# Persona-driven openers (first message + daily check-ins)

Makes the **first message** and the **daily "message of the day"** speak in the
companion's real voice + character, instead of the old templates. Reuses the
same `buildPersonaLayer` the main chat uses.

**Files:** 1 new edge function, 1 new client service, 2 client wire-ups.
**Requires deploy:** `supabase functions deploy generate-opener`.

## Why
- First message (`firstMessageService`) injected the Signature Voice but **none**
  of the questionnaire character traits — half-personalized.
- Daily message (`dailyRitualService` → `proactiveMessageService`) was **100%
  static templates** — no AI, no voice, no personality.

Both fire client-side when the chat opens, so an AI call there is fine.

## Design
One persona-aware opener generator both paths call, with the existing templates
kept as **fallbacks** so nothing can break or block. Model choice: **Sonnet for
the one-time first message** (max first impression), **Haiku for recurring
daily/reconnect** openers (cheap; the rich persona keeps quality high).

---

## 1. NEW edge function — `supabase/functions/generate-opener/index.ts`

POST `{ companionId, situation }`, returns `{ message }`.
`situation ∈ 'first_match' | 'daily_morning' | 'daily_evening' | 'daily_night' | 'reconnect'`.

Flow (mirrors `chat-turn` auth exactly):
1. Auth: service-role client, `admin.auth.getUser(token)` from the `Authorization: Bearer` header.
2. Load companion (`.eq('id', companionId).eq('user_id', user.id)`), 404 if none.
3. Load `user_profiles.name` (treat `'there'` as empty).
4. For non-`first_match`, pull the last 6 conversation rows + a gap note → a
   short "RECENT CONVERSATION … don't repeat, move forward" block for continuity.
5. `personaLayer = buildPersonaLayer(companion, userName)` (imported from
   `../_shared/personaBuilder.ts`).
6. System prompt = persona + history block + a situation-specific TASK line
   (mentor variants are goal-oriented / no romance), ending
   "Write ONLY the message text — no quotation marks, no labels, no narration."
7. Anthropic call: model per above, `max_tokens: 200`, one synthetic user turn
   `'[Begin now — send your opener.]'`. Parse ALL text blocks, strip wrapping
   quotes, 502 on empty. Return `{ message }`.

Env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`
(same as chat-turn). `_shared/personaBuilder.ts` ships with the deploy.

The full file is in the repo — copy it verbatim.

## 2. NEW client service — `src/services/openerService.ts`

```ts
export type OpenerSituation = 'first_match' | 'daily_morning' | 'daily_evening' | 'daily_night' | 'reconnect';

export async function generateOpener(companionId: string, situation: OpenerSituation): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return null;
    const url = import.meta.env.VITE_SUPABASE_URL;
    const resp = await fetch(`${url}/functions/v1/generate-opener`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ companionId, situation }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const msg = typeof data?.message === 'string' ? data.message.trim() : '';
    return msg.length > 0 ? msg : null;
  } catch { return null; }
}
```
Returns `null` on any failure → callers fall back.

## 3. Wire-up — first message (`src/App.tsx`, in `sendFirstMessage`)

Try the opener first; keep `firstMessageService.generateFirstMessage(...)` as the
fallback:
```ts
const { generateOpener } = await import('./services/openerService');
let firstMsg = await generateOpener(cid, 'first_match');
if (!firstMsg) {
  firstMsg = await firstMessageService.generateFirstMessage(
    companionData.custom_name, companionData.gender, userName, matchData,
    companionData.signature_voice, userBirthday,
    expertConfig?.domain, expertConfig, companionData.relationship_type,
  );
}
```

## 4. Wire-up — daily (`src/services/dailyRitualService.ts`, in `checkAndTriggerRituals`)

Replace the template-only `message` assignment with: try the opener, else the
existing templates.
```ts
let message: string | null = null;
try {
  const { generateOpener } = await import('./openerService');
  const situation = ({ morning: 'daily_morning', evening: 'daily_evening', night: 'daily_night' } as const)[currentTimeSlot];
  message = await generateOpener(companionId, situation);
} catch { message = null; }

if (!message) {
  if (companionRow?.relationship_type === 'mentor') {
    // ...existing domain resolve + getCoachScheduledMessage(currentTimeSlot, { domain })
  } else {
    message = ProactiveMessageService.getScheduledMessage(currentTimeSlot);
  }
}
```

---

## Deploy
```bash
supabase functions deploy generate-opener
```

## Verify
- Create a companion with a distinctive voice/traits → the **first message**
  clearly reflects that character (not generic), and differs from an
  opposite-built companion.
- Trigger a daily ritual (open chat in a morning/evening/night slot, >20h since
  last of that slot, >4h since last message) → the check-in sounds in-character
  and references recent history when there is some.
- Kill the function / go offline → first message and daily still send (template
  fallbacks); nothing blocks.

## Not included (follow-up option)
`SessionResumptionService` (the "welcome back after a break" line) is a third
opener that could route through the same generator with `situation: 'reconnect'`
— the function already supports it; only the client wire-up is pending.

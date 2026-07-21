# Companion Persona Fix — Handoff Instructions for Bolt

## The bug (critical)

The live companion chat never used the companion's personality. The chat flow is:

```
App.tsx (hub chat) → ChatService.sendMessageWithSignals() → edge function chat-turn
```

`chat-turn` built its system prompt from **one generic line** —
`"You are ${name}, a ${gender} companion having a genuine conversation with ${userName}."` —
plus a behavioral block that is identical for every companion. All the questionnaire
answers (energy, humor, flirting style, love language, availability, communication
style, expressiveness, initiative, etc.) and the selected Signature Voice were saved
to the `companions` table **but never reached the model**. Every companion was
running the same generic personality regardless of how the user built them.

The rich client-side prompt builder (`src/config/systemPromptBuilder.ts`) that did
use this data is dead code: it only runs on a legacy path gated by
`USE_SERVER_PROMPT = false` in `src/services/chatService.ts`, and the hub calls
`sendMessageWithSignals`, which goes straight to `chat-turn`.

Note: first messages were NOT affected (firstMessageService builds its own
voice-aware prompt). Only the ongoing conversation was generic.

## The fix — design

Compile a **Rope-style character sheet server-side, per message, from the data
already on the companion row**. `chat-turn` already does `select('*')` on
`companions`, so all questionnaire columns are already in the function — the fix is
pure prompt assembly. Because it reads existing columns at chat time:

- **No schema changes. No migration. No backfill.** Every existing companion is
  fixed retroactively the moment the function is deployed.
- Works for friends, romantic companions, AND coaches (coaches keep their coach
  framework + expert layer on top).

The sheet follows the Velvet Rope persona-seed format that tested so well: only
the traits the user actually chose, each translated into a direct behavioral
instruction (not a menu of all options), plus the full Signature Voice
instruction with examples, plus a "texting rhythm" block (short by default, vary
length, react first, imperfect is human).

## Files

### NEW: `supabase/functions/_shared/signatureVoicePrompts.ts`

Deno-compatible copy of the 28 Signature Voice definitions, keeping only
`{ name, instruction, examples }` per voice id, plus:

```ts
export function getVoicePrompt(voiceId: string | null | undefined, gender: string): VoicePrompt {
  if (voiceId && VOICE_PROMPTS[voiceId]) return VOICE_PROMPTS[voiceId];
  return VOICE_PROMPTS[gender === 'male' ? 'classic_male' : 'classic_female'];
}
```

It is GENERATED from `src/config/signatureVoices.ts` (edge functions can't import
from `src/`). To regenerate after a voice changes:

```bash
npx esbuild src/config/signatureVoices.ts --bundle --format=cjs --outfile=/tmp/sv.cjs
node -e "
const { SIGNATURE_VOICES } = require('/tmp/sv.cjs');
const out = {};
for (const v of SIGNATURE_VOICES) out[v.id] = { name: v.name, instruction: v.instruction, examples: v.examples || [] };
console.log(JSON.stringify(out, null, 2));
"
# paste the JSON into the VOICE_PROMPTS object in the file, keeping the header + getVoicePrompt function
```

### NEW: `supabase/functions/_shared/personaBuilder.ts`

Exports `buildPersonaLayer(companion, userName)` → string. Structure of the
output (see the file for the full mapping tables):

```
=== WHO YOU ARE: {NAME} ===
{role line — girlfriend/boyfriend | close friend | expert coach, with the
 relationship-type guardrails inline (no romance for friends/coaches)}
{never-break-character rule}

YOUR CHARACTER (built by {user} — honor every trait, every message):
- Energy: {compiled instruction from energy_preference}
- Humor: {from humor_style}
- Flirting: {from flirting_style}          ← romantic only
- Love language: {from love_language}      ← romantic only
- Dynamic: {from dynamic_preference}       ← romantic only
- Availability: {from availability_level}  ← romantic only
- Conflict: {from confrontation_style}
- Support style: {from support_style}
- Directness: {from communication_style}
- Emotional openness: {from emotional_openness}
- Depth: {from conversation_depth}
- Expressiveness: {from expressiveness}
- Initiative: {from initiative}
- Your own passions: {interest_text}
- Where {user} is right now: {life_context}

=== YOUR VOICE: {voice name} ===
{full voice.instruction + examples}
{"character is WHAT you do, voice is HOW you say it — neither overrides the other"}

ABOUT {USER}: hobbies · sports · music · favorite color · zodiac
{"weave in naturally, never list back"}

=== TEXTING RHYTHM ===
{short by default 1-3 sentences; longer only when deserved; react first;
 one question max; imperfect is human; never perform the personality}
```

Implementation details that matter:

- **Token matching, not exact matching.** Stored answers are the questionnaire
  option strings (e.g. `"Playful Teasing - Flirts Through Banter"`). Each trait
  maps via lowercase keyword tokens (`['teasing','banter'] → instruction`), so
  copy tweaks in the questionnaire don't silently break the mapping. An
  unrecognized value falls back to `"{raw value}" — embody this fully.` instead
  of being dropped.
- Missing traits are simply omitted. If ALL traits are missing, a single
  "warm, balanced, adaptable" line is used so the header is never empty.
- `userName === 'there'` (the profile placeholder) is treated as no name;
  possessives fall back to "their".
- Mentors and friends skip the romantic-only traits and get non-romantic role
  lines; mentors still get the coach framework and expert layer from the
  existing chat-turn code — the persona stacks under them.
- Output is ~800–1100 tokens for a fully-specified companion.

### MODIFIED: `supabase/functions/chat-turn/index.ts` (3 small edits)

1. Add import:
   ```ts
   import { buildPersonaLayer } from "../_shared/personaBuilder.ts";
   ```
2. Replace the `mentorIntro` const (the generic one-liner) with:
   ```ts
   const personaLayer = buildPersonaLayer(companion, profile.name);
   ```
   and swap `${mentorIntro}` → `${personaLayer}` at the top of the
   `systemPrompt` template. Also delete the now-unused
   `const companionGender = companion.gender || 'female';` line.
3. Replace the last line of the system prompt
   `IMPORTANT: Keep your response under ${maxTokens} tokens.` with:
   ```
   RESPONSE LENGTH: Default short — like a real text. Never exceed ${maxTokens} tokens, but never write long just because you can. A finished short message always beats a clipped long one.
   ```
   (The API-side `max_tokens` cap is unchanged; this stops the model from
   writing TO the cap.)

Everything else in chat-turn is untouched: moderation, tier gating, model
selection, history depth, expert layer, coach framework, memory rules, time
rules, rate limiting, signals.

## Deployment

The frontend build does not ship edge functions. After merging:

```bash
supabase functions deploy chat-turn
```

(`_shared` files deploy with the function automatically.)

## QA checklist

1. Create a companion with a strong voice (e.g. Tsundere or Jock) + distinctive
   questionnaire answers (e.g. "Sarcastic & Dry" humor, "Mysterious & Reserved"
   flirting). Chat: the voice and traits must be unmistakable within 2-3
   messages, and clearly different from a second companion built the opposite way.
2. Friend-type companion: no pet names, no flirting, still has personality.
3. Coach: professional tone intact, expert layer + accountability style intact,
   but the coach's Signature Voice now comes through.
4. Free tier (Haiku, 100 tokens): responses should read short-and-complete, not
   clipped mid-sentence.
5. A companion created long ago (pre-fix, no new columns touched): still works —
   missing traits are skipped gracefully.
6. Ask "are you an AI?" — in-character deflection, no confession.
7. Regression: calendar-event detection and navigation signals still fire;
   moderation still blocks; message decrement still happens.

## Known follow-ups (not in this change)

- `group-chat`, games trash-talk, and other edge functions have their own
  prompts and do not yet use the persona builder. Same recipe applies:
  `buildPersonaLayer(companion, userName)` + their existing framing.
- The dead client-side path in `chatService.ts` (`USE_SERVER_PROMPT`,
  `buildSystemPrompt`) can eventually be removed to avoid confusion; left
  untouched here to keep the diff minimal.
- Voice drift correction (`drift_needs_correction` on the companion row) is
  computed but not yet injected server-side; a one-line addition to the persona
  layer can add the reset instruction when that flag is true.

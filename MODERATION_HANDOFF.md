# Content Moderation System — Complete Handoff for Bolt

Self-contained deploy instructions for the AI-chat moderation layer. No git
checkout required — everything needed is in this file.

**What this does:** screens user messages to the AI companion *before* they are
stored or sent to the model, and blocks the one illegal category — sexual content
involving minors (CSAE). Blocked attempts are logged and the user is struck/banned.
Ordinary adult content is intentionally **allowed** (this is an adult product).

Three parts:
1. **Database migration** — apply via `apply_migration`.
2. **New shared module** — `supabase/functions/_shared/moderation.ts`.
3. **Edits to 3 edge functions** — then redeploy them.

> ⚠️ **Do not weaken the grants.** `record_moderation_strike` must stay
> `service_role`-only. And do **not** broaden the filter to block general adult
> content — the co-occurrence design (minor + sexual) is deliberate to avoid
> false positives on the app's normal romantic/adult use.

---

## PART 1 — Database migration

Apply exactly as written (idempotent — safe to re-run):

```sql
-- 1. Columns
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS moderation_strikes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS banned_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_user_profiles_is_banned
  ON user_profiles(is_banned)
  WHERE is_banned = true;

-- 2. Audit table (no offending content is ever stored)
CREATE TABLE IF NOT EXISTS moderation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  category text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_moderation_events_user ON moderation_events(user_id, created_at DESC);

ALTER TABLE moderation_events ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: end users get zero access. service_role bypasses RLS.

-- 3. Strike / ban RPC — service role only
CREATE OR REPLACE FUNCTION record_moderation_strike(p_user_id uuid, p_category text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  BAN_THRESHOLD constant integer := 3;  -- non-CSAE categories ban on the 3rd strike
  v_strikes integer;
BEGIN
  INSERT INTO moderation_events (user_id, category) VALUES (p_user_id, p_category);

  UPDATE user_profiles
    SET moderation_strikes = moderation_strikes + 1
    WHERE id = p_user_id
    RETURNING moderation_strikes INTO v_strikes;

  -- CSAE is zero-tolerance: ban immediately. Other categories: ban at threshold.
  IF p_category = 'csae' OR v_strikes >= BAN_THRESHOLD THEN
    UPDATE user_profiles
      SET is_banned = true, banned_at = now()
      WHERE id = p_user_id AND is_banned = false;
  END IF;

  RETURN coalesce(v_strikes, 0);
END;
$$;

REVOKE ALL ON FUNCTION record_moderation_strike(uuid, text) FROM public;
REVOKE ALL ON FUNCTION record_moderation_strike(uuid, text) FROM authenticated;
REVOKE ALL ON FUNCTION record_moderation_strike(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION record_moderation_strike(uuid, text) TO service_role;
```

---

## PART 2 — New shared module

Create the file **`supabase/functions/_shared/moderation.ts`** with exactly this content:

```ts
// Shared content-moderation for the AI chat surfaces (chat, chat-turn, group-chat).
//
// SCOPE: This is an adult companion product, so ordinary adult/romantic content
// is allowed by design. This filter targets the one category that is illegal and
// non-negotiable: sexual content involving minors (CSAE). It runs BEFORE the user
// message is stored or sent to the model, so disallowed input never lands in the
// database and never reaches the API.

export type ModerationCategory = 'csae';

export interface ModerationResult {
  action: 'allow' | 'block';
  category: ModerationCategory | null;
}

function normalizeForms(input: string): { digits: string; deleet: string } {
  const lowered = input.toLowerCase();
  const collapse = (s: string) => {
    const spaced = s.replace(/[^a-z0-9]+/g, ' ').trim();
    return spaced + ' ' + spaced.replace(/\s+/g, '');
  };
  const deleet = lowered
    .replace(/[@4]/g, 'a')
    .replace(/[0]/g, 'o')
    .replace(/[1!|]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[$5]/g, 's')
    .replace(/[7]/g, 't');
  return { digits: collapse(lowered), deleet: collapse(deleet) };
}

const ZERO_TOLERANCE: RegExp[] = [
  /child\s*p[o]rn/,
  /\bcsam\b/,
  /\bcsae\b/,
  /\bloli(con)?\b/,
  /\bshota(con)?\b/,
  /\bjailbait\b/,
  /\bpedo(phil(e|ia))?\b/,
  /(under\s*age|underage)\s*(sex|porn|nud|naked|xxx)/,
  /child\s*(sex|porn|nud|naked|molest)/,
  /(minor|kid|child)\s*(sexual|fuck|blowjob|nude|naked)/,
  /(sex|fuck|rape|molest)\w*\s*(a\s*)?(child|minor|kid|toddler|infant)/,
];

const MINOR_INDICATORS: RegExp[] = [
  /\b(child|children|kid|kids|minor|minors|underage|under\s*age)\b/,
  /\b(toddler|infant|baby|preteen|pre\s*teen|tween)\b/,
  /\b(little\s*(girl|boy)|schoolgirl|schoolboy)\b/,
  /\b(elementary|middle\s*school|grade\s*school|kindergarten)\b/,
  /\b([1-9]|1[0-7])\s*(yo|y\/o|yr?s?\s*old|year[\s-]*old|years?\s*old)\b/,
];

const SEXUAL_INDICATORS: RegExp[] = [
  /\b(sex|sexual|sexy|nude|naked|nud|porn|xxx|horny|aroused)\b/,
  /\b(fuck|fucking|blowjob|handjob|cum|orgasm|masturbat|penetrat)\b/,
  /\b(penis|vagina|pussy|dick|cock|boobs|breasts|genital|nipple)\b/,
  /\b(molest|rape|fondle|grope|undress|strip)\b/,
];

function anyMatch(patterns: RegExp[], forms: string[]): boolean {
  return patterns.some((re) => forms.some((f) => re.test(f)));
}

export function screenText(raw: string): ModerationResult {
  if (!raw || typeof raw !== 'string') return { action: 'allow', category: null };
  const { digits, deleet } = normalizeForms(raw);

  if (anyMatch(ZERO_TOLERANCE, [digits, deleet])) {
    return { action: 'block', category: 'csae' };
  }
  const hasMinor = anyMatch(MINOR_INDICATORS, [digits, deleet]);
  const hasSexual = anyMatch(SEXUAL_INDICATORS, [digits, deleet]);
  if (hasMinor && hasSexual) {
    return { action: 'block', category: 'csae' };
  }
  return { action: 'allow', category: null };
}

export async function recordModerationStrike(
  supabaseAdmin: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> },
  userId: string,
  category: ModerationCategory,
): Promise<number | null> {
  try {
    const { data, error } = await supabaseAdmin.rpc('record_moderation_strike', {
      p_user_id: userId,
      p_category: category,
    });
    if (error) return null;
    return typeof data === 'number' ? data : null;
  } catch {
    return null;
  }
}

export const MODERATION_REFUSAL =
  "This request was blocked for violating our content policy. Sexual content involving minors is strictly prohibited and this attempt has been logged. Repeated violations will result in a permanent ban.";
```

---

## PART 3 — Edit the 3 edge functions, then redeploy

Add the import to the top of each file (below the existing `modelConfig` import):

```ts
import { screenText, recordModerationStrike, MODERATION_REFUSAL } from "../_shared/moderation.ts";
```

### 3a. `supabase/functions/chat/index.ts`

**Add `is_banned` to the profile select + a ban check.** Find:
```ts
      .select('subscription_tier, messages_remaining, is_test_user, referred_by, referral_qualified')
      .eq('id', user.id)
      .maybeSingle();

    const isTestUser = profile?.is_test_user === true;
```
Replace with:
```ts
      .select('subscription_tier, messages_remaining, is_test_user, referred_by, referral_qualified, is_banned')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.is_banned === true) {
      return new Response(
        JSON.stringify({ error: 'Account suspended', message: 'Your account has been suspended for violating our content policy.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isTestUser = profile?.is_test_user === true;
```

**Add the input screen.** Find:
```ts
    if (totalContentChars > 150000) {
      return validationError('total message content exceeds 150,000 characters');
    }
```
Add immediately after it:
```ts

    const lastUserMessage = [...validatedMessages].reverse().find((m) => m.role === 'user');
    if (lastUserMessage) {
      const inputScreen = screenText(lastUserMessage.content);
      if (inputScreen.action === 'block') {
        console.warn(`Blocked input, category=${inputScreen.category}, user=${user.id}`);
        await recordModerationStrike(supabaseAdmin, user.id, inputScreen.category!);
        return new Response(
          JSON.stringify({ error: 'Content policy violation', message: MODERATION_REFUSAL }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
```

### 3b. `supabase/functions/chat-turn/index.ts`

This function selects `*`, so no select change. Find:
```ts
    console.log(`[${traceId}] Chat turn request:`, { userId: user.id, companionId, mode, messageLength: message.length });

    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      throw new Error('User profile not found');
    }

    const isTestUser = profile.is_test_user === true;
```
Replace with:
```ts
    console.log(`[${traceId}] Chat turn request:`, { userId: user.id, companionId, mode, messageLength: message.length });

    const inputScreen = screenText(message);
    if (inputScreen.action === 'block') {
      console.warn(`[${traceId}] Blocked input, category=${inputScreen.category}, user=${user.id}`);
      await recordModerationStrike(supabaseAdmin, user.id, inputScreen.category!);
      return new Response(
        JSON.stringify({ error: 'Content policy violation', message: MODERATION_REFUSAL }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) {
      throw new Error('User profile not found');
    }

    if (profile.is_banned === true) {
      return new Response(
        JSON.stringify({ error: 'Account suspended', message: 'Your account has been suspended for violating our content policy.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const isTestUser = profile.is_test_user === true;
```

### 3c. `supabase/functions/group-chat/index.ts`

**Add `is_banned` to the select + a ban check.** Find:
```ts
      .select('subscription_tier, messages_remaining, is_test_user, name, referred_by, referral_qualified')
      .eq('id', user.id)
      .maybeSingle();

    const isTestUser = profile?.is_test_user === true;
```
Replace with:
```ts
      .select('subscription_tier, messages_remaining, is_test_user, name, referred_by, referral_qualified, is_banned')
      .eq('id', user.id)
      .maybeSingle();

    if (profile?.is_banned === true) {
      return new Response(
        JSON.stringify({ error: 'Account suspended', message: 'Your account has been suspended for violating our content policy.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isTestUser = profile?.is_test_user === true;
```

**Add the input screen.** Find:
```ts
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error('Server configuration error: API key not set');

    const userName = profile?.name || 'User';
```
Replace with:
```ts
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) throw new Error('Server configuration error: API key not set');

    if (userMessage) {
      const inputScreen = screenText(userMessage);
      if (inputScreen.action === 'block') {
        console.warn(`Blocked group-chat input, category=${inputScreen.category}, user=${user.id}`);
        await recordModerationStrike(supabaseAdmin, user.id, inputScreen.category!);
        return new Response(
          JSON.stringify({ error: 'Content policy violation', message: MODERATION_REFUSAL }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const userName = profile?.name || 'User';
```

**Then redeploy `chat`, `chat-turn`, and `group-chat`.**

---

## PART 4 — Verify

Do this with a THROWAWAY test account (it will get banned):

1. Send a normal flirty message → it works (adult content is allowed).
2. Send a message combining a minor reference with sexual content → you get a
   403 "Content policy violation", the message is **not** stored, and a row
   appears in `moderation_events`.
3. That test account's `user_profiles.is_banned` is now `true`; any further chat
   returns 403 "Account suspended".

If step 1 gets blocked → the filter is too aggressive (check you copied the
co-occurrence logic, not a broader version). If step 2 is NOT blocked → the
shared module wasn't created or the edge functions weren't redeployed.

## Tuning later
- Ban threshold for non-CSAE categories: `BAN_THRESHOLD` in `record_moderation_strike`.
- Detection lists: `ZERO_TOLERANCE`, `MINOR_INDICATORS`, `SEXUAL_INDICATORS` in `moderation.ts`.
- The filter is a first line of defense; the model's own refusals remain the second.

# Referral / Invitation System — Complete Handoff for Bolt

This document contains **everything** needed to deploy the activation-based
referral system into a project that does NOT have the git branch. Bolt: apply
these changes to the live project and deploy. Nothing here needs a git checkout.

There are 3 parts:
1. **Database migration** — apply via `apply_migration`. (Sensitive — do not alter the grants.)
2. **Edge function changes** — 3 existing functions get a few added lines.
3. **Frontend** — 2 new files + 4 small edits.

> ⚠️ **Critical anti-fraud rule:** `track_referral_progress` MUST remain
> `service_role`-only. Do not grant it to `authenticated` or `anon`. That
> restriction is what stops users from faking their message count to farm rewards.

---

## PART 1 — Database migration

Apply this exactly as written (it is idempotent — safe to run more than once):

```sql
-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_qualified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS messages_sent_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_reward_count integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_referral_code
  ON user_profiles(referral_code)
  WHERE referral_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_referred_by
  ON user_profiles(referred_by)
  WHERE referred_by IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profiles_no_self_referral'
  ) THEN
    ALTER TABLE user_profiles
      ADD CONSTRAINT user_profiles_no_self_referral CHECK (referred_by IS NULL OR referred_by <> id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Code generator (7-char, unambiguous alphabet)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  candidate text;
  i integer;
BEGIN
  LOOP
    candidate := '';
    FOR i IN 1..7 LOOP
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM user_profiles WHERE referral_code = candidate);
  END LOOP;
  RETURN candidate;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Backfill codes for existing users
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM user_profiles WHERE referral_code IS NULL LOOP
    UPDATE user_profiles SET referral_code = generate_referral_code() WHERE id = r.id;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Assign a code to every new user (extends existing handle_new_user)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, name, referral_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'user_name', 'there'),
    generate_referral_code()
  )
  ON CONFLICT (id) DO UPDATE
    SET referral_code = COALESCE(user_profiles.referral_code, EXCLUDED.referral_code);
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Audit table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL UNIQUE REFERENCES user_profiles(id) ON DELETE CASCADE,
  code_used text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'qualified')),
  referrer_reward integer NOT NULL DEFAULT 0,
  referred_reward integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  qualified_at timestamptz,
  CHECK (referrer_id <> referred_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Referrer reads own referrals" ON referrals;
CREATE POLICY "Referrer reads own referrals"
  ON referrals FOR SELECT TO authenticated
  USING (referrer_id = auth.uid() OR referred_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 6. redeem_referral_code — invitee attaches to a referrer (once)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION redeem_referral_code(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_referrer_id uuid;
  v_normalized text := upper(trim(p_code));
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  END IF;

  IF EXISTS (SELECT 1 FROM user_profiles WHERE id = v_uid AND referred_by IS NOT NULL) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_referred');
  END IF;

  SELECT id INTO v_referrer_id FROM user_profiles WHERE referral_code = v_normalized;

  IF v_referrer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code');
  END IF;

  IF v_referrer_id = v_uid THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'self_referral');
  END IF;

  UPDATE user_profiles SET referred_by = v_referrer_id WHERE id = v_uid AND referred_by IS NULL;

  INSERT INTO referrals (referrer_id, referred_user_id, code_used, status)
  VALUES (v_referrer_id, v_uid, v_normalized, 'pending')
  ON CONFLICT (referred_user_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'reason', 'redeemed');
END;
$$;

REVOKE ALL ON FUNCTION redeem_referral_code(text) FROM public;
GRANT EXECUTE ON FUNCTION redeem_referral_code(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. track_referral_progress — SERVICE ROLE ONLY. Activation gate + payout.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION track_referral_progress(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ACTIVATION_THRESHOLD constant integer := 10;
  REFERRER_REWARD      constant integer := 50;
  REFERRED_REWARD      constant integer := 25;
  REFERRER_REWARD_CAP  constant integer := 100;

  v_total integer;
  v_referrer_id uuid;
  v_qualified boolean;
BEGIN
  UPDATE user_profiles
    SET messages_sent_total = messages_sent_total + 1
    WHERE id = p_user_id
    RETURNING messages_sent_total, referred_by, referral_qualified
    INTO v_total, v_referrer_id, v_qualified;

  IF v_referrer_id IS NULL OR v_qualified OR v_total < ACTIVATION_THRESHOLD THEN
    RETURN;
  END IF;

  UPDATE user_profiles
    SET referral_qualified = true
    WHERE id = p_user_id AND referral_qualified = false;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE user_profiles
    SET messages_remaining = CASE WHEN messages_remaining = -1 THEN -1
                                  ELSE messages_remaining + REFERRER_REWARD END,
        referral_reward_count = referral_reward_count + 1
    WHERE id = v_referrer_id
      AND referral_reward_count < REFERRER_REWARD_CAP;

  IF FOUND THEN
    UPDATE user_profiles
      SET messages_remaining = CASE WHEN messages_remaining = -1 THEN -1
                                    ELSE messages_remaining + REFERRED_REWARD END
      WHERE id = p_user_id;

    UPDATE referrals
      SET status = 'qualified',
          qualified_at = now(),
          referrer_reward = REFERRER_REWARD,
          referred_reward = REFERRED_REWARD
      WHERE referred_user_id = p_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION track_referral_progress(uuid) FROM public;
REVOKE ALL ON FUNCTION track_referral_progress(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION track_referral_progress(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION track_referral_progress(uuid) TO service_role;
```

---

## PART 2 — Edge function changes (3 functions)

Each of these existing functions already decrements `messages_remaining` after a
successful message. Add a call to `track_referral_progress` right after that, and
(for two of them) add two columns to the profile `select`. Then redeploy all three.

### 2a. `supabase/functions/chat/index.ts`

**Add two columns to the profile select.** Find:
```ts
      .select('subscription_tier, messages_remaining, is_test_user')
```
Replace with:
```ts
      .select('subscription_tier, messages_remaining, is_test_user, referred_by, referral_qualified')
```

**Add the tracking call.** Find the block that ends the decrement (just before `return new Response(JSON.stringify(data)`):
```ts
      console.log('Message count decremented:', messagesRemaining, '->', newCount);
    }

    return new Response(JSON.stringify(data), {
```
Replace with:
```ts
      console.log('Message count decremented:', messagesRemaining, '->', newCount);
    }

    // Referral activation: reward the inviter once this user is genuinely engaged.
    if (profile?.referred_by && !profile?.referral_qualified) {
      await supabaseAdmin.rpc('track_referral_progress', { p_user_id: user.id });
    }

    return new Response(JSON.stringify(data), {
```

### 2b. `supabase/functions/chat-turn/index.ts`

This one already selects `*`, so no select change. Find:
```ts
        .update({ messages_remaining: newCount })
        .eq('id', user.id);
      console.log(`[${traceId}] Message count decremented:`, messagesRemaining, '->', newCount);
    }
```
Add immediately after it:
```ts

    // Referral activation: reward the inviter once this user is genuinely engaged.
    // Runs for every tier (incl. unlimited) so paid invitees still qualify.
    if (profile.referred_by && !profile.referral_qualified) {
      await supabaseAdmin.rpc('track_referral_progress', { p_user_id: user.id });
    }
```

### 2c. `supabase/functions/group-chat/index.ts`

**Add two columns to the profile select.** Find:
```ts
      .select('subscription_tier, messages_remaining, is_test_user, name')
```
Replace with:
```ts
      .select('subscription_tier, messages_remaining, is_test_user, name, referred_by, referral_qualified')
```

**Add the tracking call.** Find:
```ts
        .update({ messages_remaining: newCount })
        .eq('id', user.id);
    }

    return new Response(JSON.stringify({ responses }), {
```
Replace with:
```ts
        .update({ messages_remaining: newCount })
        .eq('id', user.id);
    }

    // Referral activation: reward the inviter once this user is genuinely engaged.
    if (profile?.referred_by && !profile?.referral_qualified) {
      await supabaseAdmin.rpc('track_referral_progress', { p_user_id: user.id });
    }

    return new Response(JSON.stringify({ responses }), {
```

**Then redeploy `chat`, `chat-turn`, and `group-chat`.**

---

## PART 3 — Frontend

### 3a. NEW FILE: `src/services/referralService.ts`

```ts
import { supabase } from '../shared/supabase/client';

const PENDING_CODE_KEY = 'velvet_pending_referral_code';

export interface ReferralSummary {
  code: string | null;
  inviteLink: string | null;
  invitedCount: number;
  qualifiedCount: number;
  pendingCount: number;
  rewardMessagesEarned: number;
}

export interface ReferralRow {
  referred_user_id: string;
  status: 'pending' | 'qualified';
  referrer_reward: number;
  created_at: string;
  qualified_at: string | null;
}

class ReferralService {
  captureRefFromUrl(): void {
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('ref');
      if (code && code.trim()) {
        localStorage.setItem(PENDING_CODE_KEY, code.trim().toUpperCase());
      }
    } catch {
      /* SSR / storage unavailable — non-fatal */
    }
  }

  getPendingCode(): string | null {
    try {
      return localStorage.getItem(PENDING_CODE_KEY);
    } catch {
      return null;
    }
  }

  async redeemPendingReferral(): Promise<void> {
    const code = this.getPendingCode();
    if (!code) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const { data, error } = await supabase.rpc('redeem_referral_code', { p_code: code });
      if (error) return;

      const reason = (data as { reason?: string } | null)?.reason;
      if (reason) localStorage.removeItem(PENDING_CODE_KEY);
    } catch {
      /* network — keep stash, retry next boot */
    }
  }

  buildInviteLink(code: string): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/signup?ref=${encodeURIComponent(code)}`;
  }

  async getSummary(): Promise<ReferralSummary> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { code: null, inviteLink: null, invitedCount: 0, qualifiedCount: 0, pendingCount: 0, rewardMessagesEarned: 0 };
    }

    const [{ data: profile }, { data: rows }] = await Promise.all([
      supabase.from('user_profiles').select('referral_code').eq('id', user.id).maybeSingle(),
      supabase
        .from('referrals')
        .select('referred_user_id, status, referrer_reward, created_at, qualified_at')
        .eq('referrer_id', user.id),
    ]);

    const referrals = (rows ?? []) as ReferralRow[];
    const qualified = referrals.filter((r) => r.status === 'qualified');
    const code = profile?.referral_code ?? null;

    return {
      code,
      inviteLink: code ? this.buildInviteLink(code) : null,
      invitedCount: referrals.length,
      qualifiedCount: qualified.length,
      pendingCount: referrals.length - qualified.length,
      rewardMessagesEarned: qualified.reduce((sum, r) => sum + (r.referrer_reward || 0), 0),
    };
  }
}

export const referralService = new ReferralService();
```

### 3b. NEW FILE: `src/pages/InvitePage.tsx`

> The full source is in the repo at `src/pages/InvitePage.tsx`. It renders the
> user's code, a copyable invite link, a share button, and 3 stat tiles
> (Invited / Activated / Msgs earned). It imports `referralService` and `toast`
> from `../shared/ui`. If you need it regenerated, ask — it's ~180 lines of
> presentational React with no new logic. A minimal version is enough to ship:
> call `referralService.getSummary()` on mount, show `summary.code` and
> `summary.inviteLink`, and a copy button.

### 3c. EDIT `src/pages/SignUpPage.tsx`

- Add import: `import { referralService } from '../services/referralService';`
- Change `import { useState } from 'react';` to `import { useState, useEffect } from 'react';`
- Inside the component, add: `useEffect(() => { referralService.captureRefFromUrl(); }, []);`
- After the `await authService.signUp(...)` call and before `navigate('/welcome')`, add:
  `await referralService.redeemPendingReferral();`

### 3d. EDIT `src/auth/AuthProvider.tsx`

- Add import: `import { referralService } from '../services/referralService';`
- In the `onAuthStateChange` callback, after `setLoading(false);`, add:
  ```ts
  if (newSession) {
    referralService.redeemPendingReferral().catch(() => {});
  }
  ```

### 3e. EDIT `src/routes/appRoutes.tsx`

- Add lazy import next to the other page imports:
  ```ts
  const InvitePage = lazy(() => import('../pages/InvitePage').then(m => ({ default: m.InvitePage })));
  ```
- Add a route inside the `appRoutes` array:
  ```tsx
  <Route key="invite" path="/invite" element={P(<InvitePage />)} />,
  ```

### 3f. EDIT `src/components/ChatHeader.tsx` (optional entry point)

Add `Gift` to the `lucide-react` import, and an "Invite friends" button in the
settings dropdown that calls `navigate('/invite')`. Optional but recommended so
users can find the page.

---

## PART 4 — Verify

1. New signup → visit `/invite` → a 7-char code appears. *(migration ran)*
2. Open `/signup?ref=THATCODE` in a private window → sign up as a 2nd user.
3. In Supabase, `referrals` table has one row, status `pending`.
4. As the 2nd user, send **10 messages**.
5. Row flips to `qualified`; referrer `messages_remaining` +50, invitee +25. *(edge functions redeployed)*

If step 1 shows no code → migration didn't run.
If step 5 never fires → edge functions weren't redeployed.

To change the economy later, edit the four `constant` values at the top of
`track_referral_progress` (threshold, referrer reward, invitee reward, cap).

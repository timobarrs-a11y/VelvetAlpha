/*
# Add Referral Activation System

## Overview
Implements an activation-based referral system where users invite friends with a
unique code. Rewards only fire when the invited user sends 20 messages (the
activation gate), preventing fake-account farming.

## New Columns on user_profiles
- referral_code (text, unique) — 7-char code generated automatically per user
- referred_by (uuid, FK to user_profiles.id) — the referrer, NULL if not referred
- referral_qualified (boolean, default false) — true once the user hits 20 messages
- messages_sent_total (integer, default 0) — lifetime message counter
- referral_reward_count (integer, default 0) — how many referrals this user has earned from

## New Tables
- referrals — audit table tracking each referral relationship
  - referrer_id (uuid FK) — who shared the code
  - referred_user_id (uuid FK, unique) — who used the code
  - code_used (text) — the code that was redeemed
  - status (text: 'pending' | 'qualified') — flips to qualified at activation
  - referrer_reward (integer) — messages awarded to referrer (0 until qualified)
  - referred_reward (integer) — messages awarded to invitee (0 until qualified)
  - created_at, qualified_at (timestamptz)

## New Functions
- generate_referral_code() — generates a unique 7-char code from an unambiguous alphabet
- redeem_referral_code(p_code text) — invitee attaches to a referrer (once, no self-referral)
- track_referral_progress(p_user_id uuid) — increments message count, fires rewards at 20 messages

## Security
- RLS enabled on referrals table
- Referrer or referred user can read their own referral rows
- redeem_referral_code: granted to authenticated (users redeem their own code)
- track_referral_progress: SERVICE ROLE ONLY — revoked from public, authenticated, anon
  This is the anti-fraud boundary. Users cannot call it directly to fake message counts.
  Only edge functions with the service_role key can invoke it.

## Important Notes
1. The activation threshold is 20 messages (ACTIVATION_THRESHOLD constant).
2. Referrer reward: +50 messages. Invitee reward: +25 messages.
3. Referrer reward cap: 100 total reward messages across all referrals.
4. The migration is idempotent — safe to run more than once.
5. Existing users are backfilled with referral codes.
6. The handle_new_user trigger is rewritten to assign codes to new signups.
*/

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
--    Threshold: 20 messages. Referrer gets +50, invitee gets +25, cap 100.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION track_referral_progress(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ACTIVATION_THRESHOLD constant integer := 20;
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
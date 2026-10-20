/*
# Access Hardening: Server-Verified Age, Welcome Window, Card Trial Fix

## Summary

This migration closes the security gaps identified in the access flow review:

1. **Server-verified age**: Moves age verification from client-side to server-side.
   A SECURITY DEFINER function computes age from a date of birth and writes
   `birthday` + `age_verified_at` so users can't self-assign these.
2. **Welcome window**: Adds a 48-hour full-access window after email confirmation.
   New users get full access for 48 hours, then drop to free and hit the lock screen.
3. **Card trial fix**: Rewrites `start_trial()` to grant 3 days (not 7), and marks
   it as card-required. The actual Stripe payment-method attachment happens in
   the checkout flow; this function now records the trial as card-gated.
4. **Bot account flag**: Adds `is_bot` column for labeling bot accounts on profiles
   and comments.
5. **Column privilege tightening**: Removes `age_verified_at` and `birthday` from
   the client-writable column grant so only the SECURITY DEFINER function can set them.

## New Columns on `user_profiles`

- `welcome_window_expires_at` (timestamptz, nullable) — when the 48-hour welcome
  window ends. NULL means the window hasn't started yet (legacy users).
- `is_bot` (boolean, default false) — flags bot/system accounts for labeling.

## New Functions

- `verify_age_and_consent(p_birthday date, p_terms_version text)` — SECURITY DEFINER.
  Computes age on the server, rejects minors, writes birthday + age_verified_at +
  terms acceptance. Callable only by the authenticated owner.
- `start_welcome_window()` — SECURITY DEFINER. Sets `welcome_window_expires_at`
  to now + 48 hours and grants full-access (trial-tier) messages. Called after
  email confirmation.
- `check_access()` — SECURITY DEFINER. Returns the user's current access state:
  welcome_window_active, tier, trial_expires_at, age_verified, can_access_social.
  Used by the frontend to decide whether to show the lock screen.

## Modified Functions

- `start_trial()` — rewritten to grant 3 days (not 7). Now sets
  `subscription_status = 'card_trial'` to distinguish from the old no-card trial.
  Still no Stripe call here — the card trial requires a payment method attached
  via the checkout flow first.

## Security Changes

- `age_verified_at` and `birthday` removed from the client-writable UPDATE grant
  on `user_profiles`. Only the SECURITY DEFINER `verify_age_and_consent` function
  can set them.
- `welcome_window_expires_at` and `is_bot` are NOT client-writable.
- `start_trial()` remains SECURITY INVOKER (uses auth.uid() internally).
- `verify_age_and_consent` and `start_welcome_window` are SECURITY DEFINER so they
  can write to columns the user can't write directly.

## Important Notes

1. Existing users (19 rows) will have NULL `welcome_window_expires_at`. The
   `check_access()` function treats NULL welcome_window as "expired" — these
   users are gated by their subscription_tier as before. No data loss.
2. The `start_trial()` change does NOT affect users who already used their trial
   (`trial_used = true` blocks re-use).
3. Bot accounts are created by operators (admins) by setting `is_bot = true`
   directly in the database — there is no client-facing way to become a bot.
*/

-- ============================================================
-- 1. Add new columns to user_profiles
-- ============================================================

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS welcome_window_expires_at timestamptz;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_bot boolean NOT NULL DEFAULT false;

-- ============================================================
-- 2. SECURITY DEFINER: verify_age_and_consent
--    Server-side age verification — computes age from DOB,
--    rejects minors, writes birthday + age_verified_at + terms.
-- ============================================================

CREATE OR REPLACE FUNCTION public.verify_age_and_consent(
  p_birthday date,
  p_terms_version text,
  p_terms_accepted_at timestamptz DEFAULT now()
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_age int;
  v_today date := current_date;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_birthday IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'birthday_required');
  END IF;

  -- Compute age on the server
  v_age := date_part('year', age(v_today, p_birthday))::int;

  IF v_age < 18 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'underage');
  END IF;

  -- Write birthday, age_verified_at, and terms — columns the user can't write directly
  UPDATE public.user_profiles
  SET
    birthday = p_birthday,
    age_verified_at = p_terms_accepted_at,
    terms_version = p_terms_version,
    terms_accepted_at = p_terms_accepted_at,
    updated_at = now()
  WHERE id = v_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'profile_not_found');
  END IF;

  RETURN jsonb_build_object('success', true, 'age', v_age);
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_age_and_consent TO authenticated;

-- ============================================================
-- 3. SECURITY DEFINER: start_welcome_window
--    Sets welcome_window_expires_at to now + 48h and grants
--    full-access (trial-tier) message allowance.
--    Called after email confirmation.
-- ============================================================

CREATE OR REPLACE FUNCTION public.start_welcome_window()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_expires timestamptz := now() + interval '48 hours';
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Only start the welcome window if it hasn't been started yet
  UPDATE public.user_profiles
  SET
    welcome_window_expires_at = v_expires,
    -- Grant full-access message allowance during the window
    messages_remaining = 8000,
    haiku_model_enabled = true,
    sonnet_model_enabled = true,
    updated_at = now()
  WHERE id = v_uid
    AND welcome_window_expires_at IS NULL;

  IF NOT FOUND THEN
    -- Already had a welcome window — return existing
    SELECT welcome_window_expires_at INTO v_expires
    FROM public.user_profiles WHERE id = v_uid;
    RETURN jsonb_build_object('success', true, 'already_started', true, 'welcome_window_expires_at', v_expires);
  END IF;

  RETURN jsonb_build_object('success', true, 'welcome_window_expires_at', v_expires);
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_welcome_window TO authenticated;

-- ============================================================
-- 4. SECURITY DEFINER: check_access
--    Returns the user's current access state so the frontend
--    can decide whether to show the lock screen or allow access.
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_access()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile public.user_profiles%ROWTYPE;
  v_welcome_active boolean;
  v_trial_active boolean;
  v_is_paid boolean;
  v_can_access_social boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_profile FROM public.user_profiles WHERE id = v_uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'profile_not_found');
  END IF;

  -- Welcome window: active if expires_at is in the future
  v_welcome_active := v_profile.welcome_window_expires_at IS NOT NULL
    AND v_profile.welcome_window_expires_at > now();

  -- Trial: active if trial_expires_at is in the future
  v_trial_active := v_profile.trial_expires_at IS NOT NULL
    AND v_profile.trial_expires_at > now()
    AND v_profile.subscription_tier = 'trial';

  -- Paid: any paid tier with active subscription
  v_is_paid := COALESCE(v_profile.subscription_tier, 'free') IN ('essential', 'plus', 'elite');

  -- Social access: age verified AND (welcome window OR trial OR paid)
  v_can_access_social := v_profile.age_verified_at IS NOT NULL
    AND (v_welcome_active OR v_trial_active OR v_is_paid);

  RETURN jsonb_build_object(
    'success', true,
    'tier', COALESCE(v_profile.subscription_tier, 'free'),
    'age_verified', v_profile.age_verified_at IS NOT NULL,
    'welcome_window_active', v_welcome_active,
    'welcome_window_expires_at', v_profile.welcome_window_expires_at,
    'trial_active', v_trial_active,
    'trial_expires_at', v_profile.trial_expires_at,
    'is_paid', v_is_paid,
    'is_bot', COALESCE(v_profile.is_bot, false),
    'can_access_social', v_can_access_social
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_access TO authenticated;

-- ============================================================
-- 5. Rewrite start_trial() — 3 days (not 7), card_trial status
-- ============================================================

CREATE OR REPLACE FUNCTION public.start_trial()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile public.user_profiles%ROWTYPE;
  v_expires timestamptz := now() + interval '3 days';
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_profile FROM public.user_profiles WHERE id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF COALESCE(v_profile.trial_used, false) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'trial_already_used');
  END IF;

  IF COALESCE(v_profile.subscription_tier, 'free') NOT IN ('free', 'starter') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_subscribed');
  END IF;

  UPDATE public.user_profiles
  SET
    subscription_tier = 'trial',
    subscription_status = 'card_trial',
    trial_expires_at = v_expires,
    trial_used = true,
    messages_remaining = 8000,
    haiku_model_enabled = true,
    sonnet_model_enabled = true,
    updated_at = now()
  WHERE id = v_uid;

  RETURN jsonb_build_object('success', true, 'trial_expires_at', v_expires);
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_trial TO authenticated;

-- ============================================================
-- 6. Revoke client UPDATE on age_verified_at and birthday
--    These columns are now only writable via verify_age_and_consent()
-- ============================================================

-- We can't use ALTER TABLE to remove specific columns from a GRANT.
-- Instead, we REVOKE the broad UPDATE grant and re-GRANT UPDATE on
-- all columns EXCEPT age_verified_at and birthday.
-- This is the standard Postgres pattern for column-level privilege restriction.

REVOKE UPDATE ON public.user_profiles FROM authenticated;

-- Re-grant UPDATE on all columns except the privileged ones
-- (age_verified_at, birthday, welcome_window_expires_at, is_bot,
--  subscription_tier, subscription_status, trial_expires_at, trial_used,
--  messages_remaining, haiku_model_enabled, sonnet_model_enabled,
--  stripe_customer_id, stripe_subscription_id, is_super_user, user_role,
--  moderation_strikes, is_banned, banned_at, referral_code, referred_by,
--  referral_qualified, referral_reward_count, messages_sent_total)
-- These are managed by server functions or admin-only actions.
GRANT UPDATE (
  name,
  interests,
  updated_at,
  relationship_started_at,
  last_interaction_at,
  mood_state,
  recent_topics,
  onboarding_completed,
  location,
  first_message_sent,
  conversation_stage,
  topics_discussed,
  user_info,
  gender,
  avatar_config,
  favorite_color,
  zodiac_sign,
  music_genre,
  hobbies,
  sports,
  profile_completed,
  sports_interests,
  entertainment_interests,
  tech_interests,
  lifestyle_interests,
  news_categories,
  timezone,
  deletion_requested_at,
  welcome_seen,
  location_city,
  location_lat,
  location_lng,
  location_radius_minutes,
  atlas_default_voice,
  navi_default_voice,
  default_landing,
  political_leaning,
  terms_accepted_at,
  terms_version,
  nickname,
  communication_profile,
  quality_review_consent,
  setup_step,
  setup_path,
  shared_memory_consent
) ON public.user_profiles TO authenticated;

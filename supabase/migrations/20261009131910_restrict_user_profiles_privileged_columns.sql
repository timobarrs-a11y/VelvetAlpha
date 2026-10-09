-- Findings F1-F8: row-level policies on user_profiles do not restrict which COLUMNS
-- a user may write. Narrow the UPDATE privilege to user-content columns only, so
-- privilege, entitlement, billing, moderation and quota columns become server-only.

REVOKE UPDATE ON public.user_profiles FROM authenticated;
REVOKE UPDATE ON public.user_profiles FROM anon;

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
  birthday,
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
  age_verified_at,
  nickname,
  communication_profile,
  quality_review_consent,
  setup_step,
  setup_path,
  shared_memory_consent
) ON public.user_profiles TO authenticated;

-- F6: trial activation was performed by the browser, so the "already used" check was
-- client side only. Re-check it server side.
CREATE OR REPLACE FUNCTION public.start_trial()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile public.user_profiles%ROWTYPE;
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
  SET subscription_tier = 'trial',
      subscription_status = 'trialing',
      trial_expires_at = now() + interval '7 days',
      trial_used = true,
      messages_remaining = 8000,
      haiku_model_enabled = true,
      sonnet_model_enabled = true,
      updated_at = now()
  WHERE id = v_uid;

  RETURN jsonb_build_object(
    'success', true,
    'trial_expires_at', (now() + interval '7 days')
  );
END;
$$;

-- F2 / F3: admins still need to change roles and tiers, but must not do it through a
-- blanket column grant. These functions re-verify the caller is an admin server side.
CREATE OR REPLACE FUNCTION public.admin_set_user_role(p_target_user_id uuid, p_role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = v_uid AND (user_role = 'admin' OR is_super_user = true)
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_role NOT IN ('user', 'manager', 'admin') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  UPDATE public.user_profiles
  SET user_role = p_role, updated_at = now()
  WHERE id = p_target_user_id;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_subscription_tier(p_target_user_id uuid, p_tier text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = v_uid AND (user_role = 'admin' OR is_super_user = true)
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_tier NOT IN ('free', 'starter', 'trial', 'essential', 'plus', 'elite', 'unlimited') THEN
    RAISE EXCEPTION 'Invalid tier';
  END IF;

  UPDATE public.user_profiles
  SET subscription_tier = p_tier, updated_at = now()
  WHERE id = p_target_user_id;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.start_trial() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_subscription_tier(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_trial() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_subscription_tier(uuid, text) TO authenticated;

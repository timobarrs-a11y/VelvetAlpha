/*
# Security Hardening + Access Functions

## Summary

1. Fixes mutable `search_path` on SECURITY DEFINER functions.
2. Enables RLS + adds policies on tables missing them (`admin_audit_log`, `coaching_signal_log`, `_coaching_sync_guard`).
3. Revokes excess `anon` privileges on user-data tables (user_profiles, user_goals, coaching_*, coach_plans, coach_plan_steps, member_profiles, member_follows, progress_posts, progress_post_likes, progress_post_comments, community_*).
4. Creates `has_full_access(uid)` and `can_use_social(uid)` helper functions.
5. Adds `deleted_at` column to `progress_posts` for soft-delete.
6. Adds `auto_posting_enabled` column to `member_profiles` (default true).
7. Rewrites `check_access()` to use `has_full_access` and add `is_banned`, `social_paused` awareness.

## Security Changes
- All SECURITY DEFINER functions get `SET search_path = public`.
- `anon` role revoked from all user-data tables; only `authenticated` + `service_role` retain access.
- Tables with RLS enabled but no policies now get owner-scoped or service-only policies.
*/

-- ============================================================
-- 1. Fix mutable search_path on SECURITY DEFINER functions
-- ============================================================

CREATE OR REPLACE FUNCTION public.im_get_or_create_conversation(other_user uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  lo uuid;
  hi uuid;
  conv_id uuid;
BEGIN
  IF me IS NULL THEN RETURN NULL; END IF;
  IF me = other_user THEN RETURN NULL; END IF;
  lo := LEAST(me, other_user);
  hi := GREATEST(me, other_user);
  SELECT id INTO conv_id FROM im_conversations WHERE user_a_id = lo AND user_b_id = hi LIMIT 1;
  IF conv_id IS NULL THEN
    INSERT INTO im_conversations (user_a_id, user_b_id) VALUES (lo, hi)
    RETURNING id INTO conv_id;
  END IF;
  RETURN conv_id;
END;
$$;

-- ============================================================
-- 2. RLS on tables with no policies
-- ============================================================

-- admin_audit_log: service-only, no client access
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_audit_log FROM anon, authenticated;
GRANT SELECT, INSERT ON public.admin_audit_log TO service_role;
DROP POLICY IF EXISTS "service_only_audit_log" ON public.admin_audit_log;
CREATE POLICY "service_only_audit_log"
ON public.admin_audit_log FOR ALL
TO service_role
USING (true) WITH CHECK (true);

-- coaching_signal_log: service-only, no client access
ALTER TABLE public.coaching_signal_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coaching_signal_log FROM anon, authenticated;
GRANT SELECT, INSERT ON public.coaching_signal_log TO service_role;
DROP POLICY IF EXISTS "service_only_signal_log" ON public.coaching_signal_log;
CREATE POLICY "service_only_signal_log"
ON public.coaching_signal_log FOR ALL
TO service_role
USING (true) WITH CHECK (true);

-- _coaching_sync_guard: service-only internal table
ALTER TABLE public._coaching_sync_guard ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._coaching_sync_guard FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public._coaching_sync_guard TO service_role;
DROP POLICY IF EXISTS "service_only_sync_guard" ON public._coaching_sync_guard;
CREATE POLICY "service_only_sync_guard"
ON public._coaching_sync_guard FOR ALL
TO service_role
USING (true) WITH CHECK (true);

-- ============================================================
-- 3. Revoke anon privileges on all user-data tables
-- ============================================================

REVOKE ALL ON public.user_profiles FROM anon;
REVOKE ALL ON public.user_goals FROM anon;
REVOKE ALL ON public.coaching_commitments FROM anon;
REVOKE ALL ON public.coaching_change_log FROM anon;
REVOKE ALL ON public.coach_plans FROM anon;
REVOKE ALL ON public.coach_plan_steps FROM anon;
REVOKE ALL ON public.member_profiles FROM anon;
REVOKE ALL ON public.member_follows FROM anon;
REVOKE ALL ON public.progress_posts FROM anon;
REVOKE ALL ON public.progress_post_likes FROM anon;
REVOKE ALL ON public.progress_post_comments FROM anon;
REVOKE ALL ON public.community_room_messages FROM anon;
REVOKE ALL ON public.community_board_members FROM anon;
REVOKE ALL ON public.community_rooms FROM anon;
REVOKE ALL ON public.community_notifications FROM anon;
REVOKE ALL ON public.user_events FROM anon;
REVOKE ALL ON public.user_insights FROM anon;
REVOKE ALL ON public.conversation_insights FROM anon;
REVOKE ALL ON public.user_customization FROM anon;

-- ============================================================
-- 4. New columns
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'progress_posts' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE public.progress_posts ADD COLUMN deleted_at timestamptz DEFAULT now();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'member_profiles' AND column_name = 'auto_posting_enabled'
  ) THEN
    ALTER TABLE public.member_profiles ADD COLUMN auto_posting_enabled boolean NOT NULL DEFAULT true;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'social_paused'
  ) THEN
    ALTER TABLE public.user_profiles ADD COLUMN social_paused boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ============================================================
-- 5. has_full_access(uid) and can_use_social(uid)
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_full_access(p_uid uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.user_profiles%ROWTYPE;
  v_welcome_active boolean;
  v_trial_active boolean;
  v_is_paid boolean;
BEGIN
  SELECT * INTO v_profile FROM public.user_profiles WHERE id = p_uid;
  IF NOT FOUND THEN RETURN false; END IF;

  v_welcome_active := v_profile.welcome_window_expires_at IS NOT NULL
    AND v_profile.welcome_window_expires_at > now();
  v_trial_active := v_profile.trial_expires_at IS NOT NULL
    AND v_profile.trial_expires_at > now()
    AND v_profile.subscription_tier = 'trial';
  v_is_paid := COALESCE(v_profile.subscription_tier, 'free') IN ('essential', 'plus', 'elite');

  RETURN v_profile.age_verified_at IS NOT NULL
    AND COALESCE(v_profile.is_banned, false) = false
    AND COALESCE(v_profile.social_paused, false) = false
    AND (v_welcome_active OR v_trial_active OR v_is_paid);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.has_full_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_full_access(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_use_social(p_uid uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.has_full_access(p_uid);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.can_use_social(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_use_social(uuid) TO authenticated, service_role;

-- ============================================================
-- 6. Rewrite check_access() to use has_full_access
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

  v_welcome_active := v_profile.welcome_window_expires_at IS NOT NULL
    AND v_profile.welcome_window_expires_at > now();
  v_trial_active := v_profile.trial_expires_at IS NOT NULL
    AND v_profile.trial_expires_at > now()
    AND v_profile.subscription_tier = 'trial';
  v_is_paid := COALESCE(v_profile.subscription_tier, 'free') IN ('essential', 'plus', 'elite');

  v_can_access_social := public.has_full_access(v_uid);

  RETURN jsonb_build_object(
    'success', true,
    'tier', COALESCE(v_profile.subscription_tier, 'free'),
    'age_verified', v_profile.age_verified_at IS NOT NULL,
    'welcome_window_active', v_welcome_active,
    'welcome_window_expires_at', v_profile.welcome_window_expires_at,
    'trial_active', v_trial_active,
    'trial_expires_at', v_profile.trial_expires_at,
    'is_paid', v_is_paid,
    'is_banned', COALESCE(v_profile.is_banned, false),
    'social_paused', COALESCE(v_profile.social_paused, false),
    'is_bot', COALESCE(v_profile.is_bot, false),
    'can_access_social', v_can_access_social
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_access() TO authenticated, service_role;

/*
  # Fix Duplicate and Stacking RLS Policies

  ## Issues Fixed

  1. feature_usage_stats - Two SELECT policies stack additively (one FOR ALL + one FOR SELECT).
     Remove the FOR ALL, replace with explicit INSERT/UPDATE/DELETE.

  2. ron_sessions - Duplicate SELECT policy for participant_b. Remove the exact duplicate.

  3. user_feedback - Three INSERT policies stacking. Consolidate to one.

  4. monitoring_logs - INSERT policy has no WITH CHECK (unrestricted insert).
     Restrict to admin users only, matching the SELECT policy intent.

  Note: typing_status "Anyone can" policies are intentional — the table has no user_id
  column and is used for real-time typing indicators in group chat rooms.
*/

-- ============================================================
-- 1. FEATURE_USAGE_STATS: Remove FOR ALL, add explicit INSERT/UPDATE/DELETE
-- ============================================================
DROP POLICY IF EXISTS "System can manage feature usage" ON public.feature_usage_stats;

CREATE POLICY "System can insert feature usage" ON public.feature_usage_stats
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "System can update feature usage" ON public.feature_usage_stats
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "System can delete feature usage" ON public.feature_usage_stats
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================
-- 2. RON_SESSIONS: Remove exact duplicate SELECT policy for participant_b
-- ============================================================
DROP POLICY IF EXISTS "Participant B can view their sessions" ON public.ron_sessions;

-- ============================================================
-- 3. USER_FEEDBACK: Consolidate three stacking INSERT policies into one
-- ============================================================
DROP POLICY IF EXISTS "Anyone can submit feedback" ON public.user_feedback;
DROP POLICY IF EXISTS "Authenticated users can submit feedback" ON public.user_feedback;
DROP POLICY IF EXISTS "Users can submit own feedback" ON public.user_feedback;

CREATE POLICY "Authenticated users can submit own feedback" ON public.user_feedback
  FOR INSERT TO authenticated
  WITH CHECK (
    (user_id IS NULL) OR (user_id = (select auth.uid()))
  );

-- ============================================================
-- 4. MONITORING_LOGS: Restrict INSERT to admin users only
-- ============================================================
DROP POLICY IF EXISTS "Service can insert monitoring logs" ON public.monitoring_logs;

CREATE POLICY "Service can insert monitoring logs" ON public.monitoring_logs
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = (select auth.uid())
      AND user_profiles.user_role = 'admin'
  ));

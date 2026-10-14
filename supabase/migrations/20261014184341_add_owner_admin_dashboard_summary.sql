/*
# Owner-only admin dashboard summary

1. Plain-English
   The admin analytics page could only read the signed-in person's own rows (row level security),
   so every tile showed numbers for just one user. This adds a single read-only function that
   returns app-wide totals, but ONLY to the app owner (user_profiles.is_super_user = true).

2. New Functions
   - `admin_dashboard_summary(p_start, p_today_start, p_yesterday_start, p_tz)` returns jsonb with:
     user counts by tier, signups today/yesterday/in period, signups per day (last 14 days, in p_tz),
     messages, companions, active users, avg session length, recent signups (with email),
     popular features, recent errors, and onboarding/upgrade funnel step stats.

3. Security
   - SECURITY DEFINER with empty search_path; raises 'forbidden' unless caller is the owner.
   - EXECUTE revoked from public/anon; granted to authenticated only (owner check enforced inside).
   - No table policies are changed; regular users still see only their own data.
*/

CREATE OR REPLACE FUNCTION public.admin_dashboard_summary(
  p_start timestamptz,
  p_today_start timestamptz,
  p_yesterday_start timestamptz,
  p_tz text DEFAULT 'UTC'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tz text := COALESCE(NULLIF(p_tz, ''), 'UTC');
  v_result jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND is_super_user = true
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = v_tz) THEN
    v_tz := 'UTC';
  END IF;

  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.user_profiles),
    'premium_users', (SELECT count(*) FROM public.user_profiles WHERE subscription_tier IN ('unlimited','starter','plus','elite')),
    'free_users', (SELECT count(*) FROM public.user_profiles WHERE subscription_tier = 'free'),
    'trial_users', (SELECT count(*) FROM public.user_profiles WHERE subscription_tier = 'trial'),
    'tier_counts', COALESCE((SELECT jsonb_object_agg(t, c) FROM (
        SELECT COALESCE(subscription_tier, 'free') t, count(*) c FROM public.user_profiles GROUP BY 1) x), '{}'::jsonb),
    'signups_today', (SELECT count(*) FROM auth.users WHERE created_at >= p_today_start),
    'signups_yesterday', (SELECT count(*) FROM auth.users WHERE created_at >= p_yesterday_start AND created_at < p_today_start),
    'signups_in_period', (SELECT count(*) FROM auth.users WHERE created_at >= p_start),
    'signups_by_day', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('day', d::date, 'count', COALESCE(c, 0)) ORDER BY d)
      FROM generate_series(
        (date_trunc('day', now() AT TIME ZONE v_tz) - interval '13 days'),
        date_trunc('day', now() AT TIME ZONE v_tz),
        interval '1 day') d
      LEFT JOIN (
        SELECT date_trunc('day', created_at AT TIME ZONE v_tz) dd, count(*) c
        FROM auth.users GROUP BY 1
      ) s ON s.dd = d
    ), '[]'::jsonb),
    'total_messages', (SELECT count(*) FROM public.conversations WHERE created_at >= p_start),
    'total_companions', (SELECT count(*) FROM public.companions),
    'active_users', (SELECT count(DISTINCT user_id) FROM public.user_behavior_analytics WHERE created_at >= p_start AND user_id IS NOT NULL),
    'error_count', (SELECT count(*) FROM public.error_logs WHERE created_at >= p_start),
    'avg_session_seconds', COALESCE((
      SELECT round(avg((metadata->>'session_duration')::numeric))
      FROM public.user_behavior_analytics
      WHERE action_type = 'navigation' AND action_target = 'session_end'
        AND created_at >= p_start
        AND (metadata->>'session_duration') ~ '^[0-9]+(\.[0-9]+)?$'
    ), 0),
    'recent_signups', COALESCE((
      SELECT jsonb_agg(r ORDER BY r.created_at DESC) FROM (
        SELECT u.id, COALESCE(p.name, '') AS name, u.email, COALESCE(p.subscription_tier, 'free') AS subscription_tier, u.created_at
        FROM auth.users u LEFT JOIN public.user_profiles p ON p.id = u.id
        ORDER BY u.created_at DESC LIMIT 10
      ) r
    ), '[]'::jsonb),
    'popular_features', COALESCE((
      SELECT jsonb_agg(f ORDER BY f.count DESC) FROM (
        SELECT feature_name AS feature, sum(usage_count)::int AS count
        FROM public.feature_usage_stats GROUP BY feature_name ORDER BY 2 DESC LIMIT 8
      ) f
    ), '[]'::jsonb),
    'recent_errors', COALESCE((
      SELECT jsonb_agg(e ORDER BY e.created_at DESC) FROM (
        SELECT id, error_type, error_message, page_path, severity, created_at
        FROM public.error_logs ORDER BY created_at DESC LIMIT 8
      ) e
    ), '[]'::jsonb),
    'funnels', jsonb_build_object(
      'onboarding', COALESCE((
        SELECT jsonb_agg(s ORDER BY s.step_number) FROM (
          SELECT step_name, min(step_number) step_number, count(*) total_users,
            100.0 * count(*) FILTER (WHERE completed) / count(*) completion_rate,
            100.0 * count(*) FILTER (WHERE dropped_off) / count(*) drop_off_rate
          FROM public.conversion_funnel WHERE funnel_type = 'onboarding' GROUP BY step_name
        ) s), '[]'::jsonb),
      'upgrade', COALESCE((
        SELECT jsonb_agg(s ORDER BY s.step_number) FROM (
          SELECT step_name, min(step_number) step_number, count(*) total_users,
            100.0 * count(*) FILTER (WHERE completed) / count(*) completion_rate,
            100.0 * count(*) FILTER (WHERE dropped_off) / count(*) drop_off_rate
          FROM public.conversion_funnel WHERE funnel_type = 'upgrade' GROUP BY step_name
        ) s), '[]'::jsonb)
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_dashboard_summary(timestamptz, timestamptz, timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_dashboard_summary(timestamptz, timestamptz, timestamptz, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_summary(timestamptz, timestamptz, timestamptz, text) TO authenticated;

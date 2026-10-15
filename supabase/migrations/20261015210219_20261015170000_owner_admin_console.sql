/*
# Owner admin console: audit log, settings, and owner-only tools

1. Plain-English
   Adds the server side of the admin console. Everything here is callable only by the
   owner (user_profiles.is_super_user = true); regular users get 'forbidden'.
   Every action that changes data writes a row to admin_audit_log.

2. New tables
   - admin_audit_log: who did what to whom, with details. No client policies; read via RPC.
   - app_settings: key/value switches the owner can change live (maintenance mode, kill
     switches, limits). Readable by any signed-in user so the app can honor them; writable
     only through admin_set_setting.

3. New functions (all SECURITY DEFINER, empty search_path, owner check inside)
   admin_overview, admin_search_users, admin_user_detail, admin_set_ban,
   admin_extend_trial, admin_reset_strikes, admin_list_reports, admin_resolve_report,
   admin_list_feedback, admin_set_feedback_status, admin_bot_overview, admin_set_bot_board,
   admin_set_setting, admin_list_audit, admin_log_action.
*/

-- ── Tables ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target ON public.admin_audit_log (target_type, target_id);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: access only through owner-checked RPCs.

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_settings_read_authenticated" ON public.app_settings;
CREATE POLICY "app_settings_read_authenticated"
  ON public.app_settings FOR SELECT TO authenticated USING (true);

INSERT INTO public.app_settings (key, value, description) VALUES
  ('maintenance_mode',      'false'::jsonb, 'Show a maintenance notice to non-owner users'),
  ('maintenance_message',   '"We''re making improvements. Back shortly."'::jsonb, 'Text shown during maintenance'),
  ('signups_enabled',       'true'::jsonb,  'Allow new accounts to be created'),
  ('community_bots_enabled','true'::jsonb,  'Master switch for community bots'),
  ('bot_daily_claude_cap',  '50'::jsonb,    'Max Claude calls the community bot may make per day'),
  ('site_announcement',     '""'::jsonb,    'Banner text shown to all users (empty = none)')
ON CONFLICT (key) DO NOTHING;

-- ── Helpers ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_assert_owner()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_super_user = true
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_log_action(
  p_action text, p_target_type text DEFAULT NULL, p_target_id text DEFAULT NULL,
  p_details jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.admin_assert_owner();
  INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, details)
  VALUES (auth.uid(), p_action, p_target_type, p_target_id, COALESCE(p_details, '{}'::jsonb));
END;
$$;

-- ── Overview ("needs attention") ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.admin_assert_owner();
  RETURN jsonb_build_object(
    'pending_reports',    (SELECT count(*) FROM public.community_reports WHERE status = 'pending'),
    'new_feedback',       (SELECT count(*) FROM public.user_feedback WHERE status = 'new'),
    'open_alerts',        (SELECT count(*) FROM public.alert_events WHERE resolved IS NOT TRUE),
    'errors_24h',         (SELECT count(*) FROM public.error_logs WHERE created_at > now() - interval '24 hours'),
    'bot_errors_24h',     (SELECT count(*) FROM public.community_bot_runs WHERE status = 'error' AND created_at > now() - interval '24 hours'),
    'banned_users',       (SELECT count(*) FROM public.user_profiles WHERE is_banned),
    'trials_ending_3d',   (SELECT count(*) FROM public.user_profiles WHERE subscription_tier = 'trial' AND trial_expires_at BETWEEN now() AND now() + interval '3 days'),
    'signups_24h',        (SELECT count(*) FROM auth.users WHERE created_at > now() - interval '24 hours'),
    'pending_memory_proposals', (SELECT count(*) FROM public.memory_proposals WHERE status = 'pending')
  );
END;
$$;

-- ── Users ─────────────────────────────────────────────────────────────────
-- p_filter: all | banned | trial_ending | struck | new_7d | paying
CREATE OR REPLACE FUNCTION public.admin_search_users(
  p_query text DEFAULT '', p_tier text DEFAULT 'all', p_filter text DEFAULT 'all',
  p_limit int DEFAULT 50, p_offset int DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_q text := '%' || COALESCE(trim(p_query), '') || '%';
  v_rows jsonb;
  v_total bigint;
BEGIN
  PERFORM public.admin_assert_owner();

  WITH base AS (
    SELECT p.id, p.name, u.email, p.subscription_tier, p.user_role, p.is_super_user,
           p.is_banned, p.moderation_strikes, p.trial_expires_at, p.created_at,
           u.last_sign_in_at
    FROM public.user_profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE (p_query IS NULL OR trim(p_query) = '' OR p.name ILIKE v_q OR u.email ILIKE v_q OR p.id::text = trim(p_query))
      AND (p_tier = 'all' OR COALESCE(p.subscription_tier, 'free') = p_tier)
      AND (
        p_filter = 'all'
        OR (p_filter = 'banned' AND p.is_banned)
        OR (p_filter = 'struck' AND p.moderation_strikes > 0)
        OR (p_filter = 'new_7d' AND p.created_at > now() - interval '7 days')
        OR (p_filter = 'paying' AND p.subscription_tier IN ('unlimited','starter','plus','elite'))
        OR (p_filter = 'trial_ending' AND p.subscription_tier = 'trial' AND p.trial_expires_at BETWEEN now() AND now() + interval '3 days')
      )
  )
  SELECT (SELECT count(*) FROM base),
         COALESCE(jsonb_agg(to_jsonb(r)), '[]'::jsonb)
  INTO v_total, v_rows
  FROM (SELECT * FROM base ORDER BY created_at DESC LIMIT LEAST(GREATEST(p_limit, 1), 200) OFFSET GREATEST(p_offset, 0)) r;

  RETURN jsonb_build_object('total', v_total, 'users', v_rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_user_detail(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_result jsonb;
BEGIN
  PERFORM public.admin_assert_owner();
  SELECT jsonb_build_object(
    'profile', (SELECT to_jsonb(x) FROM (
        SELECT p.id, p.name, u.email, p.subscription_tier, p.user_role, p.is_super_user,
               p.is_banned, p.banned_at, p.moderation_strikes, p.trial_expires_at, p.created_at,
               u.last_sign_in_at
        FROM public.user_profiles p LEFT JOIN auth.users u ON u.id = p.id
        WHERE p.id = p_user) x),
    'companions', (SELECT count(*) FROM public.companions WHERE user_id = p_user),
    'messages_total', (SELECT count(*) FROM public.conversations WHERE user_id = p_user AND role = 'user'),
    'messages_7d', (SELECT count(*) FROM public.conversations WHERE user_id = p_user AND role = 'user' AND created_at > now() - interval '7 days'),
    'last_message_at', (SELECT max(created_at) FROM public.conversations WHERE user_id = p_user),
    'posts', (SELECT count(*) FROM public.community_posts WHERE author_id = p_user),
    'comments', (SELECT count(*) FROM public.community_comments WHERE author_id = p_user),
    'reports_filed', (SELECT count(*) FROM public.community_reports WHERE reporter_id = p_user),
    'feedback', COALESCE((SELECT jsonb_agg(to_jsonb(f)) FROM (
        SELECT id, feedback_type, message, status, created_at FROM public.user_feedback
        WHERE user_id = p_user ORDER BY created_at DESC LIMIT 5) f), '[]'::jsonb),
    'moderation_events', COALESCE((SELECT jsonb_agg(to_jsonb(m)) FROM (
        SELECT category, created_at FROM public.moderation_events
        WHERE user_id = p_user ORDER BY created_at DESC LIMIT 10) m), '[]'::jsonb),
    'referrals_made', (SELECT count(*) FROM public.referrals WHERE referrer_id = p_user),
    'recent_errors', COALESCE((SELECT jsonb_agg(to_jsonb(e)) FROM (
        SELECT error_type, error_message, created_at FROM public.error_logs
        WHERE user_id = p_user ORDER BY created_at DESC LIMIT 5) e), '[]'::jsonb),
    'audit', COALESCE((SELECT jsonb_agg(to_jsonb(a)) FROM (
        SELECT action, details, created_at FROM public.admin_audit_log
        WHERE target_type = 'user' AND target_id = p_user::text ORDER BY created_at DESC LIMIT 10) a), '[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_ban(p_user uuid, p_banned boolean, p_reason text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.admin_assert_owner();
  IF p_user = auth.uid() THEN RAISE EXCEPTION 'cannot ban yourself'; END IF;
  UPDATE public.user_profiles
     SET is_banned = p_banned,
         banned_at = CASE WHEN p_banned THEN now() ELSE NULL END
   WHERE id = p_user AND is_super_user IS NOT TRUE;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM public.admin_log_action(CASE WHEN p_banned THEN 'user.ban' ELSE 'user.unban' END,
    'user', p_user::text, jsonb_build_object('reason', p_reason));
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_extend_trial(p_user uuid, p_days int)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.admin_assert_owner();
  IF p_days < 1 OR p_days > 365 THEN RAISE EXCEPTION 'days must be 1-365'; END IF;
  UPDATE public.user_profiles
     SET subscription_tier = 'trial',
         trial_expires_at = GREATEST(COALESCE(trial_expires_at, now()), now()) + make_interval(days => p_days)
   WHERE id = p_user;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM public.admin_log_action('user.extend_trial', 'user', p_user::text, jsonb_build_object('days', p_days));
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reset_strikes(p_user uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.admin_assert_owner();
  UPDATE public.user_profiles SET moderation_strikes = 0 WHERE id = p_user;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM public.admin_log_action('user.reset_strikes', 'user', p_user::text);
  RETURN true;
END;
$$;

-- ── Moderation queue ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_list_reports(p_status text DEFAULT 'pending', p_limit int DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.admin_assert_owner();
  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC) FROM (
      SELECT cr.id, cr.target_type, cr.target_id, cr.reason, cr.status, cr.created_at,
             rp.name AS reporter_name,
             COALESCE(po.author_id, co.author_id) AS content_author_id,
             (SELECT name FROM public.user_profiles WHERE id = COALESCE(po.author_id, co.author_id)) AS content_author_name,
             COALESCE(po.title, left(co.body, 80)) AS content_title,
             COALESCE(po.body, co.body) AS content_body,
             COALESCE(po.is_ai_generated, co.is_ai_generated, false) AS content_is_bot,
             (po.id IS NULL AND co.id IS NULL AND cr.target_type <> 'board') AS content_missing
      FROM public.community_reports cr
      LEFT JOIN public.user_profiles rp ON rp.id = cr.reporter_id
      LEFT JOIN public.community_posts po ON cr.target_type = 'post' AND po.id = cr.target_id
      LEFT JOIN public.community_comments co ON cr.target_type = 'comment' AND co.id = cr.target_id
      WHERE p_status = 'all' OR cr.status = p_status
      ORDER BY cr.created_at DESC
      LIMIT LEAST(GREATEST(p_limit, 1), 200)
    ) r), '[]'::jsonb);
END;
$$;

-- p_action: dismiss | remove_content | remove_and_ban
CREATE OR REPLACE FUNCTION public.admin_resolve_report(p_report uuid, p_action text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rep public.community_reports%ROWTYPE;
  v_author uuid;
BEGIN
  PERFORM public.admin_assert_owner();
  IF p_action NOT IN ('dismiss', 'remove_content', 'remove_and_ban') THEN
    RAISE EXCEPTION 'invalid action';
  END IF;
  SELECT * INTO v_rep FROM public.community_reports WHERE id = p_report;
  IF NOT FOUND THEN RETURN false; END IF;

  IF p_action <> 'dismiss' THEN
    IF v_rep.target_type = 'post' THEN
      SELECT author_id INTO v_author FROM public.community_posts WHERE id = v_rep.target_id;
      DELETE FROM public.community_posts WHERE id = v_rep.target_id;
    ELSIF v_rep.target_type = 'comment' THEN
      SELECT author_id INTO v_author FROM public.community_comments WHERE id = v_rep.target_id;
      DELETE FROM public.community_comments WHERE id = v_rep.target_id;
    ELSE
      RAISE EXCEPTION 'boards are managed from the Community tools';
    END IF;
    IF p_action = 'remove_and_ban' AND v_author IS NOT NULL THEN
      PERFORM public.admin_set_ban(v_author, true, 'Removed via report ' || p_report::text);
    END IF;
  END IF;

  UPDATE public.community_reports
     SET status = CASE WHEN p_action = 'dismiss' THEN 'reviewed' ELSE 'resolved' END
   WHERE id = p_report;

  PERFORM public.admin_log_action('report.' || p_action, 'report', p_report::text,
    jsonb_build_object('target_type', v_rep.target_type, 'target_id', v_rep.target_id, 'author', v_author));
  RETURN true;
END;
$$;

-- ── Feedback inbox ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_list_feedback(p_status text DEFAULT 'new', p_limit int DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.admin_assert_owner();
  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC) FROM (
      SELECT f.id, f.user_id, COALESCE(f.email, u.email) AS email, p.name AS user_name,
             f.feedback_type, f.message, f.page_url, f.status, f.created_at
      FROM public.user_feedback f
      LEFT JOIN public.user_profiles p ON p.id = f.user_id
      LEFT JOIN auth.users u ON u.id = f.user_id
      WHERE p_status = 'all' OR f.status = p_status
      ORDER BY f.created_at DESC
      LIMIT LEAST(GREATEST(p_limit, 1), 200)
    ) r), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_feedback_status(p_id uuid, p_status text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.admin_assert_owner();
  IF p_status NOT IN ('new', 'reviewed', 'implemented', 'dismissed') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;
  UPDATE public.user_feedback SET status = p_status, updated_at = now() WHERE id = p_id;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM public.admin_log_action('feedback.' || p_status, 'feedback', p_id::text);
  RETURN true;
END;
$$;

-- ── Community bots ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_bot_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.admin_assert_owner();
  RETURN jsonb_build_object(
    'boards', COALESCE((
      SELECT jsonb_agg(to_jsonb(b) ORDER BY b.name) FROM (
        SELECT cb.id, cb.name, s.bot_enabled, s.post_frequency_hours, s.respond_frequency_hours,
               s.last_post_at, s.last_respond_at
        FROM public.community_boards cb
        LEFT JOIN public.community_board_bot_settings s ON s.board_id = cb.id
      ) b), '[]'::jsonb),
    'runs', COALESCE((
      SELECT jsonb_agg(to_jsonb(r)) FROM (
        SELECT id, bot_name, action, status, error_message, generated_title, created_at
        FROM public.community_bot_runs ORDER BY created_at DESC LIMIT 40) r), '[]'::jsonb),
    'runs_24h', (SELECT count(*) FROM public.community_bot_runs WHERE created_at > now() - interval '24 hours' AND status = 'success'),
    'errors_24h', (SELECT count(*) FROM public.community_bot_runs WHERE created_at > now() - interval '24 hours' AND status = 'error')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_bot_board(
  p_board uuid, p_enabled boolean, p_post_hours int, p_respond_hours int
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.admin_assert_owner();
  IF p_post_hours < 1 OR p_respond_hours < 1 THEN RAISE EXCEPTION 'frequency must be at least 1 hour'; END IF;
  INSERT INTO public.community_board_bot_settings (board_id, bot_enabled, post_frequency_hours, respond_frequency_hours, updated_at)
  VALUES (p_board, p_enabled, p_post_hours, p_respond_hours, now())
  ON CONFLICT (board_id) DO UPDATE
    SET bot_enabled = EXCLUDED.bot_enabled,
        post_frequency_hours = EXCLUDED.post_frequency_hours,
        respond_frequency_hours = EXCLUDED.respond_frequency_hours,
        updated_at = now();
  PERFORM public.admin_log_action('bot.board_settings', 'board', p_board::text,
    jsonb_build_object('enabled', p_enabled, 'post_hours', p_post_hours, 'respond_hours', p_respond_hours));
  RETURN true;
END;
$$;

-- ── Settings / audit ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_setting(p_key text, p_value jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_old jsonb;
BEGIN
  PERFORM public.admin_assert_owner();
  SELECT value INTO v_old FROM public.app_settings WHERE key = p_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown setting'; END IF;
  UPDATE public.app_settings SET value = p_value, updated_at = now(), updated_by = auth.uid() WHERE key = p_key;
  PERFORM public.admin_log_action('setting.update', 'setting', p_key,
    jsonb_build_object('from', v_old, 'to', p_value));
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_audit(p_limit int DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.admin_assert_owner();
  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(r)) FROM (
      SELECT a.id, a.action, a.target_type, a.target_id, a.details, a.created_at,
             p.name AS actor_name
      FROM public.admin_audit_log a
      LEFT JOIN public.user_profiles p ON p.id = a.actor_id
      ORDER BY a.created_at DESC
      LIMIT LEAST(GREATEST(p_limit, 1), 500)
    ) r), '[]'::jsonb);
END;
$$;

-- ── Grants: authenticated only; owner check is enforced inside ───────────
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'admin_assert_owner()', 'admin_log_action(text,text,text,jsonb)', 'admin_overview()',
    'admin_search_users(text,text,text,int,int)', 'admin_user_detail(uuid)',
    'admin_set_ban(uuid,boolean,text)', 'admin_extend_trial(uuid,int)', 'admin_reset_strikes(uuid)',
    'admin_list_reports(text,int)', 'admin_resolve_report(uuid,text)',
    'admin_list_feedback(text,int)', 'admin_set_feedback_status(uuid,text)',
    'admin_bot_overview()', 'admin_set_bot_board(uuid,boolean,int,int)',
    'admin_set_setting(text,jsonb)', 'admin_list_audit(int)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;
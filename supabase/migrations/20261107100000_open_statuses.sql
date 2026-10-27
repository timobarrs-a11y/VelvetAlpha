-- Statuses are open to everyone
--
-- Posting a status used to need a trial, a welcome window or a paid plan (can_use_social), so most
-- members saw an error and could not post at all. Now anyone who has verified their age and is not
-- banned or paused can post, with the same limits as before: 500 characters, 10 an hour, and the
-- choice of who sees it.
--
-- Only create_status_post changes. can_use_social stays as it is for anything else that uses it.

CREATE OR REPLACE FUNCTION public.can_post_status(p_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = p_uid
      AND up.age_verified_at IS NOT NULL
      AND COALESCE(up.is_banned, false) = false
      AND COALESCE(up.social_paused, false) = false
  );
$$;
REVOKE EXECUTE ON FUNCTION public.can_post_status(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_post_status(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_status_post(p_body text, p_audience text DEFAULT 'everyone'::text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_body text := btrim(COALESCE(p_body, ''));
  v_audience text := COALESCE(NULLIF(btrim(p_audience), ''), 'everyone');
  v_id uuid := gen_random_uuid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_signed_in');
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE id = v_uid AND COALESCE(is_banned, false)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'banned');
  END IF;
  IF NOT public.can_post_status(v_uid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_access');
  END IF;
  IF v_audience NOT IN ('everyone', 'friends') THEN
    RETURN jsonb_build_object('success', false, 'error', 'bad_audience');
  END IF;
  IF char_length(v_body) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'empty');
  END IF;
  IF char_length(v_body) > 500 THEN
    RETURN jsonb_build_object('success', false, 'error', 'too_long');
  END IF;
  IF NOT public.check_rate_limit(v_uid, 'status_post', 10, 60) THEN
    RETURN jsonb_build_object('success', false, 'error', 'rate_limited');
  END IF;

  -- Written directly: check_rate_limit counts rate_limits.endpoint, and the
  -- record_rate_limit overloads are ambiguous for a (uuid, text) call.
  INSERT INTO public.rate_limits (user_id, endpoint) VALUES (v_uid, 'status_post');

  INSERT INTO public.progress_posts
    (id, user_id, post_type, title, body, ref_target_type, ref_target_id, is_auto_generated, audience)
  VALUES
    (v_id, v_uid, 'status', 'Status', v_body, 'status', v_id, false, v_audience);

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$function$;

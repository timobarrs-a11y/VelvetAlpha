-- Findings F10, F11, F16-F21, F24-F26, F28.
-- These SECURITY DEFINER routines filtered on a caller-supplied user id, so any caller
-- could name another account. Each now refuses when a signed-in caller names a user
-- other than themselves. A NULL auth.uid() is still allowed so that service_role
-- callers (edge functions, cron) keep working; anonymous access is revoked separately.

CREATE OR REPLACE FUNCTION public.match_memories(
  query_embedding vector,
  match_user_id uuid,
  match_companion_id uuid,
  match_threshold double precision DEFAULT 0.70,
  match_count integer DEFAULT 8
)
RETURNS TABLE(id uuid, summary text, key_facts text[], emotional_tone text, importance_score double precision, session_key timestamp with time zone, similarity double precision)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> match_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    ss.id,
    ss.summary,
    ss.key_facts,
    ss.emotional_tone,
    ss.importance_score,
    ss.session_key,
    1 - (ss.embedding <=> query_embedding) AS similarity
  FROM session_summaries ss
  WHERE ss.user_id = match_user_id
    AND ss.companion_id = match_companion_id
    AND ss.embedding IS NOT NULL
    AND 1 - (ss.embedding <=> query_embedding) >= match_threshold
  ORDER BY
    (0.6 * (1 - (ss.embedding <=> query_embedding))
     + 0.3 * ss.importance_score
     + 0.1 * (1.0 / (1.0 + EXTRACT(EPOCH FROM (now() - ss.session_key)) / 86400.0))
    ) DESC
  LIMIT match_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.search_memories_by_similarity(
  query_embedding vector,
  match_threshold double precision,
  match_count integer,
  filter_user_id uuid
)
RETURNS TABLE(id uuid, content text, similarity double precision)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> filter_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT rm.id, rm.content, 1 - (rm.embedding <=> query_embedding) AS similarity
  FROM public.relationship_memories rm
  WHERE rm.user_id = filter_user_id
    AND 1 - (rm.embedding <=> query_embedding) > match_threshold
  ORDER BY rm.embedding <=> query_embedding
  LIMIT match_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_affection_context(p_user_id uuid, p_companion_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_stats RECORD;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT relationship_intent, affection_base, affection_last_updated_at,
         current_streak_days, elapsed_days_since_creation
  INTO v_stats
  FROM relationship_stats
  WHERE user_id = p_user_id AND companion_id = p_companion_id;

  RETURN jsonb_build_object(
    'relationship_intent', COALESCE(v_stats.relationship_intent, 'companion'),
    'affection_base', COALESCE(v_stats.affection_base, 5),
    'affection_last_updated_at', v_stats.affection_last_updated_at,
    'current_streak_days', COALESCE(v_stats.current_streak_days, 0),
    'elapsed_days_since_creation', COALESCE(v_stats.elapsed_days_since_creation, 0)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_total_chat_days(p_user_id uuid, p_companion_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_total_days integer;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COUNT(*) INTO v_total_days
  FROM relationship_days
  WHERE user_id = p_user_id AND companion_id = p_companion_id;

  RETURN COALESCE(v_total_days, 0);
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_update_affection(p_user_id uuid, p_companion_id uuid)
RETURNS TABLE(allowed boolean, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_last_update timestamptz;
  v_updates_last_week int;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT updated_at INTO v_last_update
  FROM affection_updates
  WHERE user_id = p_user_id AND companion_id = p_companion_id
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_last_update IS NOT NULL AND v_last_update > (NOW() - INTERVAL '24 hours') THEN
    RETURN QUERY SELECT false, 'Rate limit: max 1 update per 24 hours';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_updates_last_week
  FROM affection_updates
  WHERE user_id = p_user_id
    AND companion_id = p_companion_id
    AND updated_at > (NOW() - INTERVAL '7 days');

  IF v_updates_last_week >= 2 THEN
    RETURN QUERY SELECT false, 'Rate limit: max 2 updates per week';
    RETURN;
  END IF;

  RETURN QUERY SELECT true, 'Rate limit check passed';
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_update_affection_base(p_user_id uuid, p_companion_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_last_updated timestamptz;
  v_update_history jsonb;
  v_updates_last_week int;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT affection_last_updated_at, affection_update_history
  INTO v_last_updated, v_update_history
  FROM relationship_stats
  WHERE user_id = p_user_id AND companion_id = p_companion_id;

  IF v_last_updated IS NOT NULL AND v_last_updated > (NOW() - INTERVAL '24 hours') THEN
    RETURN false;
  END IF;

  SELECT COUNT(*) INTO v_updates_last_week
  FROM jsonb_array_elements(COALESCE(v_update_history, '[]'::jsonb)) AS update
  WHERE (update->>'updated_at')::timestamptz > (NOW() - INTERVAL '7 days');

  IF v_updates_last_week >= 2 THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_user_moderation_status(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  flag_count integer;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COUNT(*) INTO flag_count
  FROM public.moderation_flags mf
  JOIN public.companions c ON c.id = mf.companion_id
  WHERE c.user_id = p_user_id
    AND mf.status = 'pending'
    AND mf.severity IN ('high', 'critical');

  RETURN flag_count = 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_rate_limit(p_user_id uuid, p_action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.rate_limits (user_id, action) VALUES (p_user_id, p_action);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_event_mention(p_event_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE user_events
  SET last_mentioned_at = now()
  WHERE id = p_event_id AND user_id = p_user_id;

  RETURN FOUND;
END;
$function$;

-- F25: the 5-argument definer overload inserted a flag against any companion id.
CREATE OR REPLACE FUNCTION public.record_moderation_flag(
  p_companion_id uuid,
  p_flag_type text,
  p_severity text,
  p_content text,
  p_metadata jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  new_flag_id uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.companions c WHERE c.id = p_companion_id AND c.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.moderation_flags (companion_id, flag_type, severity, content, metadata)
  VALUES (p_companion_id, p_flag_type, p_severity, p_content, p_metadata)
  RETURNING id INTO new_flag_id;

  RETURN new_flag_id;
END;
$function$;

-- F16 / F17: guest donation lookup and claiming keyed on an arbitrary email address.
CREATE OR REPLACE FUNCTION public.claim_guest_donations(p_user_id uuid, p_email text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  claimed_count integer;
  v_uid uuid := auth.uid();
  v_email text := lower(trim(COALESCE(auth.jwt() ->> 'email', '')));
BEGIN
  IF v_uid IS NOT NULL THEN
    IF v_uid <> p_user_id THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
    IF v_email = '' OR v_email <> lower(trim(COALESCE(p_email, ''))) THEN
      RAISE EXCEPTION 'Not authorized';
    END IF;
  END IF;

  UPDATE donations
  SET user_id = p_user_id
  WHERE lower(trim(email)) = lower(trim(p_email))
    AND user_id IS NULL;

  GET DIAGNOSTICS claimed_count = ROW_COUNT;
  RETURN claimed_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_guest_donations(p_email text)
RETURNS TABLE(id uuid, amount_cents integer, message text, star_x double precision, star_y double precision, star_size double precision, star_brightness double precision, star_color text, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email text := lower(trim(COALESCE(auth.jwt() ->> 'email', '')));
BEGIN
  IF auth.uid() IS NOT NULL AND (v_email = '' OR v_email <> lower(trim(COALESCE(p_email, '')))) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT d.id, d.amount_cents, d.message, d.star_x, d.star_y,
         d.star_size, d.star_brightness, d.star_color, d.created_at
  FROM donations d
  WHERE lower(trim(d.email)) = lower(trim(p_email))
    AND d.user_id IS NULL
  ORDER BY d.created_at ASC;
END;
$function$;

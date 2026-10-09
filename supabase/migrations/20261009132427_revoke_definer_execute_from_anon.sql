-- Findings F12, F13, F18, F22, F23, F27, F45.
-- Every SECURITY DEFINER routine in public was executable by the anon role, which the
-- browser bundle holds. Several of them fall back to a caller-supplied user id when
-- auth.uid() is NULL, so anonymous callers inherited owner privileges. Revoke anon
-- execute across the board, keeping the two survey-token routines that are designed
-- to be used by a signed-out recipient.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname NOT IN ('get_person_via_survey_token', 'update_person_via_survey_token')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- F18 / F27: maintenance and analytics routines that no client should ever invoke.
REVOKE ALL ON FUNCTION public.detect_session_dropoffs(uuid[], timestamptz) FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.expire_trials() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_old_rate_limits() FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.detect_session_dropoffs(uuid[], timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_trials() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_rate_limits() TO service_role;

-- F24 / F25: the rate-limit and moderation-flag writers are used only by server code.
REVOKE ALL ON FUNCTION public.record_rate_limit(uuid, text) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_rate_limit(uuid, text) TO service_role;

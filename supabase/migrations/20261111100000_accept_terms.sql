/*
  # accept_terms: record terms consent for people who sign in with Google

  Email sign-ups accept the Terms and Privacy Policy on the sign-up form, and
  verify_age_and_consent records it. Someone who arrives through Google skips that
  form, so the app shows them one acceptance screen and calls this function.

  - SECURITY DEFINER because terms_version / terms_accepted_at are server-trusted
    columns the app cannot write itself.
  - Only fills the columns when no acceptance is on file, so it can't rewrite history.
*/

CREATE OR REPLACE FUNCTION public.accept_terms(p_terms_version text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_authenticated');
  END IF;

  IF p_terms_version IS NULL OR length(trim(p_terms_version)) = 0 OR length(p_terms_version) > 40 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'version_invalid');
  END IF;

  UPDATE public.user_profiles
  SET terms_version = p_terms_version,
      terms_accepted_at = now(),
      updated_at = now()
  WHERE id = v_uid
    AND terms_accepted_at IS NULL;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.accept_terms(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_terms(text) TO authenticated;

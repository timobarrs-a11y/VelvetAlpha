-- Preserve the product's documented 3-day trial length.
CREATE OR REPLACE FUNCTION public.start_trial()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
  SET subscription_tier = 'trial',
      subscription_status = 'trialing',
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

REVOKE ALL ON FUNCTION public.start_trial() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_trial() TO authenticated;

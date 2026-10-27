-- An older account that gets its age verified through the setup questions has never had a
-- (current) welcome window, and verifying is what makes the lock screen apply. So the first
-- verification starts a fresh 48 hour welcome window when there isn't one running, the same
-- allowance a new sign-up gets. Verifying again later changes nothing about access.

CREATE OR REPLACE FUNCTION public.confirm_birthday(p_birthday date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_age int;
  v_first boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_signed_in');
  END IF;
  IF p_birthday IS NULL OR p_birthday > current_date OR p_birthday < date '1900-01-01' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'birthday_invalid');
  END IF;

  v_age := date_part('year', age(current_date, p_birthday))::int;
  IF v_age < 18 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'underage');
  END IF;

  SELECT age_verified_at IS NULL INTO v_first FROM public.user_profiles WHERE id = v_uid;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'profile_not_found');
  END IF;

  UPDATE public.user_profiles
  SET birthday = p_birthday,
      age_verified_at = COALESCE(age_verified_at, now()),
      welcome_window_expires_at = CASE
        WHEN v_first AND (welcome_window_expires_at IS NULL OR welcome_window_expires_at <= now())
          THEN now() + interval '48 hours'
        ELSE welcome_window_expires_at
      END,
      messages_remaining = CASE
        WHEN v_first AND (welcome_window_expires_at IS NULL OR welcome_window_expires_at <= now())
          THEN 8000
        ELSE messages_remaining
      END,
      haiku_model_enabled = CASE WHEN v_first AND (welcome_window_expires_at IS NULL OR welcome_window_expires_at <= now()) THEN true ELSE haiku_model_enabled END,
      sonnet_model_enabled = CASE WHEN v_first AND (welcome_window_expires_at IS NULL OR welcome_window_expires_at <= now()) THEN true ELSE sonnet_model_enabled END,
      updated_at = now()
  WHERE id = v_uid;

  RETURN jsonb_build_object('success', true, 'age', v_age);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_birthday(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_birthday(date) TO authenticated;

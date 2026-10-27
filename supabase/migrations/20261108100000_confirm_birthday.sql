-- The setup questions ask for the birthday again, so a mistake made at sign-up can be fixed and
-- older accounts (made before age checks) can be verified. The app can't write birthday or
-- age_verified_at itself, so this is the one door: it takes a birthday, refuses anyone under 18,
-- and marks the account age verified (keeping the original date if there already was one).

CREATE OR REPLACE FUNCTION public.confirm_birthday(p_birthday date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_age int;
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

  UPDATE public.user_profiles
  SET birthday = p_birthday,
      age_verified_at = COALESCE(age_verified_at, now()),
      updated_at = now()
  WHERE id = v_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'profile_not_found');
  END IF;

  RETURN jsonb_build_object('success', true, 'age', v_age);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_birthday(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_birthday(date) TO authenticated;

/*
# Auto-flag timobarrs@gmail.com as super user on signup

1. Changes
   - Adds a trigger that sets `is_super_user = true` on the `user_profiles` row
     the moment the account `timobarrs@gmail.com` is created in `auth.users`.
   - This is a one-account convenience so the owner gets premium access
     automatically upon first sign-up, with no manual SQL step.

2. Security
   - The trigger function is `SECURITY DEFINER` so it can write to `user_profiles`
     during the auth insert (which runs as the anon/postgres role).
   - The email match is hardcoded; no new public API surface is exposed.
   - Only fires for the single email listed below.

3. Important Notes
   - If the account already existed before this migration, the trigger would not
     fire (it only runs on INSERT). In that case the flag must be set manually.
   - Safe to re-run: uses `DROP FUNCTION IF EXISTS` before recreating.
*/

CREATE OR REPLACE FUNCTION public.flag_owner_as_super_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.email = 'timobarrs@gmail.com' THEN
    UPDATE public.user_profiles
    SET is_super_user = true
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_super_user ON auth.users;
CREATE TRIGGER on_auth_user_created_super_user
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.flag_owner_as_super_user();
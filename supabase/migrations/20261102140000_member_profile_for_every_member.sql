-- Every member gets a public profile
--
-- Tapping someone's face (chat, buddy list, spaces, the town) opens their profile, so
-- every person needs one. A new user_profiles row now creates a public member profile
-- right away, using the nickname when there is one. Existing profile rows and
-- anything a member has already set are left alone.

CREATE OR REPLACE FUNCTION public.create_member_profile_for_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.member_profiles (user_id, display_name, is_public, discoverable)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(btrim(NEW.nickname), ''), NULLIF(NULLIF(btrim(NEW.name), ''), 'there'), 'Member'),
    true,
    true
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_member_profile_for_new_user() FROM anon, authenticated, public;

DROP TRIGGER IF EXISTS user_profiles_create_member_profile ON public.user_profiles;
CREATE TRIGGER user_profiles_create_member_profile
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_member_profile_for_new_user();

-- Backfill: anyone without one gets a public profile.
INSERT INTO public.member_profiles (user_id, display_name, is_public, is_bot, discoverable)
SELECT u.id,
       COALESCE(NULLIF(btrim(up.nickname), ''), NULLIF(NULLIF(btrim(up.name), ''), 'there'), 'Member'),
       true,
       u.email LIKE '%@community.local',
       true
FROM auth.users u
LEFT JOIN public.user_profiles up ON up.id = u.id
WHERE NOT EXISTS (SELECT 1 FROM public.member_profiles mp WHERE mp.user_id = u.id);

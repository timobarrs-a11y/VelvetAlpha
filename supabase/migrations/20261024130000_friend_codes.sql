/*
  # Friend codes

  Every member gets a unique 8-digit friend code (like Pokémon GO) that they
  can share or show on their billboard. Entering it, or opening
  /add/<code>, sends a friend request or opens the chat.

  1. `user_profiles.friend_code`
    - 8 digits, never starting with 0, unique. Filled for existing members and
      on insert. Members cannot change it themselves.

  2. Functions (authenticated only, SECURITY DEFINER with narrow outputs)
    - `get_my_friend_code()`: the caller's code.
    - `get_friend_code(p_user_id)`: someone's code, for billboards. Null when
      either side has blocked the other.
    - `find_user_by_friend_code(p_code)`: who a code belongs to (id, name,
      avatar). Nothing for blocked pairs.
    - `im_display_names(p_user_ids)`: display names for people the caller is
      connected to (friendship in any state, or a conversation). Falls back
      from the messenger card to the member profile to the account nickname,
      so friends without a messenger card are no longer "Anonymous".
*/

ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS friend_code text;

-- SECURITY DEFINER: it must see every member's code to stay unique, and runs
-- inside sign-up where the caller can only see their own row.
CREATE OR REPLACE FUNCTION public.generate_friend_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code text;
BEGIN
  LOOP
    code := (10000000 + floor(random() * 90000000))::bigint::text;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE friend_code = code);
  END LOOP;
  RETURN code;
END;
$$;

-- One row at a time so each code sees the ones assigned before it.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.user_profiles WHERE friend_code IS NULL LOOP
    UPDATE public.user_profiles SET friend_code = public.generate_friend_code() WHERE id = r.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_friend_code_key ON public.user_profiles (friend_code);

CREATE OR REPLACE FUNCTION public.user_profiles_friend_code_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.friend_code := COALESCE(NEW.friend_code, public.generate_friend_code());
  -- auth.role() is the caller's JWT role even inside SECURITY DEFINER; members
  -- can't pick their own code, only the service role can change it.
  ELSIF NEW.friend_code IS DISTINCT FROM OLD.friend_code
        AND coalesce((SELECT auth.role()), 'anon') IN ('authenticated', 'anon') THEN
    NEW.friend_code := OLD.friend_code;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_profiles_friend_code_guard ON public.user_profiles;
CREATE TRIGGER user_profiles_friend_code_guard
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.user_profiles_friend_code_guard();

-- Best available name for a member, without exposing anything else.
CREATE OR REPLACE FUNCTION public.im_member_display_name(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT NULLIF(btrim(display_name), '') FROM public.im_discovery_profiles WHERE user_id = p_user_id),
    (SELECT NULLIF(btrim(display_name), '') FROM public.member_profiles WHERE user_id = p_user_id),
    (SELECT NULLIF(btrim(nickname), '') FROM public.user_profiles WHERE id = p_user_id),
    (SELECT NULLIF(btrim(name), '') FROM public.user_profiles
      WHERE id = p_user_id AND lower(btrim(name)) NOT IN ('there', 'babe')),
    'Velvet member'
  );
$$;

CREATE OR REPLACE FUNCTION public.im_is_blocked_pair(a uuid, b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.im_blocks
    WHERE (blocker_id = a AND blocked_id = b) OR (blocker_id = b AND blocked_id = a)
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_friend_code()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT friend_code FROM public.user_profiles WHERE id = (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.get_friend_code(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT up.friend_code
  FROM public.user_profiles up
  WHERE up.id = p_user_id
    AND (SELECT auth.uid()) IS NOT NULL
    AND NOT public.im_is_blocked_pair((SELECT auth.uid()), p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.find_user_by_friend_code(p_code text)
RETURNS TABLE (user_id uuid, display_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT up.id,
         public.im_member_display_name(up.id),
         (SELECT avatar_url FROM public.im_discovery_profiles WHERE user_id = up.id)
  FROM public.user_profiles up
  WHERE (SELECT auth.uid()) IS NOT NULL
    AND up.friend_code = regexp_replace(coalesce(p_code, ''), '\D', '', 'g')
    AND COALESCE(up.is_banned, false) = false
    AND NOT public.im_is_blocked_pair((SELECT auth.uid()), up.id);
$$;

CREATE OR REPLACE FUNCTION public.im_display_names(p_user_ids uuid[])
RETURNS TABLE (user_id uuid, display_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u, public.im_member_display_name(u)
  FROM unnest(p_user_ids) AS u
  WHERE (SELECT auth.uid()) IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.im_friendships f
        WHERE (f.requester_id = (SELECT auth.uid()) AND f.addressee_id = u)
           OR (f.addressee_id = (SELECT auth.uid()) AND f.requester_id = u)
      )
      OR EXISTS (
        SELECT 1 FROM public.im_conversations c
        WHERE (c.user_a_id = (SELECT auth.uid()) AND c.user_b_id = u)
           OR (c.user_b_id = (SELECT auth.uid()) AND c.user_a_id = u)
      )
    );
$$;

REVOKE ALL ON FUNCTION public.generate_friend_code() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.user_profiles_friend_code_guard() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.im_member_display_name(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.im_is_blocked_pair(uuid, uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_my_friend_code() FROM public, anon;
REVOKE ALL ON FUNCTION public.get_friend_code(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.find_user_by_friend_code(text) FROM public, anon;
REVOKE ALL ON FUNCTION public.im_display_names(uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_friend_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_friend_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_user_by_friend_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.im_display_names(uuid[]) TO authenticated;

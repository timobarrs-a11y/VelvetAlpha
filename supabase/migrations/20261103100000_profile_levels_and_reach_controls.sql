-- Profile levels, shared wins, reach controls and status audience
--
-- Everyone exists in the community. Every member has a FRONT CARD that anyone can see:
-- display name (their nickname: a real name is never shown unless they put it there themselves), interests, favorite color,
-- zodiac and a broad outline of what they are working on.
--
-- The FULL PAGE (bio, goals, commitments, statuses, and commenting) is for friends. A member
-- can choose a public-facing profile (profile_mode = 'open') to give it to everyone.
--
-- WINS: finishing a goal, task, plan step or commitment posts an accomplishment that shows
-- what they did. Accomplishments are shared with every member and appear in Discover, so
-- people who get things done can find and cheer each other on. It is on by default and each
-- member can turn it off (share_accomplishments); friends always see them.
--
-- member_profiles gets:
--   share_accomplishments   true | false       wins appear in Discover and on the front page
--   profile_mode            friends | open     open = full page for everyone
--   who_can_message         everyone | friends | nobody
--   accepts_friend_requests true | false
--   accepts_mail            true | false       (letters from Velvet; opted-out members are skipped)
--   comments_from           everyone | friends (who may comment on their posts and wins)
-- progress_posts gets an audience for statuses: everyone | friends.
--
-- Everything is enforced in the database, so the app cannot be used to get around it:
--   * messages and friend requests follow the recipient's settings
--   * comments and likes need permission to see the post
--   * posts only appear in feeds for people allowed to see them
--   * finishing a goal, commitment or plan step now posts for every member (it used to
--     require a public profile, which most accounts never had)
--   * send_town_letter skips members who turned mail off
--
-- Every new user_profiles row also gets a member profile and a starter house in town, and anyone
-- who has none now gets them.
-- Nicknames are the name people see; a real name is never shown unless they put it there.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.members_are_friends(a uuid, b uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a IS NOT NULL AND b IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.im_friendships f
    WHERE f.status = 'accepted'
      AND ((f.requester_id = a AND f.addressee_id = b) OR (f.requester_id = b AND f.addressee_id = a))
  ) AND NOT EXISTS (
    SELECT 1 FROM public.im_blocks k
    WHERE (k.blocker_id = a AND k.blocked_id = b) OR (k.blocker_id = b AND k.blocked_id = a)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.members_are_friends(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.members_are_friends(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS share_accomplishments boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS profile_mode text NOT NULL DEFAULT 'friends',
  ADD COLUMN IF NOT EXISTS who_can_message text NOT NULL DEFAULT 'everyone',
  ADD COLUMN IF NOT EXISTS accepts_friend_requests boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS accepts_mail boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS comments_from text NOT NULL DEFAULT 'everyone';

ALTER TABLE public.member_profiles DROP CONSTRAINT IF EXISTS member_profiles_profile_mode_check;
ALTER TABLE public.member_profiles ADD CONSTRAINT member_profiles_profile_mode_check
  CHECK (profile_mode IN ('open', 'friends'));
ALTER TABLE public.member_profiles DROP CONSTRAINT IF EXISTS member_profiles_who_can_message_check;
ALTER TABLE public.member_profiles ADD CONSTRAINT member_profiles_who_can_message_check
  CHECK (who_can_message IN ('everyone', 'friends', 'nobody'));
ALTER TABLE public.member_profiles DROP CONSTRAINT IF EXISTS member_profiles_comments_from_check;
ALTER TABLE public.member_profiles ADD CONSTRAINT member_profiles_comments_from_check
  CHECK (comments_from IN ('everyone', 'friends'));

GRANT INSERT (share_accomplishments, profile_mode, who_can_message, accepts_friend_requests, accepts_mail, comments_from) ON public.member_profiles TO authenticated;
GRANT UPDATE (share_accomplishments, profile_mode, who_can_message, accepts_friend_requests, accepts_mail, comments_from) ON public.member_profiles TO authenticated;

-- Existence is always public now; the front card is shown whatever this said before.
UPDATE public.member_profiles SET is_public = true WHERE NOT is_public;

ALTER TABLE public.progress_posts ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'everyone';
ALTER TABLE public.progress_posts DROP CONSTRAINT IF EXISTS progress_posts_audience_check;
ALTER TABLE public.progress_posts ADD CONSTRAINT progress_posts_audience_check CHECK (audience IN ('everyone', 'friends'));

-- ---------------------------------------------------------------------------
-- Who can see what
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_member_profile(p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.member_profiles WHERE user_id = p_user_id); $$;
REVOKE EXECUTE ON FUNCTION public.has_member_profile(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_member_profile(uuid) TO authenticated;

-- A post is visible to its author and their friends. Everyone else sees:
--   * accomplishments (every post that is not a status), when the author shares their wins
--   * statuses, when the author is public-facing and the status is for everyone
CREATE OR REPLACE FUNCTION public.can_see_post_of(p_author uuid, p_audience text, p_post_type text, p_viewer uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p_viewer IS NOT NULL AND (
    p_viewer = p_author
    OR public.members_are_friends(p_viewer, p_author)
    OR (p_post_type <> 'status'
        AND COALESCE((SELECT mp.share_accomplishments FROM public.member_profiles mp WHERE mp.user_id = p_author), true))
    OR (p_post_type = 'status' AND p_audience = 'everyone'
        AND COALESCE((SELECT mp.profile_mode FROM public.member_profiles mp WHERE mp.user_id = p_author), 'friends') = 'open')
  );
$$;
REVOKE EXECUTE ON FUNCTION public.can_see_post_of(uuid, text, text, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_see_post_of(uuid, text, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_view_progress_post(p_post_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.progress_posts pp
    WHERE pp.id = p_post_id AND public.can_see_post_of(pp.user_id, pp.audience, pp.post_type, auth.uid())
  );
$$;
REVOKE EXECUTE ON FUNCTION public.can_view_progress_post(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_view_progress_post(uuid) TO authenticated;

DROP POLICY IF EXISTS "select_post_comments" ON public.progress_post_comments;
CREATE POLICY "select_post_comments" ON public.progress_post_comments
  FOR SELECT TO authenticated
  USING (NOT users_blocked(auth.uid(), user_id) AND public.can_view_progress_post(post_id));

DROP POLICY IF EXISTS "insert_own_comment" ON public.progress_post_comments;
CREATE POLICY "insert_own_comment" ON public.progress_post_comments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT users_blocked(auth.uid(), get_post_owner(post_id)) AND public.can_view_progress_post(post_id));

DROP POLICY IF EXISTS "insert_own_like" ON public.progress_post_likes;
CREATE POLICY "insert_own_like" ON public.progress_post_likes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT users_blocked(auth.uid(), get_post_owner(post_id)) AND public.can_view_progress_post(post_id));

-- ---------------------------------------------------------------------------
-- Messages
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.im_enforce_reach()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  recipient uuid;
  setting text;
BEGIN
  SELECT CASE WHEN c.user_a_id = NEW.sender_id THEN c.user_b_id ELSE c.user_a_id END
    INTO recipient
  FROM public.im_conversations c WHERE c.id = NEW.conversation_id;

  IF recipient IS NULL THEN RETURN NEW; END IF;

  SELECT mp.who_can_message INTO setting FROM public.member_profiles mp WHERE mp.user_id = recipient;
  IF setting = 'nobody' OR (setting = 'friends' AND NOT public.members_are_friends(NEW.sender_id, recipient)) THEN
    RAISE EXCEPTION 'This member is not taking messages from you right now' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.im_enforce_reach() FROM anon, authenticated, public;

DROP TRIGGER IF EXISTS trg_im_messages_reach ON public.im_messages;
CREATE TRIGGER trg_im_messages_reach
  BEFORE INSERT ON public.im_messages
  FOR EACH ROW EXECUTE FUNCTION public.im_enforce_reach();

-- ---------------------------------------------------------------------------
-- Friend requests
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.im_enforce_friend_requests()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pending' AND EXISTS (
    SELECT 1 FROM public.member_profiles mp
    WHERE mp.user_id = NEW.addressee_id AND NOT mp.accepts_friend_requests
  ) THEN
    RAISE EXCEPTION 'This member is not accepting friend requests right now' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.im_enforce_friend_requests() FROM anon, authenticated, public;

DROP TRIGGER IF EXISTS trg_im_friendships_reach ON public.im_friendships;
CREATE TRIGGER trg_im_friendships_reach
  BEFORE INSERT ON public.im_friendships
  FOR EACH ROW EXECUTE FUNCTION public.im_enforce_friend_requests();

-- ---------------------------------------------------------------------------
-- Comments: follow the author's comments_from setting
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.progress_comment_enforce_reach()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  owner uuid;
  setting text;
BEGIN
  SELECT pp.user_id INTO owner FROM public.progress_posts pp WHERE pp.id = NEW.post_id;
  IF owner IS NULL OR owner = NEW.user_id THEN RETURN NEW; END IF;

  SELECT mp.comments_from INTO setting FROM public.member_profiles mp WHERE mp.user_id = owner;
  IF setting = 'friends' AND NOT public.members_are_friends(NEW.user_id, owner) THEN
    RAISE EXCEPTION 'Only friends can comment on this member''s posts' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.progress_comment_enforce_reach() FROM anon, authenticated, public;

DROP TRIGGER IF EXISTS trg_progress_comment_reach ON public.progress_post_comments;
CREATE TRIGGER trg_progress_comment_reach
  BEFORE INSERT ON public.progress_post_comments
  FOR EACH ROW EXECUTE FUNCTION public.progress_comment_enforce_reach();

-- ---------------------------------------------------------------------------
-- Writing a status: choose the audience
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_status_post(text);

CREATE FUNCTION public.create_status_post(p_body text, p_audience text DEFAULT 'everyone')
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_body text := btrim(COALESCE(p_body, ''));
  v_audience text := COALESCE(NULLIF(btrim(p_audience), ''), 'everyone');
  v_id uuid := gen_random_uuid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_signed_in');
  END IF;
  IF NOT public.can_use_social(v_uid) THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_access');
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE id = v_uid AND COALESCE(is_banned, false)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'banned');
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
$$;
REVOKE ALL ON FUNCTION public.create_status_post(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_status_post(text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Feeds: friends-only posts only reach the author and their friends
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_member_posts_inner(p_user_ids uuid[], p_viewer_uid uuid, p_limit integer, p_offset integer)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_results jsonb;
BEGIN
  SELECT jsonb_agg(t.post ORDER BY t.created_at DESC)
  INTO v_results
  FROM (
    SELECT pp.created_at, jsonb_build_object(
      'id', pp.id,
      'user_id', pp.user_id,
      'post_type', pp.post_type,
      'title', public.progress_post_title(pp, p_viewer_uid),
      'body', CASE WHEN pp.post_type = 'status' THEN pp.body END,
      'ref_target_type', pp.ref_target_type,
      'ref_target_id', pp.ref_target_id,
      'goal_id', pp.goal_id,
      'like_count', pp.like_count,
      'comment_count', pp.comment_count,
      'is_auto_generated', pp.is_auto_generated,
      'created_at', pp.created_at,
      'audience', pp.audience,
      'author_name', COALESCE(mp.display_name, 'Member'),
      'author_avatar_config', mp.avatar_config,
      'author_profile_image_type', COALESCE(mp.profile_image_type, 'avatar'),
      'author_profile_smilie_code', mp.profile_smilie_code,
      'author_is_bot', COALESCE(mp.is_bot, false)
    ) AS post
    FROM public.progress_posts pp
    LEFT JOIN public.member_profiles mp ON mp.user_id = pp.user_id
    WHERE pp.user_id = ANY(p_user_ids)
      AND pp.deleted_at IS NULL
      AND public.can_see_post_of(pp.user_id, pp.audience, pp.post_type, p_viewer_uid)
      AND NOT public.users_blocked(p_viewer_uid, pp.user_id)
    ORDER BY pp.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) t;

  RETURN jsonb_build_object('success', true, 'posts', COALESCE(v_results, '[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_trending_posts_inner(p_user_ids uuid[], p_viewer_uid uuid, p_limit integer, p_since timestamp with time zone)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_results jsonb;
BEGIN
  SELECT jsonb_agg(t.post ORDER BY t.score DESC, t.created_at DESC)
  INTO v_results
  FROM (
    SELECT
      pp.created_at,
      COALESCE(pp.like_count, 0) + CASE WHEN post_count.author_post_count < 5 THEN 5 ELSE 0 END AS score,
      jsonb_build_object(
        'id', pp.id,
        'user_id', pp.user_id,
        'post_type', pp.post_type,
        'title', public.progress_post_title(pp, p_viewer_uid),
        'body', CASE WHEN pp.post_type = 'status' THEN pp.body END,
        'ref_target_type', pp.ref_target_type,
        'ref_target_id', pp.ref_target_id,
        'goal_id', pp.goal_id,
        'like_count', pp.like_count,
        'comment_count', pp.comment_count,
        'is_auto_generated', pp.is_auto_generated,
        'created_at', pp.created_at,
        'audience', pp.audience,
        'author_name', COALESCE(mp.display_name, 'Member'),
        'author_avatar_config', mp.avatar_config,
        'author_profile_image_type', COALESCE(mp.profile_image_type, 'avatar'),
        'author_profile_smilie_code', mp.profile_smilie_code,
        'author_is_bot', COALESCE(mp.is_bot, false)
      ) AS post
    FROM public.progress_posts pp
    LEFT JOIN public.member_profiles mp ON mp.user_id = pp.user_id
    LEFT JOIN LATERAL (
      SELECT count(*) AS author_post_count
      FROM public.progress_posts pp2
      WHERE pp2.user_id = pp.user_id AND pp2.deleted_at IS NULL
    ) post_count ON true
    WHERE pp.user_id = ANY(p_user_ids)
      AND pp.created_at >= p_since
      AND pp.deleted_at IS NULL
      AND public.can_see_post_of(pp.user_id, pp.audience, pp.post_type, p_viewer_uid)
      AND NOT public.users_blocked(p_viewer_uid, pp.user_id)
    ORDER BY score DESC, pp.created_at DESC
    LIMIT p_limit
  ) t;

  RETURN jsonb_build_object('success', true, 'posts', COALESCE(v_results, '[]'::jsonb));
END;
$$;

-- ---------------------------------------------------------------------------
-- Mail: skip members who turned it off
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_town_letter(p_subject text, p_body text, p_user_ids uuid[] DEFAULT NULL, p_sender text DEFAULT 'Velvet')
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  sent int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only an admin can send letters' USING ERRCODE = '42501';
  END IF;
  IF p_body IS NULL OR char_length(btrim(p_body)) = 0 THEN
    RAISE EXCEPTION 'A letter needs some words';
  END IF;

  INSERT INTO public.town_letters (user_id, sender_label, subject, body)
  SELECT wp.user_id, COALESCE(NULLIF(btrim(p_sender), ''), 'Velvet'), COALESCE(btrim(p_subject), ''), btrim(p_body)
  FROM public.world_plots wp
  WHERE (p_user_ids IS NULL OR wp.user_id = ANY (p_user_ids))
    AND NOT COALESCE((SELECT mp.is_bot FROM public.member_profiles mp WHERE mp.user_id = wp.user_id), false)
    AND COALESCE((SELECT mp.accepts_mail FROM public.member_profiles mp WHERE mp.user_id = wp.user_id), true);

  GET DIAGNOSTICS sent = ROW_COUNT;
  RETURN sent;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.send_town_letter(text, text, uuid[], text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.send_town_letter(text, text, uuid[], text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Wins: finishing something posts an accomplishment for every member
-- ---------------------------------------------------------------------------
-- These four triggers used to return early unless the member had a PUBLIC profile, and most
-- accounts had no profile row at all, so nothing was ever posted. They now only need a
-- profile row. Who sees the win is decided when it is read (can_see_post_of).
CREATE OR REPLACE FUNCTION public.create_post_on_goal_completed()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    IF NOT public.has_member_profile(NEW.user_id) THEN RETURN NEW; END IF;
    IF public.post_exists_for_target(NEW.user_id, 'user_goals', NEW.id, 'goal_completed') THEN RETURN NEW; END IF;

    INSERT INTO public.progress_posts (user_id, post_type, title, body, ref_target_type, ref_target_id, goal_id)
    VALUES (NEW.user_id, 'goal_completed', 'Finished a goal 🏆', NULL, 'user_goals', NEW.id, NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_post_on_commitment_completed()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_goal_id uuid;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    IF NOT public.has_member_profile(NEW.user_id) THEN RETURN NEW; END IF;
    IF public.post_exists_for_target(NEW.user_id, 'coaching_commitments', NEW.id, 'commitment_completed') THEN RETURN NEW; END IF;

    v_goal_id := NEW.goal_id;
    INSERT INTO public.progress_posts (user_id, post_type, title, body, ref_target_type, ref_target_id, goal_id)
    VALUES (NEW.user_id, 'commitment_completed', 'Kept a commitment', NULL, 'coaching_commitments', NEW.id, v_goal_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_post_on_plan_step_completed()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_user_id uuid;
  v_goal_id uuid;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    SELECT p.user_id INTO v_user_id FROM public.coach_plans p WHERE p.id = NEW.plan_id;
    IF v_user_id IS NULL THEN RETURN NEW; END IF;
    IF NOT public.has_member_profile(v_user_id) THEN RETURN NEW; END IF;
    IF public.post_exists_for_target(v_user_id, 'coach_plan_steps', NEW.id, 'plan_step_completed') THEN RETURN NEW; END IF;

    IF NEW.commitment_id IS NOT NULL THEN
      SELECT goal_id INTO v_goal_id FROM public.coaching_commitments WHERE id = NEW.commitment_id;
    END IF;

    INSERT INTO public.progress_posts (user_id, post_type, title, body, ref_target_type, ref_target_id, goal_id)
    VALUES (v_user_id, 'plan_step_completed', 'Completed a plan step', NULL, 'coach_plan_steps', NEW.id, v_goal_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_post_on_milestone()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.has_member_profile(NEW.user_id) THEN RETURN NEW; END IF;
  IF public.post_exists_for_target(NEW.user_id, 'milestone_achievements', NEW.id, 'milestone_achieved') THEN RETURN NEW; END IF;

  INSERT INTO public.progress_posts (user_id, post_type, title, body, ref_target_type, ref_target_id)
  VALUES (NEW.user_id, 'milestone_achieved', 'Milestone unlocked', NULL, 'milestone_achievements', NEW.id);
  RETURN NEW;
END;
$$;

-- A win says what was done. Anyone who can see the post sees this, because sharing wins is
-- the point (a member who does not want that turns off share_accomplishments).
CREATE OR REPLACE FUNCTION public.progress_post_title(pp public.progress_posts, p_viewer_uid uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT CASE pp.post_type
    WHEN 'commitment_completed' THEN COALESCE(
      (SELECT 'Kept a commitment: ' || cc.description FROM public.coaching_commitments cc WHERE cc.id = pp.ref_target_id),
      pp.title)
    WHEN 'plan_step_completed' THEN COALESCE(
      (SELECT 'Completed: ' || COALESCE(NULLIF(btrim(cps.user_set_title), ''), cps.title)
              || COALESCE(' (toward ' || (SELECT ug.title FROM public.user_goals ug WHERE ug.id = pp.goal_id) || ')', '')
         FROM public.coach_plan_steps cps WHERE cps.id = pp.ref_target_id),
      pp.title)
    WHEN 'goal_completed' THEN COALESCE(
      (SELECT 'Finished ' || ug.title || ' 🏆' FROM public.user_goals ug WHERE ug.id = pp.ref_target_id),
      pp.title)
    WHEN 'milestone_achieved' THEN COALESCE(
      (SELECT 'Milestone unlocked: ' || ma.achievement_name FROM public.milestone_achievements ma WHERE ma.id = pp.ref_target_id),
      pp.title)
    ELSE pp.title
  END;
$$;

-- ---------------------------------------------------------------------------
-- Feeds that listed only "public" members now list everyone
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_member_posts(p_user_id uuid, p_limit integer DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'posts', '[]'::jsonb);
  END IF;
  IF public.users_blocked(v_uid, p_user_id) THEN
    RETURN jsonb_build_object('success', true, 'posts', '[]'::jsonb);
  END IF;
  -- What comes back is already limited to what this viewer may see (a friend sees everything,
  -- anyone else sees the wins this member shares).
  RETURN public.get_member_posts_inner(ARRAY[p_user_id], v_uid, p_limit, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_feed(p_limit integer DEFAULT 30, p_offset integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_user_ids uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'posts', '[]'::jsonb);
  END IF;

  SELECT array_agg(user_id) INTO v_user_ids FROM public.member_profiles;
  v_user_ids := array_append(COALESCE(v_user_ids, ARRAY[]::uuid[]), v_uid);

  RETURN public.get_member_posts_inner(v_user_ids, v_uid, LEAST(GREATEST(p_limit, 1), 50), GREATEST(p_offset, 0));
END;
$$;

-- ---------------------------------------------------------------------------
-- Discover: people getting things done
-- ---------------------------------------------------------------------------
-- Recent wins from every member who shares them, other than you. This is how you find
-- people you are not friends with and cheer them on.
CREATE OR REPLACE FUNCTION public.get_discover_accomplishments(p_limit integer DEFAULT 30, p_offset integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_results jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'posts', '[]'::jsonb);
  END IF;

  SELECT jsonb_agg(t.post ORDER BY t.created_at DESC)
  INTO v_results
  FROM (
    SELECT pp.created_at, jsonb_build_object(
      'id', pp.id,
      'user_id', pp.user_id,
      'post_type', pp.post_type,
      'title', public.progress_post_title(pp, v_uid),
      'body', NULL,
      'ref_target_type', pp.ref_target_type,
      'ref_target_id', pp.ref_target_id,
      'goal_id', pp.goal_id,
      'like_count', pp.like_count,
      'comment_count', pp.comment_count,
      'is_auto_generated', pp.is_auto_generated,
      'created_at', pp.created_at,
      'audience', pp.audience,
      'author_name', COALESCE(NULLIF(NULLIF(btrim(mp.display_name), ''), 'Member'), NULLIF(btrim(up.nickname), ''), 'Member'),
      'author_avatar_config', mp.avatar_config,
      'author_profile_image_type', COALESCE(mp.profile_image_type, 'avatar'),
      'author_profile_smilie_code', mp.profile_smilie_code,
      'author_is_bot', COALESCE(mp.is_bot, false)
    ) AS post
    FROM public.progress_posts pp
    JOIN public.member_profiles mp ON mp.user_id = pp.user_id
    LEFT JOIN public.user_profiles up ON up.id = pp.user_id
    WHERE pp.post_type <> 'status'
      AND pp.deleted_at IS NULL
      AND pp.user_id <> v_uid
      AND mp.share_accomplishments
      AND pp.created_at > now() - interval '30 days'
      AND NOT public.users_blocked(v_uid, pp.user_id)
    ORDER BY pp.created_at DESC
    LIMIT LEAST(GREATEST(p_limit, 1), 50) OFFSET GREATEST(p_offset, 0)
  ) t;

  RETURN jsonb_build_object('success', true, 'posts', COALESCE(v_results, '[]'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.get_discover_accomplishments(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_discover_accomplishments(integer, integer) TO authenticated;

-- ---------------------------------------------------------------------------
-- The front card: what anyone may see about anyone
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.zodiac_for(p_birthday date)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_birthday IS NULL THEN NULL
    WHEN (extract(month FROM p_birthday) = 3 AND extract(day FROM p_birthday) >= 21) OR (extract(month FROM p_birthday) = 4 AND extract(day FROM p_birthday) <= 19) THEN 'Aries'
    WHEN (extract(month FROM p_birthday) = 4 AND extract(day FROM p_birthday) >= 20) OR (extract(month FROM p_birthday) = 5 AND extract(day FROM p_birthday) <= 20) THEN 'Taurus'
    WHEN (extract(month FROM p_birthday) = 5 AND extract(day FROM p_birthday) >= 21) OR (extract(month FROM p_birthday) = 6 AND extract(day FROM p_birthday) <= 20) THEN 'Gemini'
    WHEN (extract(month FROM p_birthday) = 6 AND extract(day FROM p_birthday) >= 21) OR (extract(month FROM p_birthday) = 7 AND extract(day FROM p_birthday) <= 22) THEN 'Cancer'
    WHEN (extract(month FROM p_birthday) = 7 AND extract(day FROM p_birthday) >= 23) OR (extract(month FROM p_birthday) = 8 AND extract(day FROM p_birthday) <= 22) THEN 'Leo'
    WHEN (extract(month FROM p_birthday) = 8 AND extract(day FROM p_birthday) >= 23) OR (extract(month FROM p_birthday) = 9 AND extract(day FROM p_birthday) <= 22) THEN 'Virgo'
    WHEN (extract(month FROM p_birthday) = 9 AND extract(day FROM p_birthday) >= 23) OR (extract(month FROM p_birthday) = 10 AND extract(day FROM p_birthday) <= 22) THEN 'Libra'
    WHEN (extract(month FROM p_birthday) = 10 AND extract(day FROM p_birthday) >= 23) OR (extract(month FROM p_birthday) = 11 AND extract(day FROM p_birthday) <= 21) THEN 'Scorpio'
    WHEN (extract(month FROM p_birthday) = 11 AND extract(day FROM p_birthday) >= 22) OR (extract(month FROM p_birthday) = 12 AND extract(day FROM p_birthday) <= 21) THEN 'Sagittarius'
    WHEN (extract(month FROM p_birthday) = 12 AND extract(day FROM p_birthday) >= 22) OR (extract(month FROM p_birthday) = 1 AND extract(day FROM p_birthday) <= 19) THEN 'Capricorn'
    WHEN (extract(month FROM p_birthday) = 1 AND extract(day FROM p_birthday) >= 20) OR (extract(month FROM p_birthday) = 2 AND extract(day FROM p_birthday) <= 18) THEN 'Aquarius'
    ELSE 'Pisces'
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_profile_card(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row record;
  v_friend boolean;
  v_access boolean;
  v_request text := 'none';
  v_interests jsonb;
  v_areas jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false); END IF;
  IF v_uid <> p_user_id AND public.users_blocked(v_uid, p_user_id) THEN RETURN jsonb_build_object('success', false); END IF;

  SELECT mp.user_id, mp.display_name, mp.headline, mp.profile_image_type, mp.profile_smilie_code, mp.is_bot,
         mp.profile_mode, mp.who_can_message, mp.accepts_friend_requests, mp.share_accomplishments,
         up.nickname, up.favorite_color, up.zodiac_sign, up.birthday, up.interests, up.hobbies,
         up.sports_interests, up.entertainment_interests, up.tech_interests, up.lifestyle_interests, up.music_genre
    INTO v_row
  FROM public.member_profiles mp
  LEFT JOIN public.user_profiles up ON up.id = mp.user_id
  WHERE mp.user_id = p_user_id;

  IF v_row.user_id IS NULL THEN RETURN jsonb_build_object('success', false); END IF;

  v_friend := public.members_are_friends(v_uid, p_user_id);
  v_access := v_uid = p_user_id OR v_friend OR v_row.profile_mode = 'open';

  SELECT COALESCE(jsonb_agg(i), '[]'::jsonb) INTO v_interests
  FROM (
    SELECT i FROM (
      SELECT DISTINCT ON (lower(btrim(x))) btrim(x) AS i
      FROM unnest(
        COALESCE(v_row.interests, '{}'::text[]) || COALESCE(v_row.hobbies, '{}'::text[])
        || COALESCE(v_row.sports_interests, '{}'::text[]) || COALESCE(v_row.entertainment_interests, '{}'::text[])
        || COALESCE(v_row.tech_interests, '{}'::text[]) || COALESCE(v_row.lifestyle_interests, '{}'::text[])
        || CASE WHEN v_row.music_genre IS NULL OR btrim(v_row.music_genre) = '' THEN '{}'::text[] ELSE ARRAY[v_row.music_genre] END
      ) AS x
      WHERE btrim(x) <> ''
    ) d LIMIT 12
  ) l;

  -- A broad outline only: the areas they are working on, never the goals themselves.
  SELECT COALESCE(jsonb_agg(g), '[]'::jsonb) INTO v_areas
  FROM (
    SELECT DISTINCT ug.goal_type AS g FROM public.user_goals ug
    WHERE ug.user_id = p_user_id AND ug.status = 'active' AND ug.goal_type IS NOT NULL AND btrim(ug.goal_type) <> ''
    LIMIT 4
  ) a;

  IF v_uid <> p_user_id AND NOT v_friend THEN
    SELECT CASE
      WHEN EXISTS (SELECT 1 FROM public.im_friendships f WHERE f.status = 'pending' AND f.requester_id = v_uid AND f.addressee_id = p_user_id) THEN 'sent'
      WHEN EXISTS (SELECT 1 FROM public.im_friendships f WHERE f.status = 'pending' AND f.requester_id = p_user_id AND f.addressee_id = v_uid) THEN 'received'
      ELSE 'none' END INTO v_request;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'card', jsonb_build_object(
      'user_id', v_row.user_id,
      -- the name they chose: never their real name
      'display_name', COALESCE(NULLIF(NULLIF(btrim(v_row.display_name), ''), 'Member'), NULLIF(btrim(v_row.nickname), ''), 'Member'),
      'headline', v_row.headline,
      'profile_image_type', COALESCE(v_row.profile_image_type, 'avatar'),
      'profile_smilie_code', v_row.profile_smilie_code,
      'is_bot', v_row.is_bot,
      'interests', v_interests,
      'favorite_color', NULLIF(btrim(v_row.favorite_color), ''),
      'zodiac_sign', COALESCE(NULLIF(btrim(v_row.zodiac_sign), ''), public.zodiac_for(v_row.birthday)),
      'goal_areas', v_areas
    ),
    'relation', jsonb_build_object(
      'is_self', v_uid = p_user_id,
      'is_friend', v_friend,
      'has_full_access', v_access,
      'friend_request', v_request
    ),
    'reach', jsonb_build_object(
      'who_can_message', v_row.who_can_message,
      'accepts_friend_requests', v_row.accepts_friend_requests,
      'shares_accomplishments', v_row.share_accomplishments
    )
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_profile_card(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_card(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- The full page: bio, goals and commitments are for friends (or everyone, if public-facing)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_profile(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_profile jsonb;
  v_counts jsonb;
  v_goals jsonb;
  v_commitments jsonb;
  v_is_owner boolean;
  v_access boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  v_is_owner := (v_uid = p_user_id);

  IF NOT v_is_owner AND public.users_blocked(v_uid, p_user_id) THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  v_access := v_is_owner
    OR public.members_are_friends(v_uid, p_user_id)
    OR COALESCE((SELECT mp.profile_mode FROM public.member_profiles mp WHERE mp.user_id = p_user_id), 'friends') = 'open';

  SELECT jsonb_build_object(
    'user_id', mp.user_id,
    'display_name', COALESCE(NULLIF(NULLIF(btrim(mp.display_name), ''), 'Member'), NULLIF(btrim(up.nickname), ''), 'Member'),
    'headline', mp.headline,
    'bio', CASE WHEN v_access THEN mp.bio END,
    'profile_image_type', COALESCE(mp.profile_image_type, 'avatar'),
    'profile_smilie_code', mp.profile_smilie_code,
    'is_public', true,
    'follower_count', mp.follower_count,
    'following_count', mp.following_count,
    'is_bot', mp.is_bot
  ) INTO v_profile
  FROM public.member_profiles mp
  LEFT JOIN public.user_profiles up ON up.id = mp.user_id
  WHERE mp.user_id = p_user_id;

  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  SELECT jsonb_build_object(
    'active_goals', COUNT(*) FILTER (WHERE ug.status = 'active'),
    'goals_completed', COUNT(*) FILTER (WHERE ug.status = 'completed'),
    'commitments_kept', (SELECT COUNT(*) FROM public.coaching_commitments cc WHERE cc.user_id = p_user_id AND cc.status = 'completed'),
    'plan_steps_done', (SELECT COUNT(*) FROM public.coach_plan_steps cps JOIN public.coach_plans cp ON cp.id = cps.plan_id WHERE cp.user_id = p_user_id AND cps.status = 'completed'),
    'current_streak', COALESCE((SELECT uc.current_streak FROM public.user_customization uc WHERE uc.user_id = p_user_id), 0)
  ) INTO v_counts
  FROM public.user_goals ug
  WHERE ug.user_id = p_user_id;

  SELECT jsonb_agg(sub.row_data) INTO v_goals
  FROM (
    SELECT jsonb_build_object(
      'id', ug.id, 'title', ug.title, 'goal_type', ug.goal_type,
      'current_value', ug.current_value, 'target_value', ug.target_value,
      'unit', ug.unit, 'target_date', ug.target_date, 'status', ug.status
    ) AS row_data
    FROM public.user_goals ug
    WHERE ug.user_id = p_user_id AND v_access AND (ug.show_on_profile = true OR v_is_owner = true)
    ORDER BY ug.created_at DESC
  ) sub;
  IF v_goals IS NULL THEN v_goals := '[]'::jsonb; END IF;

  SELECT jsonb_agg(sub.row_data) INTO v_commitments
  FROM (
    SELECT jsonb_build_object(
      'id', cc.id, 'description', cc.description, 'due_date', cc.due_date,
      'completed_at', cc.completed_at, 'status', cc.status
    ) AS row_data
    FROM public.coaching_commitments cc
    WHERE cc.user_id = p_user_id AND v_access AND (cc.show_on_profile = true OR v_is_owner = true)
    ORDER BY cc.completed_at DESC NULLS LAST, cc.created_at DESC
  ) sub;
  IF v_commitments IS NULL THEN v_commitments := '[]'::jsonb; END IF;

  RETURN jsonb_build_object(
    'success', true, 'profile', v_profile, 'counts', v_counts,
    'goals', v_goals, 'commitments', v_commitments, 'is_owner', v_is_owner, 'has_full_access', v_access
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Every member has a profile (so everyone has a front card)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_member_profile_for_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.member_profiles (user_id, display_name, is_public, discoverable)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(btrim(NEW.nickname), ''), 'Member'),
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
       COALESCE(NULLIF(btrim(up.nickname), ''), 'Member'),
       true,
       u.email LIKE '%@community.local',
       true
FROM auth.users u
LEFT JOIN public.user_profiles up ON up.id = u.id
WHERE NOT EXISTS (SELECT 1 FROM public.member_profiles mp WHERE mp.user_id = u.id);

-- ---------------------------------------------------------------------------
-- Nicknames are the name people see
-- ---------------------------------------------------------------------------
-- When someone picks or changes their nickname, their public display name follows it, unless
-- they have set a different display name themselves.
CREATE OR REPLACE FUNCTION public.sync_member_display_name()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NULLIF(btrim(NEW.nickname), '') IS NOT NULL AND NEW.nickname IS DISTINCT FROM OLD.nickname THEN
    UPDATE public.member_profiles mp
       SET display_name = btrim(NEW.nickname), updated_at = now()
     WHERE mp.user_id = NEW.id
       AND (btrim(mp.display_name) IN ('', 'Member') OR mp.display_name = OLD.nickname);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sync_member_display_name() FROM anon, authenticated, public;

DROP TRIGGER IF EXISTS user_profiles_sync_member_display_name ON public.user_profiles;
CREATE TRIGGER user_profiles_sync_member_display_name
  AFTER UPDATE OF nickname ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_member_display_name();

-- Instant-message names: a chosen display name, then the nickname. Never a real name.
CREATE OR REPLACE FUNCTION public.im_member_display_name(p_user_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT NULLIF(btrim(display_name), '') FROM public.im_discovery_profiles WHERE user_id = p_user_id),
    (SELECT NULLIF(NULLIF(btrim(display_name), ''), 'Member') FROM public.member_profiles WHERE user_id = p_user_id),
    (SELECT NULLIF(btrim(nickname), '') FROM public.user_profiles WHERE id = p_user_id),
    'Velvet member'
  );
$$;

-- ---------------------------------------------------------------------------
-- Everyone has a house in town
-- ---------------------------------------------------------------------------
-- A plot used to exist only once someone finished the move-in step, so most accounts were
-- missing from the town. Every real account now gets a starter house at sign-up (and the
-- ones who have none get one now). People still pick or change their house in onboarding
-- and in the customizer: this only makes sure nobody is left out.
CREATE OR REPLACE FUNCTION public.ensure_world_plot(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_slot int;
BEGIN
  SELECT slot_index INTO v_slot FROM public.world_plots WHERE user_id = p_user_id;
  IF FOUND THEN RETURN v_slot; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('world_plots_slot'));
  SELECT slot_index INTO v_slot FROM public.world_plots WHERE user_id = p_user_id;
  IF FOUND THEN RETURN v_slot; END IF;

  SELECT COALESCE(max(slot_index) + 1, 0) INTO v_slot FROM public.world_plots;
  INSERT INTO public.world_plots (user_id, slot_index, house)
  VALUES (p_user_id, v_slot, '{"style": "standard"}'::jsonb)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN v_slot;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.ensure_world_plot(uuid) FROM anon, authenticated, public;

CREATE OR REPLACE FUNCTION public.ensure_world_plot_for_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_world_plot(NEW.id);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.ensure_world_plot_for_new_user() FROM anon, authenticated, public;

DROP TRIGGER IF EXISTS user_profiles_ensure_world_plot ON public.user_profiles;
CREATE TRIGGER user_profiles_ensure_world_plot
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.ensure_world_plot_for_new_user();

-- Everyone who is missing one, oldest account first (community bot accounts are skipped).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT u.id FROM auth.users u
    WHERE NOT EXISTS (SELECT 1 FROM public.world_plots wp WHERE wp.user_id = u.id)
      AND COALESCE(u.email, '') NOT LIKE '%@community.local'
    ORDER BY u.created_at, u.id
  LOOP
    PERFORM public.ensure_world_plot(r.id);
  END LOOP;
END;
$$;

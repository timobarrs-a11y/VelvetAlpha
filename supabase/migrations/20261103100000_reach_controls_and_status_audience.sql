-- Reach controls and status audience
--
-- Everyone exists in the community: names, faces and profiles are public. What a member
-- controls is how people can REACH them. A friend request is the way in to their world.
--
-- member_profiles gets four settings:
--   who_can_message         everyone | friends | nobody
--   accepts_friend_requests true | false
--   accepts_mail            true | false   (letters from Velvet; opted-out members are skipped)
--   comments_from           everyone | friends
-- (discoverable already exists.)
--
-- progress_posts gets an audience, chosen when the status is written, like a feed:
--   everyone | friends
--
-- Everything is enforced in the database, so the app cannot be used to get around it:
--   * a message to someone who does not take messages from you is refused
--   * a friend request to someone who is not accepting them is refused
--   * comments and likes need permission to see the post, and comments follow comments_from
--   * friends-only posts only appear in feeds for the author and their friends
--   * send_town_letter skips members who turned mail off

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
  ADD COLUMN IF NOT EXISTS who_can_message text NOT NULL DEFAULT 'everyone',
  ADD COLUMN IF NOT EXISTS accepts_friend_requests boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS accepts_mail boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS comments_from text NOT NULL DEFAULT 'everyone';

ALTER TABLE public.member_profiles DROP CONSTRAINT IF EXISTS member_profiles_who_can_message_check;
ALTER TABLE public.member_profiles ADD CONSTRAINT member_profiles_who_can_message_check
  CHECK (who_can_message IN ('everyone', 'friends', 'nobody'));
ALTER TABLE public.member_profiles DROP CONSTRAINT IF EXISTS member_profiles_comments_from_check;
ALTER TABLE public.member_profiles ADD CONSTRAINT member_profiles_comments_from_check
  CHECK (comments_from IN ('everyone', 'friends'));

GRANT INSERT (who_can_message, accepts_friend_requests, accepts_mail, comments_from) ON public.member_profiles TO authenticated;
GRANT UPDATE (who_can_message, accepts_friend_requests, accepts_mail, comments_from) ON public.member_profiles TO authenticated;

ALTER TABLE public.progress_posts ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'everyone';
ALTER TABLE public.progress_posts DROP CONSTRAINT IF EXISTS progress_posts_audience_check;
ALTER TABLE public.progress_posts ADD CONSTRAINT progress_posts_audience_check CHECK (audience IN ('everyone', 'friends'));

-- ---------------------------------------------------------------------------
-- Who can see a post (used by comment and like policies)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_progress_post(p_post_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.progress_posts pp
    WHERE pp.id = p_post_id
      AND (pp.audience = 'everyone' OR pp.user_id = auth.uid() OR public.members_are_friends(auth.uid(), pp.user_id))
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
      AND (
        pp.user_id = p_viewer_uid
        OR EXISTS (SELECT 1 FROM public.member_profiles mp2 WHERE mp2.user_id = pp.user_id AND mp2.is_public = true)
      )
      AND (pp.audience = 'everyone' OR pp.user_id = p_viewer_uid OR public.members_are_friends(p_viewer_uid, pp.user_id))
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
      AND (
        pp.user_id = p_viewer_uid
        OR EXISTS (SELECT 1 FROM public.member_profiles mp2 WHERE mp2.user_id = pp.user_id AND mp2.is_public = true)
      )
      AND (pp.audience = 'everyone' OR pp.user_id = p_viewer_uid OR public.members_are_friends(p_viewer_uid, pp.user_id))
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

-- Space chat counts toward "leave a comment in a Space"
--
-- Spaces are the Discord-like part of the site: rooms you chat in, with boards of posts alongside. The
-- objective "leave a comment in a Space" only counted comments on posts, so chatting in a room did not
-- tick it. Now a message in a room counts too (deleted messages do not). Only objective_counts changes.

-- How far someone got within [p_start, p_end): what they did, plus the visits they reported.
CREATE OR REPLACE FUNCTION public.objective_counts(p_uid uuid, p_start timestamptz, p_end timestamptz)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT jsonb_object_agg(a.activity, a.n)
    FROM (SELECT activity, count(*) AS n FROM public.daily_activity
          WHERE user_id = p_uid AND happened_at >= p_start AND happened_at < p_end GROUP BY activity) a
  ), '{}'::jsonb) || jsonb_build_object(
    'chat_with_helper',  (SELECT count(*) FROM public.conversations c WHERE c.user_id = p_uid AND c.role = 'user' AND c.created_at >= p_start AND c.created_at < p_end),
    -- A Space is a chat room (the Discord-like part) and a board of posts: a message in a room or a comment on a post both count.
    'comment_in_space',
      (SELECT count(*) FROM public.community_comments c WHERE c.author_id = p_uid AND c.created_at >= p_start AND c.created_at < p_end)
      + (SELECT count(*) FROM public.community_room_messages rm WHERE rm.author_id = p_uid AND rm.deleted_at IS NULL AND rm.created_at >= p_start AND rm.created_at < p_end),
    'post_in_space',     (SELECT count(*) FROM public.community_posts p WHERE p.author_id = p_uid AND p.created_at >= p_start AND p.created_at < p_end),
    'react_in_space',    (SELECT count(*) FROM public.community_reactions r WHERE r.user_id = p_uid AND r.created_at >= p_start AND r.created_at < p_end),
    'join_a_space',      (SELECT count(*) FROM public.community_board_members m WHERE m.user_id = p_uid AND m.source = 'manual' AND m.joined_at >= p_start AND m.joined_at < p_end),
    'comment_on_wins',   (SELECT count(*) FROM public.progress_post_comments c WHERE c.user_id = p_uid AND COALESCE(c.is_bot, false) = false AND c.created_at >= p_start AND c.created_at < p_end),
    'cheer_a_win',       (SELECT count(*) FROM public.progress_post_likes l WHERE l.user_id = p_uid AND l.created_at >= p_start AND l.created_at < p_end),
    'complete_step',     (SELECT count(*) FROM public.coaching_commitments m WHERE m.user_id = p_uid AND m.status = 'completed' AND m.completed_at >= p_start AND m.completed_at < p_end),
    'make_commitment',   (SELECT count(*) FROM public.coaching_commitments m WHERE m.user_id = p_uid AND m.is_user_created AND m.created_at >= p_start AND m.created_at < p_end),
    'set_a_goal',        (SELECT count(*) FROM public.user_goals g WHERE g.user_id = p_uid AND COALESCE(g.source, '') <> 'atlas' AND g.created_at >= p_start AND g.created_at < p_end),
    'add_friend',        (SELECT count(*) FROM public.im_friendships f WHERE f.requester_id = p_uid AND f.created_at >= p_start AND f.created_at < p_end),
    'message_friend',    (SELECT count(*) FROM public.im_messages m WHERE m.sender_id = p_uid AND m.created_at >= p_start AND m.created_at < p_end),
    -- Helpers made for them by the arrival are not something they did.
    'create_companion',  (SELECT count(*) FROM public.companions c WHERE c.user_id = p_uid AND c.relationship_type NOT IN ('mentor', 'assistant') AND c.created_at >= p_start AND c.created_at < p_end),
    -- Events the arrival wrote for them (their plan's weekly rhythm) are not something they did.
    'add_to_calendar',   (SELECT count(*) FROM public.user_events e WHERE e.user_id = p_uid AND COALESCE(e.metadata ->> 'source', '') NOT IN ('atlas', 'coach', 'assistant') AND e.created_at >= p_start AND e.created_at < p_end),
    'morning_journal',   (SELECT count(*) FROM public.journal_sessions j WHERE j.user_id = p_uid AND j.completed_at >= p_start AND j.completed_at < p_end),
    'ask_atlas',         (SELECT count(*) FROM public.atlas_messages m WHERE m.user_id = p_uid AND m.role = 'user' AND m.created_at >= p_start AND m.created_at < p_end),
    'explore_navi',      (SELECT count(*) FROM public.local_explorer_messages m WHERE m.user_id = p_uid AND m.role = 'user' AND m.created_at >= p_start AND m.created_at < p_end)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.objective_counts(uuid, timestamptz, timestamptz) FROM anon, authenticated, public;

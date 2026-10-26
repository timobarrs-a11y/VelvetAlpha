/*
# Status posts and "Your Feed"

Members can write their own posts ("statuses") next to the automatic progress
posts. Statuses live in `progress_posts` with `post_type = 'status'`, so the
existing likes, comments, block checks and counters work on them unchanged.

## Changes

1. `progress_posts.deleted_at` drops its `DEFAULT now()`. A soft-delete column
   that defaults to now marks every new row deleted. Nothing reads the column
   yet, so existing rows are reset to NULL.
2. `create_status_post(p_body)`: the only way to write a status. Checks the
   caller is signed in, has social access, isn't banned, the text is 1-500
   characters after trimming, and they've posted fewer than 10 statuses in the
   last hour.
3. `progress_post_title(post, viewer)`: the title rules that both feed
   functions repeated inline (owner sees detail, others only when the item is
   shown on the profile), now in one place.
4. `get_member_posts_inner` and `get_trending_posts_inner`:
   - return `body` for statuses (it stays NULL for automatic posts),
   - skip soft-deleted posts,
   - apply LIMIT/OFFSET to the posts before aggregating. Before, they were
     applied to the single aggregated row, so any offset returned nothing.
5. `get_public_feed(p_limit, p_offset)`: posts from every public member plus
   your own, for the "Everyone" tab.
*/

-- 1. deleted_at must default to "not deleted"
ALTER TABLE public.progress_posts ALTER COLUMN deleted_at DROP DEFAULT;
UPDATE public.progress_posts SET deleted_at = NULL WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_progress_posts_user_created
  ON public.progress_posts (user_id, created_at DESC);

-- 2. Write a status
CREATE OR REPLACE FUNCTION public.create_status_post(p_body text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_body text := btrim(COALESCE(p_body, ''));
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
    (id, user_id, post_type, title, body, ref_target_type, ref_target_id, is_auto_generated)
  VALUES
    (v_id, v_uid, 'status', 'Status', v_body, 'status', v_id, false);

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_status_post(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_status_post(text) TO authenticated;

-- 3. Title rules, shared by both feeds
CREATE OR REPLACE FUNCTION public.progress_post_title(pp public.progress_posts, p_viewer_uid uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT CASE pp.post_type
    WHEN 'commitment_completed' THEN COALESCE(
      (SELECT 'Kept a commitment: ' || cc.description
         FROM public.coaching_commitments cc
        WHERE cc.id = pp.ref_target_id
          AND (pp.user_id = p_viewer_uid OR cc.show_on_profile = true)),
      pp.title)
    WHEN 'plan_step_completed' THEN COALESCE(
      (SELECT 'Completed a step toward ' || ug.title
         FROM public.coach_plan_steps cps
         JOIN public.coaching_commitments cc ON cc.id = cps.commitment_id
         JOIN public.user_goals ug ON ug.id = cc.goal_id
        WHERE cps.id = pp.ref_target_id
          AND (pp.user_id = p_viewer_uid OR ug.show_on_profile = true)),
      (SELECT 'Completed a step toward ' || ug.title
         FROM public.coach_plan_steps cps
         JOIN public.coaching_commitments cc ON cc.id = cps.commitment_id
         JOIN public.user_goals ug ON ug.id = pp.goal_id
        WHERE cps.id = pp.ref_target_id
          AND (pp.user_id = p_viewer_uid OR ug.show_on_profile = true)),
      pp.title)
    WHEN 'goal_completed' THEN COALESCE(
      (SELECT 'Finished ' || ug.title || ' 🏆'
         FROM public.user_goals ug
        WHERE ug.id = pp.ref_target_id
          AND (pp.user_id = p_viewer_uid OR ug.show_on_profile = true)),
      pp.title)
    ELSE pp.title
  END;
$$;

REVOKE ALL ON FUNCTION public.progress_post_title(public.progress_posts, uuid) FROM PUBLIC, anon, authenticated;

-- 4a. Chronological feed
CREATE OR REPLACE FUNCTION public.get_member_posts_inner(p_user_ids uuid[], p_viewer_uid uuid, p_limit integer, p_offset integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
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
      AND NOT public.users_blocked(p_viewer_uid, pp.user_id)
    ORDER BY pp.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) t;

  RETURN jsonb_build_object('success', true, 'posts', COALESCE(v_results, '[]'::jsonb));
END;
$$;

-- 4b. Trending feed
CREATE OR REPLACE FUNCTION public.get_trending_posts_inner(p_user_ids uuid[], p_viewer_uid uuid, p_limit integer, p_since timestamp with time zone)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
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
      AND NOT public.users_blocked(p_viewer_uid, pp.user_id)
    ORDER BY score DESC, pp.created_at DESC
    LIMIT p_limit
  ) t;

  RETURN jsonb_build_object('success', true, 'posts', COALESCE(v_results, '[]'::jsonb));
END;
$$;

-- 5. Everyone: every public member, plus you
CREATE OR REPLACE FUNCTION public.get_public_feed(p_limit integer DEFAULT 30, p_offset integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_user_ids uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'posts', '[]'::jsonb);
  END IF;

  SELECT array_agg(user_id) INTO v_user_ids
  FROM public.member_profiles WHERE is_public = true;

  v_user_ids := array_append(COALESCE(v_user_ids, ARRAY[]::uuid[]), v_uid);

  RETURN public.get_member_posts_inner(v_user_ids, v_uid, LEAST(GREATEST(p_limit, 1), 50), GREATEST(p_offset, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_feed(integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_feed(integer, integer) TO authenticated;

/*
# Trending posts function

Since direct SELECT on progress_posts is now owner-only, trending posts
(which span all public profiles) need a SECURITY DEFINER function.
Returns posts from the last 48h ordered by like_count, with display text
resolved according to show_on_profile flags.
*/

CREATE OR REPLACE FUNCTION public.get_trending_posts(p_limit int DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_since timestamptz := now() - interval '48 hours';
  v_user_ids uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'posts', '[]'::jsonb);
  END IF;

  -- Following + own
  SELECT array_agg(DISTINCT followee_id) INTO v_user_ids
  FROM public.member_follows WHERE follower_id = v_uid;
  v_user_ids := array_append(COALESCE(v_user_ids, ARRAY[]::uuid[]), v_uid);

  -- Use the inner function with the same user set, but we need a different ordering
  -- For trending, we filter by recency and order by like_count
  -- The inner function orders by created_at DESC, so we need a separate query here

  RETURN public.get_trending_posts_inner(v_user_ids, v_uid, p_limit, v_since);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_trending_posts TO authenticated;


CREATE OR REPLACE FUNCTION public.get_trending_posts_inner(
  p_user_ids uuid[],
  p_viewer_uid uuid,
  p_limit int,
  p_since timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_results jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object(
    'id', pp.id,
    'user_id', pp.user_id,
    'post_type', pp.post_type,
    'title', CASE
      WHEN pp.user_id = p_viewer_uid THEN
        CASE pp.post_type
          WHEN 'commitment_completed' THEN
            COALESCE(
              (SELECT 'Kept a commitment: ' || cc.description
               FROM public.coaching_commitments cc WHERE cc.id = pp.ref_target_id),
              pp.title
            )
          WHEN 'plan_step_completed' THEN
            COALESCE(
              (SELECT 'Completed a step toward ' || ug.title
               FROM public.coach_plan_steps cps
               JOIN public.coaching_commitments cc ON cc.id = cps.commitment_id
               JOIN public.user_goals ug ON ug.id = cc.goal_id
               WHERE cps.id = pp.ref_target_id),
              (SELECT 'Completed a step toward ' || ug.title
               FROM public.coach_plan_steps cps
               JOIN public.coaching_commitments cc ON cc.id = cps.commitment_id
               JOIN public.user_goals ug ON ug.id = pp.goal_id
               WHERE cps.id = pp.ref_target_id),
              pp.title
            )
          WHEN 'goal_completed' THEN
            COALESCE(
              (SELECT 'Finished ' || ug.title || ' 🏆' FROM public.user_goals ug WHERE ug.id = pp.ref_target_id),
              pp.title
            )
          ELSE pp.title
        END
      ELSE
        CASE pp.post_type
          WHEN 'commitment_completed' THEN
            COALESCE(
              (SELECT 'Kept a commitment: ' || cc.description
               FROM public.coaching_commitments cc
               WHERE cc.id = pp.ref_target_id AND cc.show_on_profile = true),
              pp.title
            )
          WHEN 'plan_step_completed' THEN
            COALESCE(
              (SELECT 'Completed a step toward ' || ug.title
               FROM public.coach_plan_steps cps
               JOIN public.coaching_commitments cc ON cc.id = cps.commitment_id
               JOIN public.user_goals ug ON ug.id = cc.goal_id
               WHERE cps.id = pp.ref_target_id AND ug.show_on_profile = true),
              (SELECT 'Completed a step toward ' || ug.title
               FROM public.coach_plan_steps cps
               JOIN public.coaching_commitments cc ON cc.id = cps.commitment_id
               JOIN public.user_goals ug ON ug.id = pp.goal_id
               WHERE cps.id = pp.ref_target_id AND ug.show_on_profile = true),
              pp.title
            )
          WHEN 'goal_completed' THEN
            COALESCE(
              (SELECT 'Finished ' || ug.title || ' 🏆'
               FROM public.user_goals ug
               WHERE ug.id = pp.ref_target_id AND ug.show_on_profile = true),
              pp.title
            )
          ELSE pp.title
        END
    END,
    'body', NULL,
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
  ) ORDER BY pp.like_count DESC, pp.created_at DESC)
  INTO v_results
  FROM public.progress_posts pp
  LEFT JOIN public.member_profiles mp ON mp.user_id = pp.user_id
  WHERE pp.user_id = ANY(p_user_ids)
    AND pp.created_at >= p_since
    AND (
      pp.user_id = p_viewer_uid
      OR EXISTS (
        SELECT 1 FROM public.member_profiles mp2
        WHERE mp2.user_id = pp.user_id AND mp2.is_public = true
      )
    )
    AND NOT public.users_blocked(p_viewer_uid, pp.user_id)
  LIMIT p_limit;

  IF v_results IS NULL THEN
    v_results := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object('success', true, 'posts', v_results);
END;
$$;

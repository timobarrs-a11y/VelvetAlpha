/*
# Audit fixes batch 2: admin sorting, new-member boost, Atlas throttle, profile bio

1. A15: admin_list_reports sorts possible_minor to top.
2. D6: New-member boost (<5 posts gets +5 ranking weight) in trending.
3. AT3: Per-day Atlas intro limit (5/day) + opt-out column + atlas_intro_log table.
4. P1: get_public_profile hides bio from non-owners.
*/

-- ─── A15 ───
CREATE OR REPLACE FUNCTION public.admin_list_reports(p_status text DEFAULT 'pending'::text, p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  PERFORM public.admin_assert_owner();
  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(r) ORDER BY r.is_possible_minor DESC, r.created_at DESC) FROM (
      SELECT cr.id, cr.target_type, cr.target_id, cr.reason, cr.status, cr.created_at,
        (cr.reason = 'possible_minor') AS is_possible_minor,
        rp.name AS reporter_name,
        COALESCE(po.author_id, co.author_id) AS content_author_id,
        (SELECT name FROM public.user_profiles WHERE id = COALESCE(po.author_id, co.author_id)) AS content_author_name,
        COALESCE(po.title, left(co.body, 80)) AS content_title,
        COALESCE(po.body, co.body) AS content_body,
        COALESCE(po.is_ai_generated, co.is_ai_generated, false) AS content_is_bot,
        (po.id IS NULL AND co.id IS NULL AND cr.target_type <> 'board') AS content_missing
      FROM public.community_reports cr
      LEFT JOIN public.user_profiles rp ON rp.id = cr.reporter_id
      LEFT JOIN public.community_posts po ON cr.target_type = 'post' AND po.id = cr.target_id
      LEFT JOIN public.community_comments co ON cr.target_type = 'comment' AND co.id = cr.target_id
      WHERE p_status = 'all' OR cr.status = p_status
      ORDER BY (cr.reason = 'possible_minor') DESC, cr.created_at DESC
      LIMIT LEAST(GREATEST(p_limit, 1), 200)
    ) r), '[]'::jsonb);
END;
$function$;

-- ─── D6: New-member boost in trending ───
CREATE OR REPLACE FUNCTION public.get_trending_posts_inner(p_user_ids uuid[], p_viewer_uid uuid, p_limit integer, p_since timestamp with time zone)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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
            COALESCE((SELECT 'Kept a commitment: ' || cc.description FROM public.coaching_commitments cc WHERE cc.id = pp.ref_target_id), pp.title)
          WHEN 'plan_step_completed' THEN
            COALESCE(
              (SELECT 'Completed a step toward ' || ug.title FROM public.coach_plan_steps cps JOIN public.coaching_commitments cc ON cc.id = cps.commitment_id JOIN public.user_goals ug ON ug.id = cc.goal_id WHERE cps.id = pp.ref_target_id),
              (SELECT 'Completed a step toward ' || ug.title FROM public.coach_plan_steps cps JOIN public.coaching_commitments cc ON cc.id = cps.commitment_id JOIN public.user_goals ug ON ug.id = pp.goal_id WHERE cps.id = pp.ref_target_id),
              pp.title
            )
          WHEN 'goal_completed' THEN
            COALESCE((SELECT 'Finished ' || ug.title || ' 🏆' FROM public.user_goals ug WHERE ug.id = pp.ref_target_id), pp.title)
          ELSE pp.title
        END
      ELSE
        CASE pp.post_type
          WHEN 'commitment_completed' THEN
            COALESCE((SELECT 'Kept a commitment: ' || cc.description FROM public.coaching_commitments cc WHERE cc.id = pp.ref_target_id AND cc.show_on_profile = true), pp.title)
          WHEN 'plan_step_completed' THEN
            COALESCE(
              (SELECT 'Completed a step toward ' || ug.title FROM public.coach_plan_steps cps JOIN public.coaching_commitments cc ON cc.id = cps.commitment_id JOIN public.user_goals ug ON ug.id = cc.goal_id WHERE cps.id = pp.ref_target_id AND ug.show_on_profile = true),
              (SELECT 'Completed a step toward ' || ug.title FROM public.coach_plan_steps cps JOIN public.coaching_commitments cc ON cc.id = cps.commitment_id JOIN public.user_goals ug ON ug.id = pp.goal_id WHERE cps.id = pp.ref_target_id AND ug.show_on_profile = true),
              pp.title
            )
          WHEN 'goal_completed' THEN
            COALESCE((SELECT 'Finished ' || ug.title || ' 🏆' FROM public.user_goals ug WHERE ug.id = pp.ref_target_id AND ug.show_on_profile = true), pp.title)
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
  ) ORDER BY
    (COALESCE(pp.like_count, 0) + CASE WHEN author_post_count < 5 THEN 5 ELSE 0 END) DESC,
    pp.created_at DESC
  ) INTO v_results
  FROM public.progress_posts pp
  LEFT JOIN public.member_profiles mp ON mp.user_id = pp.user_id
  LEFT JOIN LATERAL (
    SELECT count(*) AS author_post_count FROM public.progress_posts pp2 WHERE pp2.user_id = pp.user_id
  ) post_count ON true
  WHERE pp.user_id = ANY(p_user_ids)
  AND pp.created_at >= p_since
  AND (
    pp.user_id = p_viewer_uid
    OR EXISTS (SELECT 1 FROM public.member_profiles mp2 WHERE mp2.user_id = pp.user_id AND mp2.is_public = true)
  )
  AND NOT public.users_blocked(p_viewer_uid, pp.user_id)
  LIMIT p_limit;

  IF v_results IS NULL THEN
    v_results := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object('success', true, 'posts', v_results);
END;
$function$;

-- ─── AT3 ───
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'member_profiles' AND column_name = 'atlas_intros_opt_out') THEN
    ALTER TABLE public.member_profiles ADD COLUMN atlas_intros_opt_out boolean NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.atlas_intro_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id uuid NOT NULL,
  introduced_user_id uuid NOT NULL,
  shown_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (viewer_id, introduced_user_id, shown_at)
);

ALTER TABLE public.atlas_intro_log ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.atlas_intro_log TO authenticated;

DROP POLICY IF EXISTS "select_own_atlas_intro_log" ON public.atlas_intro_log;
CREATE POLICY "select_own_atlas_intro_log" ON public.atlas_intro_log FOR SELECT
  TO authenticated USING (auth.uid() = viewer_id);

DROP POLICY IF EXISTS "insert_own_atlas_intro_log" ON public.atlas_intro_log;
CREATE POLICY "insert_own_atlas_intro_log" ON public.atlas_intro_log FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = viewer_id);

DROP POLICY IF EXISTS "delete_own_atlas_intro_log" ON public.atlas_intro_log;
CREATE POLICY "delete_own_atlas_intro_log" ON public.atlas_intro_log FOR DELETE
  TO authenticated USING (auth.uid() = viewer_id);

CREATE OR REPLACE FUNCTION public.get_atlas_introductions(p_limit integer DEFAULT 5)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_my_goal_types text[];
  v_results jsonb;
  v_today_count int;
  v_remaining int;
  v_already_introduced uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF EXISTS (SELECT 1 FROM public.member_profiles WHERE user_id = v_uid AND atlas_intros_opt_out = true) THEN
    RETURN jsonb_build_object('success', true, 'introductions', '[]'::jsonb, 'opted_out', true);
  END IF;

  SELECT count(*) INTO v_today_count
  FROM public.atlas_intro_log
  WHERE viewer_id = v_uid AND shown_at = CURRENT_DATE;

  v_remaining := 5 - v_today_count;
  IF v_remaining <= 0 THEN
    RETURN jsonb_build_object('success', true, 'introductions', '[]'::jsonb, 'daily_limit_reached', true);
  END IF;

  v_remaining := LEAST(v_remaining, p_limit);

  SELECT array_agg(DISTINCT goal_type) INTO v_my_goal_types
  FROM public.user_goals
  WHERE user_id = v_uid
  AND status IN ('active', 'completed');

  IF v_my_goal_types IS NULL OR array_length(v_my_goal_types, 1) IS NULL THEN
    RETURN jsonb_build_object('success', true, 'introductions', '[]'::jsonb);
  END IF;

  SELECT array_agg(introduced_user_id) INTO v_already_introduced
  FROM public.atlas_intro_log
  WHERE viewer_id = v_uid AND shown_at = CURRENT_DATE;

  SELECT jsonb_agg(jsonb_build_object(
    'user_id', t.user_id,
    'display_name', t.display_name,
    'headline', t.headline,
    'avatar_config', t.avatar_config,
    'profile_image_type', COALESCE(t.profile_image_type, 'avatar'),
    'profile_smilie_code', t.profile_smilie_code,
    'is_bot', t.is_bot,
    'follower_count', t.follower_count,
    'shared_goal_types', t.shared_types,
    'shared_goal_titles', t.shared_titles
  )) INTO v_results
  FROM (
    SELECT
      mp.user_id,
      mp.display_name,
      mp.headline,
      mp.avatar_config,
      mp.profile_image_type,
      mp.profile_smilie_code,
      mp.is_bot,
      mp.follower_count,
      array_agg(DISTINCT ug_other.goal_type) AS shared_types,
      array_agg(DISTINCT ug_other.title) AS shared_titles
    FROM public.member_profiles mp
    JOIN public.user_goals ug_other ON ug_other.user_id = mp.user_id
      AND ug_other.goal_type = ANY(v_my_goal_types)
      AND ug_other.status IN ('active', 'completed')
      AND ug_other.show_on_profile = true
    WHERE mp.is_public = true
      AND mp.discoverable = true
      AND COALESCE(mp.atlas_intros_opt_out, false) = false
      AND mp.user_id != v_uid
      AND mp.user_id NOT IN (SELECT followee_id FROM public.member_follows WHERE follower_id = v_uid)
      AND NOT public.users_blocked(v_uid, mp.user_id)
      AND (v_already_introduced IS NULL OR NOT (mp.user_id = ANY(v_already_introduced)))
    GROUP BY mp.user_id, mp.display_name, mp.headline, mp.avatar_config, mp.profile_image_type, mp.profile_smilie_code, mp.is_bot, mp.follower_count
    ORDER BY random()
    LIMIT v_remaining
  ) AS t;

  IF v_results IS NULL THEN
    v_results := '[]'::jsonb;
  END IF;

  INSERT INTO public.atlas_intro_log (viewer_id, introduced_user_id)
  SELECT v_uid, (elem->>'user_id')::uuid
  FROM jsonb_array_elements(v_results) AS elem
  WHERE elem->>'user_id' IS NOT NULL;

  RETURN jsonb_build_object('success', true, 'introductions', v_results);
END;
$function$;

-- ─── P1: Remove bio for non-owners ───
CREATE OR REPLACE FUNCTION public.get_public_profile(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_profile jsonb;
  v_counts jsonb;
  v_goals jsonb;
  v_commitments jsonb;
  v_is_owner boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  v_is_owner := (v_uid = p_user_id);

  IF NOT v_is_owner AND public.users_blocked(v_uid, p_user_id) THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  IF v_is_owner THEN
    SELECT jsonb_build_object(
      'user_id', mp.user_id,
      'display_name', mp.display_name,
      'headline', mp.headline,
      'bio', mp.bio,
      'profile_image_type', COALESCE(mp.profile_image_type, 'avatar'),
      'profile_smilie_code', mp.profile_smilie_code,
      'is_public', mp.is_public,
      'follower_count', mp.follower_count,
      'following_count', mp.following_count,
      'is_bot', mp.is_bot
    ) INTO v_profile
    FROM public.member_profiles mp
    WHERE mp.user_id = p_user_id;
  ELSE
    SELECT jsonb_build_object(
      'user_id', mp.user_id,
      'display_name', mp.display_name,
      'headline', mp.headline,
      'profile_image_type', COALESCE(mp.profile_image_type, 'avatar'),
      'profile_smilie_code', mp.profile_smilie_code,
      'is_public', mp.is_public,
      'follower_count', mp.follower_count,
      'following_count', mp.following_count,
      'is_bot', mp.is_bot
    ) INTO v_profile
    FROM public.member_profiles mp
    WHERE mp.user_id = p_user_id;
  END IF;

  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  IF NOT v_is_owner AND NOT (v_profile->>'is_public')::boolean THEN
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
    WHERE ug.user_id = p_user_id AND (ug.show_on_profile = true OR v_is_owner = true)
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
    WHERE cc.user_id = p_user_id AND (cc.show_on_profile = true OR v_is_owner = true)
    ORDER BY cc.completed_at DESC NULLS LAST, cc.created_at DESC
  ) sub;

  IF v_commitments IS NULL THEN v_commitments := '[]'::jsonb; END IF;

  RETURN jsonb_build_object(
    'success', true, 'profile', v_profile, 'counts', v_counts,
    'goals', v_goals, 'commitments', v_commitments, 'is_owner', v_is_owner
  );
END;
$function$;

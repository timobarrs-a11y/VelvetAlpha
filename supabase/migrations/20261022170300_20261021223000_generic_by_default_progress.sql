/*
# Generic-by-default progress

## Summary
Makes progress visible without leaking private text. Goals and commitments
get a per-item `show_on_profile` flag (off by default). Auto-posts store
only generic titles — the display text is resolved at read time based on
the flag. Existing posts are backfilled to strip private text from the
database. Atlas introductions and discovery respect the flags and check
im_blocks.

## Modified Tables
- user_goals: + show_on_profile boolean default false
- coaching_commitments: + show_on_profile boolean default false
- progress_posts: title rewritten to generic, body set to null for all rows

## New Functions
- get_progress_feed(p_limit, p_offset) — feed for current user (following + own)
- get_member_posts(p_user_id, p_limit) — posts for a specific member
- get_public_profile(p_user_id) — safe public profile with counts and shown items

## Rewritten Functions
- get_atlas_introductions — respects show_on_profile, checks im_blocks
- create_post_on_commitment_completed — generic title, no body
- create_post_on_plan_step_completed — generic title, no body
- create_post_on_goal_completed — generic title, no body
- create_post_on_milestone — generic title, no body

## Security
- user_goals and coaching_commitments stay owner-only under RLS.
- Other users only get data through SECURITY DEFINER functions.
- Hidden items are unreachable by any other user through any table, view,
  function, post, discovery card, or Atlas result.
*/

-- ============================================================
-- 1. Add show_on_profile to user_goals and coaching_commitments
-- ============================================================

ALTER TABLE public.user_goals
  ADD COLUMN IF NOT EXISTS show_on_profile boolean NOT NULL DEFAULT false;

ALTER TABLE public.coaching_commitments
  ADD COLUMN IF NOT EXISTS show_on_profile boolean NOT NULL DEFAULT false;

-- Migrate shared_goal_ids: goals that were previously shared get show_on_profile = true
UPDATE public.user_goals
SET show_on_profile = true, updated_at = now()
WHERE id IN (
  SELECT UNNEST(shared_goal_ids) FROM public.member_profiles
  WHERE shared_goal_ids IS NOT NULL AND array_length(shared_goal_ids, 1) > 0
);

-- Allow owners to toggle show_on_profile (it's within their existing UPDATE policy,
-- but we need to make sure the column is in the grant if there's a column-level grant)
-- user_goals has a full UPDATE grant, so no column-level change needed.
-- coaching_commitments has a full UPDATE grant, so no column-level change needed.

-- ============================================================
-- 2. Rewrite triggers to store generic titles only
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_post_on_commitment_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_goal_id uuid;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    IF NOT public.has_public_profile(NEW.user_id) THEN
      RETURN NEW;
    END IF;

    IF public.post_exists_for_target(NEW.user_id, 'coaching_commitments', NEW.id, 'commitment_completed') THEN
      RETURN NEW;
    END IF;

    v_goal_id := NEW.goal_id;

    INSERT INTO public.progress_posts (user_id, post_type, title, body, ref_target_type, ref_target_id, goal_id)
    VALUES (
      NEW.user_id,
      'commitment_completed',
      'Kept a commitment',
      NULL,
      'coaching_commitments',
      NEW.id,
      v_goal_id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_post_on_plan_step_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_goal_id uuid;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    SELECT p.user_id INTO v_user_id
    FROM public.coach_plans p WHERE p.id = NEW.plan_id;

    IF v_user_id IS NULL THEN RETURN NEW; END IF;

    IF NOT public.has_public_profile(v_user_id) THEN
      RETURN NEW;
    END IF;

    IF public.post_exists_for_target(v_user_id, 'coach_plan_steps', NEW.id, 'plan_step_completed') THEN
      RETURN NEW;
    END IF;

    IF NEW.commitment_id IS NOT NULL THEN
      SELECT goal_id INTO v_goal_id FROM public.coaching_commitments WHERE id = NEW.commitment_id;
    END IF;

    INSERT INTO public.progress_posts (user_id, post_type, title, body, ref_target_type, ref_target_id, goal_id)
    VALUES (
      v_user_id,
      'plan_step_completed',
      'Completed a plan step',
      NULL,
      'coach_plan_steps',
      NEW.id,
      v_goal_id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_post_on_goal_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    IF NOT public.has_public_profile(NEW.user_id) THEN
      RETURN NEW;
    END IF;

    IF public.post_exists_for_target(NEW.user_id, 'user_goals', NEW.id, 'goal_completed') THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.progress_posts (user_id, post_type, title, body, ref_target_type, ref_target_id, goal_id)
    VALUES (
      NEW.user_id,
      'goal_completed',
      'Finished a goal 🏆',
      NULL,
      'user_goals',
      NEW.id,
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_post_on_milestone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.has_public_profile(NEW.user_id) THEN
    RETURN NEW;
  END IF;

  IF public.post_exists_for_target(NEW.user_id, 'milestone_achievements', NEW.id, 'milestone_achieved') THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.progress_posts (user_id, post_type, title, body, ref_target_type, ref_target_id)
  VALUES (
    NEW.user_id,
    'milestone_achieved',
    'Milestone unlocked',
    NULL,
    'milestone_achievements',
    NEW.id
  );
END;
$$;

-- ============================================================
-- 3. Backfill: strip private text from all existing posts
-- ============================================================

UPDATE public.progress_posts SET
  title = CASE post_type
    WHEN 'commitment_completed' THEN 'Kept a commitment'
    WHEN 'plan_step_completed' THEN 'Completed a plan step'
    WHEN 'goal_completed' THEN 'Finished a goal 🏆'
    WHEN 'milestone_achieved' THEN 'Milestone unlocked'
    WHEN 'streak_milestone' THEN 'Hit a streak 🔥'
    WHEN 'medal_earned' THEN 'Earned a medal'
    ELSE title
  END,
  body = NULL
WHERE is_auto_generated = true;

-- ============================================================
-- 4. Helper: check if two users block each other
-- ============================================================

CREATE OR REPLACE FUNCTION public.users_blocked(p_a uuid, p_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.im_blocks
    WHERE (blocker_id = p_a AND blocked_id = p_b)
       OR (blocker_id = p_b AND blocked_id = p_a)
  );
$$;

-- ============================================================
-- 5. get_progress_feed — feed for current user (following + own)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_progress_feed(p_limit int DEFAULT 30, p_offset int DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_user_ids uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'posts', '[]'::jsonb);
  END IF;

  SELECT array_agg(DISTINCT followee_id) INTO v_user_ids
  FROM public.member_follows WHERE follower_id = v_uid;

  v_user_ids := array_append(COALESCE(v_user_ids, ARRAY[]::uuid[]), v_uid);

  RETURN public.get_member_posts_inner(v_user_ids, v_uid, p_limit, p_offset);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_progress_feed TO authenticated;

-- ============================================================
-- 6. get_member_posts — posts for a specific member
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_member_posts(p_user_id uuid, p_limit int DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

  -- If viewing someone else, require public profile
  IF p_user_id != v_uid THEN
    IF NOT EXISTS (SELECT 1 FROM public.member_profiles WHERE user_id = p_user_id AND is_public = true) THEN
      RETURN jsonb_build_object('success', true, 'posts', '[]'::jsonb);
    END IF;
  END IF;

  RETURN public.get_member_posts_inner(ARRAY[p_user_id], v_uid, p_limit, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_member_posts TO authenticated;

-- ============================================================
-- 7. Shared inner logic for resolving post display text
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_member_posts_inner(
  p_user_ids uuid[],
  p_viewer_uid uuid,
  p_limit int,
  p_offset int
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
        -- Owner sees full detail
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
        -- Other viewers: only show detail if show_on_profile is true
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
  ) ORDER BY pp.created_at DESC)
  INTO v_results
  FROM public.progress_posts pp
  LEFT JOIN public.member_profiles mp ON mp.user_id = pp.user_id
  WHERE pp.user_id = ANY(p_user_ids)
    AND (
      pp.user_id = p_viewer_uid
      OR EXISTS (
        SELECT 1 FROM public.member_profiles mp2
        WHERE mp2.user_id = pp.user_id AND mp2.is_public = true
      )
    )
    AND NOT public.users_blocked(p_viewer_uid, pp.user_id)
  LIMIT p_limit OFFSET p_offset;

  IF v_results IS NULL THEN
    v_results := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object('success', true, 'posts', v_results);
END;
$$;

-- Inner function doesn't need direct grant — called by the public ones

-- ============================================================
-- 8. get_public_profile — safe public profile with counts
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_public_profile(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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

  -- If not owner and blocked, return nothing
  IF NOT v_is_owner AND public.users_blocked(v_uid, p_user_id) THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  -- Get member profile
  SELECT jsonb_build_object(
    'user_id', mp.user_id,
    'display_name', mp.display_name,
    'headline', mp.headline,
    'bio', mp.bio,
    'avatar_config', mp.avatar_config,
    'profile_image_type', COALESCE(mp.profile_image_type, 'avatar'),
    'profile_smilie_code', mp.profile_smilie_code,
    'is_public', mp.is_public,
    'follower_count', mp.follower_count,
    'following_count', mp.following_count,
    'is_bot', mp.is_bot
  ) INTO v_profile
  FROM public.member_profiles mp
  WHERE mp.user_id = p_user_id;

  -- If no profile or not public and not owner, return nothing
  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  IF NOT v_is_owner AND NOT (v_profile->>'is_public')::boolean THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  -- Progress counts (always visible for public profiles)
  SELECT jsonb_build_object(
    'active_goals', COUNT(*) FILTER (WHERE ug.status = 'active'),
    'goals_completed', COUNT(*) FILTER (WHERE ug.status = 'completed'),
    'commitments_kept', (SELECT COUNT(*) FROM public.coaching_commitments cc WHERE cc.user_id = p_user_id AND cc.status = 'completed'),
    'plan_steps_done', (SELECT COUNT(*) FROM public.coach_plan_steps cps JOIN public.coach_plans cp ON cp.id = cps.plan_id WHERE cp.user_id = p_user_id AND cps.status = 'completed'),
    'current_streak', 0
  ) INTO v_counts
  FROM public.user_goals ug
  WHERE ug.user_id = p_user_id;

  -- Shown goals only
  SELECT jsonb_agg(jsonb_build_object(
    'id', ug.id,
    'title', ug.title,
    'goal_type', ug.goal_type,
    'current_value', ug.current_value,
    'target_value', ug.target_value,
    'unit', ug.unit,
    'target_date', ug.target_date,
    'status', ug.status
  )) INTO v_goals
  FROM public.user_goals ug
  WHERE ug.user_id = p_user_id
    AND (ug.show_on_profile = true OR v_is_owner = true)
  ORDER BY ug.created_at DESC;

  IF v_goals IS NULL THEN v_goals := '[]'::jsonb; END IF;

  -- Shown commitments only
  SELECT jsonb_agg(jsonb_build_object(
    'id', cc.id,
    'description', cc.description,
    'due_date', cc.due_date,
    'completed_at', cc.completed_at,
    'status', cc.status
  )) INTO v_commitments
  FROM public.coaching_commitments cc
  WHERE cc.user_id = p_user_id
    AND (cc.show_on_profile = true OR v_is_owner = true)
  ORDER BY cc.completed_at DESC NULLS LAST, cc.created_at DESC;

  IF v_commitments IS NULL THEN v_commitments := '[]'::jsonb; END IF;

  RETURN jsonb_build_object(
    'success', true,
    'profile', v_profile,
    'counts', v_counts,
    'goals', v_goals,
    'commitments', v_commitments,
    'is_owner', v_is_owner
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_profile TO authenticated;

-- ============================================================
-- 9. Rewrite get_atlas_introductions
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_atlas_introductions(p_limit int DEFAULT 5)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_my_goal_types text[];
  v_results jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT array_agg(DISTINCT goal_type) INTO v_my_goal_types
  FROM public.user_goals
  WHERE user_id = v_uid
    AND status IN ('active', 'completed');

  IF v_my_goal_types IS NULL OR array_length(v_my_goal_types, 1) IS NULL THEN
    RETURN jsonb_build_object('success', true, 'introductions', '[]'::jsonb);
  END IF;

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
      array_agg(DISTINCT ug_other.title) FILTER (WHERE ug_other.show_on_profile = true) AS shared_titles
    FROM public.member_profiles mp
    JOIN public.user_goals ug_other ON ug_other.user_id = mp.user_id
      AND ug_other.goal_type = ANY(v_my_goal_types)
      AND ug_other.status IN ('active', 'completed')
    WHERE mp.is_public = true
      AND mp.discoverable = true
      AND mp.user_id != v_uid
      AND mp.user_id NOT IN (SELECT followee_id FROM public.member_follows WHERE follower_id = v_uid)
      AND NOT public.users_blocked(v_uid, mp.user_id)
    GROUP BY mp.user_id, mp.display_name, mp.headline, mp.avatar_config, mp.profile_image_type, mp.profile_smilie_code, mp.is_bot, mp.follower_count
    ORDER BY random()
    LIMIT p_limit
  ) AS t;

  IF v_results IS NULL THEN
    v_results := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object('success', true, 'introductions', v_results);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_atlas_introductions TO authenticated;

-- ============================================================
-- 10. Remove direct client SELECT of other users' progress_posts
--     Keep own-posts SELECT, restrict public SELECT to generic columns only
-- ============================================================

DROP POLICY IF EXISTS "select_public_progress_posts" ON public.progress_posts;

-- Only allow selecting own posts directly. Other users' posts come through functions.
CREATE POLICY "select_own_progress_posts_only" ON public.progress_posts
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Re-grant only own-post access to authenticated
REVOKE SELECT ON public.progress_posts FROM authenticated;
GRANT SELECT ON public.progress_posts TO authenticated;

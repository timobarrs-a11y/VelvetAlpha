/*
# Fix current_streak in get_public_profile

## Summary

The `get_public_profile` function was returning `current_streak` hardcoded to 0.
This fix reads the actual streak value from the `user_customization` table,
which tracks the member's daily check-in streak.

## Changes

- `get_public_profile`: replaces `'current_streak', 0` with a subquery that
  reads `current_streak` from `user_customization` for the profile owner.
  Falls back to 0 if no customization row exists.

## Security

- No new tables, no policy changes. The function is already SECURITY DEFINER
  and granted to authenticated.
*/

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
    'current_streak', COALESCE((SELECT uc.current_streak FROM public.user_customization uc WHERE uc.user_id = p_user_id), 0)
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

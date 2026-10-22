/*
# Coaching Auto-Activate Plan, Trigger Fix, Public Profile Fix

## Summary

1. Adds `auto_activate_plan_on_commitment()` trigger: when the first commitment
   on a plan is completed, the plan status becomes 'active' if it was 'draft'.
2. Fixes `sync_commitment_completion_to_goal()` trigger: sets mutable search_path to public.
3. Rewrites `get_public_profile()` to exclude `avatar_config` (may contain photo URLs).
   Follower/following counts and all other public fields remain.

## Security Changes
- All new/rewritten functions have `SET search_path = public`.
- Existing `undo_coaching_change(p_change_id uuid)` is retained as-is.
*/

-- ============================================================
-- 1. Fix sync_commitment_completion_to_goal search_path
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_commitment_completion_to_goal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_goal record;
  v_new_value numeric;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM NEW.status) AND NEW.goal_id IS NOT NULL THEN
    SELECT current_value, target_value, status INTO v_goal
    FROM public.user_goals WHERE id = NEW.goal_id;

    IF FOUND AND v_goal.status = 'active' THEN
      v_new_value := COALESCE(v_goal.current_value, 0) + 1;
      IF v_goal.target_value IS NOT NULL AND v_new_value >= v_goal.target_value THEN
        UPDATE public.user_goals
        SET current_value = v_new_value, status = 'completed', updated_at = now()
        WHERE id = NEW.goal_id;
      ELSE
        UPDATE public.user_goals
        SET current_value = v_new_value, updated_at = now()
        WHERE id = NEW.goal_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. Auto-activate plan on first completed commitment
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_activate_plan_on_commitment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id uuid;
  v_plan_status text;
  v_completed_count int;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    SELECT cps.plan_id INTO v_plan_id
    FROM public.coach_plan_steps cps
    WHERE cps.id = NEW.plan_step_id;

    IF v_plan_id IS NOT NULL THEN
      SELECT status INTO v_plan_status FROM public.coach_plans WHERE id = v_plan_id;

      IF v_plan_status = 'draft' THEN
        SELECT COUNT(*) INTO v_completed_count
        FROM public.coaching_commitments cc
        JOIN public.coach_plan_steps cps ON cps.id = cc.plan_step_id
        WHERE cps.plan_id = v_plan_id AND cc.status = 'completed';

        IF v_completed_count >= 1 THEN
          UPDATE public.coach_plans
          SET status = 'active', updated_at = now()
          WHERE id = v_plan_id AND status = 'draft';
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_activate_plan ON public.coaching_commitments;
CREATE TRIGGER trg_auto_activate_plan
AFTER UPDATE ON public.coaching_commitments
FOR EACH ROW EXECUTE FUNCTION public.auto_activate_plan_on_commitment();

-- ============================================================
-- 3. Fix get_public_profile: strip avatar_config
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_public_profile(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  IF NOT v_is_owner AND public.users_blocked(v_uid, p_user_id) THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  -- Get member profile — NO avatar_config (may contain photo URLs)
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

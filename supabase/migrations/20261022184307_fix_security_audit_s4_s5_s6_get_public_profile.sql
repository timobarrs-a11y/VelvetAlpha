/*
# Fix Security Audit Findings (S4, S5, S6, get_public_profile bug)

## Summary

This migration fixes four security issues found during the S1-S7 audit:

1. **S4 — member_profiles privileged columns**: `follower_count`, `following_count`, and `is_bot`
   were included in the UPDATE grant for `authenticated`. Users could inflate their own follower
   count or mark themselves as a bot. These columns are now removed from the UPDATE grant.
   The app updates these columns via SECURITY DEFINER functions or service_role only.

2. **S5 — Liker identity exposed via progress_post_likes**: The SELECT policy allowed any
   authenticated user to read `user_id` from `progress_post_likes`, exposing who liked a post.
   The SELECT grant is now restricted to `post_id` and `created_at` only (no `user_id`), so
   only a count is readable, not the liker's identity.

3. **S6 — Block enforcement on INSERT policies**: The INSERT policies on `member_follows`,
   `progress_post_likes`, and `progress_post_comments` only checked `auth.uid() = user_id`
   but did not check whether a block exists between the two users. Now all three INSERT
   policies call `public.users_blocked()` to reject the operation if either user has blocked
   the other.

4. **get_public_profile ORDER BY bug**: The function used `ORDER BY` inside `jsonb_agg()`
   without a subquery, which PostgreSQL rejects. The goals and commitments queries now use
   a subquery with `ORDER BY` fed to `jsonb_agg()`, which is the correct pattern.

## Changes

### member_profiles grants
- Revoke UPDATE on `follower_count`, `following_count`, `is_bot` from `authenticated`
- Re-grant UPDATE on only the user-editable columns (excluding the three privileged ones)

### progress_post_likes grants
- Revoke SELECT on `user_id` from `authenticated`
- Re-grant SELECT on only `post_id`, `created_at` (no `user_id`)

### member_follows INSERT policy
- Drop `insert_own_follow`
- Create `insert_own_follow` with block check: `auth.uid() = follower_id AND NOT users_blocked(auth.uid(), followee_id)`

### progress_post_likes INSERT policy
- Drop `insert_own_like`
- Create `insert_own_like` with block check: `auth.uid() = user_id AND NOT users_blocked(auth.uid(), (SELECT user_id FROM progress_posts WHERE id = post_id))`

### progress_post_comments INSERT policy
- Drop `insert_own_comment`
- Create `insert_own_comment` with block check: `auth.uid() = user_id AND NOT users_blocked(auth.uid(), (SELECT user_id FROM progress_posts WHERE id = post_id))`

### get_public_profile function
- Fix the goals aggregate: wrap the query in a subquery with ORDER BY, then apply jsonb_agg
- Fix the commitments aggregate: same pattern
*/

-- ─── S4: Remove privileged columns from member_profiles UPDATE grant ───
REVOKE UPDATE ON public.member_profiles FROM authenticated;
GRANT UPDATE (user_id, display_name, headline, bio, avatar_config, is_public, discoverable, shared_goal_ids, profile_image_type, profile_smilie_code, auto_posting_enabled, updated_at) ON public.member_profiles TO authenticated;

-- ─── S5: Remove user_id from progress_post_likes SELECT grant ───
REVOKE SELECT ON public.progress_post_likes FROM authenticated;
GRANT SELECT (post_id, created_at) ON public.progress_post_likes TO authenticated;

-- ─── S6: Add block checks to INSERT policies ───

-- member_follows: block check on followee
DROP POLICY IF EXISTS "insert_own_follow" ON public.member_follows;
CREATE POLICY "insert_own_follow"
ON public.member_follows FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = follower_id
  AND NOT public.users_blocked(auth.uid(), followee_id)
);

-- progress_post_likes: block check on post owner
DROP POLICY IF EXISTS "insert_own_like" ON public.progress_post_likes;
CREATE POLICY "insert_own_like"
ON public.progress_post_likes FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND NOT public.users_blocked(auth.uid(), (SELECT pp.user_id FROM public.progress_posts pp WHERE pp.id = post_id))
);

-- progress_post_comments: block check on post owner
DROP POLICY IF EXISTS "insert_own_comment" ON public.progress_post_comments;
CREATE POLICY "insert_own_comment"
ON public.progress_post_comments FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND NOT public.users_blocked(auth.uid(), (SELECT pp.user_id FROM public.progress_posts pp WHERE pp.id = post_id))
);

-- ─── Fix get_public_profile ORDER BY bug ───
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

  -- Get member profile
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

  -- Fixed: use subquery with ORDER BY, then jsonb_agg (no ORDER BY inside jsonb_agg)
  SELECT jsonb_agg(sub.row_data) INTO v_goals
  FROM (
    SELECT jsonb_build_object(
      'id', ug.id,
      'title', ug.title,
      'goal_type', ug.goal_type,
      'current_value', ug.current_value,
      'target_value', ug.target_value,
      'unit', ug.unit,
      'target_date', ug.target_date,
      'status', ug.status
    ) AS row_data
    FROM public.user_goals ug
    WHERE ug.user_id = p_user_id
      AND (ug.show_on_profile = true OR v_is_owner = true)
    ORDER BY ug.created_at DESC
  ) sub;

  IF v_goals IS NULL THEN v_goals := '[]'::jsonb; END IF;

  -- Fixed: same pattern for commitments
  SELECT jsonb_agg(sub.row_data) INTO v_commitments
  FROM (
    SELECT jsonb_build_object(
      'id', cc.id,
      'description', cc.description,
      'due_date', cc.due_date,
      'completed_at', cc.completed_at,
      'status', cc.status
    ) AS row_data
    FROM public.coaching_commitments cc
    WHERE cc.user_id = p_user_id
      AND (cc.show_on_profile = true OR v_is_owner = true)
    ORDER BY cc.completed_at DESC NULLS LAST, cc.created_at DESC
  ) sub;

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
$function$;

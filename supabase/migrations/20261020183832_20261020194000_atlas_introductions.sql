/*
# Atlas Introductions

## Summary

Creates a SECURITY DEFINER function `get_atlas_introductions()` that finds
public, discoverable members who share goal types with the current user but
aren't already followed. This powers the "Atlas thinks you should connect"
cards in the progress feed.

## New Functions

- `get_atlas_introductions(p_limit int default 5)` — SECURITY DEFINER.
  Returns up to p_limit member profiles that:
  1. Have a public, discoverable member profile
  2. Share at least one goal_type with the current user's goals
  3. Are not already followed by the current user
  4. Are not the current user themselves
  Returns: user_id, display_name, headline, avatar_config, is_bot,
  shared_goal_types (array of goal types in common), shared_goal_titles (array).

## Security

- SECURITY DEFINER so it can read all public profiles and goal data.
- Only returns public + discoverable profiles — respects user privacy settings.
- Callable by authenticated users only.

## Important Notes

1. This function does NOT create any persistent state — it's a read-only query
   that runs on demand when the user loads the feed. No data is stored.
2. Results are randomized (ORDER BY random()) so each feed load shows different
   potential connections, preventing a stale "recommended" list.
3. Respects the `discoverable` flag — users who opt out of discovery won't appear.
*/

CREATE OR REPLACE FUNCTION public.get_atlas_introductions(p_limit int DEFAULT 5)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_my_goal_types text[];
  v_results jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Get the current user's goal types
  SELECT array_agg(DISTINCT goal_type) INTO v_my_goal_types
  FROM public.user_goals
  WHERE user_id = v_uid
    AND status IN ('active', 'completed');

  IF v_my_goal_types IS NULL OR array_length(v_my_goal_types, 1) IS NULL THEN
    RETURN jsonb_build_object('success', true, 'introductions', '[]'::jsonb);
  END IF;

  -- Find public, discoverable members who share goal types and aren't already followed
  SELECT jsonb_agg(jsonb_build_object(
    'user_id', mp.user_id,
    'display_name', mp.display_name,
    'headline', mp.headline,
    'avatar_config', mp.avatar_config,
    'is_bot', mp.is_bot,
    'follower_count', mp.follower_count,
    'shared_goal_types', shared_types,
    'shared_goal_titles', shared_titles
  )) INTO v_results
  FROM (
    SELECT
      mp.user_id,
      mp.display_name,
      mp.headline,
      mp.avatar_config,
      mp.is_bot,
      mp.follower_count,
      array_agg(DISTINCT ug_other.goal_type) AS shared_types,
      array_agg(DISTINCT ug_other.title) AS shared_titles
    FROM public.member_profiles mp
    JOIN public.user_goals ug_other ON ug_other.user_id = mp.user_id
      AND ug_other.goal_type = ANY(v_my_goal_types)
      AND ug_other.status IN ('active', 'completed')
    WHERE mp.is_public = true
      AND mp.discoverable = true
      AND mp.user_id != v_uid
      AND mp.user_id NOT IN (
        SELECT followee_id FROM public.member_follows WHERE follower_id = v_uid
      )
    GROUP BY mp.user_id, mp.display_name, mp.headline, mp.avatar_config, mp.is_bot, mp.follower_count
    ORDER BY random()
    LIMIT p_limit
  ) AS mp;

  IF v_results IS NULL THEN
    v_results := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object('success', true, 'introductions', v_results);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_atlas_introductions TO authenticated;

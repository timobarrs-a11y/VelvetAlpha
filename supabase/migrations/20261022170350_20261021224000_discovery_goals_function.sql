/*
# Discovery helper: get public goal types for a set of users

Returns goal_type (always visible) and title (only when show_on_profile = true)
for public, discoverable members. This avoids the RLS problem where the browser
can't read other users' user_goals rows directly.
*/

CREATE OR REPLACE FUNCTION public.get_discoverable_goals(p_user_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_results jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'goals', '[]'::jsonb);
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'user_id', ug.user_id,
    'goal_type', ug.goal_type,
    'title', CASE WHEN ug.show_on_profile = true THEN ug.title ELSE NULL END
  )) INTO v_results
  FROM public.user_goals ug
  WHERE ug.user_id = ANY(p_user_ids)
    AND ug.user_id != v_uid
    AND ug.status IN ('active', 'completed')
    AND NOT public.users_blocked(v_uid, ug.user_id)
    AND EXISTS (
      SELECT 1 FROM public.member_profiles mp
      WHERE mp.user_id = ug.user_id AND mp.is_public = true AND mp.discoverable = true
    );

  IF v_results IS NULL THEN v_results := '[]'::jsonb; END IF;

  RETURN jsonb_build_object('success', true, 'goals', v_results);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_discoverable_goals TO authenticated;

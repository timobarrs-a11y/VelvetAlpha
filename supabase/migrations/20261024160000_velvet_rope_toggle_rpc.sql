/*
  # Velvet Rope toggle: server-side

  Members can no longer update `user_profiles.velvet_rope_enabled` directly
  (UPDATE is granted per column, and the Velvet Rope columns aren't in the
  list), so the Friends HQ toggle failed with "permission denied".

  `set_velvet_rope_enabled` flips the switch for the caller and stamps
  `velvet_rope_first_seen_at` the first time it's turned on. The stamp is set
  here rather than by the client because it gates when AI matches start.
*/

CREATE OR REPLACE FUNCTION public.set_velvet_rope_enabled(p_enabled boolean)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.user_profiles
  SET velvet_rope_enabled = p_enabled,
      velvet_rope_first_seen_at = CASE
        WHEN p_enabled AND velvet_rope_first_seen_at IS NULL THEN now()
        ELSE velvet_rope_first_seen_at
      END
  WHERE id = (SELECT auth.uid());
$$;

REVOKE ALL ON FUNCTION public.set_velvet_rope_enabled(boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_velvet_rope_enabled(boolean) TO authenticated;

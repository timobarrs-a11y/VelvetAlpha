/*
# Velvet World: visitors and the fuller billboard card

1. New table `world_plot_visits`
   - One row per (host, visitor): opening someone's billboard counts as a
     visit. The tally is unique visitors, so clicking the same billboard
     again doesn't add to it. Nobody is told who visited; viewing a
     billboard still never notifies anyone.
   - RLS on with no policies: read and written only through the RPCs below.

2. New RPCs
   - record_world_visit(p_host): counts a visit (not your own house, not
     between blocked people) and returns the host's visitor count.
   - world_card_details(p_user_id): what the billboard card shows beyond
     world_cards: visitors (all time and this week) for everyone; for a
     public profile also avatar, bio, move-in date, friends, friends in
     common, streak, goals done, commitments kept, up to three goals they
     chose to share, and spaces you both belong to.
*/

CREATE TABLE IF NOT EXISTS public.world_plot_visits (
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visitor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_at timestamptz NOT NULL DEFAULT now(),
  last_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (host_id, visitor_id)
);
ALTER TABLE public.world_plot_visits ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS world_plot_visits_host_first_idx ON public.world_plot_visits (host_id, first_at);

CREATE OR REPLACE FUNCTION public.record_world_visit(p_host uuid)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN 0; END IF;
  IF v_uid <> p_host
     AND EXISTS (SELECT 1 FROM public.world_plots WHERE user_id = p_host)
     AND NOT public.world_blocked(v_uid, p_host) THEN
    INSERT INTO public.world_plot_visits (host_id, visitor_id) VALUES (p_host, v_uid)
    ON CONFLICT (host_id, visitor_id) DO UPDATE SET last_at = now();
  END IF;
  RETURN (SELECT count(*)::int FROM public.world_plot_visits WHERE host_id = p_host);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.record_world_visit(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.record_world_visit(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.world_card_details(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_shown boolean;
  v_out jsonb;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.world_plots WHERE user_id = p_user_id) THEN
    RETURN NULL;
  END IF;

  v_out := jsonb_build_object(
    'visitors', (SELECT count(*) FROM public.world_plot_visits WHERE host_id = p_user_id),
    'visitors_week', (SELECT count(*) FROM public.world_plot_visits WHERE host_id = p_user_id AND first_at > now() - interval '7 days')
  );

  -- Same rule as world_cards: your own, or a public profile with no block either way.
  v_shown := p_user_id = v_uid OR (
    COALESCE((SELECT is_public FROM public.member_profiles WHERE user_id = p_user_id), false)
    AND NOT public.world_blocked(v_uid, p_user_id)
  );
  IF NOT v_shown THEN RETURN v_out; END IF;

  RETURN v_out || jsonb_build_object(
    'avatar_config', (SELECT COALESCE(mp.avatar_config, up.avatar_config)
                      FROM public.user_profiles up LEFT JOIN public.member_profiles mp ON mp.user_id = up.id
                      WHERE up.id = p_user_id),
    'bio', (SELECT NULLIF(btrim(bio), '') FROM public.member_profiles WHERE user_id = p_user_id),
    'moved_in_at', (SELECT moved_in_at FROM public.world_plots WHERE user_id = p_user_id),
    'friends', (SELECT count(*) FROM public.im_friendships f
                WHERE f.status = 'accepted' AND (f.requester_id = p_user_id OR f.addressee_id = p_user_id)),
    'mutual_friends', CASE WHEN p_user_id = v_uid THEN 0 ELSE (
      SELECT count(*) FROM (
        SELECT CASE WHEN f.requester_id = p_user_id THEN f.addressee_id ELSE f.requester_id END AS id
        FROM public.im_friendships f
        WHERE f.status = 'accepted' AND (f.requester_id = p_user_id OR f.addressee_id = p_user_id)
        INTERSECT
        SELECT CASE WHEN f.requester_id = v_uid THEN f.addressee_id ELSE f.requester_id END
        FROM public.im_friendships f
        WHERE f.status = 'accepted' AND (f.requester_id = v_uid OR f.addressee_id = v_uid)
      ) m) END,
    'streak', COALESCE((SELECT current_streak FROM public.user_customization WHERE user_id = p_user_id), 0),
    'goals_done', (SELECT count(*) FROM public.user_goals WHERE user_id = p_user_id AND status = 'completed'),
    'commitments_kept', (SELECT count(*) FROM public.coaching_commitments WHERE user_id = p_user_id AND status = 'completed'),
    'goals', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('label', g.title, 'pct', g.pct, 'done', g.done) ORDER BY g.ord)
      FROM (
        SELECT ug.title,
               LEAST(100, GREATEST(0, round(100 * ug.current_value / NULLIF(ug.target_value, 0))))::int AS pct,
               ug.status = 'completed' AS done,
               row_number() OVER (ORDER BY (ug.status = 'completed'), ug.created_at DESC) AS ord
        FROM public.user_goals ug
        WHERE ug.user_id = p_user_id AND ug.show_on_profile
        ORDER BY (ug.status = 'completed'), ug.created_at DESC
        LIMIT 3
      ) g), '[]'::jsonb),
    'shared_spaces', CASE WHEN p_user_id = v_uid THEN '[]'::jsonb ELSE COALESCE((
      SELECT jsonb_agg(b.name ORDER BY b.name)
      FROM public.community_board_members a
      JOIN public.community_board_members me ON me.board_id = a.board_id AND me.user_id = v_uid
      JOIN public.community_boards b ON b.id = a.board_id AND b.visibility = 'open'
      WHERE a.user_id = p_user_id), '[]'::jsonb) END
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.world_card_details(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.world_card_details(uuid) TO authenticated;

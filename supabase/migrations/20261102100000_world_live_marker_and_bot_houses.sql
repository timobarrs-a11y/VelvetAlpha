-- Mark human neighbors "live"; open every house to the bots
--
-- 1. world_cards gains is_live: true when the plot belongs to a person (not a seeded
-- or bot profile) whose profile is visible to the viewer. The town draws a small
-- "LIVE" marker over those houses.
-- 2. Seeded and bot profiles can live in any house style, so the street looks varied:
-- world_cards and get_town_plots report them as members, and (for the earned
-- styles) as holding the medal that unlocks each. This is display only. It does not
-- touch plans or medals, and people's access to houses is unchanged.

CREATE OR REPLACE FUNCTION public.world_is_bot(p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE((SELECT mp.is_bot FROM public.member_profiles mp WHERE mp.user_id = p_user_id), false); $$;
REVOKE EXECUTE ON FUNCTION public.world_is_bot(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.world_is_bot(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.world_cards(uuid[]);

CREATE FUNCTION public.world_cards(p_user_ids uuid[])
RETURNS TABLE (
  user_id uuid, slot_index int, house jsonb, sign jsonb, yard jsonb, is_member boolean, earned text[],
  is_public boolean, display_name text, headline text, goal_label text, goal_pct int,
  medals text[], medal_count int, spaces text[], new_neighbor boolean, is_live boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    p.user_id, p.slot_index, p.house, p.sign, p.yard,
    public.is_paid_member(p.user_id) OR public.world_is_bot(p.user_id),
    CASE WHEN public.world_is_bot(p.user_id) THEN ARRAY['iron-will','the-closer','hat-trick','coachable','unbreakable'] ELSE public.world_earned_medals(p.user_id) END,
    v.shown,
    CASE WHEN v.shown THEN COALESCE(NULLIF(btrim(mp.display_name), ''), up.nickname, up.name, 'Neighbor') ELSE 'A neighbor' END,
    CASE WHEN v.shown THEN mp.headline END,
    g.title,
    g.pct,
    CASE WHEN v.shown THEN COALESCE((
      SELECT array_agg(x.medal_slug ORDER BY x.ord)
      FROM (
        SELECT um.medal_slug, COALESCE(um.showcase_slot, 10) * 1000 + row_number() OVER (ORDER BY um.earned_at DESC) AS ord
        FROM public.user_medals um
        WHERE um.user_id = p.user_id AND um.earned_at IS NOT NULL
        ORDER BY COALESCE(um.showcase_slot, 10), um.earned_at DESC
        LIMIT 3
      ) x), '{}') ELSE '{}' END,
    CASE WHEN v.shown THEN (SELECT count(*)::int FROM public.user_medals um WHERE um.user_id = p.user_id AND um.earned_at IS NOT NULL) ELSE 0 END,
    CASE WHEN v.shown THEN COALESCE((
      SELECT array_agg(b.name ORDER BY m.joined_at)
      FROM (SELECT * FROM public.community_board_members m0 WHERE m0.user_id = p.user_id ORDER BY m0.joined_at LIMIT 2) m
      JOIN public.community_boards b ON b.id = m.board_id AND b.visibility = 'open'), '{}') ELSE '{}' END,
    p.moved_in_at > now() - interval '7 days',
    -- a real person with a visible profile: the town marks their house "live"
    v.shown AND NOT COALESCE(mp.is_bot, false)
  FROM unnest(p_user_ids) AS ids(id)
  JOIN public.world_plots p ON p.user_id = ids.id
  LEFT JOIN public.member_profiles mp ON mp.user_id = p.user_id
  LEFT JOIN public.user_profiles up ON up.id = p.user_id
  -- shown = a public profile, and neither of you has blocked the other (you always see your own)
  CROSS JOIN LATERAL (SELECT (p.user_id = auth.uid()) OR (COALESCE(mp.is_public, false) AND NOT public.world_blocked(auth.uid(), p.user_id)) AS shown) v
  LEFT JOIN LATERAL (
    -- one goal they turned on "show on profile" for: an active one first, newest first
    SELECT ug.title, LEAST(100, GREATEST(0, round(100 * ug.current_value / NULLIF(ug.target_value, 0))))::int AS pct
    FROM public.user_goals ug
    WHERE v.shown AND ug.user_id = p.user_id AND ug.show_on_profile
    ORDER BY (ug.status = 'completed'), ug.created_at DESC
    LIMIT 1
  ) g ON true;
$$;

REVOKE EXECUTE ON FUNCTION public.world_cards(uuid[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.world_cards(uuid[]) TO authenticated;

-- The zoomed-out town view: same bot access.
DROP FUNCTION IF EXISTS public.get_town_plots(int, int);
CREATE FUNCTION public.get_town_plots(p_from int, p_to int)
RETURNS TABLE (user_id uuid, slot_index int, style text, body text, roof text, door text, sign_color text, is_member boolean, earned text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.user_id, p.slot_index, p.house ->> 'style', p.house ->> 'body', p.house ->> 'roof', p.house ->> 'door', p.sign ->> 'color',
         public.is_paid_member(p.user_id) OR public.world_is_bot(p.user_id),
         CASE WHEN p.house ->> 'style' IN ('lighthouse', 'observatory', 'treehouse', 'windmill', 'castle')
              THEN CASE WHEN public.world_is_bot(p.user_id) THEN ARRAY['iron-will','the-closer','hat-trick','coachable','unbreakable'] ELSE public.world_earned_medals(p.user_id) END
              ELSE '{}' END
  FROM public.world_plots p
  WHERE p.slot_index >= p_from AND p.slot_index < LEAST(p_to, p_from + 5000)
  ORDER BY p.slot_index;
$$;
REVOKE EXECUTE ON FUNCTION public.get_town_plots(int, int) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_town_plots(int, int) TO authenticated;

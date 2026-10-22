/*
# Phase 6: Velvet World (working name)

## Plain-English summary
Every member gets a plot in one shared town: a house (the look) and a billboard
(the info). Plots have a permanent number, so an address never changes. The
client turns plot numbers into streets and lots with townSlot() in
src/features/velvet-world/art/streetArt.js.

Each day everyone sees a new "block": 8 neighbors picked fresh, nobody repeated
until the town runs out, a few who share your community spaces, and nothing
that tells anyone when a neighbor was last online.

## Houses
Three collections, checked on save:
- starter: standard, cottage, bungalow, ranch, cabin       (everyone)
- member:  craftsman, modern, colonial, victorian, villa   (paid members)
- earned:  lighthouse (iron-will), observatory (the-closer),
           treehouse (hat-trick)                            (that medal, never for sale)
If a member's plan ends, the saved choice stays, and every viewer's client shows
a starter house instead (resolvePlot in the kit), until they're a member again.

## Tables
- world_plots        one per person: slot_index, house, sign, yard, main companion
- world_block_views  who you were shown on which day (keeps blocks fresh)

## RPCs
- claim_world_plot(p_house)         move in: gets the next plot number (idempotent)
- get_my_world_plot()               your plot
- save_world_plot(p_house, p_sign, p_yard)   validated save
- world_cards(p_user_ids)           everything needed to draw plots and billboards
- get_daily_block(p_day, p_count)   today's candidate neighbors, in order
- mark_block_seen(p_day, p_ids)     record who you were shown today
- get_town_plots(p_from, p_to)      tiny summaries for the whole-town view
- find_world_plot(p_query)          find someone by name
- get_landmark_progress()           how built the clock tower is (0-100)

Requires community Phases 2-3 (community_board_members, user_medals) and
member_profiles. Idempotent.
*/

-- ============================================================
-- 1. Helpers
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_paid_member(p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT subscription_tier IN ('essential', 'plus', 'elite') FROM public.user_profiles WHERE id = p_user_id), false);
$$;
REVOKE EXECUTE ON FUNCTION public.is_paid_member(uuid) FROM anon, authenticated, public;

-- Medals that unlock earned houses, for one user.
CREATE OR REPLACE FUNCTION public.world_earned_medals(p_user_id uuid)
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(array_agg(medal_slug ORDER BY medal_slug), '{}')
  FROM public.user_medals
  WHERE user_id = p_user_id AND earned_at IS NOT NULL
    AND medal_slug IN ('iron-will', 'the-closer', 'hat-trick');
$$;
REVOKE EXECUTE ON FUNCTION public.world_earned_medals(uuid) FROM anon, authenticated, public;

-- ============================================================
-- 2. Plots
-- ============================================================
CREATE TABLE IF NOT EXISTS public.world_plots (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  slot_index int NOT NULL UNIQUE CHECK (slot_index >= 0),
  house jsonb NOT NULL DEFAULT '{"style": "standard"}'::jsonb,
  sign jsonb NOT NULL DEFAULT '{}'::jsonb,
  yard jsonb NOT NULL DEFAULT '{}'::jsonb,
  main_companion_id uuid REFERENCES public.companions(id) ON DELETE SET NULL,
  moved_in_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.world_plots ENABLE ROW LEVEL SECURITY;

-- Read your own row directly; everything about other people goes through the RPCs below.
DROP POLICY IF EXISTS "world_plots_select_own" ON public.world_plots;
CREATE POLICY "world_plots_select_own" ON public.world_plots
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Only the main companion can be changed directly; looks go through save_world_plot.
DROP POLICY IF EXISTS "world_plots_update_own" ON public.world_plots;
CREATE POLICY "world_plots_update_own" ON public.world_plots
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
REVOKE UPDATE ON public.world_plots FROM authenticated;
GRANT UPDATE (main_companion_id) ON public.world_plots TO authenticated;

-- The main companion must be one of your own.
CREATE OR REPLACE FUNCTION public.world_plots_check_companion()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.main_companion_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.companions WHERE id = NEW.main_companion_id AND user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'That companion is not yours';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_world_plots_check_companion ON public.world_plots;
CREATE TRIGGER trg_world_plots_check_companion
  BEFORE INSERT OR UPDATE ON public.world_plots
  FOR EACH ROW EXECUTE FUNCTION public.world_plots_check_companion();

-- Is this house style open to this person right now?
CREATE OR REPLACE FUNCTION public.world_house_allowed(p_style text, p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN p_style IN ('standard', 'cottage', 'bungalow', 'ranch', 'cabin') THEN true
    WHEN p_style IN ('craftsman', 'modern', 'colonial', 'victorian', 'villa') THEN public.is_paid_member(p_user_id)
    WHEN p_style = 'lighthouse' THEN 'iron-will' = ANY (public.world_earned_medals(p_user_id))
    WHEN p_style = 'observatory' THEN 'the-closer' = ANY (public.world_earned_medals(p_user_id))
    WHEN p_style = 'treehouse' THEN 'hat-trick' = ANY (public.world_earned_medals(p_user_id))
    ELSE false
  END;
$$;
REVOKE EXECUTE ON FUNCTION public.world_house_allowed(text, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.world_house_allowed(text, uuid) TO authenticated;

-- Move in. Returns your plot number; calling it again returns the same number.
CREATE OR REPLACE FUNCTION public.claim_world_plot(p_house jsonb DEFAULT NULL)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_slot int;
  v_house jsonb := COALESCE(p_house, '{"style": "standard"}'::jsonb);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT slot_index INTO v_slot FROM public.world_plots WHERE user_id = auth.uid();
  IF FOUND THEN RETURN v_slot; END IF;
  IF NOT public.world_house_allowed(v_house ->> 'style', auth.uid()) THEN v_house := '{"style": "standard"}'::jsonb; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('world_plots_slot'));
  SELECT COALESCE(max(slot_index) + 1, 0) INTO v_slot FROM public.world_plots;
  INSERT INTO public.world_plots (user_id, slot_index, house) VALUES (auth.uid(), v_slot, v_house);
  RETURN v_slot;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.claim_world_plot(jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.claim_world_plot(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_world_plot()
RETURNS TABLE (slot_index int, house jsonb, sign jsonb, yard jsonb, main_companion_id uuid, moved_in_at timestamptz, is_member boolean, earned text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.slot_index, p.house, p.sign, p.yard, p.main_companion_id, p.moved_in_at,
         public.is_paid_member(p.user_id), public.world_earned_medals(p.user_id)
  FROM public.world_plots p WHERE p.user_id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_world_plot() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_my_world_plot() TO authenticated;

-- Save your look. The house must be open to you; member-only sign and yard choices are kept
-- even for free users (they appear the moment you join), because the kit decides what shows.
CREATE OR REPLACE FUNCTION public.save_world_plot(p_house jsonb, p_sign jsonb DEFAULT NULL, p_yard jsonb DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_house IS NULL OR NOT public.world_house_allowed(p_house ->> 'style', auth.uid()) THEN
    RAISE EXCEPTION 'That house is not open to you yet';
  END IF;
  IF octet_length(p_house::text) > 2000 OR octet_length(COALESCE(p_sign, '{}')::text) > 2000 OR octet_length(COALESCE(p_yard, '{}')::text) > 4000 THEN
    RAISE EXCEPTION 'Plot settings are too large';
  END IF;
  UPDATE public.world_plots
  SET house = p_house, sign = COALESCE(p_sign, sign), yard = COALESCE(p_yard, yard), updated_at = now()
  WHERE user_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Move in first'; END IF;
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.save_world_plot(jsonb, jsonb, jsonb) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.save_world_plot(jsonb, jsonb, jsonb) TO authenticated;

-- ============================================================
-- 3. What a billboard shows
-- ============================================================
-- Private profiles still get a house, but their billboard just says "A neighbor".
CREATE OR REPLACE FUNCTION public.world_cards(p_user_ids uuid[])
RETURNS TABLE (
  user_id uuid, slot_index int, house jsonb, sign jsonb, yard jsonb, is_member boolean, earned text[],
  is_public boolean, display_name text, headline text, goal_label text, goal_pct int,
  medals text[], medal_count int, spaces text[], new_neighbor boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    p.user_id, p.slot_index, p.house, p.sign, p.yard,
    public.is_paid_member(p.user_id), public.world_earned_medals(p.user_id),
    COALESCE(mp.is_public, false),
    CASE WHEN COALESCE(mp.is_public, false) THEN COALESCE(NULLIF(btrim(mp.display_name), ''), up.nickname, up.name, 'Neighbor') ELSE 'A neighbor' END,
    CASE WHEN COALESCE(mp.is_public, false) THEN mp.headline END,
    g.title,
    g.pct,
    CASE WHEN COALESCE(mp.is_public, false) THEN COALESCE((
      SELECT array_agg(x.medal_slug ORDER BY x.ord)
      FROM (
        SELECT um.medal_slug, COALESCE(um.showcase_slot, 10) * 1000 + row_number() OVER (ORDER BY um.earned_at DESC) AS ord
        FROM public.user_medals um
        WHERE um.user_id = p.user_id AND um.earned_at IS NOT NULL
        ORDER BY COALESCE(um.showcase_slot, 10), um.earned_at DESC
        LIMIT 3
      ) x), '{}') ELSE '{}' END,
    CASE WHEN COALESCE(mp.is_public, false) THEN (SELECT count(*)::int FROM public.user_medals um WHERE um.user_id = p.user_id AND um.earned_at IS NOT NULL) ELSE 0 END,
    CASE WHEN COALESCE(mp.is_public, false) THEN COALESCE((
      SELECT array_agg(b.name ORDER BY m.joined_at)
      FROM (SELECT * FROM public.community_board_members m0 WHERE m0.user_id = p.user_id ORDER BY m0.joined_at LIMIT 2) m
      JOIN public.community_boards b ON b.id = m.board_id AND b.visibility = 'open'), '{}') ELSE '{}' END,
    p.moved_in_at > now() - interval '7 days'
  FROM unnest(p_user_ids) AS ids(id)
  JOIN public.world_plots p ON p.user_id = ids.id
  LEFT JOIN public.member_profiles mp ON mp.user_id = p.user_id
  LEFT JOIN public.user_profiles up ON up.id = p.user_id
  LEFT JOIN LATERAL (
    -- the first goal they chose to share
    SELECT ug.title, LEAST(100, GREATEST(0, round(100 * ug.current_value / NULLIF(ug.target_value, 0))))::int AS pct
    FROM public.user_goals ug
    WHERE COALESCE(mp.is_public, false) AND ug.user_id = p.user_id AND ug.id = ANY (COALESCE(mp.shared_goal_ids, '{}'))
    ORDER BY array_position(mp.shared_goal_ids, ug.id)
    LIMIT 1
  ) g ON true;
$$;
REVOKE EXECUTE ON FUNCTION public.world_cards(uuid[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.world_cards(uuid[]) TO authenticated;

-- ============================================================
-- 4. Today's block
-- ============================================================
CREATE TABLE IF NOT EXISTS public.world_block_views (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  neighbor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  PRIMARY KEY (user_id, day, neighbor_id)
);
ALTER TABLE public.world_block_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "world_block_views_own" ON public.world_block_views;
CREATE POLICY "world_block_views_own" ON public.world_block_views
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Candidates for one day, in order. Same answer all day (so a reload doesn't reshuffle), new
-- people tomorrow. Only public profiles are put on other people's blocks. The first few share
-- one of your community spaces; the rest come from anywhere in town.
CREATE OR REPLACE FUNCTION public.get_daily_block(p_day date DEFAULT current_date, p_count int DEFAULT 16)
RETURNS TABLE (user_id uuid, shares_space boolean, ord int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH mine AS (
    SELECT board_id FROM public.community_board_members WHERE community_board_members.user_id = auth.uid()
  ),
  cands AS (
    SELECT p.user_id,
           EXISTS (SELECT 1 FROM public.world_block_views v WHERE v.user_id = auth.uid() AND v.neighbor_id = p.user_id AND v.day < p_day AND v.day >= p_day - 30) AS seen,
           EXISTS (SELECT 1 FROM public.community_board_members m WHERE m.user_id = p.user_id AND m.board_id IN (SELECT board_id FROM mine)) AS shares,
           md5(auth.uid()::text || p_day::text || p.user_id::text) AS shuffle
    FROM public.world_plots p
    JOIN public.member_profiles mp ON mp.user_id = p.user_id AND mp.is_public
    WHERE p.user_id <> auth.uid()
  ),
  shared AS (SELECT c.user_id, true AS s, 0 AS grp, c.seen, c.shuffle FROM cands c WHERE c.shares ORDER BY c.seen, c.shuffle LIMIT 3),
  rest AS (SELECT c.user_id, c.shares AS s, 1 AS grp, c.seen, c.shuffle FROM cands c WHERE c.user_id NOT IN (SELECT shared.user_id FROM shared) ORDER BY c.seen, c.shuffle LIMIT GREATEST(p_count - (SELECT count(*) FROM shared), 0))
  SELECT x.user_id, x.s, (row_number() OVER (ORDER BY x.grp, x.seen, x.shuffle))::int
  FROM (SELECT * FROM shared UNION ALL SELECT * FROM rest) x
  ORDER BY 3;
$$;
REVOKE EXECUTE ON FUNCTION public.get_daily_block(date, int) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_daily_block(date, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_block_seen(p_day date, p_ids uuid[])
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO public.world_block_views (user_id, neighbor_id, day)
  SELECT auth.uid(), id, p_day FROM unnest(p_ids) AS id
  WHERE auth.uid() IS NOT NULL AND id <> auth.uid()
  ON CONFLICT DO NOTHING;
  DELETE FROM public.world_block_views WHERE user_id = auth.uid() AND day < p_day - 45;
$$;
REVOKE EXECUTE ON FUNCTION public.mark_block_seen(date, uuid[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.mark_block_seen(date, uuid[]) TO authenticated;

-- ============================================================
-- 5. The whole town
-- ============================================================
-- Tiny per-plot summaries for the zoomed-out view. Fetch in ranges of plot numbers.
-- `earned` is only filled for people living in an earned house (so the kit can draw it).
DROP FUNCTION IF EXISTS public.get_town_plots(int, int);
CREATE FUNCTION public.get_town_plots(p_from int, p_to int)
RETURNS TABLE (user_id uuid, slot_index int, style text, body text, roof text, door text, sign_color text, is_member boolean, earned text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.user_id, p.slot_index, p.house ->> 'style', p.house ->> 'body', p.house ->> 'roof', p.house ->> 'door', p.sign ->> 'color', public.is_paid_member(p.user_id),
         CASE WHEN p.house ->> 'style' IN ('lighthouse', 'observatory', 'treehouse') THEN public.world_earned_medals(p.user_id) ELSE '{}' END
  FROM public.world_plots p
  WHERE p.slot_index >= p_from AND p.slot_index < LEAST(p_to, p_from + 5000)
  ORDER BY p.slot_index;
$$;
REVOKE EXECUTE ON FUNCTION public.get_town_plots(int, int) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_town_plots(int, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_town_size()
RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE(max(slot_index) + 1, 0) FROM public.world_plots; $$;
REVOKE EXECUTE ON FUNCTION public.get_town_size() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_town_size() TO authenticated;

CREATE OR REPLACE FUNCTION public.find_world_plot(p_query text)
RETURNS TABLE (user_id uuid, slot_index int, display_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.user_id, p.slot_index, mp.display_name
  FROM public.world_plots p
  JOIN public.member_profiles mp ON mp.user_id = p.user_id AND mp.is_public
  WHERE length(btrim(p_query)) >= 2 AND mp.display_name ILIKE '%' || btrim(p_query) || '%'
  ORDER BY mp.display_name
  LIMIT 10;
$$;
REVOKE EXECUTE ON FUNCTION public.find_world_plot(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.find_world_plot(text) TO authenticated;

-- The clock tower rises with everyone's completed goals. Target is 1,000 goals for now.
CREATE OR REPLACE FUNCTION public.get_landmark_progress()
RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT LEAST(100, (count(*) * 100 / 1000))::int FROM public.user_goals WHERE status = 'completed'; $$;
REVOKE EXECUTE ON FUNCTION public.get_landmark_progress() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_landmark_progress() TO authenticated;

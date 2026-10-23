/*
# Phase 6c: Two more earned houses, and unlocks before move-in

## Plain-English summary
Adds two earned houses, so there are five (one medal each, never for sale):
- windmill  earned with Coachable   (complete 10 commitments your coach set)
- castle    earned with Unbreakable (check in 100 days in a row)

Also adds get_world_unlocks(), so the welcome popup can show a new person which
houses they can pick before they have a plot.

## Existing members get a house automatically
Everyone who signed up before Velvet World gets a plot now, so the town is full on
day one and nobody has to go looking for a setup screen:
- Plot numbers follow sign-up order, so the earliest members live on the first streets.
- Each gets a starter house (picked from their user id, so it's stable) with the front
  door in their favorite color.
- Bots and banned accounts are skipped.
- `welcomed_at` stays empty for these plots. The app shows them a one-time "We built you a
  house" popup with Make it mine / Looks great. Plots people chose themselves count as
  welcomed already.

Requires Phase 6 (velvet_world_phase6). Idempotent.
*/

-- Medals that unlock earned houses, for one user.
CREATE OR REPLACE FUNCTION public.world_earned_medals(p_user_id uuid)
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(array_agg(medal_slug ORDER BY medal_slug), '{}')
  FROM public.user_medals
  WHERE user_id = p_user_id AND earned_at IS NOT NULL
    AND medal_slug IN ('iron-will', 'the-closer', 'hat-trick', 'coachable', 'unbreakable');
$$;
REVOKE EXECUTE ON FUNCTION public.world_earned_medals(uuid) FROM anon, authenticated, public;

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
    WHEN p_style = 'windmill' THEN 'coachable' = ANY (public.world_earned_medals(p_user_id))
    WHEN p_style = 'castle' THEN 'unbreakable' = ANY (public.world_earned_medals(p_user_id))
    ELSE false
  END;
$$;
REVOKE EXECUTE ON FUNCTION public.world_house_allowed(text, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.world_house_allowed(text, uuid) TO authenticated;

-- Town summaries: `earned` is filled for anyone living in an earned house, so the kit can draw it.
CREATE OR REPLACE FUNCTION public.get_town_plots(p_from int, p_to int)
RETURNS TABLE (user_id uuid, slot_index int, style text, body text, roof text, door text, sign_color text, is_member boolean, earned text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.user_id, p.slot_index, p.house ->> 'style', p.house ->> 'body', p.house ->> 'roof', p.house ->> 'door', p.sign ->> 'color', public.is_paid_member(p.user_id),
         CASE WHEN p.house ->> 'style' IN ('lighthouse', 'observatory', 'treehouse', 'windmill', 'castle') THEN public.world_earned_medals(p.user_id) ELSE '{}' END
  FROM public.world_plots p
  WHERE p.slot_index >= p_from AND p.slot_index < LEAST(p_to, p_from + 5000)
  ORDER BY p.slot_index;
$$;
REVOKE EXECUTE ON FUNCTION public.get_town_plots(int, int) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_town_plots(int, int) TO authenticated;

-- What you can live in, even before you've moved in (for the welcome popup).
CREATE OR REPLACE FUNCTION public.get_world_unlocks()
RETURNS TABLE (is_member boolean, earned text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_paid_member(auth.uid()), public.world_earned_medals(auth.uid())
  WHERE auth.uid() IS NOT NULL;
$$;
REVOKE EXECUTE ON FUNCTION public.get_world_unlocks() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_world_unlocks() TO authenticated;

-- ============================================================
-- Existing members: a house for everyone, and a one-time welcome
-- ============================================================
-- Plots people already chose themselves have been welcomed. Only on the first run, so a
-- re-run can't mark the houses built below as seen.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'world_plots' AND column_name = 'welcomed_at') THEN
    ALTER TABLE public.world_plots ADD COLUMN welcomed_at timestamptz;
    UPDATE public.world_plots SET welcomed_at = moved_in_at;
  END IF;
END $$;

-- Favorite color (from the personal questionnaire) → a front door color from the kit's palette.
CREATE OR REPLACE FUNCTION public.world_door_for_color(p_color text)
RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT CASE lower(COALESCE(p_color, ''))
    WHEN 'red' THEN '#C2413A' WHEN 'orange' THEN '#B98A6A' WHEN 'yellow' THEN '#E0A43A'
    WHEN 'green' THEN '#2F4F3E' WHEN 'teal' THEN '#2F4F3E' WHEN 'cyan' THEN '#2B4A6B'
    WHEN 'blue' THEN '#2B4A6B' WHEN 'purple' THEN '#8E5468' WHEN 'magenta' THEN '#8E5468'
    WHEN 'pink' THEN '#8E5468' WHEN 'black' THEN '#3A3340' WHEN 'white' THEN '#B98A6A'
    ELSE NULL END;
$$;

-- Move every existing member in. Safe to re-run: only people without a plot are added.
DO $$
DECLARE v_next int;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('world_plots_slot'));
  SELECT COALESCE(max(slot_index) + 1, 0) INTO v_next FROM public.world_plots;
  INSERT INTO public.world_plots (user_id, slot_index, house, welcomed_at)
  SELECT u.id,
         v_next + (row_number() OVER (ORDER BY u.created_at, u.id))::int - 1,
         jsonb_strip_nulls(jsonb_build_object(
           'style', (ARRAY['standard', 'cottage', 'bungalow', 'ranch', 'cabin'])[1 + abs(hashtext(u.id::text)) % 5],
           'door', public.world_door_for_color(to_jsonb(up) ->> 'favorite_color'))),
         NULL
  FROM auth.users u
  JOIN public.user_profiles up ON up.id = u.id
  WHERE NOT COALESCE(up.is_bot, false) AND NOT COALESCE(up.is_banned, false)
    AND NOT EXISTS (SELECT 1 FROM public.world_plots p WHERE p.user_id = u.id);
END $$;

-- Moving in yourself, or saving your look, counts as being welcomed.
CREATE OR REPLACE FUNCTION public.world_plots_mark_welcomed()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.user_id = auth.uid() AND NEW.welcomed_at IS NULL THEN NEW.welcomed_at := now(); END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_world_plots_mark_welcomed ON public.world_plots;
CREATE TRIGGER trg_world_plots_mark_welcomed
  BEFORE INSERT OR UPDATE OF house, sign, yard ON public.world_plots
  FOR EACH ROW EXECUTE FUNCTION public.world_plots_mark_welcomed();

-- What the welcome popup needs: no plot yet (new person), or a plot we built and they haven't seen.
CREATE OR REPLACE FUNCTION public.get_world_welcome()
RETURNS TABLE (has_plot boolean, needs_welcome boolean, slot_index int, house jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.user_id IS NOT NULL, p.user_id IS NULL OR p.welcomed_at IS NULL, p.slot_index, p.house
  FROM (SELECT auth.uid() AS uid) me
  LEFT JOIN public.world_plots p ON p.user_id = me.uid
  WHERE me.uid IS NOT NULL;
$$;
REVOKE EXECUTE ON FUNCTION public.get_world_welcome() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_world_welcome() TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_world_welcomed()
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ UPDATE public.world_plots SET welcomed_at = now() WHERE user_id = auth.uid() AND welcomed_at IS NULL; $$;
REVOKE EXECUTE ON FUNCTION public.mark_world_welcomed() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.mark_world_welcomed() TO authenticated;

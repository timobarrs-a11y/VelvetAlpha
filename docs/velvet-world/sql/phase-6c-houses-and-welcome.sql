/*
# Phase 6c: Two more earned houses, and unlocks before move-in

## Plain-English summary
Adds two earned houses, so there are five (one medal each, never for sale):
- windmill  earned with Coachable   (complete 10 commitments your coach set)
- castle    earned with Unbreakable (check in 100 days in a row)

Also adds get_world_unlocks(), so the welcome popup can show a new person which
houses they can pick before they have a plot.

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

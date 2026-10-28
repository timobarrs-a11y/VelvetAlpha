/*
# Promo codes: once per account

Velvet Sims promo codes (`src/games/velvet-house/state/unlockCodes.ts`) give promo packs for free. During the alpha
they're handed out to players; there is no limit on how many people use a code, but each account gets one house's worth:
a code used in one house (one companion's game) doesn't work again in another. Restarting the same house gets it back.

The list of codes lives in the game for now, so the server only records who used what. Tim, 28 October: "if we lock the
codes per account, so one per account, that should be fine."

1. `velvet_promo_redemptions`: one row per account and code, with the house (companion) it went to.
2. `claim_velvet_promo(code, companion)`: 'ok' the first time or again for the same house, 'used' for another house.
3. `admin_velvet_promo_stats()`: for the admin Promo codes page, how many accounts used each code and who last.
Safe to run more than once.
*/

CREATE TABLE IF NOT EXISTS public.velvet_promo_redemptions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL CHECK (char_length(code) BETWEEN 1 AND 40),
  companion_id uuid,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, code)
);
ALTER TABLE public.velvet_promo_redemptions ENABLE ROW LEVEL SECURITY;

-- People see their own redemptions; admins see everyone's (how many players used each code). Writes go through the RPC.
DROP POLICY IF EXISTS "promo_redemptions_select" ON public.velvet_promo_redemptions;
CREATE POLICY "promo_redemptions_select" ON public.velvet_promo_redemptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE OR REPLACE FUNCTION public.claim_velvet_promo(p_code text, p_companion uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_code text := lower(btrim(p_code));
  v_prev public.velvet_promo_redemptions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF v_code = '' OR char_length(v_code) > 40 THEN RAISE EXCEPTION 'Not a code'; END IF;

  INSERT INTO public.velvet_promo_redemptions (user_id, code, companion_id)
  VALUES (auth.uid(), v_code, p_companion)
  ON CONFLICT (user_id, code) DO NOTHING;
  IF FOUND THEN RETURN 'ok'; END IF;

  SELECT * INTO v_prev FROM public.velvet_promo_redemptions WHERE user_id = auth.uid() AND code = v_code;
  RETURN CASE WHEN v_prev.companion_id IS NOT DISTINCT FROM p_companion THEN 'ok' ELSE 'used' END;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.claim_velvet_promo(text, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.claim_velvet_promo(text, uuid) TO authenticated;

-- 3. For the admin Promo codes page: every code that has been used, how many accounts, when last, and the latest few.
CREATE OR REPLACE FUNCTION public.admin_velvet_promo_stats()
RETURNS TABLE (code text, accounts int, last_used timestamptz, recent jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT r.code, count(*)::int, max(r.redeemed_at),
         (SELECT COALESCE(jsonb_agg(jsonb_build_object('name', x.name, 'at', x.redeemed_at) ORDER BY x.redeemed_at DESC), '[]'::jsonb)
          FROM (SELECT COALESCE(mp.display_name, up.name, 'Someone') AS name, q.redeemed_at
                FROM public.velvet_promo_redemptions q
                LEFT JOIN public.member_profiles mp ON mp.user_id = q.user_id
                LEFT JOIN public.user_profiles up ON up.id = q.user_id
                WHERE q.code = r.code
                ORDER BY q.redeemed_at DESC LIMIT 5) x)
  FROM public.velvet_promo_redemptions r
  GROUP BY r.code;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_velvet_promo_stats() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_velvet_promo_stats() TO authenticated;

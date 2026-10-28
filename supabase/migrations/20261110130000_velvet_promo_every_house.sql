/*
# Promo codes: redeemed once, open in every house on the account

Tim, 28 October: "the intent is open it up for every house they want after". A code redeemed in one house is the
account's: every house on the account (and every house made later) gets the packs, without typing the code again.
This replaces the "another house on the account is told it's used" rule from 20261110120000.

`claim_velvet_promo` now only records the redemption (the first house it was used in is kept, for the admin page) and
always answers 'ok'. The game asks for the account's codes with a plain select on `velvet_promo_redemptions`, which
its existing policy allows for the player's own rows. Safe to run more than once.
*/
CREATE OR REPLACE FUNCTION public.claim_velvet_promo(p_code text, p_companion uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_code text := lower(btrim(p_code));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF v_code = '' OR char_length(v_code) > 40 THEN RAISE EXCEPTION 'Not a code'; END IF;
  INSERT INTO public.velvet_promo_redemptions (user_id, code, companion_id)
  VALUES (auth.uid(), v_code, p_companion)
  ON CONFLICT (user_id, code) DO NOTHING;
  RETURN 'ok';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.claim_velvet_promo(text, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.claim_velvet_promo(text, uuid) TO authenticated;

import { supabase } from '../shared/supabase/client';

/** Record a Velvet Sims promo code as redeemed on this account (the house it was first used in is kept for the admin page). */
export async function recordVelvetPromo(code: string, companionId: string | null): Promise<void> {
  await supabase.rpc('claim_velvet_promo', { p_code: code, p_companion: companionId });
}

/** The promo codes this account has redeemed, in any house: every house of theirs gets those packs. */
export async function myVelvetPromoCodes(): Promise<string[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase.from('velvet_promo_redemptions').select('code').eq('user_id', user.id);
  if (error || !data) return [];
  return data.map((r) => r.code as string);
}

import { supabase } from '../shared/supabase/client';

/**
 * Claim a Velvet Sims promo code for this account and house (companion). 'used' means it already went to another house
 * on this account. If the claim can't be checked (offline, not applied yet), the code still works during the alpha.
 */
export async function claimVelvetPromo(code: string, companionId: string | null): Promise<'ok' | 'used'> {
  const { data, error } = await supabase.rpc('claim_velvet_promo', { p_code: code, p_companion: companionId });
  if (error) return 'ok';
  return data === 'used' ? 'used' : 'ok';
}

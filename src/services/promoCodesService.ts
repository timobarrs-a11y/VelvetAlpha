import { supabase } from '../shared/supabase/client';

export interface PromoCodeStats {
  code: string;
  accounts: number;
  last_used: string | null;
  recent: Array<{ name: string; at: string }>;
}

/** Admin only: how many accounts used each promo code, and who last. */
export async function fetchPromoStats(): Promise<PromoCodeStats[]> {
  const { data, error } = await supabase.rpc('admin_velvet_promo_stats');
  if (error) throw new Error(error.message?.includes('forbidden') ? 'Owner access required.' : error.message);
  return (data ?? []) as PromoCodeStats[];
}

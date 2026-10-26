import { useEffect, useState } from 'react';
import { supabase } from '../shared/supabase/client';
import { getUserMedals } from '../services/medalsService';
import { getOwnedAvatarItems, onAvatarInventoryChanged } from '../services/avatarInventoryService';
import { isPaidTier, normalizeSubscriptionTier } from '../types/subscription';
import { AvatarUnlocks, STARTER_ONLY } from '../data/avatarItems';

// What the signed-in person may wear: membership, medals, and everything
// they own (bought in Velvet Sims, won, or granted). Starter-only if nobody
// is signed in or anything fails, so a locked item is never offered by
// mistake. The server has the final say on save.
export async function loadAvatarUnlocks(): Promise<AvatarUnlocks> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return STARTER_ONLY;
    const [{ data: profile }, medals, owned] = await Promise.all([
      supabase.from('user_profiles').select('subscription_tier').eq('id', user.id).maybeSingle(),
      getUserMedals().catch(() => []),
      getOwnedAvatarItems(user.id).catch(() => []),
    ]);
    return {
      member: isPaidTier(normalizeSubscriptionTier(profile?.subscription_tier)),
      earned: medals.filter((m) => m.earned_at).map((m) => m.slug),
      owned,
    };
  } catch {
    return STARTER_ONLY;
  }
}

export function useAvatarUnlocks(): AvatarUnlocks {
  const [unlocks, setUnlocks] = useState<AvatarUnlocks>(STARTER_ONLY);

  useEffect(() => {
    let cancelled = false;
    const load = () => loadAvatarUnlocks().then((u) => { if (!cancelled) setUnlocks(u); });
    load();
    // Something bought in Velvet Sims shows up here straight away.
    const off = onAvatarInventoryChanged(load);
    return () => { cancelled = true; off(); };
  }, []);

  return unlocks;
}

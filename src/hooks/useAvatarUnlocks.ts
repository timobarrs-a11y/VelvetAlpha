import { useEffect, useState } from 'react';
import { supabase } from '../shared/supabase/client';
import { getUserMedals } from '../services/medalsService';
import { isPaidTier, normalizeSubscriptionTier } from '../types/subscription';
import { AvatarUnlocks, STARTER_ONLY } from '../data/avatarItems';

// Which wardrobe items the signed-in person may wear. Starts (and stays, if
// anything fails or nobody is signed in) at starter-only, so a locked item is
// never offered by mistake. The server has the final say on save.
export function useAvatarUnlocks(): AvatarUnlocks {
  const [unlocks, setUnlocks] = useState<AvatarUnlocks>(STARTER_ONLY);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [{ data: profile }, medals] = await Promise.all([
        supabase.from('user_profiles').select('subscription_tier').eq('id', user.id).maybeSingle(),
        getUserMedals().catch(() => []),
      ]);
      if (cancelled) return;
      setUnlocks({
        member: isPaidTier(normalizeSubscriptionTier(profile?.subscription_tier)),
        earned: medals.filter((m) => m.earned_at).map((m) => m.slug),
      });
    })().catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return unlocks;
}

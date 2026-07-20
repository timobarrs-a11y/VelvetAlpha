import { supabase } from '../shared/supabase/client';
import { SubscriptionTier } from '../types/subscription';

const SUPER_USER_EMAILS: string[] = (import.meta.env.VITE_SUPER_USER_EMAILS ?? '')
  .split(',')
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean);

export function isSuperUserEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return SUPER_USER_EMAILS.includes(email.trim().toLowerCase());
}

export interface SuperUserStatus {
  isSuperUser: boolean;
  tier: SubscriptionTier;
}

export async function getSuperUserStatus(
  userId: string,
  knownEmail?: string | null
): Promise<SuperUserStatus> {
  let email = knownEmail ?? null;
  if (!email) {
    const { data: { user } } = await supabase.auth.getUser();
    email = user?.email ?? null;
  }

  if (isSuperUserEmail(email)) {
    return { isSuperUser: true, tier: 'elite' };
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_super_user, subscription_tier')
    .eq('id', userId)
    .maybeSingle();

  if (profile?.is_super_user) {
    return { isSuperUser: true, tier: 'elite' };
  }

  return {
    isSuperUser: false,
    tier: (profile?.subscription_tier as SubscriptionTier) || 'free',
  };
}

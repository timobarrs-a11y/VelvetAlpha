import { supabase } from '../shared/supabase/client';

export interface UserMedal {
  slug: string; name: string; description: string;
  category: 'goals' | 'streaks' | 'social' | 'community' | 'coach' | 'hidden' | 'exclusive';
  tier: 'bronze' | 'silver' | 'gold' | 'legendary'; icon: string;
  threshold: number; progress: number; earned_at: string | null;
  showcase_slot: number | null; is_hidden: boolean; earned_percent: number;
}

export async function getUserMedals(userId?: string): Promise<UserMedal[]> {
  const { data, error } = await supabase.rpc('get_user_medals', { p_user_id: userId ?? null });
  if (error) throw new Error(error.message);
  return (data ?? []) as UserMedal[];
}

export async function setShowcase(slugs: string[]): Promise<void> {
  const { error } = await supabase.rpc('set_medal_showcase', { p_slugs: slugs });
  if (error) throw new Error(error.message);
}

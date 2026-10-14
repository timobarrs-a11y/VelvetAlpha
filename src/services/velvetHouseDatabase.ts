import { supabase } from '../shared/supabase/client';

export interface VelvetHouseSave {
  id?: string;
  user_id: string;
  companion_id: string;
  save_data: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export async function loadVelvetHouseSave(companionId: string): Promise<Record<string, unknown> | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('velvet_house_saves')
    .select('save_data')
    .eq('user_id', user.id)
    .eq('companion_id', companionId)
    .maybeSingle();

  if (error || !data) return null;
  return data.save_data as Record<string, unknown>;
}

export async function saveVelvetHouseProgress(companionId: string, saveData: Record<string, unknown>): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('velvet_house_saves')
    .upsert({
      user_id: user.id,
      companion_id: companionId,
      save_data: saveData,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,companion_id',
    });

  if (error) {
    console.error('Failed to save Velvet House progress:', error.message);
  }
}

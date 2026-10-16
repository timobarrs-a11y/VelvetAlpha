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

export async function saveVelvetHouseHistory(companionId: string, saveData: Record<string, unknown>): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const day = typeof saveData.day === 'number' ? saveData.day : 0;

  await supabase
    .from('velvet_house_save_history')
    .insert({
      user_id: user.id,
      companion_id: companionId,
      save_data: saveData,
      day,
    });

  // Keep only the 10 most recent rows per (user, companion).
  // Delete older rows in a single call.
  const { data: oldRows } = await supabase
    .from('velvet_house_save_history')
    .select('id')
    .eq('user_id', user.id)
    .eq('companion_id', companionId)
    .order('saved_at', { ascending: false })
    .range(10, 100);

  if (oldRows && oldRows.length > 0) {
    const ids = oldRows.map((r: { id: string }) => r.id);
    await supabase
      .from('velvet_house_save_history')
      .delete()
      .in('id', ids);
  }
}

export async function loadVelvetHouseHistory(companionId: string): Promise<Array<{ id: string; day: number; saved_at: string; save_data: Record<string, unknown> }>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('velvet_house_save_history')
    .select('id, day, saved_at, save_data')
    .eq('user_id', user.id)
    .eq('companion_id', companionId)
    .order('saved_at', { ascending: false })
    .limit(10);

  if (error || !data) return [];
  return data as Array<{ id: string; day: number; saved_at: string; save_data: Record<string, unknown> }>;
}

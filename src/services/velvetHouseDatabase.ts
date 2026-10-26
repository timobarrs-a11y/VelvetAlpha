import { supabase } from '../shared/supabase/client';

export interface VelvetHouseSave {
  id?: string;
  user_id: string;
  companion_id: string;
  save_data: Record<string, unknown>;
  save_data_v2?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Compare two saves by game progress (day, then minutes).
 * Returns a positive number if `a` is more advanced, negative if `b` is, 0 if equal.
 */
export function compareSaveProgress(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): number {
  const aDay = typeof a.day === 'number' ? a.day : 0;
  const bDay = typeof b.day === 'number' ? b.day : 0;
  if (aDay !== bDay) return aDay - bDay;
  const aMin = typeof a.minutes === 'number' ? a.minutes : 0;
  const bMin = typeof b.minutes === 'number' ? b.minutes : 0;
  if (aMin !== bMin) return aMin - bMin;
  const aRev = typeof a.rev === 'number' ? a.rev : 0;
  const bRev = typeof b.rev === 'number' ? b.rev : 0;
  return aRev - bRev;
}

/**
 * Strip v2-only fields to produce a v1-compatible save for the save_data column.
 * This keeps save_data always holding a valid v1 save so we can roll back.
 */
export function toV1Compatible(saveData: Record<string, unknown>): Record<string, unknown> {
  const v1: Record<string, unknown> = {};
  // Copy all v1-known fields, skip v2-only extensions
  const V2_ONLY_KEYS = new Set(['v', 'rngSeed', 'player', 'partner', 'ext', 'rev', 'contentVersion', 'storage']);
  for (const [key, value] of Object.entries(saveData)) {
    if (!V2_ONLY_KEYS.has(key)) {
      v1[key] = value;
    }
  }
  // The legacy game requires v === 1 to load a save, and knows only the four original floors:
  // the attic's looks and anything standing on it stay out of this copy.
  v1.v = 1;
  for (const k of ['LOOKS', 'ROOMLOOK']) if (Array.isArray(v1[k])) v1[k] = (v1[k] as unknown[]).slice(0, 4);
  if (Array.isArray(v1.objs)) v1.objs = (v1.objs as Array<{ level?: number }>).filter(o => (o?.level ?? 0) <= 3);

  // Extract grouped player/partner back to v1 flat fields if present.
  // Merge needs, skills and mood into the existing jordan/maya objects
  // instead of replacing them with only the needs object.
  const player = saveData.player as Record<string, unknown> | undefined;
  const partner = saveData.partner as Record<string, unknown> | undefined;
  if (player) {
    if (player.name) v1.simName = player.name;
    if (player.look) v1.look = player.look;
    if (player.needs || player.skills || player.mood) {
      const existing = (v1.jordan && typeof v1.jordan === 'object' ? v1.jordan : {}) as Record<string, unknown>;
      v1.jordan = { ...existing, ...filterUndef({ needs: player.needs, skills: player.skills, mood: player.mood }) };
    }
  }
  if (partner) {
    if (partner.name) v1.partnerName = partner.name;
    if (partner.look) v1.mayaLook = partner.look;
    if (partner.needs || partner.skills || partner.mood) {
      const existing = (v1.maya && typeof v1.maya === 'object' ? v1.maya : {}) as Record<string, unknown>;
      v1.maya = { ...existing, ...filterUndef({ needs: partner.needs, skills: partner.skills, mood: partner.mood }) };
    }
  }
  return v1;
}

function filterUndef(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/** Both copies in the cloud: `v1` (what the legacy game reads) and `v2` (the full save, v2 or newer). */
export async function loadVelvetHouseSaveCopies(companionId: string): Promise<{ v1: Record<string, unknown> | null; v2: Record<string, unknown> | null } | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('velvet_house_saves')
    .select('save_data, save_data_v2')
    .eq('user_id', user.id)
    .eq('companion_id', companionId)
    .maybeSingle();
  if (error || !data) return null;
  return { v1: (data.save_data as Record<string, unknown> | null) ?? null, v2: (data.save_data_v2 as Record<string, unknown> | null) ?? null };
}

export async function loadVelvetHouseSave(companionId: string): Promise<Record<string, unknown> | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('velvet_house_saves')
    .select('save_data, save_data_v2')
    .eq('user_id', user.id)
    .eq('companion_id', companionId)
    .maybeSingle();

  if (error || !data) return null;

  const v1 = data.save_data as Record<string, unknown> | null;
  const v2 = data.save_data_v2 as Record<string, unknown> | null;

  if (v1 && v2) {
    // Load whichever save is more advanced (e.g. if v1 was updated by the
    // legacy game after a rollback, it may be newer than the stale v2 copy).
    return compareSaveProgress(v1, v2) >= 0 ? v1 : v2;
  }
  return v2 ?? v1;
}

export async function saveVelvetHouseProgress(companionId: string, saveData: Record<string, unknown>, force = false): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  if (!force) {
    const { data: existing } = await supabase
      .from('velvet_house_saves')
      .select('save_data')
      .eq('user_id', user.id)
      .eq('companion_id', companionId)
      .maybeSingle();

    if (existing?.save_data) {
      const cloud = existing.save_data as Record<string, unknown>;
      if (compareSaveProgress(cloud, saveData) > 0) return;
    }
  }

  // True dual-write: save_data always holds a v1-compatible save,
  // save_data_v2 holds the v2 save (if the game produced one).
  // This way save_data is never corrupted by a v2 overwrite.
  const isV2 = typeof saveData.v === 'number' && saveData.v >= 2;
  const upsertPayload: Record<string, unknown> = {
    user_id: user.id,
    companion_id: companionId,
    updated_at: new Date().toISOString(),
  };

  if (isV2) {
    // Write v1-compatible version to save_data, full v2 to save_data_v2
    upsertPayload.save_data = toV1Compatible(saveData);
    upsertPayload.save_data_v2 = saveData;
  } else {
    // V1 save: write to save_data only, leave save_data_v2 untouched
    upsertPayload.save_data = saveData;
  }

  const { error } = await supabase
    .from('velvet_house_saves')
    .upsert(upsertPayload, {
      onConflict: 'user_id,companion_id',
    });

  if (error) {
    console.error('Failed to save Velvet House progress:', error.message);
  }
}

export async function maybeSnapshotHistory(companionId: string, saveData: Record<string, unknown>): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const day = typeof saveData.day === 'number' ? saveData.day : 0;

  const { data: last } = await supabase
    .from('velvet_house_save_history')
    .select('day')
    .eq('user_id', user.id)
    .eq('companion_id', companionId)
    .order('saved_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (last && last.day === day) return;

  await saveVelvetHouseHistory(companionId, saveData);
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

  // Belt-and-suspenders: the server trigger also caps at 10, but this
  // client-side cleanup handles any rows that slipped through before the trigger.
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

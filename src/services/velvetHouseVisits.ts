import { supabase } from '../shared/supabase/client';
import type { FriendHouse, HouseOp } from '../games/velvet-house/bridge/protocol';

// Visiting friends' houses in Velvet Sims: the database functions in
// supabase/migrations/20261111100000_velvet_house_visits.sql. A visit shows the house only, never the rest of a save.

export interface HousesAnswer { ok: boolean; data?: unknown }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Runs one request from the game with the player's account. */
export async function runHousesOp(op: HouseOp, open?: boolean): Promise<HousesAnswer> {
  try {
    if (op === 'friends') {
      const { data, error } = await supabase.rpc('velvet_house_friend_houses');
      if (error || !Array.isArray(data)) return { ok: false };
      const list: FriendHouse[] = data
        .filter((r: { owner_id?: unknown }) => typeof r.owner_id === 'string')
        .map((r: { owner_id: string; owner_name?: string | null; day?: number | null }) => ({ ownerId: r.owner_id, name: r.owner_name || 'A friend', day: typeof r.day === 'number' ? r.day : null }));
      return { ok: true, data: list };
    }
    if (op === 'open') {
      const { data, error } = await supabase.rpc('velvet_house_visits_open');
      return error ? { ok: false } : { ok: true, data: data === true };
    }
    if (typeof open !== 'boolean') return { ok: false };
    const { data, error } = await supabase.rpc('velvet_house_set_visits_open', { p_open: open });
    return error ? { ok: false } : { ok: true, data: data === true };
  } catch {
    return { ok: false };
  }
}

/** A friend's house to visit (only the house), or null when it is not open to the player. */
export async function fetchFriendHouse(ownerId: string): Promise<Record<string, unknown> | null> {
  if (!UUID.test(ownerId)) return null;
  const { data, error } = await supabase.rpc('velvet_house_visit', { p_owner: ownerId });
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) return null;
  return data as Record<string, unknown>;
}

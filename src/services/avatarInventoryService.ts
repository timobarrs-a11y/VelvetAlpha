import { supabase } from '../shared/supabase/client';
import { howToGet, parseItemId, type ItemId } from '../data/avatarCatalog';

// What this person owns for their avatar (see src/data/avatarCatalog.ts).
// Read straight from avatar_inventory; items only ever arrive through the
// database's own functions, never a plain insert from here.

const CHANGED = 'velvet:avatar-inventory-changed';

export async function getOwnedAvatarItems(userId: string): Promise<ItemId[]> {
  const { data, error } = await supabase.from('avatar_inventory').select('item_id').eq('user_id', userId);
  // Before the table exists, or offline: nothing owned, nothing breaks.
  if (error || !data) return [];
  return data.map(r => r.item_id as string).filter(id => parseItemId(id)) as ItemId[];
}

// Something bought in the Velvet Sims shop. Only shop items are accepted.
export async function recordSimsPurchase(id: string): Promise<boolean> {
  if (!parseItemId(id) || howToGet(id as ItemId).how !== 'sims') return false;
  const { error } = await supabase.rpc('record_sims_avatar_unlock', { p_item_id: id });
  if (error) {
    console.warn('[avatar inventory] could not record purchase', id, error);
    return false;
  }
  window.dispatchEvent(new CustomEvent(CHANGED));
  return true;
}

export function onAvatarInventoryChanged(cb: () => void): () => void {
  window.addEventListener(CHANGED, cb);
  return () => window.removeEventListener(CHANGED, cb);
}

import { supabase } from '../shared/supabase/client';

/** Unread companion/coach messages per companion id (only ids with unread > 0). */
export async function getCompanionUnreadCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc('get_companion_unread_counts');
  if (error || !Array.isArray(data)) return {};
  const counts: Record<string, number> = {};
  for (const row of data as Array<{ companion_id: string; unread: number }>) {
    if (row.unread > 0) counts[row.companion_id] = row.unread;
  }
  return counts;
}

/** The user has seen everything from this companion so far (dock window or chat screen). */
export async function markCompanionRead(companionId: string): Promise<void> {
  await supabase
    .from('companions')
    .update({ last_read_at: new Date().toISOString() })
    .eq('id', companionId);
}

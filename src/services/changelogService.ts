import { supabase } from '../shared/supabase/client';
import type { ChangelogEntry, ChangelogEntryWithRead } from '../types/changelog';

export async function fetchChangelog(): Promise<ChangelogEntryWithRead[]> {
  const { data: entries, error } = await supabase
    .from('changelog_entries')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('published_at', { ascending: false });

  if (error || !entries) return [];

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;

  if (!userId) {
    return entries.map((e: ChangelogEntry) => ({ ...e, is_read: false }));
  }

  const { data: readRows } = await supabase
    .from('changelog_read_status')
    .select('entry_id')
    .eq('user_id', userId);

  const readIds = new Set((readRows ?? []).map((r) => r.entry_id));

  return entries.map((e: ChangelogEntry) => ({
    ...e,
    is_read: readIds.has(e.id),
  }));
}

export async function markEntryRead(entryId: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;

  await supabase
    .from('changelog_read_status')
    .upsert(
      { user_id: userData.user.id, entry_id: entryId },
      { onConflict: 'user_id,entry_id' }
    );
}

export async function fetchEntriesByTag(tag: string): Promise<ChangelogEntry[]> {
  const { data, error } = await supabase
    .from('changelog_entries')
    .select('*')
    .contains('tags', [tag])
    .order('published_at', { ascending: false });

  if (error || !data) return [];
  return data;
}

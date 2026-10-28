import { supabase } from '../shared/supabase/client';

export interface GoalNote {
  id: string;
  goal_id: string | null;
  companion_id: string | null;
  commitment_id: string | null;
  title: string;
  summary: string;
  key_points: string[];
  next_step: string | null;
  pinned: boolean;
  created_at: string;
}

const COLUMNS = 'id, goal_id, companion_id, commitment_id, title, summary, key_points, next_step, pinned, created_at';

/** Newest first, pinned ones on top. */
export function sortNotes(notes: GoalNote[]): GoalNote[] {
  return [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at));
}

export async function listGoalNotes(): Promise<GoalNote[]> {
  const { data, error } = await supabase.from('goal_notes').select(COLUMNS).order('created_at', { ascending: false }).limit(500);
  if (error) throw error;
  return sortNotes((data ?? []) as GoalNote[]);
}

export async function setNotePinned(id: string, pinned: boolean): Promise<void> {
  const { error } = await supabase.from('goal_notes').update({ pinned }).eq('id', id);
  if (error) throw error;
}

export async function deleteGoalNote(id: string): Promise<void> {
  const { error } = await supabase.from('goal_notes').delete().eq('id', id);
  if (error) throw error;
}

/** How many notes each task has, for the chip on the task. */
export async function noteCountsByTask(): Promise<Record<string, number>> {
  const { data } = await supabase.from('goal_notes').select('commitment_id').not('commitment_id', 'is', null);
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as Array<{ commitment_id: string }>) counts[row.commitment_id] = (counts[row.commitment_id] ?? 0) + 1;
  return counts;
}

/** A note as plain text, to copy out. */
export function noteAsText(note: Pick<GoalNote, 'title' | 'summary' | 'key_points' | 'next_step'>): string {
  const plain = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');
  const lines = [note.title, '', plain(note.summary)];
  if (note.key_points.length) lines.push('', ...note.key_points.map(p => `- ${plain(p)}`));
  if (note.next_step) lines.push('', `Next: ${plain(note.next_step)}`);
  return lines.join('\n');
}

/** The question that takes a note back to the coach that gave it. */
export function followUpPrompt(note: Pick<GoalNote, 'title' | 'next_step'>): string {
  return `Following up on my note "${note.title}". ${note.next_step ? `The next thing to do is: ${note.next_step}. ` : ''}Walk me through it, and tell me what I should watch out for.`;
}

import { supabase } from '../shared/supabase/client';

export interface TownLetter {
  id: string;
  sender_label: string;
  subject: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

/** My letters, unread first, then newest. */
export async function getMyMail(limit = 50): Promise<TownLetter[]> {
  const { data, error } = await supabase.rpc('get_my_mail', { p_limit: limit });
  if (error) throw new Error(error.message);
  return (data ?? []) as TownLetter[];
}

/** How many letters are waiting. Returns 0 if the mail tables aren't there yet. */
export async function getUnreadMailCount(): Promise<number> {
  const { data, error } = await supabase.rpc('get_my_unread_mail_count');
  if (error) return 0;
  return typeof data === 'number' ? data : 0;
}

export async function markLetterRead(id: string): Promise<void> {
  const { error } = await supabase.rpc('mark_letter_read', { p_id: id });
  if (error) throw new Error(error.message);
}

export async function markAllMailRead(): Promise<void> {
  const { error } = await supabase.rpc('mark_all_mail_read');
  if (error) throw new Error(error.message);
}

/** Admin only. `userIds` omitted sends to everyone with a house. Returns how many letters were sent. */
export async function sendTownLetter(subject: string, body: string, userIds?: string[]): Promise<number> {
  const { data, error } = await supabase.rpc('send_town_letter', {
    p_subject: subject,
    p_body: body,
    p_user_ids: userIds && userIds.length ? userIds : null,
  });
  if (error) throw new Error(error.message);
  return typeof data === 'number' ? data : 0;
}

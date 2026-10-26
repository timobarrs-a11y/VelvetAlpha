import { supabase } from '../../shared/supabase/client';
import { isHelper } from '../../utils/relationshipType';

// "Your first week": five optional things that show what Velvet has between
// goals. Each ticks off when it's done; the card goes once all five are done or
// the week is over. Design: docs/onboarding/questionnaire-plan.md.

export interface FirstWeekProgress {
  friend: boolean;
  space: boolean;
  game: boolean;
  companion: boolean;
  people: boolean;
}

export const FIRST_WEEK_DAYS = 7;
const GAME_KEY = 'velvet.firstWeek.playedGame';
const DISMISSED_KEY = 'velvet.firstWeek.dismissed';

export function noteGamePlayed(): void {
  try { localStorage.setItem(GAME_KEY, '1'); } catch { /* storage blocked */ }
}

export function dismissFirstWeek(): void {
  try { localStorage.setItem(DISMISSED_KEY, '1'); } catch { /* storage blocked */ }
}

export function firstWeekDismissed(): boolean {
  try { return localStorage.getItem(DISMISSED_KEY) === '1'; } catch { return false; }
}

/** Whether the card still belongs on the home screen. */
export function showFirstWeek(progress: FirstWeekProgress, accountCreatedAt: string | null | undefined, now = new Date()): boolean {
  if (Object.values(progress).every(Boolean)) return false;
  if (!accountCreatedAt) return false;
  const ageDays = (now.getTime() - new Date(accountCreatedAt).getTime()) / 86_400_000;
  return ageDays >= 0 && ageDays < FIRST_WEEK_DAYS;
}

export async function getFirstWeekProgress(userId: string): Promise<FirstWeekProgress> {
  const [friends, messages, companions, people] = await Promise.all([
    supabase.from('im_friendships').select('id', { head: true, count: 'exact' })
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`).in('status', ['accepted', 'pending']),
    supabase.from('community_room_messages').select('id', { head: true, count: 'exact' })
      .eq('author_id', userId).eq('kind', 'user'),
    supabase.from('companions').select('relationship_type').eq('user_id', userId).eq('is_active', true),
    supabase.from('real_people').select('id', { head: true, count: 'exact' }).not('birthday', 'is', null),
  ]);
  let game = false;
  try { game = localStorage.getItem(GAME_KEY) === '1'; } catch { /* storage blocked */ }
  return {
    friend: (friends.count ?? 0) > 0,
    space: (messages.count ?? 0) > 0,
    game,
    companion: ((companions.data ?? []) as Array<{ relationship_type: string }>).some(c => !isHelper(c.relationship_type)),
    people: (people.count ?? 0) > 0,
  };
}

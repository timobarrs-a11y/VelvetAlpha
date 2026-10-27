import { supabase } from '../shared/supabase/client';

export type ObjectiveKey = 'visit_town' | 'post_in_space' | 'cheer_a_win' | 'complete_step' | 'play_game';

export interface ObjectiveDef {
  key: ObjectiveKey;
  label: string;
  /** What to do, in a few words. */
  hint: string;
  /** Where the objective takes you. */
  to: string;
}

/** Today's five, in the order they are shown. Each one's `to` is where you go to do it. */
export const OBJECTIVES: ObjectiveDef[] = [
  { key: 'visit_town', label: 'Visit the Town', hint: 'Take a stroll down your street', to: '/world' },
  { key: 'post_in_space', label: 'Join in a Space', hint: 'Post or comment in a Space', to: '/community' },
  { key: 'cheer_a_win', label: 'Cheer a win', hint: 'React to a neighbour\'s win in Discover', to: '/discover' },
  { key: 'complete_step', label: 'Finish a step', hint: 'Tick off a step of your plan', to: '/coaching-commitments' },
  { key: 'play_game', label: 'Play a game', hint: 'Any game counts', to: '/lobby' },
];

/** Fired after something that may have ticked an objective, so the toolbar re-checks at once. */
export const OBJECTIVES_CHANGED = 'velvet:objectives-changed';

export function notifyObjectivesChanged() {
  window.dispatchEvent(new Event(OBJECTIVES_CHANGED));
}

/** The start of the user's own day, so "today" follows their clock and not the server's. */
export function localDayStart(now = new Date()): string {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

/** The keys finished today. */
export async function getDailyObjectives(): Promise<Set<ObjectiveKey>> {
  const { data, error } = await supabase.rpc('get_daily_objectives', { p_day_start: localDayStart() });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{ key: ObjectiveKey; done: boolean }>;
  return new Set(rows.filter(r => r.done).map(r => r.key));
}

/** Visiting the Town and playing a game have no record of their own, so the app reports them. */
export async function reportActivity(key: 'visit_town' | 'play_game'): Promise<void> {
  const { error } = await supabase.rpc('report_activity', { p_key: key });
  if (error) console.warn('[objectives] report failed:', error.message);
  notifyObjectivesChanged();
}

export interface LeaderboardRow {
  rank: number;
  user_id: string;
  nickname: string;
  points: number;
  full_days: number;
  is_you: boolean;
}

export type LeaderboardPeriod = 'week' | 'all';

export async function getObjectiveLeaderboard(period: LeaderboardPeriod, limit = 50): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase.rpc('get_objective_leaderboard', { p_period: period, p_limit: limit });
  if (error) throw new Error(error.message);
  return (data ?? []) as LeaderboardRow[];
}

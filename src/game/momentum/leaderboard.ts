// Daily Climb / Endless leaderboards backed by Supabase.
import { supabase } from '../../shared/supabase/client';
import type { GhostRun } from './ghost';

export type LeaderboardMode = 'daily' | 'endless';

export interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  score: number;
  time: number;
  ghost: number[] | null;
}

/** UTC day so everyone shares the same Daily Climb. */
export const todayKey = (date = new Date()) => date.toISOString().slice(0, 10);

export const submitRun = async (
  mode: LeaderboardMode,
  period: string,
  score: number,
  time: number,
  ghost: GhostRun | null,
): Promise<void> => {
  try {
    await supabase.rpc('submit_momentum_run', {
      p_mode: mode,
      p_period: period,
      p_score: Math.round(score),
      p_time: Number(time.toFixed(2)),
      p_ghost: ghost ? ghost.path : null,
    });
  } catch (error) {
    console.error('Failed to submit Momentum run:', error);
  }
};

export const fetchLeaderboard = async (mode: LeaderboardMode, period: string, limit = 10): Promise<LeaderboardEntry[]> => {
  try {
    let query = supabase
      .from('momentum_leaderboard')
      .select('user_id, display_name, score, time, ghost')
      .eq('mode', mode)
      .eq('period', period)
      .limit(limit);
    query = mode === 'daily' ? query.order('time', { ascending: true }) : query.order('score', { ascending: false });
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as LeaderboardEntry[];
  } catch (error) {
    console.error('Failed to load Momentum leaderboard:', error);
    return [];
  }
};

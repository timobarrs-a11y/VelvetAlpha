import { supabase } from '../shared/supabase/client';

export interface ZeldaOceanSession {
  user_id: string;
  score: number;
  rupees_collected: number;
  mode: 'EXPLORE' | 'GAME';
  lives_lost: number;
  time_played: number;
  completed: boolean;
}

export interface ZeldaOceanHighScore {
  user_id: string;
  highest_score: number;
  total_rupees: number;
  games_played: number;
  games_completed: number;
  total_playtime: number;
  updated_at?: string;
}

export async function saveOceanSession(session: ZeldaOceanSession): Promise<void> {
  await supabase.from('zelda_ocean_sessions').insert(session);

  const { data: existing } = await supabase
    .from('zelda_ocean_high_scores')
    .select('*')
    .eq('user_id', session.user_id)
    .maybeSingle();

  if (existing) {
    await supabase.from('zelda_ocean_high_scores').update({
      highest_score: Math.max(existing.highest_score, session.score),
      total_rupees: existing.total_rupees + session.rupees_collected,
      games_played: existing.games_played + 1,
      games_completed: existing.games_completed + (session.completed ? 1 : 0),
      total_playtime: existing.total_playtime + session.time_played,
      updated_at: new Date().toISOString(),
    }).eq('user_id', session.user_id);
  } else {
    await supabase.from('zelda_ocean_high_scores').insert({
      user_id: session.user_id,
      highest_score: session.score,
      total_rupees: session.rupees_collected,
      games_played: 1,
      games_completed: session.completed ? 1 : 0,
      total_playtime: session.time_played,
    });
  }
}

export async function getOceanHighScore(userId: string): Promise<ZeldaOceanHighScore | null> {
  const { data } = await supabase
    .from('zelda_ocean_high_scores')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return data;
}

export async function getOceanLeaderboard(limit = 10): Promise<ZeldaOceanHighScore[]> {
  const { data } = await supabase
    .from('zelda_ocean_high_scores')
    .select('*')
    .order('highest_score', { ascending: false })
    .limit(limit);
  return data ?? [];
}

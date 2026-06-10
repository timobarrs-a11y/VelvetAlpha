import { supabase } from '../shared/supabase/client';

export interface StellarPursuitSession {
  id?: string;
  user_id: string;
  score: number;
  wave_reached: number;
  sector_reached: number;
  enemies_defeated: number;
  bosses_defeated: number;
  shots_fired: number;
  accuracy: number;
  time_played: number;
  completed: boolean;
  created_at?: string;
}

export interface StellarPursuitHighScores {
  user_id: string;
  highest_score: number;
  highest_wave: number;
  highest_sector: number;
  total_enemies_defeated: number;
  total_bosses_defeated: number;
  total_playtime: number;
  games_played: number;
  games_completed: number;
  updated_at?: string;
}

export async function saveGameSession(session: StellarPursuitSession): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('stellar_pursuit_sessions')
    .insert({
      ...session,
      user_id: user.id
    });

  await updateHighScores(user.id, session);
}

async function updateHighScores(userId: string, session: StellarPursuitSession): Promise<void> {
  const { data: existingScores } = await supabase
    .from('stellar_pursuit_high_scores')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingScores) {
    const updatedScores: Partial<StellarPursuitHighScores> = {
      highest_score: Math.max(existingScores.highest_score, session.score),
      highest_wave: Math.max(existingScores.highest_wave, session.wave_reached),
      highest_sector: Math.max(existingScores.highest_sector, session.sector_reached),
      total_enemies_defeated: existingScores.total_enemies_defeated + session.enemies_defeated,
      total_bosses_defeated: existingScores.total_bosses_defeated + session.bosses_defeated,
      total_playtime: existingScores.total_playtime + session.time_played,
      games_played: existingScores.games_played + 1,
      games_completed: existingScores.games_completed + (session.completed ? 1 : 0),
      updated_at: new Date().toISOString()
    };

    await supabase
      .from('stellar_pursuit_high_scores')
      .update(updatedScores)
      .eq('user_id', userId);
  } else {
    const newScores: StellarPursuitHighScores = {
      user_id: userId,
      highest_score: session.score,
      highest_wave: session.wave_reached,
      highest_sector: session.sector_reached,
      total_enemies_defeated: session.enemies_defeated,
      total_bosses_defeated: session.bosses_defeated,
      total_playtime: session.time_played,
      games_played: 1,
      games_completed: session.completed ? 1 : 0
    };

    await supabase
      .from('stellar_pursuit_high_scores')
      .insert(newScores);
  }
}

export async function getHighScores(userId: string): Promise<StellarPursuitHighScores | null> {
  const { data } = await supabase
    .from('stellar_pursuit_high_scores')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  return data;
}

export async function getRecentSessions(userId: string, limit: number = 10): Promise<StellarPursuitSession[]> {
  const { data } = await supabase
    .from('stellar_pursuit_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return data || [];
}

export async function getGlobalLeaderboard(limit: number = 10): Promise<StellarPursuitHighScores[]> {
  const { data } = await supabase
    .from('stellar_pursuit_high_scores')
    .select('*')
    .order('highest_score', { ascending: false })
    .limit(limit);

  return data || [];
}

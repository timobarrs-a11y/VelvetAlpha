import { supabase } from './supabase';
import type { PacmanGame, GameState } from '../types/pacman';

export async function createGame(
  userId: string,
  gameState: GameState,
  mode: 'solo' | 'vs-ai' = 'vs-ai',
  difficulty: 'easy' | 'medium' | 'hard' = 'medium'
): Promise<PacmanGame | null> {
  const { data, error } = await supabase
    .from('pacman_games')
    .insert({
      user_id: userId,
      game_state: gameState,
      game_mode: mode,
      difficulty,
      final_score_p1: 0,
      final_score_p2: 0
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create pacman game:', error);
    return null;
  }

  return data;
}

export async function updateGameState(
  gameId: string,
  gameState: GameState
): Promise<boolean> {
  const { error } = await supabase
    .from('pacman_games')
    .update({
      game_state: gameState,
      final_score_p1: gameState.player1.score,
      final_score_p2: gameState.player2?.score || 0,
      updated_at: new Date().toISOString()
    })
    .eq('id', gameId);

  if (error) {
    console.error('Failed to update game state:', error);
    return false;
  }

  return true;
}

export async function getGame(gameId: string): Promise<PacmanGame | null> {
  const { data, error } = await supabase
    .from('pacman_games')
    .select('*')
    .eq('id', gameId)
    .maybeSingle();

  if (error) {
    console.error('Failed to get game:', error);
    return null;
  }

  return data;
}

export async function getUserGames(userId: string): Promise<PacmanGame[]> {
  const { data, error } = await supabase
    .from('pacman_games')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Failed to get user games:', error);
    return [];
  }

  return data || [];
}

export async function deleteGame(gameId: string): Promise<boolean> {
  const { error } = await supabase
    .from('pacman_games')
    .delete()
    .eq('id', gameId);

  if (error) {
    console.error('Failed to delete game:', error);
    return false;
  }

  return true;
}

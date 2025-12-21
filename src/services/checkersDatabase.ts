import { supabase } from './supabase';
import type { CheckersGame, CheckersMove, BoardState, Position, Move } from '../types/checkers';
import { createInitialBoard } from './checkersGameLogic';
import type { TrashTalkPersonality } from './checkersTrashTalk';

export async function createGame(
  userId: string,
  playerColor: 'red' | 'black',
  aiPersonality: TrashTalkPersonality = 'confident'
): Promise<CheckersGame | null> {
  const boardState = createInitialBoard();

  const { data, error } = await supabase
    .from('checkers_games')
    .insert({
      user_id: userId,
      board_state: boardState,
      current_turn: 'red',
      player_color: playerColor,
      ai_color: playerColor === 'red' ? 'black' : 'red',
      game_status: 'active',
      move_count: 0,
      ai_personality: aiPersonality
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create game:', error);
    return null;
  }

  return data;
}

export async function getGame(gameId: string): Promise<CheckersGame | null> {
  const { data, error } = await supabase
    .from('checkers_games')
    .select('*')
    .eq('id', gameId)
    .maybeSingle();

  if (error) {
    console.error('Failed to get game:', error);
    return null;
  }

  return data;
}

export async function getUserGames(userId: string): Promise<CheckersGame[]> {
  const { data, error } = await supabase
    .from('checkers_games')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Failed to get user games:', error);
    return [];
  }

  return data || [];
}

export async function getActiveGame(userId: string): Promise<CheckersGame | null> {
  const { data, error } = await supabase
    .from('checkers_games')
    .select('*')
    .eq('user_id', userId)
    .eq('game_status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Failed to get active game:', error);
    return null;
  }

  return data;
}

export async function updateGame(
  gameId: string,
  updates: {
    board_state?: BoardState;
    current_turn?: 'red' | 'black';
    game_status?: 'active' | 'won' | 'lost' | 'draw';
    move_count?: number;
  }
): Promise<CheckersGame | null> {
  const { data, error } = await supabase
    .from('checkers_games')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', gameId)
    .select()
    .single();

  if (error) {
    console.error('Failed to update game:', error);
    return null;
  }

  return data;
}

export async function saveMove(
  gameId: string,
  moveNumber: number,
  player: 'red' | 'black',
  from: Position,
  to: Position,
  captures: Position[],
  becameKing: boolean,
  boardStateAfter: BoardState
): Promise<CheckersMove | null> {
  const { data, error } = await supabase
    .from('checkers_moves')
    .insert({
      game_id: gameId,
      move_number: moveNumber,
      player,
      from_position: from,
      to_position: to,
      captured_pieces: captures,
      became_king: becameKing,
      board_state_after: boardStateAfter
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to save move:', error);
    return null;
  }

  return data;
}

export async function getGameMoves(gameId: string): Promise<CheckersMove[]> {
  const { data, error } = await supabase
    .from('checkers_moves')
    .select('*')
    .eq('game_id', gameId)
    .order('move_number', { ascending: true });

  if (error) {
    console.error('Failed to get game moves:', error);
    return [];
  }

  return data || [];
}

export async function deleteGame(gameId: string): Promise<boolean> {
  const { error } = await supabase
    .from('checkers_games')
    .delete()
    .eq('id', gameId);

  if (error) {
    console.error('Failed to delete game:', error);
    return false;
  }

  return true;
}

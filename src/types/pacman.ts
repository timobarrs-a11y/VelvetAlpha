export interface PlayerState {
  score: number;
  lives: number;
  position: { x: number; y: number };
}

export interface GameState {
  player1: PlayerState;
  player2?: PlayerState;
  level: number;
  status: 'playing' | 'paused' | 'game_over' | 'won';
}

export interface PacmanGame {
  id: string;
  user_id: string;
  game_state: GameState;
  game_mode: 'solo' | 'vs-ai';
  difficulty: 'easy' | 'medium' | 'hard';
  final_score_p1: number;
  final_score_p2: number;
  created_at: string;
  updated_at: string;
}

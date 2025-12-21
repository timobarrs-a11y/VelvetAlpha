export type CellType = 'wall' | 'empty' | 'fruit' | 'power-up' | 'player1' | 'player2' | 'enemy';

export interface Position {
  row: number;
  col: number;
}

export interface Player {
  position: Position;
  score: number;
  lives: number;
  powerUpActive: boolean;
  powerUpExpiry: number;
}

export interface Enemy {
  id: string;
  position: Position;
  direction: 'up' | 'down' | 'left' | 'right';
  type: 'blinky' | 'pinky' | 'inky' | 'clyde';
}

export interface GameState {
  maze: CellType[][];
  player1: Player;
  player2: Player | null;
  enemies: Enemy[];
  fruits: Position[];
  powerUps: Position[];
  timeRemaining: number;
  gameStatus: 'waiting' | 'active' | 'paused' | 'finished';
  winner: 'player1' | 'player2' | 'tie' | null;
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

export type PieceType = 'red' | 'black' | 'red-king' | 'black-king' | null;

export type Position = {
  row: number;
  col: number;
};

export type Move = {
  from: Position;
  to: Position;
  captures: Position[];
};

export type GameStatus = 'active' | 'won' | 'lost' | 'draw';

export type BoardState = PieceType[][];

export interface CheckersGame {
  id: string;
  user_id: string;
  board_state: BoardState;
  current_turn: 'red' | 'black';
  player_color: 'red' | 'black';
  ai_color: 'red' | 'black';
  game_status: GameStatus;
  move_count: number;
  ai_personality: string;
  created_at: string;
  updated_at: string;
}

export interface CheckersMove {
  id: string;
  game_id: string;
  move_number: number;
  player: 'red' | 'black';
  from_position: Position;
  to_position: Position;
  captured_pieces: Position[];
  became_king: boolean;
  board_state_after: BoardState;
  created_at: string;
}

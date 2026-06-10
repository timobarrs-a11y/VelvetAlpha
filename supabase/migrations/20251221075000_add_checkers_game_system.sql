/*
  # Checkers Game System

  1. New Tables
    - `checkers_games`
      - `id` (uuid, primary key) - Unique game identifier
      - `user_id` (uuid, foreign key) - Player who created the game
      - `board_state` (jsonb) - Current board state as 8x8 array
      - `current_turn` (text) - Which player's turn ('red' or 'black')
      - `player_color` (text) - User's piece color
      - `ai_color` (text) - AI's piece color
      - `game_status` (text) - Status: 'active', 'won', 'lost', 'draw'
      - `move_count` (integer) - Number of moves made
      - `ai_personality` (text) - AI trash talk personality
      - `created_at` (timestamptz) - When game was created
      - `updated_at` (timestamptz) - Last update time
    
    - `checkers_moves`
      - `id` (uuid, primary key) - Unique move identifier
      - `game_id` (uuid, foreign key) - Reference to game
      - `move_number` (integer) - Sequential move number
      - `player` (text) - Who made the move ('red' or 'black')
      - `from_position` (jsonb) - Starting position {row, col}
      - `to_position` (jsonb) - Ending position {row, col}
      - `captured_pieces` (jsonb) - Array of captured piece positions
      - `became_king` (boolean) - Whether piece became king
      - `board_state_after` (jsonb) - Board state after this move
      - `created_at` (timestamptz) - When move was made

  2. Security
    - Enable RLS on both tables
    - Users can only access their own games and moves
    - Authenticated users can create and manage their games
*/

-- Create checkers_games table
CREATE TABLE IF NOT EXISTS checkers_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  board_state jsonb NOT NULL,
  current_turn text NOT NULL DEFAULT 'red',
  player_color text NOT NULL,
  ai_color text NOT NULL,
  game_status text NOT NULL DEFAULT 'active',
  move_count integer NOT NULL DEFAULT 0,
  ai_personality text DEFAULT 'confident',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create checkers_moves table
CREATE TABLE IF NOT EXISTS checkers_moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid REFERENCES checkers_games(id) ON DELETE CASCADE NOT NULL,
  move_number integer NOT NULL,
  player text NOT NULL,
  from_position jsonb NOT NULL,
  to_position jsonb NOT NULL,
  captured_pieces jsonb DEFAULT '[]'::jsonb,
  became_king boolean DEFAULT false,
  board_state_after jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_checkers_games_user_id ON checkers_games(user_id);
CREATE INDEX IF NOT EXISTS idx_checkers_games_status ON checkers_games(game_status);
CREATE INDEX IF NOT EXISTS idx_checkers_moves_game_id ON checkers_moves(game_id);

-- Enable RLS
ALTER TABLE checkers_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkers_moves ENABLE ROW LEVEL SECURITY;

-- RLS Policies for checkers_games
CREATE POLICY "Users can view own games"
  ON checkers_games FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own games"
  ON checkers_games FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own games"
  ON checkers_games FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own games"
  ON checkers_games FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for checkers_moves
CREATE POLICY "Users can view moves from own games"
  ON checkers_moves FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM checkers_games
      WHERE checkers_games.id = checkers_moves.game_id
      AND checkers_games.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create moves for own games"
  ON checkers_moves FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM checkers_games
      WHERE checkers_games.id = checkers_moves.game_id
      AND checkers_games.user_id = auth.uid()
    )
  );

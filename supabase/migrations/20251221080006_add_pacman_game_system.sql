/*
  # Pac-Man Style Competitive Game System

  1. New Tables
    - `pacman_games`
      - `id` (uuid, primary key) - Unique game identifier
      - `user_id` (uuid, foreign key) - Player who created the game
      - `game_state` (jsonb) - Complete game state including maze, players, enemies
      - `game_mode` (text) - Game mode: 'solo' or 'vs-ai'
      - `difficulty` (text) - Difficulty level: 'easy', 'medium', 'hard'
      - `final_score_p1` (integer) - Player 1 final score
      - `final_score_p2` (integer) - Player 2/AI final score
      - `created_at` (timestamptz) - When game was created
      - `updated_at` (timestamptz) - Last update time

  2. Security
    - Enable RLS on pacman_games table
    - Users can only access their own games
    - Authenticated users can create and manage their games

  3. Notes
    - Game state stored as JSONB for flexibility
    - Supports both solo mode and AI opponent
    - Time-limited competitive gameplay
    - Tracks high scores
*/

-- Create pacman_games table
CREATE TABLE IF NOT EXISTS pacman_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  game_state jsonb NOT NULL,
  game_mode text NOT NULL DEFAULT 'vs-ai',
  difficulty text NOT NULL DEFAULT 'medium',
  final_score_p1 integer DEFAULT 0,
  final_score_p2 integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_pacman_games_user_id ON pacman_games(user_id);
CREATE INDEX IF NOT EXISTS idx_pacman_games_created_at ON pacman_games(created_at DESC);

-- Enable RLS
ALTER TABLE pacman_games ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pacman_games
CREATE POLICY "Users can view own games"
  ON pacman_games FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own games"
  ON pacman_games FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own games"
  ON pacman_games FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own games"
  ON pacman_games FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

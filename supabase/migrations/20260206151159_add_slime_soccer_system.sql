/*
  # Add Slime Soccer Game System

  1. New Tables
    - `slime_soccer_matches`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `game_mode` (text) - 'single' or 'multi'
      - `player_score` (integer) - left/cyan player score
      - `opponent_score` (integer) - right/red player score
      - `result` (text) - 'win', 'loss', or 'tie'
      - `duration_seconds` (integer) - match duration
      - `power_ups_collected` (integer) - total power-ups grabbed
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `slime_soccer_matches`
    - Add policies for authenticated users to insert and read their own data
*/

CREATE TABLE IF NOT EXISTS slime_soccer_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  game_mode text NOT NULL DEFAULT 'single',
  player_score integer NOT NULL DEFAULT 0,
  opponent_score integer NOT NULL DEFAULT 0,
  result text NOT NULL DEFAULT 'tie',
  duration_seconds integer NOT NULL DEFAULT 0,
  power_ups_collected integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE slime_soccer_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own slime soccer matches"
  ON slime_soccer_matches
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own slime soccer matches"
  ON slime_soccer_matches
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_slime_soccer_matches_user_id ON slime_soccer_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_slime_soccer_matches_created_at ON slime_soccer_matches(created_at DESC);

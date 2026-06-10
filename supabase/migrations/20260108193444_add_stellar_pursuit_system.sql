/*
  # Stellar Pursuit Game System

  1. New Tables
    - `stellar_pursuit_sessions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `score` (integer)
      - `wave_reached` (integer)
      - `sector_reached` (integer)
      - `enemies_defeated` (integer)
      - `bosses_defeated` (integer)
      - `shots_fired` (integer)
      - `accuracy` (float)
      - `time_played` (integer, in seconds)
      - `completed` (boolean)
      - `created_at` (timestamptz)

    - `stellar_pursuit_high_scores`
      - `user_id` (uuid, primary key, references auth.users)
      - `highest_score` (integer)
      - `highest_wave` (integer)
      - `highest_sector` (integer)
      - `total_enemies_defeated` (integer)
      - `total_bosses_defeated` (integer)
      - `total_playtime` (integer)
      - `games_played` (integer)
      - `games_completed` (integer)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Users can only read/write their own game data
*/

-- Create stellar_pursuit_sessions table
CREATE TABLE IF NOT EXISTS stellar_pursuit_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  score integer NOT NULL DEFAULT 0,
  wave_reached integer NOT NULL DEFAULT 1,
  sector_reached integer NOT NULL DEFAULT 1,
  enemies_defeated integer NOT NULL DEFAULT 0,
  bosses_defeated integer NOT NULL DEFAULT 0,
  shots_fired integer NOT NULL DEFAULT 0,
  accuracy float NOT NULL DEFAULT 0,
  time_played integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE stellar_pursuit_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stellar_pursuit_sessions
CREATE POLICY "Users can view own stellar pursuit sessions"
  ON stellar_pursuit_sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stellar pursuit sessions"
  ON stellar_pursuit_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stellar pursuit sessions"
  ON stellar_pursuit_sessions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create stellar_pursuit_high_scores table
CREATE TABLE IF NOT EXISTS stellar_pursuit_high_scores (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  highest_score integer NOT NULL DEFAULT 0,
  highest_wave integer NOT NULL DEFAULT 1,
  highest_sector integer NOT NULL DEFAULT 1,
  total_enemies_defeated integer NOT NULL DEFAULT 0,
  total_bosses_defeated integer NOT NULL DEFAULT 0,
  total_playtime integer NOT NULL DEFAULT 0,
  games_played integer NOT NULL DEFAULT 0,
  games_completed integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE stellar_pursuit_high_scores ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stellar_pursuit_high_scores
CREATE POLICY "Users can view own stellar pursuit high scores"
  ON stellar_pursuit_high_scores
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stellar pursuit high scores"
  ON stellar_pursuit_high_scores
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stellar pursuit high scores"
  ON stellar_pursuit_high_scores
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_stellar_pursuit_sessions_user_id
  ON stellar_pursuit_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_stellar_pursuit_sessions_created_at
  ON stellar_pursuit_sessions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stellar_pursuit_sessions_score
  ON stellar_pursuit_sessions(score DESC);

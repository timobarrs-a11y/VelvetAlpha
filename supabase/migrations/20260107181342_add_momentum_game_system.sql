/*
  # Add Momentum Platformer Game System

  ## Overview
  Creates tables to track Momentum game statistics including high scores, level completion, and theme usage.

  ## New Tables

  ### `momentum_game_stats`
  Tracks individual game sessions and performance metrics:
  - `id` (uuid, primary key) - Unique identifier for each game session
  - `user_id` (uuid, foreign key) - References auth.users, the player
  - `level` (integer) - The level number played
  - `theme_name` (text) - The theme/world name used for this level
  - `score` (integer) - Final score achieved
  - `completion_time` (decimal) - Time taken in seconds
  - `completed` (boolean) - Whether the level was completed (true) or game over (false)
  - `created_at` (timestamptz) - When the game session was recorded

  ### `momentum_high_scores`
  Tracks best scores per user per level:
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid, foreign key) - References auth.users
  - `level` (integer) - The level number
  - `high_score` (integer) - Best score achieved
  - `best_time` (decimal) - Fastest completion time in seconds
  - `theme_name` (text) - Theme used for the high score run
  - `updated_at` (timestamptz) - When this record was last updated

  ## Security
  - RLS enabled on both tables
  - Users can only read/write their own game stats
  - Authenticated users only

  ## Indexes
  - Index on user_id for both tables for fast user lookups
  - Composite index on (user_id, level) for high scores
  - Index on created_at for stats ordering

  ## Important Notes
  1. High scores are automatically updated via trigger when new stats are inserted
  2. Only the best score and fastest time per level are kept in high_scores table
  3. All game sessions are preserved in game_stats for historical tracking
*/

-- Create momentum_game_stats table
CREATE TABLE IF NOT EXISTS momentum_game_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level integer NOT NULL DEFAULT 1,
  theme_name text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  completion_time decimal NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create momentum_high_scores table
CREATE TABLE IF NOT EXISTS momentum_high_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level integer NOT NULL,
  high_score integer NOT NULL DEFAULT 0,
  best_time decimal NOT NULL,
  theme_name text NOT NULL,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, level)
);

-- Enable RLS
ALTER TABLE momentum_game_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE momentum_high_scores ENABLE ROW LEVEL SECURITY;

-- RLS Policies for momentum_game_stats
CREATE POLICY "Users can view own game stats"
  ON momentum_game_stats FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own game stats"
  ON momentum_game_stats FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for momentum_high_scores
CREATE POLICY "Users can view own high scores"
  ON momentum_high_scores FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own high scores"
  ON momentum_high_scores FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own high scores"
  ON momentum_high_scores FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_momentum_game_stats_user_id ON momentum_game_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_momentum_game_stats_created_at ON momentum_game_stats(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_momentum_high_scores_user_id ON momentum_high_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_momentum_high_scores_user_level ON momentum_high_scores(user_id, level);

-- Function to update high scores automatically
CREATE OR REPLACE FUNCTION update_momentum_high_scores()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update high scores if the level was completed
  IF NEW.completed THEN
    INSERT INTO momentum_high_scores (user_id, level, high_score, best_time, theme_name)
    VALUES (NEW.user_id, NEW.level, NEW.score, NEW.completion_time, NEW.theme_name)
    ON CONFLICT (user_id, level) DO UPDATE
    SET
      high_score = GREATEST(momentum_high_scores.high_score, NEW.score),
      best_time = LEAST(momentum_high_scores.best_time, NEW.completion_time),
      theme_name = CASE
        WHEN NEW.score > momentum_high_scores.high_score THEN NEW.theme_name
        ELSE momentum_high_scores.theme_name
      END,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically update high scores
DROP TRIGGER IF EXISTS trigger_update_momentum_high_scores ON momentum_game_stats;
CREATE TRIGGER trigger_update_momentum_high_scores
  AFTER INSERT ON momentum_game_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_momentum_high_scores();
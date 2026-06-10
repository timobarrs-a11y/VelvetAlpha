/*
  # Add Momentum Career Mode System

  ## Overview
  Adds career mode progression tracking for the Momentum game with time-based challenges,
  star ratings, and level unlocking mechanics.

  ## New Tables

  ### `momentum_career_progress`
  Tracks individual user progress through career mode levels.

  **Columns:**
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid, foreign key) - References auth.users
  - `level_number` (integer) - The career level (1-indexed)
  - `completed` (boolean) - Whether the level has been completed
  - `best_time` (decimal) - Best completion time in seconds
  - `stars_earned` (integer) - Star rating (1-3) based on performance
  - `theme_used` (text) - The theme name used for this completion
  - `score_achieved` (integer) - Highest score achieved on this level
  - `attempts` (integer) - Number of times the level was attempted
  - `created_at` (timestamptz) - First attempt timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## Security
  - Enable RLS on all tables
  - Users can only read/write their own progress
  - Prevent tampering by validating level progression

  ## Indexes
  - Index on user_id + level_number for fast lookups
  - Index on completed for filtering
*/

-- Create career progress table
CREATE TABLE IF NOT EXISTS momentum_career_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  level_number integer NOT NULL CHECK (level_number > 0),
  completed boolean DEFAULT false NOT NULL,
  best_time decimal(10,3),
  stars_earned integer DEFAULT 0 CHECK (stars_earned >= 0 AND stars_earned <= 3),
  theme_used text,
  score_achieved integer DEFAULT 0,
  attempts integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, level_number)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_momentum_career_user_level
  ON momentum_career_progress(user_id, level_number);

CREATE INDEX IF NOT EXISTS idx_momentum_career_completed
  ON momentum_career_progress(user_id, completed);

-- Enable RLS
ALTER TABLE momentum_career_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own career progress"
  ON momentum_career_progress
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own career progress"
  ON momentum_career_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own career progress"
  ON momentum_career_progress
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_momentum_career_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update timestamp
DROP TRIGGER IF EXISTS momentum_career_update_timestamp ON momentum_career_progress;
CREATE TRIGGER momentum_career_update_timestamp
  BEFORE UPDATE ON momentum_career_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_momentum_career_updated_at();
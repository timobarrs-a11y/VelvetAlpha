/*
  # Add Noir Shooter Score Tracking System

  1. New Tables
    - `noir_shooter_scores`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `score` (integer) - Final score
      - `kills` (integer) - Number of enemies killed
      - `total_enemies` (integer) - Total enemies in level
      - `accuracy_pct` (integer) - Shooting accuracy percentage
      - `bullet_time_used` (integer) - Seconds of bullet time used
      - `completion_time` (integer) - Seconds to complete
      - `grade` (text) - Letter grade (S, A, B, C)
      - `created_at` (timestamptz)
      
  2. Security
    - Enable RLS on `noir_shooter_scores` table
    - Add policies for authenticated users to:
      - Insert their own scores
      - Read all scores (for leaderboards)
      
  3. Indexes
    - Add index on user_id for faster lookups
    - Add index on score for leaderboard queries
*/

-- Create noir shooter scores table
CREATE TABLE IF NOT EXISTS noir_shooter_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  score integer DEFAULT 0 NOT NULL,
  kills integer DEFAULT 0 NOT NULL,
  total_enemies integer DEFAULT 0 NOT NULL,
  accuracy_pct integer DEFAULT 0 NOT NULL,
  bullet_time_used integer DEFAULT 0 NOT NULL,
  completion_time integer DEFAULT 0 NOT NULL,
  grade text DEFAULT 'C' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE noir_shooter_scores ENABLE ROW LEVEL SECURITY;

-- Users can insert their own scores
CREATE POLICY "Users can insert own scores"
  ON noir_shooter_scores
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Everyone can read all scores (for leaderboards)
CREATE POLICY "Anyone can view all scores"
  ON noir_shooter_scores
  FOR SELECT
  TO authenticated
  USING (true);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_noir_shooter_scores_user_id 
  ON noir_shooter_scores(user_id);
  
CREATE INDEX IF NOT EXISTS idx_noir_shooter_scores_score 
  ON noir_shooter_scores(score DESC);

CREATE INDEX IF NOT EXISTS idx_noir_shooter_scores_created_at 
  ON noir_shooter_scores(created_at DESC);

/*
  # Add Platformer Game System (Luna's Run)

  1. New Tables
    - `platformer_sessions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `score` (integer) - total score for the session
      - `level_reached` (integer) - highest level reached
      - `berries_collected` (integer) - total berries collected
      - `enemies_stomped` (integer) - total enemies defeated
      - `deaths` (integer) - number of deaths
      - `completed` (boolean) - whether all levels were completed
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `platformer_sessions`
    - Add policy for authenticated users to insert their own sessions
    - Add policy for authenticated users to view their own sessions
*/

CREATE TABLE IF NOT EXISTS platformer_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  score integer NOT NULL DEFAULT 0,
  level_reached integer NOT NULL DEFAULT 1,
  berries_collected integer NOT NULL DEFAULT 0,
  enemies_stomped integer NOT NULL DEFAULT 0,
  deaths integer NOT NULL DEFAULT 0,
  completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE platformer_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own platformer sessions"
  ON platformer_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own platformer sessions"
  ON platformer_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

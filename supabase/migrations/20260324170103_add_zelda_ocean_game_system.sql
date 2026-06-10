/*
  # Wind Waker Ocean Game System

  1. New Tables
    - `zelda_ocean_sessions`: Individual play sessions per user
      - score, rupees_collected, lives_lost, time_played, mode (EXPLORE/GAME)
    - `zelda_ocean_high_scores`: Lifetime aggregate stats per user
      - highest_score, total_rupees, games_played, best_time

  2. Security
    - RLS enabled on both tables
    - Users can only read/write their own data

  3. Indexes
    - user_id indexes for fast user-specific queries
    - score index for leaderboard queries
*/

CREATE TABLE IF NOT EXISTS zelda_ocean_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  score            integer NOT NULL DEFAULT 0,
  rupees_collected integer NOT NULL DEFAULT 0,
  mode             text NOT NULL DEFAULT 'GAME',
  lives_lost       integer NOT NULL DEFAULT 0,
  time_played      integer NOT NULL DEFAULT 0,
  completed        boolean NOT NULL DEFAULT false,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE zelda_ocean_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own ocean sessions"
  ON zelda_ocean_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own ocean sessions"
  ON zelda_ocean_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS zelda_ocean_high_scores (
  user_id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  highest_score   integer NOT NULL DEFAULT 0,
  total_rupees    integer NOT NULL DEFAULT 0,
  games_played    integer NOT NULL DEFAULT 0,
  games_completed integer NOT NULL DEFAULT 0,
  total_playtime  integer NOT NULL DEFAULT 0,
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE zelda_ocean_high_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ocean high scores"
  ON zelda_ocean_high_scores FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ocean high scores"
  ON zelda_ocean_high_scores FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ocean high scores"
  ON zelda_ocean_high_scores FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_zelda_ocean_sessions_user_id
  ON zelda_ocean_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_zelda_ocean_sessions_score
  ON zelda_ocean_sessions(score DESC);

CREATE INDEX IF NOT EXISTS idx_zelda_ocean_high_scores_score
  ON zelda_ocean_high_scores(highest_score DESC);

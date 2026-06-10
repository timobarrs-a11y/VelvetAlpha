/*
  # Daily Check-in & Customization Unlock System

  ## Overview
  Tracks user daily sign-ins to build streaks, and stores
  unlocked + active customization preferences (pointer symbol,
  lobby tile colors).

  ## New Tables

  ### user_daily_checkins
  - Records one row per user per UTC day
  - Used to compute current streak and lifetime days

  ### user_customization
  - One row per user, stores:
    - active_pointer: which cursor symbol is active
    - unlocked_pointers: array of earned pointer keys
    - tile_colors: jsonb map of tile-id → color key
    - current_streak: convenience cache updated on each check-in
    - longest_streak: all-time record
    - total_checkins: lifetime count

  ## Security
  - RLS enabled on both tables
  - Users can only read/write their own rows
*/

CREATE TABLE IF NOT EXISTS user_daily_checkins (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checkin_date date       NOT NULL DEFAULT CURRENT_DATE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, checkin_date)
);

ALTER TABLE user_daily_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own checkins"
  ON user_daily_checkins FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own checkins"
  ON user_daily_checkins FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS user_customization (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  active_pointer   text        NOT NULL DEFAULT 'star',
  unlocked_pointers text[]     NOT NULL DEFAULT ARRAY['star'],
  tile_colors      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  current_streak   int         NOT NULL DEFAULT 0,
  longest_streak   int         NOT NULL DEFAULT 0,
  total_checkins   int         NOT NULL DEFAULT 0,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_customization ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own customization"
  ON user_customization FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own customization"
  ON user_customization FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own customization"
  ON user_customization FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_date ON user_daily_checkins(user_id, checkin_date DESC);
CREATE INDEX IF NOT EXISTS idx_customization_user ON user_customization(user_id);

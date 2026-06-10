/*
  # Add User Daily Schedule Table

  ## Purpose
  Stores a lightweight work/life schedule profile for each user.
  Used to personalize the Morning Brief with real daily context
  (work hours, school pickup, commute, appointments).

  ## New Tables
  - `user_daily_schedule`
    - `user_id` (uuid, PK, FK → auth.users)
    - `work_type` (text) — 'office' | 'remote' | 'hybrid' | 'shift' | 'freelance' | 'student' | 'none'
    - `work_start_hour` (int, nullable) — 0–23, hour of day work starts
    - `work_end_hour` (int, nullable) — 0–23, hour of day work ends
    - `has_morning_commute` (boolean)
    - `has_evening_commute` (boolean)
    - `has_school_pickup` (boolean)
    - `school_pickup_time` (text, nullable) — 'morning' | 'afternoon' | 'both'
    - `has_recurring_appointments` (boolean)
    - `appointment_notes` (text, nullable) — brief freeform context
    - `extra_context` (text, nullable) — anything else the user wants the brief to know
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - Users can only read/write their own row
*/

CREATE TABLE IF NOT EXISTS user_daily_schedule (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  work_type text NOT NULL DEFAULT 'none',
  work_start_hour int,
  work_end_hour int,
  has_morning_commute boolean NOT NULL DEFAULT false,
  has_evening_commute boolean NOT NULL DEFAULT false,
  has_school_pickup boolean NOT NULL DEFAULT false,
  school_pickup_time text,
  has_recurring_appointments boolean NOT NULL DEFAULT false,
  appointment_notes text,
  extra_context text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_daily_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own schedule"
  ON user_daily_schedule FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own schedule"
  ON user_daily_schedule FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own schedule"
  ON user_daily_schedule FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

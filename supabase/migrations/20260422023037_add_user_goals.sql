/*
  # Add User Goals Table

  ## Purpose
  Stores personal goals for each user that integrate into the morning brief.
  Goals are conversational — progress is updated naturally through chat with Navi.

  ## New Tables
  - `user_goals`
    - `id` (uuid, PK)
    - `user_id` (uuid, FK → auth.users)
    - `title` (text) — e.g. "Lose 20 lbs", "Finish reading Dune", "No sweets for 30 days"
    - `goal_type` (text) — health_fitness | reading | creative | habit | deadline
    - `target_value` (numeric, nullable) — e.g. 20 (lbs), 688 (pages)
    - `current_value` (numeric, nullable) — current tracked progress
    - `unit` (text, nullable) — "lbs", "pages", "days", "miles", etc.
    - `start_date` (date) — when the goal was set
    - `target_date` (date, nullable) — optional deadline
    - `status` (text) — active | completed | paused | abandoned
    - `notes` (text, nullable) — any additional context
    - `created_at` / `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - Users can only read/write/delete their own goals
*/

CREATE TABLE IF NOT EXISTS user_goals (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title          text NOT NULL,
  goal_type      text NOT NULL DEFAULT 'habit',
  target_value   numeric,
  current_value  numeric,
  unit           text,
  start_date     date NOT NULL DEFAULT CURRENT_DATE,
  target_date    date,
  status         text NOT NULL DEFAULT 'active',
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT valid_goal_type CHECK (goal_type IN (
    'health_fitness', 'reading', 'creative', 'habit', 'deadline'
  )),
  CONSTRAINT valid_goal_status CHECK (status IN (
    'active', 'completed', 'paused', 'abandoned'
  ))
);

ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own goals"
  ON user_goals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goals"
  ON user_goals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals"
  ON user_goals FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals"
  ON user_goals FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_goals_user_status
  ON user_goals(user_id, status);

CREATE INDEX IF NOT EXISTS idx_user_goals_target_date
  ON user_goals(target_date)
  WHERE target_date IS NOT NULL;

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_user_goals_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'user_goals_updated_at'
    AND event_object_table = 'user_goals'
  ) THEN
    CREATE TRIGGER user_goals_updated_at
      BEFORE UPDATE ON user_goals
      FOR EACH ROW EXECUTE FUNCTION update_user_goals_updated_at();
  END IF;
END $$;

/*
  # Add Onboarding Progress System

  ## Purpose
  Tracks each user's living onboarding state so the Atlas-guided tutorial can:
  - Resume after page refresh or re-entry
  - Know which features have been spotlighted
  - Capture companion personality snapshot at tutorial start
  - Record conversation history for context continuity

  ## New Tables

  ### user_onboarding_progress
  - `id` (uuid, pk)
  - `user_id` (uuid, fk → auth.users) — one row per user
  - `companion_id` (uuid) — companion that was just created
  - `companion_name` (text) — denormalized for quick use
  - `companion_personality_snapshot` (jsonb) — questionnaire answers at creation time
  - `steps_completed` (text[]) — ordered list of step IDs that have been finished
  - `current_step` (text) — the step Atlas is currently guiding through
  - `onboarding_complete` (bool) — whether the full intro tour is done
  - `tutorial_conversation` (jsonb[]) — Atlas ↔ user exchange during onboarding
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - Users can only read/write their own row
*/

CREATE TABLE IF NOT EXISTS user_onboarding_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id uuid,
  companion_name text DEFAULT '',
  companion_personality_snapshot jsonb DEFAULT '{}',
  steps_completed text[] DEFAULT '{}',
  current_step text DEFAULT 'intro',
  onboarding_complete boolean DEFAULT false,
  tutorial_conversation jsonb[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT user_onboarding_progress_user_id_key UNIQUE (user_id)
);

ALTER TABLE user_onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own onboarding progress"
  ON user_onboarding_progress FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own onboarding progress"
  ON user_onboarding_progress FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own onboarding progress"
  ON user_onboarding_progress FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_onboarding_progress_user_id
  ON user_onboarding_progress (user_id);

CREATE OR REPLACE FUNCTION update_onboarding_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_onboarding_updated_at ON user_onboarding_progress;
CREATE TRIGGER set_onboarding_updated_at
  BEFORE UPDATE ON user_onboarding_progress
  FOR EACH ROW EXECUTE FUNCTION update_onboarding_updated_at();

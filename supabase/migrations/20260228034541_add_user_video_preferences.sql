/*
  # Add user video preferences table

  ## Purpose
  Stores per-user custom interest tags for the "For You" video feed in Your Lens.
  Users can add custom topics on top of what was collected in the questionnaire,
  and disable individual questionnaire-sourced interests from appearing in the feed.

  ## New Tables
  - `user_video_preferences`
    - `id` (uuid, pk)
    - `user_id` (uuid, fk → auth.users)
    - `custom_tags` (text[]) – manually added interests e.g. "jazz", "rock climbing"
    - `disabled_tags` (text[]) – tags from questionnaire the user has muted
    - `created_at`, `updated_at`

  ## Security
  - RLS enabled
  - Users can only read/write their own row
*/

CREATE TABLE IF NOT EXISTS user_video_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  custom_tags text[] NOT NULL DEFAULT '{}',
  disabled_tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE user_video_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own video preferences"
  ON user_video_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own video preferences"
  ON user_video_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own video preferences"
  ON user_video_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

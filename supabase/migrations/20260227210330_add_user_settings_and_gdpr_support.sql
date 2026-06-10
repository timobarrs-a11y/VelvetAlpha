/*
  # Add User Settings and GDPR Support

  ## Summary
  Adds a `user_settings` table to persist per-user preferences (notifications,
  privacy, appearance), and adds a `deletion_requested_at` column to
  `user_profiles` to support GDPR account deletion requests.

  ## New Tables
  - `user_settings` — Stores per-user notification, privacy, and appearance preferences.

  ## Modified Tables
  - `user_profiles` — Adds `deletion_requested_at` timestamptz column.

  ## Security
  - RLS enabled on `user_settings`
  - Users can only read and write their own settings row
*/

CREATE TABLE IF NOT EXISTS user_settings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  notification_settings  jsonb DEFAULT '{
    "push_enabled": true,
    "email_digest": false,
    "companion_messages": true,
    "calendar_reminders": true,
    "daily_checkin": true,
    "system_updates": true
  }'::jsonb,
  privacy_settings       jsonb DEFAULT '{
    "activity_tracking": true,
    "analytics_sharing": true,
    "personalization": true
  }'::jsonb,
  theme_mode    text DEFAULT 'dark' CHECK (theme_mode IN ('dark', 'light', 'system')),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  CONSTRAINT user_settings_user_id_unique UNIQUE (user_id)
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'deletion_requested_at'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN deletion_requested_at timestamptz DEFAULT NULL;
  END IF;
END $$;

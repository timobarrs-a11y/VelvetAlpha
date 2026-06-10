/*
  # Add Local Explorer System

  ## Overview
  Adds tables and columns to support the Local Explorer feature — a location-aware
  AI chat that surfaces local news, events, food, and activities based on the user's
  geographic location.

  ## Changes

  ### Modified Tables
  - `user_profiles`
    - `location_city` (text): Human-readable city/region name (e.g. "Denver, CO")
    - `location_lat` (float8): Latitude from browser geolocation
    - `location_lng` (float8): Longitude from browser geolocation
    - `location_radius_minutes` (int4): Drive-time radius preference, default 30 minutes

  ### New Tables
  1. `local_explorer_conversations`
     - `id` (uuid, PK)
     - `user_id` (uuid, FK to auth.users)
     - `title` (text): Auto-generated short title for the conversation
     - `location_snapshot` (text): City name at time of conversation (preserved even if user later changes location)
     - `created_at`, `updated_at`

  2. `local_explorer_messages`
     - `id` (uuid, PK)
     - `conversation_id` (uuid, FK to local_explorer_conversations)
     - `user_id` (uuid, FK to auth.users)
     - `role` (text): 'user' or 'assistant'
     - `content` (text): Raw message text
     - `structured_results` (jsonb): Array of parsed event/place/news card objects
     - `created_at`

  ## Security
  - RLS enabled on both new tables
  - Users can only read/write their own data
  - location fields are user-owned and only visible to the owning user
*/

-- Add location columns to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'location_city'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN location_city text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'location_lat'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN location_lat float8;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'location_lng'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN location_lng float8;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'location_radius_minutes'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN location_radius_minutes int4 DEFAULT 30;
  END IF;
END $$;

-- Create local_explorer_conversations table
CREATE TABLE IF NOT EXISTS local_explorer_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Local Explorer',
  location_snapshot text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE local_explorer_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own local explorer conversations"
  ON local_explorer_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own local explorer conversations"
  ON local_explorer_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own local explorer conversations"
  ON local_explorer_conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own local explorer conversations"
  ON local_explorer_conversations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create local_explorer_messages table
CREATE TABLE IF NOT EXISTS local_explorer_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES local_explorer_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL DEFAULT '',
  structured_results jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE local_explorer_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own local explorer messages"
  ON local_explorer_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own local explorer messages"
  ON local_explorer_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS local_explorer_conversations_user_id_idx
  ON local_explorer_conversations(user_id);

CREATE INDEX IF NOT EXISTS local_explorer_conversations_updated_at_idx
  ON local_explorer_conversations(updated_at DESC);

CREATE INDEX IF NOT EXISTS local_explorer_messages_conversation_id_idx
  ON local_explorer_messages(conversation_id);

CREATE INDEX IF NOT EXISTS local_explorer_messages_user_id_idx
  ON local_explorer_messages(user_id);

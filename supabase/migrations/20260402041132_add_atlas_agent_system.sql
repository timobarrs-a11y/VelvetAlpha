/*
  # Atlas AI Agent System

  ## Overview
  Adds the Atlas utility AI agent feature — a clean, no-persona productivity assistant
  independent from the companion experience.

  ## New Tables

  ### atlas_conversations
  - Top-level container for a user's Atlas chat thread
  - id: uuid primary key
  - user_id: references auth.users
  - title: auto-generated or user-set conversation title
  - created_at / updated_at: timestamps

  ### atlas_messages
  - Individual messages within an Atlas conversation
  - id: uuid primary key
  - conversation_id: references atlas_conversations
  - user_id: denormalized for fast RLS checks
  - role: 'user' | 'assistant'
  - content: message text
  - created_at: timestamp

  ## New Columns on user_profiles

  ### atlas_messages_today
  - Count of Atlas messages sent today (resets daily)

  ### atlas_messages_reset_at
  - Timestamp of the last daily reset — used to detect when a new day has begun

  ## Security
  - RLS enabled on both new tables
  - Users can only access their own conversations and messages
*/

-- Atlas conversations
CREATE TABLE IF NOT EXISTS atlas_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New Conversation',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE atlas_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own atlas conversations"
  ON atlas_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own atlas conversations"
  ON atlas_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own atlas conversations"
  ON atlas_conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own atlas conversations"
  ON atlas_conversations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Atlas messages
CREATE TABLE IF NOT EXISTS atlas_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES atlas_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE atlas_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own atlas messages"
  ON atlas_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own atlas messages"
  ON atlas_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own atlas messages"
  ON atlas_messages FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_atlas_conversations_user_id ON atlas_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_atlas_conversations_updated_at ON atlas_conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_atlas_messages_conversation_id ON atlas_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_atlas_messages_created_at ON atlas_messages(created_at ASC);

-- Daily Atlas message tracking on user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'atlas_messages_today'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN atlas_messages_today integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'atlas_messages_reset_at'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN atlas_messages_reset_at timestamptz DEFAULT now();
  END IF;
END $$;

/*
  # Add Companion System

  ## Overview
  This migration enables users to have multiple AI companions, each with their own personality and relationship type (friend or romantic).

  ## 1. New Tables
    - `companions`
      - `id` (uuid, primary key) - Unique ID for this companion instance
      - `user_id` (uuid, foreign key) - Links to auth.users
      - `character_type` (text) - riley, raven, or jake
      - `relationship_type` (text) - friend or romantic
      - `created_at` (timestamptz) - When companion was created
      - `last_message_at` (timestamptz) - Last interaction time
      - `is_active` (boolean) - Whether companion is still active
      - `first_message_sent` (boolean) - Whether first message has been sent

  ## 2. Changes to Existing Tables
    - `conversations`
      - Add `companion_id` (uuid) - Links messages to specific companion
    - `user_profiles`
      - Move `first_message_sent` to companions table (handled by new structure)

  ## 3. Security
    - Enable RLS on `companions` table
    - Users can only view/modify their own companions
    - Conversations filtered by both user_id AND companion_id

  ## 4. Migration Strategy
    - Create companions table
    - Add companion_id to conversations
    - Migrate existing data: create default companion for existing users
    - Add appropriate indexes for performance
*/

-- Create companions table
CREATE TABLE IF NOT EXISTS companions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  character_type text NOT NULL CHECK (character_type IN ('riley', 'raven', 'jake')),
  relationship_type text NOT NULL DEFAULT 'romantic' CHECK (relationship_type IN ('friend', 'romantic')),
  created_at timestamptz DEFAULT now(),
  last_message_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  first_message_sent boolean DEFAULT false
);

-- Add companion_id to conversations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'companion_id'
  ) THEN
    ALTER TABLE conversations ADD COLUMN companion_id uuid REFERENCES companions(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create index for faster companion lookups
CREATE INDEX IF NOT EXISTS idx_companions_user_id ON companions(user_id);
CREATE INDEX IF NOT EXISTS idx_companions_active ON companions(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_conversations_companion ON conversations(companion_id, created_at DESC);

-- Enable RLS on companions table
ALTER TABLE companions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for companions table
CREATE POLICY "Users can view own companions"
  ON companions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own companions"
  ON companions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own companions"
  ON companions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own companions"
  ON companions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Migrate existing users: Create default companion for each user who has conversations
INSERT INTO companions (user_id, character_type, relationship_type, first_message_sent, last_message_at)
SELECT DISTINCT 
  up.id as user_id,
  COALESCE(up.character_type, 'riley') as character_type,
  'romantic' as relationship_type,
  COALESCE(up.first_message_sent, false) as first_message_sent,
  COALESCE(
    (SELECT MAX(created_at) FROM conversations WHERE user_id = up.id),
    now()
  ) as last_message_at
FROM user_profiles up
WHERE NOT EXISTS (
  SELECT 1 FROM companions WHERE companions.user_id = up.id
)
ON CONFLICT DO NOTHING;

-- Link existing conversations to their user's default companion
UPDATE conversations
SET companion_id = (
  SELECT id FROM companions 
  WHERE companions.user_id = conversations.user_id 
  ORDER BY created_at ASC 
  LIMIT 1
)
WHERE companion_id IS NULL;

-- Make companion_id required going forward (after migration)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'companion_id'
  ) THEN
    ALTER TABLE conversations ALTER COLUMN companion_id SET NOT NULL;
  END IF;
END $$;
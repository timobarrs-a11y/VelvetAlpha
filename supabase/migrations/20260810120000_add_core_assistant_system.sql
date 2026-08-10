/*
  # Core General-Assistant Surface

  ## Overview
  Adds "Core" — the fourth agent surface alongside Companion, Coach, and
  Correspondent. Core is a general-purpose, task-oriented assistant that shares
  the same semantic memory layer as the persona surfaces but has no persona of
  its own. It is metered separately from companion message counts.

  ## New Tables

  ### core_conversations
  - Top-level container for a Core chat thread.
  - id: uuid primary key
  - user_id: references auth.users
  - title: auto-generated or user-set thread title
  - created_at / updated_at: timestamps

  ### core_messages
  - Individual messages within a Core thread.
  - id: uuid primary key
  - conversation_id: references core_conversations
  - user_id: denormalized for fast RLS checks
  - role: 'user' | 'assistant'
  - content: message text
  - created_at: timestamp

  ## New Columns on user_profiles
  - core_messages_today: count of Core messages sent today (resets daily)
  - core_messages_reset_at: timestamp of the last daily reset

  ## New Column on relationship_memories
  - source_surface: which surface produced the memory ('companion' | 'coach' |
    'correspondent' | 'core'). Preserves provenance so cross-surface retrieval
    can attribute where a fact came from. Defaults to 'companion' so existing
    rows are unchanged.

  ## Security
  - RLS enabled on both new tables; users can only access their own rows.
  - No RLS change to relationship_memories (column addition only).

  ## Notes
  - Idempotent: IF NOT EXISTS on tables/columns/indexes; CREATE POLICY guarded.
*/

-- Core conversations (threads)
CREATE TABLE IF NOT EXISTS core_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New thread',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE core_conversations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'core_conversations' AND policyname = 'Users can select own core conversations') THEN
    CREATE POLICY "Users can select own core conversations"
      ON core_conversations FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'core_conversations' AND policyname = 'Users can insert own core conversations') THEN
    CREATE POLICY "Users can insert own core conversations"
      ON core_conversations FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'core_conversations' AND policyname = 'Users can update own core conversations') THEN
    CREATE POLICY "Users can update own core conversations"
      ON core_conversations FOR UPDATE TO authenticated
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'core_conversations' AND policyname = 'Users can delete own core conversations') THEN
    CREATE POLICY "Users can delete own core conversations"
      ON core_conversations FOR DELETE TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Core messages
CREATE TABLE IF NOT EXISTS core_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES core_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE core_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'core_messages' AND policyname = 'Users can select own core messages') THEN
    CREATE POLICY "Users can select own core messages"
      ON core_messages FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'core_messages' AND policyname = 'Users can insert own core messages') THEN
    CREATE POLICY "Users can insert own core messages"
      ON core_messages FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'core_messages' AND policyname = 'Users can delete own core messages') THEN
    CREATE POLICY "Users can delete own core messages"
      ON core_messages FOR DELETE TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_core_conversations_user_id ON core_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_core_conversations_updated_at ON core_conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_core_messages_conversation_id ON core_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_core_messages_created_at ON core_messages(created_at ASC);

-- Daily Core message metering (separate from companion messages_remaining and
-- from atlas_messages_today) on user_profiles.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'core_messages_today'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN core_messages_today integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'core_messages_reset_at'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN core_messages_reset_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Surface provenance on shared memories.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'relationship_memories' AND column_name = 'source_surface'
  ) THEN
    ALTER TABLE relationship_memories
      ADD COLUMN source_surface text NOT NULL DEFAULT 'companion';
  END IF;
END $$;

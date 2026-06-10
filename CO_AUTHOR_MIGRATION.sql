/*
  # Co-Author Collaborative Workspace System - Manual Migration

  Run this SQL in your Supabase SQL Editor to set up the co-author system.

  This creates:
  - co_author_sessions table (Writing/Research sessions)
  - co_author_blocks table (canvas content blocks)
  - co_author_chat_messages table (chat sidebar messages)
  - favorite_color column for companions
*/

-- Create co_author_sessions table
CREATE TABLE IF NOT EXISTS co_author_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
  title text NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('Writing', 'Research')),
  session_prompt text,
  length_preference text NOT NULL DEFAULT '1-2 sentences'
    CHECK (length_preference IN ('1-2 sentences', '3-4 sentences', '1 paragraph', '2-3 paragraphs')),
  created_at timestamptz DEFAULT now(),
  last_accessed_at timestamptz DEFAULT now()
);

-- Create co_author_blocks table
CREATE TABLE IF NOT EXISTS co_author_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES co_author_sessions(id) ON DELETE CASCADE,
  author_type text NOT NULL CHECK (author_type IN ('user', 'avatar')),
  content text NOT NULL,
  block_order integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create co_author_chat_messages table
CREATE TABLE IF NOT EXISTS co_author_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES co_author_sessions(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('user', 'avatar')),
  message_content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Add favorite_color to companions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companions' AND column_name = 'favorite_color'
  ) THEN
    ALTER TABLE companions ADD COLUMN favorite_color text;
  END IF;
END $$;

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_co_author_sessions_user_id ON co_author_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_co_author_sessions_companion_id ON co_author_sessions(companion_id);
CREATE INDEX IF NOT EXISTS idx_co_author_blocks_session_order ON co_author_blocks(session_id, block_order);
CREATE INDEX IF NOT EXISTS idx_co_author_chat_session_time ON co_author_chat_messages(session_id, created_at);

-- Enable RLS
ALTER TABLE co_author_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE co_author_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE co_author_chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for co_author_sessions
DROP POLICY IF EXISTS "Users can view own co-author sessions" ON co_author_sessions;
CREATE POLICY "Users can view own co-author sessions"
  ON co_author_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own co-author sessions" ON co_author_sessions;
CREATE POLICY "Users can create own co-author sessions"
  ON co_author_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own co-author sessions" ON co_author_sessions;
CREATE POLICY "Users can update own co-author sessions"
  ON co_author_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own co-author sessions" ON co_author_sessions;
CREATE POLICY "Users can delete own co-author sessions"
  ON co_author_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for co_author_blocks
DROP POLICY IF EXISTS "Users can view blocks from own sessions" ON co_author_blocks;
CREATE POLICY "Users can view blocks from own sessions"
  ON co_author_blocks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM co_author_sessions
      WHERE co_author_sessions.id = co_author_blocks.session_id
      AND co_author_sessions.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create blocks in own sessions" ON co_author_blocks;
CREATE POLICY "Users can create blocks in own sessions"
  ON co_author_blocks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM co_author_sessions
      WHERE co_author_sessions.id = co_author_blocks.session_id
      AND co_author_sessions.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update blocks in own sessions" ON co_author_blocks;
CREATE POLICY "Users can update blocks in own sessions"
  ON co_author_blocks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM co_author_sessions
      WHERE co_author_sessions.id = co_author_blocks.session_id
      AND co_author_sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM co_author_sessions
      WHERE co_author_sessions.id = co_author_blocks.session_id
      AND co_author_sessions.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete blocks from own sessions" ON co_author_blocks;
CREATE POLICY "Users can delete blocks from own sessions"
  ON co_author_blocks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM co_author_sessions
      WHERE co_author_sessions.id = co_author_blocks.session_id
      AND co_author_sessions.user_id = auth.uid()
    )
  );

-- RLS Policies for co_author_chat_messages
DROP POLICY IF EXISTS "Users can view chat messages from own sessions" ON co_author_chat_messages;
CREATE POLICY "Users can view chat messages from own sessions"
  ON co_author_chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM co_author_sessions
      WHERE co_author_sessions.id = co_author_chat_messages.session_id
      AND co_author_sessions.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create chat messages in own sessions" ON co_author_chat_messages;
CREATE POLICY "Users can create chat messages in own sessions"
  ON co_author_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM co_author_sessions
      WHERE co_author_sessions.id = co_author_chat_messages.session_id
      AND co_author_sessions.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update chat messages in own sessions" ON co_author_chat_messages;
CREATE POLICY "Users can update chat messages in own sessions"
  ON co_author_chat_messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM co_author_sessions
      WHERE co_author_sessions.id = co_author_chat_messages.session_id
      AND co_author_sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM co_author_sessions
      WHERE co_author_sessions.id = co_author_chat_messages.session_id
      AND co_author_sessions.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete chat messages from own sessions" ON co_author_chat_messages;
CREATE POLICY "Users can delete chat messages from own sessions"
  ON co_author_chat_messages FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM co_author_sessions
      WHERE co_author_sessions.id = co_author_chat_messages.session_id
      AND co_author_sessions.user_id = auth.uid()
    )
  );

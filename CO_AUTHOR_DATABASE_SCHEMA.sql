/*
  Co-Author System Database Schema

  This file contains the SQL schema for the Co-Author feature.
  Apply this manually to your Supabase database using the SQL editor.

  IMPORTANT: Run this as a single transaction in your Supabase SQL editor.
*/

-- Create co_author_sessions table
CREATE TABLE IF NOT EXISTS co_author_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  companion_id uuid REFERENCES companions(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Untitled Session',
  purpose text NOT NULL DEFAULT 'Writing' CHECK (purpose IN ('Writing', 'Research')),
  length_preference text NOT NULL DEFAULT '1-2 sentences' CHECK (length_preference IN ('1-2 sentences', '3-4 sentences', '1 paragraph', '2-3 paragraphs')),
  session_prompt text DEFAULT '',
  tone text NOT NULL DEFAULT 'Casual' CHECK (tone IN ('Professional', 'Casual', 'Creative', 'Academic', 'Playful')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  last_accessed_at timestamptz DEFAULT now() NOT NULL
);

-- Create co_author_blocks table
CREATE TABLE IF NOT EXISTS co_author_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES co_author_sessions(id) ON DELETE CASCADE NOT NULL,
  block_order integer NOT NULL DEFAULT 0,
  author_type text NOT NULL CHECK (author_type IN ('user', 'avatar')),
  content text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_co_author_sessions_user_id ON co_author_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_co_author_sessions_last_accessed ON co_author_sessions(last_accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_co_author_blocks_session_id ON co_author_blocks(session_id);
CREATE INDEX IF NOT EXISTS idx_co_author_blocks_order ON co_author_blocks(session_id, block_order);

-- Enable RLS
ALTER TABLE co_author_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE co_author_blocks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for co_author_sessions
DROP POLICY IF EXISTS "Users can view own sessions" ON co_author_sessions;
CREATE POLICY "Users can view own sessions"
  ON co_author_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own sessions" ON co_author_sessions;
CREATE POLICY "Users can create own sessions"
  ON co_author_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sessions" ON co_author_sessions;
CREATE POLICY "Users can update own sessions"
  ON co_author_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own sessions" ON co_author_sessions;
CREATE POLICY "Users can delete own sessions"
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

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_co_author_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_co_author_sessions_updated_at ON co_author_sessions;
CREATE TRIGGER update_co_author_sessions_updated_at
  BEFORE UPDATE ON co_author_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_co_author_updated_at();

DROP TRIGGER IF EXISTS update_co_author_blocks_updated_at ON co_author_blocks;
CREATE TRIGGER update_co_author_blocks_updated_at
  BEFORE UPDATE ON co_author_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_co_author_updated_at();

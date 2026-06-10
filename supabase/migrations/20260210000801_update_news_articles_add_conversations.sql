-- Update news_articles table and add conversation tables
--
-- Adds missing columns to news_articles for full content
-- Creates article_conversations and article_views tables

-- Add missing columns to news_articles if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'news_articles' AND column_name = 'content'
  ) THEN
    ALTER TABLE news_articles ADD COLUMN content text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'news_articles' AND column_name = 'author'
  ) THEN
    ALTER TABLE news_articles ADD COLUMN author text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'news_articles' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE news_articles ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Create article_conversations table
CREATE TABLE IF NOT EXISTS article_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create article_views table
CREATE TABLE IF NOT EXISTS article_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  viewed_at timestamptz DEFAULT now()
);

-- Create unique constraint on article views
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_article_views_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_article_views_unique ON article_views(article_id, user_id);
  END IF;
END $$;

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_article_conv_lookup ON article_conversations(article_id, user_id);
CREATE INDEX IF NOT EXISTS idx_article_conv_time ON article_conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_article_views_user_time ON article_views(user_id, viewed_at DESC);

-- Enable RLS
ALTER TABLE article_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_views ENABLE ROW LEVEL SECURITY;

-- RLS Policies for article_conversations
CREATE POLICY "Users can read own article conversations"
  ON article_conversations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own article conversations"
  ON article_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own article conversations"
  ON article_conversations
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for article_views
CREATE POLICY "Users can read own article views"
  ON article_views
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own article views"
  ON article_views
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

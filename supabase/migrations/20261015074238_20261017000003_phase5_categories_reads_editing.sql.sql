/*
# Phase 5: Board categories + post read tracking

1. New Columns
- `community_boards.category` (text, default 'General') — groups boards into categories for the community index.
- `community_posts.edited_at` (timestamptz, nullable) — set when a post is edited.

2. New Tables
- `community_post_reads` — tracks which posts a user has viewed for read/unread indicators.

3. Security
- RLS enabled on `community_post_reads`. Users can only see/insert their own read records.

4. Notes
- The `category` column defaults to 'General'. Existing boards will have 'General'.
- No data loss: all new columns are nullable or have defaults.
*/

-- Add category column to boards
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'community_boards' AND column_name = 'category'
  ) THEN
    ALTER TABLE community_boards ADD COLUMN category text NOT NULL DEFAULT 'General';
  END IF;
END $$;

-- Add edited_at column to posts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'community_posts' AND column_name = 'edited_at'
  ) THEN
    ALTER TABLE community_posts ADD COLUMN edited_at timestamptz;
  END IF;
END $$;

-- Create post reads table
CREATE TABLE IF NOT EXISTS community_post_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

ALTER TABLE community_post_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_reads" ON community_post_reads;
CREATE POLICY "select_own_reads" ON community_post_reads FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_reads" ON community_post_reads;
CREATE POLICY "insert_own_reads" ON community_post_reads FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_reads" ON community_post_reads;
CREATE POLICY "update_own_reads" ON community_post_reads FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_reads" ON community_post_reads;
CREATE POLICY "delete_own_reads" ON community_post_reads FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS community_post_reads_user_idx ON community_post_reads(user_id);
CREATE INDEX IF NOT EXISTS community_post_reads_post_idx ON community_post_reads(post_id);

-- Assign categories to existing boards based on name
DO $$
BEGIN
  UPDATE community_boards SET category = 'Community Hub' WHERE name IN ('General Discussion', 'Welcome & Introductions', 'Site Feedback');
  UPDATE community_boards SET category = 'Life & Relationships' WHERE name IN ('Relationships & Dating', 'Single Life', 'Honest Bridge');
  UPDATE community_boards SET category = 'Family' WHERE name IN ('Moms', 'Dads', 'Parenting');
  UPDATE community_boards SET category = 'Interests & Hobbies' WHERE name IN ('Cooking & Recipes', 'Gaming Lounge', 'Movies/Music & Pop Culture', 'Tech & Gadgets', 'Sports Talk', 'Travel & Adventure');
  UPDATE community_boards SET category = 'Self-Improvement' WHERE name IN ('Career & Money', 'Fitness & Motivation', 'Spirituality & Reflection', 'Daily Check-In');
  UPDATE community_boards SET category = 'Companion Corner' WHERE name IN ('Companion Corner');
END $$;

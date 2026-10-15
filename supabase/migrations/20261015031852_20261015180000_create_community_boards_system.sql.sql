/*
# Create Community Boards System

1. Purpose
   - Adds a full community message board system: boards, posts, comments, reactions, and reports.
   - Any signed-in user can create boards, post, comment, and react.
   - Board owners can moderate their own boards; admins can moderate everything.
   - Includes denormalized comment_count and reaction_count on posts, maintained by triggers.

2. New Tables
   - community_boards: Board categories created by users. Columns: id, name, description, color, icon, owner_id, is_locked, is_pinned, created_at.
   - community_posts: Threaded posts within boards. Columns: id, board_id, author_id, title, body, image_url, is_ai_generated, is_pinned, is_locked, comment_count, reaction_count, created_at, updated_at.
   - community_comments: Flat replies on posts (one level). Columns: id, post_id, author_id, body, created_at, updated_at.
   - community_reactions: Emoji reactions on posts or comments. Columns: id, user_id, target_type (post|comment), target_id, reaction_type (like|support|relate), created_at. Unique per user per target.
   - community_reports: User-submitted reports for moderation. Columns: id, reporter_id, target_type (post|comment|board), target_id, reason, status, created_at.

3. Security (RLS)
   - All tables have RLS enabled.
   - Any authenticated user can SELECT all community tables (boards, posts, comments, reactions).
   - Users can INSERT their own posts, comments, reactions, boards, and reports.
   - Users can UPDATE/DELETE only their own posts, comments, and boards.
   - Board owners can DELETE posts and comments within their board (moderation).
   - Admins (is_super_user = true on user_profiles) can DELETE any post, comment, or board, and can UPDATE any board.
   - Reports are visible only to admins.

4. Indexes
   - community_posts(board_id, created_at DESC) for board feed sorting.
   - community_posts(board_id, reaction_count DESC) for trending.
   - community_comments(post_id, created_at) for comment threading.
   - community_reactions(target_type, target_id) for reaction lookups.

5. Triggers
   - update_post_comment_count: Increments/decrements community_posts.comment_count when a comment is inserted/deleted.
   - update_post_reaction_count: Increments/decrements community_posts.reaction_count when a reaction is inserted/deleted.
*/

-- ── community_boards ──
CREATE TABLE IF NOT EXISTS community_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  color text NOT NULL DEFAULT 'blue',
  icon text NOT NULL DEFAULT 'MessageSquare',
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  is_locked boolean NOT NULL DEFAULT false,
  is_pinned boolean NOT NULL DEFAULT false,
  post_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE community_boards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "community_boards_select_all" ON community_boards;
CREATE POLICY "community_boards_select_all"
  ON community_boards FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "community_boards_insert_own" ON community_boards;
CREATE POLICY "community_boards_insert_own"
  ON community_boards FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "community_boards_update_own" ON community_boards;
CREATE POLICY "community_boards_update_own"
  ON community_boards FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_super_user = true))
  WITH CHECK (auth.uid() = owner_id OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_super_user = true));

DROP POLICY IF EXISTS "community_boards_delete_own" ON community_boards;
CREATE POLICY "community_boards_delete_own"
  ON community_boards FOR DELETE TO authenticated
  USING (auth.uid() = owner_id OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_super_user = true));

-- ── community_posts ──
CREATE TABLE IF NOT EXISTS community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES community_boards(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  image_url text,
  is_ai_generated boolean NOT NULL DEFAULT false,
  is_pinned boolean NOT NULL DEFAULT false,
  is_locked boolean NOT NULL DEFAULT false,
  comment_count int NOT NULL DEFAULT 0,
  reaction_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "community_posts_select_all" ON community_posts;
CREATE POLICY "community_posts_select_all"
  ON community_posts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "community_posts_insert_own" ON community_posts;
CREATE POLICY "community_posts_insert_own"
  ON community_posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "community_posts_update_own" ON community_posts;
CREATE POLICY "community_posts_update_own"
  ON community_posts FOR UPDATE TO authenticated
  USING (auth.uid() = author_id OR EXISTS (SELECT 1 FROM community_boards WHERE id = community_posts.board_id AND owner_id = auth.uid()) OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_super_user = true))
  WITH CHECK (auth.uid() = author_id OR EXISTS (SELECT 1 FROM community_boards WHERE id = community_posts.board_id AND owner_id = auth.uid()) OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_super_user = true));

DROP POLICY IF EXISTS "community_posts_delete_own_or_owner" ON community_posts;
CREATE POLICY "community_posts_delete_own_or_owner"
  ON community_posts FOR DELETE TO authenticated
  USING (auth.uid() = author_id OR EXISTS (SELECT 1 FROM community_boards WHERE id = community_posts.board_id AND owner_id = auth.uid()) OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_super_user = true));

-- ── community_comments ──
CREATE TABLE IF NOT EXISTS community_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  is_ai_generated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE community_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "community_comments_select_all" ON community_comments;
CREATE POLICY "community_comments_select_all"
  ON community_comments FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "community_comments_insert_own" ON community_comments;
CREATE POLICY "community_comments_insert_own"
  ON community_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "community_comments_update_own" ON community_comments;
CREATE POLICY "community_comments_update_own"
  ON community_comments FOR UPDATE TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "community_comments_delete_own_or_owner" ON community_comments;
CREATE POLICY "community_comments_delete_own_or_owner"
  ON community_comments FOR DELETE TO authenticated
  USING (auth.uid() = author_id OR EXISTS (SELECT 1 FROM community_posts p JOIN community_boards b ON p.board_id = b.id WHERE p.id = community_comments.post_id AND b.owner_id = auth.uid()) OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_super_user = true));

-- ── community_reactions ──
CREATE TABLE IF NOT EXISTS community_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('post', 'comment')),
  target_id uuid NOT NULL,
  reaction_type text NOT NULL CHECK (reaction_type IN ('like', 'support', 'relate')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, target_type, target_id, reaction_type)
);

ALTER TABLE community_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "community_reactions_select_all" ON community_reactions;
CREATE POLICY "community_reactions_select_all"
  ON community_reactions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "community_reactions_insert_own" ON community_reactions;
CREATE POLICY "community_reactions_insert_own"
  ON community_reactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "community_reactions_delete_own" ON community_reactions;
CREATE POLICY "community_reactions_delete_own"
  ON community_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ── community_reports ──
CREATE TABLE IF NOT EXISTS community_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('post', 'comment', 'board')),
  target_id uuid NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE community_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "community_reports_select_admin" ON community_reports;
CREATE POLICY "community_reports_select_admin"
  ON community_reports FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_super_user = true));

DROP POLICY IF EXISTS "community_reports_insert_own" ON community_reports;
CREATE POLICY "community_reports_insert_own"
  ON community_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "community_reports_update_admin" ON community_reports;
CREATE POLICY "community_reports_update_admin"
  ON community_reports FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_super_user = true))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_super_user = true));

DROP POLICY IF EXISTS "community_reports_delete_admin" ON community_reports;
CREATE POLICY "community_reports_delete_admin"
  ON community_reports FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_super_user = true));

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_community_posts_board_created ON community_posts (board_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_board_reactions ON community_posts (board_id, reaction_count DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_created ON community_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_reaction_count ON community_posts (reaction_count DESC);
CREATE INDEX IF NOT EXISTS idx_community_comments_post_created ON community_comments (post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_community_reactions_target ON community_reactions (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_community_boards_pinned ON community_boards (is_pinned DESC, created_at DESC);

-- ── Trigger: update post comment_count ──
CREATE OR REPLACE FUNCTION update_post_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE community_posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_post_comment_insert ON community_comments;
CREATE TRIGGER trg_post_comment_insert
  AFTER INSERT ON community_comments
  FOR EACH ROW EXECUTE FUNCTION update_post_comment_count();

DROP TRIGGER IF EXISTS trg_post_comment_delete ON community_comments;
CREATE TRIGGER trg_post_comment_delete
  AFTER DELETE ON community_comments
  FOR EACH ROW EXECUTE FUNCTION update_post_comment_count();

-- ── Trigger: update post reaction_count ──
CREATE OR REPLACE FUNCTION update_post_reaction_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.target_type = 'post' THEN
      UPDATE community_posts SET reaction_count = reaction_count + 1 WHERE id = NEW.target_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.target_type = 'post' THEN
      UPDATE community_posts SET reaction_count = GREATEST(reaction_count - 1, 0) WHERE id = OLD.target_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_post_reaction_insert ON community_reactions;
CREATE TRIGGER trg_post_reaction_insert
  AFTER INSERT ON community_reactions
  FOR EACH ROW EXECUTE FUNCTION update_post_reaction_count();

DROP TRIGGER IF EXISTS trg_post_reaction_delete ON community_reactions;
CREATE TRIGGER trg_post_reaction_delete
  AFTER DELETE ON community_reactions
  FOR EACH ROW EXECUTE FUNCTION update_post_reaction_count();

-- ── Trigger: update board post_count ──
CREATE OR REPLACE FUNCTION update_board_post_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_boards SET post_count = post_count + 1 WHERE id = NEW.board_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE community_boards SET post_count = GREATEST(post_count - 1, 0) WHERE id = OLD.board_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_board_post_insert ON community_posts;
CREATE TRIGGER trg_board_post_insert
  AFTER INSERT ON community_posts
  FOR EACH ROW EXECUTE FUNCTION update_board_post_count();

DROP TRIGGER IF EXISTS trg_board_post_delete ON community_posts;
CREATE TRIGGER trg_board_post_delete
  AFTER DELETE ON community_posts
  FOR EACH ROW EXECUTE FUNCTION update_board_post_count();

-- ── Enable realtime ──
ALTER TABLE community_posts REPLICA IDENTITY FULL;
ALTER TABLE community_comments REPLICA IDENTITY FULL;
ALTER TABLE community_reactions REPLICA IDENTITY FULL;

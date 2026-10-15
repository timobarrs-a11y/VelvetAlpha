/*
# Auto cross-post changelog entries to a community board

1. Creates a dedicated "Updates" board owned by the super user (Tim).
2. Adds a `cross_posted_post_id` column to changelog_entries so we can track
   which community post was created from each changelog entry (and avoid
   duplicates).
3. Creates a SECURITY DEFINER trigger function that fires AFTER INSERT on
   changelog_entries and automatically creates a matching community_posts row
   in the Updates board. The function runs as the board owner so RLS on
   community_posts is satisfied.
*/

-- ── 1. Add tracking column ──
ALTER TABLE changelog_entries
  ADD COLUMN IF NOT EXISTS cross_posted_post_id uuid REFERENCES community_posts(id) ON DELETE SET NULL;

-- ── 2. Create the "Updates" board if it doesn't exist ──
INSERT INTO community_boards (id, name, description, color, icon, owner_id, is_pinned)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Updates',
  'Official product changelog — every feature, fix, and improvement we ship, posted automatically.',
  'blue',
  'GitCommit',
  '3a195a32-ee68-4164-9bd5-40499627a378',
  true
)
ON CONFLICT (id) DO NOTHING;

-- ── 3. Trigger function: cross-post changelog → community post ──
CREATE OR REPLACE FUNCTION cross_post_changelog_to_board()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  board_id uuid := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  owner_id uuid := '3a195a32-ee68-4164-9bd5-40499627a378';
  new_post_id uuid;
  category_label text;
BEGIN
  -- Skip if already cross-posted (e.g. re-running seeds)
  IF NEW.cross_posted_post_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Map category to a readable label
  category_label := CASE NEW.category
    WHEN 'feature' THEN 'New Feature'
    WHEN 'improvement' THEN 'Improvement'
    WHEN 'fix' THEN 'Bug Fix'
    WHEN 'design' THEN 'Design'
    WHEN 'game' THEN 'Game Update'
    WHEN 'infra' THEN 'Infrastructure'
    ELSE 'Update'
  END;

  -- Insert the community post as the board owner
  INSERT INTO community_posts (board_id, author_id, title, body, is_ai_generated, is_pinned)
  VALUES (
    board_id,
    owner_id,
    NEW.title,
    '[' || category_label || ']' || E'\n\n' || NEW.body ||
      E'\n\n---\nSee the full changelog at /changelog',
    false,
    NEW.is_pinned
  )
  RETURNING id INTO new_post_id;

  -- Link back
  UPDATE changelog_entries
    SET cross_posted_post_id = new_post_id
    WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- ── 4. Drop & recreate the trigger ──
DROP TRIGGER IF EXISTS trg_changelog_cross_post ON changelog_entries;
CREATE TRIGGER trg_changelog_cross_post
  AFTER INSERT ON changelog_entries
  FOR EACH ROW
  EXECUTE FUNCTION cross_post_changelog_to_board();

-- ── 5. Backfill: cross-post any existing entries that haven't been posted yet ──
-- We need to do this manually since the trigger only fires on new inserts.
DO $$
DECLARE
  entry RECORD;
  board_id uuid := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  owner_id uuid := '3a195a32-ee68-4164-9bd5-40499627a378';
  new_post_id uuid;
  category_label text;
BEGIN
  FOR entry IN
    SELECT id, title, body, category, is_pinned
    FROM changelog_entries
    WHERE cross_posted_post_id IS NULL
    ORDER BY published_at ASC
  LOOP
    category_label := CASE entry.category
      WHEN 'feature' THEN 'New Feature'
      WHEN 'improvement' THEN 'Improvement'
      WHEN 'fix' THEN 'Bug Fix'
      WHEN 'design' THEN 'Design'
      WHEN 'game' THEN 'Game Update'
      WHEN 'infra' THEN 'Infrastructure'
      ELSE 'Update'
    END;

    INSERT INTO community_posts (board_id, author_id, title, body, is_ai_generated, is_pinned)
    VALUES (
      board_id,
      owner_id,
      entry.title,
      '[' || category_label || ']' || E'\n\n' || entry.body ||
        E'\n\n---\nSee the full changelog at /changelog',
      false,
      entry.is_pinned
    )
    RETURNING id INTO new_post_id;

    UPDATE changelog_entries
      SET cross_posted_post_id = new_post_id
      WHERE id = entry.id;
  END LOOP;
END $$;

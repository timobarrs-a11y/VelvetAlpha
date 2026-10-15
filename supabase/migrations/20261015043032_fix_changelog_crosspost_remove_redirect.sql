/*
# Fix changelog cross-post: present full content, remove redirect link

## Problem
The auto cross-post trigger appends "See the full changelog at /changelog"
to every community post. The user wants the full changelog entry presented
directly in the board post -- no redirect to another page.

## Changes
1. Rewrite the trigger function to post the full body without the redirect footer.
2. Update all existing cross-posted community posts to remove the redirect text.
3. Keep the category label prefix (it's useful context, not a redirect).
*/

-- 1. Rewrite the trigger function (no redirect footer)
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
  IF NEW.cross_posted_post_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  category_label := CASE NEW.category
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
    NEW.title,
    '[' || category_label || ']' || E'\n\n' || NEW.body,
    false,
    NEW.is_pinned
  )
  RETURNING id INTO new_post_id;

  UPDATE changelog_entries
    SET cross_posted_post_id = new_post_id
    WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- 2. Strip the redirect footer from existing cross-posted posts
UPDATE community_posts
SET body = split_part(body, E'\n\n---\nSee the full changelog at /changelog', 1)
WHERE body LIKE '%---\nSee the full changelog at /changelog%';
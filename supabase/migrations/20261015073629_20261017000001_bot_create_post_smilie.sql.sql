/*
# Update bot_create_post to accept post_smilie parameter

1. Modified Functions
- `bot_create_post` — adds optional `p_post_smilie text` parameter, inserts it into `community_posts.post_smilie`
2. Security
- No RLS changes. Function remains SECURITY DEFINER, EXECUTE revoked from anon and authenticated.
3. Notes
- The parameter is optional (NULL allowed) so existing callers that don't pass it still work.
- Existing posts with NULL post_smilie are unaffected.
- Must DROP the old signature first since CREATE OR REPLACE with a different parameter signature creates an ambiguity.
*/

DROP FUNCTION IF EXISTS bot_create_post(uuid, uuid, text, text);

CREATE OR REPLACE FUNCTION bot_create_post(
  p_board_id uuid,
  p_author_id uuid,
  p_title text,
  p_body text,
  p_post_smilie text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_id uuid;
  v_board_exists boolean;
BEGIN
  IF p_title IS NULL OR btrim(p_title) = '' THEN
    RAISE EXCEPTION 'Title cannot be empty';
  END IF;
  IF p_body IS NULL OR btrim(p_body) = '' THEN
    RAISE EXCEPTION 'Body cannot be empty';
  END IF;
  IF length(p_title) > 300 THEN
    RAISE EXCEPTION 'Title too long (max 300 chars)';
  END IF;
  IF length(p_body) > 5000 THEN
    RAISE EXCEPTION 'Body too long (max 5000 chars)';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM community_boards
    WHERE id = p_board_id AND is_approved = true
  ) INTO v_board_exists;

  IF NOT v_board_exists THEN
    RAISE EXCEPTION 'Board does not exist or is not approved';
  END IF;

  INSERT INTO community_posts (board_id, author_id, title, body, is_ai_generated, post_smilie)
  VALUES (p_board_id, p_author_id, p_title, p_body, true, p_post_smilie)
  RETURNING id INTO v_post_id;

  RETURN v_post_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION bot_create_post(uuid, uuid, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION bot_create_post(uuid, uuid, text, text, text) FROM authenticated;

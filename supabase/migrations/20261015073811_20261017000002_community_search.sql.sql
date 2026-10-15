/*
# Community search RPC

1. New Functions
- `community_search(p_query text, p_limit int default 20)` — full-text search across community posts and boards.
  Returns a unified result set with columns: result_type ('post' | 'board'), id, title, body, board_id, board_name, author_name, comment_count, created_at.
  Uses plainto_tsquery for user-friendly search. Only searches approved boards.
2. Security
- SECURITY DEFINER so the function can join user_profiles for author names without exposing the table directly.
- EXECUTE granted to authenticated (the app requires sign-in). Revoked from anon.
3. Notes
- Uses English text search configuration.
- Post results are ranked by ts_rank, board results by name similarity.
- Only approved boards are searched, and only posts within approved boards.
*/

CREATE OR REPLACE FUNCTION community_search(
  p_query text,
  p_limit int DEFAULT 20
)
RETURNS TABLE (
  result_type text,
  id uuid,
  title text,
  body text,
  board_id uuid,
  board_name text,
  author_name text,
  comment_count int,
  created_at timestamptz,
  rank real
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tsq tsquery;
BEGIN
  v_tsq := plainto_tsquery('english', p_query);
  IF v_tsq = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    'post'::text AS result_type,
    p.id,
    p.title,
    LEFT(p.body, 300) AS body,
    p.board_id,
    b.name AS board_name,
    COALESCE(up.name, 'Unknown') AS author_name,
    p.comment_count,
    p.created_at,
    ts_rank(tsv, v_tsq) AS rank
  FROM community_posts p
  JOIN community_boards b ON b.id = p.board_id AND b.is_approved = true
  LEFT JOIN user_profiles up ON up.id = p.author_id
  WHERE tsv @@ v_tsq
  ORDER BY rank DESC, p.created_at DESC
  LIMIT p_limit;

  RETURN QUERY
  SELECT
    'board'::text AS result_type,
    b.id,
    b.name AS title,
    b.description AS body,
    NULL::uuid AS board_id,
    NULL::text AS board_name,
    NULL::text AS author_name,
    b.post_count AS comment_count,
    b.created_at,
    similarity(b.name, p_query) AS rank
  FROM community_boards b
  WHERE b.is_approved = true AND (b.name ILIKE '%' || p_query || '%' OR b.description ILIKE '%' || p_query || '%')
  ORDER BY rank DESC, b.name ASC
  LIMIT p_limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION community_search(text, int) FROM anon;
GRANT EXECUTE ON FUNCTION community_search(text, int) TO authenticated;

-- Add a generated tsvector column and index for posts if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'community_posts' AND column_name = 'tsv'
  ) THEN
    ALTER TABLE community_posts ADD COLUMN tsv tsvector
      GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))
      ) STORED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS community_posts_tsv_idx ON community_posts USING gin(tsv);

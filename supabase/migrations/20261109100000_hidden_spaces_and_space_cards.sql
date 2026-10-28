/*
# Hidden spaces, and one view for spaces and crews

1. A fifth door, `hidden`. A hidden space or crew is never listed, searched or suggested to anyone
   who isn't in it. The only ways in are an invite link or an owner/mod adding a friend. Anything
   inside a hidden space (its crews, rooms, posts) is hidden the same way unless you're a member of
   that thing itself. Admins still see everything. Setting a door to hidden needs social access
   (age verified), like the rest of the community.

   Tim, 28 October: this is a deliberate exception to "every door is always on the map".

2. `can_see_board(id)`: the one rule for "does this space exist, as far as I'm concerned". Used by
   the board SELECT policy, the directory, search, suggestions and can_read_board.

3. `get_space_card(id)`: the House shows any space or crew you can see, not just ones you're in
   (a preview with the right door button for the rest). Includes the parent's name for the
   breadcrumb.

4. `get_my_spaces()` and `get_space_directory()` now also return `parent_board_id`, `parent_name`
   and a `sub_space_count` that only counts crews you can see, so the sidebar can nest crews
   under their space without a second lookup. `parent_name` is null when the parent is hidden
   from me (I was invited into a crew of a hidden space I'm not in).
*/

-- ============================================================
-- 1. The door
-- ============================================================
ALTER TABLE public.community_boards DROP CONSTRAINT IF EXISTS community_boards_visibility_check;
ALTER TABLE public.community_boards
  ADD CONSTRAINT community_boards_visibility_check
  CHECK (visibility IN ('open', 'request', 'invite', 'private', 'hidden'));

CREATE OR REPLACE FUNCTION public.guard_hidden_visibility()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.visibility = 'hidden'
     AND (TG_OP = 'INSERT' OR OLD.visibility IS DISTINCT FROM 'hidden')
     AND auth.uid() IS NOT NULL
     AND NOT public.has_social_access() THEN
    RAISE EXCEPTION 'Verify your age to make a hidden space';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_guard_hidden_visibility ON public.community_boards;
CREATE TRIGGER trg_guard_hidden_visibility
  BEFORE INSERT OR UPDATE OF visibility ON public.community_boards
  FOR EACH ROW EXECUTE FUNCTION public.guard_hidden_visibility();

-- ============================================================
-- 2. Who can see a space
-- ============================================================
-- Visible when nothing in the chain from this space up to the top is hidden from me, or I'm a
-- member of the space itself, or I'm an admin. Owners are members (setup_new_space).
CREATE OR REPLACE FUNCTION public.can_see_board(p_board_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH RECURSIVE chain AS (
    SELECT b.id, b.parent_board_id, b.visibility, 0 AS depth
    FROM public.community_boards b WHERE b.id = p_board_id
    UNION ALL
    SELECT p.id, p.parent_board_id, p.visibility, c.depth + 1
    FROM public.community_boards p
    JOIN chain c ON p.id = c.parent_board_id
    WHERE c.depth < 8
  )
  SELECT EXISTS (SELECT 1 FROM chain)
     AND (
       public.is_admin()
       OR public.is_board_member(p_board_id)
       OR NOT EXISTS (
         SELECT 1 FROM chain
         WHERE chain.visibility = 'hidden' AND NOT public.is_board_member(chain.id)
       )
     );
$$;
REVOKE EXECUTE ON FUNCTION public.can_see_board(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_see_board(uuid) TO authenticated;

-- Reading an open space's rooms and posts also needs the space to be visible
-- (an open crew inside a hidden space is for that space's members).
CREATE OR REPLACE FUNCTION public.can_read_board(p_board_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_boards b
    WHERE b.id = p_board_id
      AND ((b.visibility = 'open' AND public.can_see_board(b.id))
           OR public.is_board_member(b.id) OR public.is_admin())
  );
$$;

-- Board rows: approved and visible, or my own (pending approval), or a super user.
-- The short-circuit keeps the common case (an open top-level space) cheap.
DROP POLICY IF EXISTS "community_boards_select_visibility" ON public.community_boards;
CREATE POLICY "community_boards_select_visibility"
  ON public.community_boards FOR SELECT
  TO authenticated
  USING (
    (is_approved = true
      AND ((visibility <> 'hidden' AND parent_board_id IS NULL) OR public.can_see_board(id)))
    OR owner_id = auth.uid()
    OR is_current_user_super_user()
  );

-- ============================================================
-- 3. One space, as the House shows it
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_space_card(p_board_id uuid)
RETURNS TABLE (
  board_id uuid, parent_board_id uuid, parent_name text, name text, description text,
  icon text, color text, category text, visibility text, member_count int,
  role text, has_pending_request boolean, sub_space_count int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT b.id, b.parent_board_id, CASE WHEN public.can_see_board(p.id) THEN p.name END, b.name, b.description, b.icon, b.color, b.category,
         b.visibility, b.member_count,
         public.board_role(b.id),
         EXISTS (SELECT 1 FROM public.community_join_requests r
                 WHERE r.board_id = b.id AND r.user_id = auth.uid() AND r.status = 'pending'),
         (SELECT count(*)::int FROM public.community_boards c
          WHERE c.parent_board_id = b.id AND c.is_approved AND public.can_see_board(c.id))
  FROM public.community_boards b
  LEFT JOIN public.community_boards p ON p.id = b.parent_board_id
  WHERE b.id = p_board_id
    AND (b.is_approved OR b.owner_id = auth.uid() OR public.is_admin())
    AND public.can_see_board(b.id);
$$;
REVOKE EXECUTE ON FUNCTION public.get_space_card(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_space_card(uuid) TO authenticated;

-- ============================================================
-- 4. My spaces, with where each one sits
-- ============================================================
DROP FUNCTION IF EXISTS public.get_my_spaces();
CREATE FUNCTION public.get_my_spaces()
RETURNS TABLE (
  board_id uuid, name text, description text, icon text, color text, category text,
  visibility text, member_count int, role text, unread_count int, last_message_at timestamptz,
  parent_board_id uuid, parent_name text, sub_space_count int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    b.id, b.name, b.description, b.icon, b.color, b.category, b.visibility, b.member_count, m.role,
    (
      SELECT count(*)::int
      FROM public.community_room_messages msg
      LEFT JOIN public.community_room_reads r ON r.room_id = msg.room_id AND r.user_id = m.user_id
      WHERE msg.board_id = b.id
        AND msg.deleted_at IS NULL
        AND msg.author_id IS DISTINCT FROM m.user_id
        AND msg.created_at > COALESCE(r.last_read_at, m.joined_at)
    ),
    (SELECT max(rm.last_message_at) FROM public.community_rooms rm WHERE rm.board_id = b.id),
    b.parent_board_id,
    CASE WHEN public.can_see_board(p.id) THEN p.name END,
    (SELECT count(*)::int FROM public.community_boards c
     WHERE c.parent_board_id = b.id AND c.is_approved AND public.can_see_board(c.id))
  FROM public.community_board_members m
  JOIN public.community_boards b ON b.id = m.board_id
  LEFT JOIN public.community_boards p ON p.id = b.parent_board_id
  WHERE m.user_id = auth.uid()
  ORDER BY b.is_pinned DESC, b.sort_order, b.name;
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_spaces() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_my_spaces() TO authenticated;

-- ============================================================
-- 5. Directory, search and suggestions leave hidden spaces out
-- ============================================================
DROP FUNCTION IF EXISTS public.get_space_directory(uuid, text);
CREATE FUNCTION public.get_space_directory(p_parent_id uuid DEFAULT NULL, p_query text DEFAULT NULL)
RETURNS TABLE (
  board_id uuid, parent_board_id uuid, name text, description text, icon text, color text, category text,
  visibility text, member_count int, is_member boolean, has_pending_request boolean, sub_space_count int,
  parent_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT b.id, b.parent_board_id, b.name, b.description, b.icon, b.color, b.category,
         b.visibility, b.member_count,
         public.is_board_member(b.id),
         EXISTS (SELECT 1 FROM public.community_join_requests r
                 WHERE r.board_id = b.id AND r.user_id = auth.uid() AND r.status = 'pending'),
         (SELECT count(*)::int FROM public.community_boards c
          WHERE c.parent_board_id = b.id AND c.is_approved AND public.can_see_board(c.id)),
         CASE WHEN public.can_see_board(p.id) THEN p.name END
  FROM public.community_boards b
  LEFT JOIN public.community_boards p ON p.id = b.parent_board_id
  WHERE b.is_approved
    -- With a search query and no parent: search every level. Otherwise: one level of the tree.
    AND ((p_parent_id IS NULL AND p_query IS NOT NULL) OR b.parent_board_id IS NOT DISTINCT FROM p_parent_id)
    AND (p_query IS NULL OR b.name ILIKE '%' || p_query || '%' OR b.description ILIKE '%' || p_query || '%')
    AND public.can_see_board(b.id)
  ORDER BY b.is_pinned DESC, b.member_count DESC, b.name
  LIMIT 200;
$$;
REVOKE EXECUTE ON FUNCTION public.get_space_directory(uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_space_directory(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_space_suggestions(p_limit int DEFAULT 5)
RETURNS TABLE (
  board_id uuid, name text, description text, icon text, color text,
  visibility text, member_count int, matched_interests text[]
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT b.id, b.name, b.description, b.icon, b.color, b.visibility, b.member_count,
         array_agg(DISTINCT m.interest ORDER BY m.interest)
  FROM public.community_interest_map m
  JOIN public.community_boards b ON b.id = m.board_id AND b.is_approved
  LEFT JOIN public.user_profiles up ON up.id = auth.uid()
  WHERE m.interest = ANY (public.user_interest_tags(auth.uid(), true))
    AND (m.gender_filter IS NULL OR m.gender_filter = up.gender)
    AND b.visibility <> 'hidden'
    AND public.can_see_board(b.id)
    AND NOT EXISTS (SELECT 1 FROM public.community_board_members x WHERE x.board_id = b.id AND x.user_id = auth.uid())
    AND NOT EXISTS (SELECT 1 FROM public.community_space_dismissals d WHERE d.board_id = b.id AND d.user_id = auth.uid())
  GROUP BY b.id
  ORDER BY count(*) DESC, b.member_count DESC
  LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION public.community_search(
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
    AND public.can_read_board(p.board_id)
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
  WHERE b.is_approved = true
    AND (b.name ILIKE '%' || p_query || '%' OR b.description ILIKE '%' || p_query || '%')
    AND public.can_see_board(b.id)
  ORDER BY rank DESC, b.name ASC
  LIMIT p_limit;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.community_search(text, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.community_search(text, int) TO authenticated;

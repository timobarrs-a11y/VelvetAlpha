/*
# Phase 2: Spaces, live rooms, membership, auto-join from the questionnaire

## Plain-English summary
A "space" is an existing community board. This migration gives every space:
- members (join / leave, owner / mod / member roles),
- live chat rooms (like Discord channels) next to the existing posts,
- a visibility setting: 'open' (anyone can read, join to talk) or 'private'
  (still LISTED in the directory, but only members can read or post),
- automatic placement from the personal questionnaire, through an editable
  interest -> space map.

It also seeds three new spaces (Books & Writing, Creative Corner,
Pets & Animals), a room set for the busiest spaces, and the private
"Velvet Alpha" space for alpha testers.

## Tables
- community_board_members  (board_id, user_id, role, source, joined_at)
- community_rooms          (id, board_id, name, topic, kind, sort_order, last_message_at)
- community_room_messages  (id, room_id, board_id, author_id, body, reply_to_id, kind, deleted_at)
- community_room_reads     (room_id, user_id, last_read_at)
- community_interest_map   (interest, board_id, room_name, gender_filter)
- community_space_dismissals (user_id, board_id)

## Columns added to community_boards
- visibility   text 'open' | 'private'   (Phase 4 adds 'request' and 'invite')
- member_count int, maintained by trigger
- auto_join_all boolean: every new member is placed here (Welcome, Updates)

## Security
- Room messages have NO client INSERT policy. Sending goes through the
  `community-room-send` edge function (moderation + rate limit + membership).
- Posts, comments and room messages in private spaces are readable only by
  members (or admins). Space rows themselves stay readable so private spaces
  are still listed.
- community_search is rewritten so it never returns posts from private
  spaces the caller can't read.

Requires Phase 1 (user_interest_tags). Idempotent.
*/

-- ============================================================
-- 1. Columns on community_boards
-- ============================================================
ALTER TABLE public.community_boards
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS member_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_join_all boolean NOT NULL DEFAULT false;

ALTER TABLE public.community_boards DROP CONSTRAINT IF EXISTS community_boards_visibility_check;
ALTER TABLE public.community_boards
  ADD CONSTRAINT community_boards_visibility_check CHECK (visibility IN ('open', 'private'));

-- ============================================================
-- 2. Members
-- ============================================================
CREATE TABLE IF NOT EXISTS public.community_board_members (
  board_id uuid NOT NULL REFERENCES public.community_boards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'mod', 'member')),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'interests', 'admin', 'invite', 'request')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (board_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_board_members_user ON public.community_board_members (user_id);
ALTER TABLE public.community_board_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_board_members REPLICA IDENTITY FULL;

-- ============================================================
-- 3. Helpers (SECURITY DEFINER so policies don't recurse)
-- ============================================================
CREATE OR REPLACE FUNCTION public.board_role(p_board_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.community_board_members
  WHERE board_id = p_board_id AND user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_board_member(p_board_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_board_members
    WHERE board_id = p_board_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_read_board(p_board_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_boards b
    WHERE b.id = p_board_id
      AND (b.visibility = 'open' OR public.is_board_member(b.id) OR public.is_admin())
  );
$$;

CREATE OR REPLACE FUNCTION public.can_moderate_board(p_board_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(public.board_role(p_board_id) IN ('owner', 'mod'), false) OR public.is_admin();
$$;

-- Age verified AND (welcome window OR trial OR paid). Mirrors check_access().
CREATE OR REPLACE FUNCTION public.has_social_access()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((public.check_access() ->> 'can_access_social')::boolean, false)
      OR public.is_admin();
$$;

REVOKE EXECUTE ON FUNCTION public.board_role(uuid), public.is_board_member(uuid),
  public.can_read_board(uuid), public.can_moderate_board(uuid), public.has_social_access()
FROM anon, public;
GRANT EXECUTE ON FUNCTION public.board_role(uuid), public.is_board_member(uuid),
  public.can_read_board(uuid), public.can_moderate_board(uuid), public.has_social_access()
TO authenticated;

-- Member policies
DROP POLICY IF EXISTS "board_members_select" ON public.community_board_members;
CREATE POLICY "board_members_select" ON public.community_board_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_read_board(board_id));

-- Self-join: open, approved spaces only, as a plain member.
DROP POLICY IF EXISTS "board_members_join_open" ON public.community_board_members;
CREATE POLICY "board_members_join_open" ON public.community_board_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'member'
    AND source = 'manual'
    AND EXISTS (
      SELECT 1 FROM public.community_boards b
      WHERE b.id = board_id AND b.visibility = 'open' AND b.is_approved = true
    )
  );

-- Leave (owners can't leave their own space).
DROP POLICY IF EXISTS "board_members_leave" ON public.community_board_members;
CREATE POLICY "board_members_leave" ON public.community_board_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND role <> 'owner');

-- member_count
CREATE OR REPLACE FUNCTION public.update_board_member_count()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_boards SET member_count = member_count + 1 WHERE id = NEW.board_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_boards SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.board_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_board_member_count ON public.community_board_members;
CREATE TRIGGER trg_board_member_count
  AFTER INSERT OR DELETE ON public.community_board_members
  FOR EACH ROW EXECUTE FUNCTION public.update_board_member_count();

-- ============================================================
-- 4. Rooms
-- ============================================================
CREATE TABLE IF NOT EXISTS public.community_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.community_boards(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (name ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(name) <= 32),
  topic text CHECK (topic IS NULL OR char_length(topic) <= 200),
  kind text NOT NULL DEFAULT 'chat' CHECK (kind IN ('chat', 'announcements')),
  sort_order int NOT NULL DEFAULT 0,
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (board_id, name)
);
CREATE INDEX IF NOT EXISTS idx_rooms_board ON public.community_rooms (board_id, sort_order);
ALTER TABLE public.community_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_rooms REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS "rooms_select" ON public.community_rooms;
CREATE POLICY "rooms_select" ON public.community_rooms
  FOR SELECT TO authenticated USING (public.can_read_board(board_id));

DROP POLICY IF EXISTS "rooms_insert_mods" ON public.community_rooms;
CREATE POLICY "rooms_insert_mods" ON public.community_rooms
  FOR INSERT TO authenticated WITH CHECK (public.can_moderate_board(board_id));

DROP POLICY IF EXISTS "rooms_update_mods" ON public.community_rooms;
CREATE POLICY "rooms_update_mods" ON public.community_rooms
  FOR UPDATE TO authenticated
  USING (public.can_moderate_board(board_id))
  WITH CHECK (public.can_moderate_board(board_id));

DROP POLICY IF EXISTS "rooms_delete_mods" ON public.community_rooms;
CREATE POLICY "rooms_delete_mods" ON public.community_rooms
  FOR DELETE TO authenticated USING (public.can_moderate_board(board_id));

-- ============================================================
-- 5. Room messages (insert only via edge function / service role)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.community_room_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.community_rooms(id) ON DELETE CASCADE,
  board_id uuid NOT NULL REFERENCES public.community_boards(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  reply_to_id uuid REFERENCES public.community_room_messages(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'user' CHECK (kind IN ('user', 'system', 'bot')),
  is_ai_generated boolean NOT NULL DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_room_messages_room_created ON public.community_room_messages (room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_room_messages_board_created ON public.community_room_messages (board_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_room_messages_author ON public.community_room_messages (author_id, created_at DESC);
ALTER TABLE public.community_room_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_room_messages REPLICA IDENTITY FULL;

DROP POLICY IF EXISTS "room_messages_select" ON public.community_room_messages;
CREATE POLICY "room_messages_select" ON public.community_room_messages
  FOR SELECT TO authenticated USING (public.can_read_board(board_id));

-- Keep board_id in sync with the room and bump last_message_at.
CREATE OR REPLACE FUNCTION public.room_message_before_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  SELECT board_id INTO NEW.board_id FROM public.community_rooms WHERE id = NEW.room_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_room_message_before_insert ON public.community_room_messages;
CREATE TRIGGER trg_room_message_before_insert
  BEFORE INSERT ON public.community_room_messages
  FOR EACH ROW EXECUTE FUNCTION public.room_message_before_insert();

CREATE OR REPLACE FUNCTION public.room_message_after_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.community_rooms SET last_message_at = NEW.created_at WHERE id = NEW.room_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_room_message_after_insert ON public.community_room_messages;
CREATE TRIGGER trg_room_message_after_insert
  AFTER INSERT ON public.community_room_messages
  FOR EACH ROW EXECUTE FUNCTION public.room_message_after_insert();

-- Soft delete: the author, or a space owner/mod/admin.
CREATE OR REPLACE FUNCTION public.delete_room_message(p_message_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_msg public.community_room_messages%ROWTYPE;
BEGIN
  SELECT * INTO v_msg FROM public.community_room_messages WHERE id = p_message_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_msg.author_id IS DISTINCT FROM auth.uid() AND NOT public.can_moderate_board(v_msg.board_id) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  UPDATE public.community_room_messages SET deleted_at = now(), body = '[deleted]' WHERE id = p_message_id;
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.delete_room_message(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.delete_room_message(uuid) TO authenticated;

-- ============================================================
-- 6. Read markers (unread dots)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.community_room_reads (
  room_id uuid NOT NULL REFERENCES public.community_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);
ALTER TABLE public.community_room_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "room_reads_own" ON public.community_room_reads;
CREATE POLICY "room_reads_own" ON public.community_room_reads
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 7. Interest map + dismissed suggestions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.community_interest_map (
  interest text NOT NULL,
  board_id uuid NOT NULL REFERENCES public.community_boards(id) ON DELETE CASCADE,
  room_name text,
  gender_filter text,
  PRIMARY KEY (interest, board_id)
);
ALTER TABLE public.community_interest_map ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "interest_map_select" ON public.community_interest_map;
CREATE POLICY "interest_map_select" ON public.community_interest_map
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "interest_map_admin" ON public.community_interest_map;
CREATE POLICY "interest_map_admin" ON public.community_interest_map
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.community_space_dismissals (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  board_id uuid NOT NULL REFERENCES public.community_boards(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, board_id)
);
ALTER TABLE public.community_space_dismissals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "space_dismissals_own" ON public.community_space_dismissals;
CREATE POLICY "space_dismissals_own" ON public.community_space_dismissals
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 8. New spaces get a #general room and their owner as a member
-- ============================================================
CREATE OR REPLACE FUNCTION public.setup_new_space()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.community_rooms (board_id, name, kind, sort_order, created_by)
  VALUES (NEW.id, 'general', 'chat', 0, NEW.owner_id)
  ON CONFLICT (board_id, name) DO NOTHING;

  INSERT INTO public.community_board_members (board_id, user_id, role, source)
  VALUES (NEW.id, NEW.owner_id, 'owner', 'admin')
  ON CONFLICT (board_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_setup_new_space ON public.community_boards;
CREATE TRIGGER trg_setup_new_space
  AFTER INSERT ON public.community_boards
  FOR EACH ROW EXECUTE FUNCTION public.setup_new_space();

-- ============================================================
-- 9. Tighten posts / comments for private spaces
-- ============================================================
DROP POLICY IF EXISTS "community_posts_select_all" ON public.community_posts;
DROP POLICY IF EXISTS "community_posts_select_readable" ON public.community_posts;
CREATE POLICY "community_posts_select_readable" ON public.community_posts
  FOR SELECT TO authenticated USING (public.can_read_board(board_id));

-- Replaces the approval migration's insert policy (permissive policies are OR'd,
-- so the old one must go or it would still allow posting into private spaces).
DROP POLICY IF EXISTS "community_posts_insert_own" ON public.community_posts;
DROP POLICY IF EXISTS "community_posts_insert_approved_boards" ON public.community_posts;
CREATE POLICY "community_posts_insert_approved_boards" ON public.community_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND public.can_read_board(board_id)
    AND (
      EXISTS (SELECT 1 FROM public.community_boards b WHERE b.id = board_id AND b.is_approved = true)
      OR public.is_current_user_super_user()
    )
  );

-- Comments inherit their post's visibility (the subquery is itself filtered by posts RLS).
DROP POLICY IF EXISTS "community_comments_select_all" ON public.community_comments;
DROP POLICY IF EXISTS "community_comments_select_readable" ON public.community_comments;
CREATE POLICY "community_comments_select_readable" ON public.community_comments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.community_posts p WHERE p.id = post_id));

DROP POLICY IF EXISTS "community_comments_insert_own" ON public.community_comments;
CREATE POLICY "community_comments_insert_own" ON public.community_comments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id AND EXISTS (SELECT 1 FROM public.community_posts p WHERE p.id = post_id));

-- Search: same as before, plus the private-space filter. Private spaces are
-- still returned as 'board' results so they can be found and requested.
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
  WHERE b.is_approved = true AND (b.name ILIKE '%' || p_query || '%' OR b.description ILIKE '%' || p_query || '%')
  ORDER BY rank DESC, b.name ASC
  LIMIT p_limit;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.community_search(text, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.community_search(text, int) TO authenticated;

-- ============================================================
-- 10. RPCs the frontend calls
-- ============================================================

-- Core placement logic. Internal; takes any user id.
CREATE OR REPLACE FUNCTION public.join_spaces_from_interests_for(p_user_id uuid)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tags text[];
  v_gender text;
  v_count int;
BEGIN
  v_tags := public.user_interest_tags(p_user_id, true);
  SELECT gender INTO v_gender FROM public.user_profiles WHERE id = p_user_id;

  WITH defaults AS (
    SELECT b.id AS board_id
    FROM public.community_boards b
    WHERE b.auto_join_all AND b.is_approved AND b.visibility = 'open'
  ),
  matched AS (
    SELECT m.board_id
    FROM public.community_interest_map m
    JOIN public.community_boards b ON b.id = m.board_id AND b.is_approved AND b.visibility = 'open'
    WHERE m.interest = ANY (v_tags)
      AND (m.gender_filter IS NULL OR m.gender_filter = v_gender)
      AND NOT EXISTS (
        SELECT 1 FROM public.community_space_dismissals d
        WHERE d.user_id = p_user_id AND d.board_id = m.board_id
      )
    GROUP BY m.board_id
    ORDER BY count(*) DESC, m.board_id
    LIMIT 6
  )
  INSERT INTO public.community_board_members (board_id, user_id, role, source)
  SELECT board_id, p_user_id, 'member', 'interests'
  FROM (SELECT board_id FROM defaults UNION SELECT board_id FROM matched) picked
  ON CONFLICT (board_id, user_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.join_spaces_from_interests_for(uuid) FROM anon, authenticated, public;

-- Client wrapper: call right after the questionnaire is saved, and when the
-- House page loads for a user who has no spaces yet.
CREATE OR REPLACE FUNCTION public.join_spaces_from_interests()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  RETURN public.join_spaces_from_interests_for(auth.uid());
END;
$$;
REVOKE EXECUTE ON FUNCTION public.join_spaces_from_interests() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.join_spaces_from_interests() TO authenticated;

-- Sidebar: my spaces with unread counts.
CREATE OR REPLACE FUNCTION public.get_my_spaces()
RETURNS TABLE (
  board_id uuid, name text, description text, icon text, color text, category text,
  visibility text, member_count int, role text, unread_count int, last_message_at timestamptz
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
    (SELECT max(rm.last_message_at) FROM public.community_rooms rm WHERE rm.board_id = b.id)
  FROM public.community_board_members m
  JOIN public.community_boards b ON b.id = m.board_id
  WHERE m.user_id = auth.uid()
  ORDER BY b.is_pinned DESC, b.sort_order, b.name;
$$;
REVOKE EXECUTE ON FUNCTION public.get_my_spaces() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_my_spaces() TO authenticated;

-- "You might like" cards: spaces matching my interests that I haven't joined or dismissed.
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
    AND NOT EXISTS (SELECT 1 FROM public.community_board_members x WHERE x.board_id = b.id AND x.user_id = auth.uid())
    AND NOT EXISTS (SELECT 1 FROM public.community_space_dismissals d WHERE d.board_id = b.id AND d.user_id = auth.uid())
  GROUP BY b.id
  ORDER BY count(*) DESC, b.member_count DESC
  LIMIT p_limit;
$$;
REVOKE EXECUTE ON FUNCTION public.get_space_suggestions(int) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_space_suggestions(int) TO authenticated;

-- Member list with display names (user_profiles isn't readable by other users).
CREATE OR REPLACE FUNCTION public.get_space_members(p_board_id uuid)
RETURNS TABLE (user_id uuid, display_name text, avatar_config jsonb, role text, is_bot boolean, joined_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.user_id,
         COALESCE(mp.display_name, up.nickname, up.name, 'Member'),
         COALESCE(mp.avatar_config, up.avatar_config),
         m.role,
         COALESCE(up.is_bot, false),
         m.joined_at
  FROM public.community_board_members m
  LEFT JOIN public.member_profiles mp ON mp.user_id = m.user_id
  LEFT JOIN public.user_profiles up ON up.id = m.user_id
  WHERE m.board_id = p_board_id
    AND public.can_read_board(p_board_id)
  ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'mod' THEN 1 ELSE 2 END, 2;
$$;
REVOKE EXECUTE ON FUNCTION public.get_space_members(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_space_members(uuid) TO authenticated;

-- Message history page (newest first) with author names.
CREATE OR REPLACE FUNCTION public.get_room_messages(
  p_room_id uuid,
  p_before timestamptz DEFAULT NULL,
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  id uuid, room_id uuid, author_id uuid, author_name text, author_avatar jsonb, author_is_bot boolean,
  body text, reply_to_id uuid, kind text, is_ai_generated boolean, deleted_at timestamptz, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT msg.id, msg.room_id, msg.author_id,
         COALESCE(mp.display_name, up.nickname, up.name, 'Member'),
         COALESCE(mp.avatar_config, up.avatar_config),
         COALESCE(up.is_bot, false),
         msg.body, msg.reply_to_id, msg.kind, msg.is_ai_generated, msg.deleted_at, msg.created_at
  FROM public.community_room_messages msg
  LEFT JOIN public.member_profiles mp ON mp.user_id = msg.author_id
  LEFT JOIN public.user_profiles up ON up.id = msg.author_id
  WHERE msg.room_id = p_room_id
    AND public.can_read_board(msg.board_id)
    AND (p_before IS NULL OR msg.created_at < p_before)
  ORDER BY msg.created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 100);
$$;
REVOKE EXECUTE ON FUNCTION public.get_room_messages(uuid, timestamptz, int) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_room_messages(uuid, timestamptz, int) TO authenticated;

-- Owners/mods of a PRIVATE space add people from their own accepted friends.
CREATE OR REPLACE FUNCTION public.add_friend_to_space(p_board_id uuid, p_friend_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.can_moderate_board(p_board_id) THEN
    RAISE EXCEPTION 'Only space owners and mods can add people';
  END IF;
  IF NOT public.is_admin() AND NOT EXISTS (
    SELECT 1 FROM public.im_friendships f
    WHERE f.status = 'accepted'
      AND ((f.requester_id = auth.uid() AND f.addressee_id = p_friend_id)
        OR (f.addressee_id = auth.uid() AND f.requester_id = p_friend_id))
  ) THEN
    RAISE EXCEPTION 'You can only add your friends';
  END IF;
  INSERT INTO public.community_board_members (board_id, user_id, role, source)
  VALUES (p_board_id, p_friend_id, 'member', 'invite')
  ON CONFLICT (board_id, user_id) DO NOTHING;
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.add_friend_to_space(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.add_friend_to_space(uuid, uuid) TO authenticated;

-- ============================================================
-- 11. Realtime
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'community_room_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.community_room_messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'community_board_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.community_board_members;
  END IF;
END $$;

-- ============================================================
-- 12. Seed: new spaces, rooms, Velvet Alpha, interest map
-- ============================================================
INSERT INTO public.community_boards (id, name, description, color, icon, owner_id, is_pinned, is_approved, sort_order, category)
VALUES
  ('b0000000-0000-0000-0000-000000000019', 'Books & Writing',
   'What you''re reading, what you''re writing, and what you can''t stop thinking about.',
   'amber', 'BookOpen', '3a195a32-ee68-4164-9bd5-40499627a378', false, true, 165, 'Interests & Hobbies'),
  ('b0000000-0000-0000-0000-000000000020', 'Creative Corner',
   'Photos, art, crafts, style, home and garden. Show what you made.',
   'purple', 'Palette', '3a195a32-ee68-4164-9bd5-40499627a378', false, true, 166, 'Interests & Hobbies'),
  ('b0000000-0000-0000-0000-000000000021', 'Pets & Animals',
   'Post your pets. That''s it. That''s the space.',
   'green', 'Cat', '3a195a32-ee68-4164-9bd5-40499627a378', false, true, 167, 'Interests & Hobbies'),
  ('b0000000-0000-0000-0000-000000000100', 'Velvet Alpha',
   'The founding crew. Bugs, ideas, wins, and first looks at what''s next.',
   'pink', 'Sparkles', '3a195a32-ee68-4164-9bd5-40499627a378', true, true, 1, 'Community Hub')
ON CONFLICT (id) DO NOTHING;

-- Maya and Jordan were created before user_profiles.is_bot existed; flag them so
-- member lists label them and they never earn medals or get auto-placed.
UPDATE public.user_profiles SET is_bot = true
WHERE id IN ('b0b00000-0000-0000-0000-000000000001', 'b0b00000-0000-0000-0000-000000000002')
  AND COALESCE(is_bot, false) = false;

-- The approval trigger marks migration inserts as unapproved (no auth.uid()); approve them.
UPDATE public.community_boards SET is_approved = true
WHERE id IN ('b0000000-0000-0000-0000-000000000019', 'b0000000-0000-0000-0000-000000000020',
             'b0000000-0000-0000-0000-000000000021', 'b0000000-0000-0000-0000-000000000100');
UPDATE public.community_boards SET visibility = 'private' WHERE id = 'b0000000-0000-0000-0000-000000000100';
UPDATE public.community_boards SET auto_join_all = true
WHERE id IN ('b0000000-0000-0000-0000-000000000001', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890');

-- Every existing space: #general + owner membership (new ones get it from the trigger).
INSERT INTO public.community_rooms (board_id, name, kind, sort_order, created_by)
SELECT b.id, 'general', 'chat', 0, b.owner_id FROM public.community_boards b
ON CONFLICT (board_id, name) DO NOTHING;

INSERT INTO public.community_board_members (board_id, user_id, role, source)
SELECT b.id, b.owner_id, 'owner', 'admin' FROM public.community_boards b
ON CONFLICT (board_id, user_id) DO NOTHING;

-- Updates is read-only for members.
UPDATE public.community_rooms SET kind = 'announcements'
WHERE board_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' AND name = 'general';

INSERT INTO public.community_rooms (board_id, name, topic, kind, sort_order)
SELECT v.board_id::uuid, v.name, v.topic, v.kind, v.sort_order
FROM (VALUES
  ('b0000000-0000-0000-0000-000000000100', 'announcements', 'From Tim. Read these first.', 'announcements', -1),
  ('b0000000-0000-0000-0000-000000000100', 'bugs', 'What you did, what happened, screenshot if you can.', 'chat', 1),
  ('b0000000-0000-0000-0000-000000000100', 'feature-ideas', 'What should Velvet do next?', 'chat', 2),
  ('b0000000-0000-0000-0000-000000000100', 'wins', 'Hit a goal? Post it here.', 'chat', 3),
  ('b0000000-0000-0000-0000-000000000012', 'looking-for-group', 'Find people to run with tonight.', 'chat', 1),
  ('b0000000-0000-0000-0000-000000000012', 'esports', NULL, 'chat', 2),
  ('b0000000-0000-0000-0000-000000000012', 'clips', 'Best plays, worst fails.', 'chat', 3),
  ('b0000000-0000-0000-0000-000000000015', 'basketball', NULL, 'chat', 1),
  ('b0000000-0000-0000-0000-000000000015', 'football', NULL, 'chat', 2),
  ('b0000000-0000-0000-0000-000000000015', 'soccer', NULL, 'chat', 3),
  ('b0000000-0000-0000-0000-000000000015', 'baseball', NULL, 'chat', 4),
  ('b0000000-0000-0000-0000-000000000015', 'mma-boxing', NULL, 'chat', 5),
  ('b0000000-0000-0000-0000-000000000013', 'movies-and-tv', NULL, 'chat', 1),
  ('b0000000-0000-0000-0000-000000000013', 'music', NULL, 'chat', 2),
  ('b0000000-0000-0000-0000-000000000013', 'anime', NULL, 'chat', 3),
  ('b0000000-0000-0000-0000-000000000011', 'daily-wins', 'What did you get done today?', 'chat', 1),
  ('b0000000-0000-0000-0000-000000000014', 'ai', NULL, 'chat', 1)
) AS v(board_id, name, topic, kind, sort_order)
ON CONFLICT (board_id, name) DO NOTHING;

-- Interest -> space. Values are exactly what personalBank.ts stores.
-- Edit this table (not code) to change placement.
INSERT INTO public.community_interest_map (interest, board_id, room_name, gender_filter)
SELECT v.interest, v.board_id::uuid, v.room_name, v.gender_filter
FROM (VALUES
  -- Gaming Lounge
  ('Gaming', 'b0000000-0000-0000-0000-000000000012', NULL, NULL),
  ('Board Games/Puzzles', 'b0000000-0000-0000-0000-000000000012', NULL, NULL),
  ('Gaming Tech', 'b0000000-0000-0000-0000-000000000012', NULL, NULL),
  ('Esports', 'b0000000-0000-0000-0000-000000000012', 'esports', NULL),
  ('Twitch/Streaming', 'b0000000-0000-0000-0000-000000000012', 'clips', NULL),
  ('Gaming night', 'b0000000-0000-0000-0000-000000000012', NULL, NULL),
  -- Sports Talk
  ('Basketball', 'b0000000-0000-0000-0000-000000000015', 'basketball', NULL),
  ('Football', 'b0000000-0000-0000-0000-000000000015', 'football', NULL),
  ('Soccer', 'b0000000-0000-0000-0000-000000000015', 'soccer', NULL),
  ('Baseball', 'b0000000-0000-0000-0000-000000000015', 'baseball', NULL),
  ('MMA/Boxing', 'b0000000-0000-0000-0000-000000000015', 'mma-boxing', NULL),
  ('Tennis', 'b0000000-0000-0000-0000-000000000015', NULL, NULL),
  ('Golf', 'b0000000-0000-0000-0000-000000000015', NULL, NULL),
  ('Skateboarding', 'b0000000-0000-0000-0000-000000000015', NULL, NULL),
  ('Live at the game', 'b0000000-0000-0000-0000-000000000015', NULL, NULL),
  -- Fitness & Motivation
  ('Fitness/Working Out', 'b0000000-0000-0000-0000-000000000011', NULL, NULL),
  ('Fitness/Wellness', 'b0000000-0000-0000-0000-000000000011', NULL, NULL),
  ('Running', 'b0000000-0000-0000-0000-000000000011', NULL, NULL),
  ('Cycling', 'b0000000-0000-0000-0000-000000000011', NULL, NULL),
  ('Swimming', 'b0000000-0000-0000-0000-000000000011', NULL, NULL),
  ('Dancing', 'b0000000-0000-0000-0000-000000000011', NULL, NULL),
  ('Yoga/Meditation', 'b0000000-0000-0000-0000-000000000011', NULL, NULL),
  ('Gym at 6am', 'b0000000-0000-0000-0000-000000000011', 'daily-wins', NULL),
  -- Cooking & Recipes
  ('Cooking', 'b0000000-0000-0000-0000-000000000009', NULL, NULL),
  ('Food & Drink', 'b0000000-0000-0000-0000-000000000009', NULL, NULL),
  ('Wine & Spirits', 'b0000000-0000-0000-0000-000000000009', NULL, NULL),
  ('Cook at home', 'b0000000-0000-0000-0000-000000000009', NULL, NULL),
  -- Movies, Music & Pop Culture
  ('Movies/TV Shows', 'b0000000-0000-0000-0000-000000000013', 'movies-and-tv', NULL),
  ('Movies', 'b0000000-0000-0000-0000-000000000013', 'movies-and-tv', NULL),
  ('TV Shows', 'b0000000-0000-0000-0000-000000000013', 'movies-and-tv', NULL),
  ('Reality TV', 'b0000000-0000-0000-0000-000000000013', 'movies-and-tv', NULL),
  ('Documentaries', 'b0000000-0000-0000-0000-000000000013', 'movies-and-tv', NULL),
  ('Stand-up Comedy', 'b0000000-0000-0000-0000-000000000013', NULL, NULL),
  ('Theater/Plays', 'b0000000-0000-0000-0000-000000000013', NULL, NULL),
  ('Podcasts', 'b0000000-0000-0000-0000-000000000013', NULL, NULL),
  ('YouTube', 'b0000000-0000-0000-0000-000000000013', NULL, NULL),
  ('Anime', 'b0000000-0000-0000-0000-000000000013', 'anime', NULL),
  ('Manga', 'b0000000-0000-0000-0000-000000000013', 'anime', NULL),
  ('Music (Playing/Listening)', 'b0000000-0000-0000-0000-000000000013', 'music', NULL),
  ('R&B/Soul', 'b0000000-0000-0000-0000-000000000013', 'music', NULL),
  ('Hip-Hop/Rap', 'b0000000-0000-0000-0000-000000000013', 'music', NULL),
  ('Pop', 'b0000000-0000-0000-0000-000000000013', 'music', NULL),
  ('Rock/Alternative', 'b0000000-0000-0000-0000-000000000013', 'music', NULL),
  ('Lo-fi/Chill', 'b0000000-0000-0000-0000-000000000013', 'music', NULL),
  ('Country', 'b0000000-0000-0000-0000-000000000013', 'music', NULL),
  ('Jazz', 'b0000000-0000-0000-0000-000000000013', 'music', NULL),
  ('Classical', 'b0000000-0000-0000-0000-000000000013', 'music', NULL),
  ('Electronic/EDM', 'b0000000-0000-0000-0000-000000000013', 'music', NULL),
  ('Reggae/Dancehall', 'b0000000-0000-0000-0000-000000000013', 'music', NULL),
  ('Latin', 'b0000000-0000-0000-0000-000000000013', 'music', NULL),
  -- Tech & Gadgets
  ('Tech/Gadgets', 'b0000000-0000-0000-0000-000000000014', NULL, NULL),
  ('AI & Machine Learning', 'b0000000-0000-0000-0000-000000000014', 'ai', NULL),
  ('Gadgets/Hardware', 'b0000000-0000-0000-0000-000000000014', NULL, NULL),
  ('Programming/Coding', 'b0000000-0000-0000-0000-000000000014', NULL, NULL),
  ('Crypto/Web3', 'b0000000-0000-0000-0000-000000000014', NULL, NULL),
  ('Science/Space', 'b0000000-0000-0000-0000-000000000014', NULL, NULL),
  ('Cars/EVs', 'b0000000-0000-0000-0000-000000000014', NULL, NULL),
  ('Tech News', 'b0000000-0000-0000-0000-000000000014', NULL, NULL),
  -- Career & Money
  ('Startups/Entrepreneurship', 'b0000000-0000-0000-0000-000000000010', NULL, NULL),
  -- Travel & Adventure
  ('Travel/Exploring', 'b0000000-0000-0000-0000-000000000016', NULL, NULL),
  ('Travel/Adventure', 'b0000000-0000-0000-0000-000000000016', NULL, NULL),
  ('Hiking', 'b0000000-0000-0000-0000-000000000016', NULL, NULL),
  ('Road trip', 'b0000000-0000-0000-0000-000000000016', NULL, NULL),
  ('Sunrise hike', 'b0000000-0000-0000-0000-000000000016', NULL, NULL),
  -- Spirituality & Reflection
  ('Mindfulness/Self-care', 'b0000000-0000-0000-0000-000000000018', NULL, NULL),
  ('Sustainability/Eco', 'b0000000-0000-0000-0000-000000000018', NULL, NULL),
  -- Moms / Dads
  ('Parenting/Family', 'b0000000-0000-0000-0000-000000000007', NULL, 'Female'),
  ('Parenting/Family', 'b0000000-0000-0000-0000-000000000008', NULL, 'Male'),
  -- Books & Writing
  ('Reading', 'b0000000-0000-0000-0000-000000000019', NULL, NULL),
  ('Writing', 'b0000000-0000-0000-0000-000000000019', NULL, NULL),
  ('Books', 'b0000000-0000-0000-0000-000000000019', NULL, NULL),
  -- Creative Corner
  ('Photography', 'b0000000-0000-0000-0000-000000000020', NULL, NULL),
  ('Drawing/Painting', 'b0000000-0000-0000-0000-000000000020', NULL, NULL),
  ('DIY/Crafts', 'b0000000-0000-0000-0000-000000000020', NULL, NULL),
  ('Fashion/Shopping', 'b0000000-0000-0000-0000-000000000020', NULL, NULL),
  ('Fashion/Style', 'b0000000-0000-0000-0000-000000000020', NULL, NULL),
  ('Skincare/Beauty', 'b0000000-0000-0000-0000-000000000020', NULL, NULL),
  ('Home Decor', 'b0000000-0000-0000-0000-000000000020', NULL, NULL),
  ('Gardening', 'b0000000-0000-0000-0000-000000000020', NULL, NULL),
  ('Plants/Gardening', 'b0000000-0000-0000-0000-000000000020', NULL, NULL),
  -- Pets & Animals
  ('Pets/Animals', 'b0000000-0000-0000-0000-000000000021', NULL, NULL)
) AS v(interest, board_id, room_name, gender_filter)
WHERE EXISTS (SELECT 1 FROM public.community_boards b WHERE b.id = v.board_id::uuid)
ON CONFLICT (interest, board_id) DO NOTHING;

-- ============================================================
-- 13. Backfill: place everyone who already finished the questionnaire
-- ============================================================
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id FROM public.user_profiles
    WHERE profile_completed = true AND COALESCE(is_bot, false) = false
  LOOP
    PERFORM public.join_spaces_from_interests_for(r.id);
  END LOOP;
END $$;
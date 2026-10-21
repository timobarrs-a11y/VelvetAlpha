/*
# Phase 4: Crews (roles, private-but-listed spaces, invites, sub-spaces, mentions)

## Plain-English summary
The rule: every space is LISTED and searchable. A crew can lock its door,
but the door is always on the map. Visibility now has four values:
- open     anyone can read; join with one tap
- request  listed; you ask, an owner/mod approves
- invite   listed; you need an invite link
- private  listed; owners/mods add people from their friends (Velvet Alpha)

Also adds:
- sub-spaces: a crew can live inside a parent space (2K27 Crew inside
  Gaming Lounge). Members of the parent can create one and it is approved
  instantly; top-level spaces still need Tim's approval.
- mods, kicks, per-space bans, transfer of ownership
- custom role tags with colors (like Discord roles)
- invite links with optional max uses and expiry
- @mentions: the client writes <@user-uuid> in the message body; the
  community-room-send function turns those into 'mention' notifications.

Requires Phase 2. Idempotent.

## New Tables
- community_board_bans: per-space bans (board_id, user_id, banned_by, reason)
- community_join_requests: pending/approved/declined join requests
- community_invites: 8-character invite codes with max_uses, expiry, revoked
- community_role_tags: colored role tags per space (name, color, sort_order)
- community_member_tags: assigns role tags to members (many-to-many)

## Modified Tables
- community_boards: visibility CHECK now includes 'private'; adds parent_board_id column
- community_notifications: type CHECK adds 'mention','join_request','join_approved'; adds meta jsonb column

## New RPCs
- request_to_join_space, decide_join_request, get_join_requests
- create_space_invite, get_invite_preview, redeem_space_invite
- set_member_role, transfer_space_ownership, remove_space_member, unban_space_member
- update_space_settings
- get_space_members (replaced: now returns tags jsonb)
- get_space_directory (new: all approved spaces with my relationship)

## Security
- RLS enabled on all new tables
- Bans: readable by mods or the banned user
- Join requests: readable by requester or mods
- Invites: readable/writable by mods only
- Role tags + member tags: readable by anyone who can read the board, writable by mods
*/

-- ============================================================
-- 1. Visibility, sub-spaces
-- ============================================================
ALTER TABLE public.community_boards DROP CONSTRAINT IF EXISTS community_boards_visibility_check;
ALTER TABLE public.community_boards
  ADD CONSTRAINT community_boards_visibility_check CHECK (visibility IN ('open', 'request', 'invite', 'private'));

ALTER TABLE public.community_boards
  ADD COLUMN IF NOT EXISTS parent_board_id uuid REFERENCES public.community_boards(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_boards_parent ON public.community_boards (parent_board_id) WHERE parent_board_id IS NOT NULL;

-- Sub-spaces created by a member of the parent are approved immediately.
CREATE OR REPLACE FUNCTION public.set_board_approval_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF is_current_user_super_user() THEN
    NEW.is_approved := true;
  ELSIF NEW.parent_board_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.community_board_members
    WHERE board_id = NEW.parent_board_id AND user_id = auth.uid()
  ) THEN
    NEW.is_approved := true;
  ELSE
    NEW.is_approved := false;
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. Bans
-- ============================================================
CREATE TABLE IF NOT EXISTS public.community_board_bans (
  board_id uuid NOT NULL REFERENCES public.community_boards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  banned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (board_id, user_id)
);
ALTER TABLE public.community_board_bans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "board_bans_mods_select" ON public.community_board_bans;
CREATE POLICY "board_bans_mods_select" ON public.community_board_bans
  FOR SELECT TO authenticated USING (public.can_moderate_board(board_id) OR user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_banned_from_board(p_board_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.community_board_bans WHERE board_id = p_board_id AND user_id = p_user_id);
$$;
REVOKE EXECUTE ON FUNCTION public.is_banned_from_board(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_banned_from_board(uuid, uuid) TO authenticated;

-- Self-join still only for open spaces; now also blocked by a ban.
DROP POLICY IF EXISTS "board_members_join_open" ON public.community_board_members;
CREATE POLICY "board_members_join_open" ON public.community_board_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'member'
    AND source = 'manual'
    AND NOT public.is_banned_from_board(board_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.community_boards b
      WHERE b.id = board_id AND b.visibility = 'open' AND b.is_approved = true
    )
  );

-- ============================================================
-- 3. Join requests
-- ============================================================
CREATE TABLE IF NOT EXISTS public.community_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.community_boards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  message text CHECK (message IS NULL OR char_length(message) <= 300),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_join_requests_pending
  ON public.community_join_requests (board_id, user_id) WHERE status = 'pending';
ALTER TABLE public.community_join_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "join_requests_select" ON public.community_join_requests;
CREATE POLICY "join_requests_select" ON public.community_join_requests
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.can_moderate_board(board_id));

-- Notification types for this phase.
ALTER TABLE public.community_notifications DROP CONSTRAINT IF EXISTS community_notifications_type_check;
ALTER TABLE public.community_notifications
  ADD CONSTRAINT community_notifications_type_check
  CHECK (type IN ('reply', 'reaction', 'badge', 'weekly', 'mention', 'join_request', 'join_approved'));
ALTER TABLE public.community_notifications ADD COLUMN IF NOT EXISTS meta jsonb;

CREATE OR REPLACE FUNCTION public.request_to_join_space(p_board_id uuid, p_message text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_board public.community_boards%ROWTYPE;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_board FROM public.community_boards WHERE id = p_board_id AND is_approved;
  IF NOT FOUND THEN RAISE EXCEPTION 'Space not found'; END IF;
  IF v_board.visibility <> 'request' THEN RAISE EXCEPTION 'This space does not take requests'; END IF;
  IF public.is_banned_from_board(p_board_id, auth.uid()) THEN RAISE EXCEPTION 'You cannot join this space'; END IF;
  IF public.is_board_member(p_board_id) THEN RAISE EXCEPTION 'Already a member'; END IF;

  INSERT INTO public.community_join_requests (board_id, user_id, message)
  VALUES (p_board_id, auth.uid(), NULLIF(btrim(p_message), ''))
  ON CONFLICT (board_id, user_id) WHERE status = 'pending' DO UPDATE SET message = EXCLUDED.message
  RETURNING id INTO v_id;

  INSERT INTO public.community_notifications (user_id, type, actor_id, meta)
  SELECT m.user_id, 'join_request', auth.uid(),
         jsonb_build_object('board_id', p_board_id, 'board_name', v_board.name, 'request_id', v_id)
  FROM public.community_board_members m
  WHERE m.board_id = p_board_id AND m.role IN ('owner', 'mod');

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decide_join_request(p_request_id uuid, p_approve boolean)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_req public.community_join_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_req FROM public.community_join_requests WHERE id = p_request_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF NOT public.can_moderate_board(v_req.board_id) THEN RAISE EXCEPTION 'Not allowed'; END IF;

  UPDATE public.community_join_requests
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'declined' END,
      decided_by = auth.uid(), decided_at = now()
  WHERE id = p_request_id;

  IF p_approve THEN
    INSERT INTO public.community_board_members (board_id, user_id, role, source)
    VALUES (v_req.board_id, v_req.user_id, 'member', 'request')
    ON CONFLICT (board_id, user_id) DO NOTHING;

    INSERT INTO public.community_notifications (user_id, type, actor_id, meta)
    SELECT v_req.user_id, 'join_approved', auth.uid(), jsonb_build_object('board_id', b.id, 'board_name', b.name)
    FROM public.community_boards b WHERE b.id = v_req.board_id;
  END IF;
  RETURN true;
END;
$$;

-- Pending requests with names, for the owner/mod Requests tab.
CREATE OR REPLACE FUNCTION public.get_join_requests(p_board_id uuid)
RETURNS TABLE (id uuid, user_id uuid, display_name text, avatar_config jsonb, message text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.id, r.user_id,
         COALESCE(mp.display_name, up.nickname, up.name, 'Member'),
         COALESCE(mp.avatar_config, up.avatar_config),
         r.message, r.created_at
  FROM public.community_join_requests r
  LEFT JOIN public.member_profiles mp ON mp.user_id = r.user_id
  LEFT JOIN public.user_profiles up ON up.id = r.user_id
  WHERE r.board_id = p_board_id
    AND r.status = 'pending'
    AND public.can_moderate_board(p_board_id)
  ORDER BY r.created_at;
$$;

-- ============================================================
-- 4. Invite links
-- ============================================================
CREATE TABLE IF NOT EXISTS public.community_invites (
  code text PRIMARY KEY,
  board_id uuid NOT NULL REFERENCES public.community_boards(id) ON DELETE CASCADE,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  max_uses int CHECK (max_uses IS NULL OR max_uses > 0),
  uses int NOT NULL DEFAULT 0,
  expires_at timestamptz,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.community_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invites_mods_select" ON public.community_invites;
CREATE POLICY "invites_mods_select" ON public.community_invites
  FOR SELECT TO authenticated USING (public.can_moderate_board(board_id));
DROP POLICY IF EXISTS "invites_mods_update" ON public.community_invites;
CREATE POLICY "invites_mods_update" ON public.community_invites
  FOR UPDATE TO authenticated
  USING (public.can_moderate_board(board_id)) WITH CHECK (public.can_moderate_board(board_id));

-- Owners/mods of any space can make links. Link format: /join/<code>
CREATE OR REPLACE FUNCTION public.create_space_invite(
  p_board_id uuid, p_max_uses int DEFAULT NULL, p_expires_in_hours int DEFAULT 168
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_code text;
BEGIN
  IF NOT public.can_moderate_board(p_board_id) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  LOOP
    v_code := substr(md5(random()::text || clock_timestamp()::text || auth.uid()::text), 1, 8);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.community_invites WHERE code = v_code);
  END LOOP;
  INSERT INTO public.community_invites (code, board_id, max_uses, expires_at)
  VALUES (v_code, p_board_id, p_max_uses,
          CASE WHEN p_expires_in_hours IS NULL THEN NULL ELSE now() + make_interval(hours => p_expires_in_hours) END);
  RETURN v_code;
END;
$$;

-- Preview before joining (works for non-members; shows only public space info).
CREATE OR REPLACE FUNCTION public.get_invite_preview(p_code text)
RETURNS TABLE (board_id uuid, name text, description text, icon text, color text, member_count int, is_valid boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT b.id, b.name, b.description, b.icon, b.color, b.member_count,
         (NOT i.revoked AND (i.expires_at IS NULL OR i.expires_at > now())
          AND (i.max_uses IS NULL OR i.uses < i.max_uses))
  FROM public.community_invites i
  JOIN public.community_boards b ON b.id = i.board_id
  WHERE i.code = lower(p_code);
$$;

CREATE OR REPLACE FUNCTION public.redeem_space_invite(p_code text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inv public.community_invites%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT * INTO v_inv FROM public.community_invites WHERE code = lower(p_code) FOR UPDATE;
  IF NOT FOUND OR v_inv.revoked
     OR (v_inv.expires_at IS NOT NULL AND v_inv.expires_at <= now())
     OR (v_inv.max_uses IS NOT NULL AND v_inv.uses >= v_inv.max_uses) THEN
    RAISE EXCEPTION 'This invite is no longer valid';
  END IF;
  IF public.is_banned_from_board(v_inv.board_id, auth.uid()) THEN RAISE EXCEPTION 'You cannot join this space'; END IF;

  INSERT INTO public.community_board_members (board_id, user_id, role, source)
  VALUES (v_inv.board_id, auth.uid(), 'member', 'invite')
  ON CONFLICT (board_id, user_id) DO NOTHING;
  IF FOUND THEN
    UPDATE public.community_invites SET uses = uses + 1 WHERE code = v_inv.code;
  END IF;
  RETURN v_inv.board_id;
END;
$$;

-- ============================================================
-- 5. Roles, kicks, bans, ownership
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_member_role(p_board_id uuid, p_user_id uuid, p_role text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_role NOT IN ('mod', 'member') THEN RAISE EXCEPTION 'Role must be mod or member'; END IF;
  IF COALESCE(public.board_role(p_board_id), '') <> 'owner' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only the owner can change roles';
  END IF;
  UPDATE public.community_board_members SET role = p_role
  WHERE board_id = p_board_id AND user_id = p_user_id AND role <> 'owner';
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.transfer_space_ownership(p_board_id uuid, p_new_owner uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF COALESCE(public.board_role(p_board_id), '') <> 'owner' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only the owner can transfer the space';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.community_board_members WHERE board_id = p_board_id AND user_id = p_new_owner) THEN
    RAISE EXCEPTION 'New owner must be a member';
  END IF;
  UPDATE public.community_board_members SET role = 'mod' WHERE board_id = p_board_id AND role = 'owner';
  UPDATE public.community_board_members SET role = 'owner' WHERE board_id = p_board_id AND user_id = p_new_owner;
  UPDATE public.community_boards SET owner_id = p_new_owner WHERE id = p_board_id;
  RETURN true;
END;
$$;

-- Owners can remove anyone but themselves; mods can remove plain members.
CREATE OR REPLACE FUNCTION public.remove_space_member(p_board_id uuid, p_user_id uuid, p_ban boolean DEFAULT false, p_reason text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_my_role text := public.board_role(p_board_id);
  v_their_role text;
BEGIN
  SELECT role INTO v_their_role FROM public.community_board_members WHERE board_id = p_board_id AND user_id = p_user_id;
  IF v_their_role = 'owner' THEN RAISE EXCEPTION 'The owner cannot be removed'; END IF;
  IF NOT (
    public.is_admin()
    OR v_my_role = 'owner'
    OR (v_my_role = 'mod' AND COALESCE(v_their_role, 'member') = 'member')
  ) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  DELETE FROM public.community_board_members WHERE board_id = p_board_id AND user_id = p_user_id;
  IF p_ban THEN
    INSERT INTO public.community_board_bans (board_id, user_id, banned_by, reason)
    VALUES (p_board_id, p_user_id, auth.uid(), p_reason)
    ON CONFLICT (board_id, user_id) DO NOTHING;
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.unban_space_member(p_board_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.can_moderate_board(p_board_id) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  DELETE FROM public.community_board_bans WHERE board_id = p_board_id AND user_id = p_user_id;
  RETURN FOUND;
END;
$$;

-- Owners/mods change name, description, icon, color, visibility of their space.
CREATE OR REPLACE FUNCTION public.update_space_settings(
  p_board_id uuid, p_name text DEFAULT NULL, p_description text DEFAULT NULL,
  p_icon text DEFAULT NULL, p_color text DEFAULT NULL, p_visibility text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.can_moderate_board(p_board_id) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  UPDATE public.community_boards SET
    name = COALESCE(NULLIF(btrim(p_name), ''), name),
    description = COALESCE(p_description, description),
    icon = COALESCE(p_icon, icon),
    color = COALESCE(p_color, color),
    visibility = COALESCE(p_visibility, visibility)
  WHERE id = p_board_id;
  RETURN FOUND;
END;
$$;

-- ============================================================
-- 6. Custom role tags (colored name tags)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.community_role_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.community_boards(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 24),
  color text NOT NULL DEFAULT '#a78bfa' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (board_id, name)
);
ALTER TABLE public.community_role_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "role_tags_select" ON public.community_role_tags;
CREATE POLICY "role_tags_select" ON public.community_role_tags
  FOR SELECT TO authenticated USING (public.can_read_board(board_id));
DROP POLICY IF EXISTS "role_tags_write" ON public.community_role_tags;
CREATE POLICY "role_tags_write" ON public.community_role_tags
  FOR ALL TO authenticated
  USING (public.can_moderate_board(board_id)) WITH CHECK (public.can_moderate_board(board_id));

CREATE TABLE IF NOT EXISTS public.community_member_tags (
  board_id uuid NOT NULL,
  user_id uuid NOT NULL,
  tag_id uuid NOT NULL REFERENCES public.community_role_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (board_id, user_id, tag_id),
  FOREIGN KEY (board_id, user_id) REFERENCES public.community_board_members(board_id, user_id) ON DELETE CASCADE
);
ALTER TABLE public.community_member_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "member_tags_select" ON public.community_member_tags;
CREATE POLICY "member_tags_select" ON public.community_member_tags
  FOR SELECT TO authenticated USING (public.can_read_board(board_id));
DROP POLICY IF EXISTS "member_tags_write" ON public.community_member_tags;
CREATE POLICY "member_tags_write" ON public.community_member_tags
  FOR ALL TO authenticated
  USING (public.can_moderate_board(board_id))
  WITH CHECK (
    public.can_moderate_board(board_id)
    AND EXISTS (SELECT 1 FROM public.community_role_tags t WHERE t.id = tag_id AND t.board_id = community_member_tags.board_id)
  );

-- Member list now includes tags.
DROP FUNCTION IF EXISTS public.get_space_members(uuid);
CREATE OR REPLACE FUNCTION public.get_space_members(p_board_id uuid)
RETURNS TABLE (user_id uuid, display_name text, avatar_config jsonb, role text, is_bot boolean, joined_at timestamptz, tags jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT m.user_id,
         COALESCE(mp.display_name, up.nickname, up.name, 'Member'),
         COALESCE(mp.avatar_config, up.avatar_config),
         m.role,
         COALESCE(up.is_bot, false),
         m.joined_at,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'color', t.color) ORDER BY t.sort_order)
           FROM public.community_member_tags mt JOIN public.community_role_tags t ON t.id = mt.tag_id
           WHERE mt.board_id = m.board_id AND mt.user_id = m.user_id
         ), '[]'::jsonb)
  FROM public.community_board_members m
  LEFT JOIN public.member_profiles mp ON mp.user_id = m.user_id
  LEFT JOIN public.user_profiles up ON up.id = m.user_id
  WHERE m.board_id = p_board_id
    AND public.can_read_board(p_board_id)
  ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'mod' THEN 1 ELSE 2 END, 2;
$$;

-- ============================================================
-- 7. Directory: every approved space, with my relationship to it
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_space_directory(p_parent_id uuid DEFAULT NULL, p_query text DEFAULT NULL)
RETURNS TABLE (
  board_id uuid, parent_board_id uuid, name text, description text, icon text, color text, category text,
  visibility text, member_count int, is_member boolean, has_pending_request boolean, sub_space_count int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT b.id, b.parent_board_id, b.name, b.description, b.icon, b.color, b.category,
         b.visibility, b.member_count,
         public.is_board_member(b.id),
         EXISTS (SELECT 1 FROM public.community_join_requests r
                 WHERE r.board_id = b.id AND r.user_id = auth.uid() AND r.status = 'pending'),
         (SELECT count(*)::int FROM public.community_boards c WHERE c.parent_board_id = b.id AND c.is_approved)
  FROM public.community_boards b
  WHERE b.is_approved
    -- With a search query and no parent: search every level. Otherwise: one level of the tree.
    AND ((p_parent_id IS NULL AND p_query IS NOT NULL) OR b.parent_board_id IS NOT DISTINCT FROM p_parent_id)
    AND (p_query IS NULL OR b.name ILIKE '%' || p_query || '%' OR b.description ILIKE '%' || p_query || '%')
  ORDER BY b.is_pinned DESC, b.member_count DESC, b.name
  LIMIT 200;
$$;

-- ============================================================
-- 8. Grants
-- ============================================================
REVOKE EXECUTE ON FUNCTION
  public.request_to_join_space(uuid, text), public.decide_join_request(uuid, boolean),
  public.get_join_requests(uuid),
  public.create_space_invite(uuid, int, int), public.get_invite_preview(text), public.redeem_space_invite(text),
  public.set_member_role(uuid, uuid, text), public.transfer_space_ownership(uuid, uuid),
  public.remove_space_member(uuid, uuid, boolean, text), public.unban_space_member(uuid, uuid),
  public.update_space_settings(uuid, text, text, text, text, text),
  public.get_space_members(uuid), public.get_space_directory(uuid, text)
FROM anon, public;
GRANT EXECUTE ON FUNCTION
  public.request_to_join_space(uuid, text), public.decide_join_request(uuid, boolean),
  public.get_join_requests(uuid),
  public.create_space_invite(uuid, int, int), public.get_invite_preview(text), public.redeem_space_invite(text),
  public.set_member_role(uuid, uuid, text), public.transfer_space_ownership(uuid, uuid),
  public.remove_space_member(uuid, uuid, boolean, text), public.unban_space_member(uuid, uuid),
  public.update_space_settings(uuid, text, text, text, text, text),
  public.get_space_members(uuid), public.get_space_directory(uuid, text)
TO authenticated;

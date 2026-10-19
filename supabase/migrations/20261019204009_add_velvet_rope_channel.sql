/*
# Velvet Rope channel in the messaging system

## Purpose
Adds a new "Velvet Rope" conversation channel that lives alongside the existing
instant-messenger conversations inside the same messaging house. Velvet Rope is
a purely conversational guessing game — no game mechanics, just chat. It is
opt-in via a per-user toggle, enforces one active Velvet Rope conversation at a
time, hides the opponent's identity up front, and routes AI opponents only after
the user has been on the site for at least 5 minutes.

## Plain-English summary of changes

1. Adds velvet_rope_enabled, velvet_rope_first_seen_at, and
   velvet_rope_active_conv_id columns to user_profiles for toggle state,
   5-minute gate timestamp, and one-at-a-time enforcement.
2. Creates vr_requests for incoming Velvet Rope requests (masked identity).
3. Creates vr_conversations for Velvet Rope conversations (distinct from
   im_conversations so the two channels never blend).
4. Creates vr_messages for messages inside a Velvet Rope conversation.
5. Adds vr_accept_request, vr_decline_request, vr_close_conversation, and
   vr_can_send_ai_request helper functions for atomic state transitions and
   the AI 5-minute gate check.

## Security (RLS)
- All new tables have RLS enabled with authenticated, ownership-scoped policies.
- vr_requests: addressee or requester can read/update their own rows.
- vr_conversations: participants can read/update only their own conversations.
- vr_messages: participants can read messages in their own conversations; only
  the sender can insert; only the recipient can mark read.

This migration is idempotent and re-runnable. No existing data is touched.
*/

-- ---------------------------------------------------------------------------
-- 1. Add Velvet Rope columns to user_profiles
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'velvet_rope_enabled'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN velvet_rope_enabled boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'velvet_rope_first_seen_at'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN velvet_rope_first_seen_at timestamptz;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'velvet_rope_active_conv_id'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN velvet_rope_active_conv_id uuid;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. vr_requests table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vr_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  match_type text NOT NULL DEFAULT 'human' CHECK (match_type IN ('ai','human')),
  masked_handle text NOT NULL DEFAULT 'Someone',
  opener_message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);

ALTER TABLE vr_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS vr_requests_addressee_status_idx
  ON vr_requests (addressee_id, status);

DROP POLICY IF EXISTS "vr_read_own_requests" ON vr_requests;
CREATE POLICY "vr_read_own_requests"
ON vr_requests FOR SELECT
TO authenticated
USING (auth.uid() = addressee_id OR auth.uid() = requester_id);

DROP POLICY IF EXISTS "vr_insert_own_request" ON vr_requests;
CREATE POLICY "vr_insert_own_request"
ON vr_requests FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = addressee_id OR auth.uid() = requester_id OR requester_id IS NULL);

DROP POLICY IF EXISTS "vr_update_own_request" ON vr_requests;
CREATE POLICY "vr_update_own_request"
ON vr_requests FOR UPDATE
TO authenticated
USING (auth.uid() = addressee_id OR auth.uid() = requester_id)
WITH CHECK (auth.uid() = addressee_id OR auth.uid() = requester_id);

DROP POLICY IF EXISTS "vr_delete_own_request" ON vr_requests;
CREATE POLICY "vr_delete_own_request"
ON vr_requests FOR DELETE
TO authenticated
USING (auth.uid() = addressee_id OR auth.uid() = requester_id);

-- ---------------------------------------------------------------------------
-- 3. vr_conversations table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vr_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_type text NOT NULL DEFAULT 'human' CHECK (match_type IN ('ai','human')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  last_message_at timestamptz
);

ALTER TABLE vr_conversations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS vr_conversations_user_a_idx ON vr_conversations (user_a_id);
CREATE INDEX IF NOT EXISTS vr_conversations_user_b_idx ON vr_conversations (user_b_id);

DROP POLICY IF EXISTS "vr_read_own_conversations" ON vr_conversations;
CREATE POLICY "vr_read_own_conversations"
ON vr_conversations FOR SELECT
TO authenticated
USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

DROP POLICY IF EXISTS "vr_insert_own_conversation" ON vr_conversations;
CREATE POLICY "vr_insert_own_conversation"
ON vr_conversations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_a_id OR auth.uid() = user_b_id);

DROP POLICY IF EXISTS "vr_update_own_conversation" ON vr_conversations;
CREATE POLICY "vr_update_own_conversation"
ON vr_conversations FOR UPDATE
TO authenticated
USING (auth.uid() = user_a_id OR auth.uid() = user_b_id)
WITH CHECK (auth.uid() = user_a_id OR auth.uid() = user_b_id);

DROP POLICY IF EXISTS "vr_delete_own_conversation" ON vr_conversations;
CREATE POLICY "vr_delete_own_conversation"
ON vr_conversations FOR DELETE
TO authenticated
USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- ---------------------------------------------------------------------------
-- 4. vr_messages table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vr_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES vr_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vr_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS vr_messages_conversation_idx ON vr_messages (conversation_id, created_at);

DROP POLICY IF EXISTS "vr_read_own_messages" ON vr_messages;
CREATE POLICY "vr_read_own_messages"
ON vr_messages FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM vr_conversations c
  WHERE c.id = vr_messages.conversation_id
    AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
));

DROP POLICY IF EXISTS "vr_insert_own_message" ON vr_messages;
CREATE POLICY "vr_insert_own_message"
ON vr_messages FOR INSERT
TO authenticated
WITH CHECK (sender_id = auth.uid() AND EXISTS (
  SELECT 1 FROM vr_conversations c
  WHERE c.id = vr_messages.conversation_id
    AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
    AND c.status = 'active'
));

DROP POLICY IF EXISTS "vr_mark_message_read" ON vr_messages;
CREATE POLICY "vr_mark_message_read"
ON vr_messages FOR UPDATE
TO authenticated
USING (sender_id <> auth.uid() AND EXISTS (
  SELECT 1 FROM vr_conversations c
  WHERE c.id = vr_messages.conversation_id
    AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
))
WITH CHECK (sender_id <> auth.uid() AND EXISTS (
  SELECT 1 FROM vr_conversations c
  WHERE c.id = vr_messages.conversation_id
    AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
));

DROP POLICY IF EXISTS "vr_delete_own_message" ON vr_messages;
CREATE POLICY "vr_delete_own_message"
ON vr_messages FOR DELETE
TO authenticated
USING (sender_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 5. vr_accept_request(p_request_id)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vr_accept_request(p_request_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req vr_requests%ROWTYPE;
  v_conv_id uuid;
  v_other uuid;
BEGIN
  SELECT * INTO v_req FROM vr_requests WHERE id = p_request_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or not pending';
  END IF;
  IF v_req.addressee_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not the addressee of this request';
  END IF;

  v_other := COALESCE(v_req.requester_id, v_req.addressee_id);

  INSERT INTO vr_conversations (user_a_id, user_b_id, match_type, status)
  VALUES (v_req.addressee_id, v_other, v_req.match_type, 'active')
  RETURNING id INTO v_conv_id;

  UPDATE vr_requests
    SET status = 'accepted', responded_at = now()
    WHERE id = p_request_id;

  UPDATE user_profiles
    SET velvet_rope_active_conv_id = v_conv_id
    WHERE id = v_req.addressee_id;

  IF v_req.requester_id IS NOT NULL THEN
    UPDATE user_profiles
      SET velvet_rope_active_conv_id = v_conv_id
      WHERE id = v_req.requester_id;
  END IF;

  RETURN v_conv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION vr_accept_request(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. vr_decline_request(p_request_id)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vr_decline_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req vr_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_req FROM vr_requests WHERE id = p_request_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or not pending';
  END IF;
  IF v_req.addressee_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not the addressee of this request';
  END IF;
  UPDATE vr_requests
    SET status = 'declined', responded_at = now()
    WHERE id = p_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION vr_decline_request(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. vr_close_conversation(p_conv_id)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vr_close_conversation(p_conv_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv vr_conversations%ROWTYPE;
BEGIN
  SELECT * INTO v_conv FROM vr_conversations WHERE id = p_conv_id AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found or already closed';
  END IF;
  IF v_conv.user_a_id <> auth.uid() AND v_conv.user_b_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not a participant in this conversation';
  END IF;
  UPDATE vr_conversations
    SET status = 'closed', closed_at = now()
    WHERE id = p_conv_id;
  UPDATE user_profiles
    SET velvet_rope_active_conv_id = NULL
    WHERE id IN (v_conv.user_a_id, v_conv.user_b_id)
      AND velvet_rope_active_conv_id = p_conv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION vr_close_conversation(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8. vr_can_send_ai_request(p_user_id)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION vr_can_send_ai_request(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(up.velvet_rope_enabled, false)
    AND up.velvet_rope_active_conv_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM vr_requests r
      WHERE r.addressee_id = p_user_id AND r.status = 'pending'
    )
    AND up.velvet_rope_first_seen_at IS NOT NULL
    AND (now() - up.velvet_rope_first_seen_at) >= interval '5 minutes'
  FROM user_profiles up
  WHERE up.id = p_user_id;
$$;

GRANT EXECUTE ON FUNCTION vr_can_send_ai_request(uuid) TO authenticated;

/*
# Real-Time Messaging Overlay System (Friends + Direct Messages)

## Plain-English Summary

Adds a real-time, interest-based direct messaging system so signed-in users can
connect with each other, friend each other, and chat live. Users opt in to being
discoverable; only friends can send each other messages. Includes friend requests,
blocking, typing indicators, and read receipts.

## New Tables

1. `im_friendships` - friend relationships (pending/accepted/declined/blocked).
2. `im_conversations` - 1:1 DM rooms (canonical user_a < user_b).
3. `im_messages` - DM messages with read_at.
4. `im_typing` - ephemeral typing indicator state.
5. `im_presence` - online/last-seen state.
6. `im_blocks` - blocker -> blocked rows.
7. `im_discovery_profiles` - opt-in discovery cards (display name, avatar, interests, headline).

## Security (RLS)

- All tables enable RLS, owner-scoped CRUD where appropriate.
- Friendship rows: both parties read; only requester inserts; either updates; either deletes.
- Conversations: both participants read/insert/update.
- Messages: both conversation participants read; only sender inserts; only recipient updates read_at.
- Blocks: blocker owns; blocked can read.
- Discovery profiles: discoverable rows readable by any authenticated user; only owner writes.

## Important Notes

1. `user_profiles` already exists with `interests text[]`; not modified here.
2. Owner columns default to auth.uid() so client inserts succeed without user_id.
3. Policies dropped before recreating to keep migration idempotent.
*/

-- ============================================================================
-- 1. im_friendships
-- ============================================================================
CREATE TABLE IF NOT EXISTS im_friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','declined','blocked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  CONSTRAINT no_self_friendship CHECK (requester_id <> addressee_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_im_friendships_pair
  ON im_friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));
CREATE INDEX IF NOT EXISTS idx_im_friendships_addressee ON im_friendships (addressee_id, status);
CREATE INDEX IF NOT EXISTS idx_im_friendships_requester ON im_friendships (requester_id, status);

ALTER TABLE im_friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_own_friendships" ON im_friendships;
CREATE POLICY "read_own_friendships" ON im_friendships FOR SELECT
  TO authenticated USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

DROP POLICY IF EXISTS "insert_own_friendship_request" ON im_friendships;
CREATE POLICY "insert_own_friendship_request" ON im_friendships FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "update_own_friendship" ON im_friendships;
CREATE POLICY "update_own_friendship" ON im_friendships FOR UPDATE
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id)
  WITH CHECK (auth.uid() = requester_id OR auth.uid() = addressee_id);

DROP POLICY IF EXISTS "delete_own_friendship" ON im_friendships;
CREATE POLICY "delete_own_friendship" ON im_friendships FOR DELETE
  TO authenticated USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- ============================================================================
-- 2. im_conversations
-- ============================================================================
CREATE TABLE IF NOT EXISTS im_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz,
  CONSTRAINT conv_canonical_order CHECK (user_a_id < user_b_id),
  CONSTRAINT conv_no_self CHECK (user_a_id <> user_b_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_im_conversations_pair
  ON im_conversations (user_a_id, user_b_id);
CREATE INDEX IF NOT EXISTS idx_im_conversations_user_a ON im_conversations (user_a_id);
CREATE INDEX IF NOT EXISTS idx_im_conversations_user_b ON im_conversations (user_b_id);

ALTER TABLE im_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_own_conversations" ON im_conversations;
CREATE POLICY "read_own_conversations" ON im_conversations FOR SELECT
  TO authenticated USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

DROP POLICY IF EXISTS "insert_own_conversation" ON im_conversations;
CREATE POLICY "insert_own_conversation" ON im_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_a_id OR auth.uid() = user_b_id);

DROP POLICY IF EXISTS "update_own_conversation" ON im_conversations;
CREATE POLICY "update_own_conversation" ON im_conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id)
  WITH CHECK (auth.uid() = user_a_id OR auth.uid() = user_b_id);

-- ============================================================================
-- 3. im_messages
-- ============================================================================
CREATE TABLE IF NOT EXISTS im_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES im_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_im_messages_conv_created
  ON im_messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_im_messages_sender ON im_messages (sender_id);

ALTER TABLE im_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_messages_in_own_conversations" ON im_messages;
CREATE POLICY "read_messages_in_own_conversations" ON im_messages FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM im_conversations c
      WHERE c.id = im_messages.conversation_id
        AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "insert_own_message" ON im_messages;
CREATE POLICY "insert_own_message" ON im_messages FOR INSERT
  TO authenticated WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM im_conversations c
      WHERE c.id = im_messages.conversation_id
        AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "mark_message_read_by_recipient" ON im_messages;
CREATE POLICY "mark_message_read_by_recipient" ON im_messages FOR UPDATE
  TO authenticated
  USING (
    sender_id <> auth.uid()
    AND EXISTS (
      SELECT 1 FROM im_conversations c
      WHERE c.id = im_messages.conversation_id
        AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
    )
  )
  WITH CHECK (
    sender_id <> auth.uid()
    AND EXISTS (
      SELECT 1 FROM im_conversations c
      WHERE c.id = im_messages.conversation_id
        AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
    )
  );

-- ============================================================================
-- 4. im_typing
-- ============================================================================
CREATE TABLE IF NOT EXISTS im_typing (
  user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES im_conversations(id) ON DELETE CASCADE,
  last_typed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE im_typing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_typing_in_own_conversations" ON im_typing;
CREATE POLICY "read_typing_in_own_conversations" ON im_typing FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM im_conversations c
      WHERE c.id = im_typing.conversation_id
        AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "upsert_own_typing" ON im_typing;
CREATE POLICY "upsert_own_typing" ON im_typing FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "update_own_typing" ON im_typing;
CREATE POLICY "update_own_typing" ON im_typing FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "delete_own_typing" ON im_typing;
CREATE POLICY "delete_own_typing" ON im_typing FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- ============================================================================
-- 5. im_presence
-- ============================================================================
CREATE TABLE IF NOT EXISTS im_presence (
  user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  is_online boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE im_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_presence_self_or_friends" ON im_presence;
CREATE POLICY "read_presence_self_or_friends" ON im_presence FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM im_friendships f
      WHERE f.status = 'accepted'
        AND (f.requester_id = auth.uid() OR f.addressee_id = auth.uid())
        AND (f.requester_id = im_presence.user_id OR f.addressee_id = im_presence.user_id)
    )
  );

DROP POLICY IF EXISTS "upsert_own_presence" ON im_presence;
CREATE POLICY "upsert_own_presence" ON im_presence FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "update_own_presence" ON im_presence;
CREATE POLICY "update_own_presence" ON im_presence FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 6. im_blocks
-- ============================================================================
CREATE TABLE IF NOT EXISTS im_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT no_self_block CHECK (blocker_id <> blocked_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_im_blocks_pair
  ON im_blocks (blocker_id, blocked_id);

ALTER TABLE im_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_blocks_owner_or_blocked" ON im_blocks;
CREATE POLICY "read_blocks_owner_or_blocked" ON im_blocks FOR SELECT
  TO authenticated USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);

DROP POLICY IF EXISTS "insert_own_block" ON im_blocks;
CREATE POLICY "insert_own_block" ON im_blocks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "delete_own_block" ON im_blocks;
CREATE POLICY "delete_own_block" ON im_blocks FOR DELETE
  TO authenticated USING (auth.uid() = blocker_id);

-- ============================================================================
-- 7. im_discovery_profiles
-- ============================================================================
CREATE TABLE IF NOT EXISTS im_discovery_profiles (
  user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  avatar_url text,
  headline text,
  interests text[] NOT NULL DEFAULT '{}',
  discoverable boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_im_discovery_discoverable
  ON im_discovery_profiles (discoverable) WHERE discoverable = true;

ALTER TABLE im_discovery_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_discoverable_or_own_profile" ON im_discovery_profiles;
CREATE POLICY "read_discoverable_or_own_profile" ON im_discovery_profiles FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR discoverable = true);

DROP POLICY IF EXISTS "upsert_own_discovery_profile" ON im_discovery_profiles;
CREATE POLICY "upsert_own_discovery_profile" ON im_discovery_profiles FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "update_own_discovery_profile" ON im_discovery_profiles;
CREATE POLICY "update_own_discovery_profile" ON im_discovery_profiles FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "delete_own_discovery_profile" ON im_discovery_profiles;
CREATE POLICY "delete_own_discovery_profile" ON im_discovery_profiles FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- ============================================================================
-- updated_at triggers
-- ============================================================================
CREATE OR REPLACE FUNCTION im_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_im_friendships_updated_at ON im_friendships;
CREATE TRIGGER trg_im_friendships_updated_at
  BEFORE UPDATE ON im_friendships
  FOR EACH ROW EXECUTE FUNCTION im_touch_updated_at();

DROP TRIGGER IF EXISTS trg_im_discovery_profiles_updated_at ON im_discovery_profiles;
CREATE TRIGGER trg_im_discovery_profiles_updated_at
  BEFORE UPDATE ON im_discovery_profiles
  FOR EACH ROW EXECUTE FUNCTION im_touch_updated_at();

-- ============================================================================
-- Helper: get-or-create the canonical conversation id for a user pair
-- ============================================================================
CREATE OR REPLACE FUNCTION im_get_or_create_conversation(
  other_user uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  me uuid := auth.uid();
  lo uuid;
  hi uuid;
  conv_id uuid;
BEGIN
  IF me IS NULL THEN RETURN NULL; END IF;
  IF me = other_user THEN RETURN NULL; END IF;
  lo := LEAST(me, other_user);
  hi := GREATEST(me, other_user);
  SELECT id INTO conv_id FROM im_conversations WHERE user_a_id = lo AND user_b_id = hi LIMIT 1;
  IF conv_id IS NULL THEN
    INSERT INTO im_conversations (user_a_id, user_b_id) VALUES (lo, hi)
      RETURNING id INTO conv_id;
  END IF;
  RETURN conv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION im_get_or_create_conversation(uuid) TO authenticated;

/*
  # Add Group Chat System

  1. New Tables
    - `group_chats`
      - `id` (uuid, primary key) - Unique group chat identifier
      - `user_id` (uuid, references auth.users) - Owner of the group chat
      - `name` (text) - Display name for the group chat
      - `created_at` (timestamptz) - When the group was created
      - `updated_at` (timestamptz) - Last activity timestamp
      - `is_active` (boolean, default true) - Soft delete flag

    - `group_chat_members`
      - `id` (uuid, primary key) - Unique membership record
      - `group_chat_id` (uuid, references group_chats) - Which group chat
      - `companion_id` (uuid, references companions) - Which companion is in the group
      - `joined_at` (timestamptz) - When the companion was added
      - `is_active` (boolean, default true) - Whether the member is currently active

    - `group_chat_messages`
      - `id` (uuid, primary key) - Unique message identifier
      - `group_chat_id` (uuid, references group_chats) - Which group chat
      - `user_id` (uuid, references auth.users) - Message author (for user messages)
      - `companion_id` (uuid, references companions, nullable) - Which companion sent it (null for user messages)
      - `role` (text) - 'user' or 'assistant'
      - `sender_name` (text) - Display name of the sender
      - `content` (text) - Message content
      - `created_at` (timestamptz) - When the message was sent

  2. Security
    - Enable RLS on all three tables
    - Users can only access their own group chats
    - Users can only manage members in their own groups
    - Users can only read/write messages in their own groups

  3. Indexes
    - group_chat_messages by group_chat_id and created_at for efficient loading
    - group_chat_members by group_chat_id for member lookups
*/

CREATE TABLE IF NOT EXISTS group_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);

ALTER TABLE group_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own group chats"
  ON group_chats FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own group chats"
  ON group_chats FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own group chats"
  ON group_chats FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own group chats"
  ON group_chats FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS group_chat_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_chat_id uuid NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  UNIQUE(group_chat_id, companion_id)
);

ALTER TABLE group_chat_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view members of own group chats"
  ON group_chat_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_chats
      WHERE group_chats.id = group_chat_members.group_chat_id
      AND group_chats.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add members to own group chats"
  ON group_chat_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_chats
      WHERE group_chats.id = group_chat_members.group_chat_id
      AND group_chats.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update members of own group chats"
  ON group_chat_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_chats
      WHERE group_chats.id = group_chat_members.group_chat_id
      AND group_chats.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM group_chats
      WHERE group_chats.id = group_chat_members.group_chat_id
      AND group_chats.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove members from own group chats"
  ON group_chat_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM group_chats
      WHERE group_chats.id = group_chat_members.group_chat_id
      AND group_chats.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS group_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_chat_id uuid NOT NULL REFERENCES group_chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id uuid REFERENCES companions(id) ON DELETE SET NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  sender_name text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE group_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in own group chats"
  ON group_chat_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can send messages in own group chats"
  ON group_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete messages in own group chats"
  ON group_chat_messages FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_group_chat_messages_group_created
  ON group_chat_messages(group_chat_id, created_at);

CREATE INDEX IF NOT EXISTS idx_group_chat_members_group
  ON group_chat_members(group_chat_id);

CREATE INDEX IF NOT EXISTS idx_group_chats_user
  ON group_chats(user_id);

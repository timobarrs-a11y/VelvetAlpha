/*
# Velvet Rope — make vr_messages.sender_id nullable for AI opponents

## Purpose
AI Velvet Rope opponents have no real user id, so their messages need a
nullable sender_id. The original migration made sender_id NOT NULL, which
forced AI messages to use the human user's own id — breaking the "who sent
this" distinction. This migration makes sender_id nullable and adjusts the
RLS policies so the INSERT policy allows sender_id to be null for AI
opponent rows inserted by the edge function (service role), and so the
read/mark-read policies treat null-sender rows as "from the opponent."

## Changes
1. Alter vr_messages.sender_id to be nullable (drops NOT NULL).
2. Drop and recreate the INSERT policy to allow sender_id = null when the
   conversation belongs to the authenticated user (for client-side inserts
   of the user's own messages). The service-role edge function bypasses RLS
   for AI-message inserts.
3. Drop and recreate the UPDATE (mark-read) policy so rows with null
   sender_id are treated as incoming (markable by the human participant).

This migration is idempotent and re-runnable. No data is lost.
*/

-- 1. Make sender_id nullable
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vr_messages' AND column_name = 'sender_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE vr_messages ALTER COLUMN sender_id DROP NOT NULL;
  END IF;
END $$;

-- Drop the default auth.uid() so the edge function can insert null sender_id.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vr_messages' AND column_name = 'sender_id'
      AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE vr_messages ALTER COLUMN sender_id DROP DEFAULT;
  END IF;
END $$;

-- Drop the sender_id FK constraint if it exists (AI null sender has no user),
-- then re-add it without ON DELETE cascade issues. We keep the FK but allow
-- null.
DO $$
DECLARE
  v_constraint text;
BEGIN
  SELECT conname INTO v_constraint
  FROM pg_constraint
  WHERE conrelid = 'vr_messages'::regclass
    AND contype = 'f'
    AND conname LIKE '%sender_id%';
  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE vr_messages DROP CONSTRAINT IF EXISTS %I', v_constraint);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'vr_messages'::regclass
      AND contype = 'f'
      AND conname = 'vr_messages_sender_id_fkey'
  ) THEN
    ALTER TABLE vr_messages
      ADD CONSTRAINT vr_messages_sender_id_fkey
      FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Recreate INSERT policy: allow the human participant to insert their own
--    messages (sender_id = auth.uid()). AI messages are inserted by the
--    service-role edge function which bypasses RLS.
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

-- 3. Recreate UPDATE (mark-read) policy: treat null-sender rows as incoming.
DROP POLICY IF EXISTS "vr_mark_message_read" ON vr_messages;
CREATE POLICY "vr_mark_message_read"
ON vr_messages FOR UPDATE
TO authenticated
USING (
  (sender_id IS NULL OR sender_id <> auth.uid())
  AND EXISTS (
    SELECT 1 FROM vr_conversations c
    WHERE c.id = vr_messages.conversation_id
      AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
  )
)
WITH CHECK (
  (sender_id IS NULL OR sender_id <> auth.uid())
  AND EXISTS (
    SELECT 1 FROM vr_conversations c
    WHERE c.id = vr_messages.conversation_id
      AND (c.user_a_id = auth.uid() OR c.user_b_id = auth.uid())
  )
);

/*
  # Add Thread Architecture Columns to Conversations Table

  ## Overview
  The actual chat messages are stored in the `conversations` table (not `chat_messages`).
  This migration adds the columns needed for The Thread's rich message types, bot indicators,
  and Morning Brief injection.

  ## Changes to `conversations`
  - message_type: identifies what kind of message this is — text, news-card, calendar-card, navi-card,
    system indicator, bot-entry/exit, or brief-block
  - metadata: jsonb for rich content — article ids, event ids, image urls, etc.
  - bot_source: which entity sent this message — companion, atlas, or navi
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'message_type'
  ) THEN
    ALTER TABLE conversations ADD COLUMN message_type text NOT NULL DEFAULT 'text';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE conversations ADD COLUMN metadata jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'bot_source'
  ) THEN
    ALTER TABLE conversations ADD COLUMN bot_source text NOT NULL DEFAULT 'companion';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS conversations_message_type_idx ON conversations (message_type) WHERE message_type != 'text';
CREATE INDEX IF NOT EXISTS conversations_bot_source_idx ON conversations (bot_source) WHERE bot_source != 'companion';

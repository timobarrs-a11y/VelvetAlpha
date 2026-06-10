/*
  # Add client_message_id to conversations for deduplication

  ## Purpose
  Prevents duplicate messages being inserted when the frontend retries a send
  (e.g., after a network hiccup). The client generates a UUID before the insert;
  if the same UUID arrives twice the second insert is silently ignored via
  ON CONFLICT DO NOTHING.

  ## Changes
  - `conversations` table
    - New column `client_message_id` (uuid, nullable, default gen_random_uuid())
      Rows inserted by backend services (DailyRitualService, SessionResumptionService)
      that don't supply a value will auto-receive a UUID so the unique constraint
      covers every row.
    - New unique index `conversations_client_message_id_key` on `client_message_id`

  ## Notes
  - The column is nullable-turned-unique-per-row via the default, not a NOT NULL
    constraint, so existing rows are unaffected during the migration backfill step.
  - Existing rows get a generated UUID via the DEFAULT during the ALTER TABLE; the
    unique index is created AFTER the backfill so it does not conflict.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'client_message_id'
  ) THEN
    ALTER TABLE conversations
      ADD COLUMN client_message_id uuid DEFAULT gen_random_uuid();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'conversations' AND indexname = 'conversations_client_message_id_key'
  ) THEN
    CREATE UNIQUE INDEX conversations_client_message_id_key
      ON conversations (client_message_id);
  END IF;
END $$;

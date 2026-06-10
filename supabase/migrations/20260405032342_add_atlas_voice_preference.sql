/*
  # Add Atlas Voice Preference

  ## Summary
  Adds a `voice` column to `atlas_conversations` so each conversation can have
  a chosen Atlas persona — either "masculine" or "feminine". Defaults to null
  (the user hasn't chosen yet, and the UI will prompt them on the first new
  conversation).

  ## Changes
  - `atlas_conversations.voice` (text, nullable) — "masculine" | "feminine" | null
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atlas_conversations' AND column_name = 'voice'
  ) THEN
    ALTER TABLE atlas_conversations ADD COLUMN voice text CHECK (voice IN ('masculine', 'feminine'));
  END IF;
END $$;

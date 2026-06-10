/*
  # Add Voice/Gender to Navi (Local Explorer)

  ## Summary
  Adds a `voice` column to `local_explorer_conversations` so Navi can remember
  the user's preferred voice (masculine/feminine) per conversation, matching the
  same pattern as Atlas.

  Also adds `navi_default_voice` to `user_profiles` so users can save a default
  and skip the picker on future conversations.

  ## Changes
  - `local_explorer_conversations.voice` (text, nullable) — "masculine" | "feminine"
  - `user_profiles.navi_default_voice` (text, nullable) — "masculine" | "feminine"
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'local_explorer_conversations' AND column_name = 'voice'
  ) THEN
    ALTER TABLE local_explorer_conversations
      ADD COLUMN voice text
      CHECK (voice IN ('masculine', 'feminine'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'navi_default_voice'
  ) THEN
    ALTER TABLE user_profiles
      ADD COLUMN navi_default_voice text
      CHECK (navi_default_voice IN ('masculine', 'feminine'));
  END IF;
END $$;

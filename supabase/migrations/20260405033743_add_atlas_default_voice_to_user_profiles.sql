/*
  # Add Atlas Default Voice to User Profiles

  ## Summary
  Adds an `atlas_default_voice` column to `user_profiles` so users can save their
  preferred Atlas voice (masculine or feminine) and skip the picker on future sessions.

  ## Changes
  - `user_profiles.atlas_default_voice` (text, nullable) — "masculine" | "feminine" | null
    - null means "always ask" (no saved preference)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'atlas_default_voice'
  ) THEN
    ALTER TABLE user_profiles
      ADD COLUMN atlas_default_voice text
      CHECK (atlas_default_voice IN ('masculine', 'feminine'));
  END IF;
END $$;

/*
  # Add Missing Personality Columns to Companions Table

  ## Overview
  Adds missing personality columns that are referenced in the questionnaire
  but not present in the database schema.

  ## Changes
  - Add `zodiac_sign` column (text) - User's zodiac sign for personality insights
  - Add `music_genre` column (text) - User's preferred music genre for conversation context

  ## Purpose
  - Fixes 400 error when creating companions through questionnaire
  - Ensures all questionnaire data can be properly stored
  - Enables richer personality-based conversations

  ## Notes
  - All columns allow NULL for backward compatibility
  - Existing companions unaffected
*/

-- Add zodiac_sign column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companions' AND column_name = 'zodiac_sign'
  ) THEN
    ALTER TABLE companions ADD COLUMN zodiac_sign text;
  END IF;
END $$;

-- Add music_genre column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companions' AND column_name = 'music_genre'
  ) THEN
    ALTER TABLE companions ADD COLUMN music_genre text;
  END IF;
END $$;

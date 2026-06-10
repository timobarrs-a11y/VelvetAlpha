/*
  # Add Questionnaire Data Columns to Companions Table

  ## Overview
  Adds missing questionnaire data fields to the companions table so that companion personalities
  can be fully customized based on user's questionnaire answers.

  ## New Columns Added
  - `interest_text` (text): Free-text answer about what the companion is passionate about
  - `love_language` (text): How the user wants to feel cared about (words of affirmation, quality time, etc.)
  - `support_style` (text): How the user wants support when stressed (solutions, listening, distraction, space)
  - `life_context` (text): User's current life situation (working/studying, tough time, doing well, lonely)
  - `energy_preference` (text): Whether user prefers life of party or own world type
  - `interest_style` (text): Whether companion should be flirty/bold or reserved/subtle
  - `vibe_preference` (text): User's preferred vibe (bright/energetic or mysterious/deep)
  
  ## Changes Made
  - Adds all missing questionnaire columns to companions table
  - Allows NULL values since existing companions don't have this data
  - No default values to avoid polluting existing data

  ## Notes
  - These columns complement existing fields: dynamic_preference, confrontation_style, availability_level, interest_preference
  - This enables full personality customization based on questionnaire answers
*/

-- Add missing questionnaire columns to companions table
DO $$
BEGIN
  -- Add interest_text column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companions' AND column_name = 'interest_text'
  ) THEN
    ALTER TABLE companions ADD COLUMN interest_text text;
  END IF;

  -- Add love_language column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companions' AND column_name = 'love_language'
  ) THEN
    ALTER TABLE companions ADD COLUMN love_language text;
  END IF;

  -- Add support_style column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companions' AND column_name = 'support_style'
  ) THEN
    ALTER TABLE companions ADD COLUMN support_style text;
  END IF;

  -- Add life_context column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companions' AND column_name = 'life_context'
  ) THEN
    ALTER TABLE companions ADD COLUMN life_context text;
  END IF;

  -- Add energy_preference column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companions' AND column_name = 'energy_preference'
  ) THEN
    ALTER TABLE companions ADD COLUMN energy_preference text;
  END IF;

  -- Add interest_style column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companions' AND column_name = 'interest_style'
  ) THEN
    ALTER TABLE companions ADD COLUMN interest_style text;
  END IF;

  -- Add vibe_preference column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companions' AND column_name = 'vibe_preference'
  ) THEN
    ALTER TABLE companions ADD COLUMN vibe_preference text;
  END IF;
END $$;
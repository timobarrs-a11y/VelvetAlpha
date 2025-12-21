/*
  # Add Companion Personalization Fields

  1. Changes to `companions` table
    - Add `custom_name` (text) - User's chosen name for their companion
    - Add `hobbies` (text[]) - User's favorite hobbies for conversation context
    - Add `sports` (text[]) - User's favorite sports for conversation context
  
  2. Purpose
    - Allow users to customize companion names instead of using default character names
    - Store user preferences from questionnaire to fuel personalized conversations
    - Enable AI to reference user's interests naturally in conversation starters
  
  3. Notes
    - These fields are populated during the questionnaire flow
    - AI system prompts will reference these to create contextual conversations
    - Hobbies and sports are stored as text arrays to support multiple interests
*/

-- Add personalization fields to companions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companions' AND column_name = 'custom_name'
  ) THEN
    ALTER TABLE companions ADD COLUMN custom_name text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companions' AND column_name = 'hobbies'
  ) THEN
    ALTER TABLE companions ADD COLUMN hobbies text[] DEFAULT ARRAY[]::text[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companions' AND column_name = 'sports'
  ) THEN
    ALTER TABLE companions ADD COLUMN sports text[] DEFAULT ARRAY[]::text[];
  END IF;
END $$;
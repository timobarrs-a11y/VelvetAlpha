/*
  # Add User Gender Field

  1. Changes to `user_profiles` table
    - Add `gender` (text) - User's gender for personalized interactions

  2. Purpose
    - Enables companions to address users appropriately based on gender
    - Ensures gender-appropriate greetings (e.g., "bro" for males, appropriate terms for females)
    - Improves conversation personalization and context
*/

-- Add gender field to user_profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'gender'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN gender text;
  END IF;
END $$;

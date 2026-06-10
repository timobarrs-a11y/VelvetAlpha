/*
  # Remove personality_settings Column from user_profiles

  ## Overview
  Removes the deprecated `personality_settings` column from user_profiles table.
  
  ## Why This Change
  - personality_settings had hardcoded default values that never changed
  - The actual personality data is now stored in the companions table
  - The system now dynamically builds personality settings from companion questionnaire data
  - This column was causing confusion by showing the same defaults for all users
  
  ## Changes Made
  - Drops `personality_settings` column from user_profiles table
  
  ## Notes
  - chatService.ts now builds personalitySettings from companion data dynamically
  - No data loss - all personality data is in companions table
*/

-- Drop the personality_settings column (no longer used, data is in companions table)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'personality_settings'
  ) THEN
    ALTER TABLE user_profiles DROP COLUMN personality_settings;
  END IF;
END $$;
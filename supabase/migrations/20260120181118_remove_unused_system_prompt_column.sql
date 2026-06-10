/*
  # Remove Unused system_prompt Column from user_profiles

  ## Overview
  The `system_prompt` column in `user_profiles` is no longer used. System prompts are now
  dynamically generated per-companion using the `buildSystemPrompt` function based on
  companion data and questionnaire answers.

  ## Changes Made
  - Drops the `system_prompt` column from `user_profiles` table

  ## Notes
  - This column had a default value of "You are Riley..." which was confusing but never actually used
  - System prompts are now generated dynamically and never stored in the database
*/

-- Drop the unused system_prompt column from user_profiles
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'system_prompt'
  ) THEN
    ALTER TABLE user_profiles DROP COLUMN system_prompt;
  END IF;
END $$;
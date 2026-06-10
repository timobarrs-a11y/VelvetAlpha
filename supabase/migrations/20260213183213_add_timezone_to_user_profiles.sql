/*
  # Add Timezone to User Profiles

  ## Overview
  Adds timezone field to user_profiles table for accurate temporal awareness
  calculations. Used to determine local date boundaries for streak tracking,
  time-of-day context, and relationship metrics.

  ## Changes
  - Adds timezone column (defaults to 'America/New_York')
  - Backfills existing users with default timezone
  - Timezone can be updated by user or detected automatically

  ## Usage
  - Store IANA timezone identifier (e.g., 'America/New_York', 'Europe/London')
  - Used in temporalAwarenessService for local date calculations
  - Updated on user login if browser timezone differs
*/

-- Add timezone column to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'timezone'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN timezone text DEFAULT 'America/New_York';
  END IF;
END $$;

-- Backfill existing users with default timezone
UPDATE user_profiles
SET timezone = 'America/New_York'
WHERE timezone IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.timezone IS
  'IANA timezone identifier for accurate temporal awareness calculations';

/*
  # Add welcome_seen flag to user_profiles

  ## Summary
  Adds a `welcome_seen` boolean column to `user_profiles` so the Project Velvet
  welcome screen is only shown once to new users. Defaults to false so all existing
  users will see the screen on their next visit if they haven't already (no harm done
  since they're already onboarded — but new users are the primary target).

  ## Changes
  - `user_profiles.welcome_seen` (boolean, default false) — tracks whether the user
    has dismissed the one-time welcome/intro screen.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'welcome_seen'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN welcome_seen boolean DEFAULT false;
  END IF;
END $$;

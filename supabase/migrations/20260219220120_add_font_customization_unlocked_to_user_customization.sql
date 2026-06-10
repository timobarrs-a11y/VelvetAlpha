/*
  # Add font_customization_unlocked to user_customization

  1. Changes
    - Adds `font_customization_unlocked` (boolean, default false) to `user_customization`
    - This flag is set to true when the user reaches a 20-day check-in streak
    - Controls whether the Companion Fonts section in the customization panel is interactive

  2. Notes
    - Default false means all existing users start locked
    - `performDailyCheckin` in the app will flip this to true at streak >= 20
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_customization' AND column_name = 'font_customization_unlocked'
  ) THEN
    ALTER TABLE user_customization
      ADD COLUMN font_customization_unlocked boolean NOT NULL DEFAULT false;
  END IF;
END $$;

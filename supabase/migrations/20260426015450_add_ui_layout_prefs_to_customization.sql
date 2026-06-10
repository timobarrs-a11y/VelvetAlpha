/*
  # Add UI layout preference columns to user_customization

  1. Changes
    - `translucent_ui` (boolean, DEFAULT false) — when true, left rail and bottom bar render with reduced opacity/glass effect so chat content shows through; off by default
    - `left_rail_collapsed` (boolean, DEFAULT false) — persists whether the left rail is in collapsed (icon-only) state; off by default

  2. Notes
    - Both default to false so existing users see no change
    - Both are saved/restored via the existing updateCursorPrefs upsert path
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_customization' AND column_name = 'translucent_ui'
  ) THEN
    ALTER TABLE user_customization ADD COLUMN translucent_ui boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_customization' AND column_name = 'left_rail_collapsed'
  ) THEN
    ALTER TABLE user_customization ADD COLUMN left_rail_collapsed boolean DEFAULT false;
  END IF;
END $$;

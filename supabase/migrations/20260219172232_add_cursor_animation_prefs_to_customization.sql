/*
  # Add cursor animation preferences to user_customization

  ## Changes
  - `show_trail` (bool) — whether the line trail is shown behind the cursor
  - `animation_style` (text) — which particle animation is active: stars, bubbles, petals, sparks, comet, none
  - `cursor_color` (text) — color key for the cursor trail / particles

  All columns have safe defaults so existing rows are unchanged.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_customization' AND column_name = 'show_trail'
  ) THEN
    ALTER TABLE user_customization ADD COLUMN show_trail boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_customization' AND column_name = 'animation_style'
  ) THEN
    ALTER TABLE user_customization ADD COLUMN animation_style text NOT NULL DEFAULT 'stars';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_customization' AND column_name = 'cursor_color'
  ) THEN
    ALTER TABLE user_customization ADD COLUMN cursor_color text NOT NULL DEFAULT 'rose';
  END IF;
END $$;

/*
  # Add trail_style column to user_customization

  Adds a `trail_style` column to store the user's selected trail line design.
  Default is 'solid' (the original glowing line).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_customization' AND column_name = 'trail_style'
  ) THEN
    ALTER TABLE user_customization ADD COLUMN trail_style text NOT NULL DEFAULT 'solid';
  END IF;
END $$;

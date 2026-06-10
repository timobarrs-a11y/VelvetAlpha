/*
  # Add companion-side bubble and text color columns

  ## Summary
  Adds two additional color customization columns to companions so users can
  style the companion's own message bubbles independently from their own bubbles.

  ## New Columns
  - `companion_bubble_color` (text, nullable) — color key for companion message bubbles
  - `companion_text_color` (text, nullable) — text color key inside companion bubbles
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companions' AND column_name = 'companion_bubble_color'
  ) THEN
    ALTER TABLE companions ADD COLUMN companion_bubble_color text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companions' AND column_name = 'companion_text_color'
  ) THEN
    ALTER TABLE companions ADD COLUMN companion_text_color text DEFAULT NULL;
  END IF;
END $$;

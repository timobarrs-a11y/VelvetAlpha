/*
  # Add font_family to companions table

  1. Changes
    - Adds `font_family` (text, nullable) column to `companions` table
    - Each companion gets a unique font assigned at creation or on first load
    - Null means font not yet assigned (will be backfilled on next load)

  2. Notes
    - No default value — font assignment is done in application code based on
      the companion's gender and which fonts other companions already claim
    - No RLS changes needed; existing companion policies already cover this column
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companions' AND column_name = 'font_family'
  ) THEN
    ALTER TABLE companions ADD COLUMN font_family text;
  END IF;
END $$;

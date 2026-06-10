/*
  # Migrate character_type to gender-based system

  1. Changes
    - Add `gender` column to companions table (male/female)
    - Migrate existing character_type data to gender:
      - 'riley' and 'raven' → 'female'
      - 'jake' → 'male'
    - Remove character_type column and constraint
    - Add gender check constraint

  2. Security
    - No changes to RLS policies (they remain the same)
*/

-- Add gender column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companions' AND column_name = 'gender'
  ) THEN
    ALTER TABLE companions ADD COLUMN gender text;
  END IF;
END $$;

-- Migrate existing data: map character_type to gender
UPDATE companions
SET gender = CASE
  WHEN character_type IN ('riley', 'raven') THEN 'female'
  WHEN character_type = 'jake' THEN 'male'
  ELSE 'female'
END
WHERE gender IS NULL;

-- Make gender NOT NULL and add check constraint
ALTER TABLE companions
  ALTER COLUMN gender SET NOT NULL,
  ADD CONSTRAINT companions_gender_check CHECK (gender IN ('male', 'female'));

-- Remove character_type column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companions' AND column_name = 'character_type'
  ) THEN
    -- Drop the check constraint first
    ALTER TABLE companions DROP CONSTRAINT IF EXISTS companions_character_type_check;

    -- Drop the column
    ALTER TABLE companions DROP COLUMN character_type;
  END IF;
END $$;

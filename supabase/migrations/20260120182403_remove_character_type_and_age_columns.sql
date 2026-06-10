/*
  # Remove Unused character_type and age Columns

  ## Overview
  Removes deprecated and unused columns from user_profiles table:
  - `character_type` - This was from the old Riley/Goth/Jake system. Now companions have their own names.
  - `age` - Redundant since we have birthday and can calculate age from it

  ## Changes Made
  - Drops `character_type` column (had default 'riley' which is confusing and incorrect)
  - Drops `age` column (redundant with birthday field)

  ## Notes
  - User profiles are for the USER, not the companion
  - Companion names are stored in the companions table
  - User's birthday is stored and age is calculated dynamically when needed
*/

-- Drop the character_type column (no longer used, companions have their own names)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'character_type'
  ) THEN
    ALTER TABLE user_profiles DROP COLUMN character_type;
  END IF;
END $$;

-- Drop the age column (redundant with birthday field)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'age'
  ) THEN
    ALTER TABLE user_profiles DROP COLUMN age;
  END IF;
END $$;
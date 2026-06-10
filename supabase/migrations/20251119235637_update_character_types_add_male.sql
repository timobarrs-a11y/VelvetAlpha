/*
  # Update Character Types to Include Male Character

  1. Changes to Existing Tables
    - Update `character_type` constraint to include 'raven' (goth girl) and 'tyler' (male character)
    - Rename 'avery' to 'raven' for existing users (if any)

  2. Notes
    - character_type now supports: 'riley', 'raven', 'tyler'
    - Riley = bubbly cheerleader (female)
    - Raven = goth girl (female)
    - Tyler = college athlete (male)
*/

-- Drop existing constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_profiles_character_type_check'
    AND table_name = 'user_profiles'
  ) THEN
    ALTER TABLE user_profiles DROP CONSTRAINT user_profiles_character_type_check;
  END IF;
END $$;

-- Update any existing 'avery' to 'raven'
UPDATE user_profiles SET character_type = 'raven' WHERE character_type = 'avery';

-- Add new constraint with updated character types
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_character_type_check 
  CHECK (character_type IN ('riley', 'raven', 'tyler'));

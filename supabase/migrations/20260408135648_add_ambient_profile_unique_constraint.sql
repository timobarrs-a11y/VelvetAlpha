/*
  # Add unique constraint to ambient_profile

  1. Changes
    - Adds a unique constraint on (user_id, key) in the ambient_profile table
      so upsert operations can resolve conflicts correctly.
  
  2. Notes
    - Safe to apply even if the table is empty (no data loss).
    - Required for the ambientProfileService.seedFromQuestionnaire upsert to work.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'ambient_profile'
      AND constraint_type = 'UNIQUE'
      AND constraint_name = 'ambient_profile_user_id_key_unique'
  ) THEN
    ALTER TABLE ambient_profile ADD CONSTRAINT ambient_profile_user_id_key_unique UNIQUE (user_id, key);
  END IF;
END $$;

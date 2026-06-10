/*
  # Add Test User Bypass System
  
  1. Changes
    - Add `is_test_user` boolean field to `user_profiles` table
    - Defaults to false for all users
    - Allows admin/testing accounts to bypass subscription checks
  
  2. Security
    - Can only be set manually via Supabase dashboard (no public API)
    - Not exposed to client-side modification
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'is_test_user'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN is_test_user boolean DEFAULT false;
  END IF;
END $$;
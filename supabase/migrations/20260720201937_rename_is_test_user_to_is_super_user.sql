/*
# Rename is_test_user to is_super_user

1. Changes
   - Renames the `is_test_user` boolean column on `user_profiles` to `is_super_user`.
   - Preserves all existing values (any row previously flagged `is_test_user = true`
     becomes `is_super_user = true`).
   - Keeps the column default of `false` and the NOT NULL constraint behavior.
   - No data is lost; this is a pure metadata rename.

2. Security
   - The column remains writable only via the Supabase dashboard / service role.
     No public UPDATE policy is added, so users cannot self-assign super-user status.
   - RLS on `user_profiles` is unchanged.

3. Important Notes
   - All client code and edge functions must be updated to read `is_super_user`
     instead of `is_test_user` in the same deploy.
   - The old column name is dropped after the rename so stale references fail loudly.
*/

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'is_test_user'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'is_super_user'
  ) THEN
    ALTER TABLE user_profiles RENAME COLUMN is_test_user TO is_super_user;
  END IF;
END $$;
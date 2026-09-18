/*
# Add nickname column to user_profiles

1. Changes
- Adds `nickname` (text, nullable) to `user_profiles`.
- Stores the user's casual name separately from their real name.
- Companions and friends use the nickname by default; coaches and
  correspondents use the real name. Falls back to `name` when null.

2. Security
- No new tables. No policy changes — user_profiles already has
  owner-scoped RLS (authenticated users can read/update their own row).
- The new column inherits those existing policies automatically.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'nickname'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN nickname text;
  END IF;
END $$;

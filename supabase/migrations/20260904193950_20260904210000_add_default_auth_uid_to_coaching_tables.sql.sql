/*
# Add DEFAULT auth.uid() to coaching table owner columns

1. Modified tables
- `user_goals.user_id`: add `DEFAULT auth.uid()` so client inserts that
  omit user_id still satisfy the INSERT RLS policy's WITH CHECK.
- `user_experts.user_id`: same fix.

2. Security
- No policy changes. Existing policies already check `auth.uid() = user_id`.
- The DEFAULT ensures the column is populated from the authenticated
  session even when the frontend doesn't pass it explicitly.

3. Important notes
- Both columns already have `NOT NULL` constraints and `REFERENCES auth.users(id)`.
- Adding a DEFAULT does not change existing rows — it only affects future inserts.
- If any existing rows have NULL user_id (shouldn't be possible due to NOT NULL),
  they are unaffected.
*/

DO $$
BEGIN
  -- user_goals.user_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_goals'
      AND column_name = 'user_id'
      AND column_default LIKE '%auth.uid%'
  ) THEN
    ALTER TABLE user_goals ALTER COLUMN user_id SET DEFAULT auth.uid();
  END IF;

  -- user_experts.user_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_experts'
      AND column_name = 'user_id'
      AND column_default LIKE '%auth.uid%'
  ) THEN
    ALTER TABLE user_experts ALTER COLUMN user_id SET DEFAULT auth.uid();
  END IF;
END $$;

/*
# Add home_layout_preference to user_feedback

1. Modified Tables
   - `user_feedback`
     - `home_layout_preference` (text, nullable) — records which home layout
       ('classic' or 'new') the tester was using when they submitted feedback.
       Used during the closed beta to attribute feedback to a specific layout variant.

2. Security
   - No policy changes required. Existing INSERT policy already covers this column.

3. Notes
   - Nullable because older rows won't have this value.
   - No default — the app explicitly sets it on every new insert.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_feedback'
      AND column_name = 'home_layout_preference'
  ) THEN
    ALTER TABLE public.user_feedback
      ADD COLUMN home_layout_preference text;
  END IF;
END $$;

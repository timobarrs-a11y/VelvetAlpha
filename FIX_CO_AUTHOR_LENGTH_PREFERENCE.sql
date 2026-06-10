/*
  Fix Co-Author length_preference Constraint

  This updates the CHECK constraint on co_author_sessions.length_preference
  to use the correct values: '1-2 sentences', '3-4 sentences', '1 paragraph', '2-3 paragraphs'

  Run this in your Supabase SQL Editor to fix the constraint mismatch.
*/

-- Drop the old constraint if it exists
DO $$
BEGIN
  -- Try to drop the old constraint (it might not exist or have a generated name)
  ALTER TABLE co_author_sessions DROP CONSTRAINT IF EXISTS co_author_sessions_length_preference_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Add the correct constraint
ALTER TABLE co_author_sessions
  ADD CONSTRAINT co_author_sessions_length_preference_check
  CHECK (length_preference IN ('1-2 sentences', '3-4 sentences', '1 paragraph', '2-3 paragraphs'));

-- Update any existing rows that might have old values
-- This converts old values to new ones if they exist
UPDATE co_author_sessions
SET length_preference = CASE
  WHEN length_preference = 'Short' THEN '1-2 sentences'
  WHEN length_preference = 'Medium' THEN '1 paragraph'
  WHEN length_preference = 'Long' THEN '2-3 paragraphs'
  ELSE length_preference
END
WHERE length_preference IN ('Short', 'Medium', 'Long');

-- Verify the constraint is correct
SELECT
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conname LIKE '%length_preference%'
  AND conrelid = 'co_author_sessions'::regclass;

/*
# Add completed_at column to coaching_commitments

1. Modified Tables
- `coaching_commitments`: adds `completed_at` (timestamptz, nullable) to track
  when a commitment was marked completed. Existing rows and pending commitments
  get NULL — only set when the status transitions to 'completed'.

2. Notes
- No data loss: column is nullable with no default.
- No RLS changes needed: existing policies cover the new column implicitly.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'coaching_commitments'
    AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE coaching_commitments ADD COLUMN completed_at timestamptz;
  END IF;
END $$;

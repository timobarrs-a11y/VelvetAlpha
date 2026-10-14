/*
# Upgrade Commitments: User-Created Tasks, In-Progress Status, Progress Notes

## Purpose
Upgrades the coaching_commitments table to support:
1. User-created commitments (not just coach-extracted) — companion_id becomes nullable
2. "in_progress" as a new status alongside pending/completed/missed/renegotiated
3. Progress notes so users can log updates on commitments
4. A flag to distinguish user-created vs coach-extracted commitments

## Changes to coaching_commitments
- `companion_id`: changed from NOT NULL to nullable (user-created tasks may not have a coach)
- `progress_note` (text, nullable): users can log a progress update on a commitment
- `is_user_created` (boolean, default false): true when the user manually created this commitment
- `category` (text, nullable): optional categorization (e.g. "work", "health", "personal")

## Security
- No RLS policy changes — existing owner-scoped CRUD policies remain intact
- The existing UPDATE policy already allows updating any column on owned rows
- The existing INSERT policy allows inserting with auth.uid() = user_id

## Notes
- Making companion_id nullable is non-destructive — existing rows keep their values
- No data is lost or renamed
- The status column has no CHECK constraint, so 'in_progress' is accepted without changes
*/

ALTER TABLE coaching_commitments ALTER COLUMN companion_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'coaching_commitments' AND column_name = 'progress_note'
  ) THEN
    ALTER TABLE coaching_commitments ADD COLUMN progress_note text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'coaching_commitments' AND column_name = 'is_user_created'
  ) THEN
    ALTER TABLE coaching_commitments ADD COLUMN is_user_created boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'coaching_commitments' AND column_name = 'category'
  ) THEN
    ALTER TABLE coaching_commitments ADD COLUMN category text;
  END IF;
END $$;

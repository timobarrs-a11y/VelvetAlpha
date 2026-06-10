/*
  # Add previous_interaction_at to relationship_stats

  1. Changes
    - Add `previous_interaction_at` column to `relationship_stats` table to track the timestamp before the most recent update
    - This enables accurate gap calculations even after updating last_interaction_at
    - Nullable field, will be null for first interaction

  2. Purpose
    - Fix bug where gap calculations always return 0 because last_interaction_at was just updated
    - Store the previous timestamp before overwriting with current interaction time
    - Enable accurate "time since last chat" calculations
*/

-- Add previous_interaction_at column to relationship_stats
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'relationship_stats' AND column_name = 'previous_interaction_at'
  ) THEN
    ALTER TABLE relationship_stats
    ADD COLUMN previous_interaction_at timestamptz;
  END IF;
END $$;
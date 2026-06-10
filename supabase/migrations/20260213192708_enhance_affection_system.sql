/*
  # Enhance Affection Scale System

  1. Changes
    - Add relationship_status field (platonic | exploring | romantic_confirmed)
    - Add affection_update_history JSONB column to track last updates for rate limiting
    - Update defaults: friend=3, evolve=3, companion=4
    - Add helper function to check affection rate limits

  2. Security
    - No changes to RLS policies needed
*/

-- Add relationship_status and update history tracking
DO $$
BEGIN
  -- Add relationship_status column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'relationship_stats' AND column_name = 'relationship_status'
  ) THEN
    ALTER TABLE relationship_stats
    ADD COLUMN relationship_status text DEFAULT 'exploring' CHECK (relationship_status IN ('platonic', 'exploring', 'romantic_confirmed'));
  END IF;

  -- Add affection_update_history column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'relationship_stats' AND column_name = 'affection_update_history'
  ) THEN
    ALTER TABLE relationship_stats
    ADD COLUMN affection_update_history jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Update existing rows to set defaults based on relationship_intent
UPDATE relationship_stats
SET
  affection_base = CASE
    WHEN relationship_intent = 'friend' THEN 3
    WHEN relationship_intent = 'evolve' THEN 3
    WHEN relationship_intent = 'companion' THEN 4
    ELSE 3
  END,
  relationship_status = CASE
    WHEN relationship_intent = 'friend' THEN 'platonic'
    WHEN relationship_intent = 'companion' THEN 'romantic_confirmed'
    ELSE 'exploring'
  END
WHERE affection_base IS NULL OR relationship_status IS NULL;

-- Helper function to check if affection can be updated (rate limit)
CREATE OR REPLACE FUNCTION can_update_affection_base(
  p_user_id uuid,
  p_companion_id uuid
) RETURNS boolean AS $$
DECLARE
  v_last_updated timestamptz;
  v_update_history jsonb;
  v_updates_last_week int;
BEGIN
  -- Get current stats
  SELECT affection_last_updated_at, affection_update_history
  INTO v_last_updated, v_update_history
  FROM relationship_stats
  WHERE user_id = p_user_id AND companion_id = p_companion_id;

  -- Check if updated in last 24 hours
  IF v_last_updated IS NOT NULL AND v_last_updated > (NOW() - INTERVAL '24 hours') THEN
    RETURN false;
  END IF;

  -- Count updates in last 7 days from history
  SELECT COUNT(*)
  INTO v_updates_last_week
  FROM jsonb_array_elements(COALESCE(v_update_history, '[]'::jsonb)) AS update
  WHERE (update->>'updated_at')::timestamptz > (NOW() - INTERVAL '7 days');

  -- Block if 2 or more updates in last week
  IF v_updates_last_week >= 2 THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comment on new fields
COMMENT ON COLUMN relationship_stats.relationship_status IS 'Current relationship status: platonic (friends), exploring (getting to know), romantic_confirmed (explicit romantic)';
COMMENT ON COLUMN relationship_stats.affection_update_history IS 'Array of last 5 affection updates with timestamps for rate limiting';

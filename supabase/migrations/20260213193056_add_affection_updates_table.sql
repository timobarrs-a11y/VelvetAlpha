/*
  # Add Affection Updates Tracking Table

  1. New Table
    - affection_updates: Tracks every affection_base change for rate limiting
      - id (uuid, primary key)
      - user_id (uuid, references user_profiles)
      - companion_id (uuid, references companions)
      - old_base (int)
      - new_base (int)
      - updated_at (timestamptz, default now())

  2. Changes to relationship_stats
    - Add relationship_status: 'platonic' | 'exploring' | 'romantic_confirmed'
    - Update affection_base defaults

  3. Security
    - Enable RLS on affection_updates
    - Users can only view their own updates
*/

-- Create affection_updates table
CREATE TABLE IF NOT EXISTS affection_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
  old_base int NOT NULL,
  new_base int NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create index for efficient rate limit queries
CREATE INDEX IF NOT EXISTS idx_affection_updates_user_companion_time 
  ON affection_updates(user_id, companion_id, updated_at DESC);

-- Enable RLS
ALTER TABLE affection_updates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own affection updates"
  ON affection_updates FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own affection updates"
  ON affection_updates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Add relationship_status to relationship_stats
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'relationship_stats' AND column_name = 'relationship_status'
  ) THEN
    ALTER TABLE relationship_stats
    ADD COLUMN relationship_status text DEFAULT 'exploring' CHECK (relationship_status IN ('platonic', 'exploring', 'romantic_confirmed'));
  END IF;
END $$;

-- Update existing rows to set correct relationship_status and affection_base defaults
UPDATE relationship_stats
SET
  relationship_status = CASE
    WHEN relationship_intent = 'friend' THEN 'platonic'
    WHEN relationship_intent = 'companion' THEN 'exploring'
    ELSE 'exploring'
  END,
  affection_base = CASE
    WHEN relationship_intent = 'friend' THEN 3
    WHEN relationship_intent = 'evolve' THEN 3
    WHEN relationship_intent = 'companion' THEN 4
    ELSE 3
  END
WHERE relationship_status IS NULL OR affection_base IS NULL;

-- Helper function to check rate limits
CREATE OR REPLACE FUNCTION can_update_affection(
  p_user_id uuid,
  p_companion_id uuid
) RETURNS TABLE(allowed boolean, reason text) AS $$
DECLARE
  v_last_update timestamptz;
  v_updates_last_week int;
BEGIN
  -- Check last update time
  SELECT updated_at INTO v_last_update
  FROM affection_updates
  WHERE user_id = p_user_id AND companion_id = p_companion_id
  ORDER BY updated_at DESC
  LIMIT 1;

  -- Block if updated in last 24 hours
  IF v_last_update IS NOT NULL AND v_last_update > (NOW() - INTERVAL '24 hours') THEN
    RETURN QUERY SELECT false, 'Rate limit: max 1 update per 24 hours';
    RETURN;
  END IF;

  -- Count updates in last 7 days
  SELECT COUNT(*) INTO v_updates_last_week
  FROM affection_updates
  WHERE user_id = p_user_id 
    AND companion_id = p_companion_id
    AND updated_at > (NOW() - INTERVAL '7 days');

  -- Block if 2 or more updates in last week
  IF v_updates_last_week >= 2 THEN
    RETURN QUERY SELECT false, 'Rate limit: max 2 updates per week';
    RETURN;
  END IF;

  RETURN QUERY SELECT true, 'Rate limit check passed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON TABLE affection_updates IS 'Tracks all affection_base changes for rate limiting';
COMMENT ON COLUMN relationship_stats.relationship_status IS 'Current relationship status: platonic (friends only), exploring (getting to know), romantic_confirmed (explicitly romantic)';

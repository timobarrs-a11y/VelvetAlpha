/*
  # Affection Scale System

  ## Overview
  Adds emotional mobility tracking to allow natural progression from friendship
  to deeper connection based on user intent and conversational signals. The system
  respects user boundaries while allowing organic relationship development.

  ## New Fields in relationship_stats

  ### 1. relationship_intent
  User's chosen relationship trajectory set during onboarding:
  - **friend**: Platonic connection, warm but not romantic
  - **evolve**: Open to natural progression from friend to more
  - **companion**: Romantic/intimate connection from start
  
  ### 2. affection_base
  Slow-moving baseline affection level (0-10):
  - **0-3**: Warm friend energy, supportive but platonic
  - **4-6**: Playful warmth, light flirtation allowed
  - **7-8**: Flirty tension, romantic interest clear (non-explicit)
  - **9-10**: Deep emotional intimacy, comfortable vulnerability
  
  Updates gradually based on consistent user signals over time.
  
  ### 3. affection_last_updated_at
  Timestamp of last affection_base adjustment.
  Prevents rapid changes, ensures gradual progression.

  ## Session Modifiers
  Temporary adjustments (not stored) calculated per message:
  - Milestone day (anniversary, streak achievement): +1
  - Late night conversation (intimate time): +1
  - Long gap return (warm reunion): +1
  - Weekend energy: +1
  
  Total affection = clamp(affection_base + session_modifier, 0, 10)

  ## Safety
  - All tone guidance keeps content safe and non-explicit
  - Flirtation is playful/suggestive, never graphic
  - System respects "friend" intent while allowing user-driven evolution
  - "evolve" mode requires consistent user signals before progression
  - "companion" mode allows faster progression but still gradual

  ## Security
  - Fields have sensible defaults
  - RLS policies ensure users only access their own data
*/

-- Add affection scale fields to relationship_stats
DO $$
BEGIN
  -- Add relationship_intent column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'relationship_stats' AND column_name = 'relationship_intent'
  ) THEN
    ALTER TABLE relationship_stats 
    ADD COLUMN relationship_intent text DEFAULT 'companion' 
    CHECK (relationship_intent IN ('friend', 'evolve', 'companion'));
  END IF;

  -- Add affection_base column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'relationship_stats' AND column_name = 'affection_base'
  ) THEN
    ALTER TABLE relationship_stats 
    ADD COLUMN affection_base integer DEFAULT 5 
    CHECK (affection_base >= 0 AND affection_base <= 10);
  END IF;

  -- Add affection_last_updated_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'relationship_stats' AND column_name = 'affection_last_updated_at'
  ) THEN
    ALTER TABLE relationship_stats 
    ADD COLUMN affection_last_updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Set initial values based on existing relationship_type in companions table
UPDATE relationship_stats rs
SET 
  relationship_intent = CASE
    WHEN EXISTS (
      SELECT 1 FROM companions c 
      WHERE c.id = rs.companion_id 
      AND c.relationship_type = 'friend'
    ) THEN 'friend'
    ELSE 'companion'
  END,
  affection_base = CASE
    WHEN EXISTS (
      SELECT 1 FROM companions c 
      WHERE c.id = rs.companion_id 
      AND c.relationship_type = 'friend'
    ) THEN 3
    ELSE 5
  END
WHERE relationship_intent IS NULL OR relationship_intent = 'companion';

-- Add helpful comments
COMMENT ON COLUMN relationship_stats.relationship_intent IS
  'User chosen relationship trajectory: friend (platonic), evolve (open to progression), companion (romantic)';

COMMENT ON COLUMN relationship_stats.affection_base IS
  'Baseline affection level 0-10, moves slowly based on consistent user signals over time';

COMMENT ON COLUMN relationship_stats.affection_last_updated_at IS
  'Last time affection_base was adjusted, prevents rapid changes';

-- Create helper function to get affection context
CREATE OR REPLACE FUNCTION get_affection_context(
  p_user_id uuid,
  p_companion_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stats RECORD;
  v_result jsonb;
BEGIN
  -- Fetch affection stats
  SELECT 
    relationship_intent,
    affection_base,
    affection_last_updated_at,
    current_streak_days,
    elapsed_days_since_creation
  INTO v_stats
  FROM relationship_stats
  WHERE user_id = p_user_id
    AND companion_id = p_companion_id;
  
  -- Build context object
  v_result := jsonb_build_object(
    'relationship_intent', COALESCE(v_stats.relationship_intent, 'companion'),
    'affection_base', COALESCE(v_stats.affection_base, 5),
    'affection_last_updated_at', v_stats.affection_last_updated_at,
    'current_streak_days', COALESCE(v_stats.current_streak_days, 0),
    'elapsed_days_since_creation', COALESCE(v_stats.elapsed_days_since_creation, 0)
  );
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_affection_context IS
  'Returns affection-related context for prompt generation including intent and base level';

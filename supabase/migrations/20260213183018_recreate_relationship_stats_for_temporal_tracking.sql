/*
  # Recreate Relationship Stats for Temporal Tracking

  ## Overview
  Drops the old unused relationship_stats table and creates a new one optimized for
  temporal awareness tracking. Updates on every user message to provide real-time
  context for AI companion conversations.

  ## Changes
  1. Drops old relationship_stats table (empty, unused schema)
  2. Creates new relationship_stats table with temporal tracking fields
  3. Adds auto-initialization trigger for new companions
  4. Backfills existing companions with initial stats

  ## New Schema
  - Uses companion_id (not character_id)
  - Tracks temporal metrics: streaks, gaps, active days
  - Optimized for prompt context generation
  - One record per user-companion pair (composite primary key)

  ## Security
  - Full RLS enabled
  - Users can only access their own stats
*/

-- ============================================================================
-- Drop old table and recreate
-- ============================================================================

DROP TABLE IF EXISTS relationship_stats CASCADE;

CREATE TABLE relationship_stats (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
  
  -- Temporal tracking
  last_interaction_at timestamptz NOT NULL DEFAULT now(),
  last_interaction_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Engagement metrics
  active_conversation_days integer NOT NULL DEFAULT 0,
  total_messages integer NOT NULL DEFAULT 0,
  elapsed_days_since_creation integer NOT NULL DEFAULT 0,
  
  -- Streak tracking
  current_streak_days integer NOT NULL DEFAULT 0,
  longest_streak_days integer NOT NULL DEFAULT 0,
  previous_interaction_date date,
  
  -- Gap tracking
  longest_gap_days integer NOT NULL DEFAULT 0,
  current_gap_hours numeric(10,2) DEFAULT 0,
  
  -- Pattern analysis
  avg_messages_per_active_day numeric(10,2) DEFAULT 0,
  
  -- Primary key ensures one stats record per user-companion pair
  PRIMARY KEY (user_id, companion_id)
);

-- Indexes for performance
CREATE INDEX idx_relationship_stats_last_interaction
  ON relationship_stats(user_id, last_interaction_at DESC);

CREATE INDEX idx_relationship_stats_companion
  ON relationship_stats(companion_id, last_interaction_at DESC);

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE relationship_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own relationship stats"
  ON relationship_stats
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert relationship stats"
  ON relationship_stats
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can update relationship stats"
  ON relationship_stats
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to initialize relationship stats when companion is created
CREATE OR REPLACE FUNCTION initialize_relationship_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO relationship_stats (
    user_id,
    companion_id,
    last_interaction_at,
    last_interaction_date,
    active_conversation_days,
    total_messages,
    elapsed_days_since_creation,
    current_streak_days,
    longest_streak_days,
    longest_gap_days,
    avg_messages_per_active_day
  ) VALUES (
    NEW.user_id,
    NEW.id,
    NEW.created_at,
    DATE(NEW.created_at),
    0,
    0,
    0,
    0,
    0,
    0,
    0
  )
  ON CONFLICT (user_id, companion_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Trigger to auto-initialize stats when companion is created
DROP TRIGGER IF EXISTS trigger_initialize_relationship_stats ON companions;
CREATE TRIGGER trigger_initialize_relationship_stats
  AFTER INSERT ON companions
  FOR EACH ROW
  EXECUTE FUNCTION initialize_relationship_stats();

-- ============================================================================
-- Backfill existing companions with initial stats
-- ============================================================================

INSERT INTO relationship_stats (
  user_id,
  companion_id,
  last_interaction_at,
  last_interaction_date,
  active_conversation_days,
  total_messages,
  elapsed_days_since_creation,
  current_streak_days,
  longest_streak_days,
  longest_gap_days
)
SELECT 
  c.user_id,
  c.id,
  c.created_at,
  DATE(c.created_at),
  0,
  0,
  0,
  0,
  0,
  0
FROM companions c
ON CONFLICT (user_id, companion_id) DO NOTHING;

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON TABLE relationship_stats IS
  'Tracks aggregate relationship metrics updated on every user message for temporal awareness context.';

COMMENT ON FUNCTION initialize_relationship_stats IS
  'Automatically creates relationship_stats record when a new companion is created.';

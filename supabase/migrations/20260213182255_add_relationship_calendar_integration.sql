/*
  # Relationship Calendar Integration

  ## Overview
  Integrates the Temporal Awareness system with the calendar UI to visualize
  relationship depth through interaction patterns. Creates anchor events,
  tracks daily interactions, and automatically generates milestone events.

  ## New Tables

  ### 1. relationship_days
  Tracks unique dates when user chatted with each companion for calendar visualization.
  - Stores date-level interaction data (NOT individual messages)
  - Used to render subtle calendar dots showing conversation patterns
  - Message count per day for potential future analytics

  Key Features:
  - Unique constraint ensures one record per user/companion/date
  - Optimized for date range queries (calendar month views)
  - Separate from calendar events to avoid database bloat

  ### 2. temporal_milestones
  Tracks relationship milestones that have been reached and acknowledged.
  - Prevents duplicate milestone creation
  - Links to calendar events for celebration
  - Tracks acknowledgment status for AI conversation context

  Milestone Types:
  - chat_day_7: First week of interaction
  - chat_day_30: First month of interaction
  - chat_day_100: Major relationship milestone
  - chat_day_365: One year together

  ## Calendar Event Types
  The existing user_events table already has companion_id and event_type fields.
  New event types used:
  - relationship_anchor: "Met [CompanionName]" on creation day
  - relationship_milestone: "X days with [CompanionName]" at 7/30/100/365 days
  - relationship_day: Synthetic events (not stored) for calendar dots

  ## Security
  - Full RLS enabled on both tables
  - Users can only access their own relationship data
  - Prevent deletion of relationship_days to maintain history
  - temporal_milestones is primarily system-managed

  ## Performance
  - Indexes optimized for calendar date range queries
  - Unique constraints prevent duplicate data
  - Efficient lookups for milestone checking
*/

-- ============================================================================
-- Table 1: relationship_days
-- ============================================================================

CREATE TABLE IF NOT EXISTS relationship_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
  interaction_date date NOT NULL,
  message_count integer NOT NULL DEFAULT 1 CHECK (message_count >= 1),
  created_at timestamptz DEFAULT now(),

  -- Ensure one record per user/companion/date combination
  UNIQUE(user_id, companion_id, interaction_date)
);

-- Indexes for fast calendar queries
CREATE INDEX IF NOT EXISTS idx_relationship_days_user_date
  ON relationship_days(user_id, interaction_date);

CREATE INDEX IF NOT EXISTS idx_relationship_days_companion_date
  ON relationship_days(companion_id, interaction_date);

CREATE INDEX IF NOT EXISTS idx_relationship_days_user_companion
  ON relationship_days(user_id, companion_id);

-- ============================================================================
-- Table 2: temporal_milestones
-- ============================================================================

CREATE TABLE IF NOT EXISTS temporal_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
  milestone_type text NOT NULL CHECK (
    milestone_type IN ('chat_day_7', 'chat_day_30', 'chat_day_100', 'chat_day_365')
  ),
  milestone_date date NOT NULL,
  calendar_event_id uuid REFERENCES user_events(id) ON DELETE SET NULL,
  acknowledged boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),

  -- Ensure one milestone of each type per user/companion
  UNIQUE(user_id, companion_id, milestone_type)
);

-- Indexes for milestone checking and retrieval
CREATE INDEX IF NOT EXISTS idx_temporal_milestones_user_companion
  ON temporal_milestones(user_id, companion_id);

CREATE INDEX IF NOT EXISTS idx_temporal_milestones_calendar_event
  ON temporal_milestones(calendar_event_id)
  WHERE calendar_event_id IS NOT NULL;

-- ============================================================================
-- Row Level Security Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE relationship_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE temporal_milestones ENABLE ROW LEVEL SECURITY;

-- relationship_days policies
CREATE POLICY "Users can view own relationship days"
  ON relationship_days
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own relationship days"
  ON relationship_days
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own relationship days"
  ON relationship_days
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Note: No DELETE policy - preserve relationship history

-- temporal_milestones policies
CREATE POLICY "Users can view own milestones"
  ON temporal_milestones
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert milestones"
  ON temporal_milestones
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own milestone acknowledgment"
  ON temporal_milestones
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- Helper Function: Get Total Chat Days
-- ============================================================================

CREATE OR REPLACE FUNCTION get_total_chat_days(
  p_user_id uuid,
  p_companion_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_days integer;
BEGIN
  -- Count unique interaction dates for this user-companion pair
  SELECT COUNT(*)
  INTO v_total_days
  FROM relationship_days
  WHERE user_id = p_user_id
    AND companion_id = p_companion_id;

  RETURN COALESCE(v_total_days, 0);
END;
$$;

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON TABLE relationship_days IS
  'Tracks unique dates when user chatted with each companion. Used for calendar visualization of interaction patterns.';

COMMENT ON TABLE temporal_milestones IS
  'Tracks relationship milestones (7/30/100/365 chat days) with links to calendar events.';

COMMENT ON FUNCTION get_total_chat_days IS
  'Returns the total number of unique days a user has chatted with a specific companion.';

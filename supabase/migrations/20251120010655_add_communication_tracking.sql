/*
  # Communication Behavior Tracking

  ## Overview
  Tracks when users communicate well vs poorly.
  Rewards good communication habits (telling her when busy).
  
  ## New Columns for relationship_stats
  - good_communication_count (int) - times user gave heads up
  - poor_communication_count (int) - times user disappeared without warning
  
  This helps gamify and reinforce positive communication patterns.
*/

-- Add communication tracking to relationship_stats
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'relationship_stats' AND column_name = 'good_communication_count'
  ) THEN
    ALTER TABLE relationship_stats ADD COLUMN good_communication_count int DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'relationship_stats' AND column_name = 'poor_communication_count'
  ) THEN
    ALTER TABLE relationship_stats ADD COLUMN poor_communication_count int DEFAULT 0;
  END IF;
END $$;
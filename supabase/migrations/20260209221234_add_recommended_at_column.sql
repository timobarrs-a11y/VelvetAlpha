/*
  # Add recommended_at column to video_recommendations

  Adds the missing recommended_at timestamp column to track when videos were recommended.

  ## Changes
  - Add `recommended_at` column with default value of created_at
  - Create index for performance
*/

-- Add recommended_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'video_recommendations' AND column_name = 'recommended_at'
  ) THEN
    ALTER TABLE video_recommendations ADD COLUMN recommended_at timestamptz DEFAULT now() NOT NULL;
    
    -- Backfill existing rows with created_at value
    UPDATE video_recommendations SET recommended_at = created_at WHERE recommended_at IS NULL;
  END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_video_recommendations_recommended_at ON video_recommendations(recommended_at DESC);
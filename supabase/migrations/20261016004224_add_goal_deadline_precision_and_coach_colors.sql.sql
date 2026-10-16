/*
# Add deadline precision to goals and coach colors to companions

## Purpose
This migration supports two features:
1. Flexible goal deadlines — users can set a deadline as month/year, quarter/year, or season/year (not just an exact date).
2. Coach identity colors — each coach (mentor companion) gets a signature color so their commitments, plans, and messages are visually distinguishable across the app.

## Changes

### 1. user_goals table — new column: deadline_precision
- `deadline_precision` (text, nullable, default 'exact')
  - 'exact' = specific date (existing behavior)
  - 'month' = month + year only
  - 'quarter' = Q1–Q4 + year
  - 'season' = Spring/Summer/Fall/Winter + year
- Existing rows default to 'exact' since they already have a specific target_date.

### 2. companions table — new column: coach_color
- `coach_color` (text, nullable)
  - Stores a color key from the palette: 'blue', 'green', 'amber', 'coral', 'teal'
  - Only relevant for companions with relationship_type = 'mentor' (coaches)
  - Nullable so existing companions remain unaffected until a color is assigned.

### 3. Index on user_goals.companion_id
- Adds an index on `source_companion_id` to speed up per-coach goal queries.

## Security
- No RLS policy changes. All existing policies remain in effect.
- No data is deleted or transformed — only additive columns and an index.
*/

-- Add deadline_precision to user_goals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_goals' AND column_name = 'deadline_precision'
  ) THEN
    ALTER TABLE user_goals ADD COLUMN deadline_precision text DEFAULT 'exact';
  END IF;
END $$;

-- Add coach_color to companions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companions' AND column_name = 'coach_color'
  ) THEN
    ALTER TABLE companions ADD COLUMN coach_color text;
  END IF;
END $$;

-- Index for per-coach goal lookups
CREATE INDEX IF NOT EXISTS idx_user_goals_companion_id ON user_goals(source_companion_id);

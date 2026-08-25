/*
# Add Goal Discovery Columns to user_goals

## Purpose
Supports the new onboarding goal-discovery conversation. When a user signs up,
they now have a short AI conversation with Velvet to surface what they're
working toward. This migration adds two columns to track how the goal was
discovered and store the conversation transcript for QA.

## Modified Tables
- `user_goals`:
  - `source` (text, default 'stated') — 'stated' if the user picked directly,
    'discovered' if surfaced through the AI discovery conversation
  - `discovery_transcript` (jsonb, nullable) — the full conversation turns
    from the discovery chat, stored for QA/debugging only (admin-visible, never
    shown to users)

## Security
- No new tables; existing user_goals RLS policies cover the new columns
- The `source` column has a CHECK constraint limiting it to 'stated' | 'discovered'
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_goals' AND column_name = 'source'
  ) THEN
    ALTER TABLE user_goals ADD COLUMN source text NOT NULL DEFAULT 'stated';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_goals' AND column_name = 'discovery_transcript'
  ) THEN
    ALTER TABLE user_goals ADD COLUMN discovery_transcript jsonb;
  END IF;
END $$;

-- Add constraint on source column (drop first for idempotency)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'valid_goal_source' AND table_name = 'user_goals'
  ) THEN
    ALTER TABLE user_goals
      ADD CONSTRAINT valid_goal_source CHECK (source IN ('stated', 'discovered'));
  END IF;
END $$;

/*
# Coaching State Engine — Commitments, Sessions, and Cross-Companion Goals

## Purpose
This migration adds the structured state layer that backs the coaching system.
Today coaching is purely prompt-level — the LLM is told to "follow up on commitments"
but has no actual commitment store to read from. This migration creates:
1. `coaching_commitments` — what the user committed to, by when, status, linked to a goal
2. `coaching_sessions` — session boundaries with summaries for cross-session continuity
3. Adds `source_companion_id` to `user_goals` so any companion can see all user goals
4. Adds `confidence_score` and `last_confirmed_at` to `user_insights` for fact grounding

## New Tables

### coaching_commitments
- `id` (uuid, PK)
- `user_id` (uuid, NOT NULL, references auth.users, ON DELETE CASCADE)
- `companion_id` (uuid, NOT NULL, references companions, ON DELETE CASCADE) — the coach that extracted this commitment
- `goal_id` (uuid, nullable, references user_goals, ON DELETE SET NULL) — optional link to a structured goal
- `description` (text, NOT NULL) — what the user committed to (e.g. "send the draft by Friday")
- `due_date` (timestamptz, nullable) — when the user said they'd do it
- `status` (text, NOT NULL, default 'pending') — pending / completed / missed / renegotiated
- `extracted_from_message` (text, nullable) — the user message the commitment was extracted from (for provenance)
- `completed_at` (timestamptz, nullable) — when the user confirmed completion
- `created_at` (timestamptz, NOT NULL, default now())
- `updated_at` (timestamptz, NOT NULL, default now())

### coaching_sessions
- `id` (uuid, PK)
- `user_id` (uuid, NOT NULL, references auth.users, ON DELETE CASCADE)
- `companion_id` (uuid, NOT NULL, references companions, ON DELETE CASCADE)
- `status` (text, NOT NULL, default 'open') — open / closed
- `opened_at` (timestamptz, NOT NULL, default now())
- `closed_at` (timestamptz, nullable)
- `summary` (text, nullable) — AI-generated session summary (diagnosis, direction, commitment made)
- `commitment_ids` (uuid[], nullable) — commitments made during this session
- `message_count` (integer, default 0)
- `created_at` (timestamptz, NOT NULL, default now())

## Modified Tables
- `user_goals`: adds `source_companion_id` (uuid, nullable, references companions, ON DELETE SET NULL)
  — identifies which companion (coach) originated the goal, so other companions can see it's from a coach
- `user_insights`: adds `confidence_score` (double precision, default 0.5) and `last_confirmed_at` (timestamptz, nullable)
  — used to filter stale or low-confidence facts before injecting them into prompts

## Security
- RLS enabled on both new tables with owner-scoped CRUD (4 policies each: select/insert/update/delete)
- `user_id` defaults to `auth.uid()` on both new tables
- `source_companion_id` column addition is idempotent (uses DO $$ block)

## Indexes
- `coaching_commitments`: index on (user_id, status) for fetching open commitments
- `coaching_commitments`: index on (user_id, due_date) for deadline-aware nudges
- `coaching_sessions`: index on (user_id, companion_id, status) for finding active sessions
*/

-- =====================================================
-- 1. coaching_commitments table
-- =====================================================
CREATE TABLE IF NOT EXISTS coaching_commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
  goal_id uuid REFERENCES user_goals(id) ON DELETE SET NULL,
  description text NOT NULL,
  due_date timestamptz,
  status text NOT NULL DEFAULT 'pending',
  extracted_from_message text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coaching_commitments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_commitments" ON coaching_commitments;
CREATE POLICY "select_own_commitments" ON coaching_commitments FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_commitments" ON coaching_commitments;
CREATE POLICY "insert_own_commitments" ON coaching_commitments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_commitments" ON coaching_commitments;
CREATE POLICY "update_own_commitments" ON coaching_commitments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_commitments" ON coaching_commitments;
CREATE POLICY "delete_own_commitments" ON coaching_commitments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_commitments_user_status ON coaching_commitments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_commitments_user_due ON coaching_commitments(user_id, due_date);

-- =====================================================
-- 2. coaching_sessions table
-- =====================================================
CREATE TABLE IF NOT EXISTS coaching_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  summary text,
  commitment_ids uuid[] DEFAULT '{}',
  message_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coaching_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_sessions" ON coaching_sessions;
CREATE POLICY "select_own_sessions" ON coaching_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_sessions" ON coaching_sessions;
CREATE POLICY "insert_own_sessions" ON coaching_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_sessions" ON coaching_sessions;
CREATE POLICY "update_own_sessions" ON coaching_sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_sessions" ON coaching_sessions;
CREATE POLICY "delete_own_sessions" ON coaching_sessions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_user_companion_status ON coaching_sessions(user_id, companion_id, status);

-- =====================================================
-- 3. Add source_companion_id to user_goals
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_goals' AND column_name = 'source_companion_id'
  ) THEN
    ALTER TABLE user_goals ADD COLUMN source_companion_id uuid REFERENCES companions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =====================================================
-- 4. Add confidence_score and last_confirmed_at to user_insights
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_insights' AND column_name = 'confidence_score'
  ) THEN
    ALTER TABLE user_insights ADD COLUMN confidence_score double precision DEFAULT 0.5;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_insights' AND column_name = 'last_confirmed_at'
  ) THEN
    ALTER TABLE user_insights ADD COLUMN last_confirmed_at timestamptz;
  END IF;
END $$;

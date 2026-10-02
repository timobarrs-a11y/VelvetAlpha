/*
# Create memory eval training system

1. Purpose
- Enables users to contribute to a crowd-sourced eval dataset by role-playing
  through realistic life scenarios. The system extracts memories from their
  responses using the same extraction pipeline, then asks the user to confirm
  or correct what was extracted. Confirmed extractions become ground-truth
  eval cases that can be replayed against proposed changes.

2. New Tables

- `eval_scenarios`: Pre-written life scenarios the user role-plays through.
  - id (uuid PK)
  - title (text) — short label shown in the scenario picker
  - category (text) — e.g. 'work', 'relationships', 'health', 'hobbies'
  - prompt (text) — the scenario setup the user reads
  - context_lines (text[]) — context lines to seed the conversation
  - difficulty (text) — 'easy', 'medium', 'hard' — controls ambiguity
  - expected_facts (jsonb) — the facts a correct extraction should capture
  - sort_order (int) — display order
  - is_active (boolean, default true)

- `eval_responses`: A user's role-play response to a scenario.
  - id (uuid PK)
  - scenario_id (uuid FK → eval_scenarios)
  - user_id (uuid FK → auth.users, DEFAULT auth.uid())
  - response_text (text) — what the user typed as their role-play
  - quality_tag (text) — 'good', 'goofy', 'flagged' (admin can tag)
  - created_at (timestamptz)

- `eval_extractions`: What the extraction pipeline pulled from the response.
  - id (uuid PK)
  - response_id (uuid FK → eval_responses)
  - extracted_json (jsonb) — raw extraction output
  - extracted_text (text) — human-readable summary of extracted facts
  - model (text) — which model did the extraction
  - created_at (timestamptz)

- `eval_verifications`: User's confirmation/correction of an extraction.
  - id (uuid PK)
  - extraction_id (uuid FK → eval_extractions)
  - user_id (uuid FK → auth.users, DEFAULT auth.uid())
  - status (text) — 'confirmed' | 'corrected' | 'rejected'
  - corrected_json (jsonb) — user's corrected version (null if confirmed)
  - notes (text) — optional feedback
  - is_ground_truth (boolean, default false) — set by admin/promotion
  - created_at (timestamptz)

3. Security
- eval_scenarios: readable by all authenticated users (SELECT), writes by
  service_role only (admin manages scenarios).
- eval_responses: users can SELECT/INSERT their own; admin can SELECT all.
- eval_extractions: users can SELECT their own (via response ownership);
  INSERT by service_role only (edge function writes these).
- eval_verifications: users can SELECT/INSERT/UPDATE their own;
  service_role can promote to ground truth.
*/

-- eval_scenarios
CREATE TABLE IF NOT EXISTS eval_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  prompt text NOT NULL,
  context_lines text[] DEFAULT '{}',
  difficulty text NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  expected_facts jsonb DEFAULT '[]'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE eval_scenarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_eval_scenarios" ON eval_scenarios;
CREATE POLICY "select_eval_scenarios"
ON eval_scenarios FOR SELECT
TO authenticated USING (is_active = true);

-- eval_responses
CREATE TABLE IF NOT EXISTS eval_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid NOT NULL REFERENCES eval_scenarios(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  response_text text NOT NULL,
  quality_tag text DEFAULT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE eval_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_eval_responses" ON eval_responses;
CREATE POLICY "select_own_eval_responses"
ON eval_responses FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_eval_responses" ON eval_responses;
CREATE POLICY "insert_own_eval_responses"
ON eval_responses FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_eval_responses" ON eval_responses;
CREATE POLICY "update_own_eval_responses"
ON eval_responses FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_eval_responses_user ON eval_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_eval_responses_scenario ON eval_responses(scenario_id);

-- eval_extractions
CREATE TABLE IF NOT EXISTS eval_extractions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES eval_responses(id) ON DELETE CASCADE,
  extracted_json jsonb DEFAULT '{}'::jsonb,
  extracted_text text DEFAULT '',
  model text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE eval_extractions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_eval_extractions" ON eval_extractions;
CREATE POLICY "select_own_eval_extractions"
ON eval_extractions FOR SELECT
TO authenticated USING (
  EXISTS (
    SELECT 1 FROM eval_responses
    WHERE eval_responses.id = eval_extractions.response_id
    AND eval_responses.user_id = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS idx_eval_extractions_response ON eval_extractions(response_id);

-- eval_verifications
CREATE TABLE IF NOT EXISTS eval_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_id uuid NOT NULL REFERENCES eval_extractions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('confirmed', 'corrected', 'rejected')),
  corrected_json jsonb DEFAULT NULL,
  notes text DEFAULT '',
  is_ground_truth boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE eval_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_eval_verifications" ON eval_verifications;
CREATE POLICY "select_own_eval_verifications"
ON eval_verifications FOR SELECT
TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_eval_verifications" ON eval_verifications;
CREATE POLICY "insert_own_eval_verifications"
ON eval_verifications FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_eval_verifications" ON eval_verifications;
CREATE POLICY "update_own_eval_verifications"
ON eval_verifications FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_eval_verifications_user ON eval_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_eval_verifications_extraction ON eval_verifications(extraction_id);

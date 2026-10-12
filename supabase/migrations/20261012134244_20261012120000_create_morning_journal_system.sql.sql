/*
# Create Morning Journal System

1. New Tables
- `journal_sessions` — One per journaling session (typically one per morning).
  - id, user_id, session_date, phase, mood/energy/focus ratings, journal_entry, timestamps
- `journal_qa` — Individual question-and-answer exchanges within a session.
  - id, session_id, user_id, question, question_key, answer, display_order, timestamps

2. Security
- RLS enabled on both tables, owner-scoped CRUD via auth.uid().

3. Indexes
- journal_sessions: unique (user_id, session_date) — one session per day
- journal_qa: session_id index for efficient joins
*/

CREATE TABLE IF NOT EXISTS journal_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  phase text NOT NULL DEFAULT 'questions' CHECK (phase IN ('questions', 'ratings', 'revealed', 'skipped')),
  mood_rating integer CHECK (mood_rating >= 1 AND mood_rating <= 10),
  energy_rating integer CHECK (energy_rating >= 1 AND energy_rating <= 10),
  focus_rating integer CHECK (focus_rating >= 1 AND focus_rating <= 10),
  journal_entry text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS journal_sessions_user_date_unique
  ON journal_sessions (user_id, session_date);

ALTER TABLE journal_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_journal_sessions" ON journal_sessions;
CREATE POLICY "select_own_journal_sessions" ON journal_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_journal_sessions" ON journal_sessions;
CREATE POLICY "insert_own_journal_sessions" ON journal_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_journal_sessions" ON journal_sessions;
CREATE POLICY "update_own_journal_sessions" ON journal_sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_journal_sessions" ON journal_sessions;
CREATE POLICY "delete_own_journal_sessions" ON journal_sessions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS journal_qa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES journal_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  question text NOT NULL,
  question_key text,
  answer text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz
);

CREATE INDEX IF NOT EXISTS journal_qa_session_idx ON journal_qa (session_id);

ALTER TABLE journal_qa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_journal_qa" ON journal_qa;
CREATE POLICY "select_own_journal_qa" ON journal_qa FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_journal_qa" ON journal_qa;
CREATE POLICY "insert_own_journal_qa" ON journal_qa FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_journal_qa" ON journal_qa;
CREATE POLICY "update_own_journal_qa" ON journal_qa FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_journal_qa" ON journal_qa;
CREATE POLICY "delete_own_journal_qa" ON journal_qa FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

/*
# Create confidence_checks table for coaching confidence trend tracking

## Purpose
Stores periodic self-reported confidence ratings from the user about their
goals. The coach asks "How confident are you feeling about [goal]?" on a
1-10 scale during check-ins, and the response is logged here. Over time
this builds a trend line shown on the Progress page.

## New Table: confidence_checks
- `id` (uuid, PK)
- `user_id` (uuid, NOT NULL, references auth.users, ON DELETE CASCADE)
- `goal_id` (uuid, nullable, references user_goals, ON DELETE SET NULL) — which goal this check relates to
- `companion_id` (uuid, nullable, references companions, ON DELETE SET NULL) — which coach asked
- `score` (integer, NOT NULL, CHECK 1-10) — self-reported confidence
- `note` (text, nullable) — optional context from the user ("I'm struggling because...")
- `asked_during_session` (uuid, nullable) — coaching_sessions id if asked during a session
- `created_at` (timestamptz, NOT NULL, default now())

## Security
- RLS enabled with owner-scoped CRUD (4 policies: select/insert/update/delete)
- `user_id` defaults to `auth.uid()`

## Indexes
- (user_id, created_at DESC) for fetching trend data
- (user_id, goal_id) for per-goal confidence history
*/

CREATE TABLE IF NOT EXISTS confidence_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id uuid REFERENCES user_goals(id) ON DELETE SET NULL,
  companion_id uuid REFERENCES companions(id) ON DELETE SET NULL,
  score integer NOT NULL CHECK (score >= 1 AND score <= 10),
  note text,
  asked_during_session uuid REFERENCES coaching_sessions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE confidence_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_confidence_checks" ON confidence_checks;
CREATE POLICY "select_own_confidence_checks" ON confidence_checks FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_confidence_checks" ON confidence_checks;
CREATE POLICY "insert_own_confidence_checks" ON confidence_checks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_confidence_checks" ON confidence_checks;
CREATE POLICY "update_own_confidence_checks" ON confidence_checks FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_confidence_checks" ON confidence_checks;
CREATE POLICY "delete_own_confidence_checks" ON confidence_checks FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_confidence_checks_user_created ON confidence_checks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_confidence_checks_user_goal ON confidence_checks(user_id, goal_id);

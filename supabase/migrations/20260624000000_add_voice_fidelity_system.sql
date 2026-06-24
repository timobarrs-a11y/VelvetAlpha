/*
  # Voice Fidelity System (drift detection & governed re-anchoring)

  ## Problem
  Over long-running conversations, a companion's behavior drifts away from its
  signature voice (tone flattening, vocabulary loss, boundary creep). This drift
  is invisible until a user notices the companion "feels off". We need to score
  recent behavior against a fixed baseline and re-anchor when it degrades.

  ## What this adds
  1. `companion_drift_log` — append-only audit trail of every fidelity inspection.
     One row per inspection, storing per-dimension and overall scores (0.0-1.0).
  2. New columns on `companions`:
     - `voice_baseline`        text   — frozen "golden fingerprint" set once.
     - `drift_vfs`             real   — latest overall Voice Fidelity Score.
     - `drift_needs_correction` bool  — true when last score crossed the threshold.
     - `drift_checked_at`      timestamptz — when the last inspection ran.

  ## Security
  - RLS on `companion_drift_log`: a user can only see/insert rows for their own
    companions (ownership checked via the companions table).
  - New companion columns inherit existing companions RLS.
*/

-- 1. Drift columns on companions (the live drift status the chat reads)
ALTER TABLE companions
  ADD COLUMN IF NOT EXISTS voice_baseline text,
  ADD COLUMN IF NOT EXISTS drift_vfs real,
  ADD COLUMN IF NOT EXISTS drift_needs_correction boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS drift_checked_at timestamptz;

-- 2. Append-only inspection log (the audit trail)
CREATE TABLE IF NOT EXISTS companion_drift_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  companion_id uuid NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vfs_overall real NOT NULL,
  vfs_tone real,
  vfs_vocabulary real,
  vfs_emotional real,
  vfs_energy real,
  vfs_boundary real,
  drift_detected boolean DEFAULT false,
  correction_applied boolean DEFAULT false,
  messages_sampled integer DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE companion_drift_log ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies — user can only touch logs for companions they own
CREATE POLICY "select_own_drift_log" ON companion_drift_log FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_own_drift_log" ON companion_drift_log FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM companions c
      WHERE c.id = companion_id AND c.user_id = auth.uid()
    )
  );

-- 5. Indexes for trend queries
CREATE INDEX IF NOT EXISTS idx_drift_log_companion ON companion_drift_log(companion_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_drift_log_user ON companion_drift_log(user_id);

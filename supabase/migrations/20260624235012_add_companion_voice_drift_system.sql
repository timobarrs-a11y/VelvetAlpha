ALTER TABLE companions
  ADD COLUMN IF NOT EXISTS voice_baseline text,
  ADD COLUMN IF NOT EXISTS drift_vfs real,
  ADD COLUMN IF NOT EXISTS drift_needs_correction boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS drift_checked_at timestamptz;

CREATE TABLE IF NOT EXISTS companion_drift_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  companion_id uuid NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vfs_overall real NOT NULL,
  vfs_tone real, vfs_vocabulary real, vfs_emotional real,
  vfs_energy real, vfs_boundary real,
  drift_detected boolean DEFAULT false,
  correction_applied boolean DEFAULT false,
  messages_sampled integer DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE companion_drift_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_drift_log" ON companion_drift_log FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_own_drift_log" ON companion_drift_log FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = user_id AND EXISTS (
      SELECT 1 FROM companions c WHERE c.id = companion_id AND c.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_drift_log_companion ON companion_drift_log(companion_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_drift_log_user ON companion_drift_log(user_id);
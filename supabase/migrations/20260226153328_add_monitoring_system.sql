/*
  # Add Monitoring System

  ## Summary
  Adds comprehensive monitoring infrastructure to support production observability.

  ## New Tables

  ### `api_performance_logs`
  - Tracks every edge function call with latency, status, and cost metadata
  - Used to identify slow endpoints, error spikes, and AI cost tracking
  - Columns: function_name, duration_ms, status_code, user_id, metadata

  ### `health_checks`
  - Periodic uptime snapshots for key services (db, edge functions, ai)
  - Columns: service_name, status, latency_ms, error_message, checked_at

  ### `alert_events`
  - Fired when a threshold breach is detected (error spike, latency spike, etc.)
  - Columns: alert_type, severity, title, message, resolved, resolved_at, metadata

  ## Modified Tables

  ### `error_logs` (existing)
  - Adds `component`, `session_id`, `browser`, `os` columns for richer context

  ## Security
  - RLS enabled on all new tables
  - Admin-only read via user_role = 'admin' check on user_profiles
*/

-- ─── api_performance_logs ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_performance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  duration_ms integer NOT NULL,
  status_code integer NOT NULL DEFAULT 200,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  model_used text,
  tokens_used integer,
  estimated_cost_usd numeric(10, 6),
  error_message text,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE api_performance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own performance logs"
  ON api_performance_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Admins can read all performance logs"
  ON api_performance_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.user_role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_api_perf_function ON api_performance_logs(function_name);
CREATE INDEX IF NOT EXISTS idx_api_perf_created ON api_performance_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_perf_status ON api_performance_logs(status_code);

-- ─── health_checks ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('healthy', 'degraded', 'down')),
  latency_ms integer,
  error_message text,
  checked_at timestamptz DEFAULT now()
);

ALTER TABLE health_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read health checks"
  ON health_checks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.user_role = 'admin'
    )
  );

CREATE POLICY "Admins can insert health checks"
  ON health_checks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.user_role = 'admin'
    )
  );

-- ─── alert_events ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alert_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  title text NOT NULL,
  message text NOT NULL,
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE alert_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read alert events"
  ON alert_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.user_role = 'admin'
    )
  );

CREATE POLICY "Admins can insert alert events"
  ON alert_events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.user_role = 'admin'
    )
  );

CREATE POLICY "Admins can update alert events"
  ON alert_events FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.user_role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.user_role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_alert_severity ON alert_events(severity, resolved, created_at DESC);

-- ─── error_logs enhancements ────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'error_logs' AND column_name = 'component'
  ) THEN
    ALTER TABLE error_logs ADD COLUMN component text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'error_logs' AND column_name = 'session_id'
  ) THEN
    ALTER TABLE error_logs ADD COLUMN session_id text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'error_logs' AND column_name = 'browser'
  ) THEN
    ALTER TABLE error_logs ADD COLUMN browser text DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'error_logs' AND column_name = 'os'
  ) THEN
    ALTER TABLE error_logs ADD COLUMN os text DEFAULT '';
  END IF;
END $$;

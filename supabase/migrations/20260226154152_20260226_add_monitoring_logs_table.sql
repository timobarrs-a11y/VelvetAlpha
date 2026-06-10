/*
  # Add Monitoring Logs Table for Health Checks

  1. New Tables
    - `monitoring_logs` - Stores uptime and health check results
      - `id` (uuid, primary key)
      - `check_type` (text) - Type of check (uptime, performance, error)
      - `status` (text) - healthy, degraded, or down
      - `details` (jsonb) - Additional check details
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `monitoring_logs` table
    - Only admin users can view logs
*/

CREATE TABLE IF NOT EXISTS monitoring_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_type text NOT NULL,
  status text NOT NULL CHECK (status IN ('healthy', 'degraded', 'down')),
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE monitoring_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin only can view monitoring logs"
  ON monitoring_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.user_role = 'admin'
    )
  );

CREATE POLICY "Service can insert monitoring logs"
  ON monitoring_logs
  FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_monitoring_logs_created_at ON monitoring_logs(created_at DESC);
CREATE INDEX idx_monitoring_logs_check_type ON monitoring_logs(check_type);

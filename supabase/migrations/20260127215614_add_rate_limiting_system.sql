/*
  # Add Rate Limiting System

  1. New Tables
    - `rate_limits`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `endpoint` (text) - which API endpoint was called
      - `called_at` (timestamptz) - when the call was made
      - `ip_address` (text) - optional IP tracking
      - `user_agent` (text) - optional user agent tracking

  2. Indexes
    - Index on user_id + called_at for efficient queries
    - Index on endpoint + called_at for endpoint-specific limits

  3. Security
    - Enable RLS on rate_limits table
    - Only authenticated users can see their own rate limit records
    - System can insert records for all users

  4. Functions
    - Function to check rate limit
    - Function to clean up old rate limit records

  5. Notes
    - Rate limits are per-user, per-endpoint
    - Records older than 24 hours can be cleaned up
    - This enables flexible rate limiting strategies
*/

-- Create rate_limits table
CREATE TABLE IF NOT EXISTS rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  called_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_time
  ON rate_limits(user_id, called_at DESC);

CREATE INDEX IF NOT EXISTS idx_rate_limits_endpoint_time
  ON rate_limits(endpoint, called_at DESC);

-- Enable RLS
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Users can view their own rate limit records
CREATE POLICY "Users can view own rate limits"
  ON rate_limits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role can insert rate limit records (used by edge functions)
CREATE POLICY "Service can insert rate limits"
  ON rate_limits FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to check if user has exceeded rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id uuid,
  p_endpoint text,
  p_limit_count integer,
  p_time_window_minutes integer
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  call_count integer;
BEGIN
  -- Count calls within time window
  SELECT COUNT(*)
  INTO call_count
  FROM rate_limits
  WHERE user_id = p_user_id
    AND endpoint = p_endpoint
    AND called_at > (now() - (p_time_window_minutes || ' minutes')::interval);

  -- Return true if under limit, false if exceeded
  RETURN call_count < p_limit_count;
END;
$$;

-- Function to record a rate limit call
CREATE OR REPLACE FUNCTION record_rate_limit(
  p_user_id uuid,
  p_endpoint text,
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO rate_limits (user_id, endpoint, ip_address, user_agent)
  VALUES (p_user_id, p_endpoint, p_ip_address, p_user_agent);
END;
$$;

-- Function to clean up old rate limit records (run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count integer;
BEGIN
  -- Delete records older than 24 hours
  DELETE FROM rate_limits
  WHERE called_at < (now() - interval '24 hours');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
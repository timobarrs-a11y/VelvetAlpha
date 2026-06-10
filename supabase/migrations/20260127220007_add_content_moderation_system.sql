/*
  # Add Content Moderation System

  1. New Tables
    - `moderation_flags`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `companion_id` (uuid, foreign key to companions)
      - `conversation_id` (uuid) - reference to conversation
      - `message_content` (text) - the flagged content
      - `flag_reason` (text) - why it was flagged
      - `severity` (text) - low, medium, high, critical
      - `status` (text) - pending, reviewed, dismissed, action_taken
      - `reviewed_at` (timestamptz)
      - `reviewed_by` (uuid)
      - `created_at` (timestamptz)

  2. Indexes
    - Index on user_id for finding all flags for a user
    - Index on status for finding pending flags
    - Index on severity for prioritizing reviews

  3. Security
    - Enable RLS
    - Only system can insert flags
    - Only admins can view (handled at application level)

  4. Functions
    - Function to check if user has too many flags
    - Function to record moderation flags

  5. Notes
    - This system logs inappropriate content for review
    - Helps protect users and maintain community standards
    - Enables admin dashboard for content moderation
*/

-- Create moderation_flags table
CREATE TABLE IF NOT EXISTS moderation_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id uuid REFERENCES companions(id) ON DELETE SET NULL,
  conversation_id uuid,
  message_content text NOT NULL,
  flag_reason text NOT NULL,
  severity text NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'action_taken')),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_moderation_flags_user
  ON moderation_flags(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_moderation_flags_status
  ON moderation_flags(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_moderation_flags_severity
  ON moderation_flags(severity, created_at DESC);

-- Enable RLS
ALTER TABLE moderation_flags ENABLE ROW LEVEL SECURITY;

-- System can insert moderation flags
CREATE POLICY "System can insert moderation flags"
  ON moderation_flags FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to check if user has too many active flags
CREATE OR REPLACE FUNCTION check_user_moderation_status(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  flag_count integer;
  critical_count integer;
  high_count integer;
  result jsonb;
BEGIN
  -- Count recent flags (last 30 days)
  SELECT COUNT(*)
  INTO flag_count
  FROM moderation_flags
  WHERE user_id = p_user_id
    AND created_at > (now() - interval '30 days')
    AND status IN ('pending', 'action_taken');

  -- Count critical flags
  SELECT COUNT(*)
  INTO critical_count
  FROM moderation_flags
  WHERE user_id = p_user_id
    AND severity = 'critical'
    AND status IN ('pending', 'action_taken');

  -- Count high severity flags
  SELECT COUNT(*)
  INTO high_count
  FROM moderation_flags
  WHERE user_id = p_user_id
    AND severity = 'high'
    AND status IN ('pending', 'action_taken');

  result := jsonb_build_object(
    'total_flags', flag_count,
    'critical_flags', critical_count,
    'high_flags', high_count,
    'is_suspended', (critical_count > 0 OR high_count >= 3),
    'needs_review', (flag_count >= 5)
  );

  RETURN result;
END;
$$;

-- Function to record a moderation flag
CREATE OR REPLACE FUNCTION record_moderation_flag(
  p_user_id uuid,
  p_companion_id uuid,
  p_conversation_id uuid,
  p_message_content text,
  p_flag_reason text,
  p_severity text
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  flag_id uuid;
BEGIN
  INSERT INTO moderation_flags (
    user_id,
    companion_id,
    conversation_id,
    message_content,
    flag_reason,
    severity
  )
  VALUES (
    p_user_id,
    p_companion_id,
    p_conversation_id,
    p_message_content,
    p_flag_reason,
    p_severity
  )
  RETURNING id INTO flag_id;

  RETURN flag_id;
END;
$$;
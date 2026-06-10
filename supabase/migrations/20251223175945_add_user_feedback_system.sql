/*
  # Add User Feedback System

  1. New Tables
    - `user_feedback`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `email` (text, optional - for anonymous users)
      - `feedback_type` (text - bug, feature, improvement, other)
      - `message` (text - the actual feedback)
      - `page_url` (text - where they submitted from)
      - `status` (text - new, reviewed, implemented, dismissed)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `user_feedback` table
    - Allow anyone to insert feedback (even unauthenticated users)
    - Only authenticated users can read their own feedback
    - Admin access would need to be added separately

  3. Indexes
    - Index on user_id for faster queries
    - Index on status for admin filtering
    - Index on created_at for chronological sorting
*/

CREATE TABLE IF NOT EXISTS user_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text,
  feedback_type text NOT NULL DEFAULT 'other',
  message text NOT NULL,
  page_url text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_feedback_type CHECK (feedback_type IN ('bug', 'feature', 'improvement', 'other')),
  CONSTRAINT valid_status CHECK (status IN ('new', 'reviewed', 'implemented', 'dismissed'))
);

ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

-- Allow anyone (even anonymous) to submit feedback
CREATE POLICY "Anyone can submit feedback"
  ON user_feedback
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Users can read their own feedback
CREATE POLICY "Users can read own feedback"
  ON user_feedback
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_status ON user_feedback(status);
CREATE INDEX IF NOT EXISTS idx_user_feedback_created_at ON user_feedback(created_at DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_user_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_feedback_updated_at
  BEFORE UPDATE ON user_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_user_feedback_updated_at();

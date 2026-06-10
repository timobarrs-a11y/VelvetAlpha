/*
  # Daily Ritual System

  1. New Tables
    - `daily_rituals`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `companion_id` (uuid, references companions)
      - `ritual_type` (text) - 'morning', 'evening', 'night'
      - `last_triggered_at` (timestamptz)
      - `enabled` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `scheduled_messages`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `companion_id` (uuid, references companions)
      - `message_content` (text)
      - `scheduled_for` (timestamptz)
      - `delivered_at` (timestamptz, nullable)
      - `message_type` (text) - 'daily_ritual', 'check_in', 'nudge'
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own rituals

  3. Indexes
    - Add index on user_id and companion_id for fast lookups
    - Add index on scheduled_for for efficient time-based queries
*/

-- Daily rituals table
CREATE TABLE IF NOT EXISTS daily_rituals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  companion_id uuid REFERENCES companions(id) ON DELETE CASCADE NOT NULL,
  ritual_type text NOT NULL CHECK (ritual_type IN ('morning', 'evening', 'night')),
  last_triggered_at timestamptz,
  enabled boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, companion_id, ritual_type)
);

-- Scheduled messages table
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  companion_id uuid REFERENCES companions(id) ON DELETE CASCADE NOT NULL,
  message_content text NOT NULL,
  scheduled_for timestamptz NOT NULL,
  delivered_at timestamptz,
  message_type text NOT NULL CHECK (message_type IN ('daily_ritual', 'check_in', 'nudge')),
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE daily_rituals ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for daily_rituals
CREATE POLICY "Users can view own daily rituals"
  ON daily_rituals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily rituals"
  ON daily_rituals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily rituals"
  ON daily_rituals FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own daily rituals"
  ON daily_rituals FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for scheduled_messages
CREATE POLICY "Users can view own scheduled messages"
  ON scheduled_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scheduled messages"
  ON scheduled_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scheduled messages"
  ON scheduled_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own scheduled messages"
  ON scheduled_messages FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS daily_rituals_user_companion_idx ON daily_rituals(user_id, companion_id);
CREATE INDEX IF NOT EXISTS scheduled_messages_user_companion_idx ON scheduled_messages(user_id, companion_id);
CREATE INDEX IF NOT EXISTS scheduled_messages_scheduled_for_idx ON scheduled_messages(scheduled_for);
CREATE INDEX IF NOT EXISTS scheduled_messages_delivered_idx ON scheduled_messages(delivered_at);

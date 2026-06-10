/*
  # The Thread Architecture — Supporting Tables

  ## Overview
  Adds database support for the chat-first unified interface ("The Thread").

  ## New Tables

  ### daily_briefs
  Tracks which Morning Brief was delivered into the companion thread, preventing duplicates.
  - user_id: the user receiving the brief
  - companion_id: which companion's thread it was delivered to
  - date: YYYY-MM-DD date string for deduplication (one per day)
  - delivered_at: timestamp of delivery
  - blocks_delivered: jsonb array of which block types were included

  ### ambient_profile
  Key-value store for silent inferences about a user — fed by questionnaire answers
  and eventually by conversation extraction.
  - user_id: FK to auth.users
  - key: string identifier (e.g. 'loves_jazz', 'hates_mondays', 'morning_person')
  - value: the inferred value (text)
  - source: 'questionnaire' | 'conversation' | 'system'
  - confidence: 0.0–1.0 float, how confident the system is in this inference

  ## Modified Tables

  ### chat_messages
  Adds message_type, metadata, and bot_source columns to support rich card rendering
  and bot entry/exit indicators within The Thread.
  - message_type: 'text' | 'news-card' | 'calendar-card' | 'navi-card' | 'system' | 'bot-entry' | 'bot-exit' | 'brief-block'
  - metadata: jsonb — stores article_id, event_id, structured Navi results, etc.
  - bot_source: 'companion' | 'atlas' | 'navi' — which bot sent this message

  ## Security
  - RLS enabled on both new tables
  - Users can only access their own data
*/

CREATE TABLE IF NOT EXISTS daily_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL,
  date text NOT NULL,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  blocks_delivered jsonb NOT NULL DEFAULT '[]',
  UNIQUE(user_id, companion_id, date)
);

ALTER TABLE daily_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own daily briefs"
  ON daily_briefs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily briefs"
  ON daily_briefs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily briefs"
  ON daily_briefs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS daily_briefs_user_date_idx ON daily_briefs (user_id, date);
CREATE INDEX IF NOT EXISTS daily_briefs_companion_idx ON daily_briefs (companion_id);


CREATE TABLE IF NOT EXISTS ambient_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key text NOT NULL,
  value text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'questionnaire',
  confidence float NOT NULL DEFAULT 1.0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, key)
);

ALTER TABLE ambient_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own ambient profile"
  ON ambient_profile FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own ambient profile"
  ON ambient_profile FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ambient profile"
  ON ambient_profile FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own ambient profile"
  ON ambient_profile FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS ambient_profile_user_idx ON ambient_profile (user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'message_type'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN message_type text NOT NULL DEFAULT 'text';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN metadata jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'bot_source'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN bot_source text NOT NULL DEFAULT 'companion';
  END IF;
END $$;

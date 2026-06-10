/*
  # Add News Fetch Log Table

  ## Purpose
  Tracks the last time the news feed was auto-fetched for each user, enabling
  the 12-hour auto-refresh cycle on the Daily Feed page.

  ## New Tables
  - `news_fetch_log`
    - `user_id` (uuid, primary key, references auth.users)
    - `last_fetched_at` (timestamptz) — when the last web fetch was triggered

  ## Security
  - RLS enabled
  - Users can only read/write their own fetch log record
*/

CREATE TABLE IF NOT EXISTS news_fetch_log (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_fetched_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE news_fetch_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own fetch log"
  ON news_fetch_log
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own fetch log"
  ON news_fetch_log
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own fetch log"
  ON news_fetch_log
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

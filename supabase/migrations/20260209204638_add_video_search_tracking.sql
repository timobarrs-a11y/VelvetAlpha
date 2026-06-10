/*
  # Video Search Tracking System

  1. New Tables
    - `video_search_history`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `search_query` (text) - what the user searched for
      - `results_count` (integer) - number of results returned
      - `video_clicked` (text, nullable) - video ID if user clicked on a result
      - `created_at` (timestamptz)
      
  2. Security
    - Enable RLS on `video_search_history` table
    - Add policy for users to read their own search history
    - Add policy for users to insert their own searches
    
  3. Indexes
    - Index on user_id for fast lookups
    - Index on created_at for time-based queries
*/

CREATE TABLE IF NOT EXISTS video_search_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  search_query text NOT NULL,
  results_count integer DEFAULT 0,
  video_clicked text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE video_search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own search history"
  ON video_search_history
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own searches"
  ON video_search_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_video_search_history_user_id 
  ON video_search_history(user_id);

CREATE INDEX IF NOT EXISTS idx_video_search_history_created_at 
  ON video_search_history(created_at DESC);

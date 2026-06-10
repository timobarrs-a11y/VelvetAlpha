/*
  # Video Watching System

  Creates infrastructure for companions to watch videos with users and react in real-time.

  ## New Tables
  
  ### `watched_videos`
  Tracks videos that users have watched with their companions
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users) - The user watching
  - `companion_id` (uuid, references companions) - Which companion watched with them
  - `video_url` (text) - Original YouTube URL
  - `video_id` (text) - Extracted YouTube video ID
  - `video_title` (text) - Video title from YouTube
  - `video_description` (text) - Video description
  - `video_duration` (integer) - Duration in seconds
  - `watched_at` (timestamptz) - When they started watching
  - `completed` (boolean) - Whether they finished the video
  - `watch_session_data` (jsonb) - Stores playback data, reactions sent, etc.
  - `created_at` (timestamptz)

  ### `video_reactions`
  Stores companion reactions at specific video timestamps
  - `id` (uuid, primary key)
  - `watched_video_id` (uuid, references watched_videos)
  - `companion_id` (uuid, references companions)
  - `timestamp_seconds` (integer) - When in the video this reaction occurred
  - `reaction_text` (text) - What the companion said
  - `reaction_type` (text) - Type: 'proactive', 'response', 'end_of_video'
  - `sent_at` (timestamptz) - When the reaction was actually sent
  - `created_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Users can only access their own watched videos and reactions
*/

-- Create watched_videos table
CREATE TABLE IF NOT EXISTS watched_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  companion_id uuid REFERENCES companions(id) ON DELETE CASCADE NOT NULL,
  video_url text NOT NULL,
  video_id text NOT NULL,
  video_title text,
  video_description text,
  video_duration integer,
  watched_at timestamptz DEFAULT now() NOT NULL,
  completed boolean DEFAULT false,
  watch_session_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create video_reactions table
CREATE TABLE IF NOT EXISTS video_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  watched_video_id uuid REFERENCES watched_videos(id) ON DELETE CASCADE NOT NULL,
  companion_id uuid REFERENCES companions(id) ON DELETE CASCADE NOT NULL,
  timestamp_seconds integer NOT NULL,
  reaction_text text NOT NULL,
  reaction_type text NOT NULL CHECK (reaction_type IN ('proactive', 'response', 'end_of_video')),
  sent_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_watched_videos_user_id ON watched_videos(user_id);
CREATE INDEX IF NOT EXISTS idx_watched_videos_companion_id ON watched_videos(companion_id);
CREATE INDEX IF NOT EXISTS idx_watched_videos_video_id ON watched_videos(video_id);
CREATE INDEX IF NOT EXISTS idx_video_reactions_watched_video_id ON video_reactions(watched_video_id);
CREATE INDEX IF NOT EXISTS idx_video_reactions_timestamp ON video_reactions(timestamp_seconds);

-- Enable RLS
ALTER TABLE watched_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_reactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for watched_videos
CREATE POLICY "Users can view their own watched videos"
  ON watched_videos FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own watched videos"
  ON watched_videos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own watched videos"
  ON watched_videos FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own watched videos"
  ON watched_videos FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for video_reactions
CREATE POLICY "Users can view reactions for their watched videos"
  ON video_reactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM watched_videos
      WHERE watched_videos.id = video_reactions.watched_video_id
      AND watched_videos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert reactions for their watched videos"
  ON video_reactions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM watched_videos
      WHERE watched_videos.id = video_reactions.watched_video_id
      AND watched_videos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update reactions for their watched videos"
  ON video_reactions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM watched_videos
      WHERE watched_videos.id = video_reactions.watched_video_id
      AND watched_videos.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM watched_videos
      WHERE watched_videos.id = video_reactions.watched_video_id
      AND watched_videos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete reactions for their watched videos"
  ON video_reactions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM watched_videos
      WHERE watched_videos.id = video_reactions.watched_video_id
      AND watched_videos.user_id = auth.uid()
    )
  );
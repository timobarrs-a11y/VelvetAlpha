/*
  # Stories and Timeline System

  **Purpose**: Capture special moments, create relationship timeline, track milestones

  ## New Tables

  ### 1. `memory_moments`
  Special moments automatically captured from conversations
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `companion_id` (uuid, references companions)
  - `moment_type` (text) - funny, heartfelt, milestone, achievement, vulnerable, supportive, playful
  - `title` (text) - Auto-generated title for the moment
  - `description` (text) - What made this moment special
  - `conversation_excerpt` (text) - Key part of the conversation
  - `emotion` (text) - Primary emotion of the moment
  - `importance_score` (integer) - How important (1-10)
  - `moment_date` (timestamptz) - When it happened
  - `related_conversation_id` (uuid) - Link to conversation
  - `user_favorited` (boolean) - User marked as favorite
  - `tags` (text[]) - Custom tags for organization
  - `media_url` (text) - If there's an associated image/media
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. `relationship_timeline`
  Chronological story of the relationship with major events
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `companion_id` (uuid, references companions)
  - `timeline_event_type` (text) - first_message, first_week, first_month, milestone, special_achievement
  - `title` (text)
  - `description` (text)
  - `event_date` (timestamptz)
  - `stats_snapshot` (jsonb) - Stats at this point in time
  - `highlighted_moments` (uuid[]) - Array of memory_moment ids
  - `auto_generated` (boolean) - Was this automatically created?
  - `created_at` (timestamptz)

  ### 3. `milestone_achievements`
  Relationship milestones and achievements
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `companion_id` (uuid, references companions)
  - `achievement_type` (text) - days_together, messages_sent, deep_conversation, shared_laugh, goal_support, etc.
  - `achievement_name` (text)
  - `achievement_description` (text)
  - `icon` (text) - Icon/emoji for the achievement
  - `unlocked_at` (timestamptz)
  - `stats_at_unlock` (jsonb) - Stats when unlocked
  - `celebration_message` (text) - Message companion sends
  - `rarity` (text) - common, uncommon, rare, legendary
  - `is_new` (boolean) - User hasn't seen it yet
  - `created_at` (timestamptz)

  ### 4. `memory_collections`
  User-created or auto-generated collections of memories
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `companion_id` (uuid, references companions)
  - `collection_name` (text)
  - `collection_description` (text)
  - `collection_type` (text) - auto_highlights, user_favorites, monthly_recap, year_in_review
  - `moment_ids` (uuid[]) - Array of memory_moment ids
  - `cover_image_url` (text)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Users can only access their own memories and timeline
  - Companion can create moments during conversation

  ## Indexes
  - Index on moment_date for chronological queries
  - Index on importance_score for filtering highlights
  - Index on user_favorited for quick favorites access
*/

-- Create memory_moments table
CREATE TABLE IF NOT EXISTS memory_moments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  companion_id uuid REFERENCES companions(id) ON DELETE CASCADE,
  moment_type text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  conversation_excerpt text DEFAULT '',
  emotion text DEFAULT 'neutral',
  importance_score integer DEFAULT 5,
  moment_date timestamptz DEFAULT now(),
  related_conversation_id uuid,
  user_favorited boolean DEFAULT false,
  tags text[] DEFAULT ARRAY[]::text[],
  media_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_moment_type CHECK (moment_type IN ('funny', 'heartfelt', 'milestone', 'achievement', 'vulnerable', 'supportive', 'playful', 'deep', 'romantic', 'adventurous')),
  CONSTRAINT valid_emotion CHECK (emotion IN ('happy', 'excited', 'loved', 'grateful', 'proud', 'vulnerable', 'sad', 'anxious', 'neutral', 'mixed')),
  CONSTRAINT valid_importance CHECK (importance_score >= 1 AND importance_score <= 10)
);

-- Create relationship_timeline table
CREATE TABLE IF NOT EXISTS relationship_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  companion_id uuid REFERENCES companions(id) ON DELETE CASCADE,
  timeline_event_type text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  event_date timestamptz DEFAULT now(),
  stats_snapshot jsonb DEFAULT '{}'::jsonb,
  highlighted_moments uuid[] DEFAULT ARRAY[]::uuid[],
  auto_generated boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_timeline_event_type CHECK (timeline_event_type IN ('first_message', 'first_week', 'first_month', '100_days', '1_year', 'milestone', 'special_achievement', 'deep_conversation', 'shared_experience'))
);

-- Create milestone_achievements table
CREATE TABLE IF NOT EXISTS milestone_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  companion_id uuid REFERENCES companions(id) ON DELETE CASCADE,
  achievement_type text NOT NULL,
  achievement_name text NOT NULL,
  achievement_description text NOT NULL,
  icon text DEFAULT '🏆',
  unlocked_at timestamptz DEFAULT now(),
  stats_at_unlock jsonb DEFAULT '{}'::jsonb,
  celebration_message text DEFAULT '',
  rarity text DEFAULT 'common',
  is_new boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_rarity CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary'))
);

-- Create memory_collections table
CREATE TABLE IF NOT EXISTS memory_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  companion_id uuid REFERENCES companions(id) ON DELETE CASCADE,
  collection_name text NOT NULL,
  collection_description text DEFAULT '',
  collection_type text NOT NULL,
  moment_ids uuid[] DEFAULT ARRAY[]::uuid[],
  cover_image_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_collection_type CHECK (collection_type IN ('auto_highlights', 'user_favorites', 'monthly_recap', 'year_in_review', 'custom', 'best_moments'))
);

-- Enable RLS
ALTER TABLE memory_moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationship_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestone_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_collections ENABLE ROW LEVEL SECURITY;

-- RLS Policies for memory_moments
CREATE POLICY "Users can view own memory moments"
  ON memory_moments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own memory moments"
  ON memory_moments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own memory moments"
  ON memory_moments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own memory moments"
  ON memory_moments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for relationship_timeline
CREATE POLICY "Users can view own timeline"
  ON relationship_timeline FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own timeline events"
  ON relationship_timeline FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own timeline events"
  ON relationship_timeline FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for milestone_achievements
CREATE POLICY "Users can view own achievements"
  ON milestone_achievements FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can create achievements"
  ON milestone_achievements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own achievements"
  ON milestone_achievements FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for memory_collections
CREATE POLICY "Users can view own collections"
  ON memory_collections FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own collections"
  ON memory_collections FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own collections"
  ON memory_collections FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own collections"
  ON memory_collections FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_memory_moments_date ON memory_moments(moment_date DESC);
CREATE INDEX IF NOT EXISTS idx_memory_moments_importance ON memory_moments(importance_score DESC);
CREATE INDEX IF NOT EXISTS idx_memory_moments_favorited ON memory_moments(user_favorited) WHERE user_favorited = true;
CREATE INDEX IF NOT EXISTS idx_memory_moments_user_companion ON memory_moments(user_id, companion_id);
CREATE INDEX IF NOT EXISTS idx_timeline_date ON relationship_timeline(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_achievements_unlocked ON milestone_achievements(unlocked_at DESC);
CREATE INDEX IF NOT EXISTS idx_achievements_new ON milestone_achievements(is_new) WHERE is_new = true;
CREATE INDEX IF NOT EXISTS idx_collections_user ON memory_collections(user_id, companion_id);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_memory_moments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER memory_moments_updated_at
  BEFORE UPDATE ON memory_moments
  FOR EACH ROW
  EXECUTE FUNCTION update_memory_moments_updated_at();

CREATE OR REPLACE FUNCTION update_memory_collections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER memory_collections_updated_at
  BEFORE UPDATE ON memory_collections
  FOR EACH ROW
  EXECUTE FUNCTION update_memory_collections_updated_at();

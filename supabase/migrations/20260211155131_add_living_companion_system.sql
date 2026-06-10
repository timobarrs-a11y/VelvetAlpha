/*
  # Add Living Companion System

  ## Overview
  Creates the foundation for a "Living Companion" feature where companions simulate 
  daily lives between chat sessions. This includes daily experience narratives and 
  a memory system for companions to reference their own history.

  ## New Tables

  ### 1. daily_experiences
  Stores a generated "day in the life" for each companion, created once per day per user.
  - Narrative: First-person account of companion's day (150-300 words)
  - Mood & Energy: Current state tracking
  - Highlights: Key moments from the day
  - Conversation Hooks: Topics to bring up in chat
  - Status Timeline: Timeline of activities throughout the day
  - Real World References: News/events the companion engaged with

  ### 2. companion_memory
  Stores condensed memories of past experiences so companions can reference their 
  own history in future conversations and daily generations.
  - Memory Types: daily_experience, user_interaction, milestone, running_story
  - Emotional Weight: Significance tracking (1-10)
  - Tags: Topic-based search/retrieval
  - Referenced Count: Tracks usage in conversations

  ## Security
  - Full RLS enabled on both tables
  - Users can only access their own companion data
  - CRUD policies for authenticated users on their own data
*/

-- Table 1: daily_experiences
CREATE TABLE IF NOT EXISTS daily_experiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
  date date NOT NULL,
  narrative text NOT NULL,
  mood text NOT NULL CHECK (mood IN ('energized', 'chill', 'reflective', 'excited', 'frustrated', 'playful', 'focused', 'tired')),
  energy_level integer NOT NULL CHECK (energy_level >= 1 AND energy_level <= 10),
  highlights jsonb DEFAULT '[]'::jsonb,
  conversation_hooks jsonb DEFAULT '[]'::jsonb,
  status_timeline jsonb DEFAULT '[]'::jsonb,
  real_world_references jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, companion_id, date)
);

-- Table 2: companion_memory
CREATE TABLE IF NOT EXISTS companion_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
  date date NOT NULL,
  memory_type text NOT NULL CHECK (memory_type IN ('daily_experience', 'user_interaction', 'milestone', 'running_story')),
  summary text NOT NULL CHECK (length(summary) <= 200),
  full_content text NOT NULL,
  emotional_weight integer NOT NULL CHECK (emotional_weight >= 1 AND emotional_weight <= 10),
  tags jsonb DEFAULT '[]'::jsonb,
  referenced_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Indexes for daily_experiences
CREATE INDEX IF NOT EXISTS idx_daily_experiences_user_companion ON daily_experiences(user_id, companion_id);
CREATE INDEX IF NOT EXISTS idx_daily_experiences_date ON daily_experiences(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_experiences_companion_date ON daily_experiences(companion_id, date DESC);

-- Indexes for companion_memory
CREATE INDEX IF NOT EXISTS idx_companion_memory_user_companion ON companion_memory(user_id, companion_id);
CREATE INDEX IF NOT EXISTS idx_companion_memory_date ON companion_memory(date DESC);
CREATE INDEX IF NOT EXISTS idx_companion_memory_type ON companion_memory(memory_type);
CREATE INDEX IF NOT EXISTS idx_companion_memory_emotional_weight ON companion_memory(emotional_weight DESC);
CREATE INDEX IF NOT EXISTS idx_companion_memory_tags ON companion_memory USING gin(tags);

-- Enable RLS
ALTER TABLE daily_experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE companion_memory ENABLE ROW LEVEL SECURITY;

-- RLS Policies for daily_experiences
CREATE POLICY "Users can view own daily experiences"
  ON daily_experiences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own daily experiences"
  ON daily_experiences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily experiences"
  ON daily_experiences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own daily experiences"
  ON daily_experiences FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for companion_memory
CREATE POLICY "Users can view own companion memories"
  ON companion_memory FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own companion memories"
  ON companion_memory FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own companion memories"
  ON companion_memory FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own companion memories"
  ON companion_memory FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

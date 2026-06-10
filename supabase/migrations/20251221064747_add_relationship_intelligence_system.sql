/*
  # Relationship Intelligence System
  
  Creates a comprehensive memory and intelligence layer for AI companions to build
  deeper, more consistent relationships with users.
  
  ## New Tables
  
  ### `relationship_memories`
  Stores key facts, moments, and emotional context from conversations
  - `id` (uuid, primary key)
  - `user_id` (uuid, references user_profiles)
  - `memory_type` (text) - 'user_fact', 'relationship_moment', 'emotional_context', 'inside_joke', 'shared_experience'
  - `content` (text) - the actual memory
  - `emotional_valence` (text) - 'positive', 'negative', 'neutral', 'mixed'
  - `importance_score` (integer) - 1-10 scale for retrieval prioritization
  - `context_tags` (text[]) - searchable tags for smart retrieval
  - `related_messages` (text[]) - IDs of related conversation messages
  - `last_referenced` (timestamptz) - when this memory was last used in context
  - `reference_count` (integer) - how many times it's been surfaced
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  
  ### `conversation_threads`
  Tracks ongoing topics and unresolved threads across conversations
  - `id` (uuid, primary key)
  - `user_id` (uuid, references user_profiles)
  - `topic` (text) - main topic/theme
  - `status` (text) - 'active', 'resolved', 'dormant'
  - `context_summary` (text) - brief summary of the thread
  - `emotional_tone` (text) - overall emotional tone
  - `user_sentiment` (text) - user's position/feelings
  - `ai_sentiment` (text) - AI's position/approach
  - `unresolved_questions` (text[]) - questions that need follow-up
  - `key_points` (text[]) - important points made
  - `started_at` (timestamptz)
  - `last_active` (timestamptz)
  - `resolved_at` (timestamptz)
  
  ### `emotional_profile`
  Builds a profile of user's emotional patterns and communication style
  - `id` (uuid, primary key)
  - `user_id` (uuid, unique, references user_profiles)
  - `baseline_mood` (text) - typical mood state
  - `stress_triggers` (text[]) - topics/situations that stress them
  - `joy_triggers` (text[]) - topics/situations that make them happy
  - `communication_style` (text) - how they prefer to communicate
  - `support_preferences` (text) - how they like to receive support
  - `humor_style` (text) - what kind of humor they respond to
  - `vulnerability_level` (text) - how comfortable they are sharing emotions
  - `response_patterns` (jsonb) - patterns in how they respond to different approaches
  - `peak_activity_times` (text[]) - when they're most active
  - `updated_at` (timestamptz)
  
  ### `personality_consistency_log`
  Logs AI responses and user reactions to build consistency
  - `id` (uuid, primary key)
  - `user_id` (uuid, references user_profiles)
  - `message_context` (text) - what was being discussed
  - `ai_response` (text) - what the AI said
  - `response_style` (text) - tone/approach used
  - `user_reaction` (text) - 'positive', 'negative', 'neutral'
  - `engagement_score` (integer) - 1-10 based on user's next message
  - `worked_well` (boolean) - whether this approach should be repeated
  - `notes` (text) - additional context
  - `created_at` (timestamptz)
  
  ## Security
  - Enable RLS on all tables
  - Users can only access their own data
  - Authenticated users only
*/

-- Create relationship_memories table
CREATE TABLE IF NOT EXISTS relationship_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  memory_type text NOT NULL CHECK (memory_type IN ('user_fact', 'relationship_moment', 'emotional_context', 'inside_joke', 'shared_experience')),
  content text NOT NULL,
  emotional_valence text NOT NULL CHECK (emotional_valence IN ('positive', 'negative', 'neutral', 'mixed')) DEFAULT 'neutral',
  importance_score integer NOT NULL CHECK (importance_score >= 1 AND importance_score <= 10) DEFAULT 5,
  context_tags text[] DEFAULT '{}',
  related_messages text[] DEFAULT '{}',
  last_referenced timestamptz DEFAULT now(),
  reference_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create conversation_threads table
CREATE TABLE IF NOT EXISTS conversation_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  topic text NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'resolved', 'dormant')) DEFAULT 'active',
  context_summary text NOT NULL,
  emotional_tone text DEFAULT 'neutral',
  user_sentiment text,
  ai_sentiment text,
  unresolved_questions text[] DEFAULT '{}',
  key_points text[] DEFAULT '{}',
  started_at timestamptz DEFAULT now(),
  last_active timestamptz DEFAULT now(),
  resolved_at timestamptz
);

-- Create emotional_profile table
CREATE TABLE IF NOT EXISTS emotional_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  baseline_mood text DEFAULT 'neutral',
  stress_triggers text[] DEFAULT '{}',
  joy_triggers text[] DEFAULT '{}',
  communication_style text DEFAULT 'casual',
  support_preferences text DEFAULT 'balanced',
  humor_style text DEFAULT 'playful',
  vulnerability_level text DEFAULT 'moderate',
  response_patterns jsonb DEFAULT '{}'::jsonb,
  peak_activity_times text[] DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

-- Create personality_consistency_log table
CREATE TABLE IF NOT EXISTS personality_consistency_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  message_context text NOT NULL,
  ai_response text NOT NULL,
  response_style text NOT NULL,
  user_reaction text CHECK (user_reaction IN ('positive', 'negative', 'neutral')),
  engagement_score integer CHECK (engagement_score >= 1 AND engagement_score <= 10),
  worked_well boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_relationship_memories_user_id ON relationship_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_relationship_memories_type ON relationship_memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_relationship_memories_importance ON relationship_memories(importance_score DESC);
CREATE INDEX IF NOT EXISTS idx_relationship_memories_last_referenced ON relationship_memories(last_referenced DESC);
CREATE INDEX IF NOT EXISTS idx_relationship_memories_tags ON relationship_memories USING gin(context_tags);

CREATE INDEX IF NOT EXISTS idx_conversation_threads_user_id ON conversation_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_threads_status ON conversation_threads(status);
CREATE INDEX IF NOT EXISTS idx_conversation_threads_last_active ON conversation_threads(last_active DESC);

CREATE INDEX IF NOT EXISTS idx_emotional_profile_user_id ON emotional_profile(user_id);

CREATE INDEX IF NOT EXISTS idx_personality_log_user_id ON personality_consistency_log(user_id);
CREATE INDEX IF NOT EXISTS idx_personality_log_created ON personality_consistency_log(created_at DESC);

-- Enable RLS
ALTER TABLE relationship_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE emotional_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE personality_consistency_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for relationship_memories
CREATE POLICY "Users can view own memories"
  ON relationship_memories FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own memories"
  ON relationship_memories FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own memories"
  ON relationship_memories FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own memories"
  ON relationship_memories FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for conversation_threads
CREATE POLICY "Users can view own threads"
  ON conversation_threads FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own threads"
  ON conversation_threads FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own threads"
  ON conversation_threads FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own threads"
  ON conversation_threads FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for emotional_profile
CREATE POLICY "Users can view own emotional profile"
  ON emotional_profile FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own emotional profile"
  ON emotional_profile FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own emotional profile"
  ON emotional_profile FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own emotional profile"
  ON emotional_profile FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for personality_consistency_log
CREATE POLICY "Users can view own consistency log"
  ON personality_consistency_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own consistency log"
  ON personality_consistency_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own consistency log"
  ON personality_consistency_log FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own consistency log"
  ON personality_consistency_log FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_relationship_memories_updated_at
  BEFORE UPDATE ON relationship_memories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_emotional_profile_updated_at
  BEFORE UPDATE ON emotional_profile
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
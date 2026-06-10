/*
  # Add Insights Tracking System

  1. New Tables
    - `user_insights`
      - Aggregated insights for a user over a time period
      - Tracks conversation stats, topics, sentiment trends, facts learned, and goals
    - `conversation_insights`
      - Per-conversation insights
      - Tracks topics, sentiment, extracted facts for each conversation

  2. Security
    - Enable RLS on both tables
    - Users can only view their own insights
    - Insights are read-only for users (written by edge functions)

  3. Indexes
    - Add indexes for efficient querying by user, companion, and date ranges
*/

-- Create user_insights table
CREATE TABLE IF NOT EXISTS user_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  companion_id uuid REFERENCES companions(id) ON DELETE CASCADE NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_conversations int DEFAULT 0,
  total_messages int DEFAULT 0,
  avg_conversation_length int DEFAULT 0,
  top_topics jsonb DEFAULT '[]'::jsonb,
  sentiment_trend jsonb DEFAULT '[]'::jsonb,
  facts_learned jsonb DEFAULT '[]'::jsonb,
  goals_mentioned jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create conversation_insights table
CREATE TABLE IF NOT EXISTS conversation_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  companion_id uuid REFERENCES companions(id) ON DELETE CASCADE,
  topics text[] DEFAULT ARRAY[]::text[],
  sentiment_score float,
  facts_extracted jsonb DEFAULT '[]'::jsonb,
  conversation_date timestamptz DEFAULT now(),
  message_count int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_insights_user_id ON user_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_user_insights_companion_id ON user_insights(companion_id);
CREATE INDEX IF NOT EXISTS idx_user_insights_period ON user_insights(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_conversation_insights_user_id ON conversation_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_insights_companion_id ON conversation_insights(companion_id);
CREATE INDEX IF NOT EXISTS idx_conversation_insights_conversation_id ON conversation_insights(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_insights_date ON conversation_insights(conversation_date);

-- Enable RLS
ALTER TABLE user_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_insights ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_insights
CREATE POLICY "Users can view their own insights"
  ON user_insights
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert insights"
  ON user_insights
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update insights"
  ON user_insights
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for conversation_insights
CREATE POLICY "Users can view their own conversation insights"
  ON conversation_insights
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert conversation insights"
  ON conversation_insights
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update conversation insights"
  ON conversation_insights
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);
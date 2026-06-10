/*
  # Calendar and Events System

  **Purpose**: Comprehensive calendar system for reminders, events, anniversaries, and AI-generated suggestions

  ## New Tables

  ### 1. `user_events`
  Stores all user events, reminders, and important dates
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `companion_id` (uuid, references companions)
  - `title` (text) - Event name
  - `description` (text) - Event details
  - `event_type` (text) - reminder, appointment, anniversary, birthday, milestone, date_idea
  - `event_date` (timestamptz) - When the event occurs
  - `reminder_time` (timestamptz) - When to remind user (nullable)
  - `all_day` (boolean) - Is it an all-day event?
  - `location` (text) - Event location (nullable)
  - `completed` (boolean) - For tasks/reminders
  - `recurring` (text) - daily, weekly, monthly, yearly, none
  - `metadata` (jsonb) - Additional data (gift ideas, notes, etc.)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. `event_suggestions`
  AI-generated event suggestions based on conversation context
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `companion_id` (uuid, references companions)
  - `suggested_title` (text)
  - `suggested_description` (text)
  - `suggested_type` (text)
  - `suggested_date` (timestamptz)
  - `reasoning` (text) - Why AI suggested this
  - `confidence_score` (numeric) - How confident AI is (0-1)
  - `accepted` (boolean) - User accepted suggestion
  - `dismissed` (boolean) - User dismissed suggestion
  - `created_event_id` (uuid) - If accepted, links to created event
  - `created_at` (timestamptz)

  ### 3. `anniversaries`
  Special relationship milestones and recurring celebrations
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `companion_id` (uuid, references companions)
  - `anniversary_type` (text) - relationship_started, first_message, special_moment, custom
  - `title` (text)
  - `description` (text)
  - `original_date` (date) - The first time this happened
  - `celebration_message` (text) - Message companion sends on this day
  - `notify_days_before` (integer) - Days before to start mentioning
  - `is_active` (boolean)
  - `metadata` (jsonb)
  - `created_at` (timestamptz)

  ### 4. `gift_suggestions`
  AI-generated gift ideas based on conversation context
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `companion_id` (uuid, references companions)
  - `recipient` (text) - Who the gift is for
  - `occasion` (text) - Birthday, anniversary, holiday, etc.
  - `gift_idea` (text)
  - `reasoning` (text) - Why this gift is suggested
  - `price_range` (text) - budget, moderate, premium
  - `where_to_buy` (text) - Suggested places to purchase
  - `relevance_score` (numeric) - How relevant (0-1)
  - `based_on_context` (text) - Which conversation triggered this
  - `user_reaction` (text) - loved_it, considering, not_interested
  - `created_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Users can only access their own events, suggestions, anniversaries, and gift ideas
  - Companions can read but not modify

  ## Indexes
  - Index on event_date for quick lookups
  - Index on user_id + companion_id for filtering
  - Index on anniversary original_date for recurring checks
*/

-- Create user_events table
CREATE TABLE IF NOT EXISTS user_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  companion_id uuid REFERENCES companions(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  event_type text NOT NULL DEFAULT 'reminder',
  event_date timestamptz NOT NULL,
  reminder_time timestamptz,
  all_day boolean DEFAULT false,
  location text,
  completed boolean DEFAULT false,
  recurring text DEFAULT 'none',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_event_type CHECK (event_type IN ('reminder', 'appointment', 'anniversary', 'birthday', 'milestone', 'date_idea', 'task', 'goal_deadline')),
  CONSTRAINT valid_recurring CHECK (recurring IN ('none', 'daily', 'weekly', 'monthly', 'yearly'))
);

-- Create event_suggestions table
CREATE TABLE IF NOT EXISTS event_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  companion_id uuid REFERENCES companions(id) ON DELETE CASCADE,
  suggested_title text NOT NULL,
  suggested_description text DEFAULT '',
  suggested_type text NOT NULL,
  suggested_date timestamptz,
  reasoning text NOT NULL,
  confidence_score numeric DEFAULT 0.5,
  accepted boolean DEFAULT false,
  dismissed boolean DEFAULT false,
  created_event_id uuid REFERENCES user_events(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_confidence CHECK (confidence_score >= 0 AND confidence_score <= 1)
);

-- Create anniversaries table
CREATE TABLE IF NOT EXISTS anniversaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  companion_id uuid REFERENCES companions(id) ON DELETE CASCADE,
  anniversary_type text NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  original_date date NOT NULL,
  celebration_message text DEFAULT '',
  notify_days_before integer DEFAULT 1,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_anniversary_type CHECK (anniversary_type IN ('relationship_started', 'first_message', 'special_moment', 'custom'))
);

-- Create gift_suggestions table
CREATE TABLE IF NOT EXISTS gift_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  companion_id uuid REFERENCES companions(id) ON DELETE CASCADE,
  recipient text NOT NULL,
  occasion text DEFAULT 'general',
  gift_idea text NOT NULL,
  reasoning text NOT NULL,
  price_range text DEFAULT 'moderate',
  where_to_buy text DEFAULT '',
  relevance_score numeric DEFAULT 0.5,
  based_on_context text DEFAULT '',
  user_reaction text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_price_range CHECK (price_range IN ('budget', 'moderate', 'premium', 'luxury')),
  CONSTRAINT valid_user_reaction CHECK (user_reaction IS NULL OR user_reaction IN ('loved_it', 'considering', 'not_interested', 'purchased')),
  CONSTRAINT valid_relevance CHECK (relevance_score >= 0 AND relevance_score <= 1)
);

-- Enable RLS
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE anniversaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_events
CREATE POLICY "Users can view own events"
  ON user_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own events"
  ON user_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own events"
  ON user_events FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own events"
  ON user_events FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for event_suggestions
CREATE POLICY "Users can view own event suggestions"
  ON event_suggestions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own event suggestions"
  ON event_suggestions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can create event suggestions"
  ON event_suggestions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for anniversaries
CREATE POLICY "Users can view own anniversaries"
  ON anniversaries FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own anniversaries"
  ON anniversaries FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own anniversaries"
  ON anniversaries FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own anniversaries"
  ON anniversaries FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for gift_suggestions
CREATE POLICY "Users can view own gift suggestions"
  ON gift_suggestions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own gift suggestions"
  ON gift_suggestions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own gift suggestions"
  ON gift_suggestions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_events_date ON user_events(event_date);
CREATE INDEX IF NOT EXISTS idx_user_events_user_companion ON user_events(user_id, companion_id);
CREATE INDEX IF NOT EXISTS idx_user_events_reminder_time ON user_events(reminder_time) WHERE reminder_time IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_event_suggestions_user ON event_suggestions(user_id, accepted, dismissed);
CREATE INDEX IF NOT EXISTS idx_anniversaries_date ON anniversaries(original_date, is_active);
CREATE INDEX IF NOT EXISTS idx_gift_suggestions_user ON gift_suggestions(user_id, user_reaction);

-- Create updated_at trigger for user_events
CREATE OR REPLACE FUNCTION update_user_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_events_updated_at
  BEFORE UPDATE ON user_events
  FOR EACH ROW
  EXECUTE FUNCTION update_user_events_updated_at();

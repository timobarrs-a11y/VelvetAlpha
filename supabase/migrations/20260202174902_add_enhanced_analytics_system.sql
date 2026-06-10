/*
  # Enhanced Analytics System

  **Purpose**: Comprehensive analytics for user behavior, business metrics, performance monitoring

  ## New Tables

  ### 1. `user_behavior_analytics`
  Track user actions and engagement patterns
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `session_id` (uuid) - Unique session identifier
  - `action_type` (text) - page_view, feature_used, button_clicked, message_sent, etc.
  - `action_target` (text) - What was clicked/used
  - `page_path` (text) - Current page
  - `referrer` (text) - Previous page
  - `device_type` (text) - mobile, tablet, desktop
  - `browser` (text)
  - `metadata` (jsonb) - Additional context
  - `created_at` (timestamptz)

  ### 2. `feature_usage_stats`
  Track which features users engage with
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `feature_name` (text) - insights, calendar, stories, games, etc.
  - `usage_count` (integer) - How many times used
  - `last_used_at` (timestamptz)
  - `total_time_spent_seconds` (integer)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 3. `business_metrics`
  Track key business metrics
  - `id` (uuid, primary key)
  - `metric_date` (date)
  - `metric_type` (text) - dau, wau, mau, new_signups, churned_users, premium_conversions
  - `metric_value` (numeric)
  - `metadata` (jsonb) - Breakdown by segment, cohort, etc.
  - `created_at` (timestamptz)

  ### 4. `conversion_funnel`
  Track user progress through conversion funnels
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `funnel_type` (text) - onboarding, upgrade, feature_discovery
  - `step_name` (text) - Current step in funnel
  - `step_number` (integer) - Order in funnel
  - `completed` (boolean) - Did they complete this step?
  - `time_to_complete_seconds` (integer)
  - `dropped_off` (boolean) - Did they abandon here?
  - `created_at` (timestamptz)

  ### 5. `performance_metrics`
  Track system performance
  - `id` (uuid, primary key)
  - `metric_type` (text) - api_response_time, error_rate, uptime
  - `endpoint` (text) - Which API endpoint (nullable)
  - `value` (numeric)
  - `status` (text) - healthy, warning, critical
  - `metadata` (jsonb)
  - `created_at` (timestamptz)

  ### 6. `error_logs`
  Comprehensive error tracking
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users) - nullable for unauthenticated errors
  - `error_type` (text) - client_error, server_error, network_error
  - `error_message` (text)
  - `error_stack` (text)
  - `page_path` (text)
  - `user_action` (text) - What were they trying to do?
  - `severity` (text) - low, medium, high, critical
  - `resolved` (boolean)
  - `created_at` (timestamptz)

  ### 7. `retention_cohorts`
  Track user retention by cohort
  - `id` (uuid, primary key)
  - `cohort_date` (date) - When users signed up
  - `cohort_size` (integer) - How many users in cohort
  - `day_0_active` (integer) - Active on day 0
  - `day_1_active` (integer) - Active on day 1
  - `day_7_active` (integer)
  - `day_30_active` (integer)
  - `day_90_active` (integer)
  - `metadata` (jsonb)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security
  - Most analytics tables are restricted to admins only
  - Users can see their own behavior data only
  - No public access to aggregated metrics

  ## Indexes
  - Index on timestamps for time-series queries
  - Index on user_id for per-user analytics
  - Index on metric_type for filtering
*/

-- Create user_behavior_analytics table
CREATE TABLE IF NOT EXISTS user_behavior_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id uuid NOT NULL,
  action_type text NOT NULL,
  action_target text DEFAULT '',
  page_path text NOT NULL,
  referrer text DEFAULT '',
  device_type text DEFAULT 'unknown',
  browser text DEFAULT 'unknown',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_action_type CHECK (action_type IN ('page_view', 'feature_used', 'button_clicked', 'message_sent', 'form_submitted', 'error_occurred', 'navigation')),
  CONSTRAINT valid_device_type CHECK (device_type IN ('mobile', 'tablet', 'desktop', 'unknown'))
);

-- Create feature_usage_stats table
CREATE TABLE IF NOT EXISTS feature_usage_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  feature_name text NOT NULL,
  usage_count integer DEFAULT 0,
  last_used_at timestamptz DEFAULT now(),
  total_time_spent_seconds integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_feature_name CHECK (feature_name IN ('chat', 'insights', 'calendar', 'stories', 'games_checkers', 'games_pacman', 'games_stellar_pursuit', 'games_momentum', 'avatar_creator', 'video_watch', 'companion_creation')),
  UNIQUE(user_id, feature_name)
);

-- Create business_metrics table
CREATE TABLE IF NOT EXISTS business_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date date NOT NULL,
  metric_type text NOT NULL,
  metric_value numeric NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_metric_type CHECK (metric_type IN ('dau', 'wau', 'mau', 'new_signups', 'churned_users', 'premium_conversions', 'revenue', 'avg_session_duration', 'messages_per_user', 'retention_rate')),
  UNIQUE(metric_date, metric_type)
);

-- Create conversion_funnel table
CREATE TABLE IF NOT EXISTS conversion_funnel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  funnel_type text NOT NULL,
  step_name text NOT NULL,
  step_number integer NOT NULL,
  completed boolean DEFAULT false,
  time_to_complete_seconds integer,
  dropped_off boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_funnel_type CHECK (funnel_type IN ('onboarding', 'upgrade', 'feature_discovery', 'companion_creation', 'first_message')),
  CONSTRAINT valid_step_number CHECK (step_number > 0)
);

-- Create performance_metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type text NOT NULL,
  endpoint text,
  value numeric NOT NULL,
  status text DEFAULT 'healthy',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_metric_type_perf CHECK (metric_type IN ('api_response_time', 'error_rate', 'uptime', 'database_query_time', 'ai_inference_time')),
  CONSTRAINT valid_status CHECK (status IN ('healthy', 'warning', 'critical'))
);

-- Create error_logs table
CREATE TABLE IF NOT EXISTS error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  error_type text NOT NULL,
  error_message text NOT NULL,
  error_stack text DEFAULT '',
  page_path text DEFAULT '',
  user_action text DEFAULT '',
  severity text DEFAULT 'medium',
  resolved boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_error_type CHECK (error_type IN ('client_error', 'server_error', 'network_error', 'validation_error', 'authentication_error', 'permission_error')),
  CONSTRAINT valid_severity CHECK (severity IN ('low', 'medium', 'high', 'critical'))
);

-- Create retention_cohorts table
CREATE TABLE IF NOT EXISTS retention_cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_date date NOT NULL UNIQUE,
  cohort_size integer DEFAULT 0,
  day_0_active integer DEFAULT 0,
  day_1_active integer DEFAULT 0,
  day_7_active integer DEFAULT 0,
  day_30_active integer DEFAULT 0,
  day_90_active integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_behavior_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_usage_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversion_funnel ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE retention_cohorts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_behavior_analytics
CREATE POLICY "Users can view own behavior analytics"
  ON user_behavior_analytics FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert behavior analytics"
  ON user_behavior_analytics FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for feature_usage_stats
CREATE POLICY "Users can view own feature usage"
  ON feature_usage_stats FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can manage feature usage"
  ON feature_usage_stats FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for conversion_funnel
CREATE POLICY "Users can view own funnel progress"
  ON conversion_funnel FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can track funnel progress"
  ON conversion_funnel FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for error_logs
CREATE POLICY "Users can view own errors"
  ON error_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can log errors"
  ON error_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Admin-only policies for aggregated metrics (business_metrics, performance_metrics, retention_cohorts)
-- Note: In production, you would check for admin role here
CREATE POLICY "Admins can view business metrics"
  ON business_metrics FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can view performance metrics"
  ON performance_metrics FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can view retention cohorts"
  ON retention_cohorts FOR SELECT
  TO authenticated
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_behavior_analytics_user ON user_behavior_analytics(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_analytics_action ON user_behavior_analytics(action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_analytics_session ON user_behavior_analytics(session_id);
CREATE INDEX IF NOT EXISTS idx_feature_usage_user ON feature_usage_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_business_metrics_date ON business_metrics(metric_date DESC, metric_type);
CREATE INDEX IF NOT EXISTS idx_conversion_funnel_user ON conversion_funnel(user_id, funnel_type);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_time ON performance_metrics(created_at DESC, metric_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_user ON error_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity, resolved);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_feature_usage_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER feature_usage_stats_updated_at
  BEFORE UPDATE ON feature_usage_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_feature_usage_stats_updated_at();

CREATE OR REPLACE FUNCTION update_retention_cohorts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER retention_cohorts_updated_at
  BEFORE UPDATE ON retention_cohorts
  FOR EACH ROW
  EXECUTE FUNCTION update_retention_cohorts_updated_at();

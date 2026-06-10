-- Money Grab Game Tracking Tables
-- Comprehensive system for scores, leaderboards, achievements, and statistics

-- Money Grab Game Sessions
CREATE TABLE IF NOT EXISTS money_grab_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  companion_id uuid REFERENCES companions(id) ON DELETE SET NULL,
  total_score integer NOT NULL DEFAULT 0,
  player_score integer NOT NULL DEFAULT 0,
  ai_score integer NOT NULL DEFAULT 0,
  highest_level integer NOT NULL DEFAULT 1,
  duration_seconds integer NOT NULL DEFAULT 0,
  money_collected integer NOT NULL DEFAULT 0,
  power_ups_used integer NOT NULL DEFAULT 0,
  enemies_defeated integer NOT NULL DEFAULT 0,
  max_combo integer NOT NULL DEFAULT 0,
  fastest_level_time integer DEFAULT NULL,
  player_wins integer NOT NULL DEFAULT 0,
  ai_wins integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE money_grab_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own money grab scores"
  ON money_grab_scores FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own money grab scores"
  ON money_grab_scores FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public can read scores for leaderboards"
  ON money_grab_scores FOR SELECT
  TO anon
  USING (true);

CREATE INDEX IF NOT EXISTS idx_money_grab_scores_total_score ON money_grab_scores(total_score DESC);
CREATE INDEX IF NOT EXISTS idx_money_grab_scores_level ON money_grab_scores(highest_level DESC);
CREATE INDEX IF NOT EXISTS idx_money_grab_scores_user_id ON money_grab_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_money_grab_scores_created_at ON money_grab_scores(created_at DESC);

-- Money Grab Player Achievements
CREATE TABLE IF NOT EXISTS money_grab_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  achievement_id text NOT NULL,
  progress integer DEFAULT 0,
  completed boolean DEFAULT false,
  unlocked_at timestamptz DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

ALTER TABLE money_grab_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own achievements"
  ON money_grab_achievements FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own achievements"
  ON money_grab_achievements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own achievements"
  ON money_grab_achievements FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_money_grab_achievements_user_id ON money_grab_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_money_grab_achievements_completed ON money_grab_achievements(completed);

-- Money Grab Player Stats (aggregate statistics)
CREATE TABLE IF NOT EXISTS money_grab_stats (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_games integer DEFAULT 0,
  total_score bigint DEFAULT 0,
  total_money_collected bigint DEFAULT 0,
  total_power_ups_used integer DEFAULT 0,
  total_enemies_defeated integer DEFAULT 0,
  highest_level_reached integer DEFAULT 0,
  best_combo integer DEFAULT 0,
  fastest_level_completion integer DEFAULT NULL,
  total_playtime_seconds bigint DEFAULT 0,
  player_total_wins integer DEFAULT 0,
  ai_total_wins integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE money_grab_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own stats"
  ON money_grab_stats FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stats"
  ON money_grab_stats FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stats"
  ON money_grab_stats FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function to update stats when new game score is inserted
CREATE OR REPLACE FUNCTION update_money_grab_stats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO money_grab_stats (
    user_id,
    total_games,
    total_score,
    total_money_collected,
    total_power_ups_used,
    total_enemies_defeated,
    highest_level_reached,
    best_combo,
    fastest_level_completion,
    total_playtime_seconds,
    player_total_wins,
    ai_total_wins,
    updated_at
  )
  VALUES (
    NEW.user_id,
    1,
    NEW.total_score,
    NEW.money_collected,
    NEW.power_ups_used,
    NEW.enemies_defeated,
    NEW.highest_level,
    NEW.max_combo,
    NEW.fastest_level_time,
    NEW.duration_seconds,
    NEW.player_wins,
    NEW.ai_wins,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    total_games = money_grab_stats.total_games + 1,
    total_score = money_grab_stats.total_score + NEW.total_score,
    total_money_collected = money_grab_stats.total_money_collected + NEW.money_collected,
    total_power_ups_used = money_grab_stats.total_power_ups_used + NEW.power_ups_used,
    total_enemies_defeated = money_grab_stats.total_enemies_defeated + NEW.enemies_defeated,
    highest_level_reached = GREATEST(money_grab_stats.highest_level_reached, NEW.highest_level),
    best_combo = GREATEST(money_grab_stats.best_combo, NEW.max_combo),
    fastest_level_completion = CASE 
      WHEN money_grab_stats.fastest_level_completion IS NULL THEN NEW.fastest_level_time
      WHEN NEW.fastest_level_time IS NULL THEN money_grab_stats.fastest_level_completion
      ELSE LEAST(money_grab_stats.fastest_level_completion, NEW.fastest_level_time)
    END,
    total_playtime_seconds = money_grab_stats.total_playtime_seconds + NEW.duration_seconds,
    player_total_wins = money_grab_stats.player_total_wins + NEW.player_wins,
    ai_total_wins = money_grab_stats.ai_total_wins + NEW.ai_wins,
    updated_at = now();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically update stats
DROP TRIGGER IF EXISTS trigger_update_money_grab_stats ON money_grab_scores;
CREATE TRIGGER trigger_update_money_grab_stats
  AFTER INSERT ON money_grab_scores
  FOR EACH ROW
  EXECUTE FUNCTION update_money_grab_stats();
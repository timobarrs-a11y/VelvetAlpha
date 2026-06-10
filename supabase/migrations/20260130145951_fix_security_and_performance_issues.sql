/*
  # Fix Security and Performance Issues

  This migration addresses multiple security and performance issues identified by Supabase:

  ## 1. Missing Foreign Key Indexes (Performance)
  Added indexes for foreign keys on:
  - companion_memories.companion_id
  - moderation_flags.companion_id
  - moderation_flags.reviewed_by
  - money_grab_scores.companion_id
  - video_reactions.companion_id

  ## 2. RLS Policy Optimization (Performance)
  Updated all RLS policies to use `(select auth.uid())` instead of `auth.uid()`
  This prevents re-evaluation of auth functions for each row, significantly improving query performance.
  Affects 67+ policies across all tables.

  ## 3. Function Search Path Security
  Fixed search_path for all functions to prevent search_path manipulation attacks.

  ## 4. RLS Policy Security Issues
  Fixed overly permissive RLS policies:
  - moderation_flags: Restricted system insert policy
  - rate_limits: Restricted service insert policy
  - user_feedback: Added proper authentication check

  ## 5. Vector Extension Best Practice
  Note: Vector extension should be moved to a separate schema in production.
  This requires coordination with application code and is noted for manual follow-up.

  ## 6. Unused Indexes
  Note: 50+ unused indexes identified. These are kept for now as the application
  may be in early stages. Recommend reviewing after production usage data is available.

  ## 7. Password Breach Detection
  Note: Enable leaked password protection in Supabase Dashboard:
  Authentication > Settings > Enable "Breach Password Protection"
*/

-- ============================================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_companion_memories_companion_id 
  ON companion_memories(companion_id);

CREATE INDEX IF NOT EXISTS idx_moderation_flags_companion_id 
  ON moderation_flags(companion_id);

CREATE INDEX IF NOT EXISTS idx_moderation_flags_reviewed_by 
  ON moderation_flags(reviewed_by);

CREATE INDEX IF NOT EXISTS idx_money_grab_scores_companion_id 
  ON money_grab_scores(companion_id);

CREATE INDEX IF NOT EXISTS idx_video_reactions_companion_id 
  ON video_reactions(companion_id);

-- ============================================================================
-- 2. FIX FUNCTION SEARCH PATHS
-- ============================================================================

ALTER FUNCTION update_user_feedback_updated_at() SET search_path = '';
ALTER FUNCTION update_momentum_career_updated_at() SET search_path = '';
ALTER FUNCTION update_momentum_high_scores() SET search_path = '';
ALTER FUNCTION update_money_grab_stats() SET search_path = '';
ALTER FUNCTION search_memories_by_similarity(vector, uuid, double precision, integer) SET search_path = '';
ALTER FUNCTION initialize_emotional_state() SET search_path = '';
ALTER FUNCTION check_rate_limit(uuid, text, integer, integer) SET search_path = '';
ALTER FUNCTION record_rate_limit(uuid, text, text, text) SET search_path = '';
ALTER FUNCTION cleanup_old_rate_limits() SET search_path = '';
ALTER FUNCTION check_user_moderation_status(uuid) SET search_path = '';
ALTER FUNCTION record_moderation_flag(uuid, uuid, uuid, text, text, text) SET search_path = '';
ALTER FUNCTION update_updated_at_column() SET search_path = '';

-- ============================================================================
-- 3. FIX OVERLY PERMISSIVE RLS POLICIES
-- ============================================================================

-- Fix moderation_flags: Make system insert policy more restrictive
DROP POLICY IF EXISTS "System can insert moderation flags" ON moderation_flags;
CREATE POLICY "Service role can insert moderation flags"
  ON moderation_flags
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Fix rate_limits: Restrict to service role only
DROP POLICY IF EXISTS "Service can insert rate limits" ON rate_limits;
CREATE POLICY "Service role can manage rate limits"
  ON rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Fix user_feedback: Require authentication
DROP POLICY IF EXISTS "Anyone can submit feedback" ON user_feedback;
CREATE POLICY "Authenticated users can submit feedback"
  ON user_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- 4. OPTIMIZE RLS POLICIES - USE (SELECT auth.uid())
-- ============================================================================

-- RELATIONSHIP_MEMORIES
DROP POLICY IF EXISTS "Users can view own memories" ON relationship_memories;
CREATE POLICY "Users can view own memories"
  ON relationship_memories FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own memories" ON relationship_memories;
CREATE POLICY "Users can insert own memories"
  ON relationship_memories FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own memories" ON relationship_memories;
CREATE POLICY "Users can update own memories"
  ON relationship_memories FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own memories" ON relationship_memories;
CREATE POLICY "Users can delete own memories"
  ON relationship_memories FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- CONVERSATION_THREADS
DROP POLICY IF EXISTS "Users can view own threads" ON conversation_threads;
CREATE POLICY "Users can view own threads"
  ON conversation_threads FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own threads" ON conversation_threads;
CREATE POLICY "Users can insert own threads"
  ON conversation_threads FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own threads" ON conversation_threads;
CREATE POLICY "Users can update own threads"
  ON conversation_threads FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own threads" ON conversation_threads;
CREATE POLICY "Users can delete own threads"
  ON conversation_threads FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- COMPANIONS
DROP POLICY IF EXISTS "Users can view own companions" ON companions;
CREATE POLICY "Users can view own companions"
  ON companions FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can create own companions" ON companions;
CREATE POLICY "Users can create own companions"
  ON companions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own companions" ON companions;
CREATE POLICY "Users can update own companions"
  ON companions FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own companions" ON companions;
CREATE POLICY "Users can delete own companions"
  ON companions FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- EMOTIONAL_PROFILE
DROP POLICY IF EXISTS "Users can view own emotional profile" ON emotional_profile;
CREATE POLICY "Users can view own emotional profile"
  ON emotional_profile FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own emotional profile" ON emotional_profile;
CREATE POLICY "Users can insert own emotional profile"
  ON emotional_profile FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own emotional profile" ON emotional_profile;
CREATE POLICY "Users can update own emotional profile"
  ON emotional_profile FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own emotional profile" ON emotional_profile;
CREATE POLICY "Users can delete own emotional profile"
  ON emotional_profile FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- PERSONALITY_CONSISTENCY_LOG
DROP POLICY IF EXISTS "Users can view own consistency log" ON personality_consistency_log;
CREATE POLICY "Users can view own consistency log"
  ON personality_consistency_log FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own consistency log" ON personality_consistency_log;
CREATE POLICY "Users can insert own consistency log"
  ON personality_consistency_log FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own consistency log" ON personality_consistency_log;
CREATE POLICY "Users can update own consistency log"
  ON personality_consistency_log FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own consistency log" ON personality_consistency_log;
CREATE POLICY "Users can delete own consistency log"
  ON personality_consistency_log FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- CHECKERS_GAMES
DROP POLICY IF EXISTS "Users can view own games" ON checkers_games;
CREATE POLICY "Users can view own games"
  ON checkers_games FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can create own games" ON checkers_games;
CREATE POLICY "Users can create own games"
  ON checkers_games FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own games" ON checkers_games;
CREATE POLICY "Users can update own games"
  ON checkers_games FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own games" ON checkers_games;
CREATE POLICY "Users can delete own games"
  ON checkers_games FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- CHECKERS_MOVES
DROP POLICY IF EXISTS "Users can view moves from own games" ON checkers_moves;
CREATE POLICY "Users can view moves from own games"
  ON checkers_moves FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM checkers_games
      WHERE checkers_games.id = checkers_moves.game_id
      AND checkers_games.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create moves for own games" ON checkers_moves;
CREATE POLICY "Users can create moves for own games"
  ON checkers_moves FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM checkers_games
      WHERE checkers_games.id = checkers_moves.game_id
      AND checkers_games.user_id = (select auth.uid())
    )
  );

-- PACMAN_GAMES
DROP POLICY IF EXISTS "Users can view own games" ON pacman_games;
CREATE POLICY "Users can view own games"
  ON pacman_games FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can create own games" ON pacman_games;
CREATE POLICY "Users can create own games"
  ON pacman_games FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own games" ON pacman_games;
CREATE POLICY "Users can update own games"
  ON pacman_games FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own games" ON pacman_games;
CREATE POLICY "Users can delete own games"
  ON pacman_games FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- USER_FEEDBACK
DROP POLICY IF EXISTS "Users can read own feedback" ON user_feedback;
CREATE POLICY "Users can read own feedback"
  ON user_feedback FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- COMPANION_MEMORIES
DROP POLICY IF EXISTS "Users can view own companion memories" ON companion_memories;
CREATE POLICY "Users can view own companion memories"
  ON companion_memories FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companions
      WHERE companions.id = companion_memories.companion_id
      AND companions.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create own companion memories" ON companion_memories;
CREATE POLICY "Users can create own companion memories"
  ON companion_memories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companions
      WHERE companions.id = companion_memories.companion_id
      AND companions.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own companion memories" ON companion_memories;
CREATE POLICY "Users can update own companion memories"
  ON companion_memories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companions
      WHERE companions.id = companion_memories.companion_id
      AND companions.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companions
      WHERE companions.id = companion_memories.companion_id
      AND companions.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete own companion memories" ON companion_memories;
CREATE POLICY "Users can delete own companion memories"
  ON companion_memories FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companions
      WHERE companions.id = companion_memories.companion_id
      AND companions.user_id = (select auth.uid())
    )
  );

-- WATCHED_VIDEOS
DROP POLICY IF EXISTS "Users can view their own watched videos" ON watched_videos;
CREATE POLICY "Users can view their own watched videos"
  ON watched_videos FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own watched videos" ON watched_videos;
CREATE POLICY "Users can insert their own watched videos"
  ON watched_videos FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own watched videos" ON watched_videos;
CREATE POLICY "Users can update their own watched videos"
  ON watched_videos FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own watched videos" ON watched_videos;
CREATE POLICY "Users can delete their own watched videos"
  ON watched_videos FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- VIDEO_REACTIONS
DROP POLICY IF EXISTS "Users can view reactions for their watched videos" ON video_reactions;
CREATE POLICY "Users can view reactions for their watched videos"
  ON video_reactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM watched_videos
      WHERE watched_videos.id = video_reactions.watched_video_id
      AND watched_videos.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert reactions for their watched videos" ON video_reactions;
CREATE POLICY "Users can insert reactions for their watched videos"
  ON video_reactions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM watched_videos
      WHERE watched_videos.id = video_reactions.watched_video_id
      AND watched_videos.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update reactions for their watched videos" ON video_reactions;
CREATE POLICY "Users can update reactions for their watched videos"
  ON video_reactions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM watched_videos
      WHERE watched_videos.id = video_reactions.watched_video_id
      AND watched_videos.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM watched_videos
      WHERE watched_videos.id = video_reactions.watched_video_id
      AND watched_videos.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete reactions for their watched videos" ON video_reactions;
CREATE POLICY "Users can delete reactions for their watched videos"
  ON video_reactions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM watched_videos
      WHERE watched_videos.id = video_reactions.watched_video_id
      AND watched_videos.user_id = (select auth.uid())
    )
  );

-- MONEY_GRAB_SCORES
DROP POLICY IF EXISTS "Users can read own money grab scores" ON money_grab_scores;
CREATE POLICY "Users can read own money grab scores"
  ON money_grab_scores FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own money grab scores" ON money_grab_scores;
CREATE POLICY "Users can insert own money grab scores"
  ON money_grab_scores FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- MONEY_GRAB_ACHIEVEMENTS
DROP POLICY IF EXISTS "Users can read own achievements" ON money_grab_achievements;
CREATE POLICY "Users can read own achievements"
  ON money_grab_achievements FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own achievements" ON money_grab_achievements;
CREATE POLICY "Users can insert own achievements"
  ON money_grab_achievements FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own achievements" ON money_grab_achievements;
CREATE POLICY "Users can update own achievements"
  ON money_grab_achievements FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- MONEY_GRAB_STATS
DROP POLICY IF EXISTS "Users can read own stats" ON money_grab_stats;
CREATE POLICY "Users can read own stats"
  ON money_grab_stats FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own stats" ON money_grab_stats;
CREATE POLICY "Users can insert own stats"
  ON money_grab_stats FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own stats" ON money_grab_stats;
CREATE POLICY "Users can update own stats"
  ON money_grab_stats FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- MOMENTUM_GAME_STATS
DROP POLICY IF EXISTS "Users can view own game stats" ON momentum_game_stats;
CREATE POLICY "Users can view own game stats"
  ON momentum_game_stats FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own game stats" ON momentum_game_stats;
CREATE POLICY "Users can insert own game stats"
  ON momentum_game_stats FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- MOMENTUM_HIGH_SCORES
DROP POLICY IF EXISTS "Users can view own high scores" ON momentum_high_scores;
CREATE POLICY "Users can view own high scores"
  ON momentum_high_scores FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own high scores" ON momentum_high_scores;
CREATE POLICY "Users can insert own high scores"
  ON momentum_high_scores FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own high scores" ON momentum_high_scores;
CREATE POLICY "Users can update own high scores"
  ON momentum_high_scores FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- MOMENTUM_CAREER_PROGRESS
DROP POLICY IF EXISTS "Users can view their own career progress" ON momentum_career_progress;
CREATE POLICY "Users can view their own career progress"
  ON momentum_career_progress FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own career progress" ON momentum_career_progress;
CREATE POLICY "Users can insert their own career progress"
  ON momentum_career_progress FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own career progress" ON momentum_career_progress;
CREATE POLICY "Users can update their own career progress"
  ON momentum_career_progress FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- STELLAR_PURSUIT_SESSIONS
DROP POLICY IF EXISTS "Users can view own stellar pursuit sessions" ON stellar_pursuit_sessions;
CREATE POLICY "Users can view own stellar pursuit sessions"
  ON stellar_pursuit_sessions FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own stellar pursuit sessions" ON stellar_pursuit_sessions;
CREATE POLICY "Users can insert own stellar pursuit sessions"
  ON stellar_pursuit_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own stellar pursuit sessions" ON stellar_pursuit_sessions;
CREATE POLICY "Users can update own stellar pursuit sessions"
  ON stellar_pursuit_sessions FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- STELLAR_PURSUIT_HIGH_SCORES
DROP POLICY IF EXISTS "Users can view own stellar pursuit high scores" ON stellar_pursuit_high_scores;
CREATE POLICY "Users can view own stellar pursuit high scores"
  ON stellar_pursuit_high_scores FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own stellar pursuit high scores" ON stellar_pursuit_high_scores;
CREATE POLICY "Users can insert own stellar pursuit high scores"
  ON stellar_pursuit_high_scores FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own stellar pursuit high scores" ON stellar_pursuit_high_scores;
CREATE POLICY "Users can update own stellar pursuit high scores"
  ON stellar_pursuit_high_scores FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- MEMORY_CLUSTERS
DROP POLICY IF EXISTS "Users can view own memory clusters" ON memory_clusters;
CREATE POLICY "Users can view own memory clusters"
  ON memory_clusters FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own memory clusters" ON memory_clusters;
CREATE POLICY "Users can insert own memory clusters"
  ON memory_clusters FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own memory clusters" ON memory_clusters;
CREATE POLICY "Users can update own memory clusters"
  ON memory_clusters FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own memory clusters" ON memory_clusters;
CREATE POLICY "Users can delete own memory clusters"
  ON memory_clusters FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- TEMPORAL_CHAINS
DROP POLICY IF EXISTS "Users can view own temporal chains" ON temporal_chains;
CREATE POLICY "Users can view own temporal chains"
  ON temporal_chains FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own temporal chains" ON temporal_chains;
CREATE POLICY "Users can insert own temporal chains"
  ON temporal_chains FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own temporal chains" ON temporal_chains;
CREATE POLICY "Users can update own temporal chains"
  ON temporal_chains FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own temporal chains" ON temporal_chains;
CREATE POLICY "Users can delete own temporal chains"
  ON temporal_chains FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- RATE_LIMITS
DROP POLICY IF EXISTS "Users can view own rate limits" ON rate_limits;
CREATE POLICY "Users can view own rate limits"
  ON rate_limits FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

/*
  # Fix Security and Performance Issues

  ## Performance Improvements
  1. **Foreign Key Index**
     - Add index for `scheduled_callbacks.conversation_id` foreign key
  
  2. **RLS Policy Optimization**
     - Wrap all `auth.uid()` calls in SELECT subqueries
     - Prevents re-evaluation for each row at scale
     - Applies to all tables: user_profiles, conversations, conversation_memories, 
       scheduled_callbacks, ai_initiated_messages, user_engagement_patterns, life_events,
       user_tokens, user_gifts, sleepy_warnings, proactive_messages, worry_escalations,
       relationship_stats, emotional_states, mood_history, activity_sessions, game_scores,
       study_sessions, workout_logs, date_scenarios

  ## Security Improvements
  1. **Function Search Path**
     - Set explicit search_path for all functions
     - Prevents search_path injection attacks
*/

-- ============================================================================
-- 1. ADD MISSING INDEX FOR FOREIGN KEY
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_scheduled_callbacks_conversation_id 
  ON scheduled_callbacks(conversation_id);

-- ============================================================================
-- 2. OPTIMIZE RLS POLICIES - USER_PROFILES
-- ============================================================================

DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- ============================================================================
-- 3. OPTIMIZE RLS POLICIES - CONVERSATIONS
-- ============================================================================

DROP POLICY IF EXISTS "Users can read own conversations" ON conversations;
CREATE POLICY "Users can read own conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own conversations" ON conversations;
CREATE POLICY "Users can insert own conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own conversations" ON conversations;
CREATE POLICY "Users can delete own conversations"
  ON conversations FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- 4. OPTIMIZE RLS POLICIES - CONVERSATION_MEMORIES
-- ============================================================================

DROP POLICY IF EXISTS "Users can read own memories" ON conversation_memories;
CREATE POLICY "Users can read own memories"
  ON conversation_memories FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own memories" ON conversation_memories;
CREATE POLICY "Users can insert own memories"
  ON conversation_memories FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own memories" ON conversation_memories;
CREATE POLICY "Users can delete own memories"
  ON conversation_memories FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- 5. OPTIMIZE RLS POLICIES - SCHEDULED_CALLBACKS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own scheduled callbacks" ON scheduled_callbacks;
CREATE POLICY "Users can view own scheduled callbacks"
  ON scheduled_callbacks FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own scheduled callbacks" ON scheduled_callbacks;
CREATE POLICY "Users can create own scheduled callbacks"
  ON scheduled_callbacks FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own scheduled callbacks" ON scheduled_callbacks;
CREATE POLICY "Users can update own scheduled callbacks"
  ON scheduled_callbacks FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own scheduled callbacks" ON scheduled_callbacks;
CREATE POLICY "Users can delete own scheduled callbacks"
  ON scheduled_callbacks FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- 6. OPTIMIZE RLS POLICIES - AI_INITIATED_MESSAGES
-- ============================================================================

DROP POLICY IF EXISTS "Users can read own AI messages" ON ai_initiated_messages;
CREATE POLICY "Users can read own AI messages"
  ON ai_initiated_messages FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own AI messages" ON ai_initiated_messages;
CREATE POLICY "Users can update own AI messages"
  ON ai_initiated_messages FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- 7. OPTIMIZE RLS POLICIES - USER_ENGAGEMENT_PATTERNS
-- ============================================================================

DROP POLICY IF EXISTS "Users can read own engagement patterns" ON user_engagement_patterns;
CREATE POLICY "Users can read own engagement patterns"
  ON user_engagement_patterns FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own engagement patterns" ON user_engagement_patterns;
CREATE POLICY "Users can update own engagement patterns"
  ON user_engagement_patterns FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- 8. OPTIMIZE RLS POLICIES - LIFE_EVENTS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own life events" ON life_events;
CREATE POLICY "Users can view own life events"
  ON life_events FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own life events" ON life_events;
CREATE POLICY "Users can create own life events"
  ON life_events FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own life events" ON life_events;
CREATE POLICY "Users can update own life events"
  ON life_events FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own life events" ON life_events;
CREATE POLICY "Users can delete own life events"
  ON life_events FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- 9. OPTIMIZE RLS POLICIES - USER_TOKENS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own tokens" ON user_tokens;
CREATE POLICY "Users can view own tokens"
  ON user_tokens FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own tokens" ON user_tokens;
CREATE POLICY "Users can update own tokens"
  ON user_tokens FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own tokens" ON user_tokens;
CREATE POLICY "Users can insert own tokens"
  ON user_tokens FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- 10. OPTIMIZE RLS POLICIES - USER_GIFTS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own gifts" ON user_gifts;
CREATE POLICY "Users can view own gifts"
  ON user_gifts FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own gifts" ON user_gifts;
CREATE POLICY "Users can update own gifts"
  ON user_gifts FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own gifts" ON user_gifts;
CREATE POLICY "Users can insert own gifts"
  ON user_gifts FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- 11. OPTIMIZE RLS POLICIES - SLEEPY_WARNINGS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own warnings" ON sleepy_warnings;
CREATE POLICY "Users can view own warnings"
  ON sleepy_warnings FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own warnings" ON sleepy_warnings;
CREATE POLICY "Users can insert own warnings"
  ON sleepy_warnings FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- 12. OPTIMIZE RLS POLICIES - PROACTIVE_MESSAGES
-- ============================================================================

DROP POLICY IF EXISTS "Users own proactive" ON proactive_messages;
CREATE POLICY "Users own proactive"
  ON proactive_messages
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- 13. OPTIMIZE RLS POLICIES - WORRY_ESCALATIONS
-- ============================================================================

DROP POLICY IF EXISTS "Users own worry" ON worry_escalations;
CREATE POLICY "Users own worry"
  ON worry_escalations
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- 14. OPTIMIZE RLS POLICIES - RELATIONSHIP_STATS
-- ============================================================================

DROP POLICY IF EXISTS "Users own stats" ON relationship_stats;
CREATE POLICY "Users own stats"
  ON relationship_stats
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- 15. OPTIMIZE RLS POLICIES - EMOTIONAL_STATES
-- ============================================================================

DROP POLICY IF EXISTS "Users access own emotional states" ON emotional_states;
CREATE POLICY "Users access own emotional states"
  ON emotional_states
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- 16. OPTIMIZE RLS POLICIES - MOOD_HISTORY
-- ============================================================================

DROP POLICY IF EXISTS "Users access own mood history" ON mood_history;
CREATE POLICY "Users access own mood history"
  ON mood_history
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- 17. OPTIMIZE RLS POLICIES - ACTIVITY_SESSIONS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own activity sessions" ON activity_sessions;
CREATE POLICY "Users can view own activity sessions"
  ON activity_sessions FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own activity sessions" ON activity_sessions;
CREATE POLICY "Users can create own activity sessions"
  ON activity_sessions FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own activity sessions" ON activity_sessions;
CREATE POLICY "Users can update own activity sessions"
  ON activity_sessions FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- 18. OPTIMIZE RLS POLICIES - GAME_SCORES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own game scores" ON game_scores;
CREATE POLICY "Users can view own game scores"
  ON game_scores FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own game scores" ON game_scores;
CREATE POLICY "Users can create own game scores"
  ON game_scores FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- 19. OPTIMIZE RLS POLICIES - STUDY_SESSIONS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own study sessions" ON study_sessions;
CREATE POLICY "Users can view own study sessions"
  ON study_sessions FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own study sessions" ON study_sessions;
CREATE POLICY "Users can create own study sessions"
  ON study_sessions FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own study sessions" ON study_sessions;
CREATE POLICY "Users can update own study sessions"
  ON study_sessions FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- 20. OPTIMIZE RLS POLICIES - WORKOUT_LOGS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own workout logs" ON workout_logs;
CREATE POLICY "Users can view own workout logs"
  ON workout_logs FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own workout logs" ON workout_logs;
CREATE POLICY "Users can create own workout logs"
  ON workout_logs FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own workout logs" ON workout_logs;
CREATE POLICY "Users can update own workout logs"
  ON workout_logs FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- 21. OPTIMIZE RLS POLICIES - DATE_SCENARIOS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own date scenarios" ON date_scenarios;
CREATE POLICY "Users can view own date scenarios"
  ON date_scenarios FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own date scenarios" ON date_scenarios;
CREATE POLICY "Users can create own date scenarios"
  ON date_scenarios FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own date scenarios" ON date_scenarios;
CREATE POLICY "Users can update own date scenarios"
  ON date_scenarios FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- 22. FIX FUNCTION SEARCH PATHS
-- ============================================================================

ALTER FUNCTION update_updated_at_column() SET search_path = public, pg_temp;
ALTER FUNCTION initialize_emotional_state() SET search_path = public, pg_temp;
ALTER FUNCTION update_last_interaction() SET search_path = public, pg_temp;
ALTER FUNCTION update_user_last_active() SET search_path = public, pg_temp;
ALTER FUNCTION deactivate_expired_life_events() SET search_path = public, pg_temp;
ALTER FUNCTION refresh_daily_tokens() SET search_path = public, pg_temp;
ALTER FUNCTION create_user_tokens() SET search_path = public, pg_temp;
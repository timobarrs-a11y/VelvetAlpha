/*
  # Fix Security Policies and Cleanup Duplicates

  1. Security Fixes
    - Restrict `business_metrics` SELECT to admins only (was open to all authenticated users)
    - Restrict `performance_metrics` SELECT to admins only (was open to all authenticated users)
    - Restrict `retention_cohorts` SELECT to admins only (was open to all authenticated users)
    - Fix `error_logs` INSERT to enforce ownership via auth.uid() = user_id
    - Fix `user_behavior_analytics` INSERT to enforce ownership via auth.uid() = user_id

  2. Duplicate Policy Cleanup
    - Remove duplicate policies on `co_author_blocks` (had 2 of each CRUD operation)
    - Remove duplicate policies on `co_author_chat_messages` (had 2 of each CRUD operation)
    - Remove duplicate policies on `co_author_sessions` (had 3 INSERT, 3 DELETE, 3 SELECT, 3 UPDATE)

  3. Duplicate Index Cleanup
    - Remove `idx_co_author_blocks_order` (duplicate of `idx_co_author_blocks_session_order`)
    - Remove `idx_co_author_chat_messages_session_id` (duplicate of `idx_co_author_chat_session_time`)

  4. Notes
    - All changes are safe: duplicate policies/indexes are functionally identical
    - Admin restriction uses existing `is_admin()` helper function
    - No data is modified
*/

-- =============================================
-- 1. FIX ADMIN TABLE POLICIES
-- =============================================

-- business_metrics: restrict to admins
DROP POLICY IF EXISTS "Admins can view business metrics" ON business_metrics;
CREATE POLICY "Admins can view business metrics"
  ON business_metrics FOR SELECT
  TO authenticated
  USING (is_admin());

-- performance_metrics: restrict to admins
DROP POLICY IF EXISTS "Admins can view performance metrics" ON performance_metrics;
CREATE POLICY "Admins can view performance metrics"
  ON performance_metrics FOR SELECT
  TO authenticated
  USING (is_admin());

-- retention_cohorts: restrict to admins
DROP POLICY IF EXISTS "Admins can view retention cohorts" ON retention_cohorts;
CREATE POLICY "Admins can view retention cohorts"
  ON retention_cohorts FOR SELECT
  TO authenticated
  USING (is_admin());

-- =============================================
-- 2. FIX OVERLY PERMISSIVE INSERT POLICIES
-- =============================================

-- error_logs: enforce ownership on INSERT
DROP POLICY IF EXISTS "System can log errors" ON error_logs;
CREATE POLICY "Users can log own errors"
  ON error_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- user_behavior_analytics: enforce ownership on INSERT
DROP POLICY IF EXISTS "System can insert behavior analytics" ON user_behavior_analytics;
CREATE POLICY "Users can insert own behavior analytics"
  ON user_behavior_analytics FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- =============================================
-- 3. CLEANUP DUPLICATE CO_AUTHOR POLICIES
-- =============================================

-- co_author_blocks: keep "Users can ... blocks in/from own sessions", drop "Users can ... own co_author blocks"
DROP POLICY IF EXISTS "Users can read own co_author blocks" ON co_author_blocks;
DROP POLICY IF EXISTS "Users can insert own co_author blocks" ON co_author_blocks;
DROP POLICY IF EXISTS "Users can update own co_author blocks" ON co_author_blocks;
DROP POLICY IF EXISTS "Users can delete own co_author blocks" ON co_author_blocks;

-- co_author_chat_messages: keep "Users can ... chat messages in/from own sessions", drop "Users can ... own co_author chat messages"
DROP POLICY IF EXISTS "Users can read own co_author chat messages" ON co_author_chat_messages;
DROP POLICY IF EXISTS "Users can insert own co_author chat messages" ON co_author_chat_messages;
DROP POLICY IF EXISTS "Users can delete own co_author chat messages" ON co_author_chat_messages;

-- co_author_sessions: keep "Users can ... own co-author sessions" (with hyphen), drop others
DROP POLICY IF EXISTS "Users can read own co_author sessions" ON co_author_sessions;
DROP POLICY IF EXISTS "Users can insert own co_author sessions" ON co_author_sessions;
DROP POLICY IF EXISTS "Users can update own co_author sessions" ON co_author_sessions;
DROP POLICY IF EXISTS "Users can delete own co_author sessions" ON co_author_sessions;
DROP POLICY IF EXISTS "Users can create own sessions" ON co_author_sessions;
DROP POLICY IF EXISTS "Users can view own sessions" ON co_author_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON co_author_sessions;
DROP POLICY IF EXISTS "Users can delete own sessions" ON co_author_sessions;

-- =============================================
-- 4. CLEANUP DUPLICATE INDEXES
-- =============================================

DROP INDEX IF EXISTS idx_co_author_blocks_order;
DROP INDEX IF EXISTS idx_co_author_chat_messages_session_id;

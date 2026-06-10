-- ============================================================
-- COMPREHENSIVE SECURITY FIX MIGRATION
-- ============================================================
-- This migration addresses three categories of security issues:
--
-- 1. MISSING INDEXES: Adds indexes for unindexed foreign key columns
--    to improve query performance and enable efficient JOINs.
--
-- 2. RLS POLICY FIXES: Replaces auth.uid() with (select auth.uid())
--    in all RLS policies. This prevents per-row function re-evaluation
--    and avoids potential privilege escalation via search_path tricks.
--    Only the auth.uid() call is changed; all policy logic is preserved.
--
-- 3. FUNCTION SEARCH PATH: Adds SET search_path = public, pg_catalog
--    to all affected functions to eliminate mutable search_path
--    security warnings.
-- ============================================================


-- ============================================================
-- PART 1: ADD MISSING INDEXES FOR UNINDEXED FOREIGN KEYS
-- ============================================================

-- activity_sessions
CREATE INDEX IF NOT EXISTS idx_activity_sessions_user_id ON public.activity_sessions(user_id);

-- affection_updates
CREATE INDEX IF NOT EXISTS idx_affection_updates_companion_id ON public.affection_updates(companion_id);

-- anniversaries
CREATE INDEX IF NOT EXISTS idx_anniversaries_companion_id ON public.anniversaries(companion_id);
CREATE INDEX IF NOT EXISTS idx_anniversaries_user_id ON public.anniversaries(user_id);

-- api_performance_logs
CREATE INDEX IF NOT EXISTS idx_api_performance_logs_user_id ON public.api_performance_logs(user_id);

-- article_conversations
CREATE INDEX IF NOT EXISTS idx_article_conversations_companion_id ON public.article_conversations(companion_id);
CREATE INDEX IF NOT EXISTS idx_article_conversations_user_id ON public.article_conversations(user_id);

-- chat_messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_agent_id ON public.chat_messages(agent_id);

-- checkers_games
CREATE INDEX IF NOT EXISTS idx_checkers_games_user_id ON public.checkers_games(user_id);

-- companion_memory
CREATE INDEX IF NOT EXISTS idx_companion_memory_companion_id ON public.companion_memory(companion_id);

-- daily_rituals
CREATE INDEX IF NOT EXISTS idx_daily_rituals_companion_id ON public.daily_rituals(companion_id);

-- date_scenarios
CREATE INDEX IF NOT EXISTS idx_date_scenarios_user_id ON public.date_scenarios(user_id);

-- event_suggestions
CREATE INDEX IF NOT EXISTS idx_event_suggestions_companion_id ON public.event_suggestions(companion_id);
CREATE INDEX IF NOT EXISTS idx_event_suggestions_created_event_id ON public.event_suggestions(created_event_id);

-- game_scores
CREATE INDEX IF NOT EXISTS idx_game_scores_user_id ON public.game_scores(user_id);

-- gift_suggestions
CREATE INDEX IF NOT EXISTS idx_gift_suggestions_companion_id ON public.gift_suggestions(companion_id);

-- group_chat_members
CREATE INDEX IF NOT EXISTS idx_group_chat_members_companion_id ON public.group_chat_members(companion_id);

-- group_chat_messages
CREATE INDEX IF NOT EXISTS idx_group_chat_messages_companion_id ON public.group_chat_messages(companion_id);
CREATE INDEX IF NOT EXISTS idx_group_chat_messages_user_id ON public.group_chat_messages(user_id);

-- memory_clusters
CREATE INDEX IF NOT EXISTS idx_memory_clusters_user_id ON public.memory_clusters(user_id);

-- memory_collections
CREATE INDEX IF NOT EXISTS idx_memory_collections_companion_id ON public.memory_collections(companion_id);

-- memory_moments
CREATE INDEX IF NOT EXISTS idx_memory_moments_companion_id ON public.memory_moments(companion_id);

-- milestone_achievements
CREATE INDEX IF NOT EXISTS idx_milestone_achievements_companion_id ON public.milestone_achievements(companion_id);
CREATE INDEX IF NOT EXISTS idx_milestone_achievements_user_id ON public.milestone_achievements(user_id);

-- moderation_flags
CREATE INDEX IF NOT EXISTS idx_moderation_flags_user_id ON public.moderation_flags(user_id);

-- momentum_game_stats
CREATE INDEX IF NOT EXISTS idx_momentum_game_stats_user_id ON public.momentum_game_stats(user_id);

-- money_grab_scores
CREATE INDEX IF NOT EXISTS idx_money_grab_scores_user_id ON public.money_grab_scores(user_id);

-- noir_asset_pairs
CREATE INDEX IF NOT EXISTS idx_noir_asset_pairs_paired_asset ON public.noir_asset_pairs(paired_asset);

-- noir_conversation_choices
CREATE INDEX IF NOT EXISTS idx_noir_conversation_choices_next_node_id ON public.noir_conversation_choices(next_node_id);

-- noir_level_landmarks
CREATE INDEX IF NOT EXISTS idx_noir_level_landmarks_asset_type ON public.noir_level_landmarks(asset_type);

-- noir_player_conversation_state
CREATE INDEX IF NOT EXISTS idx_noir_player_conv_state_current_node ON public.noir_player_conversation_state(current_node_id);

-- pacman_games
CREATE INDEX IF NOT EXISTS idx_pacman_games_user_id ON public.pacman_games(user_id);

-- platformer_sessions
CREATE INDEX IF NOT EXISTS idx_platformer_sessions_user_id ON public.platformer_sessions(user_id);

-- player_dialogue_state
CREATE INDEX IF NOT EXISTS idx_player_dialogue_state_npc_id ON public.player_dialogue_state(npc_id);
CREATE INDEX IF NOT EXISTS idx_player_dialogue_state_run_id ON public.player_dialogue_state(run_id);

-- rate_limits
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_id ON public.rate_limits(user_id);

-- relationship_timeline
CREATE INDEX IF NOT EXISTS idx_relationship_timeline_companion_id ON public.relationship_timeline(companion_id);
CREATE INDEX IF NOT EXISTS idx_relationship_timeline_user_id ON public.relationship_timeline(user_id);

-- scheduled_messages
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_companion_id ON public.scheduled_messages(companion_id);

-- stellar_pursuit_sessions
CREATE INDEX IF NOT EXISTS idx_stellar_pursuit_sessions_user_id ON public.stellar_pursuit_sessions(user_id);

-- study_sessions
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_id ON public.study_sessions(user_id);

-- temporal_chains
CREATE INDEX IF NOT EXISTS idx_temporal_chains_user_id ON public.temporal_chains(user_id);

-- temporal_milestones
CREATE INDEX IF NOT EXISTS idx_temporal_milestones_companion_id ON public.temporal_milestones(companion_id);

-- user_article_interactions
CREATE INDEX IF NOT EXISTS idx_user_article_interactions_article_id ON public.user_article_interactions(article_id);
CREATE INDEX IF NOT EXISTS idx_user_article_interactions_companion_id ON public.user_article_interactions(companion_id);

-- user_events
CREATE INDEX IF NOT EXISTS idx_user_events_companion_id ON public.user_events(companion_id);

-- user_feedback
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON public.user_feedback(user_id);

-- video_reactions
CREATE INDEX IF NOT EXISTS idx_video_reactions_watched_video_id ON public.video_reactions(watched_video_id);

-- watched_videos
CREATE INDEX IF NOT EXISTS idx_watched_videos_recommendation_id ON public.watched_videos(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_watched_videos_user_id ON public.watched_videos(user_id);

-- workout_logs
CREATE INDEX IF NOT EXISTS idx_workout_logs_user_id ON public.workout_logs(user_id);


-- ============================================================
-- PART 2: FIX RLS POLICIES (replace auth.uid() with (select auth.uid()))
-- ============================================================

-- ------------------------------------------------------------
-- public.user_insights
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own insights" ON public.user_insights;
CREATE POLICY "Users can view their own insights" ON public.user_insights
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.conversation_insights
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own conversation insights" ON public.conversation_insights;
CREATE POLICY "Users can view their own conversation insights" ON public.conversation_insights
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own conversation insights" ON public.conversation_insights;
CREATE POLICY "Users can insert their own conversation insights" ON public.conversation_insights
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.chat_agents
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can delete agents in own rooms" ON public.chat_agents;
CREATE POLICY "Users can delete agents in own rooms" ON public.chat_agents
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM chat_rooms
    WHERE (chat_rooms.id = chat_agents.room_id)
      AND ((chat_rooms.created_by)::text = ((select auth.uid())::text))
  ));

DROP POLICY IF EXISTS "Users can create agents in own rooms" ON public.chat_agents;
CREATE POLICY "Users can create agents in own rooms" ON public.chat_agents
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM chat_rooms
    WHERE (chat_rooms.id = chat_agents.room_id)
      AND ((chat_rooms.created_by)::text = ((select auth.uid())::text))
  ));

DROP POLICY IF EXISTS "Users can view agents in accessible rooms" ON public.chat_agents;
CREATE POLICY "Users can view agents in accessible rooms" ON public.chat_agents
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM chat_rooms
    WHERE (chat_rooms.id = chat_agents.room_id)
      AND (
        ((chat_rooms.created_by)::text = ((select auth.uid())::text))
        OR (EXISTS (
          SELECT 1 FROM chat_participants
          WHERE (chat_participants.room_id = chat_rooms.id)
            AND ((chat_participants.user_id)::text = ((select auth.uid())::text))
        ))
      )
  ));

DROP POLICY IF EXISTS "Users can update agents in own rooms" ON public.chat_agents;
CREATE POLICY "Users can update agents in own rooms" ON public.chat_agents
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM chat_rooms
    WHERE (chat_rooms.id = chat_agents.room_id)
      AND ((chat_rooms.created_by)::text = ((select auth.uid())::text))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM chat_rooms
    WHERE (chat_rooms.id = chat_agents.room_id)
      AND ((chat_rooms.created_by)::text = ((select auth.uid())::text))
  ));

-- ------------------------------------------------------------
-- public.chat_messages
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can create messages in accessible rooms" ON public.chat_messages;
CREATE POLICY "Users can create messages in accessible rooms" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM chat_rooms
    WHERE (chat_rooms.id = chat_messages.room_id)
      AND (
        ((chat_rooms.created_by)::text = ((select auth.uid())::text))
        OR (EXISTS (
          SELECT 1 FROM chat_participants
          WHERE (chat_participants.room_id = chat_rooms.id)
            AND ((chat_participants.user_id)::text = ((select auth.uid())::text))
        ))
      )
  ));

DROP POLICY IF EXISTS "Users can view messages in accessible rooms" ON public.chat_messages;
CREATE POLICY "Users can view messages in accessible rooms" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM chat_rooms
    WHERE (chat_rooms.id = chat_messages.room_id)
      AND (
        ((chat_rooms.created_by)::text = ((select auth.uid())::text))
        OR (EXISTS (
          SELECT 1 FROM chat_participants
          WHERE (chat_participants.room_id = chat_messages.room_id)
            AND ((chat_participants.user_id)::text = ((select auth.uid())::text))
        ))
      )
  ));

DROP POLICY IF EXISTS "Users can delete messages in own rooms" ON public.chat_messages;
CREATE POLICY "Users can delete messages in own rooms" ON public.chat_messages
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM chat_rooms
    WHERE (chat_rooms.id = chat_messages.room_id)
      AND ((chat_rooms.created_by)::text = ((select auth.uid())::text))
  ));

-- ------------------------------------------------------------
-- public.user_events
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own events" ON public.user_events;
CREATE POLICY "Users can view own events" ON public.user_events
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own events" ON public.user_events;
CREATE POLICY "Users can create own events" ON public.user_events
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own events" ON public.user_events;
CREATE POLICY "Users can update own events" ON public.user_events
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own events" ON public.user_events;
CREATE POLICY "Users can delete own events" ON public.user_events
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.event_suggestions
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own event suggestions" ON public.event_suggestions;
CREATE POLICY "Users can view own event suggestions" ON public.event_suggestions
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own event suggestions" ON public.event_suggestions;
CREATE POLICY "Users can update own event suggestions" ON public.event_suggestions
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "System can create event suggestions" ON public.event_suggestions;
CREATE POLICY "System can create event suggestions" ON public.event_suggestions
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.anniversaries
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own anniversaries" ON public.anniversaries;
CREATE POLICY "Users can view own anniversaries" ON public.anniversaries
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own anniversaries" ON public.anniversaries;
CREATE POLICY "Users can create own anniversaries" ON public.anniversaries
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own anniversaries" ON public.anniversaries;
CREATE POLICY "Users can update own anniversaries" ON public.anniversaries
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own anniversaries" ON public.anniversaries;
CREATE POLICY "Users can delete own anniversaries" ON public.anniversaries
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.gift_suggestions
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own gift suggestions" ON public.gift_suggestions;
CREATE POLICY "Users can view own gift suggestions" ON public.gift_suggestions
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own gift suggestions" ON public.gift_suggestions;
CREATE POLICY "Users can create own gift suggestions" ON public.gift_suggestions
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own gift suggestions" ON public.gift_suggestions;
CREATE POLICY "Users can update own gift suggestions" ON public.gift_suggestions
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.reflection_atoms
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update own reflection atoms" ON public.reflection_atoms;
CREATE POLICY "Users can update own reflection atoms" ON public.reflection_atoms
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own reflection atoms" ON public.reflection_atoms;
CREATE POLICY "Users can delete own reflection atoms" ON public.reflection_atoms
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own reflection atoms" ON public.reflection_atoms;
CREATE POLICY "Users can view own reflection atoms" ON public.reflection_atoms
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own reflection atoms" ON public.reflection_atoms;
CREATE POLICY "Users can insert own reflection atoms" ON public.reflection_atoms
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.memory_moments
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own memory moments" ON public.memory_moments;
CREATE POLICY "Users can view own memory moments" ON public.memory_moments
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own memory moments" ON public.memory_moments;
CREATE POLICY "Users can create own memory moments" ON public.memory_moments
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own memory moments" ON public.memory_moments;
CREATE POLICY "Users can update own memory moments" ON public.memory_moments
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own memory moments" ON public.memory_moments;
CREATE POLICY "Users can delete own memory moments" ON public.memory_moments
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.relationship_timeline
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own timeline" ON public.relationship_timeline;
CREATE POLICY "Users can view own timeline" ON public.relationship_timeline
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own timeline events" ON public.relationship_timeline;
CREATE POLICY "Users can create own timeline events" ON public.relationship_timeline
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own timeline events" ON public.relationship_timeline;
CREATE POLICY "Users can update own timeline events" ON public.relationship_timeline
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.milestone_achievements
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own achievements" ON public.milestone_achievements;
CREATE POLICY "Users can view own achievements" ON public.milestone_achievements
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "System can create achievements" ON public.milestone_achievements;
CREATE POLICY "System can create achievements" ON public.milestone_achievements
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own achievements" ON public.milestone_achievements;
CREATE POLICY "Users can update own achievements" ON public.milestone_achievements
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.memory_collections
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own collections" ON public.memory_collections;
CREATE POLICY "Users can view own collections" ON public.memory_collections
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own collections" ON public.memory_collections;
CREATE POLICY "Users can create own collections" ON public.memory_collections
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own collections" ON public.memory_collections;
CREATE POLICY "Users can update own collections" ON public.memory_collections
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own collections" ON public.memory_collections;
CREATE POLICY "Users can delete own collections" ON public.memory_collections
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.article_views
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update own article views" ON public.article_views;
CREATE POLICY "Users can update own article views" ON public.article_views
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can read own article views" ON public.article_views;
CREATE POLICY "Users can read own article views" ON public.article_views
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can create own article views" ON public.article_views;
CREATE POLICY "Users can create own article views" ON public.article_views
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- ------------------------------------------------------------
-- public.news_fetch_log
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own fetch log" ON public.news_fetch_log;
CREATE POLICY "Users can read own fetch log" ON public.news_fetch_log
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own fetch log" ON public.news_fetch_log;
CREATE POLICY "Users can insert own fetch log" ON public.news_fetch_log
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own fetch log" ON public.news_fetch_log;
CREATE POLICY "Users can update own fetch log" ON public.news_fetch_log
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.monitoring_logs
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Admin only can view monitoring logs" ON public.monitoring_logs;
CREATE POLICY "Admin only can view monitoring logs" ON public.monitoring_logs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE (user_profiles.id = (select auth.uid()))
      AND (user_profiles.user_role = 'admin'::text)
  ));

-- ------------------------------------------------------------
-- public.user_behavior_analytics
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own behavior analytics" ON public.user_behavior_analytics;
CREATE POLICY "Users can view own behavior analytics" ON public.user_behavior_analytics
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own behavior analytics" ON public.user_behavior_analytics;
CREATE POLICY "Users can insert own behavior analytics" ON public.user_behavior_analytics
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.feature_usage_stats
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own feature usage" ON public.feature_usage_stats;
CREATE POLICY "Users can view own feature usage" ON public.feature_usage_stats
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "System can manage feature usage" ON public.feature_usage_stats;
CREATE POLICY "System can manage feature usage" ON public.feature_usage_stats
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.player_profiles
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own profile" ON public.player_profiles;
CREATE POLICY "Users can view own profile" ON public.player_profiles
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.player_profiles;
CREATE POLICY "Users can insert own profile" ON public.player_profiles
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.player_profiles;
CREATE POLICY "Users can update own profile" ON public.player_profiles
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.conversion_funnel
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own funnel progress" ON public.conversion_funnel;
CREATE POLICY "Users can view own funnel progress" ON public.conversion_funnel
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "System can track funnel progress" ON public.conversion_funnel;
CREATE POLICY "System can track funnel progress" ON public.conversion_funnel
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.error_logs
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own errors" ON public.error_logs;
CREATE POLICY "Users can view own errors" ON public.error_logs
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can log own errors" ON public.error_logs;
CREATE POLICY "Users can log own errors" ON public.error_logs
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.daily_rituals
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own daily rituals" ON public.daily_rituals;
CREATE POLICY "Users can view own daily rituals" ON public.daily_rituals
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own daily rituals" ON public.daily_rituals;
CREATE POLICY "Users can insert own daily rituals" ON public.daily_rituals
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own daily rituals" ON public.daily_rituals;
CREATE POLICY "Users can update own daily rituals" ON public.daily_rituals
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own daily rituals" ON public.daily_rituals;
CREATE POLICY "Users can delete own daily rituals" ON public.daily_rituals
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.scheduled_messages
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own scheduled messages" ON public.scheduled_messages;
CREATE POLICY "Users can view own scheduled messages" ON public.scheduled_messages
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own scheduled messages" ON public.scheduled_messages;
CREATE POLICY "Users can insert own scheduled messages" ON public.scheduled_messages
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own scheduled messages" ON public.scheduled_messages;
CREATE POLICY "Users can update own scheduled messages" ON public.scheduled_messages
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own scheduled messages" ON public.scheduled_messages;
CREATE POLICY "Users can delete own scheduled messages" ON public.scheduled_messages
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.player_skills
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own skills" ON public.player_skills;
CREATE POLICY "Users can view own skills" ON public.player_skills
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM player_profiles
    WHERE (player_profiles.id = player_skills.player_id)
      AND (player_profiles.user_id = (select auth.uid()))
  ));

DROP POLICY IF EXISTS "Users can insert own skills" ON public.player_skills;
CREATE POLICY "Users can insert own skills" ON public.player_skills
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM player_profiles
    WHERE (player_profiles.id = player_skills.player_id)
      AND (player_profiles.user_id = (select auth.uid()))
  ));

DROP POLICY IF EXISTS "Users can update own skills" ON public.player_skills;
CREATE POLICY "Users can update own skills" ON public.player_skills
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM player_profiles
    WHERE (player_profiles.id = player_skills.player_id)
      AND (player_profiles.user_id = (select auth.uid()))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM player_profiles
    WHERE (player_profiles.id = player_skills.player_id)
      AND (player_profiles.user_id = (select auth.uid()))
  ));

-- ------------------------------------------------------------
-- public.ron_sessions
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Participant A can view their sessions" ON public.ron_sessions;
CREATE POLICY "Participant A can view their sessions" ON public.ron_sessions
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = participant_a_id);

DROP POLICY IF EXISTS "Participant B can view their sessions" ON public.ron_sessions;
CREATE POLICY "Participant B can view their sessions" ON public.ron_sessions
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = participant_b_id);

DROP POLICY IF EXISTS "Users can create sessions as participant A" ON public.ron_sessions;
CREATE POLICY "Users can create sessions as participant A" ON public.ron_sessions
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = participant_a_id);

DROP POLICY IF EXISTS "Participant A can update their sessions" ON public.ron_sessions;
CREATE POLICY "Participant A can update their sessions" ON public.ron_sessions
  FOR UPDATE TO authenticated
  USING (((select auth.uid()) = participant_a_id) OR ((select auth.uid()) = participant_b_id))
  WITH CHECK (((select auth.uid()) = participant_a_id) OR ((select auth.uid()) = participant_b_id));

DROP POLICY IF EXISTS "Participant B can view their session" ON public.ron_sessions;
CREATE POLICY "Participant B can view their session" ON public.ron_sessions
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = participant_b_id);

-- ------------------------------------------------------------
-- public.ron_messages
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Participant A can send messages" ON public.ron_messages;
CREATE POLICY "Participant A can send messages" ON public.ron_messages
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM ron_sessions s
    WHERE (s.id = ron_messages.session_id)
      AND (s.participant_a_id = (select auth.uid()))
      AND (ron_messages.sender_role = 'a'::text)
      AND (s.status = 'active'::text)
  ));

DROP POLICY IF EXISTS "Participant B can send messages" ON public.ron_messages;
CREATE POLICY "Participant B can send messages" ON public.ron_messages
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM ron_sessions s
    WHERE (s.id = ron_messages.session_id)
      AND (s.participant_b_id = (select auth.uid()))
      AND (ron_messages.sender_role = 'b'::text)
      AND (s.status = 'active'::text)
  ));

DROP POLICY IF EXISTS "Session participants can view messages" ON public.ron_messages;
CREATE POLICY "Session participants can view messages" ON public.ron_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM ron_sessions s
    WHERE (s.id = ron_messages.session_id)
      AND (
        (s.participant_a_id = (select auth.uid()))
        OR ((s.participant_b_id IS NOT NULL) AND (s.participant_b_id = (select auth.uid())))
      )
  ));

-- ------------------------------------------------------------
-- public.run_history
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own run history" ON public.run_history;
CREATE POLICY "Users can view own run history" ON public.run_history
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM player_profiles
    WHERE (player_profiles.id = run_history.player_id)
      AND (player_profiles.user_id = (select auth.uid()))
  ));

DROP POLICY IF EXISTS "Users can insert own runs" ON public.run_history;
CREATE POLICY "Users can insert own runs" ON public.run_history
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM player_profiles
    WHERE (player_profiles.id = run_history.player_id)
      AND (player_profiles.user_id = (select auth.uid()))
  ));

DROP POLICY IF EXISTS "Users can update own runs" ON public.run_history;
CREATE POLICY "Users can update own runs" ON public.run_history
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM player_profiles
    WHERE (player_profiles.id = run_history.player_id)
      AND (player_profiles.user_id = (select auth.uid()))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM player_profiles
    WHERE (player_profiles.id = run_history.player_id)
      AND (player_profiles.user_id = (select auth.uid()))
  ));

-- ------------------------------------------------------------
-- public.co_author_sessions
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own co-author sessions" ON public.co_author_sessions;
CREATE POLICY "Users can view own co-author sessions" ON public.co_author_sessions
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own co-author sessions" ON public.co_author_sessions;
CREATE POLICY "Users can create own co-author sessions" ON public.co_author_sessions
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own co-author sessions" ON public.co_author_sessions;
CREATE POLICY "Users can update own co-author sessions" ON public.co_author_sessions
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own co-author sessions" ON public.co_author_sessions;
CREATE POLICY "Users can delete own co-author sessions" ON public.co_author_sessions
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.unlocked_content
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own unlocked content" ON public.unlocked_content;
CREATE POLICY "Users can view own unlocked content" ON public.unlocked_content
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM player_profiles
    WHERE (player_profiles.id = unlocked_content.player_id)
      AND (player_profiles.user_id = (select auth.uid()))
  ));

DROP POLICY IF EXISTS "Users can insert own unlocked content" ON public.unlocked_content;
CREATE POLICY "Users can insert own unlocked content" ON public.unlocked_content
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM player_profiles
    WHERE (player_profiles.id = unlocked_content.player_id)
      AND (player_profiles.user_id = (select auth.uid()))
  ));

-- ------------------------------------------------------------
-- public.player_dialogue_state
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own dialogue state" ON public.player_dialogue_state;
CREATE POLICY "Users can view own dialogue state" ON public.player_dialogue_state
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM player_profiles
    WHERE (player_profiles.id = player_dialogue_state.player_id)
      AND (player_profiles.user_id = (select auth.uid()))
  ));

DROP POLICY IF EXISTS "Users can insert own dialogue state" ON public.player_dialogue_state;
CREATE POLICY "Users can insert own dialogue state" ON public.player_dialogue_state
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM player_profiles
    WHERE (player_profiles.id = player_dialogue_state.player_id)
      AND (player_profiles.user_id = (select auth.uid()))
  ));

DROP POLICY IF EXISTS "Users can update own dialogue state" ON public.player_dialogue_state;
CREATE POLICY "Users can update own dialogue state" ON public.player_dialogue_state
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM player_profiles
    WHERE (player_profiles.id = player_dialogue_state.player_id)
      AND (player_profiles.user_id = (select auth.uid()))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM player_profiles
    WHERE (player_profiles.id = player_dialogue_state.player_id)
      AND (player_profiles.user_id = (select auth.uid()))
  ));

-- ------------------------------------------------------------
-- public.user_settings
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
CREATE POLICY "Users can view own settings" ON public.user_settings
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
CREATE POLICY "Users can insert own settings" ON public.user_settings
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
CREATE POLICY "Users can update own settings" ON public.user_settings
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.co_author_blocks
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view blocks from own sessions" ON public.co_author_blocks;
CREATE POLICY "Users can view blocks from own sessions" ON public.co_author_blocks
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM co_author_sessions
    WHERE (co_author_sessions.id = co_author_blocks.session_id)
      AND (co_author_sessions.user_id = (select auth.uid()))
  ));

DROP POLICY IF EXISTS "Users can create blocks in own sessions" ON public.co_author_blocks;
CREATE POLICY "Users can create blocks in own sessions" ON public.co_author_blocks
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM co_author_sessions
    WHERE (co_author_sessions.id = co_author_blocks.session_id)
      AND (co_author_sessions.user_id = (select auth.uid()))
  ));

DROP POLICY IF EXISTS "Users can update blocks in own sessions" ON public.co_author_blocks;
CREATE POLICY "Users can update blocks in own sessions" ON public.co_author_blocks
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM co_author_sessions
    WHERE (co_author_sessions.id = co_author_blocks.session_id)
      AND (co_author_sessions.user_id = (select auth.uid()))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM co_author_sessions
    WHERE (co_author_sessions.id = co_author_blocks.session_id)
      AND (co_author_sessions.user_id = (select auth.uid()))
  ));

DROP POLICY IF EXISTS "Users can delete blocks from own sessions" ON public.co_author_blocks;
CREATE POLICY "Users can delete blocks from own sessions" ON public.co_author_blocks
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM co_author_sessions
    WHERE (co_author_sessions.id = co_author_blocks.session_id)
      AND (co_author_sessions.user_id = (select auth.uid()))
  ));

-- ------------------------------------------------------------
-- public.co_author_chat_messages
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view chat messages from own sessions" ON public.co_author_chat_messages;
CREATE POLICY "Users can view chat messages from own sessions" ON public.co_author_chat_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM co_author_sessions
    WHERE (co_author_sessions.id = co_author_chat_messages.session_id)
      AND (co_author_sessions.user_id = (select auth.uid()))
  ));

DROP POLICY IF EXISTS "Users can create chat messages in own sessions" ON public.co_author_chat_messages;
CREATE POLICY "Users can create chat messages in own sessions" ON public.co_author_chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM co_author_sessions
    WHERE (co_author_sessions.id = co_author_chat_messages.session_id)
      AND (co_author_sessions.user_id = (select auth.uid()))
  ));

DROP POLICY IF EXISTS "Users can update chat messages in own sessions" ON public.co_author_chat_messages;
CREATE POLICY "Users can update chat messages in own sessions" ON public.co_author_chat_messages
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM co_author_sessions
    WHERE (co_author_sessions.id = co_author_chat_messages.session_id)
      AND (co_author_sessions.user_id = (select auth.uid()))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM co_author_sessions
    WHERE (co_author_sessions.id = co_author_chat_messages.session_id)
      AND (co_author_sessions.user_id = (select auth.uid()))
  ));

DROP POLICY IF EXISTS "Users can delete chat messages from own sessions" ON public.co_author_chat_messages;
CREATE POLICY "Users can delete chat messages from own sessions" ON public.co_author_chat_messages
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM co_author_sessions
    WHERE (co_author_sessions.id = co_author_chat_messages.session_id)
      AND (co_author_sessions.user_id = (select auth.uid()))
  ));

-- ------------------------------------------------------------
-- public.story_flags
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own story flags" ON public.story_flags;
CREATE POLICY "Users can view own story flags" ON public.story_flags
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM player_profiles
    WHERE (player_profiles.id = story_flags.player_id)
      AND (player_profiles.user_id = (select auth.uid()))
  ));

DROP POLICY IF EXISTS "Users can insert own story flags" ON public.story_flags;
CREATE POLICY "Users can insert own story flags" ON public.story_flags
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM player_profiles
    WHERE (player_profiles.id = story_flags.player_id)
      AND (player_profiles.user_id = (select auth.uid()))
  ));

DROP POLICY IF EXISTS "Users can update own story flags" ON public.story_flags;
CREATE POLICY "Users can update own story flags" ON public.story_flags
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM player_profiles
    WHERE (player_profiles.id = story_flags.player_id)
      AND (player_profiles.user_id = (select auth.uid()))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM player_profiles
    WHERE (player_profiles.id = story_flags.player_id)
      AND (player_profiles.user_id = (select auth.uid()))
  ));

-- ------------------------------------------------------------
-- public.business_metrics
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view business metrics" ON public.business_metrics;
CREATE POLICY "Admins can view business metrics" ON public.business_metrics
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE (user_profiles.id = (select auth.uid()))
      AND (user_profiles.user_role = 'admin'::text)
  ));

-- ------------------------------------------------------------
-- public.user_video_preferences
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can select own video preferences" ON public.user_video_preferences;
CREATE POLICY "Users can select own video preferences" ON public.user_video_preferences
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own video preferences" ON public.user_video_preferences;
CREATE POLICY "Users can insert own video preferences" ON public.user_video_preferences
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own video preferences" ON public.user_video_preferences;
CREATE POLICY "Users can update own video preferences" ON public.user_video_preferences
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.performance_metrics
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view performance metrics" ON public.performance_metrics;
CREATE POLICY "Admins can view performance metrics" ON public.performance_metrics
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE (user_profiles.id = (select auth.uid()))
      AND (user_profiles.user_role = 'admin'::text)
  ));

-- ------------------------------------------------------------
-- public.group_chats
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own group chats" ON public.group_chats;
CREATE POLICY "Users can view own group chats" ON public.group_chats
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own group chats" ON public.group_chats;
CREATE POLICY "Users can create own group chats" ON public.group_chats
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own group chats" ON public.group_chats;
CREATE POLICY "Users can update own group chats" ON public.group_chats
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own group chats" ON public.group_chats;
CREATE POLICY "Users can delete own group chats" ON public.group_chats
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.group_chat_members
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view members of own group chats" ON public.group_chat_members;
CREATE POLICY "Users can view members of own group chats" ON public.group_chat_members
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM group_chats
    WHERE (group_chats.id = group_chat_members.group_chat_id)
      AND (group_chats.user_id = (select auth.uid()))
  ));

DROP POLICY IF EXISTS "Users can add members to own group chats" ON public.group_chat_members;
CREATE POLICY "Users can add members to own group chats" ON public.group_chat_members
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM group_chats
    WHERE (group_chats.id = group_chat_members.group_chat_id)
      AND (group_chats.user_id = (select auth.uid()))
  ));

DROP POLICY IF EXISTS "Users can update members of own group chats" ON public.group_chat_members;
CREATE POLICY "Users can update members of own group chats" ON public.group_chat_members
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM group_chats
    WHERE (group_chats.id = group_chat_members.group_chat_id)
      AND (group_chats.user_id = (select auth.uid()))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM group_chats
    WHERE (group_chats.id = group_chat_members.group_chat_id)
      AND (group_chats.user_id = (select auth.uid()))
  ));

DROP POLICY IF EXISTS "Users can remove members from own group chats" ON public.group_chat_members;
CREATE POLICY "Users can remove members from own group chats" ON public.group_chat_members
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM group_chats
    WHERE (group_chats.id = group_chat_members.group_chat_id)
      AND (group_chats.user_id = (select auth.uid()))
  ));

-- ------------------------------------------------------------
-- public.group_chat_messages
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view messages in own group chats" ON public.group_chat_messages;
CREATE POLICY "Users can view messages in own group chats" ON public.group_chat_messages
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can send messages in own group chats" ON public.group_chat_messages;
CREATE POLICY "Users can send messages in own group chats" ON public.group_chat_messages
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete messages in own group chats" ON public.group_chat_messages;
CREATE POLICY "Users can delete messages in own group chats" ON public.group_chat_messages
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.noir_player_stats
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own stats" ON public.noir_player_stats;
CREATE POLICY "Users can view own stats" ON public.noir_player_stats
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own stats" ON public.noir_player_stats;
CREATE POLICY "Users can update own stats" ON public.noir_player_stats
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own stats" ON public.noir_player_stats;
CREATE POLICY "Users can insert own stats" ON public.noir_player_stats
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.noir_run_history
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own run history" ON public.noir_run_history;
CREATE POLICY "Users can view own run history" ON public.noir_run_history
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own run history" ON public.noir_run_history;
CREATE POLICY "Users can insert own run history" ON public.noir_run_history
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.platformer_sessions
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own platformer sessions" ON public.platformer_sessions;
CREATE POLICY "Users can insert own platformer sessions" ON public.platformer_sessions
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own platformer sessions" ON public.platformer_sessions;
CREATE POLICY "Users can view own platformer sessions" ON public.platformer_sessions
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.noir_conversation_history
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own conversation history" ON public.noir_conversation_history;
CREATE POLICY "Users can view own conversation history" ON public.noir_conversation_history
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own conversation history" ON public.noir_conversation_history;
CREATE POLICY "Users can insert own conversation history" ON public.noir_conversation_history
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.slime_soccer_matches
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own slime soccer matches" ON public.slime_soccer_matches;
CREATE POLICY "Users can insert own slime soccer matches" ON public.slime_soccer_matches
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can read own slime soccer matches" ON public.slime_soccer_matches;
CREATE POLICY "Users can read own slime soccer matches" ON public.slime_soccer_matches
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.video_recommendations
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own video recommendations" ON public.video_recommendations;
CREATE POLICY "Users can view their own video recommendations" ON public.video_recommendations
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own video recommendations" ON public.video_recommendations;
CREATE POLICY "Users can insert their own video recommendations" ON public.video_recommendations
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own video recommendations" ON public.video_recommendations;
CREATE POLICY "Users can update their own video recommendations" ON public.video_recommendations
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own video recommendations" ON public.video_recommendations;
CREATE POLICY "Users can delete their own video recommendations" ON public.video_recommendations
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.noir_player_conversation_state
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own conversation state" ON public.noir_player_conversation_state;
CREATE POLICY "Users can read own conversation state" ON public.noir_player_conversation_state
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own conversation state" ON public.noir_player_conversation_state;
CREATE POLICY "Users can insert own conversation state" ON public.noir_player_conversation_state
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own conversation state" ON public.noir_player_conversation_state;
CREATE POLICY "Users can update own conversation state" ON public.noir_player_conversation_state
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.video_search_history
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own search history" ON public.video_search_history;
CREATE POLICY "Users can read own search history" ON public.video_search_history
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own searches" ON public.video_search_history;
CREATE POLICY "Users can insert own searches" ON public.video_search_history
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.api_performance_logs
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own performance logs" ON public.api_performance_logs;
CREATE POLICY "Users can insert own performance logs" ON public.api_performance_logs
  FOR INSERT TO authenticated
  WITH CHECK (((select auth.uid()) = user_id) OR (user_id IS NULL));

DROP POLICY IF EXISTS "Admins can read all performance logs" ON public.api_performance_logs;
CREATE POLICY "Admins can read all performance logs" ON public.api_performance_logs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE (user_profiles.id = (select auth.uid()))
      AND (user_profiles.user_role = 'admin'::text)
  ));

-- ------------------------------------------------------------
-- public.health_checks
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can read health checks" ON public.health_checks;
CREATE POLICY "Admins can read health checks" ON public.health_checks
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE (user_profiles.id = (select auth.uid()))
      AND (user_profiles.user_role = 'admin'::text)
  ));

DROP POLICY IF EXISTS "Admins can insert health checks" ON public.health_checks;
CREATE POLICY "Admins can insert health checks" ON public.health_checks
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE (user_profiles.id = (select auth.uid()))
      AND (user_profiles.user_role = 'admin'::text)
  ));

-- ------------------------------------------------------------
-- public.user_article_interactions
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own article interactions" ON public.user_article_interactions;
CREATE POLICY "Users can read own article interactions" ON public.user_article_interactions
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own article interactions" ON public.user_article_interactions;
CREATE POLICY "Users can create own article interactions" ON public.user_article_interactions
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own article interactions" ON public.user_article_interactions;
CREATE POLICY "Users can update own article interactions" ON public.user_article_interactions
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.daily_experiences
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own daily experiences" ON public.daily_experiences;
CREATE POLICY "Users can view own daily experiences" ON public.daily_experiences
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own daily experiences" ON public.daily_experiences;
CREATE POLICY "Users can create own daily experiences" ON public.daily_experiences
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own daily experiences" ON public.daily_experiences;
CREATE POLICY "Users can update own daily experiences" ON public.daily_experiences
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own daily experiences" ON public.daily_experiences;
CREATE POLICY "Users can delete own daily experiences" ON public.daily_experiences
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.companion_memory
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own companion memories" ON public.companion_memory;
CREATE POLICY "Users can view own companion memories" ON public.companion_memory
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create own companion memories" ON public.companion_memory;
CREATE POLICY "Users can create own companion memories" ON public.companion_memory
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own companion memories" ON public.companion_memory;
CREATE POLICY "Users can update own companion memories" ON public.companion_memory
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own companion memories" ON public.companion_memory;
CREATE POLICY "Users can delete own companion memories" ON public.companion_memory
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.article_conversations
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own article conversations" ON public.article_conversations;
CREATE POLICY "Users can read own article conversations" ON public.article_conversations
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can create own article conversations" ON public.article_conversations;
CREATE POLICY "Users can create own article conversations" ON public.article_conversations
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own article conversations" ON public.article_conversations;
CREATE POLICY "Users can delete own article conversations" ON public.article_conversations
  FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- ------------------------------------------------------------
-- public.relationship_days
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own relationship days" ON public.relationship_days;
CREATE POLICY "Users can view own relationship days" ON public.relationship_days
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own relationship days" ON public.relationship_days;
CREATE POLICY "Users can insert own relationship days" ON public.relationship_days
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own relationship days" ON public.relationship_days;
CREATE POLICY "Users can update own relationship days" ON public.relationship_days
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.temporal_milestones
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own milestones" ON public.temporal_milestones;
CREATE POLICY "Users can view own milestones" ON public.temporal_milestones
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "System can insert milestones" ON public.temporal_milestones;
CREATE POLICY "System can insert milestones" ON public.temporal_milestones
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own milestone acknowledgment" ON public.temporal_milestones;
CREATE POLICY "Users can update own milestone acknowledgment" ON public.temporal_milestones
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.relationship_stats
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own relationship stats" ON public.relationship_stats;
CREATE POLICY "Users can view own relationship stats" ON public.relationship_stats
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "System can insert relationship stats" ON public.relationship_stats;
CREATE POLICY "System can insert relationship stats" ON public.relationship_stats
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "System can update relationship stats" ON public.relationship_stats;
CREATE POLICY "System can update relationship stats" ON public.relationship_stats
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.alert_events
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can read alert events" ON public.alert_events;
CREATE POLICY "Admins can read alert events" ON public.alert_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE (user_profiles.id = (select auth.uid()))
      AND (user_profiles.user_role = 'admin'::text)
  ));

DROP POLICY IF EXISTS "Admins can insert alert events" ON public.alert_events;
CREATE POLICY "Admins can insert alert events" ON public.alert_events
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE (user_profiles.id = (select auth.uid()))
      AND (user_profiles.user_role = 'admin'::text)
  ));

DROP POLICY IF EXISTS "Admins can update alert events" ON public.alert_events;
CREATE POLICY "Admins can update alert events" ON public.alert_events
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE (user_profiles.id = (select auth.uid()))
      AND (user_profiles.user_role = 'admin'::text)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE (user_profiles.id = (select auth.uid()))
      AND (user_profiles.user_role = 'admin'::text)
  ));

-- ------------------------------------------------------------
-- public.affection_updates
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own affection updates" ON public.affection_updates;
CREATE POLICY "Users can view own affection updates" ON public.affection_updates
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own affection updates" ON public.affection_updates;
CREATE POLICY "Users can insert own affection updates" ON public.affection_updates
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.user_daily_checkins
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own checkins" ON public.user_daily_checkins;
CREATE POLICY "Users can view own checkins" ON public.user_daily_checkins
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own checkins" ON public.user_daily_checkins;
CREATE POLICY "Users can insert own checkins" ON public.user_daily_checkins
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.user_customization
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own customization" ON public.user_customization;
CREATE POLICY "Users can view own customization" ON public.user_customization
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own customization" ON public.user_customization;
CREATE POLICY "Users can insert own customization" ON public.user_customization
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own customization" ON public.user_customization;
CREATE POLICY "Users can update own customization" ON public.user_customization
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.chat_rooms
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can create rooms" ON public.chat_rooms;
CREATE POLICY "Users can create rooms" ON public.chat_rooms
  FOR INSERT TO authenticated
  WITH CHECK ((created_by)::text = ((select auth.uid())::text));

DROP POLICY IF EXISTS "Users can view accessible rooms" ON public.chat_rooms;
CREATE POLICY "Users can view accessible rooms" ON public.chat_rooms
  FOR SELECT TO authenticated
  USING (
    ((created_by)::text = ((select auth.uid())::text))
    OR (EXISTS (
      SELECT 1 FROM chat_participants
      WHERE (chat_participants.room_id = chat_rooms.id)
        AND ((chat_participants.user_id)::text = ((select auth.uid())::text))
    ))
  );

DROP POLICY IF EXISTS "Users can update own rooms" ON public.chat_rooms;
CREATE POLICY "Users can update own rooms" ON public.chat_rooms
  FOR UPDATE TO authenticated
  USING ((created_by)::text = ((select auth.uid())::text))
  WITH CHECK ((created_by)::text = ((select auth.uid())::text));

DROP POLICY IF EXISTS "Users can delete own rooms" ON public.chat_rooms;
CREATE POLICY "Users can delete own rooms" ON public.chat_rooms
  FOR DELETE TO authenticated
  USING ((created_by)::text = ((select auth.uid())::text));

-- ------------------------------------------------------------
-- public.chat_participants
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can join rooms" ON public.chat_participants;
CREATE POLICY "Users can join rooms" ON public.chat_participants
  FOR INSERT TO authenticated
  WITH CHECK ((user_id)::text = ((select auth.uid())::text));

DROP POLICY IF EXISTS "Users can view room participants" ON public.chat_participants;
CREATE POLICY "Users can view room participants" ON public.chat_participants
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM chat_rooms
    WHERE (chat_rooms.id = chat_participants.room_id)
      AND (
        ((chat_rooms.created_by)::text = ((select auth.uid())::text))
        OR (EXISTS (
          SELECT 1 FROM chat_participants cp
          WHERE (cp.room_id = chat_rooms.id)
            AND ((cp.user_id)::text = ((select auth.uid())::text))
        ))
      )
  ));

DROP POLICY IF EXISTS "Users can leave rooms" ON public.chat_participants;
CREATE POLICY "Users can leave rooms" ON public.chat_participants
  FOR DELETE TO authenticated
  USING (
    ((user_id)::text = ((select auth.uid())::text))
    OR (EXISTS (
      SELECT 1 FROM chat_rooms
      WHERE (chat_rooms.id = chat_participants.room_id)
        AND ((chat_rooms.created_by)::text = ((select auth.uid())::text))
    ))
  );

-- ------------------------------------------------------------
-- public.noir_shooter_scores
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own scores" ON public.noir_shooter_scores;
CREATE POLICY "Users can insert own scores" ON public.noir_shooter_scores
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- ------------------------------------------------------------
-- public.retention_cohorts
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view retention cohorts" ON public.retention_cohorts;
CREATE POLICY "Admins can view retention cohorts" ON public.retention_cohorts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE (user_profiles.id = (select auth.uid()))
      AND (user_profiles.user_role = 'admin'::text)
  ));


-- ============================================================
-- PART 3: FIX MUTABLE SEARCH_PATH IN FUNCTIONS
-- ============================================================
-- Note: get_upcoming_events_for_chat has 4 parameters (confirmed from pg_proc)
-- Note: check_rate_limit uses integer for p_window_minutes (not interval)

ALTER FUNCTION public.update_user_events_updated_at() SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_total_chat_days(uuid, uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_memory_moments_updated_at() SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_memory_collections_updated_at() SET search_path = public, pg_catalog;
ALTER FUNCTION public.expire_trials() SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_feature_usage_stats_updated_at() SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_retention_cohorts_updated_at() SET search_path = public, pg_catalog;
ALTER FUNCTION public.initialize_relationship_stats() SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_co_author_updated_at() SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_affection_context(uuid, uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.claim_ron_session(uuid, text) SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_upcoming_events_for_chat(uuid, uuid, integer, integer) SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_event_mention(uuid, uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.can_update_affection_base(uuid, uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.can_update_affection(uuid, uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.check_rate_limit(uuid, text, integer, integer) SET search_path = public, pg_catalog;

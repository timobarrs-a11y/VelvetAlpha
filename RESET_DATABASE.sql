-- ====================================================
-- QUICK DATABASE RESET
-- Copy and paste this into the Supabase SQL Editor
-- ====================================================

-- Delete all data (order matters due to foreign keys)
DELETE FROM video_reactions;
DELETE FROM watched_videos;
DELETE FROM companion_memories;
DELETE FROM conversations;
DELETE FROM companions;
DELETE FROM checkers_moves;
DELETE FROM checkers_games;
DELETE FROM pacman_games;
DELETE FROM money_grab_achievements;
DELETE FROM money_grab_scores;
DELETE FROM money_grab_stats;
DELETE FROM momentum_game_stats;
DELETE FROM momentum_high_scores;
DELETE FROM momentum_career_progress;
DELETE FROM stellar_pursuit_sessions;
DELETE FROM stellar_pursuit_high_scores;
DELETE FROM game_scores;
DELETE FROM activity_sessions;
DELETE FROM study_sessions;
DELETE FROM workout_logs;
DELETE FROM date_scenarios;
DELETE FROM ai_initiated_messages;
DELETE FROM user_engagement_patterns;
DELETE FROM life_events;
DELETE FROM scheduled_callbacks;
DELETE FROM user_tokens;
DELETE FROM user_gifts;
DELETE FROM sleepy_warnings;
DELETE FROM proactive_messages;
DELETE FROM worry_escalations;
DELETE FROM relationship_stats;
DELETE FROM emotional_states;
DELETE FROM mood_history;
DELETE FROM conversation_memories;
DELETE FROM relationship_memories;
DELETE FROM conversation_threads;
DELETE FROM emotional_profile;
DELETE FROM personality_consistency_log;
DELETE FROM user_feedback;
DELETE FROM user_profiles;

-- Also delete from auth.users to fully reset
DELETE FROM auth.users;

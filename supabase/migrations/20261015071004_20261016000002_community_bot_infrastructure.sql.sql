/*
# Community bot infrastructure

1. Purpose
Sets up the database layer for an automated bot system that keeps the community
feeling alive. Two bot personas act as community members:
  - "Maya" (poster bot) — starts conversations by creating posts
  - "Jordan" (responder bot) — replies to posts to build dialogue

Bots are real rows in auth.users + user_profiles so that author_name resolves
correctly in the existing community_post / community_comment queries, and so
their content is labeled via is_ai_generated = true.

2. New Tables
- `community_bot_runs` — append-only log of every bot invocation.
- `community_board_bot_settings` — per-board toggle + frequency config.

3. SECURITY DEFINER Functions
- `bot_create_post(p_board_id, p_author_id, p_title, p_body)` — inserts a
  community_posts row as the bot user, is_ai_generated = true (hardcoded).
- `bot_create_comment(p_post_id, p_author_id, p_body)` — inserts a
  community_comments row as the bot user, is_ai_generated = true (hardcoded).
Both revoke EXECUTE from anon + authenticated — only service role can call.

4. Idempotent — uses ON CONFLICT / IF NOT EXISTS throughout.
*/

-- ============================================================
-- 1. Create bot users in auth.users + user_profiles
-- ============================================================
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, email_change_confirm_status)
VALUES
  ('b0b00000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'maya-bot@community.local', '', now(), now(), now(),
   jsonb_build_object('is_bot', true),
   jsonb_build_object('name', 'Maya'),
   0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, email_change_confirm_status)
VALUES
  ('b0b00000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'jordan-bot@community.local', '', now(), now(), now(),
   jsonb_build_object('is_bot', true),
   jsonb_build_object('name', 'Jordan'),
   0)
ON CONFLICT (id) DO NOTHING;

-- Bot profiles in user_profiles (store personality in user_info jsonb)
INSERT INTO user_profiles (id, name, is_super_user, user_info)
VALUES
  ('b0b00000-0000-0000-0000-000000000001', 'Maya', false,
   jsonb_build_object('is_bot', true, 'bot_role', 'poster',
     'personality', 'You are Maya, a warm, curious community member who loves starting conversations and making people feel welcome.'))
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  user_info = EXCLUDED.user_info;

INSERT INTO user_profiles (id, name, is_super_user, user_info)
VALUES
  ('b0b00000-0000-0000-0000-000000000002', 'Jordan', false,
   jsonb_build_object('is_bot', true, 'bot_role', 'responder',
     'personality', 'You are Jordan, a thoughtful, encouraging community member who responds to posts with empathy and follow-up questions.'))
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  user_info = EXCLUDED.user_info;

-- ============================================================
-- 2. community_bot_runs — durable log of every bot action
-- ============================================================
CREATE TABLE IF NOT EXISTS community_bot_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bot_name text NOT NULL,
  action text NOT NULL CHECK (action IN ('post', 'comment')),
  board_id uuid REFERENCES community_boards(id) ON DELETE SET NULL,
  post_id uuid REFERENCES community_posts(id) ON DELETE SET NULL,
  generated_title text,
  generated_body text,
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'skipped_duplicate', 'skipped_rate_limit', 'skipped_no_board', 'error')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_runs_bot_created
  ON community_bot_runs (bot_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bot_runs_board_action
  ON community_bot_runs (board_id, action, created_at DESC);

ALTER TABLE community_bot_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bot_runs_select_authenticated" ON community_bot_runs;
CREATE POLICY "bot_runs_select_authenticated"
  ON community_bot_runs FOR SELECT
  TO authenticated USING (true);

-- ============================================================
-- 3. community_board_bot_settings — per-board bot config
-- ============================================================
CREATE TABLE IF NOT EXISTS community_board_bot_settings (
  board_id uuid PRIMARY KEY REFERENCES community_boards(id) ON DELETE CASCADE,
  bot_enabled boolean NOT NULL DEFAULT true,
  post_frequency_hours integer NOT NULL DEFAULT 6,
  respond_frequency_hours integer NOT NULL DEFAULT 4,
  last_post_at timestamptz,
  last_respond_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE community_board_bot_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bot_settings_select_authenticated" ON community_board_bot_settings;
CREATE POLICY "bot_settings_select_authenticated"
  ON community_board_bot_settings FOR SELECT
  TO authenticated USING (true);

-- Seed default settings: enable bots on all boards except Welcome & Updates
INSERT INTO community_board_bot_settings (board_id, bot_enabled, post_frequency_hours, respond_frequency_hours)
SELECT b.id, true, 6, 4
FROM community_boards b
WHERE b.id NOT IN ('b0000000-0000-0000-0000-000000000001', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890')
ON CONFLICT (board_id) DO NOTHING;

-- ============================================================
-- 4. SECURITY DEFINER functions for bot content insertion
-- ============================================================
CREATE OR REPLACE FUNCTION bot_create_post(
  p_board_id uuid,
  p_author_id uuid,
  p_title text,
  p_body text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_id uuid;
  v_board_exists boolean;
BEGIN
  IF p_title IS NULL OR btrim(p_title) = '' THEN
    RAISE EXCEPTION 'Title cannot be empty';
  END IF;
  IF p_body IS NULL OR btrim(p_body) = '' THEN
    RAISE EXCEPTION 'Body cannot be empty';
  END IF;
  IF length(p_title) > 300 THEN
    RAISE EXCEPTION 'Title too long (max 300 chars)';
  END IF;
  IF length(p_body) > 5000 THEN
    RAISE EXCEPTION 'Body too long (max 5000 chars)';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM community_boards
    WHERE id = p_board_id AND is_approved = true
  ) INTO v_board_exists;

  IF NOT v_board_exists THEN
    RAISE EXCEPTION 'Board does not exist or is not approved';
  END IF;

  INSERT INTO community_posts (board_id, author_id, title, body, is_ai_generated)
  VALUES (p_board_id, p_author_id, p_title, p_body, true)
  RETURNING id INTO v_post_id;

  RETURN v_post_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION bot_create_post FROM anon;
REVOKE EXECUTE ON FUNCTION bot_create_post FROM authenticated;

CREATE OR REPLACE FUNCTION bot_create_comment(
  p_post_id uuid,
  p_author_id uuid,
  p_body text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comment_id uuid;
  v_post_exists boolean;
  v_post_locked boolean;
BEGIN
  IF p_body IS NULL OR btrim(p_body) = '' THEN
    RAISE EXCEPTION 'Comment body cannot be empty';
  END IF;
  IF length(p_body) > 3000 THEN
    RAISE EXCEPTION 'Comment too long (max 3000 chars)';
  END IF;

  SELECT true, is_locked INTO v_post_exists, v_post_locked
  FROM community_posts WHERE id = p_post_id;

  IF NOT v_post_exists THEN
    RAISE EXCEPTION 'Post does not exist';
  END IF;
  IF v_post_locked THEN
    RAISE EXCEPTION 'Post is locked';
  END IF;

  INSERT INTO community_comments (post_id, author_id, body, is_ai_generated)
  VALUES (p_post_id, p_author_id, p_body, true)
  RETURNING id INTO v_comment_id;

  RETURN v_comment_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION bot_create_comment FROM anon;
REVOKE EXECUTE ON FUNCTION bot_create_comment FROM authenticated;

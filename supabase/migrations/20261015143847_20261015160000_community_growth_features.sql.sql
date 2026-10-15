/*
# Community Growth Features: Notifications, Polls, Badges, Weekly Threads

This migration adds engagement features to the community message board:

1. Notifications — Automatic notifications when someone replies to your post
   or reacts to your content. Drives return visits.
2. Polls — Attach polls to posts for community voting. Increases interaction.
3. Recognition Badges — Computed badges based on participation (first post,
   conversation starter, community helper, etc.). Gamification.
4. Weekly Recurring Threads — Automated weekly thread creation on configured
   boards. Creates recurring engagement.

## New Tables

### community_notifications
- id, user_id (recipient), type (reply|reaction|badge|weekly),
  actor_id (who triggered), target_type (post|comment), target_id,
  post_id (for navigation), read, created_at
- Triggers auto-create notifications on comment/reaction insert

### community_polls
- id, post_id (UNIQUE, FK CASCADE), question, options (text[]),
  expires_at, created_at

### community_poll_votes
- id, poll_id (FK CASCADE), user_id (FK CASCADE), option_index, created_at
- UNIQUE(poll_id, user_id) — one vote per user per poll

### community_weekly_threads
- id, board_id (FK CASCADE), title_pattern, body_pattern,
  day_of_week (0=Sun..6=Sat), is_active, last_run_at, created_at
- UNIQUE(board_id, day_of_week)

## New Functions (all SECURITY DEFINER, search_path = '')

### notify_on_comment() — AFTER INSERT trigger on community_comments
  Creates 'reply' notification for the post author (skips self-reply).

### notify_on_reaction() — AFTER INSERT trigger on community_reactions
  Creates 'reaction' notification for the target's author (skips self-react).

### cleanup_comment_notifications() — BEFORE DELETE trigger on community_comments
  Removes notifications referencing the deleted comment.

### get_unread_notification_count() — RPC
  Returns count of unread notifications for the current authenticated user.

### get_community_badges(p_user_id uuid) — RPC
  Returns JSON array of earned badges based on participation metrics.

### create_weekly_threads() — service-role only
  Creates pinned weekly thread posts for active templates due today.

### get_poll_results(p_poll_id uuid) — RPC
  Returns vote counts per option index for a poll.

## Security
- RLS enabled on all new tables.
- Notifications: user sees/updates/deletes only their own.
  Triggers bypass RLS via SECURITY DEFINER (owned by postgres, BYPASSRLS).
- Polls: visible to all authenticated; only post author can create.
- Poll votes: visible to all; one vote per user (UNIQUE + RLS).
- Weekly threads: visible to all; only admins can manage templates.
- All trigger functions use SECURITY DEFINER with search_path = ''.
*/

-- =============================================================
-- 1. community_notifications
-- =============================================================

CREATE TABLE IF NOT EXISTS public.community_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('reply', 'reaction', 'badge', 'weekly')),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_type text CHECK (target_type IN ('post', 'comment')),
  target_id uuid,
  post_id uuid REFERENCES public.community_posts(id) ON DELETE CASCADE,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.community_notifications (user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.community_notifications (user_id, created_at DESC);

ALTER TABLE public.community_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_notifications REPLICA IDENTITY FULL;

-- =============================================================
-- 2. community_polls + community_poll_votes
-- =============================================================

CREATE TABLE IF NOT EXISTS public.community_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL UNIQUE REFERENCES public.community_posts(id) ON DELETE CASCADE,
  question text NOT NULL,
  options text[] NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.community_polls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  option_index int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_option
  ON public.community_poll_votes (poll_id, option_index);

ALTER TABLE public.community_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_polls REPLICA IDENTITY FULL;
ALTER TABLE public.community_poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_poll_votes REPLICA IDENTITY FULL;

-- =============================================================
-- 3. community_weekly_threads
-- =============================================================

CREATE TABLE IF NOT EXISTS public.community_weekly_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.community_boards(id) ON DELETE CASCADE,
  title_pattern text NOT NULL,
  body_pattern text NOT NULL,
  day_of_week int NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (board_id, day_of_week)
);

ALTER TABLE public.community_weekly_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_weekly_threads REPLICA IDENTITY FULL;

-- =============================================================
-- 4. Notification trigger functions
-- =============================================================

CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_post_author uuid;
BEGIN
  SELECT author_id INTO v_post_author
  FROM public.community_posts WHERE id = NEW.post_id;

  IF v_post_author IS NOT NULL AND v_post_author != NEW.author_id THEN
    INSERT INTO public.community_notifications (user_id, type, actor_id, target_type, target_id, post_id)
    VALUES (v_post_author, 'reply', NEW.author_id, 'comment', NEW.id, NEW.post_id);
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_on_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_target_author uuid;
  v_post_id uuid;
BEGIN
  IF NEW.target_type = 'post' THEN
    SELECT author_id, id INTO v_target_author, v_post_id
    FROM public.community_posts WHERE id = NEW.target_id;
  ELSIF NEW.target_type = 'comment' THEN
    SELECT author_id, post_id INTO v_target_author, v_post_id
    FROM public.community_comments WHERE id = NEW.target_id;
  END IF;

  IF v_target_author IS NOT NULL AND v_target_author != NEW.user_id THEN
    INSERT INTO public.community_notifications (user_id, type, actor_id, target_type, target_id, post_id)
    VALUES (v_target_author, 'reaction', NEW.user_id, NEW.target_type, NEW.target_id, v_post_id);
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_comment_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  DELETE FROM public.community_notifications
  WHERE target_type = 'comment' AND target_id = OLD.id;
  RETURN OLD;
END;
$function$;

-- Triggers (drop first for idempotency)
DROP TRIGGER IF EXISTS trg_notify_on_comment ON public.community_comments;
CREATE TRIGGER trg_notify_on_comment
  AFTER INSERT ON public.community_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

DROP TRIGGER IF EXISTS trg_notify_on_reaction ON public.community_reactions;
CREATE TRIGGER trg_notify_on_reaction
  AFTER INSERT ON public.community_reactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_reaction();

DROP TRIGGER IF EXISTS trg_cleanup_comment_notifications ON public.community_comments;
CREATE TRIGGER trg_cleanup_comment_notifications
  BEFORE DELETE ON public.community_comments
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_comment_notifications();

-- =============================================================
-- 5. Notification helper function
-- =============================================================

CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT COUNT(*)::int FROM public.community_notifications
  WHERE user_id = auth.uid() AND read = false;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_unread_notification_count() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_unread_notification_count() TO authenticated;

-- =============================================================
-- 6. Poll results function
-- =============================================================

CREATE OR REPLACE FUNCTION public.get_poll_results(p_poll_id uuid)
RETURNS TABLE(option_index int, vote_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT option_index, COUNT(*)::bigint AS vote_count
  FROM public.community_poll_votes
  WHERE poll_id = p_poll_id
  GROUP BY option_index
  ORDER BY option_index;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_poll_results(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_poll_results(uuid) TO authenticated;

-- =============================================================
-- 7. Badges function
-- =============================================================

CREATE OR REPLACE FUNCTION public.get_community_badges(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_post_count int;
  v_comment_count int;
  v_reactions_received int;
  v_days_active numeric;
  v_badges json[] := ARRAY[]::json[];
BEGIN
  SELECT COUNT(*) INTO v_post_count
  FROM public.community_posts WHERE author_id = p_user_id;

  SELECT COUNT(*) INTO v_comment_count
  FROM public.community_comments WHERE author_id = p_user_id;

  SELECT COUNT(*) INTO v_reactions_received
  FROM public.community_reactions r
  WHERE (r.target_type = 'post' AND EXISTS (
    SELECT 1 FROM public.community_posts p
    WHERE p.id = r.target_id AND p.author_id = p_user_id
  )) OR (r.target_type = 'comment' AND EXISTS (
    SELECT 1 FROM public.community_comments c
    WHERE c.id = r.target_id AND c.author_id = p_user_id
  ));

  IF v_post_count > 0 THEN
    v_badges := array_append(v_badges, json_build_object(
      'key', 'first_post', 'label', 'First Post',
      'description', 'Published your first post'));
  END IF;

  IF v_post_count >= 5 THEN
    v_badges := array_append(v_badges, json_build_object(
      'key', 'conversation_starter', 'label', 'Conversation Starter',
      'description', 'Created 5+ posts'));
  END IF;

  IF v_comment_count >= 10 THEN
    v_badges := array_append(v_badges, json_build_object(
      'key', 'community_helper', 'label', 'Community Helper',
      'description', 'Made 10+ comments'));
  END IF;

  IF v_reactions_received >= 10 THEN
    v_badges := array_append(v_badges, json_build_object(
      'key', 'rising_star', 'label', 'Rising Star',
      'description', 'Received 10+ reactions'));
  END IF;

  IF v_reactions_received >= 25 THEN
    v_badges := array_append(v_badges, json_build_object(
      'key', 'crowd_favorite', 'label', 'Crowd Favorite',
      'description', 'Received 25+ reactions'));
  END IF;

  IF v_post_count > 0 THEN
    SELECT EXTRACT(EPOCH FROM (now() - MIN(created_at))) / 86400 INTO v_days_active
    FROM public.community_posts WHERE author_id = p_user_id;
    IF v_days_active >= 7 THEN
      v_badges := array_append(v_badges, json_build_object(
        'key', 'regular', 'label', 'Regular',
        'description', 'Active for 7+ days'));
    END IF;
  END IF;

  RETURN COALESCE(json_agg(v), '[]'::json) FROM unnest(v_badges) AS v;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_community_badges(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_community_badges(uuid) TO authenticated;

-- =============================================================
-- 8. Weekly threads function (service-role only)
-- =============================================================

CREATE OR REPLACE FUNCTION public.create_weekly_threads()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  t RECORD;
  v_today date := now()::date;
  v_title text;
  v_body text;
  v_bot_id uuid := 'b0b00000-0000-0000-0000-000000000001'::uuid;
BEGIN
  FOR t IN
    SELECT * FROM public.community_weekly_threads
    WHERE is_active = true AND day_of_week = EXTRACT(DOW FROM now())::int
  LOOP
    IF t.last_run_at IS NOT NULL AND t.last_run_at::date = v_today THEN
      CONTINUE;
    END IF;

    v_title := replace(t.title_pattern, '{date}', to_char(now(), 'Day, Month DD'));
    v_body := replace(t.body_pattern, '{date}', to_char(now(), 'Day, Month DD'));

    INSERT INTO public.community_posts (board_id, author_id, title, body, is_ai_generated, is_pinned)
    VALUES (t.board_id, v_bot_id, v_title, v_body, true, true);

    UPDATE public.community_weekly_threads
    SET last_run_at = now() WHERE id = t.id;
  END LOOP;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_weekly_threads() FROM anon, authenticated, public;

-- =============================================================
-- 9. RLS Policies
-- =============================================================

-- community_notifications: user sees/updates/deletes only their own
DROP POLICY IF EXISTS "select_own_notifications" ON public.community_notifications;
CREATE POLICY "select_own_notifications"
  ON public.community_notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_notifications" ON public.community_notifications;
CREATE POLICY "update_own_notifications"
  ON public.community_notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_notifications" ON public.community_notifications;
CREATE POLICY "delete_own_notifications"
  ON public.community_notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- community_polls: visible to all; only post author can create
DROP POLICY IF EXISTS "select_polls" ON public.community_polls;
CREATE POLICY "select_polls"
  ON public.community_polls FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_polls_post_author" ON public.community_polls;
CREATE POLICY "insert_polls_post_author"
  ON public.community_polls FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.community_posts
            WHERE id = post_id AND author_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_polls_post_author" ON public.community_polls;
CREATE POLICY "delete_polls_post_author"
  ON public.community_polls FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.community_posts
            WHERE id = post_id AND (author_id = auth.uid() OR is_admin()))
  );

-- community_poll_votes: visible to all; users vote once (UNIQUE enforces)
DROP POLICY IF EXISTS "select_poll_votes" ON public.community_poll_votes;
CREATE POLICY "select_poll_votes"
  ON public.community_poll_votes FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_poll_vote" ON public.community_poll_votes;
CREATE POLICY "insert_own_poll_vote"
  ON public.community_poll_votes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_poll_vote" ON public.community_poll_votes;
CREATE POLICY "delete_own_poll_vote"
  ON public.community_poll_votes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- community_weekly_threads: visible to all; admin-managed
DROP POLICY IF EXISTS "select_weekly_threads" ON public.community_weekly_threads;
CREATE POLICY "select_weekly_threads"
  ON public.community_weekly_threads FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_weekly_threads_admin" ON public.community_weekly_threads;
CREATE POLICY "insert_weekly_threads_admin"
  ON public.community_weekly_threads FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "update_weekly_threads_admin" ON public.community_weekly_threads;
CREATE POLICY "update_weekly_threads_admin"
  ON public.community_weekly_threads FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "delete_weekly_threads_admin" ON public.community_weekly_threads;
CREATE POLICY "delete_weekly_threads_admin"
  ON public.community_weekly_threads FOR DELETE
  TO authenticated USING (is_admin());

-- =============================================================
-- 10. Table grants
-- =============================================================

GRANT SELECT, UPDATE, DELETE ON public.community_notifications TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.community_polls TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.community_poll_votes TO authenticated;
GRANT SELECT ON public.community_weekly_threads TO authenticated;

-- =============================================================
-- 11. Seed weekly thread template for Daily Check-In (Mondays)
-- =============================================================

DO $$
DECLARE
  v_board_id uuid;
BEGIN
  SELECT id INTO v_board_id FROM public.community_boards
  WHERE name = 'Daily Check-In' LIMIT 1;
  IF v_board_id IS NOT NULL THEN
    INSERT INTO public.community_weekly_threads (board_id, title_pattern, body_pattern, day_of_week, is_active)
    VALUES (
      v_board_id,
      'Weekly Check-In — Week of {date}',
      E'How was your week?\n\nShare your wins, your challenges, or just say hi. This is our weekly space to check in with each other.',
      1,
      true
    )
    ON CONFLICT (board_id, day_of_week) DO NOTHING;
  END IF;
END $$;
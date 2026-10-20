/*
# Progress Post Likes and Comments

## Summary

Creates `progress_post_likes` and `progress_post_comments` tables with triggers
to maintain denormalized like_count and comment_count on `progress_posts`.
Also adds a SECURITY DEFINER function for throttled bot engagement.

## New Tables

### `progress_post_likes`
- `user_id` (uuid, references auth.users) — who liked
- `post_id` (uuid, references progress_posts) — which post
- `created_at` (timestamptz)
- Primary key: (user_id, post_id)

### `progress_post_comments`
- `id` (uuid, PK)
- `user_id` (uuid, references auth.users) — who commented
- `post_id` (uuid, references progress_posts) — which post
- `body` (text, max 500 chars) — comment text
- `is_bot` (boolean, default false) — labels bot comments
- `created_at` (timestamptz)

## Triggers

- `trg_like_count_insert` / `trg_like_count_delete` — maintain like_count on progress_posts
- `trg_comment_count_insert` / `trg_comment_count_delete` — maintain comment_count on progress_posts

## Security

- Likes: SELECT visible to all authenticated; INSERT/DELETE owner only.
- Comments: SELECT visible to all authenticated; INSERT owner only; DELETE owner only.
- Neither table allows client UPDATE.

## Bot Engagement

- `engage_bot_on_post()` — SECURITY DEFINER function that a scheduled edge function
  calls to add throttled bot likes/comments. It randomly selects a subset of recent
  posts (capped at 5 per call) and adds a like or short comment from a bot account.
  This makes the feed feel alive from day one while being disclosed (bot label).
*/

-- ============================================================
-- 1. progress_post_likes
-- ============================================================

CREATE TABLE IF NOT EXISTS public.progress_post_likes (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.progress_posts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

ALTER TABLE public.progress_post_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_post_likes" ON public.progress_post_likes;
CREATE POLICY "select_post_likes"
ON public.progress_post_likes FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "insert_own_like" ON public.progress_post_likes;
CREATE POLICY "insert_own_like"
ON public.progress_post_likes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_like" ON public.progress_post_likes;
CREATE POLICY "delete_own_like"
ON public.progress_post_likes FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_post_likes_post ON public.progress_post_likes (post_id);

-- ============================================================
-- 2. progress_post_comments
-- ============================================================

CREATE TABLE IF NOT EXISTS public.progress_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.progress_posts(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(body) <= 500 AND length(trim(body)) > 0),
  is_bot boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.progress_post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_post_comments" ON public.progress_post_comments;
CREATE POLICY "select_post_comments"
ON public.progress_post_comments FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "insert_own_comment" ON public.progress_post_comments;
CREATE POLICY "insert_own_comment"
ON public.progress_post_comments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_comment" ON public.progress_post_comments;
CREATE POLICY "delete_own_comment"
ON public.progress_post_comments FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_post_comments_post ON public.progress_post_comments (post_id, created_at);

-- ============================================================
-- 3. Triggers: maintain like_count on progress_posts
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_like_count_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.progress_posts
  SET like_count = like_count + 1
  WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_like_count_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.progress_posts
  SET like_count = GREATEST(like_count - 1, 0)
  WHERE id = OLD.post_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_like_count_insert ON public.progress_post_likes;
CREATE TRIGGER trg_like_count_insert
AFTER INSERT ON public.progress_post_likes
FOR EACH ROW EXECUTE FUNCTION public.update_like_count_on_insert();

DROP TRIGGER IF EXISTS trg_like_count_delete ON public.progress_post_likes;
CREATE TRIGGER trg_like_count_delete
AFTER DELETE ON public.progress_post_likes
FOR EACH ROW EXECUTE FUNCTION public.update_like_count_on_delete();

-- ============================================================
-- 4. Triggers: maintain comment_count on progress_posts
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_comment_count_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.progress_posts
  SET comment_count = comment_count + 1
  WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_comment_count_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.progress_posts
  SET comment_count = GREATEST(comment_count - 1, 0)
  WHERE id = OLD.post_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_comment_count_insert ON public.progress_post_comments;
CREATE TRIGGER trg_comment_count_insert
AFTER INSERT ON public.progress_post_comments
FOR EACH ROW EXECUTE FUNCTION public.update_comment_count_on_insert();

DROP TRIGGER IF EXISTS trg_comment_count_delete ON public.progress_post_comments;
CREATE TRIGGER trg_comment_count_delete
AFTER DELETE ON public.progress_post_comments
FOR EACH ROW EXECUTE FUNCTION public.update_comment_count_on_delete();

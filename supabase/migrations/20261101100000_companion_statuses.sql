/*
# Companion statuses on your own feed

A companion's day already comes with a timeline of short status lines
(`daily_experiences.status_timeline`). This turns those lines into posts on the
owner's feed, so they stay there instead of being a chat message that may not
be seen, and lets the owner comment on them. A companion answers a comment only
when it @-mentions that companion (the rules live in
supabase/functions/_shared/companionStatusRules.ts).

Phase 1: only the owner can see their companions' statuses.

## New tables

### `companion_status_posts`
- One row per posted status line. `experience_id` + `slot` is unique, so syncing
  twice never posts a line twice.
- `visible_at` is when the line's time came, in the member's time zone.

### `companion_status_comments`
- Comments on a status. `author_type` is 'user' (the owner) or 'companion'.
- `mentioned_companion_id` is set when a user's comment @-mentions one of their
  companions; `reply_to` ties a companion's answer to the comment that asked.

## Security

- RLS: the owner can read their own rows. Nobody can write from the client.
  The `companion-status` edge function writes with the service role, after
  checking the caller owns the post, so limits and moderation can't be skipped.
- Rows go when the companion or the member is deleted.
*/

CREATE TABLE IF NOT EXISTS public.companion_status_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL REFERENCES public.companions(id) ON DELETE CASCADE,
  experience_id uuid NOT NULL REFERENCES public.daily_experiences(id) ON DELETE CASCADE,
  slot integer NOT NULL CHECK (slot >= 0),
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 280),
  activity text,
  visible_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (experience_id, slot)
);

CREATE INDEX IF NOT EXISTS idx_companion_status_posts_user_visible
  ON public.companion_status_posts (user_id, visible_at DESC);
CREATE INDEX IF NOT EXISTS idx_companion_status_posts_companion_visible
  ON public.companion_status_posts (companion_id, visible_at DESC);

ALTER TABLE public.companion_status_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_companion_status_posts" ON public.companion_status_posts;
CREATE POLICY "select_own_companion_status_posts"
  ON public.companion_status_posts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON public.companion_status_posts FROM anon, authenticated;
GRANT SELECT ON public.companion_status_posts TO authenticated;

CREATE TABLE IF NOT EXISTS public.companion_status_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.companion_status_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_type text NOT NULL CHECK (author_type IN ('user', 'companion')),
  companion_id uuid REFERENCES public.companions(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  mentioned_companion_id uuid REFERENCES public.companions(id) ON DELETE SET NULL,
  reply_to uuid REFERENCES public.companion_status_comments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- A companion comment names its companion; a member comment doesn't.
  CHECK ((author_type = 'companion') = (companion_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_companion_status_comments_post
  ON public.companion_status_comments (post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_companion_status_comments_user_created
  ON public.companion_status_comments (user_id, author_type, created_at DESC);
-- One answer per mentioning comment, however many times the function is retried.
CREATE UNIQUE INDEX IF NOT EXISTS uq_companion_status_comments_reply_to
  ON public.companion_status_comments (reply_to) WHERE reply_to IS NOT NULL;

ALTER TABLE public.companion_status_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_companion_status_comments" ON public.companion_status_comments;
CREATE POLICY "select_own_companion_status_comments"
  ON public.companion_status_comments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON public.companion_status_comments FROM anon, authenticated;
GRANT SELECT ON public.companion_status_comments TO authenticated;

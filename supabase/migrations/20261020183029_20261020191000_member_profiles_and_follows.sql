/*
# Public Member Profiles

## Summary

Creates the `member_profiles` table for the public social layer. Every member
gets a public profile showing their avatar (generated, never face photos),
display name, headline, bio, and shared goals with progress. Only fields the
user explicitly opts into are public. Nothing from journals, coaching chat,
memories, insights, or location ever appears here.

## New Tables

### `member_profiles`
- `user_id` (uuid, PK, references auth.users) — the member's identity
- `display_name` (text) — public name shown to other members
- `headline` (text, nullable) — one-line tagline
- `bio` (text, nullable) — short bio (max 500 chars)
- `avatar_config` (jsonb, nullable) — generated avatar config (colors, style), never a photo
- `is_public` (boolean, default false) — master switch: profile is visible to others
- `shared_goal_ids` (uuid[], default '{}') — goal IDs the user has opted to share publicly
- `follower_count` (int, default 0) — denormalized count
- `following_count` (int, default 0) — denormalized count
- `discoverable` (boolean, default true) — appears in discovery / Atlas introductions
- `is_bot` (boolean, default false) — labeled as a bot account
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### `member_follows`
- `follower_id` (uuid) — the user who follows
- `followee_id` (uuid) — the user being followed
- `created_at` (timestamptz)
- Primary key: (follower_id, followee_id)
- Check constraint: follower_id != followee_id

## Security

### `member_profiles`
- RLS enabled.
- SELECT: any authenticated user with social access can read public profiles
  (is_public = true). Users can always read their own profile.
- INSERT/UPDATE/DELETE: owner only (auth.uid() = user_id). However, `is_bot`,
  `follower_count`, and `following_count` are NOT client-writable — they're
  managed by server functions and triggers. Column-level GRANT restricts
  which columns the client can UPDATE.

### `member_follows`
- RLS enabled.
- SELECT: any authenticated user can see follows (needed to render follow state).
- INSERT: a user can only create a follow where they are the follower.
- DELETE: a user can only delete a follow where they are the follower.

## Triggers

- `update_follower_counts_on_follow` — after INSERT on `member_follows`,
  increments `follower_count` on the followee and `following_count` on the follower.
- `update_follower_counts_on_unfollow` — after DELETE on `member_follows`,
  decrements the same counts.

## Important Notes

1. A row is auto-created when a user first toggles their profile public. Until
   then, no public profile exists.
2. `avatar_config` stores the same generated avatar config used elsewhere in
   the app — never a photo URL. The UI renders it as a generated avatar.
3. `shared_goal_ids` references `user_goals.id` but is NOT a foreign key
   (goals can be deleted; we just filter out stale IDs at read time).
4. Bot accounts are created by operators setting `is_bot = true` directly in
   the database — there is no client path to become a bot.
*/

-- ============================================================
-- 1. member_profiles table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.member_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Member',
  headline text,
  bio text CHECK (length(bio) <= 500),
  avatar_config jsonb,
  is_public boolean NOT NULL DEFAULT false,
  shared_goal_ids uuid[] NOT NULL DEFAULT '{}',
  follower_count int NOT NULL DEFAULT 0,
  following_count int NOT NULL DEFAULT 0,
  discoverable boolean NOT NULL DEFAULT true,
  is_bot boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.member_profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: read own profile OR public profiles (social access enforced by app gate)
DROP POLICY IF EXISTS "select_own_member_profile" ON public.member_profiles;
CREATE POLICY "select_own_member_profile"
ON public.member_profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_public_member_profiles" ON public.member_profiles;
CREATE POLICY "select_public_member_profiles"
ON public.member_profiles FOR SELECT
TO authenticated
USING (is_public = true);

-- INSERT: owner only
DROP POLICY IF EXISTS "insert_own_member_profile" ON public.member_profiles;
CREATE POLICY "insert_own_member_profile"
ON public.member_profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- UPDATE: owner only, but only on client-writable columns
DROP POLICY IF EXISTS "update_own_member_profile" ON public.member_profiles;
CREATE POLICY "update_own_member_profile"
ON public.member_profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE: owner only
DROP POLICY IF EXISTS "delete_own_member_profile" ON public.member_profiles;
CREATE POLICY "delete_own_member_profile"
ON public.member_profiles FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Column-level: prevent client from writing is_bot, follower_count, following_count
GRANT UPDATE (display_name, headline, bio, avatar_config, is_public, shared_goal_ids, discoverable, updated_at)
ON public.member_profiles TO authenticated;

-- ============================================================
-- 2. member_follows table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.member_follows (
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id != followee_id)
);

ALTER TABLE public.member_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_member_follows" ON public.member_follows;
CREATE POLICY "select_member_follows"
ON public.member_follows FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "insert_own_follow" ON public.member_follows;
CREATE POLICY "insert_own_follow"
ON public.member_follows FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "delete_own_follow" ON public.member_follows;
CREATE POLICY "delete_own_follow"
ON public.member_follows FOR DELETE
TO authenticated
USING (auth.uid() = follower_id);

-- ============================================================
-- 3. Triggers to maintain follower/following counts
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_follow_counts_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.member_profiles
  SET follower_count = follower_count + 1, updated_at = now()
  WHERE user_id = NEW.followee_id;

  UPDATE public.member_profiles
  SET following_count = following_count + 1, updated_at = now()
  WHERE user_id = NEW.follower_id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_follow_counts_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.member_profiles
  SET follower_count = GREATEST(follower_count - 1, 0), updated_at = now()
  WHERE user_id = OLD.followee_id;

  UPDATE public.member_profiles
  SET following_count = GREATEST(following_count - 1, 0), updated_at = now()
  WHERE user_id = OLD.follower_id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_follow_insert ON public.member_follows;
CREATE TRIGGER trg_follow_insert
AFTER INSERT ON public.member_follows
FOR EACH ROW EXECUTE FUNCTION public.update_follow_counts_on_insert();

DROP TRIGGER IF EXISTS trg_follow_delete ON public.member_follows;
CREATE TRIGGER trg_follow_delete
AFTER DELETE ON public.member_follows
FOR EACH ROW EXECUTE FUNCTION public.update_follow_counts_on_delete();

-- Indexes for discovery queries
CREATE INDEX IF NOT EXISTS idx_member_profiles_public_discoverable
ON public.member_profiles (is_public, discoverable)
WHERE is_public = true AND discoverable = true;

CREATE INDEX IF NOT EXISTS idx_member_follows_followee
ON public.member_follows (followee_id);

CREATE INDEX IF NOT EXISTS idx_member_follows_follower
ON public.member_follows (follower_id);

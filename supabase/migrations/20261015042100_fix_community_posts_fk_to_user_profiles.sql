/*
# Fix community posts/comments author FK to user_profiles

## Problem
The community_posts and community_comments tables have a FK on author_id
pointing to auth.users(id), but the frontend query uses a PostgREST
embedded resource join: `user_profiles!community_posts_author_id_fkey(name)`.
PostgREST resolves embedded joins by following named FK constraints.
Since the FK is to auth.users (not user_profiles), the join name
`community_posts_author_id_fkey` maps to auth.users -- and PostgREST
cannot resolve a column `name` on auth.users in the normal schema, so
the query errors out and returns zero posts. The board shows "3 posts"
(from the cached post_count column) but the actual post list is empty.

## Fix
Add a second FK from community_posts.author_id -> user_profiles(id)
and community_comments.author_id -> user_profiles(id). We name these
constraints explicitly so the frontend join string can reference them.
The existing FK to auth.users stays in place (it guards cascading deletes
when a user is deleted from auth).

## Changes
1. community_posts: add FK `community_posts_author_profile_fkey`
   (author_id -> user_profiles(id) ON DELETE CASCADE)
2. community_comments: add FK `community_comments_author_profile_fkey`
   (author_id -> user_profiles(id) ON DELETE CASCADE)

## Security
No RLS changes. No new tables. No data loss.
*/

-- Add FK from community_posts.author_id to user_profiles(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'community_posts_author_profile_fkey'
  ) THEN
    ALTER TABLE community_posts
      ADD CONSTRAINT community_posts_author_profile_fkey
      FOREIGN KEY (author_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add FK from community_comments.author_id to user_profiles(id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'community_comments_author_profile_fkey'
  ) THEN
    ALTER TABLE community_comments
      ADD CONSTRAINT community_comments_author_profile_fkey
      FOREIGN KEY (author_id) REFERENCES user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;
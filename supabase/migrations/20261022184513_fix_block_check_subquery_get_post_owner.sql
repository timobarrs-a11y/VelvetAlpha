/*
# Fix block-check subqueries in likes/comments INSERT policies

## Problem

The INSERT policies on `progress_post_likes` and `progress_post_comments` use a subquery
`SELECT pp.user_id FROM progress_posts WHERE pp.id = post_id` to find the post owner,
then call `users_blocked(auth.uid(), <post_owner>)`. But this subquery is subject to RLS —
the `progress_posts` SELECT policy only allows reading your own posts. So when user B tries
to like user A's post, the subquery returns NULL (B can't see A's post), and
`users_blocked(B, NULL)` returns false (no block found), so the INSERT succeeds.

## Fix

Create a `SECURITY DEFINER` helper function `get_post_owner(p_post_id uuid)` that looks up
the post owner's user_id bypassing RLS. This is safe because:
- It only returns a uuid (the owner's id), not any post content
- It's only used inside RLS policy checks, not exposed as a public RPC
- EXECUTE is revoked from PUBLIC/anon so only the policy engine (running as authenticated) can use it

Then update the INSERT policies to use `public.get_post_owner(post_id)` instead of the
RLS-blocked subquery.

## Changes

1. New function `get_post_owner(uuid) RETURNS uuid` — SECURITY DEFINER, SECURITY DEFINER
2. Revoke EXECUTE from PUBLIC and anon
3. Drop and recreate `insert_own_like` policy using `get_post_owner`
4. Drop and recreate `insert_own_comment` policy using `get_post_owner`
*/

CREATE OR REPLACE FUNCTION public.get_post_owner(p_post_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT pp.user_id FROM public.progress_posts pp WHERE pp.id = p_post_id;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_post_owner(uuid) FROM PUBLIC, anon;

-- Update insert_own_like to use get_post_owner (bypasses RLS on progress_posts)
DROP POLICY IF EXISTS "insert_own_like" ON public.progress_post_likes;
CREATE POLICY "insert_own_like"
ON public.progress_post_likes FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND NOT public.users_blocked(auth.uid(), public.get_post_owner(post_id))
);

-- Update insert_own_comment to use get_post_owner
DROP POLICY IF EXISTS "insert_own_comment" ON public.progress_post_comments;
CREATE POLICY "insert_own_comment"
ON public.progress_post_comments FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND NOT public.users_blocked(auth.uid(), public.get_post_owner(post_id))
);

/*
# Phase 1: one shared definition of "a user's interests"

## Why
The personal questionnaire saves interests across seven user_profiles columns
(hobbies, sports, sports_interests, entertainment_interests, tech_interests,
lifestyle_interests, music_genre). The Discover tab in the messaging overlay
only reads the legacy `interests` column, which the V2 questionnaire never
writes, so discovery cards start empty.

## Changes
1. `user_interest_tags(p_user_id, p_include_signals)`: internal helper that
   merges every interest column into one de-duplicated text[]. The swipe-deck
   answers stored in `sports` ("Gaming night", "Sleep in", ...) are left out
   unless p_include_signals = true, because they are preferences, not tags.
   Not callable from the client (it takes any user id).
2. `get_my_interest_tags()`: client RPC that returns the caller's tags.
3. Backfills empty im_discovery_profiles.interests from the questionnaire.
4. Fixes the "Movies, Music & Pop Culture" board, which the categories
   migration missed because it matched on the wrong name.
5. Approves the 12 boards seeded by migration 20261016000001. The
   set_board_approval_on_insert trigger sets is_approved = false whenever
   auth.uid() is not a super user, and migrations run with no auth.uid(), so
   those boards were saved as unapproved: visible to Tim, hidden from
   everyone else.

Idempotent.
*/

CREATE OR REPLACE FUNCTION public.user_interest_tags(
  p_user_id uuid,
  p_include_signals boolean DEFAULT false
)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH p AS (
    SELECT * FROM public.user_profiles WHERE id = p_user_id
  ),
  raw AS (
    SELECT unnest(hobbies) AS t FROM p
    UNION SELECT unnest(interests) FROM p
    UNION SELECT unnest(sports) FROM p
    UNION SELECT unnest(sports_interests) FROM p
    UNION SELECT unnest(entertainment_interests) FROM p
    UNION SELECT unnest(tech_interests) FROM p
    UNION SELECT unnest(lifestyle_interests) FROM p
    UNION SELECT btrim(unnest(string_to_array(music_genre, ','))) FROM p
  )
  SELECT COALESCE(array_agg(t ORDER BY t), '{}'::text[])
  FROM raw
  WHERE t IS NOT NULL
    AND btrim(t) <> ''
    AND (
      p_include_signals
      OR t <> ALL (ARRAY[
        'Gaming night', 'Sunrise hike', 'Cook at home', 'Try a new restaurant',
        'Road trip', 'Stay in & recharge', 'Live at the game', 'On the couch',
        'Dive bar', 'Rooftop spot', 'Gym at 6am', 'Sleep in'
      ])
    );
$$;

REVOKE EXECUTE ON FUNCTION public.user_interest_tags(uuid, boolean) FROM anon, authenticated, public;

CREATE OR REPLACE FUNCTION public.get_my_interest_tags()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_interest_tags(auth.uid(), false);
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_interest_tags() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_my_interest_tags() TO authenticated;

-- Backfill discovery cards that were created empty.
UPDATE public.im_discovery_profiles d
SET interests = public.user_interest_tags(d.user_id, false)
WHERE COALESCE(array_length(d.interests, 1), 0) = 0;

-- Category typo fix.
UPDATE public.community_boards
SET category = 'Interests & Hobbies'
WHERE id = 'b0000000-0000-0000-0000-000000000013';

-- Approve the official seeded boards (owned by Tim).
UPDATE public.community_boards
SET is_approved = true
WHERE is_approved = false
  AND owner_id = '3a195a32-ee68-4164-9bd5-40499627a378'
  AND id IN (
    'b0000000-0000-0000-0000-000000000007', 'b0000000-0000-0000-0000-000000000008',
    'b0000000-0000-0000-0000-000000000009', 'b0000000-0000-0000-0000-000000000010',
    'b0000000-0000-0000-0000-000000000011', 'b0000000-0000-0000-0000-000000000012',
    'b0000000-0000-0000-0000-000000000013', 'b0000000-0000-0000-0000-000000000014',
    'b0000000-0000-0000-0000-000000000015', 'b0000000-0000-0000-0000-000000000016',
    'b0000000-0000-0000-0000-000000000017', 'b0000000-0000-0000-0000-000000000018'
  );

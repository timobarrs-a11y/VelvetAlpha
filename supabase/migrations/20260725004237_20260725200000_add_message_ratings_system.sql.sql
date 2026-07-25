/*
# Message Ratings (Like/Dislike) System for Regression Protection

1. Purpose
   - Lets every user rate each AI response with a thumbs-up or thumbs-down.
   - On dislike, the user can type a natural-language reason ("too much 'baby'",
     "felt robotic", etc.) so the owner can spot persona regressions.
   - Feeds the admin "Response Quality" review view with disliked responses,
     dislike-rate trends per companion, and top problem responses.

2. New Tables
   - `message_ratings`
     - `id` uuid PK
     - `message_id` uuid NOT NULL — the conversations row being rated
     - `conversation_id` uuid NOT NULL — denormalized for faster queries
     - `companion_id` uuid NOT NULL — denormalized for grouping by persona
     - `user_id` uuid NOT NULL DEFAULT auth.uid() — who rated it
     - `rating` text NOT NULL — 'like' | 'dislike'
     - `reason` text — optional natural-language feedback (set on dislike)
     - `regenerated` boolean DEFAULT false — true if user clicked "try again"
     - `created_at` timestamptz DEFAULT now()
     - `updated_at` timestamptz DEFAULT now()
   - UNIQUE constraint on (message_id, user_id) so each user can rate a
     given message once; re-rating updates the existing row.

3. Indexes
   - `idx_message_ratings_companion` on companion_id (admin grouping/trends)
   - `idx_message_ratings_user` on user_id (user's own ratings)
   - `idx_message_ratings_rating` on rating (filter dislikes fast)
   - `idx_message_ratings_created_at` on created_at (time-series trends)

4. Security (RLS)
   - RLS enabled on message_ratings.
   - Authenticated users can INSERT/UPDATE/SELECT/DELETE only their own
     ratings (ownership via auth.uid() = user_id).
   - Admins (is_super_user = true OR user_role = 'admin') can SELECT all
     ratings for the review view — no INSERT/UPDATE/DELETE on others' rows.
   - Anon role has NO access (this is authenticated-only data).

5. Important Notes
   - One rating per user per message (unique constraint). Changing a like
     to a dislike updates the row in place rather than creating a duplicate.
   - The `reason` column is intentionally freeform text so users can describe
     problems in their own words.
   - No data is copied from the conversations table; message_ratings only
     references the message_id and stores denormalized companion_id for
     fast admin queries without joins.
   - Safe to re-run: uses IF NOT EXISTS, DROP POLICY IF EXISTS.
*/

CREATE TABLE IF NOT EXISTS message_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  companion_id uuid NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  rating text NOT NULL CHECK (rating IN ('like', 'dislike')),
  reason text,
  regenerated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_ratings_companion ON message_ratings(companion_id);
CREATE INDEX IF NOT EXISTS idx_message_ratings_user ON message_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_message_ratings_rating ON message_ratings(rating);
CREATE INDEX IF NOT EXISTS idx_message_ratings_created_at ON message_ratings(created_at);

ALTER TABLE message_ratings ENABLE ROW LEVEL SECURITY;

-- Users can read their own ratings
DROP POLICY IF EXISTS "select_own_ratings" ON message_ratings;
CREATE POLICY "select_own_ratings"
  ON message_ratings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own ratings
DROP POLICY IF EXISTS "insert_own_ratings" ON message_ratings;
CREATE POLICY "insert_own_ratings"
  ON message_ratings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own ratings (e.g. change like to dislike, add reason)
DROP POLICY IF EXISTS "update_own_ratings" ON message_ratings;
CREATE POLICY "update_own_ratings"
  ON message_ratings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own ratings
DROP POLICY IF EXISTS "delete_own_ratings" ON message_ratings;
CREATE POLICY "delete_own_ratings"
  ON message_ratings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins (super user or admin role) can read ALL ratings for the review view
DROP POLICY IF EXISTS "admin_select_all_ratings" ON message_ratings;
CREATE POLICY "admin_select_all_ratings"
  ON message_ratings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (user_profiles.is_super_user = true OR user_profiles.user_role = 'admin')
    )
  );
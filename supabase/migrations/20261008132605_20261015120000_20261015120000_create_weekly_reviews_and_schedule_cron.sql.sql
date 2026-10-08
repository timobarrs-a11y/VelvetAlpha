/*
# Create weekly_reviews table and schedule weekly review cron job

## Purpose
Adds a `weekly_reviews` table to store AI-generated weekly coaching summaries
and schedules a cron job that runs every Sunday at 5pm UTC to generate reviews
for all users with coaching activity that week.

## New Table: weekly_reviews
- `id` (uuid, PK)
- `user_id` (uuid, NOT NULL, references auth.users, ON DELETE CASCADE)
- `companion_id` (uuid, nullable, references companions, ON DELETE SET NULL) — the coach whose perspective the review is from
- `week_starting` (date, NOT NULL) — the Sunday date that starts the review week
- `review_text` (text, NOT NULL) — the AI-generated review message
- `stats` (jsonb) — structured stats: commitments_kept, commitments_missed, etc.
- `read_at` (timestamptz, nullable) — when the user opened/read the review
- `created_at` (timestamptz, NOT NULL, default now())

## Security
- RLS enabled with owner-scoped CRUD (4 policies: select/insert/update/delete)
- `user_id` defaults to `auth.uid()`
- Unique constraint on (user_id, week_starting) to prevent duplicate reviews

## Cron Job
- `generate-weekly-review`: runs at 5pm UTC every Sunday ('0 17 * * 0')
- Calls the edge function which gathers each user's weekly commitments,
  goals, and session summaries, generates a review via Anthropic, and stores it

## Important Notes
- The cron job uses the hardcoded project URL (matching existing cron pattern)
- No auth header needed (matching existing coaching cron pattern)
- The edge function is verify_jwt=false since it's cron-triggered
*/

CREATE TABLE IF NOT EXISTS weekly_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id uuid REFERENCES companions(id) ON DELETE SET NULL,
  week_starting date NOT NULL,
  review_text text NOT NULL,
  stats jsonb DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE weekly_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_reviews" ON weekly_reviews;
CREATE POLICY "select_own_reviews" ON weekly_reviews FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_reviews" ON weekly_reviews;
CREATE POLICY "insert_own_reviews" ON weekly_reviews FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_reviews" ON weekly_reviews;
CREATE POLICY "update_own_reviews" ON weekly_reviews FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_reviews" ON weekly_reviews;
CREATE POLICY "delete_own_reviews" ON weekly_reviews FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_reviews_user_week ON weekly_reviews(user_id, week_starting);
CREATE INDEX IF NOT EXISTS idx_weekly_reviews_user_created ON weekly_reviews(user_id, created_at DESC);

-- Schedule the weekly review cron job (Sundays at 5pm UTC)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'generate-weekly-review') THEN
    PERFORM cron.unschedule('generate-weekly-review');
  END IF;

  PERFORM cron.schedule(
    'generate-weekly-review',
    '0 17 * * 0',
    $cron$
      SELECT net.http_post(
        url := 'https://lcygiskxwxomytglkwnt.supabase.co/functions/v1/generate-weekly-review',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := '{}'::jsonb
      );
    $cron$
  );
END $$;

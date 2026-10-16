/*
# Create Velvet House save history table

1. New Tables
- `velvet_house_save_history` — stores the last 10 save snapshots per (user, companion)
  so a bad migration or accidental overwrite is recoverable.
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, defaults to auth.uid(), references auth.users ON DELETE CASCADE)
  - `companion_id` (uuid, not null, references companions ON DELETE CASCADE)
  - `save_data` (jsonb, not null) — the full game state blob at that point in time
  - `day` (int, not null, default 0) — the in-game day number, used to compare progress
  - `saved_at` (timestamptz, default now())

2. How it works
- Each time a cloud save is written, a copy of the previous blob is inserted here.
- A trigger keeps only the 10 most recent rows per (user_id, companion_id).
- The host can query this table to find a more-advanced save if a rollback
  accidentally clobbered the main row.

3. Security
- Enable RLS on `velvet_house_save_history`.
- Owner-scoped CRUD: each authenticated user can only read/insert their own history rows.
- DELETE is allowed so the cleanup trigger can prune old rows.
*/

CREATE TABLE IF NOT EXISTS velvet_house_save_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
  save_data jsonb NOT NULL,
  day int NOT NULL DEFAULT 0,
  saved_at timestamptz DEFAULT now()
);

ALTER TABLE velvet_house_save_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_save_history" ON velvet_house_save_history;
CREATE POLICY "select_own_save_history" ON velvet_house_save_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_save_history" ON velvet_house_save_history;
CREATE POLICY "insert_own_save_history" ON velvet_house_save_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_save_history" ON velvet_house_save_history;
CREATE POLICY "delete_own_save_history" ON velvet_house_save_history
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_save_history_user_companion
  ON velvet_house_save_history(user_id, companion_id, saved_at DESC);

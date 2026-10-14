/*
# Create Velvet House save system

1. New Tables
- `velvet_house_saves` — stores a single save slot per (user, companion) for the Velvet House game.
  - `id` (uuid, primary key)
  - `user_id` (uuid, not null, defaults to auth.uid(), references auth.users ON DELETE CASCADE)
  - `companion_id` (uuid, not null, references companions ON DELETE CASCADE)
  - `save_data` (jsonb, not null, default '{}') — the full game state blob produced by the game's snapshot() function
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())
  - Unique constraint on (user_id, companion_id) so each user has one save per companion.

2. Security
- Enable RLS on `velvet_house_saves`.
- Owner-scoped CRUD: each authenticated user can only read/insert/update/delete their own save rows.
- Four separate policies (select/insert/update/delete), scoped to `TO authenticated` with `auth.uid() = user_id`.
*/

CREATE TABLE IF NOT EXISTS velvet_house_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL REFERENCES companions(id) ON DELETE CASCADE,
  save_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT velvet_house_saves_user_companion_unique UNIQUE (user_id, companion_id)
);

ALTER TABLE velvet_house_saves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_velvet_house_saves" ON velvet_house_saves;
CREATE POLICY "select_own_velvet_house_saves" ON velvet_house_saves
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_velvet_house_saves" ON velvet_house_saves;
CREATE POLICY "insert_own_velvet_house_saves" ON velvet_house_saves
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_velvet_house_saves" ON velvet_house_saves;
CREATE POLICY "update_own_velvet_house_saves" ON velvet_house_saves
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_velvet_house_saves" ON velvet_house_saves;
CREATE POLICY "delete_own_velvet_house_saves" ON velvet_house_saves
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_velvet_house_saves_user ON velvet_house_saves(user_id);
CREATE INDEX IF NOT EXISTS idx_velvet_house_saves_companion ON velvet_house_saves(companion_id);

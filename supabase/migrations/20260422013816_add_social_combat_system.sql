/*
  # Social Combat RPG persistence

  Adds cross-run memory so the Social Combat RPG can track player history,
  unlocked scenarios, and per-opponent rapport between runs.

  1. New Tables
    - `social_combat_runs`
      - `id` (uuid, PK)
      - `user_id` (uuid, FK auth.users)
      - `mode` (text: 'tutorial' | 'single' | 'ascent')
      - `scenario_id` (text, nullable — for single/ascent entry)
      - `outcome` (text: 'win' | 'loss' | 'abandoned' | 'ending_a' | 'ending_b' | 'ending_c')
      - `turns` (int, default 0)
      - `max_combo` (int, default 0)
      - `score` (int, default 0)
      - `notes` (jsonb, default '{}') — flexible per-run metadata (choices, moments)
      - `created_at` (timestamptz, default now())
    - `social_combat_memory`
      - `id` (uuid, PK)
      - `user_id` (uuid, FK auth.users)
      - `opponent_id` (text) — scenario opponent key
      - `rapport` (int, default 0) — persistent per-opponent relationship score
      - `times_faced` (int, default 0)
      - `times_defeated` (int, default 0)
      - `endings_seen` (text[], default '{}')
      - `last_seen_at` (timestamptz, default now())
      - Unique on (user_id, opponent_id)
    - `social_combat_unlocks`
      - `id` (uuid, PK)
      - `user_id` (uuid, FK auth.users)
      - `unlock_key` (text) — e.g. 'scenario:mentor' or 'response:empathy_advanced'
      - `unlocked_at` (timestamptz, default now())
      - Unique on (user_id, unlock_key)

  2. Security
    - Enable RLS on all three tables.
    - Users can SELECT / INSERT / UPDATE / DELETE only their own rows.
*/

CREATE TABLE IF NOT EXISTS social_combat_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'single',
  scenario_id text,
  outcome text NOT NULL DEFAULT 'abandoned',
  turns int NOT NULL DEFAULT 0,
  max_combo int NOT NULL DEFAULT 0,
  score int NOT NULL DEFAULT 0,
  notes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_combat_runs_user ON social_combat_runs(user_id, created_at DESC);

ALTER TABLE social_combat_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own combat runs"
  ON social_combat_runs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own combat runs"
  ON social_combat_runs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own combat runs"
  ON social_combat_runs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own combat runs"
  ON social_combat_runs FOR DELETE TO authenticated
  USING (auth.uid() = user_id);


CREATE TABLE IF NOT EXISTS social_combat_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opponent_id text NOT NULL,
  rapport int NOT NULL DEFAULT 0,
  times_faced int NOT NULL DEFAULT 0,
  times_defeated int NOT NULL DEFAULT 0,
  endings_seen text[] NOT NULL DEFAULT '{}',
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, opponent_id)
);

CREATE INDEX IF NOT EXISTS idx_social_combat_memory_user ON social_combat_memory(user_id);

ALTER TABLE social_combat_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own combat memory"
  ON social_combat_memory FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own combat memory"
  ON social_combat_memory FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own combat memory"
  ON social_combat_memory FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own combat memory"
  ON social_combat_memory FOR DELETE TO authenticated
  USING (auth.uid() = user_id);


CREATE TABLE IF NOT EXISTS social_combat_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unlock_key text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, unlock_key)
);

CREATE INDEX IF NOT EXISTS idx_social_combat_unlocks_user ON social_combat_unlocks(user_id);

ALTER TABLE social_combat_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own combat unlocks"
  ON social_combat_unlocks FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own combat unlocks"
  ON social_combat_unlocks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own combat unlocks"
  ON social_combat_unlocks FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

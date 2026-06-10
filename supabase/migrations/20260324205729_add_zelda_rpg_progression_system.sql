/*
  # Zelda RPG Progression System

  Adds full RPG persistence layer on top of the existing ocean game tables.

  ## New Tables

  ### `zelda_rpg_saves`
  - Per-user persistent RPG save file
  - Tracks rupee wallet, health, max health, equipment, discovered islands
  - Active quest tracking

  ### `zelda_island_progress`
  - Per-user, per-island completion state
  - Tracks whether dungeon has been cleared, which chests opened, which NPCs spoken to
  - Records number of attempts

  ### `zelda_dungeon_runs`
  - Individual dungeon attempt records
  - Score, enemies defeated, time taken, completion status
  - Used for leaderboard and analytics

  ### `zelda_quest_log`
  - Per-user quest state
  - Quest ID references a static quest definition in the frontend
  - Tracks active/completed status and progress counter

  ## Security
  - RLS enabled on all tables
  - Users can only read/write their own data
*/

-- RPG save file: one row per user
CREATE TABLE IF NOT EXISTS zelda_rpg_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rupee_wallet integer NOT NULL DEFAULT 0,
  max_health integer NOT NULL DEFAULT 6,
  current_health integer NOT NULL DEFAULT 6,
  has_sword boolean NOT NULL DEFAULT false,
  has_shield boolean NOT NULL DEFAULT false,
  has_hookshot boolean NOT NULL DEFAULT false,
  has_bow boolean NOT NULL DEFAULT false,
  discovered_islands text[] NOT NULL DEFAULT '{}',
  total_enemies_defeated integer NOT NULL DEFAULT 0,
  total_dungeons_cleared integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE zelda_rpg_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own rpg save"
  ON zelda_rpg_saves FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rpg save"
  ON zelda_rpg_saves FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rpg save"
  ON zelda_rpg_saves FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Per-island progress
CREATE TABLE IF NOT EXISTS zelda_island_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  island_id text NOT NULL,
  dungeon_cleared boolean NOT NULL DEFAULT false,
  chests_opened text[] NOT NULL DEFAULT '{}',
  npcs_met text[] NOT NULL DEFAULT '{}',
  dungeon_attempts integer NOT NULL DEFAULT 0,
  first_visited_at timestamptz,
  cleared_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, island_id)
);

ALTER TABLE zelda_island_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own island progress"
  ON zelda_island_progress FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own island progress"
  ON zelda_island_progress FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own island progress"
  ON zelda_island_progress FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Dungeon run records
CREATE TABLE IF NOT EXISTS zelda_dungeon_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  island_id text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  enemies_defeated integer NOT NULL DEFAULT 0,
  chests_opened integer NOT NULL DEFAULT 0,
  damage_taken integer NOT NULL DEFAULT 0,
  time_seconds integer NOT NULL DEFAULT 0,
  rupees_found integer NOT NULL DEFAULT 0,
  item_found text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE zelda_dungeon_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own dungeon runs"
  ON zelda_dungeon_runs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dungeon runs"
  ON zelda_dungeon_runs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Quest log
CREATE TABLE IF NOT EXISTS zelda_quest_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quest_id text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed')),
  progress integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(user_id, quest_id)
);

ALTER TABLE zelda_quest_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own quest log"
  ON zelda_quest_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quest log"
  ON zelda_quest_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quest log"
  ON zelda_quest_log FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_zelda_rpg_saves_user ON zelda_rpg_saves(user_id);
CREATE INDEX IF NOT EXISTS idx_zelda_island_progress_user ON zelda_island_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_zelda_island_progress_island ON zelda_island_progress(island_id);
CREATE INDEX IF NOT EXISTS idx_zelda_dungeon_runs_user ON zelda_dungeon_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_zelda_quest_log_user ON zelda_quest_log(user_id);

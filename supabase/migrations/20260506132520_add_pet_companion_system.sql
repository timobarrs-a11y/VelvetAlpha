/*
  # Pet Companion System

  ## Summary
  Creates the persistence layer for the Velvet Pet Companion meta-game feature.
  Each user gets one pet per companion. Stats are debounced-saved every 5 seconds
  from the physics engine's onStats callback.

  ## New Tables
  - `pet_state`
    - `user_id` (uuid, FK auth.users) — part of composite PK
    - `companion_id` (uuid, FK companions) — part of composite PK
    - `pet_name` (text) — player-chosen pet name, default 'Mochi'
    - `animal_type` (text) — 'cat' | 'bunny', default 'cat'
    - `hunger` (float) — 0-100, default 82
    - `mood` (float) — 0-100, default 78
    - `clean` (float) — 0-100, default 90
    - `xp` (float) — cumulative XP, default 0
    - `level` (int) — 1-10, default 1
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - Users can only read/write their own pet state
*/

CREATE TABLE IF NOT EXISTS pet_state (
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL,
  pet_name     text NOT NULL DEFAULT 'Mochi',
  animal_type  text NOT NULL DEFAULT 'cat' CHECK (animal_type IN ('cat', 'bunny')),
  hunger       float NOT NULL DEFAULT 82 CHECK (hunger >= 0 AND hunger <= 100),
  mood         float NOT NULL DEFAULT 78  CHECK (mood   >= 0 AND mood   <= 100),
  clean        float NOT NULL DEFAULT 90  CHECK (clean  >= 0 AND clean  <= 100),
  xp           float NOT NULL DEFAULT 0   CHECK (xp     >= 0),
  level        int   NOT NULL DEFAULT 1   CHECK (level  >= 1 AND level  <= 10),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, companion_id)
);

CREATE INDEX IF NOT EXISTS pet_state_user_id_idx ON pet_state (user_id);
CREATE INDEX IF NOT EXISTS pet_state_companion_id_idx ON pet_state (companion_id);

ALTER TABLE pet_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own pet state"
  ON pet_state FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pet state"
  ON pet_state FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pet state"
  ON pet_state FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

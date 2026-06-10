/*
  # Add Reflection Atoms Table

  ## Summary
  Creates the `reflection_atoms` table to persist structured CBT reflection data per user.

  ## New Tables
  - `reflection_atoms`
    - `id` (uuid, primary key)
    - `user_id` (uuid, FK to auth.users, required)
    - `timestamp` (bigint) — JS timestamp in milliseconds
    - `situation` (text) — what happened
    - `automatic_thought` (text) — what went through their mind
    - `emotion` (text) — named emotion
    - `emotion_intensity` (int) — 1-10 scale
    - `body_signal` (text) — where they felt it physically
    - `behavior` (text) — what they did next
    - `outcome` (text) — how it turned out
    - `tags` (text[]) — domain tags: work, relationship, health, identity etc
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Users can only SELECT, INSERT, UPDATE, DELETE their own rows

  ## Notes
  - No companion scoping — atoms belong to the user globally
  - `timestamp` is stored as bigint (JS Date.now()) for consistency with the ReflectionAtom interface
*/

CREATE TABLE IF NOT EXISTS reflection_atoms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  timestamp bigint NOT NULL DEFAULT extract(epoch from now()) * 1000,
  situation text,
  automatic_thought text,
  emotion text,
  emotion_intensity int CHECK (emotion_intensity >= 1 AND emotion_intensity <= 10),
  body_signal text,
  behavior text,
  outcome text,
  tags text[] DEFAULT ARRAY[]::text[],
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reflection_atoms_user_id ON reflection_atoms(user_id);
CREATE INDEX IF NOT EXISTS idx_reflection_atoms_timestamp ON reflection_atoms(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_reflection_atoms_emotion ON reflection_atoms(emotion);

ALTER TABLE reflection_atoms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reflection atoms"
  ON reflection_atoms
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reflection atoms"
  ON reflection_atoms
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reflection atoms"
  ON reflection_atoms
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reflection atoms"
  ON reflection_atoms
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- AI Experts System
-- Adds user-authored experts table and expert columns to companions

-- 1. User-authored experts table
CREATE TABLE IF NOT EXISTS user_experts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  domain text NOT NULL,
  category text NOT NULL DEFAULT 'lifestyle',
  description text DEFAULT '',
  instruction text NOT NULL,
  goal_types text[] DEFAULT '{}',
  check_in_style text DEFAULT 'responsive',
  accountability_level text DEFAULT 'moderate',
  sample_interaction text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE user_experts ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies (one per CRUD verb)
CREATE POLICY "select_own_experts" ON user_experts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_own_experts" ON user_experts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_experts" ON user_experts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_experts" ON user_experts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- 4. Indexes
CREATE INDEX idx_user_experts_user_id ON user_experts(user_id);
CREATE INDEX idx_user_experts_category ON user_experts(category);

-- 5. Add expert columns to companions table
ALTER TABLE companions
  ADD COLUMN IF NOT EXISTS signature_expert text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS signature_expert_source text DEFAULT NULL;

-- 6. Index on companions for expert lookups
CREATE INDEX IF NOT EXISTS idx_companions_signature_expert ON companions(signature_expert)
  WHERE signature_expert IS NOT NULL;

-- 7. Update relationship_type constraint to allow 'mentor'
-- First drop old constraint if exists, then add new one
DO $$
BEGIN
  -- Try to drop existing constraint (may not exist)
  BEGIN
    ALTER TABLE companions DROP CONSTRAINT IF EXISTS companions_relationship_type_check;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- Allow mentor as a valid relationship type
ALTER TABLE companions
  ADD CONSTRAINT companions_relationship_type_check
  CHECK (relationship_type IN ('friend', 'romantic', 'mentor'));

/*
# Coach Plans, Plan Steps, and Resource Cache

## Purpose
Adds the structured plan layer for coaches (Phase 1) and a resource caching
layer for the resource finder (Phase 2).

1. coach_plans — a named plan owned by a coach (companion), e.g. "Spanish 1 — Week 2"
2. coach_plan_steps — ordered steps within a plan, each linked to an optional commitment
3. resource_cache — cached search results (YouTube/web) keyed by topic, so we don't re-search every chat

## New Tables

### coach_plans
- id (uuid, PK)
- user_id (uuid, NOT NULL, DEFAULT auth.uid(), references auth.users ON DELETE CASCADE)
- companion_id (uuid, nullable, references companions ON DELETE SET NULL) — the coach who owns this plan
- title (text, NOT NULL)
- description (text, nullable)
- status (text, NOT NULL DEFAULT 'active') — active / completed / paused
- cadence (text, nullable) — e.g. "daily", "3x/week", "weekly"
- created_at (timestamptz, DEFAULT now())
- updated_at (timestamptz, DEFAULT now())

### coach_plan_steps
- id (uuid, PK)
- plan_id (uuid, NOT NULL, references coach_plans ON DELETE CASCADE)
- commitment_id (uuid, nullable, references coaching_commitments ON DELETE SET NULL)
- title (text, NOT NULL)
- description (text, nullable)
- order_index (integer, NOT NULL DEFAULT 0)
- status (text, NOT NULL DEFAULT 'pending') — pending / in_progress / completed / skipped
- resource_url (text, nullable) — optional link to a cached resource
- resource_note (text, nullable) — coach annotation: "why this, what to watch for"
- completed_at (timestamptz, nullable)
- created_at (timestamptz, DEFAULT now())
- updated_at (timestamptz, DEFAULT now())

### resource_cache
- id (uuid, PK)
- cache_key (text, NOT NULL) — lowercase topic + filter, e.g. "spanish:present-tense-drills"
- source (text, NOT NULL DEFAULT 'youtube') — youtube / web
- query (text, NOT NULL) — the original search query
- results (jsonb, NOT NULL) — array of result objects (id, title, channel, thumbnail, url, duration)
- created_at (timestamptz, DEFAULT now())
- expires_at (timestamptz, NOT NULL) — TTL for cache validity

## Security
- RLS enabled on all three tables.
- coach_plans and coach_plan_steps: owner-scoped CRUD via auth.uid() = user_id.
  For coach_plan_steps, ownership is checked through the parent plan.
- resource_cache: owner-scoped CRUD (each user has their own cache entries).

## Notes
- coach_plans.companion_id is nullable so plans can exist without a coach (user-created).
- coach_plan_steps.commitment_id links to coaching_commitments, so completing a step
  can update the linked commitment if desired.
- resource_cache has a UNIQUE constraint on (user_id, cache_key) so re-searching
  the same topic upserts rather than duplicates.
*/

-- =====================================================
-- 1. coach_plans table
-- =====================================================
CREATE TABLE IF NOT EXISTS coach_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id uuid REFERENCES companions(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active',
  cadence text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coach_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_plans" ON coach_plans;
CREATE POLICY "select_own_plans" ON coach_plans FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_plans" ON coach_plans;
CREATE POLICY "insert_own_plans" ON coach_plans FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_plans" ON coach_plans;
CREATE POLICY "update_own_plans" ON coach_plans FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_plans" ON coach_plans;
CREATE POLICY "delete_own_plans" ON coach_plans FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_plans_user_companion ON coach_plans(user_id, companion_id);
CREATE INDEX IF NOT EXISTS idx_plans_user_status ON coach_plans(user_id, status);

-- =====================================================
-- 2. coach_plan_steps table
-- =====================================================
CREATE TABLE IF NOT EXISTS coach_plan_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES coach_plans(id) ON DELETE CASCADE,
  commitment_id uuid REFERENCES coaching_commitments(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  resource_url text,
  resource_note text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coach_plan_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_plan_steps" ON coach_plan_steps;
CREATE POLICY "select_own_plan_steps" ON coach_plan_steps FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM coach_plans WHERE coach_plans.id = coach_plan_steps.plan_id AND coach_plans.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_plan_steps" ON coach_plan_steps;
CREATE POLICY "insert_own_plan_steps" ON coach_plan_steps FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM coach_plans WHERE coach_plans.id = coach_plan_steps.plan_id AND coach_plans.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_plan_steps" ON coach_plan_steps;
CREATE POLICY "update_own_plan_steps" ON coach_plan_steps FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM coach_plans WHERE coach_plans.id = coach_plan_steps.plan_id AND coach_plans.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM coach_plans WHERE coach_plans.id = coach_plan_steps.plan_id AND coach_plans.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_plan_steps" ON coach_plan_steps;
CREATE POLICY "delete_own_plan_steps" ON coach_plan_steps FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM coach_plans WHERE coach_plans.id = coach_plan_steps.plan_id AND coach_plans.user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_plan_steps_plan ON coach_plan_steps(plan_id, order_index);

-- =====================================================
-- 3. resource_cache table
-- =====================================================
CREATE TABLE IF NOT EXISTS resource_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  cache_key text NOT NULL,
  source text NOT NULL DEFAULT 'youtube',
  query text NOT NULL,
  results jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

ALTER TABLE resource_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_resource_cache" ON resource_cache;
CREATE POLICY "select_own_resource_cache" ON resource_cache FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_resource_cache" ON resource_cache;
CREATE POLICY "insert_own_resource_cache" ON resource_cache FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_resource_cache" ON resource_cache;
CREATE POLICY "update_own_resource_cache" ON resource_cache FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_resource_cache" ON resource_cache;
CREATE POLICY "delete_own_resource_cache" ON resource_cache FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_resource_cache_user_key ON resource_cache(user_id, cache_key);
CREATE INDEX IF NOT EXISTS idx_resource_cache_expires ON resource_cache(expires_at);
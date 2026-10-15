/*
# Unified Coaching Foundation

1. Plain-English
   This migration lays the groundwork for a unified coaching system where the coach's AI
   can see plans, steps, commitments, and user updates in real time. It fixes the goal_type
   constraint, adds coach-proposed vs user-set values on plan steps, adds a coach minimum
   floor, adds coaching tick events for live updates, adds a coaching_state snapshot column
   on companions, and creates the coach_artifacts table for coach-produced materials.

2. Changes to existing tables
   - user_goals: Widen the goal_type CHECK to include 'skill' and 'project' (was only 5 types,
     atlas-onboarding and expert catalog reference 7).
   - coach_plan_steps: Add coach_proposed_title (what the coach suggested), user_set_title
     (what the user edited it to), coach_minimum (the floor below which the step doesn't count),
     override_log (JSONB array of override events), and is_below_floor (flag for user edits
     below the coach minimum).
   - companions: Add coaching_state JSONB column for a compact snapshot the coach's AI reads.
   - coaching_commitments: Add plan_step_id for bidirectional step↔commitment sync.

3. New tables
   - coaching_tick_events: Small event rows written when a user checks off a step, updates a
     commitment, or edits a plan step. The coach reads these on the next message ("since last
     time: ticked 2 steps").
   - coach_artifacts: Saved, typed items the coach creates in chat — reading material, routines,
     practice sets, worksheets, checklists, progress reports. Each links to a goal and plan.

4. Security
   - All new tables get RLS with owner-scoped CRUD (4 policies each, TO authenticated).
   - coaching_tick_events and coach_artifacts default user_id to auth.uid().
*/

-- ── 1. Fix goal_type CHECK on user_goals ──────────────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'user_goals_goal_type_check'
  ) THEN
    ALTER TABLE public.user_goals DROP CONSTRAINT IF EXISTS user_goals_goal_type_check;
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE public.user_goals
    ADD CONSTRAINT user_goals_goal_type_check
    CHECK (goal_type IN ('health_fitness', 'reading', 'creative', 'habit', 'deadline', 'skill', 'project'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Add columns to coach_plan_steps ────────────────────────────────────
ALTER TABLE public.coach_plan_steps
  ADD COLUMN IF NOT EXISTS coach_proposed_title text,
  ADD COLUMN IF NOT EXISTS user_set_title text,
  ADD COLUMN IF NOT EXISTS coach_minimum text,
  ADD COLUMN IF NOT EXISTS override_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_below_floor boolean NOT NULL DEFAULT false;

-- ── 3. Add coaching_state to companions ──────────────────────────────────
ALTER TABLE public.companions
  ADD COLUMN IF NOT EXISTS coaching_state jsonb;

-- ── 4. coaching_tick_events ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coaching_tick_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  companion_id uuid,
  event_type text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  acknowledged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coaching_tick_events_user
  ON public.coaching_tick_events (user_id, acknowledged, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coaching_tick_events_companion
  ON public.coaching_tick_events (companion_id, created_at DESC);

ALTER TABLE public.coaching_tick_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_tick_events" ON public.coaching_tick_events;
CREATE POLICY "select_own_tick_events" ON public.coaching_tick_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_tick_events" ON public.coaching_tick_events;
CREATE POLICY "insert_own_tick_events" ON public.coaching_tick_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_tick_events" ON public.coaching_tick_events;
CREATE POLICY "update_own_tick_events" ON public.coaching_tick_events
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_tick_events" ON public.coaching_tick_events;
CREATE POLICY "delete_own_tick_events" ON public.coaching_tick_events
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ── 5. coach_artifacts ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coach_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  companion_id uuid REFERENCES public.companions(id) ON DELETE SET NULL,
  goal_id uuid REFERENCES public.user_goals(id) ON DELETE SET NULL,
  plan_id uuid REFERENCES public.coach_plans(id) ON DELETE SET NULL,
  artifact_type text NOT NULL,
  title text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'proposed',
  version int NOT NULL DEFAULT 1,
  parent_artifact_id uuid REFERENCES public.coach_artifacts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coach_artifacts_user
  ON public.coach_artifacts (user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coach_artifacts_companion
  ON public.coach_artifacts (companion_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_coach_artifacts_type
  ON public.coach_artifacts (user_id, artifact_type);

ALTER TABLE public.coach_artifacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_artifacts" ON public.coach_artifacts;
CREATE POLICY "select_own_artifacts" ON public.coach_artifacts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_artifacts" ON public.coach_artifacts;
CREATE POLICY "insert_own_artifacts" ON public.coach_artifacts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_artifacts" ON public.coach_artifacts;
CREATE POLICY "update_own_artifacts" ON public.coach_artifacts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_artifacts" ON public.coach_artifacts;
CREATE POLICY "delete_own_artifacts" ON public.coach_artifacts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ── 6. Add plan_step_id to coaching_commitments ───────────────────────────
ALTER TABLE public.coaching_commitments
  ADD COLUMN IF NOT EXISTS plan_step_id uuid REFERENCES public.coach_plan_steps(id) ON DELETE SET NULL;
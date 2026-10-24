/*
  # Coaching chain: goal → plan → commitments → progress

  1. Constraints
    - `coach_plans.goal_id` is required: every plan serves a goal.
    - `coaching_commitments.plan_step_id` is required: every commitment comes
      from a plan step.
    - Their foreign keys switch from ON DELETE SET NULL to ON DELETE CASCADE, so
      deleting a goal removes the plans built on it, and deleting a plan (which
      already cascades to its steps) removes the commitments built on them.
      Removing a single step stays a soft delete, so commitments survive it.

  2. Realtime
    - Adds the coaching tables to the `supabase_realtime` publication so the
      coaching pages and the chat-side Plan/Commitments tabs update live.
      RLS on each table limits every subscriber to their own rows.

  Safe to apply: when this was written there were no plans or commitments.
*/

ALTER TABLE public.coach_plans
  DROP CONSTRAINT IF EXISTS coach_plans_goal_id_fkey,
  ADD CONSTRAINT coach_plans_goal_id_fkey
    FOREIGN KEY (goal_id) REFERENCES public.user_goals(id) ON DELETE CASCADE,
  ALTER COLUMN goal_id SET NOT NULL;

ALTER TABLE public.coaching_commitments
  DROP CONSTRAINT IF EXISTS coaching_commitments_plan_step_id_fkey,
  ADD CONSTRAINT coaching_commitments_plan_step_id_fkey
    FOREIGN KEY (plan_step_id) REFERENCES public.coach_plan_steps(id) ON DELETE CASCADE,
  ALTER COLUMN plan_step_id SET NOT NULL;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['user_goals', 'coach_plans', 'coach_plan_steps', 'coaching_commitments', 'coach_artifacts']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

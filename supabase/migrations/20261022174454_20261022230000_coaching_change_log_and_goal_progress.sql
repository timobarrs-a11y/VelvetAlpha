/*
# Coaching Change Log + Goal Progress Trigger

## Purpose
Supports the coaching loop (spec §14): every coach edit is logged so the coach
always knows what changed and who changed it, and completed commitments
automatically update goal progress through a database trigger (so it works
whether the change comes from a coach tool, a tab tick, or the overdue sweep).

## 1. New Table: coaching_change_log
- `id` (uuid, primary key)
- `user_id` (uuid, NOT NULL, references auth.users ON DELETE CASCADE)
- `companion_id` (uuid, nullable, references companions ON DELETE SET NULL) — the coach that made the change (null for user edits)
- `entity_type` (text, NOT NULL) — 'goal' | 'plan' | 'plan_step' | 'commitment'
- `entity_id` (uuid, NOT NULL)
- `actor` (text, NOT NULL) — 'coach' | 'user' | 'system'
- `action` (text, NOT NULL) — 'created' | 'updated' | 'completed' | 'cancelled' | 'deleted' | 'reordered' | 'status_changed'
- `before` (jsonb, nullable) — snapshot of relevant fields before the change
- `after` (jsonb, nullable) — snapshot of relevant fields after the change
- `reason` (text, nullable) — why the change was made (coach-supplied or system note)
- `created_at` (timestamptz, NOT NULL, default now())

## 2. Security
- RLS enabled on coaching_change_log.
- Grant SELECT to authenticated (owner-scoped) so the client can read its own change log for undo/highlight.
- Grant INSERT to service_role only (edge functions write entries; users don't write directly).
- 4 owner-scoped policies for authenticated (select/insert/update/delete on own rows).

## 3. Goal Progress Trigger
- `sync_commitment_completion_to_goal()`: SECURITY DEFINER trigger function.
  When a commitment's status transitions TO 'completed', if the commitment has
  a goal_id, increment user_goals.current_value by 1. If current_value reaches
  target_value, mark the goal as completed.
  This complements the existing step↔commitment sync triggers and ensures goal
  progress updates regardless of how the commitment was completed.
- Trigger: `trg_commitment_goal_progress` AFTER UPDATE OF status ON coaching_commitments.

## 4. Indexes
- idx_change_log_user_created ON coaching_change_log(user_id, created_at DESC)
- idx_change_log_entity ON coaching_change_log(entity_type, entity_id)
*/

-- =====================================================
-- 1. coaching_change_log table
-- =====================================================
CREATE TABLE IF NOT EXISTS coaching_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id uuid REFERENCES companions(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  actor text NOT NULL,
  action text NOT NULL,
  before jsonb,
  after jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coaching_change_log ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON coaching_change_log TO authenticated;
GRANT INSERT ON coaching_change_log TO service_role;

DROP POLICY IF EXISTS "select_own_change_log" ON coaching_change_log;
CREATE POLICY "select_own_change_log" ON coaching_change_log FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_change_log" ON coaching_change_log;
CREATE POLICY "insert_own_change_log" ON coaching_change_log FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_change_log" ON coaching_change_log;
CREATE POLICY "update_own_change_log" ON coaching_change_log FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_change_log" ON coaching_change_log;
CREATE POLICY "delete_own_change_log" ON coaching_change_log FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_change_log_user_created ON coaching_change_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_change_log_entity ON coaching_change_log(entity_type, entity_id);

-- =====================================================
-- 2. Goal progress trigger: commitment completed → goal progress
-- =====================================================
CREATE OR REPLACE FUNCTION public.sync_commitment_completion_to_goal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_goal record;
  v_new_value numeric;
BEGIN
  -- Only fire when status transitions TO 'completed' and commitment has a goal
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM NEW.status) AND NEW.goal_id IS NOT NULL THEN
    SELECT current_value, target_value, status INTO v_goal
      FROM public.user_goals WHERE id = NEW.goal_id;

    IF FOUND AND v_goal.status = 'active' THEN
      v_new_value := COALESCE(v_goal.current_value, 0) + 1;
      IF v_goal.target_value IS NOT NULL AND v_new_value >= v_goal.target_value THEN
        UPDATE public.user_goals
           SET current_value = v_new_value, status = 'completed', updated_at = now()
         WHERE id = NEW.goal_id;
      ELSE
        UPDATE public.user_goals
           SET current_value = v_new_value, updated_at = now()
         WHERE id = NEW.goal_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_commitment_goal_progress ON public.coaching_commitments;
CREATE TRIGGER trg_commitment_goal_progress
  AFTER UPDATE OF status ON public.coaching_commitments
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.sync_commitment_completion_to_goal();

REVOKE ALL ON FUNCTION public.sync_commitment_completion_to_goal() FROM PUBLIC, anon, authenticated;

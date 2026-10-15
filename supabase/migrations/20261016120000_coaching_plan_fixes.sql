/*
# Coaching plan fixes: working plans, enforced coach minimums, two-way step/commitment sync

1. Plain-English
   - coach_plans never had a goal_id column, so every plan the coach tried to create failed.
     Adds it (and a 'proposed' plan status is now used for coach-created plans; no constraint
     exists on status so no change needed).
   - Plan steps get structured numbers (target, minimum, unit) so the coach minimum can be
     enforced instead of compared as free text.
   - edit_plan_step(): the one way a user edits a step. It checks ownership, works out whether
     the edit is below the coach's minimum, records an override-log entry, and writes a tick event
     so the coach sees it on the next message.
   - Steps and commitments were linked by two different columns, so each direction of the sync
     only worked for one of them. Completion is now synced by database triggers that honour both
     columns, in both directions, including re-opening. When every step of a plan is done the plan
     is marked completed.
   - coaching_signal_log remembers when each adjustment signal was last raised, so the coach
     does not repeat the same nudge on every message.

2. Security
   - Trigger functions and edit_plan_step are SECURITY DEFINER with an empty search_path and only
     touch rows belonging to the same user.
   - coaching_signal_log has RLS enabled and no client policies (service role only).
*/

-- ── 1. coach_plans.goal_id ────────────────────────────────────────────────
ALTER TABLE public.coach_plans
  ADD COLUMN IF NOT EXISTS goal_id uuid REFERENCES public.user_goals(id) ON DELETE SET NULL;

-- ── 2. Structured step targets ────────────────────────────────────────────
ALTER TABLE public.coach_plan_steps
  ADD COLUMN IF NOT EXISTS target_unit text,
  ADD COLUMN IF NOT EXISTS minimum_value numeric,
  ADD COLUMN IF NOT EXISTS user_target_value numeric;

-- ── 3. Signal cooldown log ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coaching_signal_log (
  user_id uuid NOT NULL,
  companion_id uuid NOT NULL,
  signal_key text NOT NULL,
  last_raised_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, companion_id, signal_key)
);
ALTER TABLE public.coaching_signal_log ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only the service role (edge functions) reads or writes this.

-- ── 4. Backfill: mirror the two link columns ──────────────────────────────
UPDATE public.coach_plan_steps s
   SET commitment_id = c.id
  FROM public.coaching_commitments c
 WHERE c.plan_step_id = s.id AND s.commitment_id IS NULL;

UPDATE public.coaching_commitments c
   SET plan_step_id = s.id
  FROM public.coach_plan_steps s
 WHERE s.commitment_id = c.id AND c.plan_step_id IS NULL;

-- ── 5. Two-way completion sync ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_step_status_to_commitment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner uuid;
BEGIN
  -- Only ever touch commitments that belong to the same user as the step's plan, even if the
  -- step row carries an id pointing at someone else's commitment.
  SELECT user_id INTO v_owner FROM public.coach_plans WHERE id = NEW.plan_id;

  IF NEW.status = 'completed' THEN
    UPDATE public.coaching_commitments
       SET status = 'completed',
           completed_at = COALESCE(completed_at, now()),
           updated_at = now()
     WHERE user_id = v_owner
       AND (id = NEW.commitment_id OR plan_step_id = NEW.id)
       AND status <> 'completed';
  ELSIF OLD.status = 'completed' THEN
    UPDATE public.coaching_commitments
       SET status = 'pending', completed_at = NULL, updated_at = now()
     WHERE user_id = v_owner
       AND (id = NEW.commitment_id OR plan_step_id = NEW.id)
       AND status = 'completed';
  END IF;

  -- Plan completes when every step is done or skipped; re-opens if a step is un-ticked.
  IF NEW.status IN ('completed', 'skipped') THEN
    UPDATE public.coach_plans p
       SET status = 'completed', updated_at = now()
     WHERE p.id = NEW.plan_id
       AND p.status = 'active'
       AND NOT EXISTS (
         SELECT 1 FROM public.coach_plan_steps s
          WHERE s.plan_id = p.id AND s.status NOT IN ('completed', 'skipped')
       );
  ELSE
    UPDATE public.coach_plans
       SET status = 'active', updated_at = now()
     WHERE id = NEW.plan_id AND status = 'completed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_step_status_sync ON public.coach_plan_steps;
CREATE TRIGGER trg_step_status_sync
  AFTER UPDATE OF status ON public.coach_plan_steps
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.sync_step_status_to_commitment();

CREATE OR REPLACE FUNCTION public.sync_commitment_status_to_step()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only steps whose plan belongs to the commitment's owner may be changed.
  IF NEW.status = 'completed' THEN
    UPDATE public.coach_plan_steps s
       SET status = 'completed',
           completed_at = COALESCE(s.completed_at, now()),
           updated_at = now()
     WHERE (s.id = NEW.plan_step_id OR s.commitment_id = NEW.id)
       AND s.status <> 'completed'
       AND EXISTS (SELECT 1 FROM public.coach_plans p WHERE p.id = s.plan_id AND p.user_id = NEW.user_id);
  ELSIF OLD.status = 'completed' AND NEW.status IN ('pending', 'in_progress') THEN
    UPDATE public.coach_plan_steps s
       SET status = 'pending', completed_at = NULL, updated_at = now()
     WHERE (s.id = NEW.plan_step_id OR s.commitment_id = NEW.id)
       AND s.status = 'completed'
       AND EXISTS (SELECT 1 FROM public.coach_plans p WHERE p.id = s.plan_id AND p.user_id = NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_commitment_status_sync ON public.coaching_commitments;
CREATE TRIGGER trg_commitment_status_sync
  AFTER UPDATE OF status ON public.coaching_commitments
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.sync_commitment_status_to_step();

REVOKE ALL ON FUNCTION public.sync_step_status_to_commitment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_commitment_status_to_step() FROM PUBLIC, anon, authenticated;

-- ── 6. Server-checked step edits ──────────────────────────────────────────
-- The user's number is p_target_value when given, otherwise the first number found in the new
-- title ("10 push-ups" -> 10). A step is "below floor" when that number is under minimum_value.
CREATE OR REPLACE FUNCTION public.edit_plan_step(
  p_step_id uuid,
  p_title text,
  p_target_value numeric DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_step public.coach_plan_steps%ROWTYPE;
  v_plan public.coach_plans%ROWTYPE;
  v_title text := btrim(COALESCE(p_title, ''));
  v_value numeric;
  v_below boolean := false;
  v_reset boolean;
  v_from text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF v_title = '' OR char_length(v_title) > 300 THEN RAISE EXCEPTION 'Title must be 1-300 characters'; END IF;

  SELECT * INTO v_step FROM public.coach_plan_steps WHERE id = p_step_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Step not found'; END IF;
  SELECT * INTO v_plan FROM public.coach_plans WHERE id = v_step.plan_id AND user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Step not found'; END IF;

  v_from := COALESCE(v_step.user_set_title, v_step.title);
  v_reset := v_title = COALESCE(v_step.coach_proposed_title, v_step.title) AND p_target_value IS NULL;

  v_value := COALESCE(p_target_value, NULLIF(substring(v_title from '\d+(?:\.\d+)?'), '')::numeric);
  IF NOT v_reset AND v_step.minimum_value IS NOT NULL AND v_value IS NOT NULL AND v_value < v_step.minimum_value THEN
    v_below := true;
  END IF;

  UPDATE public.coach_plan_steps
     SET user_set_title = CASE WHEN v_reset THEN NULL ELSE v_title END,
         user_target_value = CASE WHEN v_reset THEN NULL ELSE v_value END,
         is_below_floor = v_below,
         override_log = COALESCE(override_log, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
           'actor', 'user', 'action', CASE WHEN v_reset THEN 'reset' ELSE 'edit' END,
           'from', v_from, 'to', v_title, 'below_floor', v_below, 'at', now())),
         updated_at = now()
   WHERE id = p_step_id;

  INSERT INTO public.coaching_tick_events (user_id, companion_id, event_type, target_type, target_id, details)
  VALUES (v_uid, v_plan.companion_id, 'step_edited', 'plan_step', p_step_id::text,
          jsonb_build_object('from', v_from, 'to', v_title, 'below_floor', v_below,
                             'minimum', COALESCE(v_step.coach_minimum, v_step.minimum_value::text)));

  RETURN jsonb_build_object(
    'is_below_floor', v_below,
    'minimum_value', v_step.minimum_value,
    'minimum_text', v_step.coach_minimum
  );
END;
$$;

REVOKE ALL ON FUNCTION public.edit_plan_step(uuid, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.edit_plan_step(uuid, text, numeric) TO authenticated;

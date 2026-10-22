import { createClient } from 'npm:@supabase/supabase-js@2';

type Admin = ReturnType<typeof createClient>;

export const ARTIFACT_TYPES = [
  'reading_material', 'plan', 'routine', 'practice_set',
  'worksheet', 'resource_pick', 'checklist', 'progress_report',
] as const;

export interface CoachArtifactResult {
  id: string;
  artifactType: string;
  title: string;
  content: Record<string, unknown>;
}

export interface CoachingChange {
  entityType: 'goal' | 'plan' | 'plan_step' | 'commitment';
  entityId: string;
  action: string;
}

export interface CoachToolOutcome {
  result: Record<string, unknown>;
  isError: boolean;
  artifact?: CoachArtifactResult;
  change?: CoachingChange;
  uiAction?: { tab: 'plan' | 'commitments'; highlightIds: string[] };
}

const MAX_TEXT = 12000;
const MAX_ITEMS = 40;

function str(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

function esc(v: string): string {
  return v.replace(/[\\%_]/g, (m) => `\\${m}`);
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function isUuid(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function fail(message: string): CoachToolOutcome {
  return { result: { error: message }, isError: true };
}

function ok(result: Record<string, unknown>, extra?: Partial<CoachToolOutcome>): CoachToolOutcome {
  return { result, isError: false, ...extra };
}

function normalizeArtifactContent(raw: unknown): Record<string, unknown> {
  const c = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw as Record<string, unknown> : {};
  const out: Record<string, unknown> = {};
  const text = str(c.text, MAX_TEXT);
  if (text) out.text = text;
  if (Array.isArray(c.items)) {
    const items = c.items.slice(0, MAX_ITEMS).map((it) => {
      if (typeof it === 'string') return { title: it.slice(0, 300) };
      const o = (it && typeof it === 'object') ? it as Record<string, unknown> : {};
      const item: Record<string, string> = {};
      const title = str(o.title ?? o.text, 300);
      if (title) item.title = title;
      const note = str(o.note ?? o.detail, 600);
      if (note) item.note = note;
      const url = str(o.url, 500);
      if (url && /^https?:\/\//i.test(url)) item.url = url;
      return item;
    }).filter((i) => i.title);
    if (items.length) out.items = items;
  }
  const url = str(c.url, 500);
  if (url && /^https?:\/\//i.test(url)) out.url = url;
  const note = str(c.note, 600);
  if (note) out.note = note;
  return out;
}

// ── Ownership guards ──────────────────────────────────────────────────────

async function ownedGoal(admin: Admin, userId: string, companionId: string, goalId: unknown) {
  if (!isUuid(goalId)) return null;
  const { data } = await admin
    .from('user_goals')
    .select('id, source_companion_id, title, goal_type, status')
    .eq('id', goalId)
    .eq('user_id', userId)
    .maybeSingle();
  const goal = data as (Record<string, unknown> & { id: string }) | null;
  if (!goal) return null;
  if (goal.source_companion_id && goal.source_companion_id !== companionId) return null;
  return goal;
}

async function activeGoalId(admin: Admin, userId: string): Promise<string | null> {
  const { data } = await admin
    .from('user_goals')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

async function ownedPlan(admin: Admin, userId: string, companionId: string, planId: unknown) {
  if (!isUuid(planId)) return null;
  const { data } = await admin
    .from('coach_plans')
    .select('id, companion_id, goal_id, title, status')
    .eq('id', planId)
    .eq('user_id', userId)
    .maybeSingle();
  const plan = data as (Record<string, unknown> & { id: string }) | null;
  if (!plan) return null;
  if (plan.companion_id && plan.companion_id !== companionId) return null;
  return plan;
}

async function ownedStep(admin: Admin, userId: string, companionId: string, stepId: unknown) {
  if (!isUuid(stepId)) return null;
  const { data } = await admin
    .from('coach_plan_steps')
    .select('id, plan_id, title, coach_proposed_title, user_set_title, commitment_id, override_log, status')
    .eq('id', stepId)
    .maybeSingle();
  const step = data as (Record<string, unknown> & { plan_id: string; id: string }) | null;
  if (!step) return null;
  const plan = await ownedPlan(admin, userId, companionId, step.plan_id);
  return plan ? step : null;
}

async function ownedCommitment(admin: Admin, userId: string, companionId: string, commitmentId: unknown) {
  if (!isUuid(commitmentId)) return null;
  const { data } = await admin
    .from('coaching_commitments')
    .select('id, companion_id, goal_id, plan_step_id, description, due_date, status, is_user_created')
    .eq('id', commitmentId)
    .eq('user_id', userId)
    .maybeSingle();
  const commit = data as (Record<string, unknown> & { id: string }) | null;
  if (!commit) return null;
  if (commit.companion_id && commit.companion_id !== companionId) return null;
  return commit;
}

// ── Change logging ────────────────────────────────────────────────────────

async function logChange(
  admin: Admin,
  userId: string,
  companionId: string,
  entityType: CoachingChange['entityType'],
  entityId: string,
  actor: 'coach' | 'system',
  action: string,
  before?: Record<string, unknown>,
  after?: Record<string, unknown>,
  reason?: string | null,
): Promise<void> {
  try {
    await admin.from('coaching_change_log').insert({
      user_id: userId,
      companion_id: companionId,
      entity_type: entityType,
      entity_id: entityId,
      actor,
      action,
      before: before ?? null,
      after: after ?? null,
      reason: reason ?? null,
    });
  } catch { /* best-effort */ }
}

function stepRow(s: Record<string, unknown>, planId: string, index: number) {
  const title = str(s.title, 300);
  if (!title) return null;
  const minimumValue = num(s.minimum_value);
  return {
    plan_id: planId,
    title,
    coach_proposed_title: title,
    description: str(s.description, 600),
    coach_minimum: str(s.minimum_note, 120) ?? (minimumValue !== null && str(s.unit, 40) ? `${minimumValue} ${str(s.unit, 40)}` : null),
    minimum_value: minimumValue,
    target_unit: str(s.unit, 40),
    order_index: index,
    status: 'pending',
  };
}

// ── Tool definitions ──────────────────────────────────────────────────────

export const COACH_TOOLS = [
  {
    name: 'create_goal',
    description:
      'Create a goal for the user from what they said in the conversation. Use this as soon as you know the goal and timeframe. ' +
      'Skips duplicates by title and returns the existing goal_id. The goal is linked to this coach.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short goal name, e.g. "Run a 5K"' },
        goal_type: { type: 'string', enum: ['health_fitness', 'reading', 'creative', 'habit', 'deadline', 'skill', 'project'] },
        target_value: { type: 'number', description: 'Target quantity, e.g. 5 for a 5K' },
        unit: { type: 'string', description: 'e.g. km, pages, sessions' },
        target_date: { type: 'string', description: 'ISO 8601 date' },
      },
      required: ['title', 'goal_type'],
    },
  },
  {
    name: 'create_plan',
    description:
      'Propose a new plan (an ordered list of steps) toward the user\'s goal. The user sees it as a PROPOSAL they can accept and edit. ' +
      'Give each step a concrete quantity in its title (e.g. "15 push-ups, 4 days a week") and, where a floor exists, a minimum_value below which the step would not meaningfully count. ' +
      'Only one open plan per goal: check COACHING STATE first and use add_step/adjust_step to change an existing plan.',
    input_schema: {
      type: 'object',
      properties: {
        goal_id: { type: 'string', description: 'The goal this plan serves. Omit only if the user has exactly one active goal with this coach.' },
        title: { type: 'string', description: 'Short plan name, e.g. "Spanish basics, weeks 1-2"' },
        description: { type: 'string' },
        cadence: { type: 'string', description: 'e.g. daily, 3x/week, weekly' },
        steps: {
          type: 'array',
          maxItems: 12,
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'The step including its quantity, e.g. "15 push-ups"' },
              description: { type: 'string' },
              minimum_value: { type: 'number', description: 'Smallest quantity that still counts (same unit as the title\'s number)' },
              minimum_note: { type: 'string', description: 'Human wording of the minimum, e.g. "8 push-ups"' },
              unit: { type: 'string', description: 'e.g. push-ups, minutes, pages' },
            },
            required: ['title'],
          },
        },
      },
      required: ['title', 'steps'],
    },
  },
  {
    name: 'update_plan',
    description:
      'Update a plan\'s title, description, cadence, or status. ' +
      'Use status "active" to activate a proposed plan (e.g. after the user says "let\'s go"). ' +
      'Other statuses: "paused", "completed".',
    input_schema: {
      type: 'object',
      properties: {
        plan_id: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        cadence: { type: 'string' },
        status: { type: 'string', enum: ['proposed', 'active', 'paused', 'completed'] },
      },
      required: ['plan_id'],
    },
  },
  {
    name: 'add_step',
    description: 'Add a step to an existing plan. Use the plan_id shown in COACHING STATE.',
    input_schema: {
      type: 'object',
      properties: {
        plan_id: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        minimum_value: { type: 'number' },
        minimum_note: { type: 'string' },
        unit: { type: 'string' },
      },
      required: ['plan_id', 'title'],
    },
  },
  {
    name: 'adjust_step',
    description:
      'Respond to the user editing a step, or revise your own proposal. Use the step_id shown in COACHING STATE. ' +
      'action "hold": reinstate your original proposal (use when an edit falls below your minimum and you will not accept it). ' +
      'action "accept": the user\'s edit stands (optionally lower your minimum). ' +
      'action "revise": replace the step with a new proposal (new_title required), e.g. a smaller step to rebuild momentum.',
    input_schema: {
      type: 'object',
      properties: {
        step_id: { type: 'string' },
        action: { type: 'string', enum: ['hold', 'accept', 'revise'] },
        new_title: { type: 'string' },
        new_minimum_value: { type: 'number' },
        new_minimum_note: { type: 'string' },
        reason: { type: 'string', description: 'One sentence, shown in the step history' },
      },
      required: ['step_id', 'action'],
    },
  },
  {
    name: 'remove_step',
    description: 'Soft-delete a step from a plan. The reason is shown in the step history. Use sparingly — prefer adjust_step "revise".',
    input_schema: {
      type: 'object',
      properties: {
        step_id: { type: 'string' },
        reason: { type: 'string', description: 'Why this step is being removed' },
      },
      required: ['step_id'],
    },
  },
  {
    name: 'reorder_steps',
    description: 'Reorder the steps in a plan. Pass all step_ids in the new order.',
    input_schema: {
      type: 'object',
      properties: {
        plan_id: { type: 'string' },
        step_ids: { type: 'array', items: { type: 'string' } },
      },
      required: ['plan_id', 'step_ids'],
    },
  },
  {
    name: 'create_commitment',
    description:
      'Record a concrete, dated commitment for the user. Pass plan_step_id (from COACHING STATE) to tie it to a plan step so ticking one completes the other.',
    input_schema: {
      type: 'object',
      properties: {
        goal_id: { type: 'string', description: 'The goal this commitment serves. If omitted, uses the step\'s plan goal or the coach\'s single active goal.' },
        description: { type: 'string' },
        due_date: { type: 'string', description: 'ISO 8601 date or date-time' },
        plan_step_id: { type: 'string' },
      },
      required: ['description'],
    },
  },
  {
    name: 'update_commitment',
    description: 'Edit a commitment\'s description, due date, or linked step.',
    input_schema: {
      type: 'object',
      properties: {
        commitment_id: { type: 'string' },
        description: { type: 'string' },
        due_date: { type: 'string', description: 'ISO 8601 date or date-time' },
        plan_step_id: { type: 'string' },
      },
      required: ['commitment_id'],
    },
  },
  {
    name: 'complete_commitment',
    description: 'Mark a commitment as completed. Replaces the old fuzzy-matching path — always use the commitment_id from COACHING STATE.',
    input_schema: {
      type: 'object',
      properties: {
        commitment_id: { type: 'string' },
      },
      required: ['commitment_id'],
    },
  },
  {
    name: 'cancel_commitment',
    description: 'Cancel a commitment (status → cancelled). Use when the user says they no longer want to do it.',
    input_schema: {
      type: 'object',
      properties: {
        commitment_id: { type: 'string' },
        reason: { type: 'string', description: 'Why it was cancelled' },
      },
      required: ['commitment_id'],
    },
  },
  {
    name: 'show_in_tab',
    description: 'UI-only: open the Plan or Commitments tab beside the chat and highlight the listed item ids. Use after creating or updating items so the user sees them.',
    input_schema: {
      type: 'object',
      properties: {
        tab: { type: 'string', enum: ['plan', 'commitments'] },
        highlight_ids: { type: 'array', items: { type: 'string' } },
      },
      required: ['tab'],
    },
  },
  {
    name: 'create_artifact',
    description:
      'Save something the user keeps: reading material, a routine, a practice set, a worksheet, a checklist, a resource pick or a progress report. ' +
      'content shape: { text?: string (markdown body), items?: [{ title: string, note?: string, url?: string }], url?: string, note?: string }. ' +
      'reading_material: text = the lesson or summary; items = recommended readings with a note on why each matters (never invent citations or URLs). ' +
      'routine/checklist/practice_set/worksheet: use items (one per exercise, day, question or task).',
    input_schema: {
      type: 'object',
      properties: {
        artifact_type: { type: 'string', enum: [...ARTIFACT_TYPES] },
        title: { type: 'string' },
        content: { type: 'object' },
      },
      required: ['artifact_type', 'title', 'content'],
    },
  },
];

// ── Tool executor ─────────────────────────────────────────────────────────

export async function executeCoachTool(
  admin: Admin,
  userId: string,
  companionId: string,
  name: string,
  input: Record<string, unknown>,
): Promise<CoachToolOutcome> {
  try {
    switch (name) {
      // ── create_goal ──────────────────────────────────────────────────────
      case 'create_goal': {
        const title = str(input.title, 200);
        const goalType = str(input.goal_type, 50);
        if (!title) return fail('title is required');
        if (!goalType) return fail('goal_type is required');
        const validTypes = ['health_fitness', 'reading', 'creative', 'habit', 'deadline', 'skill', 'project'];
        if (!validTypes.includes(goalType)) return fail(`goal_type must be one of: ${validTypes.join(', ')}`);

        const { data: existing } = await admin
          .from('user_goals')
          .select('id, title, status')
          .eq('user_id', userId)
          .ilike('title', esc(title))
          .in('status', ['active', 'paused'])
          .limit(1)
          .maybeSingle();
        if (existing) {
          return ok({ goal_id: (existing as { id: string }).id, already_existed: true });
        }

        let targetDate: string | null = null;
        if (typeof input.target_date === 'string' && input.target_date.trim()) {
          const d = new Date(input.target_date);
          if (Number.isNaN(d.getTime())) return fail('target_date is not a valid date');
          targetDate = d.toISOString();
        }

        const { data: goal, error } = await admin
          .from('user_goals')
          .insert({
            user_id: userId,
            source_companion_id: companionId,
            title,
            goal_type: goalType,
            target_value: num(input.target_value),
            unit: str(input.unit, 40),
            target_date: targetDate,
            status: 'active',
          })
          .select('id')
          .maybeSingle();
        if (error || !goal) return fail(`could not create goal: ${error?.message ?? 'unknown error'}`);

        const goalId = (goal as { id: string }).id;
        await logChange(admin, userId, companionId, 'goal', goalId, 'coach', 'created',
          undefined, { title, goal_type: goalType }, null);
        return ok({ goal_id: goalId }, { change: { entityType: 'goal', entityId: goalId, action: 'created' } });
      }

      // ── create_plan ──────────────────────────────────────────────────────
      case 'create_plan': {
        const title = str(input.title, 200);
        const steps = Array.isArray(input.steps) ? input.steps.slice(0, 12) : [];
        if (!title) return fail('title is required');
        if (steps.length === 0) return fail('at least one step is required');

        // Resolve goal_id: explicit > coach's single active goal
        let goalId: string | null = null;
        if (input.goal_id && isUuid(input.goal_id)) {
          const goal = await ownedGoal(admin, userId, companionId, input.goal_id);
          if (!goal) return fail('goal not found for this coach');
          goalId = goal.id as string;
        } else {
          const { data: goals } = await admin
            .from('user_goals')
            .select('id')
            .eq('user_id', userId)
            .eq('status', 'active')
            .order('created_at', { ascending: true });
          const userGoals = (goals ?? []) as Array<{ id: string }>;
          if (userGoals.length === 1) {
            goalId = userGoals[0].id;
          } else if (userGoals.length > 1) {
            return fail('The user has multiple active goals. Pass goal_id to specify which one this plan is for.');
          }
        }

        const { data: existing } = await admin
          .from('coach_plans')
          .select('id, title, status')
          .eq('user_id', userId)
          .eq('companion_id', companionId)
          .in('status', ['proposed', 'active'])
          .ilike('title', esc(title));
        const dup = (existing as Array<{ id: string; title: string; status: string }> | null)?.[0];
        if (dup) {
          return ok({ plan_id: dup.id, note: 'A plan with this title already exists; use add_step/adjust_step to change it.', already_existed: true });
        }

        const { data: plan, error } = await admin
          .from('coach_plans')
          .insert({
            user_id: userId,
            companion_id: companionId,
            goal_id: goalId,
            title,
            description: str(input.description, 600),
            cadence: str(input.cadence, 60),
            status: 'proposed',
          })
          .select('id')
          .maybeSingle();
        if (error || !plan) return fail(`could not create plan: ${error?.message ?? 'unknown error'}`);

        const planId = (plan as { id: string }).id;
        const rows = steps
          .map((s, i) => stepRow((s && typeof s === 'object') ? s as Record<string, unknown> : {}, planId, i))
          .filter((r): r is NonNullable<typeof r> => r !== null);
        const { data: inserted, error: stepErr } = await admin
          .from('coach_plan_steps')
          .insert(rows)
          .select('id, title, order_index');
        if (stepErr) {
          await admin.from('coach_plans').delete().eq('id', planId);
          return fail(`could not create plan steps: ${stepErr.message}`);
        }

        const stepList = ((inserted ?? []) as Array<{ id: string; title: string; order_index: number }>)
          .sort((a, b) => a.order_index - b.order_index)
          .map((s) => ({ step_id: s.id, title: s.title }));

        await logChange(admin, userId, companionId, 'plan', planId, 'coach', 'created',
          undefined, { title, steps: stepList.length }, null);

        return ok({
          plan_id: planId,
          status: 'proposed',
          steps: stepList,
          note: 'The user sees this as a proposal they can accept and edit.',
        }, {
          change: { entityType: 'plan', entityId: planId, action: 'created' },
          uiAction: { tab: 'plan', highlightIds: [planId, ...stepList.map(s => s.step_id)] },
        });
      }

      // ── update_plan ──────────────────────────────────────────────────────
      case 'update_plan': {
        const plan = await ownedPlan(admin, userId, companionId, input.plan_id);
        if (!plan) return fail('plan not found');

        const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
        const before: Record<string, unknown> = { status: plan.status, title: plan.title };
        const after: Record<string, unknown> = {};

        const newTitle = str(input.title, 200);
        if (newTitle) { update.title = newTitle; after.title = newTitle; }
        const newDesc = str(input.description, 600);
        if (newDesc) { update.description = newDesc; after.description = newDesc; }
        const newCadence = str(input.cadence, 60);
        if (newCadence) { update.cadence = newCadence; after.cadence = newCadence; }
        const newStatus = str(input.status, 20);
        if (newStatus) {
          if (!['proposed', 'active', 'paused', 'completed'].includes(newStatus)) return fail('status must be proposed, active, paused or completed');
          update.status = newStatus;
          after.status = newStatus;
        }

        const { error } = await admin.from('coach_plans').update(update).eq('id', plan.id);
        if (error) return fail(`could not update plan: ${error.message}`);

        await logChange(admin, userId, companionId, 'plan', plan.id, 'coach', 'updated', before, after, null);
        return ok({ plan_id: plan.id, updated: after }, {
          change: { entityType: 'plan', entityId: plan.id, action: 'updated' },
        });
      }

      // ── add_step ─────────────────────────────────────────────────────────
      case 'add_step': {
        const plan = await ownedPlan(admin, userId, companionId, input.plan_id);
        if (!plan) return fail('plan not found');
        const { data: last } = await admin
          .from('coach_plan_steps')
          .select('order_index')
          .eq('plan_id', plan.id)
          .order('order_index', { ascending: false })
          .limit(1)
          .maybeSingle();
        const row = stepRow(input, plan.id, ((last as { order_index: number } | null)?.order_index ?? -1) + 1);
        if (!row) return fail('title is required');
        const { data: step, error } = await admin.from('coach_plan_steps').insert(row).select('id').maybeSingle();
        if (error || !step) return fail(`could not add step: ${error?.message ?? 'unknown error'}`);
        const stepId = (step as { id: string }).id;
        await logChange(admin, userId, companionId, 'plan_step', stepId, 'coach', 'created',
          undefined, { title: row.title, plan_id: plan.id }, null);
        return ok({ step_id: stepId }, {
          change: { entityType: 'plan_step', entityId: stepId, action: 'created' },
          uiAction: { tab: 'plan', highlightIds: [stepId] },
        });
      }

      // ── adjust_step ──────────────────────────────────────────────────────
      case 'adjust_step': {
        const step = await ownedStep(admin, userId, companionId, input.step_id);
        if (!step) return fail('step not found');
        const action = input.action;
        if (action !== 'hold' && action !== 'accept' && action !== 'revise') return fail('action must be hold, accept or revise');

        const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
        const before = (step.user_set_title as string | null) || (step.title as string);
        let after = before;

        if (action === 'hold') {
          update.user_set_title = null;
          update.user_target_value = null;
          update.is_below_floor = false;
          after = (step.coach_proposed_title as string | null) || (step.title as string);
        } else if (action === 'accept') {
          update.is_below_floor = false;
          const newMin = num(input.new_minimum_value);
          if (newMin !== null) update.minimum_value = newMin;
          const newNote = str(input.new_minimum_note, 120);
          if (newNote) update.coach_minimum = newNote;
        } else {
          const newTitle = str(input.new_title, 300);
          if (!newTitle) return fail('new_title is required for revise');
          update.title = newTitle;
          update.coach_proposed_title = newTitle;
          update.user_set_title = null;
          update.user_target_value = null;
          update.is_below_floor = false;
          const newMin = num(input.new_minimum_value);
          if (newMin !== null) update.minimum_value = newMin;
          const newNote = str(input.new_minimum_note, 120);
          if (newNote) update.coach_minimum = newNote;
          after = newTitle;
        }

        const log = Array.isArray(step.override_log) ? [...(step.override_log as unknown[])] : [];
        log.push({ actor: 'coach', action, from: before, to: after, reason: str(input.reason, 300), at: new Date().toISOString() });
        update.override_log = log.slice(-30);

        const { error } = await admin.from('coach_plan_steps').update(update).eq('id', step.id as string);
        if (error) return fail(`could not adjust step: ${error.message}`);

        await logChange(admin, userId, companionId, 'plan_step', step.id, 'coach', 'updated',
          { title: before }, { title: after }, str(input.reason, 300));
        return ok({ step_id: step.id, action, now: after }, {
          change: { entityType: 'plan_step', entityId: step.id, action: 'updated' },
        });
      }

      // ── remove_step ──────────────────────────────────────────────────────
      case 'remove_step': {
        const step = await ownedStep(admin, userId, companionId, input.step_id);
        if (!step) return fail('step not found');
        const reason = str(input.reason, 300);

        const { error } = await admin.from('coach_plan_steps')
          .update({ status: 'skipped', updated_at: new Date().toISOString() })
          .eq('id', step.id as string);
        if (error) return fail(`could not remove step: ${error.message}`);

        await logChange(admin, userId, companionId, 'plan_step', step.id, 'coach', 'deleted',
          { title: step.title }, undefined, reason);
        return ok({ step_id: step.id, removed: true }, {
          change: { entityType: 'plan_step', entityId: step.id, action: 'deleted' },
        });
      }

      // ── reorder_steps ────────────────────────────────────────────────────
      case 'reorder_steps': {
        const plan = await ownedPlan(admin, userId, companionId, input.plan_id);
        if (!plan) return fail('plan not found');
        const stepIds = Array.isArray(input.step_ids) ? input.step_ids.filter(isUuid) : [];
        if (stepIds.length === 0) return fail('step_ids is required');

        for (let i = 0; i < stepIds.length; i++) {
          await admin.from('coach_plan_steps')
            .update({ order_index: i, updated_at: new Date().toISOString() })
            .eq('id', stepIds[i])
            .eq('plan_id', plan.id);
        }
        await logChange(admin, userId, companionId, 'plan', plan.id, 'coach', 'reordered',
          undefined, { step_ids: stepIds }, null);
        return ok({ plan_id: plan.id, reordered: true }, {
          change: { entityType: 'plan', entityId: plan.id, action: 'reordered' },
        });
      }

      // ── create_commitment ────────────────────────────────────────────────
      case 'create_commitment': {
        const description = str(input.description, 400);
        if (!description) return fail('description is required');

        let dueDate: string | null = null;
        if (typeof input.due_date === 'string' && input.due_date.trim()) {
          const d = new Date(input.due_date);
          if (Number.isNaN(d.getTime())) return fail('due_date is not a valid date');
          dueDate = d.toISOString();
        }

        let stepId: string | null = null;
        let goalId: string | null = null;

        if (input.plan_step_id !== undefined && input.plan_step_id !== null && input.plan_step_id !== '') {
          const step = await ownedStep(admin, userId, companionId, input.plan_step_id);
          if (!step) return fail('plan step not found');
          stepId = step.id as string;
          // Try to get goal from the step's plan
          const plan = await ownedPlan(admin, userId, companionId, step.plan_id);
          if (plan?.goal_id) goalId = plan.goal_id as string;
        }

        if (!goalId && input.goal_id && isUuid(input.goal_id)) {
          const goal = await ownedGoal(admin, userId, companionId, input.goal_id);
          if (!goal) return fail('goal not found for this coach');
          goalId = goal.id as string;
        }
        if (!goalId) goalId = await activeGoalId(admin, userId);

        const { data: dup } = await admin
          .from('coaching_commitments')
          .select('id')
          .eq('user_id', userId)
          .in('status', ['pending', 'in_progress'])
          .ilike('description', esc(description))
          .limit(1)
          .maybeSingle();
        if (dup) return ok({ commitment_id: (dup as { id: string }).id, already_existed: true });

        const { data: commit, error } = await admin
          .from('coaching_commitments')
          .insert({
            user_id: userId,
            companion_id: companionId,
            goal_id: goalId,
            plan_step_id: stepId,
            description,
            due_date: dueDate,
            status: 'pending',
            is_user_created: false,
          })
          .select('id')
          .maybeSingle();
        if (error || !commit) return fail(`could not create commitment: ${error?.message ?? 'unknown error'}`);

        const commitId = (commit as { id: string }).id;
        if (stepId) {
          await admin.from('coach_plan_steps').update({ commitment_id: commitId }).eq('id', stepId).is('commitment_id', null);
        }
        await logChange(admin, userId, companionId, 'commitment', commitId, 'coach', 'created',
          undefined, { description, due_date: dueDate }, null);
        return ok({ commitment_id: commitId }, {
          change: { entityType: 'commitment', entityId: commitId, action: 'created' },
          uiAction: { tab: 'commitments', highlightIds: [commitId] },
        });
      }

      // ── update_commitment ────────────────────────────────────────────────
      case 'update_commitment': {
        const commit = await ownedCommitment(admin, userId, companionId, input.commitment_id);
        if (!commit) return fail('commitment not found');

        const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
        const before: Record<string, unknown> = {
          description: commit.description,
          due_date: commit.due_date,
          plan_step_id: commit.plan_step_id,
        };
        const after: Record<string, unknown> = {};

        const newDesc = str(input.description, 400);
        if (newDesc) { update.description = newDesc; after.description = newDesc; }
        if (typeof input.due_date === 'string' && input.due_date.trim()) {
          const d = new Date(input.due_date);
          if (Number.isNaN(d.getTime())) return fail('due_date is not a valid date');
          update.due_date = d.toISOString();
          after.due_date = d.toISOString();
        }
        if (input.plan_step_id !== undefined) {
          if (input.plan_step_id === null || input.plan_step_id === '') {
            update.plan_step_id = null;
            after.plan_step_id = null;
          } else {
            const step = await ownedStep(admin, userId, companionId, input.plan_step_id);
            if (!step) return fail('plan step not found');
            update.plan_step_id = step.id as string;
            after.plan_step_id = step.id as string;
          }
        }

        const { error } = await admin.from('coaching_commitments').update(update).eq('id', commit.id);
        if (error) return fail(`could not update commitment: ${error.message}`);

        await logChange(admin, userId, companionId, 'commitment', commit.id, 'coach', 'updated', before, after, null);
        return ok({ commitment_id: commit.id, updated: after }, {
          change: { entityType: 'commitment', entityId: commit.id, action: 'updated' },
        });
      }

      // ── complete_commitment ──────────────────────────────────────────────
      case 'complete_commitment': {
        const commit = await ownedCommitment(admin, userId, companionId, input.commitment_id);
        if (!commit) return fail('commitment not found');
        if (commit.status === 'completed') return ok({ commitment_id: commit.id, already_completed: true });

        const { error } = await admin.from('coaching_commitments')
          .update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', commit.id);
        if (error) return fail(`could not complete commitment: ${error.message}`);

        await logChange(admin, userId, companionId, 'commitment', commit.id, 'coach', 'completed',
          { status: commit.status }, { status: 'completed' }, null);
        return ok({ commitment_id: commit.id, status: 'completed' }, {
          change: { entityType: 'commitment', entityId: commit.id, action: 'completed' },
        });
      }

      // ── cancel_commitment ────────────────────────────────────────────────
      case 'cancel_commitment': {
        const commit = await ownedCommitment(admin, userId, companionId, input.commitment_id);
        if (!commit) return fail('commitment not found');
        const reason = str(input.reason, 300);

        // Coach can't cancel user-created commitments unless the user asked
        if (commit.is_user_created) {
          return fail('This is a user-created commitment. The user must cancel it themselves.');
        }

        const { error } = await admin.from('coaching_commitments')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('id', commit.id);
        if (error) return fail(`could not cancel commitment: ${error.message}`);

        await logChange(admin, userId, companionId, 'commitment', commit.id, 'coach', 'cancelled',
          { status: commit.status }, { status: 'cancelled' }, reason);
        return ok({ commitment_id: commit.id, status: 'cancelled' }, {
          change: { entityType: 'commitment', entityId: commit.id, action: 'cancelled' },
        });
      }

      // ── show_in_tab (UI only, no DB writes) ──────────────────────────────
      case 'show_in_tab': {
        const tab = input.tab;
        if (tab !== 'plan' && tab !== 'commitments') return fail('tab must be "plan" or "commitments"');
        const highlightIds = Array.isArray(input.highlight_ids)
          ? input.highlight_ids.filter((id): id is string => typeof id === 'string')
          : [];
        return ok({ tab, highlighted: highlightIds.length }, {
          uiAction: { tab, highlightIds },
        });
      }

      // ── create_artifact ──────────────────────────────────────────────────
      case 'create_artifact': {
        const artifactType = input.artifact_type;
        if (typeof artifactType !== 'string' || !(ARTIFACT_TYPES as readonly string[]).includes(artifactType)) {
          return fail(`artifact_type must be one of: ${ARTIFACT_TYPES.join(', ')}`);
        }
        const title = str(input.title, 200);
        if (!title) return fail('title is required');
        const content = normalizeArtifactContent(input.content);
        if (Object.keys(content).length === 0) return fail('content is empty: provide text and/or items');

        const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const { data: dup } = await admin
          .from('coach_artifacts')
          .select('id, artifact_type, title, content')
          .eq('user_id', userId)
          .eq('companion_id', companionId)
          .eq('artifact_type', artifactType)
          .ilike('title', esc(title))
          .gte('created_at', since)
          .limit(1)
          .maybeSingle();
        if (dup) {
          const d = dup as { id: string; artifact_type: string; title: string; content: Record<string, unknown> };
          return ok({ artifact_id: d.id, already_existed: true }, { artifact: { id: d.id, artifactType: d.artifact_type, title: d.title, content: d.content } });
        }

        const { data: artifact, error } = await admin
          .from('coach_artifacts')
          .insert({
            user_id: userId,
            companion_id: companionId,
            goal_id: await activeGoalId(admin, userId),
            artifact_type: artifactType,
            title,
            content,
            status: 'proposed',
          })
          .select('id, artifact_type, title, content')
          .maybeSingle();
        if (error || !artifact) return fail(`could not create artifact: ${error?.message ?? 'unknown error'}`);
        const a = artifact as { id: string; artifact_type: string; title: string; content: Record<string, unknown> };
        return ok({ artifact_id: a.id }, { artifact: { id: a.id, artifactType: a.artifact_type, title: a.title, content: a.content } });
      }

      default:
        return fail(`unknown tool: ${name}`);
    }
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'tool failed');
  }
}

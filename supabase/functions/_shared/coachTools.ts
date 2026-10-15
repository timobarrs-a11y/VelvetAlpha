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

export interface CoachToolOutcome {
  /** JSON-serialisable result handed back to the model as the tool_result. */
  result: Record<string, unknown>;
  isError: boolean;
  artifact?: CoachArtifactResult;
}

/** Anthropic tool definitions for a coach. */
export const COACH_TOOLS = [
  {
    name: 'create_plan',
    description:
      'Propose a new plan (an ordered list of steps) toward the user\'s goal. The user sees it as a PROPOSAL they can accept and edit. ' +
      'Give each step a concrete quantity in its title (e.g. "15 push-ups, 4 days a week") and, where a floor exists, a minimum_value below which the step would not meaningfully count. ' +
      'Only one open plan per goal: check COACHING STATE first and use add_step/adjust_step to change an existing plan.',
    input_schema: {
      type: 'object',
      properties: {
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
    name: 'create_commitment',
    description:
      'Record a concrete, dated commitment for the user. Pass plan_step_id (from COACHING STATE) to tie it to a plan step so ticking one completes the other.',
    input_schema: {
      type: 'object',
      properties: {
        description: { type: 'string' },
        due_date: { type: 'string', description: 'ISO 8601 date or date-time' },
        plan_step_id: { type: 'string' },
      },
      required: ['description'],
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

const MAX_TEXT = 12000;
const MAX_ITEMS = 40;

function str(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

/** Escape LIKE wildcards so a model-supplied title is matched literally. */
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

function ok(result: Record<string, unknown>, artifact?: CoachArtifactResult): CoachToolOutcome {
  return { result, isError: false, artifact };
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

/** The plan must belong to the user, and to this coach or to no coach. */
async function ownedPlan(admin: Admin, userId: string, companionId: string, planId: unknown) {
  if (!isUuid(planId)) return null;
  const { data } = await admin
    .from('coach_plans')
    .select('id, companion_id')
    .eq('id', planId)
    .eq('user_id', userId)
    .maybeSingle();
  const plan = data as { id: string; companion_id: string | null } | null;
  if (!plan) return null;
  if (plan.companion_id && plan.companion_id !== companionId) return null;
  return plan;
}

async function ownedStep(admin: Admin, userId: string, companionId: string, stepId: unknown) {
  if (!isUuid(stepId)) return null;
  const { data } = await admin
    .from('coach_plan_steps')
    .select('id, plan_id, title, coach_proposed_title, user_set_title, commitment_id, override_log')
    .eq('id', stepId)
    .maybeSingle();
  const step = data as (Record<string, unknown> & { plan_id: string }) | null;
  if (!step) return null;
  const plan = await ownedPlan(admin, userId, companionId, step.plan_id);
  return plan ? step : null;
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

/**
 * Run one coach tool call. Every id the model supplies is verified against the
 * authenticated user (and this coach) before anything is read or written.
 */
export async function executeCoachTool(
  admin: Admin,
  userId: string,
  companionId: string,
  name: string,
  input: Record<string, unknown>,
): Promise<CoachToolOutcome> {
  try {
    switch (name) {
      case 'create_plan': {
        const title = str(input.title, 200);
        const steps = Array.isArray(input.steps) ? input.steps.slice(0, 12) : [];
        if (!title) return fail('title is required');
        if (steps.length === 0) return fail('at least one step is required');

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
            goal_id: await activeGoalId(admin, userId),
            title,
            description: str(input.description, 600),
            cadence: str(input.cadence, 60),
            status: 'proposed',
          })
          .select('id')
          .maybeSingle();
        if (error || !plan) return fail(`could not create plan: ${error?.message ?? 'unknown error'}`);

        const rows = steps
          .map((s, i) => stepRow((s && typeof s === 'object') ? s as Record<string, unknown> : {}, (plan as { id: string }).id, i))
          .filter((r): r is NonNullable<typeof r> => r !== null);
        const { data: inserted, error: stepErr } = await admin
          .from('coach_plan_steps')
          .insert(rows)
          .select('id, title, order_index');
        if (stepErr) {
          await admin.from('coach_plans').delete().eq('id', (plan as { id: string }).id);
          return fail(`could not create plan steps: ${stepErr.message}`);
        }
        return ok({
          plan_id: (plan as { id: string }).id,
          status: 'proposed',
          steps: ((inserted ?? []) as Array<{ id: string; title: string; order_index: number }>)
            .sort((a, b) => a.order_index - b.order_index)
            .map((s) => ({ step_id: s.id, title: s.title })),
          note: 'The user sees this as a proposal they can accept and edit.',
        });
      }

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
        return ok({ step_id: (step as { id: string }).id });
      }

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
        return ok({ step_id: step.id, action, now: after });
      }

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
        if (input.plan_step_id !== undefined && input.plan_step_id !== null && input.plan_step_id !== '') {
          const step = await ownedStep(admin, userId, companionId, input.plan_step_id);
          if (!step) return fail('plan step not found');
          stepId = step.id as string;
        }

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
            goal_id: await activeGoalId(admin, userId),
            plan_step_id: stepId,
            description,
            due_date: dueDate,
            status: 'pending',
            is_user_created: false,
          })
          .select('id')
          .maybeSingle();
        if (error || !commit) return fail(`could not create commitment: ${error?.message ?? 'unknown error'}`);

        if (stepId) {
          await admin.from('coach_plan_steps').update({ commitment_id: (commit as { id: string }).id }).eq('id', stepId).is('commitment_id', null);
        }
        return ok({ commitment_id: (commit as { id: string }).id });
      }

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
          return ok({ artifact_id: d.id, already_existed: true }, { id: d.id, artifactType: d.artifact_type, title: d.title, content: d.content });
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
        return ok({ artifact_id: a.id }, { id: a.id, artifactType: a.artifact_type, title: a.title, content: a.content });
      }

      default:
        return fail(`unknown tool: ${name}`);
    }
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'tool failed');
  }
}

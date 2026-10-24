import { describe, it, expect, vi } from 'vitest';

// The edge-function modules import the Deno-style package specifier; they only use it as a type.
vi.mock('npm:@supabase/supabase-js@2', () => ({ createClient: () => ({}) }));

import { executeCoachTool } from '../../../supabase/functions/_shared/coachTools';
import { computeSignals, type CoachingState } from '../../../supabase/functions/_shared/coachingState';

type Row = Record<string, any>;

/** Minimal in-memory stand-in for the slice of supabase-js the tools use. */
function fakeAdmin(tables: Record<string, Row[]>) {
  let seq = 0;
  const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;

  function from(name: string) {
    tables[name] ??= [];
    const filters: Array<(r: Row) => boolean> = [];
    let mode: 'select' | 'insert' | 'update' | 'delete' = 'select';
    let payload: Row | Row[] = {};
    let limit = Infinity;
    const like = (pat: string) =>
      new RegExp('^' + pat.replace(/\\([\\%_])/g, '\u0000$1').replace(/[.*+?^${}()|[\]]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.').replace(/\u0000(.)/g, (_m, c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) + '$', 'i');

    const run = () => {
      if (mode === 'insert') {
        const rows = (Array.isArray(payload) ? payload : [payload]).map(r => ({ id: uuid(), created_at: new Date().toISOString(), ...r }));
        tables[name].push(...rows);
        return rows;
      }
      const matched = tables[name].filter(r => filters.every(f => f(r)));
      if (mode === 'update') { matched.forEach(r => Object.assign(r, payload)); return matched; }
      if (mode === 'delete') { tables[name] = tables[name].filter(r => !matched.includes(r)); return matched; }
      return matched.slice(0, limit);
    };

    const b: any = {
      select: () => b,
      insert: (p: Row | Row[]) => { mode = 'insert'; payload = p; return b; },
      update: (p: Row) => { mode = 'update'; payload = p; return b; },
      delete: () => { mode = 'delete'; return b; },
      eq: (k: string, v: unknown) => { filters.push(r => r[k] === v); return b; },
      is: (k: string, v: unknown) => { filters.push(r => (r[k] ?? null) === v); return b; },
      in: (k: string, vs: unknown[]) => { filters.push(r => vs.includes(r[k])); return b; },
      ilike: (k: string, pat: string) => { filters.push(r => typeof r[k] === 'string' && like(pat).test(r[k])); return b; },
      gte: (k: string, v: string) => { filters.push(r => r[k] >= v); return b; },
      order: () => b,
      limit: (n: number) => { limit = n; return b; },
      maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
      then: (res: (v: unknown) => unknown) => res({ data: run(), error: null }),
    };
    return b;
  }
  return { from } as any;
}

const ME = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const COACH = '33333333-3333-4333-8333-333333333333';
const OTHER_COACH = '44444444-4444-4444-8444-444444444444';
const MY_PLAN = '55555555-5555-4555-8555-555555555555';
const THEIR_PLAN = '66666666-6666-4666-8666-666666666666';
const MY_STEP = '77777777-7777-4777-8777-777777777777';
const THEIR_STEP = '88888888-8888-4888-8888-888888888888';

function seeded() {
  return fakeAdmin({
    user_goals: [{ id: 'g1', user_id: ME, status: 'active', created_at: '2026-01-01' }],
    coach_plans: [
      { id: MY_PLAN, user_id: ME, companion_id: COACH, title: 'Fitness', status: 'active' },
      { id: THEIR_PLAN, user_id: OTHER, companion_id: OTHER_COACH, title: 'Theirs', status: 'active' },
    ],
    coach_plan_steps: [
      { id: MY_STEP, plan_id: MY_PLAN, title: '15 push-ups', coach_proposed_title: '15 push-ups', user_set_title: '5 push-ups', is_below_floor: true, override_log: [], order_index: 0 },
      { id: THEIR_STEP, plan_id: THEIR_PLAN, title: 'Secret', coach_proposed_title: 'Secret', override_log: [], order_index: 0 },
    ],
    coaching_commitments: [],
    coach_artifacts: [],
  });
}

describe('executeCoachTool ownership', () => {
  it("refuses add_step on another user's plan", async () => {
    const db = seeded();
    const out = await executeCoachTool(db, ME, COACH, 'add_step', { plan_id: THEIR_PLAN, title: 'x' });
    expect(out.isError).toBe(true);
    const { data } = await db.from('coach_plan_steps').eq('title', 'x').maybeSingle();
    expect(data).toBeNull();
  });

  it("refuses adjust_step on another user's step and leaves it untouched", async () => {
    const db = seeded();
    const out = await executeCoachTool(db, ME, COACH, 'adjust_step', { step_id: THEIR_STEP, action: 'revise', new_title: 'hacked' });
    expect(out.isError).toBe(true);
    const { data } = await db.from('coach_plan_steps').eq('id', THEIR_STEP).maybeSingle();
    expect(data.title).toBe('Secret');
  });

  it("refuses a plan that belongs to a different coach of the same user", async () => {
    const db = seeded();
    const out = await executeCoachTool(db, ME, OTHER_COACH, 'add_step', { plan_id: MY_PLAN, title: 'x' });
    expect(out.isError).toBe(true);
  });

  it('refuses to link a commitment to a step the user does not own', async () => {
    const db = seeded();
    const out = await executeCoachTool(db, ME, COACH, 'create_commitment', { description: 'do it', plan_step_id: THEIR_STEP });
    expect(out.isError).toBe(true);
  });

  it('rejects non-uuid ids', async () => {
    const out = await executeCoachTool(seeded(), ME, COACH, 'adjust_step', { step_id: "x' or '1'='1", action: 'hold' });
    expect(out.isError).toBe(true);
  });
});

describe('executeCoachTool behaviour', () => {
  it('creates a proposed plan linked to the active goal, with minimums', async () => {
    const db = seeded();
    const out = await executeCoachTool(db, ME, COACH, 'create_plan', {
      title: 'Strength', steps: [{ title: '15 push-ups', minimum_value: 8, unit: 'push-ups' }],
    });
    expect(out.isError).toBe(false);
    const { data: plan } = await db.from('coach_plans').eq('title', 'Strength').maybeSingle();
    expect(plan.status).toBe('proposed');
    expect(plan.goal_id).toBe('g1');
    const { data: step } = await db.from('coach_plan_steps').eq('plan_id', plan.id).maybeSingle();
    expect(step.minimum_value).toBe(8);
    expect(step.coach_minimum).toBe('8 push-ups');
  });

  it('does not create a duplicate plan with the same title', async () => {
    const db = seeded();
    const out = await executeCoachTool(db, ME, COACH, 'create_plan', { title: 'fitness', steps: [{ title: 'a' }] });
    expect(out.result.already_existed).toBe(true);
  });

  it('hold reinstates the coach proposal, clears the flag, and logs it', async () => {
    const db = seeded();
    const out = await executeCoachTool(db, ME, COACH, 'adjust_step', { step_id: MY_STEP, action: 'hold', reason: 'Below what works' });
    expect(out.isError).toBe(false);
    const { data } = await db.from('coach_plan_steps').eq('id', MY_STEP).maybeSingle();
    expect(data.user_set_title).toBeNull();
    expect(data.is_below_floor).toBe(false);
    expect(data.override_log.at(-1)).toMatchObject({ actor: 'coach', action: 'hold', to: '15 push-ups' });
  });

  it('refuses a plan when the user has no goal yet', async () => {
    const db = fakeAdmin({ user_goals: [], coach_plans: [], coach_plan_steps: [] });
    const out = await executeCoachTool(db, ME, COACH, 'create_plan', { title: 'Strength', steps: [{ title: '15 push-ups' }] });
    expect(out.isError).toBe(true);
    expect(String(out.result.error)).toContain('create_goal');
    const { data } = await db.from('coach_plans').eq('title', 'Strength').maybeSingle();
    expect(data).toBeNull();
  });

  it('refuses a commitment that is not tied to a plan step', async () => {
    const db = seeded();
    const out = await executeCoachTool(db, ME, COACH, 'create_commitment', { description: 'Push-ups today', goal_id: 'g1' });
    expect(out.isError).toBe(true);
    expect(String(out.result.error)).toContain('plan_step_id');
    const { data } = await db.from('coaching_commitments').eq('description', 'Push-ups today').maybeSingle();
    expect(data).toBeNull();
  });

  it('links a commitment to a step in both columns', async () => {
    const db = seeded();
    const out = await executeCoachTool(db, ME, COACH, 'create_commitment', { description: 'Push-ups today', plan_step_id: MY_STEP, due_date: '2026-12-01' });
    expect(out.isError).toBe(false);
    const { data: step } = await db.from('coach_plan_steps').eq('id', MY_STEP).maybeSingle();
    expect(step.commitment_id).toBe(out.result.commitment_id);
  });

  it('validates artifacts and returns the card data', async () => {
    const db = seeded();
    expect((await executeCoachTool(db, ME, COACH, 'create_artifact', { artifact_type: 'nope', title: 't', content: { text: 'x' } })).isError).toBe(true);
    expect((await executeCoachTool(db, ME, COACH, 'create_artifact', { artifact_type: 'routine', title: 't', content: {} })).isError).toBe(true);
    const ok = await executeCoachTool(db, ME, COACH, 'create_artifact', {
      artifact_type: 'reading_material', title: 'Week 1', content: { text: 'hi', items: [{ title: 'A', url: 'javascript:alert(1)' }, 'B'] },
    });
    expect(ok.isError).toBe(false);
    expect(ok.artifact?.content.items).toEqual([{ title: 'A' }, { title: 'B' }]);
  });
});

function state(over: Partial<CoachingState> = {}): CoachingState {
  return {
    goal: null, plans: [], commitments: [], tickEvents: [], artifacts: [],
    confidenceTrend: { latest: null, previous: null, direction: null },
    lastUserMessageBeforeSession: null, ...over,
  };
}

describe('computeSignals', () => {
  const now = new Date('2026-06-10T12:00:00Z');
  const commit = (over: Record<string, unknown> = {}) => ({ id: 'c', description: 'x', due_date: null, status: 'pending', progress_note: null, is_user_created: false, plan_step_id: null, ...over });

  it('does NOT report silence just because there are no unread updates', () => {
    const s = computeSignals(state({ commitments: [commit()], lastUserMessageBeforeSession: '2026-06-10T11:00:00Z' }), now);
    expect(s.find(x => x.key === 'silence')).toBeUndefined();
  });

  it('reports silence only after a real gap', () => {
    const s = computeSignals(state({ commitments: [commit()], lastUserMessageBeforeSession: '2026-06-01T12:00:00Z' }), now);
    expect(s.find(x => x.key === 'silence')).toBeDefined();
  });

  it('flags missed and overdue commitments and below-floor steps', () => {
    const s = computeSignals(state({
      commitments: [commit({ status: 'missed' }), commit({ due_date: '2026-06-01T00:00:00Z' })],
      plans: [{ id: 'p', title: 'p', status: 'active', cadence: null, steps: [{ id: 's', title: 't', coach_proposed_title: null, user_set_title: '5', status: 'pending', coach_minimum: '8', minimum_value: 8, is_below_floor: true, completed_at: null }] }],
    }), now).map(x => x.key);
    expect(s).toEqual(expect.arrayContaining(['missed_commitments', 'overdue_commitments', 'below_floor']));
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UserEvent } from '../calendarService';

// A tiny stand-in for the Supabase query builder: every call is recorded, and
// awaiting a query resolves to whatever the test queued for that table.
type Call = { table: string; method: string; args: unknown[] };
const calls: Call[] = [];
const results = new Map<string, Array<{ data: unknown; error: unknown }>>();

function query(table: string) {
  const builder: Record<string, unknown> = {};
  const record = (method: string) => (...args: unknown[]) => {
    calls.push({ table, method, args });
    return builder;
  };
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'or', 'gte', 'lte', 'gt', 'order', 'limit', 'not']) {
    builder[m] = record(m);
  }
  const next = () => results.get(table)?.shift() ?? { data: null, error: null };
  builder.single = () => Promise.resolve(next());
  builder.maybeSingle = () => Promise.resolve(next());
  builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(next()).then(resolve, reject);
  return builder;
}

vi.mock('../../shared/supabase/client', () => ({
  supabase: { from: (table: string) => { calls.push({ table, method: 'from', args: [] }); return query(table); } },
}));
vi.mock('../memoryBus', () => ({ getUserContext: vi.fn(), contextToPromptBlock: vi.fn() }));

const { calendarService } = await import('../calendarService');

function event(overrides: Partial<UserEvent>): UserEvent {
  return {
    id: 'e1', user_id: 'u1', companion_id: null, title: 'Event', description: '',
    event_type: 'task', event_date: new Date(2026, 9, 26, 9).toISOString(),
    reminder_time: null, all_day: false, location: null, completed: false,
    recurring: 'none', metadata: {}, created_at: '', updated_at: '',
    ...overrides,
  };
}

const updatesTo = (table: string) => calls.filter(c => c.table === table && c.method === 'update').map(c => c.args[0]);

beforeEach(() => {
  calls.length = 0;
  results.clear();
});

describe('calendarService.setCompleted', () => {
  it('ticks off a commitment shown on the calendar in the commitments table', async () => {
    const result = await calendarService.setCompleted(event({ id: 'commitment:c1', metadata: { commitment_id: 'c1' } }), true);
    const [patch] = updatesTo('coaching_commitments') as Array<Record<string, unknown>>;
    expect(patch.status).toBe('completed');
    expect(patch.completed_at).toEqual(expect.any(String));
    expect(calls).toContainEqual({ table: 'coaching_commitments', method: 'eq', args: ['id', 'c1'] });
    expect(result?.completed).toBe(true);
    expect(updatesTo('user_events')).toEqual([]);
  });

  it('marks only that day of a repeating event', async () => {
    results.set('user_events', [
      { data: { metadata: { source: 'atlas', completed_dates: ['2026-10-25'] } }, error: null },
      { data: { id: 'e1' }, error: null },
    ]);
    await calendarService.setCompleted(event({ recurring: 'daily', occurrence_date: '2026-10-26', series_date: 'x' }), true);
    expect(updatesTo('user_events')).toEqual([{ metadata: { source: 'atlas', completed_dates: ['2026-10-25', '2026-10-26'] } }]);
  });

  it('ticks off a one-off event directly', async () => {
    results.set('user_events', [{ data: { id: 'e1' }, error: null }]);
    await calendarService.setCompleted(event({}), true);
    expect(updatesTo('user_events')).toEqual([{ completed: true }]);
  });
});

describe('calendarService.updateEvent', () => {
  it('never writes the occurrence-only fields to the table', async () => {
    results.set('user_events', [{ data: { id: 'e1' }, error: null }]);
    await calendarService.updateEvent('e1', { title: 'New', series_date: 'a', occurrence_date: 'b' });
    expect(updatesTo('user_events')).toEqual([{ title: 'New' }]);
  });
});

describe('calendarService.getCalendarItems', () => {
  it('puts commitments beside events, in time order, marked as commitments', async () => {
    results.set('user_events', [
      { data: [event({ id: 'late', event_date: new Date(2026, 9, 26, 18).toISOString() })], error: null },
      { data: [], error: null },
    ]);
    results.set('coaching_commitments', [
      { data: [{ id: 'c1', description: 'Call the lender', due_date: new Date(2026, 9, 26, 9).toISOString(), status: 'pending', created_at: '' }], error: null },
    ]);
    const items = await calendarService.getCalendarItems('u1', new Date(2026, 9, 26), new Date(2026, 9, 26, 23, 59));
    expect(items.map(i => i.id)).toEqual(['commitment:c1', 'late']);
    expect(items[0]).toMatchObject({ title: 'Call the lender', all_day: true, completed: false, metadata: { commitment_id: 'c1' } });
  });
});

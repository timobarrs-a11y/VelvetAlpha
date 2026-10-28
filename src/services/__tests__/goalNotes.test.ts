import { describe, it, expect, vi } from 'vitest';
import { buildNotePrompt, captureGoalNote, parseNoteReply, worthConsidering, type NoteContext } from '../../../supabase/functions/_shared/goalNotes';

const ctx: NoteContext = {
  goals: [{ id: 'g1', title: 'Start my own company' }, { id: 'g2', title: 'Run a 5K' }],
  tasks: [{ id: 't1', description: 'File the trademark', goalId: 'g1' }],
  recentTitles: ['Choosing an LLC or a corporation'],
};

const TRADEMARK_REPLY = `Here's what filing with the trademark office involves.\n\n1. Search first: check the USPTO database so your name isn't already taken.\n2. Pick the class: each class of goods or services is filed and paid for separately.\n3. File online and pay the fee per class, then expect about 8 to 12 months before an examiner reviews it.\n\nThe requirement most people miss is proof the mark is in use, or a sworn statement that you intend to use it.`;

describe('worthConsidering: most replies never cost a model call', () => {
  it('lets through a substantive reply with steps and requirements', () => {
    expect(worthConsidering(TRADEMARK_REPLY)).toBe(true);
  });
  it('skips short replies, encouragement and questions back', () => {
    expect(worthConsidering('You can do this! Take it one step at a time.')).toBe(false);
    expect(worthConsidering('You are doing so well and I am proud of how you showed up this week. '.repeat(8))).toBe(false);
    expect(worthConsidering(('What matters most to you about the name, and what would make you feel it is right? ').repeat(4).trim())).toBe(false);
  });
});

describe('parseNoteReply', () => {
  const good = { save: true, title: 'Trademark filing: what the USPTO needs', summary: 'Filing needs a clear mark, a class and a fee per class.', keyPoints: ['Search the USPTO database', 'Pick the class', 'Pay per class'], nextStep: 'Search the database', goalId: 'g1', taskId: 't1' };

  it('turns a good reply into a note tied to the goal and the task', () => {
    expect(parseNoteReply(`Sure: ${JSON.stringify(good)}`, ctx)).toEqual({
      title: good.title, summary: good.summary, keyPoints: good.keyPoints, nextStep: 'Search the database', goalId: 'g1', commitmentId: 't1',
    });
  });
  it('says no when the model says no, or sends nothing usable', () => {
    expect(parseNoteReply('{"save": false}', ctx)).toBeNull();
    expect(parseNoteReply('no json here', ctx)).toBeNull();
    expect(parseNoteReply(null, ctx)).toBeNull();
    expect(parseNoteReply(JSON.stringify({ ...good, keyPoints: [] }), ctx)).toBeNull();
    expect(parseNoteReply(JSON.stringify({ ...good, title: 'x' }), ctx)).toBeNull();
  });
  it('only accepts a goal and a task it was given', () => {
    expect(parseNoteReply(JSON.stringify({ ...good, goalId: 'made-up' }), ctx)).toBeNull();
    expect(parseNoteReply(JSON.stringify({ ...good, goalId: 'made-up' }), { ...ctx, goals: [ctx.goals[0]] })?.goalId).toBe('g1');
    expect(parseNoteReply(JSON.stringify({ ...good, taskId: 'made-up' }), ctx)?.commitmentId).toBeNull();
  });
  it('skips a note whose title repeats one already saved', () => {
    expect(parseNoteReply(JSON.stringify({ ...good, title: 'choosing an LLC, or a corporation?' }), ctx)).toBeNull();
  });
  it('trims and limits what it keeps', () => {
    const note = parseNoteReply(JSON.stringify({ ...good, keyPoints: Array.from({ length: 12 }, (_, i) => `  point ${i}  `), summary: 'x'.repeat(2000) }), ctx)!;
    expect(note.keyPoints).toHaveLength(7);
    expect(note.keyPoints[0]).toBe('point 0');
    expect(note.summary.length).toBe(900);
  });
});

describe('the prompt', () => {
  it('lists their goals, open tasks and saved titles, and what is and is not worth saving', () => {
    const { system, user } = buildNotePrompt(ctx, 'How do I file the trademark?', TRADEMARK_REPLY);
    expect(system).toContain('g1: Start my own company');
    expect(system).toContain('t1: File the trademark');
    expect(system).toContain('Choosing an LLC or a corporation');
    expect(system).toContain('Never invent a fee, date, name or step');
    expect(user).toContain('How do I file the trademark?');
    expect(user).toContain('Search first');
  });
});

// A stand-in for the database: each table answers with what it was given, whatever the query.
function fakeAdmin(tables: Record<string, { data?: unknown; count?: number }>) {
  const inserted: Array<{ table: string; row: Record<string, unknown> }> = [];
  const builder = (table: string) => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'gte', 'limit', 'order']) b[m] = () => b;
    b.then = (res: (v: unknown) => unknown) => res({ data: tables[table]?.data ?? [], count: tables[table]?.count ?? 0, error: null });
    b.insert = (row: Record<string, unknown>) => { inserted.push({ table, row }); return Promise.resolve({ error: null }); };
    return b;
  };
  return { admin: { from: builder }, inserted };
}

describe('captureGoalNote', () => {
  const base = { anthropicKey: 'k', model: 'm', userId: 'u1', companionId: 'c1', userMessage: 'How do I file the trademark?', assistantMessage: TRADEMARK_REPLY };
  const tables = {
    user_goals: { data: [{ id: 'g1', title: 'Start my own company', source_companion_id: 'c1' }] },
    coaching_commitments: { data: [{ id: 't1', description: 'File the trademark', goal_id: 'g1' }] },
    goal_notes: { data: [], count: 0 },
  };
  const modelSays = JSON.stringify({ save: true, title: 'Trademark filing: what the USPTO needs', summary: 'Filing needs a clear mark, a class and a fee per class.', keyPoints: ['Search first', 'Pick the class', 'Pay per class'], nextStep: null, goalId: 'g1', taskId: 't1' });

  it('saves the note, tied to the goal, the task and the coach that gave it', async () => {
    const { admin, inserted } = fakeAdmin(tables);
    expect(await captureGoalNote({ ...base, admin, callModel: async () => modelSays })).toBe('saved');
    expect(inserted).toHaveLength(1);
    expect(inserted[0].table).toBe('goal_notes');
    expect(inserted[0].row).toMatchObject({ user_id: 'u1', goal_id: 'g1', companion_id: 'c1', commitment_id: 't1', title: 'Trademark filing: what the USPTO needs' });
    expect(inserted[0].row.key_points).toEqual(['Search first', 'Pick the class', 'Pay per class']);
  });

  it('does not call the model for a reply that is not worth it', async () => {
    const { admin, inserted } = fakeAdmin(tables);
    const callModel = vi.fn();
    expect(await captureGoalNote({ ...base, assistantMessage: 'Nice work today!', admin, callModel })).toBe('not-worth-a-call');
    expect(callModel).not.toHaveBeenCalled();
    expect(inserted).toHaveLength(0);
  });

  it('saves nothing without a goal, past the daily cap, or when the model says no', async () => {
    const noGoal = fakeAdmin({ ...tables, user_goals: { data: [] } });
    expect(await captureGoalNote({ ...base, admin: noGoal.admin, callModel: async () => modelSays })).toBe('no-goal');
    const capped = fakeAdmin({ ...tables, goal_notes: { data: [], count: 30 } });
    const callModel = vi.fn();
    expect(await captureGoalNote({ ...base, admin: capped.admin, callModel })).toBe('capped');
    expect(callModel).not.toHaveBeenCalled();
    const no = fakeAdmin(tables);
    expect(await captureGoalNote({ ...base, admin: no.admin, callModel: async () => '{"save": false}' })).toBe('not-a-note');
    expect(no.inserted).toHaveLength(0);
  });
});

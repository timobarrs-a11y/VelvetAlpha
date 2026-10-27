import { describe, it, expect } from 'vitest';
import { ScriptEngine } from '../script/engine';
import { validateContent } from '../script/validate';
import { NEW_RUNTIME, type FlagValue, type LineBook, type ScriptDef, type ScriptHost, type ScriptRuntime, type Step } from '../script/types';

/** A world that only records what it is asked, and lets a test decide when things finish. */
function fakeHost(preset: 'warm' | 'calm' | 'bubbly' | 'dry' = 'warm') {
  const calls: string[] = [];
  const state = { walking: new Set<string>(), acting: new Set<string>(), sayOpen: false, choiceIdx: null as number | null, cardOpen: false, introOpen: false, mode: null as string | null, day: 1, minutes: 540, ready: { profile: false, plot: false }, world: {} as Record<string, { type: string; at?: string; lightOn?: boolean }> };
  const flags: Record<string, FlagValue> = {};
  const host: ScriptHost = {
    flags,
    clock: () => ({ day: state.day, minutes: state.minutes }),
    names: () => ({ player: 'Jordan', partner: 'Maya', town: 'Honeysuckle Hollow', preset }),
    setMode: (m) => { state.mode = m; calls.push(`mode:${m}`); },
    spawn: (n, at, c) => calls.push(`spawn:${n}@${JSON.stringify(at)}${c ? ':' + c : ''}`),
    despawn: (n) => calls.push(`despawn:${n}`),
    carry: (w, c) => calls.push(`carry:${w}:${c}`),
    place: (w, at) => calls.push(`place:${w}@${JSON.stringify(at)}`),
    walk: (w, to) => { state.walking.add(w); calls.push(`walk:${w}>${JSON.stringify(to)}`); },
    arrived: (w) => !state.walking.has(w),
    face: (w, t) => calls.push(`face:${w}>${t}`),
    act: (w, a) => { state.acting.add(w); calls.push(`act:${w}:${a}`); },
    actDone: (w) => !state.acting.has(w),
    emote: (w, e) => calls.push(`emote:${w}:${e}`),
    camera: (f) => calls.push(`camera:${JSON.stringify(f)}`),
    say: (w, text, blocking) => { calls.push(`say:${w}:${text}`); state.sayOpen = blocking; return 1.5; },
    sayDone: () => !state.sayOpen,
    showChoice: (l) => { calls.push(`choice:${l.join('|')}`); state.choiceIdx = null; },
    choiceMade: () => state.choiceIdx,
    showCard: (t, _b, _s, button) => { calls.push(`card:${t}`); state.cardOpen = !!button; },
    cardDone: () => !state.cardOpen,
    highlight: (t) => calls.push(`highlight:${t}`),
    outline: (s) => calls.push(`outline:${s ? s.objType : 'off'}`),
    give: (g) => calls.push(`give:${JSON.stringify(g)}`),
    deliver: (c, id) => calls.push(`deliver:${c}:${id}`),
    unlock: (w) => calls.push(`unlock:${w}`),
    setClock: (d, m) => calls.push(`clock:${d}:${m}`),
    intro: (k) => { calls.push(`intro:${k}`); state.introOpen = true; },
    introDone: () => !state.introOpen,
    release: (w) => calls.push(`release:${w.sort().join(',')}`),
    hold: (w) => calls.push(`hold:${w.join(',')}`),
    ready: (what) => state.ready[what],
    check: (w) => { const o = state.world[w.obj]; if (w.exists !== undefined) return !!o === w.exists; if (!o) return false; return (!w.is || o.type === w.is) && (!w.at || o.at === w.at) && (w.lightOn === undefined || o.lightOn === w.lightOn); },
  };
  return { host, calls, state, flags };
}

const BOOK: LineBook = {
  lines: {
    hello: 'Hello {player}, welcome to {town}.',
    voiced: { warm: 'warm line', calm: 'calm line', bubbly: 'bubbly line', dry: 'dry line' },
  },
  pools: { greet: ['a', 'b', 'c'] },
};

const make = (defs: ScriptDef[], preset?: 'warm' | 'calm' | 'bubbly' | 'dry', rt?: ScriptRuntime) => {
  const h = fakeHost(preset);
  const engine = new ScriptEngine(h.host, defs, BOOK, rt);
  const tick = (n = 1, dt = 0.1) => { for (let i = 0; i < n; i++) engine.tick(dt); };
  return { ...h, engine, tick };
};

const base = (id: string, steps: Step[], extra: Partial<ScriptDef> = {}): ScriptDef => ({ id, trigger: { on: 'newGame' }, mode: 'cutscene', steps, ...extra });

describe('running steps', () => {
  it('runs in order, and stops at a line until the player taps through it', () => {
    const t = make([base('s', [{ do: 'set', flag: 'a', value: 1 }, { do: 'say', who: 'maya', line: 'hello' }, { do: 'set', flag: 'b', value: 2 }])]);
    t.engine.startNewGame();
    t.tick(3);
    expect(t.flags).toEqual({ a: 1 });
    expect(t.calls).toContain('say:maya:Hello Jordan, welcome to Honeysuckle Hollow.');
    t.state.sayOpen = false;
    t.tick(2);
    expect(t.flags).toEqual({ a: 1, b: 2 });
    expect(t.engine.rt.done).toEqual(['s']);
    expect(t.engine.isActive()).toBe(false);
    expect(t.state.mode).toBeNull();
  });

  it('waits for a walk to finish, and lets go of the people it directed at the end', () => {
    const t = make([base('s', [{ do: 'spawn', npc: 'dez', at: 'door' }, { do: 'walk', who: 'dez', to: 'mark:inside' }, { do: 'set', flag: 'in', value: true }])]);
    t.engine.startNewGame();
    t.tick(3);
    expect(t.flags.in).toBeUndefined();
    t.state.walking.delete('dez');
    t.tick(2);
    expect(t.flags.in).toBe(true);
    expect(t.calls).toContain('release:dez');
  });

  it('can walk without waiting', () => {
    const t = make([base('s', [{ do: 'walk', who: 'maya', to: 'x', wait: false }, { do: 'set', flag: 'a', value: 1 }])]);
    t.engine.startNewGame();
    t.tick(2);
    expect(t.flags.a).toBe(1);
  });

  it('waits some seconds, or for an event that happens after the wait began', () => {
    const t = make([base('s', [{ do: 'wait', seconds: 1 }, { do: 'set', flag: 'a', value: 1 }, { do: 'wait', until: { event: 'obj.placed', match: { objType: 'sofa' } } }, { do: 'set', flag: 'b', value: 1 }])]);
    t.engine.startNewGame();
    t.tick(5);
    expect(t.flags.a).toBeUndefined();
    t.tick(8);
    expect(t.flags.a).toBe(1);
    t.engine.emit({ type: 'obj.placed', objType: 'lamp' });
    t.tick(2);
    expect(t.flags.b).toBeUndefined();
    t.engine.emit({ type: 'obj.placed', objType: 'sofa' });
    t.tick(2);
    expect(t.flags.b).toBe(1);
  });

  it('a card with a button waits for it; one without does not', () => {
    const t = make([base('s', [{ do: 'card', title: 'One', body: 'x' }, { do: 'card', title: 'Two', body: 'x', button: 'Got it' }, { do: 'set', flag: 'a', value: 1 }])]);
    t.engine.startNewGame();
    t.tick(3);
    expect(t.calls.filter((c) => c.startsWith('card:'))).toEqual(['card:One', 'card:Two']);
    expect(t.flags.a).toBeUndefined();
    t.state.cardOpen = false;
    t.tick(2);
    expect(t.flags.a).toBe(1);
  });

  it('an opening shot plays first and the script waits for it to end', () => {
    const t = make([base('s', [{ do: 'intro', kind: 'arrival' }, { do: 'set', flag: 'a', value: 1 }])]);
    t.engine.startNewGame();
    t.tick(3);
    expect(t.calls).toContain('intro:arrival');
    expect(t.flags.a).toBeUndefined();
    t.state.introOpen = false;
    t.tick(2);
    expect(t.flags.a).toBe(1);
  });

  it('branches on a condition', () => {
    const t = make([base('s', [{ do: 'set', flag: 'x', value: 'yes' }, { do: 'if', cond: { flag: 'x', equals: 'yes' }, then: [{ do: 'set', flag: 'r', value: 'then' }], else: [{ do: 'set', flag: 'r', value: 'else' }] }])]);
    t.engine.startNewGame();
    t.tick(3);
    expect(t.flags.r).toBe('then');
  });
});

describe('lines', () => {
  it('speaks in the companion\'s voice', () => {
    for (const preset of ['warm', 'calm', 'bubbly', 'dry'] as const) {
      const t = make([base('s', [{ do: 'say', who: 'maya', line: 'voiced' }])], preset);
      t.engine.startNewGame();
      t.tick(2);
      expect(t.calls.find((c) => c.startsWith('say:'))).toBe(`say:maya:${preset} line`);
    }
  });

  it('a pool does not repeat until it has been all the way through', () => {
    const t = make([base('s', [{ do: 'wait', seconds: 0 }], { once: false })]);
    const seen = [0, 1, 2, 3, 4, 5].map(() => t.engine.text({ pool: 'greet' }));
    expect(new Set(seen.slice(0, 3)).size).toBe(3);
    expect(new Set(seen.slice(3, 6)).size).toBe(3);
  });

  it('in a beat, a line is shown for a moment and play goes on without a tap', () => {
    const t = make([base('s', [{ do: 'say', who: 'dez', line: 'hello' }, { do: 'set', flag: 'a', value: 1 }], { mode: 'beat' })]);
    t.engine.startNewGame();
    t.tick(2);
    expect(t.flags.a).toBeUndefined();
    t.tick(20, 0.1);
    expect(t.flags.a).toBe(1);
  });
});

describe('choices', () => {
  const script = base('s', [
    { do: 'choice', options: [
      { label: 'Keep', default: true, set: { couch: 'mine' }, steps: [{ do: 'set', flag: 'kept', value: true }] },
      { label: 'Move', set: { couch: 'theirs' }, steps: [{ do: 'set', flag: 'moved', value: true }] },
    ] },
    { do: 'set', flag: 'done', value: true },
  ]);

  it('takes the option picked, sets its flags and plays its steps', () => {
    const t = make([script]);
    t.engine.startNewGame();
    t.tick(2);
    expect(t.calls).toContain('choice:Keep|Move');
    t.state.choiceIdx = 1;
    t.tick(3);
    expect(t.flags).toEqual({ couch: 'theirs', moved: true, done: true });
  });

});

describe('saving mid-script', () => {
  const steps: Step[] = [
    { do: 'set', flag: 'before', value: 1 },
    { do: 'choice', options: [
      { label: 'A', default: true, steps: [{ do: 'set', flag: 'a1', value: 1 }, { do: 'checkpoint' }, { do: 'wait', until: { event: 'go' } }, { do: 'set', flag: 'a2', value: 1 }] },
      { label: 'B', steps: [] },
    ] },
    { do: 'set', flag: 'after', value: 1 },
  ];

  it('comes back at the last checkpoint, inside the branch, and does not repeat earlier steps', () => {
    const first = make([base('s', steps)]);
    first.engine.startNewGame();
    first.tick(2);
    first.state.choiceIdx = 0;
    first.tick(3);
    expect(first.flags.a1).toBe(1);
    const saved = JSON.parse(JSON.stringify(first.engine.rt)) as ScriptRuntime;
    expect(saved.active!.path).toHaveLength(2);

    const second = make([base('s', steps)], 'warm', saved);
    second.flags.before = 1; second.flags.a1 = 1; // the flags are saved with the game
    second.engine.resume();
    second.tick(2);
    expect(second.calls.filter((c) => c.startsWith('choice:'))).toEqual([]);
    expect(second.flags.a2).toBeUndefined();
    second.engine.emit({ type: 'go' });
    second.tick(3);
    expect(second.flags).toMatchObject({ a2: 1, after: 1 });
    expect(second.engine.rt.done).toEqual(['s']);
  });
});

describe('triggers, queue and interruptions', () => {
  it('starts a script when its condition becomes true, once', () => {
    const t = make([base('late', [{ do: 'set', flag: 'ran', value: 1 }], { trigger: { on: 'cond', cond: { time: { after: 600 } } }, mode: 'beat' })]);
    t.tick(3);
    expect(t.flags.ran).toBeUndefined();
    t.state.minutes = 700;
    t.tick(3);
    expect(t.flags.ran).toBe(1);
    t.flags.ran = 0; t.tick(5);
    expect(t.flags.ran).toBe(0);
  });

  it('a repeating script runs every time and takes variables from the event', () => {
    const d = base('delivery', [{ do: 'say', who: 'dez', line: { pool: 'greet' } }, { do: 'set', flag: 'last', value: '$category' }],
      { trigger: { on: 'cond', cond: { event: 'delivery.due' } }, mode: 'beat', once: false, vars: { category: '$event.category' } });
    const t = make([d]);
    t.engine.emit({ type: 'delivery.due', category: 'food' });
    t.tick(30);
    expect(t.flags.last).toBe('food');
    t.engine.emit({ type: 'delivery.due', category: 'paint' });
    t.tick(30);
    expect(t.flags.last).toBe('paint');
    expect(t.engine.rt.done).toEqual([]);
  });

  it('runs the higher priority first when several are waiting', () => {
    const t = make([
      base('low', [{ do: 'set', flag: 'order', value: 'low' }], { priority: 1 }),
      base('high', [{ do: 'set', flag: 'order', value: 'high' }], { priority: 9 }),
    ]);
    t.engine.startNewGame();
    t.tick(1);
    expect(t.flags.order).toBe('high');
    t.tick(2);
    expect(t.flags.order).toBe('low');
  });

  it('a beat waiting on the player steps aside for a delivery, then carries on, keeping what happened meanwhile', () => {
    const beat = base('chapter', [{ do: 'wait', until: { event: 'lamp.placed' } }, { do: 'set', flag: 'chapterDone', value: 1 }], { mode: 'beat', priority: 1 });
    const delivery = base('delivery', [{ do: 'set', flag: 'delivered', value: 1 }, { do: 'wait', seconds: 1 }], { trigger: { on: 'cond', cond: { event: 'delivery.due' } }, mode: 'beat', once: false, priority: 5 });
    const t = make([beat, delivery]);
    t.engine.startNewGame();
    t.tick(2);
    expect(t.engine.state()?.id).toBe('chapter');
    t.engine.emit({ type: 'delivery.due' });
    t.tick(1);
    expect(t.engine.state()?.id).toBe('delivery');
    // The player places the lamp while Dez is at the door.
    t.engine.emit({ type: 'lamp.placed' });
    t.tick(30);
    expect(t.flags.delivered).toBe(1);
    expect(t.flags.chapterDone).toBe(1);
    expect(t.engine.rt.done).toContain('chapter');
  });

  it('never interrupts a cutscene', () => {
    const scene = base('scene', [{ do: 'wait', until: { event: 'never' } }], { priority: 0 });
    const urgent = base('urgent', [{ do: 'set', flag: 'u', value: 1 }], { trigger: { on: 'cond', cond: { event: 'ping' } }, priority: 9, mode: 'beat' });
    const t = make([scene, urgent]);
    t.engine.startNewGame(); t.tick(2);
    t.engine.emit({ type: 'ping' }); t.tick(5);
    expect(t.flags.u).toBeUndefined();
    expect(t.engine.state()?.id).toBe('scene');
  });

  it('a sub-script runs inside and counts as done', () => {
    const t = make([
      base('main', [{ do: 'run', script: 'child' }, { do: 'set', flag: 'after', value: 1 }]),
      base('child', [{ do: 'set', flag: 'inChild', value: 1 }], { trigger: { on: 'cond', cond: { scriptDone: 'never' } }, mode: 'beat' }),
    ]);
    t.engine.startNewGame(); t.tick(3);
    expect(t.flags).toEqual({ inChild: 1, after: 1 });
    expect(t.engine.rt.done.sort()).toEqual(['child', 'main']);
  });

  it('returning players: marked done without ever playing', () => {
    const t = make([base('opening.moveIn', [{ do: 'set', flag: 'ran', value: 1 }]), base('tutorial.ch7', [], { trigger: { on: 'cond', cond: { flag: 'opening.done' } } })]);
    t.engine.markDone(['opening.', 'tutorial.']);
    t.engine.startNewGame(); t.tick(3);
    expect(t.flags.ran).toBeUndefined();
    expect(t.engine.rt.done.sort()).toEqual(['opening.moveIn', 'tutorial.ch7']);
  });
});

describe('content checks', () => {
  const ok = base('ok', [{ do: 'say', who: 'maya', line: 'voiced' }, { do: 'say', who: 'dez', line: { pool: 'greet' } }]);

  it('passes good content', () => {
    expect(validateContent([ok], BOOK, ['dez'])).toEqual([]);
  });

  it('reports every kind of mistake in plain words', () => {
    const bad: ScriptDef[] = [
      base('dup', []), base('dup', []),
      base('nodefault', [{ do: 'choice', options: [{ label: 'a' }, { label: 'b' }] }]),
      base('missing', [{ do: 'say', who: 'maya', line: 'nope' }, { do: 'say', who: 'maya', line: { pool: 'empty' } }, { do: 'run', script: 'ghost' }, { do: 'spawn', npc: 'stranger', at: 'door' }]),
    ];
    const errors = validateContent(bad, BOOK, ['dez']).join('\n');
    for (const piece of ['id used twice', 'exactly one default', '"nope" is not in the line book', 'pool "empty"', '"ghost", which does not exist', 'not a known visitor']) {
      expect(errors).toContain(piece);
    }
  });

  it('wants every companion voice', () => {
    const book: LineBook = { lines: { half: { warm: 'x' } }, pools: {} };
    expect(validateContent([base('s', [{ do: 'say', who: 'maya', line: 'half' }])], book, []).join()).toContain('no calm version');
  });
});

describe('rules that keep a scene honest', () => {
  it('a wait on the world ends when the house is right, however it got there', () => {
    const t = make([base('s', [{ do: 'wait', until: { world: { obj: 'box.couch', is: 'sofa', at: 'mark:tv' } } }, { do: 'set', flag: 'placed', value: 1 }])]);
    t.engine.startNewGame(); t.tick(3);
    expect(t.flags.placed).toBeUndefined();
    t.state.world['box.couch'] = { type: 'sofa', at: 'mark:kitchen' }; t.tick(2);
    expect(t.flags.placed).toBeUndefined();
    t.state.world['box.couch'].at = 'mark:tv'; t.tick(2);
    expect(t.flags.placed).toBe(1);
  });

  it('a reload comes back at the last mode step, so the card and the allowed taps are rebuilt, and a wait that already holds passes', () => {
    const steps: Step[] = [
      { do: 'say', who: 'dez', line: 'hello' },
      { do: 'mode', mode: 'guided', allow: ['obj:box.couch'] },
      { do: 'card', title: 'Open the box', body: 'x' },
      { do: 'wait', until: { any: [{ event: 'obj.unpacked' }, { world: { obj: 'box.couch', is: 'sofa' } }] } },
      { do: 'set', flag: 'opened', value: 1 },
    ];
    const first = make([base('s', steps)]);
    first.engine.startNewGame(); first.tick(2); first.state.sayOpen = false; first.tick(3);
    expect(first.calls.filter((c) => c.startsWith('card:'))).toEqual(['card:Open the box']);
    // The player opens the box; the game saves before the engine sees the event.
    first.state.world['box.couch'] = { type: 'sofa' };
    const saved = JSON.parse(JSON.stringify(first.engine.rt)) as ScriptRuntime;
    expect(saved.active).toMatchObject({ id: 's', redo: true });
    const second = make([base('s', steps)], 'warm', saved);
    second.state.world['box.couch'] = { type: 'sofa' };
    second.engine.resume(); second.tick(3);
    expect(second.calls).toContain('mode:guided');
    expect(second.calls).toContain('card:Open the box');
    expect(second.calls.filter((c) => c.startsWith('say:'))).toEqual([]);
    expect(second.flags.opened).toBe(1);
    expect(second.engine.rt.done).toEqual(['s']);
  });

  it('a wait before any mode step is a resume point itself', () => {
    const steps: Step[] = [{ do: 'set', flag: 'a', value: 1 }, { do: 'wait', until: { flag: 'go' } }, { do: 'set', flag: 'b', value: 1 }];
    const first = make([base('s', steps, { mode: 'beat' })]);
    first.engine.startNewGame(); first.tick(2);
    const saved = JSON.parse(JSON.stringify(first.engine.rt)) as ScriptRuntime;
    const second = make([base('s', steps, { mode: 'beat' })], 'warm', saved);
    second.flags.a = 1; second.engine.resume(); second.tick(2);
    expect(second.flags.b).toBeUndefined();
    second.flags.go = true; second.tick(2);
    expect(second.flags.b).toBe(1);
  });

  it('waits for the host before starting a script that needs it, but not forever', () => {
    const t = make([base('s', [{ do: 'set', flag: 'ran', value: 1 }], { needs: { host: ['profile'], timeoutMs: 1000 } })]);
    t.engine.startNewGame(); t.tick(3);
    expect(t.flags.ran).toBeUndefined();
    t.state.ready.profile = true; t.tick(1);
    expect(t.flags.ran).toBe(1);
    const late = make([base('s', [{ do: 'set', flag: 'ran', value: 1 }], { needs: { host: ['plot'], timeoutMs: 500 } })]);
    late.engine.startNewGame(); late.tick(4);
    expect(late.flags.ran).toBeUndefined();
    late.tick(3);
    expect(late.flags.ran).toBe(1);
  });

  it('holds the residents it names from the first step and lets them go at the end', () => {
    const t = make([base('s', [{ do: 'set', flag: 'a', value: 1 }], { needs: { hold: ['jordan', 'maya'] } })]);
    t.engine.startNewGame(); t.tick(2);
    expect(t.calls[1]).toBe('hold:jordan,maya');
    expect(t.calls).toContain('release:jordan,maya');
  });

  it('waits for several walkers at once', () => {
    const t = make([base('s', [{ do: 'walk', who: 'jordan', to: 'a', wait: false }, { do: 'walk', who: 'maya', to: 'b', wait: false }, { do: 'wait', arrive: ['jordan', 'maya'] }, { do: 'set', flag: 'in', value: 1 }])]);
    t.engine.startNewGame(); t.tick(2);
    expect(t.flags.in).toBeUndefined();
    t.state.walking.delete('jordan'); t.tick(2);
    expect(t.flags.in).toBeUndefined();
    t.state.walking.delete('maya'); t.tick(2);
    expect(t.flags.in).toBe(1);
  });

  it('a guided lesson is not interrupted by a delivery; a beat is, and comes back at its last mode step', () => {
    const lesson = base('lesson', [{ do: 'mode', mode: 'guided', allow: ['obj:box'] }, { do: 'wait', until: { flag: 'opened' } }], { mode: 'beat', priority: 1 });
    const delivery = base('delivery', [{ do: 'set', flag: 'delivered', value: 1 }], { trigger: { on: 'cond', cond: { event: 'delivery.due' } }, mode: 'beat', once: false, priority: 5 });
    const t = make([lesson, delivery]);
    t.engine.startNewGame(); t.tick(2);
    t.engine.emit({ type: 'delivery.due' }); t.tick(3);
    expect(t.flags.delivered).toBeUndefined();
    expect(t.engine.state()?.id).toBe('lesson');
  });

  it('the validator insists on a fallback beside an event, a wait after a button, and silence while walking', () => {
    const bad: ScriptDef[] = [
      base('bare', [{ do: 'wait', until: { event: 'obj.unpacked' } }]),
      base('button', [{ do: 'card', title: 'Place it', body: 'x', button: 'Set it down' }, { do: 'set', flag: 'x', value: 1 }]),
      base('talking', [{ do: 'walk', who: 'maya', to: 'x', wait: false }, { do: 'say', who: 'dez', line: 'hello' }]),
    ];
    const errors = validateContent(bad, BOOK, ['dez']).join('\n');
    expect(errors).toContain('a wait on "obj.unpacked" has no flag or world condition');
    expect(errors).toContain('the card "Place it" has a button but no wait after it');
    expect(errors).toContain('"dez" speaks while maya is still walking');
    const good: ScriptDef[] = [
      base('ok', [
        { do: 'walk', who: 'maya', to: 'x', wait: false }, { do: 'wait', arrive: ['maya'] }, { do: 'say', who: 'dez', line: 'hello' },
        { do: 'card', title: 'Place it', body: 'x', button: 'Set it down' }, { do: 'wait', until: { any: [{ event: 'obj.placed' }, { world: { obj: 'box', is: 'sofa' } }] } },
      ]),
      base('beatTalk', [{ do: 'walk', who: 'maya', to: 'x', wait: false }, { do: 'say', who: 'maya', line: 'hello' }], { mode: 'beat' }),
    ];
    expect(validateContent(good, BOOK, ['dez'])).toEqual([]);
  });
});

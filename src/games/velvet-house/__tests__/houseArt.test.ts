import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createHouseArt } from '../art/houseArt.js';
import { INITIAL_OBJS } from '../state/objects';

function stubCtx(): { ctx: CanvasRenderingContext2D; calls: { n: number } } {
  const calls = { n: 0 };
  const store: Record<string | symbol, unknown> = {};
  const gradient = { addColorStop: () => {} };
  const ctx: unknown = new Proxy(store, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'canvas') return { width: 640, height: 440, clientWidth: 640, clientHeight: 440 };
      if (key === 'measureText') return () => ({ width: 10 });
      return (..._args: unknown[]) => {
        calls.n++;
        return gradient;
      };
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  });
  return { ctx: ctx as CanvasRenderingContext2D, calls };
}

beforeAll(() => {
  const realCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    if (tag === 'canvas') {
      const { ctx } = stubCtx();
      return { width: 640, height: 440, getContext: () => ctx } as unknown as HTMLCanvasElement;
    }
    return realCreate(tag);
  }) as typeof document.createElement);
});

// A context that records the geometry it is asked to draw, so two frames can be compared.
function recordingCtx(): { ctx: CanvasRenderingContext2D; sig: () => string; vec: () => number[]; reset: () => void } {
  const { ctx: base } = stubCtx();
  let log: string[] = [];
  let nums: number[] = [];
  const ctx = new Proxy(base as unknown as Record<string | symbol, unknown>, {
    get(target, key) {
      const v = target[key];
      if (typeof key === 'string' && /^(moveTo|lineTo|ellipse|arc|quadraticCurveTo|bezierCurveTo|fillRect|translate|drawImage)$/.test(key)) {
        return (...a: unknown[]) => {
          const n = a.filter((x): x is number => typeof x === 'number');
          log.push(key + n.map((x) => x.toFixed(1)).join(','));
          nums.push(...n);
          return typeof v === 'function' ? (v as (...r: unknown[]) => unknown)(...a) : undefined;
        };
      }
      return typeof v === 'function' ? (v as (...r: unknown[]) => unknown).bind(target) : v;
    },
    set(target, key, value) { target[key] = value; return true; },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, sig: () => log.join('|'), vec: () => nums, reset: () => { log = []; nums = []; } };
}

const PERSON = { level: 1, x: 5.5, y: 4.5, z: 0, face: [1, 0] as [number, number], pose: 'stand', walking: false, sit: false, hidden: false, seed: 1.5, id: 'j',
  look: { skin: '#C68E6A', hair: '#2B1D16', top: '#3E6E8E', bottom: '#2F3542', longHair: false } };

// How far apart two recorded frames are, or Infinity if they drew different things.
function apart(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity;
  return a.reduce((t, v, i) => t + Math.abs(v - b[i]), 0);
}

describe('character motion', () => {
  const scene = (person: Partial<typeof PERSON> & { act?: string }) => ({ level: 1, rot: 0, minutes: 600, day: 1, t: 1, dt: 0.016, objs: INITIAL_OBJS.map((o) => ({ ...o })), wallMode: 'up', chars: [{ ...PERSON, ...person }, { ...PERSON, seed: 3, x: 1.5, y: 1.5, level: 0 }] });

  // Draw settled in `from`, switch to `to`: the first frame must still look like `from`, and a while later like `to`.
  function check(from: Partial<typeof PERSON>, to: Partial<typeof PERSON>) {
    const rec = recordingCtx();
    const art = createHouseArt(rec.ctx);
    for (let i = 0; i < 90; i++) { rec.reset(); art.render(scene(from)); }
    const before = rec.vec();
    const ref = recordingCtx(), refArt = createHouseArt(ref.ctx);
    for (let i = 0; i < 90; i++) { ref.reset(); refArt.render(scene(to)); }
    const settled = ref.vec();
    rec.reset(); art.render(scene(to));
    const first = rec.vec();
    for (let i = 0; i < 90; i++) { rec.reset(); art.render(scene(to)); }
    return { first, before, settled, end: rec.vec() };
  }

  it('swings round to a new facing instead of snapping, then settles', () => {
    const r = check({ face: [1, 0] }, { face: [-1, 0] });
    expect(apart(r.first, r.before), 'barely moved on the first frame').toBeLessThan(apart(r.first, r.settled));
    expect(apart(r.end, r.settled), 'ends up facing the new way').toBeLessThan(1);
  });

  it('slides into a seat instead of jumping there', () => {
    const r = check({ z: 0 }, { z: 0.45 });
    // Hair and hem springs alone move a snapped frame by ~130; sliding in leaves it far from the final seat.
    expect(apart(r.first, r.settled), 'first frame is still on its way to the seat').toBeGreaterThan(400);
    expect(apart(r.end, r.settled)).toBeLessThan(1);
  });

  it('blends between two activities instead of switching pose at once', () => {
    // Crouching to pet something, after standing: the first frame must not already be fully crouched.
    const r = check({ pose: 'stand' }, { pose: 'pet' });
    // Without a blend the first frame is the crouch itself, off by ~230 from springs alone.
    expect(apart(r.first, r.settled), 'first frame is still easing into the crouch').toBeGreaterThan(450);
    expect(apart(r.end, r.settled), 'fully in the new clip').toBeLessThan(1);
  });
})

describe('sleep and the drawn head', () => {
  const look = { skin: '#C68E6A', hair: '#2B1D16', top: '#3E6E8E', bottom: '#2F3542', longHair: true };
  const scene = (chars: object[], rot = 0) => ({ level: 1, rot, minutes: 1380, day: 1, t: 1, dt: 0.016, objs: INITIAL_OBJS.map((o) => ({ ...o })), wallMode: 'up', chars });

  it('draws a sleeper from every camera angle, and rolls over smoothly rather than popping', () => {
    const rec = recordingCtx();
    const art = createHouseArt(rec.ctx);
    for (let rot = 0; rot < 4; rot++) { rec.reset(); art.render(scene([{ ...PERSON, pose: 'sleep', z: 0.56, face: [1, 0], look }], rot)); expect(rec.vec().length).toBeGreaterThan(20); }
    // Across the roll-over (every 24 s) no frame jumps far from the one before it.
    let worst = 0, last: number[] | null = null;
    for (let i = 0; i < 1800; i++) {
      rec.reset(); art.render({ ...scene([{ ...PERSON, pose: 'sleep', z: 0.56, face: [1, 0], look }]), t: 1 + i / 30 });
      const v = rec.vec();
      if (last && last.length === v.length) worst = Math.max(worst, apart(v, last));
      last = v;
    }
    expect(worst).toBeLessThan(60);
  });

  it('draws the head without sprites facing every way, differently in each', () => {
    const sigs = new Set<string>();
    for (const face of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [1, -1]] as [number, number][]) {
      const rec = recordingCtx();
      const art = createHouseArt(rec.ctx);
      for (let i = 0; i < 60; i++) { rec.reset(); art.render(scene([{ ...PERSON, face, look, z: 0 }])); }
      sigs.add(rec.sig());
    }
    expect(sigs.size).toBe(6);
  });
});

describe('the stairs', () => {
  const look = { skin: '#C68E6A', hair: '#2B1D16', top: '#3E6E8E', bottom: '#2F3542', longHair: false };
  // The flight from the ground floor to the first: bottom (9.5, 3.25), top (9.5, 1.25).
  const climber = (s: number, up: boolean) => ({ ...PERSON, level: 0, x: 9.5, y: 3.25 - 2 * s, z: 0, look, walking: true,
    stair: { s, up, bx: 9.5, by: 3.25, tx: 9.5, ty: 1.25, low: 0, high: 1 } });
  const scene = (level: number, chars: object[], t: number, rot = 0) => ({ level, rot, minutes: 600, day: 1, t, dt: 0.016, objs: INITIAL_OBJS.map((o) => ({ ...o })), wallMode: 'up', chars });

  it('draws a climber on the flight below and coming up out of the stairwell above, both ways, from every angle', () => {
    for (const up of [true, false]) for (let rot = 0; rot < 4; rot++) {
      const { ctx, calls } = stubCtx();
      const art = createHouseArt(ctx);
      for (let i = 0; i <= 20; i++) {
        const s = i / 20;
        for (const level of [0, 1]) { const before = calls.n; art.render(scene(level, [climber(s, up)], 1 + i * 0.1, rot)); expect(calls.n, `s=${s} level ${level}`).toBeGreaterThan(before); }
      }
    }
  });

  it('rises smoothly up the flight instead of hopping a step at a time', () => {
    // The drawn head is placed with a translate; the house's own translates never move, so the one that
    // changes from frame to frame is the climber's head.
    const rec = recordingCtx();
    const art = createHouseArt(rec.ctx);
    const translates = () => rec.sig().split('|').filter(e => e.startsWith('translate'));
    let prev = new Set<string>(translates());
    const heads: number[] = [];
    for (let i = 0; i <= 40; i++) {
      rec.reset(); art.render(scene(0, [climber(i / 40, true)], 1 + i * 0.05));
      const now = translates(), fresh = now.filter(e => !prev.has(e));
      prev = new Set(now);
      if (fresh.length) heads.push(Math.min(...fresh.map(e => Number(e.slice(9).split(',')[1]))));
    }
    expect(heads.length).toBeGreaterThan(30);
    const jumps = heads.slice(1).map((y, i) => heads[i] - y);
    expect(Math.max(...jumps), 'no single frame climbs more than a few pixels').toBeLessThan(6);
    expect(heads[0] - heads[heads.length - 1], 'but over the flight the head rises most of a floor').toBeGreaterThan(50);
  });
});

describe('pets', () => {
  const pet = (over: object) => ({ id: 'pet1', kind: 'cat', coat: { c: '#D9822B', d: '#B5651D' }, name: 'Biscuit', level: 1, x: 4.5, y: 3.5, z: 0, face: [1, 0], pose: 'stand', seed: 0.4, alpha: 1, hidden: false, hearts: 0, want: null, door: false, bowl: null, litter: null, bowlFood: 0, litterUses: 0, ...over });
  const scene = (pets: object[], t = 1) => ({ level: 1, rot: 0, minutes: 600, day: 1, t, dt: 0.016, objs: INITIAL_OBJS.map((o) => ({ ...o })), wallMode: 'up', chars: [], pets });

  it('draws a cat and a dog in every pose, each one differently', () => {
    for (const kind of ['cat', 'dog']) {
      const sigs = new Set<string>();
      for (const pose of ['stand', 'walk', 'run', 'sit', 'sleep', 'eat', 'crouch', 'groom', 'play', 'happy']) {
        const rec = recordingCtx();
        createHouseArt(rec.ctx).render(scene([pet({ kind, pose, hearts: 2, want: 'feed' })]));
        expect(rec.vec().length, `${kind} ${pose}`).toBeGreaterThan(20);
        sigs.add(rec.sig());
      }
      expect(sigs.size, `${kind} poses all look different`).toBe(10);
    }
  });

  it('strides by the ground it covers, not the clock: still, it holds a pose; moving, the legs change', () => {
    const rec = recordingCtx();
    const art = createHouseArt(rec.ctx);
    const frame = (x: number) => { rec.reset(); art.render(scene([pet({ kind: 'dog', pose: 'walk', x })], 1)); return rec.sig(); };
    // Standing on the spot the stride amplitude eases off; once it has, frame after frame is the same picture.
    for (let i = 0; i < 90; i++) frame(4.5);
    const still = frame(4.5), again = frame(4.5);
    expect(again).toBe(still);
    const moved = frame(4.56);
    expect(moved).not.toBe(still);
  });

  it('leaves out a pet that is hidden or on another floor, and faces the way it is told', () => {
    const base = recordingCtx(); createHouseArt(base.ctx).render(scene([]));
    const hid = recordingCtx(); createHouseArt(hid.ctx).render(scene([pet({ hidden: true })]));
    const other = recordingCtx(); createHouseArt(other.ctx).render(scene([pet({ level: 2 })]));
    expect(hid.sig()).toBe(base.sig());
    expect(other.sig()).toBe(base.sig());
    const east = recordingCtx(); createHouseArt(east.ctx).render(scene([pet({ face: [1, 0] })]));
    const west = recordingCtx(); createHouseArt(west.ctx).render(scene([pet({ face: [-1, 0] })]));
    expect(east.sig()).not.toBe(west.sig());
  });
});

describe('house artwork', () => {
  it('draws every floor from every camera angle, day and night', () => {
    const { ctx, calls } = stubCtx();
    const art = createHouseArt(ctx);
    const objs = INITIAL_OBJS.map((o) => ({ ...o }));
    for (const minutes of [10 * 60, 23 * 60]) {
      for (let level = 0; level < 4; level++) {
        for (let rot = 0; rot < 4; rot++) {
          for (const wallMode of ['cut', 'up', 'down']) {
            const before = calls.n;
            art.render({ level, rot, minutes, day: 1, t: 1, dt: 0.016, objs, wallMode });
            expect(calls.n).toBeGreaterThan(before);
          }
        }
      }
    }
  });

  it('restores saved decorating and still draws', () => {
    const { ctx, calls } = stubCtx();
    const art = createHouseArt(ctx);
    art.applySave({
      owned: ['bed'],
      LOOKS: [{ floor: 'rubber' }, { paint: '#C8D7D1', paper: 'stripes', floor: 'herring' }, { floor: 'marble', paper: 'damask-plum' }],
      ROOMLOOK: [{}, { Kitchen: { floor: 'hexsage', paper: 'subway' } }, {}, {}],
      WALLOBJS: [{ type: 'print', level: 1, p: 'B', u: 2.2, z: 1.2, col: '#3D6B73' }, { type: 'nope', level: 1, p: 'B', u: 1, z: 1 }],
      yard: { t: [[0.8, 0.2, 0.9, 0, 0]], rainAt: 0, rainUntil: 0, rainCheck: -1 },
    });
    for (let level = 0; level < 4; level++) {
      const before = calls.n;
      art.render({ level, rot: 0, minutes: 600, day: 30, t: 1, dt: 0.016, objs: INITIAL_OBJS.map((o) => ({ ...o })), wallMode: 'up' });
      expect(calls.n).toBeGreaterThan(before);
    }
  });

  it('knows how to draw every starter furniture piece', () => {
    const { ctx } = stubCtx();
    const art = createHouseArt(ctx);
    INITIAL_OBJS.forEach((o) => expect(art.TYPES[o.type], o.type).toBeTruthy());
  });
});

describe('finding things on screen at every rotation', () => {
  const frame = (rot: number, objs: ReturnType<typeof INITIAL_OBJS.map>) => ({ level: 1, rot, minutes: 600, day: 1, t: 1, dt: 0.016, objs, wallMode: 'cut' as const });

  it('unproject undoes project, whichever way the house is turned', () => {
    const art = createHouseArt(stubCtx().ctx);
    const objs = INITIAL_OBJS.map(o => ({ ...o }));
    for (let rot = 0; rot < 4; rot++) {
      art.render(frame(rot, objs));
      for (const [x, y] of [[1, 1], [4.5, 3.25], [8.2, 6.5], [0.3, 7.5]]) {
        const [px, py] = art.project(x, y, 0);
        const [wx, wy] = art.unproject(px, py);
        expect(wx).toBeCloseTo(x, 5);
        expect(wy).toBeCloseTo(y, 5);
      }
    }
  });

  it('a tap on a piece finds that piece at every rotation, and only on its own floor', () => {
    const art = createHouseArt(stubCtx().ctx);
    const objs = INITIAL_OBJS.map(o => ({ ...o }));
    for (let rot = 0; rot < 4; rot++) {
      art.render(frame(rot, objs));
      for (const id of ['sofa', 'tvunit', 'dining', 'fridge']) {
        const o = objs.find(q => q.id === id)!;
        const t = art.TYPES[o.type];
        const [fw, fd] = o.rot % 2 ? [t.D, t.W] : [t.W, t.D];
        const [sx, sy] = art.project(o.x + fw / 2, o.y + fd / 2, (t.h || 1) / 2);
        expect(art.hitObject(1, sx, sy)?.id, `${id} at rotation ${rot}`).toBe(id);
        expect(art.hitObject(0, sx, sy)?.id).not.toBe(id);
      }
    }
  });
});

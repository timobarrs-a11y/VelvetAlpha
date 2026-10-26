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

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

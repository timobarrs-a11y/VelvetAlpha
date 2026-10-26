import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createHouseArt } from '../art/houseArt.js';
import { snapshot, type SaveContext } from '../state/save';
import { migrateSave } from '../state/saveMigration';
import { INITIAL_OBJS } from '../state/objects';

// A canvas stand-in, enough for the art to be created (as in houseArt.test.ts).
function stubCtx(): CanvasRenderingContext2D {
  const store: Record<string | symbol, unknown> = {};
  const gradient = { addColorStop: () => {} };
  return new Proxy(store, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'canvas') return { width: 640, height: 440 };
      if (k === 'measureText') return () => ({ width: 10 });
      return () => gradient;
    },
    set(t, k, v) { t[k] = v; return true; },
  }) as unknown as CanvasRenderingContext2D;
}
beforeAll(() => {
  const real = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) =>
    tag === 'canvas' ? ({ width: 640, height: 440, getContext: () => stubCtx() } as unknown as HTMLCanvasElement) : real(tag)) as typeof document.createElement);
});

const look = { skin: '#c68e6a', hair: '#2b1d16', top: '#4a5da8', topStyle: 'tee', bottom: '#2e3b57', accent: '#fff', longHair: false } as never;
const needs = { energy: 60, food: 50, hygiene: 70, fun: 40, comfort: 55, social: 45 };

function ctxWith(art: ReturnType<typeof createHouseArt>): SaveContext {
  return {
    day: 3, minutes: 600, money: 700, earnedToday: 0, spentToday: 0, power: true,
    fridge: { basic: 2, fresh: 1 }, dishes: 1, laundryPile: 2, bill: null, nextBillAt: null,
    objs: INITIAL_OBJS.map(o => ({ ...o })), storage: [], owned: ['couch'], closet: [], bond: 61, flags: {},
    simName: 'Sam', partnerName: 'Maya', look, mayaLook: look, needs: { jordan: needs, maya: needs },
    memories: [], coreMem: [], pastMem: [], townName: 'Honeysuckle Hollow', turns: [], rngSeed: 7,
    lifeGoal: null, settleDone: false, freeWill: true, style: {}, companion: null, wallMode: 'cut',
    looks: art.exportLooks(),
  };
}

const newArt = () => createHouseArt(stubCtx(), {} as never);

describe('saving the house', () => {
  it('keeps paint, wallpaper, floors, the attic and the yard through save and load', () => {
    const art = newArt();
    art.applyPaint(0, '#3A3340'); art.applyWallpaper(2, 'stripe-mint'); art.applyFloor(1, 'herring'); art.applyFloor(4, 'maple');
    const saved = JSON.parse(JSON.stringify(snapshot(ctxWith(art))));
    expect(saved.LOOKS[0].paint).toBe('#3A3340');
    expect(saved.LOOKS[2].paper).toBe('stripe-mint');
    expect(saved.LOOKS[1].floor).toBe('herring');
    expect(saved.LOOKS[4].floor).toBe('maple');
    expect(saved.yard.t).toHaveLength(80);

    const reloaded = newArt();
    reloaded.applySave(saved);
    const again = reloaded.exportLooks();
    expect(again.LOOKS).toEqual(art.exportLooks().LOOKS);
    expect(again.yard).toEqual(art.exportLooks().yard);
  });

  it('carries over what the game does not model, instead of resetting it', () => {
    const prev = {
      v: 2, career: { level: 2, perf: 4.5 }, mcareer: { level: 1, perf: 1 }, pets: [{ id: 'p1', kind: 'cat', name: 'Miso' }],
      dirt: [{ id: 'd1', level: 1 }], petFood: 3, support: 5, together: 9,
      jordan: { needs, skills: { cooking: 3, fitness: 1, logic: 0, creativity: 2, charisma: 0 }, mood: { happy: 90 }, workedDay: true, friendsDay: false },
      someFutureField: 'kept',
    };
    const saved = snapshot(ctxWith(newArt()), prev) as unknown as Record<string, unknown>;
    expect(saved.career).toEqual({ level: 2, perf: 4.5 });
    expect(saved.pets).toEqual(prev.pets);
    expect(saved.dirt).toEqual(prev.dirt);
    expect(saved.petFood).toBe(3);
    expect(saved.together).toBe(9);
    expect((saved.jordan as { skills: { cooking: number } }).skills.cooking).toBe(3);
    expect(saved.someFutureField).toBe('kept');
  });

  it('survives a second save: nothing carried over is lost after repeated saves', () => {
    const prev = { v: 2, career: { level: 3, perf: 1 }, pets: [{ id: 'p1' }] };
    let save = snapshot(ctxWith(newArt()), prev) as unknown as Record<string, unknown>;
    save = snapshot(ctxWith(newArt()), save) as unknown as Record<string, unknown>;
    expect(save.career).toEqual({ level: 3, perf: 1 });
    expect(save.pets).toEqual([{ id: 'p1' }]);
  });

  it('writes sensible defaults for a brand new game, and a save the loader accepts', () => {
    const saved = snapshot(ctxWith(newArt()), null);
    expect(saved.career).toEqual({ level: 0, perf: 0 });
    expect(migrateSave(JSON.parse(JSON.stringify(saved)))).not.toBeNull();
  });

  it('keeps stored furniture', () => {
    const ctx = ctxWith(newArt());
    ctx.storage = [{ id: 'sofa', type: 'sofa', level: 1, x: 1, y: 1, rot: 0 }];
    expect((snapshot(ctx) as unknown as { storage: unknown[] }).storage).toHaveLength(1);
  });
});

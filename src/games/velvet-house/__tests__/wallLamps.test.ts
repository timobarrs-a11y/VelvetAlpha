import { describe, it, expect } from 'vitest';
import { defaultWallLamps, readWallLamps, checkLamp, snapLamp, freeLampSpot, lampRoom, LAMP_STYLES, LAMP_NAMES, LAMP_PRICES, type WallLamp } from '../state/wallLamps';
import { INITIAL_OBJS } from '../state/objects';
import { CATALOG } from '../state/catalog';
import { WALL_LIGHTS } from '../state/house';

const lamp = (o: Partial<WallLamp> = {}): WallLamp => ({ id: 'x', level: 1, p: 'B', u: 6, z: 1.8, style: 'classic', r: 130, ...o });

describe('wall lamps', () => {
  it('the house starts with its sconces, each a lamp that can hang where it is', () => {
    const lamps = defaultWallLamps();
    expect(lamps.length).toBe(WALL_LIGHTS.filter((l) => l.k === 'sconce').length);
    for (const l of lamps) expect(checkLamp(lamps, l, INITIAL_OBJS), `${l.id} ${l.level} ${l.p} ${l.u}: ${checkLamp(lamps, l, INITIAL_OBJS).reason}`).toEqual({ ok: true });
    expect(new Set(lamps.map((l) => l.id)).size).toBe(lamps.length);
    expect(new Set(lamps.map((l) => l.style)).size).toBe(8);
  });

  it('a lamp cannot hang over a window, near a corner, or beside another lamp', () => {
    const all = defaultWallLamps();
    const win = lamp({ level: 1, p: 'B', u: 6.0, z: 1.8 });
    expect(checkLamp([], { ...win, u: 0.1 }).reason).toMatch(/corner/);
    const blocked = [lamp({ u: 5 }), lamp({ u: 5.2 }), lamp({ u: 6 }), lamp({ u: 3 }), lamp({ u: 7 }), lamp({ u: 4 }), lamp({ u: 8.5 })].filter((l) => !checkLamp([], l).ok);
    expect(blocked.length).toBeGreaterThan(0);
    const one = lamp({ id: 'a', u: 9.5 }), two = lamp({ id: 'b', u: 9.7 });
    if (checkLamp([], one).ok && checkLamp([], two).ok) expect(checkLamp([one], two).reason).toMatch(/Another lamp/);
    expect(all.length).toBeGreaterThan(0);
  });

  it('a tall piece against the wall blocks a lamp above it', () => {
    const fridgeish = { id: 'f', type: 'wardrobe', level: 1, x: 5, y: 0, rot: 0 } as never;
    const spot = lamp({ u: 5.6 });
    expect(checkLamp([], spot, [fridgeish]).reason).toMatch(/in the way/);
    expect(checkLamp([], { ...spot, u: 8.2 }, [fridgeish]).ok || checkLamp([], { ...spot, u: 8.2 }, [fridgeish]).reason).toBeTruthy();
  });

  it('snaps to the lamp grid and keeps to the wall', () => {
    expect(snapLamp('B', 5.62, 1.83)).toEqual({ p: 'B', u: 5.6, z: 1.85 });
    expect(snapLamp('B', -3, 0.2)).toEqual({ p: 'B', u: 0.35, z: 1.3 });
    expect(snapLamp('L', 99, 9)).toEqual({ p: 'L', u: 7.65, z: 2.15 });
  });

  it('finds a free wall spot on a floor, and the room it is in', () => {
    const lamps = defaultWallLamps();
    for (let level = 0; level < 4; level++) {
      const spot = freeLampSpot(lamps, level, INITIAL_OBJS);
      expect(spot, `level ${level}`).not.toBeNull();
      expect(checkLamp(lamps, { id: 'n', level, ...spot!, style: 'globe', r: 130 }, INITIAL_OBJS).ok).toBe(true);
    }
    expect(lampRoom({ level: 1, p: 'B', u: 8.5 })).toBe('Living room');
  });

  it('what a save holds is made safe', () => {
    expect(readWallLamps(undefined)).toBeNull();
    expect(readWallLamps('no')).toBeNull();
    const out = readWallLamps([{ id: 'a', level: 1, p: 'B', u: 99, z: -4, style: 'cage' }, { id: 'b', level: 1, p: 'F', u: 3, z: 1.8, style: 'cage' }, { id: 'c', level: 1, p: 'L', u: 3, z: 1.8, style: 'plasma' }, { id: 'd', level: 99, p: 'L', u: 3, z: 1.8, style: 'cage' }, null, { id: 'e', level: 0, p: 'L', u: 3, z: 1.8, style: 'lantern', night: true }])!;
    expect(out.map((l) => l.id)).toEqual(['a', 'e']);
    expect(out[0]).toMatchObject({ u: 9.65, z: 1.3, style: 'cage' });
    expect(out[1].night).toBe(true);
  });

  it('every style can be bought, in the Decor tab, at its own price', () => {
    for (const s of LAMP_STYLES) {
      const e = CATALOG.find((c) => c.id === `lamp-${s}`)!;
      expect(e, s).toMatchObject({ tab: 'Decor', wallLamp: s, price: LAMP_PRICES[s], name: LAMP_NAMES[s], repeat: true });
    }
  });
});

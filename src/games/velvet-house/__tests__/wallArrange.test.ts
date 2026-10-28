import { describe, it, expect, beforeAll, vi } from 'vitest';
import { createHouseArt } from '../art/houseArt.js';

// Wall pieces in Arrange: found under the pointer, slid along their wall, taken down into storage and hung again, saved with the house.
function stubCtx(): CanvasRenderingContext2D {
  const gradient = { addColorStop: () => {} };
  return new Proxy({} as Record<string | symbol, unknown>, {
    get(t, k) { if (k in t) return t[k]; if (k === 'canvas') return { width: 640, height: 440 }; if (k === 'measureText') return () => ({ width: 10 }); return () => gradient; },
    set(t, k, v) { t[k] = v; return true; },
  }) as unknown as CanvasRenderingContext2D;
}
beforeAll(() => {
  const realCreate = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => (tag === 'canvas'
    ? ({ width: 640, height: 440, getContext: () => stubCtx() } as unknown as HTMLCanvasElement) : realCreate(tag))) as typeof document.createElement);
});

describe('wall pieces in Arrange', () => {
  it('hung pieces have ids and names, and the one under a view point is found', () => {
    const art = createHouseArt(stubCtx());
    expect(art.hangWallObj(1, 'marquee', '#F4C430')).toBe(true);
    expect(art.hangWallObj(1, 'print')).toBe(true);
    const on = art.wallObjsOn(1);
    expect(on.map((w) => w.name)).toEqual(['Marquee sign', 'Framed print']);
    expect(new Set(on.map((w) => w.id)).size).toBe(2);
    for (const w of on) {
      const p = art.wallObjView(w.id)!;
      expect(art.hitWallObj(1, p[0], p[1])).toBe(w.id);
    }
    expect(art.hitWallObj(1, -500, -500)).toBeNull();
    expect(art.hitWallObj(2, art.wallObjView(on[0].id)![0], art.wallObjView(on[0].id)![1])).toBeNull();
  });

  it('slides along its wall under the pointer, up and down too, and never off the ends or into the floor', () => {
    const art = createHouseArt(stubCtx());
    art.hangWallObj(1, 'print');
    const [w] = art.wallObjsOn(1);
    const [cx, cy] = art.wallObjView(w.id)!;
    // Its centre follows the point: one wall unit along (which also drops it 16px on screen) and 5px up.
    const [tx, ty] = [cx + 32, cy + 16 - 5];
    expect(art.moveWallObj(w.id, tx, ty)).toBe(true);
    const moved = art.wallObjsOn(1)[0];
    expect(moved.p).toBe(w.p);
    expect(moved.u).not.toBe(w.u);
    const [nx, ny] = art.wallObjView(w.id)!;
    expect(Math.abs(nx - tx)).toBeLessThan(1.5);
    expect(Math.abs(ny - ty)).toBeLessThan(1.5);
    // Far past the end of the wall and the floor: it stops at the edges.
    art.moveWallObj(w.id, cx + 5000, cy + 5000);
    const clamped = art.wallObjsOn(1)[0];
    expect(clamped.u).toBeGreaterThanOrEqual(0.1);
    expect(clamped.z).toBeGreaterThanOrEqual(0.3);
    art.moveWallObj(w.id, cx - 5000, cy - 5000);
    const other = art.wallObjsOn(1)[0];
    expect(other.u).toBeGreaterThanOrEqual(0.1);
    expect(other.z + 0.62).toBeLessThanOrEqual(2.6);
    // A grab offset keeps the piece from jumping under the finger.
    art.moveWallObj(w.id, cx, cy);
    const [bx, by] = art.wallObjView(w.id)!;
    art.moveWallObj(w.id, bx + 20, by, [20, 0]);
    const [ax] = art.wallObjView(w.id)!;
    expect(Math.abs(ax - bx)).toBeLessThan(1.5);
  });

  it('knows when a piece overlaps another, so the outline can go red', () => {
    const art = createHouseArt(stubCtx());
    art.hangWallObj(1, 'print'); art.hangWallObj(1, 'wclock');
    const [a, b] = art.wallObjsOn(1);
    expect(art.wallObjClear(a.id)).toBe(true);
    const [bx, by] = art.wallObjView(b.id)!;
    art.moveWallObj(a.id, bx, by);
    expect(art.wallObjClear(a.id)).toBe(false);
    expect(art.wallObjClear('nonsense')).toBe(false);
  });

  it('comes down into storage and goes back up, and both survive a save', () => {
    const art = createHouseArt(stubCtx());
    art.hangWallObj(1, 'tapestry', '#E8DCC8');
    const [w] = art.wallObjsOn(1);
    expect(art.takeDownWallObj(w.id)).toBe('Woven tapestry');
    expect(art.wallObjsOn(1)).toEqual([]);
    expect(art.storedWallObjs()).toEqual([{ id: w.id, type: 'tapestry', name: 'Woven tapestry', col: '#E8DCC8' }]);
    expect(art.takeDownWallObj('nonsense')).toBeNull();
    const looks = art.exportLooks();
    expect(looks.WALLSTORE).toHaveLength(1);
    const again = createHouseArt(stubCtx());
    again.applySave(looks);
    expect(again.storedWallObjs().map((s) => s.id)).toEqual([w.id]);
    expect(again.rehangWallObj(w.id, 2)).toBe(true);
    expect(again.storedWallObjs()).toEqual([]);
    expect(again.wallObjsOn(2).map((x) => [x.id, x.type])).toEqual([[w.id, 'tapestry']]);
    expect(again.rehangWallObj(w.id, 2)).toBe(false);
  });

  it('gives ids to wall pieces from older saves', () => {
    const art = createHouseArt(stubCtx());
    art.applySave({ WALLOBJS: [{ type: 'print', level: 1, p: 'B', u: 2, z: 1.2 }] });
    const [w] = art.wallObjsOn(1);
    expect(w.id).toMatch(/^wall-/);
  });
});

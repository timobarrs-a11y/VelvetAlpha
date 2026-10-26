import { describe, it, expect } from 'vitest';
import { INITIAL_OBJS, type ObjectInstance } from '../state/objects';
import { checkPlacement, isMovable, centreAt, rotateAboutCentre, nextColour, otherFloors, relocate } from '../state/arrange';
import { buildWorld } from '../state/agents';

const fresh = () => INITIAL_OBJS.map(o => ({ ...o }));

describe('arrange mode', () => {
  it('accepts the starter house exactly as it is', () => {
    const objs = fresh();
    for (const o of objs.filter(isMovable)) expect(checkPlacement(objs, o), o.id).toEqual({ ok: true });
  });

  it('lets you move the washer and dryer, but never the stairs', () => {
    const objs = fresh();
    expect(isMovable(objs.find(o => o.id === 'laundry')!)).toBe(true);
    expect(isMovable(objs.find(o => o.type === 'flightY')!)).toBe(false);
  });

  it('refuses a spot through the outer wall, or on top of other furniture', () => {
    const objs = fresh();
    const washer = objs.find(o => o.id === 'laundry')!;
    washer.x = 9.5; washer.y = 4.7;
    expect(checkPlacement(objs, washer).ok).toBe(false);
    const tread = objs.find(o => o.id === 'tread')!;
    washer.x = tread.x; washer.y = tread.y;
    expect(checkPlacement(objs, washer)).toMatchObject({ ok: false, reason: expect.stringMatching(/treadmill/) });
  });

  it('moves the place people use it: the washer works from its new corner', () => {
    const objs = fresh();
    const washer = objs.find(o => o.id === 'laundry')!;
    centreAt(washer, 7, 2.5);
    expect(checkPlacement(objs, washer).ok).toBe(true);
    const slot = buildWorld(objs).slots.find(s => s.id === 'laundry:w')!;
    // The spot to stand at moved with it.
    expect(Math.hypot(slot.stand[0] - 7, slot.stand[1] - 2.5)).toBeLessThan(1.5);
  });

  it('turns about its own centre, and cycles colours when it has them', () => {
    const o: ObjectInstance = { id: 's', type: 'sofa', level: 1, x: 4, y: 3, rot: 0 };
    rotateAboutCentre(o);
    expect(o.rot).toBe(1);
    expect(Math.abs(o.x + 0.5 - (4 + 1.2))).toBeLessThan(0.3);
    expect(nextColour({ id: 'a', type: 'armchair', level: 1, x: 0, y: 0, rot: 0 })).toBe('#B5476E');
    expect(nextColour(o)).toBeNull();
  });

  it('lets light pieces be carried between the indoor floors, but not heavy or yard ones', () => {
    const objs = fresh();
    const get = (id: string) => objs.find(o => o.id === id)!;
    expect(otherFloors(get('sofa'))).toEqual([0, 2]);
    expect(otherFloors(get('desk'))).toEqual([0, 1]);
    expect(otherFloors(get('lamp0'))).toEqual([1, 2]);
    expect(otherFloors(get('bed'))).toEqual([]);
    expect(otherFloors(get('laundry'))).toEqual([]);
    expect(otherFloors(get('bench'))).toEqual([]);
    expect(otherFloors(get('stair01'))).toEqual([]);
  });

  it('carries a piece to another floor and sets it down on free floor', () => {
    const objs = fresh();
    const desk = objs.find(o => o.id === 'desk')!;
    expect(relocate(objs, desk, 1)).toBe(true);
    expect(desk.level).toBe(1);
    expect(checkPlacement(objs, desk)).toEqual({ ok: true });
    // The rest of the house still works with it in its new home.
    for (const o of objs.filter(isMovable)) expect(checkPlacement(objs, o), o.id).toEqual({ ok: true });
  });

  it('leaves a piece untouched when the other floor has no room for it', () => {
    const objs = fresh();
    // Fill the basement with moving boxes, wall to wall.
    for (let x = 0; x < 10; x += 0.5) for (let y = 0; y < 8; y += 0.5) objs.push({ id: `b${x}_${y}`, type: 'pbox', level: 0, x, y, rot: 0 });
    const desk = objs.find(o => o.id === 'desk')!;
    const before = { ...desk };
    expect(relocate(objs, desk, 0)).toBe(false);
    expect(desk).toEqual(before);
  });
});

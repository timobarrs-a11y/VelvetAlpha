import { describe, it, expect } from 'vitest';
import { INITIAL_OBJS, type ObjectInstance } from '../state/objects';
import { checkPlacement, isMovable, centreAt, rotateAboutCentre, nextColour, otherFloors, relocate, canStore } from '../state/arrange';
import { buildWorld } from '../state/agents';
import { ATTIC_STAIR_OBJS } from '../state/objects';
import { levelPath } from '../state/pathfinding';
import { STAIRS, ATTIC } from '../state/house';

const fresh = () => INITIAL_OBJS.map(o => ({ ...o }));

describe('arrange mode', () => {
  it('does not let someone who could not get around anyway make every spot impossible', () => {
    const objs = fresh();
    const lamp = objs.find((o) => o.id === 'lamp1')!;
    // A person standing inside the kitchen counter: unreachable with or without the lamp.
    const stuck = { level: 1, x: 0.7, y: 0.3 };
    const w = buildWorld(objs);
    void w;
    expect(checkPlacement(objs, lamp, [stuck])).toEqual({ ok: true });
  });

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

  it('lets any piece be carried between the indoor floors (nothing is too heavy), the yard included, but not the stairs', () => {
    const objs = fresh();
    const get = (id: string) => objs.find(o => o.id === id)!;
    expect(otherFloors(get('sofa'))).toEqual([0, 2, 3, 4]);
    expect(otherFloors(get('desk'))).toEqual([0, 1, 3, 4]);
    expect(otherFloors(get('lamp0'))).toEqual([1, 2, 3, 4]);
    expect(otherFloors(get('bed'))).toEqual([0, 1, 3, 4]);
    expect(otherFloors(get('tread'))).toEqual([1, 2, 3, 4]);
    expect(otherFloors(get('fridge'))).toEqual([0, 2, 3, 4]);
    expect(otherFloors(get('laundry'))).toEqual([1, 2, 3, 4]); // nothing is fixed
    expect(otherFloors(get('bench'))).toEqual([0, 1, 2, 4]);
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

  it('puts a treadmill on the lawn and a garden bench in the living room', () => {
    const objs = fresh();
    const tread = objs.find(o => o.id === 'tread')!;
    expect(relocate(objs, tread, 3)).toBe(true);
    expect(tread.level).toBe(3);
    expect(checkPlacement(objs, tread)).toEqual({ ok: true });
    const bench = objs.find(o => o.id === 'bench')!;
    expect(relocate(objs, bench, 1)).toBe(true);
    expect(checkPlacement(objs, bench)).toEqual({ ok: true });
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

  it('lets you store furniture, but not the stairs or built-in appliances', () => {
    const objs = fresh();
    const get = (id: string) => objs.find(o => o.id === id)!;
    expect(canStore(get('sofa'))).toBe(true);
    expect(canStore(get('bed'))).toBe(true);
    expect(canStore(get('fridge'))).toBe(false);
    expect(canStore(get('stair01'))).toBe(false);
  });

  it('builds the attic: stairs lead up from the hall, and its floor takes furniture', () => {
    const objs = [...fresh(), ...ATTIC_STAIR_OBJS.map(o => ({ ...o }))];
    // Main floor to attic is two flights.
    expect(levelPath(STAIRS, 1, ATTIC).map(l => l.st.id)).toEqual(['S12', 'S24']);
    for (const o of objs.filter(isMovable)) expect(checkPlacement(objs, o), o.id).toEqual({ ok: true });
    const desk = objs.find(o => o.id === 'desk')!;
    expect(otherFloors(desk)).toContain(ATTIC);
    expect(relocate(objs, desk, ATTIC)).toBe(true);
    expect(desk.level).toBe(ATTIC);
    expect(buildWorld(objs).slots.some(s => s.id.startsWith('desk:') && s.level === ATTIC)).toBe(true);
  });
});

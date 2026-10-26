import { describe, it, expect } from 'vitest';
import { INITIAL_OBJS, type ObjectInstance } from '../state/objects';
import { checkPlacement, isMovable, centreAt, rotateAboutCentre, nextColour } from '../state/arrange';
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
});

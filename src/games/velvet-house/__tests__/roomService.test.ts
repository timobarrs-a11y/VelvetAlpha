import { describe, expect, it } from 'vitest';
import { bedside, cartEntry } from '../systems/roomService';
import { INITIAL_OBJS } from '../state/objects';

describe('room service', () => {
  it('comes in upstairs at the top of the stairs', () => {
    expect(cartEntry(2)).toEqual([0.75, 7.5]);
  });
  it('parks on the open side of the bed, clear of it', () => {
    const bed = INITIAL_OBJS.find((o) => o.type === 'bed')!;
    const [x, y] = bedside(bed);
    expect(x).toBeGreaterThan(bed.x + 2.5);
    expect(y).toBeGreaterThan(bed.y);
    expect(y).toBeLessThan(bed.y + 1.6);
  });
});

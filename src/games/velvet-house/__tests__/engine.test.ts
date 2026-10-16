import { describe, it, expect } from 'vitest';
import { advanceClock } from '../engine/loop';

describe('advanceClock', () => {
  it('advances one game minute per second at normal speed', () => {
    expect(advanceClock(1, 600, 1, 1)).toEqual({ day: 1, minutes: 601 });
  });

  it('scales with game speed', () => {
    expect(advanceClock(1, 600, 1, 10)).toEqual({ day: 1, minutes: 610 });
  });

  it('rolls into the next day at midnight', () => {
    const r = advanceClock(3, 1439, 2, 1);
    expect(r.day).toBe(4);
    expect(r.minutes).toBeCloseTo(1, 6);
  });
});

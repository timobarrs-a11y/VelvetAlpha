import { describe, it, expect } from 'vitest';
import { steerTarget, steerVelocity, zoneForX } from '../touchControls';

describe('momentum touch controls', () => {
  it('splits the screen into steer and boost zones', () => {
    expect(zoneForX(0.2, false)).toBe('steer');
    expect(zoneForX(0.9, false)).toBe('boost');
    expect(zoneForX(0.9, true)).toBe('steer');
    expect(zoneForX(0.1, true)).toBe('boost');
  });

  it('steering is relative to the drag and scaled by sensitivity', () => {
    expect(steerTarget(400, 50, 'low')).toBeLessThan(steerTarget(400, 50, 'high'));
    expect(steerTarget(400, 0, 'medium')).toBe(400);
  });

  it('eases toward the target and respects max speed', () => {
    const vx = steerVelocity(0, 900, 400, 4.5);
    expect(vx).toBeGreaterThan(0);
    expect(vx).toBeLessThan(4.5);
    let v = 0;
    for (let i = 0; i < 30; i++) v = steerVelocity(v, 900, 400, 4.5);
    expect(v).toBeCloseTo(4.5, 2);
    expect(steerVelocity(2, 401, 400, 4.5)).toBeLessThan(2);
  });
});

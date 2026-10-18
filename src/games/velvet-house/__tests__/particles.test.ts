import { describe, it, expect } from 'vitest';
import { createParticles } from '../engine/particles';

describe('particles', () => {
  it('emits at a steady rate per source and rises', () => {
    const p = createParticles(100, () => 0.5);
    for (let i = 0; i < 60; i++) { p.step(1 / 60, [0, 0], 1); p.emit('a', 'steam', 1, 2, 2, 1); }
    expect(p.count).toBeGreaterThan(4);
    expect(p.count).toBeLessThan(10);
    let minZ = Infinity;
    p.forEach(1, q => { minZ = Math.min(minZ, q.z); });
    expect(minZ).toBeGreaterThanOrEqual(1);
  });

  it('expires particles and respects the cap', () => {
    const p = createParticles(5, () => 0.5);
    for (let i = 0; i < 120; i++) { p.step(1 / 30, [0, 0], 1); p.emit('a', 'smoke', 3, 0, 0, 0.5, 10); }
    expect(p.count).toBeLessThanOrEqual(5);
    for (let i = 0; i < 200; i++) p.step(1 / 30, [0, 0], 1);
    expect(p.count).toBe(0);
  });

  it('only reports particles on the requested floor', () => {
    const p = createParticles(50, () => 0.5);
    for (let i = 0; i < 30; i++) { p.step(1 / 30, [0, 0], 1); p.emit('a', 'ember', 3, 0, 0, 0.3); }
    let other = 0;
    p.forEach(1, () => { other++; });
    expect(other).toBe(0);
  });

  it('dust puffs settle toward the ground', () => {
    const p = createParticles(50, () => 0.5);
    for (let i = 0; i < 30; i++) { p.step(1 / 60, [0, 0], 1); p.emit('dust', 'dust', 3, 1, 1, 0.02); }
    expect(p.count).toBeGreaterThan(0);
    let falling = 0;
    p.forEach(3, q => { if (q.vz < 0) falling++; });
    expect(falling).toBeGreaterThan(0);
    for (let i = 0; i < 120; i++) p.step(1 / 60, [0, 0], 1);
    expect(p.count).toBe(0);
  });
});

import { describe, it, expect } from 'vitest';
import { blendMoving, blendFrames } from '../view/interpolate';

const at = (x: number, y = 0, extra: object = {}) => ({ id: 'a', level: 1, x, y, z: 0, face: [1, 0] as number[], ...extra });

describe('blending between simulation steps', () => {
  it('puts a walker the share of the step that has passed between the two steps', () => {
    const b = blendMoving(at(1), at(1.025), 0.5);
    expect(b.x).toBeCloseTo(1.0125, 6);
    expect(blendMoving(at(1), at(1.025), 0).x).toBe(1);
    expect(blendMoving(at(1), at(1.025), 1).x).toBe(1.025);
  });

  it('glides evenly at any refresh rate: no frame lands twice in one place or skips ahead', () => {
    // A 144 Hz screen over a 60 Hz sim: positions drawn should climb steadily, not step.
    const speed = 1.5, dt = 1 / 60, frame = 1 / 144;
    let acc = 0, steps = 0, prev = at(0), cur = at(0);
    const drawn: number[] = [];
    for (let f = 0; f < 200; f++) {
      acc += frame;
      while (acc >= dt) { prev = cur; steps++; cur = at(steps * speed * dt); acc -= dt; }
      drawn.push(blendMoving(prev, cur, acc / dt).x);
    }
    const d = drawn.slice(3).map((x, i) => x - drawn[i + 2]);
    const spread = Math.max(...d) - Math.min(...d);
    expect(spread).toBeLessThan(speed * frame * 0.05);
  });

  it('shows a jump, a floor change or another person as it is', () => {
    expect(blendMoving(at(0), at(5), 0.5).x).toBe(5);
    expect(blendMoving(at(0), at(0.01, 0, { level: 2 }), 0.5).level).toBe(2);
    expect(blendMoving(at(0), at(0.01, 0, { level: 2 }), 0.5).x).toBe(0.01);
    expect(blendMoving(at(0), at(0.01, 0, { id: 'b' }), 0.5).x).toBe(0.01);
    expect(blendMoving(undefined, at(3), 0.5).x).toBe(3);
  });

  it('turns the facing smoothly and keeps it a unit length; a half-turn snaps', () => {
    const b = blendMoving(at(0, 0, { face: [1, 0] }), at(0.01, 0, { face: [0, 1] }), 0.5);
    expect(Math.hypot(b.face[0], b.face[1])).toBeCloseTo(1, 6);
    expect(b.face[0]).toBeCloseTo(Math.SQRT1_2, 6);
    expect(blendMoving(at(0, 0, { face: [1, 0] }), at(0.01, 0, { face: [-1, 0] }), 0.5).face).toEqual([-1, 0]);
  });

  it('blends the position on a stair too, and a list matches by place', () => {
    const b = blendMoving(at(0, 0, { stair: { s: 0.2 } }), at(0.01, 0, { stair: { s: 0.3 } }), 0.5);
    expect(b.stair!.s).toBeCloseTo(0.25, 6);
    const out = blendFrames([at(0), at(10)], [at(0.02), at(10.02)], 0.5);
    expect(out.map((o) => o.x)).toEqual([0.01, 10.01]);
  });
});

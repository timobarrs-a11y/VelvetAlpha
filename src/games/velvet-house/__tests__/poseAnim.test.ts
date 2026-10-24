import { describe, it, expect } from 'vitest';
import { poseRig, ANIMATED_POSES } from '../art/poseAnim.js';
import { ACTIVITIES } from '../state/activities';

const finite = (v: number[]) => v.every(Number.isFinite);

describe('poseRig', () => {
  it('gives every animated pose two hands at finite positions, at any time', () => {
    for (const pose of ANIMATED_POSES) {
      for (const t of [0, 0.7, 3.3, 61.9]) {
        const rig = poseRig(pose, t, 0.42);
        expect(rig, pose).not.toBeNull();
        expect(finite(rig!.hands[1]), pose).toBe(true);
        expect(finite(rig!.hands[-1]), pose).toBe(true);
      }
    }
  });

  it('covers every pose an activity uses (apart from standing, sleeping and dancing)', () => {
    const drawnElsewhere = new Set(['stand', 'sleep', 'dance']);
    const used = new Set(Object.values(ACTIVITIES).map(a => a.pose));
    for (const pose of used) {
      if (!drawnElsewhere.has(pose)) expect(ANIMATED_POSES, pose).toContain(pose);
    }
  });

  it('moves over time, so you can watch the activity', () => {
    for (const pose of ['cook', 'run', 'lift', 'mop', 'roll', 'swim', 'desk']) {
      const a = poseRig(pose, 0.2, 0.1)!.hands[1], b = poseRig(pose, 0.55, 0.1)!.hands[1];
      expect(a.some((v, i) => Math.abs(v - b[i]) > 0.005), pose).toBe(true);
    }
  });

  it('lifts the cup and fork to the mouth now and then', () => {
    const heights = (pose: string) => Array.from({ length: 80 }, (_, i) => poseRig(pose, i * 0.1, 0)!.hands[1][2]);
    for (const pose of ['sip', 'eat']) {
      const h = heights(pose);
      expect(Math.max(...h) - Math.min(...h), pose).toBeGreaterThan(0.3);
    }
  });

  it('leaves plain standing alone', () => {
    expect(poseRig('stand', 1, 0)).toBeNull();
  });
});

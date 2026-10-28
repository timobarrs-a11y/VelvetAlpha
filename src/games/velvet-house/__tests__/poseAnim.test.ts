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

  it('animates every everyday activity, with hands that move over time', () => {
    const everyday = ['newspaper', 'rakeYard', 'yardWorkout', 'phonePace', 'snack', 'wipeCounter', 'soloDance',
      'journal', 'mirror', 'foldClothes', 'makeBed', 'meditate', 'jumprope', 'shadowbox'];
    for (const act of everyday) {
      const pose = ACTIVITIES[act].pose;
      const frames = [0.1, 0.45, 0.9, 1.7, 2.6].map(t => poseRig(pose, t, 0.3, act));
      expect(frames.every(Boolean), act).toBe(true);
      const moved = frames.some((f, i) => i > 0 && [1, -1].some(s => f!.hands[s].some((v: number, k: number) => Math.abs(v - frames[0]!.hands[s][k]) > 0.004)) || (f!.bob ?? 0) !== (frames[0]!.bob ?? 0));
      expect(moved, act).toBe(true);
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

  it('moves the hands far enough to read at game size', () => {
    // About 36px per world unit across the floor and 34px per unit of height.
    const travel = (pose: string, act: string | null, side: number) => {
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (let t = 0; t < 8; t += 0.02) {
        const h = poseRig(pose, t, 0.3, act)!.hands[side];
        h.forEach((v: number, i: number) => { lo[i] = Math.min(lo[i], v); hi[i] = Math.max(hi[i], v); });
      }
      return Math.hypot((hi[0] - lo[0]) * 36, (hi[1] - lo[1]) * 36, (hi[2] - lo[2]) * 34);
    };
    const clips: [string, string | null, number, number][] = [
      ['desk', null, 1, 4], ['desk', 'piano', 1, 6], ['stand', 'guitar', 1, 7], ['arcade', null, -1, 6],
      ['cook', 'cook', 1, 5], ['cook', null, 1, 9], ['mop', null, 1, 12], ['phone', null, -1, 8], ['tv', null, 1, 15],
    ];
    for (const [pose, act, side, px] of clips) expect(travel(pose, act, side), `${pose}/${act}`).toBeGreaterThan(px);
  });

  it('leaves plain standing alone', () => {
    expect(poseRig('stand', 1, 0)).toBeNull();
  });

  it('gives activities that share a pose their own clip', () => {
    // Piano and the bike both use the desk pose, but neither should type.
    const desk = poseRig('desk', 1, 0.2)!;
    expect(poseRig('desk', 1, 0.2, 'piano')).not.toEqual(desk);
    expect(poseRig('desk', 1, 0.2, 'bike')!.legs).toBe('pedal');
    expect(poseRig('arcade', 1, 0.2, 'boxing')!.props!.some(p => p.kind === 'gloves')).toBe(true);
    expect(poseRig('listen', 1, 0.2, 'guitar')!.props!.some(p => p.kind === 'guitar')).toBe(true);
  });

  it('walks cooking through chop, stir, taste and plate', () => {
    const kinds = [1, 8, 14, 20].map(m => (poseRig('cook', 1, 0, 'cook', m)!.props ?? []).map(p => p.kind).join());
    expect(kinds).toEqual(['knife', 'spoon', 'spoon', 'plate']);
  });

  it('dances in more than one style', () => {
    const at = (act: string) => JSON.stringify(poseRig('dance', 2, 0, act)!.hands);
    expect(new Set([at('dance'), at('jukebox'), at('danceTogether')]).size).toBe(3);
  });
});

import { idleRig, expressionFor, walkRig, seatLegs, legIK, gaitFoot, LEG, ARM, GAIT } from '../art/poseAnim.js';

describe('the stride', () => {
  it('plants the foot and slides it back at exactly the body\'s speed, so it never skates', () => {
    // The phase advances PI per half cycle of travel; a planted foot must cover 2 * reach over that half.
    const perRad = (2 * GAIT.reach) / Math.PI;
    for (let u = Math.PI + 0.05; u < 2 * Math.PI - 0.1; u += 0.1) {
      const a = gaitFoot(u), b = gaitFoot(u + 0.05);
      expect(a[1], 'planted feet stay on the floor').toBe(0);
      expect((a[0] - b[0]) / 0.05).toBeCloseTo(perRad, 6);
    }
  });

  it('swings the foot forward through the air and lands it where the plant begins', () => {
    const lifts = [];
    for (let u = 0.05; u < Math.PI; u += 0.1) { const [f, z] = gaitFoot(u); lifts.push(z); expect(f).toBeGreaterThan(gaitFoot(u - 0.05)[0]); }
    expect(Math.max(...lifts)).toBeCloseTo(GAIT.lift, 2);
    expect(gaitFoot(Math.PI - 1e-6)[0]).toBeCloseTo(gaitFoot(Math.PI + 1e-6)[0], 3);
    expect(gaitFoot(2 * Math.PI - 1e-6)[0]).toBeCloseTo(gaitFoot(1e-6)[0], 3);
  });

  it('fades to standing with the amplitude', () => {
    expect(gaitFoot(1, 0)).toEqual([-0, 0]);
    expect(Math.abs(gaitFoot(4, 0)[0])).toBeLessThan(1e-12);
  });
});

describe('the knee', () => {
  const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const hip = [0, 0.62];

  it('keeps the thigh and shin their own lengths wherever the foot lands in a stride', () => {
    for (let ph = 0; ph < Math.PI * 2; ph += 0.05) {
      const foot = [Math.sin(ph) * 0.17, Math.max(0, Math.sin(ph)) * 0.075];
      const knee = legIK(hip, foot);
      const d = dist(hip, foot);
      if (d <= LEG.thigh + LEG.shin) {
        expect(dist(hip, knee), `thigh at ${ph}`).toBeCloseTo(LEG.thigh, 3);
        expect(dist(knee, foot), `shin at ${ph}`).toBeCloseTo(LEG.shin, 3);
      } else {
        // Out of reach: the leg straightens toward the foot, split at the knee.
        expect(dist(hip, knee) / dist(knee, foot)).toBeCloseTo(LEG.thigh / LEG.shin, 3);
      }
    }
  });

  it('bends forward, never backward', () => {
    for (const foot of [[0, 0], [0.15, 0], [-0.15, 0], [0.1, 0.2], [0.2, 0.3], [-0.1, 0.05]]) {
      const knee = legIK(hip, foot);
      const t = (knee[1] - hip[1]) / ((foot[1] - hip[1]) || -1e-6); // where along the hip-foot line the knee is
      const onLine = hip[0] + (foot[0] - hip[0]) * t;
      expect(knee[0], `foot ${foot}`).toBeGreaterThanOrEqual(onLine - 1e-9);
    }
  });

  it('straightens a leg that hangs with the foot right below the hip', () => {
    const knee = legIK(hip, [0, 0]);
    expect(knee[1]).toBeCloseTo(0.31, 3);
    expect(knee[0]).toBeGreaterThanOrEqual(0); // a 0.62 leg over a 0.62 drop: the knee sits dead on the line
    expect(knee[0]).toBeLessThan(0.01);
  });
});

describe('the walk', () => {
  const len = (v: number[]) => Math.hypot(v[0], v[2]);

  it('keeps each hand an arm\'s length from the shoulder through the whole stride', () => {
    for (let ph = 0; ph < Math.PI * 2; ph += 0.1) {
      const r = walkRig(ph, 1);
      for (const side of [1, -1]) expect(len(r.hands[side])).toBeCloseTo(ARM.length, 1);
    }
  });

  it('swings the arms forward and back, opposite the leg on the same side, never out to the side', () => {
    // The legs: side +1 is furthest forward at phase PI, side -1 at phase 0 (gaitFoot).
    const r = walkRig(Math.PI, 1);
    expect(gaitFoot(Math.PI)[0]).toBeCloseTo(GAIT.reach, 6);
    expect(r.hands[1][0], 'right arm back while the right leg is forward').toBeLessThan(-0.1);
    expect(r.hands[-1][0], 'left arm forward while the left leg is back').toBeGreaterThan(0.1);
    for (let ph = 0; ph < Math.PI * 2; ph += 0.1) {
      const w = walkRig(ph, 1);
      for (const side of [1, -1]) {
        expect(w.hands[side][1]).toBeCloseTo(0.13, 2); // the sideways offset never changes
        expect(w.hands[side][2], 'hands stay below the shoulder').toBeLessThan(-0.3);
      }
    }
  });

  it('is a stride, not a flail: the hands travel far enough to read and no further', () => {
    const reach = Math.max(...Array.from({ length: 64 }, (_, i) => Math.abs(walkRig(i / 10, 1).hands[1][0])));
    expect(reach).toBeGreaterThan(0.18);
    expect(reach).toBeLessThan(0.26);
  });

  it('lets the arms hang when the walk fades out', () => {
    const r = walkRig(1.3, 0);
    for (const side of [1, -1]) {
      expect(Math.abs(r.hands[side][0])).toBeLessThan(0.001);
      expect(r.hands[side][2]).toBeCloseTo(-ARM.length + 0.02, 3);
    }
  });

  it('bends the elbow forward, between the shoulder and the hand', () => {
    for (const ph of [0, 1, 2, 3, 4, 5]) {
      const r = walkRig(ph, 1);
      for (const side of [1, -1]) {
        const e = r.elbows[side], h = r.hands[side];
        expect(e[2]).toBeGreaterThan(h[2]);
        expect(e[2]).toBeLessThan(0);
        expect(e[0]).toBeGreaterThan(Math.min(0, h[0]) - 0.001);
      }
    }
  });
});

describe('the seat', () => {
  const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  it('keeps the thigh its own length on every seat', () => {
    for (const seat of [0.1, 0.18, 0.3, 0.48, 0.49, 0.56, 0.7]) {
      const s = seatLegs(seat);
      expect(dist(s.hip, s.knee), `seat ${seat}`).toBeCloseTo(LEG.thigh, 2);
    }
  });

  it('never stretches the shin past its cartoon allowance, and never shortens it', () => {
    for (const seat of [0.1, 0.18, 0.3, 0.48, 0.49, 0.56, 0.7]) {
      const s = seatLegs(seat), shin = dist(s.knee, s.foot);
      expect(shin, `seat ${seat}`).toBeGreaterThanOrEqual(LEG.shin - 0.001);
      expect(shin, `seat ${seat}`).toBeLessThanOrEqual(LEG.shin * LEG.stretch + 0.001);
    }
  });

  it('puts the feet on the floor from a couch or a chair, and lets them hang from a bar stool', () => {
    for (const seat of [0.48, 0.49]) {
      const s = seatLegs(seat);
      expect(s.dangle, `seat ${seat}`).toBe(false);
      expect(s.foot[1], `seat ${seat}`).toBeCloseTo(-seat, 5); // floor level
      expect(s.foot[0], 'feet under or ahead of the knees').toBeGreaterThanOrEqual(s.knee[0] - 1e-9);
    }
    const stool = seatLegs(0.7);
    expect(stool.dangle).toBe(true);
    expect(stool.foot[1]).toBeGreaterThan(-0.7); // above the floor
  });

  it('raises the knees on a low seat so the feet still stand flat', () => {
    const low = seatLegs(0.12), chair = seatLegs(0.48);
    expect(low.knee[1]).toBeGreaterThan(chair.knee[1] + 0.1);
    expect(low.foot[1]).toBeCloseTo(-0.12, 5);
  });

  it('sinks the hips a little into the cushion, and no more', () => {
    const s = seatLegs(0.48);
    expect(s.hip[1]).toBeLessThan(0);
    expect(s.hip[1]).toBeGreaterThan(-0.08);
  });
});

describe('idle life and expressions', () => {
  it('fidgets now and then while standing, but never all the time', () => {
    const frames = Array.from({ length: 200 }, (_, i) => idleRig(i * 0.25, 0.4, 'neutral'));
    const busy = frames.filter(Boolean).length;
    expect(busy).toBeGreaterThan(20);
    expect(busy).toBeLessThan(180);
  });

  it('reads feelings from needs', () => {
    expect(expressionFor({ energy: 10, food: 80, hygiene: 80, fun: 80, comfort: 80, social: 80 })).toBe('tired');
    expect(expressionFor({ energy: 80, food: 10, hygiene: 80, fun: 80, comfort: 80, social: 80 })).toBe('annoyed');
    expect(expressionFor({ energy: 80, food: 80, hygiene: 80, fun: 80, comfort: 80, social: 10 })).toBe('sad');
    expect(expressionFor({ energy: 80, food: 80, hygiene: 80, fun: 70, comfort: 80, social: 80 })).toBe('happy');
    expect(expressionFor({ energy: 50, food: 50, hygiene: 50, fun: 50, comfort: 50, social: 50 })).toBe('neutral');
  });
});

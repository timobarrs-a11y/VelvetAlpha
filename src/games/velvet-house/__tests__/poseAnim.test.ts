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

import { idleRig, expressionFor } from '../art/poseAnim.js';

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

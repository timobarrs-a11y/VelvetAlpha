import { describe, it, expect } from 'vitest';
import { BallSim, BALL_R, RIM_R, RIM_TUBE, launchVelocity, planShot, sampleAt, type V3 } from '../ballSim';
import { buildCourse, isMake, RIM_HEIGHT, spotPosition, type Outcome } from '../engine';
import { seeded } from '../rivals';

const OUTCOMES: Outcome[] = ['swish', 'make', 'rim-in', 'rim-out', 'brick', 'airball'];
const spots = buildCourse(2).map(s => { const [x, y] = spotPosition(s); return { label: s.label, from: [x, y, 2.45] as V3 }; });

describe('ball physics', () => {
  it('bounces off the floor like a basketball (drop from 1.8m comes back to about 1.1–1.3m)', () => {
    const b = new BallSim([0, 5, 1.8 + BALL_R], [0, 0, 0]);
    let fell = false, peak = 0;
    for (let i = 0; i < 240 * 3; i++) {
      b.step();
      if (b.touches.floor > 0) fell = true;
      if (fell && b.touches.floor === 1) peak = Math.max(peak, b.p[2] - BALL_R);
    }
    expect(peak).toBeGreaterThan(1.0);
    expect(peak).toBeLessThan(1.3);
  });

  it('solves a launch that passes through the aim point, at a realistic speed and hang time', () => {
    const from: V3 = [0, 7.24, 2.45];
    const v = launchVelocity(from, [0, 0, RIM_HEIGHT], 50);
    const speed = Math.hypot(...v);
    expect(speed).toBeGreaterThan(8);
    expect(speed).toBeLessThan(10.5);
    // Fly it without the hoop in the way and check it crosses rim height right at the centre.
    const b = new BallSim(from, v);
    let prev: V3 = [...b.p], t = 0;
    for (let i = 0; i < 2400; i++) {
      prev = [...b.p]; b.step(); t = b.t;
      if (b.v[2] < 0 && b.p[2] <= RIM_HEIGHT) break;
    }
    expect(Math.hypot(b.p[0], b.p[1])).toBeLessThan(0.05);
    expect(t).toBeGreaterThan(1.0);
    expect(t).toBeLessThan(1.5);
    expect(prev[2]).toBeGreaterThan(RIM_HEIGHT - 0.1);
  });

  it('a perfect release swishes from every spot (no iron, no glass)', () => {
    for (const s of spots) for (let k = 0; k < 6; k++) {
      const plan = planShot(s.from, 'swish', k % 2 ? 1 : -1, seeded(100 + k));
      expect(plan.made, s.label).toBe(true);
      expect(plan.events.some(e => e.kind === 'rim' || e.kind === 'board'), s.label).toBe(false);
      expect(plan.fitted).toBe(true);
    }
  });

  it('never disagrees with the rules about make or miss, from any spot, for any outcome', () => {
    for (const s of spots) for (const o of OUTCOMES) for (const side of [-1, 1]) for (let k = 0; k < 3; k++) {
      const plan = planShot(s.from, o, side, seeded(k * 31 + side + 7));
      expect(plan.made, `${o} from ${s.label}`).toBe(isMake(o));
    }
  });

  it('finds a real flight for the asked outcome almost always (rarely needs the fallback)', () => {
    for (const o of OUTCOMES) {
      let fitted = 0, n = 0;
      for (const s of spots) for (const side of [-1, 1]) for (let k = 0; k < 3; k++) {
        n++; if (planShot(s.from, o, side, seeded(500 + k * 13 + side)).fitted) fitted++;
      }
      expect(fitted / n, o).toBeGreaterThanOrEqual(0.9);
    }
  });

  it('early misses come up short (front rim), late ones go long (back rim)', () => {
    let front = 0, back = 0, n = 0;
    for (const s of spots) for (let k = 0; k < 4; k++) for (const side of [-1, 1]) {
      const plan = planShot(s.from, 'rim-out', side, seeded(900 + k));
      const hit = plan.events.find(e => e.kind === 'rim');
      if (!hit) continue;
      const p = sampleAt(plan.samples, hit.t).p;
      const toShooter = Math.hypot(s.from[0], s.from[1]);
      const depth = (p[0] * s.from[0] + p[1] * s.from[1]) / toShooter; // > 0: shooter's side of the rim
      n++;
      if (side < 0 && depth > 0) front++;
      if (side > 0 && depth < 0) back++;
    }
    expect((front + back) / n).toBeGreaterThan(0.85);
  });

  it('never passes through the rim or the backboard', () => {
    for (const s of spots) for (const o of OUTCOMES) {
      const plan = planShot(s.from, o, o === 'brick' ? 1 : -1, seeded(42));
      for (const smp of plan.samples) {
        const [x, y, z] = smp.p;
        const d = Math.hypot(x, y);
        const toRing = Math.hypot(d - RIM_R, z - RIM_HEIGHT);
        expect(toRing).toBeGreaterThan(BALL_R + RIM_TUBE - 0.02);
        const inBoard = Math.abs(x) < 0.915 && y > -0.3925 - BALL_R + 0.02 && y < -0.3675 + BALL_R - 0.02 && z > 2.9 && z < 3.97;
        expect(inBoard, `${o} at ${smp.t.toFixed(2)}s`).toBe(false);
        expect(z).toBeGreaterThan(BALL_R - 0.02);
      }
    }
  });

  it('decides makes in about a second and a half, and records smooth samples', () => {
    for (const s of spots) {
      const plan = planShot(s.from, 'swish', 1, seeded(3));
      expect(plan.resolvedAt).toBeGreaterThan(0.9);
      expect(plan.resolvedAt).toBeLessThan(1.8);
      for (let i = 1; i < plan.samples.length; i++) {
        const a = plan.samples[i - 1].p, b = plan.samples[i].p;
        expect(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])).toBeLessThan(0.15); // < 18 m/s per 1/120 s
      }
    }
  });

  it('is deterministic: the same seed gives the same flight', () => {
    const a = planShot(spots[2].from, 'rim-in', 1, seeded(77));
    const b = planShot(spots[2].from, 'rim-in', 1, seeded(77));
    expect(a.samples).toEqual(b.samples);
    expect(a.events).toEqual(b.events);
  });

  it('plans a shot quickly enough to do it on release', () => {
    const t0 = performance.now();
    let n = 0;
    for (const s of spots) for (const o of OUTCOMES) { planShot(s.from, o, 1, seeded(n++)); }
    expect((performance.now() - t0) / n).toBeLessThan(25);
  });
});

describe('touch shots (physics decides)', () => {
  it('a throw aimed through the hoop goes in, and is named for how it went in', async () => {
    const { simulateLaunch, launchVelocity: lv } = await import('../ballSim');
    const from: V3 = [0, 6, 2.3];
    const v = lv(from, [0, 0, RIM_HEIGHT], 50);
    const shot = simulateLaunch(from, v, [-15, 0, 0]);
    expect(shot.made).toBe(true);
    expect(shot.outcome).toBe('swish');
    const short = simulateLaunch(from, lv(from, [0, 1.2, RIM_HEIGHT], 45), [0, 0, 0]);
    expect(short.made).toBe(false);
  });

  it('the glass can bank one in from the wing', async () => {
    const { simulateLaunch } = await import('../ballSim');
    // Aim at the square on the glass from the wing: some of these banks should drop.
    const from: V3 = [3.2, 3.2, 2.3];
    let banks = 0;
    for (let k = 0; k < 40; k++) {
      const v = launchVelocity(from, [-0.12 + k * 0.006, -0.3, RIM_HEIGHT + 0.35], 50 + (k % 5));
      const s = simulateLaunch(from, v, [0, 0, 0]);
      if (s.made && s.bank) banks++;
    }
    expect(banks).toBeGreaterThan(0);
  });

  it('previews the start of the arc from the hands', async () => {
    const { previewArc } = await import('../ballSim');
    const pts = previewArc([0, 6, 2.3], [0, -5, 6], [0, 0, 0], 0.4);
    expect(pts.length).toBeGreaterThan(8);
    expect(pts[0]).toEqual([0, 6, 2.3]);
    expect(pts[pts.length - 1][2]).toBeGreaterThan(2.3);
  });
});

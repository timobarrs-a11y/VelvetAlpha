// Basketball physics for the shootout: gravity, air drag and backspin, and
// collisions with the rim, backboard, floor and stanchion, including friction
// that trades sliding for spin. It runs on a fixed step, so the same launch
// always produces the same path (replays and rival playback depend on that).
//
// The rules decide what a shot does (engine.resolveShot); `planShot` then
// finds a launch whose real flight does exactly that: early releases come up
// short, late ones go long. Game coordinates: metres, x across, y out from
// the rim (rim centre at x = y = 0), z up.

import { RIM_HEIGHT, isMake, type Outcome } from './engine';

export type V3 = [number, number, number];

export const BALL_R = 0.12;
export const RIM_R = 0.2286;
export const RIM_TUBE = 0.011;
export const STEP = 1 / 240;
const G = 9.81;
/** Quadratic air drag per metre (0.5·ρ·Cd·A / m for a basketball). */
const DRAG = 0.02;
/** Hollow sphere: I = 2/3·m·r². */
const INERTIA = 2 / 3;

/** Solid things the ball can hit, as axis-aligned boxes: [min, max]. */
const BOXES: Array<{ kind: 'board' | 'stanchion'; min: V3; max: V3; e: number; mu: number }> = [
  { kind: 'board', min: [-0.915, -0.3925, 2.9], max: [0.915, -0.3675, 3.97], e: 0.62, mu: 0.25 },
  { kind: 'board', min: [-0.06, -0.3786, 3.015], max: [0.06, -0.2186, 3.065], e: 0.5, mu: 0.3 }, // rim bracket
  { kind: 'stanchion', min: [-0.7, -4.8, 0], max: [0.7, -2.6, 1.1], e: 0.45, mu: 0.5 },
  { kind: 'stanchion', min: [-0.21, -3.61, 0.5], max: [0.21, -3.19, 3.9], e: 0.5, mu: 0.4 },
];
const RIM_E = 0.55, RIM_MU = 0.3, FLOOR_E = 0.8, FLOOR_MU = 0.45;

export type ContactKind = 'rim' | 'board' | 'floor' | 'stanchion';
export interface SimEvent { t: number; kind: ContactKind | 'through'; speed: number }
/** A recorded position and spin, every other physics step (120Hz). */
export interface Sample { t: number; p: V3; w: V3 }

const add = (a: V3, b: V3, s = 1): V3 => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];

export class BallSim {
  p: V3; v: V3; w: V3;
  t = 0;
  events: SimEvent[] = [];
  /** Went down through the hoop. */
  made = false;
  /** Separate touches (a ball rolling on the rim is one touch). */
  touches: Record<ContactKind, number> = { rim: 0, board: 0, floor: 0, stanchion: 0 };
  private lastContact: Record<ContactKind, number> = { rim: -1, board: -1, floor: -1, stanchion: -1 };

  constructor(p: V3, v: V3, w: V3 = [0, 0, 0]) { this.p = [...p]; this.v = [...v]; this.w = [...w]; }

  step(dt = STEP): void {
    const prevZ = this.p[2], prevR = Math.hypot(this.p[0], this.p[1]);
    // Gravity and drag.
    const sp = len(this.v);
    this.v = add(this.v, [0, 0, -G * dt]);
    this.v = add(this.v, this.v, -DRAG * sp * dt);
    this.p = add(this.p, this.v, dt);
    this.t += dt;

    // Through the hoop: the centre crosses the rim plane going down, inside the ring.
    const r = Math.hypot(this.p[0], this.p[1]);
    if (!this.made && prevZ >= RIM_HEIGHT && this.p[2] < RIM_HEIGHT && this.v[2] < 0 && Math.min(r, prevR) < RIM_R - 0.02) {
      this.made = true;
      this.events.push({ t: this.t, kind: 'through', speed: -this.v[2] });
    }
    // The net catches a made ball: it slows and drops straight down. Only
    // right after it goes through, and only inside the net.
    const throughT = this.made ? this.events.find(e => e.kind === 'through')!.t : -1;
    if (this.made && this.t - throughT < 0.6 && Math.hypot(this.p[0], this.p[1]) < RIM_R + 0.05 && this.p[2] > RIM_HEIGHT - 0.5 && this.p[2] < RIM_HEIGHT) {
      const k = Math.exp(-5 * dt);
      this.v = [this.v[0] * k, this.v[1] * k, this.v[2] * Math.exp(-1.8 * dt)];
      const netR = RIM_R * (1 - 0.4 * ((RIM_HEIGHT - this.p[2]) / 0.5)) - BALL_R * 0.35;
      const rr = Math.hypot(this.p[0], this.p[1]);
      if (rr > netR && rr > 1e-6) { const f = netR / rr; this.p = [this.p[0] * f, this.p[1] * f, this.p[2]]; }
    }

    // The rim: a ring of radius RIM_R; the ball hits the nearest point on it.
    {
      const d = Math.hypot(this.p[0], this.p[1]);
      const q: V3 = d > 1e-6 ? [(this.p[0] / d) * RIM_R, (this.p[1] / d) * RIM_R, RIM_HEIGHT] : [RIM_R, 0, RIM_HEIGHT];
      const n = add(this.p, q, -1), dist = len(n), reach = BALL_R + RIM_TUBE;
      if (dist < reach && dist > 1e-9) this.collide('rim', scale(n, 1 / dist), reach - dist, RIM_E, RIM_MU);
    }
    // Boxes: backboard, bracket, stanchion.
    for (const b of BOXES) {
      const c: V3 = [Math.max(b.min[0], Math.min(this.p[0], b.max[0])), Math.max(b.min[1], Math.min(this.p[1], b.max[1])), Math.max(b.min[2], Math.min(this.p[2], b.max[2]))];
      const n = add(this.p, c, -1), dist = len(n);
      if (dist < BALL_R && dist > 1e-9) this.collide(b.kind, scale(n, 1 / dist), BALL_R - dist, b.e, b.mu);
    }
    // The floor.
    if (this.p[2] < BALL_R) this.collide('floor', [0, 0, 1], BALL_R - this.p[2], FLOOR_E, FLOOR_MU);
    // Rolling on the floor slowly loses speed and spin.
    if (this.p[2] <= BALL_R + 1e-3 && Math.abs(this.v[2]) < 0.05) {
      const k = Math.exp(-0.35 * dt);
      this.v = [this.v[0] * k, this.v[1] * k, this.v[2]];
      this.w = scale(this.w, k);
    }
  }

  /** Push out of an obstacle and bounce: restitution on the normal, friction and spin on the tangent. */
  private collide(kind: ContactKind, n: V3, depth: number, e: number, mu: number): void {
    this.p = add(this.p, n, depth);
    const rc = scale(n, -BALL_R); // contact point from the centre
    const vc = add(this.v, cross(this.w, rc)); // surface velocity at the contact
    const vn = dot(vc, n);
    if (vn >= 0) return; // already separating
    const jn = -(1 + e) * vn;
    // A bounce small enough to be resting contact on the floor doesn't count as a new touch.
    if (this.t - this.lastContact[kind] > 0.06 && (kind !== 'floor' || -vn > 0.4)) {
      this.touches[kind]++;
      this.events.push({ t: this.t, kind, speed: -vn });
    }
    this.lastContact[kind] = this.t;
    let vt = add(vc, n, -vn);
    const vtLen = len(vt);
    // Friction: at most enough to stop sliding (rolling), at most mu × normal impulse.
    let jt = 0;
    if (vtLen > 1e-6) {
      jt = Math.min(mu * jn, vtLen / (1 + 1 / INERTIA));
      vt = scale(vt, 1 / vtLen);
    }
    this.v = add(add(this.v, n, jn), vt, -jt);
    // Angular impulse: r × (−jt·t̂), over I/m = (2/3)r².
    this.w = add(this.w, cross(rc, scale(vt, -jt)), 1 / (INERTIA * BALL_R * BALL_R));
  }
}

/**
 * Launch velocity that carries the ball from `from` through the point `aim`
 * (on the way down), at launch angle `arc` degrees, with air drag. Solved by
 * bisection on speed against the same integrator the game uses.
 */
export function launchVelocity(from: V3, aim: V3, arcDeg: number): V3 {
  const dx = aim[0] - from[0], dy = aim[1] - from[1], D = Math.hypot(dx, dy);
  const ux = dx / D, uy = dy / D, a = (arcDeg * Math.PI) / 180;
  const dir: V3 = [ux * Math.cos(a), uy * Math.cos(a), Math.sin(a)];
  const reach = (s: number): number => {
    // Horizontal distance covered when the ball comes back down through aim height.
    let p: V3 = [...from], v = scale(dir, s);
    for (let i = 0; i < 2400; i++) {
      const sp = len(v);
      v = add(v, [0, 0, -G * STEP]);
      v = add(v, v, -DRAG * sp * STEP);
      const np = add(p, v, STEP);
      if (v[2] < 0 && np[2] <= aim[2]) {
        const f = (p[2] - aim[2]) / (p[2] - np[2]);
        return Math.hypot(p[0] + (np[0] - p[0]) * f - from[0], p[1] + (np[1] - p[1]) * f - from[1]);
      }
      p = np;
    }
    return 0;
  };
  // Start from the no-drag answer; drag only ever needs a little more speed.
  const H = aim[2] - from[2];
  const denom = 2 * Math.cos(a) ** 2 * (D * Math.tan(a) - H);
  const v0 = denom > 0 ? Math.sqrt((G * D * D) / denom) : 10;
  let lo = v0 * 0.98, hi = v0 * 1.12;
  if (reach(hi) < D) { lo = hi; hi = 25; }
  for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; if (reach(mid) < D) lo = mid; else hi = mid; }
  return scale(dir, (lo + hi) / 2);
}

export interface ShotPlan {
  samples: Sample[];
  events: SimEvent[];
  made: boolean;
  /** When the shot is decided: through the net, or clearly missed. */
  resolvedAt: number;
  duration: number;
  /** False when no launch matched the outcome and a certain fallback was used. */
  fitted: boolean;
}

/** Does a simulated flight look like the outcome the rules asked for? */
function fits(o: Outcome, s: BallSim): boolean {
  const { rim, board } = s.touches;
  switch (o) {
    case 'swish': return s.made && rim === 0 && board === 0;
    case 'make': return s.made && rim <= 1 && board === 0;
    case 'rim-in': return s.made && rim >= 1;
    case 'rim-out': return !s.made && rim >= 1;
    case 'brick': return !s.made && (rim + board) >= 1;
    case 'airball': return !s.made && rim === 0 && board === 0;
  }
}

/**
 * Where to aim for each outcome, as [depth, lateral] offsets from the rim
 * centre in metres (depth > 0 is long, past the centre). `side` is the sign
 * of the timing error: early (-1) comes up short, late (+1) goes long.
 */
function aimFor(o: Outcome, side: number, rand: () => number, widen: number): { depth: number; lateral: number; arc: number } {
  const u = (a: number, b: number) => a + (b - a) * rand();
  const lat = (m: number) => (rand() * 2 - 1) * m * widen;
  switch (o) {
    case 'swish': return { depth: (rand() * 2 - 1) * 0.02 * widen, lateral: lat(0.015), arc: u(47, 52) };
    // A real rim is forgiving long (the back iron and backspin feed it in) and
    // unforgiving short, so the make ranges are lopsided (mapped from the sim).
    case 'make': return { depth: (side < 0 ? -u(0.01, 0.05) : u(0.02, 0.1)) * widen, lateral: lat(0.04), arc: u(45, 52) };
    case 'rim-in': return { depth: (side < 0 ? -u(0.03, 0.13) : u(0.06, 0.18)) * widen, lateral: lat(0.08), arc: u(46, 52) };
    case 'rim-out': return { depth: side * u(0.1, 0.26) * widen, lateral: lat(0.14), arc: u(44, 52) };
    case 'brick': return side < 0 ? { depth: -u(0.18, 0.32) * widen, lateral: lat(0.1), arc: u(40, 47) } : { depth: u(0.3, 0.55) * widen, lateral: lat(0.15), arc: u(46, 54) };
    case 'airball': return { depth: -u(0.5, 1.0) * widen, lateral: lat(0.3), arc: u(40, 50) };
  }
}

/** Run a launch for up to `seconds`, recording samples and when it was decided. */
function fly(from: V3, v: V3, w: V3, seconds: number, record: boolean): { sim: BallSim; samples: Sample[]; resolvedAt: number } {
  const sim = new BallSim(from, v, w);
  const samples: Sample[] = record ? [{ t: 0, p: [...from], w: [...w] }] : [];
  let resolvedAt = -1, contacted = false;
  const steps = Math.round(seconds / STEP);
  for (let i = 1; i <= steps; i++) {
    sim.step();
    if (sim.touches.rim + sim.touches.board > 0) contacted = true;
    if (resolvedAt < 0) {
      if (sim.made) resolvedAt = sim.t;
      // A miss is decided once the ball is on its way down well below the rim
      // after touching iron or glass, or when it first reaches the floor.
      else if ((contacted && sim.p[2] < RIM_HEIGHT - 0.6 && sim.v[2] < 0) || sim.touches.floor > 0) resolvedAt = sim.t;
    }
    if (record && i % 2 === 0) samples.push({ t: sim.t, p: [...sim.p], w: [...sim.w] });
    // Without recording we only need to know how the shot is decided.
    if (!record && resolvedAt >= 0 && sim.t > resolvedAt + 0.3) break;
  }
  return { sim, samples, resolvedAt: resolvedAt < 0 ? sim.t : resolvedAt };
}

/**
 * A real flight for a shot whose outcome the rules already decided. Tries
 * seeded launches around the outcome's aim until the physics agrees; the
 * made/missed result always matches the rules (falls back to a clean swish or
 * a short ball, which are certain). A generator, so the search can be spread
 * over several frames: each `yield` is one tried launch (about 1–3ms).
 */
export function* planShotSteps(from: V3, outcome: Outcome, side: number, rand: () => number, seconds = 4): Generator<void, ShotPlan> {
  const toShooter = Math.hypot(from[0], from[1]);
  const ux = from[0] / toShooter, uy = from[1] / toShooter; // rim → shooter
  const spin = 14 + rand() * 6; // backspin, rad/s (about 2–3 turns a second)
  const backspin = (v: V3): V3 => { const l = Math.hypot(v[0], v[1]) || 1; return scale(cross([0, 0, 1], [v[0] / l, v[1] / l, 0]), spin); };
  const launch = (o: Outcome, widen: number): { v: V3; w: V3 } => {
    const a = aimFor(o, side, rand, widen);
    // Depth is measured away from the shooter; lateral is across the shot line.
    const aim: V3 = [-ux * a.depth + -uy * a.lateral, -uy * a.depth + ux * a.lateral, RIM_HEIGHT];
    const v = launchVelocity(from, aim, a.arc);
    return { v, w: backspin(v) };
  };
  let chosen: { v: V3; w: V3 } | null = null;
  for (let i = 0; i < 60 && !chosen; i++) {
    const c = launch(outcome, i < 30 ? 1 : 1.4);
    yield; // one solve per slice
    if (fits(outcome, fly(from, c.v, c.w, seconds, false).sim)) chosen = c;
    yield; // one test flight per slice
  }
  const fitted = !!chosen;
  if (!chosen) {
    // Certain fallbacks keep made/missed honest: dead centre, or well short.
    const aim: V3 = isMake(outcome) ? [0, 0, RIM_HEIGHT] : [ux * 1.3, uy * 1.3, RIM_HEIGHT];
    const v = launchVelocity(from, aim, isMake(outcome) ? 50 : 44);
    chosen = { v, w: backspin(v) };
  }
  const { sim, samples, resolvedAt } = fly(from, chosen.v, chosen.w, seconds, true);
  return { samples, events: sim.events, made: sim.made, resolvedAt, duration: sim.t, fitted };
}

/** `planShotSteps`, run to the end in one go. */
export function planShot(from: V3, outcome: Outcome, side: number, rand: () => number, seconds = 4): ShotPlan {
  const g = planShotSteps(from, outcome, side, rand, seconds);
  for (;;) { const r = g.next(); if (r.done) return r.value; }
}

/** Position and spin at time t along a recorded flight (linear between samples). */
export function sampleAt(samples: Sample[], t: number): Sample {
  if (t <= 0 || samples.length < 2) return samples[0];
  const dt = samples[1].t - samples[0].t;
  const i = Math.min(samples.length - 2, Math.floor(t / dt));
  const a = samples[i], b = samples[i + 1];
  const f = Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t)));
  return { t, p: [a.p[0] + (b.p[0] - a.p[0]) * f, a.p[1] + (b.p[1] - a.p[1]) * f, a.p[2] + (b.p[2] - a.p[2]) * f], w: b.w };
}

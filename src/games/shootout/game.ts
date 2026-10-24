// 3-Point Shootout: the running game. Draws a perspective court on a 2D
// canvas (first person while shooting, a fixed broadcast camera between
// racks), runs the clock and the ball, and calls back with results.
//
// World: metres. x across the court (left -, right +), y out from the rim
// (rim centre at y = 0, the shooter at y > 0), z up. Backboard at y = -0.38.

import {
  buildCourse, fireBoost, isMake, judge, LEVELS, MAX_SCORE, resolveShot, RIM_HEIGHT, shotWindow, spotPosition,
  type Ball, type Grade, type Level, type Outcome, type Spot,
} from './engine';
import * as sfx from './audio';

export type V3 = [number, number, number];
type Phase = 'walk' | 'aim' | 'hold' | 'flight' | 'done';

export interface RunResult { score: number; max: number; makes: number; shots: number; bestStreak: number; level: Level }

export interface ShootoutCallbacks {
  onScore?: (score: number) => void;
  onDone?: (r: RunResult) => void;
}

const RIM_R = 0.2286, BALL_R = 0.12, BOARD_Y = -0.38;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** One piece of the ball's path: a parabola from a to b over dur seconds, peaking h above the higher end. */
export interface Leg { a: V3; b: V3; h: number; dur: number; sound?: 'rim' | 'board' | 'swish' | 'bounce' | null }

export function legAt(l: Leg, u: number): V3 {
  // Straight line from a to b, lifted by a parabola h high at the middle.
  return [lerp(l.a[0], l.b[0], u), lerp(l.a[1], l.b[1], u), lerp(l.a[2], l.b[2], u) + 4 * l.h * u * (1 - u)];
}

/** The ball's whole flight for an outcome, from the release point. */
export function planFlight(from: V3, outcome: Outcome, side: number): Leg[] {
  const dist = Math.hypot(from[0], from[1]);
  const arc = 1.3 + dist * 0.12, t = 0.85 + dist * 0.03;
  const toward = norm([from[0], from[1], 0]); // from the rim out to the shooter
  const at = (dx: number, dy: number, z: number): V3 => [dx, dy, z];
  switch (outcome) {
    case 'swish':
      return [
        { a: from, b: [0, 0, RIM_HEIGHT + 0.02], h: arc, dur: t },
        { a: [0, 0, RIM_HEIGHT + 0.02], b: [0, 0.02, RIM_HEIGHT - 0.5], h: 0, dur: 0.16, sound: 'swish' },
        { a: [0, 0.02, RIM_HEIGHT - 0.5], b: [toward[0] * 0.5, toward[1] * 0.5, BALL_R], h: 0, dur: 0.4, sound: null },
        { a: [toward[0] * 0.5, toward[1] * 0.5, BALL_R], b: [toward[0] * 1.6, toward[1] * 1.6, BALL_R], h: 0.6, dur: 0.5, sound: 'bounce' },
      ];
    case 'make': {
      const front = at(toward[0] * 0.14, toward[1] * 0.14, RIM_HEIGHT + 0.04);
      return [
        { a: from, b: front, h: arc, dur: t },
        { a: front, b: [0, 0, RIM_HEIGHT - 0.45], h: 0.05, dur: 0.22, sound: 'swish' },
        { a: [0, 0, RIM_HEIGHT - 0.45], b: [toward[0] * 0.4, toward[1] * 0.4, BALL_R], h: 0, dur: 0.38, sound: null },
        { a: [toward[0] * 0.4, toward[1] * 0.4, BALL_R], b: [toward[0] * 1.3, toward[1] * 1.3, BALL_R], h: 0.5, dur: 0.45, sound: 'bounce' },
      ];
    }
    case 'rim-in': {
      const front = at(toward[0] * RIM_R, toward[1] * RIM_R, RIM_HEIGHT + 0.1);
      const back = at(-toward[0] * RIM_R * 0.8 + side * 0.08, -toward[1] * RIM_R * 0.8, RIM_HEIGHT + 0.1);
      return [
        { a: from, b: front, h: arc, dur: t },
        { a: front, b: back, h: 0.28, dur: 0.32, sound: 'rim' },
        { a: back, b: [side * 0.05, 0, RIM_HEIGHT + 0.08], h: 0.12, dur: 0.22, sound: 'rim' },
        { a: [side * 0.05, 0, RIM_HEIGHT + 0.08], b: [0, 0, RIM_HEIGHT - 0.5], h: 0, dur: 0.2, sound: 'swish' },
        { a: [0, 0, RIM_HEIGHT - 0.5], b: [toward[0] * 0.4, toward[1] * 0.4, BALL_R], h: 0, dur: 0.38, sound: null },
      ];
    }
    case 'rim-out': {
      const front = at(toward[0] * RIM_R + side * 0.05, toward[1] * RIM_R, RIM_HEIGHT + 0.1);
      const away = at(toward[0] * 1.4 + side * 1.2, toward[1] * 1.4, BALL_R);
      return [
        { a: from, b: front, h: arc, dur: t },
        { a: front, b: away, h: 0.5, dur: 0.6, sound: 'rim' },
        { a: away, b: [away[0] + side * 0.6, away[1] + 0.8, BALL_R], h: 0.35, dur: 0.45, sound: 'bounce' },
      ];
    }
    case 'brick': {
      const board = at(side * 0.35, BOARD_Y + BALL_R, RIM_HEIGHT + 0.55);
      const floor = at(side * 0.9 + toward[0], toward[1] * 1.8, BALL_R);
      return [
        { a: from, b: board, h: arc * 0.7, dur: t * 0.95 },
        { a: board, b: floor, h: 0.2, dur: 0.6, sound: 'board' },
        { a: floor, b: [floor[0] + side * 0.4, floor[1] + 0.9, BALL_R], h: 0.3, dur: 0.4, sound: 'bounce' },
      ];
    }
    case 'airball': {
      const land = at(toward[0] * 0.9 + side * 0.4, toward[1] * 0.9, BALL_R);
      return [
        { a: from, b: land, h: arc * 0.85, dur: t * 1.05 },
        { a: land, b: [land[0] - toward[0] * 0.8, land[1] - toward[1] * 0.8, BALL_R], h: 0.3, dur: 0.4, sound: 'bounce' },
      ];
    }
  }
}

interface Popup { text: string; color: string; t: number; big?: boolean }
interface Spark { x: number; y: number; vx: number; vy: number; life: number; color: string }

export class Shootout {
  private cv: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private W = 1; private H = 1; private dpr = 1;
  private raf = 0;
  private last = 0;
  private cb: ShootoutCallbacks;

  readonly level: Level;
  private course: Spot[];
  private max: number;
  private spotIdx = 0;
  private ballIdx = 0;
  private phase: Phase = 'walk';
  private phaseT = 0;
  private clock: number;
  score = 0;
  private makes = 0; private shots = 0; private streak = 0; private bestStreak = 0;
  private holdT = 0;
  private win = { green: 0.08, rise: 0.7 };
  private greenPinged = false;
  private flight: Leg[] = [];
  private flightT = 0;
  private legPlayed = -1;
  private outcome: Outcome | null = null;
  private ballNow: Ball | null = null;
  private netKick = 0;
  private flash = 0;
  private shake = 0;
  private popups: Popup[] = [];
  private sparks: Spark[] = [];
  private crowd: Array<{ x: number; y: number; c: string; s: number }> = [];
  private walkFrom: [number, number] = [0, 9];
  private lastTick = -1;
  private reduced = false;

  constructor(canvas: HTMLCanvasElement, level: Level, moneyRack: number, cb: ShootoutCallbacks = {}) {
    this.cv = canvas;
    this.g = canvas.getContext('2d')!;
    this.cb = cb;
    this.level = level;
    this.course = buildCourse(moneyRack);
    this.max = MAX_SCORE(this.course);
    this.clock = level.clock;
    this.reduced = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const hues = ['#2B2D42', '#8D99AE', '#EF233C', '#F2E9E4', '#3A86FF', '#FFBE0B', '#6A4C93', '#1B998B'];
    for (let i = 0; i < 520; i++) this.crowd.push({ x: Math.random(), y: Math.random(), c: hues[Math.floor(Math.random() * hues.length)], s: Math.random() });
    this.resize();
  }

  start(): void {
    this.last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.step(dt);
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void { cancelAnimationFrame(this.raf); }

  resize(): void {
    const r = this.cv.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = Math.max(1, r.width); this.H = Math.max(1, r.height);
    this.cv.width = Math.round(this.W * this.dpr); this.cv.height = Math.round(this.H * this.dpr);
  }

  get spot(): Spot { return this.course[this.spotIdx]; }
  get timeLeft(): number { return Math.max(0, this.clock); }

  // ---- Input ----------------------------------------------------------------

  press(): void {
    if (this.phase !== 'aim') return;
    this.phase = 'hold'; this.holdT = 0; this.greenPinged = false;
  }

  release(): void {
    if (this.phase !== 'hold') return;
    this.shoot();
  }

  // ---- Simulation -----------------------------------------------------------

  private step(dt: number): void {
    this.phaseT += dt;
    if (this.phase !== 'done') {
      this.clock -= dt;
      const sec = Math.ceil(this.clock);
      if (this.clock <= 5 && sec !== this.lastTick && sec > 0) { this.lastTick = sec; sfx.playTick(); }
      if (this.clock <= 0 && this.phase !== 'flight') { this.finish(); return; }
    }
    if (this.phase === 'walk' && this.phaseT > 1.15) this.enter('aim');
    if (this.phase === 'hold') {
      this.holdT += dt;
      const { green, rise } = this.win;
      if (!this.greenPinged && this.holdT >= rise - green / 2) { this.greenPinged = true; sfx.playGreen(); }
      // Hold too long and the shot goes up anyway, late.
      if (this.holdT > rise * 1.45) this.shoot();
    }
    if (this.phase === 'flight') {
      this.flightT += dt;
      let acc = 0;
      for (let i = 0; i < this.flight.length; i++) {
        if (this.flightT >= acc && i > this.legPlayed) {
          this.legPlayed = i;
          const s = this.flight[i].sound;
          if (s === 'rim') { sfx.playRim(); this.netKick = Math.max(this.netKick, 0.4); }
          if (s === 'board') sfx.playBoard();
          if (s === 'swish') { sfx.playSwish(this.ballNow?.points); this.netKick = 1; this.celebrate(); }
          if (s === 'bounce') sfx.playBounce();
        }
        acc += this.flight[i].dur;
      }
      if (this.flightT > acc + 0.15) this.nextBall();
    }
    this.netKick = Math.max(0, this.netKick - dt * 1.6);
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.shake = Math.max(0, this.shake - dt * 3);
    this.popups = this.popups.filter(p => (p.t += dt) < 1.4);
    this.sparks = this.sparks.filter(s => { s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 260 * dt; return s.life > 0; });
  }

  private enter(p: Phase): void { this.phase = p; this.phaseT = 0; }

  private shoot(): void {
    const ball = this.spot.balls[this.ballIdx];
    const { grade } = judge(this.holdT, this.win.rise, this.win.green * fireBoost(this.streak));
    this.outcome = resolveShot(grade);
    this.ballNow = ball;
    const [px, py] = spotPosition(this.spot);
    const eye = this.eye(px, py, 1);
    const fwd = norm(sub([0, 0, RIM_HEIGHT], eye));
    const from: V3 = [eye[0] + fwd[0] * 0.35, eye[1] + fwd[1] * 0.35, eye[2] + 0.15];
    this.flight = planFlight(from, this.outcome, Math.random() < 0.5 ? -1 : 1);
    this.flightT = 0; this.legPlayed = 0;
    this.shots++;
    const label: Record<Grade, [string, string]> = {
      perfect: ['PERFECT', '#22C55E'], good: ['GOOD', '#A3E635'], early: ['EARLY', '#FBBF24'], late: ['LATE', '#FBBF24'],
      'very-early': ['WAY EARLY', '#F87171'], 'very-late': ['WAY LATE', '#F87171'],
    };
    this.popups.push({ text: label[grade][0], color: label[grade][1], t: 0 });
    this.enter('flight');
    if (!isMake(this.outcome)) {
      this.streak = 0;
    }
  }

  private celebrate(): void {
    if (!this.outcome || !isMake(this.outcome) || !this.ballNow) return;
    const pts = this.ballNow.points;
    this.score += pts; this.makes++; this.streak++;
    this.bestStreak = Math.max(this.bestStreak, this.streak);
    this.cb.onScore?.(this.score);
    const big = pts > 1 || this.streak >= 3 || this.outcome === 'swish';
    this.popups.push({ text: `+${pts}${this.outcome === 'swish' ? '  SWISH' : ''}`, color: pts === 3 ? '#E0E7FF' : pts === 2 ? '#F472B6' : '#FFFFFF', t: 0, big: true });
    if (this.streak === 3) this.popups.push({ text: 'ON FIRE 🔥', color: '#FB923C', t: -0.3, big: true });
    this.flash = pts > 1 ? 0.6 : 0.25;
    if (!this.reduced) this.shake = big ? 0.5 : 0.2;
    try { navigator.vibrate?.(pts > 1 ? [20, 40, 30] : 18); } catch { /* not supported */ }
    // Confetti from the rim.
    const [rx, ry] = this.project(this.camNow(), [0, 0, RIM_HEIGHT]);
    const colors = pts === 3 ? ['#E0E7FF', '#A5B4FC', '#FFFFFF'] : pts === 2 ? ['#F472B6', '#FBBF24', '#FFFFFF'] : ['#FBBF24', '#FFFFFF', '#FB923C'];
    for (let i = 0; i < (big ? 46 : 22); i++) {
      const a = Math.random() * Math.PI * 2, v = 80 + Math.random() * 220;
      this.sparks.push({ x: rx, y: ry, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 140, life: 0.6 + Math.random() * 0.6, color: colors[i % colors.length] });
    }
  }

  private nextBall(): void {
    this.ballIdx++;
    if (this.ballIdx >= this.spot.balls.length) {
      this.walkFrom = spotPosition(this.spot);
      this.spotIdx++; this.ballIdx = 0;
      if (this.spotIdx >= this.course.length) { this.finish(); return; }
      this.prepWindow();
      this.enter('walk');
      return;
    }
    this.prepWindow();
    this.enter('aim');
  }

  private prepWindow(): void {
    const s = this.spot;
    if (!s) return;
    this.win = shotWindow(this.level, s, s.balls[this.ballIdx], this.ballIdx);
  }

  private finish(): void {
    if (this.phase === 'done') return;
    this.enter('done');
    sfx.playHorn();
    this.cb.onDone?.({ score: this.score, max: this.max, makes: this.makes, shots: this.shots, bestStreak: this.bestStreak, level: this.level });
  }

  begin(): void {
    this.prepWindow();
    this.walkFrom = [0, 10];
    this.enter('walk');
  }

  // ---- Camera ---------------------------------------------------------------

  /** The shooter's eyes at a spot; `jump` 0..1 lifts them through the jump. */
  private eye(px: number, py: number, jump: number): V3 {
    return [px * 1.04, py * 1.04, 1.78 + Math.sin(Math.min(1, jump) * Math.PI * 0.5) * 0.55];
  }

  private camNow(): { eye: V3; look: V3; f: number } {
    if (this.phase === 'walk' || this.phase === 'done') {
      // Fixed broadcast camera from the sideline, high.
      return { eye: [-9.5, 9.5, 6.2], look: [0.5, 3.6, 0.6], f: 0.62 };
    }
    const [px, py] = spotPosition(this.spot);
    const jump = this.phase === 'hold' ? this.holdT / this.win.rise : this.phase === 'flight' ? Math.max(0, 1 - this.flightT * 1.4) : 0;
    const eye = this.eye(px, py, jump);
    // A touch of sway while waiting, so it feels like standing there.
    const sway = this.phase === 'aim' && !this.reduced ? Math.sin(this.phaseT * 1.6) * 0.012 : 0;
    // Follow the ball a little as it flies, then settle back on the rim.
    let look: V3 = [sway, 0, RIM_HEIGHT - 0.8];
    if (this.phase === 'flight') { const b = this.ballPos(); look = [lerp(look[0], b[0], 0.2), lerp(look[1], b[1], 0.2), lerp(look[2], Math.max(look[2], b[2]), 0.45)]; }
    return { eye, look, f: 0.82 };
  }

  /** A world point in camera space: [right, up, forward]. */
  private toCam(cam: { eye: V3; look: V3; f: number }, p: V3): V3 {
    const fwd = norm(sub(cam.look, cam.eye));
    const right = norm(cross(fwd, [0, 0, 1]));
    const up = cross(right, fwd);
    const d = sub(p, cam.eye);
    return [dot(d, right), dot(d, up), dot(d, fwd)];
  }

  /** Focal length in pixels: wide enough on phones (portrait) and desktops alike. */
  private focal(cam: { f: number }): number { return Math.min(this.W, this.H * 1.6) * cam.f; }

  private fromCam(cam: { eye: V3; look: V3; f: number }, c: V3): [number, number, number] {
    const k = this.focal(cam) / Math.max(0.05, c[2]);
    return [this.W / 2 + c[0] * k, this.H * 0.5 - c[1] * k, c[2]];
  }

  private project(cam: { eye: V3; look: V3; f: number }, p: V3): [number, number, number] {
    return this.fromCam(cam, this.toCam(cam, p));
  }

  private ballPos(): V3 {
    let acc = 0;
    for (const leg of this.flight) {
      if (this.flightT <= acc + leg.dur) return legAt(leg, Math.max(0, (this.flightT - acc) / leg.dur));
      acc += leg.dur;
    }
    const lastLeg = this.flight[this.flight.length - 1];
    return lastLeg ? lastLeg.b : [0, 0, 0];
  }

  // ---- Drawing --------------------------------------------------------------

  private draw(): void {
    const g = this.g, W = this.W, H = this.H;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const shake = this.shake > 0 ? [(Math.random() - 0.5) * 6 * this.shake, (Math.random() - 0.5) * 6 * this.shake] : [0, 0];
    g.translate(shake[0], shake[1]);
    const cam = this.camNow();

    this.drawArena(cam);
    this.drawFloor(cam);
    this.drawHoop(cam, false);
    if (this.phase === 'walk' || this.phase === 'done') this.drawOverview(cam);
    if (this.phase === 'flight') this.drawBall(cam, this.ballPos());
    this.drawHoop(cam, true);
    if (this.phase === 'aim' || this.phase === 'hold') this.drawHands();
    if (this.phase === 'hold' || this.phase === 'aim') this.drawMeter();

    // Sparks and popups over everything.
    this.sparks.forEach(s => { g.globalAlpha = Math.min(1, s.life * 2); g.fillStyle = s.color; g.fillRect(s.x - 2, s.y - 2, 4, 4); });
    g.globalAlpha = 1;
    this.popups.forEach((p, i) => {
      if (p.t < 0) return;
      const a = Math.min(1, (1.4 - p.t) * 2), y = H * (p.big ? 0.2 : 0.7) - p.t * 30 - i * 4;
      g.globalAlpha = a; g.textAlign = 'center';
      g.font = `900 ${p.big ? Math.min(54, W * 0.09) : Math.min(30, W * 0.055)}px Inter, system-ui, sans-serif`;
      g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.55)'; g.strokeText(p.text, W / 2, y);
      g.fillStyle = p.color; g.fillText(p.text, W / 2, y);
    });
    g.globalAlpha = 1;
    if (this.flash > 0) { g.fillStyle = `rgba(255,255,255,${this.flash * 0.35})`; g.fillRect(-10, -10, W + 20, H + 20); }
    if (this.streak >= 3 && this.phase !== 'done') {
      // On fire: warm vignette.
      const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      vg.addColorStop(0, 'rgba(251,146,60,0)'); vg.addColorStop(1, `rgba(251,113,30,${0.22 + Math.sin(performance.now() / 200) * 0.05})`);
      g.fillStyle = vg; g.fillRect(0, 0, W, H);
    }
  }

  private drawArena(cam: { eye: V3; look: V3; f: number }): void {
    const g = this.g, W = this.W, H = this.H;
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#05060C'); sky.addColorStop(0.5, '#12142A'); sky.addColorStop(1, '#1D1B2E');
    g.fillStyle = sky; g.fillRect(-10, -10, W + 20, H + 20);
    // The crowd: rows of fans in the stands, with camera flashes.
    const horizon = this.project(cam, [0, -6, 0])[1];
    const top = Math.max(0, horizon - H * 0.42);
    this.crowd.forEach(p => {
      const y = top + p.y * (horizon - top);
      const x = p.x * W;
      g.fillStyle = p.c; g.globalAlpha = 0.25 + (y - top) / (horizon - top) * 0.45;
      g.fillRect(x, y, 3 + (y - top) / (horizon - top) * 4, 3 + (y - top) / (horizon - top) * 3);
    });
    g.globalAlpha = 1;
    for (let i = 0; i < 3; i++) if (Math.random() < 0.06) { g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(Math.random() * W, top + Math.random() * (horizon - top), 2 + Math.random() * 2, 0, 7); g.fill(); }
    // Arena lights glow.
    const lg = g.createRadialGradient(W / 2, top, 10, W / 2, top, W * 0.7);
    lg.addColorStop(0, 'rgba(255,240,210,.18)'); lg.addColorStop(1, 'rgba(255,240,210,0)');
    g.fillStyle = lg; g.fillRect(0, 0, W, H);
  }

  /**
   * A polyline (or closed polygon) in world space, clipped against the
   * camera's near plane so shapes that pass behind the camera still draw.
   */
  private path3(cam: { eye: V3; look: V3; f: number }, pts: V3[], close = false): void {
    const g = this.g, NEAR = 0.15;
    const C = pts.map(p => this.toCam(cam, p));
    const cut = (a: V3, b: V3): V3 => { const t = (NEAR - a[2]) / (b[2] - a[2]); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]; };
    if (close) {
      // Sutherland-Hodgman against z = NEAR.
      const out: V3[] = [];
      for (let i = 0; i < C.length; i++) {
        const a = C[i], b = C[(i + 1) % C.length], ain = a[2] >= NEAR, bin = b[2] >= NEAR;
        if (ain) out.push(a);
        if (ain !== bin) out.push(cut(a, b));
      }
      out.forEach((c, i) => { const [x, y] = this.fromCam(cam, c); if (i === 0) g.moveTo(x, y); else g.lineTo(x, y); });
      if (out.length) g.closePath();
      return;
    }
    for (let i = 0; i < C.length - 1; i++) {
      let a = C[i], b = C[i + 1];
      if (a[2] < NEAR && b[2] < NEAR) continue;
      if (a[2] < NEAR) a = cut(a, b); else if (b[2] < NEAR) b = cut(b, a);
      const [ax, ay] = this.fromCam(cam, a), [bx, by] = this.fromCam(cam, b);
      g.moveTo(ax, ay); g.lineTo(bx, by);
    }
  }

  private drawFloor(cam: { eye: V3; look: V3; f: number }): void {
    const g = this.g;
    // Hardwood: the court as a big quad, then planks.
    // The apron past the baseline, a shade darker, so the floor runs to the stands.
    g.beginPath(); this.path3(cam, [[-14, -6, 0], [14, -6, 0], [14, 16, 0], [-14, 16, 0]], true);
    g.fillStyle = '#6E4A2A'; g.fill();
    const quad: V3[] = [[-9, -1.6, 0], [9, -1.6, 0], [9, 14, 0], [-9, 14, 0]];
    g.beginPath(); this.path3(cam, quad, true);
    const wood = g.createLinearGradient(0, this.H * 0.3, 0, this.H);
    wood.addColorStop(0, '#9A6A3C'); wood.addColorStop(1, '#C9925A');
    g.fillStyle = wood; g.fill();
    g.strokeStyle = 'rgba(80,45,20,.18)'; g.lineWidth = 1;
    for (let x = -9; x <= 9; x += 0.45) { g.beginPath(); this.path3(cam, [[x, -1.6, 0], [x, 14, 0]]); g.stroke(); }
    // The paint (key) and its lines.
    const key: V3[] = [[-2.44, -1.6, 0], [2.44, -1.6, 0], [2.44, 4.19, 0], [-2.44, 4.19, 0]];
    g.beginPath(); this.path3(cam, key, true); g.fillStyle = 'rgba(122,32,72,.55)'; g.fill();
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2;
    g.beginPath(); this.path3(cam, key, true); g.stroke();
    const ft: V3[] = []; for (let a = 0; a <= Math.PI; a += Math.PI / 24) ft.push([Math.cos(a) * 1.8, 4.19 + Math.sin(a) * 1.8, 0]);
    g.beginPath(); this.path3(cam, ft); g.stroke();
    // The three-point line: straight in the corners, then the arc.
    const a0 = Math.asin(6.7 / 7.24);
    g.lineWidth = 3; g.beginPath(); this.path3(cam, [[-6.7, -1.6, 0], [-6.7, Math.cos(a0) * 7.24, 0]]); g.stroke();
    g.beginPath(); this.path3(cam, [[6.7, -1.6, 0], [6.7, Math.cos(a0) * 7.24, 0]]); g.stroke();
    const arcPts: V3[] = []; for (let a = -a0; a <= a0 + 1e-6; a += a0 / 40) arcPts.push([Math.sin(a) * 7.24, Math.cos(a) * 7.24, 0]);
    g.beginPath(); this.path3(cam, arcPts); g.stroke();
    // Baseline and centre logo.
    g.lineWidth = 2; g.beginPath(); this.path3(cam, [[-9, -1.6, 0], [9, -1.6, 0]]); g.stroke();
    // Floor shine under the lights.
    const [sx, sy] = this.project(cam, [0, 3, 0]);
    const sh = g.createRadialGradient(sx, sy, 4, sx, sy, this.W * 0.5);
    sh.addColorStop(0, 'rgba(255,240,220,.22)'); sh.addColorStop(1, 'rgba(255,240,220,0)');
    g.fillStyle = sh; g.fillRect(0, 0, this.W, this.H);
  }

  /** Backboard, rim and net. The front half of the rim and the net draw after the ball. */
  private drawHoop(cam: { eye: V3; look: V3; f: number }, front: boolean): void {
    const g = this.g;
    if (!front) {
      // Stanchion and board.
      g.strokeStyle = '#2B2D3A'; g.lineWidth = 6;
      g.beginPath(); this.path3(cam, [[0, -2.6, 0], [0, -2.6, 3.4], [0, BOARD_Y - 0.05, 3.4]]); g.stroke();
      const board: V3[] = [[-0.915, BOARD_Y, 2.9], [0.915, BOARD_Y, 2.9], [0.915, BOARD_Y, 3.97], [-0.915, BOARD_Y, 3.97]];
      g.beginPath(); this.path3(cam, board, true); g.fillStyle = 'rgba(230,240,255,.22)'; g.fill();
      g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2.5; g.stroke();
      const inner: V3[] = [[-0.3, BOARD_Y, 3.05], [0.3, BOARD_Y, 3.05], [0.3, BOARD_Y, 3.5], [-0.3, BOARD_Y, 3.5]];
      g.beginPath(); this.path3(cam, inner, true); g.strokeStyle = '#F97316'; g.lineWidth = 2; g.stroke();
      // Rim bracket.
      g.strokeStyle = '#C2410C'; g.lineWidth = 3;
      g.beginPath(); this.path3(cam, [[0, BOARD_Y, RIM_HEIGHT], [0, -RIM_R, RIM_HEIGHT]]); g.stroke();
    }
    // Net: strings from the rim down to a narrower ring, rippling after a make.
    const kick = this.netKick, now = performance.now() / 1000;
    const ringTop: V3[] = [], ringBot: V3[] = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const wob = kick * 0.05 * Math.sin(now * 18 + i);
      ringTop.push([Math.cos(a) * RIM_R, Math.sin(a) * RIM_R, RIM_HEIGHT]);
      ringBot.push([Math.cos(a) * (RIM_R * 0.55 + wob), Math.sin(a) * (RIM_R * 0.55 + wob), RIM_HEIGHT - 0.42 + kick * 0.12]);
    }
    // Front = the half facing the camera.
    const camDir = norm(sub(cam.eye, [0, 0, RIM_HEIGHT]));
    const isFront = (p: V3) => p[0] * camDir[0] + p[1] * camDir[1] >= 0;
    g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 1.1;
    for (let i = 0; i < 16; i++) {
      if (isFront(ringTop[i]) !== front) continue;
      const j = (i + 1) % 16;
      g.beginPath(); this.path3(cam, [ringTop[i], ringBot[j]]); g.stroke();
      g.beginPath(); this.path3(cam, [ringTop[j], ringBot[i]]); g.stroke();
    }
    // Rim: thick orange ring, the matching half.
    g.strokeStyle = '#F97316'; g.lineWidth = Math.max(2.5, this.W * 0.006);
    const seg: V3[] = [];
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2, p: V3 = [Math.cos(a) * RIM_R, Math.sin(a) * RIM_R, RIM_HEIGHT];
      if (isFront(p) === front) seg.push(p); else if (seg.length) { g.beginPath(); this.path3(cam, seg); g.stroke(); seg.length = 0; }
    }
    if (seg.length) { g.beginPath(); this.path3(cam, seg); g.stroke(); }
  }

  private drawBall(cam: { eye: V3; look: V3; f: number }, p: V3): void {
    const g = this.g;
    const [x, y, z] = this.project(cam, p);
    if (z < 0.2) return;
    const r = (BALL_R * this.focal(cam)) / z;
    // Shadow on the floor.
    const [sx, sy, sz] = this.project(cam, [p[0], p[1], 0]);
    if (sz > 0.2) { g.fillStyle = `rgba(0,0,0,${Math.max(0.05, 0.35 - p[2] * 0.06)})`; g.beginPath(); g.ellipse(sx, sy, r * 1.1, r * 0.4, 0, 0, 7); g.fill(); }
    this.ballSprite(x, y, r, this.ballNow?.kind ?? 'regular', this.flightT * 9);
  }

  /** The ball: orange (money balls red-white-blue, Starry white) with seams and a highlight. */
  private ballSprite(x: number, y: number, r: number, kind: Ball['kind'], spin: number): void {
    const g = this.g;
    const grad = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    if (kind === 'money') { grad.addColorStop(0, '#FFE4E6'); grad.addColorStop(0.5, '#E11D48'); grad.addColorStop(1, '#1E3A8A'); }
    else if (kind === 'starry') { grad.addColorStop(0, '#FFFFFF'); grad.addColorStop(0.7, '#E0E7FF'); grad.addColorStop(1, '#A5B4FC'); }
    else { grad.addColorStop(0, '#FDBA74'); grad.addColorStop(0.6, '#EA580C'); grad.addColorStop(1, '#9A3412'); }
    g.fillStyle = grad; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.save(); g.beginPath(); g.arc(x, y, r, 0, 7); g.clip();
    g.strokeStyle = kind === 'starry' ? 'rgba(99,102,241,.7)' : 'rgba(30,10,0,.75)'; g.lineWidth = Math.max(1, r * 0.08);
    g.translate(x, y); g.rotate(spin);
    g.beginPath(); g.moveTo(-r, 0); g.lineTo(r, 0); g.stroke();
    g.beginPath(); g.ellipse(0, 0, r * 0.45, r, 0, 0, 7); g.stroke();
    g.beginPath(); g.ellipse(0, 0, r, r * 0.5, Math.PI / 2, -Math.PI / 2, Math.PI / 2); g.stroke();
    g.restore();
    if (this.streak >= 3) {
      // On fire: flames trail the ball.
      for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(251,${120 + i * 20},40,${0.5 - i * 0.07})`; g.beginPath(); g.arc(x + (Math.random() - 0.5) * r, y + r * (0.4 + i * 0.25), r * (0.7 - i * 0.09), 0, 7); g.fill(); }
    }
  }

  /** First person: the ball in your hands, rising through the jump. */
  private drawHands(): void {
    const g = this.g, W = this.W, H = this.H;
    const t = this.phase === 'hold' ? Math.min(1.2, this.holdT / this.win.rise) : 0;
    const lift = ease(Math.min(1, t)) * H * 0.22;
    const r = Math.min(W, H) * 0.11;
    const x = W * 0.54, y = H * 0.88 - lift + (this.phase === 'aim' ? Math.sin(this.phaseT * 3) * 3 : 0);
    // Forearms from the bottom of the screen.
    g.strokeStyle = '#8D5A3B'; g.lineCap = 'round';
    g.lineWidth = r * 0.55; g.beginPath(); g.moveTo(W * 0.66, H + 20); g.lineTo(x + r * 0.7, y + r * 0.3); g.stroke();
    g.lineWidth = r * 0.5; g.beginPath(); g.moveTo(W * 0.4, H + 20); g.lineTo(x - r * 0.75, y + r * 0.45); g.stroke();
    this.ballSprite(x, y, r, this.spot.balls[this.ballIdx]?.kind ?? 'regular', 0.4);
    // Fingers over the ball.
    g.fillStyle = '#9C6644';
    for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(x + r * 0.55 + i * r * 0.1, y - r * 0.35 + i * r * 0.2, r * 0.12, r * 0.3, -0.4, 0, 7); g.fill(); }
    g.beginPath(); g.ellipse(x - r * 0.75, y + r * 0.2, r * 0.16, r * 0.34, 0.5, 0, 7); g.fill();
  }

  /** The shot meter beside the ball: fills while you hold; the green zone is the release window. */
  private drawMeter(): void {
    const g = this.g, W = this.W, H = this.H;
    const full = this.win.rise * 1.45;
    const h = Math.min(220, H * 0.34), w = 12, x = W * 0.54 + Math.min(W, H) * 0.17, y = H * 0.82 - h;
    g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.roundRect(x - 3, y - 3, w + 6, h + 6, 8); g.fill();
    const green = this.win.green * fireBoost(this.streak);
    const gTop = y + h - ((this.win.rise + green / 2) / full) * h, gBot = y + h - ((this.win.rise - green / 2) / full) * h;
    g.fillStyle = this.streak >= 3 ? '#FB923C' : '#22C55E'; g.fillRect(x, gTop, w, gBot - gTop);
    if (this.phase === 'hold') {
      const fill = Math.min(1, this.holdT / full) * h;
      const inGreen = Math.abs(this.holdT - this.win.rise) <= green / 2;
      g.fillStyle = inGreen ? '#BBF7D0' : 'rgba(255,255,255,.9)';
      g.fillRect(x, y + h - fill, w, 3);
      g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x, y + h - fill, w, fill);
    }
  }

  /** The broadcast view between racks: the racks, the money rack, and you jogging to the next spot. */
  private drawOverview(cam: { eye: V3; look: V3; f: number }): void {
    const g = this.g;
    this.course.forEach((s, i) => {
      const [x, y] = spotPosition(s);
      const done = i < this.spotIdx;
      // The rack: a little cart of balls.
      const [rx, ry, rz] = this.project(cam, [x * 1.08, y * 1.08, 0.5]);
      if (rz < 0.2) return;
      const r = (0.1 * this.focal(cam)) / rz;
      const left = done ? 0 : s.balls.length - (i === this.spotIdx ? this.ballIdx : 0);
      for (let k = 0; k < left; k++) this.ballSprite(rx + (k - (left - 1) / 2) * r * 1.6, ry, r * 0.75, s.balls[k].kind, 0);
    });
    // You, jogging over.
    const to = spotPosition(this.spot);
    const u = this.phase === 'walk' ? ease(Math.min(1, this.phaseT / 1.0)) : 1;
    const px = lerp(this.walkFrom[0], to[0], u), py = lerp(this.walkFrom[1], to[1], u);
    const [fx, fy, fz] = this.project(cam, [px, py, 0]);
    const [hx, hy] = this.project(cam, [px, py, 1.9]);
    if (fz > 0.2) {
      const bob = Math.abs(Math.sin(this.phaseT * 12)) * 3 * (1 - u);
      g.strokeStyle = '#1D4ED8'; g.lineWidth = Math.max(4, (0.32 * this.focal(cam)) / fz); g.lineCap = 'round';
      g.beginPath(); g.moveTo(fx, fy - bob); g.lineTo(hx, hy - bob + 10); g.stroke();
      g.fillStyle = '#8D5A3B'; g.beginPath(); g.arc(hx, hy - bob, Math.max(4, (0.13 * this.focal(cam)) / fz), 0, 7); g.fill();
    }
    // Where you're headed.
    if (this.phase === 'walk') {
      g.font = '800 16px Inter, system-ui, sans-serif'; g.textAlign = 'center';
      g.fillStyle = 'rgba(255,255,255,.95)';
      const [lx, ly] = this.project(cam, [to[0] * 1.08, to[1] * 1.08, 1.2]);
      g.fillText(this.spot.label.toUpperCase(), lx, ly - 12);
    }
  }

  /** For the HUD: balls left on the current rack, with their kinds. */
  rackState(): Array<{ kind: Ball['kind']; state: 'done' | 'now' | 'left' }> {
    const s = this.spot;
    if (!s) return [];
    return s.balls.map((b, i) => ({ kind: b.kind, state: i < this.ballIdx ? 'done' : i === this.ballIdx ? 'now' : 'left' }));
  }

  hud(): { score: number; time: number; spot: string; streak: number; phase: Phase } {
    return { score: this.score, time: this.timeLeft, spot: this.spot?.label ?? '', streak: this.streak, phase: this.phase };
  }
}

export { LEVELS };

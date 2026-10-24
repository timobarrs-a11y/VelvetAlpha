// Shootout sounds, synthesised with Web Audio (no files): clean tones only
// (make chime, rim, backboard, bounce, shot clock, horn). Crowd and net noise
// are out until there are real recordings. Silent when blocked or muted.

let ctx: AudioContext | null = null;
let muted = false;

function ac(): AudioContext | null {
  if (muted) return null;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx ??= new AC();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  } catch { return null; }
}

/**
 * Start audio from inside a tap or click. iOS only lets audio begin during a
 * user gesture (and creating the context is slow), so do it here rather than
 * on the first sound, which plays from the game loop mid-jump.
 */
export function unlockAudio(): void {
  const c = ac();
  if (!c) return;
  try {
    const src = c.createBufferSource();
    src.buffer = c.createBuffer(1, 1, c.sampleRate);
    src.connect(c.destination); src.start();
  } catch { /* not supported */ }
}

export function setMuted(v: boolean): void { muted = v; if (!v) unlockAudio(); }
export const isMuted = () => muted;

function tone(c: AudioContext, at: number, freq: number, dur: number, peak: number, type: OscillatorType = 'sine') {
  const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(peak, at + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(c.destination); o.start(at); o.stop(at + dur + 0.02);
  return o;
}

/** A make: a soft, bright two-note chime (higher for bigger balls). */
export function playSwish(points = 1): void {
  const c = ac(); if (!c) return;
  const t = c.currentTime, base = points >= 3 ? 880 : points === 2 ? 784 : 659;
  tone(c, t, base, 0.25, 0.07); tone(c, t + 0.07, base * 1.5, 0.35, 0.06);
  if (points >= 2) tone(c, t + 0.14, base * 2, 0.4, 0.045);
}

/** Ball on the rim: metallic partials that ring. */
export function playRim(strength = 1): void {
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  [523, 1093, 1867].forEach((f, i) => tone(c, t, f * (0.98 + Math.random() * 0.04), 0.3 - i * 0.06, (0.06 / (i + 1)) * strength, 'triangle'));
}

/** Backboard: a hollow knock. */
export function playBoard(): void {
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  const o = tone(c, t, 160, 0.18, 0.22, 'sine'); o.frequency.exponentialRampToValueAtTime(90, t + 0.15);
}

/** The ball hitting the floor. */
export function playBounce(): void {
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  const o = tone(c, t, 120, 0.14, 0.28); o.frequency.exponentialRampToValueAtTime(60, t + 0.12);
}

/** Last seconds on the clock. */
export function playTick(): void {
  const c = ac(); if (!c) return;
  tone(c, c.currentTime, 1200, 0.07, 0.05, 'triangle');
}

/** The horn at the end. */
export function playHorn(): void {
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  [220, 277, 330].forEach(f => tone(c, t, f, 1.0, 0.05, 'triangle'));
}

/** The meter hitting the green (only while the meter is showing). */
export function playGreen(): void {
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  tone(c, t, 1320, 0.15, 0.06); tone(c, t + 0.05, 1760, 0.18, 0.05);
}

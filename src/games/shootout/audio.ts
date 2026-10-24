// Shootout sounds, synthesised with Web Audio (no files): the swish, rim and
// backboard, the crowd, the shot clock and the horn. Silent when audio is
// blocked or muted.

let ctx: AudioContext | null = null;
let muted = false;
let crowdGain: GainNode | null = null;

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

export function setMuted(v: boolean): void {
  muted = v;
  if (crowdGain && ctx) crowdGain.gain.setTargetAtTime(v ? 0 : 0.035, ctx.currentTime, 0.2);
}
export const isMuted = () => muted;

function noiseBuffer(c: AudioContext, seconds: number): AudioBuffer {
  const b = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function noise(c: AudioContext, at: number, dur: number, type: BiquadFilterType, freq: number, q: number, peak: number, attack = 0.005) {
  const src = c.createBufferSource(); src.buffer = noiseBuffer(c, dur);
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(peak, at + attack); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(c.destination); src.start(at); src.stop(at + dur);
  return f;
}

function tone(c: AudioContext, at: number, freq: number, dur: number, peak: number, type: OscillatorType = 'sine') {
  const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(peak, at + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(c.destination); o.start(at); o.stop(at + dur + 0.02);
  return o;
}

/** The release: a soft flick of the wrist. */
export function playRelease(): void {
  const c = ac(); if (!c) return;
  noise(c, c.currentTime, 0.08, 'highpass', 2500, 0.7, 0.05);
}

/** Pure net: a breathy, rising "shhk". */
export function playSwish(): void {
  const c = ac(); if (!c) return;
  const f = noise(c, c.currentTime, 0.32, 'bandpass', 2600, 1.4, 0.32, 0.02);
  f.frequency.setValueAtTime(1800, c.currentTime); f.frequency.exponentialRampToValueAtTime(4200, c.currentTime + 0.25);
}

/** Ball on the rim: metallic partials that ring. */
export function playRim(strength = 1): void {
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  [523, 1093, 1867, 2741].forEach((f, i) => tone(c, t, f * (0.98 + Math.random() * 0.04), 0.35 - i * 0.05, (0.09 / (i + 1)) * strength, 'triangle'));
  noise(c, t, 0.05, 'bandpass', 3000, 2, 0.08 * strength);
}

/** Backboard: a hollow knock. */
export function playBoard(): void {
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  const o = tone(c, t, 160, 0.18, 0.3, 'sine'); o.frequency.exponentialRampToValueAtTime(90, t + 0.15);
  noise(c, t, 0.12, 'lowpass', 900, 0.8, 0.18);
}

/** The ball hitting the floor. */
export function playBounce(): void {
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  const o = tone(c, t, 120, 0.14, 0.35); o.frequency.exponentialRampToValueAtTime(60, t + 0.12);
}

/** The crowd: a low bed that's always there. */
export function startCrowd(): void {
  const c = ac(); if (!c || crowdGain) return;
  const src = c.createBufferSource(); src.buffer = noiseBuffer(c, 4); src.loop = true;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.5;
  crowdGain = c.createGain(); crowdGain.gain.value = 0.035;
  src.connect(f).connect(crowdGain).connect(c.destination); src.start();
}

/** A roar that swells and fades. Bigger for money balls and streaks. */
export function playCheer(size = 1): void {
  const c = ac(); if (!c) return;
  const t = c.currentTime, dur = 1.2 + size * 0.8;
  const f = noise(c, t, dur, 'bandpass', 900, 0.6, Math.min(0.5, 0.18 * size), 0.18);
  f.frequency.setValueAtTime(700, t); f.frequency.linearRampToValueAtTime(1300, t + 0.3);
  // A few whistles on top for the big ones.
  if (size >= 2) for (let i = 0; i < 2; i++) { const w = tone(c, t + 0.1 + i * 0.25, 2200 + i * 300, 0.35, 0.03); w.frequency.linearRampToValueAtTime(2900 + i * 200, t + 0.4 + i * 0.25); }
}

/** A disappointed "ohh". */
export function playGroan(): void {
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  const f = noise(c, t, 0.9, 'bandpass', 500, 1.2, 0.12, 0.08);
  f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(320, t + 0.8);
}

/** Last seconds on the clock. */
export function playTick(): void {
  const c = ac(); if (!c) return;
  tone(c, c.currentTime, 1500, 0.06, 0.08, 'square');
}

/** The horn at the end. */
export function playHorn(): void {
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  [220, 277, 330].forEach(f => tone(c, t, f, 1.1, 0.08, 'sawtooth'));
}

/** The meter hitting the green: a bright ping. */
export function playGreen(): void {
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  tone(c, t, 1320, 0.18, 0.12); tone(c, t + 0.06, 1760, 0.22, 0.1);
}

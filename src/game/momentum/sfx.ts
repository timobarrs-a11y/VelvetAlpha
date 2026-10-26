// One-shot sound effects for Momentum.
// Synthesized with the Web Audio API (no assets) so they load instantly.

const MUTE_KEY = 'momentum_muted';
// Pentatonic steps so a rising bounce chain always sounds musical
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];

class MomentumSfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      // storage unavailable
    }
  }

  private ensureCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      try {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.35;
        this.master.connect(this.ctx.destination);
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** Call from a user gesture so mobile browsers allow audio. */
  unlock() {
    this.ensureCtx();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.35;
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      // storage unavailable
    }
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0) {
    const ctx = this.ensureCtx();
    if (!ctx || !this.master || this.muted) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, from: number, to: number) {
    const ctx = this.ensureCtx();
    if (!ctx || !this.master || this.muted) return;
    const t = ctx.currentTime;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(from, t);
    filter.frequency.exponentialRampToValueAtTime(to, t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
  }

  /** Pitch climbs with the momentum chain. */
  bounce(chain: number) {
    const step = SCALE[Math.min(SCALE.length - 1, chain)];
    this.tone(330 * Math.pow(2, step / 12), 0.14, 'triangle', 0.25);
  }

  spring() {
    this.tone(220, 0.25, 'sine', 0.3, 880);
  }

  boost() {
    this.noise(0.28, 0.35, 400, 2400);
    this.tone(180, 0.2, 'sawtooth', 0.08, 520);
  }

  perfect() {
    [0, 4, 7, 12].forEach((s, i) => this.tone(660 * Math.pow(2, s / 12), 0.18, 'sine', 0.22, undefined, i * 0.04));
  }

  checkpoint() {
    [0, 7, 12].forEach((s, i) => this.tone(523 * Math.pow(2, s / 12), 0.3, 'square', 0.08, undefined, i * 0.08));
  }

  orb() {
    this.tone(990, 0.12, 'sine', 0.2, 1480);
  }

  empty() {
    this.tone(160, 0.08, 'square', 0.06);
  }

  fall() {
    this.tone(500, 0.6, 'triangle', 0.2, 80);
  }

  win() {
    [0, 4, 7, 12, 16].forEach((s, i) => this.tone(523 * Math.pow(2, s / 12), 0.35, 'triangle', 0.2, undefined, i * 0.09));
  }
}

export const momentumSfx = new MomentumSfx();

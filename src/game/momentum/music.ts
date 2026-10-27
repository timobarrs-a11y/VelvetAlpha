// Adaptive music for Momentum: a small Web Audio sequencer whose layers follow the climb.
// Intensity 0 = kick and bass, 1 adds hats, 2 an arpeggio, 3 claps and a lead, 4 (Overdrive) everything, brighter.
import { momentumSfx } from './sfx';

const BPM = 124;
const STEP = 60 / BPM / 4; // sixteenth notes
const LOOKAHEAD_S = 0.12;
const TICK_MS = 25;

// i - VI - III - VII in A minor, one chord per bar
const CHORDS: Array<{ root: number; tones: number[] }> = [
  { root: 110.0, tones: [0, 3, 7] }, // Am
  { root: 87.31, tones: [0, 4, 7] }, // F
  { root: 130.81, tones: [0, 4, 7] }, // C
  { root: 98.0, tones: [0, 4, 7] }, // G
];
const BASS_STEPS = new Set([0, 3, 6, 8, 11, 14]);
const LEAD = [12, 10, 7, 10, 12, 15, 12, 7]; // semitones above the chord root, one per beat
const CUTOFF = [1400, 2600, 5000, 12000, 16000];

const semis = (f: number, s: number) => f * Math.pow(2, s / 12);

class MomentumMusic {
  private bus: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private intensity = 0;

  get playing() {
    return this.timer !== null;
  }

  start() {
    if (this.timer !== null) return;
    const out = momentumSfx.output();
    if (!out) return;
    const { ctx, master } = out;
    if (!this.bus) {
      this.filter = ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.Q.value = 0.8;
      this.bus = ctx.createGain();
      this.filter.connect(this.bus).connect(master);
      const len = Math.floor(ctx.sampleRate * 0.3);
      this.noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    this.bus!.gain.cancelScheduledValues(ctx.currentTime);
    this.bus!.gain.setTargetAtTime(0.55, ctx.currentTime, 0.3);
    this.filter!.frequency.setValueAtTime(CUTOFF[this.intensity], ctx.currentTime);
    this.nextTime = ctx.currentTime + 0.05;
    this.step = 0;
    this.timer = window.setInterval(() => this.schedule(ctx), TICK_MS);
  }

  stop() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    const out = momentumSfx.output();
    if (out && this.bus) this.bus.gain.setTargetAtTime(0, out.ctx.currentTime, 0.15);
  }

  setIntensity(level: number) {
    const next = Math.max(0, Math.min(4, level));
    if (next === this.intensity) return;
    this.intensity = next;
    const out = momentumSfx.output();
    if (out && this.filter) this.filter.frequency.setTargetAtTime(CUTOFF[next], out.ctx.currentTime, 0.25);
  }

  /** The climb broke: muffle the mix and let it swell back. */
  drop() {
    const out = momentumSfx.output();
    if (!out || !this.filter) return;
    const t = out.ctx.currentTime;
    this.filter.frequency.cancelScheduledValues(t);
    this.filter.frequency.setValueAtTime(320, t);
    this.filter.frequency.setTargetAtTime(CUTOFF[this.intensity], t + 0.25, 0.35);
  }

  private schedule(ctx: AudioContext) {
    while (this.nextTime < ctx.currentTime + LOOKAHEAD_S) {
      if (!momentumSfx.muted) this.playStep(ctx, this.step, this.nextTime);
      this.nextTime += STEP;
      this.step = (this.step + 1) % 64;
    }
  }

  private playStep(ctx: AudioContext, step: number, t: number) {
    const s = step % 16;
    const chord = CHORDS[Math.floor(step / 16)];
    const lvl = this.intensity;

    if (s % 4 === 0) this.kick(ctx, t, lvl >= 4);
    if (BASS_STEPS.has(s)) this.voice(ctx, t, chord.root, STEP * 1.6, 'sawtooth', 0.09, 600);
    // Hats: off-beat eighths, then every eighth once the climb is hot
    if (lvl >= 1 && (lvl >= 3 ? s % 2 === 0 : s % 4 === 2)) this.hat(ctx, t);
    if (lvl >= 2) {
      const tone = chord.tones[s % chord.tones.length] + 12 * (1 + Math.floor(s / 8) % 2);
      this.voice(ctx, t, semis(chord.root, tone), STEP * 0.9, 'triangle', 0.05);
      if (lvl >= 4) this.voice(ctx, t, semis(chord.root, tone + 24), STEP * 0.6, 'square', 0.018);
    }
    if (lvl >= 3) {
      if (s === 4 || s === 12) this.clap(ctx, t);
      if (s % 4 === 0) this.voice(ctx, t, semis(chord.root, LEAD[(step / 4) % LEAD.length] + 12), STEP * 3, 'square', 0.03, 2600);
    }
  }

  private voice(ctx: AudioContext, t: number, freq: number, dur: number, type: OscillatorType, vol: number, lowpass?: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = osc;
    if (lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpass;
      node = osc.connect(f);
    }
    node.connect(gain).connect(this.filter!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private kick(ctx: AudioContext, t: number, pump: boolean) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(gain).connect(this.filter!);
    osc.start(t);
    osc.stop(t + 0.2);
    if (pump && this.bus) {
      // Overdrive: duck the mix on every kick for a pumping feel
      this.bus.gain.setValueAtTime(0.3, t);
      this.bus.gain.linearRampToValueAtTime(0.6, t + STEP * 3);
    }
  }

  private hat(ctx: AudioContext, t: number) {
    this.noiseHit(ctx, t, 0.035, 0.05, 'highpass', 7000);
  }

  private clap(ctx: AudioContext, t: number) {
    this.noiseHit(ctx, t, 0.12, 0.12, 'bandpass', 1800);
  }

  private noiseHit(ctx: AudioContext, t: number, dur: number, vol: number, type: BiquadFilterType, freq: number) {
    if (!this.noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(gain).connect(this.filter!);
    src.start(t);
    src.stop(t + dur + 0.01);
  }
}

export const momentumMusic = new MomentumMusic();

/** Music layer for the current game state. */
export const musicIntensity = (chain: number, overdrive: boolean) =>
  overdrive ? 4 : chain >= 6 ? 3 : chain >= 4 ? 2 : chain >= 2 ? 1 : 0;

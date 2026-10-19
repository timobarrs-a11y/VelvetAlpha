// One-shot sound effects for Social Combat.
// Uses the Web Audio API directly (no assets needed). Sounds are
// synthesized so they stay tiny and load instantly.

type SfxName =
  | 'hit'
  | 'super'
  | 'weak'
  | 'crit'
  | 'combo'
  | 'ult'
  | 'heal'
  | 'oppHit'
  | 'oppTelegraph'
  | 'win'
  | 'lose'
  | 'click'
  | 'perk';

class SfxEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;

  private ensureCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      try {
        const Ctor = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.5;
        this.master.connect(this.ctx.destination);
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      const now = this.ctx.currentTime;
      this.master.gain.setTargetAtTime(m ? 0 : 0.5, now, 0.05);
    }
  }
  isMuted() { return this.muted; }

  play(name: SfxName) {
    const ctx = this.ensureCtx();
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    switch (name) {
      case 'hit':       this.blip(ctx, 320, 0.12, 'square', 0.18); break;
      case 'super':     this.sweep(ctx, 420, 880, 0.18, 'sawtooth', 0.2); break;
      case 'weak':      this.blip(ctx, 180, 0.16, 'sine', 0.14); break;
      case 'crit':      this.crit(ctx); break;
      case 'combo':     this.arpeggio(ctx, [523, 659, 784], 0.06, 'triangle', 0.16); break;
      case 'ult':       this.ultimate(ctx); break;
      case 'heal':      this.sweep(ctx, 440, 660, 0.22, 'sine', 0.16); break;
      case 'oppHit':    this.blip(ctx, 220, 0.14, 'sawtooth', 0.18); break;
      case 'oppTelegraph': this.telegraph(ctx); break;
      case 'win':       this.arpeggio(ctx, [523, 659, 784, 1047], 0.1, 'triangle', 0.2); break;
      case 'lose':      this.sweep(ctx, 330, 110, 0.5, 'sawtooth', 0.18); break;
      case 'click':     this.blip(ctx, 600, 0.04, 'square', 0.08); break;
      case 'perk':      this.arpeggio(ctx, [392, 523, 659], 0.07, 'triangle', 0.16); break;
    }
  }

  private blip(ctx: AudioContext, freq: number, dur: number, type: OscillatorType, vol: number) {
    if (!this.master) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g); g.connect(this.master);
    o.start();
    o.stop(ctx.currentTime + dur + 0.02);
  }

  private sweep(ctx: AudioContext, from: number, to: number, dur: number, type: OscillatorType, vol: number) {
    if (!this.master) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, to), ctx.currentTime + dur);
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g); g.connect(this.master);
    o.start();
    o.stop(ctx.currentTime + dur + 0.02);
  }

  private arpeggio(ctx: AudioContext, freqs: number[], step: number, type: OscillatorType, vol: number) {
    freqs.forEach((f, i) => {
      const t = ctx.currentTime + i * step;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + step * 1.6);
      o.connect(g);
      if (this.master) g.connect(this.master);
      o.start(t);
      o.stop(t + step * 1.8);
    });
  }

  private crit(ctx: AudioContext) {
    this.sweep(ctx, 600, 1200, 0.12, 'sawtooth', 0.2);
    setTimeout(() => this.blip(ctx, 1000, 0.1, 'square', 0.16), 80);
  }

  private ultimate(ctx: AudioContext) {
    this.sweep(ctx, 200, 800, 0.3, 'sawtooth', 0.22);
    setTimeout(() => this.arpeggio(ctx, [523, 659, 784, 1047], 0.07, 'triangle', 0.18), 200);
  }

  private telegraph(ctx: AudioContext) {
    this.blip(ctx, 140, 0.08, 'square', 0.12);
    setTimeout(() => this.blip(ctx, 140, 0.08, 'square', 0.12), 120);
  }
}

export const sfx = new SfxEngine();
export type { SfxName };

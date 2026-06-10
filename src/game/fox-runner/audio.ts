const COMBO_SCALE = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88, 523.25];

export class FoxRunnerAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private ambientOsc: OscillatorNode | null = null;
  private ambientGain: GainNode | null = null;
  private currentTheme: string | null = null;
  private footstepTimer = 0;
  private lastWasGrounded = false;

  private getCtx(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.4;
        this.masterGain.connect(this.ctx.destination);
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private out(): AudioNode | null {
    return this.masterGain;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (m) {
      this.stopAmbient();
      if (this.masterGain) this.masterGain.gain.value = 0;
    } else {
      if (this.masterGain) this.masterGain.gain.value = 0.4;
    }
  }

  isMuted() { return this.muted; }

  private envelope(gain: GainNode, ctx: AudioContext, attack: number, decay: number, sustain: number, release: number, peak = 1) {
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + attack);
    gain.gain.linearRampToValueAtTime(sustain * peak, now + attack + decay);
    gain.gain.setValueAtTime(sustain * peak, now + attack + decay);
    gain.gain.linearRampToValueAtTime(0, now + attack + decay + release);
  }

  playJump() {
    const ctx = this.getCtx();
    const out = this.out();
    if (!ctx || !out) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(out);

    osc.type = 'square';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.12);

    this.envelope(gain, ctx, 0.005, 0.05, 0.3, 0.1, 0.25);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  }

  playDoubleJump() {
    const ctx = this.getCtx();
    const out = this.out();
    if (!ctx || !out) return;

    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(out);

      const t = ctx.currentTime + i * 0.06;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(330 + i * 110, t);
      osc.frequency.exponentialRampToValueAtTime(660 + i * 220, t + 0.15);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.01);
      gain.gain.linearRampToValueAtTime(0, t + 0.18);

      osc.start(t);
      osc.stop(t + 0.2);
    }
  }

  playWallJump() {
    const ctx = this.getCtx();
    const out = this.out();
    if (!ctx || !out) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(out);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(360, ctx.currentTime + 0.1);

    this.envelope(gain, ctx, 0.005, 0.04, 0.2, 0.12, 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  }

  playLand(velocity = 8) {
    const ctx = this.getCtx();
    const out = this.out();
    if (!ctx || !out) return;

    const intensity = Math.min(1, velocity / 15);
    const bufferSize = ctx.sampleRate * 0.08;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300 + intensity * 200;

    const gain = ctx.createGain();
    gain.gain.value = 0.15 + intensity * 0.25;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    source.start(ctx.currentTime);
  }

  playFootstep() {
    const ctx = this.getCtx();
    const out = this.out();
    if (!ctx || !out) return;

    const bufferSize = Math.floor(ctx.sampleRate * 0.04);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 200 + Math.random() * 100;
    filter.Q.value = 2;

    const gain = ctx.createGain();
    gain.gain.value = 0.06;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    source.start(ctx.currentTime);
  }

  playSpring() {
    const ctx = this.getCtx();
    const out = this.out();
    if (!ctx || !out) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(out);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.08);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.16);

    this.envelope(gain, ctx, 0.005, 0.03, 0.5, 0.15, 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.22);
  }

  playCrumble() {
    const ctx = this.getCtx();
    const out = this.out();
    if (!ctx || !out) return;

    const bufferSize = Math.floor(ctx.sampleRate * 0.5);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const decay = Math.pow(1 - i / bufferSize, 1.5);
      const rumble = Math.sin(i * 0.08) * 0.3 + Math.sin(i * 0.13) * 0.2;
      data[i] = (Math.random() * 2 - 1) * decay * 0.5 + rumble * decay * 0.5;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 250;

    const gain = ctx.createGain();
    gain.gain.value = 0.18;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(out);
    source.start(ctx.currentTime);
  }

  playBerryCollect() {
    const ctx = this.getCtx();
    const out = this.out();
    if (!ctx || !out) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(out);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.1);

    this.envelope(gain, ctx, 0.005, 0.02, 0.3, 0.1, 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.16);
  }

  playGemCollect() {
    const ctx = this.getCtx();
    const out = this.out();
    if (!ctx || !out) return;

    const freqs = [880, 1108, 1320];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(out);

      const t = ctx.currentTime + i * 0.04;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.25, t + 0.01);
      gain.gain.linearRampToValueAtTime(0, t + 0.18);

      osc.start(t);
      osc.stop(t + 0.2);
    });
  }

  playHeartCollect() {
    const ctx = this.getCtx();
    const out = this.out();
    if (!ctx || !out) return;

    const freqs = [523.25, 659.25, 783.99, 1046.5];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(out);

      const t = ctx.currentTime + i * 0.06;
      osc.type = 'sine';
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.28, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

      osc.start(t);
      osc.stop(t + 0.32);
    });
  }

  playPowerupCollect() {
    const ctx = this.getCtx();
    const out = this.out();
    if (!ctx || !out) return;

    const notes = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(out);

      const t = ctx.currentTime + i * 0.07;
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      osc.start(t);
      osc.stop(t + 0.27);
    });
  }

  playCheckpoint() {
    const ctx = this.getCtx();
    const out = this.out();
    if (!ctx || !out) return;

    const chord = [523.25, 659.25, 783.99];
    chord.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(out);

      osc.type = 'triangle';
      osc.frequency.value = freq;

      const t = ctx.currentTime + i * 0.03;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

      osc.start(t);
      osc.stop(t + 0.52);
    });
  }

  playStompCombo(comboCount: number) {
    const ctx = this.getCtx();
    const out = this.out();
    if (!ctx || !out) return;

    const noteIndex = Math.min(comboCount - 1, COMBO_SCALE.length - 1);
    const freq = COMBO_SCALE[noteIndex];

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(out);

    osc.type = comboCount > 4 ? 'sawtooth' : 'square';
    osc.frequency.setValueAtTime(freq * 0.5, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq, ctx.currentTime + 0.04);

    const peak = Math.min(0.5, 0.2 + comboCount * 0.04);
    this.envelope(gain, ctx, 0.005, 0.03, 0.4, 0.15, peak);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.22);

    if (comboCount >= 3) {
      const shimmer = ctx.createOscillator();
      const shimmerGain = ctx.createGain();
      shimmer.connect(shimmerGain);
      shimmerGain.connect(out);
      shimmer.type = 'sine';
      shimmer.frequency.value = freq * 2;
      shimmerGain.gain.setValueAtTime(0, ctx.currentTime);
      shimmerGain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.01);
      shimmerGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      shimmer.start(ctx.currentTime);
      shimmer.stop(ctx.currentTime + 0.22);
    }
  }

  playHurt() {
    const ctx = this.getCtx();
    const out = this.out();
    if (!ctx || !out) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(out);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.25);

    this.envelope(gain, ctx, 0.005, 0.05, 0.4, 0.2, 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  }

  playDeath() {
    const ctx = this.getCtx();
    const out = this.out();
    if (!ctx || !out) return;

    const stages = [
      { freq: 330, t: 0, dur: 0.1 },
      { freq: 220, t: 0.12, dur: 0.12 },
      { freq: 165, t: 0.26, dur: 0.15 },
      { freq: 110, t: 0.43, dur: 0.35 },
    ];

    for (const s of stages) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(out);

      const t = ctx.currentTime + s.t;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(s.freq, t);
      osc.frequency.exponentialRampToValueAtTime(s.freq * 0.7, t + s.dur);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.4, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + s.dur);

      osc.start(t);
      osc.stop(t + s.dur + 0.05);
    }
  }

  playLevelComplete() {
    const ctx = this.getCtx();
    const out = this.out();
    if (!ctx || !out) return;

    const melody = [
      { freq: 523.25, t: 0 },
      { freq: 659.25, t: 0.12 },
      { freq: 783.99, t: 0.24 },
      { freq: 1046.5, t: 0.36 },
    ];

    for (const note of melody) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(out);

      const t = ctx.currentTime + note.t;
      osc.type = 'triangle';
      osc.frequency.value = note.freq;

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.35, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      osc.start(t);
      osc.stop(t + 0.37);

      const harm = ctx.createOscillator();
      const harmGain = ctx.createGain();
      harm.connect(harmGain);
      harmGain.connect(out);
      harm.type = 'sine';
      harm.frequency.value = note.freq * 1.5;
      harmGain.gain.setValueAtTime(0, t);
      harmGain.gain.linearRampToValueAtTime(0.1, t + 0.02);
      harmGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      harm.start(t);
      harm.stop(t + 0.27);
    }
  }

  playGameOver() {
    const ctx = this.getCtx();
    const out = this.out();
    if (!ctx || !out) return;

    const notes = [
      { freq: 392.0, t: 0 },
      { freq: 349.23, t: 0.2 },
      { freq: 311.13, t: 0.4 },
      { freq: 261.63, t: 0.65 },
    ];

    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(out);

      const t = ctx.currentTime + note.t;
      osc.type = 'triangle';
      osc.frequency.value = note.freq;

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

      osc.start(t);
      osc.stop(t + 0.48);
    }
  }

  playVictory() {
    const ctx = this.getCtx();
    const out = this.out();
    if (!ctx || !out) return;

    const fanfare = [
      { freq: 523.25, t: 0 },
      { freq: 523.25, t: 0.1 },
      { freq: 523.25, t: 0.2 },
      { freq: 415.3, t: 0.3 },
      { freq: 466.16, t: 0.4 },
      { freq: 523.25, t: 0.6 },
      { freq: 466.16, t: 0.7 },
      { freq: 523.25, t: 0.8 },
    ];

    for (const note of fanfare) {
      ['sine', 'triangle'].forEach((type, hi) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(out);

        const t = ctx.currentTime + note.t;
        osc.type = type as OscillatorType;
        osc.frequency.value = note.freq * (hi === 1 ? 2 : 1);

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(hi === 0 ? 0.3 : 0.12, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

        osc.start(t);
        osc.stop(t + 0.3);
      });
    }
  }

  startAmbient(theme: string) {
    if (this.muted || this.currentTheme === theme) return;
    this.stopAmbient();

    const ctx = this.getCtx();
    const out = this.out();
    if (!ctx || !out) return;

    this.currentTheme = theme;

    const baseFreq = theme === 'cave' ? 55 : theme === 'mountain' ? 73.42 : theme === 'sky' ? 110 : 82.41;
    const oscType: OscillatorType = theme === 'cave' ? 'sawtooth' : 'sine';

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = oscType;
    osc.frequency.value = baseFreq;

    filter.type = 'lowpass';
    filter.frequency.value = theme === 'cave' ? 200 : 400;
    filter.Q.value = 2;

    gain.gain.value = 0;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(out);

    osc.start();
    gain.gain.linearRampToValueAtTime(theme === 'cave' ? 0.06 : 0.04, ctx.currentTime + 1.5);

    this.ambientOsc = osc;
    this.ambientGain = gain;

    const harmFreq = baseFreq * (theme === 'sky' ? 1.5 : theme === 'mountain' ? 1.33 : 2);
    const harm = ctx.createOscillator();
    const harmGain = ctx.createGain();
    harm.type = 'sine';
    harm.frequency.value = harmFreq;
    harm.frequency.setValueAtTime(harmFreq, ctx.currentTime);

    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.3;
    lfoGain.gain.value = harmFreq * 0.008;
    lfo.connect(lfoGain);
    lfoGain.connect(harm.frequency);

    harmGain.gain.value = 0.025;
    harm.connect(harmGain);
    harmGain.connect(out);
    lfo.start();
    harm.start();
  }

  stopAmbient() {
    if (this.ambientOsc) {
      try {
        const ctx = this.ctx;
        if (ctx && this.ambientGain) {
          this.ambientGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
          const osc = this.ambientOsc;
          setTimeout(() => { try { osc.stop(); } catch {} }, 600);
        } else {
          this.ambientOsc.stop();
        }
      } catch {}
      this.ambientOsc = null;
      this.ambientGain = null;
      this.currentTheme = null;
    }
  }

  tickFootsteps(grounded: boolean, moving: boolean, dt: number) {
    if (grounded && moving) {
      this.footstepTimer -= dt;
      if (this.footstepTimer <= 0) {
        this.playFootstep();
        this.footstepTimer = 0.22;
      }
    } else {
      this.footstepTimer = 0;
    }

    if (!this.lastWasGrounded && grounded) {
      this.playLand();
    }
    this.lastWasGrounded = grounded;
  }

  destroy() {
    this.stopAmbient();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}

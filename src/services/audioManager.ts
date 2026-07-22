export type AudioScene =
  | 'lobby'
  | 'chat'
  | 'checkers'
  | 'momentum'
  | 'slime-soccer'
  | 'stellar-pursuit'
  | 'fox-runner'
  | 'money-grab'
  | 'home-run-derby'
  | 'zelda-ocean'
  | 'none';

const STORAGE_KEY_MUTED = 'audio_manager_muted';
const STORAGE_KEY_VOLUME = 'audio_manager_volume';
const FADE_TIME = 1.5;

// Master switch for the synthesized ambient scene audio. Off — the oscillator
// drones sounded like buzzing. Set to true to bring ambient audio back.
const AMBIENT_AUDIO_ENABLED = false;

type LoopNode = {
  oscillators: OscillatorNode[];
  gains: GainNode[];
  masterGain: GainNode;
};

class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private currentLoop: LoopNode | null = null;
  private currentScene: AudioScene = 'none';
  private muted: boolean;
  private volume: number;
  private interacted = false;
  private pendingScene: AudioScene | null = null;

  constructor() {
    this.muted = localStorage.getItem(STORAGE_KEY_MUTED) === 'true';
    const saved = parseFloat(localStorage.getItem(STORAGE_KEY_VOLUME) ?? '');
    this.volume = isNaN(saved) ? 0.45 : saved;
  }

  private getCtx(): AudioContext | null {
    if (!this.interacted) return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : this.volume;
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

  onUserInteraction() {
    if (this.interacted) return;
    this.interacted = true;
    if (this.pendingScene !== null) {
      this.play(this.pendingScene);
      this.pendingScene = null;
    }
  }

  play(scene: AudioScene) {
    // Ambient scene audio is disabled globally — the synthesized oscillator
    // drones read as an unpleasant buzzing. Flip AMBIENT_AUDIO_ENABLED back to
    // true to restore it; the rest of the manager (mute UI, etc.) is untouched.
    if (!AMBIENT_AUDIO_ENABLED) return;

    if (!this.interacted) {
      this.pendingScene = scene;
      return;
    }
    if (scene === this.currentScene) return;
    this.currentScene = scene;

    this.fadeOutCurrent(() => {
      if (scene !== 'none') {
        this.startScene(scene);
      }
    });
  }

  stop() {
    this.currentScene = 'none';
    this.pendingScene = null;
    this.fadeOutCurrent(() => {});
  }

  setMuted(m: boolean) {
    this.muted = m;
    localStorage.setItem(STORAGE_KEY_MUTED, String(m));
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(m ? 0 : this.volume, now, 0.3);
    }
  }

  getMuted() { return this.muted; }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    localStorage.setItem(STORAGE_KEY_VOLUME, String(this.volume));
    if (this.masterGain && this.ctx && !this.muted) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(this.volume, now, 0.1);
    }
  }

  getVolume() { return this.volume; }
  getScene() { return this.currentScene; }

  private fadeOutCurrent(onDone: () => void) {
    const loop = this.currentLoop;
    const ctx = this.ctx;
    if (!loop || !ctx) {
      this.currentLoop = null;
      onDone();
      return;
    }

    const now = ctx.currentTime;
    loop.masterGain.gain.cancelScheduledValues(now);
    loop.masterGain.gain.setValueAtTime(loop.masterGain.gain.value, now);
    loop.masterGain.gain.linearRampToValueAtTime(0, now + FADE_TIME);

    this.currentLoop = null;

    const intervalKeys = ['_arpInterval', '_leadInterval', '_chipInterval', '_bassInterval', '_stabInterval', '_melInterval', '_brassInterval'];
    intervalKeys.forEach(key => {
      const id = (loop as any)[key];
      if (id !== undefined) clearInterval(id);
    });

    setTimeout(() => {
      loop.oscillators.forEach(o => { try { o.stop(); } catch {} });
      onDone();
    }, (FADE_TIME + 0.1) * 1000);
  }

  private startScene(scene: AudioScene) {
    const ctx = this.getCtx();
    if (!ctx || !this.masterGain) return;

    const loop = this.buildScene(scene, ctx, this.masterGain);
    if (!loop) return;

    const now = ctx.currentTime;
    loop.masterGain.gain.setValueAtTime(0, now);
    loop.masterGain.gain.linearRampToValueAtTime(1, now + FADE_TIME);

    this.currentLoop = loop;
  }

  private buildScene(scene: AudioScene, ctx: AudioContext, out: AudioNode): LoopNode | null {
    switch (scene) {
      case 'lobby':         return this.buildLobby(ctx, out);
      case 'chat':          return this.buildChat(ctx, out);
      case 'checkers':      return this.buildCheckers(ctx, out);
      case 'momentum':      return this.buildMomentum(ctx, out);
      case 'slime-soccer':  return this.buildSlimeSoccer(ctx, out);
      case 'stellar-pursuit': return this.buildStellar(ctx, out);
      case 'fox-runner':    return this.buildFoxRunner(ctx, out);
      case 'money-grab':    return this.buildMoneyGrab(ctx, out);
      case 'home-run-derby': return this.buildHomeRun(ctx, out);
      case 'zelda-ocean':   return null;
      default:              return null;
    }
  }

  private makeLoop(): LoopNode {
    return { oscillators: [], gains: [], masterGain: null as unknown as GainNode };
  }

  private osc(ctx: AudioContext, type: OscillatorType, freq: number, loop: LoopNode): OscillatorNode {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    loop.oscillators.push(o);
    return o;
  }

  private gain(ctx: AudioContext, value: number, loop: LoopNode): GainNode {
    const g = ctx.createGain();
    g.gain.value = value;
    loop.gains.push(g);
    return g;
  }

  private lfo(ctx: AudioContext, rate: number, depth: number, target: AudioParam, loop: LoopNode) {
    const l = ctx.createOscillator();
    const g = ctx.createGain();
    l.type = 'sine';
    l.frequency.value = rate;
    g.gain.value = depth;
    l.connect(g);
    g.connect(target);
    l.start();
    loop.oscillators.push(l);
    loop.gains.push(g);
  }

  private filter(ctx: AudioContext, type: BiquadFilterType, freq: number, q = 1): BiquadFilterNode {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  private buildLobby(ctx: AudioContext, out: AudioNode): LoopNode {
    const loop = this.makeLoop();
    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(out);
    loop.masterGain = master;

    const pad1 = this.osc(ctx, 'sine', 220, loop);
    const pad1g = this.gain(ctx, 0.08, loop);
    const pad1f = this.filter(ctx, 'lowpass', 600);
    pad1.connect(pad1f); pad1f.connect(pad1g); pad1g.connect(master);
    this.lfo(ctx, 0.12, 3, pad1.frequency, loop);
    pad1.start();

    const pad2 = this.osc(ctx, 'triangle', 330, loop);
    const pad2g = this.gain(ctx, 0.055, loop);
    const pad2f = this.filter(ctx, 'lowpass', 800);
    pad2.connect(pad2f); pad2f.connect(pad2g); pad2g.connect(master);
    this.lfo(ctx, 0.09, 2, pad2.frequency, loop);
    pad2.start();

    const pad3 = this.osc(ctx, 'sine', 440, loop);
    const pad3g = this.gain(ctx, 0.04, loop);
    const pad3f = this.filter(ctx, 'lowpass', 1000);
    pad3.connect(pad3f); pad3f.connect(pad3g); pad3g.connect(master);
    this.lfo(ctx, 0.17, 4, pad3.frequency, loop);
    pad3.start();

    const arp = this.osc(ctx, 'triangle', 660, loop);
    const arpg = this.gain(ctx, 0.03, loop);
    arp.connect(arpg); arpg.connect(master);
    const arpNotes = [660, 784, 880, 990, 880, 784];
    let ni = 0;
    const stepArp = () => {
      if (!arp.frequency) return;
      arp.frequency.setValueAtTime(arpNotes[ni % arpNotes.length], ctx.currentTime);
      ni++;
    };
    const arpInterval = setInterval(stepArp, 480);
    arp.start();
    (arp as any)._interval = arpInterval;
    (loop as any)._arpInterval = arpInterval;

    const sub = this.osc(ctx, 'sine', 110, loop);
    const subg = this.gain(ctx, 0.05, loop);
    const subf = this.filter(ctx, 'lowpass', 200);
    sub.connect(subf); subf.connect(subg); subg.connect(master);
    this.lfo(ctx, 0.05, 1.5, sub.frequency, loop);
    sub.start();

    return loop;
  }

  private buildChat(ctx: AudioContext, out: AudioNode): LoopNode {
    const loop = this.makeLoop();
    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(out);
    loop.masterGain = master;

    const pad1 = this.osc(ctx, 'sine', 196, loop);
    const pad1g = this.gain(ctx, 0.06, loop);
    const pad1f = this.filter(ctx, 'lowpass', 500);
    pad1.connect(pad1f); pad1f.connect(pad1g); pad1g.connect(master);
    this.lfo(ctx, 0.07, 1.5, pad1.frequency, loop);
    pad1.start();

    const pad2 = this.osc(ctx, 'sine', 294, loop);
    const pad2g = this.gain(ctx, 0.045, loop);
    const pad2f = this.filter(ctx, 'lowpass', 700);
    pad2.connect(pad2f); pad2f.connect(pad2g); pad2g.connect(master);
    this.lfo(ctx, 0.05, 1, pad2.frequency, loop);
    pad2.start();

    const pad3 = this.osc(ctx, 'triangle', 392, loop);
    const pad3g = this.gain(ctx, 0.03, loop);
    const pad3f = this.filter(ctx, 'lowpass', 900);
    pad3.connect(pad3f); pad3f.connect(pad3g); pad3g.connect(master);
    this.lfo(ctx, 0.11, 2, pad3.frequency, loop);
    pad3.start();

    const shimmer = this.osc(ctx, 'sine', 784, loop);
    const shimmerg = this.gain(ctx, 0.015, loop);
    shimmer.connect(shimmerg); shimmerg.connect(master);
    this.lfo(ctx, 0.19, 8, shimmer.frequency, loop);
    shimmer.start();

    return loop;
  }

  private buildCheckers(ctx: AudioContext, out: AudioNode): LoopNode {
    const loop = this.makeLoop();
    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(out);
    loop.masterGain = master;

    const bass = this.osc(ctx, 'sine', 98, loop);
    const bassg = this.gain(ctx, 0.07, loop);
    const bassf = this.filter(ctx, 'lowpass', 250);
    bass.connect(bassf); bassf.connect(bassg); bassg.connect(master);
    this.lfo(ctx, 0.04, 1, bass.frequency, loop);
    bass.start();

    const jazz1 = this.osc(ctx, 'triangle', 311, loop);
    const jazz1g = this.gain(ctx, 0.04, loop);
    const jazz1f = this.filter(ctx, 'bandpass', 600, 2);
    jazz1.connect(jazz1f); jazz1f.connect(jazz1g); jazz1g.connect(master);
    this.lfo(ctx, 0.08, 3, jazz1.frequency, loop);
    jazz1.start();

    const jazz2 = this.osc(ctx, 'triangle', 415, loop);
    const jazz2g = this.gain(ctx, 0.035, loop);
    const jazz2f = this.filter(ctx, 'bandpass', 900, 2);
    jazz2.connect(jazz2f); jazz2f.connect(jazz2g); jazz2g.connect(master);
    this.lfo(ctx, 0.13, 4, jazz2.frequency, loop);
    jazz2.start();

    const melody = this.osc(ctx, 'sine', 523, loop);
    const melodyr = this.gain(ctx, 0.025, loop);
    const melodyf = this.filter(ctx, 'lowpass', 1200);
    melody.connect(melodyf); melodyf.connect(melodyr); melodyr.connect(master);
    this.lfo(ctx, 0.2, 6, melody.frequency, loop);
    melody.start();

    return loop;
  }

  private buildMomentum(ctx: AudioContext, out: AudioNode): LoopNode {
    const loop = this.makeLoop();
    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(out);
    loop.masterGain = master;

    const bass = this.osc(ctx, 'sawtooth', 55, loop);
    const bassg = this.gain(ctx, 0.06, loop);
    const bassf = this.filter(ctx, 'lowpass', 300, 3);
    bass.connect(bassf); bassf.connect(bassg); bassg.connect(master);
    bass.start();

    const lead = this.osc(ctx, 'square', 330, loop);
    const leadg = this.gain(ctx, 0.04, loop);
    const leadf = this.filter(ctx, 'lowpass', 1500, 2);
    lead.connect(leadf); leadf.connect(leadg); leadg.connect(master);
    lead.start();

    const leadNotes = [330, 392, 440, 523, 440, 392, 330, 294];
    let lni = 0;
    const leadStep = setInterval(() => {
      lead.frequency.setValueAtTime(leadNotes[lni % leadNotes.length], ctx.currentTime);
      lni++;
    }, 250);
    (loop as any)._leadInterval = leadStep;

    const pulse = this.osc(ctx, 'sine', 110, loop);
    const pulseg = this.gain(ctx, 0.05, loop);
    this.lfo(ctx, 8, 0.04, pulseg.gain, loop);
    pulse.connect(pulseg); pulseg.connect(master);
    pulse.start();

    const high = this.osc(ctx, 'triangle', 880, loop);
    const highg = this.gain(ctx, 0.025, loop);
    const highf = this.filter(ctx, 'highpass', 700);
    high.connect(highf); highf.connect(highg); highg.connect(master);
    this.lfo(ctx, 4, 20, high.frequency, loop);
    high.start();

    return loop;
  }

  private buildSlimeSoccer(ctx: AudioContext, out: AudioNode): LoopNode {
    const loop = this.makeLoop();
    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(out);
    loop.masterGain = master;

    const kick = this.osc(ctx, 'sine', 80, loop);
    const kickg = this.gain(ctx, 0.08, loop);
    this.lfo(ctx, 4, 0.07, kickg.gain, loop);
    kick.connect(kickg); kickg.connect(master);
    kick.start();

    const melody = this.osc(ctx, 'square', 523, loop);
    const melodyr = this.gain(ctx, 0.04, loop);
    const melodyf = this.filter(ctx, 'lowpass', 1800, 1);
    melody.connect(melodyf); melodyf.connect(melodyr); melodyr.connect(master);
    melody.start();

    const chipNotes = [523, 659, 784, 659, 784, 880, 784, 659];
    let cni = 0;
    const chipStep = setInterval(() => {
      melody.frequency.setValueAtTime(chipNotes[cni % chipNotes.length], ctx.currentTime);
      cni++;
    }, 200);
    (loop as any)._chipInterval = chipStep;

    const bass = this.osc(ctx, 'triangle', 130, loop);
    const bassg = this.gain(ctx, 0.06, loop);
    bass.connect(bassg); bassg.connect(master);
    bass.start();

    const bassNotes = [130, 130, 146, 130];
    let bni = 0;
    const bassStep = setInterval(() => {
      bass.frequency.setValueAtTime(bassNotes[bni % bassNotes.length], ctx.currentTime);
      bni++;
    }, 400);
    (loop as any)._bassInterval = bassStep;

    return loop;
  }

  private buildStellar(ctx: AudioContext, out: AudioNode): LoopNode {
    const loop = this.makeLoop();
    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(out);
    loop.masterGain = master;

    const space1 = this.osc(ctx, 'sine', 55, loop);
    const space1g = this.gain(ctx, 0.07, loop);
    const space1f = this.filter(ctx, 'lowpass', 180);
    space1.connect(space1f); space1f.connect(space1g); space1g.connect(master);
    this.lfo(ctx, 0.03, 2, space1.frequency, loop);
    space1.start();

    const space2 = this.osc(ctx, 'sine', 82.5, loop);
    const space2g = this.gain(ctx, 0.045, loop);
    const space2f = this.filter(ctx, 'lowpass', 300);
    space2.connect(space2f); space2f.connect(space2g); space2g.connect(master);
    this.lfo(ctx, 0.07, 3, space2.frequency, loop);
    space2.start();

    const shimmer1 = this.osc(ctx, 'sine', 440, loop);
    const shimmer1g = this.gain(ctx, 0.02, loop);
    shimmer1.connect(shimmer1g); shimmer1g.connect(master);
    this.lfo(ctx, 0.15, 15, shimmer1.frequency, loop);
    shimmer1.start();

    const shimmer2 = this.osc(ctx, 'sine', 660, loop);
    const shimmer2g = this.gain(ctx, 0.015, loop);
    shimmer2.connect(shimmer2g); shimmer2g.connect(master);
    this.lfo(ctx, 0.11, 10, shimmer2.frequency, loop);
    shimmer2.start();

    const deep = this.osc(ctx, 'sine', 27.5, loop);
    const deepg = this.gain(ctx, 0.06, loop);
    const deepf = this.filter(ctx, 'lowpass', 100);
    deep.connect(deepf); deepf.connect(deepg); deepg.connect(master);
    this.lfo(ctx, 0.02, 0.5, deep.frequency, loop);
    deep.start();

    return loop;
  }

  private buildFoxRunner(ctx: AudioContext, out: AudioNode): LoopNode {
    const loop = this.makeLoop();
    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(out);
    loop.masterGain = master;

    const forest1 = this.osc(ctx, 'sine', 164, loop);
    const forest1g = this.gain(ctx, 0.06, loop);
    const forest1f = this.filter(ctx, 'lowpass', 500);
    forest1.connect(forest1f); forest1f.connect(forest1g); forest1g.connect(master);
    this.lfo(ctx, 0.1, 3, forest1.frequency, loop);
    forest1.start();

    const forest2 = this.osc(ctx, 'triangle', 246, loop);
    const forest2g = this.gain(ctx, 0.04, loop);
    forest2.connect(forest2g); forest2g.connect(master);
    this.lfo(ctx, 0.14, 4, forest2.frequency, loop);
    forest2.start();

    const melody = this.osc(ctx, 'triangle', 392, loop);
    const melodyr = this.gain(ctx, 0.035, loop);
    const melodyf = this.filter(ctx, 'lowpass', 1200);
    melody.connect(melodyf); melodyf.connect(melodyr); melodyr.connect(master);
    melody.start();

    const melNotes = [392, 440, 494, 523, 494, 440, 392, 349];
    let mni = 0;
    const melStep = setInterval(() => {
      melody.frequency.setValueAtTime(melNotes[mni % melNotes.length], ctx.currentTime);
      mni++;
    }, 350);
    (loop as any)._melInterval = melStep;

    const bird = this.osc(ctx, 'sine', 880, loop);
    const birdg = this.gain(ctx, 0.015, loop);
    bird.connect(birdg); birdg.connect(master);
    this.lfo(ctx, 0.25, 40, bird.frequency, loop);
    bird.start();

    return loop;
  }

  private buildMoneyGrab(ctx: AudioContext, out: AudioNode): LoopNode {
    const loop = this.makeLoop();
    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(out);
    loop.masterGain = master;

    const bass = this.osc(ctx, 'sawtooth', 73, loop);
    const bassg = this.gain(ctx, 0.07, loop);
    const bassf = this.filter(ctx, 'lowpass', 400, 3);
    bass.connect(bassf); bassf.connect(bassg); bassg.connect(master);
    bass.start();

    const bassNotes = [73, 73, 82, 73, 65, 73, 82, 98];
    let bni = 0;
    const bassStep = setInterval(() => {
      bass.frequency.setValueAtTime(bassNotes[bni % bassNotes.length], ctx.currentTime);
      bni++;
    }, 150);
    (loop as any)._bassInterval = bassStep;

    const stab = this.osc(ctx, 'square', 370, loop);
    const stabg = this.gain(ctx, 0.045, loop);
    const stabf = this.filter(ctx, 'bandpass', 800, 2);
    stab.connect(stabf); stabf.connect(stabg); stabg.connect(master);
    stab.start();

    const stabNotes = [370, 415, 370, 330, 370, 440, 370, 415];
    let sni = 0;
    const stabStep = setInterval(() => {
      stab.frequency.setValueAtTime(stabNotes[sni % stabNotes.length], ctx.currentTime);
      sni++;
    }, 180);
    (loop as any)._stabInterval = stabStep;

    const frenzy = this.osc(ctx, 'triangle', 740, loop);
    const frenzyr = this.gain(ctx, 0.03, loop);
    this.lfo(ctx, 6, 0.025, frenzyr.gain, loop);
    frenzy.connect(frenzyr); frenzyr.connect(master);
    frenzy.start();

    return loop;
  }

  private buildHomeRun(ctx: AudioContext, out: AudioNode): LoopNode {
    const loop = this.makeLoop();
    const master = ctx.createGain();
    master.gain.value = 1;
    master.connect(out);
    loop.masterGain = master;

    const brass1 = this.osc(ctx, 'sawtooth', 220, loop);
    const brass1f = this.filter(ctx, 'lowpass', 1200, 2);
    const brass1g = this.gain(ctx, 0.055, loop);
    brass1.connect(brass1f); brass1f.connect(brass1g); brass1g.connect(master);
    brass1.start();

    const brassNotes = [220, 247, 262, 294, 330, 294, 262, 247];
    let brni = 0;
    const brassStep = setInterval(() => {
      brass1.frequency.setValueAtTime(brassNotes[brni % brassNotes.length], ctx.currentTime);
      brni++;
    }, 300);
    (loop as any)._brassInterval = brassStep;

    const pump = this.osc(ctx, 'triangle', 110, loop);
    const pumpg = this.gain(ctx, 0.06, loop);
    this.lfo(ctx, 3.33, 0.055, pumpg.gain, loop);
    pump.connect(pumpg); pumpg.connect(master);
    pump.start();

    const crowd = this.osc(ctx, 'sawtooth', 880, loop);
    const crowdf = this.filter(ctx, 'bandpass', 1200, 5);
    const crowdg = this.gain(ctx, 0.012, loop);
    this.lfo(ctx, 2.5, 0.01, crowdg.gain, loop);
    crowd.connect(crowdf); crowdf.connect(crowdg); crowdg.connect(master);
    crowd.start();

    return loop;
  }

}

export const audioManager = new AudioManager();

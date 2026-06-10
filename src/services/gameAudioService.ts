class GameAudioService {
  private audioContext: AudioContext | null = null;
  private musicGainNode: GainNode | null = null;
  private sfxGainNode: GainNode | null = null;
  private masterGainNode: GainNode | null = null;
  private isInitialized = false;
  private isMuted = false;
  private musicVolume = 0.3;
  private sfxVolume = 0.5;
  private backgroundOscillators: OscillatorNode[] = [];

  private init() {
    if (this.isInitialized) return;

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      this.masterGainNode = this.audioContext.createGain();
      this.masterGainNode.connect(this.audioContext.destination);
      this.masterGainNode.gain.value = this.isMuted ? 0 : 1;

      this.musicGainNode = this.audioContext.createGain();
      this.musicGainNode.connect(this.masterGainNode);
      this.musicGainNode.gain.value = this.musicVolume;

      this.sfxGainNode = this.audioContext.createGain();
      this.sfxGainNode.connect(this.masterGainNode);
      this.sfxGainNode.gain.value = this.sfxVolume;

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize audio:', error);
    }
  }

  private ensureInitialized() {
    if (!this.isInitialized) {
      this.init();
    }
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  playMoneyCollect() {
    this.ensureInitialized();
    if (!this.audioContext || !this.sfxGainNode) return;

    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.connect(gain);
    gain.connect(this.sfxGainNode);

    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  playPowerUpCollect() {
    this.ensureInitialized();
    if (!this.audioContext || !this.sfxGainNode) return;

    const now = this.audioContext.currentTime;

    const freqs = [400, 500, 600, 800, 1000];
    freqs.forEach((freq, i) => {
      const osc = this.audioContext!.createOscillator();
      const gain = this.audioContext!.createGain();

      osc.connect(gain);
      gain.connect(this.sfxGainNode!);

      osc.frequency.setValueAtTime(freq, now + i * 0.05);
      gain.gain.setValueAtTime(0.15, now + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.05 + 0.15);

      osc.start(now + i * 0.05);
      osc.stop(now + i * 0.05 + 0.15);
    });
  }

  playHit() {
    this.ensureInitialized();
    if (!this.audioContext || !this.sfxGainNode) return;

    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGainNode);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.2);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, now);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  playEnemyDefeat() {
    this.ensureInitialized();
    if (!this.audioContext || !this.sfxGainNode) return;

    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.connect(gain);
    gain.connect(this.sfxGainNode);

    osc.type = 'square';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.3);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  playLevelComplete() {
    this.ensureInitialized();
    if (!this.audioContext || !this.sfxGainNode) return;

    const now = this.audioContext.currentTime;
    const melody = [523, 659, 784, 1047];

    melody.forEach((freq, i) => {
      const osc = this.audioContext!.createOscillator();
      const gain = this.audioContext!.createGain();

      osc.connect(gain);
      gain.connect(this.sfxGainNode!);

      osc.frequency.setValueAtTime(freq, now + i * 0.1);
      gain.gain.setValueAtTime(0.2, now + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.3);

      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.3);
    });
  }

  playCombo(comboLevel: number) {
    this.ensureInitialized();
    if (!this.audioContext || !this.sfxGainNode) return;

    const now = this.audioContext.currentTime;
    const baseFreq = 400 + (comboLevel * 100);

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.connect(gain);
    gain.connect(this.sfxGainNode);

    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.08);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.start(now);
    osc.stop(now + 0.12);
  }

  playPowerUpActivate(type: string) {
    this.ensureInitialized();
    if (!this.audioContext || !this.sfxGainNode) return;

    const now = this.audioContext.currentTime;
    const frequencyMap: Record<string, number[]> = {
      speed: [600, 900, 1200],
      magnet: [400, 600, 800],
      shield: [300, 500, 700],
      double: [500, 750, 1000],
      freeze: [200, 300, 400],
      ghost: [700, 1000, 1300]
    };

    const freqs = frequencyMap[type] || [500, 700, 900];

    freqs.forEach((freq, i) => {
      const osc = this.audioContext!.createOscillator();
      const gain = this.audioContext!.createGain();

      osc.connect(gain);
      gain.connect(this.sfxGainNode!);

      osc.frequency.setValueAtTime(freq, now + i * 0.04);
      gain.gain.setValueAtTime(0.18, now + i * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.04 + 0.2);

      osc.start(now + i * 0.04);
      osc.stop(now + i * 0.04 + 0.2);
    });
  }

  playAchievementUnlock() {
    this.ensureInitialized();
    if (!this.audioContext || !this.sfxGainNode) return;

    const now = this.audioContext.currentTime;
    const fanfare = [523, 659, 784, 1047, 1319];

    fanfare.forEach((freq, i) => {
      const osc = this.audioContext!.createOscillator();
      const gain = this.audioContext!.createGain();

      osc.connect(gain);
      gain.connect(this.sfxGainNode!);

      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      gain.gain.setValueAtTime(0.15, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.5);

      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.5);
    });
  }

  startBackgroundMusic(level: number = 1) {
    this.ensureInitialized();
    if (!this.audioContext || !this.musicGainNode) return;

    this.stopBackgroundMusic();

    const now = this.audioContext.currentTime;
    const baseFrequencies = [220, 330, 440];
    const tempo = Math.max(0.4, 0.8 - (level * 0.05));

    baseFrequencies.forEach((baseFreq, i) => {
      const osc = this.audioContext!.createOscillator();
      const gain = this.audioContext!.createGain();
      const filter = this.audioContext!.createBiquadFilter();

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGainNode!);

      osc.type = 'sine';
      osc.frequency.value = baseFreq;

      filter.type = 'lowpass';
      filter.frequency.value = 800 + (level * 50);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.03 + (i * 0.01), now + tempo);

      osc.start(now);
      this.backgroundOscillators.push(osc);
    });
  }

  stopBackgroundMusic() {
    if (this.backgroundOscillators.length > 0) {
      this.backgroundOscillators.forEach(osc => {
        try {
          osc.stop();
        } catch (e) {
          console.warn('Failed to stop oscillator:', e);
        }
      });
      this.backgroundOscillators = [];
    }
  }

  setMusicVolume(volume: number) {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    if (this.musicGainNode) {
      this.musicGainNode.gain.value = this.musicVolume;
    }
  }

  setSFXVolume(volume: number) {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
    if (this.sfxGainNode) {
      this.sfxGainNode.gain.value = this.sfxVolume;
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGainNode) {
      this.masterGainNode.gain.value = this.isMuted ? 0 : 1;
    }
    return this.isMuted;
  }

  getMuteState() {
    return this.isMuted;
  }

  cleanup() {
    this.stopBackgroundMusic();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.isInitialized = false;
  }
}

export const gameAudioService = new GameAudioService();

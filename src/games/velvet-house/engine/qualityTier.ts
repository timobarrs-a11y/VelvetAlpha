/**
 * Quality-tier manager: auto-detects Low/Medium/High from frame times.
 * The player can override in settings. DPR steps down under load and
 * steps back up when headroom returns.
 */

export type QualityTier = 'low' | 'medium' | 'high';

const FRAME_TIME_WINDOW = 60;
const LOW_THRESHOLD_MS = 33;   // < 30 fps → low
const HIGH_THRESHOLD_MS = 20;  // > 50 fps → high

class QualityManager {
  private tier: QualityTier = 'high';
  private playerOverride: QualityTier | null = null;
  private frameTimes: number[] = [];
  private dprStep = 2;
  private lowFrames = 0;
  private highFrames = 0;

  recordFrame(dtMs: number): void {
    this.frameTimes.push(dtMs);
    if (this.frameTimes.length > FRAME_TIME_WINDOW) this.frameTimes.shift();

    if (this.frameTimes.length < 20) return;

    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;

    if (avg > LOW_THRESHOLD_MS) {
      this.lowFrames++;
      this.highFrames = 0;
    } else if (avg < HIGH_THRESHOLD_MS) {
      this.highFrames++;
      this.lowFrames = 0;
    } else {
      this.lowFrames = 0;
      this.highFrames = 0;
    }

    // Auto-adjust DPR: step down after sustained low frames, step up after sustained high
    if (this.lowFrames > 30 && this.dprStep > 1) {
      this.dprStep--;
      this.lowFrames = 0;
    } else if (this.highFrames > 60 && this.dprStep < 2) {
      this.dprStep++;
      this.highFrames = 0;
    }

    // Auto-detect tier (only if no player override)
    if (!this.playerOverride) {
      if (avg > LOW_THRESHOLD_MS) this.tier = 'low';
      else if (avg < HIGH_THRESHOLD_MS) this.tier = 'high';
      else this.tier = 'medium';
    }
  }

  getTier(): QualityTier {
    return this.playerOverride ?? this.tier;
  }

  setPlayerOverride(tier: QualityTier | null): void {
    this.playerOverride = tier;
  }

  getDprStep(): number {
    return this.dprStep;
  }

  /** Suggests a device pixel ratio capped by the current quality step. */
  resolveDpr(nativeDpr: number): number {
    const base = Math.min(nativeDpr, 2);
    if (this.getTier() === 'low') return Math.min(base, 1);
    if (this.getTier() === 'medium') return Math.min(base, 1.5);
    return base;
  }
}

export const qualityManager = new QualityManager();

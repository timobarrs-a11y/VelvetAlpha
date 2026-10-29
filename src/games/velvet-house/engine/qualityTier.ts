/**
 * Quality-tier manager: auto-detects Low/Medium/High from frame times.
 * The player can override in settings. DPR steps down under load and
 * steps back up when headroom returns.
 *
 * Important: a steady 30 fps (e.g. iPhone Low Power Mode caps the display
 * at 30 Hz) is NOT treated as a slow condition. Only irregular frame times
 * or frames below the display's own refresh rate trigger a downgrade.
 */

export type QualityTier = 'low' | 'medium' | 'high';

const FRAME_TIME_WINDOW = 60;
const LOW_THRESHOLD_MS = 33;   // < 30 fps → low (irregular or genuinely slow)
const HIGH_THRESHOLD_MS = 20;  // > 50 fps → high
const STEADY_TOLERANCE = 0.4;  // frame time jitter fraction for "steady" classification

class QualityManager {
  private tier: QualityTier = 'high';
  private playerOverride: QualityTier | null = null;
  private frameTimes: number[] = [];
  /** How far the frame rate has pushed the pixel ratio down: 4 is full (see DPR_NOTCHES), 0 is the lowest. */
  private dprStep = 4;
  private lowFrames = 0;
  private highFrames = 0;

  recordFrame(dtMs: number): void {
    this.frameTimes.push(dtMs);
    if (this.frameTimes.length > FRAME_TIME_WINDOW) this.frameTimes.shift();

    if (this.frameTimes.length < 20) return;

    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;

    // Determine whether the frame times are steady (low jitter) or irregular.
    // A display capped at 30 Hz produces consistent ~33.3 ms frames — that's
    // steady and should NOT trigger a downgrade.
    const variance = this.frameTimes.reduce((sum, t) => sum + (t - avg) ** 2, 0) / this.frameTimes.length;
    const stddev = Math.sqrt(variance);
    const isIrregular = stddev > avg * STEADY_TOLERANCE;

    // "Genuinely slow" = average is well below 30 fps AND irregular
    // (steady 33 ms is fine — it's a 30 Hz display, not a performance problem)
    const isSlow = avg > LOW_THRESHOLD_MS && isIrregular;

    if (isSlow) {
      this.lowFrames++;
      this.highFrames = 0;
    } else if (avg < HIGH_THRESHOLD_MS) {
      this.highFrames++;
      this.lowFrames = 0;
    } else {
      this.lowFrames = 0;
      this.highFrames = 0;
    }

    // Auto-adjust DPR: step down after sustained slow frames, step up after sustained high
    if (this.lowFrames > 30 && this.dprStep > 0) {
      this.dprStep--;
      this.lowFrames = 0;
    } else if (this.highFrames > 60 && this.dprStep < 4) {
      this.dprStep++;
      this.highFrames = 0;
    }

    // Auto-detect tier (only if no player override)
    if (!this.playerOverride) {
      if (isSlow) this.tier = 'low';
      else if (avg < HIGH_THRESHOLD_MS) this.tier = 'high';
      else this.tier = 'medium';
    }
  }

  getTier(): QualityTier {
    return this.playerOverride ?? this.tier;
  }

  /** Ultra: draw at the screen's full pixel ratio (up to 3x). Only while the game is at its top tier; slow devices still step down. */
  private ultra = false;
  setUltra(on: boolean): void {
    this.ultra = on;
  }

  setPlayerOverride(tier: QualityTier | null): void {
    this.playerOverride = tier;
  }

  getDprStep(): number {
    return this.dprStep;
  }

  /** Suggests a device pixel ratio capped by the current quality step. */
  resolveDpr(nativeDpr: number): number {
    // Each step down the frame rate has forced drops the ratio one notch, so it eases down rather than jumping to 1x.
    const notch = DPR_NOTCHES[this.dprStep];
    if (this.ultra && this.getTier() === 'high') return Math.min(Math.max(nativeDpr, 2), 3, notch);
    const tierCap = this.getTier() === 'low' ? 1 : this.getTier() === 'medium' ? 1.5 : 2;
    return Math.min(nativeDpr, tierCap, notch);
  }

}

export const qualityManager = new QualityManager();

/** The pixel ratios the game steps between, from lowest to full. */
const DPR_NOTCHES = [1, 1.5, 2, 2.5, 3];

/** The player's graphics choice: Auto, Ultra, High, Medium or Low. Ultra is High plus the full pixel ratio. */
export type PlayerQuality = 'auto' | 'ultra' | 'high' | 'medium' | 'low';

export function applyPlayerQuality(q: PlayerQuality): void {
  qualityManager.setUltra(q === 'ultra');
  qualityManager.setPlayerOverride(q === 'auto' ? null : q === 'ultra' ? 'high' : q);
}

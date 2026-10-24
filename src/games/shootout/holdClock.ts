/**
 * Times a hold from input timestamps instead of counting rendered frames, so a
 * release is judged the same at 30fps, 120fps, or through a stutter. Pointer
 * and keyboard events carry `timeStamp` on the same clock as
 * `performance.now()`, accurate to well under a frame.
 */
export class HoldClock {
  private startedAt: number | null = null;

  constructor(private now: () => number) {}

  /** A usable time for an input event: its own stamp if plausible, else now. */
  stamp(at?: number): number {
    const n = this.now();
    return at != null && Number.isFinite(at) && at <= n + 1 && n - at < 1000 ? at : n;
  }

  start(at?: number): void { this.startedAt = this.stamp(at); }

  /** Seconds held so far, or up to `at`. */
  held(at?: number): number {
    return this.startedAt == null ? 0 : Math.max(0, (this.stamp(at) - this.startedAt) / 1000);
  }

  /** End the hold and return how long it lasted. */
  stop(at?: number): number {
    const h = this.held(at);
    this.startedAt = null;
    return h;
  }

  get running(): boolean { return this.startedAt != null; }
}

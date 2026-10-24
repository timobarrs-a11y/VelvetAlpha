import { describe, it, expect } from 'vitest';
import { HoldClock } from '../holdClock';
import { judge } from '../engine';

/** A fake clock that only moves when a "frame" is rendered, like the game loop. */
function frames(fps: number) {
  let t = 1000;
  return { now: () => t, tick: () => { t += 1000 / fps; } };
}

describe('hold timing', () => {
  it('measures a hold from the input timestamps, not from rendered frames', () => {
    for (const fps of [30, 60, 120]) {
      const f = frames(fps);
      const c = new HoldClock(f.now);
      const pressAt = 1000.4;              // the press lands between frames
      c.start(pressAt);
      while (f.now() < pressAt + 760) f.tick(); // frames render past the release moment
      expect(c.stop(pressAt + 760)).toBeCloseTo(0.76, 6);
    }
  });

  it('grades a perfectly timed release as perfect at any frame rate (tightest window)', () => {
    const target = 0.6, half = 0.0106; // Legend Starry: about 10.6ms either side
    for (const fps of [24, 30, 60]) {
      const f = frames(fps);
      const c = new HoldClock(f.now);
      const press = f.now() + 3.3;
      f.tick(); c.start(press);
      // Frames keep rendering until the release event is handled.
      while (f.now() < press + target * 1000) f.tick();
      const held = c.stop(press + target * 1000);
      expect(judge(held, target, half * 2).grade).toBe('perfect');
    }
  });

  it('keeps time through a stutter (a long frame does not eat the hold)', () => {
    const f = frames(60);
    const c = new HoldClock(f.now);
    c.start(f.now());
    for (let i = 0; i < 10; i++) f.tick();
    // A 200ms hitch: the release happens mid-hitch and is handled when the frame finally lands.
    const releaseAt = f.now() + 150;
    for (let i = 0; i < 12; i++) f.tick();
    expect(c.stop(releaseAt)).toBeCloseTo((releaseAt - 1000) / 1000, 6);
  });

  it('falls back to the clock for missing or implausible timestamps', () => {
    const f = frames(60);
    const c = new HoldClock(f.now);
    c.start(undefined);
    f.tick(); f.tick();
    expect(c.held()).toBeCloseTo(2 / 60, 6);
    expect(c.stamp(0)).toBe(f.now());            // a zero stamp from an old browser
    expect(c.stamp(f.now() + 5000)).toBe(f.now()); // a stamp from the future
    expect(c.stamp(f.now() - 5000)).toBe(f.now()); // a stale stamp
  });

  it('never reports a negative hold and resets after stopping', () => {
    const f = frames(60);
    const c = new HoldClock(f.now);
    c.start(f.now());
    expect(c.stop(f.now() - 10)).toBe(0);
    expect(c.running).toBe(false);
    expect(c.held()).toBe(0);
  });
});

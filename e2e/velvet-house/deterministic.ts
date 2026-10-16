/**
 * Injected before the game script runs.
 * Freezes Math.random with a seeded mulberry32, pins Date.now and
 * performance.now to a fixed timeline so screenshots are identical every run.
 */
(() => {
  const SEED = 12345;
  let state = SEED >>> 0;
  const mulberry32 = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  Object.defineProperty(Math, 'random', { value: mulberry32, writable: true });

  const FROZEN_TIME = 0; // ms — everything starts at t=0
  let perfNow = FROZEN_TIME;
  const origRAF = window.requestAnimationFrame.bind(window);
  const origCancelRAF = window.cancelAnimationFrame.bind(window);
  const rafCallbacks = new Map<number, (t: number) => void>();
  let rafId = 1;

  // Fixed 16.67ms steps so animation time advances deterministically
  window.requestAnimationFrame = (cb: (t: number) => void) => {
    const id = rafId++;
    rafCallbacks.set(id, cb);
    origRAF((t) => {
      perfNow += 16.667;
      const cb2 = rafCallbacks.get(id);
      if (cb2) { rafCallbacks.delete(id); cb2(perfNow); }
    });
    return id;
  };
  window.cancelAnimationFrame = (id: number) => {
    rafCallbacks.delete(id);
    origCancelRAF(id);
  };

  Object.defineProperty(performance, 'now', { value: () => perfNow, writable: true });
  // Freeze Date.now to a fixed value — do NOT advance it with perfNow,
  // otherwise the number of RAF ticks before game boot varies between runs,
  // producing different Date.now()-based RNG seeds and diverging fixtures.
  Object.defineProperty(Date, 'now', { value: () => 1700000000000, writable: true });

  // Prevent localStorage bleed between test scenarios
  window.__clearVelvetSaves = () => {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('velvet-'))
        .forEach((k) => localStorage.removeItem(k));
    } catch {}
  };
})();

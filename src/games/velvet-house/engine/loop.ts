/** Drives `step` once per animation frame with a clamped delta in seconds. Returns a stop function. */
export function startLoop(step: (dt: number) => void): () => void {
  let last = performance.now();
  let id = 0;
  const frame = (now: number): void => {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    step(dt);
    id = requestAnimationFrame(frame);
  };
  id = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(id);
}

export const BASE_MIN_PER_SEC = 1;

/** Advances the in-game clock; rolls the day over at midnight. */
export function advanceClock(day: number, minutes: number, dt: number, speed: number): { day: number; minutes: number } {
  let m = minutes + dt * BASE_MIN_PER_SEC * speed;
  let d = day;
  while (m >= 1440) {
    m -= 1440;
    d++;
  }
  return { day: d, minutes: m };
}

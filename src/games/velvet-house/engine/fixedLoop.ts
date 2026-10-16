/**
 * Fixed-step simulation with interpolated rendering.
 * The simulation runs at a fixed 60 Hz timestep. Rendering is interpolated
 * between the previous and current sim state so visuals are smooth at any
 * frame rate. Pauses automatically when the tab is hidden.
 */

const FIXED_DT = 1 / 60;
const MAX_ACCUMULATOR = 0.1;

export function startFixedLoop(
  simulate: (dt: number) => void,
  render: (alpha: number, frameDt: number) => void,
): () => void {
  let last = performance.now();
  let accumulator = 0;
  let id = 0;
  let hidden = false;

  const onVisibility = () => { hidden = document.hidden; };
  document.addEventListener('visibilitychange', onVisibility);

  const frame = (now: number): void => {
    const realDt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;

    if (!hidden) {
      accumulator += realDt;
      accumulator = Math.min(accumulator, MAX_ACCUMULATOR);
      while (accumulator >= FIXED_DT) {
        simulate(FIXED_DT);
        accumulator -= FIXED_DT;
      }
      const alpha = accumulator / FIXED_DT;
      render(alpha, realDt);
    }

    id = requestAnimationFrame(frame);
  };
  id = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(id);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}

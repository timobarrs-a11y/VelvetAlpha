import { VIEW } from '../kernel/config';
import type { Game } from '../kernel/game';

/**
 * The title screen's backdrop: the real house, alive. Evening falls and the lamps come on, the two of them go about
 * their evening, and the camera drifts, closes in on one of them, then climbs a floor. It is a throwaway house (see
 * `run.attract` in kernel/config): nothing here is saved, and the menu sits on top of it.
 */
export function startAttract(g: Game): void {
  const { view, world, cam, people, stage } = g;
  stage.classList.add('vh-attract');
  world.minutes = 18 * 60 + 20;
  view.speedIdx = 2;
  view.follow = null;

  const reduced = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  // One shot after another: a wide drift, a close-up on each of them, the upstairs, the wide again from the other side.
  const shots: Array<() => void> = [
    () => { view.follow = null; g.setLevel(1, true); cam.tz = 1.15; },
    () => { view.follow = 'maya'; },
    () => { view.follow = null; g.setLevel(2, true); cam.tz = 1.3; },
    () => { view.follow = 'jordan'; },
    () => { view.follow = null; g.setLevel(1, true); view.rot = (view.rot + 1) % 4; cam.tz = 1.1; },
  ];
  let i = 0, t = 0, last = performance.now();
  shots[0]();
  const frame = (now: number): void => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now; t += dt;
    if (t > 11 && !reduced) { t = 0; i = (i + 1) % shots.length; shots[i](); }
    // While nobody is followed the frame drifts slowly.
    if (!view.follow) {
      cam.tfx = VIEW.w / 2 + Math.sin(now / 5200) * 48;
      cam.tfy = VIEW.h / 2 + Math.cos(now / 6800) * 22;
    }
    void people;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

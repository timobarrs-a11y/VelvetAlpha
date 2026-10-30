import type { AgentId } from '../state/agents';
import { qualityManager } from '../engine/qualityTier';
import { VIEW } from '../kernel/config';
import type { Game } from '../kernel/game';
import { SOCIAL_ACTS } from '../view/social';

export function createCamera(g: Game): Partial<Game> {
  const { view, people, canvas, ctx, art } = g;
  const fit = (): void => {
    // The canvas takes the shape of the picture (a bigger floor is not 640 x 440): the style rule reads this.
    canvas.style.setProperty('--vh-aspect', String(VIEW.w / VIEW.h));
    const ratio = qualityManager.resolveDpr(window.devicePixelRatio || 1);
    const box = canvas.getBoundingClientRect();
    const isNarrow = box.width < 560;
    let w: number, h: number;
    if (isNarrow) {
      h = Math.max(1, Math.round(box.height * ratio));
      w = Math.max(1, Math.round((h * VIEW.w) / VIEW.h));
    } else {
      w = Math.max(1, Math.round(box.width * ratio));
      h = Math.max(1, Math.round((w * VIEW.h) / VIEW.w));
    }
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    basePan = isNarrow ? -((w - Math.round(box.width * ratio)) / 2) * (w / VIEW.w) / w : 0;
    applyCamera(0);
  };

  // Camera: zoom and focus on top of the fitted view. Following someone frames
  // them in a close-up (a two-shot when they're with the other person);
  // otherwise scroll or pinch to zoom, drag to pan, double-tap to reset.
  let basePan = 0;
  const cam = { z: 1, fx: VIEW.w / 2, fy: VIEW.h / 2, tz: 1, tfx: VIEW.w / 2, tfy: VIEW.h / 2 };
  const CAM_MAX = 2.6;
  // A drag that ends while still moving glides on and slows down (view units per second).
  const fling = { vx: 0, vy: 0 };
  function flingCamera(vx: number, vy: number): void {
    const speed = Math.hypot(vx, vy);
    if (speed < 20) return;
    const cap = Math.min(1, 900 / speed);
    fling.vx = vx * cap; fling.vy = vy * cap;
  }
  // Panels that sit over the house (the Arrange panel, a lesson card, the floor and speed buttons) are not part of the
  // picture: while one is up, the house is framed in the band they leave free. Fractions of the canvas height.
  const inset = { top: 0, bottom: 0, ttop: 0, tbottom: 0 };
  let insetClock = 0;
  const visible = (el: Element | null): el is HTMLElement => !!el && !(el as HTMLElement).hidden && (el as HTMLElement).offsetParent !== null;
  // The last framing asked for: when a panel grows or shrinks, the same framing is redone in the new free band.
  let lastFrame: { points: Array<[number, number]>; maxZoom: number; pad: number } | null = null;
  function measureInsets(): void {
    const box = canvas.getBoundingClientRect();
    const was: [number, number] = [inset.ttop, inset.tbottom];
    inset.ttop = inset.tbottom = 0;
    // A story card sits over the middle for a moment and is read; only bands that stay (Arrange, a line) move the house.
    const covering = g.stage.classList.contains('vh-arranging') || visible(g.stage.querySelector('.vh-speech'));
    if (covering && box.height > 0) {
      const sel = ['.vh-drawer[data-open="arrange"]', '.vh-speech', '.vh-controls', '.vh-dock'];
      for (const el of sel.flatMap((q) => [...g.stage.querySelectorAll(q)])) {
        if (!visible(el)) continue;
        const r = el.getBoundingClientRect();
        // A side panel (desktop drawer) resizes the canvas instead; only bands across the house count.
        if (r.width < box.width * 0.5 || r.bottom <= box.top || r.top >= box.bottom) continue;
        if ((r.top + r.bottom) / 2 < box.top + box.height / 2) inset.ttop = Math.max(inset.ttop, (r.bottom - box.top) / box.height);
        else inset.tbottom = Math.max(inset.tbottom, (box.bottom - r.top) / box.height);
      }
      inset.ttop = Math.min(0.45, inset.ttop); inset.tbottom = Math.min(0.45, inset.tbottom);
    }
    if (lastFrame && (Math.abs(was[0] - inset.ttop) > 0.02 || Math.abs(was[1] - inset.tbottom) > 0.02)) {
      const f = lastFrame; lastFrame = null; frameView(f.points, f.maxZoom, f.pad);
    } else if (!covering) lastFrame = null;
  }
  /** While panels cover part of the screen the camera may pull out a little, so the whole house can sit in what is left. */
  const minZoom = (): number => (inset.ttop + inset.tbottom > 0.02 ? 0.6 : 1);
  /** The free band's centre, as an offset from the middle of the canvas (fraction of its height). */
  const bandOffset = (): number => (inset.top - inset.bottom) / 2;
  function clampFocus(z: number, fx: number, fy: number): [number, number] {
    const hw = VIEW.w / (2 * z);
    const off = bandOffset();
    const lo = (0.5 + off) * VIEW.h / z, hi = VIEW.h - (0.5 - off) * VIEW.h / z;
    // Pulled out past the edges of the view there is nothing to keep inside it: only stay on the map.
    return [hw * 2 >= VIEW.w ? Math.max(0, Math.min(VIEW.w, fx)) : Math.max(hw, Math.min(VIEW.w - hw, fx)), lo > hi ? Math.max(0, Math.min(VIEW.h, fy)) : Math.max(lo, Math.min(hi, fy))];
  }
  // A short shake for big moments (none when the player asks for reduced motion).
  let shakeLeft = 0, shakeAmp = 0;
  const SHAKE_TIME = 0.45;
  const reducedMotion = (): boolean => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  function shake(amount = 1): void {
    if (reducedMotion()) return;
    shakeAmp = Math.max(shakeAmp, amount); shakeLeft = SHAKE_TIME;
  }
  // A held shot: a close-up on someone (trying something on) or a pull back to the whole house (a room finished).
  // When it ends the camera returns to where the player had it.
  let beat: { until: number; kind: 'closeup' | 'reveal'; id: AgentId; back: { tz: number; tfx: number; tfy: number } } | null = null;
  function cameraBeat(kind: 'closeup' | 'reveal', id: AgentId = 'jordan', ms = 2400): void {
    if (reducedMotion() || view.follow) return;
    const back = beat ? beat.back : { tz: cam.tz, tfx: cam.tfx, tfy: cam.tfy };
    beat = { until: performance.now() + ms, kind, id, back };
  }
  function runBeat(): boolean {
    if (!beat) return false;
    if (performance.now() > beat.until || view.follow) {
      if (!view.follow) { cam.tz = beat.back.tz; cam.tfx = beat.back.tfx; cam.tfy = beat.back.tfy; }
      beat = null;
      return false;
    }
    const p = people.find((q) => q.id === beat!.id);
    if (beat.kind === 'closeup' && p && p.level === view.level) {
      const [ax, ay] = art.project(p.x, p.y, 0.9);
      cam.tz = 2.3; cam.tfx = ax; cam.tfy = ay;
    } else { cam.tz = 1; cam.tfx = VIEW.w / 2; cam.tfy = VIEW.h / 2; }
    return true;
  }
  /** Frame view-space points as closely as fits in the free band, never closer than maxZoom. */
  function frameView(points: Array<[number, number]>, maxZoom = 2.2, pad = 1): void {
    if (!points.length || view.follow) return;
    lastFrame = null;
    measureInsets(); inset.top = inset.ttop; inset.bottom = inset.tbottom;
    lastFrame = { points, maxZoom, pad };
    const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const bandH = 1 - inset.ttop - inset.tbottom;
    // Leave room round the points: the piece itself is bigger than its centre.
    const spanX = Math.max(60, x1 - x0 + 90 * pad), spanY = Math.max(50, y1 - y0 + 80 * pad);
    // On a phone held upright the screen shows only the middle slice of the view's width.
    const box = canvas.getBoundingClientRect();
    const visW = Math.min(VIEW.w, box.height > 0 ? (VIEW.h * box.width) / box.height : VIEW.w);
    const z = Math.min(maxZoom, visW / spanX, (VIEW.h * bandH) / spanY);
    cam.tz = Math.max(minZoom(), z);
    cam.tfx = (x0 + x1) / 2; cam.tfy = (y0 + y1) / 2;
  }
  // While a piece is carried the camera stays with it. It looks ahead of the finger, and only moves once the piece
  // leaves the middle of the free band, so a steady drag does not make the picture swim. When a lesson marks where
  // the piece is going, the camera frames the piece and that spot together and holds still.
  let lastHeld: [number, number] | null = null;
  const heldVel = { x: 0, y: 0 };
  function trackHeld(dt: number): void {
    const hc = g.heldCentre?.();
    if (hc) lastFrame = null;
    if (!hc || view.follow) { lastHeld = null; heldVel.x = heldVel.y = 0; return; }
    const [px, py] = art.project(hc.x, hc.y, hc.h);
    if (lastHeld && dt > 0) {
      const k = Math.min(1, dt * 8);
      heldVel.x += ((px - lastHeld[0]) / dt - heldVel.x) * k; heldVel.y += ((py - lastHeld[1]) / dt - heldVel.y) * k;
    }
    lastHeld = [px, py];
    const goal = g.ghostTarget?.();
    if (goal && goal.level === view.level) { frameView([[px, py], art.project(goal.x, goal.y, goal.h)], 2.0); return; }
    // Edge scrolling: while the piece is inside the middle of the screen the picture stays still. Once it (or the spot
    // it is heading for, a little ahead of the finger) goes past that, the picture scrolls after it at a steady pace.
    const lead: [number, number] = [px + Math.max(-45, Math.min(45, heldVel.x * 0.3)), py + Math.max(-35, Math.min(35, heldVel.y * 0.3))];
    const box = canvas.getBoundingClientRect();
    const visW = Math.min(VIEW.w, box.height > 0 ? (VIEW.h * box.width) / box.height : VIEW.w);
    const dx = (visW / (2 * cam.tz)) * 0.6, dy = ((VIEW.h * (1 - inset.ttop - inset.tbottom)) / (2 * cam.tz)) * 0.6;
    const maxStep = 260 * dt / cam.tz;
    const edge = (d: number, dz: number): number => {
      const over = Math.abs(d) - dz;
      return over > 0 ? Math.sign(d) * Math.min(over, maxStep) : 0;
    };
    cam.tfx += edge(lead[0] - cam.tfx, dx);
    cam.tfy += edge(lead[1] - cam.tfy, dy);
  }
  function cameraShot(): void {
    if (runBeat()) return;
    const followed = view.follow && people.find((p) => p.id === view.follow);
    if (!followed || followed.level !== view.level) return;
    const other = people.find((p) => p.id !== followed.id);
    const together = other && other.level === followed.level && followed.task && SOCIAL_ACTS.has(followed.task.act);
    const [ax, ay] = art.project(followed.x, followed.y, 0.7);
    if (together && other) {
      const [bx, by] = art.project(other.x, other.y, 0.7);
      cam.tz = 1.7; cam.tfx = (ax + bx) / 2; cam.tfy = (ay + by) / 2;
    } else {
      cam.tz = 2.1; cam.tfx = ax; cam.tfy = ay;
    }
  }
  function applyCamera(frameDt: number): void {
    insetClock -= frameDt;
    if (insetClock <= 0 || frameDt === 0) { insetClock = 0.1; measureInsets(); }
    const ik = frameDt > 0 ? Math.min(1, frameDt * 8) : 1;
    inset.top += (inset.ttop - inset.top) * ik; inset.bottom += (inset.tbottom - inset.bottom) * ik;
    trackHeld(frameDt);
    cameraShot();
    if (frameDt > 0 && (fling.vx || fling.vy)) {
      if (view.follow) fling.vx = fling.vy = 0;
      else {
        cam.tfx += fling.vx * frameDt; cam.tfy += fling.vy * frameDt;
        const decay = Math.exp(-frameDt * 4.5);
        fling.vx *= decay; fling.vy *= decay;
        if (Math.hypot(fling.vx, fling.vy) < 4) fling.vx = fling.vy = 0;
      }
    }
    const k = frameDt > 0 ? Math.min(1, frameDt * 6) : 1;
    cam.tz = Math.max(minZoom(), cam.tz);
    cam.z += (cam.tz - cam.z) * k;
    [cam.tfx, cam.tfy] = clampFocus(cam.tz, cam.tfx, cam.tfy);
    cam.fx += (cam.tfx - cam.fx) * k; cam.fy += (cam.tfy - cam.fy) * k;
    [cam.fx, cam.fy] = clampFocus(cam.z, cam.fx, cam.fy);
    const w = canvas.width, h = canvas.height, sx = (w / VIEW.w) * cam.z, sy = (h / VIEW.h) * cam.z;
    let ox = 0, oy = 0;
    if (shakeLeft > 0) {
      if (frameDt > 0) shakeLeft -= frameDt;
      if (shakeLeft <= 0) shakeAmp = 0;
      else {
        const k2 = (shakeLeft / SHAKE_TIME) * shakeAmp * (w / VIEW.w), now = performance.now();
        ox = Math.sin(now * 0.09) * 2.4 * k2; oy = Math.cos(now * 0.11) * 1.8 * k2;
      }
    }
    ctx!.setTransform(sx, 0, 0, sy, w / 2 - sx * cam.fx + basePan + ox, h * (0.5 + bandOffset()) - sy * cam.fy + oy);
  }
  /** A pointer position in game view coordinates, whatever the zoom. */
  function toView(clientX: number, clientY: number): [number, number] {
    const rect = canvas.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * canvas.width, py = ((clientY - rect.top) / rect.height) * canvas.height;
    const p = ctx!.getTransform().inverse().transformPoint(new DOMPoint(px, py));
    return [p.x, p.y];
  }
  function zoomAt(clientX: number, clientY: number, factor: number): void {
    if (view.follow) g.toggleFollow(view.follow); // taking the camera back from a follow
    lastFrame = null;
    const [px, py] = toView(clientX, clientY);
    const nz = Math.max(minZoom(), Math.min(CAM_MAX, cam.tz * factor));
    // Keep the spot under the finger or cursor where it is.
    cam.tfx = px - (px - cam.tfx) * (cam.tz / nz);
    cam.tfy = py - (py - cam.tfy) * (cam.tz / nz);
    cam.tz = nz;
  }
  function resetCamera(): void { lastFrame = null; fling.vx = fling.vy = 0; cam.tz = minZoom(); cam.tfx = VIEW.w / 2; cam.tfy = VIEW.h / 2; }
  new ResizeObserver(fit).observe(canvas);
  fit();
  return { cam, fit, applyCamera, toView, zoomAt, resetCamera, frameView, trackHeld, flingCamera, shake, cameraBeat };
}

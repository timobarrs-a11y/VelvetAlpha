import { qualityManager } from '../engine/qualityTier';
import { VIEW_W, VIEW_H } from '../kernel/config';
import type { Game } from '../kernel/game';
import { SOCIAL_ACTS } from '../view/social';

export function createCamera(g: Game): Partial<Game> {
  const { view, people, canvas, ctx, art } = g;
  const fit = (): void => {
    const ratio = qualityManager.resolveDpr(window.devicePixelRatio || 1);
    const box = canvas.getBoundingClientRect();
    const isNarrow = box.width < 560;
    let w: number, h: number;
    if (isNarrow) {
      h = Math.max(1, Math.round(box.height * ratio));
      w = Math.max(1, Math.round((h * VIEW_W) / VIEW_H));
    } else {
      w = Math.max(1, Math.round(box.width * ratio));
      h = Math.max(1, Math.round((w * VIEW_H) / VIEW_W));
    }
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    basePan = isNarrow ? -((w - Math.round(box.width * ratio)) / 2) * (w / VIEW_W) / w : 0;
    applyCamera(0);
  };

  // Camera: zoom and focus on top of the fitted view. Following someone frames
  // them in a close-up (a two-shot when they're with the other person);
  // otherwise scroll or pinch to zoom, drag to pan, double-tap to reset.
  let basePan = 0;
  const cam = { z: 1, fx: VIEW_W / 2, fy: VIEW_H / 2, tz: 1, tfx: VIEW_W / 2, tfy: VIEW_H / 2 };
  const CAM_MAX = 2.6;
  function clampFocus(z: number, fx: number, fy: number): [number, number] {
    const hw = VIEW_W / (2 * z), hh = VIEW_H / (2 * z);
    return [Math.max(hw, Math.min(VIEW_W - hw, fx)), Math.max(hh, Math.min(VIEW_H - hh, fy))];
  }
  function cameraShot(): void {
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
    cameraShot();
    const k = frameDt > 0 ? Math.min(1, frameDt * 6) : 1;
    cam.z += (cam.tz - cam.z) * k;
    [cam.tfx, cam.tfy] = clampFocus(cam.tz, cam.tfx, cam.tfy);
    cam.fx += (cam.tfx - cam.fx) * k; cam.fy += (cam.tfy - cam.fy) * k;
    [cam.fx, cam.fy] = clampFocus(cam.z, cam.fx, cam.fy);
    const w = canvas.width, h = canvas.height, sx = (w / VIEW_W) * cam.z, sy = (h / VIEW_H) * cam.z;
    ctx!.setTransform(sx, 0, 0, sy, w / 2 - sx * cam.fx + basePan, h / 2 - sy * cam.fy);
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
    const [px, py] = toView(clientX, clientY);
    const nz = Math.max(1, Math.min(CAM_MAX, cam.tz * factor));
    // Keep the spot under the finger or cursor where it is.
    cam.tfx = px - (px - cam.tfx) * (cam.tz / nz);
    cam.tfy = py - (py - cam.tfy) * (cam.tz / nz);
    cam.tz = nz;
  }
  function resetCamera(): void { cam.tz = 1; cam.tfx = VIEW_W / 2; cam.tfy = VIEW_H / 2; }
  new ResizeObserver(fit).observe(canvas);
  fit();
  return { cam, fit, applyCamera, toView, zoomAt, resetCamera };
}

/**
 * A small frame-rate counter in the corner: the frames per second, the quality tier the game is at, and the pixel ratio
 * it is drawing at. Shown when the player turns it on in Settings, or with `?fps` in the address.
 */
import { qualityManager } from './qualityTier';

const KEY = 'velvet-fps';

export function fpsOn(): boolean {
  try { return localStorage.getItem(KEY) === '1' || new URLSearchParams(location.search).has('fps'); } catch { return false; }
}

export function setFpsOn(on: boolean): void {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* storage blocked */ }
}

export function createFpsMeter(): { frame(dt: number): void } {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;top:6px;right:8px;z-index:9999;font:600 11px/1.2 monospace;color:#fff;background:rgba(0,0,0,.6);padding:3px 6px;border-radius:6px;pointer-events:none;display:none';
  document.body.appendChild(el);
  let frames = 0, seconds = 0;
  return {
    frame(dt: number): void {
      if (!fpsOn()) { el.style.display = 'none'; frames = 0; seconds = 0; return; }
      el.style.display = 'block';
      frames++;
      seconds += dt;
      if (seconds >= 0.5) {
        const dpr = qualityManager.resolveDpr(window.devicePixelRatio || 1);
        el.textContent = `${Math.round(frames / seconds)} fps · ${qualityManager.getTier()} · ${dpr}x`;
        frames = 0; seconds = 0;
      }
    },
  };
}

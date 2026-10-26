import { TYPES } from '../state/objects';
import { VIEW_W } from '../kernel/config';
import type { Game } from '../kernel/game';

export function createInput(g: Game): void {
  const { people, view, log, canvas, art, cam } = g;
  // Canvas click → interaction or arrange
  canvas.addEventListener('click', (e) => {
    if (g.s.suppressClick) { g.s.suppressClick = false; return; }
    const [sx, sy] = g.toView(e.clientX, e.clientY);

    if (g.isArranging()) {
      // Arrange mode: pointer events do the work (select on press, drag to
      // move). A tap on empty floor lets go of the selection.
      if (!g.movableAt(sx, sy)) g.selectObject(null);
      return;
    }

    // Try clicking on Maya → open chat
    const maya = people[1];
    if (maya.level === view.level) {
      const [mx, my] = art.project(maya.x, maya.y, maya.z);
      if (Math.hypot(sx - mx, sy - my) < 30) { g.openChat(); return; }
    }
    // Try clicking on Jordan → follow
    const jordan = people[0];
    if (jordan.level === view.level) {
      const [jx, jy] = art.project(jordan.x, jordan.y, jordan.z);
      if (Math.hypot(sx - jx, sy - jy) < 30) { g.toggleFollow('jordan'); return; }
    }
    // Try clicking on objects. Touch one and it comes alive: the TV flickers
    // on, the washer spins, the fridge swings open. This comes before the
    // room's lights, so tapping the TV doesn't switch on the lamp beside it.
    // Then, as before, you can ask Jordan to use it.
    const obj = g.findObjectAt(sx, sy);
    const reaction = obj ? art.poke(obj, g.counterPartAt(obj, sx, sy)) : null;
    if (obj && reaction) {
      log(reaction);
      g.showObjectActions(obj, e.clientX, e.clientY, true);
      return;
    }
    const lightState = art.toggleLightAt(view.level, sx, sy);
    if (lightState !== null) { log(`Light turned ${lightState ? 'on' : 'off'}.`); return; }
    if (obj && TYPES[obj.type]?.light) {
      const on = art.toggleObjectLight(obj.id);
      log(`${TYPES[obj.type]?.name ?? 'Light'} turned ${on ? 'on' : 'off'}.`);
      return;
    }
    if (obj) { g.showObjectActions(obj, e.clientX, e.clientY); return; }
  });

  // Zoom and pan: wheel, pinch, drag (when zoomed), double-tap to reset.
  const touches = new Map<number, { x: number; y: number }>();
  let dragFrom: { x: number; y: number; fx: number; fy: number } | null = null;
  let pinchFrom = 0;
  // How fast the finger was moving when it let go, so a quick drag glides on a little.
  let lastMove: { t: number; x: number; y: number; vx: number; vy: number } | null = null;
  canvas.style.touchAction = 'none';
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); g.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  canvas.addEventListener('dblclick', () => { if (view.follow) g.toggleFollow(view.follow); g.resetCamera(); });
  canvas.addEventListener('pointerdown', (e) => {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 1) dragFrom = g.isArranging() && g.movableAt(...g.toView(e.clientX, e.clientY)) ? null : { x: e.clientX, y: e.clientY, fx: cam.tfx, fy: cam.tfy };
    if (touches.size === 2) { const [a, b] = [...touches.values()]; pinchFrom = Math.hypot(a.x - b.x, a.y - b.y); dragFrom = null; g.abortDrag(); }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!touches.has(e.pointerId)) return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2 && pinchFrom > 0) {
      const [a, b] = [...touches.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
      g.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinchFrom);
      pinchFrom = d; g.s.suppressClick = true;
    } else if (dragFrom && cam.tz > 1.01) {
      const dx = e.clientX - dragFrom.x, dy = e.clientY - dragFrom.y;
      if (Math.hypot(dx, dy) > 6) {
        const rect = canvas.getBoundingClientRect(), k = VIEW_W / rect.width / cam.tz;
        if (view.follow) g.toggleFollow(view.follow);
        cam.tfx = dragFrom.fx - dx * k; cam.tfy = dragFrom.fy - dy * k;
        g.s.suppressClick = true;
        const now = performance.now();
        if (lastMove && now > lastMove.t) {
          const s = 1000 / (now - lastMove.t);
          lastMove = { t: now, x: e.clientX, y: e.clientY, vx: lastMove.vx * 0.5 + (e.clientX - lastMove.x) * s * 0.5, vy: lastMove.vy * 0.5 + (e.clientY - lastMove.y) * s * 0.5 };
        } else lastMove = { t: now, x: e.clientX, y: e.clientY, vx: 0, vy: 0 };
      }
    }
  });
  const lift = (e: PointerEvent) => {
    touches.delete(e.pointerId);
    if (touches.size < 2) pinchFrom = 0;
    if (touches.size === 0) {
      if (dragFrom && lastMove && performance.now() - lastMove.t < 80) {
        const k = VIEW_W / canvas.getBoundingClientRect().width / cam.tz;
        g.flingCamera(-lastMove.vx * k, -lastMove.vy * k);
      }
      dragFrom = null;
      lastMove = null;
    }
  };
  canvas.addEventListener('pointerup', lift);
  canvas.addEventListener('pointercancel', lift);
}

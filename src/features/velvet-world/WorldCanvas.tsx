import { useRef, useEffect, type MutableRefObject } from 'react';
import {
  iso, LOT_W, TW, TH, TOWN, STREET, FONTS,
  drawPlot, drawPlotLive, drawPlotLights, drawPlotLowDetail,
  drawTownGround, drawTownFront, drawTownLights, drawTownLightsLow,
  drawTownStreets, drawTownSquare,
  drawWeather, lightingAt, plotBounds, resolvePlot,
  townBounds,
  type Plot, type Season, type Env, type View, type PlotMeta, type TownLayout, type Rect,
} from './art/streetArt';

export type ViewMode = 'street' | 'town';


/** Unread mail: the flag goes up and the mailbox glows. */
function drawMailLight(ctx: CanvasRenderingContext2D, mb: { top: [number, number]; flag: [number, number] }, zoom: number, t: number, still: boolean) {
  const k = Math.max(1, 0.7 / Math.max(zoom, 0.2)), pulse = still ? 1 : 0.7 + 0.3 * Math.sin(t * 3.2);
  const [tx, ty] = mb.top, [fx, fy] = mb.flag;
  ctx.save();
  const r = 15 * k, g = ctx.createRadialGradient(tx, ty, 0, tx, ty, r);
  g.addColorStop(0, `rgba(255,214,120,${0.75 * pulse})`); g.addColorStop(1, 'rgba(255,214,120,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(tx, ty, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgba(255,236,170,${0.7 + 0.3 * pulse})`; ctx.beginPath(); ctx.arc(tx, ty - 3 * k, 2.4 * k, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#D9D5CE'; ctx.lineWidth = 1.1 * k; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - 9 * k); ctx.stroke();
  ctx.fillStyle = '#F0436B'; ctx.fillRect(fx, fy - 9 * k, 6 * k, 4 * k);
  ctx.restore();
}

/** A small "LIVE" pill just above a house: a real person lives here. */
function drawLiveMarker(ctx: CanvasRenderingContext2D, pts: [number, number][], zoom: number, t: number, still: boolean) {
  let top = Infinity, minX = Infinity, maxX = -Infinity;
  for (const [x, y] of pts) { if (y < top) top = y; if (x < minX) minX = x; if (x > maxX) maxX = x; }
  const k = 1 / Math.max(zoom, 0.35), cx = (minX + maxX) / 2, bob = still ? 0 : Math.sin(t * 2.2) * 1.5 * k;
  const h = 14 * k, w = 40 * k, x = cx - w / 2, y = top - 20 * k - h + bob;
  ctx.save();
  ctx.fillStyle = 'rgba(20,18,42,0.88)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
  ctx.lineWidth = 1 * k; ctx.strokeStyle = 'rgba(89,201,138,0.7)'; ctx.stroke();
  const pulse = still ? 1 : 0.65 + 0.35 * Math.sin(t * 3.4);
  ctx.fillStyle = `rgba(89,201,138,${pulse})`;
  ctx.beginPath(); ctx.arc(x + 9 * k, y + h / 2, 2.6 * k, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#E9FFF1'; ctx.font = `800 ${8 * k}px ${FONTS.ui}`; ctx.textBaseline = 'middle';
  ctx.fillText('LIVE', x + 15 * k, y + h / 2 + 0.5 * k);
  ctx.restore();
}

/** Camera moves the page can ask for. Slots are permanent plot numbers (slot_index). */
export interface WorldControl {
  showStreet: () => void;
  /** Start over your own house, then pull back to the whole town. */
  showTown: () => void;
  /** Jump high over a plot, then fly down to it. */
  visit: (slot: number) => void;
  tower: () => void;
}

interface WorldCanvasProps {
  plots: Plot[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Someone tapped a mailbox. */
  onMailbox?: (id: string) => void;
  /** Your own user id and how many letters are waiting: your mailbox lights up. */
  myId?: string;
  mailUnread?: number;
  season: Season;
  hour: number;
  view: ViewMode;
  /** Town summaries indexed by slot_index; gaps (deleted accounts) are undefined. */
  townPlots: (Plot | undefined)[];
  /** Bump when townPlots gains rows, so the zoomed-out image is redrawn. */
  townVersion: number;
  /** Full plots (with names) for the close-up town, keyed by user id, origin set. */
  detailRef: MutableRefObject<Map<string, Plot>>;
  /** Asks the page to load cards for plots that are close up but have no name yet. */
  onNeedCards: (ids: string[]) => void;
  townLayout: TownLayout;
  landmarkPct: number;
  homeSlot: number;
  pins: { slot: number; label: string; color: string }[];
  controlRef: MutableRefObject<WorldControl | null>;
}

interface CacheEntry {
  key: string;
  scale: number;
  b: Rect;
  e: Plot;
  live: boolean;
  meta?: PlotMeta;
  back?: HTMLCanvasElement;
  front?: HTMLCanvasElement;
}

function cacheKey(p: Plot, season: Season): string {
  return JSON.stringify([p.member, p.config, p.profile.name, p.profile.medals, season]);
}

function rrPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function WorldCanvas(props: WorldCanvasProps) {
  const { plots, season, townPlots, controlRef } = props;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // The render loop reads the latest props from here, so React never re-runs it.
  const propsRef = useRef(props);
  propsRef.current = props;
  const streetCacheRef = useRef<Map<number, CacheEntry>>(new Map());
  const townCacheRef = useRef<Map<number, CacheEntry>>(new Map());

  useEffect(() => {
    const canvasEl = canvasRef.current;
    const container = containerRef.current;
    const ctx2d = canvasEl?.getContext('2d');
    if (!canvasEl || !container || !ctx2d) return;
    const canvas: HTMLCanvasElement = canvasEl;
    const ctx: CanvasRenderingContext2D = ctx2d;
    const P = () => propsRef.current;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const cam = { x: 0, y: 0, zoom: 1.2 };
    let view: ViewMode = P().view, lastPropView: ViewMode = view;
    let W = 0, H = 0, dpr = 1, raf = 0, zoomSettled = 0;
    let flight: { from: typeof cam; to: typeof cam; t0: number; ms: number } | null = null;
    let townImage: { canvas: HTMLCanvasElement; b: Rect; key: string } | null = null;
    let slotBoundsFor: TownLayout | null = null, slotBounds: Rect[] = [];
    const requested = new Map<string, number>();
    let needTimer: ReturnType<typeof setTimeout> | null = null;
    const streetCache = streetCacheRef.current, townCache = townCacheRef.current;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const rect = container.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    };
    const ro = new ResizeObserver(() => { resize(); streetCache.clear(); townCache.clear(); townImage = null; });
    ro.observe(container);
    resize();

    const narrow = () => W < 760;
    const flyTo = (x: number, y: number, zoom: number, ms = 900) => { flight = { from: { ...cam }, to: { x, y, zoom }, t0: performance.now(), ms }; };
    const slotCenter = (slot: number) => { const s = P().townLayout.slots[slot] ?? { x: 0, y: 0 }; return iso(s.x + 4, s.y + 4.5, 1.5); };
    const townFit = () => {
      const b = townBounds(P().townLayout);
      return { x: b.x + b.w / 2, y: b.y + b.h / 2, zoom: Math.min(W / b.w, (H - 120) / b.h) * 0.95 };
    };
    const getSlotBounds = () => {
      const layout = P().townLayout;
      if (slotBoundsFor !== layout) { slotBounds = layout.slots.map((s) => plotBounds(0, { id: '', member: false, origin: s, profile: { name: '' }, config: {} })); slotBoundsFor = layout; }
      return slotBounds;
    };
    function frameStreet() {
      cam.zoom = narrow() ? Math.max(0.55, W / 640) : Math.min(1.5, W / 1300);
      const [ax, ay] = iso(narrow() ? 43.5 : 45, 5.2, 1.2);
      cam.x = ax;
      cam.y = ay + (narrow() ? -40 : 30);
    }

    controlRef.current = {
      showStreet: () => { view = 'street'; flight = null; frameStreet(); },
      showTown: () => {
        view = 'town';
        const [cx, cy] = slotCenter(P().homeSlot);
        cam.x = cx; cam.y = cy; cam.zoom = narrow() ? 0.7 : 1.0; flight = null;
        setTimeout(() => { const f = townFit(); flyTo(f.x, f.y, f.zoom, 1800); }, 350);
      },
      visit: (slot) => {
        view = 'town';
        const [cx, cy] = slotCenter(slot);
        cam.x = cx; cam.y = cy; cam.zoom = 0.2;
        flyTo(cx, cy, narrow() ? 0.7 : 1.0, 1300);
      },
      tower: () => {
        if (view === 'street') {
          const lx = Math.min((P().plots.length * LOT_W) / 2, 12), [x, y] = iso(lx, -12.6, 4.4);
          flyTo(x, y + 40, narrow() ? 0.7 : 1.0);
        } else {
          const q = P().townLayout.square, [x, y] = iso(q.cx, q.cy, 4);
          flyTo(x, y, narrow() ? 0.6 : 0.9, 1200);
        }
      },
    };
    if (view === 'street') frameStreet(); else controlRef.current.showTown();

    const toWorld = (sx: number, sy: number): [number, number] => [cam.x + (sx - W / 2) / cam.zoom, cam.y + (sy - H / 2) / cam.zoom];

    function clampCam() {
      if (view === 'street') {
        const n = P().plots.length;
        if (n === 0) return;
        const [a] = iso(-6, 12, 0), [b] = iso(n * LOT_W + 6, 0, 0), [, c] = iso(0, -20, 6), [, d] = iso(n * LOT_W, 16, 0);
        cam.x = Math.max(a, Math.min(b, cam.x));
        cam.y = Math.max(c, Math.min(d, cam.y));
      } else {
        const b = townBounds(P().townLayout);
        cam.x = Math.max(b.x, Math.min(b.x + b.w, cam.x));
        cam.y = Math.max(b.y, Math.min(b.y + b.h, cam.y));
      }
    }

    function zoomAt(sx: number, sy: number, f: number) {
      const [wx, wy] = toWorld(sx, sy);
      const min = view === 'town' ? townFit().zoom * 0.9 : 0.3;
      cam.zoom = Math.max(min, Math.min(4, cam.zoom * f));
      cam.x = wx - (sx - W / 2) / cam.zoom;
      cam.y = wy - (sy - H / 2) / cam.zoom;
      zoomSettled = performance.now() + 220;
      clampCam();
    }

    function buildPlotCache(cache: Map<number, CacheEntry>, i: number, p: Plot, scale: number, season: Season): CacheEntry {
      const b = plotBounds(i, p), pxW = Math.ceil(b.w * scale), pxH = Math.ceil(b.h * scale);
      const entry: CacheEntry = { key: cacheKey(p, season), scale, b, e: p, live: pxW * pxH > 7e6 };
      p._resolved = resolvePlot(p);
      if (!entry.live) {
        const mk = (): [HTMLCanvasElement, CanvasRenderingContext2D] => {
          const c = document.createElement('canvas');
          c.width = pxW;
          c.height = pxH;
          const o = c.getContext('2d') as CanvasRenderingContext2D;
          o.setTransform(scale, 0, 0, scale, -b.x * scale, -b.y * scale);
          return [c, o];
        };
        const env = { season } as Env;
        const [cb, ob] = mk();
        entry.meta = drawPlot(ob, p, i, 'back', env);
        entry.back = cb;
        const [cf, of] = mk();
        drawPlot(of, p, i, 'front', env);
        entry.front = cf;
      }
      cache.delete(i);
      cache.set(i, entry);
      if (cache.size > 140) cache.delete(cache.keys().next().value as number);
      return entry;
    }

    function drawDetailed(cache: Map<number, CacheEntry>, i: number, p: Plot, scale: number, env: Env, t: number, budget: { left: number }): CacheEntry | null {
      const c = cache.get(i), key = cacheKey(p, env.season);
      const fresh = c && c.key === key && (Math.abs(c.scale - scale) / scale < 0.02 || performance.now() < zoomSettled);
      let entry = fresh ? c : null;
      if (!entry) {
        if (budget.left <= 0 && c && c.key === key) entry = c;
        else if (budget.left > 0) { budget.left--; entry = buildPlotCache(cache, i, p, scale, env.season); }
      }
      if (!entry) { drawPlotLowDetail(ctx, p, env); return null; }
      if (entry.live || !entry.back || !entry.front || !entry.meta) {
        entry.meta = drawPlot(ctx, entry.e, i, 'back', env);
        drawPlotLive(ctx, entry.e, i, entry.meta, t, env);
        drawPlot(ctx, entry.e, i, 'front', env);
      } else {
        const b = entry.b;
        ctx.drawImage(entry.back, b.x, b.y, b.w, b.h);
        drawPlotLive(ctx, entry.e, i, entry.meta, t, env);
        ctx.drawImage(entry.front, b.x, b.y, b.w, b.h);
      }
      return entry;
    }

    function buildTownImage(key: string) {
      const layout = P().townLayout, b = townBounds(layout), sc = Math.min(1, 3400 / b.w);
      const c = document.createElement('canvas');
      c.width = Math.ceil(b.w * sc);
      c.height = Math.ceil(b.h * sc);
      const o = c.getContext('2d') as CanvasRenderingContext2D;
      o.setTransform(sc, 0, 0, sc, -b.x * sc, -b.y * sc);
      const env = { season: P().season } as Env;
      drawTownStreets(o, layout, env, null, false);
      for (const p of P().townPlots) if (p) drawPlotLowDetail(o, p, env);
      drawTownSquare(o, layout, env, null, P().landmarkPct);
      townImage = { canvas: c, b, key };
    }

    // Close-up plots without a name yet: ask the page for their cards, at most every 250 ms.
    function requestCards(ids: string[]) {
      const now = performance.now();
      const fresh = ids.filter((id) => now - (requested.get(id) ?? -Infinity) > 15000);
      if (fresh.length === 0 || needTimer) return;
      needTimer = setTimeout(() => {
        needTimer = null;
        const t = performance.now(), batch = fresh.filter((id) => !P().detailRef.current.has(id)).slice(0, 100);
        batch.forEach((id) => requested.set(id, t));
        if (batch.length) P().onNeedCards(batch);
      }, 250);
    }

    function inside(pts: [number, number][], x: number, y: number): boolean {
      let a = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) a = !a;
      }
      return a;
    }

    function pick(sx: number, sy: number) {
      const [x, y] = toWorld(sx, sy);
      const cache = view === 'street' ? streetCache : townCache;
      let hit: string | null = null;
      // mailboxes first: they stand in front of everything else on the lot
      for (const [, c] of cache) {
        const m = c.meta && c.meta.hit.mailbox;
        if (!m) continue;
        const xs = m.map((q) => q[0]), ys = m.map((q) => q[1]);
        if (x > Math.min(...xs) && x < Math.max(...xs) && y > Math.min(...ys) && y < Math.max(...ys)) { P().onMailbox?.(c.e.id); return; }
      }
      for (const [, c] of cache) if (c.meta && c.meta.hit.sign && inside(c.meta.hit.sign, x, y)) hit = c.e.id;
      if (!hit) {
        for (const [, c] of cache) {
          const h = c.meta && c.meta.hit.house;
          if (!h) continue;
          const xs = h.map((p) => p[0]), ys = h.map((p) => p[1]);
          if (x > Math.min(...xs) && x < Math.max(...xs) && y > Math.min(...ys) && y < Math.max(...ys)) hit = c.e.id;
        }
      }
      if (!hit && view === 'town') {
        // far away: find the lot under the finger and fly to it
        const wx = (x / TW + y / TH) / 2, wy = (y / TH - x / TW) / 2;
        const row = Math.floor(wy / TOWN.rowPitch), col = Math.floor(wx / LOT_W);
        const k = P().townLayout.slots.findIndex((sl) => sl.row === row && sl.col === col);
        const tp = k >= 0 ? P().townPlots[k] : undefined;
        if (tp && wy - row * TOWN.rowPitch < STREET.lawnFront + 1) {
          const [cx, cy] = slotCenter(k);
          flyTo(cx, cy, Math.max(cam.zoom, 0.9));
          hit = tp.id;
        }
      }
      P().onSelect(hit);
    }

    const pointers = new Map<number, [number, number]>();
    let drag: { x: number; y: number; cx: number; cy: number; moved: number } | null = null;
    let pinch: { d: number; z: number } | null = null;
    const local = (e: { clientX: number; clientY: number }): [number, number] => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

    const onPointerDown = (e: PointerEvent) => {
      flight = null;
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, local(e));
      if (pointers.size === 1) drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: 0 };
      if (pointers.size === 2) { const [p, q] = [...pointers.values()]; pinch = { d: Math.hypot(p[0] - q[0], p[1] - q[1]), z: cam.zoom }; drag = null; }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, local(e));
      if (pinch && pointers.size === 2) {
        const [p, q] = [...pointers.values()], d = Math.hypot(p[0] - q[0], p[1] - q[1]);
        zoomAt((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (pinch.z * (d / pinch.d)) / cam.zoom);
        return;
      }
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
      cam.x = drag.cx - dx / cam.zoom;
      cam.y = drag.cy - dy / cam.zoom;
      clampCam();
    };
    const endPointer = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (drag && drag.moved < 6 && e.type === 'pointerup') pick(...local(e));
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 0) drag = null;
    };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); flight = null; zoomAt(...local(e), Math.exp(-e.deltaY * 0.0015)); };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    const t0 = performance.now();
    function render(now: number) {
      raf = requestAnimationFrame(render);
      const props = P();
      // The page's Block/Town toggle. visit() already switched, so this only reacts to a real change.
      if (props.view !== lastPropView) {
        lastPropView = props.view;
        if (props.view !== view && props.view === 'street') controlRef.current?.showStreet();
        else if (props.view !== view) controlRef.current?.showTown();
      }
      if (flight) {
        const u = Math.min(1, (now - flight.t0) / flight.ms), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        cam.x = flight.from.x + (flight.to.x - flight.from.x) * e;
        cam.y = flight.from.y + (flight.to.y - flight.from.y) * e;
        cam.zoom = Math.exp(Math.log(flight.from.zoom) + (Math.log(flight.to.zoom) - Math.log(flight.from.zoom)) * e);
        if (u >= 1) flight = null;
        zoomSettled = now + 220;
      }
      const t = (now - t0) / 1000, light = lightingAt(props.hour, props.season);
      const env: Env = { season: props.season, hour: props.hour, night: light.night, reducedMotion: reduceMotion.matches, zoom: cam.zoom };
      const s = cam.zoom * dpr;
      const vr: View = { x0: cam.x - W / 2 / cam.zoom, x1: cam.x + W / 2 / cam.zoom, y0: cam.y - H / 2 / cam.zoom, y1: cam.y + H / 2 / cam.zoom };
      const inView = (b: Rect) => !(b.x > vr.x1 || b.x + b.w < vr.x0 || b.y > vr.y1 || b.y + b.h < vr.y0);
      const world = () => ctx.setTransform(s, 0, 0, s, (W * dpr) / 2 - cam.x * s, (H * dpr) / 2 - cam.y * s);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = props.season === 'winter' ? '#D9E0E6' : '#9DAE97';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      world();

      const detailed: [number, CacheEntry][] = [], lowVisible: Plot[] = [], budget = { left: 5 };
      let ground: { lights: unknown[] } = { lights: [] }, front: { lamps: unknown[] } = { lamps: [] }, square: { lights: unknown[] } = { lights: [] };

      if (view === 'street') {
        ground = drawTownGround(ctx, props.plots.length, env, vr, props.landmarkPct);
        props.plots.forEach((p, i) => {
          if (!inView(plotBounds(i, p))) return;
          const entry = drawDetailed(streetCache, i, p, s, env, t, budget);
          if (entry) detailed.push([i, entry]);
        });
        front = drawTownFront(ctx, props.plots.length, env, vr);
      } else {
        const sb = getSlotBounds(), townPlots = props.townPlots, detail = props.detailRef.current;
        if (cam.zoom < 0.2) {
          const key = `${props.season}|${props.townVersion}|${props.landmarkPct}`;
          if (!townImage || townImage.key !== key) buildTownImage(key);
          if (townImage) ctx.drawImage(townImage.canvas, townImage.b.x, townImage.b.y, townImage.b.w, townImage.b.h);
          for (let k = 0; k < townPlots.length; k++) { const p = townPlots[k]; if (p && inView(sb[k])) lowVisible.push(p); }
        } else {
          const full = cam.zoom >= 0.45, missing: string[] = [];
          drawTownStreets(ctx, props.townLayout, env, vr, full);
          for (let k = 0; k < townPlots.length; k++) {
            const summary = townPlots[k];
            if (!summary || !inView(sb[k])) continue;
            const p = detail.get(summary.id) ?? summary;
            if (full) {
              if (p === summary) missing.push(summary.id);
              const entry = p === summary ? null : drawDetailed(townCache, k, p, s, env, t, budget);
              if (entry) detailed.push([k, entry]);
              else { if (p === summary) drawPlotLowDetail(ctx, p, env); lowVisible.push(p); }
            } else {
              drawPlotLowDetail(ctx, p, env);
              lowVisible.push(p);
            }
          }
          if (missing.length) requestCards(missing);
          square = drawTownSquare(ctx, props.townLayout, env, vr, props.landmarkPct);
        }
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (light.tint.toLowerCase() !== '#ffffff') {
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = light.tint;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';
      }
      world();
      detailed.forEach(([i, c]) => { if (c.meta) drawPlotLights(ctx, c.e, i, c.meta, t, env); });
      if (lowVisible.length) drawTownLightsLow(ctx, lowVisible, t, env, vr);
      if (view === 'street') drawTownLights(ctx, props.plots.length, t, env, ground, front);
      else drawTownLights(ctx, 0, t, env, square, { lamps: [] });

      // "LIVE" over the houses of real people
      detailed.forEach(([, c]) => {
        const pts = c.meta?.hit.house;
        if (c.e.profile.live && pts?.length) drawLiveMarker(ctx, pts, cam.zoom, t, env.reducedMotion);
      });

      // a lit mailbox: unread mail is waiting
      detailed.forEach(([, c]) => {
        const mb = c.meta?.mailbox;
        if (mb && c.e.id === P().myId && (P().mailUnread ?? 0) > 0) drawMailLight(ctx, mb, cam.zoom, t, env.reducedMotion);
      });

      // selection ring around the chosen billboard
      if (props.selectedId) {
        const hit = detailed.find(([, c]) => c.e.id === props.selectedId);
        const pts = hit?.[1].meta?.hit.sign;
        if (pts) {
          ctx.beginPath();
          pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.closePath();
          ctx.lineWidth = 3 / cam.zoom;
          ctx.strokeStyle = `rgba(240,106,155,${0.65 + 0.35 * Math.sin(t * 4)})`;
          ctx.stroke();
        }
      }

      // pins for you and your friends in the town view
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (view === 'town') {
        for (const pin of props.pins) {
          if (!props.townLayout.slots[pin.slot]) continue;
          const [wx, wy] = slotCenter(pin.slot), sx = (wx - cam.x) * cam.zoom + W / 2, sy = (wy - cam.y) * cam.zoom + H / 2;
          if (sx < -40 || sx > W + 40 || sy < -60 || sy > H + 40) continue;
          ctx.font = `700 12px ${FONTS.ui}`;
          const w = ctx.measureText(pin.label).width + 16;
          ctx.fillStyle = pin.color;
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - 6, sy - 10); ctx.lineTo(sx + 6, sy - 10); ctx.closePath(); ctx.fill();
          rrPath(ctx, sx - w / 2, sy - 32, w, 22, 11);
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.textAlign = 'center';
          ctx.fillText(pin.label, sx, sy - 17);
          ctx.textAlign = 'left';
        }
      }
      drawWeather(ctx, W, H, t, env);
    }
    raf = requestAnimationFrame(render);

    // Billboards use web fonts; redraw the caches once they arrive.
    let alive = true;
    if (document.fonts && document.fonts.load) {
      Promise.all(['800 12px "Bricolage Grotesque"', '400 12px "Alfa Slab One"', '700 12px "Fraunces"', '400 12px "Yellowtail"', '600 12px "Instrument Sans"']
        .map((f) => document.fonts.load(f).catch(() => null)))
        .then(() => { if (alive) { streetCache.clear(); townCache.clear(); townImage = null; } });
    }

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      if (needTimer) clearTimeout(needTimer);
      ro.disconnect();
      controlRef.current = null;
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', endPointer);
      canvas.removeEventListener('pointercancel', endPointer);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [controlRef]);

  // A new block (after a save or a new day) redraws the street.
  useEffect(() => { streetCacheRef.current.clear(); }, [plots]);
  // Plots whose look changed rebuild by themselves (the cache key includes it); a season change redraws all.
  useEffect(() => { townCacheRef.current.clear(); }, [season, townPlots.length]);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      <canvas
        ref={canvasRef}
        aria-label="Velvet World: a street of resident houses and billboards. Drag to look around, tap a billboard to see who lives there."
        className="block h-full w-full touch-none"
        style={{ cursor: 'grab' }}
      />
    </div>
  );
}

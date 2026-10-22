import { useRef, useEffect } from 'react';
import {
  iso, LOT_W,
  drawPlot, drawPlotLive, drawPlotLights, drawPlotLowDetail,
  drawTownGround, drawTownFront, drawTownLights,
  drawWeather, lightingAt, plotBounds, resolvePlot,
  type Plot, type Season, type Env, type View, type PlotMeta,
} from './art/streetArt';

interface WorldCanvasProps {
  plots: Plot[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  season: Season;
  hour: number;
}

interface CacheEntry {
  key: string;
  scale: number;
  b: { x: number; y: number; w: number; h: number };
  e: Plot;
  live: boolean;
  meta?: PlotMeta;
  back?: HTMLCanvasElement;
  front?: HTMLCanvasElement;
}

function cacheKey(p: Plot, season: Season): string {
  return JSON.stringify([p.member, p.config, p.profile.name, p.profile.medals, season]);
}

export function WorldCanvas({ plots, selectedId, onSelect, season, hour }: WorldCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const camRef = useRef({ x: 0, y: 0, zoom: 1.2 });
  const plotsRef = useRef(plots);
  const selectedRef = useRef(selectedId);
  const onSelectRef = useRef(onSelect);
  const seasonRef = useRef(season);
  const hourRef = useRef(hour);
  const streetCacheRef = useRef<Map<number, CacheEntry>>(new Map());
  const rafRef = useRef<number>(0);
  const flightRef = useRef<{ from: typeof camRef.current; to: typeof camRef.current; t0: number; ms: number } | null>(null);
  const zoomSettledRef = useRef(0);

  plotsRef.current = plots;
  selectedRef.current = selectedId;
  onSelectRef.current = onSelect;
  seasonRef.current = season;
  hourRef.current = hour;

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let W = 0, H = 0, dpr = 1;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const rect = container.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
    };

    const ro = new ResizeObserver(() => {
      resize();
      streetCacheRef.current.clear();
    });
    ro.observe(container);
    resize();

    const narrow = () => W < 760;

    function frameStreet() {
      const cam = camRef.current;
      cam.zoom = narrow() ? Math.max(0.55, W / 640) : Math.min(1.5, W / 1300);
      const [ax, ay] = iso(narrow() ? 43.5 : 45, 5.2, 1.2);
      cam.x = ax;
      cam.y = ay + (narrow() ? -40 : 30);
    }
    frameStreet();

    const toWorld = (sx: number, sy: number): [number, number] => {
      const cam = camRef.current;
      return [cam.x + (sx - W / 2) / cam.zoom, cam.y + (sy - H / 2) / cam.zoom];
    };

    function clampCam() {
      const cam = camRef.current;
      const n = plotsRef.current.length;
      if (n > 0) {
        const [a] = iso(-6, 12, 0);
        const [b] = iso(n * LOT_W + 6, 0, 0);
        const [, c] = iso(0, -20, 6);
        const [, d] = iso(n * LOT_W, 16, 0);
        cam.x = Math.max(a, Math.min(b, cam.x));
        cam.y = Math.max(c, Math.min(d, cam.y));
      }
    }

    function zoomAt(sx: number, sy: number, f: number) {
      const cam = camRef.current;
      const [wx, wy] = toWorld(sx, sy);
      const min = 0.3;
      cam.zoom = Math.max(min, Math.min(4, cam.zoom * f));
      cam.x = wx - (sx - W / 2) / cam.zoom;
      cam.y = wy - (sy - H / 2) / cam.zoom;
      zoomSettledRef.current = performance.now() + 220;
      clampCam();
    }

    function buildPlotCache(cache: Map<number, CacheEntry>, i: number, p: Plot, scale: number): CacheEntry {
      const b = plotBounds(i, p);
      const pxW = Math.ceil(b.w * scale);
      const pxH = Math.ceil(b.h * scale);
      const entry: CacheEntry = {
        key: cacheKey(p, seasonRef.current), scale, b, e: p, live: pxW * pxH > 7e6,
      };
      p._resolved = resolvePlot(p);
      if (!entry.live) {
        const mk = (): [HTMLCanvasElement, CanvasRenderingContext2D] => {
          const c = document.createElement('canvas');
          c.width = pxW;
          c.height = pxH;
          const o = c.getContext('2d')!;
          o.setTransform(scale, 0, 0, scale, -b.x * scale, -b.y * scale);
          return [c, o];
        };
        const env = { season: seasonRef.current } as Env;
        const [cb, ob] = mk();
        entry.meta = drawPlot(ob, p, i, 'back', env);
        entry.back = cb;
        const [cf, of] = mk();
        drawPlot(of, p, i, 'front', env);
        entry.front = cf;
      }
      cache.delete(i);
      cache.set(i, entry);
      if (cache.size > 140) cache.delete(cache.keys().next().value!);
      return entry;
    }

    function drawDetailed(
      cache: Map<number, CacheEntry>, i: number, p: Plot, scale: number,
      env: Env, t: number, budget: { left: number },
    ): CacheEntry | null {
      const c = cache.get(i);
      const fresh = c && c.key === cacheKey(p, env.season) &&
        (Math.abs(c.scale - scale) / scale < 0.02 || performance.now() < zoomSettledRef.current);
      let entry = fresh ? c : null;
      if (!entry) {
        if (budget.left <= 0 && c && c.key === cacheKey(p, env.season)) entry = c;
        else if (budget.left > 0) { budget.left--; entry = buildPlotCache(cache, i, p, scale); }
      }
      if (!entry) { drawPlotLowDetail(ctx, p, env); return null; }
      if (entry.live) {
        entry.meta = drawPlot(ctx, entry.e, i, 'back', env);
        drawPlotLive(ctx, entry.e, i, entry.meta, t, env);
        drawPlot(ctx, entry.e, i, 'front', env);
      } else {
        const b = entry.b;
        ctx.drawImage(entry.back!, b.x, b.y, b.w, b.h);
        drawPlotLive(ctx, entry.e, i, entry.meta!, t, env);
        ctx.drawImage(entry.front!, b.x, b.y, b.w, b.h);
      }
      return entry;
    }

    function inside(pts: [number, number][], x: number, y: number): boolean {
      let a = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) a = !a;
      }
      return a;
    }

    function pick(sx: number, sy: number) {
      const [x, y] = toWorld(sx, sy);
      const cache = streetCacheRef.current;
      let hit: string | null = null;
      for (const [, c] of cache) {
        if (c.meta && c.meta.hit.sign && inside(c.meta.hit.sign, x, y)) hit = c.e.id;
      }
      if (!hit) {
        for (const [, c] of cache) {
          const h = c.meta && c.meta.hit.house;
          if (!h) continue;
          const xs = h.map(p => p[0]);
          const ys = h.map(p => p[1]);
          if (x > Math.min(...xs) && x < Math.max(...xs) && y > Math.min(...ys) && y < Math.max(...ys)) hit = c.e.id;
        }
      }
      onSelectRef.current(hit);
    }

    // Pointer handlers
    const pointers = new Map<number, [number, number]>();
    let drag: { x: number; y: number; cx: number; cy: number; moved: number } | null = null;
    let pinch: { d: number; z: number } | null = null;

    const onPointerDown = (e: PointerEvent) => {
      flightRef.current = null;
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, [e.clientX, e.clientY]);
      if (pointers.size === 1) {
        const cam = camRef.current;
        drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: 0 };
      }
      if (pointers.size === 2) {
        const [p, q] = [...pointers.values()];
        pinch = { d: Math.hypot(p[0] - q[0], p[1] - q[1]), z: camRef.current.zoom };
        drag = null;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, [e.clientX, e.clientY]);
      if (pinch && pointers.size === 2) {
        const [p, q] = [...pointers.values()];
        const d = Math.hypot(p[0] - q[0], p[1] - q[1]);
        zoomAt((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (pinch.z * (d / pinch.d)) / camRef.current.zoom);
        return;
      }
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
      const cam = camRef.current;
      cam.x = drag.cx - dx / cam.zoom;
      cam.y = drag.cy - dy / cam.zoom;
      clampCam();
    };

    const endPointer = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (drag && drag.moved < 6 && e.type === 'pointerup') {
        const rect = canvas.getBoundingClientRect();
        pick(e.clientX - rect.left, e.clientY - rect.top);
      }
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 0) drag = null;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      flightRef.current = null;
      const rect = canvas.getBoundingClientRect();
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.0015));
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    // Render loop
    const t0 = performance.now();

    function render(now: number) {
      rafRef.current = requestAnimationFrame(render);

      const flight = flightRef.current;
      if (flight) {
        const u = Math.min(1, (now - flight.t0) / flight.ms);
        const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        const cam = camRef.current;
        cam.x = flight.from.x + (flight.to.x - flight.from.x) * e;
        cam.y = flight.from.y + (flight.to.y - flight.from.y) * e;
        cam.zoom = Math.exp(Math.log(flight.from.zoom) + (Math.log(flight.to.zoom) - Math.log(flight.from.zoom)) * e);
        if (u >= 1) flightRef.current = null;
        zoomSettledRef.current = now + 220;
      }

      const t = (now - t0) / 1000;
      const s_season = seasonRef.current;
      const s_hour = hourRef.current;
      const light = lightingAt(s_hour, s_season);
      const env: Env = {
        season: s_season,
        hour: s_hour,
        night: light.night,
        reducedMotion: reduceMotion.matches,
        zoom: camRef.current.zoom,
      };
      const cam = camRef.current;
      const s = cam.zoom * dpr;
      const view: View = {
        x0: cam.x - W / 2 / cam.zoom, x1: cam.x + W / 2 / cam.zoom,
        y0: cam.y - H / 2 / cam.zoom, y1: cam.y + H / 2 / cam.zoom,
      };
      const inView = (b: { x: number; y: number; w: number; h: number }) =>
        !(b.x > view.x1 || b.x + b.w < view.x0 || b.y > view.y1 || b.y + b.h < view.y0);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = s_season === 'winter' ? '#D9E0E6' : '#9DAE97';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const world = () => ctx.setTransform(s, 0, 0, s, (W * dpr) / 2 - cam.x * s, (H * dpr) / 2 - cam.y * s);
      world();

      const streetPlots = plotsRef.current;
      const budget = { left: 5 };
      const detailed: [number, CacheEntry][] = [];

      const ground = drawTownGround(ctx, streetPlots.length, env, view, 62);
      streetPlots.forEach((p, i) => {
        const b = plotBounds(i, p);
        if (!inView(b)) return;
        const entry = drawDetailed(streetCacheRef.current, i, p, s, env, t, budget);
        if (entry) detailed.push([i, entry]);
      });
      const front = drawTownFront(ctx, streetPlots.length, env, view);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (light.tint.toLowerCase() !== '#ffffff') {
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = light.tint;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'source-over';
      }
      world();

      detailed.forEach(([i, c]) => drawPlotLights(ctx, c.e, i, c.meta!, t, env));
      drawTownLights(ctx, streetPlots.length, t, env, ground, front);

      // Selection ring
      const sel = selectedRef.current;
      if (sel) {
        const hit = detailed.find(([, c]) => c.e.id === sel);
        if (hit && hit[1].meta && hit[1].meta.hit.sign) {
          const pts = hit[1].meta.hit.sign;
          ctx.beginPath();
          pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.closePath();
          ctx.lineWidth = 3 / cam.zoom;
          ctx.strokeStyle = `rgba(240,106,155,${0.65 + 0.35 * Math.sin(t * 4)})`;
          ctx.stroke();
        }
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawWeather(ctx, W, H, t, env);
    }

    rafRef.current = requestAnimationFrame(render);

    // Font load → rebuild caches
    if (document.fonts && document.fonts.load) {
      Promise.all([
        '800 12px "Bricolage Grotesque"',
        '400 12px "Alfa Slab One"',
        '700 12px "Fraunces"',
        '400 12px "Yellowtail"',
        '600 12px "Instrument Sans"',
      ].map(f => document.fonts.load(f).catch(() => null))).then(() => {
        streetCacheRef.current.clear();
      });
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', endPointer);
      canvas.removeEventListener('pointercancel', endPointer);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, []);

  // Invalidate cache when plots change
  useEffect(() => {
    streetCacheRef.current.clear();
  }, [plots]);

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

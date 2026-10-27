import {
  iso, TW, TH, ZH, LOT_W, STREET, STREET_NAME, FONTS, shade,
  drawPlot, drawPlotLive, drawTownGround, drawTownFront, lightingAt, plotBounds,
  type Plot, type PlotConfig, type PlotMeta, type Season, type Env,
} from '../../../features/velvet-world/art/streetArt.js';

/**
 * The drive-up that opens a new game: Dez pulls up to the player's own house, the one they built in town, drawn by the
 * same street kit the town uses. Plain canvas on top of the game; it ends by fading away to the house inside, and
 * the move-in script carries on from there.
 */
export interface ArrivalPlot { member: boolean; config: PlotConfig; earned?: string[]; address?: string }
export interface Arrival { done(): boolean; cancel(): void }

const HOUSE = 1; // the player's lot on the little street: a neighbour either side
const FADE_IN = 0.7, DRIVE_FROM = 0.5, DRIVE_TIME = 4.2, HOLD_UNTIL = 6.3, FADE_OUT = 0.9;
const LANE_Y = (STREET.road0 + STREET.road1) / 2 + 0.55;
const START_X = -3.2, STOP_X = LOT_W + 4.4;
const SEASONS: Season[] = ['spring', 'summer', 'fall', 'winter'];
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

type Pt = [number, number];

function poly(ctx: CanvasRenderingContext2D, pts: Pt[], fill: string): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** A solid box in street units: the top, the face toward the street and the face toward the front of the truck. */
function box(ctx: CanvasRenderingContext2D, x: number, y: number, z: number, w: number, d: number, h: number, col: string): void {
  const P = (px: number, py: number, pz: number): Pt => iso(px, py, pz);
  poly(ctx, [P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)], shade(col, -0.1));
  poly(ctx, [P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)], shade(col, -0.24));
  poly(ctx, [P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)], shade(col, 0.08));
}

/** Draws in the plane of the street-facing side at y: local x runs along the truck, local y runs down. */
function onSide(ctx: CanvasRenderingContext2D, y: number, draw: () => void): void {
  const [ox, oy] = iso(0, y, 0);
  ctx.save();
  ctx.transform(TW, TH, 0, ZH, ox, oy);
  draw();
  ctx.restore();
}

/** Dez's moving truck: rear of the box at x, driving toward +x. */
function drawTruck(ctx: CanvasRenderingContext2D, x: number, moving: number, t: number): void {
  const y = LANE_Y, bob = moving * Math.abs(Math.sin(t * 9)) * 0.025, z = 0.34 + bob;
  const shadow: Pt[] = [iso(x - 0.2, y - 0.1, 0), iso(x + 4.3, y - 0.1, 0), iso(x + 4.3, y + 1.95, 0), iso(x - 0.2, y + 1.95, 0)];
  poly(ctx, shadow, 'rgba(0,0,0,.2)');
  box(ctx, x, y + 0.05, z - 0.12, 4.05, 1.62, 0.2, '#2B2B30');
  box(ctx, x, y, z + 0.05, 2.75, 1.72, 1.95, '#F2EEE8');
  box(ctx, x + 2.78, y + 0.06, z + 0.05, 1.28, 1.6, 1.2, '#C2413A');
  box(ctx, x + 2.78, y + 0.06, z + 1.2, 0.7, 1.6, 0.05, '#A8332C');
  // The windscreen, on the face toward the front of the truck.
  poly(ctx, [iso(x + 4.06, y + 0.2, z + 0.72), iso(x + 4.06, y + 1.5, z + 0.72), iso(x + 4.06, y + 1.5, z + 1.1), iso(x + 4.06, y + 0.2, z + 1.1)], '#A9D0E0');
  poly(ctx, [iso(x + 4.06, y + 0.25, z + 0.3), iso(x + 4.06, y + 0.5, z + 0.3), iso(x + 4.06, y + 0.5, z + 0.42), iso(x + 4.06, y + 0.25, z + 0.42)], '#FFE9A8');
  poly(ctx, [iso(x + 4.06, y + 1.2, z + 0.3), iso(x + 4.06, y + 1.45, z + 0.3), iso(x + 4.06, y + 1.45, z + 0.42), iso(x + 4.06, y + 1.2, z + 0.42)], '#FFE9A8');
  onSide(ctx, y + 1.72, () => {
    // Lettering, a stripe, the cab window and the wheels.
    ctx.fillStyle = '#C2413A';
    ctx.fillRect(x, -(z + 0.55), 2.75, 0.14);
    ctx.fillStyle = '#2B2B30';
    ctx.font = '700 0.3px ' + FONTS.display;
    ctx.textAlign = 'center';
    ctx.fillText('DUPREE MOVING', x + 1.37, -(z + 1.1));
    ctx.font = '600 0.17px ' + FONTS.ui;
    ctx.fillText('& Mayor’s Office', x + 1.37, -(z + 0.82));
    ctx.fillStyle = '#A9D0E0';
    ctx.fillRect(x + 3.2, -(z + 1.05), 0.7, 0.42);
    for (const wx of [x + 0.75, x + 3.2]) {
      ctx.fillStyle = '#1B1B1F'; ctx.beginPath(); ctx.arc(wx, -(z - 0.02), 0.36, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#9AA3A8'; ctx.beginPath(); ctx.arc(wx, -(z - 0.02), 0.17, 0, Math.PI * 2); ctx.fill();
    }
  });
}

function plotOf(id: string, mine: ArrivalPlot | null): Plot {
  return {
    id, member: !!mine?.member, origin: null,
    config: mine?.config ?? {},
    profile: { name: '', earned: mine?.earned ?? [], address: mine?.address },
  };
}

export function playArrival(
  stage: Element,
  opts: { plot: ArrivalPlot | null; season: string; town: string; reducedMotion: boolean; onDone?: () => void },
): Arrival {
  const root = document.createElement('div');
  root.className = 'vh-arrival';
  root.style.cssText = 'position:absolute;inset:0;z-index:27;background:#14121A;overflow:hidden;touch-action:none;cursor:pointer';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
  const caption = document.createElement('div');
  caption.style.cssText = 'position:absolute;left:0;right:0;top:15%;text-align:center;color:#FFF8EC;font:600 13px/1.3 Inter,system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;text-shadow:0 2px 14px rgba(0,0,0,.55);opacity:0;pointer-events:none;padding:0 16px';
  const street = [opts.plot?.address, STREET_NAME].filter(Boolean).join(' ');
  const townEl = document.createElement('div');
  townEl.style.cssText = `font:700 26px/1.1 ${FONTS.display};letter-spacing:.02em;text-transform:none;margin-bottom:6px`;
  townEl.textContent = opts.town;
  const streetEl = document.createElement('div');
  streetEl.textContent = street;
  caption.append(townEl, streetEl);
  root.append(canvas, caption);
  stage.appendChild(root);

  const season = (SEASONS as string[]).includes(opts.season.toLowerCase()) ? (opts.season.toLowerCase() as Season) : 'spring';
  const light = lightingAt(9.2, season);
  const env: Env = { season, hour: 9.2, night: 0, reducedMotion: opts.reducedMotion, zoom: 1 };
  const plots: Plot[] = [plotOf('arrival-left', null), plotOf('arrival-you', opts.plot), plotOf('arrival-right', null)];
  plots[HOUSE].profile.live = false;

  // The still part of the street is drawn once into an image; only the truck, the smoke and the flag move.
  const rb = plotBounds(HOUSE, plots[HOUSE]);
  const rx0 = iso(-6, 15)[0], rx1 = iso(2 * LOT_W + 8, -1)[0];
  const region = { x: Math.floor(rx0), y: Math.floor(rb.y - 20), w: Math.ceil(rx1 - rx0), h: 0 };
  region.h = Math.ceil(iso(2 * LOT_W + 8, 15.5)[1] - region.y);
  let still: HTMLCanvasElement | null = null, meta: PlotMeta | null = null, stillScale = 0;

  function build(scale: number): void {
    stillScale = Math.min(scale, 3200 / region.w);
    still = document.createElement('canvas');
    still.width = Math.ceil(region.w * stillScale); still.height = Math.ceil(region.h * stillScale);
    const c = still.getContext('2d')!;
    c.setTransform(stillScale, 0, 0, stillScale, -region.x * stillScale, -region.y * stillScale);
    c.fillStyle = season === 'winter' ? '#D9E0E6' : '#9DAE97';
    c.fillRect(region.x, region.y, region.w, region.h);
    const view = { x0: region.x, y0: region.y, x1: region.x + region.w, y1: region.y + region.h };
    drawTownGround(c, plots.length, env, view, 0);
    plots.forEach((p, i) => {
      const m = drawPlot(c, p, i, 'back', env);
      if (i === HOUSE) meta = m;
      drawPlot(c, p, i, 'front', env);
    });
    drawTownFront(c, plots.length, env, view);
  }

  let finished = false, t = 0, last = performance.now(), raf = 0;
  const reduced = opts.reducedMotion;
  const total = reduced ? 2.2 : HOLD_UNTIL + FADE_OUT;
  const xAt = (time: number): number => {
    const u = clamp01((time - DRIVE_FROM) / DRIVE_TIME);
    return START_X + (STOP_X - START_X) * (1 - Math.pow(1 - u, 2.4));
  };
  const finish = (): void => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    root.remove();
    opts.onDone?.();
  };
  // The drive-up plays to its end: a story animation is never skipped.

  function frame(now: number): void {
    if (finished) return;
    const dt = Math.min(0.25, (now - last) / 1000); last = now; t += dt;
    if (t >= total) { finish(); return; }
    const W = Math.max(1, root.clientWidth), H = Math.max(1, root.clientHeight), dpr = Math.min(window.devicePixelRatio || 1, 3);
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    const vs = Math.min(W / (rb.w * 0.82), H / (rb.h * 1.25));
    if (!still) build(vs * dpr);
    const ctx = canvas.getContext('2d')!;
    const driving = reduced ? 1 : clamp01((t - DRIVE_FROM) / DRIVE_TIME);
    const tx = reduced ? STOP_X : xAt(t), moving = driving > 0 && driving < 1 ? 1 - driving * 0.6 : 0;
    // The camera starts back toward the truck and settles on the house as it arrives; at the end it leans in.
    const house = iso(HOUSE * LOT_W + LOT_W * 0.5, 4.5, 1.4), truck = iso(tx + 2, LANE_Y, 1);
    const lean = reduced ? 0 : clamp01((t - HOLD_UNTIL) / FADE_OUT);
    const z = 1 + 0.18 * lean * lean;
    const follow = 0.5 * (1 - Math.pow(driving, 1.5));
    let cx = house[0] + (truck[0] - house[0]) * follow;
    const cy = house[1] + (truck[1] - house[1]) * follow + rb.h * 0.06;
    const half = W / (2 * vs * z);
    cx = region.w <= half * 2 ? region.x + region.w / 2 : Math.max(region.x + half, Math.min(region.x + region.w - half, cx));
    const s = vs * z * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#14121A'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(s, 0, 0, s, canvas.width / 2 - cx * s, canvas.height / 2 - cy * s);
    // Only the part of the street on screen is copied over: the whole image is far bigger than the screen.
    const vx0 = Math.max(region.x, cx - canvas.width / (2 * s)), vx1 = Math.min(region.x + region.w, cx + canvas.width / (2 * s));
    const vy0 = Math.max(region.y, cy - canvas.height / (2 * s)), vy1 = Math.min(region.y + region.h, cy + canvas.height / (2 * s));
    if (vx1 > vx0 && vy1 > vy0) ctx.drawImage(still!, (vx0 - region.x) * stillScale, (vy0 - region.y) * stillScale, (vx1 - vx0) * stillScale, (vy1 - vy0) * stillScale, vx0, vy0, vx1 - vx0, vy1 - vy0);
    if (meta) drawPlotLive(ctx, plots[HOUSE], HOUSE, meta, t, env);
    if (!reduced && driving < 1.12) {
      // Exhaust puffs where the truck has been.
      for (let k = 1; k <= 7; k++) {
        const age = k * 0.16, px = xAt(Math.max(0, t - age)) - 0.15, a = 0.28 * (1 - k / 8) * (driving > 0 ? 1 : 0);
        const [ex, ey] = iso(px, LANE_Y + 0.35, 0.5 + age * 0.9);
        ctx.fillStyle = `rgba(235,235,235,${a})`; ctx.beginPath(); ctx.arc(ex, ey, 3 + k * 1.1, 0, Math.PI * 2); ctx.fill();
      }
    }
    drawTruck(ctx, tx, moving, t);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (light.tint.toLowerCase() !== '#ffffff') {
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = light.tint; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.globalCompositeOperation = 'source-over';
    }
    // Fade up from black at the start; the whole picture fades away at the end, to the house inside.
    const up = 1 - clamp01(t / FADE_IN);
    if (up > 0) { ctx.fillStyle = `rgba(20,18,26,${up})`; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    caption.style.opacity = String(reduced ? 1 : clamp01((t - 1.0) / 0.8) * (1 - clamp01((t - (HOLD_UNTIL - 0.6)) / 0.6)));
    root.style.opacity = String(1 - clamp01((t - (total - FADE_OUT)) / FADE_OUT));
    root.style.background = 'transparent';
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  return { done: () => finished, cancel: finish };
}

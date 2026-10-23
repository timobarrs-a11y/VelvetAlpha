import { drawPlot, iso, type Plot, type HouseStyle, type Env } from './art/streetArt';

const TILE_ENV: Env = { season: 'summer', hour: 12, night: 0, reducedMotion: true };

/** How each earned house is unlocked, in the words a new person would understand. */
export const EARN_HINT: Record<string, string> = {
  'hat-trick': 'Complete 3 goals',
  'the-closer': 'Complete 10 goals',
  'iron-will': 'Check in 30 days in a row',
  coachable: 'Finish 10 things your coach sets',
  unbreakable: 'Check in 100 days in a row',
};


/** Draws just the house (not the whole lot) into a small canvas. */
export function drawHouseTile(canvas: HTMLCanvasElement, plot: Plot, pad = 6) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  // the part of the lot a house can occupy, tallest houses included
  const pts = [[0.8, 0.6, 0], [7.2, 0.6, 0], [7.2, 5.6, 0], [0.8, 5.6, 0], [0.8, 0.6, 6.6], [7.2, 0.6, 6.6], [7.2, 5.6, 6.6]].map(([x, y, z]) => iso(x, y, z));
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const bx = Math.min(...xs), by = Math.min(...ys), bw = Math.max(...xs) - bx, bh = Math.max(...ys) - by;
  const sc = Math.min((canvas.width - pad * 2) / bw, (canvas.height - pad * 2) / bh);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(sc, 0, 0, sc, (canvas.width - bw * sc) / 2 - bx * sc, (canvas.height - bh * sc) / 2 - by * sc);
  const p = { ...plot, _resolved: null };
  drawPlot(ctx, p, 0, 'back', TILE_ENV);
  drawPlot(ctx, p, 0, 'front', TILE_ENV);
}

export function tilePlot(style: HouseStyle, colors: { body?: string; roof?: string; door?: string } = {}, member = false, earned: string[] = []): Plot {
  return { id: `tile-${style}`, number: 2, member, origin: null, config: { house: { style, ...colors }, sign: {} }, profile: { name: '', earned } };
}

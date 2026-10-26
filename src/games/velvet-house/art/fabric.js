/* eslint-disable */
// Draws a garment recipe (state/garment.ts) on the body. Each limb segment is painted in its own frame, so stripes
// turn with the arm and plaid bends at the elbow. Pattern tiles are drawn once and kept.
import { patternOps, textureOps } from '../state/fabricTile';

const TILE = 64;
const SHEEN = new Set(['satin', 'leather']);

export function createFabric(makeCanvas = () => document.createElement('canvas')) {
  const tiles = new Map();

  function raster(key, ops) {
    let c = tiles.get(key);
    if (c) return c;
    c = makeCanvas(); c.width = TILE; c.height = TILE;
    const x = c.getContext('2d');
    if (!x) return c;
    const draw = (op, dx, dy) => {
      x.globalAlpha = op.a ?? 1;
      x.fillStyle = x.strokeStyle = op.c;
      if (op.k === 'rect') x.fillRect((op.x + dx) * TILE, (op.y + dy) * TILE, op.w * TILE, op.h * TILE);
      else if (op.k === 'circle') { x.beginPath(); x.arc((op.x + dx) * TILE, (op.y + dy) * TILE, op.r * TILE, 0, 7); x.fill(); }
      else if (op.k === 'ring') { x.lineWidth = op.lw * TILE; x.beginPath(); x.arc((op.x + dx) * TILE, (op.y + dy) * TILE, op.r * TILE, 0, 7); x.stroke(); }
      else if (op.k === 'poly') { x.beginPath(); op.pts.forEach((p, i) => (i ? x.lineTo((p[0] + dx) * TILE, (p[1] + dy) * TILE) : x.moveTo((p[0] + dx) * TILE, (p[1] + dy) * TILE))); x.closePath(); x.fill(); }
      else if (op.k === 'line') { x.lineWidth = op.lw * TILE; x.lineCap = 'butt'; x.beginPath(); x.moveTo((op.x1 + dx) * TILE, (op.y1 + dy) * TILE); x.lineTo((op.x2 + dx) * TILE, (op.y2 + dy) * TILE); x.stroke(); }
    };
    // Lines can sit on an edge, so they are drawn at the places around the tile too.
    ops.forEach((op) => { if (op.k === 'line') { for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) draw(op, dx, dy); } else draw(op, 0, 0); });
    x.globalAlpha = 1;
    tiles.set(key, c);
    return c;
  }

  const patternKey = (p) => `${p.kind}|${p.colors.join(',')}|${p.density ?? 0.5}|${p.seed}`;
  const patternTile = (p) => raster('p:' + patternKey(p), patternOps(p));
  const textureTile = (f, wash) => raster(`t:${f}:${f === 'denim' ? Math.round(wash * 10) : 0}`, textureOps(f, wash));

  /** Fills the current clip with a pattern in the current (rotated) frame. */
  function fillPattern(ctx, p, bounds, offset) {
    const pat = ctx.createPattern(patternTile(p), 'repeat');
    if (!pat || !pat.setTransform) return;
    const unit = (p.kind === 'graphic' ? 30 : 10) * p.scale;
    const a = (p.angle * Math.PI) / 180, k = unit / TILE;
    pat.setTransform(new DOMMatrix([Math.cos(a) * k, Math.sin(a) * k, -Math.sin(a) * k, Math.cos(a) * k, offset[0], offset[1]]));
    ctx.fillStyle = pat;
    ctx.fillRect(bounds[0], bounds[1], bounds[2], bounds[3]);
  }

  function fillTexture(ctx, g, bounds) {
    if (g.fabric === 'cotton') return;
    const t = textureTile(g.fabric, g.details?.wash ?? 0.5);
    const pat = ctx.createPattern(t, 'repeat');
    if (!pat || !pat.setTransform) return;
    pat.setTransform(new DOMMatrix([6 / TILE, 0, 0, 6 / TILE, 0, 0]));
    ctx.fillStyle = pat;
    ctx.fillRect(bounds[0], bounds[1], bounds[2], bounds[3]);
  }

  /** Pattern, cloth texture and any fading, for whatever is clipped right now. */
  function fill(ctx, g, bounds, offset = [0, 0]) {
    if (g.pattern) {
      fillPattern(ctx, g.pattern, bounds, offset);
      if (g.pattern.layer2) fillPattern(ctx, g.pattern.layer2, bounds, [offset[0] + 3, offset[1] + 5]);
    }
    fillTexture(ctx, g, bounds);
    if (g.fabric === 'denim' && g.details?.wash) {
      ctx.fillStyle = `rgba(255,255,255,${0.04 + g.details.wash * 0.16})`;
      ctx.fillRect(bounds[0], bounds[1], bounds[2], bounds[3]);
    }
  }

  /**
   * Paints a garment over limb segments already drawn in the cloth's base colour: `pts` is two points (one segment) or
   * three (two, bending at the middle one), `w` the limb's width. opts: front (facing us), torso, hem (the end of a leg).
   */
  function paint(ctx, pts, w, g, opts = {}) {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.5) continue;
      const h = w / 2, ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      ctx.save();
      ctx.translate(a[0], a[1]); ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(0, -h); ctx.lineTo(len, -h); ctx.arc(len, 0, h, -Math.PI / 2, Math.PI / 2); ctx.lineTo(0, h); ctx.arc(0, 0, h, Math.PI / 2, Math.PI * 1.5); ctx.closePath();
      ctx.clip();
      const bounds = [-h, -h, len + w, w];
      fill(ctx, g, bounds, [i * 7.3, opts.torso ? 0 : i * 3.1]);
      if (SHEEN.has(g.fabric)) {
        const gr = ctx.createLinearGradient(0, -h, 0, h);
        gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.3, `rgba(255,255,255,${g.fabric === 'satin' ? 0.34 : 0.26})`); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,.12)');
        ctx.fillStyle = gr; ctx.fillRect(bounds[0], bounds[1], bounds[2], bounds[3]);
      }
      const d = g.details;
      if (g.fabric === 'denim' && opts.hem !== undefined) {
        // Seam stitching down the leg, and fading at the thigh and knee.
        ctx.strokeStyle = 'rgba(232,190,120,.55)'; ctx.lineWidth = 0.5; ctx.setLineDash([1.6, 1.2]);
        ctx.beginPath(); ctx.moveTo(0, h - 0.9); ctx.lineTo(len, h - 0.9); ctx.stroke(); ctx.setLineDash([]);
        if (d?.wash) { ctx.fillStyle = `rgba(255,255,255,${d.wash * 0.18})`; ctx.beginPath(); ctx.ellipse(len * 0.45, 0, len * 0.3, h * 0.9, 0, 0, 7); ctx.fill(); }
      }
      if (d?.distress && (opts.hem !== undefined || opts.torso)) {
        // Rips: a few pale slashes across the cloth, placed the same way every time.
        const n = Math.round(d.distress * 4);
        ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 0.9;
        for (let k = 0; k < n; k++) { const x = len * (0.2 + ((k * 0.37 + i * 0.21) % 0.6)); ctx.beginPath(); ctx.moveTo(x, -h * 0.5); ctx.lineTo(x + 1.6, h * 0.4); ctx.stroke(); }
      }
      if (d?.cuffs && opts.hem === i && opts.hemEnd) {
        ctx.fillStyle = d.cuffs === 'rolled' ? 'rgba(255,255,255,.28)' : 'rgba(255,255,255,.55)';
        ctx.fillRect(len - 2.6, -h, 2.6 + h, w);
      }
      if (opts.torso && opts.front) {
        if (d?.buttons) { ctx.fillStyle = 'rgba(245,240,230,.9)'; for (let k = 1; k <= 4; k++) { ctx.beginPath(); ctx.arc(len * (k / 5), 0, 0.7, 0, 7); ctx.fill(); } }
        if (d?.pocket) { ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 0.7; ctx.strokeRect(len * 0.58, h * 0.15, 3.4, 3.4); }
      }
      ctx.restore();
    }
  }

  return { paint, fill, patternTile };
}

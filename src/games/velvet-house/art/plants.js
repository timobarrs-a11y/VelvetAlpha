// Plants: leaves with a midrib and a shaded half, pots with a rim and a mound of soil, and a different silhouette for
// each plant (a leafy houseplant, a fern, a cactus, a fiddle-leaf fig, a snake plant and a palm). Everything is drawn
// from a few curves, nothing is an image. Each foliage function draws in screen space from the soil's centre (sx, sy).
//
// `h` is the host's drawing set: { ctx, ell, circle, limb, rr, shade }. `seed` is a small number from the piece's id
// so two plants of one kind are not copies of each other.

const TAU = Math.PI * 2;
const GREENS = { deep: '#2A6139', dark: '#2F6B40', mid: '#3F7D4E', leaf: '#4F9460', light: '#5BA36C', pale: '#7DBF86' };

/** A small number 0..1 from a string, the same every time. */
export function seedOf(id) {
  let n = 7;
  for (const ch of String(id || '')) n = (n * 31 + ch.charCodeAt(0)) % 9973;
  return n / 9973;
}

/**
 * One leaf: a pointed blade from (x, y) along `ang` for `len`, `wid` wide at the belly, drooping by `droop`. The half
 * below the midrib is a shade darker, the midrib is a pale line and the edge a thin dark one, so it reads as a leaf
 * with a top and an underside rather than a flat dab.
 */
export function blade(h, x, y, ang, len, wid, col, droop = 0) {
  const { ctx, shade } = h;
  const ca = Math.cos(ang), sa = Math.sin(ang), nx = -sa, ny = ca;
  const tx = x + ca * len, ty = y + sa * len + droop * len * 0.3;
  const p = (f, w) => [x + ca * len * f + nx * wid * w, y + sa * len * f + ny * wid * w + droop * len * 0.3 * f * f];
  const a1 = p(0.18, 1.2), a2 = p(0.72, 1.0), b1 = p(0.18, -1.2), b2 = p(0.72, -1.0);
  ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(a1[0], a1[1], a2[0], a2[1], tx, ty); ctx.bezierCurveTo(b2[0], b2[1], b1[0], b1[1], x, y); ctx.closePath();
  ctx.fillStyle = col; ctx.fill();
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(tx, ty); ctx.bezierCurveTo(b2[0], b2[1], b1[0], b1[1], x, y); ctx.closePath();
  ctx.fillStyle = shade(col, -0.2); ctx.fill();
  ctx.strokeStyle = 'rgba(25,55,35,.35)'; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(a1[0], a1[1], a2[0], a2[1], tx, ty); ctx.bezierCurveTo(b2[0], b2[1], b1[0], b1[1], x, y); ctx.stroke();
  ctx.strokeStyle = shade(col, 0.3); ctx.globalAlpha = 0.7; ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + ca * len * 0.92, y + sa * len * 0.92 + droop * len * 0.27); ctx.stroke(); ctx.globalAlpha = 1;
}

/** Soil seen from above the rim: a dark mound with a few crumbs and a lit edge. */
function soil(h, sx, sy, rx) {
  const { ell, circle } = h;
  ell(sx, sy + 0.6, rx, rx * 0.45, '#2E2018');
  ell(sx, sy, rx * 0.88, rx * 0.36, '#4A3426');
  [[-0.4, 0.05], [0.2, -0.1], [0.45, 0.08], [-0.1, 0.12]].forEach(([dx, dy]) => circle(sx + dx * rx, sy + dy * rx * 0.4, 0.7, '#6B4E3A'));
}

/**
 * A pot in the piece's local frame (width w, height ph): a tapered body, a wider rim with a lit top edge, a darker band
 * under it, and the soil. Returns the soil's centre on screen.
 */
export function pot(h, T, col, w = 0.4, ph = 0.4, x0 = 0.05, y0 = 0.05) {
  const { shade, ell } = h, cx = x0 + w / 2, cy = y0 + w / 2, inset = 0.045;
  T.box(x0 + inset, y0 + inset, 0, w - inset * 2, w - inset * 2, ph * 0.55, shade(col, -0.1));
  T.box(x0 + inset * 0.4, y0 + inset * 0.4, ph * 0.55, w - inset * 0.8, w - inset * 0.8, ph * 0.3, col);
  T.box(x0, y0, ph * 0.85, w, w, ph * 0.15, shade(col, 0.08));
  T.line([x0, y0 + w + 0.001, ph * 0.85], [x0 + w, y0 + w + 0.001, ph * 0.85], 'rgba(0,0,0,.2)', 1);
  T.line([x0 + 0.01, y0 + w + 0.001, ph * 0.99], [x0 + w - 0.01, y0 + w + 0.001, ph * 0.99], 'rgba(255,255,255,.3)', 1);
  const [sx, sy] = T.P(cx, cy, ph + 0.005);
  soil(h, sx, sy, w * 28);
  return [sx, sy];
}

// ---- The leafy houseplant: broad glossy leaves on arching stems ----
function houseplant(h, sx, sy, t, seed = 0) {
  const { ctx } = h;
  // [angle from straight up (deg), stem length, blade length, blade width, tone, droop]
  const L = [[-72, 7, 19, 8, 0, 0.9], [70, 7, 19, 8, 1, 0.9], [-50, 11, 22, 9, 1, 0.6], [46, 12, 22, 9, 0, 0.6], [-28, 16, 24, 9, 2, 0.35], [24, 17, 24, 9.5, 3, 0.35], [-8, 21, 25, 9.5, 2, 0.1], [10, 24, 24, 9, 4, 0.1], [-38, 8, 18, 8, 3, 0.7], [34, 9, 18, 8, 2, 0.7]];
  const tones = [GREENS.dark, GREENS.mid, GREENS.leaf, GREENS.light, GREENS.pale];
  // The ones at the back are drawn first (the longer stems), so the near ones overlap them.
  L.map((q, i) => ({ q, i })).sort((a, b) => b.q[1] - a.q[1]).forEach(({ q, i }) => {
    const [deg, stem, len, wid, tone, droop] = q, jit = (((seed * 97 + i * 13) % 1) - 0.5) * 0.18;
    const sway = Math.sin(t * 0.8 + i * 0.9 + seed * 6) * 0.045, a = (deg * Math.PI) / 180 + jit + sway;
    const bx = sx + Math.sin(a) * stem, by = sy - Math.cos(a) * stem * 1.15;
    ctx.strokeStyle = GREENS.deep; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(bx, by); ctx.stroke();
    // The blade carries on up and outward from the stem's end, bending over with its weight.
    blade(h, bx, by, a - Math.PI / 2 + (deg < 0 ? -0.1 : 0.1), len, wid, tones[tone % 5], droop);
  });
}

// ---- A fern: arching fronds, each a curve with paired leaflets that shorten toward the tip ----
function frond(h, x, y, ang, len, curl, col, leaflet, pairs) {
  const { ctx } = h;
  const pt = (u) => { const a = ang + curl * u; return [x + Math.cos(ang) * len * u + Math.cos(Math.PI / 2 + ang) * curl * len * u * u * 0.5, y + Math.sin(ang) * len * u + Math.sin(Math.PI / 2 + ang) * curl * len * u * u * 0.5 + len * 0.22 * u * u, a]; };
  ctx.strokeStyle = h.shade(col, -0.25); ctx.lineWidth = 1.1; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y); for (let k = 1; k <= 12; k++) { const [px, py] = pt(k / 12); ctx.lineTo(px, py); } ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = 1.9;
  for (let k = 1; k <= pairs; k++) {
    const u = 0.18 + (k / pairs) * 0.8, [px, py] = pt(u), [qx, qy] = pt(Math.min(1, u + 0.04)), ta = Math.atan2(qy - py, qx - px), ll = leaflet * (1 - u * 0.65);
    [-1, 1].forEach((s) => { const a = ta + s * 1.05; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(a) * ll, py + Math.sin(a) * ll + ll * 0.2); ctx.stroke(); });
  }
}
function fern(h, sx, sy, t, seed = 0) {
  const F = [[-170, 30, -0.5, 0], [-150, 36, -0.4, 1], [-125, 36, -0.25, 0], [-100, 32, -0.1, 2], [-80, 30, 0.1, 1], [-55, 36, 0.25, 0], [-30, 36, 0.4, 2], [-8, 30, 0.5, 1]];
  const tones = [GREENS.leaf, GREENS.mid, GREENS.light];
  F.forEach(([deg, len, curl, tone], i) => frond(h, sx, sy, (deg * Math.PI) / 180 + Math.sin(t * 0.7 + i + seed * 5) * 0.035, len, curl, tones[tone], 6.2, 8));
}

// ---- A palm: tall arching fronds with long leaflets, off a short trunk ----
function palm(h, sx, sy, t, seed = 0) {
  const { ctx } = h;
  ctx.strokeStyle = '#6B4A35'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + 2, sy - 14, sx + 1, sy - 28); ctx.stroke();
  [[-155, 38, -0.6, 0], [-125, 42, -0.4, 1], [-95, 40, -0.15, 0], [-65, 42, 0.15, 1], [-35, 40, 0.4, 0], [-8, 38, 0.6, 1]].forEach(([deg, len, curl, tone], i) =>
    frond(h, sx + 1, sy - 27, (deg * Math.PI) / 180 + Math.sin(t * 0.6 + i + seed * 4) * 0.03, len, curl, tone ? GREENS.leaf : GREENS.mid, 8.5, 9));
}

// ---- A fiddle-leaf fig: a woody stem with big violin-shaped leaves in a spiral ----
function fiddle(h, sx, sy, t, seed = 0) {
  const { ctx } = h;
  ctx.strokeStyle = '#6B4A35'; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx - 2, sy - 28, sx + 1, sy - 56); ctx.stroke();
  const L = [[-10, 0.16, -1], [9, 0.3, 1], [-9, 0.42, -1], [10, 0.54, 1], [-8, 0.66, -1], [9, 0.78, 1], [-6, 0.9, -1], [0, 1, 0]];
  L.forEach(([off, f, side], i) => {
    const y = sy - 56 * f, x = sx + (f - 0.5) * 2 + Math.sin(f * 3) * -1.5, a = side === 0 ? -Math.PI / 2 : side < 0 ? -Math.PI + 0.45 + f * 0.25 : -0.45 - f * 0.25;
    const sway = Math.sin(t * 0.6 + i + seed * 5) * 0.04, len = 15 + (1 - f) * 7, tone = [GREENS.dark, GREENS.mid, GREENS.leaf][i % 3];
    blade(h, x, y, a + sway, len, 8.5 - f * 1.5, tone, 0.35 * (1 - f));
  });
}

// ---- A snake plant: stiff upright swords, banded, with a yellow edge ----
function snake(h, sx, sy, t, seed = 0) {
  const { ctx } = h;
  [[-9, 34, -0.12], [-4, 46, -0.05], [3, 40, 0.06], [9, 30, 0.14], [0, 28, 0], [-13, 24, -0.2]].forEach(([dx, hh, lean], i) => {
    const tipx = sx + dx + lean * hh + Math.sin(t * 0.5 + i + seed * 4) * 0.4, tipy = sy - hh, w = 3.4;
    const body = i % 2 ? '#4E7A3E' : '#5E8A48';
    ctx.beginPath(); ctx.moveTo(sx + dx - w, sy); ctx.quadraticCurveTo(sx + dx - w * 1.1 + lean * hh * 0.4, sy - hh * 0.55, tipx, tipy); ctx.quadraticCurveTo(sx + dx + w * 1.1 + lean * hh * 0.4, sy - hh * 0.55, sx + dx + w, sy); ctx.closePath();
    ctx.fillStyle = body; ctx.fill(); ctx.strokeStyle = '#D8CB6A'; ctx.lineWidth = 0.9; ctx.stroke();
    // The lit half, and the darker cross-bands.
    ctx.beginPath(); ctx.moveTo(sx + dx, sy); ctx.quadraticCurveTo(sx + dx + lean * hh * 0.4, sy - hh * 0.55, tipx, tipy); ctx.quadraticCurveTo(sx + dx + w * 1.1 + lean * hh * 0.4, sy - hh * 0.55, sx + dx + w, sy); ctx.closePath();
    ctx.fillStyle = 'rgba(20,50,25,.28)'; ctx.fill();
    ctx.strokeStyle = 'rgba(25,60,30,.45)'; ctx.lineWidth = 1;
    for (let k = 1; k < 6; k++) { const u = k / 6, bx = sx + dx + lean * hh * u * 0.8, by = sy - hh * u * 0.92, bw = w * (1 - u * 0.85); ctx.beginPath(); ctx.moveTo(bx - bw, by + 1); ctx.lineTo(bx + bw, by - 1); ctx.stroke(); }
  });
}

// ---- A cactus: a ribbed column with two arms, spines and a flower ----
function cactus(h, sx, sy, t, seed = 0) {
  const { ctx, rr, circle, shade } = h, body = '#4F8A5B', lit = '#6BA676';
  const col = (x, y, w, hh, c) => {
    rr(x - w / 2, y - hh, w, hh, w / 2, shade(c, -0.12));
    rr(x - w / 2, y - hh, w * 0.55, hh, w / 2, c);
    ctx.strokeStyle = 'rgba(20,60,35,.35)'; ctx.lineWidth = 0.7;
    [-0.22, 0.12].forEach((r) => { ctx.beginPath(); ctx.moveTo(x + w * r, y - hh + w * 0.3); ctx.lineTo(x + w * r, y); ctx.stroke(); });
    ctx.fillStyle = 'rgba(255,248,214,.8)';
    for (let k = 0; k < Math.floor(hh / 7); k++) { ctx.fillRect(x - w * 0.3, y - 4 - k * 7, 1, 1); ctx.fillRect(x + w * 0.12, y - 7 - k * 7, 1, 1); }
  };
  // Arms: they leave the column sideways and turn up.
  rr(sx - 17, sy - 24, 12, 6, 3, shade(body, -0.1)); col(sx - 16, sy - 20, 7, 16, lit);
  rr(sx + 4, sy - 30, 13, 6, 3, shade(body, -0.1)); col(sx + 15, sy - 26, 7, 20, body);
  col(sx, sy, 11, 46, body);
  const bob = Math.sin(t * 0.9 + seed * 6) * 0.3;
  circle(sx, sy - 47 + bob, 3.2, '#E07A9A'); circle(sx, sy - 47 + bob, 1.4, '#FFD27A'); circle(sx - 1.6, sy - 48.6 + bob, 1, 'rgba(255,255,255,.6)');
}

const FOLIAGE = { houseplant, fern, palm, fiddle, snake, cactus };

/** The foliage of a kind of plant, drawn from the soil's centre. */
export function drawFoliage(h, kind, sx, sy, t, seed) { (FOLIAGE[kind] || houseplant)(h, sx, sy, t, seed); }

/**
 * Draws a plant at a growth scale (0..1 of its full size). Every foliage function draws from the soil's centre, so one
 * transform around the full drawing grows it from that point: no separate art for each stage.
 */
export function drawGrowingFoliage(h, kind, sx, sy, t, seed, grow) {
  const g = Math.max(0.05, Math.min(1, grow));
  const { ctx } = h;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(g, g);
  ctx.translate(-sx, -sy);
  drawFoliage(h, kind, sx, sy, t, seed);
  ctx.restore();
}

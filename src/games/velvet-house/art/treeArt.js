// The yard's trees. Each is painted once, in more detail than a frame could afford (branches, clumps of leaves, bark, blossom, fruit, snow),
// into a few cached layers, and then drawn every frame with a gentle sway. A tree is looked up by its species, the season, whether snow lies on
// it and a variant (so two oaks are not the same oak), and painted again only when one of those changes or the screen scale does.
//
// Everything is painted with the base of the trunk at the origin and up as negative y, so a tree stands on the tile point it is drawn at.
// The sun is in front and to the left, as everywhere in the house: lit on the upper left, shaded on the lower right, shadows to the right.

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hexRGB = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const toHex = (c) => '#' + c.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
export const mix = (a, b, t) => { const A = hexRGB(a), B = hexRGB(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); };
export const shade = (h, a) => (a < 0 ? mix(h, '#000000', -a) : mix(h, '#ffffff', a));
const rgba = (h, a) => { const [r, g, b] = hexRGB(h); return `rgba(${r},${g},${b},${a})`; };
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---- Shapes ---------------------------------------------------------------------------------------------------------

/** A limb that tapers from width w0 to w1, lit on its upper-left edge and shaded on its lower-right, bent by `bend` sideways. */
function limb(g, x0, y0, x1, y1, w0, w1, col, bend = 0) {
  const mx = (x0 + x1) / 2 + bend, my = (y0 + y1) / 2, dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const body = (a, b, c) => {
    g.fillStyle = c; g.beginPath(); g.moveTo(x0 + nx * a / 2, y0 + ny * a / 2);
    g.quadraticCurveTo(mx + nx * (a + b) / 4, my + ny * (a + b) / 4, x1 + nx * b / 2, y1 + ny * b / 2); g.lineTo(x1 - nx * b / 2, y1 - ny * b / 2);
    g.quadraticCurveTo(mx - nx * (a + b) / 4, my - ny * (a + b) / 4, x0 - nx * a / 2, y0 - ny * a / 2); g.closePath(); g.fill();
  };
  body(w0 + 1.6, w1 + 1.6, shade(col, -0.45));
  body(w0, w1, col);
  if (w0 > 3) { g.save(); g.translate(-w0 * 0.12, -w0 * 0.1); body(w0 * 0.5, w1 * 0.5, shade(col, 0.16)); g.restore(); }
}

/** A trunk: flared at the foot, narrowing up, lit on its left with bark furrows, a dark edge, roots spreading into the grass and knots. */
function trunk(g, rnd, { h, wb, wt, lean = 0, col, furrows = 6, roots = 3 }) {
  const path = () => {
    g.beginPath(); g.moveTo(-wb, 1); g.quadraticCurveTo(-wt - 1 + lean * 0.3, -h * 0.45, -wt + lean, -h); g.lineTo(wt + lean, -h);
    g.quadraticCurveTo(wt + 1 + lean * 0.3, -h * 0.45, wb, 1); g.closePath();
  };
  for (let k = 0; k < roots; k++) { const s = k % 2 ? 1 : -1, len = wb * (1.5 + rnd() * 0.8); limb(g, s * wb * 0.5, -2, s * len, 3 + rnd() * 2, wb * 0.7, 2, col, 0); }
  const lg = g.createLinearGradient(-wb, 0, wb, 0); lg.addColorStop(0, shade(col, 0.22)); lg.addColorStop(0.5, col); lg.addColorStop(1, shade(col, -0.38));
  path(); g.fillStyle = lg; g.fill(); g.strokeStyle = rgba(shade(col, -0.7), 0.7); g.lineWidth = 1.1; g.stroke();
  g.save(); path(); g.clip(); g.lineCap = 'round';
  for (let k = 0; k < furrows; k++) {
    const u = -0.85 + (k + rnd() * 0.5) * (1.7 / furrows), x0 = u * wb, x1 = u * wt + lean, bow = (rnd() - 0.5) * 5;
    g.strokeStyle = rgba(shade(col, -0.6), 0.28 + rnd() * 0.2); g.lineWidth = 0.8 + rnd() * 0.8; g.beginPath(); g.moveTo(x0, 0); g.quadraticCurveTo((x0 + x1) / 2 + bow, -h * 0.5, x1, -h); g.stroke();
  }
  for (let k = 0; k < 2; k++) { const y = -h * (0.25 + rnd() * 0.5), x = (rnd() - 0.5) * wb * 0.8; g.fillStyle = rgba(shade(col, -0.6), 0.4); g.beginPath(); g.ellipse(x, y, 2, 3, 0, 0, TAU); g.fill(); }
  g.restore();
}

function shadow(g, rx, ry = rx * 0.4) {
  [[1.12, 0.1, 14], [0.88, 0.14, 11], [0.55, 0.2, 7]].forEach(([k, a, dx]) => { g.fillStyle = `rgba(22,40,18,${a})`; g.beginPath(); g.ellipse(dx, 3, rx * k, ry * k, 0, 0, TAU); g.fill(); });
}

function leaf(g, x, y, ang, len, w, col) {
  g.fillStyle = col; g.beginPath(); g.ellipse(x, y, len, w, ang, 0, TAU); g.fill();
}

/** One clump of foliage: a lumpy shape (not a circle), shaded round, textured with leaves in three tones, with leaves breaking its edge. */
function clump(g, rnd, cx, cy, rx, ry, p, o = {}) {
  const N = 16, shape = Array.from({ length: N }, () => 1 + (rnd() - 0.5) * (o.lumpy ?? 0.3));
  const path = (grow = 0) => {
    g.beginPath();
    const pt = (i) => { const a = (i / N) * TAU, r = shape[i % N]; return [cx + Math.cos(a) * (rx * r + grow), cy + Math.sin(a) * (ry * r + grow)]; };
    const first = pt(0), last = pt(N - 1); g.moveTo((first[0] + last[0]) / 2, (first[1] + last[1]) / 2);
    for (let i = 0; i < N; i++) { const a = pt(i), b = pt(i + 1); g.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
    g.closePath();
  };
  const base = p.base, lit = p.hi, dark = p.lo;
  if (o.outline !== false) { path(1.6); g.fillStyle = rgba(p.edge, 0.7); g.fill(); }
  const m = Math.max(rx, ry), gr = g.createRadialGradient(cx - rx * 0.4, cy - ry * 0.5, m * 0.1, cx, cy, m * 1.05);
  gr.addColorStop(0, lit); gr.addColorStop(0.45, base); gr.addColorStop(1, mix(base, dark, 0.7));
  path(); g.fillStyle = gr; g.fill();
  g.save(); path(); g.clip();
  // Dark below, bright above: a crescent each side so the clump reads as a rounded lump with the sun on its upper left.
  g.lineCap = 'round'; g.strokeStyle = rgba(dark, 0.34); g.lineWidth = m * 0.42; g.beginPath(); g.ellipse(cx, cy, rx * 0.88, ry * 0.88, 0, 0.05, 1.7); g.stroke();
  g.strokeStyle = rgba(lit, 0.28); g.lineWidth = m * 0.26; g.beginPath(); g.ellipse(cx, cy, rx * 0.8, ry * 0.8, 0, 3.3, 4.8); g.stroke();
  const n = Math.round((rx * ry) / (o.density ?? 7)), L = o.leaf ?? 3.2;
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU, d = Math.sqrt(rnd()), lx = cx + Math.cos(a) * rx * d, ly = cy + Math.sin(a) * ry * d, sun = (-(lx - cx) / rx - (ly - cy) / ry) / 2 + (rnd() - 0.5) * 0.5;
    const c = sun > 0.22 ? lit : sun < -0.22 ? dark : base;
    leaf(g, lx, ly, (rnd() - 0.2) * 2.6, L * (0.8 + rnd() * 0.5), L * 0.52, rgba(c, 0.55 + rnd() * 0.3));
  }
  if (p.accent && o.accent) for (let i = 0; i < o.accent; i++) { const a = rnd() * TAU, d = Math.sqrt(rnd()) * 0.92; leaf(g, cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, rnd() * 3, L * 0.9, L * 0.55, rgba(p.accent[Math.floor(rnd() * p.accent.length)], 0.85)); }
  g.restore();
  // Leaves breaking the outline all the way round, a dark one behind each light one, so the edge is ragged and not a clean curve.
  const e = Math.round((Math.PI * (rx + ry)) / (o.edgeStep ?? 3.4));
  for (let i = 0; i < e; i++) {
    const a = rnd() * TAU, r = 0.94 + rnd() * 0.12, ex = cx + Math.cos(a) * rx * r, ey = cy + Math.sin(a) * ry * r, sun = (-Math.cos(a) - Math.sin(a)) / 1.4;
    const ang = a + (rnd() - 0.5) * 0.9, len = L * (0.9 + rnd() * 0.8);
    leaf(g, ex, ey + 0.8, ang, len + 0.6, L * 0.6, rgba(p.edge, 0.65));
    leaf(g, ex, ey, ang, len, L * 0.5, sun > 0.2 ? lit : sun < -0.3 ? dark : base);
  }
}

/**
 * A bare branch that forks again and again: curved, thinner and shorter each time, leaning back toward the sky a little at each fork.
 * Snow lies along the top of every branch thick enough to hold it, and settles in puffs where they fork.
 */
function grow(g, rnd, x, y, ang, len, w, depth, col, snowy, P) {
  const bend = (rnd() - 0.5) * len * 0.4, ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len, w1 = Math.max(0.55, w * 0.66);
  limb(g, x, y, ex, ey, w, w1, col, bend);
  if (snowy && w > 1.1) { g.strokeStyle = 'rgba(246,248,250,.96)'; g.lineCap = 'round'; g.lineWidth = Math.max(1.1, w * 0.5); g.beginPath(); g.moveTo(x, y - w * 0.42); g.quadraticCurveTo((x + ex) / 2 + bend, (y + ey) / 2 - w * 0.4, ex, ey - w1 * 0.4); g.stroke(); }
  if (depth <= 0) { if (snowy && rnd() > 0.4) { g.fillStyle = 'rgba(246,248,250,.95)'; g.beginPath(); g.ellipse(ex, ey - 1, 2.2, 1.3, 0, 0, TAU); g.fill(); } return; }
  const k = depth > 3 ? 2 : rnd() > 0.4 ? 3 : 2;
  for (let i = 0; i < k; i++) {
    const u = i === 0 ? 1 : 0.5 + rnd() * 0.3, sx = x + (ex - x) * u + bend * (u === 1 ? 0.5 : 0.35), sy = y + (ey - y) * u;
    let a = ang + (i - (k - 1) / 2) * (0.55 + rnd() * 0.45) + (rnd() - 0.5) * 0.3;
    a += (-Math.PI / 2 - a) * P.up + P.droop;
    grow(g, rnd, sx, sy, a, len * (0.6 + rnd() * 0.2), w1, depth - 1, col, snowy, P);
  }
}

// ---- Palettes -------------------------------------------------------------------------------------------------------

const GREEN = {
  spring: { base: '#86C456', hi: '#C4E87E', lo: '#3E7A3A', edge: '#2A5A2A' },
  summer: { base: '#4C9A45', hi: '#8CCB62', lo: '#1F5A2F', edge: '#17401F' },
  autumn: { base: '#D9822B', hi: '#F2C14E', lo: '#8A2E22', edge: '#5A1E18', multi: ['#C2412B', '#E0762C', '#E8B02F', '#B5522A', '#D6A02B'] },
};

// ---- Species --------------------------------------------------------------------------------------------------------
// Each painter draws into three layers: `under` (shadow, trunk, big limbs), `crown` (the foliage) and `front` (anything that hangs in front,
// swaying a little differently). It returns how the crown pivots.

function broadleaf(L, rnd, season, snowy, S) {
  const p = { ...GREEN[season === 'winter' ? 'summer' : season], ...(S.palette?.[season] || {}) };
  shadow(L.under, S.shadow);
  trunk(L.under, rnd, S.trunk);
  if (season !== 'winter') S.limbs.forEach(([x0, y0, x1, y1, w0, w1, bend]) => limb(L.under, x0, y0, x1, y1, w0, w1, S.trunk.col, bend || 0));
  if (S.fallen && season === 'autumn') S.fallen(L.under, rnd);
  if (season === 'winter') {
    // Bare: the crown is grown branch by branch from the top of the trunk, so it is never the same twice.
    const B = S.bare, col = shade(S.trunk.col, -0.04), top = [S.trunk.lean, -S.trunk.h * 0.94];
    for (let i = 0; i < B.limbs; i++) { const u = B.limbs === 1 ? 0 : i / (B.limbs - 1) - 0.5, a = -Math.PI / 2 + u * B.spread + (rnd() - 0.5) * 0.22; grow(L.crown, rnd, top[0], top[1], a, B.len * (0.85 + rnd() * 0.3), B.w, B.depth, col, snowy, B); }
    return { pivot: -S.trunk.h * 0.9, sway: 0.006 };
  }
  // Back clumps first and dark, then the branches seen through the gaps, then the middle and the front, each lighter and nearer.
  const layers = [[S.back, -0.3], [S.mid, -0.1], [S.front, 0.04]];
  layers.forEach(([list, k], li) => {
    if (li === 1) S.limbs2?.forEach(([x0, y0, x1, y1, w0, w1, bend]) => limb(L.crown, x0, y0, x1, y1, w0, w1, S.trunk.col, bend || 0));
    list.forEach(([x, y, rx, ry]) => {
      let base = shade(p.base, k);
      if (p.multi) { const u = rnd(), pick = p.multi[Math.floor((clamp((y + 110) / 70 + (rnd() - 0.5) * 0.8, 0, 0.999)) * p.multi.length)]; base = shade(mix(pick, p.base, u * 0.25), k * 0.8); }
      clump(L.crown, rnd, x, y, rx, ry, { base, hi: shade(base, 0.26), lo: shade(base, -0.34), edge: p.edge, accent: S.accent?.[season] }, { accent: S.accent?.[season] ? S.accentN?.[season] ?? 8 : 0, leaf: S.leaf, density: S.density, lumpy: S.lumpy });
    });
  });
  S.after?.(L, rnd, season, p);
  return { pivot: -S.trunk.h * 0.9, sway: 0.012 };
}

const variantJitter = (rnd, list, a = 5) => list.map(([x, y, rx, ry]) => [x + (rnd() - 0.5) * a, y + (rnd() - 0.5) * a * 0.6, rx * (0.92 + rnd() * 0.16), ry * (0.92 + rnd() * 0.16)]);

const SPECIES = {};

// A wide, heavy crown on a thick trunk with big spreading limbs: the broadest tree here, flat across the bottom.
SPECIES.oak = { w: 96, up: 144, size: 0.55, paint(L, rnd, season, snowy) {
  const S = {
    shadow: 62, trunk: { h: 46, wb: 17, wt: 10, lean: (rnd() - 0.5) * 6, col: '#6A4B36', furrows: 8, roots: 4 },
    limbs: [[0, -40, -38, -68, 10, 4, -4], [0, -42, 40, -72, 10, 4, 4], [0, -44, (rnd() - 0.5) * 8, -88, 8, 3.5], [-3, -34, -58, -56, 7, 3, -3], [3, -36, 60, -58, 7, 3, 3]],
    limbs2: [[-38, -68, -50, -90, 4, 1.6], [40, -72, 52, -92, 4, 1.6], [-58, -56, -70, -72, 3.4, 1.4], [60, -58, 72, -74, 3.4, 1.4]],
    tips: [[-38, -68, -2.2], [40, -72, -0.9], [0, -88, -1.6], [-58, -56, -2.5], [60, -58, -0.6], [-20, -62, -2], [22, -64, -1.2]], twig: 26, twigW: 3,
    back: variantJitter(rnd, [[-56, -80, 24, 19], [-32, -100, 28, 21], [0, -108, 30, 22], [32, -100, 28, 21], [56, -80, 24, 19], [-14, -82, 26, 20], [18, -86, 26, 20]]),
    mid: variantJitter(rnd, [[-48, -64, 23, 16], [-22, -86, 26, 19], [12, -94, 26, 19], [42, -80, 24, 17], [58, -66, 19, 14], [-62, -66, 17, 12], [0, -70, 24, 15]]),
    front: variantJitter(rnd, [[-38, -58, 19, 12], [-8, -66, 21, 13], [24, -60, 21, 13], [48, -62, 16, 11], [-24, -76, 16, 11]]),
    bare: { limbs: 5, spread: 1.9, len: 36, w: 9, depth: 5, up: 0.12, droop: 0 },
    leaf: 3.4, density: 6.5, lumpy: 0.34,
    fallen: (g) => { for (let i = 0; i < 9; i++) leaf(g, (rnd() - 0.5) * 80, 4 + rnd() * 7, rnd() * 3, 3, 1.7, rgba(['#C2412B', '#E0762C', '#E8B02F'][i % 3], 0.9)); },
  };
  return broadleaf(L, rnd, season, snowy, S);
} };

// A graceful umbrella: a slim dark curving trunk, limbs sweeping out flat, and the crown in layered sprays, pink with blossom in spring.
SPECIES.cherry = { w: 88, up: 124, size: 0.55, paint(L, rnd, season, snowy) {
  const lean = -8 + rnd() * 6;
  const S = {
    shadow: 56, trunk: { h: 38, wb: 9, wt: 4.5, lean, col: '#4E3436', furrows: 5, roots: 3 },
    limbs: [[lean, -34, -34, -54, 5, 2.4, -6], [lean, -36, 36, -58, 5, 2.4, 6], [lean, -38, lean + 4, -72, 4, 2], [lean - 2, -32, -52, -46, 3.6, 1.6, -3], [lean + 2, -34, 54, -48, 3.6, 1.6, 3]],
    limbs2: [[-34, -54, -46, -68, 2.4, 1.2], [36, -58, 48, -70, 2.4, 1.2]],
    tips: [[-34, -54, -2.3], [36, -58, -0.8], [lean + 4, -72, -1.6], [-52, -46, -2.7], [54, -48, -0.4]], twig: 22, twigW: 2.2,
    back: variantJitter(rnd, [[-48, -62, 26, 13], [-20, -76, 28, 14], [14, -78, 28, 14], [46, -62, 26, 13], [0, -66, 30, 14]]),
    mid: variantJitter(rnd, [[-42, -56, 24, 12], [-12, -68, 26, 13], [22, -68, 26, 13], [48, -54, 20, 10], [-56, -50, 18, 9]]),
    front: variantJitter(rnd, [[-30, -50, 20, 10], [4, -58, 22, 11], [34, -54, 20, 10], [-4, -44, 18, 9]]),
    bare: { limbs: 5, spread: 2.3, len: 30, w: 5, depth: 5, up: 0.04, droop: 0.02 },
    leaf: 3, density: 6, lumpy: 0.3,
    palette: { spring: { base: '#F4B3C8', hi: '#FFE3EB', lo: '#C96C92', edge: '#8E3F63' }, summer: { base: '#4E9446', hi: '#86C562', lo: '#1F5A2F', edge: '#17401F' },
      autumn: { base: '#D9622E', hi: '#F2B04E', lo: '#8A2A24', edge: '#5A1E18' } },
    accent: { spring: ['#FFFFFF', '#FBD3E0', '#E58AAE', '#F7A8C2'] }, accentN: { spring: 26 },
    after: (G, r, s) => { if (s === 'spring') for (let i = 0; i < 40; i++) { const a = r() * TAU, d = Math.sqrt(r()), x = Math.cos(a) * 56 * d, y = -64 + Math.sin(a) * 22 * d; for (let k = 0; k < 5; k++) { const pa = (k / 5) * TAU; leaf(G.crown, x + Math.cos(pa) * 1.6, y + Math.sin(pa) * 1.6, pa, 1.5, 1, i % 3 ? '#FFF4F7' : '#F7B6CB'); } G.crown.fillStyle = '#E2799E'; G.crown.beginPath(); G.crown.arc(x, y, 0.7, 0, TAU); G.crown.fill(); } },
  };
  return broadleaf(L, rnd, season, snowy, S);
} };

// A small round crown on a short gnarled trunk, loaded with fruit.
SPECIES.apple = { w: 72, up: 104, size: 0.75, paint(L, rnd, season, snowy) {
  const S = {
    shadow: 46, trunk: { h: 26, wb: 12, wt: 7, lean: (rnd() - 0.5) * 8, col: '#6B4A37', furrows: 6, roots: 3 },
    limbs: [[0, -22, -26, -42, 6, 2.6, -4], [0, -24, 26, -44, 6, 2.6, 4], [0, -24, 0, -52, 5, 2.2]],
    limbs2: [[-26, -42, -36, -56, 3, 1.4], [26, -44, 36, -58, 3, 1.4]],
    tips: [[-26, -42, -2.3], [26, -44, -0.8], [0, -52, -1.6], [-36, -50, -2.4], [34, -52, -0.7]], twig: 18, twigW: 2.4,
    back: variantJitter(rnd, [[-30, -52, 17, 13], [-10, -66, 20, 14], [16, -64, 19, 14], [34, -50, 16, 12], [0, -50, 20, 14]]),
    mid: variantJitter(rnd, [[-24, -46, 16, 12], [4, -58, 19, 13], [26, -48, 16, 12], [-8, -44, 16, 11]]),
    front: variantJitter(rnd, [[-18, -42, 13, 9], [14, -44, 13, 9], [-2, -52, 12, 8]]),
    bare: { limbs: 4, spread: 2.0, len: 28, w: 6.5, depth: 5, up: 0.1, droop: 0 },
    leaf: 3.1, density: 6.2, lumpy: 0.3,
    palette: { spring: { base: '#8CC95C', hi: '#CBEB88', lo: '#427C3C', edge: '#2A5A2A' }, summer: { base: '#4F9944', hi: '#8FCB62', lo: '#215C30', edge: '#17401F' },
      autumn: { base: '#B6A23A', hi: '#E8D060', lo: '#6E5A22', edge: '#4A3A18', multi: ['#B6A23A', '#C7872B', '#D8A738', '#A98A2E'] } },
    fallen: (g, r) => { if (true) for (let i = 0; i < 5; i++) { const x = (r() - 0.5) * 60, y = 5 + r() * 8; g.fillStyle = '#B22B22'; g.beginPath(); g.arc(x, y, 2.6, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.arc(x - 0.8, y - 0.8, 0.9, 0, TAU); g.fill(); } },
    after: (G, r, s) => {
      const c = G.crown;
      if (s === 'spring') for (let i = 0; i < 46; i++) { const a = r() * TAU, d = Math.sqrt(r()), x = Math.cos(a) * 36 * d, y = -52 + Math.sin(a) * 18 * d; for (let k = 0; k < 5; k++) { const pa = (k / 5) * TAU; leaf(c, x + Math.cos(pa) * 1.7, y + Math.sin(pa) * 1.7, pa, 1.6, 1.1, i % 4 ? '#FFF8F8' : '#FBD0DC'); } c.fillStyle = '#E9C54A'; c.beginPath(); c.arc(x, y, 0.8, 0, TAU); c.fill(); }
      else for (let i = 0; i < 18; i++) { const a = r() * TAU, d = Math.sqrt(r()) * 0.85, x = Math.cos(a) * 34 * d, y = -50 + Math.sin(a) * 18 * d, red = ['#C8281F', '#D2372B', '#B0221A', '#E0A82E'][i % 4]; const gr = c.createRadialGradient(x - 1.2, y - 1.4, 0.4, x, y, 4); gr.addColorStop(0, shade(red, 0.35)); gr.addColorStop(0.5, red); gr.addColorStop(1, shade(red, -0.45)); c.fillStyle = gr; c.beginPath(); c.arc(x, y, 3.6, 0, TAU); c.fill(); c.strokeStyle = 'rgba(40,12,8,.5)'; c.lineWidth = 0.7; c.stroke(); c.strokeStyle = '#4A3A22'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x, y - 3.4); c.lineTo(x + 0.6, y - 5.2); c.stroke(); }
    },
  };
  return broadleaf(L, rnd, season, snowy, S);
} };

// A tall layered cone of drooping boughs, the needles in tufts that fray at the edges. Evergreen: only the tone and the snow change.
SPECIES.pine = { w: 60, up: 156, size: 0.75, paint(L, rnd, season, snowy) {
  const g = L.crown, tones = { spring: ['#3E8A4A', '#7BC06A', '#1F5A2E'], summer: ['#2F7040', '#5FA060', '#164A28'], autumn: ['#2F6A40', '#5A9A58', '#154428'], winter: ['#2A5E48', '#58907A', '#143E34'] }[season];
  const [base, hi, lo] = tones, tiers = 9;
  shadow(L.under, 46); trunk(L.under, rnd, { h: 34, wb: 7, wt: 4.5, col: '#5A3E2E', furrows: 4, roots: 2 });
  for (let i = tiers - 1; i >= 0; i--) {
    const u = i / (tiers - 1), y = -24 - i * 14.2, hw = (40 - u * 33) * (0.92 + rnd() * 0.16), hgt = 24 - u * 8, cx = (rnd() - 0.5) * 3, tip = [cx, y - hgt];
    const n = Math.max(5, Math.round(hw / 4.2)), fringe = [];
    for (let k = 0; k <= n; k++) { const f = k / n, x = cx - hw + 2 * hw * f, edge = Math.abs(f - 0.5) * 2; fringe.push([x, y + 3 + edge * 9 + (rnd() - 0.5) * 2, 5 + rnd() * 4]); }
    const path = () => {
      g.beginPath(); g.moveTo(...tip); g.quadraticCurveTo(cx - hw * 0.62, y - hgt * 0.5, fringe[0][0], fringe[0][1]);
      for (let k = 1; k <= n; k++) { const a = fringe[k - 1], b = fringe[k]; g.quadraticCurveTo((a[0] + b[0]) / 2, Math.max(a[1], b[1]) + (a[2] + b[2]) / 2 * 0.9, b[0], b[1]); }
      g.quadraticCurveTo(cx + hw * 0.62, y - hgt * 0.5, ...tip); g.closePath();
    };
    path(); g.fillStyle = rgba(shade(lo, -0.3), 0.8); g.save(); g.translate(1.5, 2); g.fill(); g.restore();
    const gr = g.createLinearGradient(cx - hw, 0, cx + hw, 0); gr.addColorStop(0, hi); gr.addColorStop(0.4, base); gr.addColorStop(1, lo);
    path(); g.fillStyle = gr; g.fill();
    g.save(); path(); g.clip(); g.lineCap = 'round';
    const needles = Math.round(hw * 5);
    for (let j = 0; j < needles; j++) {
      const f = rnd(), x = cx - hw * 0.9 + 2 * hw * 0.9 * f, ymax = y + 2 - (1 - Math.abs(f - 0.5) * 2) * 0, py = tip[1] + (ymax + 8 - tip[1]) * Math.sqrt(rnd()), dir = x < cx ? 2.6 : 0.55, len = 4 + rnd() * 5;
      g.strokeStyle = rgba(f < 0.35 ? hi : f > 0.7 ? lo : base, 0.55); g.lineWidth = 1.1; g.beginPath(); g.moveTo(x, py); g.lineTo(x + Math.cos(dir + (rnd() - 0.5) * 0.7) * len * (x < cx ? -1 : 1) * -1, py + Math.abs(Math.sin(dir)) * len * 0.8); g.stroke();
    }
    if (season === 'spring') for (let j = 0; j < n; j++) leaf(g, fringe[j][0], fringe[j][1] - 2, 1.2, 2.2, 1.1, rgba('#B6E27A', 0.8));
    g.restore();
    path(); g.strokeStyle = rgba(shade(lo, -0.55), 0.7); g.lineWidth = 1; g.stroke();
    // The fringe breaks the lower edge: tufts of needles hanging off each tier.
    fringe.forEach(([x, yy, len], k) => { const sun = x < cx ? hi : lo; for (let m = 0; m < 3; m++) { const dx = (rnd() - 0.5) * 5; g.strokeStyle = rgba(shade(lo, -0.4), 0.7); g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + dx, yy - 1); g.lineTo(x + dx * 1.4, yy + len * 0.9); g.stroke(); g.strokeStyle = rgba(m ? base : sun, 0.9); g.lineWidth = 1; g.beginPath(); g.moveTo(x + dx, yy - 1); g.lineTo(x + dx * 1.4, yy + len * 0.85); g.stroke(); } });
    if (snowy) { g.fillStyle = 'rgba(246,248,250,.96)'; g.beginPath(); g.moveTo(tip[0] - hw * 0.62, y - hgt * 0.1 + 5); g.quadraticCurveTo(tip[0] - hw * 0.3, y - hgt * 0.55, ...tip); g.quadraticCurveTo(tip[0] + hw * 0.3, y - hgt * 0.55, tip[0] + hw * 0.62, y - hgt * 0.1 + 5); g.quadraticCurveTo(tip[0], y - hgt * 0.1 + 11, tip[0] - hw * 0.62, y - hgt * 0.1 + 5); g.fill(); g.strokeStyle = 'rgba(150,170,190,.5)'; g.lineWidth = 0.8; g.stroke(); }
    if (i === 3 || i === 5) for (let c = 0; c < 2; c++) { const f = fringe[2 + Math.floor(rnd() * (n - 3))]; g.fillStyle = '#7A5A3A'; g.beginPath(); g.ellipse(f[0], f[1] + f[2] * 0.9 + 3, 2.2, 4, 0, 0, TAU); g.fill(); g.strokeStyle = 'rgba(40,24,12,.6)'; g.lineWidth = 0.7; g.stroke(); }
  }
  return { pivot: -10, sway: 0.007 };
} };

// A slender white trunk, usually two or three together, with dark bark marks, fine pale branches and light trembling clusters of small leaves.
SPECIES.birch = { w: 60, up: 152, size: 0.8, paint(L, rnd, season, snowy) {
  const stems = [{ x: 0, h: 104, w: 6.5, lean: (rnd() - 0.5) * 8 }, { x: -9, h: 84, w: 4.6, lean: -16 - rnd() * 6 }, { x: 8, h: 74, w: 4, lean: 15 + rnd() * 6 }];
  shadow(L.under, 40);
  const barkCol = '#F1EDE4', twigCol = season === 'winter' ? '#8A6A58' : '#BFB3A4', tips = [];
  stems.forEach((s, si) => {
    L.under.save(); L.under.translate(s.x, 0);
    trunk(L.under, rnd, { h: s.h, wb: s.w * 1.25, wt: s.w * 0.55, lean: s.lean, col: barkCol, furrows: 0, roots: si ? 0 : 2 });
    const mk = (h) => { const u = h / s.h; return [s.lean * u * u * 0.85 + (rnd() - 0.5) * 0.6, -h]; };
    for (let h = 6 + rnd() * 5; h < s.h - 4; h += 6 + rnd() * 9) {
      const [x, y] = mk(h), half = (s.w * 1.25 + (s.w * 0.55 - s.w * 1.25) * (h / s.h)) * (0.55 + rnd() * 0.45);
      L.under.fillStyle = rgba('#2A2626', 0.85); L.under.beginPath(); L.under.moveTo(x - half, y); L.under.quadraticCurveTo(x, y - 1.6 - rnd() * 2, x + half, y + (rnd() - 0.5) * 2); L.under.quadraticCurveTo(x, y + 1.4, x - half, y); L.under.fill();
    }
    L.under.restore();
    // Fine branches rising and spreading from the upper stem.
    for (let b = 0; b < 4; b++) { const hh = s.h * (0.45 + b * 0.14), [bx, by] = mk(hh), dir = (b % 2 ? 1 : -1), len = 26 - b * 3 + rnd() * 8, ex = s.x + bx + dir * len * (0.6 + rnd() * 0.4), ey = by - len * (0.7 + rnd() * 0.5);
      limb(L.crown, s.x + bx, by, ex, ey, 2.2, 0.9, twigCol, dir * 4); tips.push([ex, ey]); }
    const [tx, ty] = mk(s.h); tips.push([s.x + tx, ty]);
  });
  if (season === 'winter') {
    const P = { up: 0.1, droop: 0.1 };
    tips.forEach(([x, y]) => grow(L.crown, rnd, x, y, -Math.PI / 2 + (rnd() - 0.5) * 1.4, 18, 2, 4, twigCol, snowy, P));
    return { pivot: -60, sway: 0.008 };
  }
  const pal = { spring: ['#A6D95E', '#D8F28A', '#5E9A3A', '#2E6A2E'], summer: ['#79B848', '#A8DA6A', '#3F7E32', '#1F5A28'], autumn: ['#EBC23A', '#F8E27A', '#C27A22', '#7A4A18'] }[season];
  tips.forEach(([x, y], k) => {
    const sets = [[x, y - 2, 12 + rnd() * 3, 10 + rnd() * 3], [x + (rnd() - 0.5) * 12, y + 6 + rnd() * 6, 10, 9]];
    sets.forEach(([cx, cy, rx, ry]) => clump(L.crown, rnd, cx, cy, rx, ry, { base: pal[0], hi: pal[1], lo: pal[2], edge: pal[3] }, { leaf: 3.8, density: 11, lumpy: 0.45, edgeStep: 2.6 }));
    for (let d = 0; d < 7; d++) { const dx = x + (rnd() - 0.5) * 22, dy = y + 8 + rnd() * 10; leaf(L.front, dx, dy, 1.4 + (rnd() - 0.5) * 0.6, 4, 1.9, rgba(d % 2 ? pal[0] : pal[1], 0.95)); }
  });
  return { pivot: -50, sway: 0.012, swayFront: 0.02 };
} };

// A heavy leaning trunk under a low dome, with long curtains of leaves hanging to the ground and swinging in the wind.
SPECIES.willow = { w: 104, up: 138, size: 0.5, paint(L, rnd, season, snowy) {
  const p = { spring: ['#A8D468', '#D6F08E', '#5E9A3A', '#2E6A2E'], summer: ['#7EB654', '#A8D878', '#3F7E32', '#1F5A28'], autumn: ['#D8B442', '#F2DC78', '#A87A22', '#6A4A18'], winter: ['#B49A5C', '#D8C488', '#7A6A3A', '#4A3A22'] }[season];
  const lean = -6 + rnd() * 4, col = '#6B5238';
  shadow(L.under, 64); trunk(L.under, rnd, { h: 44, wb: 17, wt: 9, lean, col, furrows: 8, roots: 4 });
  const arms = [[lean, -42, -36, -70, 9, 4, -8], [lean, -44, 38, -72, 9, 4, 8], [lean, -46, lean + 2, -84, 7, 3.4, 0], [lean - 2, -38, -60, -58, 6, 2.6, -6], [lean + 2, -40, 62, -60, 6, 2.6, 6]];
  if (season !== 'winter') arms.forEach(([x0, y0, x1, y1, w0, w1, b]) => limb(L.under, x0, y0, x1, y1, w0, w1, col, b));
  else { const P = { up: 0.05, droop: 0.05 }; arms.forEach(([x0, y0, x1, y1]) => grow(L.crown, rnd, x0, y0, Math.atan2(y1 - y0, x1 - x0), 22, 5, 3, shade(col, 0.05), snowy, P)); }
  // The curtains hang from along the arch of the limbs: some behind (the crown layer), some in front (the front layer, swinging more).
  const strands = season === 'winter' ? 26 : 52, anchors = (u) => { const a = u * Math.PI, x = -66 + u * 132, y = -58 - Math.sin(a) * 34 - (Math.abs(u - 0.5) < 0.18 ? 6 : 0); return [x, y]; };
  const dome = [[-44, -76, 26, 17], [-14, -92, 30, 19], [22, -90, 30, 19], [50, -74, 26, 17], [0, -72, 30, 16]];
  if (season !== 'winter') dome.forEach(([x, y, rx, ry]) => clump(L.crown, rnd, x, y, rx, ry, { base: shade(p[0], -0.1), hi: p[1], lo: p[2], edge: p[3] }, { leaf: 3.4, density: 7, lumpy: 0.32 }));
  for (let k = 0; k < strands; k++) {
    const u = (k + rnd() * 0.8) / strands, [sx, sy] = anchors(u), len = 52 + Math.sin(u * Math.PI) * 26 + rnd() * 18, front = k % 2 === 0, g = front ? L.front : L.crown;
    const bow = (rnd() - 0.5) * 14 + (u - 0.5) * 22, ex = sx + bow, ey = sy + len, cx = sx + bow * 0.2 - (u - 0.5) * 10, cy = sy + len * 0.45;
    g.lineCap = 'round'; g.strokeStyle = rgba(shade(p[2], -0.3), 0.85); g.lineWidth = season === 'winter' ? 1.3 : 2.4; g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(cx, cy, ex, ey); g.stroke();
    g.strokeStyle = season === 'winter' ? p[0] : k % 3 ? p[0] : p[1]; g.lineWidth = season === 'winter' ? 0.9 : 1.4; g.stroke();
    if (season !== 'winter') for (let j = 1; j <= 15; j++) { const f = j / 16, x = (1 - f) * (1 - f) * sx + 2 * (1 - f) * f * cx + f * f * ex, y = (1 - f) * (1 - f) * sy + 2 * (1 - f) * f * cy + f * f * ey, side = j % 2 ? 1 : -1;
      leaf(g, x + side * 2.2, y, 1.5 + side * 0.5, 4.3, 1.5, rgba(j % 3 ? p[0] : p[1], 0.95)); if (j % 4 === 0) leaf(g, x - side * 2, y + 1, 1.5 - side * 0.4, 3.6, 1.3, rgba(p[2], 0.9)); }
    if (snowy && season === 'winter') { g.fillStyle = 'rgba(246,248,250,.95)'; g.beginPath(); g.ellipse(sx, sy - 1, 2.6, 1.4, 0, 0, TAU); g.fill(); }
  }
  return { pivot: -64, sway: 0.006, swayFront: 0.022 };
} };

// A bare curved ringed trunk topped by a burst of long arching fronds, each feathered with leaflets, and a cluster of coconuts.
SPECIES.palm = { w: 84, up: 156, size: 0.7, paint(L, rnd, season, snowy) {
  const lean = 14 + rnd() * 8, top = [lean, -100], p = { spring: ['#4DB04F', '#8AD36A', '#206A32', '#124A22'], summer: ['#3F9E48', '#7CCB60', '#1B5E2C', '#0F4020'], autumn: ['#6CA44A', '#A8CC66', '#4A7A2E', '#2E5420'], winter: ['#3A8A58', '#6CB890', '#18523A', '#0E3A28'] }[season];
  shadow(L.under, 44);
  // The trunk: ring by ring along a curve, slightly swollen at the foot, each ring lit on its left.
  const at = (u) => [(1 - u) * (1 - u) * 0 + 2 * (1 - u) * u * (lean * 0.1 - 4) + u * u * lean, -u * 100];
  const g = L.under; let prev = at(0);
  for (let i = 1; i <= 22; i++) {
    const u = i / 22, [x, y] = at(u), w0 = 8.5 - (i - 1) * 0.2 + (i < 3 ? 2 : 0), w1 = 8.5 - i * 0.2 + (i < 3 ? 1.5 : 0), col = i % 2 ? '#A88862' : '#9A7A56';
    const lg = g.createLinearGradient(x - w1, 0, x + w1, 0); lg.addColorStop(0, shade(col, 0.2)); lg.addColorStop(0.55, col); lg.addColorStop(1, shade(col, -0.36));
    g.fillStyle = lg; g.beginPath(); g.moveTo(prev[0] - w0 / 2, prev[1]); g.lineTo(prev[0] + w0 / 2, prev[1]); g.lineTo(x + w1 / 2, y); g.lineTo(x - w1 / 2, y); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(60,40,24,.5)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(x - w1 / 2, y); g.quadraticCurveTo(x, y + 1.6, x + w1 / 2, y); g.stroke(); prev = [x, y];
  }
  g.strokeStyle = 'rgba(40,26,14,.6)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(at(0)[0] - 10, 1); for (let i = 0; i <= 22; i++) { const [x, y] = at(i / 22); g.lineTo(x - (8.5 - i * 0.2) / 2 - 0.4, y); } g.stroke();
  const cr = L.crown, fr = L.front, [tx, ty] = top;
  // Fronds: each a curve from the crown, arching up then falling, with leaflets down both sides that shorten toward the tip.
  const frond = (g2, a, len, droop, lit, dead) => {
    const ex = tx + Math.cos(a) * len, ey = ty + Math.sin(a) * len * 0.5 + droop, cx = tx + Math.cos(a) * len * 0.5, cy = ty + Math.sin(a) * len * 0.5 - 16 - Math.abs(Math.cos(a)) * 6;
    const pt = (u) => [(1 - u) * (1 - u) * tx + 2 * (1 - u) * u * cx + u * u * ex, (1 - u) * (1 - u) * ty + 2 * (1 - u) * u * cy + u * u * ey];
    g2.lineCap = 'round'; g2.strokeStyle = dead ? '#6A5530' : rgba(p[3], 0.9); g2.lineWidth = 3.2; g2.beginPath(); g2.moveTo(tx, ty); g2.quadraticCurveTo(cx, cy, ex, ey); g2.stroke();
    g2.strokeStyle = dead ? '#9A8250' : p[0]; g2.lineWidth = 1.6; g2.stroke();
    for (let j = 2; j <= 26; j++) {
      const u = j / 27, [px, py] = pt(u), [qx, qy] = pt(u + 0.03), tx2 = qx - px, ty2 = qy - py, L2 = Math.hypot(tx2, ty2) || 1, nx = -ty2 / L2, ny = tx2 / L2, ll = (dead ? 8 : 15) * Math.pow(Math.sin(u * Math.PI * 0.92 + 0.15), 0.8) + 2;
      for (const s of [-1, 1]) {
        const lx = px + (nx * s * 0.75 + tx2 / L2 * 0.55) * ll, ly = py + (ny * s * 0.75 + ty2 / L2 * 0.55) * ll + ll * 0.45;
        g2.strokeStyle = rgba(dead ? '#6A5530' : p[3], 0.75); g2.lineWidth = 2.1; g2.beginPath(); g2.moveTo(px, py); g2.quadraticCurveTo((px + lx) / 2, (py + ly) / 2 - 1.5, lx, ly); g2.stroke();
        g2.strokeStyle = dead ? '#A68C54' : (s * (lit ? -1 : 1) > 0 ? p[0] : p[1]); g2.lineWidth = 1.2; g2.stroke();
        if (snowy && s < 0 && j % 3 === 0) { g2.fillStyle = 'rgba(246,248,250,.95)'; g2.beginPath(); g2.ellipse(lx, ly - 1, 2, 1, 0, 0, TAU); g2.fill(); }
      }
    }
  };
  [[-1.2, 48, 46, true], [-2.9, 54, 38, true]].forEach(([a, len, d]) => frond(cr, a + Math.PI * 0.62, len * 0.7, d, false, true));
  const back = [-2.75, -2.2, -1.75, -1.35, -0.9, -0.4];
  back.forEach((a, k) => frond(cr, a, 62 + (k % 2) * 6, 22 + (k % 3) * 8, k < 3, false));
  [-3.05, 0.0, -0.15, -3.2].forEach((a, k) => frond(fr, a + (k > 1 ? 0 : 0), 58 - k * 3, 40 + k * 3, k % 2, false));
  // Coconuts under the crown.
  [[-5, 6, 4.4], [3, 7, 4.2], [-1, 11, 4], [8, 4, 3.8], [-9, 3, 3.6]].forEach(([dx, dy, r]) => { const x = tx + dx, y = ty + dy, gr = cr.createRadialGradient(x - 1.4, y - 1.6, 0.5, x, y, r + 1); gr.addColorStop(0, '#C09A62'); gr.addColorStop(0.55, '#7A5430'); gr.addColorStop(1, '#3E2A16'); cr.fillStyle = gr; cr.beginPath(); cr.arc(x, y, r, 0, TAU); cr.fill(); cr.strokeStyle = 'rgba(30,18,8,.6)'; cr.lineWidth = 0.7; cr.stroke(); });
  return { pivot: -90, sway: 0.016, swayFront: 0.028 };
} };

// ---- Drawing --------------------------------------------------------------------------------------------------------

const CACHE = new Map();
const seasonName = (i) => ['spring', 'summer', 'autumn', 'winter'][i] || 'summer';

function build(kind, season, snowy, variant, scale) {
  const sp = SPECIES[kind], rnd = rng(variant * 7919 + kind.length * 104729 + (season.charCodeAt(0) << 8));
  const w = sp.w, up = sp.up, down = 26, cvW = Math.ceil(w * 2 * scale), cvH = Math.ceil((up + down) * scale);
  const make = () => { const cv = document.createElement('canvas'); cv.width = cvW; cv.height = cvH; const g = cv.getContext('2d'); g.setTransform(scale, 0, 0, scale, w * scale, up * scale); return { cv, g }; };
  const under = make(), crown = make(), front = make();
  const meta = sp.paint({ under: under.g, crown: crown.g, front: front.g }, rnd, season, snowy) || {};
  return { w, up, down, under: under.cv, crown: crown.cv, front: front.cv, pivot: meta.pivot ?? -40, sway: meta.sway ?? 0.01, swayFront: meta.swayFront ?? meta.sway ?? 0.012 };
}

export const TREE_KINDS = Object.keys(SPECIES);

/**
 * Draw one tree with its base at (bx, by). `o`: { season: 0..3, snowy, variant, scale } and `t` the clock for the wind.
 * Returns where the crown sits, so a caller can add falling blossoms or leaves.
 */
export function drawTree(g, kind, bx, by, t, o) {
  const season = seasonName(o.season), snowy = !!o.snowy && season === 'winter', variant = (o.variant | 0) % 3, scale = Math.max(2, Math.min(4, Math.round((o.scale || 1) * 2 * 2) / 2));
  const key = `${kind}|${season}|${snowy ? 1 : 0}|${variant}|${scale}`;
  let s = CACHE.get(key);
  if (!s) { s = build(kind, season, snowy, variant, scale); CACHE.set(key, s); }
  // The sprite is painted large and drawn smaller, so it is crisp: `size` is how big the species stands against a tile.
  const k = o.size ?? SPECIES[kind].size ?? 1, x = bx - s.w * k, y = by - s.up * k, W = s.w * 2 * k, H = (s.up + s.down) * k, pv = s.pivot * k;
  g.drawImage(s.under, x, y, W, H);
  const swing = (amt, phase) => Math.sin(t * 0.7 + phase) * amt + Math.sin(t * 1.9 + phase * 2) * amt * 0.25;
  g.save(); g.translate(bx, by + pv); g.rotate(swing(s.sway, 0)); g.translate(-bx, -(by + pv)); g.drawImage(s.crown, x, y, W, H); g.restore();
  g.save(); g.translate(bx, by + pv); g.rotate(swing(s.swayFront, 1.3)); g.translate(-bx, -(by + pv)); g.drawImage(s.front, x, y, W, H); g.restore();
  return s;
}

export function clearTreeCache() { CACHE.clear(); }

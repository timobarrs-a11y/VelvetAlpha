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
  // Roots swell out of the trunk and dive into the ground, curving down as they go.
  for (let k = 0; k < roots; k++) { const s = k % 2 ? 1 : -1, len = wb * (1.2 + rnd() * 0.5) + (k > 1 ? 4 : 0); limb(g, s * wb * 0.35, -11, s * len, 5 + rnd() * 2.5, wb * 0.55, 1.4, col, s * 3.5); }
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

function shadow(g, rx, ry = rx * 0.4, rnd = null) {
  [[1.12, 0.1, 14], [0.88, 0.14, 11], [0.55, 0.2, 7]].forEach(([k, a, dx]) => { g.fillStyle = `rgba(22,40,18,${a})`; g.beginPath(); g.ellipse(dx, 3, rx * k, ry * k, 0, 0, TAU); g.fill(); });
  // Light coming through the leaves: pale flecks scattered over the shade.
  if (rnd) for (let i = 0; i < 16; i++) { const a = rnd() * TAU, d = Math.sqrt(rnd()) * 0.8; g.fillStyle = 'rgba(190,230,140,.14)'; g.beginPath(); g.ellipse(10 + Math.cos(a) * rx * d, 3 + Math.sin(a) * ry * d, 2 + rnd() * 3.5, 1 + rnd() * 1.6, 0, 0, TAU); g.fill(); }
}
/** Grass growing up round the foot of a trunk, so it stands in the lawn and not on it. */
function tufts(g, rnd, spread, season, snowy) {
  const cols = season === 'winter' ? ['#9DB08C', '#B7C6A6'] : ['#4E8A3E', '#7CBB55', '#A6D66E'];
  for (let i = 0; i < 16; i++) {
    const x = (rnd() - 0.5) * spread * 2, y = 1 + rnd() * 5, h = 3 + rnd() * 5;
    for (let k = -1; k <= 1; k++) { g.strokeStyle = cols[(i + k + 3) % cols.length]; g.lineWidth = 1.1; g.lineCap = 'round'; g.beginPath(); g.moveTo(x + k * 0.8, y); g.quadraticCurveTo(x + k * 1.6, y - h * 0.6, x + k * 2.6 + (rnd() - 0.5), y - h); g.stroke(); }
  }
  if (snowy) for (let i = 0; i < 7; i++) { g.fillStyle = 'rgba(246,248,250,.95)'; g.beginPath(); g.ellipse((rnd() - 0.5) * spread * 2, 2 + rnd() * 4, 4 + rnd() * 3, 1.6, 0, 0, TAU); g.fill(); }
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
  if (o.outline !== false) { path(1.5); g.fillStyle = rgba(p.edge, 0.5); g.fill(); }
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
  const e = Math.round((Math.PI * (rx + ry)) / (o.edgeStep ?? 4.6));
  for (let i = 0; i < e; i++) {
    const a = rnd() * TAU, r = 0.94 + rnd() * 0.12, ex = cx + Math.cos(a) * rx * r, ey = cy + Math.sin(a) * ry * r, sun = (-Math.cos(a) - Math.sin(a)) / 1.4;
    const ang = a + (rnd() - 0.5) * 0.9, len = L * (0.62 + rnd() * 0.5);
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
  shadow(L.under, S.shadow, undefined, season === 'winter' ? null : rnd);
  trunk(L.under, rnd, S.trunk);
  tufts(L.under, rnd, S.trunk.wb * 1.5, season, snowy);
  if (season !== 'winter') S.limbs.forEach(([x0, y0, x1, y1, w0, w1, bend]) => limb(L.under, x0, y0, x1, y1, w0, w1, S.trunk.col, bend || 0));
  if (S.fallen && season === 'autumn') S.fallen(L.under, rnd);
  if (season === 'winter') {
    // Bare: the crown is grown branch by branch from the top of the trunk, so it is never the same twice.
    const B = S.bare, col = shade(S.trunk.col, -0.04), top = [S.trunk.lean, -S.trunk.h * 0.94];
    for (let i = 0; i < B.limbs; i++) { const u = B.limbs === 1 ? 0 : i / (B.limbs - 1) - 0.5, a = -Math.PI / 2 + u * B.spread + (rnd() - 0.5) * 0.22; grow(L.crown, rnd, top[0], top[1], a, B.len * (0.85 + rnd() * 0.3), B.w, B.depth, col, snowy, B); }
    return { pivot: -S.trunk.h * 0.9, sway: 0.006, spots: S.fruitSpots?.(rnd) };
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
  return { pivot: -S.trunk.h * 0.9, sway: 0.012, spots: S.fruitSpots?.(rnd) };
}

const variantJitter = (rnd, list, a = 9) => list.map(([x, y, rx, ry]) => [x + (rnd() - 0.5) * a, y + (rnd() - 0.5) * a * 0.7, rx * (0.84 + rnd() * 0.3), ry * (0.84 + rnd() * 0.3)]);

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
    leaf: 2.7, density: 4.6, lumpy: 0.4,
    fallen: (g) => { for (let i = 0; i < 9; i++) leaf(g, (rnd() - 0.5) * 80, 4 + rnd() * 7, rnd() * 3, 3, 1.7, rgba(['#C2412B', '#E0762C', '#E8B02F'][i % 3], 0.9)); },
  };
  return broadleaf(L, rnd, season, snowy, S);
} };

// A graceful umbrella: a slim dark curving trunk, limbs sweeping out flat, and the crown in layered sprays, pink with blossom in spring.
SPECIES.cherry = { w: 88, up: 130, size: 0.55, paint(L, rnd, season, snowy) {
  const lean = -8 + rnd() * 6;
  const S = {
    shadow: 56, trunk: { h: 46, wb: 10, wt: 4.8, lean, col: '#4E3436', furrows: 5, roots: 3 },
    limbs: [[lean, -40, -38, -58, 5.4, 2.4, -7], [lean, -42, 40, -62, 5.4, 2.4, 7], [lean, -44, lean + 4, -80, 4.4, 2, 0], [lean - 2, -36, -58, -46, 3.8, 1.6, -4], [lean + 2, -38, 60, -50, 3.8, 1.6, 4], [lean, -44, -14, -72, 3, 1.4, -3], [lean, -46, 18, -76, 3, 1.4, 3]],
    limbs2: [[-38, -58, -52, -72, 2.4, 1.2], [40, -62, 54, -74, 2.4, 1.2], [-58, -46, -72, -56, 2, 1]],
    tips: [], twig: 22,
    bare: { limbs: 6, spread: 2.5, len: 30, w: 5, depth: 5, up: 0.04, droop: 0.02 },
    // Sprays in tiers with air between them: the top ones behind, the lowest in front, the limbs showing through the gaps.
    back: variantJitter(rnd, [[-28, -92, 20, 10], [6, -98, 22, 10], [34, -88, 18, 9], [-52, -76, 18, 9]]),
    mid: variantJitter(rnd, [[-50, -66, 22, 10], [-18, -78, 24, 11], [16, -80, 24, 11], [50, -68, 22, 10], [70, -52, 14, 7]]),
    front: variantJitter(rnd, [[-62, -52, 18, 8], [-30, -60, 22, 9], [4, -66, 22, 9], [36, -58, 22, 9], [60, -48, 16, 7]]),
    fruitSpots: (r) => Array.from({ length: 9 }, () => [-58 + r() * 116, -46 + r() * 14]),
    leaf: 2.6, density: 4.6, lumpy: 0.34,
    palette: { spring: { base: '#F4B3C8', hi: '#FFE9F0', lo: '#C96C92', edge: '#8E3F63' }, summer: { base: '#4E9446', hi: '#86C562', lo: '#1F5A2F', edge: '#17401F' },
      autumn: { base: '#D9622E', hi: '#F2B04E', lo: '#8A2A24', edge: '#5A1E18' } },
    accent: { spring: ['#FFFFFF', '#FBD3E0', '#E58AAE', '#F7A8C2'] }, accentN: { spring: 22 },
    after: (G, r, s) => { if (s !== 'spring') return; for (let i = 0; i < 70; i++) { const a = r() * TAU, d = Math.sqrt(r()), x = Math.cos(a) * 66 * d, y = -70 + Math.sin(a) * 26 * d; for (let k = 0; k < 5; k++) { const pa = (k / 5) * TAU; leaf(G.crown, x + Math.cos(pa) * 1.7, y + Math.sin(pa) * 1.7, pa, 1.6, 1.05, i % 3 ? '#FFF6F8' : '#F9BED2'); } G.crown.fillStyle = '#E2799E'; G.crown.beginPath(); G.crown.arc(x, y, 0.75, 0, TAU); G.crown.fill(); }
      // A few sprays of blossom hanging over the front, swinging a little more than the crown.
      for (let i = 0; i < 9; i++) { const x = -60 + r() * 120, y = -52 + r() * 10; for (let k = 0; k < 6; k++) { const yy = y + k * 3.2, xx = x + Math.sin(k + i) * 1.2; for (let m = 0; m < 5; m++) { const pa = (m / 5) * TAU; leaf(G.front, xx + Math.cos(pa) * 1.5, yy + Math.sin(pa) * 1.5, pa, 1.4, 0.9, k % 2 ? '#FFF2F6' : '#F7B3CB'); } } } },
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
    fruitSpots: (r) => Array.from({ length: 12 }, () => { const a = r() * TAU, d = Math.sqrt(r()) * 0.82; return [Math.cos(a) * 34 * d, -50 + Math.sin(a) * 17 * d]; }),
    after: (G, r, s) => {
      const c = G.crown;
      if (s === 'spring') for (let i = 0; i < 46; i++) { const a = r() * TAU, d = Math.sqrt(r()), x = Math.cos(a) * 36 * d, y = -52 + Math.sin(a) * 18 * d; for (let k = 0; k < 5; k++) { const pa = (k / 5) * TAU; leaf(c, x + Math.cos(pa) * 1.7, y + Math.sin(pa) * 1.7, pa, 1.6, 1.1, i % 4 ? '#FFF8F8' : '#FBD0DC'); } c.fillStyle = '#E9C54A'; c.beginPath(); c.arc(x, y, 0.8, 0, TAU); c.fill(); }
    },
  };
  return broadleaf(L, rnd, season, snowy, S);
} };

// A tall cone of drooping boughs: tier on tier of branches that sweep out from the trunk and hang at the tips, each with sprays of needles
// along it, so the edge is ragged and every tier overhangs the one below. Evergreen: only the tone and the snow change with the season.
SPECIES.pine = { w: 62, up: 170, size: 0.75, paint(L, rnd, season, snowy) {
  const g = L.crown, [base, hi, lo] = { spring: ['#3E8A4A', '#86C870', '#1F5A2E'], summer: ['#2F7040', '#68AA64', '#164A28'], autumn: ['#2F6A40', '#5E9E5A', '#154428'], winter: ['#2A5E48', '#62A088', '#143E34'] }[season], tiers = 10, top = -150, bot = -26;
  shadow(L.under, 48, undefined, rnd); trunk(L.under, rnd, { h: 60, wb: 8, wt: 4, col: '#5A3E2E', furrows: 5, roots: 3 }); tufts(L.under, rnd, 12, season, snowy);
  limb(L.under, 0, -50, 0, top - 4, 4, 1.6, '#5A3E2E');
  g.lineCap = 'round';
  for (let i = 0; i < tiers; i++) {
    const u = i / (tiers - 1), y = top + (bot - top) * u, reach = 9 + Math.pow(u, 0.92) * 38, nb = 6 + Math.round(u * 4);
    // A solid core, so no tier has holes through to the sky.
    const core = g.createLinearGradient(-reach, 0, reach, 0); core.addColorStop(0, base); core.addColorStop(0.55, shade(base, -0.12)); core.addColorStop(1, lo);
    g.fillStyle = core; g.beginPath(); g.moveTo(0, y - 14 - u * 4); g.lineTo(-reach * 0.62, y + 8); g.lineTo(reach * 0.62, y + 8); g.closePath(); g.fill();
    const boughs = [];
    for (let b = 0; b < nb; b++) boughs.push({ side: b % 2 ? 1 : -1, len: reach * (0.62 + rnd() * 0.38), y: y + (rnd() - 0.5) * 8 + (b % 3) * 2, drop: 0.3 + rnd() * 0.2 });
    boughs.sort((a, b2) => a.len - b2.len).reverse().forEach((bg, bi) => {
      const sx = (rnd() - 0.5) * 2, ex = sx + bg.side * bg.len, ey = bg.y + bg.len * bg.drop + 3, cx = sx + bg.side * bg.len * 0.55, cy = bg.y - 4 - bg.len * 0.05;
      const pt = (f) => [(1 - f) * (1 - f) * sx + 2 * (1 - f) * f * cx + f * f * ex, (1 - f) * (1 - f) * bg.y + 2 * (1 - f) * f * cy + f * f * ey];
      g.strokeStyle = rgba(shade(lo, -0.3), 0.95); g.lineWidth = 3; g.beginPath(); g.moveTo(sx, bg.y); g.quadraticCurveTo(cx, cy, ex, ey); g.stroke();
      const m = Math.max(4, Math.round(bg.len / 2.6));
      for (let k = 1; k <= m; k++) {
        const f = k / m, [px, py] = pt(f), [qx, qy] = pt(Math.min(1, f + 0.04)), tang = Math.atan2(qy - py, qx - px), lit = bg.side < 0 ? hi : (f < 0.5 ? base : lo);
        for (const sgn of [-1, 1]) {
          const ang = tang + sgn * 1.05 + (rnd() - 0.5) * 0.3, len = 6.5 + rnd() * 3 + (1 - f) * 1.5, ex2 = px + Math.cos(ang) * len, ey2 = py + Math.sin(ang) * len * 0.9 + 1.2;
          g.strokeStyle = rgba(shade(lo, -0.15), 0.8); g.lineWidth = 2; g.beginPath(); g.moveTo(px, py); g.lineTo(ex2, ey2); g.stroke();
          g.strokeStyle = (k + (sgn > 0 ? 1 : 0)) % 2 ? lit : mix(lit, '#ffffff', 0.14); g.lineWidth = 1.2; g.stroke();
          if (season === 'spring' && f > 0.78) { g.strokeStyle = '#BDE67F'; g.lineWidth = 1; g.beginPath(); g.moveTo(px + Math.cos(ang) * len * 0.5, py + Math.sin(ang) * len * 0.45); g.lineTo(ex2, ey2); g.stroke(); }
        }
        if (snowy && k % 2 === 0) { g.fillStyle = 'rgba(246,248,250,.97)'; g.beginPath(); g.ellipse(px, py - 1.8, 3.4, 1.6, tang, 0, TAU); g.fill(); }
      }
      if (snowy) { g.strokeStyle = 'rgba(246,248,250,.97)'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(sx, bg.y - 1.5); g.quadraticCurveTo(cx, cy - 1.5, ex, ey - 1.5); g.stroke(); }
      if ((i === 6 || i === 8) && bi === 1) { g.fillStyle = '#7A5A3A'; g.beginPath(); g.ellipse(ex, ey + 4, 2.4, 4.2, 0.2, 0, TAU); g.fill(); g.strokeStyle = 'rgba(40,24,12,.6)'; g.lineWidth = 0.7; g.stroke(); }
    });
  }
  g.strokeStyle = shade(base, -0.1); g.lineWidth = 2.2; g.beginPath(); g.moveTo(0, top - 14); g.lineTo(0.5, top - 24); g.stroke();
  return { pivot: -12, sway: 0.007 };
} };

// A slender white trunk, usually two or three together, with dark bark marks, fine pale branches and light trembling clusters of small leaves.
SPECIES.birch = { w: 60, up: 152, size: 0.8, paint(L, rnd, season, snowy) {
  const stems = [{ x: 0, h: 104, w: 6.5, lean: (rnd() - 0.5) * 8 }, { x: -9, h: 84, w: 4.6, lean: -16 - rnd() * 6 }, { x: 8, h: 74, w: 4, lean: 15 + rnd() * 6 }];
  shadow(L.under, 40, undefined, season === 'winter' ? null : rnd); tufts(L.under, rnd, 14, season, snowy);
  const barkCol = '#F1EDE4', twigCol = season === 'winter' ? '#8A6A58' : '#BFB3A4', tips = [];
  stems.forEach((s, si) => {
    L.under.save(); L.under.translate(s.x, 0);
    trunk(L.under, rnd, { h: s.h, wb: s.w * 1.25, wt: s.w * 0.55, lean: s.lean, col: barkCol, furrows: 0, roots: 0 });
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
  // Light, airy foliage: a small cluster at the end of each branch with sky between, and a few leaves hanging loose in front.
  tips.forEach(([x, y], k) => {
    clump(L.crown, rnd, x + (rnd() - 0.5) * 6, y - 2, 9 + rnd() * 3, 7.5 + rnd() * 2.5, { base: pal[0], hi: pal[1], lo: pal[2], edge: pal[3] }, { leaf: 3.4, density: 9, lumpy: 0.5, edgeStep: 3.4 });
    if (k % 2) clump(L.crown, rnd, x + (rnd() - 0.5) * 14, y + 8 + rnd() * 6, 7, 6, { base: pal[0], hi: pal[1], lo: pal[2], edge: pal[3] }, { leaf: 3.4, density: 9, lumpy: 0.5, edgeStep: 3.4 });
    for (let d = 0; d < 6; d++) { const dx = x + (rnd() - 0.5) * 20, dy = y + 7 + rnd() * 12; leaf(L.front, dx, dy, 1.5 + (rnd() - 0.5) * 0.6, 4.4, 1.7, rgba(d % 2 ? pal[0] : pal[1], 0.95)); }
  });
  return { pivot: -50, sway: 0.012, swayFront: 0.02 };
} };

// A heavy leaning trunk under a rounded dome, with curtains of leaves hanging to the ground in three depths (behind the trunk, beside it and
// across the front, leaving gaps to see the trunk through) that swing in the wind.
SPECIES.willow = { w: 106, up: 140, size: 0.5, paint(L, rnd, season, snowy) {
  const p = { spring: ['#A8D468', '#D6F08E', '#5E9A3A', '#2E6A2E'], summer: ['#7EB654', '#A8D878', '#3F7E32', '#1F5A28'], autumn: ['#D8B442', '#F2DC78', '#A87A22', '#6A4A18'], winter: ['#B49A5C', '#D8C488', '#7A6A3A', '#4A3A22'] }[season];
  const lean = -6 + rnd() * 4, col = '#6B5238', winter = season === 'winter';
  shadow(L.under, 66, undefined, winter ? null : rnd); trunk(L.under, rnd, { h: 42, wb: 19, wt: 10, lean, col, furrows: 9, roots: 4 }); tufts(L.under, rnd, 28, season, snowy);
  const arms = [[lean, -40, -40, -66, 10, 4.4, -8], [lean, -42, 42, -68, 10, 4.4, 8], [lean, -44, lean + 2, -82, 8, 3.6, 0], [lean - 2, -36, -66, -54, 6.4, 2.8, -6], [lean + 2, -38, 68, -56, 6.4, 2.8, 6]];
  if (!winter) arms.forEach(([x0, y0, x1, y1, w0, w1, b]) => limb(L.under, x0, y0, x1, y1, w0, w1, col, b));
  else arms.forEach(([x0, y0, x1, y1]) => grow(L.crown, rnd, x0, y0, Math.atan2(y1 - y0, x1 - x0), 24, 5.4, 3, shade(col, 0.05), snowy, { up: 0.05, droop: 0.05 }));
  const arch = (u) => [-76 + u * 152, -50 - Math.sin(u * Math.PI) * 44];
  // One curtain strand: a curve from its anchor to near the ground, with leaves along it in pairs, a few each side.
  const strand = (g, u, dark, n, lenJit) => {
    const [sx, sy] = arch(u), ey = -3 - rnd() * 16 - lenJit, bow = (rnd() - 0.5) * 16 + (u - 0.5) * 20, ex = sx + bow, cx = sx + bow * 0.1 - (u - 0.5) * 8, cy = sy + (ey - sy) * 0.42;
    const pt = (f) => [(1 - f) * (1 - f) * sx + 2 * (1 - f) * f * cx + f * f * ex, (1 - f) * (1 - f) * sy + 2 * (1 - f) * f * cy + f * f * ey], tone = (c) => (dark ? shade(c, -0.28) : c);
    g.lineCap = 'round'; g.strokeStyle = rgba(shade(p[2], -0.3), 0.85); g.lineWidth = winter ? 1.4 : 2.1; g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(cx, cy, ex, ey); g.stroke();
    g.strokeStyle = tone(winter ? p[0] : p[2]); g.lineWidth = winter ? 0.9 : 1.1; g.stroke();
    // Leaves lie along the strand, flaring a little to each side, so it hangs like a switch of leaves and not a stack of slashes.
    if (!winter) for (let j = 1; j <= n; j++) { const f = j / (n + 1) * 0.96 + 0.04, [x, y] = pt(f), [x2, y2] = pt(f + 0.03), tang = Math.atan2(y2 - y, x2 - x), side = j % 2 ? 1 : -1, ln = 5.2 * (0.8 + rnd() * 0.5);
      leaf(g, x + Math.cos(tang + side * 0.5) * ln * 0.7, y + Math.sin(tang + side * 0.5) * ln * 0.7, tang + side * 0.45, ln, 1.25, tone(j % 3 ? p[0] : p[1]));
      if (j % 2 === 0) leaf(g, x + Math.cos(tang - side * 0.5) * ln * 0.6, y + Math.sin(tang - side * 0.5) * ln * 0.6, tang - side * 0.5, ln * 0.85, 1.15, rgba(tone(p[2]), 0.95)); }
    if (snowy && winter) { g.fillStyle = 'rgba(246,248,250,.95)'; g.beginPath(); g.ellipse(sx, sy - 1, 2.6, 1.4, 0, 0, TAU); g.fill(); }
  };
  const nb = winter ? 14 : 28, nm = winter ? 10 : 22, nf = winter ? 8 : 14, leaves = winter ? 0 : 11;
  for (let k = 0; k < nb; k++) strand(L.back, (k + rnd() * 0.7) / nb, true, leaves, 4);
  if (!winter) {
    // The dome of leaves the curtains hang from, built along the arch so it is round and not a flat hat.
    for (let k = 0; k <= 8; k++) { const [x, y] = arch(k / 8); clump(L.crown, rnd, x * 0.94, y + 8, 21, 14, { base: shade(p[0], -0.1), hi: p[1], lo: p[2], edge: p[3] }, { leaf: 3.4, density: 7, lumpy: 0.36 }); }
    [[-30, -86], [0, -98], [30, -86], [-52, -72], [52, -74], [0, -80]].forEach(([x, y]) => clump(L.crown, rnd, x, y, 22, 14, { base: p[0], hi: p[1], lo: p[2], edge: p[3] }, { leaf: 3.4, density: 7, lumpy: 0.36 }));
  }
  for (let k = 0; k < nm; k++) strand(L.crown, (k + rnd() * 0.7) / nm, false, leaves, 0);
  for (let k = 0; k < nf; k++) { const u = k < nf * 0.4 ? 0.04 + (k / (nf * 0.4)) * 0.26 : k < nf * 0.8 ? 0.7 + ((k - nf * 0.4) / (nf * 0.4)) * 0.26 : 0.4 + rnd() * 0.2; strand(L.front, u, false, leaves, 6 + rnd() * 6); }
  return { pivot: -64, sway: 0.007, swayFront: 0.022, swayBack: 0.004 };
} };

// A bare curved ringed trunk topped by a burst of long arching fronds, each feathered with leaflets, and a cluster of coconuts.
SPECIES.palm = { w: 84, up: 156, size: 0.7, paint(L, rnd, season, snowy) {
  const lean = 14 + rnd() * 8, top = [lean, -100], p = { spring: ['#4DB04F', '#8AD36A', '#206A32', '#124A22'], summer: ['#3F9E48', '#7CCB60', '#1B5E2C', '#0F4020'], autumn: ['#6CA44A', '#A8CC66', '#4A7A2E', '#2E5420'], winter: ['#3A8A58', '#6CB890', '#18523A', '#0E3A28'] }[season];
  shadow(L.under, 44, undefined, rnd);
  // The trunk: ring by ring along a curve, slightly swollen at the foot, each ring lit on its left.
  const at = (u) => [(1 - u) * (1 - u) * 0 + 2 * (1 - u) * u * (lean * 0.1 - 4) + u * u * lean, -u * 100];
  const g = L.under; let prev = at(0);
  for (let i = 1; i <= 22; i++) {
    const u = i / 22, [x, y] = at(u), w0 = 8.5 - (i - 1) * 0.2 + (i < 3 ? 2 : 0), w1 = 8.5 - i * 0.2 + (i < 3 ? 1.5 : 0), col = i % 2 ? '#A88862' : '#9A7A56';
    const lg = g.createLinearGradient(x - w1, 0, x + w1, 0); lg.addColorStop(0, shade(col, 0.2)); lg.addColorStop(0.55, col); lg.addColorStop(1, shade(col, -0.36));
    g.fillStyle = lg; g.beginPath(); g.moveTo(prev[0] - w0 / 2, prev[1]); g.lineTo(prev[0] + w0 / 2, prev[1]); g.lineTo(x + w1 / 2, y); g.lineTo(x - w1 / 2, y); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(60,40,24,.5)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(x - w1 / 2, y); g.quadraticCurveTo(x, y + 1.6, x + w1 / 2, y); g.stroke(); prev = [x, y];
  }
  tufts(g, rnd, 12, season, snowy);
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
  return { pivot: -90, sway: 0.016, swayFront: 0.028, spots: [[-5, 6], [3, 7], [-1, 11], [8, 4], [-9, 3]].map(([dx, dy]) => [tx + dx, ty + dy]) };
} };

// ---- Drawing --------------------------------------------------------------------------------------------------------

const CACHE = new Map();
const seasonName = (i) => ['spring', 'summer', 'autumn', 'winter'][i] || 'summer';

function build(kind, season, snowy, variant, scale) {
  const sp = SPECIES[kind], rnd = rng(variant * 7919 + kind.length * 104729 + (season.charCodeAt(0) << 8));
  const w = sp.w, up = sp.up, down = 26, cvW = Math.ceil(w * 2 * scale), cvH = Math.ceil((up + down) * scale);
  const make = () => { const cv = document.createElement('canvas'); cv.width = cvW; cv.height = cvH; const g = cv.getContext('2d'); g.setTransform(scale, 0, 0, scale, w * scale, up * scale); return { cv, g }; };
  const back = make(), under = make(), crown = make(), front = make();
  const meta = sp.paint({ back: back.g, under: under.g, crown: crown.g, front: front.g }, rnd, season, snowy) || {};
  return { w, up, down, spots: meta.spots || [], back: back.cv, under: under.cv, crown: crown.cv, front: front.cv, pivot: meta.pivot ?? -40, sway: meta.sway ?? 0.01, swayFront: meta.swayFront ?? meta.sway ?? 0.012, swayBack: meta.swayBack ?? meta.sway ?? 0.008 };
}

export const TREE_KINDS = Object.keys(SPECIES);

// ---- Fruit and growth -----------------------------------------------------------------------------------------------
// A fruit tree is one painted tree (above). What changes is drawn over it: a sapling while it is young, the tree growing up, and then the
// fruit, small and green at first and swelling and colouring as the time passes until it is ripe.

export const FRUIT = {
  apple: { count: 4, r: 4.8, from: '#8FC85A', to: '#D2372B', hi: '#FF9A8E' },
  cherry: { count: 3, r: 3.5, from: '#A6D064', to: '#B5121B', hi: '#FF8A92', pair: true },
  palm: { count: 3, r: 6, from: '#92C25C', to: '#7A5430', hi: '#D2B07A' },
};
const SAPLING = { apple: '#7CBB55', cherry: '#6FAE5C', palm: '#4DAE56' };
const ease = (u) => u * u * (3 - 2 * u);

/** A young sapling: a thin bending stem with a stake and a tie, pairs of glossy young leaves that grow bigger toward the top, and a new bud. */
function sapling(g, kind, bx, by, t, k) {
  const sw = Math.sin(t * 1.1) * 1.8 * k, col = SAPLING[kind] || '#7CBB55', H = 34 * k;
  g.save(); g.translate(bx, by);
  g.fillStyle = 'rgba(22,40,18,.22)'; g.beginPath(); g.ellipse(6 * k, 2 * k, 13 * k, 4.5 * k, 0, 0, TAU); g.fill();
  g.fillStyle = '#6A4C34'; g.beginPath(); g.ellipse(0, 1.5 * k, 6 * k, 2.2 * k, 0, 0, TAU); g.fill();
  g.strokeStyle = '#A98A5C'; g.lineWidth = 1.8 * k; g.lineCap = 'round'; g.beginPath(); g.moveTo(-7 * k, 2 * k); g.lineTo(-7 * k, -H * 0.82); g.stroke();
  g.strokeStyle = '#6A4C34'; g.lineWidth = 2.6 * k; g.beginPath(); g.moveTo(0, 1 * k); g.quadraticCurveTo(sw * 0.25, -H * 0.4, sw, -H); g.stroke();
  g.strokeStyle = '#E8D9A8'; g.lineWidth = 1 * k; g.beginPath(); g.moveTo(-7 * k, -H * 0.5); g.lineTo(sw * 0.2 + 0.5 * k, -H * 0.5); g.stroke();
  for (let i = 0; i < 6; i++) {
    const f = (i + 1.5) / 7.5, y = -H * f, x = sw * f * f, side = i % 2 ? 1 : -1, big = (kind === 'palm' ? 11 : 7.4) * k * (1.1 - f * 0.5), a = side * (kind === 'palm' ? 0.5 : 0.8) - 0.2;
    leaf(g, x + side * big * 0.9, y + 1 * k, a, big, (kind === 'palm' ? 1.5 : 3.2) * k, shade(col, i % 2 ? -0.12 : 0.05)); leaf(g, x + side * big * 0.9, y + 0.2 * k, a, big * 0.85, (kind === 'palm' ? 0.6 : 1.2) * k, rgba(shade(col, 0.35), 0.7));
  }
  leaf(g, sw, -H - 3 * k, -1.57, 4.4 * k, 2 * k, shade(col, 0.28));
  g.restore();
}

/** One piece of fruit at its stage `p` (0 a bud, 1 ripe), hanging from (x, y). */
function fruitAt(g, kind, x, y, p, k, t, seed) {
  const f = FRUIT[kind], q = clamp(p, 0, 1), r = f.r * k * (0.28 + 0.72 * ease(q)), col = mix(f.from, f.to, Math.pow(q, 1.4)), bob = Math.sin(t * 1.6 + seed) * 0.3 * k;
  const one = (px, py, rr) => {
    const gr = g.createRadialGradient(px - rr * 0.35, py - rr * 0.4, rr * 0.1, px, py, rr * 1.05); gr.addColorStop(0, shade(col, 0.32)); gr.addColorStop(0.55, col); gr.addColorStop(1, shade(col, -0.42));
    g.fillStyle = gr; g.beginPath(); g.arc(px, py, rr, 0, TAU); g.fill(); g.strokeStyle = rgba(shade(col, -0.65), 0.55); g.lineWidth = Math.max(0.5, 0.7 * k); g.stroke();
    if (q > 0.85) { g.fillStyle = rgba(f.hi, 0.75); g.beginPath(); g.ellipse(px - rr * 0.35, py - rr * 0.4, rr * 0.28, rr * 0.18, -0.6, 0, TAU); g.fill(); }
  };
  if (f.pair) {
    g.strokeStyle = '#5E7A3A'; g.lineWidth = 0.8 * k; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y - 5 * k); g.lineTo(x - 2.4 * k, y + 2 * k + bob); g.moveTo(x, y - 5 * k); g.lineTo(x + 2.6 * k, y + 1 * k + bob); g.stroke();
    one(x - 2.4 * k, y + 2.4 * k + bob, r); one(x + 2.6 * k, y + 1.6 * k + bob, r * 0.95);
  } else {
    if (kind === 'apple') { g.strokeStyle = '#5A4228'; g.lineWidth = 0.9 * k; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y - r * 0.7 + bob); g.lineTo(x + 0.6 * k, y - r * 1.5 + bob); g.stroke(); leaf(g, x + 2.2 * k, y - r * 1.4 + bob, -0.5, 2.4 * k, 1.1 * k, '#5E9A3A'); }
    one(x, y + bob, r);
  }
}

/**
 * Draw one tree with its base at (bx, by). `o`: { season: 0..3, snowy, variant, scale, size, grow (0 a sapling .. 1 grown, default 1),
 * fruit ({ t: 0..1 how far the fruit has come, 0 none }), shake (seconds since it was shaken, while it is still falling), fallen (the
 * fruit that fell, so it can be drawn dropping) }; `t` is the clock for the wind.
 */
export function drawTree(g, kind, bx, by, t, o) {
  const season = seasonName(o.season), snowy = !!o.snowy && season === 'winter', variant = (o.variant | 0) % 3, scale = Math.max(2, Math.min(4, Math.round((o.scale || 1) * 2 * 2) / 2));
  const grow = o.grow === undefined ? 1 : clamp(o.grow, 0, 1), full = o.size ?? SPECIES[kind].size ?? 1;
  if (grow < 0.16) { sapling(g, kind, bx, by, t, 0.95 + grow * 3.5); return null; }
  const key = `${kind}|${season}|${snowy ? 1 : 0}|${variant}|${scale}`;
  let s = CACHE.get(key);
  if (!s) { s = build(kind, season, snowy, variant, scale); CACHE.set(key, s); }
  // A young tree is the grown tree, smaller: it stands up through the stages as it grows.
  const k = full * (grow >= 1 ? 1 : 0.3 + 0.7 * ease((grow - 0.16) / 0.84)), x = bx - s.w * k, y = by - s.up * k, W = s.w * 2 * k, H = (s.up + s.down) * k, pv = s.pivot * k;
  const shk = o.shake > 0 && o.shake < 1.4 ? Math.sin(o.shake * 34) * 0.03 * Math.exp(-o.shake * 2.6) : 0;
  const swing = (amt, phase) => Math.sin(t * 0.7 + phase) * amt + Math.sin(t * 1.9 + phase * 2) * amt * 0.25;
  g.save(); g.translate(bx, by + pv); g.rotate(swing(s.swayBack, 2.4)); g.translate(-bx, -(by + pv)); g.drawImage(s.back, x, y, W, H); g.restore();
  g.drawImage(s.under, x, y, W, H);
  g.save(); g.translate(bx, by + pv); g.rotate(swing(s.sway, 0) + shk); g.translate(-bx, -(by + pv)); g.drawImage(s.crown, x, y, W, H);
  // The fruit rides on the crown, so it sways with it. A tree bears none in winter.
  const fr = FRUIT[kind];
  if (fr && grow >= 1 && o.fruit && o.fruit.t > 0 && season !== 'winter') {
    const f = o.fruit.t;
    for (let i = 0; i < fr.count && i < s.spots.length; i++) { const [sx, sy] = s.spots[i]; fruitAt(g, kind, bx + sx * k, by + sy * k, clamp((f - i * 0.05) / 0.8, 0, 1), k, t, i); }
  }
  g.restore();
  g.save(); g.translate(bx, by + pv); g.rotate(swing(s.swayFront, 1.3) + shk * 1.3); g.translate(-bx, -(by + pv)); g.drawImage(s.front, x, y, W, H); g.restore();
  // Fruit knocked off by a shake falls to the ground, bounces once and is gone.
  if (fr && o.shake > 0 && o.shake < 1.1 && o.fallen > 0) {
    for (let i = 0; i < fr.count && i < s.spots.length && i < o.fallen; i++) {
      const [sx, sy] = s.spots[i], dur = 0.5 + i * 0.05, a = Math.min(o.shake, dur + 0.5), drop = Math.min(a, dur), fall = (-sy * k) * (drop / dur) ** 2, rest = a > dur ? Math.abs(Math.sin((a - dur) * 9)) * 5 * k * Math.exp(-(a - dur) * 5) : 0;
      g.globalAlpha = o.shake > 0.8 ? Math.max(0, 1 - (o.shake - 0.8) / 0.3) : 1; fruitAt(g, kind, bx + sx * k, by + sy * k + fall - rest + 2 * k, 1, k, t, i); g.globalAlpha = 1;
    }
  }
  return s;
}

export function clearTreeCache() { CACHE.clear(); }

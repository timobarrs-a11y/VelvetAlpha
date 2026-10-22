/* eslint-disable */
// Velvet World street art kit.
//
// Everything is drawn in code on a 2D canvas, in the same 2:1 isometric projection and face
// shading as the Velvet House game (src/games/velvet-house/art/houseArt.js), so the street and
// the game read as one world. No image files.
//
// World units: x runs along the street, y runs toward the street (houses face +y), z is up.
// All draw functions work in "iso pixels"; the caller applies camera pan and zoom with
// ctx.setTransform before calling them. One plot is LOT_W tiles wide.
//
// Layers per plot (so a plot can be cached as two images and only the live bits redrawn):
//   drawPlot(ctx, plot, i, 'back', env)   ground, house, car, static yard objects  -> returns meta
//   drawPlotLive(ctx, plot, i, meta, t, env)   member animations: tree sway, pets, fountain, flag, smoke
//   drawPlot(ctx, plot, i, 'front', env)  billboard, mailbox, side hedge
//   (caller multiplies the whole frame by lightingAt(hour).tint)
//   drawPlotLights(ctx, plot, i, meta, t, env)  windows, lamps, signs: anything that glows

export const TW = 32, TH = 16, ZH = 34;
export const LOT_W = 10;
export const STREET = { lawnFront: 8.2, walkFront: 9.15, vergeFront: 9.95, road0: 10.1, road1: 13.7, farVerge1: 14.9, farWalk1: 15.9 };
export const STREET_NAME = 'Maple Street';
export const FONTS = {
  ui: '"Instrument Sans", system-ui, sans-serif',
  display: '"Bricolage Grotesque", "Instrument Sans", system-ui, sans-serif',
  slab: '"Alfa Slab One", Georgia, serif',
  serif: '"Fraunces", Georgia, serif',
  neon: '"Yellowtail", "Brush Script MT", cursive',
};

export function iso(x, y, z = 0) { return [(x - y) * TW, (x + y) * TH - z * ZH]; }

// ---------------------------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------------------------
export const HOUSE_STYLES = [
  { id: 'standard', label: 'Classic', free: true },
  { id: 'colonial', label: 'Brick colonial' },
  { id: 'craftsman', label: 'Craftsman' },
  { id: 'victorian', label: 'Victorian' },
  { id: 'modern', label: 'Modern' },
  { id: 'villa', label: 'Villa' },
];
export const WINDOW_STYLES = [
  { id: 'classic', label: 'Classic' }, { id: 'shutters', label: 'Shutters' },
  { id: 'arched', label: 'Arched' }, { id: 'picture', label: 'Picture' },
];
export const BILLBOARD_STYLES = [
  { id: 'post', label: 'Post sign', free: true }, { id: 'classic', label: 'Billboard' },
  { id: 'marquee', label: 'Marquee' }, { id: 'round', label: 'Round' },
  { id: 'hanging', label: 'Hanging' }, { id: 'neon', label: 'Neon' },
];
export const CAR_TYPES = [
  { id: 'none', label: 'No car' }, { id: 'hatch', label: 'Hatchback' }, { id: 'suv', label: 'SUV' },
  { id: 'pickup', label: 'Pickup' }, { id: 'vintage', label: 'Vintage' },
];
export const PET_TYPES = [{ id: 'none', label: 'No pet' }, { id: 'dog', label: 'Dog' }, { id: 'cat', label: 'Cat' }];
export const LAWN_STYLES = [
  { id: 'plain', label: 'Lawn', free: true }, { id: 'striped', label: 'Striped' }, { id: 'garden', label: 'Flower beds' },
  { id: 'meadow', label: 'Meadow' }, { id: 'zen', label: 'Zen gravel' },
];
export const TREE_TYPES = [{ id: 'none', label: 'No tree' }, { id: 'oak', label: 'Oak' }, { id: 'cherry', label: 'Cherry' }, { id: 'pine', label: 'Pine' }];
export const EXTRAS = [
  { id: 'fountain', label: 'Fountain' }, { id: 'flag', label: 'Crew pennant' },
  { id: 'lights', label: 'String lights' }, { id: 'lanterns', label: 'Path lanterns' },
];
export const COLORS = {
  body: ['#D9CDBD', '#EFE7D8', '#9FB4A2', '#8FA9BF', '#C98A9A', '#E6C27A', '#7E9A7A', '#9C4A3A', '#E8E6E1', '#3E4A47', '#EAD9BC', '#B8644F'],
  trim: ['#F7F3EE', '#2F3437', '#3D6B73', '#E8D5B0', '#8E5468'],
  roof: ['#5A4A44', '#3F3A3D', '#6E3B3B', '#4B5D6B', '#5F6E52', '#C26B4A'],
  door: ['#8E5468', '#2F4F3E', '#C2413A', '#2B4A6B', '#E0A43A', '#3A3340', '#B98A6A'],
  car: ['#2B4A6B', '#C2413A', '#F2EEE8', '#2B2B30', '#4F9460', '#3D8A8A', '#E0A43A', '#9AA3A8'],
  sign: ['#C2416B', '#E0A43A', '#3D8A8A', '#7C5CC4', '#2B4A6B', '#C2413A'],
  coat: { dog: ['#C98A3E', '#2B2B30', '#E8DCC8', '#8A6A55'], cat: ['#9AA3A8', '#D98F2B', '#2B2B30', '#F2EEE8'] },
};
export const STYLE_DEFAULTS = {
  standard: { body: '#D9CDBD', trim: '#F7F3EE', roof: '#5A4A44', door: '#8E5468', windows: 'classic' },
  colonial: { body: '#9C4A3A', trim: '#F7F3EE', roof: '#3F3A3D', door: '#2F4F3E', windows: 'shutters' },
  craftsman: { body: '#7E9A7A', trim: '#EFE6D3', roof: '#5A4A44', door: '#C2413A', windows: 'classic' },
  victorian: { body: '#C98A9A', trim: '#F7F3EE', roof: '#4A4450', door: '#3D6B73', windows: 'arched' },
  modern: { body: '#E8E6E1', trim: '#2F3437', roof: '#2F3437', door: '#B98A6A', windows: 'picture' },
  villa: { body: '#EAD9BC', trim: '#F7F1E6', roof: '#C26B4A', door: '#7A4A2E', windows: 'arched' },
};
// Free plots can't customize. Each one gets a preset at move-in so the street isn't identical.
export const FREE_PRESETS = [
  { body: '#D9CDBD', trim: '#F7F3EE', roof: '#5A4A44', door: '#8E5468' },
  { body: '#B9C7CF', trim: '#F7F3EE', roof: '#4B5D6B', door: '#C2413A' },
  { body: '#E3D3A8', trim: '#F7F3EE', roof: '#6E5A4A', door: '#2F4F3E' },
  { body: '#CDBFB2', trim: '#F2EEE8', roof: '#3F3A3D', door: '#2B4A6B' },
];
export const TIER_COLORS = { bronze: '#CD7F32', silver: '#C9D1DB', gold: '#F5B82E', legendary: '#B266E8' };
export const MEDALS = {
  'day-one': { name: 'Day One', tier: 'legendary', glyph: 'crown' },
  'first-step': { name: 'First Step', tier: 'bronze', glyph: 'check' },
  'halfway-there': { name: 'Halfway There', tier: 'bronze', glyph: 'flag' },
  'hat-trick': { name: 'Hat Trick', tier: 'silver', glyph: 'target' },
  'the-closer': { name: 'The Closer', tier: 'gold', glyph: 'trophy' },
  'showed-up': { name: 'Showed Up', tier: 'bronze', glyph: 'check' },
  'iron-will': { name: 'Iron Will', tier: 'gold', glyph: 'flame' },
  'unbreakable': { name: 'Unbreakable', tier: 'legendary', glyph: 'gem' },
  'a-friend-in-need': { name: 'A Friend in Need...', tier: 'silver', glyph: 'heart' },
  'is-a-friend-indeed': { name: '...Is a Friend Indeed', tier: 'gold', glyph: 'heart' },
  'hype-man': { name: 'Hype Man', tier: 'bronze', glyph: 'star' },
  'found-my-people': { name: 'Found My People', tier: 'bronze', glyph: 'home' },
  'life-of-the-party': { name: 'Life of the Party', tier: 'silver', glyph: 'spark' },
  'coachable': { name: 'Coachable', tier: 'silver', glyph: 'bolt' },
};

function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }
const h1 = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// What a plot actually shows. Free plots ignore their saved choices and use a preset.
export function resolvePlot(plot) {
  const seed = hashStr(plot.id || 'plot');
  const c = plot.config || {};
  if (!plot.member) {
    const p = FREE_PRESETS[Math.floor(seed * FREE_PRESETS.length) % FREE_PRESETS.length];
    return { member: false, seed, house: { style: 'standard', ...p, windows: 'classic' }, sign: { style: 'post', color: COLORS.sign[0] }, car: null, pet: null, lawn: 'plain', tree: 'none', extras: {}, profile: plot.profile || {} };
  }
  const style = (c.house && c.house.style) || 'standard';
  const house = { ...STYLE_DEFAULTS[style], ...(c.house || {}), style };
  return {
    member: true, seed, house,
    sign: { style: 'classic', color: COLORS.sign[0], ...(c.sign || {}) },
    car: c.car && c.car.type && c.car.type !== 'none' ? { color: COLORS.car[0], ...c.car } : null,
    pet: c.pet && c.pet.kind && c.pet.kind !== 'none' ? { coat: COLORS.coat[c.pet.kind][0], ...c.pet } : null,
    lawn: c.lawn || 'plain', tree: c.tree || 'none', extras: c.extras || {}, profile: plot.profile || {},
  };
}

// ---------------------------------------------------------------------------------------------
// Color and drawing helpers
// ---------------------------------------------------------------------------------------------
function rgbOf(h) {
  if (h[0] === '#') { let s = h.slice(1); if (s.length === 3) s = s.replace(/./g, (ch) => ch + ch); return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]; }
  const m = h.match(/[\d.]+/g); return [+m[0], +m[1], +m[2]];
}
const toHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export function shade(h, a) { const c = rgbOf(h), t = a < 0 ? 0 : 255, p = Math.min(1, Math.abs(a)); return toHex(c.map((v) => v + (t - v) * p)); }
export function mix(a, b, t) { const A = rgbOf(a), B = rgbOf(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); }
export function rgba(h, a) { const [r, g, b] = rgbOf(h); return `rgba(${r},${g},${b},${a})`; }
// Face shading calibrated to the game's box(): +y wall -0.08, +x wall -0.24, top +0.1.
function lit(h, n) { const l = Math.hypot(n[0], n[1], n[2]) || 1; return shade(h, -0.16 - 0.08 * n[0] / l + 0.08 * n[1] / l + 0.26 * n[2] / l); }
// A face is visible when its normal points toward the camera, which sits along (1, 1, 2TH/ZH).
const VIEW = [1, 1, (2 * TH) / ZH];
const faces = (n) => n[0] * VIEW[0] + n[1] * VIEW[1] + n[2] * VIEW[2] > 0.001;

const EDGE = 'rgba(40,20,32,.16)';
function ell(ctx, x, y, rx, ry, fill, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); if (fill) { ctx.fillStyle = fill; ctx.fill(); } }
function circ(ctx, x, y, r, fill) { ell(ctx, x, y, r, r, fill); }
function limb(ctx, x1, y1, x2, y2, c, w) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
function rrPath(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function rr(ctx, x, y, w, h, r, fill) { rrPath(ctx, x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); }
function hline(ctx, u0, u1, v, c, w = 0.7) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(u0, v); ctx.lineTo(u1, v); ctx.stroke(); }
function vline(ctx, u, v0, v1, c, w = 0.7) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(u, v0); ctx.lineTo(u, v1); ctx.stroke(); }
function fitText(ctx, text, maxW) {
  if (!text) return '';
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text; while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}

// The pen draws in local plot coordinates (x offset by ox) and knows the two visible wall planes.
function pen(ctx, ox = 0) {
  const P = (x, y, z = 0) => iso(x + ox, y, z);
  const path = (pts) => { ctx.beginPath(); pts.forEach((p, i) => { const [sx, sy] = P(p[0], p[1], p[2] || 0); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); ctx.closePath(); };
  const d = {
    ctx, ox, P, path,
    poly(pts, fill, stroke = EDGE, lw = 0.8) { path(pts); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); } },
    line(a, b, c, w = 1) { const [x1, y1] = P(a[0], a[1], a[2] || 0), [x2, y2] = P(b[0], b[1], b[2] || 0); limb(ctx, x1, y1, x2, y2, c, w); },
    // Solid box: only the +y, +x and top faces can face the camera.
    box(x, y, z, w, dd, h, c, o = {}) {
      const x1 = x + w, y1 = y + dd, z1 = z + h;
      if (!o.noFront) d.poly([[x, y1, z], [x1, y1, z], [x1, y1, z1], [x, y1, z1]], o.front || lit(c, [0, 1, 0]), o.stroke);
      if (!o.noSide) d.poly([[x1, y, z], [x1, y1, z], [x1, y1, z1], [x1, y, z1]], o.side || lit(c, [1, 0, 0]), o.stroke);
      if (!o.noTop) d.poly([[x, y, z1], [x1, y, z1], [x1, y1, z1], [x, y1, z1]], o.top || lit(c, [0, 0, 1]), o.stroke);
    },
    ground(x, y, w, dd, c, z = 0, stroke = null) { d.poly([[x, y, z], [x + w, y, z], [x + w, y + dd, z], [x, y + dd, z]], c, stroke); },
    // Draw on the +y face plane: (u, v) are face pixels from the top-left corner at (x0, yf, zTop).
    front(x0, yf, zTop, fn) { const [a, b] = P(x0, yf, zTop); ctx.save(); ctx.transform(1, 0.5, 0, 1, a, b); fn((u, v) => [a + u, b + 0.5 * u + v]); ctx.restore(); },
    // Draw on the +x face plane: u runs from the front corner (y1) toward the back.
    side(xf, y1, zTop, fn) { const [a, b] = P(xf, y1, zTop); ctx.save(); ctx.transform(1, -0.5, 0, 1, a, b); fn((u, v) => [a + u, b - 0.5 * u + v]); ctx.restore(); },
    // Sun comes from the front-left, so shadows fall to the right on screen.
    shadowRect(x0, y0, x1, y1, h, a = 0.2) {
      const s = h * 0.42;
      d.poly([[x0, y1, 0], [x0, y0, 0], [x0 + s, y0 - s, 0], [x1 + s, y0 - s, 0], [x1 + s, y1 - s, 0], [x1, y1, 0]], `rgba(28,40,26,${a})`, null);
    },
    shadowBlob(x, y, r, h, a = 0.18) { const [sx, sy] = P(x + h * 0.3, y - h * 0.3, 0); ell(ctx, sx, sy, r * TW * 1.3, r * TH * 1.3, `rgba(28,40,26,${a})`); },
  };
  return d;
}

// ---------------------------------------------------------------------------------------------
// Surfaces: siding, brick, shingles... drawn in face pixels
// ---------------------------------------------------------------------------------------------
function texture(ctx, kind, W, H, base, seed = 1) {
  const dark = rgba(shade(base, -0.4), 0.22), light = rgba(shade(base, 0.45), 0.3);
  if (kind === 'lap') {
    for (let v = H - 4.6; v > 0; v -= 4.6) { hline(ctx, 0, W, v, dark, 0.8); hline(ctx, 0, W, v + 0.9, light, 0.6); }
  } else if (kind === 'shingle') {
    let row = 0;
    for (let v = H - 4; v > -4; v -= 4, row++) { hline(ctx, 0, W, v, dark, 0.7); for (let u = (row % 2) * 3; u < W; u += 6) vline(ctx, u, v - 4, v, dark, 0.5); }
  } else if (kind === 'fishscale') {
    ctx.strokeStyle = dark; ctx.lineWidth = 0.7; let row = 0;
    for (let v = H; v > -4; v -= 3.6, row++) { ctx.beginPath(); for (let u = (row % 2) * 2.6; u < W + 5; u += 5.2) { ctx.moveTo(u + 2.6, v - 2); ctx.arc(u, v - 2, 2.6, 0, Math.PI); } ctx.stroke(); }
  } else if (kind === 'brick') {
    let row = 0;
    for (let v = H - 3.4; v > -3.4; v -= 3.4, row++) {
      for (let u = (row % 2) ? -4.5 : 0; u < W; u += 9) {
        const k = h1(seed * 13 + row * 7.3 + u * 0.37);
        ctx.fillStyle = k < 0.33 ? rgba(shade(base, -0.12), 0.55) : k > 0.8 ? rgba(shade(base, 0.12), 0.45) : 'rgba(0,0,0,0)';
        ctx.fillRect(u + 0.5, v + 0.5, 8, 2.4);
      }
      hline(ctx, 0, W, v + 3.2, light, 0.7);
      for (let u = (row % 2) ? -4.5 : 0; u < W; u += 9) vline(ctx, u, v, v + 3.2, light, 0.6);
    }
  } else if (kind === 'stucco') {
    for (let i = 0, n = Math.floor((W * H) / 22); i < n; i++) {
      const u = h1(seed + i * 1.7) * W, v = h1(seed * 3 + i * 2.3) * H;
      ctx.fillStyle = i % 2 ? rgba(shade(base, -0.2), 0.18) : rgba(shade(base, 0.4), 0.25); ctx.fillRect(u, v, 1, 1);
    }
  } else if (kind === 'board') {
    for (let u = 4; u < W; u += 7) { vline(ctx, u, 0, H, dark, 1.2); vline(ctx, u + 1.1, 0, H, light, 0.5); }
  } else if (kind === 'slat') {
    for (let u = 0, i = 0; u < W; u += 2.6, i++) { ctx.fillStyle = i % 3 === 0 ? rgba(shade(base, -0.18), 0.6) : i % 3 === 1 ? rgba(shade(base, 0.12), 0.4) : 'rgba(0,0,0,0)'; ctx.fillRect(u, 0, 1.4, H); }
  } else if (kind === 'stone') {
    let row = 0;
    for (let v = H; v > -6; v -= 5.2, row++) {
      let u = -h1(seed + row) * 6;
      while (u < W) { const w = 6 + h1(seed * 7 + row * 3 + u) * 7; ctx.fillStyle = rgba(shade(base, (h1(u + row) - 0.5) * 0.3), 0.7); rrPath(ctx, u + 0.6, v - 4.8, w - 1.2, 4.4, 1.4); ctx.fill(); u += w; }
    }
  }
}
function wallShade(ctx, W, H, top = 9) {
  let g = ctx.createLinearGradient(0, H - 9, 0, H); g.addColorStop(0, 'rgba(30,20,25,0)'); g.addColorStop(1, 'rgba(30,20,25,.2)'); ctx.fillStyle = g; ctx.fillRect(0, H - 9, W, 9);
  if (top > 0) { g = ctx.createLinearGradient(0, 0, 0, top); g.addColorStop(0, 'rgba(30,20,25,.3)'); g.addColorStop(1, 'rgba(30,20,25,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, top); }
}
function wallFront(d, x0, x1, yf, z0, z1, color, mat, details, o = {}) {
  const W = (x1 - x0) * TW, H = (z1 - z0) * ZH, base = lit(color, [0, 1, 0]);
  d.poly([[x0, yf, z0], [x1, yf, z0], [x1, yf, z1], [x0, yf, z1]], base);
  d.front(x0, yf, z1, (map) => {
    const ctx = d.ctx; ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    texture(ctx, mat, W, H, base, x0 * 7 + yf * 3 + z0); wallShade(ctx, W, H, o.eaveShadow ?? 9); ctx.restore();
    if (details) details(ctx, W, H, map);
  });
}
function wallSide(d, xf, y0, y1, z0, z1, color, mat, details, o = {}) {
  const W = (y1 - y0) * TW, H = (z1 - z0) * ZH, base = lit(color, [1, 0, 0]);
  d.poly([[xf, y0, z0], [xf, y1, z0], [xf, y1, z1], [xf, y0, z1]], base);
  d.side(xf, y1, z1, (map) => {
    const ctx = d.ctx; ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    texture(ctx, mat, W, H, base, xf * 5 + y0 + z0); wallShade(ctx, W, H, o.eaveShadow ?? 9); ctx.restore();
    if (details) details(ctx, W, H, map);
  });
}
function gableFront(d, x0, x1, yf, zE, zR, color, mat, details) {
  const W = (x1 - x0) * TW, H = (zR - zE) * ZH, base = lit(color, [0, 1, 0]), xm = (x0 + x1) / 2;
  d.poly([[x0, yf, zE], [x1, yf, zE], [xm, yf, zR]], base);
  d.front(x0, yf, zR, (map) => {
    const ctx = d.ctx; ctx.save(); ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(W, H); ctx.lineTo(W / 2, 0); ctx.closePath(); ctx.clip();
    texture(ctx, mat, W, H, base, x0 + zE); ctx.restore();
    if (details) details(ctx, W, H, map);
  });
}
function gableSide(d, xf, y0, y1, zE, zR, color, mat, details) {
  const W = (y1 - y0) * TW, H = (zR - zE) * ZH, base = lit(color, [1, 0, 0]), ym = (y0 + y1) / 2;
  d.poly([[xf, y0, zE], [xf, y1, zE], [xf, ym, zR]], base);
  d.side(xf, y1, zR, (map) => {
    const ctx = d.ctx; ctx.save(); ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(W, H); ctx.lineTo(W / 2, 0); ctx.closePath(); ctx.clip();
    texture(ctx, mat, W, H, base, xf + zE); ctx.restore();
    if (details) details(ctx, W, H, map);
  });
}

// ---------------------------------------------------------------------------------------------
// Windows and doors, drawn in face pixels. `reg` records glass so it can glow at night.
// ---------------------------------------------------------------------------------------------
function glassFill(ctx, u, v, w, h) {
  const g = ctx.createLinearGradient(u, v, u + w * 0.3, v + h);
  g.addColorStop(0, '#C9DCE6'); g.addColorStop(0.45, '#7C97A6'); g.addColorStop(1, '#4F6675');
  return g;
}
function win(ctx, u, v, w, h, style, H, reg, o = {}) {
  const trim = H.trim, tDark = shade(trim, -0.25);
  if (style === 'shutters') {
    const sw = Math.max(5, w * 0.42), sc = o.shutter || shade(H.door, -0.1);
    [u - sw - 2.5, u + w + 2.5].forEach((su) => {
      ctx.fillStyle = sc; ctx.fillRect(su, v - 1, sw, h + 2);
      for (let k = v + 2; k < v + h; k += 2.4) hline(ctx, su + 1, su + sw - 1, k, rgba(shade(sc, -0.4), 0.6), 0.6);
    });
  }
  const arch = style === 'arched';
  // casing
  ctx.fillStyle = trim;
  if (arch) { ctx.beginPath(); ctx.moveTo(u - 2, v + h + 1.5); ctx.lineTo(u - 2, v + w / 2); ctx.arc(u + w / 2, v + w / 2, w / 2 + 2, Math.PI, 0); ctx.lineTo(u + w + 2, v + h + 1.5); ctx.closePath(); ctx.fill(); }
  else { ctx.fillRect(u - 2, v - 2, w + 4, h + 4); ctx.fillStyle = shade(trim, -0.05); ctx.fillRect(u - 3, v - 4.5, w + 6, 2.8); }
  // glass
  ctx.save(); ctx.beginPath();
  if (arch) { ctx.moveTo(u, v + h); ctx.lineTo(u, v + w / 2); ctx.arc(u + w / 2, v + w / 2, w / 2, Math.PI, 0); ctx.lineTo(u + w, v + h); ctx.closePath(); }
  else ctx.rect(u, v, w, h);
  ctx.fillStyle = glassFill(ctx, u, v, w, h); ctx.fill(); ctx.clip();
  // curtains and a soft interior shadow, then a sky reflection
  ctx.fillStyle = 'rgba(244,236,222,.55)'; ctx.fillRect(u, v, w * 0.18, h); ctx.fillRect(u + w * 0.82, v, w * 0.18, h);
  ctx.fillStyle = 'rgba(30,40,50,.18)'; ctx.fillRect(u, v + h * 0.62, w, h * 0.38);
  ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.beginPath(); ctx.moveTo(u + w * 0.15, v); ctx.lineTo(u + w * 0.42, v); ctx.lineTo(u + w * 0.05, v + h); ctx.lineTo(u - w * 0.22, v + h); ctx.closePath(); ctx.fill();
  ctx.restore();
  // glazing bars
  const bar = o.bar || trim;
  if (style === 'picture') { vline(ctx, u + w / 3, v, v + h, tDark, 1); vline(ctx, u + (2 * w) / 3, v, v + h, tDark, 1); }
  else if (arch) { vline(ctx, u + w / 2, v + 1, v + h, bar, 1.2); hline(ctx, u, u + w, v + w / 2, bar, 1.2); }
  else { hline(ctx, u, u + w, v + h / 2, bar, 1.6); vline(ctx, u + w / 2, v, v + h, bar, 1); if (h > 16) { hline(ctx, u, u + w, v + h / 4, bar, 0.7); hline(ctx, u, u + w, v + (3 * h) / 4, bar, 0.7); } }
  // sill
  ctx.fillStyle = trim; ctx.fillRect(u - 3.5, v + h + 1.5, w + 7, 2.6);
  ctx.fillStyle = 'rgba(20,10,20,.22)'; ctx.fillRect(u - 3, v + h + 4.1, w + 6, 1.2);
  if (reg) reg(u, arch ? v + 1 : v, u + w, v + h, o.kind || 'window', o);
}
function door(ctx, u, v, w, h, color, H, kind, reg) {
  const trim = H.trim;
  ctx.fillStyle = trim;
  if (kind === 'arched') { ctx.beginPath(); ctx.moveTo(u - 3, v + h); ctx.lineTo(u - 3, v + w / 2); ctx.arc(u + w / 2, v + w / 2, w / 2 + 3, Math.PI, 0); ctx.lineTo(u + w + 3, v + h); ctx.closePath(); ctx.fill(); }
  else ctx.fillRect(u - 2.5, v - 2.5, w + 5, h + 2.5);
  const body = color, dk = shade(body, -0.22), lt = shade(body, 0.15);
  ctx.save(); ctx.beginPath();
  if (kind === 'arched') { ctx.moveTo(u, v + h); ctx.lineTo(u, v + w / 2); ctx.arc(u + w / 2, v + w / 2, w / 2, Math.PI, 0); ctx.lineTo(u + w, v + h); ctx.closePath(); }
  else ctx.rect(u, v, w, h);
  ctx.fillStyle = body; ctx.fill(); ctx.clip();
  if (kind === 'modern') {
    ctx.fillStyle = glassFill(ctx, u + w * 0.62, v + 2, w * 0.24, h - 4); ctx.fillRect(u + w * 0.62, v + 2, w * 0.24, h - 4);
    for (let k = u + 1.5; k < u + w * 0.6; k += 2.2) vline(ctx, k, v, v + h, rgba(dk, 0.5), 0.6);
    vline(ctx, u + w * 0.5, v + h * 0.3, v + h * 0.7, '#D9D2C2', 1.4);
    if (reg) reg(u + w * 0.62, v + 2, u + w * 0.86, v + h - 2, 'door');
  } else if (kind === 'arched') {
    for (let k = u + w / 5; k < u + w; k += w / 5) vline(ctx, k, v, v + h, rgba(dk, 0.7), 0.8);
    for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) circ(ctx, u + w * (0.2 + j * 0.3), v + h * (0.35 + k * 0.22), 0.7, '#2B2B30');
    circ(ctx, u + w * 0.8, v + h * 0.6, 1.1, '#C9A24A');
  } else {
    if (kind === 'craftsman') {
      ctx.fillStyle = glassFill(ctx, u + 2, v + 2.5, w - 4, h * 0.26); ctx.fillRect(u + 2.5, v + 2.5, w - 5, h * 0.24);
      vline(ctx, u + w / 3, v + 2.5, v + 2.5 + h * 0.24, body, 1); vline(ctx, u + (2 * w) / 3, v + 2.5, v + 2.5 + h * 0.24, body, 1);
      if (reg) reg(u + 2.5, v + 2.5, u + w - 2.5, v + 2.5 + h * 0.24, 'door');
      ctx.fillStyle = dk; ctx.fillRect(u + 3, v + h * 0.42, w - 6, h * 0.48);
      ctx.fillStyle = lt; ctx.fillRect(u + 3, v + h * 0.42, w - 6, 0.8);
    } else {
      const pw = (w - 7) / 2, ph1 = h * 0.36, ph2 = h * 0.38;
      [[u + 2.5, v + 3], [u + 4.5 + pw, v + 3], [u + 2.5, v + 6 + ph1], [u + 4.5 + pw, v + 6 + ph1]].forEach(([pu, pv], i) => {
        ctx.fillStyle = dk; ctx.fillRect(pu, pv, pw, i < 2 ? ph1 : ph2); ctx.fillStyle = lt; ctx.fillRect(pu, pv + (i < 2 ? ph1 : ph2) - 0.8, pw, 0.8);
      });
    }
    circ(ctx, u + w - 3.4, v + h * 0.55, 1.1, '#D9B24A');
  }
  ctx.restore();
  // threshold
  ctx.fillStyle = shade(trim, -0.3); ctx.fillRect(u - 1, v + h - 1.2, w + 2, 1.2);
}
function lampFixture(ctx, u, v, reg) {
  ctx.fillStyle = '#2B2B30'; ctx.fillRect(u - 0.8, v - 1, 1.6, 6);
  rr(ctx, u - 2.4, v + 1.5, 4.8, 5.5, 1, '#3A3340'); ctx.fillStyle = '#F2D9A0'; ctx.fillRect(u - 1.5, v + 2.5, 3, 3.5);
  if (reg) reg(u - 1.5, v + 2.5, u + 1.5, v + 6, 'porch');
}
function vent(ctx, W, H) { const cy = H * 0.62; ctx.fillStyle = '#F2EEE8'; ctx.beginPath(); ctx.arc(W / 2, cy, 5.2, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#5A5560'; ctx.beginPath(); ctx.arc(W / 2, cy, 4, 0, Math.PI * 2); ctx.fill(); for (let k = -3; k <= 3; k += 1.5) hline(ctx, W / 2 - 3.6, W / 2 + 3.6, cy + k, 'rgba(242,238,232,.7)', 0.6); }

// ---------------------------------------------------------------------------------------------
// Roofs
// ---------------------------------------------------------------------------------------------
const SNOW = '#EEF3F8';
function slopeFace(d, pts, n, color, o, tex) {
  if (!faces(n)) return;
  const snowy = o.snow, c = snowy ? lit(SNOW, n) : lit(color, n);
  d.poly(pts, c, 'rgba(30,20,25,.25)', 0.8);
  if (tex) { const ctx = d.ctx; ctx.save(); d.path(pts); ctx.clip(); tex(snowy); ctx.restore(); }
}
function shingleRows(d, a0, a1, b0, b1, n, color, snowy, tabs = true) {
  // a0->a1 is the eave line, b0->b1 the ridge line; draw rows between them with staggered tabs.
  const col = snowy ? 'rgba(150,170,190,.25)' : rgba(shade(color, -0.45), 0.35);
  const L = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
  for (let i = 1; i < n; i++) {
    const t = i / n, p = L(a0, b0, t), q = L(a1, b1, t);
    d.line(p, q, col, 0.7);
    if (tabs && !snowy) {
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]), steps = Math.floor(len / 0.32), t2 = (i + 1) / n, p2 = L(a0, b0, t2), q2 = L(a1, b1, t2);
      for (let k = 0; k <= steps; k++) { const s = (k + (i % 2) * 0.5) / Math.max(1, steps); if (s > 1) continue; d.line(L(p, q, s), L(p2, q2, s), rgba(shade(color, -0.45), 0.2), 0.5); }
    }
  }
}
function tileLines(d, eaveA, eaveB, topA, topB, color, snowy) {
  // Barrel tiles: lines running down the slope plus overlapping rows.
  const L = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
  const len = Math.hypot(eaveB[0] - eaveA[0], eaveB[1] - eaveA[1]), n = Math.floor(len / 0.2);
  for (let k = 0; k <= n; k++) { const s = k / n; d.line(L(eaveA, eaveB, s), L(topA, topB, s), snowy ? 'rgba(160,175,190,.25)' : k % 2 ? rgba(shade(color, 0.25), 0.55) : rgba(shade(color, -0.35), 0.5), 1.4); }
  for (let i = 1; i < 6; i++) { const t = i / 6; d.line(L(eaveA, topA, t), L(eaveB, topB, t), snowy ? 'rgba(160,175,190,.2)' : rgba(shade(color, -0.5), 0.35), 0.8); }
}
function fascia(d, a, b, t, color, n) { d.poly([a, b, [b[0], b[1], b[2] - t], [a[0], a[1], a[2] - t]], lit(color, n), 'rgba(30,20,25,.25)'); }

// Ridge along x (gable ends face the sides). hookBack draws things sitting on the back slope.
function roofSideGable(d, o) {
  const { x0, x1, y0, y1, zE, zR, oh = 0.28, color, trim, mat = 'shingle', snow, hookBack } = o;
  const ym = (y0 + y1) / 2, slope = (zR - zE) / (ym - y0), zEo = zE - oh * slope, t = 0.12;
  const xl = x0 - oh, xr = x1 + oh, yb = y0 - oh, yf = y1 + oh;
  const nB = [0, -(zR - zE), ym - y0], nF = [0, zR - zE, ym - y0];
  slopeFace(d, [[xl, yb, zEo], [xr, yb, zEo], [xr, ym, zR], [xl, ym, zR]], nB, color, o, (s) => shingleRows(d, [xl, yb, zEo], [xr, yb, zEo], [xl, ym, zR], [xr, ym, zR], 9, color, s, mat === 'shingle'));
  fascia(d, [xr, yb, zEo], [xr, ym, zR], t, trim, [1, 0, 0]);
  if (hookBack) hookBack((x, y) => zE + (y - y0) * slope);
  slopeFace(d, [[xl, ym, zR], [xr, ym, zR], [xr, yf, zEo], [xl, yf, zEo]], nF, color, o, (s) => mat === 'tile' ? tileLines(d, [xl, yf, zEo], [xr, yf, zEo], [xl, ym, zR], [xr, ym, zR], color, s) : shingleRows(d, [xl, yf, zEo], [xr, yf, zEo], [xl, ym, zR], [xr, ym, zR], 10, color, s, mat === 'shingle'));
  fascia(d, [xr, ym, zR], [xr, yf, zEo], t, trim, [1, 0, 0]);
  fascia(d, [xl, yf, zEo], [xr, yf, zEo], t, trim, [0, 1, 0]);
  d.line([xl, ym, zR + 0.02], [xr, ym, zR + 0.02], snow ? '#FFFFFF' : shade(color, -0.35), 2.2);
  if (snow) d.line([xl, yf, zEo + 0.02], [xr, yf, zEo + 0.02], '#FFFFFF', 2.4);
  return { zAtBack: (x, y) => zE + (y - y0) * slope, zAtFront: (x, y) => zR - (y - ym) * slope, eave: { x0: xl, x1: xr, y: yf, z: zEo - t } };
}
// Ridge along y (gable faces the street).
function roofFrontGable(d, o) {
  const { x0, x1, y0, y1, zE, zR, oh = 0.3, color, trim, mat = 'shingle', snow, hookRight } = o;
  const xm = (x0 + x1) / 2, slope = (zR - zE) / (xm - x0), zEo = zE - oh * slope, t = 0.14;
  const xl = x0 - oh, xr = x1 + oh, yb = y0 - (o.ohBack ?? oh), yf = y1 + oh;
  const nL = [-(zR - zE), 0, xm - x0], nR = [zR - zE, 0, xm - x0];
  slopeFace(d, [[xl, yb, zEo], [xm, yb, zR], [xm, yf, zR], [xl, yf, zEo]], nL, color, o, (s) => shingleRows(d, [xl, yf, zEo], [xl, yb, zEo], [xm, yf, zR], [xm, yb, zR], 9, color, s, mat === 'shingle'));
  slopeFace(d, [[xm, yb, zR], [xr, yb, zEo], [xr, yf, zEo], [xm, yf, zR]], nR, color, o, (s) => shingleRows(d, [xr, yb, zEo], [xr, yf, zEo], [xm, yb, zR], [xm, yf, zR], 9, color, s, mat === 'shingle'));
  if (hookRight) hookRight((x, y) => zR - (x - xm) * slope);
  fascia(d, [xr, yb, zEo], [xr, yf, zEo], t, trim, [1, 0, 0]);
  fascia(d, [xl, yf, zEo], [xm, yf, zR], t + 0.04, trim, [0, 1, 0]);
  fascia(d, [xm, yf, zR], [xr, yf, zEo], t + 0.04, trim, [0, 1, 0]);
  if (snow) { d.line([xm, yb, zR + 0.02], [xm, yf, zR + 0.02], '#FFFFFF', 2.2); d.line([xr, yb, zEo + 0.02], [xr, yf, zEo + 0.02], '#FFFFFF', 2.2); }
  return { xm, zAtRight: (x) => zR - (x - xm) * slope, eaveRight: { x: xr, y0: yb, y1: yf, z: zEo - t } };
}
function roofHip(d, o) {
  const { x0, x1, y0, y1, zE, zR, oh = 0.32, color, trim, snow, hookBack } = o;
  const run = (y1 - y0) / 2, slope = (zR - zE) / run, zEo = zE - oh * slope, t = 0.12, ym = (y0 + y1) / 2;
  const xl = x0 - oh, xr = x1 + oh, yb = y0 - oh, yf = y1 + oh, xa = x0 + run, xb = x1 - run;
  const tex = (eA, eB, tA, tB) => (s) => tileLines(d, eA, eB, tA, tB, color, s);
  slopeFace(d, [[xl, yb, zEo], [xr, yb, zEo], [xb, ym, zR], [xa, ym, zR]], [0, -(zR - zE), run], color, o, tex([xl, yb, zEo], [xr, yb, zEo], [xa, ym, zR], [xb, ym, zR]));
  if (hookBack) hookBack((x, y) => zE + (y - y0) * slope);
  slopeFace(d, [[xl, yf, zEo], [xl, yb, zEo], [xa, ym, zR]], [-(zR - zE), 0, run], color, o, tex([xl, yf, zEo], [xl, yb, zEo], [xa, ym, zR], [xa, ym, zR]));
  slopeFace(d, [[xr, yb, zEo], [xr, yf, zEo], [xb, ym, zR]], [zR - zE, 0, run], color, o, tex([xr, yb, zEo], [xr, yf, zEo], [xb, ym, zR], [xb, ym, zR]));
  slopeFace(d, [[xa, ym, zR], [xb, ym, zR], [xr, yf, zEo], [xl, yf, zEo]], [0, zR - zE, run], color, o, tex([xl, yf, zEo], [xr, yf, zEo], [xa, ym, zR], [xb, ym, zR]));
  fascia(d, [xr, yb, zEo], [xr, yf, zEo], t, trim, [1, 0, 0]);
  fascia(d, [xl, yf, zEo], [xr, yf, zEo], t, trim, [0, 1, 0]);
  const cap = snow ? '#FFFFFF' : shade(color, -0.3);
  d.line([xa, ym, zR + 0.02], [xb, ym, zR + 0.02], cap, 2.6); d.line([xr, yf, zEo], [xb, ym, zR], cap, 2.2); d.line([xl, yf, zEo], [xa, ym, zR], cap, 2.2);
  return { eave: { x0: xl, x1: xr, y: yf, z: zEo - t } };
}
// A chimney whose bottom follows the roof surface zAt(x, y).
function chimney(d, x0, x1, y0, y1, zAt, top, color, meta) {
  const zf0 = zAt(x0, y1), zf1 = zAt(x1, y1), zs0 = zAt(x1, y0);
  d.poly([[x0, y1, zf0], [x1, y1, zf1], [x1, y1, top], [x0, y1, top]], lit(color, [0, 1, 0]));
  d.front(x0, y1, top, () => { const ctx = d.ctx; const W = (x1 - x0) * TW; ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, (top - Math.min(zf0, zf1)) * ZH); ctx.clip(); texture(ctx, 'brick', W, (top - Math.min(zf0, zf1)) * ZH, lit(color, [0, 1, 0]), x0); ctx.restore(); });
  d.poly([[x1, y0, zs0], [x1, y1, zf1], [x1, y1, top], [x1, y0, top]], lit(color, [1, 0, 0]));
  d.box(x0 - 0.06, y0 - 0.06, top, x1 - x0 + 0.12, y1 - y0 + 0.12, 0.1, '#6B6460');
  d.ground(x0 + 0.06, y0 + 0.06, x1 - x0 - 0.12, y1 - y0 - 0.12, '#2B2526', top + 0.1);
  if (meta) meta.chimneys.push(d.P((x0 + x1) / 2, (y0 + y1) / 2, top + 0.12));
}

// ---------------------------------------------------------------------------------------------
// Houses. Each returns layout used by the yard and lights: door x, porch front y, eave line.
// ---------------------------------------------------------------------------------------------
function regFor(meta, map) {
  return (u0, v0, u1, v1, kind = 'window', o = {}) => meta.lights.push({ kind, pts: [map(u0, v0), map(u1, v0), map(u1, v1), map(u0, v1)], low: !!o.low, big: !!o.big });
}
function stoop(d, cx, y1, w, trimColor) {
  d.box(cx - w / 2, y1, 0, w, 0.45, 0.17, '#B9B2A8');
  d.box(cx - w / 2 + 0.08, y1 + 0.45, 0, w - 0.16, 0.25, 0.09, '#C4BDB3');
}

function houseSideGable(d, H, meta, env, o) {
  const { x0, x1, y0, y1, wall, zR, mat, twoStory } = o, f = 0.14;
  const cx = (x0 + x1) / 2;
  d.shadowRect(x0 - 0.3, y0 - 0.3, x1 + 0.3, y1 + 0.3, zR);
  d.box(x0 - 0.05, y0 - 0.05, 0, x1 - x0 + 0.1, y1 - y0 + 0.1, f, '#A49B91');
  wallFront(d, x0, x1, y1, f, wall, H.body, mat, (ctx, W, Hp, map) => {
    const reg = regFor(meta, map), ws = H.windows === 'picture' ? 'picture' : H.windows;
    if (twoStory) {
      const dw = 18, dh = 33, du = W / 2 - dw / 2, dv = Hp - dh;
      // pediment and pilasters around the door
      ctx.fillStyle = H.trim; ctx.fillRect(du - 7, dv - 3, 3.5, dh + 3); ctx.fillRect(du + dw + 3.5, dv - 3, 3.5, dh + 3);
      ctx.beginPath(); ctx.moveTo(du - 9, dv - 3); ctx.lineTo(du + dw + 9, dv - 3); ctx.lineTo(W / 2, dv - 11); ctx.closePath(); ctx.fill();
      ctx.fillStyle = shade(H.trim, -0.2); ctx.fillRect(du - 9, dv - 3.6, dw + 18, 1);
      door(ctx, du, dv, dw, dh, H.door, H, 'panel', reg);
      const upper = [0.12, 0.31, 0.5, 0.69, 0.88], lower = [0.12, 0.31, 0.69, 0.88], ww = 15, wh = 21;
      upper.forEach((c) => win(ctx, W * c - ww / 2, 8, ww, wh, ws, H, reg));
      lower.forEach((c) => win(ctx, W * c - ww / 2, Hp - 38, ww, wh + 3, ws, H, reg, { low: true }));
      ctx.fillStyle = H.trim; for (let k = 2; k < W; k += 4) ctx.fillRect(k, 1.5, 2, 2.4);
      ctx.fillRect(0, 0, W, 1.5);
      lampFixture(ctx, du - 13, dv + 8, reg); lampFixture(ctx, du + dw + 13, dv + 8, reg);
    } else {
      const dw = 17, dh = 31, du = W / 2 - dw / 2, dv = Hp - dh;
      door(ctx, du, dv, dw, dh, H.door, H, 'panel', reg);
      const ww = ws === 'picture' ? 30 : 23, wh = 20;
      win(ctx, W * 0.2 - ww / 2, 8, ww, wh, ws, H, reg, { low: true });
      win(ctx, W * 0.8 - ww / 2, 8, ww, wh, ws, H, reg, { low: true });
      lampFixture(ctx, du + dw + 7, dv + 5, reg);
    }
  });
  wallSide(d, x1, y0, y1, f, wall, H.body, mat, (ctx, W, Hp, map) => {
    const reg = regFor(meta, map), ws = H.windows === 'shutters' ? 'classic' : H.windows;
    if (twoStory) { win(ctx, W * 0.5 - 8, 8, 16, 21, ws, H, reg); win(ctx, W * 0.5 - 8, Hp - 36, 16, 22, ws, H, reg); }
    else win(ctx, W / 2 - 10, 9, 20, 18, ws, H, reg);
  });
  gableSide(d, x1, y0, y1, wall, zR, H.body, mat === 'brick' ? 'brick' : mat, (ctx, W, Hp) => {
    if (twoStory) { const cy = Hp * 0.7; ctx.fillStyle = H.trim; ctx.beginPath(); ctx.arc(W / 2, cy, 9, Math.PI, 0); ctx.fill(); ctx.fillStyle = glassFill(ctx, W / 2 - 7, cy - 7, 14, 7); ctx.beginPath(); ctx.arc(W / 2, cy, 7, Math.PI, 0); ctx.fill(); for (let a = 0.4; a < 3; a += 0.6) limb(ctx, W / 2, cy, W / 2 + Math.cos(Math.PI + a) * 7, cy + Math.sin(Math.PI + a) * 7, H.trim, 0.7); }
    else vent(ctx, W, Hp);
  });
  if (!twoStory) {
    stoop(d, cx, y1, 1.0);
    // little door canopy on brackets
    d.poly([[cx - 0.6, y1, 1.16], [cx + 0.6, y1, 1.16], [cx + 0.6, y1 + 0.5, 1.04], [cx - 0.6, y1 + 0.5, 1.04]], lit(H.roof, [0, 0.5, 1]), 'rgba(30,20,25,.3)');
    fascia(d, [cx - 0.6, y1 + 0.5, 1.04], [cx + 0.6, y1 + 0.5, 1.04], 0.07, H.trim, [0, 1, 0]);
    fascia(d, [cx + 0.6, y1, 1.16], [cx + 0.6, y1 + 0.5, 1.04], 0.07, H.trim, [1, 0, 0]);
  } else {
    stoop(d, cx, y1, 1.3);
  }
  const r = roofSideGable(d, {
    x0, x1, y0, y1, zE: wall, zR, oh: 0.28, color: H.roof, trim: H.trim, snow: env.season === 'winter',
    hookBack: (zAt) => {
      if (twoStory) { chimney(d, x0 + 0.35, x0 + 0.8, y0 + 0.75, y0 + 1.15, zAt, zR + 0.45, '#8E4A3C', meta); chimney(d, x1 - 0.8, x1 - 0.35, y0 + 0.75, y0 + 1.15, zAt, zR + 0.45, '#8E4A3C', meta); }
      else chimney(d, x1 - 1.2, x1 - 0.72, y0 + 0.5, y0 + 0.95, zAt, zR + 0.38, '#9A5B4A', meta);
    },
  });
  return { doorX: cx, front: y1 + (twoStory ? 0.7 : 0.7), eave: r.eave, top: zR };
}

function houseCraftsman(d, H, meta, env) {
  const x0 = 1.2, x1 = 6.2, y0 = 1.3, y1 = 4.25, py = 5.45, wall = 1.38, zR = 2.95, f = 0.32;
  const cx = 3.7, snow = env.season === 'winter';
  d.shadowRect(x0 - 0.3, y0 - 0.3, x1 + 0.3, py + 0.3, zR);
  // house front under the porch roof
  wallFront(d, x0, x1, y1, f, wall, H.body, 'lap', (ctx, W, Hp, map) => {
    const reg = regFor(meta, map);
    door(ctx, (cx - x0) * TW - 9, Hp - 33, 18, 33, H.door, H, 'craftsman', reg);
    // triple window on the left, pair on the right
    ctx.fillStyle = H.trim; ctx.fillRect(10, 5, 52, 26);
    [12, 29, 46].forEach((u, i) => win(ctx, u, 7, i === 1 ? 15 : 14, 21, 'classic', H, reg, { low: true }));
    win(ctx, W - 50, 7, 15, 21, 'classic', H, reg, { low: true }); win(ctx, W - 31, 7, 15, 21, 'classic', H, reg, { low: true });
    lampFixture(ctx, (cx - x0) * TW + 15, Hp - 26, reg);
    const g = ctx.createLinearGradient(0, 0, 0, Hp); g.addColorStop(0, 'rgba(25,15,25,.35)'); g.addColorStop(0.5, 'rgba(25,15,25,.12)'); g.addColorStop(1, 'rgba(25,15,25,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hp);
  });
  wallSide(d, x1, y0, y1, f, wall, H.body, 'lap', (ctx, W, Hp, map) => { const reg = regFor(meta, map); win(ctx, W * 0.45 - 9, 8, 18, 20, 'classic', H, reg); });
  // porch deck with a stone skirt, then steps
  d.box(x0 - 0.05, y1, 0, x1 - x0 + 0.1, py - y1 + 0.05, f, '#8A6A55', { front: lit('#9A8A78', [0, 1, 0]), side: lit('#9A8A78', [1, 0, 0]), top: lit('#9C6B45', [0, 0, 1]) });
  d.front(x0 - 0.05, py + 0.05, f, () => texture(d.ctx, 'stone', (x1 - x0 + 0.1) * TW, f * ZH, lit('#9A8A78', [0, 1, 0]), 3));
  for (let k = 1; k < 9; k++) d.line([x0 - 0.05 + k * 0.56, y1, f + 0.001], [x0 - 0.05 + k * 0.56, py + 0.05, f + 0.001], 'rgba(60,40,20,.25)', 0.6);
  d.box(cx - 0.55, py + 0.05, 0, 1.1, 0.32, 0.21, '#9A8A78'); d.box(cx - 0.55, py + 0.37, 0, 1.1, 0.3, 0.1, '#A89A88');
  // stone piers with tapered columns
  const col = (x) => {
    d.box(x - 0.2, py - 0.32, f, 0.4, 0.32, 0.45, '#8E8478', { front: lit('#9A8F82', [0, 1, 0]) });
    d.front(x - 0.2, py, f + 0.45, () => texture(d.ctx, 'stone', 0.4 * TW, 0.45 * ZH, lit('#9A8F82', [0, 1, 0]), x));
    const zb = f + 0.45, zt = wall - 0.18;
    d.poly([[x - 0.14, py - 0.06, zb], [x + 0.14, py - 0.06, zb], [x + 0.09, py - 0.06, zt], [x - 0.09, py - 0.06, zt]], lit(H.trim, [0, 1, 0]));
    d.poly([[x + 0.14, py - 0.3, zb], [x + 0.14, py - 0.06, zb], [x + 0.09, py - 0.06, zt], [x + 0.09, py - 0.24, zt]], lit(H.trim, [1, 0, 0]));
  };
  // railing between columns, left and right of the steps
  [[x0 + 0.1, cx - 0.75], [cx + 0.75, x1 - 0.1]].forEach(([a, b]) => {
    d.box(a, py - 0.12, f + 0.48, b - a, 0.08, 0.06, H.trim);
    for (let x = a + 0.12; x < b; x += 0.2) d.line([x, py - 0.08, f], [x, py - 0.08, f + 0.48], shade(H.trim, -0.15), 1.4);
  });
  [x0 + 0.12, cx - 0.9, cx + 0.9, x1 - 0.12].forEach(col);
  // beam and gable
  d.box(x0 - 0.05, py - 0.15, wall - 0.2, x1 - x0 + 0.1, 0.15, 0.2, H.trim);
  gableFront(d, x0 - 0.05, x1 + 0.05, py, wall, zR, H.body, 'shingle', (ctx, W, Hp, map) => {
    const reg = regFor(meta, map);
    ctx.fillStyle = H.trim; ctx.fillRect(W / 2 - 17, Hp * 0.45 - 2, 34, 17);
    [W / 2 - 15, W / 2 - 5, W / 2 + 5].forEach((u) => win(ctx, u, Hp * 0.45, 9, 12, 'picture', H, reg));
    // knee braces
    ctx.fillStyle = H.trim; [[14, 1], [W - 14, -1]].forEach(([u, s]) => { ctx.beginPath(); ctx.moveTo(u, Hp); ctx.lineTo(u, Hp - 8); ctx.lineTo(u + 7 * s, Hp); ctx.closePath(); ctx.fill(); });
  });
  roofFrontGable(d, {
    x0: x0 - 0.05, x1: x1 + 0.05, y0, y1: py, zE: wall, zR, oh: 0.32, ohBack: 0.3, color: H.roof, trim: H.trim, snow,
    hookRight: (zAt) => chimney(d, 4.8, 5.3, 1.6, 2.1, (x) => zAt(x), zR + 0.25, '#8E7A6A', meta),
  });
  const zEo = wall - 0.32 * ((zR - wall) / ((x1 - x0) / 2 + 0.05));
  // rafter tails under the right eave
  for (let y = y0; y < py + 0.2; y += 0.42) d.box(x1 + 0.05, y, zEo - 0.2, 0.3, 0.07, 0.07, H.trim, { noTop: true });
  return { doorX: cx, front: py + 0.7, eave: { x0: x0 - 0.1, x1: x1 + 0.1, y: py + 0.05, z: wall - 0.05 }, top: zR };
}

function houseVictorian(d, H, meta, env) {
  const x0 = 1.0, x1 = 5.8, y0 = 1.0, y1 = 3.9, wall = 2.6, zR = 4.2, f = 0.18, snow = env.season === 'winter';
  const bx0 = 1.0, bx1 = 3.05, by1 = 4.9, bzR = 4.0, accent = H.door;
  d.shadowRect(x0 - 0.3, y0 - 0.3, x1 + 0.6, by1 + 0.4, zR);
  d.box(x0 - 0.05, y0 - 0.05, 0, x1 - x0 + 0.1, y1 - y0 + 0.1, f, '#8E8478');
  // main front (only the part right of the bay shows)
  wallFront(d, x0, x1, y1, f, wall, H.body, 'lap', (ctx, W, Hp, map) => {
    const reg = regFor(meta, map), du = (4.35 - x0) * TW - 9;
    door(ctx, du, Hp - 32, 18, 32, accent, H, 'panel', reg);
    ctx.fillStyle = glassFill(ctx, du, Hp - 37.5, 18, 5); ctx.fillRect(du, Hp - 37.5, 18, 4.5); ctx.fillStyle = H.trim; ctx.fillRect(du - 2.5, Hp - 40, 23, 2.5);
    win(ctx, W - 26, Hp - 36, 14, 24, 'classic', H, reg, { low: true });
    win(ctx, (3.65 - x0) * TW - 7, 9, 13, 23, H.windows, H, reg); win(ctx, W - 25, 9, 13, 23, H.windows, H, reg);
    lampFixture(ctx, du + 25, Hp - 27, reg);
    ctx.fillStyle = accent; ctx.fillRect(0, 37.5, W, 2.6); ctx.fillStyle = H.trim; ctx.fillRect(0, 40.1, W, 1.2);
  });
  wallSide(d, x1, y0, y1, f, wall, H.body, 'lap', (ctx, W, Hp, map) => {
    const reg = regFor(meta, map);
    win(ctx, W * 0.32 - 7, 9, 13, 23, H.windows, H, reg); win(ctx, W * 0.68 - 7, 9, 13, 23, H.windows, H, reg);
    win(ctx, W * 0.5 - 7, Hp - 36, 13, 24, 'classic', H, reg);
    ctx.fillStyle = accent; ctx.fillRect(0, 37.5, W, 2.6);
  });
  gableSide(d, x1, y0, y1, wall, zR, H.body, 'fishscale', (ctx, W, Hp, map) => { const reg = regFor(meta, map); win(ctx, W / 2 - 6, Hp * 0.45, 12, 16, 'arched', H, reg); });
  // projecting bay
  d.box(bx0 - 0.05, y1, 0, bx1 - bx0 + 0.1, by1 - y1 + 0.05, f, '#8E8478');
  wallFront(d, bx0, bx1, by1, f, wall, H.body, 'lap', (ctx, W, Hp, map) => {
    const reg = regFor(meta, map);
    win(ctx, W / 2 - 20, 9, 13, 23, H.windows, H, reg); win(ctx, W / 2 + 7, 9, 13, 23, H.windows, H, reg);
    ctx.fillStyle = H.trim; ctx.fillRect(W / 2 - 26, Hp - 38, 52, 30);
    [W / 2 - 24, W / 2 - 7, W / 2 + 10].forEach((u) => win(ctx, u, Hp - 36, 14, 25, 'classic', H, reg, { low: true }));
    ctx.fillStyle = accent; ctx.fillRect(0, 37.5, W, 2.6); ctx.fillStyle = H.trim; ctx.fillRect(0, 40.1, W, 1.2);
  });
  wallSide(d, bx1, y1, by1, f, wall, H.body, 'lap', (ctx, W, Hp, map) => { ctx.fillStyle = accent; ctx.fillRect(0, 37.5, W, 2.6); });
  // wraparound porch
  const px0 = bx1, px1 = x1 + 0.3, py = 5.2, pf = 0.36, pz = 1.5;
  d.box(px0, y1, 0, px1 - px0, py - y1, pf, '#7A6A5A', { top: lit('#A07850', [0, 0, 1]) });
  for (let k = 1; k < 6; k++) d.line([px0 + k * 0.5, y1, pf + 0.001], [px0 + k * 0.5, py, pf + 0.001], 'rgba(60,40,20,.25)', 0.6);
  d.box(4.0, py, 0, 0.75, 0.3, 0.24, '#8A7A6A'); d.box(4.0, py + 0.3, 0, 0.75, 0.28, 0.12, '#958575');
  const posts = [px0 + 0.12, 3.85, 4.9, px1 - 0.1];
  [[px0 + 0.12, 3.85], [4.9, px1 - 0.1]].forEach(([a, b]) => {
    d.box(a, py - 0.1, pf + 0.42, b - a, 0.06, 0.05, H.trim);
    for (let x = a + 0.1; x < b; x += 0.15) d.line([x, py - 0.07, pf], [x, py - 0.07, pf + 0.42], H.trim, 1.3);
  });
  d.box(px1 - 0.1, y1 + 0.2, pf + 0.42, 0.06, py - y1 - 0.3, 0.05, H.trim);
  for (let y = y1 + 0.25; y < py - 0.1; y += 0.15) d.line([px1 - 0.07, y, pf], [px1 - 0.07, y, pf + 0.42], H.trim, 1.3);
  posts.forEach((x) => { d.box(x - 0.06, py - 0.12, pf, 0.12, 0.12, pz - pf, H.trim); d.line([x - 0.06, py, pf + 0.3], [x + 0.06, py, pf + 0.3], accent, 1.5); });
  // spindle frieze and bracketed porch roof
  d.box(px0, py - 0.14, pz - 0.14, px1 - px0, 0.14, 0.14, H.trim);
  d.front(px0, py, pz - 0.02, () => { const ctx = d.ctx; for (let u = 2; u < (px1 - px0) * TW; u += 3.2) vline(ctx, u, 0.5, 4, accent, 0.9); });
  d.poly([[px0, y1, pz + 0.22], [px1 + 0.12, y1, pz + 0.22], [px1 + 0.12, py + 0.15, pz], [px0, py + 0.15, pz]], snow ? lit(SNOW, [0, 0.4, 1]) : lit(H.roof, [0, 0.4, 1]), 'rgba(30,20,25,.3)');
  d.poly([[px1 + 0.12, y1, pz + 0.22], [px1 + 0.12, py + 0.15, pz], [px1 + 0.12, py + 0.15, pz - 0.08], [px1 + 0.12, y1, pz + 0.14]], lit(H.trim, [1, 0, 0]));
  fascia(d, [px0, py + 0.15, pz], [px1 + 0.12, py + 0.15, pz], 0.08, H.trim, [0, 1, 0]);
  // roofs: main side gable, then the bay's steep front gable over it
  roofSideGable(d, {
    x0, x1, y0, y1, zE: wall, zR, oh: 0.25, color: H.roof, trim: H.trim, snow, mat: 'slate',
    hookBack: (zAt) => { chimney(d, 4.55, 4.95, 1.45, 1.85, zAt, zR + 0.55, '#8E4A3C', meta); },
  });
  gableFront(d, bx0 - 0.05, bx1 + 0.05, by1, wall, bzR, H.body, 'fishscale', (ctx, W, Hp, map) => {
    const reg = regFor(meta, map);
    ctx.fillStyle = H.trim; ctx.beginPath(); ctx.arc(W / 2, Hp * 0.62, 8.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = glassFill(ctx, W / 2 - 6.5, Hp * 0.62 - 6.5, 13, 13); ctx.beginPath(); ctx.arc(W / 2, Hp * 0.62, 6.3, 0, Math.PI * 2); ctx.fill();
    hline(ctx, W / 2 - 6, W / 2 + 6, Hp * 0.62, H.trim, 1); vline(ctx, W / 2, Hp * 0.62 - 6, Hp * 0.62 + 6, H.trim, 1);
    reg(W / 2 - 5, Hp * 0.62 - 5, W / 2 + 5, Hp * 0.62 + 5);
    // sunburst at the apex
    ctx.strokeStyle = accent; ctx.lineWidth = 0.9; for (let a = 0.35; a < Math.PI - 0.3; a += 0.28) { ctx.beginPath(); ctx.moveTo(W / 2, 3); ctx.lineTo(W / 2 + Math.cos(a) * 12, 3 + Math.sin(a) * 9); ctx.stroke(); }
  });
  roofFrontGable(d, { x0: bx0 - 0.05, x1: bx1 + 0.05, y0: 2.75, y1: by1, zE: wall, zR: bzR, oh: 0.22, ohBack: 0, color: H.roof, trim: H.trim, snow, mat: 'slate' });
  const bxm = (bx0 + bx1) / 2;
  d.line([bxm, by1 + 0.22, bzR], [bxm, by1 + 0.22, bzR + 0.55], '#3A3340', 1.6); circ(d.ctx, ...d.P(bxm, by1 + 0.22, bzR + 0.36), 1.6, '#C9A24A');
  return { doorX: 4.35, front: 5.75, eave: { x0: px0, x1: px1 + 0.1, y: py + 0.15, z: pz - 0.08 }, top: zR };
}

function houseModern(d, H, meta, env) {
  const snow = env.season === 'winter', dark = H.trim, wood = H.door;
  const ax0 = 1.0, ax1 = 4.6, ay0 = 1.2, ay1 = 4.4, az = 2.6;
  const bx0 = 4.6, bx1 = 6.75, by0 = 1.6, by1 = 4.85, bz = 1.45;
  d.shadowRect(ax0 - 0.3, ay0 - 0.3, bx1 + 0.2, by1 + 0.2, az);
  d.box(ax0, ay0, 0, bx1 - ax0, by1 - ay0, 0.08, '#B9B4AC');
  // tall white box
  wallFront(d, ax0, ax1, ay1, 0.08, az, H.body, 'stucco', (ctx, W, Hp, map) => {
    const reg = regFor(meta, map);
    // floor-to-ceiling glass on the ground floor
    const gu = 8, gw = W - 16, gv = Hp - 40, gh = 38;
    ctx.fillStyle = dark; ctx.fillRect(gu - 2, gv - 2, gw + 4, gh + 2);
    ctx.fillStyle = glassFill(ctx, gu, gv, gw, gh); ctx.fillRect(gu, gv, gw, gh);
    ctx.fillStyle = 'rgba(244,236,222,.35)'; ctx.fillRect(gu + gw * 0.62, gv, gw * 0.3, gh);
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.moveTo(gu + 10, gv); ctx.lineTo(gu + 30, gv); ctx.lineTo(gu + 8, gv + gh); ctx.lineTo(gu - 12, gv + gh); ctx.closePath(); ctx.fill();
    for (let k = 1; k < 4; k++) vline(ctx, gu + (gw * k) / 4, gv, gv + gh, dark, 1.4);
    reg(gu, gv, gu + gw, gv + gh, 'window', { low: true, big: true });
    // upper ribbon window
    ctx.fillStyle = dark; ctx.fillRect(16, 12, W - 30, 19); ctx.fillStyle = glassFill(ctx, 18, 14, W - 34, 15); ctx.fillRect(18, 14, W - 34, 15);
    vline(ctx, 18 + (W - 34) / 2, 14, 29, dark, 1.2);
    reg(18, 14, W - 16, 29, 'window', { big: true });
  }, { eaveShadow: 0 });
  wallSide(d, ax1, ay0, ay1, 0.08, az, H.body, 'stucco', (ctx, W, Hp, map) => { const reg = regFor(meta, map); ctx.fillStyle = dark; ctx.fillRect(W * 0.3, 8, 12, 30); ctx.fillStyle = glassFill(ctx, W * 0.3 + 2, 10, 8, 26); ctx.fillRect(W * 0.3 + 2, 10, 8, 26); reg(W * 0.3 + 2, 10, W * 0.3 + 10, 36); }, { eaveShadow: 0 });
  // cantilevered roof slab and its shadow line
  d.box(ax0 - 0.2, ay0 - 0.2, az, ax1 - ax0 + 0.4, ay1 - ay0 + 0.65, 0.16, dark, { top: snow ? lit(SNOW, [0, 0, 1]) : lit(shade(dark, 0.18), [0, 0, 1]) });
  meta.strips.push([d.P(ax0 - 0.1, ay1 + 0.42, az - 0.01), d.P(ax1 + 0.1, ay1 + 0.42, az - 0.01)]);
  // low dark wing with wood slats and the front door
  wallFront(d, bx0, bx1, by1, 0.08, bz, '#3A3D42', 'board', (ctx, W, Hp, map) => {
    const reg = regFor(meta, map);
    ctx.fillStyle = wood; ctx.fillRect(4, 0, 30, Hp); ctx.save(); ctx.translate(4, 0); texture(ctx, 'slat', 30, Hp, wood, 2); ctx.restore();
    door(ctx, W - 28, Hp - 38, 17, 38, shade(wood, -0.1), H, 'modern', reg);
    ctx.fillStyle = glassFill(ctx, W - 9, Hp - 38, 5, 38); ctx.fillRect(W - 9, Hp - 38, 5, 38); reg(W - 9, Hp - 38, W - 4, Hp, 'door');
    ctx.fillStyle = '#E8E2D6'; ctx.font = `600 7px ${FONTS.display}`; ctx.fillText(String(meta.number || ''), 10, 10);
  }, { eaveShadow: 0 });
  wallSide(d, bx1, by0, by1, 0.08, bz, '#3A3D42', 'board', null, { eaveShadow: 0 });
  d.box(bx0 - 0.05, by0 - 0.05, bz, bx1 - bx0 + 0.1, by1 - by0 + 0.1, 0.1, '#2B2D31', { top: snow ? lit(SNOW, [0, 0, 1]) : '#4A4D52' });
  // roof terrace: planter and a glass rail
  d.box(bx0 + 0.15, by0 + 0.2, bz + 0.1, 0.5, by1 - by0 - 0.5, 0.22, '#5A5D62', { top: snow ? SNOW : '#5F7A4A' });
  if (!snow) for (let y = by0 + 0.35; y < by1 - 0.4; y += 0.28) { const [sx, sy] = d.P(bx0 + 0.4, y, bz + 0.34); circ(d.ctx, sx, sy - 2, 3, '#6E9A55'); circ(d.ctx, sx + 1, sy - 3, 1.6, '#8DB86E'); }
  d.poly([[bx0, by1 + 0.02, bz + 0.1], [bx1, by1 + 0.02, bz + 0.1], [bx1, by1 + 0.02, bz + 0.45], [bx0, by1 + 0.02, bz + 0.45]], 'rgba(190,220,235,.35)', 'rgba(255,255,255,.5)');
  d.poly([[bx1 + 0.02, by0, bz + 0.1], [bx1 + 0.02, by1, bz + 0.1], [bx1 + 0.02, by1, bz + 0.45], [bx1 + 0.02, by0, bz + 0.45]], 'rgba(170,200,220,.3)', 'rgba(255,255,255,.4)');
  return { doorX: 6.15, front: 5.35, eave: { x0: ax0, x1: ax1, y: ay1 + 0.45, z: az - 0.02 }, top: az + 0.2, noLights: true };
}

function houseVilla(d, H, meta, env) {
  const x0 = 1.0, x1 = 6.3, y0 = 1.3, y1 = 4.4, wall = 2.45, zR = 3.3, f = 0.12, snow = env.season === 'winter', cx = 3.65;
  d.shadowRect(x0 - 0.35, y0 - 0.35, x1 + 0.35, y1 + 0.35, zR);
  d.box(x0 - 0.04, y0 - 0.04, 0, x1 - x0 + 0.08, y1 - y0 + 0.08, f, '#B9A58A');
  wallFront(d, x0, x1, y1, f, wall, H.body, 'stucco', (ctx, W, Hp, map) => {
    const reg = regFor(meta, map), dc = (cx - x0) * TW, du = dc - 11;
    // arched entry with a tile surround
    const arch = (r, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(dc - r, Hp); ctx.lineTo(dc - r, Hp - 25); ctx.arc(dc, Hp - 25, r, Math.PI, 0); ctx.lineTo(dc + r, Hp); ctx.closePath(); ctx.fill(); };
    arch(16.5, '#C2794A');
    for (let a = Math.PI; a <= 2 * Math.PI + 0.01; a += Math.PI / 9) limb(ctx, dc + Math.cos(a) * 13.5, Hp - 25 + Math.sin(a) * 13.5, dc + Math.cos(a) * 16.5, Hp - 25 + Math.sin(a) * 16.5, 'rgba(90,40,20,.4)', 0.8);
    arch(13.5, shade(H.body, -0.3));
    door(ctx, du, Hp - 36, 22, 36, H.door, { ...H, trim: shade(H.body, -0.3) }, 'arched', reg);
    lampFixture(ctx, dc - 22, Hp - 30, reg); lampFixture(ctx, dc + 22, Hp - 30, reg);
    // lower and upper arched windows with iron grilles
    [W * 0.14, W * 0.86].forEach((c) => {
      win(ctx, c - 9, Hp - 36, 18, 24, 'arched', H, reg, { low: true });
      for (let k = c - 8; k < c + 9; k += 3.4) vline(ctx, k, Hp - 28, Hp - 12, '#2B2B30', 0.8);
      win(ctx, c - 9, 6, 18, 24, 'arched', H, reg);
    });
    // French window with a Juliet balcony
    win(ctx, dc - 8, 5, 16, 21, 'arched', H, reg);
    ctx.strokeStyle = '#2B2B30'; ctx.lineWidth = 1; rrPath(ctx, dc - 13, 21, 26, 9, 2); ctx.stroke();
    for (let k = dc - 11; k < dc + 12; k += 4) { ctx.beginPath(); ctx.arc(k + 2, 25.5, 1.8, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = '#2B2B30'; ctx.fillRect(dc - 14, 30, 28, 1.6);
    // bougainvillea climbing the left corner
    for (let i = 0; i < 46; i++) { const u = 2 + h1(i * 3.1) * 26 - (i / 46) * 4, v = Hp - (i / 46) * Hp * 0.92 + h1(i * 1.7) * 8 - 4; circ(ctx, u, v, 2.2 + h1(i) * 1.6, i % 3 ? '#C2416B' : '#6E9A55'); if (i % 4 === 0) circ(ctx, u + 1, v - 1, 1, '#F07FA8'); }
  });
  wallSide(d, x1, y0, y1, f, wall, H.body, 'stucco', (ctx, W, Hp, map) => {
    const reg = regFor(meta, map);
    [W * 0.3, W * 0.7].forEach((c) => { win(ctx, c - 8, 10, 16, 24, 'arched', H, reg); win(ctx, c - 8, Hp - 36, 16, 24, 'arched', H, reg, { low: true }); });
  });
  stoop(d, cx, y1, 1.3);
  const r = roofHip(d, {
    x0, x1, y0, y1, zE: wall, zR, oh: 0.36, color: H.roof, trim: H.trim, snow,
    hookBack: (zAt) => chimney(d, 4.7, 5.1, 2.1, 2.5, zAt, zR + 0.45, '#D8C3A3', meta),
  });
  return { doorX: cx, front: y1 + 0.75, eave: r.eave, top: zR };
}

const HOUSE_FN = {
  standard: (d, H, m, e) => houseSideGable(d, H, m, e, { x0: 1.6, x1: 5.9, y0: 1.6, y1: 4.4, wall: 1.32, zR: 2.48, mat: 'lap' }),
  colonial: (d, H, m, e) => houseSideGable(d, H, m, e, { x0: 1.2, x1: 6.1, y0: 1.4, y1: 4.3, wall: 2.6, zR: 3.75, mat: 'brick', twoStory: true }),
  craftsman: houseCraftsman,
  victorian: houseVictorian,
  modern: houseModern,
  villa: houseVilla,
};

// ---------------------------------------------------------------------------------------------
// Yard: lawn, paths, car, fountain base, flag pole, string-light wires
// ---------------------------------------------------------------------------------------------
const GRASS = { spring: '#7FB35A', summer: '#6CA24C', fall: '#93A157', winter: '#E9EEF3' };
function grassTone(env, k = 0) { const g = GRASS[env.season] || GRASS.summer; return env.season === 'winter' ? shade(g, -k * 0.05) : shade(g, k * 0.06); }
function lawn(d, r, env, L) {
  const ctx = d.ctx, winter = env.season === 'winter';
  // base tiles with gentle variation
  for (let i = 0; i < 10; i++) for (let j = 0; j < 9; j++) {
    const y0 = j * 0.92, y1 = Math.min(STREET.lawnFront, y0 + 0.92); if (y0 >= STREET.lawnFront) continue;
    let c = grassTone(env, (h1(i * 7.1 + j * 3.3 + r.seed * 50) - 0.5));
    if (r.lawn === 'striped' && !winter) c = shade(c, (Math.floor(i * 1.0) % 2) ? 0.07 : -0.04);
    d.ground(i, y0, 1, y1 - y0, c);
  }
  if (r.lawn === 'meadow' && !winter) {
    for (let k = 0; k < 120; k++) { const x = 0.3 + h1(k * 2.3 + r.seed) * 9, y = 4.6 + h1(k * 5.1 + r.seed) * 3.4; if (Math.abs(x - L.doorX) < 0.6 || x > 6.8) continue; const [sx, sy] = d.P(x, y); limb(ctx, sx, sy, sx + (h1(k) - 0.5) * 2, sy - 4 - h1(k * 3) * 4, '#5E8F40', 0.8); if (k % 3 === 0) circ(ctx, sx, sy - 6, 1.2, ['#F2C230', '#F2EEE8', '#C2416B', '#8E7CC3'][k % 4]); }
  } else if (!winter) {
    for (let k = 0; k < 70; k++) { const x = 0.2 + h1(k * 1.3 + r.seed * 9) * 9.4, y = h1(k * 7.9 + r.seed) * 8; const [sx, sy] = d.P(x, y); limb(ctx, sx - 1, sy, sx - 1.5, sy - 2.6, rgba(shade(grassTone(env), -0.3), 0.6), 0.7); limb(ctx, sx + 1, sy, sx + 1.4, sy - 2.2, rgba(shade(grassTone(env), -0.3), 0.6), 0.7); }
  }
  if (env.season === 'fall') for (let k = 0; k < 40; k++) { const [sx, sy] = d.P(h1(k * 3.7 + r.seed) * 9.5, h1(k * 1.9 + r.seed * 3) * 8); ell(ctx, sx, sy, 2, 1.1, ['#C2632B', '#D98F2B', '#8A5A3B', '#B5482A'][k % 4], k); }
}
function yardGround(d, r, env, meta, L) {
  const ctx = d.ctx, winter = env.season === 'winter', member = r.member;
  lawn(d, r, env, L);
  // back fence (town-provided)
  d.box(0, 0.05, 0, LOT_W - 0.05, 0.08, 0.55, '#B89E82', { front: lit('#C4AA8C', [0, 1, 0]) });
  for (let x = 0.2; x < LOT_W; x += 0.32) d.line([x, 0.13, 0], [x, 0.13, 0.55], 'rgba(90,60,40,.25)', 0.6);
  // driveway
  const dc = winter ? '#C8CDD2' : '#BDB7AE';
  d.ground(6.95, 2.0, 1.95, STREET.lawnFront - 2.0, dc, 0.005);
  for (let y = 3.0; y < STREET.lawnFront; y += 1.4) d.line([6.95, y, 0.006], [8.9, y, 0.006], 'rgba(90,85,80,.3)', 0.7);
  d.line([7.92, 2.0, 0.006], [7.92, STREET.lawnFront, 0.006], 'rgba(90,85,80,.22)', 0.6);
  // zen garden takes the left lawn
  if (r.lawn === 'zen') {
    d.ground(0.4, 5.0, L.doorX - 1.0, 2.6, winter ? '#E6EBF0' : '#D8D2C6', 0.004);
    if (!winter) for (let y = 5.15; y < 7.6; y += 0.18) d.line([0.45, y, 0.005], [L.doorX - 0.65, y, 0.005], 'rgba(150,140,125,.45)', 0.6);
    [[1.0, 5.6, 0.32], [2.1, 6.9, 0.22], [1.6, 6.2, 0.16]].forEach(([x, y, s]) => { const [sx, sy] = d.P(x, y); ell(ctx, sx, sy, s * 30, s * 16, '#7E7A74'); ell(ctx, sx - 2, sy - 3, s * 22, s * 11, '#9A958E'); });
  }
  // walkway from the door to the sidewalk
  const fancy = member && r.lawn !== 'plain';
  for (let y = L.front - 0.15; y < STREET.lawnFront - 0.05; y += 0.5) {
    if (fancy) { const [sx, sy] = d.P(L.doorX + (h1(y * 7) - 0.5) * 0.1, y + 0.2); ell(ctx, sx, sy, 11, 5.2, winter ? '#C9CED3' : '#A8A196'); ell(ctx, sx - 1, sy - 0.8, 9.5, 4.2, winter ? '#D9DEE2' : '#BDB6AA'); }
    else d.ground(L.doorX - 0.38, y, 0.76, 0.44, winter ? '#CDD2D6' : '#C4BDB3', 0.004, 'rgba(90,85,80,.25)');
  }
  if (r.lawn === 'garden') bedSpans(L).forEach(([a, b]) => { d.ground(a, L.front - 0.1, b - a, 0.62, winter ? '#E3E8ED' : '#5B4334', 0.006); d.box(a, L.front + 0.52, 0, b - a, 0.06, 0.07, '#C4BDB3'); });
}
const bedSpans = (L) => [[0.6, L.doorX - 0.5], [L.doorX + 0.5, 6.7]].filter(([a, b]) => b - a > 0.4);
// Things standing in the yard in front of the house, drawn after it.
function yardObjects(d, r, env, meta, L) {
  const ctx = d.ctx, winter = env.season === 'winter', member = r.member;
  if (r.lawn === 'garden') {
    const bedY = L.front - 0.1;
    bedSpans(L).forEach(([a, b]) => {
      if (!winter) for (let x = a + 0.18; x < b - 0.1; x += 0.26) { const [sx, sy] = d.P(x, bedY + 0.3); circ(ctx, sx, sy - 3, 4.2, '#4E7F3A'); circ(ctx, sx - 1, sy - 4.5, 2.4, '#6E9F50'); const fc = env.season === 'fall' ? ['#D98F2B', '#C2632B'] : ['#E05D8A', '#F2C230', '#F2EEE8', '#8E7CC3']; circ(ctx, sx + 1.5, sy - 6, 1.6, fc[Math.floor(x * 7) % fc.length]); circ(ctx, sx - 2.5, sy - 5, 1.3, fc[Math.floor(x * 11) % fc.length]); }
    });
  }
  // shrubs by the house corners (everyone gets two)
  [[0.75, L.front - 0.2], [6.55, L.front - 0.4]].forEach(([x, y], i) => { if (r.lawn === 'garden' && i === 0) return; const [sx, sy] = d.P(x, y); d.shadowBlob(x, y, 0.35, 0.6, 0.15); circ(ctx, sx, sy - 6, 7.5, winter ? '#5E7A5E' : '#4A7A3A'); circ(ctx, sx - 2.5, sy - 8.5, 4.5, winter ? '#F4F7FA' : '#5F9248'); circ(ctx, sx + 3, sy - 7, 3.5, winter ? '#E8EEF3' : '#6EA352'); });
  // fountain base
  if (member && r.extras.fountain) fountainBase(d, 5.35, 6.15, env, meta);
  // flag pole
  if (member && r.extras.flag) { d.box(6.62, 5.32, 0, 0.07, 0.07, 2.5, '#D9D5CE'); circ(ctx, ...d.P(6.655, 5.355, 2.55), 1.8, '#C9A24A'); meta.flag = d.P(6.655, 5.355, 2.42); }
  // string lights draped under the eave
  if (member && r.extras.lights && L.eave) {
    const e = L.eave, n = Math.max(3, Math.round((e.x1 - e.x0) / 1.2)), bulbs = [];
    ctx.strokeStyle = 'rgba(40,30,30,.55)'; ctx.lineWidth = 0.7;
    for (let s = 0; s < n; s++) {
      const a = e.x0 + ((e.x1 - e.x0) * s) / n, b = e.x0 + ((e.x1 - e.x0) * (s + 1)) / n;
      ctx.beginPath();
      for (let k = 0; k <= 10; k++) { const x = a + ((b - a) * k) / 10, sag = Math.sin((Math.PI * k) / 10) * 0.18, [sx, sy] = d.P(x, e.y + 0.02, e.z - sag); k ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); if (k % 3 === 1) bulbs.push([sx, sy + 1.5]); }
      ctx.stroke();
    }
    meta.bulbs = bulbs;
  }
  // path lanterns
  if (member && r.extras.lanterns) {
    meta.lanterns = [];
    for (let y = L.front + 0.5; y < STREET.lawnFront - 0.3; y += 1.15) [-0.62, 0.62].forEach((dx) => {
      const x = L.doorX + dx; d.box(x - 0.05, y - 0.05, 0, 0.1, 0.1, 0.42, '#2B2B30'); d.box(x - 0.09, y - 0.09, 0.42, 0.18, 0.18, 0.16, '#3A3340', { front: '#F2D9A0', side: shade('#F2D9A0', -0.2) }); d.box(x - 0.1, y - 0.1, 0.58, 0.2, 0.2, 0.04, '#2B2B30');
      meta.lanterns.push(d.P(x, y, 0.5));
    });
  }
  if (r.car) car(d, r.car, 7.25, 4.75, env);
}

// ---------------------------------------------------------------------------------------------
// Cars (oriented along y, nose toward the street)
// ---------------------------------------------------------------------------------------------
function car(d, c, x0, y0, env) {
  const ctx = d.ctx, type = c.type, col = c.color, snow = env.season === 'winter';
  const L = { hatch: 2.2, suv: 2.6, pickup: 2.95, vintage: 2.75 }[type] || 2.4, w = 1.3, x1 = x0 + w, y1 = y0 + L;
  const zb = 0.2, hb = type === 'suv' ? 0.56 : type === 'pickup' ? 0.5 : 0.42, zt = zb + hb;
  const chrome = '#D9DCE0', tire = '#24232A';
  ell(ctx, ...d.P(x0 + w / 2 + 0.22, y0 + L / 2 - 0.12, 0), (L * 0.75) * TW * 0.95, (L * 0.48) * TH * 1.2, 'rgba(28,30,26,.28)', 0.46);
  // far-side wheels peek out below the body
  [[y0 + 0.5], [y1 - 0.55]].forEach(([yw]) => { const [sx, sy] = d.P(x0 + 0.06, yw, 0.2); ell(ctx, sx, sy, 5.5, 6, tire); });
  // body
  const bodyFront = lit(col, [0, 1, 0]), bodySide = lit(col, [1, 0, 0]);
  if (type === 'pickup') {
    const cab0 = y0 + L * 0.44;
    d.box(x0, y0, zb, w, L, hb, col);
    d.ground(x0 + 0.08, y0 + 0.08, w - 0.16, cab0 - y0 - 0.1, shade(col, -0.45), zt + 0.002);
    d.box(x0 + 0.08, cab0 - 0.06, zt, w - 0.16, 0.06, 0.02, shade(col, -0.2));
  } else d.box(x0, y0, zb, w, L, hb, col);
  // side trim line and door seam
  d.side(x1, y1, zt, () => { hline(ctx, 4, L * TW - 4, hb * ZH * 0.45, rgba(shade(col, -0.45), 0.5), 0.8); vline(ctx, L * TW * 0.42, 2, hb * ZH - 2, rgba(shade(col, -0.45), 0.5), 0.7); rr(ctx, L * TW * 0.47, hb * ZH * 0.3, 4, 1.4, 0.6, chrome); });
  // cabin
  const cabA = type === 'pickup' ? y0 + L * 0.46 : y0 + L * 0.26, cabB = type === 'pickup' ? y0 + L * 0.74 : y0 + L * (type === 'suv' ? 0.82 : 0.72);
  const ins = 0.08, rise = type === 'suv' ? 0.52 : 0.44, topA = cabA + (type === 'suv' ? 0.06 : 0.14), topB = cabB - (type === 'suv' ? 0.14 : 0.32), zc = zt + rise;
  const xl = x0 + ins, xr = x1 - ins, glass = '#33414D', glassLit = '#5B7384', roofCol = type === 'vintage' ? '#F2EEE8' : col;
  if (faces([0, -rise, topA - cabA])) d.poly([[xl, cabA, zt], [xr, cabA, zt], [xr, topA, zc], [xl, topA, zc]], glass);
  d.poly([[xr, cabA, zt], [xr, cabB, zt], [xr, topB, zc], [xr, topA, zc]], lit(glassLit, [1, 0, 0]), 'rgba(20,20,25,.4)');
  // pillars on the side glass
  d.line([xr, cabA + (cabB - cabA) * 0.48, zt], [xr, topA + (topB - topA) * 0.48, zc], roofCol, 1.6);
  d.poly([[xl, cabB, zt], [xr, cabB, zt], [xr, topB, zc], [xl, topB, zc]], lit(glassLit, [0, 0.6, 0.8]), 'rgba(20,20,25,.4)');
  const [w0x, w0y] = d.P(xl + 0.2, cabB - 0.05, zt + 0.1), [w1x, w1y] = d.P(xl + 0.45, topB + 0.05, zc - 0.05);
  limb(ctx, w0x, w0y, w1x, w1y, 'rgba(255,255,255,.35)', 2);
  d.poly([[xl, topA, zc], [xr, topA, zc], [xr, topB, zc], [xl, topB, zc]], snow ? lit(SNOW, [0, 0, 1]) : lit(roofCol, [0, 0, 1]));
  if (type === 'suv') { d.line([xl + 0.08, topA + 0.05, zc + 0.06], [xl + 0.08, topB - 0.05, zc + 0.06], '#2B2B30', 1.2); d.line([xr - 0.08, topA + 0.05, zc + 0.06], [xr - 0.08, topB - 0.05, zc + 0.06], '#2B2B30', 1.2); }
  // nose: headlights, grille, bumper
  d.front(x0, y1, zt, () => {
    const W = w * TW, Hh = hb * ZH;
    rr(ctx, 3, Hh * 0.25, 7, 4, 1.4, '#F6F1DC'); rr(ctx, W - 10, Hh * 0.25, 7, 4, 1.4, '#F6F1DC');
    rr(ctx, W / 2 - 7, Hh * 0.28, 14, 5, 1.2, type === 'vintage' ? chrome : '#2B2B30');
    if (type === 'vintage') for (let k = W / 2 - 6; k < W / 2 + 7; k += 2) vline(ctx, k, Hh * 0.3, Hh * 0.28 + 4.6, '#8A8F96', 0.6);
  });
  d.box(x0 - 0.03, y1, zb - 0.02, w + 0.06, 0.07, 0.13, type === 'vintage' ? chrome : '#2B2B30');
  // near-side wheels on the +x face
  [y0 + 0.5, y1 - 0.55].forEach((yw) => d.side(x1 + 0.005, yw, 0.2, () => {
    ctx.fillStyle = shade(col, -0.55); ctx.beginPath(); ctx.arc(0, 0, 9, Math.PI, 0); ctx.fill();
    circ(ctx, 0, 0, 7.4, tire); circ(ctx, 0, 0, type === 'vintage' ? 5 : 4, type === 'vintage' ? '#F2EEE8' : '#A9AEB5'); circ(ctx, 0, 0, type === 'vintage' ? 3.2 : 1.6, type === 'vintage' ? '#C9CDD2' : '#6A6E75');
  }));
  // mirror
  d.box(x1, cabB - 0.12, zt + 0.04, 0.1, 0.08, 0.07, col);
}

function fountainBase(d, x, y, env, meta) {
  const ctx = d.ctx, r = 0.62, [sx, sy] = d.P(x, y, 0), rx = r * TW * Math.SQRT2, ry = r * TH * Math.SQRT2, h = 0.3 * ZH;
  d.shadowBlob(x, y, r, 0.4, 0.16);
  ctx.fillStyle = '#A9A196'; ctx.beginPath(); ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI); ctx.lineTo(sx - rx, sy - h); ctx.ellipse(sx, sy - h, rx, ry, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill();
  ell(ctx, sx, sy - h, rx, ry, '#C9C2B8'); ell(ctx, sx, sy - h + 0.6, rx - 3, ry - 1.6, env.season === 'winter' ? '#DCE8F0' : '#4F8FB0');
  if (env.season !== 'winter') ell(ctx, sx, sy - h, rx - 5, ry - 3, '#6FA9C6');
  ctx.fillStyle = '#B9B1A6'; ctx.fillRect(sx - 2.5, sy - h - 22, 5, 22);
  ell(ctx, sx, sy - h - 22, 10, 4.2, '#C9C2B8'); ell(ctx, sx, sy - h - 21.4, 8, 3, env.season === 'winter' ? '#DCE8F0' : '#5C9CBD');
  ctx.fillStyle = '#B9B1A6'; ctx.fillRect(sx - 1.2, sy - h - 29, 2.4, 7); circ(ctx, sx, sy - h - 30, 2.4, '#C9C2B8');
  meta.fountain = { sx, sy, h, rx, ry };
}

// ---------------------------------------------------------------------------------------------
// Billboards: the clickable piece of every plot
// ---------------------------------------------------------------------------------------------
const SIGN_Y = 7.68;
const SIGN_BOX = {
  post: { x0: 0.45, x1: 2.85, z0: 0.48, z1: 1.66 },
  classic: { x0: 0.25, x1: 3.15, z0: 1.05, z1: 2.75 },
  marquee: { x0: 0.35, x1: 3.05, z0: 0.62, z1: 2.55 },
  round: { x0: 0.55, x1: 2.85, z0: 0.95, z1: 3.11 },
  hanging: { x0: 0.75, x1: 2.85, z0: 1.05, z1: 2.15 },
  neon: { x0: 0.3, x1: 3.05, z0: 0.42, z1: 2.25 },
};
function medalBadge(ctx, x, y, r, slug) {
  const m = MEDALS[slug] || { tier: 'bronze', glyph: 'star' }, c = TIER_COLORS[m.tier];
  if (m.tier === 'legendary') { const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r); g.addColorStop(0, '#F472B6'); g.addColorStop(1, '#7C5CE8'); ctx.fillStyle = g; } else ctx.fillStyle = c;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = rgba(shade(m.tier === 'legendary' ? '#9B5CE0' : c, -0.4), 0.8); ctx.lineWidth = Math.max(0.6, r * 0.16); ctx.stroke();
  glyph(ctx, m.glyph, x, y, r * 1.15, m.tier === 'silver' ? '#4A5260' : '#FFFFFF');
}
export function glyph(ctx, kind, x, y, s, c) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 10, s / 10); ctx.fillStyle = c; ctx.strokeStyle = c; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const star = (r1, r2, n = 5) => { ctx.beginPath(); for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + (i * Math.PI) / n, r = i % 2 ? r2 : r1; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); };
  ctx.beginPath();
  switch (kind) {
    case 'crown': ctx.moveTo(-5, 3); ctx.lineTo(-5, -3); ctx.lineTo(-2.5, 0); ctx.lineTo(0, -4); ctx.lineTo(2.5, 0); ctx.lineTo(5, -3); ctx.lineTo(5, 3); ctx.closePath(); ctx.fill(); break;
    case 'check': ctx.moveTo(-4, 0); ctx.lineTo(-1.2, 3); ctx.lineTo(4.2, -3.4); ctx.stroke(); break;
    case 'flag': ctx.moveTo(-3.5, 4.5); ctx.lineTo(-3.5, -4.5); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-3.5, -4.5); ctx.lineTo(4, -2.5); ctx.lineTo(-3.5, -0.5); ctx.closePath(); ctx.fill(); break;
    case 'target': ctx.arc(0, 0, 4.2, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 1.6, 0, Math.PI * 2); ctx.fill(); break;
    case 'trophy': ctx.moveTo(-3.5, -4); ctx.lineTo(3.5, -4); ctx.lineTo(2.5, 0.5); ctx.lineTo(-2.5, 0.5); ctx.closePath(); ctx.fill(); ctx.fillRect(-0.8, 0.5, 1.6, 2.5); ctx.fillRect(-2.8, 3, 5.6, 1.5); break;
    case 'flame': ctx.moveTo(0, -5); ctx.bezierCurveTo(4, -1, 4.5, 2, 3, 3.6); ctx.bezierCurveTo(1.5, 5.2, -1.5, 5.2, -3, 3.6); ctx.bezierCurveTo(-4.5, 2, -3, -0.5, -1, -2); ctx.bezierCurveTo(-0.8, 0, 0.6, 0.2, 0, -5); ctx.fill(); break;
    case 'gem': ctx.moveTo(-4.5, -1.5); ctx.lineTo(-2.5, -4); ctx.lineTo(2.5, -4); ctx.lineTo(4.5, -1.5); ctx.lineTo(0, 4.5); ctx.closePath(); ctx.fill(); break;
    case 'heart': ctx.moveTo(0, 4); ctx.bezierCurveTo(-6, -0.5, -3.5, -6, 0, -2.2); ctx.bezierCurveTo(3.5, -6, 6, -0.5, 0, 4); ctx.fill(); break;
    case 'home': ctx.moveTo(-4.5, 0); ctx.lineTo(0, -4.5); ctx.lineTo(4.5, 0); ctx.lineTo(3.2, 0); ctx.lineTo(3.2, 4); ctx.lineTo(-3.2, 4); ctx.lineTo(-3.2, 0); ctx.closePath(); ctx.fill(); break;
    case 'spark': star(5, 1.6, 4); break;
    case 'bolt': ctx.moveTo(1, -5); ctx.lineTo(-3.5, 1); ctx.lineTo(-0.3, 1); ctx.lineTo(-1, 5); ctx.lineTo(3.5, -1); ctx.lineTo(0.3, -1); ctx.closePath(); ctx.fill(); break;
    default: star(5, 2.2);
  }
  ctx.restore();
}
function signContent(ctx, W, H, p, th, o = {}) {
  const pad = o.pad ?? Math.max(4, W * 0.065), nameSize = Math.min(o.nameSize || H * 0.25, 14.5);
  const medals = (p.medals || []).slice(0, 3), mr = Math.max(3.4, nameSize * 0.36);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = th.fg; ctx.font = `${th.weight || 800} ${nameSize}px ${th.font}`;
  const room = W - pad * 2 - (o.badgeRoom || 0), wide = ctx.measureText(p.name || '').width;
  if (wide > room) ctx.font = `${th.weight || 800} ${Math.max(nameSize * 0.68, (nameSize * room) / wide)}px ${th.font}`;
  const name = fitText(ctx, p.name || 'Neighbor', room);
  ctx.fillText(name, pad, pad + nameSize * 0.82);
  let y = pad + nameSize * 0.82 + nameSize * 0.62;
  if (!o.compact && H >= 44 && p.headline) { ctx.font = `500 ${Math.max(5.2, nameSize * 0.46)}px ${FONTS.ui}`; ctx.fillStyle = th.muted; ctx.fillText(fitText(ctx, p.headline, W - pad * 2), pad, y); y += nameSize * 0.6; }
  // progress toward the current goal
  const goal = p.goal || null, barY = H - pad - mr * 2 - 3.5, barW = W - pad * 2 - (medals.length ? 0 : 0);
  if (goal) {
    ctx.font = `600 ${Math.max(4.8, nameSize * 0.4)}px ${FONTS.ui}`; ctx.fillStyle = th.muted;
    const label = fitText(ctx, goal.label, barW - 18); ctx.fillText(label, pad, barY - 2.5);
    ctx.textAlign = 'right'; ctx.fillStyle = th.fg; ctx.fillText(`${Math.round(goal.pct)}%`, W - pad, barY - 2.5); ctx.textAlign = 'left';
    rr(ctx, pad, barY, barW, 2.8, 1.4, th.track); rr(ctx, pad, barY, Math.max(2.8, (barW * Math.min(100, goal.pct)) / 100), 2.8, 1.4, th.accent);
  }
  medals.forEach((m, i) => medalBadge(ctx, pad + mr + i * (mr * 2 + 2.2), H - pad - mr + 0.5, mr, m));
  if (p.address) { ctx.font = `600 ${Math.max(4.4, nameSize * 0.34)}px ${FONTS.ui}`; ctx.fillStyle = th.muted; ctx.textAlign = 'right'; ctx.fillText(p.address, W - pad, H - pad - mr + 2); ctx.textAlign = 'left'; }
}
function badges(ctx, W, H, p, member) {
  if (member) { // member star, top-right
    const x = W - 6.5, y = 6.5; circ(ctx, x, y, 5.2, '#2B2230'); circ(ctx, x, y, 4.4, '#F5B82E'); glyph(ctx, 'star', x, y, 5, '#2B2230');
  }
  if (p.newNeighbor) { // green tab standing on top of the sign
    ctx.font = `800 4.8px ${FONTS.ui}`; const tw = ctx.measureText('NEW NEIGHBOR').width + 7;
    rr(ctx, 3, -7.5, tw, 7.5, 2, '#3F9D62'); ctx.fillStyle = '#FFFFFF'; ctx.fillText('NEW NEIGHBOR', 6.5, -2.2);
  }
}
// The face of each sign, in face pixels. Used for the daytime image and again, lit, at night.
function signFace(ctx, s, W, H, p, accent, member) {
  if (s === 'post') {
    rr(ctx, 0, 0, W, H, 2, '#F4EFE6'); ctx.strokeStyle = '#3A3340'; ctx.lineWidth = 1.2; rrPath(ctx, 1.5, 1.5, W - 3, H - 3, 1.6); ctx.stroke();
    signContent(ctx, W, H, p, { fg: '#2A2230', muted: '#6B6070', accent: '#C2416B', track: '#E2D9CC', font: FONTS.display }, { nameSize: 10, pad: 5, badgeRoom: member ? 9 : 0 });
    badges(ctx, W, H, p, member);
  } else if (s === 'classic') {
    ctx.fillStyle = '#2F3437'; ctx.fillRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#FFFDF8'); g.addColorStop(1, '#F1EBE0'); ctx.fillStyle = g; ctx.fillRect(3, 3, W - 6, H - 6);
    ctx.fillStyle = accent; ctx.fillRect(3, 3, 4, H - 6);
    ctx.save(); ctx.translate(5, 3); signContent(ctx, W - 10, H - 6, p, { fg: '#1F1A24', muted: '#6B6070', accent, track: '#E6DED2', font: FONTS.display }, { nameSize: 12.5, badgeRoom: 9 }); ctx.restore();
    badges(ctx, W - 3, H, p, member);
  } else if (s === 'marquee') {
    const top = 15, body = () => { ctx.beginPath(); ctx.moveTo(0, H); ctx.lineTo(0, top); ctx.quadraticCurveTo(W / 2, -top * 0.6, W, top); ctx.lineTo(W, H); ctx.closePath(); };
    body(); ctx.fillStyle = shade(accent, -0.25); ctx.fill();
    ctx.save(); ctx.translate(5, 5); ctx.scale((W - 10) / W, (H - 10) / H); body(); ctx.restore(); ctx.fillStyle = '#251B2B'; ctx.fill();
    ctx.save(); ctx.translate(9, 11); signContent(ctx, W - 18, H - 15, p, { fg: '#FCE7B2', muted: '#C9B48A', accent: '#F2C14E', track: '#4A3A50', font: FONTS.slab, weight: 400 }, { nameSize: 11.5, badgeRoom: 6 }); ctx.restore();
    badges(ctx, W, H, p, member);
  } else if (s === 'round') {
    const R = W / 2, cy = H / 2, g = p.goal;
    ctx.fillStyle = shade(accent, -0.45); ctx.beginPath(); ctx.arc(R + 1.8, cy + 0.9, R, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FBF7F0'; ctx.beginPath(); ctx.arc(R, cy, R, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(R, cy, R - 3, 0, Math.PI * 2); ctx.fill();
    if (g) { ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(R, cy, R - 7, 0, Math.PI * 2); ctx.stroke(); ctx.strokeStyle = '#FFFFFF'; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(R, cy, R - 7, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * g.pct) / 100); ctx.stroke(); }
    ctx.textAlign = 'center'; ctx.fillStyle = '#FFFFFF'; ctx.font = `800 12px ${FONTS.display}`; ctx.fillText(fitText(ctx, (p.name || '').split(' ')[0], R * 1.4), R, cy - 4);
    ctx.font = `600 5.6px ${FONTS.ui}`; ctx.fillStyle = 'rgba(255,255,255,.85)'; if (g) { ctx.fillText(fitText(ctx, g.label, R * 1.3), R, cy + 4); ctx.font = `800 7px ${FONTS.ui}`; ctx.fillStyle = '#FFFFFF'; ctx.fillText(`${Math.round(g.pct)}%`, R, cy + 12); }
    ctx.textAlign = 'left';
    (p.medals || []).slice(0, 3).forEach((m, i) => medalBadge(ctx, R + (i - 1) * 9.5, cy + 23, 4, m));
    if (member) { circ(ctx, R + R * 0.68, cy - R * 0.68, 5.2, '#2B2230'); circ(ctx, R + R * 0.68, cy - R * 0.68, 4.4, '#F5B82E'); glyph(ctx, 'star', R + R * 0.68, cy - R * 0.68, 5, '#2B2230'); }
    if (p.newNeighbor) badges(ctx, W, H, { newNeighbor: true }, false);
  } else if (s === 'hanging') {
    rr(ctx, 0, 0, W, H, 3, '#7A4E32');
    for (let k = 0; k < 8; k++) { ctx.strokeStyle = 'rgba(40,20,10,.25)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(0, 3 + k * 4.4); ctx.bezierCurveTo(W * 0.3, 1 + k * 4.4, W * 0.6, 6 + k * 4.4, W, 3 + k * 4.4); ctx.stroke(); }
    ctx.strokeStyle = '#E3C27A'; ctx.lineWidth = 1; rrPath(ctx, 3, 3, W - 6, H - 6, 2); ctx.stroke();
    ctx.save(); ctx.translate(2, 1); signContent(ctx, W - 4, H - 2, p, { fg: '#F2D58A', muted: '#E3C99A', accent: '#E3C27A', track: '#5A3A24', font: FONTS.serif, weight: 700 }, { nameSize: 11.5, compact: true, badgeRoom: member ? 9 : 0 }); ctx.restore();
    badges(ctx, W, H, p, member);
  } else if (s === 'neon') {
    rr(ctx, 0, 0, W, H, 3, '#16141F'); ctx.strokeStyle = rgba(accent, 0.55); ctx.lineWidth = 1.4; rrPath(ctx, 3, 3, W - 6, H - 6, 3); ctx.stroke();
    ctx.font = `400 17px ${FONTS.neon}`; ctx.fillStyle = rgba(shade(accent, 0.4), 0.85); ctx.fillText(fitText(ctx, (p.name || '').split(' ')[0], W - 14), 7, 21);
    ctx.save(); ctx.translate(2, 22); signContent(ctx, W - 4, H - 24, { ...p, name: '' }, { fg: '#F2EEE8', muted: '#A9A3B8', accent, track: '#2E2A3A', font: FONTS.ui }, { nameSize: 0.01, compact: false, pad: 5 }); ctx.restore();
    badges(ctx, W, H, p, member);
  }
}
function drawBillboard(d, r, env, meta) {
  const ctx = d.ctx, s = r.sign.style, b = SIGN_BOX[s], p = r.profile, accent = r.sign.color, member = r.member;
  const W = (b.x1 - b.x0) * TW, H = (b.z1 - b.z0) * ZH, yb = SIGN_Y, snow = env.season === 'winter';
  meta.sign = { x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, y: yb, W, H, style: s };
  const plate = (x0, x1, z0, z1, c, depth = 0.08) => { d.poly([[x1, yb - depth, z0], [x1, yb, z0], [x1, yb, z1], [x1, yb - depth, z1]], lit(c, [1, 0, 0])); d.poly([[x0, yb - depth, z1], [x1, yb - depth, z1], [x1, yb, z1], [x0, yb, z1]], snow ? SNOW : lit(c, [0, 0, 1])); };
  const face = () => d.front(b.x0, yb, b.z1, () => signFace(ctx, s, W, H, p, accent, member));
  d.shadowRect(b.x0, yb - 0.1, b.x1, yb + 0.02, b.z1, 0.14);
  if (s === 'post') {
    [b.x0 + 0.2, b.x1 - 0.32].forEach((x) => d.box(x, yb - 0.1, 0, 0.12, 0.1, b.z1 + 0.06, '#8A6A55'));
    plate(b.x0, b.x1, b.z0, b.z1, '#E9E2D6'); face();
  } else if (s === 'classic') {
    [b.x0 + 0.55, b.x1 - 0.7].forEach((x) => { d.box(x, yb - 0.22, 0, 0.14, 0.14, b.z1 - 0.1, '#5A5D62'); });
    d.box(b.x0 + 0.05, yb, b.z0 - 0.08, b.x1 - b.x0 - 0.1, 0.26, 0.05, '#4A4D52');
    for (let x = b.x0 + 0.1; x < b.x1 - 0.05; x += 0.22) d.line([x, yb + 0.25, b.z0 - 0.03], [x, yb + 0.25, b.z0 + 0.22], '#4A4D52', 0.8);
    d.line([b.x0 + 0.05, yb + 0.25, b.z0 + 0.22], [b.x1 - 0.05, yb + 0.25, b.z0 + 0.22], '#4A4D52', 1);
    plate(b.x0, b.x1, b.z0, b.z1, '#2F3437', 0.12); face();
    meta.signLamps = [];
    [0.2, 0.5, 0.8].forEach((t) => { const x = b.x0 + (b.x1 - b.x0) * t; d.line([x, yb - 0.05, b.z1], [x, yb + 0.35, b.z1 + 0.25], '#3A3D42', 1.2); const [sx, sy] = d.P(x, yb + 0.38, b.z1 + 0.2); ell(ctx, sx, sy, 3.4, 1.8, '#3A3D42'); meta.signLamps.push([sx, sy + 1]); });
  } else if (s === 'marquee') {
    d.box(b.x0 + 0.25, yb - 0.25, 0, b.x1 - b.x0 - 0.5, 0.25, b.z0, '#9C4A3A');
    d.front(b.x0 + 0.25, yb, b.z0, () => texture(ctx, 'brick', (b.x1 - b.x0 - 0.5) * TW, b.z0 * ZH, lit('#9C4A3A', [0, 1, 0]), 5));
    d.poly([[b.x1, yb - 0.1, b.z0], [b.x1, yb, b.z0], [b.x1, yb, b.z1 - 0.4], [b.x1, yb - 0.1, b.z1 - 0.4]], lit(shade(accent, -0.3), [1, 0, 0]));
    face();
    d.front(b.x0, yb, b.z1, (map) => {
      const top = 15, pts = [];
      for (let u = 4; u < W - 2; u += 5.5) { const t = u / W; pts.push(map(u, top * (1 - 3.2 * t + 3.2 * t * t) + 2.8)); }
      for (let v = top + 4; v < H - 2; v += 5.5) { pts.push(map(2.5, v)); pts.push(map(W - 2.5, v)); }
      for (let u = 5; u < W - 2; u += 5.5) pts.push(map(u, H - 2.5));
      meta.bulbPath = pts;
    });
  } else if (s === 'round') {
    const cx = (b.x0 + b.x1) / 2;
    d.box(cx - 0.07, yb - 0.12, 0, 0.14, 0.12, b.z0 + 0.2, '#4A4D52');
    d.box(cx - 0.3, yb - 0.32, 0, 0.6, 0.5, 0.06, '#6A6D72');
    face();
  } else if (s === 'hanging') {
    d.box(0.35, yb - 0.08, 0, 0.16, 0.16, b.z1 + 0.5, '#5A4030');
    d.box(0.35, yb - 0.06, b.z1 + 0.32, b.x1 - 0.2, 0.12, 0.12, '#5A4030');
    d.line([0.5, yb, b.z1 + 0.02], [0.95, yb, b.z1 + 0.32], '#5A4030', 2);
    [b.x0 + 0.2, b.x1 - 0.2].forEach((x) => d.line([x, yb, b.z1 + 0.33], [x, yb, b.z1], '#2B2B30', 0.9));
    plate(b.x0, b.x1, b.z0, b.z1, '#7A4E32', 0.07); face();
    const [px, py] = d.P(0.43, yb + 0.25, 0); rr(ctx, px - 7, py - 7, 14, 7, 1.5, '#8A5A3B'); if (env.season !== 'winter') [-4, 0, 4].forEach((k, i) => { circ(ctx, px + k, py - 9, 3.2, '#4E7F3A'); circ(ctx, px + k + 1, py - 11, 1.6, ['#E05D8A', '#F2C230', '#F2EEE8'][i]); });
  } else if (s === 'neon') {
    d.box(b.x0 + 0.15, yb - 0.2, 0, b.x1 - b.x0 - 0.3, 0.2, b.z0, '#8E8C88');
    plate(b.x0, b.x1, b.z0, b.z1, '#16141F', 0.12); face();
  }
  const m = (u, v) => { const [a, bb] = d.P(b.x0, yb, b.z1); return [a + u, bb + 0.5 * u + v]; };
  meta.hit.sign = [m(0, 0), m(W, 0), m(W, H), m(0, H)];
}

// ---------------------------------------------------------------------------------------------
// Plot layers
// ---------------------------------------------------------------------------------------------
export function plotOrigin(i) { return i * LOT_W; }
// Bounding box of a plot in iso pixels (for caching and culling).
export function plotBounds(i) {
  const ox = plotOrigin(i); let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const x of [ox - 0.6, ox + LOT_W + 0.6]) for (const y of [-0.6, STREET.lawnFront + 0.6]) for (const z of [0, 6]) { const [sx, sy] = iso(x, y, z); x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx); y1 = Math.max(y1, sy); }
  return { x: Math.floor(x0 - 24), y: Math.floor(y0 - 24), w: Math.ceil(x1 - x0 + 48), h: Math.ceil(y1 - y0 + 48) };
}

export function drawPlot(ctx, plot, i, layer, env) {
  const r = plot._resolved || resolvePlot(plot), d = pen(ctx, plotOrigin(i));
  const meta = plot._meta && layer === 'front' ? plot._meta : { lights: [], chimneys: [], strips: [], hit: {}, number: plot.number || i * 2 + 2 };
  if (layer === 'back') {
    // a quick dry layout pass so the yard knows where the door is
    const L = HOUSE_LAYOUT[r.house.style] || HOUSE_LAYOUT.standard;
    yardGround(d, r, env, meta, L);
    const H = { ...r.house };
    const res = (HOUSE_FN[r.house.style] || HOUSE_FN.standard)(d, H, meta, env);
    yardObjects(d, r, env, meta, { ...L, eave: res.eave || L.eave });
    meta.layout = res; meta.member = r.member; meta.resolved = r;
    meta.tvIndex = Math.floor(r.seed * 97) % Math.max(1, meta.lights.filter((l) => l.kind === 'window').length);
    const hb = []; for (const [x, y, z] of [[1, 1, 0], [6.6, 1, 0], [6.6, 5.4, 0], [1, 5.4, 0], [1, 1, res.top], [6.6, 1, res.top], [6.6, 5.4, res.top], [1, 5.4, res.top]]) hb.push(d.P(x, y, z));
    meta.hit.house = hb;
    plot._meta = meta;
  } else {
    // front layer: billboard, mailbox, side hedge
    drawBillboard(d, r, env, meta);
    const L = meta.layout || HOUSE_LAYOUT.standard, mx = L.doorX > 5.5 ? L.doorX - 0.85 : L.doorX + 0.85, my = 7.75;
    d.box(mx - 0.03, my - 0.03, 0, 0.06, 0.06, 0.55, '#3A3340');
    d.box(mx - 0.14, my - 0.2, 0.55, 0.28, 0.4, 0.2, r.member ? r.house.door : '#3A3340', { top: env.season === 'winter' ? SNOW : undefined });
    d.front(mx - 0.14, my + 0.2, 0.75, (map) => { ctx.fillStyle = '#F2EEE8'; ctx.font = `700 4.2px ${FONTS.ui}`; ctx.fillText(String(meta.number), 1.6, 5.2); });
    const winter = env.season === 'winter';
    for (let y = 0.4; y < STREET.lawnFront - 0.2; y += 0.42) { const [sx, sy] = d.P(LOT_W - 0.3, y, 0); circ(ctx, sx, sy - 5, 6.2, winter ? '#6E8A6E' : '#3F6E34'); circ(ctx, sx - 1.6, sy - 7, 4, winter ? '#F2F6F9' : '#558A44'); }
  }
  return meta;
}
// Door positions per style, used by the yard before the house is drawn.
const HOUSE_LAYOUT = {
  standard: { doorX: 3.75, front: 5.1, eave: { x0: 1.32, x1: 6.18, y: 4.68, z: 1.12 } },
  colonial: { doorX: 3.65, front: 5.0, eave: { x0: 0.92, x1: 6.38, y: 4.58, z: 2.4 } },
  craftsman: { doorX: 3.7, front: 6.15, eave: { x0: 1.1, x1: 6.3, y: 5.5, z: 1.33 } },
  victorian: { doorX: 4.35, front: 5.75, eave: { x0: 3.05, x1: 6.2, y: 5.35, z: 1.42 } },
  modern: { doorX: 6.15, front: 5.35, eave: { x0: 1.0, x1: 4.6, y: 4.85, z: 2.58 } },
  villa: { doorX: 3.65, front: 5.15, eave: { x0: 0.64, x1: 6.66, y: 4.76, z: 2.14 } },
};

// ---------------------------------------------------------------------------------------------
// Member animations (redrawn every frame between the back and front layers)
// ---------------------------------------------------------------------------------------------
export function drawPlotLive(ctx, plot, i, meta, t, env) {
  const r = meta && meta.resolved; if (!r || !r.member) return;
  const d = pen(ctx, plotOrigin(i)), seed = r.seed * 10, still = env.reducedMotion;
  const tt = still ? 0 : t;
  if (r.tree !== 'none') tree(ctx, ...d.P(1.05, 5.25), r.tree, env, tt, seed, d);
  if (meta.fountain) fountainWater(ctx, meta.fountain, tt, env);
  if (meta.flag) pennant(ctx, meta.flag, tt, r.sign.color, (r.profile.crew || 'V')[0]);
  if (meta.chimneys.length && env.season !== 'summer') smoke(ctx, meta.chimneys[0], tt, seed);
  if (r.pet) pet(ctx, d, r, meta, tt, env);
  if (env.season === 'fall' && r.tree !== 'none' && r.tree !== 'pine') fallingLeaves(ctx, d.P(1.05, 5.25), tt, seed);
}
function tree(ctx, bx, by, kind, env, t, seed, d) {
  const sway = Math.sin(t * 1.1 + seed) * 1.6 + Math.sin(t * 2.3 + seed * 2) * 0.5, s = env.season;
  d.shadowBlob(1.05, 5.25, 0.9, 2.2, 0.14);
  if (kind === 'pine') {
    rr(ctx, bx - 2, by - 12, 4, 12, 1, '#5A3E2E');
    const tiers = [[0, 26, 22], [-15, 21, 18], [-28, 15, 14]];
    tiers.forEach(([dy, w, h], k) => {
      const x = bx + sway * (0.3 + k * 0.3), y = by - 10 + dy;
      ctx.fillStyle = '#2F5A3A'; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x + w * 0.2 + 2, y - h); ctx.lineTo(x + w, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3F7A4A'; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(x + w * 0.2 + 2, y - h); ctx.lineTo(x - w * 0.1, y); ctx.closePath(); ctx.fill();
      if (s === 'winter') { ctx.fillStyle = '#F4F7FA'; ctx.beginPath(); ctx.moveTo(x - w * 0.7, y - h * 0.3); ctx.lineTo(x + w * 0.2 + 2, y - h); ctx.lineTo(x + w * 0.65, y - h * 0.3); ctx.quadraticCurveTo(x, y - h * 0.15, x - w * 0.7, y - h * 0.3); ctx.fill(); }
    });
    return;
  }
  // trunk and branches
  ctx.fillStyle = '#5A3E2E'; ctx.beginPath(); ctx.moveTo(bx - 3.2, by); ctx.lineTo(bx - 1.6, by - 30); ctx.lineTo(bx + 1.6, by - 30); ctx.lineTo(bx + 3.2, by); ctx.closePath(); ctx.fill();
  limb(ctx, bx, by - 22, bx - 12 + sway * 0.3, by - 36, '#5A3E2E', 2.2); limb(ctx, bx, by - 26, bx + 13 + sway * 0.3, by - 40, '#5A3E2E', 2);
  const bare = s === 'winter' || (kind === 'cherry' && s === 'fall' && false);
  if (bare) { [[-16, -46], [-4, -54], [10, -50], [18, -42]].forEach(([dx, dy]) => limb(ctx, bx, by - 30, bx + dx + sway * 0.5, by + dy, '#6A4E3E', 1.4)); [[-16, -47], [-4, -55], [10, -51]].forEach(([dx, dy]) => ell(ctx, bx + dx + sway * 0.5, by + dy, 3.5, 1.4, '#FFFFFF')); return; }
  const pal = kind === 'cherry'
    ? ({ spring: ['#E58FB0', '#F2B6CC', '#FBD9E5'], summer: ['#3F7A3A', '#5A9A48', '#7BB860'], fall: ['#B5482A', '#D9772B', '#E8A13A'] })[s] || ['#3F7A3A', '#5A9A48', '#7BB860']
    : ({ spring: ['#4E8A3A', '#6EAD4C', '#93CC6A'], summer: ['#356B2E', '#4E8A3A', '#6EAD4C'], fall: ['#A8452A', '#D9772B', '#EDB13A'] })[s] || ['#356B2E', '#4E8A3A', '#6EAD4C'];
  const blobs = [[-14, -38, 13], [12, -40, 13], [-2, -50, 15], [-10, -56, 10], [9, -55, 11], [0, -36, 12], [-20, -46, 8], [19, -47, 8]];
  blobs.forEach(([dx, dy, rr0], k) => circ(ctx, bx + dx + sway * (0.6 + (-dy / 60)), by + dy, rr0, pal[0]));
  blobs.forEach(([dx, dy, rr0], k) => circ(ctx, bx + dx - 2 + sway * (0.6 + (-dy / 60)), by + dy - 2.5, rr0 * 0.72, pal[1]));
  blobs.forEach(([dx, dy, rr0], k) => { if (k % 2 === 0) circ(ctx, bx + dx - 4 + sway * (0.6 + (-dy / 60)), by + dy - 5, rr0 * 0.38, pal[2]); });
  if (s === 'spring' && kind !== 'cherry') for (let k = 0; k < 8; k++) circ(ctx, bx - 18 + h1(k + seed) * 36 + sway * 0.8, by - 34 - h1(k * 3 + seed) * 26, 1.3, '#F2EEE8');
}
function fountainWater(ctx, f, t, env) {
  if (env.season === 'winter') return;
  const { sx, sy, h } = f, top = sy - h - 30;
  ctx.strokeStyle = 'rgba(210,235,250,.75)'; ctx.lineWidth = 1;
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + t * 0.3, ex = Math.cos(a) * 12, ey = Math.sin(a) * 5; ctx.beginPath(); ctx.moveTo(sx, top + 1); ctx.quadraticCurveTo(sx + ex * 0.6, top - 8, sx + ex, sy - h - 21 + ey * 0.4); ctx.stroke(); }
  for (let k = 0; k < 3; k++) { const ph = (t * 0.5 + k / 3) % 1; ctx.strokeStyle = `rgba(230,245,255,${0.5 * (1 - ph)})`; ctx.beginPath(); ctx.ellipse(sx, sy - h + 0.5, 4 + ph * (f.rx - 8), 2 + ph * (f.ry - 4), 0, 0, Math.PI * 2); ctx.stroke(); }
  for (let k = 0; k < 6; k++) { const ph = (t * 1.4 + k / 6) % 1; circ(ctx, sx + Math.cos(k * 2.1) * 9 * ph, top - 6 + ph * 14 + ph * ph * 8, 0.9, `rgba(240,250,255,${0.9 * (1 - ph)})`); }
}
function pennant(ctx, [x, y], t, color, letter) {
  const n = 8, len = 26, pts = [];
  for (let k = 0; k <= n; k++) { const u = k / n; pts.push([x + u * len, y + u * 2 + Math.sin(t * 5 - u * 4) * 3 * u, (1 - u) * 9]); }
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x, y - 4.5); pts.forEach(([px, py, hh]) => ctx.lineTo(px, py - hh / 2)); for (let k = n; k >= 0; k--) { const [px, py, hh] = pts[k]; ctx.lineTo(px, py + hh / 2); } ctx.lineTo(x, y + 4.5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = `800 6px ${FONTS.display}`; ctx.fillText(letter, x + 3, pts[2][1] + 2.2);
}
function smoke(ctx, [x, y], t, seed) {
  for (let k = 0; k < 7; k++) {
    const age = (t * 0.22 + k / 7 + seed) % 1, px = x + age * 18 + Math.sin(age * 6 + k) * 2.5, py = y - age * 42;
    circ(ctx, px, py, 2.4 + age * 7, `rgba(235,235,240,${0.42 * (1 - age)})`);
  }
}
function fallingLeaves(ctx, [x, y], t, seed) {
  for (let k = 0; k < 5; k++) { const age = (t * 0.12 + k / 5 + seed) % 1, px = x - 18 + h1(k + seed) * 36 + Math.sin(age * 9 + k) * 6, py = y - 50 + age * 54; ell(ctx, px, py, 2, 1, ['#C2632B', '#D98F2B', '#B5482A'][k % 3], age * 8); }
}
function pet(ctx, d, r, meta, t, env) {
  const kind = r.pet.kind, coat = r.pet.coat, L = meta.layout || { doorX: 3.7 };
  // wander between two spots on the right lawn, pausing at each
  const a = [L.doorX + 0.9, 7.45], b = [6.45, 6.9], cycle = 16, ph = (t + r.seed * 30) % cycle;
  let p, moving = false, dir = 1;
  if (ph < 5) { const u = ph / 5, e = u * u * (3 - 2 * u); p = [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e]; moving = true; dir = 1; }
  else if (ph < 8) { p = b; dir = -1; }
  else if (ph < 13) { const u = (ph - 8) / 5, e = u * u * (3 - 2 * u); p = [b[0] + (a[0] - b[0]) * e, b[1] + (a[1] - b[1]) * e]; moving = true; dir = -1; }
  else { p = a; dir = 1; }
  if (b[0] - a[0] < 0) dir = -dir;
  const [sx, sy] = d.P(p[0], p[1]);
  ctx.save(); ctx.translate(sx, sy); ctx.scale(1.35, 1.35);
  if (kind === 'dog') drawDog(ctx, 0, 0, dir, t, moving, coat); else drawCat(ctx, 0, 0, dir, t, moving, coat);
  ctx.restore();
}
function drawDog(ctx, x, y, dir, t, moving, c) {
  const dark = shade(c, -0.28), light = shade(c, 0.18), sw = moving ? Math.sin(t * 11) * 2.4 : 0, bob = moving ? Math.abs(Math.sin(t * 11)) * 0.8 : Math.sin(t * 2) * 0.3;
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
  ell(ctx, 0, 0.5, 9, 2.6, 'rgba(20,25,20,.25)');
  limb(ctx, -4.5, -5, -4.5 - sw * 0.6, 0, dark, 2.2); limb(ctx, 4, -5, 4 + sw * 0.6, 0, dark, 2.2);
  const wag = Math.sin(t * (moving ? 10 : 15)) * 0.55;
  ctx.save(); ctx.translate(-7.6, -8.5 - bob); ctx.rotate(-1.0 + wag); limb(ctx, 0, 0, 0, -6.5, c, 2.4); ctx.restore();
  ell(ctx, 0, -7.6 - bob, 8.4, 4.5, c); ell(ctx, 1, -9.6 - bob, 6, 1.6, rgba(light, 0.8));
  limb(ctx, -3, -5, -3 + sw * 0.6, 0, c, 2.5); limb(ctx, 5.4, -5, 5.4 - sw * 0.6, 0, c, 2.5);
  ell(ctx, 8.4, -12.4 - bob, 4, 3.7, c); ell(ctx, 11.6, -11.3 - bob, 2.9, 2, light); circ(ctx, 13.8, -11.9 - bob, 1.1, '#1B1A1F'); circ(ctx, 9.8, -13.5 - bob, 0.75, '#1B1A1F');
  ell(ctx, 6.8, -12.6 - bob, 1.7, 3.2, dark, 0.35);
  ctx.strokeStyle = '#C2413A'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(6.5, -10.4 - bob, 2.6, -0.4, 1.8); ctx.stroke();
  ctx.restore();
}
function drawCat(ctx, x, y, dir, t, moving, c) {
  const dark = shade(c, -0.3), light = shade(c, 0.2), sw = moving ? Math.sin(t * 9) * 1.8 : 0, sit = !moving;
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
  ell(ctx, 0, 0.5, 7, 2.2, 'rgba(20,25,20,.25)');
  // tail curls up
  ctx.strokeStyle = c; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.beginPath(); const tw = Math.sin(t * 1.8) * 2;
  ctx.moveTo(-5.5, sit ? -3 : -6.5); ctx.bezierCurveTo(-10, -6, -11 + tw, -12, -7 + tw, -15); ctx.stroke();
  if (sit) { ell(ctx, -1, -5, 5, 5, c); ell(ctx, 1.5, -9, 3.6, 4.4, c); ell(ctx, 3.2, -4, 2.6, 1.6, light); }
  else { limb(ctx, -3.5, -4, -3.5 - sw * 0.6, 0, dark, 1.6); limb(ctx, 3.5, -4, 3.5 + sw * 0.6, 0, dark, 1.6); ell(ctx, 0, -6.4, 6.6, 3.3, c); limb(ctx, -2.5, -4, -2.5 + sw * 0.6, 0, c, 1.8); limb(ctx, 4.5, -4, 4.5 - sw * 0.6, 0, c, 1.8); }
  const hx = sit ? 3 : 6.2, hy = sit ? -13.4 : -9.6;
  circ(ctx, hx, hy, 3.3, c);
  ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(hx - 2.8, hy - 1); ctx.lineTo(hx - 2.2, hy - 5.2); ctx.lineTo(hx - 0.2, hy - 2.6); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(hx + 0.6, hy - 2.6); ctx.lineTo(hx + 2.6, hy - 5.2); ctx.lineTo(hx + 3, hy - 1); ctx.closePath(); ctx.fill();
  circ(ctx, hx + 1.6, hy - 0.4, 0.6, '#2F5A3A'); circ(ctx, hx + 3.1, hy + 0.6, 0.55, '#C27A8A');
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// Light: time of day, and everything that glows
// ---------------------------------------------------------------------------------------------
const SKY = [[0, '#3A4475'], [5, '#454C7C'], [6.2, '#C99AA8'], [7.4, '#FFE9D6'], [9, '#FFFFFF'], [16.5, '#FFFFFF'], [17.8, '#FFE3C4'], [19.0, '#F0A27E'], [19.8, '#9A7BA8'], [20.7, '#4B5283'], [24, '#3A4475']];
export function lightingAt(hour, season) {
  const h = ((hour % 24) + 24) % 24; let k = 0; while (k < SKY.length - 2 && SKY[k + 1][0] <= h) k++;
  const [h0, c0] = SKY[k], [h2, c2] = SKY[k + 1], t = (h - h0) / (h2 - h0 || 1);
  const night = h >= 20.6 || h < 5.2 ? 1 : h < 7 ? Math.max(0, (7 - h) / 1.8) : h > 18.6 ? Math.min(1, (h - 18.6) / 2) : 0;
  let tint = mix(c0, c2, t);
  if (season === 'winter') tint = mix(tint, night > 0.5 ? '#4A5A8A' : '#E6EDF7', 0.5);
  return { tint, night, golden: h > 16.8 && h < 19.6 ? 1 - Math.abs(h - 18.4) / 1.6 : 0 };
}
function glow(ctx, x, y, r, color, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(color, a)); g.addColorStop(1, rgba(color, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}
function fillPts(ctx, pts, fill) { ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
export function drawPlotLights(ctx, plot, i, meta, t, env) {
  if (!meta) return;
  const r = meta.resolved, member = r.member, n = env.night, warm = '#FFC978';
  ctx.save();
  if (n > 0.02) {
    const windows = meta.lights.filter((l) => l.kind === 'window');
    meta.lights.forEach((l) => {
      const cx = (l.pts[0][0] + l.pts[2][0]) / 2, cy = (l.pts[0][1] + l.pts[2][1]) / 2;
      if (l.kind === 'porch') {
        if (member) { ctx.globalCompositeOperation = 'lighter'; glow(ctx, cx, cy, 26, '#FFB45A', 0.45 * n); glow(ctx, cx, cy + 30, 34, '#FFB45A', 0.12 * n); ctx.globalCompositeOperation = 'source-over'; }
        fillPts(ctx, l.pts, rgba('#FFE2A8', (member ? 0.95 : 0.55) * n));
        return;
      }
      const isTv = member && l.kind === 'window' && windows.indexOf(l) === meta.tvIndex && !env.reducedMotion;
      let a = (member ? 0.88 : 0.55) * n, c = warm;
      if (member && !env.reducedMotion) a *= 0.92 + 0.08 * Math.sin(t * 1.3 + cx * 0.1);
      if (isTv) { c = mix('#8FB8FF', '#C9D9FF', (Math.sin(t * 7) + Math.sin(t * 11.3)) * 0.25 + 0.5); a = 0.85 * n; }
      fillPts(ctx, l.pts, rgba(c, a));
      if (member) {
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, cx, cy, l.big ? 60 : 22, c, (l.big ? 0.22 : 0.16) * n);
        if (l.low) { ctx.save(); ctx.translate(cx - 10, cy + 34); ctx.scale(1.6, 0.6); glow(ctx, 0, 0, l.big ? 40 : 20, c, 0.13 * n); ctx.restore(); }
        ctx.globalCompositeOperation = 'source-over';
      }
    });
    (meta.strips || []).forEach(([a, b]) => { if (!member) return; ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = rgba('#FFE6B8', 0.9 * n); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); glow(ctx, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 10, 70, '#FFD9A0', 0.12 * n); ctx.globalCompositeOperation = 'source-over'; });
    (meta.lanterns || []).forEach(([x, y]) => { ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, y, 16, '#FFC070', 0.5 * n); ctx.save(); ctx.translate(x, y + 12); ctx.scale(1.6, 0.55); glow(ctx, 0, 0, 22, '#FFC070', 0.18 * n); ctx.restore(); ctx.globalCompositeOperation = 'source-over'; });
    if (meta.fountain && member && env.season !== 'winter') { const f = meta.fountain; ctx.globalCompositeOperation = 'lighter'; ctx.save(); ctx.translate(f.sx, f.sy - f.h); ctx.scale(1, 0.5); glow(ctx, 0, 0, f.rx, '#5FD0FF', 0.35 * n); ctx.restore(); ctx.globalCompositeOperation = 'source-over'; }
  }
  // string lights: visible by day as bulbs, glowing at night
  (meta.bulbs || []).forEach(([x, y], k) => {
    const tw = env.reducedMotion ? 1 : 0.75 + 0.25 * Math.sin(t * 3 + k * 1.7);
    circ(ctx, x, y, 1.3, n > 0.05 ? rgba('#FFE7A8', 0.6 + 0.4 * tw) : '#F2EAD0');
    if (n > 0.05) { ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, y, 7, '#FFD27A', 0.35 * n * tw); ctx.globalCompositeOperation = 'source-over'; }
  });
  drawSignLights(ctx, plot, i, meta, t, env);
  // a quiet sparkle around a new neighbor's sign (a good-news signal, shown for everyone)
  if (r.profile.newNeighbor && meta.hit.sign && !env.reducedMotion) {
    const [p0, p1] = meta.hit.sign; for (let k = 0; k < 3; k++) { const ph = (t * 0.6 + k / 3) % 1, x = p0[0] + (p1[0] - p0[0]) * h1(k + Math.floor(t * 0.6 + k / 3)), y = p0[1] + (p1[1] - p0[1]) * 0.5 - 6 - ph * 10; ctx.globalAlpha = Math.sin(ph * Math.PI); glyph(ctx, 'spark', x, y, 5, '#FFF2B0'); ctx.globalAlpha = 1; }
  }
  // fireflies on member lawns on summer nights
  if (member && env.season === 'summer' && n > 0.4 && !env.reducedMotion) {
    const d = pen(ctx, plotOrigin(i));
    for (let k = 0; k < 7; k++) { const x = 0.8 + h1(k + r.seed * 9) * 5.5 + Math.sin(t * 0.5 + k) * 0.5, y = 5.6 + h1(k * 3 + r.seed) * 2.2 + Math.cos(t * 0.4 + k * 2) * 0.4, [sx, sy] = d.P(x, y, 0.6 + Math.sin(t + k) * 0.25), on = Math.max(0, Math.sin(t * 2 + k * 2.3)); if (on > 0.2) { ctx.globalCompositeOperation = 'lighter'; glow(ctx, sx, sy, 5, '#E8FF7A', 0.7 * on * n); ctx.globalCompositeOperation = 'source-over'; } }
  }
  ctx.restore();
}
function drawSignLights(ctx, plot, i, meta, t, env) {
  const r = meta.resolved, f = meta.sign, n = env.night; if (!f) return;
  const accent = r.sign.color;
  const facePts = meta.hit.sign;
  // A lit sign is redrawn at near-daylight brightness on top of the darkened frame.
  const relight = (a) => { if (a <= 0.01) return; const d = pen(ctx, plotOrigin(i)); ctx.save(); ctx.globalAlpha = a; d.front(f.x0, f.y, f.z1, () => signFace(ctx, f.style, f.W, f.H, r.profile, accent, r.member)); ctx.restore(); };
  if (f.style === 'post') { relight(0.38 * n); return; }
  if (f.style === 'classic' && n > 0.02) {
    relight(0.9 * n); ctx.globalCompositeOperation = 'lighter';
    (meta.signLamps || []).forEach(([x, y]) => glow(ctx, x, y + 6, 22, '#FFE8B8', 0.4 * n));
    ctx.globalCompositeOperation = 'source-over';
  }
  if (f.style === 'marquee') {
    const pts = meta.bulbPath || [], step = env.reducedMotion ? 0 : Math.floor(t * 6);
    relight(0.85 * n);
    pts.forEach(([x, y], k) => { const on = (k + step) % 3 !== 0; circ(ctx, x, y, 1.25, on ? '#FFF1C2' : '#C9A86A'); if (on && n > 0.05) { ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, y, 5, '#FFD27A', 0.45 * n); ctx.globalCompositeOperation = 'source-over'; } });
  }
  if (f.style === 'round' && n > 0.02) {
    const c = [(facePts[0][0] + facePts[2][0]) / 2, (facePts[0][1] + facePts[2][1]) / 2];
    relight(0.88 * n); ctx.globalCompositeOperation = 'lighter'; glow(ctx, c[0], c[1], f.W * 0.8, accent, 0.22 * n); ctx.globalCompositeOperation = 'source-over';
  }
  if (f.style === 'hanging' && n > 0.02) relight(0.6 * n);
  if (f.style === 'neon') {
    relight(0.5 * n);
    const flick = env.reducedMotion ? 1 : (Math.sin(t * 13) > -0.97 ? 1 : 0.35), a = Math.max(0.25, n) * flick;
    const d = pen(ctx, plotOrigin(i));
    d.front(f.x0, f.y, f.z1, () => {
      ctx.font = `400 17px ${FONTS.neon}`; const name = fitText(ctx, (r.profile.name || '').split(' ')[0], f.W - 14);
      ctx.shadowColor = accent; ctx.shadowBlur = 8 * a + 2; ctx.fillStyle = rgba(shade(accent, 0.55), Math.min(1, 0.6 + a)); ctx.fillText(name, 7, 21);
      ctx.shadowBlur = 0; ctx.strokeStyle = rgba(shade(accent, 0.3), 0.5 + 0.5 * a); ctx.lineWidth = 1.4; rrPath(ctx, 3, 3, f.W - 6, f.H - 6, 3); ctx.stroke();
    });
    if (n > 0.05) { const c = [(facePts[0][0] + facePts[2][0]) / 2, (facePts[0][1] + facePts[2][1]) / 2]; ctx.globalCompositeOperation = 'lighter'; glow(ctx, c[0], c[1], f.W, accent, 0.22 * n * flick); ctx.globalCompositeOperation = 'source-over'; }
  }
}

// ---------------------------------------------------------------------------------------------
// The town around the plots: street, the next street over, the landmark, lamps
// ---------------------------------------------------------------------------------------------
const FOG = '#C7D3DB';
function inView(view, x, y, w, h) { return !view || !(x + w < view.x0 || x > view.x1 || y + h < view.y0 || y > view.y1); }
export function townExtent(n) { return { x0: -8, x1: n * LOT_W + 8, y0: -26, y1: 22 }; }
export function drawTownGround(ctx, n, env, view, landmarkPct = 62) {
  const d = pen(ctx, 0), e = townExtent(n), winter = env.season === 'winter', lights = [];
  const grass = grassTone(env), farGrass = mix(grass, FOG, 0.25);
  // ground everywhere
  d.ground(e.x0, e.y0, e.x1 - e.x0, -1.8 - e.y0, farGrass);
  d.ground(e.x0, -1.8, e.x1 - e.x0, 1.85, winter ? '#DCE2E8' : '#B8AE9C');
  for (let x = e.x0; x < e.x1; x += 0.7) { const [sx, sy] = d.P(x + h1(x) * 0.5, -0.9 + h1(x * 3) * 0.8); circ(ctx, sx, sy, 0.8, 'rgba(120,110,95,.4)'); }
  d.ground(e.x0, 0, -e.x0, STREET.lawnFront, grass); d.ground(n * LOT_W, 0, e.x1 - n * LOT_W, STREET.lawnFront, grass);
  // sidewalk, verge, curb, road, far side
  d.ground(e.x0, STREET.lawnFront, e.x1 - e.x0, STREET.walkFront - STREET.lawnFront, winter ? '#D5DADF' : '#CFC9C0');
  for (let x = Math.ceil(e.x0); x < e.x1; x += 1) d.line([x, STREET.lawnFront, 0.002], [x, STREET.walkFront, 0.002], 'rgba(110,105,98,.35)', 0.7);
  d.ground(e.x0, STREET.walkFront, e.x1 - e.x0, STREET.vergeFront - STREET.walkFront, grass);
  d.box(e.x0, STREET.vergeFront, 0, e.x1 - e.x0, 0.15, 0.1, '#B9B4AC', { noSide: true });
  const asphalt = winter ? '#5A5F66' : '#4E5157';
  d.ground(e.x0, STREET.road0, e.x1 - e.x0, STREET.road1 - STREET.road0, asphalt, -0.05);
  for (let k = 0; k < (e.x1 - e.x0) * 3; k++) { const [sx, sy] = d.P(e.x0 + h1(k * 1.3) * (e.x1 - e.x0), STREET.road0 + h1(k * 2.9) * (STREET.road1 - STREET.road0), -0.05); ctx.fillStyle = k % 2 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.08)'; ctx.fillRect(sx, sy, 2, 1); }
  const mid = (STREET.road0 + STREET.road1) / 2;
  for (let x = e.x0; x < e.x1; x += 1.6) d.poly([[x, mid - 0.05, -0.049], [x + 0.9, mid - 0.05, -0.049], [x + 0.9, mid + 0.05, -0.049], [x, mid + 0.05, -0.049]], '#E8C25A', null);
  d.line([e.x0, STREET.road0 + 0.25, -0.049], [e.x1, STREET.road0 + 0.25, -0.049], 'rgba(240,240,240,.55)', 1);
  d.line([e.x0, STREET.road1 - 0.25, -0.049], [e.x1, STREET.road1 - 0.25, -0.049], 'rgba(240,240,240,.55)', 1);
  for (let k = 0; k < n; k++) { const [sx, sy] = d.P(k * LOT_W + 4.5, mid + 0.9, -0.048); ell(ctx, sx, sy, 7, 3.5, '#3E4147'); ell(ctx, sx, sy, 5.5, 2.6, '#55585E'); }
  // crosswalk at the start of the street
  for (let y = STREET.road0 + 0.2; y < STREET.road1 - 0.2; y += 0.42) d.poly([[-3.4, y, -0.048], [-1.6, y, -0.048], [-1.6, y + 0.24, -0.048], [-3.4, y + 0.24, -0.048]], 'rgba(240,240,240,.8)', null);
  d.box(e.x0, STREET.road1, 0, e.x1 - e.x0, 0.15, 0.1, '#B9B4AC', { noSide: true });
  d.ground(e.x0, STREET.road1 + 0.15, e.x1 - e.x0, STREET.farVerge1 - STREET.road1 - 0.15, grass);
  d.ground(e.x0, STREET.farVerge1, e.x1 - e.x0, STREET.farWalk1 - STREET.farVerge1, winter ? '#D5DADF' : '#CFC9C0');
  d.ground(e.x0, STREET.farWalk1, e.x1 - e.x0, e.y1 - STREET.farWalk1, grass);
  // the landmark everyone builds together sits behind the start of the street
  const lx = Math.min(n * LOT_W / 2, 12), ly = -12.6;
  // far row, then the landmark, then trees, then the near row (back to front)
  for (let k = -1; k <= n; k++) for (let j = 0; j < 3; j++) {
    const x = k * LOT_W + 0.5 + j * 3.4, s = h1(k * 5.1 + j * 2.7);
    if (Math.abs(x + 2 - lx) < 4.5) continue;
    const [vx, vy] = d.P(x, -14, 1.5); if (!inView(view, vx - 160, vy - 160, 340, 300)) continue;
    backHouse(d, x, -15.6, s, env, lights, 0.5, true);
  }
  landmark(d, lx, ly, env, lights, landmarkPct, view);
  for (let k = -1; k <= n; k++) { const x = k * LOT_W + 4.8, [sx, sy] = d.P(x, -9.6); if (Math.abs(x - lx) < 2.5 || !inView(view, sx - 40, sy - 90, 80, 100)) continue; const c = env.season === 'fall' ? '#C67A3A' : winter ? '#8E9AA0' : '#4E7A44'; const fc = mix(c, FOG, 0.35); rr(ctx, sx - 1.5, sy - 14, 3, 14, 1, mix('#5A3E2E', FOG, 0.35)); circ(ctx, sx, sy - 24, 13, fc); circ(ctx, sx - 3, sy - 27, 8, shade(fc, 0.1)); }
  for (let k = -1; k <= n; k++) for (let j = 0; j < 2; j++) {
    const x = k * LOT_W + 1.2 + j * 5 + h1(k * 3 + j) * 0.6, s = h1(k * 7.7 + j * 1.3);
    const [vx, vy] = d.P(x, -6.5, 1.5); if (!inView(view, vx - 160, vy - 160, 340, 300)) continue;
    backHouse(d, x, -7.6, s, env, lights, 0.3);
  }
  // a soft haze over everything behind the alley
  const [ax, ay] = d.P(e.x0, -1.9, 0), [bx, by] = d.P(e.x1, -1.9, 0), hz = env.season === 'winter' ? '#E4EAF0' : FOG;
  const g = ctx.createLinearGradient(0, Math.min(ay, by) - 900, 0, Math.max(ay, by));
  g.addColorStop(0, rgba(hz, 0.55)); g.addColorStop(1, rgba(hz, 0.18));
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(bx, by - 4000); ctx.lineTo(ax, ay - 4000); ctx.closePath(); ctx.fill();
  return { lights };
}
function backHouse(d, x0, y0, s, env, lights, haze, simple) {
  const w = 3.6 + s * 0.8, dd = 3.0, h = s > 0.55 ? 2.4 : 1.35, x1 = x0 + w, y1 = y0 + dd, zR = h + 0.9 + s * 0.3;
  const pal = ['#D9CDBD', '#B9C7CF', '#E3D3A8', '#C9A9A0', '#A9BFA8', '#E8E2D6'], body = mix(pal[Math.floor(s * 6) % 6], FOG, haze), roof = mix(['#5A4A44', '#4B5D6B', '#6E3B3B', '#3F3A3D'][Math.floor(s * 13) % 4], FOG, haze), winter = env.season === 'winter';
  // we look at the back wall (+y) and the right wall
  d.poly([[x0, y1, 0], [x1, y1, 0], [x1, y1, h], [x0, y1, h]], lit(body, [0, 1, 0]), 'rgba(40,20,32,.08)');
  d.poly([[x1, y0, 0], [x1, y1, 0], [x1, y1, h], [x1, y0, h]], lit(body, [1, 0, 0]), 'rgba(40,20,32,.08)');
  const ym = (y0 + y1) / 2;
  d.poly([[x1, y0, h], [x1, y1, h], [x1, ym, zR]], lit(body, [1, 0, 0]), 'rgba(40,20,32,.08)');
  const rc = winter ? mix(SNOW, FOG, haze * 0.5) : roof;
  d.poly([[x0 - 0.2, y0 - 0.2, h - 0.1], [x1 + 0.2, y0 - 0.2, h - 0.1], [x1 + 0.2, ym, zR], [x0 - 0.2, ym, zR]], lit(rc, [0, -1, 1.1]), 'rgba(30,20,25,.12)');
  d.poly([[x0 - 0.2, ym, zR], [x1 + 0.2, ym, zR], [x1 + 0.2, y1 + 0.2, h - 0.1], [x0 - 0.2, y1 + 0.2, h - 0.1]], lit(rc, [0, 1, 1.1]), 'rgba(30,20,25,.12)');
  const n = Math.max(2, Math.floor(w / 1.1)), floors = h > 2 ? 2 : 1;
  for (let f = 0; f < floors; f++) for (let k = 0; k < n; k++) {
    if (simple && (k + f) % 2) continue;
    const wx = x0 + 0.45 + k * ((w - 0.9) / (n - 1 || 1)) - 0.2, z0 = 0.45 + f * 1.05;
    const pts = [[wx, y1 + 0.01, z0], [wx + 0.4, y1 + 0.01, z0], [wx + 0.4, y1 + 0.01, z0 + 0.5], [wx, y1 + 0.01, z0 + 0.5]];
    d.poly(pts, mix('#5F7A8A', FOG, haze), null);
    if (h1(x0 * 3 + k * 7 + f) > 0.45) lights.push(pts.map((p) => d.P(...p)));
  }
}
function landmark(d, cx, cy, env, lights, pct, view) {
  const ctx = d.ctx, haze = 0.32, stone = mix('#D8CFC2', FOG, haze), brick = mix('#B07A5E', FOG, haze), x0 = cx - 1.3, x1 = cx + 1.3, y0 = cy - 1.3, y1 = cy + 1.3;
  const [vx, vy] = d.P(cx, cy, 5); if (!inView(view, vx - 200, vy - 260, 400, 420)) return;
  d.shadowRect(x0, y0, x1, y1, 7, 0.12);
  d.box(x0 - 0.3, y0 - 0.3, 0, 3.2, 3.2, 0.55, stone);
  d.box(x0, y0, 0.55, 2.6, 2.6, 4.6, brick);
  d.front(x0, y1, 5.15, () => { texture(ctx, 'brick', 2.6 * TW, 4.6 * ZH, lit(brick, [0, 1, 0]), 9); ctx.fillStyle = mix('#2F3B46', FOG, haze); [[18, 30], [18, 90]].forEach(([u, v]) => { rr(ctx, u, v, 10, 26, 5, mix('#3A4652', FOG, haze)); rr(ctx, u + 36, v, 10, 26, 5, mix('#3A4652', FOG, haze)); }); });
  d.box(x0 - 0.12, y0 - 0.12, 5.15, 2.84, 2.84, 0.18, stone);
  d.box(x0, y0, 5.33, 2.6, 2.6, 1.5, stone);
  // clock faces show the time of day on the slider
  const hour = env.hour ?? 12, hands = (fn) => { const ha = ((hour % 12) / 12) * Math.PI * 2 - Math.PI / 2, ma = ((hour % 1)) * Math.PI * 2 - Math.PI / 2; fn(ha, ma); };
  d.front(x0, y1, 6.83, (map) => { const R = 18, c = [2.6 * TW / 2, 1.5 * ZH / 2]; circ(ctx, c[0], c[1], R + 2, mix('#C9A24A', FOG, haze)); circ(ctx, c[0], c[1], R, '#F7F1E3'); hands((ha, ma) => { limb(ctx, c[0], c[1], c[0] + Math.cos(ha) * 9, c[1] + Math.sin(ha) * 9, '#2B2B30', 2); limb(ctx, c[0], c[1], c[0] + Math.cos(ma) * 14, c[1] + Math.sin(ma) * 14, '#2B2B30', 1.2); }); lights.push({ clock: true, x: map(c[0], c[1]), r: R }); });
  d.side(x1, y1, 6.83, () => { const R = 18, c = [2.6 * TW / 2, 1.5 * ZH / 2]; circ(ctx, c[0], c[1], R + 2, mix('#C9A24A', FOG, haze)); circ(ctx, c[0], c[1], R, '#EDE6D6'); hands((ha, ma) => { limb(ctx, c[0], c[1], c[0] + Math.cos(ha) * 9, c[1] + Math.sin(ha) * 9, '#2B2B30', 2); limb(ctx, c[0], c[1], c[0] + Math.cos(ma) * 14, c[1] + Math.sin(ma) * 14, '#2B2B30', 1.2); }); });
  d.box(x0 - 0.12, y0 - 0.12, 6.83, 2.84, 2.84, 0.16, stone);
  // belfry: built up to the community's progress, scaffolding above
  const built = Math.max(0.15, Math.min(1, pct / 100)), bTop = 6.99 + 2.4 * built;
  [[x0, y1 - 0.35], [x1 - 0.35, y1 - 0.35], [x1 - 0.35, y0], [x0, y0]].forEach(([px, py]) => d.box(px, py, 6.99, 0.35, 0.35, bTop - 6.99, stone));
  d.line([x0 - 0.3, y1 + 0.3, 6.99], [x0 - 0.3, y1 + 0.3, 10.2], mix('#9C6B45', FOG, haze), 1.4); d.line([x1 + 0.3, y1 + 0.3, 6.99], [x1 + 0.3, y1 + 0.3, 10.2], mix('#9C6B45', FOG, haze), 1.4); d.line([x1 + 0.3, y0 - 0.3, 6.99], [x1 + 0.3, y0 - 0.3, 10.2], mix('#9C6B45', FOG, haze), 1.4);
  for (let z = 7.5; z < 10.2; z += 0.8) { d.line([x0 - 0.3, y1 + 0.3, z], [x1 + 0.3, y1 + 0.3, z], mix('#9C6B45', FOG, haze), 1); d.line([x1 + 0.3, y1 + 0.3, z], [x1 + 0.3, y0 - 0.3, z], mix('#9C6B45', FOG, haze), 1); d.line([x0 - 0.3, y1 + 0.3, z], [x1 + 0.3, y1 + 0.3, z + 0.8], mix('#9C6B45', FOG, haze), 0.6); }
  // crane
  d.line([x1 + 1.2, y0 - 0.8, 0], [x1 + 1.2, y0 - 0.8, 11.4], mix('#E0A43A', FOG, haze), 2.2); d.line([x1 + 1.2, y0 - 0.8, 11.4], [x0 - 1.6, y0 - 0.8, 11.4], mix('#E0A43A', FOG, haze), 2); d.line([x0 - 0.6, y0 - 0.8, 11.4], [x0 - 0.6, y0 - 0.8, 9.6], mix('#5A5D62', FOG, haze), 0.6);
  // progress banner
  d.front(x0 - 0.3, y1 + 0.32, 9.6, () => { const W = 3.2 * TW, H = 18; rr(ctx, 0, 0, W, H, 2, mix('#C2416B', FOG, 0.15)); ctx.fillStyle = '#FFFFFF'; ctx.font = `800 9px ${FONTS.display}`; ctx.textAlign = 'center'; ctx.fillText(`${Math.round(pct)}% BUILT`, W / 2, 10.5); ctx.font = `600 4.6px ${FONTS.ui}`; ctx.fillText("from everyone's goals", W / 2, 16); ctx.textAlign = 'left'; });
  lights.push({ work: true, x: d.P(x1 + 0.3, y1 + 0.3, 10.2) }, { work: true, x: d.P(x0 - 0.3, y1 + 0.3, 10.2) });
}
export function drawTownFront(ctx, n, env, view) {
  const d = pen(ctx, 0), lamps = [], winter = env.season === 'winter', e = townExtent(n);
  // street sign at the corner
  d.box(-1.0, 9.45, 0, 0.08, 0.08, 2.1, '#3F4A44');
  d.box(-1.55, 9.53, 1.85, 1.2, 0.04, 0.3, '#2F6B4F', { front: '#2F6B4F' });
  d.front(-1.55, 9.57, 2.15, () => { ctx.fillStyle = '#FFFFFF'; ctx.font = `700 6.2px ${FONTS.ui}`; ctx.fillText(STREET_NAME.toUpperCase(), 3, 7.6); });
  // lamps between lots
  for (let k = 0; k <= n; k++) {
    const x = k * LOT_W + 6.45, y = 9.55, [sx, sy] = d.P(x, y, 0); if (k === n || !inView(view, sx - 30, sy - 110, 60, 120)) { lamps.push(null); continue; }
    d.box(x - 0.05, y - 0.05, 0, 0.1, 0.1, 2.7, '#2F3B36'); d.box(x - 0.09, y - 0.09, 0, 0.18, 0.18, 0.18, '#2F3B36');
    d.line([x, y, 2.6], [x, y - 0.55, 2.85], '#2F3B36', 1.6);
    const [hx, hy] = d.P(x, y - 0.6, 2.72); rr(ctx, hx - 3.5, hy - 2, 7, 5, 2, '#2F3B36'); ell(ctx, hx, hy + 3, 3, 1.4, '#F2E3B8');
    lamps.push([hx, hy + 3]);
    if (k % 2 === 1) { const [fx, fy] = d.P(k * LOT_W + 5.4, 9.6, 0); rr(ctx, fx - 3, fy - 10, 6, 10, 2, '#C2413A'); ell(ctx, fx, fy - 10, 3.6, 1.6, '#D9534A'); rr(ctx, fx - 4.5, fy - 7, 9, 2.2, 1, '#A8332C'); }
  }
  // trees on the far verge frame the street
  for (let k = -1; k < n; k++) {
    const x = k * LOT_W + 5.2 + h1(k) * 1.5, [sx, sy] = d.P(x, 14.4); if (!inView(view, sx - 50, sy - 110, 100, 120)) continue;
    tree(ctx, sx, sy, k % 3 === 0 ? 'pine' : 'oak', env, 0, k, { shadowBlob: () => {} });
  }
  return { lamps };
}
export function drawTownLights(ctx, n, t, env, ground, front) {
  const nt = env.night; if (nt < 0.02) return;
  ctx.save();
  (ground.lights || []).forEach((l) => {
    if (l.clock) { ctx.globalCompositeOperation = 'lighter'; glow(ctx, l.x[0], l.x[1], l.r * 2.2, '#FFE2A8', 0.35 * nt); ctx.globalCompositeOperation = 'source-over'; return; }
    if (l.work) { ctx.globalCompositeOperation = 'lighter'; glow(ctx, l.x[0], l.x[1], 26, '#FFF1C8', 0.5 * nt); ctx.globalCompositeOperation = 'source-over'; return; }
    fillPts(ctx, l, `rgba(255,205,130,${0.6 * nt})`);
  });
  (front.lamps || []).forEach((p) => {
    if (!p) return; const [x, y] = p;
    ctx.globalCompositeOperation = 'lighter'; glow(ctx, x, y, 18, '#FFE1A0', 0.65 * nt);
    ctx.save(); ctx.translate(x + 6, y + 70); ctx.scale(2.2, 1); glow(ctx, 0, 0, 34, '#FFD890', 0.2 * nt); ctx.restore();
    ctx.globalCompositeOperation = 'source-over'; circ(ctx, x, y, 2.4, `rgba(255,248,225,${nt})`);
  });
  ctx.restore();
}
// Screen-space weather, drawn last.
export function drawWeather(ctx, w, h, t, env) {
  if (env.season !== 'winter' || env.reducedMotion) return;
  for (let k = 0; k < 140; k++) {
    const x = ((h1(k) * w + Math.sin(t * 0.7 + k) * 18 + t * 9) % w + w) % w, y = (h1(k * 3.3) * h + t * (22 + h1(k * 7) * 30)) % h;
    circ(ctx, x, y, 0.8 + h1(k * 5) * 1.6, `rgba(255,255,255,${0.55 + h1(k * 9) * 0.4})`);
  }
}

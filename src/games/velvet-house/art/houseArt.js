/* eslint-disable */
// Ported verbatim from the original Velvet House renderer. Live game state is copied in by `render()` each frame.
import { MATERIAL } from '../engine/gbuffer';
import { sunLight, gradeTint } from '../engine/deferredLights';
import { createParticles } from '../engine/particles';
import { poseRig, idleRig, walkRig, seatLegs, legIK, gaitFoot, headTarget, turnHead, idleGlance, treeLeg, quadGait, limbIK, QUAD, FOOT, GAIT } from './poseAnim.js';
import { headFrameFor } from '../state/headSprites';
import { handImage, HAND_SPRITE } from '../state/bodySprites';
import { TYPES as STATE_TYPES, skinOf, colsOf } from '../state/objects';
import { isOutdoor } from '../state/scenes';
import { rand } from '../state/rng';
import { createFabric } from './fabric.js';
import { SLEEVE_BY_CUT } from '../state/garment';
import { LEVELS, STAIRS, WALL_LIGHTS, LEVEL_NAMES, DOOR } from '../state/house';

const GLOSS_FLOORS = new Set(['plank', 'check', 'marble', 'herring', 'parquet', 'tile', 'hex', 'mosaic']);

export function createHouseArt(ctx0, opts = {}) {
  let ctx = ctx0;
  const G = opts.gbuffer ? opts.gbuffer() : null;
  const tier = () => (opts.quality ? opts.quality() : 'high');
  let gOn = false, gMat = MATERIAL.matte;
  const objectLights = new Map();
  const wallLightOverrides = new Map();
  const W = 640, H = 440;
  const cam = { z: 1, x: W / 2, y: H / 2 };
  let minutes = 380, day = 1, viewLevel = 1, animT = 0;
  let party = false, partyF = 0, tvF = 0, dishes = 0, power = true, laundryPile = 0;
  // Things you've just tapped: 'objectId:part' -> animT until which it runs.
  const liveUntil = new Map();
  const live = (id, part = '') => (liveUntil.get(id + ':' + part) || 0) > animT;
  // Switches you flip by tapping: the TV, and the fireplace (lit by default).
  let tvOn = false;
  const fireOut = new Set();
  let parcel = null, flags = {}, owned = new Set(), arranging = false, wallMode = 'cut', tapFocus = null;
  let OBJS = [];
  const reserved = {};
  const arr = { hold: null, wHold: null, orig: null, valid: false, hover: null, mouse: null };
  let arrState = null;
  const offstage = () => ({ name: '', away: true, level: -1, x: -10, y: -10, task: null, queue: [], needs: {} });
  let jordan = offstage(), maya = offstage();
  const GUESTS = [];
  const has = (id) => owned.has(id);
  const cv = ctx0.canvas;
  const SLOTS = {};
  const PETS = [];
  let DIRT = [], sparkles = [], poofs = [];
  let fridge = { basic: 4, fresh: 0 };
  const lightSkipped = () => false;

  const WX = 10, WY = 8, TW = 32, TH = 16, ZH = 34, WH = 2.6, IW = 0.55;
  let OX = 288, OY = 128;
  const ANG = Math.atan2(TH, TW);
  // camera: VR turns the house in 90° steps. V maps world (x, y) to view space, where the viewer always sits at +vx +vy.
  let VR = 0;
  const V = (x, y) => (VR === 0 ? [x, y] : VR === 1 ? [y, WX - x] : VR === 2 ? [WX - x, WY - y] : [WY - y, x]);
  const Vi = (a, b) => (VR === 0 ? [a, b] : VR === 1 ? [WX - b, a] : VR === 2 ? [WX - a, WY - b] : [b, WY - a]);
  const VD = (dx, dy) => (VR === 0 ? [dx, dy] : VR === 1 ? [dy, -dx] : VR === 2 ? [-dx, -dy] : [-dy, dx]);
  const vs = (x, y) => { const [a, b] = V(x, y); return a + b; };
  const viewW = () => (VR % 2 ? WY : WX), viewD = () => (VR % 2 ? WX : WY);
  const BACK = [['L', 'B'], ['B', 'R'], ['R', 'F'], ['F', 'L']], FRONT = [['F', 'R'], ['L', 'F'], ['B', 'L'], ['R', 'B']];
  const isoV = (a, b, z = 0) => [OX + (a - b) * TW, OY + (a + b) * TH - z * ZH];
  const iso = (x, y, z = 0) => { const [a, b] = V(x, y); return isoV(a, b, z); };
  const unIso = (sx, sy) => { const a = (sx - OX) / TW, b = (sy - OY) / TH; return Vi((a + b) / 2, (b - a) / 2); };
  function setOrigin() { const vw = viewW(), vd = viewD(); OX = 320 - (vw / 2 - vd / 2) * TW; OY = 272 - (vw / 2 + vd / 2) * TH; }
  function vrect(x1, y1, x2, y2) { const [a1, b1] = V(x1, y1), [a2, b2] = V(x2, y2); return [Math.min(a1, a2), Math.min(b1, b2), Math.max(a1, a2), Math.max(b1, b2)]; }

  function rgb(h) { if (h[0] !== '#') { const m = h.match(/[\d.]+/g) || [128, 128, 128]; return [+m[0], +m[1], +m[2]]; } h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function shade(h, a) { const [r, g, b] = rgb(h), t = a < 0 ? 0 : 255, p = Math.abs(a), al = h.startsWith('rgba') ? +(h.match(/[\d.]+/g)[3]) : 1; const v = `${Math.round(r + (t - r) * p)},${Math.round(g + (t - g) * p)},${Math.round(b + (t - b) * p)}`; return al < 1 ? `rgba(${v},${al})` : `rgb(${v})`; }
  function gPlane(view) { G.plane(view, view.map(p => isoV(p[0], p[1], p[2])), gMat); }
  function poly(pts, fill, stroke, lw = 1) {
    if (gOn && fill) gPlane(pts.map(p => { const [a, b] = V(p[0], p[1]); return [a, b, p[2]]; }));
    ctx.beginPath(); pts.forEach((p, i) => { const [sx, sy] = iso(p[0], p[1], p[2]); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
    if (gOn && fill) G.reset();
  }
  const EDGE = 'rgba(40,20,32,.16)';
  function polyV(pts, fill, stroke, lw = 1) {
    if (gOn && fill) gPlane(pts);
    ctx.beginPath(); pts.forEach((p, i) => { const [sx, sy] = isoV(p[0], p[1], p[2]); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
    if (gOn && fill) G.reset();
  }
  function box(x, y, z, w, d, h, c) {
    const [a, b, a2, b2] = vrect(x, y, x + w, y + d);
    polyV([[a, b2, z], [a2, b2, z], [a2, b2, z + h], [a, b2, z + h]], shade(c, -0.08), EDGE, 0.8);
    polyV([[a2, b, z], [a2, b2, z], [a2, b2, z + h], [a2, b, z + h]], shade(c, -0.24), EDGE, 0.8);
    polyV([[a, b, z + h], [a2, b, z + h], [a2, b2, z + h], [a, b2, z + h]], shade(c, 0.1), EDGE, 0.8);
  }
  function line3(a, b, c, w) { const [x1, y1] = iso(...a), [x2, y2] = iso(...b); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  function ell(x, y, rx, ry, fill, stroke, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); } }
  const circle = (x, y, r, fill) => ell(x, y, r, r, fill);
  function rr(x, y, w, h, r, fill) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
  function limb(x1, y1, x2, y2, c, w) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  function limb3(x1, y1, x2, y2, x3, y3, c, w) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.stroke(); }
  function heart(x, y, s, c) { ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.beginPath(); ctx.moveTo(0, 3); ctx.bezierCurveTo(-7, -2, -4, -8, 0, -4); ctx.bezierCurveTo(4, -8, 7, -2, 0, 3); ctx.fillStyle = c; ctx.fill(); ctx.restore(); }
  function bubble(x, y, text) {
    ctx.font = '600 11px "Instrument Sans", system-ui, sans-serif';
    const w = Math.max(22, ctx.measureText(text).width + 14);
    rr(x - w / 2, y - 18, w, 18, 8, 'rgba(255,253,248,.95)');
    ctx.fillStyle = 'rgba(255,253,248,.95)'; ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y); ctx.lineTo(x, y + 5); ctx.fill();
    ctx.fillStyle = '#241B25'; ctx.textAlign = 'center'; ctx.fillText(text, x, y - 5); ctx.textAlign = 'start';
  }
  function thought(x, y, kind) {
    const c = 'rgba(255,253,248,.96)';
    circle(x, y, 11, c); circle(x - 9, y + 9, 3, c); circle(x - 13, y + 14, 1.8, c);
    ctx.textAlign = 'center';
    if (kind === 'coffee') { rr(x - 5, y - 4, 8, 8, 1.5, '#8A5A3B'); ctx.strokeStyle = '#8A5A3B'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x + 3.5, y, 2.6, -Math.PI / 2, Math.PI / 2); ctx.stroke(); }
    else if (kind === 'dance') { ctx.fillStyle = '#8A2D54'; ctx.font = '600 13px system-ui, sans-serif'; ctx.fillText('♪', x, y + 5); }
    else if (kind === 'tv') { rr(x - 6, y - 5, 12, 8, 1.5, '#2A2D35'); rr(x - 4.5, y - 3.5, 9, 5, 1, '#7FB8FF'); limb(x - 3, y + 5, x + 3, y + 5, '#2A2D35', 1.5); }
    else if (kind === 'bowl') { ell(x, y + 2, 6.5, 3.2, '#C2413A'); ell(x, y + 1, 4.8, 2, '#4A3426'); circle(x - 1.5, y, 1, '#C07A3C'); circle(x + 1.5, y + 0.5, 1, '#C07A3C'); }
    else if (kind === 'ball') { circle(x, y, 4.6, '#C9D94A'); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x - 1, y, 4.2, -0.9, 0.9); ctx.stroke(); }
    else if (kind === 'love') heart(x, y + 2, 0.9, '#CD466E');
    else if (kind === 'leash') { ctx.strokeStyle = '#8A2D54'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(x - 2.5, y - 1.5, 3.5, 0, Math.PI * 2); ctx.moveTo(x, y + 1); ctx.lineTo(x + 5, y + 5); ctx.stroke(); }
    else { ctx.fillStyle = '#8A2D54'; ctx.font = '700 14px "Pixelify Sans", ui-monospace, monospace'; ctx.fillText('!', x, y + 5); }
    ctx.textAlign = 'start';
  }

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weekday = (d = day) => (5 + d - 1) % 7; // day 1 is a Saturday: move-in day
  const hour = () => minutes / 60;
  const absMin = () => day * 1440 + minutes;
  const inWindow = (h, a, b) => (a < b ? h >= a && h < b : h >= a || h < b);
  function clockText(mins = minutes) { const h = Math.floor(mins / 60) % 24, m = Math.floor(mins % 60); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; }
  const hText = (hf) => clockText(Math.round(hf * 60)).replace(':00', '');
  const whenText = (abs) => { const d = Math.floor(abs / 1440), m = abs % 1440; return `${DAYS[weekday(d)]} ${hText(m / 60)}`; };
  const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'];
  const seasonIdx = (d = day) => Math.floor((d - 1) / 7) % 4;
  const season = () => SEASONS[seasonIdx()];
  const seasonDay = () => ((day - 1) % 7) + 1;
  // A scene can pull the room toward evening without moving the clock, to show off the lights (see setDim).
  let dimTarget = 0, dimNow = 0;
  function darkness() { const base = baseDarkness(); return dimNow > base ? dimNow : base; }
  function baseDarkness() { const h = hour(), si = seasonIdx(), eve = [0, 1, -1, -2.5][si], morn = [0, -0.5, 0.4, 0.8][si], night0 = 21 + eve, dusk0 = 18 + eve, dawn0 = 5.5 + morn, light0 = 7.5 + morn;
    if (h >= night0 || h < dawn0) return 0.42; if (h >= dusk0) return (h - dusk0) / (night0 - dusk0) * 0.42; if (h < light0) return (light0 - h) / (light0 - dawn0) * 0.42; return 0; }
  function skyColor() { const h = hour(); if (raining() && darkness() < 0.3) return seasonIdx() === 3 ? '#D2D8E0' : '#9AA6B5'; if (darkness() > 0.3) return '#2A2F55'; if (h >= 17.5 && h < 21) return '#F0B98E'; if (h < 7.5) return '#E9C7B5'; return '#BFE2F0'; }

  const LOOKS = [{ paint: '#B9B4AF', paper: 'block', floor: 'concrete' }, { paint: '#E9DCCB', paper: null, floor: 'wood' }, { paint: '#E9DCCB', paper: null, floor: 'wood' }, { paint: '#D9CDBD', paper: null, floor: 'wood' }, { paint: '#E4D6C2', paper: 'shiplap', floor: 'wood' }];
  const FLOORS = {
    wood: { kind: 'plank', a: '#C9A27A', b: '#C09670', line: 'rgba(90,60,30,.22)' },
    concrete: { kind: 'flat', a: '#A7A29D', b: '#A7A29D', line: 'rgba(0,0,0,.06)' },
    tile: { kind: 'check', a: '#ECE7E1', b: '#D6CFC6', line: 'rgba(0,0,0,.07)' },
    carpet: { kind: 'flat', a: '#8E9C96', b: '#8E9C96', line: 'rgba(0,0,0,.03)' },
    walnut: { kind: 'plank', a: '#6B4A35', b: '#634330', line: 'rgba(0,0,0,.25)' },
    checker: { kind: 'check', a: '#F2EEE8', b: '#2B2B30', line: 'rgba(0,0,0,.1)' },
    terrazzo: { kind: 'speck', a: '#E8E1DA', b: '#E8E1DA', line: 'rgba(0,0,0,.05)' },
    maple: { kind: 'plank', a: '#E2C69E', b: '#D8BA90', line: 'rgba(120,90,50,.18)' },
    ash: { kind: 'plank', a: '#B9B2A8', b: '#AFA89E', line: 'rgba(60,50,40,.18)' },
    cherry: { kind: 'plank', a: '#A65D3F', b: '#9C5539', line: 'rgba(60,20,10,.22)' },
    whitewash: { kind: 'plank', a: '#ECE6DC', b: '#E3DCD0', line: 'rgba(120,100,80,.16)' },
    ebony: { kind: 'plank', a: '#3A2E2A', b: '#332824', line: 'rgba(0,0,0,.35)' },
    herring: { kind: 'herring', a: '#C49A6C', b: '#B48B5F', line: 'rgba(80,50,25,.28)' },
    herringgray: { kind: 'herring', a: '#B7AEA3', b: '#A79E93', line: 'rgba(40,35,30,.25)' },
    parquet: { kind: 'parquet', a: '#B98552', b: '#A87645', line: 'rgba(70,40,20,.3)' },
    marble: { kind: 'marble', a: '#F1EEEA', b: '#E6E2DC', line: 'rgba(0,0,0,.08)', vein: 'rgba(120,120,130,.35)' },
    nero: { kind: 'marble', a: '#2C2B2F', b: '#262529', line: 'rgba(255,255,255,.06)', vein: 'rgba(230,225,215,.35)' },
    hexwhite: { kind: 'hex', a: '#F4F2EE', b: '#F4F2EE', line: 'rgba(0,0,0,.18)' },
    hexsage: { kind: 'hex', a: '#B9CBBE', b: '#B9CBBE', line: 'rgba(255,255,255,.6)' },
    mosaic: { kind: 'mosaic', a: '#DCE8EC', b: '#C7DDE3', line: 'rgba(255,255,255,.5)', pal: ['#DCE8EC', '#C7DDE3', '#A9C9D3', '#EEF4F5'] },
    terracotta: { kind: 'tile', a: '#C27A5A', b: '#B86F50', line: 'rgba(240,225,210,.55)' },
    slate: { kind: 'stone', a: '#5E646B', b: '#555B62', line: 'rgba(0,0,0,.25)' },
    pavers: { kind: 'brick', a: '#A85A40', b: '#97493A', line: 'rgba(230,215,200,.5)' },
    rose: { kind: 'flat', a: '#C9A3AE', b: '#C9A3AE', line: 'rgba(0,0,0,.03)' },
    navy: { kind: 'flat', a: '#3A4663', b: '#3A4663', line: 'rgba(0,0,0,.05)' },
    oatmeal: { kind: 'sisal', a: '#D8C9AE', b: '#D8C9AE', line: 'rgba(0,0,0,.04)' },
    sagecheck: { kind: 'check', a: '#EFEBE3', b: '#9DB3A5', line: 'rgba(0,0,0,.08)' },
    goldspeck: { kind: 'speck', a: '#EFE8DE', b: '#EFE8DE', line: 'rgba(0,0,0,.05)', pal: ['#C9A24A', '#E0B85A', '#2B2B30', '#C9A24A'] },
    charcoal: { kind: 'flat', a: '#4A4D52', b: '#4A4D52', line: 'rgba(255,255,255,.04)' },
    barnwood: { kind: 'plank', a: '#B58B5E', b: '#A8804F', line: 'rgba(60,35,15,.32)' },
    linoleum: { kind: 'check', a: '#F4EAD0', b: '#8FCDBB', line: 'rgba(0,0,0,.08)' },
    nordic: { kind: 'plank', a: '#E8DFCF', b: '#E1D6C3', line: 'rgba(120,100,70,.14)' },
    poured: { kind: 'stone', a: '#6E7074', b: '#66686C', line: 'rgba(0,0,0,.08)' },
    driftwood: { kind: 'plank', a: '#D9CFBE', b: '#CEC2AE', line: 'rgba(255,255,255,.4)' },
    ivorygold: { kind: 'marble', a: '#F2EAD8', b: '#E9E0CC', line: 'rgba(0,0,0,.06)', vein: 'rgba(201,162,74,.55)' },
    tatami: { kind: 'sisal', a: '#D5CBA6', b: '#D5CBA6', line: 'rgba(0,0,0,.06)' },
    jute: { kind: 'sisal', a: '#C9B28A', b: '#C9B28A', line: 'rgba(0,0,0,.05)' },
    moon: { kind: 'tile', a: '#E6E9EE', b: '#DDE1E7', line: 'rgba(255,255,255,.6)' },
    herringebony: { kind: 'herring', a: '#3A2E2A', b: '#2E2420', line: 'rgba(0,0,0,.4)' },
    zellige: { kind: 'mosaic', a: '#F1EDE3', b: '#2E4C9A', line: 'rgba(255,255,255,.5)', pal: ['#2E4C9A', '#F1EDE3', '#C27A5A', '#F1EDE3'] },
    bamboo: { kind: 'plank', a: '#E3C98F', b: '#D9BE82', line: 'rgba(120,90,40,.25)' },
    terrazzopop: { kind: 'speck', a: '#F4F1EA', b: '#F4F1EA', line: 'rgba(0,0,0,.05)', pal: ['#E63946', '#F4C430', '#2E6BD6', '#1B1A1F'] },
    limestone: { kind: 'stone', a: '#D9D2C2', b: '#D2CAB8', line: 'rgba(0,0,0,.08)' },
    saltillo: { kind: 'tile', a: '#CF8A5C', b: '#C27F54', line: 'rgba(240,225,210,.5)' },
    grate: { kind: 'tile', a: '#1A1C24', b: '#171920', line: 'rgba(25,230,240,.35)' },
    checkpink: { kind: 'check', a: '#FFF8F0', b: '#F6B7CC', line: 'rgba(0,0,0,.05)' },
    skycheck: { kind: 'check', a: '#F7FAFE', b: '#DCEEFA', line: 'rgba(0,0,0,.04)' },
    terrazzodark: { kind: 'speck', a: '#3B3C40', b: '#3B3C40', line: 'rgba(255,255,255,.04)', pal: ['#55575C', '#6E7076', '#4A4B50', '#8A8C90'] },
    arcadecarpet: { kind: 'speck', a: '#1E1740', b: '#1E1740', line: 'rgba(255,255,255,.03)', pal: ['#FF2E9A', '#19E6F0', '#F4C430', '#7A5CFF'] },
    rubber: { kind: 'speck', a: '#3A3A3F', b: '#3A3A3F', line: 'rgba(255,255,255,.04)', pal: ['#5A5A62', '#4C4C54', '#6E6E76', '#55555D'] }
  };
  // wallpapers: a pattern drawn over the paint, or with its own base color
  const PAPERS = {
    dots: { pat: 'dots' }, stripes: { pat: 'stripes' }, brick: { pat: 'brick' }, block: { pat: 'block' }, deco: { pat: 'deco' }, botanical: { pat: 'botanical' },
    'dots-rose': { pat: 'dots', base: '#F3DADD', ink: 'rgba(199,100,122,.75)' }, 'stripe-mint': { pat: 'stripes', base: '#DDEFE6', ink: 'rgba(96,160,136,.45)' },
    'stripe-candy': { pat: 'stripes', base: '#F7EDEA', ink: 'rgba(194,65,58,.4)' }, pinstripe: { pat: 'pin', base: '#27324A', ink: 'rgba(232,220,200,.42)' },
    'gingham-red': { pat: 'gingham', base: '#F7F0EA', ink: 'rgba(194,65,58,.22)' }, 'gingham-blue': { pat: 'gingham', base: '#F2F5F8', ink: 'rgba(74,93,168,.22)' },
    'plaid-forest': { pat: 'plaid', base: '#3C5849', ink: 'rgba(224,164,58,.45)', ink2: 'rgba(15,25,20,.3)' }, 'plaid-wine': { pat: 'plaid', base: '#6B2E3E', ink: 'rgba(240,220,200,.32)', ink2: 'rgba(20,10,15,.28)' },
    'chevron-mustard': { pat: 'chevron', base: '#F5EBD8', ink: 'rgba(217,163,58,.85)' }, 'chevron-slate': { pat: 'chevron', base: '#E8EAEC', ink: 'rgba(80,90,105,.55)' },
    'scallop-peach': { pat: 'scallop', base: '#F6D6C4', ink: 'rgba(255,255,255,.8)' }, 'damask-plum': { pat: 'damask', base: '#4A2D3D', ink: 'rgba(201,164,74,.55)' },
    'damask-cream': { pat: 'damask', base: '#EFE5D3', ink: 'rgba(150,118,84,.4)' }, shiplap: { pat: 'shiplap', base: '#F3F1EC', ink: 'rgba(0,0,0,.13)' },
    'pin-slate': { pat: 'pin', base: '#4A5058', ink: 'rgba(235,238,240,.35)' },
    birch: { pat: 'birch', base: '#F3EFE6', ink: 'rgba(255,255,255,.9)', ink2: 'rgba(60,50,45,.5)' },
    'brick-white': { pat: 'brick', base: '#E9E3DB', ink: 'rgba(0,0,0,.2)', tones: ['#EDE8E1', '#E4DED6', '#F1ECE5', '#E8E2DA'] },
    'stripe-nautical': { pat: 'stripes', base: '#F6F3EC', ink: 'rgba(46,59,87,.75)' },
    'deco-emerald': { pat: 'deco', base: '#1F5E4A', ink: 'rgba(224,194,110,.85)' },
    shoji: { pat: 'grid', base: '#F4EFE5', ink: 'rgba(70,55,40,.45)' },
    'arches-terracotta': { pat: 'arches', base: '#F1E8D2', ink: 'rgba(194,107,74,.8)' },
    orbit: { pat: 'dots', base: '#1B1A24', ink: 'rgba(91,227,230,.8)' },
    'damask-onyx': { pat: 'damask', base: '#23202A', ink: 'rgba(176,141,87,.6)' },
    'zellige-cobalt': { pat: 'zellige', base: '#F3EEE4', ink: 'rgba(46,76,154,.9)', pal: ['#2E4C9A', '#F1EDE3', '#3D6B73', '#F1EDE3', '#C27A5A', '#F1EDE3'] },
    'monstera-night': { pat: 'monstera', base: '#17382B', ink: 'rgba(79,148,96,.95)', ink2: 'rgba(47,107,64,.95)' },
    'squiggle-pop': { pat: 'squiggle', base: '#F6F3EC', ink: 'rgba(27,26,31,.85)', pal: ['#E63946', '#F4C430', '#2E6BD6'] },
    'lavender-sprig': { pat: 'sprig', base: '#F6F3EC', ink: 'rgba(142,124,195,.85)', ink2: 'rgba(157,179,165,.9)' },
    'serape-adobe': { pat: 'serape', base: '#E7C9A4', ink: 'rgba(43,36,32,.8)', pal: ['#B5533C', '#F4ECD8', '#3FA7A0', '#F4ECD8', '#2B2420'] },
    circuit: { pat: 'circuit', base: '#111118', ink: 'rgba(25,230,240,.6)', ink2: 'rgba(255,46,154,.75)' },
    sprinkles: { pat: 'sprinkles', base: '#FFF8F0', ink: 'rgba(224,74,106,.9)', pal: ['#E04A6A', '#BFE0F5', '#FBE7A6', '#D6C4F0', '#BFE8D6'] },
    'clouds-sky': { pat: 'clouds', base: '#C9E6F8', ink: 'rgba(255,255,255,.95)' },
    formwork: { pat: 'formwork', base: '#A9A7A2', ink: 'rgba(0,0,0,.14)', ink2: 'rgba(0,0,0,.3)' },
    'pixel-invaders': { pat: 'pixels', base: '#15121F', ink: 'rgba(25,230,240,.9)', pal: ['#19E6F0', '#FF2E9A', '#F4C430', '#39D353'] },
    'gingham-sage': { pat: 'gingham', base: '#F4F1E8', ink: 'rgba(110,150,115,.3)' },
    'starburst-mint': { pat: 'starburst', base: '#CFEBDD', ink: 'rgba(224,122,92,.75)', ink2: 'rgba(224,122,92,.9)' },
    'wainscot-white': { pat: 'wainscot', ink: '#F4F1EA' }, 'wainscot-navy': { pat: 'wainscot', ink: '#2E3B57' }, subway: { pat: 'subway', base: '#F5F5F2', ink: 'rgba(0,0,0,.14)' },
    'stars-night': { pat: 'stars', base: '#1F2442', ink: 'rgba(242,210,122,.95)' }, 'waves-sea': { pat: 'waves', base: '#E1EEF4', ink: 'rgba(74,136,184,.55)' },
    'hex-honey': { pat: 'hexes', base: '#F3E1B4', ink: 'rgba(170,120,40,.5)' }, 'arches-clay': { pat: 'arches', base: '#EBCDB6', ink: 'rgba(194,110,80,.7)' },
    'grid-ink': { pat: 'grid', base: '#F6F4F0', ink: 'rgba(30,30,35,.3)' }, 'jungle-night': { pat: 'botanical', base: '#1E392D', ink: 'rgba(120,180,128,.8)' },
    'velvet-tuft': { pat: 'tuft', base: '#6E3C50', ink: 'rgba(0,0,0,.25)' }, blossom: { pat: 'blossom', base: '#F7EEE6' }, palms: { pat: 'palms', base: '#D7EDE4' }, leaves: { pat: 'leaves', base: '#F3E6D0' }, snow: { pat: 'snow', base: '#D9E6F2' }, 'sunset-mural': { pat: 'sunset' }, cork: { pat: 'cork', base: '#B88B5A', ink: 'rgba(80,50,25,.4)' }
  };
  // rooms can override their floor's paint, wallpaper and floor
  const ROOMLOOK = [{}, {}, {}, {}, {}];
  const lookAt = (level, room) => (room && ROOMLOOK[level][room] ? Object.assign({}, LOOKS[level], ROOMLOOK[level][room]) : LOOKS[level]);
  const toneOf = (lk) => { const pp = lk.paper && PAPERS[lk.paper]; return (pp && pp.base) || lk.paint; };
  const wallTone = (level, room) => toneOf(lookAt(level, room));
  const hasRoomLooks = (level) => Object.keys(ROOMLOOK[level]).some(k => Object.keys(ROOMLOOK[level][k]).length);
  // which side of an interior wall the camera sees, and so which room's paint shows
  function wallSideRoom(level, r, vertical) { const cx = (r[0] + r[2]) / 2, cy = (r[1] + r[3]) / 2, [a, b] = vertical ? VD(1, 0) : VD(0, 1), sg = a + b >= 0 ? 1 : -1; return roomName(level, vertical ? cx + sg * 0.3 : cx, vertical ? cy : cy + sg * 0.3); }
  function planeRooms(level, pl) {
    // room spans along an outside wall: [room, u0, u1]
    const e = 0.02;
    return LEVELS[level].rooms.map(rm => { const [x1, y1, x2, y2] = rm.r; if (pl === 'B' && y1 < e) return [rm.n, x1, x2]; if (pl === 'F' && y2 > WY - e) return [rm.n, x1, x2]; if (pl === 'L' && x1 < e) return [rm.n, y1, y2]; if (pl === 'R' && x2 > WX - e) return [rm.n, y1, y2]; return null; }).filter(Boolean);
  }  // ======================================================================

  const WALLOBJS = [];
  const WFRAMES = ['#2B2430', '#C9A24A', '#F2EEE8', '#9C6B45'];
  const WTYPES = {
    print: { name: 'Framed print', w: 0.8, h: 0.62, cols: ['#E0A43A', '#3D6B73', '#D24A7A', '#4F9460', '#4A5DA8'], tags: 'modern bold',
      draw: (W, o) => { const c = o.col || '#E0A43A'; W.r(0, 0, 0.8, 0.62, '#2B2430'); W.r(0.05, 0.05, 0.75, 0.57, '#F2EEE8'); W.r(0.14, 0.13, 0.66, 0.49, shade(c, 0.55)); W.circ(0.33, 0.33, 0.12, c); W.r(0.38, 0.16, 0.6, 0.24, shade(c, -0.3)); } },
    landscape: { name: 'Landscape canvas', w: 1.3, h: 0.8, cols: ['#9EC1F5', '#F2B48A', '#C9B8E8', '#2B3A5E'], tags: 'natural vintage',
      draw: (W, o) => { const c = o.col || '#9EC1F5'; W.r(0, 0, 1.3, 0.8, '#6B4A35'); W.r(0.05, 0.05, 1.25, 0.75, c); W.p([[0.05, 0.05], [0.05, 0.38], [0.35, 0.5], [0.7, 0.32], [1.0, 0.45], [1.25, 0.36], [1.25, 0.05]], '#5E8A48'); W.p([[0.05, 0.05], [0.05, 0.2], [0.5, 0.3], [0.9, 0.15], [1.25, 0.22], [1.25, 0.05]], '#3F6B3A'); W.circ(1.0, 0.62, 0.07, shade(c, 0.6)); } },
    portrait: { name: 'Gilded portrait', w: 0.62, h: 0.82, cols: ['#2B2B30', '#3F5B4C', '#6E3C50'], tags: 'vintage luxe',
      draw: (W, o) => { W.r(0, 0, 0.62, 0.82, '#C9A24A'); W.r(0.06, 0.06, 0.56, 0.76, o.col || '#2B2B30'); W.e(0.31, 0.5, 0.11, 0.14, '#C68E62'); W.p([[0.12, 0.06], [0.16, 0.3], [0.31, 0.36], [0.46, 0.3], [0.5, 0.06]], '#8A2D54'); } },
    roundmirror: { name: 'Round mirror', w: 0.72, h: 0.72, cols: ['#C9A24A', '#2B2B30', '#9C6B45', '#F2EEE8'], tags: 'modern luxe',
      draw: (W, o) => { W.e(0.36, 0.36, 0.36, 0.36, o.col || '#C9A24A'); W.e(0.36, 0.36, 0.31, 0.31, '#DCE8EE'); W.p([[0.18, 0.4], [0.45, 0.62], [0.5, 0.56], [0.24, 0.34]], 'rgba(255,255,255,.6)'); } },
    floatshelf: { name: 'Floating shelf', w: 1.2, h: 0.45, cols: ['#9C6B45', '#F2EEE8', '#2B2B30'], tags: 'natural minimal',
      draw: (W, o) => { const c = o.col || '#9C6B45'; W.r(0, 0, 1.2, 0.06, c, 'rgba(0,0,0,.25)'); W.r(0.1, 0.06, 0.28, 0.2, '#C26B4A'); W.e(0.15, 0.3, 0.06, 0.12, '#4F9460'); W.e(0.24, 0.32, 0.06, 0.13, '#3F7D4E'); [0.5, 0.56, 0.62].forEach((u, k) => W.r(u, 0.06, u + 0.05, 0.3 + k * 0.03, ['#C2413A', '#3D6B73', '#E0A43A'][k])); W.r(0.88, 0.06, 0.98, 0.18, '#F2EEE8'); W.e(0.93, 0.22, 0.015, 0.03, '#FFB547'); } },
    wclock: { name: 'Wall clock', w: 0.5, h: 0.5, cols: ['#2B2B30', '#F2EEE8', '#C9A24A', '#D24A7A'], tags: 'modern minimal',
      draw: (W, o) => { W.e(0.25, 0.25, 0.25, 0.25, o.col || '#2B2B30'); W.e(0.25, 0.25, 0.21, 0.21, '#FBF8F2'); const hh = (hour() % 12) / 12 * Math.PI * 2, mm = (minutes % 60) / 60 * Math.PI * 2; W.l([0.25, 0.25], [0.25 + Math.sin(hh) * 0.11, 0.25 + Math.cos(hh) * 0.11], '#2B2B30', 1.6); W.l([0.25, 0.25], [0.25 + Math.sin(mm) * 0.17, 0.25 + Math.cos(mm) * 0.17], '#2B2B30', 1); } },
    tapestry: { name: 'Woven tapestry', w: 1.1, h: 1.3, cols: ['#E8DCC8', '#C27A5A', '#3D6B73', '#6E3C50'], tags: 'natural cozy vintage',
      draw: (W, o) => { const c = o.col || '#E8DCC8'; W.l([-0.05, 1.28], [1.15, 1.28], '#6B4A35', 3); W.r(0.05, 0.2, 1.05, 1.26, c); [0.45, 0.75, 1.0].forEach((z, k) => W.r(0.05, z, 1.05, z + 0.06, shade(c, k % 2 ? -0.25 : 0.3))); W.p([[0.55, 0.28], [0.8, 0.55], [0.55, 0.82], [0.3, 0.55]], shade(c, -0.35)); for (let u = 0.08; u < 1.05; u += 0.07) W.l([u, 0.2], [u, 0.08], shade(c, -0.15), 1); } },
    gallery: { name: 'Gallery wall', w: 1.3, h: 0.95, cols: ['#2B2430', '#F2EEE8', '#C9A24A'], tags: 'modern playful',
      draw: (W, o) => { const f = o.col || '#2B2430'; [[0, 0.35, 0.5, 0.95, '#D24A7A'], [0.58, 0.5, 1.0, 0.95, '#3D6B73'], [0.58, 0, 0.9, 0.42, '#E0A43A'], [0.05, 0, 0.5, 0.28, '#7FB069'], [1.05, 0.2, 1.3, 0.62, '#4A5DA8']].forEach(([a, b, c2, d, col]) => { W.r(a, b, c2, d, f); W.r(a + 0.04, b + 0.04, c2 - 0.04, d - 0.04, '#F2EEE8'); W.r(a + 0.08, b + 0.08, c2 - 0.08, d - 0.08, col); }); } },
    albums: { name: 'Record wall', w: 1.3, h: 0.42, cols: ['#2B2B30'], tags: 'vintage playful',
      draw: (W) => { [['#D24A7A', '#2B2B30'], ['#E0A43A', '#4A5DA8'], ['#4F9460', '#F2EEE8']].forEach(([a, b], k) => { const u = k * 0.45; W.r(u, 0, u + 0.4, 0.4, a); W.e(u + 0.2, 0.2, 0.12, 0.12, b); W.e(u + 0.2, 0.2, 0.03, 0.03, a); }); } },
    macrame: { name: 'Macrame planter', w: 0.5, h: 1.05, cols: ['#E8DCC8', '#C27A5A'], tags: 'natural cozy vintage',
      draw: (W, o, t) => { const c = o.col || '#E8DCC8'; [[0.1, 0.12], [0.25, 0.1], [0.4, 0.12]].forEach(([u]) => W.l([0.25, 1.05], [u, 0.3], c, 1.3)); W.r(0.08, 0.05, 0.42, 0.32, '#F2EEE8'); const sw = Math.sin(t * 0.7) * 0.02; [[0.12, -0.15], [0.38, -0.2], [0.25, -0.3], [0.05, 0.0], [0.45, -0.05]].forEach(([u, z], k) => W.e(u + sw, 0.28 + z * 0.5, 0.05, 0.12, k % 2 ? '#3F7D4E' : '#5BA36C')); } },
    polaroids: { name: 'Photo string', w: 1.5, h: 0.42, cols: ['#3A3340'], tags: 'playful cozy',
      draw: (W) => { const pts = []; for (let k = 0; k <= 10; k++) { const u = k * 0.15; pts.push([u, 0.42 - Math.sin(k / 10 * Math.PI) * 0.12]); } W.pl(pts, '#3A3340', 1); [0.2, 0.5, 0.8, 1.1, 1.35].forEach((u, k) => { const z = 0.42 - Math.sin(u / 1.5 * Math.PI) * 0.12; W.r(u - 0.08, z - 0.24, u + 0.08, z - 0.02, '#FBF8F2'); W.r(u - 0.065, z - 0.17, u + 0.065, z - 0.04, ['#9EC1F5', '#F2B48A', '#7FB069', '#D24A7A', '#E0A43A'][k]); }); } },
    plates: { name: 'Plate wall', w: 1.0, h: 0.75, cols: ['#4A88B8', '#C2413A', '#4F9460'], tags: 'vintage cozy',
      draw: (W, o) => { const c = o.col || '#4A88B8'; [[0.22, 0.52, 0.2], [0.65, 0.55, 0.15], [0.45, 0.17, 0.16], [0.86, 0.2, 0.12]].forEach(([u, z, r]) => { W.e(u, z, r, r, '#F7F3EE', 'rgba(0,0,0,.15)'); W.e(u, z, r * 0.7, r * 0.7, null, c); W.e(u, z, r * 0.25, r * 0.25, c); }); } },
    // ---- rotation and seasonal pieces (only in the daily shop) ----
    neon: { name: 'Neon heart', w: 0.9, h: 0.7, cols: ['#FF5FA2', '#5FE3FF', '#FFD25F'], tags: 'bold playful modern', rot: 'rare',
      draw: (W, o, t) => { const c = o.col || '#FF5FA2', pts = []; for (let k = 0; k <= 30; k++) { const a = k / 30 * Math.PI * 2, x = 16 * Math.pow(Math.sin(a), 3), y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a); pts.push([0.45 + x * 0.025, 0.38 + y * 0.025]); } ctx.save(); ctx.shadowColor = c; ctx.shadowBlur = 10 + Math.sin(t * 3) * 2; W.pl(pts, c, 3); ctx.restore(); W.pl(pts, '#FFFFFF', 1); } },
    wreath: { name: 'Holiday wreath', w: 0.7, h: 0.7, cols: ['#C2413A'], tags: 'cozy vintage warm', rot: 'winter',
      draw: (W) => { for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; W.e(0.35 + Math.cos(a) * 0.25, 0.35 + Math.sin(a) * 0.25, 0.1, 0.1, k % 2 ? '#2F6B40' : '#3F7D4E'); } [0.3, 1.5, 2.7, 4.1, 5.3].forEach(a => W.e(0.35 + Math.cos(a) * 0.27, 0.35 + Math.sin(a) * 0.27, 0.03, 0.03, '#C2413A')); W.p([[0.35, 0.1], [0.22, 0.02], [0.25, 0.14]], '#C2413A'); W.p([[0.35, 0.1], [0.48, 0.02], [0.45, 0.14]], '#C2413A'); } },
    surfboard: { name: 'Surfboard', w: 0.5, h: 1.6, cols: ['#5FB8D6', '#F2B48A', '#F2EEE8'], tags: 'playful cool natural', rot: 'summer',
      draw: (W, o) => { const c = o.col || '#5FB8D6', pts = []; for (let k = 0; k <= 20; k++) { const a = k / 20 * Math.PI * 2; pts.push([0.25 + Math.cos(a) * 0.2, 0.8 + Math.sin(a) * 0.78]); } W.p(pts, c, 'rgba(0,0,0,.2)'); W.l([0.25, 0.08], [0.25, 1.52], '#F7F3EE', 2); W.r(0.07, 0.95, 0.43, 1.02, '#E0A43A'); } },
    harvest: { name: 'Harvest wreath', w: 0.7, h: 0.7, cols: ['#C27A4A'], tags: 'warm cozy natural', rot: 'fall',
      draw: (W) => { for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; W.e(0.35 + Math.cos(a) * 0.25, 0.35 + Math.sin(a) * 0.25, 0.1, 0.07, ['#C27A4A', '#D9A84A', '#A8553A', '#8A6A50'][k % 4]); } W.e(0.35, 0.08, 0.07, 0.06, '#E07A2B'); } },
    blossom: { name: 'Blossom print', w: 0.75, h: 1.0, cols: ['#F2EEE8', '#2B2430'], tags: 'soft natural vintage', rot: 'spring',
      draw: (W, o) => { W.r(0, 0, 0.75, 1.0, '#C9A24A'); W.r(0.05, 0.05, 0.7, 0.95, o.col || '#F2EEE8'); W.l([0.15, 0.1], [0.45, 0.6], '#5A3E2E', 2); W.l([0.45, 0.6], [0.6, 0.85], '#5A3E2E', 1.5); W.l([0.33, 0.38], [0.2, 0.7], '#5A3E2E', 1.2); [[0.2, 0.72], [0.6, 0.86], [0.45, 0.62], [0.3, 0.5], [0.52, 0.72], [0.14, 0.62]].forEach(([u, z]) => W.e(u, z, 0.05, 0.05, '#F3B6C8')); } }
  };

  function wallHelper(w) {
    const P = (du, dz) => iso(...wallPoint(w.p, w.u + du, w.z + dz));
    const path = (pts) => { ctx.beginPath(); pts.forEach(([a, b], i) => { const [x, y] = P(a, b); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); };
    const ring = (cu, cz, ru, rz) => { const pts = []; for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; pts.push([cu + Math.cos(a) * ru, cz + Math.sin(a) * rz]); } return pts; };
    const H = {
      P, r: (a, b, c, d, fill, st) => { path([[a, b], [c, b], [c, d], [a, d]]); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (st) { ctx.strokeStyle = st; ctx.lineWidth = 1; ctx.stroke(); } },
      p: (pts, fill, st) => { path(pts); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (st) { ctx.strokeStyle = st; ctx.lineWidth = 1; ctx.stroke(); } },
      e: (cu, cz, ru, rz, fill, st) => H.p(ring(cu, cz, ru, rz), fill, st),
      circ: (cu, cz, r, fill) => H.p(ring(cu, cz, r, r), fill),
      l: (a, b, col, lw) => { const [x1, y1] = P(a[0], a[1]), [x2, y2] = P(b[0], b[1]); ctx.strokeStyle = col; ctx.lineWidth = lw || 1; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); },
      pl: (pts, col, lw) => { ctx.beginPath(); pts.forEach(([a, b], i) => { const [x, y] = P(a, b); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.strokeStyle = col; ctx.lineWidth = lw || 1; ctx.stroke(); }
    };
    return H;
  }
  function drawWallObj(w, t) { const T = WTYPES[w.type]; if (!T) return; ctx.save(); const sh = wallHelper(Object.assign({}, w, { u: w.u + 0.03, z: w.z - 0.04 })); sh.r(0, 0, T.w, T.h, 'rgba(0,0,0,.08)'); ctx.restore(); T.draw(wallHelper(w), w, t || animT); }
  function drawWallDecor(level, back) { WALLOBJS.forEach(w => { if (w.level === level && back.includes(w.p) && !(arranging && arr.wHold === w)) drawWallObj(w); }); }

  const PARCEL = { stand: [1.5, 6.0], box: [0.55, 5.75] };
  function roomName(level, x, y) { x = Math.min(9.99, Math.max(0.01, x)); y = Math.min(7.99, Math.max(0.01, y)); const r = LEVELS[level].rooms.find(rm => x >= rm.r[0] && x <= rm.r[2] && y >= rm.r[1] && y <= rm.r[3]); return r ? r.n : LEVEL_NAMES[level]; }

  const C = { sofa: '#4F6F74', cushion: '#5E8187', wood: '#9C6B45', dark: '#7A5236', plum: '#7E4458' };
  const B = (x, y, z, w, d, h, c, f = {}) => Object.assign({ box: [x, y, z, w, d, h], c }, f);
  const F = (x1, y1, x2, y2, fn, f = {}) => Object.assign({ rect: [x1, y1, x2, y2], fn }, f);
  const doing = (ch, name) => ch.task && ch.task.name === name && ch.task.phase === 'do';
  const usingSlot = (sid, names) => [jordan, maya].some(c => c.task && c.task.phase === 'do' && c.task.slot === sid && (!names || names.includes(c.task.name)));
  function steamAt(T, lx, ly, lz, t, n = 4, rise = 0.8) { const [x, y] = T.W(lx, ly); PFX.emit(`${T.o.id}:${lx},${ly}`, 'steam', T.o.level, x, y, lz, (n / 4) * (rise / 0.8)); }
  // A flight of stairs. The same numbers draw it from below (a flight rising to the floor above) and from above (the
  // stairwell cut into that floor, seen going down), so the two views are the same stairs. TOP is the height of a floor.
  const FL = { L: 1.2, N: 7, RUN: 0.28, RISE: 0.325, TOP: 2.6 };
  function flightParts(axis) {
    const { L, N, RUN, RISE, TOP } = FL, Y = axis === 'y', rail = '#5A3E2E', wood = '#8A6A50', dark = '#4A3626';
    const R = (u0, u1, v0, v1) => (Y ? [v0, u0, v1, u1] : [u0, v0, u1, v1]);
    const P = (u, v, z) => (Y ? [v, u, z] : [u, v, z]);
    const BX = (T, u0, u1, v0, v1, z, h, c) => { const r = R(u0, u1, v0, v1); T.box(r[0], r[1], z, r[2] - r[0], r[3] - r[1], h, c); };
    // The top: the edge of the floor above, over a closed base, with the handrail along the open side and a door at the
    // end where the flight goes through the wall.
    const ps = [F(...R(0, L, 0, 1), (T) => {
      BX(T, 0, L, 0, 1, 0, TOP - 0.16, '#7E6048');
      BX(T, 0, L, 0, 1, TOP - 0.16, 0.16, '#B9936C');
      T.poly([P(0.04, 0.04, TOP + 0.002), P(L, 0.04, TOP + 0.002), P(L, 0.96, TOP + 0.002), P(0.04, 0.96, TOP + 0.002)], '#C9A27A');
      for (let u = 0.3; u < L; u += 0.3) T.line(P(u, 0.04, TOP + 0.004), P(u, 0.96, TOP + 0.004), 'rgba(90,60,30,.25)', 1);
      T.line(P(0, 0.04, TOP + 0.9), P(L, 0.04, TOP + 0.9), rail, 2); [0.02, 0.4, 0.8].forEach(u => T.line(P(u, 0.04, TOP), P(u, 0.04, TOP + 0.9), rail, 1.4));
      // The door, in the wall the flight runs into: a white frame, a panelled door and a knob.
      const du = 0.03, v0 = 0.14, v1 = 0.86, dh = 1.95, DQ = (a, b, z0, z1) => [P(du, a, TOP + z0), P(du, b, TOP + z0), P(du, b, TOP + z1), P(du, a, TOP + z1)];
      T.poly(DQ(v0 - 0.07, v1 + 0.07, 0, dh + 0.07), '#EFE8DC');
      T.poly(DQ(v0, v1, 0, dh), '#7A4C32');
      T.poly(DQ(v0 + 0.08, v1 - 0.08, 1.0, dh - 0.12), null, '#5A3A28', 1.4);
      T.poly(DQ(v0 + 0.08, v1 - 0.08, 0.12, 0.86), null, '#5A3A28', 1.4);
      const k = P(du + 0.01, v1 - 0.12, TOP + 0.95); T.poly([[k[0] - 0.025, k[1] - 0.025, k[2]], [k[0] + 0.025, k[1] - 0.025, k[2]], [k[0] + 0.025, k[1] + 0.025, k[2]], [k[0] - 0.025, k[1] + 0.025, k[2]]], '#D9B64A');
    })];
    for (let i = 0; i < N; i++) {
      const u0 = L + i * RUN, u1 = u0 + RUN, h = TOP - (i + 1) * RISE, hp = TOP - i * RISE, um = u0 + RUN / 2, last = i === N - 1;
      ps.push(F(...R(u0, u1, 0, 1), (T) => {
        // A solid stringer under each tread, a tread with a lighter nosing, and the rail climbing with the flight.
        BX(T, u0, u1, 0, 1, 0, h - 0.045, i % 2 ? wood : shade(wood, 0.06)); BX(T, u0 - 0.03, u1, 0, 1, h - 0.045, 0.045, '#BE9A74');
        T.line(P(i === 0 ? L : um - RUN, 0.04, hp + 0.9), P(um, 0.04, h + 0.9), rail, 2);
        T.line(P(um, 0.04, h), P(um, 0.04, h + 0.9), rail, last ? 3.2 : 1.4);
      }));
    }
    return ps;
  }
  // The stairwell in the floor above a flight: a clean opening with the slab's thickness showing, walls dropping away to
  // the floor below, and the steps going down into the shadow.
  function holeParts(axis) {
    // Looking straight down a deep shaft shows only its far wall, so the well is drawn shallower than the real drop and fades
    // into dark: the steps still read as going down.
    const { N, RUN } = FL, TOP = 1.45, RISE = TOP / (N + 1.4), Y = axis === 'y', len = 2.0, rail = '#5A3E2E', wood = '#B08B68';
    const R = (u0, u1, v0, v1) => (Y ? [v0, u0, v1, u1] : [u0, v0, u1, v1]);
    const P = (u, v, z) => (Y ? [v, u, z] : [u, v, z]);
    const quad = (u0, u1, v0, v1, z) => [P(u0, v0, z), P(u1, v0, z), P(u1, v1, z), P(u0, v1, z)];
    return [
      F(...R(0, len, 0, 1), (T) => {
        const Q = quad(0, len, 0, 1, 0).map(([a, b, c]) => T.P(a, b, c));
        const cy = (Q[0][1] + Q[1][1] + Q[2][1] + Q[3][1]) / 4;
        ctx.save();
        ctx.beginPath(); Q.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.clip();
        ctx.fillStyle = '#141018'; ctx.fillRect(Q[0][0] - 400, Q[0][1] - 400, 800, 800);
        // The floor at the bottom, faintly lit.
        T.poly(quad(0, len, 0, 1, -TOP), '#34303B');
        // The walls of the opening that face us: the slab's cut edge, then plain wall falling into the dark.
        for (let e = 0; e < 4; e++) {
          const A = Q[e], B = Q[(e + 1) % 4], pa = quad(0, len, 0, 1, 0)[e], pb = quad(0, len, 0, 1, 0)[(e + 1) % 4];
          if (cy <= (A[1] + B[1]) / 2) continue;
          const dA = T.P(pa[0], pa[1], -TOP), dB = T.P(pb[0], pb[1], -TOP), sA = T.P(pa[0], pa[1], -0.16), sB = T.P(pb[0], pb[1], -0.16);
          const g = ctx.createLinearGradient(0, A[1], 0, dA[1]); g.addColorStop(0, '#6F6670'); g.addColorStop(0.5, '#3A343E'); g.addColorStop(1, '#17131B');
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.lineTo(dB[0], dB[1]); ctx.lineTo(dA[0], dA[1]); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#BE9A74'; ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.lineTo(sB[0], sB[1]); ctx.lineTo(sA[0], sA[1]); ctx.closePath(); ctx.fill();
        }
        // The steps, far ones first, each darker the deeper it is.
        const order = [];
        for (let i = 0; i < N; i++) { const [mx, my] = T.P(...[...R(i * RUN, i * RUN + RUN, 0.5, 0.5)].slice(0, 2), -(i + 1) * RISE); order.push([my, i]); }
        order.sort((p, q) => p[0] - q[0]).forEach(([, i]) => {
          const [x0, y0, x1, y1] = R(i * RUN, (i + 1) * RUN, 0.06, 0.94), top = -(i + 1) * RISE;
          T.box(x0, y0, -TOP, x1 - x0, y1 - y0, TOP + top, shade(wood, -0.1 - 0.72 * ((i + 1) / N)));
        });
        // A little light coming up from the floor below, pooled at the foot of the steps.
        const [lx, ly] = T.P(...[...R(len - 0.12, len - 0.12, 0.5, 0.5)].slice(0, 2), -TOP);
        const gl = ctx.createRadialGradient(lx, ly, 0, lx, ly, 38); gl.addColorStop(0, 'rgba(255,214,150,.28)'); gl.addColorStop(1, 'rgba(255,214,150,0)');
        ctx.fillStyle = gl; ctx.fillRect(lx - 40, ly - 40, 80, 80);
        ctx.restore();
        // The trim round the opening.
        ctx.strokeStyle = '#B79D83'; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.beginPath(); Q.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.stroke();
      }, { decal: true }),
      F(...R(0, len, 0, 0.05), (T) => { T.line(P(0, 0.02, 0.9), P(len, 0.02, 0.9), rail, 2); for (let u = 0; u <= len + 0.01; u += 0.4) T.line(P(u, 0.02, 0), P(u, 0.02, 0.9), rail, 1.4); }),
      F(...R(len - 0.05, len, 0, 1), (T) => { T.line(P(len, 0.02, 0.9), P(len, 1, 0.9), rail, 2); for (let v = 0.25; v <= 1.01; v += 0.25) T.line(P(len, v, 0), P(len, v, 0.9), rail, 1.4); })
    ];
  }
  const cl = (o) => o.col || (colsOf(o) || ['#8A6A50'])[0];
  // Which look a drawer branches on: the skin id, or undefined for the stock look (also for a skin the type does not have).
  const skinId = (o) => (skinOf(o) ? o.skin : undefined);
  function singleBed(cover, edge) {
    const lux = has('bed'), z = lux ? 0.56 : 0.5;
    return [B(0, 0, 0, 0.14, 0.9, lux ? 1.3 : 1.0, lux ? '#6E4A5E' : C.dark), B(0.14, 0, 0, 2.36, 0.9, 0.32, lux ? '#5A3E4C' : C.wood), B(0.18, 0.04, 0.32, 2.28, 0.82, lux ? 0.24 : 0.18, '#F1ECE4', { name: 'mattress' }),
      B(0.23, 0.16, z, 0.5, 0.58, 0.12, '#FFFFFF'), B(0.95, 0, z, 1.55, 0.9, 0.07, lux ? '#C9A24A' : cover, { cover: true }), B(0.95, 0, z + 0.07, 0.2, 0.9, 0.02, lux ? '#E0C26E' : edge, { cover: true })];
  }

  // ---- Looks from the themed sets, one block per theme so a set can be read as one picture ----
  // Each look keeps its piece's footprint, height class, spots and lights; it only draws differently. The stock
  // drawers below hand off here first (see `LOOK_DRAWERS[type][skin]`), so a new theme adds functions, not branches.
  const SC = { ash: '#D8C7A8', ashDark: '#B9A47E', oak: '#C9B693', linen: '#EFE9DD', white: '#F6F4EE', quartz: '#F2F0EA', brass: '#C9A24A', charcoal: '#3A3A40', paper: '#F7F3EA' };
  const IN = { iron: '#2B2B30', steel: '#8E939A', steelLight: '#B9BEC3', brass: '#B8893A', concrete: '#9A9A96', concreteDark: '#7F7F7B', wood: '#8A5E3B', woodDark: '#6B4A35', edison: '#FFB24A', rust: '#7B4A3A' };
  const BE = { white: '#F7F5EF', sand: '#E8DCC2', drift: '#C9B9A2', driftDark: '#A89A86', navy: '#2E3B57', sea: '#7FB8C9', seaDeep: '#4A8FA6', rope: '#C9A97A', rattan: '#D2B48C', coral: '#E8907A', shell: '#F2E6DA' };
  /** Rivets along a face line: little steel domes with a shadow. */
  const rivets = (T, from, to, n, col = IN.steelLight) => { for (let k = 0; k <= n; k++) { const u = k / n, [rx, ry] = T.P(from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u, from[2] + (to[2] - from[2]) * u); circle(rx + 0.4, ry + 0.4, 1.3, 'rgba(0,0,0,.45)'); circle(rx, ry, 1.2, col); } };
  /** Rope wound round a post between two heights: alternating light and dark bands. */
  const rope = (T, lx, ly, z0, z1, w, col = BE.rope) => { for (let z = z0; z < z1; z += 0.05) T.line([lx, ly, z], [lx, ly, Math.min(z1, z + 0.025)], shade(col, (Math.round(z * 40) % 2) ? 0.1 : -0.18), w); };
  const LOOK_DRAWERS = {
    sofa: {
      // Scandi: oatmeal linen on a visible ash frame with tapered legs, slim arms, a bolster and a knitted throw over one arm.
      scandi: (o, s1, s2) => { const v = cl(o), vc = shade(v, 0.07); return [
        ...[[0.06, 0.06], [2.26, 0.06], [0.06, 0.86], [2.26, 0.86]].map(([x, y]) => B(x, y, 0, 0.08, 0.08, 0.14, SC.ashDark)),
        B(0, 0, 0.14, 2.4, 1.0, 0.24, v, { name: 'base' }), B(0.02, 0.02, 0.1, 2.36, 0.96, 0.05, SC.oak),
        B(0, 0, 0.38, 2.4, 0.26, 0.5, v), B(0, 0, 0.38, 0.12, 1.0, 0.22, v), B(2.28, 0, 0.38, 0.12, 1.0, 0.22, v),
        B(0.14, 0.28, 0.38 - s1 * 0.018, 1.06, 0.66, 0.1 - s1 * 0.035, vc), B(1.2, 0.28, 0.38 - s2 * 0.018, 1.06, 0.66, 0.1 - s2 * 0.035, vc),
        B(2.1, 0.02, 0.6, 0.3, 0.96, 0.05, SC.oak),
        F(0, 0, 2.4, 1.0, (T) => {
          const [bx, by] = T.P(0.3, 0.52, 0.56); ell(bx, by, 9, 5, shade(v, 0.16), 'rgba(0,0,0,.12)'); circle(bx, by, 1.6, shade(v, -0.1));
          T.box(2.08, 0.1, 0.6, 0.34, 0.5, 0.1, '#D9B8B0'); for (let y = 0.14; y < 0.6; y += 0.08) T.line([2.1, y, 0.705], [2.4, y, 0.705], 'rgba(120,60,50,.28)', 1);
          T.line([0, 1.001, 0.14], [2.4, 1.001, 0.14], 'rgba(90,70,40,.35)', 1.2);
        }, { onTop: true })]; },
      // Industrial: tufted leather on a black pipe frame, square arms with a row of brass studs.
      industrial: (o, s1, s2) => { const v = cl(o), vc = shade(v, 0.08); return [
        ...[[0.04, 0.04], [2.3, 0.04], [0.04, 0.9], [2.3, 0.9]].map(([x, y]) => B(x, y, 0, 0.06, 0.06, 0.16, IN.iron)),
        B(0, 0, 0.16, 2.4, 1.0, 0.22, v, { name: 'base' }), B(0, 0, 0.38, 2.4, 0.3, 0.55, v), B(0, 0, 0.38, 0.2, 1.0, 0.3, v), B(2.2, 0, 0.38, 0.2, 1.0, 0.3, v),
        B(0.22, 0.3, 0.38 - s1 * 0.018, 0.98, 0.64, 0.1 - s1 * 0.035, vc), B(1.2, 0.3, 0.38 - s2 * 0.018, 0.98, 0.64, 0.1 - s2 * 0.035, vc),
        F(0, 0, 2.4, 1.0, (T) => {
          T.line([0.04, 1.001, 0.1], [2.36, 1.001, 0.1], IN.iron, 2.2); T.line([0.04, 0.0, 0.1], [0.04, 1.0, 0.1], IN.iron, 1.6); T.line([2.36, 0.0, 0.1], [2.36, 1.0, 0.1], IN.iron, 1.6);
          for (let r = 0; r < 2; r++) for (let i = 0; i < 7; i++) { const [tx, ty] = T.P(0.32 + i * 0.3, 0.31, 0.56 + r * 0.2); circle(tx, ty, 1.4, shade(v, -0.4)); circle(tx - 0.5, ty - 0.5, 0.6, 'rgba(255,255,255,.35)'); }
          [[0.1, 0.0], [2.3, 0.0]].forEach(([x]) => { for (let y = 0.1; y < 1.0; y += 0.15) { const [sx, sy] = T.P(x, y, 0.69); circle(sx, sy, 0.9, IN.brass); } });
          T.line([1.2, 0.3, 0.48], [1.2, 0.94, 0.48], 'rgba(0,0,0,.35)', 1);
        }, { onTop: true })]; },
      // Beach: a white slipcover with a navy stripe cushion, rope piping along the base and driftwood feet.
      beach: (o, s1, s2) => { const v = cl(o), vc = shade(v, 0.05); return [
        ...[[0.06, 0.06], [2.26, 0.06], [0.06, 0.86], [2.26, 0.86]].map(([x, y]) => B(x, y, 0, 0.08, 0.08, 0.12, BE.drift)),
        B(0, 0, 0.12, 2.4, 1.0, 0.26, v, { name: 'base' }), B(0, 0, 0.38, 2.4, 0.3, 0.56, v), B(0, 0, 0.38, 0.18, 1.0, 0.24, v), B(2.22, 0, 0.38, 0.18, 1.0, 0.24, v),
        B(0.18, 0.3, 0.38 - s1 * 0.018, 1.02, 0.64, 0.1 - s1 * 0.035, vc), B(1.2, 0.3, 0.38 - s2 * 0.018, 1.02, 0.64, 0.1 - s2 * 0.035, vc),
        B(0.28, 0.34, 0.48, 0.42, 0.14, 0.32, BE.white), B(1.68, 0.34, 0.48, 0.42, 0.14, 0.32, BE.white),
        F(0, 0, 2.4, 1.0, (T) => {
          [0.28, 1.68].forEach(x => { for (let k = 0; k < 4; k++) T.line([x + 0.04, 0.481, 0.52 + k * 0.07], [x + 0.38, 0.481, 0.52 + k * 0.07], BE.navy, 1.6); });
          for (let x = 0.02; x < 2.4; x += 0.08) T.line([x, 1.002, 0.38], [Math.min(2.4, x + 0.04), 1.002, 0.38], shade(BE.rope, (Math.round(x * 25) % 2) ? 0.1 : -0.15), 2.2);
          const [sx, sy] = T.P(1.2, 0.98, 0.26); for (let k = -1; k <= 1; k++) ell(sx + k * 7, sy + 1, 2.2, 1.6, BE.shell, 'rgba(0,0,0,.15)');
        }, { onTop: true })]; },
    },
    dining: {
      // Scandi: a pale ash table with the grain showing, splayed legs, wishbone chairs and a paper lantern over it.
      scandi: (o) => { const ps = [], ash = cl(o), seat = shade(ash, 0.1);
        const chair = (y0, back) => { [[0.39, y0 + 0.04], [0.83, y0 + 0.04], [0.39, y0 + 0.48], [0.83, y0 + 0.48]].forEach(([x, y]) => ps.push(B(x, y, 0, 0.05, 0.05, 0.42, SC.ashDark)));
          ps.push(B(0.35, y0, 0.42, 0.6, 0.58, 0.07, seat, { name: y0 === 0 ? 'seat1' : 'seat2' }), B(0.35, back, 0.98, 0.6, 0.05, 0.08, SC.ashDark));
          ps.push(F(0.35, back - 0.02, 0.95, back + 0.07, (T) => { const yb = back + 0.025; T.line([0.65, yb, 0.49], [0.65, yb, 0.98], SC.ashDark, 2); T.line([0.65, yb, 0.72], [0.47, yb, 0.98], SC.ashDark, 1.6); T.line([0.65, yb, 0.72], [0.83, yb, 0.98], SC.ashDark, 1.6); T.line([0.38, yb, 0.49], [0.4, yb, 0.98], SC.ashDark, 1.4); T.line([0.92, yb, 0.49], [0.9, yb, 0.98], SC.ashDark, 1.4); }, { onTop: true })); };
        chair(0, 0); chair(1.89, 2.42);
        [[0.08, 0.8], [1.16, 0.8], [0.08, 1.62], [1.16, 1.62]].forEach(([x, y]) => ps.push(B(x, y, 0, 0.06, 0.06, 0.7, SC.ashDark)));
        ps.push(B(0, 0.74, 0.7, 1.3, 1.0, 0.07, ash, { name: 'top' }));
        ps.push(F(0, 0.74, 1.3, 1.74, (T) => { for (let y = 0.86; y < 1.74; y += 0.17) T.line([0.04, y, 0.772], [1.26, y + 0.03, 0.772], 'rgba(120,95,55,.22)', 1); T.line([0, 1.74, 0.7], [1.3, 1.74, 0.7], shade(ash, -0.2), 1.6); }, { onTop: true }));
        ps.push(diningLife(), diningLight('lantern'));
        return ps; },
      // Industrial: reclaimed planks on black pipe legs with flanges, and metal stools instead of chairs.
      industrial: (o) => { const ps = [], wood = cl(o), tones = [wood, shade(wood, -0.12), shade(wood, 0.1)];
        const stool = (y0) => { ps.push(B(0.35, y0, 0.42, 0.6, 0.58, 0.07, IN.iron, { name: y0 === 0 ? 'seat1' : 'seat2' }));
          ps.push(F(0.35, y0, 0.95, y0 + 0.58, (T) => { const [cx, cy] = T.P(0.65, y0 + 0.29, 0.49); ell(cx, cy, 10, 5.2, IN.steel, 'rgba(0,0,0,.3)'); ell(cx, cy, 6, 3, shade(IN.steel, 0.12));
            [[0.45, y0 + 0.1], [0.85, y0 + 0.1], [0.65, y0 + 0.5]].forEach(([x, y]) => T.line([x, y, 0], [0.65, y0 + 0.29, 0.42], IN.iron, 2)); T.line([0.45, y0 + 0.1, 0.16], [0.85, y0 + 0.1, 0.16], IN.iron, 1.2); }, { onTop: true })); };
        stool(0); stool(1.89);
        [[0.08, 0.8], [1.16, 0.8], [0.08, 1.62], [1.16, 1.62]].forEach(([x, y]) => { ps.push(B(x, y, 0, 0.07, 0.07, 0.7, IN.iron)); ps.push(F(x - 0.06, y - 0.06, x + 0.13, y + 0.13, (T) => { const [fx, fy] = T.P(x + 0.035, y + 0.035, 0.005); ell(fx, fy, 4.5, 2.4, IN.iron); }, {})); });
        for (let k = 0; k < 3; k++) ps.push(B(0, 0.74 + k * (1.0 / 3), 0.7, 1.3, 1.0 / 3, 0.07, tones[k], k === 1 ? { name: 'top' } : {}));
        ps.push(F(0, 0.74, 1.3, 1.74, (T) => { for (let k = 1; k < 3; k++) T.line([0, 0.74 + k / 3, 0.772], [1.3, 0.74 + k / 3, 0.772], 'rgba(0,0,0,.35)', 1); T.line([0.02, 0.74, 0.7], [0.02, 1.74, 0.7], IN.iron, 1.6); T.line([1.28, 0.74, 0.7], [1.28, 1.74, 0.7], IN.iron, 1.6); }, { onTop: true }));
        ps.push(diningLife(), diningLight('cage'));
        return ps; },
      // Beach: a bleached driftwood table, rattan chairs, and a woven pendant shade.
      beach: (o) => { const ps = [], drift = cl(o), rattan = BE.rattan;
        const chair = (y0, back) => { [[0.39, y0 + 0.04], [0.83, y0 + 0.04], [0.39, y0 + 0.48], [0.83, y0 + 0.48]].forEach(([x, y]) => ps.push(B(x, y, 0, 0.05, 0.05, 0.42, shade(rattan, -0.2))));
          ps.push(B(0.35, y0, 0.42, 0.6, 0.58, 0.07, rattan, { name: y0 === 0 ? 'seat1' : 'seat2' }), B(0.35, back, 0.49, 0.6, 0.07, 0.6, rattan));
          ps.push(F(0.35, back - 0.02, 0.95, back + 0.08, (T) => { const yb = back + 0.072; for (let z = 0.56; z < 1.06; z += 0.08) T.line([0.37, yb, z], [0.93, yb, z], 'rgba(90,60,30,.3)', 1); for (let x = 0.42; x < 0.95; x += 0.1) T.line([x, yb, 0.5], [x, yb, 1.08], 'rgba(90,60,30,.25)', 1); }, { onTop: true })); };
        chair(0, 0); chair(1.89, 2.42);
        [[0.05, 0.79], [1.18, 0.79], [0.05, 1.64], [1.18, 1.64]].forEach(([x, y]) => ps.push(B(x, y, 0, 0.07, 0.07, 0.7, shade(drift, -0.15))));
        ps.push(B(0, 0.74, 0.7, 1.3, 1.0, 0.07, drift, { name: 'top' }));
        ps.push(F(0, 0.74, 1.3, 1.74, (T) => { for (let y = 0.9; y < 1.74; y += 0.24) T.line([0.03, y, 0.772], [1.27, y + 0.02, 0.772], 'rgba(255,255,255,.5)', 1.4); for (let y = 0.98; y < 1.74; y += 0.24) T.line([0.1, y, 0.772], [1.2, y, 0.772], 'rgba(90,70,50,.18)', 1); }, { onTop: true }));
        ps.push(diningLife(), diningLight('woven'));
        return ps; },
    },
    lamp: {
      // Scandi: an ash tripod with a big paper lantern that glows through when lit. The light stays where it was.
      scandi: (T, o) => { const lit = isLit(o.id), shadeCol = cl(o);
        [[0.05, 0.05], [0.35, 0.05], [0.2, 0.35]].forEach(([x, y]) => T.line([x, y, 0], [0.2, 0.2, 1.25], SC.ashDark, 2.4));
        T.line([0.2, 0.2, 1.25], [0.2, 0.2, 1.42], SC.charcoal, 1.6);
        const [lx, ly] = T.P(0.2, 0.2, 1.56);
        if (lit) { ell(lx, ly, 15, 15, 'rgba(255,226,168,.18)'); ell(lx, ly, 12, 12, 'rgba(255,226,168,.3)'); }
        ell(lx, ly, 9.5, 10, lit ? '#FFF1D2' : shadeCol, 'rgba(0,0,0,.12)');
        for (let k = -3; k <= 3; k++) ell(lx, ly + k * 2.8, 9.5 * Math.sqrt(Math.max(0.05, 1 - (k * 2.8 / 10) ** 2)), 0.5, lit ? 'rgba(200,160,100,.25)' : 'rgba(0,0,0,.08)');
        ell(lx, ly + 10, 2.2, 0.9, SC.charcoal); },
      // Industrial: a black pipe stand with an elbow, a cage and an Edison bulb. The light stays where it was.
      industrial: (T, o) => { const lit = isLit(o.id), pipe = cl(o);
        T.box(0.06, 0.06, 0, 0.28, 0.28, 0.04, IN.iron); T.line([0.2, 0.2, 0.04], [0.2, 0.2, 1.42], pipe, 2.6);
        T.line([0.2, 0.2, 1.42], [0.2, 0.2, 1.62], pipe, 2.6); T.line([0.14, 0.14, 1.62], [0.26, 0.26, 1.62], pipe, 3);
        const [bx, by] = T.P(0.2, 0.2, 1.5);
        if (lit) { ell(bx, by, 13, 13, 'rgba(255,178,74,.16)'); ell(bx, by, 8, 8, 'rgba(255,178,74,.28)'); }
        ell(bx, by, 4.2, 5.4, lit ? IN.edison : '#D9C9A8', 'rgba(0,0,0,.25)'); limb(bx - 1.5, by + 1, bx + 1.5, by - 1.5, lit ? '#FFF1C9' : 'rgba(0,0,0,.25)', 0.8);
        for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.ellipse(bx, by - 1, 6, 8.5, k * 0.28, 0, Math.PI * 2); ctx.strokeStyle = pipe; ctx.lineWidth = 0.9; ctx.stroke(); }
        ell(bx, by - 9.5, 3.4, 1.4, pipe); },
      // Beach: a rope-wound post with a woven drum shade. The light stays where it was.
      beach: (T, o) => { const lit = isLit(o.id), shadeCol = cl(o);
        T.box(0.05, 0.05, 0, 0.3, 0.3, 0.05, BE.drift); T.line([0.2, 0.2, 0.05], [0.2, 0.2, 1.4], BE.driftDark, 3);
        rope(T, 0.2, 0.2, 0.3, 1.1, 3.6);
        T.box(0.02, 0.02, 1.38, 0.36, 0.36, 0.34, lit ? '#FFE9B8' : shadeCol);
        for (let z = 1.44; z < 1.72; z += 0.06) { T.line([0.02, 0.381, z], [0.38, 0.381, z], 'rgba(120,90,50,.3)', 1); T.line([0.381, 0.02, z], [0.381, 0.38, z], 'rgba(120,90,50,.3)', 1); }
        for (let x = 0.06; x < 0.38; x += 0.08) T.line([x, 0.382, 1.4], [x, 0.382, 1.7], 'rgba(120,90,50,.22)', 1); },
    },
    plant: {
      // Scandi: a white ceramic pot on an ash stand with crossed legs.
      scandi: (T, o) => { [[0.06, 0.06, 0.44, 0.44], [0.44, 0.06, 0.06, 0.44]].forEach(([x0, y0, x1, y1]) => T.line([x0, y0, 0], [x1, y1, 0], SC.ashDark, 2)); [[0.06, 0.06], [0.44, 0.06], [0.06, 0.44], [0.44, 0.44]].forEach(([x, y]) => T.line([x, y, 0], [x * 0.6 + 0.1, y * 0.6 + 0.1, 0.22], SC.ashDark, 2));
        T.box(0.1, 0.1, 0.2, 0.3, 0.3, 0.03, SC.ashDark); T.box(0.08, 0.08, 0.23, 0.34, 0.34, 0.19, cl(o)); T.line([0.08, 0.421, 0.38], [0.42, 0.421, 0.38], 'rgba(0,0,0,.08)', 1); },
      // Industrial: a galvanized bucket with ribs and a wire handle.
      industrial: (T, o) => { const g = cl(o); T.box(0.04, 0.04, 0, 0.42, 0.42, 0.42, g); [0.12, 0.3].forEach(z => { T.line([0.04, 0.461, z], [0.46, 0.461, z], 'rgba(0,0,0,.28)', 1.2); T.line([0.461, 0.04, z], [0.461, 0.46, z], 'rgba(0,0,0,.28)', 1.2); });
        T.line([0.04, 0.461, 0.4], [0.46, 0.461, 0.4], 'rgba(255,255,255,.35)', 1.4); const [hx, hy] = T.P(0.25, 0.25, 0.42); ctx.beginPath(); ctx.ellipse(hx, hy - 4, 7.5, 6, 0, Math.PI, 0); ctx.strokeStyle = IN.iron; ctx.lineWidth = 1.3; ctx.stroke(); },
      // Beach: a woven seagrass basket with a rope rim.
      beach: (T, o) => { const w = cl(o); T.box(0.03, 0.03, 0, 0.44, 0.44, 0.4, w); for (let z = 0.05; z < 0.4; z += 0.06) { T.line([0.03, 0.471, z], [0.47, 0.471, z], 'rgba(90,60,30,.25)', 1); T.line([0.471, 0.03, z], [0.471, 0.47, z], 'rgba(90,60,30,.25)', 1); }
        for (let x = 0.08; x < 0.47; x += 0.08) T.line([x, 0.472, 0.02], [x, 0.472, 0.4], 'rgba(90,60,30,.18)', 1); T.box(0.01, 0.01, 0.4, 0.48, 0.48, 0.03, BE.rope); },
    },
    counter: {
      // Scandi: ash slab fronts with finger pulls, a white quartz top, a round sink and a brass tap. Sink, stove and coffee stay put.
      scandi: (T, o) => { const ash = cl(o);
        T.box(0, 0, 0, 2.8, 0.8, 0.86, ash); T.box(0, 0, 0, 2.8, 0.8, 0.06, shade(ash, -0.3));
        [0.7, 1.4, 2.1].forEach(x => T.line([x, 0.801, 0.08], [x, 0.801, 0.84], 'rgba(60,40,20,.3)', 1));
        [0.1, 0.8, 1.5, 2.2].forEach(x => T.line([x, 0.802, 0.78], [x + 0.5, 0.802, 0.78], 'rgba(60,40,20,.35)', 2.2));
        T.box(-0.05, -0.04, 0.86, 2.9, 0.88, 0.07, SC.quartz); T.line([-0.05, 0.84, 0.93], [2.85, 0.84, 0.93], 'rgba(0,0,0,.12)', 1);
        const [sx, sy] = T.P(0.65, 0.37, 0.931); ell(sx, sy, 12, 6.5, '#FBFBF8', 'rgba(0,0,0,.22)'); ell(sx, sy + 0.8, 9, 4.6, '#ECEDE9'); circle(sx, sy + 1, 1.3, '#9AA0A6');
        T.line([0.65, 0.04, 0.93], [0.65, 0.04, 1.2], SC.brass, 2.2); T.line([0.65, 0.04, 1.2], [0.65, 0.26, 1.13], SC.brass, 2.2); },
      // Industrial: an open black steel frame with a reclaimed shelf, a concrete top, a steel trough sink and a brass gooseneck.
      industrial: (T, o) => { const frame = cl(o);
        T.box(0.02, 0.02, 0.36, 2.76, 0.76, 0.05, IN.wood); for (let x = 0.3; x < 2.8; x += 0.5) T.line([x, 0.02, 0.411], [x, 0.78, 0.411], 'rgba(0,0,0,.3)', 1);
        [[0.02, 0.02], [1.37, 0.02], [2.72, 0.02], [0.02, 0.72], [1.37, 0.72], [2.72, 0.72]].forEach(([x, y]) => T.box(x, y, 0, 0.06, 0.06, 0.86, frame));
        T.line([0.02, 0.8, 0.1], [2.78, 0.8, 0.1], frame, 2.2); T.line([0.02, 0.8, 0.84], [2.78, 0.8, 0.84], frame, 2.2);
        T.box(-0.05, -0.04, 0.86, 2.9, 0.88, 0.09, IN.concrete);
        for (let k = 0; k < 22; k++) { const [px, py] = T.P(0.05 + ((k * 0.613) % 1) * 2.7, 0.05 + ((k * 0.377) % 1) * 0.7, 0.951); circle(px, py, 0.9, k % 3 ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.25)'); }
        T.line([-0.05, 0.84, 0.86], [2.85, 0.84, 0.86], 'rgba(0,0,0,.3)', 1.2);
        T.poly([[0.28, 0.1, 0.951], [1.02, 0.1, 0.951], [1.02, 0.64, 0.951], [0.28, 0.64, 0.951]], IN.steel, 'rgba(0,0,0,.4)', 1.2); T.poly([[0.34, 0.16, 0.952], [0.96, 0.16, 0.952], [0.96, 0.58, 0.952], [0.34, 0.58, 0.952]], shade(IN.steel, -0.18));
        T.line([0.65, 0.04, 0.95], [0.65, 0.04, 1.3], IN.brass, 2.4); T.line([0.65, 0.04, 1.3], [0.65, 0.18, 1.32], IN.brass, 2.4); T.line([0.65, 0.18, 1.32], [0.65, 0.3, 1.18], IN.brass, 2.4); },
      // Beach: whitewashed shiplap fronts, a driftwood top, a white basin and brass tap, with a rope pull on every door.
      beach: (T, o) => { const w = cl(o);
        T.box(0, 0, 0, 2.8, 0.8, 0.86, w); for (let z = 0.14; z < 0.84; z += 0.14) T.line([0, 0.801, z], [2.8, 0.801, z], 'rgba(90,70,50,.18)', 1);
        [0.7, 1.4, 2.1].forEach(x => T.line([x, 0.802, 0.06], [x, 0.802, 0.84], 'rgba(60,40,20,.3)', 1.2));
        [0.35, 1.05, 1.75, 2.45].forEach(x => { const [px, py] = T.P(x, 0.803, 0.62); ctx.beginPath(); ctx.ellipse(px, py + 2, 3.2, 2.6, 0, Math.PI, 0); ctx.strokeStyle = BE.rope; ctx.lineWidth = 1.6; ctx.stroke(); });
        T.box(-0.05, -0.04, 0.86, 2.9, 0.88, 0.07, BE.drift); for (let x = 0.1; x < 2.8; x += 0.45) T.line([x, -0.02, 0.931], [x + 0.3, 0.86, 0.931], 'rgba(255,255,255,.45)', 1.2);
        T.poly([[0.3, 0.13, 0.931], [1.0, 0.13, 0.931], [1.0, 0.6, 0.931], [0.3, 0.6, 0.931]], '#FBFBF8', 'rgba(0,0,0,.22)', 1); T.poly([[0.38, 0.2, 0.932], [0.92, 0.2, 0.932], [0.92, 0.53, 0.932], [0.38, 0.53, 0.932]], '#EEF2F2');
        T.line([0.65, 0.04, 0.93], [0.65, 0.04, 1.18], SC.brass, 2.2); T.line([0.65, 0.04, 1.18], [0.65, 0.24, 1.12], SC.brass, 2.2); },
    },
    fridge: {
      // Scandi: a white body with an ash cap and ash handles. Returns the colour of the open door.
      scandi: (T, o) => { const body = cl(o);
        T.box(0, 0, 0, 0.9, 0.85, 1.86, body); T.box(0, 0, 1.86, 0.9, 0.85, 0.09, SC.oak);
        T.line([0, 0.85, 1.3], [0.9, 0.85, 1.3], 'rgba(60,70,80,.25)', 1.2);
        [[0.7, 1.15], [1.42, 1.78]].forEach(([z0, z1]) => { T.line([0.78, 0.855, z0], [0.78, 0.855, z1], SC.ashDark, 4); T.line([0.78, 0.856, z0], [0.78, 0.856, z1], SC.oak, 2.2); });
        const [bx, by] = T.P(0.2, 0.851, 1.78); circle(bx, by, 1.4, SC.brass);
        return body; },
      // Industrial: gunmetal with riveted edges, a steel kick plate and a heavy latch. Returns the colour of the open door.
      industrial: (T, o) => { const body = cl(o);
        T.box(0, 0, 0, 0.9, 0.85, 0.08, IN.steelLight); T.box(0, 0, 0.08, 0.9, 0.85, 1.87, body);
        T.line([0, 0.85, 1.3], [0.9, 0.85, 1.3], 'rgba(0,0,0,.45)', 1.6);
        rivets(T, [0.06, 0.851, 0.14], [0.06, 0.851, 1.9], 11); rivets(T, [0.84, 0.851, 0.14], [0.84, 0.851, 1.9], 11); rivets(T, [0.14, 0.851, 1.3], [0.76, 0.851, 1.3], 5);
        T.box(0.72, 0.82, 0.62, 0.1, 0.06, 0.5, IN.iron); T.box(0.72, 0.82, 1.4, 0.1, 0.06, 0.42, IN.iron);
        for (let z = 0.3; z < 1.85; z += 0.25) T.line([0.12, 0.851, z], [0.7, 0.851, z + 0.06], 'rgba(255,255,255,.05)', 4);
        return body; },
      // Beach: sea-glass enamel with a white cap, rope handles and a shell badge. Returns the colour of the open door.
      beach: (T, o) => { const body = cl(o);
        T.box(0, 0, 0, 0.9, 0.85, 0.07, BE.drift); T.box(0, 0, 0.07, 0.9, 0.85, 1.8, body); T.box(0, 0, 1.87, 0.9, 0.85, 0.08, BE.white);
        T.line([0, 0.85, 1.3], [0.9, 0.85, 1.3], 'rgba(255,255,255,.55)', 1.4);
        [[0.7, 1.15], [1.42, 1.78]].forEach(([z0, z1]) => rope(T, 0.78, 0.856, z0, z1, 3.4));
        const [bx, by] = T.P(0.3, 0.851, 1.6); ell(bx, by, 3.2, 2.6, BE.shell, 'rgba(0,0,0,.2)'); for (let k = -1; k <= 1; k++) limb(bx, by + 2, bx + k * 2, by - 2, 'rgba(0,0,0,.18)', 0.7);
        return body; },
    },
  };
  // ---- Bedroom and bath looks: the upstairs packs. Same contract as above: footprint, spots and lights stay with the type. ----
  // Brutalist Loft: board-formed concrete, blackened steel and one sheet of glass.
  const BR = { conc: '#A3A19C', concDark: '#85837E', concLite: '#BDBBB5', steel: '#2B2D31', steelLite: '#4A4E55', linen: '#E9E6E0' };
  // The seams the formwork boards leave in poured concrete, across a face that looks along +y.
  const boardSeams = (T, x0, x1, y, z0, z1, n) => { for (let k = 1; k < n; k++) { const z = z0 + (z1 - z0) * k / n; T.line([x0, y, z], [x1, y, z], 'rgba(0,0,0,.13)', 0.8); } };
  const tieHoles = (T, xs, y, zs) => xs.forEach((x) => zs.forEach((z) => { const [hx, hy] = T.P(x, y, z); circle(hx, hy, 1.1, 'rgba(0,0,0,.28)'); }));
  Object.assign(LOOK_DRAWERS, {
    // A concrete slab for a headboard on a low concrete plinth, white linen and a cover in the piece's colour.
    bed: { brutalist: (o) => { const c = cl(o); return [
      B(0, 0, 0, 0.16, 1.6, 1.15, BR.conc), B(0.16, 0.06, 0, 2.3, 1.48, 0.3, BR.concDark),
      // The duvet is a block of its own over the foot of the mattress, so it shows with nobody in bed; its top is a
      // cover too, drawn over whoever is sleeping.
      B(0.2, 0.08, 0.3, 0.75, 1.44, 0.2, BR.linen, { name: 'mattress' }),
      B(0.25, 0.14, 0.5, 0.48, 0.56, 0.11, '#FFFFFF'), B(0.25, 0.9, 0.5, 0.48, 0.56, 0.11, '#FFFFFF'),
      B(0.95, 0.06, 0.3, 1.5, 1.48, 0.25, c), B(0.95, 0.06, 0.55, 1.5, 1.48, 0.02, shade(c, 0.06), { cover: true }),
      F(0.95, 0.06, 1.13, 1.54, (T) => T.poly([[0.95, 0.06, 0.571], [1.11, 0.06, 0.571], [1.11, 1.54, 0.571], [0.95, 1.54, 0.571]], shade(c, 0.22)), { onTop: true }),
      F(0, 0, 0.17, 1.6, (T) => { for (let k = 1; k < 5; k++) { const z = 1.15 * k / 5; T.line([0.161, 0.02, z], [0.161, 1.58, z], 'rgba(0,0,0,.13)', 0.8); } [0.3, 0.8, 1.3].forEach((y) => { const [hx, hy] = T.P(0.161, y, 0.92); circle(hx, hy, 1.1, 'rgba(0,0,0,.28)'); }); }, { onTop: true })]; } },
    // A poured cube with a recess for a book, and a blackened steel reading arm.
    nightstand: { brutalist: (T, o) => { const lit = isLit(o.id);
      T.box(0.02, 0.02, 0, 0.41, 0.41, 0.5, BR.conc); boardSeams(T, 0.02, 0.43, 0.431, 0, 0.5, 3);
      T.poly([[0.08, 0.432, 0.1], [0.37, 0.432, 0.1], [0.37, 0.432, 0.28], [0.08, 0.432, 0.28]], '#5E5C59');
      T.line([0.34, 0.3, 0.5], [0.34, 0.3, 0.95], BR.steel, 2); T.line([0.34, 0.3, 0.95], [0.16, 0.24, 0.93], BR.steel, 2);
      const [lx, ly] = T.P(0.16, 0.24, 0.88); if (lit) ell(lx, ly + 4, 12, 7, 'rgba(255,226,168,.3)');
      ell(lx, ly, 5, 3, lit ? '#FFE2A8' : BR.steelLite, BR.steel); } },
    // Three steel lockers under a concrete top: vents, a pull and a number on each door.
    dresser: { brutalist: (T, o) => { const c = cl(o);
      T.box(0.03, 0.03, 0, 1.14, 0.44, 0.07, BR.steel); T.box(0, 0, 0.07, 1.2, 0.5, 0.78, c);
      [0.4, 0.8].forEach((x) => T.line([x, 0.501, 0.08], [x, 0.501, 0.84], 'rgba(0,0,0,.35)', 1.2));
      [0.2, 0.6, 1.0].forEach((x, k) => { for (let v = 0; v < 3; v++) T.line([x - 0.08, 0.502, 0.72 - v * 0.04], [x + 0.08, 0.502, 0.72 - v * 0.04], 'rgba(0,0,0,.4)', 1);
        T.line([x + 0.13, 0.503, 0.38], [x + 0.13, 0.503, 0.52], '#C9CED6', 1.6); const [nx, ny] = T.P(x, 0.503, 0.58); rr(nx - 4, ny - 3, 8, 6, 1, '#E8EAEC'); ctx.fillStyle = '#2B2D31'; ctx.font = '600 5px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(k + 1), nx, ny + 2); ctx.textAlign = 'start'; });
      T.box(-0.02, -0.02, 0.85, 1.24, 0.54, 0.05, BR.concLite); T.box(0.85, 0.15, 0.9, 0.16, 0.16, 0.16, BR.conc); } },
    // Wall-hung: a concrete cistern block with a steel flush plate, and a matte black bowl that floats off the floor.
    toilet: { brutalist: (T, o) => {
      T.box(0.02, 0, 0, 0.38, 0.14, 0.8, BR.conc); boardSeams(T, 0.02, 0.4, 0.141, 0, 0.8, 4);
      T.poly([[0.13, 0.142, 0.6], [0.29, 0.142, 0.6], [0.29, 0.142, 0.7], [0.13, 0.142, 0.7]], BR.steelLite, BR.steel, 0.8);
      T.box(0.1, 0.14, 0.22, 0.22, 0.16, 0.16, '#2E2F33'); const [bx, by] = T.P(0.21, 0.4, 0.3); ell(bx, by + 1, 7.5, 6, '#2E2F33', '#1B1C1F');
      const [sx, sy] = T.P(0.21, 0.38, 0.385); ell(sx, sy, 7, 4, '#45464B'); ell(sx, sy, 5, 2.8, '#1E1F22');
      if (live(T.o.id)) { ell(sx, sy, 4.5, 2.5, '#BFE2F0'); ctx.strokeStyle = 'rgba(90,150,200,.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(sx, sy, 3, 1.6, animT * 9, 0, Math.PI * 1.4); ctx.stroke(); } } },
    // A poured concrete trough on blackened steel legs, a wall tap over it and towels on the shelf below.
    vanity: { brutalist: (T, o) => {
      [[0.05, 0.05], [0.93, 0.05], [0.05, 0.43], [0.93, 0.43]].forEach(([x, y]) => T.line([x, y, 0], [x, y, 0.62], BR.steel, 2.2));
      T.box(0.04, 0.04, 0.2, 0.92, 0.42, 0.03, BR.steel); T.box(0.12, 0.1, 0.23, 0.3, 0.3, 0.1, '#E9E6E0'); T.box(0.5, 0.1, 0.23, 0.3, 0.3, 0.07, '#8E939A');
      T.box(-0.02, -0.02, 0.62, 1.04, 0.54, 0.2, BR.conc); boardSeams(T, -0.02, 1.02, 0.521, 0.62, 0.82, 2);
      T.poly([[0.12, 0.08, 0.821], [0.88, 0.08, 0.821], [0.88, 0.42, 0.821], [0.12, 0.42, 0.821]], '#6E6C68');
      T.line([0.5, 0.0, 1.02], [0.5, 0.16, 1.02], BR.steel, 2.6); T.line([0.5, 0.16, 1.02], [0.5, 0.16, 0.96], BR.steel, 2.6); } },
    // A walk-in shower: a concrete tray and back wall, a square rain head on a steel arm, a slot drain and one glass panel.
    shower: { brutalist: (o) => [F(0, 0, 1.18, 1.18, (T) => {
        T.box(0, 0, 0, 1.18, 1.18, 0.08, BR.concDark); T.box(0, 0, 0.08, 1.18, 0.1, 2.02, BR.conc); boardSeams(T, 0, 1.18, 0.101, 0.08, 2.1, 6); tieHoles(T, [0.3, 0.9], 0.101, [0.7, 1.5]);
        T.poly([[0.2, 0.95, 0.081], [0.98, 0.95, 0.081], [0.98, 1.0, 0.081], [0.2, 1.0, 0.081]], '#2B2D31');
        T.line([0.57, 0.1, 2.08], [0.57, 0.42, 2.08], BR.steel, 2.5); T.poly([[0.45, 0.36, 2.06], [0.69, 0.36, 2.06], [0.69, 0.6, 2.06], [0.45, 0.6, 2.06]], BR.steel);
        if (usingSlot(T.o.id + ':s') || live(T.o.id)) { steamAt(T, 0.6, 0.6, 0.9, 0, 6, 1); steamAt(T, 0.5, 0.75, 1.5, 0, 3, 0.8); const [wx, wy] = T.W(0.57, 0.48); PFX.emit(T.o.id + ':splash', 'splash', T.o.level, wx, wy, 1.95, 1); }
      }, { name: 'tray' }),
      F(1.16, 0, 1.2, 0.8, (T) => { T.poly([[1.18, 0.1, 0.08], [1.18, 0.8, 0.08], [1.18, 0.8, 2.0], [1.18, 0.1, 2.0]], 'rgba(186,222,232,.2)', 'rgba(40,42,46,.85)', 1.4); T.line([1.18, 0.2, 1.85], [1.18, 0.6, 1.1], 'rgba(255,255,255,.5)', 2); })] },
  });
  const diningLife = () => F(0, 0.74, 1.3, 1.74, (T, o) => {
    ['c1', 'c2'].forEach((s, i) => { const sid = o.id + ':' + s, who = reserved[sid]; if (who && who.task && who.task.slot === sid && (doing(who, 'eat') || doing(who, 'eatOut') || doing(who, 'sip'))) { const [px, py] = T.P(0.65, i ? 1.5 : 0.98, 0.775); if (doing(who, 'eatOut')) { rr(px - 5, py - 7, 10, 7, 1.5, '#F2EEE8'); } else if (doing(who, 'sip')) { rr(px - 3, py - 6, 6, 6, 1.2, '#F2EEE8'); } else { ell(px, py, 10, 5, '#F5F2EC', 'rgba(0,0,0,.15)'); ell(px, py - 1, 6, 2.8, who.mealFresh ? '#7FB069' : '#D9822B'); circle(px + 3, py - 2, 1.8, '#4F9460'); } } });
    for (let i = 0; i < Math.min(dishes, 4); i++) { const [px, py] = T.P(1.05, 1.5, 0.775); ell(px, py - i * 2.2, 8, 4, '#EDE8E1', 'rgba(0,0,0,.2)'); ell(px + 1, py - i * 2.2 - 0.5, 4, 1.6, 'rgba(150,100,60,.45)'); }
    const [fx, fy] = T.P(0.3, 1.2, 0.775); ell(fx, fy, 6, 3, '#E9E4DD', 'rgba(0,0,0,.15)'); circle(fx - 2, fy - 3, 2.3, '#C2413A'); circle(fx + 2, fy - 2.5, 2.1, '#E0A43A');
  }, { onTop: true });
  // The pendant over the table: the stock dome, a paper lantern, a cage bulb or a woven shade. Its light stays where it is.
  const diningLight = (style) => F(0.45, 1.04, 0.85, 1.44, (T, o) => {
    const on = isLit(o.id), [px, py] = T.P(0.65, 1.24, 1.86);
    if (style === 'lantern') { T.line([0.65, 1.24, WH], [0.65, 1.24, 1.98], SC.charcoal, 1); if (on) ell(px, py, 14, 14, 'rgba(255,226,168,.18)'); ell(px, py, 10, 10.5, on ? '#FFF1D2' : SC.paper, 'rgba(0,0,0,.12)'); for (let k = -2; k <= 2; k++) ell(px, py + k * 3.4, 10 * Math.sqrt(Math.max(0.05, 1 - (k * 3.4 / 10.5) ** 2)), 0.5, 'rgba(0,0,0,.08)'); return; }
    if (style === 'cage') { T.line([0.65, 1.24, WH], [0.65, 1.24, 1.96], IN.iron, 1.4); if (on) ell(px, py, 11, 11, 'rgba(255,178,74,.2)'); ell(px, py + 1, 4, 5.2, on ? IN.edison : '#D9C9A8', 'rgba(0,0,0,.25)'); for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.ellipse(px, py, 6, 8.5, k * 0.28, 0, Math.PI * 2); ctx.strokeStyle = IN.iron; ctx.lineWidth = 0.9; ctx.stroke(); } return; }
    if (style === 'tiered') { T.line([0.65, 1.24, WH], [0.65, 1.24, 1.98], DE.lacquer, 1.2); [[12, 0], [9, -4], [6, -8]].forEach(([r, dy]) => { ell(px, py + dy, r, r * 0.4, DE.gold, 'rgba(0,0,0,.2)'); }); ell(px, py + 1, 11, 3.6, on ? '#FFF1C9' : DE.alabaster); if (on) ell(px, py + 5, 14, 6, 'rgba(255,226,168,.18)'); return; }
    if (style === 'washi') { T.line([0.65, 1.24, WH], [0.65, 1.24, 2.05], JA.ink, 1); if (on) ell(px, py - 6, 12, 16, 'rgba(255,226,168,.16)'); const [tx, ty] = T.P(0.65, 1.24, 2.04); ctx.beginPath(); ctx.moveTo(tx - 7, ty); ctx.lineTo(tx + 7, ty); ctx.lineTo(px + 7, py); ctx.lineTo(px - 7, py); ctx.closePath(); ctx.fillStyle = on ? '#FFF3DA' : JA.paper; ctx.fill(); for (let k = 1; k < 6; k++) { const yy = ty + (py - ty) * k / 6; limb(tx - 7, yy, tx + 7, yy, 'rgba(90,70,40,.25)', 1); } ell(px, py, 7, 2.6, on ? '#FFF1C9' : shade(JA.paper, -0.1)); return; }
    if (style === 'macrame') { T.line([0.65, 1.24, WH], [0.65, 1.24, 1.96], BO.jute, 1.6); ctx.beginPath(); ctx.ellipse(px, py - 2, 12, 9, 0, Math.PI, 0); ctx.fillStyle = BO.macrame; ctx.fill(); for (let k = -4; k <= 4; k++) limb(px + k * 2.6, py - 2, px + k * 2.6 + (k % 2 ? 1 : -1), py + 8, BO.macrame, 1); ell(px, py - 2, 12, 4, on ? '#FFF1C9' : BO.jute); return; }
    if (style === 'saucer') { T.line([0.65, 1.24, WH], [0.65, 1.24, 1.94], SA.chrome, 1.4); ell(px, py - 3, 13, 4, SA.chrome, 'rgba(0,0,0,.2)'); ell(px, py - 6, 6, 3.5, SA.white); ell(px, py - 1, 11, 3, on ? '#FFF1C9' : '#4A4450'); for (let k = -2; k <= 2; k++) circle(px + k * 5, py + 1, 1.2, on ? SA.neon : '#3A3F4A'); if (on) ell(px, py + 5, 15, 6, 'rgba(91,227,230,.14)'); return; }
    if (style === 'chandelier') { T.line([0.65, 1.24, WH], [0.65, 1.24, 1.98], GO.ebony, 1.4); ell(px, py + 2, 13, 5, null, GO.brass, 1.6); ctx.beginPath(); ctx.ellipse(px, py + 2, 13, 5, 0, 0, Math.PI * 2); ctx.strokeStyle = GO.brass; ctx.lineWidth = 1.6; ctx.stroke(); [[-11, 1], [0, -3], [11, 1]].forEach(([dx, dy]) => { limb(px, py - 6, px + dx, py + dy, GO.brass, 1.2); ell(px + dx, py + dy - 4, 1.6, 4, '#F6EFE0'); circle(px + dx, py + dy - 9, 1.6, on ? GO.candle : '#8E8A84'); if (on) circle(px + dx, py + dy - 9, 4, 'rgba(255,224,160,.25)'); }); circle(px, py - 6, 2.4, GO.brass); if (on) ell(px, py + 6, 16, 7, 'rgba(255,214,150,.14)'); return; }
    if (style === 'moroccan') { T.line([0.65, 1.24, WH], [0.65, 1.24, 1.98], GO.brass, 1); ctx.beginPath(); ctx.moveTo(px, py - 12); ctx.lineTo(px + 7, py - 4); ctx.lineTo(px + 7, py + 5); ctx.lineTo(px, py + 11); ctx.lineTo(px - 7, py + 5); ctx.lineTo(px - 7, py - 4); ctx.closePath(); ctx.fillStyle = RI.brass; ctx.fill(); for (let r = -3; r <= 3; r += 3) for (let c = -4; c <= 4; c += 4) circle(px + c, py + r, 1, on ? '#FFE9B8' : RI.cedarDark); circle(px, py - 12, 1.8, RI.brass); if (on) ell(px, py + 3, 15, 12, 'rgba(255,214,150,.16)'); return; }
    if (style === 'bamboo') { T.line([0.65, 1.24, WH], [0.65, 1.24, 1.96], TR.bambooDark, 1.4); ctx.beginPath(); ctx.moveTo(px - 14, py + 3); ctx.lineTo(px + 14, py + 3); ctx.lineTo(px, py - 12); ctx.closePath(); ctx.fillStyle = TR.rattan; ctx.fill(); for (let k = 1; k < 5; k++) { const yy = py + 3 - k * 3, hw = 14 * (1 - k / 5); limb(px - hw, yy, px + hw, yy, 'rgba(90,60,30,.35)', 1); } ell(px, py + 3, 14, 4.5, on ? '#FFF1C9' : '#B9A07A'); circle(px, py + 9, 2, TR.pink); if (on) ell(px, py + 7, 16, 6, 'rgba(255,226,168,.18)'); return; }
    if (style === 'sputnik') { T.line([0.65, 1.24, WH], [0.65, 1.24, 1.9], ME.black, 1.6); [[-12, -4, ME.red], [11, -6, ME.yellow], [6, 8, ME.blue], [-7, 7, ME.black]].forEach(([dx, dy, c]) => { limb(px, py, px + dx, py + dy, ME.black, 1.2); circle(px + dx, py + dy, 3.2, c); }); circle(px, py, 5, on ? '#FFF1C9' : ME.white, 'rgba(0,0,0,.2)'); if (on) circle(px, py, 11, 'rgba(255,226,168,.16)'); return; }
    if (style === 'iron') { T.line([0.65, 1.24, WH], [0.65, 1.24, 1.98], PR.iron, 1.2); ctx.beginPath(); ctx.moveTo(px - 7, py - 10); ctx.lineTo(px + 7, py - 10); ctx.lineTo(px + 9, py + 6); ctx.lineTo(px - 9, py + 6); ctx.closePath(); ctx.fillStyle = on ? 'rgba(255,241,201,.85)' : 'rgba(230,236,240,.55)'; ctx.fill(); ctx.strokeStyle = PR.iron; ctx.lineWidth = 1.2; ctx.stroke(); limb(px, py - 10, px, py + 6, PR.iron, 1); limb(px - 8, py - 2, px + 8, py - 2, PR.iron, 1); ell(px, py - 10, 7, 2.4, PR.iron); ell(px, py + 6, 9, 3, PR.iron); circle(px, py - 13, 1.6, PR.iron); if (on) ell(px, py + 8, 15, 7, 'rgba(255,226,168,.16)'); return; }
    if (style === 'tin') { T.line([0.65, 1.24, WH], [0.65, 1.24, 1.96], AD.black, 1.2); ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 6 : 13; ctx.lineTo(px + Math.cos(a) * r, py + Math.sin(a) * r); } ctx.closePath(); ctx.fillStyle = '#B9B4AC'; ctx.fill(); ctx.strokeStyle = AD.black; ctx.lineWidth = 0.8; ctx.stroke(); for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * Math.PI * 2 / 5; circle(px + Math.cos(a) * 7, py + Math.sin(a) * 7, 1.2, on ? '#FFE9B8' : AD.black); } circle(px, py, 2.4, on ? '#FFF1C9' : AD.black); if (on) ell(px, py + 5, 15, 7, 'rgba(255,214,150,.18)'); return; }
    if (style === 'neonring') { T.line([0.65, 1.24, WH], [0.65, 1.24, 1.9], NE.steel, 1.4); if (on) ell(px, py, 16, 8, 'rgba(25,230,240,.16)'); ctx.beginPath(); ctx.ellipse(px, py, 13, 5.5, 0, 0, Math.PI * 2); ctx.strokeStyle = on ? NE.cyan : NE.steel; ctx.lineWidth = 2.4; ctx.stroke(); ctx.beginPath(); ctx.ellipse(px, py, 13, 5.5, 0, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 0.8; ctx.stroke(); circle(px, py - 4, 2, NE.steel); return; }
    if (style === 'lollipop') { T.line([0.65, 1.24, WH], [0.65, 1.24, 1.92], CA.cream, 1.6); if (on) circle(px, py, 15, 'rgba(255,226,210,.22)'); circle(px, py, 10, on ? '#FFD9E4' : CA.pink, 'rgba(0,0,0,.08)'); ctx.beginPath(); for (let a = 0; a < Math.PI * 4; a += 0.2) { const r = a * 0.72; const x = px + Math.cos(a) * r, y = py + Math.sin(a) * r * 0.9; a ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.4; ctx.stroke(); ell(px - 3, py - 4, 2.5, 1.5, 'rgba(255,255,255,.7)'); return; }
    if (style === 'rainbow') { T.line([0.65, 1.24, WH], [0.65, 1.24, 1.98], CC.sky, 1.4); cloud(px, py - 6, 12, on ? '#FFFDF6' : CC.cloud); rainbow(px, py + 2, 11, 1.8, 0, Math.PI); if (on) ell(px, py + 6, 16, 7, 'rgba(255,226,168,.18)'); circle(px, py - 10, 2.2, on ? CC.yellow : CC.cloudShade); return; }
    if (style === 'marquee') { T.line([0.65, 1.24, WH], [0.65, 1.24, 1.96], AR.chrome, 1.4); const [ax, ay] = T.P(0.4, 1.24, 1.86), [bx, by] = T.P(0.9, 1.24, 1.86); ctx.beginPath(); ctx.moveTo(ax, ay - 7); ctx.lineTo(bx, by - 7); ctx.lineTo(bx, by + 5); ctx.lineTo(ax, ay + 5); ctx.closePath(); ctx.fillStyle = on && power ? AR.yellow : '#5A4A20'; ctx.fill(); ctx.strokeStyle = AR.ink; ctx.lineWidth = 1; ctx.stroke(); chaser(ax + 3, ay - 5, bx - 3, by - 5, 7, o.id, on && power); chaser(ax + 3, ay + 3, bx - 3, by + 3, 7, o.id, on && power); if (on) ell(px, py + 8, 16, 7, 'rgba(244,196,48,.16)'); return; }
    if (style === 'woven') { T.line([0.65, 1.24, WH], [0.65, 1.24, 1.95], BE.rope, 1.6); ctx.beginPath(); ctx.ellipse(px, py - 2, 11, 9, 0, Math.PI, 0); ctx.fillStyle = BE.rattan; ctx.fill(); for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.ellipse(px, py - 2, 11, 9, 0, Math.PI + k * 0.6, Math.PI + k * 0.6 + 0.3); ctx.strokeStyle = 'rgba(90,60,30,.35)'; ctx.lineWidth = 1; ctx.stroke(); } ell(px, py - 2, 11, 4, on ? '#FFF1C9' : '#B9A07A'); return; }
    T.line([0.65, 1.24, WH], [0.65, 1.24, 1.95], '#3A3340', 1.2); ctx.beginPath(); ctx.ellipse(px, py, 10, 9, 0, Math.PI, 0); ctx.fillStyle = '#2B2B30'; ctx.fill(); ell(px, py, 10, 3.8, on ? '#FFF1C9' : '#4A4450');
  }, { onTop: true });

  // ---- Four more: Art Deco, Japandi, Boho and Space Age ----
  const DE = { lacquer: '#1B1A1F', gold: '#C9A24A', goldLight: '#E0C26E', emerald: '#1F5E4A', ivory: '#F2EAD8', burgundy: '#6E2A3A', mirror: '#DCE4EA', alabaster: '#F6EFE0' };
  const JA = { walnut: '#4A3A2E', walnutLight: '#6B5444', ash: '#E6DCCB', stone: '#B9B4AC', stoneDark: '#8E8A84', paper: '#F7F3EA', ink: '#2B2B30', moss: '#7A8A6A', clay: '#B07A5A', bone: '#EDE6D6' };
  const BO = { terracotta: '#C26B4A', mustard: '#D9A84A', rust: '#A85A40', cream: '#F1E8D2', rattan: '#D2B48C', rattanDark: '#A8865A', macrame: '#EFE4D2', teal: '#3D6B73', jute: '#C9B28A', wood: '#9C6B45' };
  const SA = { white: '#F4F6F8', chrome: '#D5DAE0', chromeDark: '#9AA0A6', orange: '#F26A2E', neon: '#5BE3E6', violet: '#7A5CFF', dark: '#1B1A24', glass: '#2A2F3A' };
  /** A fan of rays from a point, in screen space: the deco sunburst. */
  const sunburst = (x, y, r, n, col, w = 1) => { for (let k = 0; k <= n; k++) { const a = Math.PI + (k / n) * Math.PI; limb(x, y, x + Math.cos(a) * r, y + Math.sin(a) * r, col, w); } };
  /** Macrame fringe: short hanging threads along a line, in the piece's frame. */
  const fringe = (T, from, to, n, drop, col) => { for (let k = 0; k <= n; k++) { const u = k / n, x = from[0] + (to[0] - from[0]) * u, y = from[1] + (to[1] - from[1]) * u; T.line([x, y, from[2]], [x, y, from[2] - drop - (k % 2) * 0.02], col, 1); } };
  Object.assign(LOOK_DRAWERS.sofa, {
    // Art Deco: emerald velvet with channel tufting, a gold plinth and gold piping.
    deco: (o, s1, s2) => { const v = cl(o), vc = shade(v, 0.08); return [
      B(0.02, 0.02, 0, 2.36, 0.96, 0.08, DE.gold), B(0, 0, 0.08, 2.4, 1.0, 0.3, v, { name: 'base' }), B(0, 0, 0.38, 2.4, 0.3, 0.58, v), B(0, 0, 0.38, 0.22, 1.0, 0.3, v), B(2.18, 0, 0.38, 0.22, 1.0, 0.3, v),
      B(0.22, 0.3, 0.38 - s1 * 0.018, 0.98, 0.66, 0.1 - s1 * 0.035, vc), B(1.2, 0.3, 0.38 - s2 * 0.018, 0.98, 0.66, 0.1 - s2 * 0.035, vc),
      F(0, 0, 2.4, 1.0, (T) => {
        for (let x = 0.12; x < 2.4; x += 0.16) T.line([x, 0.301, 0.42], [x, 0.301, 0.94], shade(v, -0.22), 1.6);
        T.line([0, 1.001, 0.38], [2.4, 1.001, 0.38], DE.gold, 1.6); T.line([0, 1.002, 0.08], [2.4, 1.002, 0.08], DE.goldLight, 1.2);
        [[0.22, 0.68], [2.18, 0.68]].forEach(([x, z]) => T.line([x, 0.0, z], [x, 1.0, z], DE.gold, 1.4));
      }, { onTop: true })]; },
    // Japandi: a low walnut platform with a bone cushion, a flat back and no arms to speak of.
    japandi: (o, s1, s2) => { const w = cl(o), cushion = JA.bone; return [
      B(0, 0, 0, 2.4, 1.0, 0.16, w), B(0.06, 0.1, 0.16, 2.28, 0.86, 0.22, cushion, { name: 'base' }), B(0, 0, 0.38, 2.4, 0.22, 0.46, w), B(0.06, 0.22, 0.38, 2.28, 0.12, 0.36, cushion),
      B(0.1, 0.34, 0.38 - s1 * 0.018, 1.08, 0.6, 0.08 - s1 * 0.035, shade(cushion, 0.05)), B(1.22, 0.34, 0.38 - s2 * 0.018, 1.08, 0.6, 0.08 - s2 * 0.035, shade(cushion, 0.05)),
      B(0.3, 0.36, 0.46, 0.4, 0.12, 0.3, JA.moss), B(1.7, 0.36, 0.46, 0.4, 0.12, 0.3, JA.stone),
      F(0, 0, 2.4, 1.0, (T) => { T.line([0, 1.001, 0.08], [2.4, 1.001, 0.08], 'rgba(0,0,0,.3)', 1.2); T.line([0.06, 0.961, 0.16], [2.34, 0.961, 0.16], 'rgba(0,0,0,.12)', 1); }, { onTop: true })]; },
    // Boho: a cream sofa with rattan arms, kilim cushions and a fringe along the base.
    boho: (o, s1, s2) => { const v = cl(o), vc = shade(v, 0.06); return [
      ...[[0.06, 0.06], [2.26, 0.06], [0.06, 0.86], [2.26, 0.86]].map(([x, y]) => B(x, y, 0, 0.08, 0.08, 0.12, BO.rattanDark)),
      B(0, 0, 0.12, 2.4, 1.0, 0.26, v, { name: 'base' }), B(0, 0, 0.38, 2.4, 0.3, 0.56, v), B(0, 0, 0.38, 0.18, 1.0, 0.3, BO.rattan), B(2.22, 0, 0.38, 0.18, 1.0, 0.3, BO.rattan),
      B(0.18, 0.3, 0.38 - s1 * 0.018, 1.02, 0.64, 0.1 - s1 * 0.035, vc), B(1.2, 0.3, 0.38 - s2 * 0.018, 1.02, 0.64, 0.1 - s2 * 0.035, vc),
      B(0.26, 0.34, 0.48, 0.42, 0.14, 0.32, BO.cream), B(1.72, 0.34, 0.48, 0.42, 0.14, 0.32, BO.cream),
      F(0, 0, 2.4, 1.0, (T) => {
        [[0.26, BO.rust], [1.72, BO.teal]].forEach(([x, c]) => { for (let z = 0.54; z < 0.78; z += 0.08) { const pts = []; for (let k = 0; k <= 6; k++) pts.push(T.P(x + 0.02 + k * 0.063, 0.481, z + (k % 2) * 0.04)); ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.strokeStyle = c; ctx.lineWidth = 1.4; ctx.stroke(); } });
        fringe(T, [0.02, 1.001, 0.12], [2.38, 1.001, 0.12], 30, 0.08, BO.macrame);
        [[0.09, 0.0], [2.31, 0.0]].forEach(([x]) => { for (let y = 0.05; y < 1.0; y += 0.08) T.line([x, y, 0.4], [x, y, 0.66], 'rgba(90,60,20,.22)', 1); });
      }, { onTop: true })]; },
    // Space Age: a white pod on a chrome ring, round arms and orange cushions.
    space: (o, s1, s2) => { const v = cl(o), vc = shade(v, 0.05); return [
      B(0.3, 0.2, 0, 1.8, 0.6, 0.1, SA.chromeDark), B(0, 0, 0.1, 2.4, 1.0, 0.28, v, { name: 'base' }), B(0, 0, 0.38, 2.4, 0.3, 0.52, v), B(0, 0, 0.38, 0.24, 1.0, 0.36, v), B(2.16, 0, 0.38, 0.24, 1.0, 0.36, v),
      B(0.24, 0.3, 0.38 - s1 * 0.018, 0.96, 0.66, 0.1 - s1 * 0.035, SA.orange), B(1.2, 0.3, 0.38 - s2 * 0.018, 0.96, 0.66, 0.1 - s2 * 0.035, SA.orange),
      F(0, 0, 2.4, 1.0, (T) => {
        [[0.12, 0.5], [2.28, 0.5]].forEach(([x, y]) => { const [ax, ay] = T.P(x, y, 0.74); ell(ax, ay, 7, 4, vc, 'rgba(0,0,0,.08)'); });
        T.line([0.02, 1.001, 0.1], [2.38, 1.001, 0.1], SA.chrome, 2.2); T.line([0.3, 1.002, 0.1], [2.1, 1.002, 0.1], 'rgba(255,255,255,.6)', 0.8);
        T.line([0.24, 0.301, 0.9], [2.16, 0.301, 0.9], SA.neon, 1.2);
      }, { onTop: true })]; },
  });
  Object.assign(LOOK_DRAWERS.dining, {
    // Art Deco: an ivory marble top on a gold pedestal, fan-back velvet chairs and a tiered gold pendant.
    deco: (o) => { const ps = [], velvet = cl(o);
      const chair = (y0, back) => { ps.push(B(0.6, y0 + 0.24, 0, 0.1, 0.1, 0.42, DE.gold), B(0.5, y0 + 0.14, 0, 0.3, 0.3, 0.03, DE.gold));
        ps.push(B(0.35, y0, 0.42, 0.6, 0.58, 0.07, velvet, { name: y0 === 0 ? 'seat1' : 'seat2' }));
        ps.push(F(0.35, back - 0.02, 0.95, back + 0.08, (T) => { const [cx, cy] = T.P(0.65, back + 0.03, 0.5); ctx.beginPath(); ctx.ellipse(cx, cy, 11, 13, 0, Math.PI, 0); ctx.fillStyle = velvet; ctx.fill(); sunburst(cx, cy, 12, 7, shade(velvet, -0.3), 1); ctx.beginPath(); ctx.ellipse(cx, cy, 11, 13, 0, Math.PI, 0); ctx.strokeStyle = DE.gold; ctx.lineWidth = 1; ctx.stroke(); }, { onTop: true })); };
      chair(0, 0); chair(1.89, 2.42);
      ps.push(B(0.45, 1.04, 0, 0.4, 0.4, 0.06, DE.gold), B(0.55, 1.14, 0.06, 0.2, 0.2, 0.64, DE.lacquer), B(0.5, 1.09, 0.5, 0.3, 0.3, 0.2, DE.gold));
      ps.push(B(0, 0.74, 0.7, 1.3, 1.0, 0.07, DE.ivory, { name: 'top' }));
      ps.push(F(0, 0.74, 1.3, 1.74, (T) => { T.line([0, 0.74, 0.7], [1.3, 0.74, 0.7], DE.gold, 1.4); T.line([0, 1.74, 0.7], [1.3, 1.74, 0.7], DE.gold, 1.4); T.line([0.08, 0.84, 0.772], [0.6, 1.3, 0.772], 'rgba(201,162,74,.4)', 1); T.line([0.7, 0.9, 0.772], [1.2, 1.6, 0.772], 'rgba(201,162,74,.3)', 1); }, { onTop: true }));
      ps.push(diningLife(), diningLight('tiered'));
      return ps; },
    // Japandi: a low dark table, slatted low-back chairs with a cushion, and a tall paper lantern.
    japandi: (o) => { const ps = [], w = cl(o);
      const chair = (y0, back) => { [[0.39, y0 + 0.04], [0.83, y0 + 0.04], [0.39, y0 + 0.48], [0.83, y0 + 0.48]].forEach(([x, y]) => ps.push(B(x, y, 0, 0.05, 0.05, 0.42, w)));
        ps.push(B(0.35, y0, 0.42, 0.6, 0.58, 0.07, w, { name: y0 === 0 ? 'seat1' : 'seat2' }), B(0.38, y0 + 0.08, 0.49, 0.54, 0.44, 0.05, JA.bone), B(0.35, back, 0.49, 0.6, 0.06, 0.4, w));
        ps.push(F(0.35, back - 0.02, 0.95, back + 0.08, (T) => { const yb = back + 0.065; for (let z = 0.56; z < 0.9; z += 0.07) T.line([0.37, yb, z], [0.93, yb, z], 'rgba(0,0,0,.35)', 1); }, { onTop: true })); };
      chair(0, 0); chair(1.89, 2.42);
      [[0.1, 0.84], [1.12, 0.84], [0.1, 1.56], [1.12, 1.56]].forEach(([x, y]) => ps.push(B(x, y, 0, 0.08, 0.08, 0.7, w)));
      ps.push(B(0, 0.74, 0.7, 1.3, 1.0, 0.07, w, { name: 'top' }));
      ps.push(F(0, 0.74, 1.3, 1.74, (T) => { T.poly([[0.35, 0.74, 0.772], [0.95, 0.74, 0.772], [0.95, 1.74, 0.772], [0.35, 1.74, 0.772]], JA.bone); const [bx, by] = T.P(0.95, 1.05, 0.775); ell(bx, by, 4, 2.2, JA.clay); ell(bx, by - 5, 3, 3.4, JA.moss); ell(bx + 2, by - 7, 2.2, 2, JA.moss); limb(bx, by - 1, bx + 1, by - 5, JA.walnut, 1); }, { onTop: true }));
      ps.push(diningLife(), diningLight('washi'));
      return ps; },
    // Boho: a live-edge table, peacock rattan chairs and a macrame pendant with a fringe.
    boho: (o) => { const ps = [], wood = cl(o);
      const chair = (y0, back) => { [[0.39, y0 + 0.04], [0.83, y0 + 0.04], [0.39, y0 + 0.48], [0.83, y0 + 0.48]].forEach(([x, y]) => ps.push(B(x, y, 0, 0.05, 0.05, 0.42, BO.rattanDark)));
        ps.push(B(0.35, y0, 0.42, 0.6, 0.58, 0.07, BO.rattan, { name: y0 === 0 ? 'seat1' : 'seat2' }));
        ps.push(F(0.35, back - 0.02, 0.95, back + 0.08, (T) => { const [cx, cy] = T.P(0.65, back + 0.03, 0.5); ctx.beginPath(); ctx.ellipse(cx, cy - 2, 13, 15, 0, Math.PI, 0); ctx.fillStyle = BO.rattan; ctx.fill(); sunburst(cx, cy - 2, 14, 10, BO.rattanDark, 1); ctx.beginPath(); ctx.ellipse(cx, cy - 2, 13, 15, 0, Math.PI, 0); ctx.strokeStyle = BO.rattanDark; ctx.lineWidth = 1.4; ctx.stroke(); }, { onTop: true })); };
      chair(0, 0); chair(1.89, 2.42);
      [[0.1, 0.82], [1.12, 0.82], [0.1, 1.6], [1.12, 1.6]].forEach(([x, y]) => ps.push(B(x, y, 0, 0.08, 0.08, 0.7, BO.rattanDark)));
      ps.push(B(0, 0.74, 0.7, 1.3, 1.0, 0.07, wood, { name: 'top' }));
      ps.push(F(0, 0.74, 1.3, 1.74, (T) => { const pts = []; for (let x = 0; x <= 1.3; x += 0.1) pts.push(T.P(x, 1.74 - Math.abs(Math.sin(x * 7)) * 0.05, 0.772)); ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.strokeStyle = shade(wood, -0.3); ctx.lineWidth = 1.6; ctx.stroke(); for (let y = 0.9; y < 1.7; y += 0.2) T.line([0.05, y, 0.772], [1.25, y + 0.03, 0.772], 'rgba(0,0,0,.14)', 1); }, { onTop: true }));
      ps.push(diningLife(), diningLight('macrame'));
      return ps; },
    // Space Age: a white tulip table on a pedestal, tulip chairs with shell backs, and a saucer light.
    space: (o) => { const ps = [], shell = cl(o);
      const chair = (y0, back) => { ps.push(B(0.55, y0 + 0.19, 0, 0.2, 0.2, 0.04, SA.chrome), B(0.62, y0 + 0.26, 0.04, 0.06, 0.06, 0.38, SA.chrome));
        ps.push(B(0.35, y0, 0.42, 0.6, 0.58, 0.07, shell, { name: y0 === 0 ? 'seat1' : 'seat2' }));
        ps.push(F(0.35, back - 0.02, 0.95, back + 0.08, (T) => { const [cx, cy] = T.P(0.65, back + 0.03, 0.49); ctx.beginPath(); ctx.ellipse(cx, cy, 11, 12, 0, Math.PI, 0); ctx.fillStyle = shell; ctx.fill(); ctx.beginPath(); ctx.ellipse(cx, cy, 11, 12, 0, Math.PI, 0); ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 1; ctx.stroke(); ell(cx, cy - 2, 7, 4, SA.orange); }, { onTop: true })); };
      chair(0, 0); chair(1.89, 2.42);
      ps.push(B(0.35, 0.94, 0, 0.6, 0.6, 0.05, SA.chrome), B(0.57, 1.16, 0.05, 0.16, 0.16, 0.65, SA.white));
      ps.push(B(0, 0.74, 0.7, 1.3, 1.0, 0.07, SA.white, { name: 'top' }));
      ps.push(F(0, 0.74, 1.3, 1.74, (T) => { const [cx, cy] = T.P(0.65, 1.24, 0.771); ell(cx, cy, 24, 12, null, 'rgba(0,0,0,.08)'); T.line([0, 0.74, 0.7], [1.3, 0.74, 0.7], 'rgba(0,0,0,.1)', 1.4); }, { onTop: true }));
      ps.push(diningLife(), diningLight('saucer'));
      return ps; },
  });
  Object.assign(LOOK_DRAWERS.lamp, {
    // Art Deco: a black stem on a stepped gold base, a fan of gold rays round an alabaster bowl.
    deco: (T, o) => { const lit = isLit(o.id), g = cl(o);
      T.box(0.04, 0.04, 0, 0.32, 0.32, 0.04, g); T.box(0.1, 0.1, 0.04, 0.2, 0.2, 0.04, g); T.line([0.2, 0.2, 0.08], [0.2, 0.2, 1.4], DE.lacquer, 2.6);
      const [px, py] = T.P(0.2, 0.2, 1.52); if (lit) ell(px, py, 14, 14, 'rgba(255,226,168,.2)');
      sunburst(px, py + 2, 13, 8, g, 1.4); ell(px, py, 8, 4, lit ? '#FFF1D2' : DE.alabaster, 'rgba(0,0,0,.12)'); ell(px, py + 1.5, 8, 2.4, shade(DE.alabaster, -0.08)); circle(px, py + 7, 2, g); },
    // Japandi: a tall paper column with ribs on a dark base; the whole column glows.
    japandi: (T, o) => { const lit = isLit(o.id), paper = cl(o);
      T.box(0.08, 0.08, 0, 0.24, 0.24, 0.04, JA.ink);
      if (lit) { const [gx, gy] = T.P(0.2, 0.2, 0.9); ell(gx, gy, 16, 30, 'rgba(255,226,168,.14)'); }
      T.box(0.06, 0.06, 0.04, 0.28, 0.28, 1.66, lit ? '#FFF3DA' : paper);
      for (let z = 0.14; z < 1.68; z += 0.1) { T.line([0.06, 0.341, z], [0.34, 0.341, z], 'rgba(90,70,40,.22)', 1); T.line([0.341, 0.06, z], [0.341, 0.34, z], 'rgba(90,70,40,.22)', 1); } },
    // Boho: a rattan tripod with a macrame shade and a fringe hanging from it.
    boho: (T, o) => { const lit = isLit(o.id), shadeCol = cl(o);
      [[0.05, 0.05], [0.35, 0.05], [0.2, 0.35]].forEach(([x, y]) => T.line([x, y, 0], [0.2, 0.2, 1.36], BO.rattanDark, 2.4));
      T.box(0.03, 0.03, 1.38, 0.34, 0.34, 0.3, lit ? '#FFE9B8' : shadeCol);
      for (let z = 1.42; z < 1.68; z += 0.08) { const pts = []; for (let x = 0.03; x <= 0.37; x += 0.04) pts.push(T.P(x, 0.371, z + ((Math.round(x * 100) % 8 < 4) ? 0.03 : 0))); ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.strokeStyle = 'rgba(120,90,50,.35)'; ctx.lineWidth = 1; ctx.stroke(); }
      fringe(T, [0.03, 0.372, 1.38], [0.37, 0.372, 1.38], 9, 0.12, BO.macrame); fringe(T, [0.372, 0.03, 1.38], [0.372, 0.37, 1.38], 9, 0.12, BO.macrame); },
    // Space Age: a chrome stem with a wide mushroom dome that glows underneath.
    space: (T, o) => { const lit = isLit(o.id), dome = cl(o);
      T.box(0.06, 0.06, 0, 0.28, 0.28, 0.05, SA.chrome); T.line([0.2, 0.2, 0.05], [0.2, 0.2, 1.46], SA.chrome, 2.6);
      const [px, py] = T.P(0.2, 0.2, 1.5); if (lit) ell(px, py + 6, 16, 8, 'rgba(255,226,168,.22)');
      ell(px, py + 2, 14, 5, lit ? '#FFF1C9' : shade(dome, -0.25)); ctx.beginPath(); ctx.ellipse(px, py + 2, 14, 12, 0, Math.PI, 0); ctx.fillStyle = dome; ctx.fill(); ell(px - 4, py - 5, 4, 2, 'rgba(255,255,255,.35)'); },
  });
  Object.assign(LOOK_DRAWERS.plant, {
    // Art Deco: a fluted gold planter on a black base.
    deco: (T, o) => { const g = cl(o); T.box(0.02, 0.02, 0, 0.46, 0.46, 0.05, DE.lacquer); T.box(0.06, 0.06, 0.05, 0.38, 0.38, 0.37, g); for (let x = 0.08; x < 0.44; x += 0.05) T.line([x, 0.441, 0.07], [x, 0.441, 0.4], 'rgba(0,0,0,.2)', 1); for (let y = 0.08; y < 0.44; y += 0.05) T.line([0.441, y, 0.07], [0.441, y, 0.4], 'rgba(0,0,0,.2)', 1); },
    // Japandi: a matte stoneware pot with a moss top.
    japandi: (T, o) => { const g = cl(o); T.box(0.05, 0.05, 0, 0.4, 0.4, 0.4, g); T.line([0.05, 0.451, 0.34], [0.45, 0.451, 0.34], 'rgba(255,255,255,.2)', 1.4); T.box(0.06, 0.06, 0.4, 0.38, 0.38, 0.03, JA.moss); },
    // Boho: a painted clay pot with stripes and dots on a jute coaster.
    boho: (T, o) => { const g = cl(o); T.box(0, 0, 0, 0.5, 0.5, 0.03, BO.jute); T.box(0.05, 0.05, 0.03, 0.4, 0.4, 0.39, g);
      [0.14, 0.3].forEach(z => { T.line([0.05, 0.451, z], [0.45, 0.451, z], BO.cream, 1.6); T.line([0.451, 0.05, z], [0.451, 0.45, z], BO.cream, 1.6); });
      for (let x = 0.1; x < 0.45; x += 0.08) { const [dx, dy] = T.P(x, 0.452, 0.22); circle(dx, dy, 1, BO.cream); } },
    // Space Age: a white egg of a pot on a chrome stand with a violet glow ring.
    space: (T, o) => { const g = cl(o); T.box(0.1, 0.1, 0, 0.3, 0.3, 0.03, SA.chrome); T.line([0.25, 0.25, 0.03], [0.25, 0.25, 0.12], SA.chrome, 2); T.box(0.06, 0.06, 0.12, 0.38, 0.38, 0.3, g); const [rx, ry] = T.P(0.25, 0.25, 0.13); ell(rx, ry, 8, 4, null, SA.violet, 1.4); ctx.beginPath(); ctx.ellipse(rx, ry, 8, 4, 0, 0, Math.PI * 2); ctx.strokeStyle = SA.violet; ctx.lineWidth = 1.6; ctx.stroke(); },
  });
  Object.assign(LOOK_DRAWERS.counter, {
    // Art Deco: black lacquer fronts with gold fluting, a mirrored top, a white basin with a gold tap, and a cocktail set at the end.
    deco: (T, o) => { const l = cl(o);
      T.box(0, 0, 0, 2.8, 0.8, 0.86, l); for (let x = 0.08; x < 2.8; x += 0.12) T.line([x, 0.801, 0.1], [x, 0.801, 0.78], DE.gold, 1);
      [0.7, 1.4, 2.1].forEach(x => T.line([x, 0.802, 0.04], [x, 0.802, 0.84], 'rgba(0,0,0,.6)', 1.6)); T.box(0, 0, 0, 2.8, 0.8, 0.05, DE.gold);
      T.box(-0.05, -0.04, 0.86, 2.9, 0.88, 0.07, DE.mirror); [[0.2, 0.7, 0.8, 0.1], [1.5, 0.75, 2.2, 0.05], [2.3, 0.6, 2.8, 0.2]].forEach(([x0, y0, x1, y1]) => T.line([x0, y0, 0.931], [x1, y1, 0.931], 'rgba(255,255,255,.7)', 1.2)); T.line([-0.05, 0.84, 0.86], [2.85, 0.84, 0.86], DE.gold, 1.6);
      T.poly([[0.3, 0.13, 0.932], [1.0, 0.13, 0.932], [1.0, 0.6, 0.932], [0.3, 0.6, 0.932]], '#FBFBF8', DE.gold, 1); T.poly([[0.38, 0.2, 0.933], [0.92, 0.2, 0.933], [0.92, 0.53, 0.933], [0.38, 0.53, 0.933]], '#EEF2F2');
      T.line([0.65, 0.04, 0.93], [0.65, 0.04, 1.18], DE.gold, 2.2); T.line([0.65, 0.04, 1.18], [0.65, 0.24, 1.12], DE.gold, 2.2);
      T.box(0.08, 0.1, 0.93, 0.12, 0.12, 0.3, DE.gold); T.box(0.06, 0.08, 1.23, 0.16, 0.16, 0.03, DE.gold); [0.26, 0.36].forEach((x, k) => { const [gx, gy] = T.P(x, 0.2 + k * 0.15, 1.0); ell(gx, gy, 2.6, 1.4, 'rgba(255,255,255,.7)'); limb(gx, gy, gx, gy + 4, 'rgba(255,255,255,.7)', 0.8); }); },
    // Japandi: dark walnut fronts with a slatted band, a black stone top, a square black basin and a bonsai at the end.
    japandi: (T, o) => { const w = cl(o);
      T.box(0, 0, 0, 2.8, 0.8, 0.86, w); for (let x = 0.04; x < 2.8; x += 0.06) T.line([x, 0.801, 0.3], [x, 0.801, 0.62], 'rgba(0,0,0,.35)', 1.2);
      [0.7, 1.4, 2.1].forEach(x => T.line([x, 0.802, 0.04], [x, 0.802, 0.84], 'rgba(0,0,0,.45)', 1.2));
      T.box(-0.05, -0.04, 0.86, 2.9, 0.88, 0.06, JA.ink); T.line([-0.05, 0.84, 0.86], [2.85, 0.84, 0.86], 'rgba(255,255,255,.12)', 1);
      T.poly([[0.3, 0.13, 0.921], [1.0, 0.13, 0.921], [1.0, 0.6, 0.921], [0.3, 0.6, 0.921]], '#3A3A40', 'rgba(255,255,255,.18)', 1); T.poly([[0.36, 0.19, 0.922], [0.94, 0.19, 0.922], [0.94, 0.54, 0.922], [0.36, 0.54, 0.922]], '#26262B');
      T.line([0.65, 0.04, 0.92], [0.65, 0.04, 1.26], JA.ink, 2.2); T.line([0.65, 0.04, 1.26], [0.65, 0.26, 1.22], JA.ink, 2.2);
      T.box(0.06, 0.1, 0.92, 0.22, 0.16, 0.06, JA.clay); const [bx, by] = T.P(0.17, 0.18, 0.98); limb(bx, by, bx + 2, by - 6, JA.walnut, 1.4); limb(bx + 2, by - 4, bx + 6, by - 6, JA.walnut, 1); ell(bx + 1, by - 8, 5, 2.4, JA.moss); ell(bx + 6, by - 7, 3, 1.6, JA.moss); },
    // Boho: woven rattan fronts, a cream tile top with blue motifs, a brass tap and pampas grass at the end.
    boho: (T, o) => { const r = cl(o);
      T.box(0, 0, 0, 2.8, 0.8, 0.86, r); for (let x = 0.06; x < 2.8; x += 0.1) T.line([x, 0.801, 0.06], [x, 0.801, 0.8], 'rgba(90,60,20,.22)', 1); for (let z = 0.12; z < 0.84; z += 0.1) T.line([0, 0.802, z], [2.8, 0.802, z], 'rgba(90,60,20,.2)', 1);
      [0.7, 1.4, 2.1].forEach(x => T.line([x, 0.803, 0.04], [x, 0.803, 0.84], 'rgba(60,40,20,.4)', 1.4));
      T.box(-0.05, -0.04, 0.86, 2.9, 0.88, 0.07, BO.cream); for (let x = 0.15; x < 2.8; x += 0.35) for (let y = 0.1; y < 0.8; y += 0.35) { const [dx, dy] = T.P(x, y, 0.931); ctx.beginPath(); ctx.moveTo(dx, dy - 3); ctx.lineTo(dx + 4, dy); ctx.lineTo(dx, dy + 3); ctx.lineTo(dx - 4, dy); ctx.closePath(); ctx.fillStyle = BO.teal; ctx.fill(); }
      T.poly([[0.3, 0.13, 0.932], [1.0, 0.13, 0.932], [1.0, 0.6, 0.932], [0.3, 0.6, 0.932]], '#FBFBF8', 'rgba(0,0,0,.2)', 1);
      T.line([0.65, 0.04, 0.93], [0.65, 0.04, 1.18], SC.brass, 2.2); T.line([0.65, 0.04, 1.18], [0.65, 0.24, 1.12], SC.brass, 2.2);
      T.box(0.08, 0.12, 0.93, 0.14, 0.14, 0.2, BO.terracotta); const [px, py] = T.P(0.15, 0.19, 1.13); [[-2, -0.3], [0, 0], [2, 0.3]].forEach(([dx, rot]) => { limb(px, py, px + dx * 2, py - 12, BO.jute, 1); ell(px + dx * 2.4, py - 14, 2.2, 5, BO.macrame, null, rot); }); },
    // Space Age: white fronts with chrome lines, a dark glass top with a neon edge, a round steel basin and console buttons.
    space: (T, o) => { const w = cl(o);
      T.box(0, 0, 0, 2.8, 0.8, 0.86, w); [0.3, 0.6].forEach(z => T.line([0, 0.801, z], [2.8, 0.801, z], SA.chrome, 1.6));
      [0.7, 1.4, 2.1].forEach(x => T.line([x, 0.802, 0.04], [x, 0.802, 0.84], 'rgba(0,0,0,.2)', 1.2));
      T.box(-0.05, -0.04, 0.86, 2.9, 0.88, 0.07, SA.glass); T.line([-0.05, 0.84, 0.93], [2.85, 0.84, 0.93], SA.neon, 1.6); T.line([-0.05, 0.84, 0.86], [2.85, 0.84, 0.86], SA.chrome, 1);
      const [sx, sy] = T.P(0.65, 0.37, 0.931); ell(sx, sy, 12, 6.5, SA.chromeDark, 'rgba(255,255,255,.3)'); ell(sx, sy + 0.8, 9, 4.6, '#6B7078');
      T.line([0.65, 0.04, 0.93], [0.65, 0.04, 1.2], SA.chrome, 2.4); T.line([0.65, 0.04, 1.2], [0.65, 0.26, 1.13], SA.chrome, 2.4);
      [[0.1, SA.neon], [0.18, SA.orange], [0.26, SA.violet], [0.34, SA.neon]].forEach(([x, c], k) => { const [bx, by] = T.P(x, 0.7, 0.935); circle(bx, by, 1.4, c); if (k % 2) circle(bx, by, 2.6, c.replace(')', ',.25)').replace('#', 'rgba(') === c ? 'rgba(255,255,255,.15)' : 'rgba(255,255,255,.15)'); }); },
  });
  Object.assign(LOOK_DRAWERS.fridge, {
    // Art Deco: black lacquer with a gold sunburst on the door, gold handles, a gold cap and base. Returns the open door's colour.
    deco: (T, o) => { const body = cl(o);
      T.box(0, 0, 0, 0.9, 0.85, 0.07, DE.gold); T.box(0, 0, 0.07, 0.9, 0.85, 1.8, body); T.box(0, 0, 1.87, 0.9, 0.85, 0.08, DE.gold);
      T.line([0, 0.85, 1.3], [0.9, 0.85, 1.3], DE.gold, 1.4);
      [[0.7, 1.15], [1.42, 1.78]].forEach(([z0, z1]) => T.line([0.78, 0.855, z0], [0.78, 0.855, z1], DE.gold, 3.2));
      const [bx, by] = T.P(0.4, 0.851, 0.42); sunburst(bx, by + 2, 12, 8, DE.gold, 1); ell(bx, by + 2, 12, 2, DE.gold);
      return body; },
    // Japandi: an ivory body with a walnut shoji grid on the door and a slim black handle. Returns the open door's colour.
    japandi: (T, o) => { const body = cl(o);
      T.box(0, 0, 0, 0.9, 0.85, 1.95, body); T.line([0, 0.85, 1.3], [0.9, 0.85, 1.3], 'rgba(0,0,0,.2)', 1.2);
      [0.22, 0.45, 0.68].forEach(x => T.line([x, 0.851, 0.1], [x, 0.851, 1.25], JA.walnut, 1.4)); [0.35, 0.65, 0.95].forEach(z => T.line([0.08, 0.851, z], [0.82, 0.851, z], JA.walnut, 1.4));
      [0.22, 0.45, 0.68].forEach(x => T.line([x, 0.851, 1.36], [x, 0.851, 1.88], JA.walnut, 1.4)); [1.6].forEach(z => T.line([0.08, 0.851, z], [0.82, 0.851, z], JA.walnut, 1.4));
      T.line([0.78, 0.855, 0.6], [0.78, 0.855, 1.25], JA.ink, 2.4); T.line([0.78, 0.855, 1.42], [0.78, 0.855, 1.8], JA.ink, 2.4);
      return body; },
    // Boho: terracotta enamel with a cream geometric band and rattan handles. Returns the open door's colour.
    boho: (T, o) => { const body = cl(o);
      T.box(0, 0, 0, 0.9, 0.85, 1.87, body); T.box(0, 0, 1.87, 0.9, 0.85, 0.08, BO.rattan);
      T.line([0, 0.85, 1.3], [0.9, 0.85, 1.3], 'rgba(0,0,0,.25)', 1.2);
      for (let x = 0.08; x < 0.78; x += 0.14) { const [ax, ay] = T.P(x, 0.851, 0.95), [bx, by] = T.P(x + 0.07, 0.851, 1.1), [cx, cy] = T.P(x + 0.14, 0.851, 0.95); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fillStyle = BO.cream; ctx.fill(); }
      T.line([0.06, 0.851, 0.88], [0.84, 0.851, 0.88], BO.cream, 1.4); T.line([0.06, 0.851, 1.16], [0.84, 0.851, 1.16], BO.cream, 1.4);
      [[0.7, 1.15], [1.42, 1.78]].forEach(([z0, z1]) => { T.line([0.78, 0.855, z0], [0.78, 0.855, z1], BO.rattanDark, 3.6); for (let z = z0; z < z1; z += 0.06) T.line([0.76, 0.856, z], [0.8, 0.856, z + 0.02], BO.rattan, 1); });
      return body; },
    // Space Age: a white pod with a chrome cap, a glowing porthole on the door and an orange handle. Returns the open door's colour.
    space: (T, o) => { const body = cl(o);
      T.box(0, 0, 0, 0.9, 0.85, 0.06, SA.chrome); T.box(0, 0, 0.06, 0.9, 0.85, 1.81, body); T.box(0, 0, 1.87, 0.9, 0.85, 0.08, SA.chrome);
      T.line([0, 0.85, 1.3], [0.9, 0.85, 1.3], SA.chrome, 1.4);
      [[0.7, 1.15], [1.42, 1.78]].forEach(([z0, z1]) => T.line([0.78, 0.855, z0], [0.78, 0.855, z1], SA.orange, 3.4));
      const [px, py] = T.P(0.4, 0.851, 0.7); circle(px, py, 8, SA.chrome); circle(px, py, 6.4, power ? SA.neon : '#3A3F4A'); if (power) circle(px, py, 9.5, 'rgba(91,227,230,.18)'); circle(px - 2, py - 2, 1.6, 'rgba(255,255,255,.6)');
      return body; },
  });
  // ---- Four more: Gothic Revival, Riad, Tropical and Memphis ----
  const GO = { ebony: '#2A2224', oxblood: '#5E1F2A', brass: '#B08D57', brassLight: '#D4B477', stone: '#8E8A84', candle: '#FFE0A0', nero: '#2C2B2F', panes: ['#8E2E3C', '#2E4C9A', '#C9A24A', '#3F6B4A'] };
  const RI = { plaster: '#F3EEE4', cobalt: '#2E4C9A', cobaltLight: '#4A6BC2', terracotta: '#C27A5A', cedar: '#8A5A3A', cedarDark: '#6B4530', brass: '#C9A24A', cream: '#F1EDE3', teal: '#3D6B73', copper: '#B5674A' };
  const TR = { bamboo: '#D9BE82', bambooDark: '#B9975A', rattan: '#D2B48C', leaf: '#2F6B40', leafLight: '#4F9460', pink: '#F08AA0', coral: '#F26A5E', brass: '#C9A24A', cream: '#F7F1E3', teak: '#8A5A3A' };
  const ME = { white: '#F4F1EA', black: '#1B1A1F', red: '#E63946', yellow: '#F4C430', blue: '#2E6BD6', mint: '#7FD1AE', pink: '#F7A1C4' };
  /** A pointed gothic arch in screen space: straight jambs, then two curves meeting at a point. */
  const arch = (cx, cy, rx, ry, fill, stroke, w = 1) => { ctx.beginPath(); ctx.moveTo(cx - rx, cy); ctx.lineTo(cx - rx, cy - ry * 0.35); ctx.quadraticCurveTo(cx - rx, cy - ry * 1.05, cx, cy - ry * 1.3); ctx.quadraticCurveTo(cx + rx, cy - ry * 1.05, cx + rx, cy - ry * 0.35); ctx.lineTo(cx + rx, cy); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = w; ctx.stroke(); } };
  /** A squiggle along a line in the piece's frame, wobbling in z: the Memphis signature. */
  const wiggle = (T, from, to, n, amp, col, w = 1.4) => { ctx.beginPath(); for (let k = 0; k <= n; k++) { const u = k / n, [sx, sy] = T.P(from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u, from[2] + (to[2] - from[2]) * u + Math.sin(u * n * 1.2) * amp); k ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); } ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.stroke(); };
  /** Bamboo: a pole with its nodes, from one point to another in the piece's frame. */
  const bambooPole = (T, a, b, w, col = TR.bamboo) => { T.line(a, b, col, w); for (let u = 0.2; u < 1; u += 0.27) { const x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u, z = a[2] + (b[2] - a[2]) * u; const [sx, sy] = T.P(x, y, z); ell(sx, sy, w * 0.6, 1, TR.bambooDark); } };
  /** A monstera leaf in screen space: a big oval with notches cut from its edge. */
  const monstera = (sx, sy, r, col, cut, rot = 0) => { ell(sx, sy, r * 0.7, r, col, null, rot); for (let k = -2; k <= 2; k++) { if (k === 0) continue; const a = rot + k * 0.55; ell(sx + Math.sin(a) * r * 0.78, sy - Math.cos(a) * r * 0.78, r * 0.12, r * 0.38, cut, null, a); } limb(sx - Math.sin(rot) * r * 0.9, sy + Math.cos(rot) * r * 0.9, sx + Math.sin(rot) * r * 0.4, sy - Math.cos(rot) * r * 0.4, shade(col, -0.25), 0.8); };
  Object.assign(LOOK_DRAWERS.sofa, {
    // Gothic Revival: oxblood velvet, button tufting, ebony plinth with ball feet, a carved crest and brass nailheads.
    gothic: (o, s1, s2) => { const v = cl(o), vc = shade(v, 0.08); return [
      ...[[0.06, 0.06], [2.26, 0.06], [0.06, 0.86], [2.26, 0.86]].map(([x, y]) => B(x, y, 0, 0.08, 0.08, 0.06, GO.ebony)),
      B(0, 0, 0.06, 2.4, 1.0, 0.06, GO.ebony), B(0, 0, 0.12, 2.4, 1.0, 0.26, v, { name: 'base' }), B(0, 0, 0.38, 2.4, 0.3, 0.56, v), B(0.7, 0, 0.94, 1.0, 0.3, 0.08, GO.ebony), B(1.0, 0, 1.02, 0.4, 0.3, 0.05, GO.ebony),
      B(0, 0, 0.38, 0.22, 1.0, 0.34, v), B(2.18, 0, 0.38, 0.22, 1.0, 0.34, v), B(0, 0, 0.72, 0.22, 1.0, 0.05, GO.ebony), B(2.18, 0, 0.72, 0.22, 1.0, 0.05, GO.ebony),
      B(0.22, 0.3, 0.38 - s1 * 0.018, 0.98, 0.66, 0.1 - s1 * 0.035, vc), B(1.2, 0.3, 0.38 - s2 * 0.018, 0.98, 0.66, 0.1 - s2 * 0.035, vc),
      F(0, 0, 2.4, 1.0, (T) => {
        for (let z = 0.5, r = 0; z < 0.92; z += 0.16, r++) for (let x = 0.36 + (r % 2) * 0.12; x < 2.1; x += 0.24) { const [bx, by] = T.P(x, 0.301, z); limb(bx - 5, by - 3, bx + 5, by + 3, 'rgba(0,0,0,.28)', 1); limb(bx - 5, by + 3, bx + 5, by - 3, 'rgba(0,0,0,.28)', 1); circle(bx, by, 1.4, GO.brass); }
        for (let x = 0.06; x < 2.4; x += 0.1) { const [nx, ny] = T.P(x, 1.001, 0.14); circle(nx, ny, 1, GO.brass); }
        [[0.11, 0.56], [2.29, 0.56]].forEach(([x, z]) => { for (let y = 0.1; y < 1.0; y += 0.1) { const [nx, ny] = T.P(x, y, z); circle(nx, ny, 1, GO.brass); } });
        T.line([0.7, 0.001, 0.98], [1.7, 0.001, 0.98], GO.brassLight, 1);
      }, { onTop: true })]; },
    // Riad: a low carved cedar banquette with cream cushions, a cobalt back and terracotta bolsters at each end.
    riad: (o, s1, s2) => { const c = cl(o), cc = shade(c, 0.04); return [
      B(0, 0, 0, 2.4, 1.0, 0.14, RI.cedar), B(0.04, 0.04, 0.14, 2.32, 0.92, 0.24, c, { name: 'base' }), B(0.04, 0.04, 0.38, 2.32, 0.26, 0.5, RI.cobalt),
      B(0.26, 0.3, 0.38 - s1 * 0.018, 0.94, 0.66, 0.1 - s1 * 0.035, cc), B(1.2, 0.3, 0.38 - s2 * 0.018, 0.94, 0.66, 0.1 - s2 * 0.035, cc),
      B(0.04, 0.3, 0.38, 0.22, 0.66, 0.22, RI.terracotta), B(2.14, 0.3, 0.38, 0.22, 0.66, 0.22, RI.terracotta),
      F(0, 0, 2.4, 1.0, (T) => {
        for (let x = 0.2; x < 2.3; x += 0.4) { const [ax, ay] = T.P(x, 1.001, 0.02); arch(ax, ay, 5, 7, RI.cedarDark, null); }
        for (let z = 0.5; z < 0.86; z += 0.12) T.line([0.08, 0.301, z], [2.32, 0.301, z], 'rgba(241,237,227,.5)', 1.2);
        for (let z = 0.56; z < 0.86; z += 0.12) for (let x = 0.2; x < 2.3; x += 0.24) { const [dx, dy] = T.P(x, 0.302, z); ctx.beginPath(); ctx.moveTo(dx, dy - 2.4); ctx.lineTo(dx + 2.4, dy); ctx.lineTo(dx, dy + 2.4); ctx.lineTo(dx - 2.4, dy); ctx.closePath(); ctx.fillStyle = RI.brass; ctx.fill(); }
        [[0.15, 0.96], [2.25, 0.96]].forEach(([x, y]) => { for (let z = 0.42; z < 0.6; z += 0.05) T.line([x - 0.1, y + 0.001, z], [x + 0.1, y + 0.001, z], 'rgba(241,237,227,.45)', 1); });
      }, { onTop: true })]; },
    // Tropical: a bamboo frame with rattan arms, cream cushions, palm-green seat cushions and pink piping.
    tropical: (o, s1, s2) => { const c = cl(o); return [
      ...[[0.06, 0.06], [2.26, 0.06], [0.06, 0.86], [2.26, 0.86]].map(([x, y]) => B(x, y, 0, 0.08, 0.08, 0.14, TR.bambooDark)),
      B(0, 0, 0.14, 2.4, 1.0, 0.24, c, { name: 'base' }), B(0, 0, 0.38, 2.4, 0.3, 0.54, c), B(0, 0, 0.38, 0.2, 1.0, 0.3, TR.rattan), B(2.2, 0, 0.38, 0.2, 1.0, 0.3, TR.rattan),
      B(0.2, 0.3, 0.38 - s1 * 0.018, 1.0, 0.66, 0.1 - s1 * 0.035, TR.leaf), B(1.2, 0.3, 0.38 - s2 * 0.018, 1.0, 0.66, 0.1 - s2 * 0.035, TR.leaf),
      B(0.3, 0.34, 0.48, 0.4, 0.14, 0.3, TR.pink), B(1.7, 0.34, 0.48, 0.4, 0.14, 0.3, TR.coral),
      F(0, 0, 2.4, 1.0, (T) => {
        bambooPole(T, [0.0, 1.0, 0.14], [2.4, 1.0, 0.14], 3); bambooPole(T, [0.0, 1.0, 0.38], [2.4, 1.0, 0.38], 2.4);
        [[0.5, 0.1], [1.2, 0.25], [1.9, 0.1]].forEach(([x, k]) => { const [lx, ly] = T.P(x, 0.301, 0.72); monstera(lx, ly, 7, TR.leafLight, c, k); });
        T.line([0.2, 0.301, 0.92], [2.2, 0.301, 0.92], TR.pink, 1.4);
        [[0.1, 0.0], [2.3, 0.0]].forEach(([x]) => { for (let y = 0.05; y < 1.0; y += 0.08) T.line([x, y, 0.4], [x, y, 0.66], 'rgba(90,60,20,.22)', 1); });
      }, { onTop: true })]; },
    // Memphis: a white block on a black plinth, one red drum arm, one yellow block arm, blue cushions and a black squiggle.
    memphis: (o, s1, s2) => { const w = cl(o); return [
      B(0, 0, 0, 2.4, 1.0, 0.1, ME.black), B(0, 0, 0.1, 2.4, 1.0, 0.28, w, { name: 'base' }), B(0, 0, 0.38, 2.4, 0.3, 0.5, w),
      B(0, 0, 0.38, 0.26, 1.0, 0.46, ME.red), B(2.14, 0, 0.38, 0.26, 1.0, 0.3, ME.yellow),
      B(0.26, 0.3, 0.38 - s1 * 0.018, 0.94, 0.66, 0.1 - s1 * 0.035, ME.blue), B(1.2, 0.3, 0.38 - s2 * 0.018, 0.94, 0.66, 0.1 - s2 * 0.035, ME.mint),
      F(0, 0, 2.4, 1.0, (T) => {
        wiggle(T, [0.4, 0.301, 0.7], [2.0, 0.301, 0.7], 24, 0.05, ME.black, 1.6);
        [[0.5, 0.5], [0.9, 0.56], [1.3, 0.5], [1.7, 0.56]].forEach(([x, z]) => { const [dx, dy] = T.P(x, 0.302, z); circle(dx, dy, 1.6, ME.black); });
        T.line([0.0, 1.001, 0.84], [0.26, 1.001, 0.84], ME.black, 1.2); T.line([2.14, 1.001, 0.5], [2.4, 1.001, 0.68], ME.black, 1.2);
      }, { onTop: true })]; },
  });
  Object.assign(LOOK_DRAWERS.dining, {
    // Gothic Revival: an ebony pedestal table with a brass inlay, pointed-arch velvet chairs and a candle chandelier.
    gothic: (o) => { const ps = [], w = cl(o);
      const chair = (y0, back) => { [[0.39, y0 + 0.04], [0.83, y0 + 0.04], [0.39, y0 + 0.48], [0.83, y0 + 0.48]].forEach(([x, y]) => ps.push(B(x, y, 0, 0.06, 0.06, 0.42, w)));
        ps.push(B(0.35, y0, 0.42, 0.6, 0.58, 0.07, GO.oxblood, { name: y0 === 0 ? 'seat1' : 'seat2' }));
        ps.push(F(0.35, back - 0.02, 0.95, back + 0.08, (T) => { const [cx, cy] = T.P(0.65, back + 0.03, 0.49); arch(cx, cy, 11, 13, w, null); arch(cx, cy - 1, 7, 9, GO.oxblood, null); circle(cx, cy - 7, 1.4, GO.brass); }, { onTop: true })); };
      chair(0, 0); chair(1.89, 2.42);
      ps.push(B(0.4, 0.99, 0, 0.5, 0.5, 0.05, w), B(0.55, 1.14, 0.05, 0.2, 0.2, 0.26, w), B(0.5, 1.09, 0.31, 0.3, 0.3, 0.1, w), B(0.55, 1.14, 0.41, 0.2, 0.2, 0.29, w));
      ps.push(B(0, 0.74, 0.7, 1.3, 1.0, 0.07, w, { name: 'top' }));
      ps.push(F(0, 0.74, 1.3, 1.74, (T) => { T.poly([[0.12, 0.86, 0.772], [1.18, 0.86, 0.772], [1.18, 1.62, 0.772], [0.12, 1.62, 0.772]], null, GO.brass, 1); T.poly([[0.2, 0.94, 0.772], [1.1, 0.94, 0.772], [1.1, 1.54, 0.772], [0.2, 1.54, 0.772]], null, 'rgba(176,141,87,.5)', 0.8); T.line([0, 0.74, 0.7], [1.3, 0.74, 0.7], GO.brass, 1); }, { onTop: true }));
      ps.push(diningLife(), diningLight('chandelier'));
      return ps; },
    // Riad: a carved cedar table with a cobalt-and-cream star inlay, leather poufs to sit on and a pierced brass lantern.
    riad: (o) => { const ps = [], w = cl(o);
      const pouf = (y0) => { ps.push(B(0.37, y0 + 0.02, 0, 0.56, 0.54, 0.36, RI.terracotta), B(0.35, y0, 0.36, 0.6, 0.58, 0.07, RI.terracotta, { name: y0 === 0 ? 'seat1' : 'seat2' }));
        ps.push(F(0.35, y0, 0.95, y0 + 0.58, (T) => { const [cx, cy] = T.P(0.65, y0 + 0.29, 0.432); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; limb(cx, cy, cx + Math.cos(a) * 11, cy + Math.sin(a) * 6, 'rgba(0,0,0,.25)', 1); } circle(cx, cy, 2, RI.cream); for (let z = 0.08; z < 0.36; z += 0.09) T.line([0.37, y0 + 0.561, z], [0.93, y0 + 0.561, z], 'rgba(0,0,0,.14)', 1); }, { onTop: true })); };
      pouf(0); pouf(1.89);
      [[0.1, 0.84], [1.12, 0.84], [0.1, 1.56], [1.12, 1.56]].forEach(([x, y]) => ps.push(B(x, y, 0, 0.08, 0.08, 0.7, w)));
      ps.push(B(0, 0.74, 0.7, 1.3, 1.0, 0.07, w, { name: 'top' }));
      ps.push(F(0, 0.74, 1.3, 1.74, (T) => { for (let x = 0.12; x < 1.3; x += 0.25) for (let y = 0.86; y < 1.74; y += 0.25) { const [dx, dy] = T.P(x, y, 0.772); ctx.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, r = k % 2 ? 2.2 : 5; ctx.lineTo(dx + Math.cos(a) * r, dy + Math.sin(a) * r * 0.6); } ctx.closePath(); ctx.fillStyle = ((Math.round(x * 4) + Math.round(y * 4)) % 2) ? RI.cobalt : RI.cream; ctx.fill(); } for (let x = 0.08; x < 1.3; x += 0.12) { const [ax, ay] = T.P(x, 1.741, 0.72); arch(ax, ay, 3, 4, RI.cedarDark, null); } }, { onTop: true }));
      ps.push(diningLife(), diningLight('moroccan'));
      return ps; },
    // Tropical: a teak top on bamboo legs, bamboo chairs with fan backs of leaves and pink cushions, under a woven cone.
    tropical: (o) => { const ps = [], w = cl(o);
      const chair = (y0, back) => { ps.push(B(0.35, y0, 0.42, 0.6, 0.58, 0.07, TR.pink, { name: y0 === 0 ? 'seat1' : 'seat2' }));
        ps.push(F(0.35, back - 0.02, 0.95, back + 0.1, (T) => { [[0.39, y0 + 0.04], [0.83, y0 + 0.04], [0.39, y0 + 0.48], [0.83, y0 + 0.48]].forEach(([x, y]) => bambooPole(T, [x, y, 0], [x, y, 0.42], 2.6)); const [cx, cy] = T.P(0.65, back + 0.03, 0.5); for (let k = 0; k < 5; k++) { const a = -2.6 + k * 0.55; ell(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8, 2.6, 8, k % 2 ? TR.leaf : TR.leafLight, null, a + 1.57); } bambooPole(T, [0.38, back + 0.03, 0.42], [0.92, back + 0.03, 0.42], 2.4); }, { onTop: true })); };
      chair(0, 0); chair(1.89, 2.42);
      ps.push(F(0, 0.74, 1.3, 1.74, (T) => { [[0.12, 0.86], [1.18, 0.86], [0.12, 1.62], [1.18, 1.62]].forEach(([x, y]) => bambooPole(T, [x, y, 0], [x, y, 0.7], 4)); }));
      ps.push(B(0, 0.74, 0.7, 1.3, 1.0, 0.07, w, { name: 'top' }));
      ps.push(F(0, 0.74, 1.3, 1.74, (T) => { for (let y = 0.84; y < 1.74; y += 0.12) T.line([0.04, y, 0.772], [1.26, y + 0.02, 0.772], 'rgba(0,0,0,.14)', 1); bambooPole(T, [0, 0.74, 0.74], [1.3, 0.74, 0.74], 2.6); bambooPole(T, [1.3, 0.74, 0.74], [1.3, 1.74, 0.74], 2.6); }, { onTop: true }));
      ps.push(diningLife(), diningLight('bamboo'));
      return ps; },
    // Memphis: a white top on three coloured legs, chairs with a yellow seat, a red drum leg and a black half-moon back, and a sputnik light.
    memphis: (o) => { const ps = [], w = cl(o);
      const chair = (y0, back) => { ps.push(B(0.52, y0 + 0.16, 0, 0.26, 0.26, 0.42, ME.red));
        ps.push(B(0.35, y0, 0.42, 0.6, 0.58, 0.07, ME.yellow, { name: y0 === 0 ? 'seat1' : 'seat2' }));
        ps.push(F(0.35, back - 0.02, 0.95, back + 0.08, (T) => { const [cx, cy] = T.P(0.65, back + 0.03, 0.49); ctx.beginPath(); ctx.ellipse(cx, cy, 11, 12, 0, Math.PI, 0); ctx.fillStyle = ME.black; ctx.fill(); ctx.beginPath(); for (let k = 0; k <= 10; k++) { const x = cx - 7 + k * 1.4, y = cy - 5 + (k % 2 ? 1.6 : -1.6); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.strokeStyle = ME.white; ctx.lineWidth = 1.2; ctx.stroke(); }, { onTop: true })); };
      chair(0, 0); chair(1.89, 2.42);
      ps.push(B(0.18, 0.86, 0, 0.16, 0.16, 0.7, ME.blue), B(0.98, 0.9, 0, 0.14, 0.14, 0.7, ME.black), B(0.5, 1.5, 0, 0.3, 0.2, 0.7, ME.red));
      ps.push(B(0, 0.74, 0.7, 1.3, 1.0, 0.07, w, { name: 'top' }));
      ps.push(F(0, 0.74, 1.3, 1.74, (T) => { wiggle(T, [0.1, 1.66, 0.772], [1.2, 1.66, 0.772], 16, 0.0, ME.black, 1.4); [[0.12, 1.5, ME.yellow], [1.18, 0.9, ME.blue], [0.2, 0.92, ME.red]].forEach(([x, y, c]) => { const [dx, dy] = T.P(x, y, 0.772); circle(dx, dy, 2.2, c); }); for (let k = 0; k < 6; k++) { const [dx, dy] = T.P(0.3 + k * 0.14, 1.62, 0.772); circle(dx, dy, 0.9, ME.black); } }, { onTop: true }));
      ps.push(diningLife(), diningLight('sputnik'));
      return ps; },
  });
  Object.assign(LOOK_DRAWERS.lamp, {
    // Gothic Revival: a brass candelabra on an ebony base, three candles that light as flames.
    gothic: (T, o) => { const lit = isLit(o.id), g = cl(o);
      T.box(0.06, 0.06, 0, 0.28, 0.28, 0.05, GO.ebony); T.box(0.12, 0.12, 0.05, 0.16, 0.16, 0.05, g); T.line([0.2, 0.2, 0.1], [0.2, 0.2, 1.3], g, 2.4);
      [[0.2, 0.2, 0.5], [0.2, 0.2, 0.9]].forEach(([x, y, z]) => { const [kx, ky] = T.P(x, y, z); ell(kx, ky, 3.2, 1.6, g); });
      const [px, py] = T.P(0.2, 0.2, 1.3);
      [[-10, 2], [0, -4], [10, 2]].forEach(([dx, dy]) => { limb(px, py, px + dx, py + dy - 4, g, 1.6); ell(px + dx, py + dy - 4, 3, 1.4, g); ell(px + dx, py + dy - 11, 1.8, 7, '#F6EFE0'); circle(px + dx, py + dy - 19, 1.8, lit ? GO.candle : GO.stone); if (lit) circle(px + dx, py + dy - 19, 5, 'rgba(255,224,160,.28)'); });
      if (lit) ell(px, py - 6, 18, 16, 'rgba(255,214,150,.12)'); },
    // Riad: a pierced brass lantern on a cedar stand; the cutouts glow.
    riad: (T, o) => { const lit = isLit(o.id), g = cl(o);
      T.box(0.06, 0.06, 0, 0.28, 0.28, 0.05, RI.cedar); T.line([0.2, 0.2, 0.05], [0.2, 0.2, 1.1], RI.cedar, 2.8);
      T.box(0.08, 0.08, 1.1, 0.24, 0.24, 0.04, g); T.box(0.06, 0.06, 1.14, 0.28, 0.28, 0.36, g);
      for (let z = 1.19; z < 1.48; z += 0.07) for (let u = 0.09; u < 0.33; u += 0.06) { const [ax, ay] = T.P(u, 0.341, z), [bx, by] = T.P(0.341, u, z); circle(ax, ay, 1, lit ? '#FFE9B8' : RI.cedarDark); circle(bx, by, 1, lit ? '#FFE9B8' : RI.cedarDark); }
      const [tx, ty] = T.P(0.2, 0.2, 1.5); ctx.beginPath(); ctx.moveTo(tx - 9, ty); ctx.lineTo(tx + 9, ty); ctx.lineTo(tx, ty - 12); ctx.closePath(); ctx.fillStyle = g; ctx.fill(); circle(tx, ty - 13, 1.8, g);
      if (lit) ell(tx, ty + 10, 18, 16, 'rgba(255,214,150,.18)'); },
    // Tropical: a bamboo pole with a woven cone shade and a pink tassel.
    tropical: (T, o) => { const lit = isLit(o.id), g = cl(o);
      T.box(0.1, 0.1, 0, 0.2, 0.2, 0.04, TR.teak); bambooPole(T, [0.2, 0.2, 0.04], [0.2, 0.2, 1.42], 3.4);
      const [px, py] = T.P(0.2, 0.2, 1.42); ctx.beginPath(); ctx.moveTo(px - 15, py + 2); ctx.lineTo(px + 15, py + 2); ctx.lineTo(px, py - 16); ctx.closePath(); ctx.fillStyle = lit ? '#FFE9B8' : g; ctx.fill();
      for (let k = 1; k < 6; k++) { const yy = py + 2 - k * 3, hw = 15 * (1 - k / 6); limb(px - hw, yy, px + hw, yy, 'rgba(90,60,30,.35)', 1); }
      ell(px, py + 2, 15, 5, lit ? '#FFF1C9' : shade(g, -0.15)); limb(px, py + 6, px, py + 12, TR.pink, 1); circle(px, py + 13, 2, TR.pink);
      if (lit) ell(px, py + 8, 18, 8, 'rgba(255,226,168,.2)'); },
    // Memphis: a red cone base, a yellow stem, a blue ball and a black-and-white striped drum shade.
    memphis: (T, o) => { const lit = isLit(o.id), g = cl(o);
      T.box(0.06, 0.06, 0, 0.28, 0.28, 0.04, ME.red); T.box(0.1, 0.1, 0.04, 0.2, 0.2, 0.08, ME.red); T.box(0.14, 0.14, 0.12, 0.12, 0.12, 0.08, ME.red);
      T.line([0.2, 0.2, 0.2], [0.2, 0.2, 1.3], g, 2.6); const [bx, by] = T.P(0.2, 0.2, 0.8); circle(bx, by, 4, ME.blue);
      T.box(0.04, 0.04, 1.3, 0.32, 0.32, 0.34, lit ? '#FFF3DA' : ME.white);
      for (let z = 1.34; z < 1.64; z += 0.08) { T.line([0.04, 0.361, z], [0.36, 0.361, z], ME.black, 1.8); T.line([0.361, 0.04, z], [0.361, 0.36, z], ME.black, 1.8); }
      if (lit) { const [gx, gy] = T.P(0.2, 0.2, 1.3); ell(gx, gy + 4, 14, 7, 'rgba(255,226,168,.22)'); } },
  });
  Object.assign(LOOK_DRAWERS.plant, {
    // Gothic Revival: a black urn with a brass rim and a brass ring on the front, on a stone plinth.
    gothic: (T, o) => { const g = cl(o); T.box(0.04, 0.04, 0, 0.42, 0.42, 0.06, GO.stone); T.box(0.1, 0.1, 0.06, 0.3, 0.3, 0.1, g); T.box(0.05, 0.05, 0.16, 0.4, 0.4, 0.26, g); T.line([0.05, 0.451, 0.4], [0.45, 0.451, 0.4], GO.brass, 1.6); T.line([0.451, 0.05, 0.4], [0.451, 0.45, 0.4], GO.brass, 1.6); const [rx, ry] = T.P(0.25, 0.452, 0.28); ell(rx, ry, 3.5, 3.5, null, GO.brass); ctx.beginPath(); ctx.arc(rx, ry, 3.5, 0, Math.PI * 2); ctx.strokeStyle = GO.brass; ctx.lineWidth = 1.4; ctx.stroke(); },
    // Riad: a terracotta pot with a cobalt band and cream diamonds.
    riad: (T, o) => { const g = cl(o); T.box(0.05, 0.05, 0, 0.4, 0.4, 0.42, g); T.box(0.04, 0.04, 0.26, 0.42, 0.42, 0.1, RI.cobalt); for (let x = 0.1; x < 0.45; x += 0.08) { const [dx, dy] = T.P(x, 0.461, 0.31); ctx.beginPath(); ctx.moveTo(dx, dy - 2.4); ctx.lineTo(dx + 2, dy); ctx.lineTo(dx, dy + 2.4); ctx.lineTo(dx - 2, dy); ctx.closePath(); ctx.fillStyle = RI.cream; ctx.fill(); } T.line([0.05, 0.451, 0.4], [0.45, 0.451, 0.4], 'rgba(255,255,255,.25)', 1.2); },
    // Tropical: a teak box planter with bamboo slats and brass corner caps.
    tropical: (T, o) => { const g = cl(o); T.box(0.05, 0.05, 0, 0.4, 0.4, 0.42, g); for (let x = 0.08; x < 0.45; x += 0.06) bambooPole(T, [x, 0.451, 0.02], [x, 0.451, 0.4], 2); for (let y = 0.08; y < 0.45; y += 0.06) bambooPole(T, [0.451, y, 0.02], [0.451, y, 0.4], 2); [[0.05, 0.45], [0.45, 0.45], [0.45, 0.05]].forEach(([x, y]) => { const [cx, cy] = T.P(x, y, 0.42); circle(cx, cy, 1.6, TR.brass); }); },
    // Memphis: a yellow block on a black cube, with a red triangle and blue dots.
    memphis: (T, o) => { const g = cl(o); T.box(0.1, 0.1, 0, 0.3, 0.3, 0.12, ME.black); T.box(0.04, 0.04, 0.12, 0.42, 0.42, 0.3, g); const [tx, ty] = T.P(0.25, 0.461, 0.2); ctx.beginPath(); ctx.moveTo(tx - 4, ty + 3); ctx.lineTo(tx + 4, ty + 3); ctx.lineTo(tx, ty - 4); ctx.closePath(); ctx.fillStyle = ME.red; ctx.fill(); for (let y = 0.1; y < 0.45; y += 0.1) { const [dx, dy] = T.P(0.461, y, 0.3); circle(dx, dy, 1.3, ME.blue); } },
  });
  Object.assign(LOOK_DRAWERS.counter, {
    // Gothic Revival: ebony fronts with pointed-arch panels in brass, a brass rail, a black marble top, a black basin and a candlestick at the end.
    gothic: (T, o) => { const e = cl(o);
      T.box(0, 0, 0, 2.8, 0.8, 0.86, e); [0.7, 1.4, 2.1].forEach(x => T.line([x, 0.802, 0.04], [x, 0.802, 0.84], 'rgba(0,0,0,.55)', 1.4));
      for (let x = 0.35; x < 2.8; x += 0.7) { const [ax, ay] = T.P(x, 0.801, 0.12); arch(ax, ay, 9, 20, null, GO.brass, 1); }
      T.box(0, 0, 0, 2.8, 0.8, 0.04, GO.brass);
      T.box(-0.05, -0.04, 0.86, 2.9, 0.88, 0.07, GO.nero); [[0.2, 0.7, 0.9, 0.1], [1.6, 0.75, 2.3, 0.05], [2.4, 0.5, 2.85, 0.3]].forEach(([x0, y0, x1, y1]) => T.line([x0, y0, 0.931], [x1, y1, 0.931], 'rgba(230,225,215,.3)', 0.9)); T.line([-0.05, 0.84, 0.86], [2.85, 0.84, 0.86], GO.brass, 1.4);
      T.poly([[0.3, 0.13, 0.932], [1.0, 0.13, 0.932], [1.0, 0.6, 0.932], [0.3, 0.6, 0.932]], '#1C1B1F', GO.brass, 1); T.poly([[0.38, 0.2, 0.933], [0.92, 0.2, 0.933], [0.92, 0.53, 0.933], [0.38, 0.53, 0.933]], '#121115');
      T.line([0.65, 0.04, 0.93], [0.65, 0.04, 1.2], GO.brass, 2.2); T.line([0.65, 0.04, 1.2], [0.65, 0.25, 1.14], GO.brass, 2.2);
      T.box(0.12, 0.12, 0.93, 0.12, 0.12, 0.03, GO.brass); T.line([0.18, 0.18, 0.96], [0.18, 0.18, 1.2], GO.brass, 2); const [cx, cy] = T.P(0.18, 0.18, 1.2); ell(cx, cy, 2, 6, '#F6EFE0'); circle(cx, cy - 7, 1.6, power ? GO.candle : GO.stone); },
    // Riad: whitewashed plaster with a cobalt zellige band, a cedar top, a hammered copper basin, a brass tap and a tagine at the end.
    riad: (T, o) => { const pl = cl(o);
      T.box(0, 0, 0, 2.8, 0.8, 0.86, pl); [0.7, 1.4, 2.1].forEach(x => T.line([x, 0.802, 0.04], [x, 0.802, 0.84], 'rgba(0,0,0,.14)', 1.2));
      for (let z = 0.1; z < 0.5; z += 0.1) for (let x = 0.02; x < 2.8; x += 0.1) { const c = [RI.cobalt, RI.cream, RI.teal, RI.cream, RI.terracotta, RI.cream][(Math.round(x * 10) + Math.round(z * 10) * 3) % 6]; T.poly([[x + 0.01, 0.801, z + 0.01], [x + 0.09, 0.801, z + 0.01], [x + 0.09, 0.801, z + 0.09], [x + 0.01, 0.801, z + 0.09]], c); }
      [0.6, 0.72].forEach((x, k) => T.line([0, 0.802, k ? 0.5 : 0.1], [2.8, 0.802, k ? 0.5 : 0.1], RI.cobalt, 1));
      T.box(-0.05, -0.04, 0.86, 2.9, 0.88, 0.07, RI.cedar); T.line([-0.05, 0.84, 0.86], [2.85, 0.84, 0.86], RI.cedarDark, 1.2); for (let x = 0.2; x < 2.8; x += 0.4) T.line([x, 0.0, 0.931], [x + 0.2, 0.84, 0.931], 'rgba(0,0,0,.1)', 1);
      T.poly([[0.3, 0.13, 0.932], [1.0, 0.13, 0.932], [1.0, 0.6, 0.932], [0.3, 0.6, 0.932]], RI.copper, 'rgba(0,0,0,.25)', 1); for (let x = 0.36; x < 1.0; x += 0.08) for (let y = 0.18; y < 0.6; y += 0.1) { const [hx, hy] = T.P(x, y, 0.933); circle(hx, hy, 1, 'rgba(255,255,255,.22)'); }
      T.line([0.65, 0.04, 0.93], [0.65, 0.04, 1.18], RI.brass, 2.2); T.line([0.65, 0.04, 1.18], [0.65, 0.24, 1.12], RI.brass, 2.2);
      T.box(0.06, 0.1, 0.93, 0.28, 0.28, 0.08, RI.terracotta); const [tx, ty] = T.P(0.2, 0.24, 1.01); ctx.beginPath(); ctx.moveTo(tx - 9, ty); ctx.lineTo(tx + 9, ty); ctx.lineTo(tx, ty - 14); ctx.closePath(); ctx.fillStyle = RI.terracotta; ctx.fill(); limb(tx - 9, ty, tx + 9, ty, RI.cobalt, 1.6); circle(tx, ty - 15, 1.6, RI.cobalt); },
    // Tropical: bamboo-slat fronts, a teak top, a white basin, a brass tap and a pineapple at the end.
    tropical: (T, o) => { const b = cl(o);
      T.box(0, 0, 0, 2.8, 0.8, 0.86, b); for (let x = 0.04; x < 2.8; x += 0.08) bambooPole(T, [x, 0.801, 0.03], [x, 0.801, 0.84], 2.6, shade(b, (Math.round(x * 25) % 3) * 0.04 - 0.04));
      [0.7, 1.4, 2.1].forEach(x => T.line([x, 0.802, 0.04], [x, 0.802, 0.84], 'rgba(60,40,20,.45)', 1.4)); T.line([0, 0.802, 0.2], [2.8, 0.802, 0.2], TR.rattan, 1.6); T.line([0, 0.802, 0.68], [2.8, 0.802, 0.68], TR.rattan, 1.6);
      T.box(-0.05, -0.04, 0.86, 2.9, 0.88, 0.07, TR.teak); T.line([-0.05, 0.84, 0.86], [2.85, 0.84, 0.86], shade(TR.teak, -0.25), 1.2); for (let x = 0.3; x < 2.8; x += 0.5) T.line([x, 0.02, 0.931], [x + 0.25, 0.82, 0.931], 'rgba(0,0,0,.14)', 1);
      T.poly([[0.3, 0.13, 0.932], [1.0, 0.13, 0.932], [1.0, 0.6, 0.932], [0.3, 0.6, 0.932]], '#FBFBF8', 'rgba(0,0,0,.2)', 1); T.poly([[0.38, 0.2, 0.933], [0.92, 0.2, 0.933], [0.92, 0.53, 0.933], [0.38, 0.53, 0.933]], '#EEF2F2');
      T.line([0.65, 0.04, 0.93], [0.65, 0.04, 1.18], TR.brass, 2.2); T.line([0.65, 0.04, 1.18], [0.65, 0.24, 1.12], TR.brass, 2.2);
      const [px, py] = T.P(0.18, 0.2, 0.93); ell(px, py - 7, 5, 7, '#E3B23C', 'rgba(0,0,0,.2)'); for (let k = -2; k <= 2; k++) { limb(px - 5, py - 7 + k * 2.5, px + 5, py - 10 + k * 2.5, 'rgba(120,80,20,.35)', 0.8); limb(px - 5, py - 10 + k * 2.5, px + 5, py - 7 + k * 2.5, 'rgba(120,80,20,.35)', 0.8); } [[-3, -0.4], [0, 0], [3, 0.4]].forEach(([dx, rot]) => ell(px + dx, py - 18, 1.6, 5, TR.leaf, null, rot)); },
    // Memphis: white laminate with a black squiggle, a red circle, a yellow triangle and a blue bar for handles, a terrazzo top and a black basin.
    memphis: (T, o) => { const w = cl(o);
      T.box(0, 0, 0, 2.8, 0.8, 0.86, w); [0.7, 1.4, 2.1].forEach(x => T.line([x, 0.802, 0.04], [x, 0.802, 0.84], 'rgba(0,0,0,.18)', 1.2));
      wiggle(T, [0.1, 0.801, 0.3], [0.62, 0.801, 0.3], 10, 0.05, ME.black, 1.6); wiggle(T, [1.5, 0.801, 0.6], [2.0, 0.801, 0.6], 10, 0.05, ME.black, 1.6);
      const [rx, ry] = T.P(1.05, 0.801, 0.6); circle(rx, ry, 5, ME.red); const [tx, ty] = T.P(1.75, 0.801, 0.25); ctx.beginPath(); ctx.moveTo(tx - 6, ty + 4); ctx.lineTo(tx + 6, ty + 4); ctx.lineTo(tx, ty - 6); ctx.closePath(); ctx.fillStyle = ME.yellow; ctx.fill(); T.poly([[2.2, 0.801, 0.5], [2.7, 0.801, 0.5], [2.7, 0.801, 0.58], [2.2, 0.801, 0.58]], ME.blue);
      for (let x = 0.15; x < 0.6; x += 0.12) { const [dx, dy] = T.P(x, 0.802, 0.65); circle(dx, dy, 1.2, ME.black); }
      T.box(-0.05, -0.04, 0.86, 2.9, 0.88, 0.07, ME.white); for (let k = 0; k < 40; k++) { const x = ((k * 0.618 * 7.1) % 2.9) - 0.05, y = ((k * 0.414 * 3.7) % 0.88) - 0.04; const [sx, sy] = T.P(x, y, 0.931); circle(sx, sy, 1.3, [ME.red, ME.yellow, ME.blue, ME.black][k % 4]); } T.line([-0.05, 0.84, 0.86], [2.85, 0.84, 0.86], ME.black, 1.4);
      const [sx, sy] = T.P(0.65, 0.37, 0.931); ell(sx, sy, 12, 6.5, ME.black, 'rgba(255,255,255,.3)'); ell(sx, sy + 0.8, 9, 4.6, '#3A3A40');
      T.line([0.65, 0.04, 0.93], [0.65, 0.04, 1.2], ME.red, 2.4); T.line([0.65, 0.04, 1.2], [0.65, 0.26, 1.13], ME.red, 2.4);
      T.box(0.08, 0.1, 0.93, 0.16, 0.16, 0.22, ME.black); T.box(0.06, 0.08, 1.15, 0.2, 0.2, 0.04, ME.yellow); for (let z = 0.97; z < 1.14; z += 0.06) { const [dx, dy] = T.P(0.16, 0.261, z); circle(dx, dy, 1, ME.white); } },
  });
  Object.assign(LOOK_DRAWERS.fridge, {
    // Gothic Revival: an ebony body with a stained-glass pointed arch in the upper door, brass handles and a brass crest. Returns the open door's colour.
    gothic: (T, o) => { const body = cl(o);
      T.box(0, 0, 0, 0.9, 0.85, 0.06, GO.brass); T.box(0, 0, 0.06, 0.9, 0.85, 1.81, body); T.box(0.1, 0.1, 1.87, 0.7, 0.65, 0.08, GO.brass);
      T.line([0, 0.85, 1.3], [0.9, 0.85, 1.3], GO.brass, 1.2);
      const [ax, ay] = T.P(0.4, 0.851, 1.36); arch(ax, ay, 9, 16, null, GO.brass, 1.2); arch(ax, ay, 7, 14, 'rgba(0,0,0,.5)', null); [[-3, -6, 0], [3, -6, 1], [-3, -14, 2], [3, -14, 3], [0, -22, 0]].forEach(([dx, dy, k]) => circle(ax + dx, ay + dy, 2.6, power ? GO.panes[k] : shade(GO.panes[k], -0.4)));
      const [bx, by] = T.P(0.4, 0.851, 0.14); arch(bx, by, 9, 26, null, GO.brass, 1);
      [[0.7, 1.15], [1.42, 1.78]].forEach(([z0, z1]) => T.line([0.78, 0.855, z0], [0.78, 0.855, z1], GO.brass, 3.2));
      return body; },
    // Riad: whitewashed plaster with a cobalt zellige band round the middle, a cedar arch on the lower door and brass handles. Returns the open door's colour.
    riad: (T, o) => { const body = cl(o);
      T.box(0, 0, 0, 0.9, 0.85, 1.95, body); T.line([0, 0.85, 1.3], [0.9, 0.85, 1.3], 'rgba(0,0,0,.14)', 1.2);
      for (let z = 1.34; z < 1.62; z += 0.1) for (let x = 0.05; x < 0.85; x += 0.1) { const c = [RI.cobalt, RI.cream, RI.teal, RI.cream][(Math.round(x * 10) + Math.round(z * 10)) % 4]; T.poly([[x + 0.01, 0.851, z + 0.01], [x + 0.09, 0.851, z + 0.01], [x + 0.09, 0.851, z + 0.09], [x + 0.01, 0.851, z + 0.09]], c); }
      const [ax, ay] = T.P(0.4, 0.851, 0.14); arch(ax, ay, 10, 30, null, RI.cedar, 1.4); arch(ax, ay, 8, 27, null, 'rgba(46,76,154,.5)', 1);
      [[0.7, 1.15], [1.42, 1.78]].forEach(([z0, z1]) => T.line([0.78, 0.855, z0], [0.78, 0.855, z1], RI.brass, 3.2));
      const [sx, sy] = T.P(0.4, 0.851, 1.8); ctx.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, r = k % 2 ? 2 : 4.5; ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r); } ctx.closePath(); ctx.fillStyle = RI.brass; ctx.fill();
      return body; },
    // Tropical: a palm-green body with bamboo bands top and bottom, a monstera leaf on the door and a pink handle. Returns the open door's colour.
    tropical: (T, o) => { const body = cl(o);
      T.box(0, 0, 0, 0.9, 0.85, 0.08, TR.bamboo); T.box(0, 0, 0.08, 0.9, 0.85, 1.79, body); T.box(0, 0, 1.87, 0.9, 0.85, 0.08, TR.bamboo);
      for (let x = 0.05; x < 0.9; x += 0.1) { const [ax, ay] = T.P(x, 0.851, 0.04), [bx, by] = T.P(x, 0.851, 1.91); ell(ax, ay, 1.5, 0.8, TR.bambooDark); ell(bx, by, 1.5, 0.8, TR.bambooDark); }
      T.line([0, 0.85, 1.3], [0.9, 0.85, 1.3], 'rgba(0,0,0,.25)', 1.2);
      const [lx, ly] = T.P(0.38, 0.851, 0.7); monstera(lx, ly, 13, TR.leafLight, body, -0.3); const [fx, fy] = T.P(0.3, 0.851, 1.6); circle(fx, fy, 3.2, TR.pink); circle(fx, fy, 1.4, TR.coral);
      [[0.7, 1.15], [1.42, 1.78]].forEach(([z0, z1]) => T.line([0.78, 0.855, z0], [0.78, 0.855, z1], TR.pink, 3.4));
      return body; },
    // Memphis: a white body with a black squiggle, a red circle, a yellow triangle and blue bar handles. Returns the open door's colour.
    memphis: (T, o) => { const body = cl(o);
      T.box(0, 0, 0, 0.9, 0.85, 0.06, ME.black); T.box(0, 0, 0.06, 0.9, 0.85, 1.89, body);
      T.line([0, 0.85, 1.3], [0.9, 0.85, 1.3], ME.black, 1.2);
      wiggle(T, [0.08, 0.851, 1.0], [0.62, 0.851, 1.0], 12, 0.05, ME.black, 1.6); wiggle(T, [0.1, 0.851, 1.72], [0.5, 0.851, 1.72], 8, 0.04, ME.black, 1.4);
      const [rx, ry] = T.P(0.3, 0.851, 0.4); circle(rx, ry, 7, ME.red); const [tx, ty] = T.P(0.58, 0.851, 1.5); ctx.beginPath(); ctx.moveTo(tx - 7, ty + 5); ctx.lineTo(tx + 7, ty + 5); ctx.lineTo(tx, ty - 8); ctx.closePath(); ctx.fillStyle = ME.yellow; ctx.fill();
      for (let z = 0.62; z < 0.9; z += 0.07) { const [dx, dy] = T.P(0.6, 0.852, z); circle(dx, dy, 1.2, ME.black); }
      [[0.7, 1.15], [1.42, 1.78]].forEach(([z0, z1]) => T.line([0.78, 0.855, z0], [0.78, 0.855, z1], ME.blue, 3.6));
      return body; },
  });

  // ---- Four more: Provence, Adobe, Neon and Candy ----
  const PR = { pine: '#E8DCC4', pineDark: '#C9B690', lavender: '#8E7CC3', lavenderLight: '#C9B8E8', iron: '#3A3A40', linen: '#F4EFE3', limestone: '#D9D2C2', toile: '#2E4C9A', sage: '#9DB3A5', zinc: '#B9BEC3', copper: '#B5674A' };
  const AD = { adobe: '#D9A47A', adobeDark: '#C08B62', turquoise: '#3FA7A0', rust: '#B5533C', sand: '#EFE2C8', pine: '#9C7046', pineDark: '#6E4B2E', black: '#2B2420', cream: '#F4ECD8', leather: '#8E4A33' };
  const NE = { black: '#111118', steel: '#3A3F4A', mesh: '#2A2F3A', magenta: '#FF2E9A', cyan: '#19E6F0', violet: '#8A3CFF', amber: '#FFB020', glass: '#1E2230' };
  const CA = { pink: '#F6B7CC', pinkDark: '#E89AB5', mint: '#BFE8D6', lilac: '#D6C4F0', butter: '#FBE7A6', cream: '#FFF8F0', choc: '#7A4B3A', cherry: '#E04A6A', sky: '#BFE0F5' };
  /** A sprig of lavender in screen space: a stem with a cluster of dots at the top. */
  const sprig = (sx, sy, h, col, stem = PR.sage) => { limb(sx, sy, sx, sy - h, stem, 1); for (let k = 0; k < 4; k++) { circle(sx - 1.2, sy - h + k * 2, 1.1, col); circle(sx + 1.2, sy - h + 1 + k * 2, 1.1, col); } };
  /** A serape band along a face in the piece's frame: stripes of colour with a zigzag between. */
  const serape = (T, from, to, pal, width, zig = 0.03) => { pal.forEach((c, k) => T.line([from[0], from[1], from[2] + k * width], [to[0], to[1], to[2] + k * width], c, 2.2)); const n = 12, pts = []; for (let k = 0; k <= n; k++) { const u = k / n; pts.push(T.P(from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u, from[2] + pal.length * width + (k % 2) * zig)); } ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.strokeStyle = AD.black; ctx.lineWidth = 1.2; ctx.stroke(); };
  /** A neon strip along a line in the piece's frame: a glow, then the bright core. */
  const neon = (T, a, b, col, on = true) => { if (on) T.line(a, b, hexA(col, 0.22), 5); T.line(a, b, on ? col : shade(col, -0.55), 1.6); if (on) T.line(a, b, 'rgba(255,255,255,.55)', 0.6); };
  const hexA = (hex, a) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;
  /** Scallops along a line in the piece's frame: half-circles hanging below it. */
  const scallops = (T, from, to, n, r, col) => { for (let k = 0; k < n; k++) { const u = (k + 0.5) / n, [sx, sy] = T.P(from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u, from[2]); ctx.beginPath(); ctx.ellipse(sx, sy, r, r * 0.8, 0, 0, Math.PI); ctx.fillStyle = col; ctx.fill(); } };
  /** Sprinkles in screen space: short dashes in a few sweet colours. */
  const sprinkles = (sx, sy, w, h, n, seed = 0) => { for (let k = 0; k < n; k++) { const x = sx + ((k * 0.618 * 7.3 + seed) % 1) * w, y = sy + ((k * 0.414 * 5.1 + seed) % 1) * h, a = (k * 1.7) % Math.PI; limb(x - Math.cos(a) * 2, y - Math.sin(a) * 2, x + Math.cos(a) * 2, y + Math.sin(a) * 2, [CA.cherry, CA.sky, CA.butter, CA.lilac, CA.mint][k % 5], 1.4); } };
  Object.assign(LOOK_DRAWERS.sofa, {
    // Provence: a skirted linen sofa with blue toile cushions, a lavender bolster and a sprig on the back.
    provence: (o, s1, s2) => { const l = cl(o), lc = shade(l, 0.03); return [
      B(0, 0, 0, 2.4, 1.0, 0.38, l, { name: 'base' }), B(0, 0, 0.38, 2.4, 0.3, 0.54, l), B(0, 0, 0.38, 0.2, 1.0, 0.3, l), B(2.2, 0, 0.38, 0.2, 1.0, 0.3, l),
      B(0.2, 0.3, 0.38 - s1 * 0.018, 1.0, 0.66, 0.1 - s1 * 0.035, lc), B(1.2, 0.3, 0.38 - s2 * 0.018, 1.0, 0.66, 0.1 - s2 * 0.035, lc),
      B(0.3, 0.34, 0.48, 0.4, 0.14, 0.3, PR.linen), B(1.7, 0.34, 0.48, 0.4, 0.14, 0.3, PR.linen), B(0.98, 0.36, 0.48, 0.44, 0.16, 0.16, PR.lavenderLight),
      F(0, 0, 2.4, 1.0, (T) => {
        for (let x = 0.1; x < 2.4; x += 0.2) T.line([x, 1.001, 0.02], [x + 0.04, 1.001, 0.3], 'rgba(0,0,0,.08)', 1); T.line([0, 1.002, 0.3], [2.4, 1.002, 0.3], 'rgba(0,0,0,.12)', 1);
        [[0.5, 0], [1.9, 0]].forEach(([x]) => { const [cx, cy] = T.P(x, 0.481, 0.64); ell(cx, cy, 3, 2, PR.toile); limb(cx - 5, cy + 4, cx + 5, cy + 4, PR.toile, 1); circle(cx + 4, cy - 3, 1.2, PR.toile); circle(cx - 4, cy - 3, 1.2, PR.toile); });
        const [sx, sy] = T.P(1.2, 0.301, 0.6); sprig(sx - 6, sy + 6, 14, PR.lavender); sprig(sx + 6, sy + 6, 12, PR.lavender);
      }, { onTop: true })]; },
    // Adobe: rust leather on a pine frame with a serape blanket over the back and a turquoise cushion.
    adobe: (o, s1, s2) => { const v = cl(o), vc = shade(v, 0.06); return [
      B(0, 0, 0, 2.4, 1.0, 0.12, AD.pine), B(0, 0, 0.12, 2.4, 1.0, 0.26, v, { name: 'base' }), B(0, 0, 0.38, 2.4, 0.3, 0.54, v), B(0, 0, 0.38, 0.22, 1.0, 0.3, AD.pine), B(2.18, 0, 0.38, 0.22, 1.0, 0.3, AD.pine),
      B(0.22, 0.3, 0.38 - s1 * 0.018, 0.98, 0.66, 0.1 - s1 * 0.035, vc), B(1.2, 0.3, 0.38 - s2 * 0.018, 0.98, 0.66, 0.1 - s2 * 0.035, vc),
      B(1.3, 0, 0.92, 0.9, 0.3, 0.04, AD.cream), B(0.3, 0.34, 0.48, 0.42, 0.14, 0.3, AD.turquoise),
      F(0, 0, 2.4, 1.0, (T) => {
        serape(T, [1.32, 0.301, 0.5], [2.18, 0.301, 0.5], [AD.rust, AD.turquoise, AD.black, AD.cream], 0.07);
        for (let x = 1.34; x < 2.2; x += 0.08) T.line([x, 0.302, 0.42], [x, 0.302, 0.5], AD.cream, 1);
        T.line([0, 1.001, 0.12], [2.4, 1.001, 0.12], AD.pineDark, 1.2); [[0.11], [2.29]].forEach(([x]) => { for (let y = 0.1; y < 1.0; y += 0.3) { const [nx, ny] = T.P(x, y, 0.5); circle(nx, ny, 1.4, AD.black); } });
      }, { onTop: true })]; },
    // Neon: black leather with magenta piping, a cyan strip under the base and a violet cushion.
    neon: (o, s1, s2) => { const v = cl(o), vc = shade(v, 0.08); return [
      B(0.1, 0.1, 0, 2.2, 0.8, 0.08, NE.steel), B(0, 0, 0.08, 2.4, 1.0, 0.3, v, { name: 'base' }), B(0, 0, 0.38, 2.4, 0.3, 0.54, v), B(0, 0, 0.38, 0.22, 1.0, 0.3, v), B(2.18, 0, 0.38, 0.22, 1.0, 0.3, v),
      B(0.22, 0.3, 0.38 - s1 * 0.018, 0.98, 0.66, 0.1 - s1 * 0.035, vc), B(1.2, 0.3, 0.38 - s2 * 0.018, 0.98, 0.66, 0.1 - s2 * 0.035, vc),
      B(0.3, 0.34, 0.48, 0.42, 0.14, 0.3, NE.violet), B(1.7, 0.34, 0.48, 0.42, 0.14, 0.3, NE.mesh),
      F(0, 0, 2.4, 1.0, (T) => {
        neon(T, [0.1, 1.001, 0.08], [2.3, 1.001, 0.08], NE.cyan, power);
        T.line([0, 1.002, 0.38], [2.4, 1.002, 0.38], NE.magenta, 1.2); T.line([0.22, 0.301, 0.9], [2.18, 0.301, 0.9], NE.magenta, 1.2);
        for (let z = 0.5; z < 0.9; z += 0.12) T.line([0.3, 0.301, z], [2.1, 0.301, z], 'rgba(255,255,255,.08)', 1);
        [[0.11, 0.68], [2.29, 0.68]].forEach(([x, z]) => T.line([x, 0.0, z], [x, 1.0, z], NE.magenta, 1));
      }, { onTop: true })]; },
    // Candy: a pink sofa with a scalloped skirt, mint and lilac cushions, a bow on one arm and sprinkles on the back.
    candy: (o, s1, s2) => { const v = cl(o), vc = shade(v, 0.04); return [
      B(0, 0, 0, 2.4, 1.0, 0.38, v, { name: 'base' }), B(0, 0, 0.38, 2.4, 0.3, 0.54, v), B(0, 0, 0.38, 0.22, 1.0, 0.32, v), B(2.18, 0, 0.38, 0.22, 1.0, 0.32, v),
      B(0.22, 0.3, 0.38 - s1 * 0.018, 0.98, 0.66, 0.1 - s1 * 0.035, vc), B(1.2, 0.3, 0.38 - s2 * 0.018, 0.98, 0.66, 0.1 - s2 * 0.035, vc),
      B(0.3, 0.34, 0.48, 0.42, 0.14, 0.3, CA.mint), B(1.7, 0.34, 0.48, 0.42, 0.14, 0.3, CA.lilac),
      F(0, 0, 2.4, 1.0, (T) => {
        scallops(T, [0.0, 1.001, 0.12], [2.4, 1.001, 0.12], 12, 4.5, CA.cream); T.line([0, 1.002, 0.12], [2.4, 1.002, 0.12], CA.cream, 1.2);
        const [bx, by] = T.P(0.11, 0.5, 0.72); ell(bx - 4, by, 4, 2.4, CA.cherry, null, -0.4); ell(bx + 4, by, 4, 2.4, CA.cherry, null, 0.4); circle(bx, by, 1.8, CA.cherry);
        const [sx, sy] = T.P(0.3, 0.301, 0.88); sprinkles(sx, sy, 50, 14, 16, 0.3);
      }, { onTop: true })]; },
  });
  Object.assign(LOOK_DRAWERS.dining, {
    // Provence: a whitewashed pine farm table on turned legs, ladder-back chairs with rush seats, and an iron lantern.
    provence: (o) => { const ps = [], w = cl(o);
      const chair = (y0, back) => { [[0.39, y0 + 0.04], [0.83, y0 + 0.04], [0.39, y0 + 0.48], [0.83, y0 + 0.48]].forEach(([x, y]) => ps.push(B(x, y, 0, 0.05, 0.05, 0.42, w)));
        ps.push(B(0.35, y0, 0.42, 0.6, 0.58, 0.07, PR.pineDark, { name: y0 === 0 ? 'seat1' : 'seat2' }), B(0.36, back, 0.49, 0.05, 0.06, 0.42, w), B(0.89, back, 0.49, 0.05, 0.06, 0.42, w));
        ps.push(F(0.35, back - 0.02, 0.95, back + 0.08, (T) => { for (let z = 0.58; z < 0.9; z += 0.1) T.line([0.38, back + 0.03, z], [0.92, back + 0.03, z], w, 2.4); for (let x = 0.38; x < 0.92; x += 0.05) T.line([x, y0 + 0.02, 0.491], [x + 0.03, y0 + 0.56, 0.491], 'rgba(0,0,0,.12)', 1); }, { onTop: true })); };
      chair(0, 0); chair(1.89, 2.42);
      [[0.1, 0.84], [1.12, 0.84], [0.1, 1.56], [1.12, 1.56]].forEach(([x, y]) => { ps.push(B(x, y, 0, 0.08, 0.08, 0.7, w)); ps.push(B(x - 0.02, y - 0.02, 0.2, 0.12, 0.12, 0.06, w), B(x - 0.02, y - 0.02, 0.46, 0.12, 0.12, 0.06, w)); });
      ps.push(B(0, 0.74, 0.7, 1.3, 1.0, 0.07, w, { name: 'top' }));
      ps.push(F(0, 0.74, 1.3, 1.74, (T) => { for (let y = 0.86; y < 1.74; y += 0.14) T.line([0.04, y, 0.772], [1.26, y + 0.01, 0.772], 'rgba(120,100,70,.16)', 1); const [jx, jy] = T.P(0.2, 0.9, 0.772); ell(jx, jy, 3.5, 2.2, PR.zinc); for (let k = -1; k <= 1; k++) sprig(jx + k * 3, jy - 1, 9 + Math.abs(k), PR.lavender); }, { onTop: true }));
      ps.push(diningLife(), diningLight('iron'));
      return ps; },
    // Adobe: a carved pine table, turquoise-painted chairs with leather seats, and a punched-tin star above.
    adobe: (o) => { const ps = [], w = cl(o);
      const chair = (y0, back) => { [[0.39, y0 + 0.04], [0.83, y0 + 0.04], [0.39, y0 + 0.48], [0.83, y0 + 0.48]].forEach(([x, y]) => ps.push(B(x, y, 0, 0.06, 0.06, 0.42, AD.turquoise)));
        ps.push(B(0.35, y0, 0.42, 0.6, 0.58, 0.07, AD.leather, { name: y0 === 0 ? 'seat1' : 'seat2' }), B(0.35, back, 0.49, 0.6, 0.06, 0.4, AD.turquoise));
        ps.push(F(0.35, back - 0.02, 0.95, back + 0.08, (T) => { const yb = back + 0.065; for (let x = 0.45; x < 0.9; x += 0.14) { const [dx, dy] = T.P(x, yb, 0.72); ctx.beginPath(); ctx.moveTo(dx, dy - 3); ctx.lineTo(dx + 3, dy); ctx.lineTo(dx, dy + 3); ctx.lineTo(dx - 3, dy); ctx.closePath(); ctx.fillStyle = AD.cream; ctx.fill(); } }, { onTop: true })); };
      chair(0, 0); chair(1.89, 2.42);
      [[0.1, 0.84], [1.12, 0.84], [0.1, 1.56], [1.12, 1.56]].forEach(([x, y]) => ps.push(B(x, y, 0, 0.1, 0.1, 0.7, w)));
      ps.push(B(0, 0.74, 0.7, 1.3, 1.0, 0.07, w, { name: 'top' }));
      ps.push(F(0, 0.74, 1.3, 1.74, (T) => { for (let x = 0.08; x < 1.3; x += 0.1) { const [nx, ny] = T.P(x, 1.741, 0.735); ctx.beginPath(); ctx.moveTo(nx, ny - 2.5); ctx.lineTo(nx + 2.5, ny); ctx.lineTo(nx, ny + 2.5); ctx.lineTo(nx - 2.5, ny); ctx.closePath(); ctx.fillStyle = AD.pineDark; ctx.fill(); } T.poly([[0.1, 0.84, 0.772], [1.2, 0.84, 0.772], [1.2, 1.64, 0.772], [0.1, 1.64, 0.772]], null, AD.pineDark, 1); serape(T, [0.15, 1.1, 0.772], [1.15, 1.1, 0.772], [AD.rust, AD.turquoise, AD.cream], 0.0, 0); }, { onTop: true }));
      ps.push(diningLife(), diningLight('tin'));
      return ps; },
    // Neon: a black glass table lit from under, steel chairs with a cyan edge, and a neon ring above.
    neon: (o) => { const ps = [], g = cl(o);
      const chair = (y0, back) => { ps.push(B(0.52, y0 + 0.16, 0, 0.26, 0.26, 0.05, NE.steel), B(0.62, y0 + 0.26, 0.05, 0.06, 0.06, 0.37, NE.steel));
        ps.push(B(0.35, y0, 0.42, 0.6, 0.58, 0.07, NE.black, { name: y0 === 0 ? 'seat1' : 'seat2' }), B(0.35, back, 0.49, 0.6, 0.06, 0.4, NE.black));
        ps.push(F(0.35, back - 0.02, 0.95, back + 0.08, (T) => { neon(T, [0.36, y0 + (y0 === 0 ? 0.58 : 0.0), 0.49], [0.94, y0 + (y0 === 0 ? 0.58 : 0.0), 0.49], NE.cyan, power); neon(T, [0.37, back + 0.06, 0.88], [0.93, back + 0.06, 0.88], NE.magenta, power); }, { onTop: true })); };
      chair(0, 0); chair(1.89, 2.42);
      ps.push(B(0.45, 1.04, 0, 0.4, 0.4, 0.04, NE.steel), B(0.58, 1.17, 0.04, 0.14, 0.14, 0.66, NE.steel));
      ps.push(B(0, 0.74, 0.7, 1.3, 1.0, 0.07, g, { name: 'top' }));
      ps.push(F(0, 0.74, 1.3, 1.74, (T) => { neon(T, [0, 0.74, 0.7], [1.3, 0.74, 0.7], NE.cyan, power); neon(T, [1.3, 0.74, 0.7], [1.3, 1.74, 0.7], NE.cyan, power); for (let y = 0.86; y < 1.74; y += 0.22) T.line([0.08, y, 0.772], [1.22, y, 0.772], 'rgba(255,255,255,.08)', 1); T.line([0.2, 0.8, 0.772], [1.1, 1.6, 0.772], 'rgba(255,255,255,.14)', 1); }, { onTop: true }));
      ps.push(diningLife(), diningLight('neonring'));
      return ps; },
    // Candy: a pink top with a scalloped edge on a striped drum, lilac chairs with heart backs, and a lollipop light.
    candy: (o) => { const ps = [], t = cl(o);
      const chair = (y0, back) => { [[0.39, y0 + 0.04], [0.83, y0 + 0.04], [0.39, y0 + 0.48], [0.83, y0 + 0.48]].forEach(([x, y]) => ps.push(B(x, y, 0, 0.05, 0.05, 0.42, CA.cream)));
        ps.push(B(0.35, y0, 0.42, 0.6, 0.58, 0.07, CA.lilac, { name: y0 === 0 ? 'seat1' : 'seat2' }));
        ps.push(F(0.35, back - 0.02, 0.95, back + 0.08, (T) => { const [cx, cy] = T.P(0.65, back + 0.03, 0.5); limb(cx - 8, cy + 8, cx - 8, cy, CA.cream, 2); limb(cx + 8, cy + 8, cx + 8, cy, CA.cream, 2); ctx.beginPath(); ctx.moveTo(cx, cy + 6); ctx.bezierCurveTo(cx - 14, cy - 4, cx - 6, cy - 14, cx, cy - 6); ctx.bezierCurveTo(cx + 6, cy - 14, cx + 14, cy - 4, cx, cy + 6); ctx.fillStyle = CA.lilac; ctx.fill(); ctx.strokeStyle = CA.cream; ctx.lineWidth = 1.4; ctx.stroke(); }, { onTop: true })); };
      chair(0, 0); chair(1.89, 2.42);
      ps.push(B(0.35, 0.94, 0, 0.6, 0.6, 0.7, CA.cream));
      ps.push(B(0, 0.74, 0.7, 1.3, 1.0, 0.07, t, { name: 'top' }));
      ps.push(F(0, 0.74, 1.3, 1.74, (T) => { for (let x = 0.4; x < 0.95; x += 0.1) T.line([x, 1.541, 0.02], [x, 1.541, 0.68], CA.pink, 2); for (let y = 0.98; y < 1.54; y += 0.1) T.line([0.951, y, 0.02], [0.951, y, 0.68], CA.pink, 2); scallops(T, [0, 1.74, 0.7], [1.3, 1.74, 0.7], 8, 4, CA.cream); scallops(T, [1.3, 0.74, 0.7], [1.3, 1.74, 0.7], 6, 4, CA.cream); const [sx, sy] = T.P(0.2, 1.5, 0.772); sprinkles(sx, sy, 30, 12, 10, 0.6); }, { onTop: true }));
      ps.push(diningLife(), diningLight('lollipop'));
      return ps; },
  });
  Object.assign(LOOK_DRAWERS.lamp, {
    // Provence: a wrought iron scroll stand with a linen drum shade and a sprig tucked in the band.
    provence: (T, o) => { const lit = isLit(o.id), g = cl(o);
      T.box(0.08, 0.08, 0, 0.24, 0.24, 0.03, g); T.line([0.2, 0.2, 0.03], [0.2, 0.2, 1.36], g, 2);
      [[0.12, 0.6], [0.28, 0.6]].forEach(([x, z], k) => { const [ax, ay] = T.P(0.2, 0.2, z), [bx, by] = T.P(x, 0.2, z - 0.16); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(bx + (k ? 4 : -4), ay - 2, bx, by); ctx.strokeStyle = g; ctx.lineWidth = 1.4; ctx.stroke(); circle(bx, by, 1.4, g); });
      T.box(0.04, 0.04, 1.36, 0.32, 0.32, 0.3, lit ? '#FFF3DA' : PR.linen); T.line([0.04, 0.361, 1.4], [0.36, 0.361, 1.4], PR.lavender, 1.4); T.line([0.361, 0.04, 1.4], [0.361, 0.36, 1.4], PR.lavender, 1.4);
      const [sx, sy] = T.P(0.3, 0.362, 1.42); sprig(sx, sy, 7, PR.lavender);
      if (lit) { const [gx, gy] = T.P(0.2, 0.2, 1.36); ell(gx, gy + 4, 14, 7, 'rgba(255,226,168,.2)'); } },
    // Adobe: a turquoise pottery base under a rawhide shade laced with leather.
    adobe: (T, o) => { const lit = isLit(o.id), g = cl(o);
      T.box(0.1, 0.1, 0, 0.2, 0.2, 0.04, AD.pineDark); T.box(0.06, 0.06, 0.04, 0.28, 0.28, 0.5, g); T.box(0.1, 0.1, 0.54, 0.2, 0.2, 0.3, g); T.line([0.2, 0.2, 0.84], [0.2, 0.2, 1.36], AD.black, 1.6);
      for (let z = 0.14; z < 0.5; z += 0.12) { const pts = []; for (let x = 0.06; x <= 0.34; x += 0.04) pts.push(T.P(x, 0.341, z + ((Math.round(x * 100) % 8 < 4) ? 0.04 : 0))); ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.strokeStyle = AD.cream; ctx.lineWidth = 1.2; ctx.stroke(); }
      T.box(0.02, 0.02, 1.36, 0.36, 0.36, 0.3, lit ? '#FFE9B8' : AD.sand); for (let z = 1.4; z < 1.66; z += 0.08) { const [ax, ay] = T.P(0.02, 0.381, z), [bx, by] = T.P(0.38, 0.381, z); limb(ax, ay, bx, by, 'rgba(120,80,40,.25)', 1); } for (let x = 0.06; x < 0.38; x += 0.06) { const [lx, ly] = T.P(x, 0.382, 1.64); limb(lx - 2, ly, lx + 2, ly - 3, AD.leather, 1.2); }
      if (lit) { const [gx, gy] = T.P(0.2, 0.2, 1.36); ell(gx, gy + 4, 15, 7, 'rgba(255,214,150,.2)'); } },
    // Neon: a magenta tube standing on a black base; the whole tube is the light.
    neon: (T, o) => { const lit = isLit(o.id), g = cl(o);
      T.box(0.06, 0.06, 0, 0.28, 0.28, 0.04, NE.black); T.box(0.12, 0.12, 0.04, 0.16, 0.16, 0.06, NE.steel);
      const [ax, ay] = T.P(0.2, 0.2, 0.1), [bx, by] = T.P(0.2, 0.2, 1.6);
      if (lit) { limb(ax, ay, bx, by, hexA(g, 0.18), 12); limb(ax, ay, bx, by, hexA(g, 0.35), 6); }
      limb(ax, ay, bx, by, lit ? g : shade(g, -0.5), 2.6); if (lit) limb(ax, ay, bx, by, 'rgba(255,255,255,.7)', 0.9);
      [0.5, 1.1].forEach(z => { const [kx, ky] = T.P(0.2, 0.2, z); ell(kx, ky, 3, 1.4, NE.steel); }); circle(bx, by, 2, NE.steel); },
    // Candy: an ice cream cone lamp: a waffle cone base with a pink scoop that glows.
    candy: (T, o) => { const lit = isLit(o.id), g = cl(o);
      T.box(0.14, 0.14, 0, 0.12, 0.12, 0.04, CA.choc); const [ax, ay] = T.P(0.2, 0.2, 0.04), [bx, by] = T.P(0.2, 0.2, 1.2);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx - 13, by); ctx.lineTo(bx + 13, by); ctx.closePath(); ctx.fillStyle = '#D9A066'; ctx.fill();
      for (let k = 1; k < 7; k++) { const u = k / 7, y = ay + (by - ay) * u, hw = 13 * u; limb(bx - hw, y, bx + hw, y, 'rgba(120,70,20,.3)', 1); limb(bx - hw * 0.6, y - 6, bx + hw * 0.1, y + 6, 'rgba(120,70,20,.2)', 1); }
      if (lit) circle(bx, by - 8, 20, 'rgba(255,226,210,.2)');
      circle(bx, by - 6, 14, lit ? '#FFD9E4' : g, 'rgba(0,0,0,.08)'); circle(bx - 6, by - 10, 3, 'rgba(255,255,255,.6)'); circle(bx, by - 21, 3, CA.cherry); limb(bx, by - 21, bx + 2, by - 27, CA.choc, 1);
      sprinkles(bx - 10, by - 14, 20, 12, 8, 0.2); },
  });
  Object.assign(LOOK_DRAWERS.plant, {
    // Provence: an old zinc pot with a lavender band.
    provence: (T, o) => { const g = cl(o); T.box(0.05, 0.05, 0, 0.4, 0.4, 0.42, g); T.box(0.03, 0.03, 0.36, 0.44, 0.44, 0.06, shade(g, -0.1)); for (let x = 0.1; x < 0.45; x += 0.1) { const [sx, sy] = T.P(x, 0.451, 0.14); sprig(sx, sy, 7, PR.lavender); } T.line([0.05, 0.451, 0.3], [0.45, 0.451, 0.3], 'rgba(0,0,0,.14)', 1); },
    // Adobe: a painted clay pot with a cream band and a zigzag in turquoise and black.
    adobe: (T, o) => { const g = cl(o); T.box(0.05, 0.05, 0, 0.4, 0.4, 0.42, g); T.box(0.04, 0.04, 0.2, 0.42, 0.42, 0.12, AD.cream); serape(T, [0.05, 0.461, 0.22], [0.45, 0.461, 0.22], [AD.turquoise], 0.0, 0.03); serape(T, [0.461, 0.05, 0.22], [0.461, 0.45, 0.22], [AD.turquoise], 0.0, 0.03); },
    // Neon: a black hex pot with a cyan ring that lights up.
    neon: (T, o) => { const g = cl(o); T.box(0.08, 0.08, 0, 0.34, 0.34, 0.06, NE.steel); T.box(0.05, 0.05, 0.06, 0.4, 0.4, 0.36, g); neon(T, [0.05, 0.451, 0.36], [0.45, 0.451, 0.36], NE.cyan, power); neon(T, [0.451, 0.05, 0.36], [0.451, 0.45, 0.36], NE.cyan, power); T.line([0.05, 0.452, 0.14], [0.45, 0.452, 0.14], NE.violet, 1); },
    // Candy: a teacup planter with a handle and a scalloped saucer.
    candy: (T, o) => { const g = cl(o); T.box(0.0, 0.0, 0, 0.5, 0.5, 0.03, CA.cream); scallops(T, [0.0, 0.5, 0.03], [0.5, 0.5, 0.03], 5, 3, CA.cream); T.box(0.07, 0.07, 0.03, 0.36, 0.36, 0.36, g); T.box(0.05, 0.05, 0.36, 0.4, 0.4, 0.05, CA.cream); const [hx, hy] = T.P(0.46, 0.25, 0.22); ctx.beginPath(); ctx.ellipse(hx + 3, hy, 5, 7, 0, -Math.PI / 2, Math.PI / 2); ctx.strokeStyle = g; ctx.lineWidth = 2.4; ctx.stroke(); for (let x = 0.12; x < 0.42; x += 0.1) { const [dx, dy] = T.P(x, 0.431, 0.2); circle(dx, dy, 1.6, CA.cream); } },
  });
  Object.assign(LOOK_DRAWERS.counter, {
    // Provence: whitewashed pine fronts with iron pulls, a limestone top, an apron-front basin, a copper tap and a jug of lavender at the end.
    provence: (T, o) => { const w = cl(o);
      T.box(0, 0, 0, 2.8, 0.8, 0.86, w); for (let x = 0.1; x < 2.8; x += 0.06) T.line([x, 0.801, 0.04], [x, 0.801, 0.84], 'rgba(120,100,70,.08)', 1);
      [0.7, 1.4, 2.1].forEach(x => T.line([x, 0.802, 0.04], [x, 0.802, 0.84], 'rgba(0,0,0,.2)', 1.2)); [0.35, 1.05, 1.75, 2.45].forEach(x => { T.poly([[x - 0.22, 0.803, 0.14], [x + 0.22, 0.803, 0.14], [x + 0.22, 0.803, 0.74], [x - 0.22, 0.803, 0.74]], null, 'rgba(0,0,0,.14)', 1); const [px, py] = T.P(x, 0.804, 0.46); circle(px, py, 1.6, PR.iron); });
      T.box(-0.05, -0.04, 0.86, 2.9, 0.88, 0.07, PR.limestone); T.line([-0.05, 0.84, 0.86], [2.85, 0.84, 0.86], shade(PR.limestone, -0.18), 1.2);
      T.box(0.3, 0.1, 0.86, 0.7, 0.72, 0.09, '#FBFBF8'); T.poly([[0.36, 0.17, 0.952], [0.94, 0.17, 0.952], [0.94, 0.56, 0.952], [0.36, 0.56, 0.952]], '#EEF2F2');
      T.line([0.65, 0.04, 0.95], [0.65, 0.04, 1.2], PR.copper, 2.2); T.line([0.65, 0.04, 1.2], [0.65, 0.24, 1.14], PR.copper, 2.2);
      T.box(0.1, 0.14, 0.93, 0.16, 0.16, 0.2, PR.zinc); const [jx, jy] = T.P(0.18, 0.22, 1.13); [-4, 0, 4].forEach((dx, k) => sprig(jx + dx, jy, 12 + (k % 2) * 3, PR.lavender)); },
    // Adobe: adobe plaster with a pine shelf line, a saltillo tile top, a copper basin, a black tap and a cactus at the end.
    adobe: (T, o) => { const a = cl(o);
      T.box(0, 0, 0, 2.8, 0.8, 0.86, a); T.box(0, 0, 0.78, 2.8, 0.8, 0.04, AD.pine); [0.7, 1.4, 2.1].forEach(x => T.line([x, 0.802, 0.04], [x, 0.802, 0.78], 'rgba(0,0,0,.1)', 1.2));
      for (let z = 0.12, r = 0; z < 0.7; z += 0.14, r++) for (let x = 0.06 + (r % 2) * 0.1; x < 2.76; x += 0.26) { const [dx, dy] = T.P(x, 0.801, z); ctx.beginPath(); ctx.moveTo(dx, dy - 2.5); ctx.lineTo(dx + 2.5, dy); ctx.lineTo(dx, dy + 2.5); ctx.lineTo(dx - 2.5, dy); ctx.closePath(); ctx.fillStyle = (r % 2) ? AD.turquoise : AD.rust; ctx.fill(); }
      T.box(-0.05, -0.04, 0.86, 2.9, 0.88, 0.07, '#CF8A5C'); for (let x = -0.05; x < 2.85; x += 0.36) T.line([x, -0.04, 0.931], [x, 0.84, 0.931], 'rgba(240,225,210,.45)', 1); for (let y = 0.0; y < 0.84; y += 0.3) T.line([-0.05, y, 0.931], [2.85, y, 0.931], 'rgba(240,225,210,.45)', 1); T.line([-0.05, 0.84, 0.86], [2.85, 0.84, 0.86], AD.pineDark, 1.2);
      T.poly([[0.3, 0.13, 0.932], [1.0, 0.13, 0.932], [1.0, 0.6, 0.932], [0.3, 0.6, 0.932]], PR.copper, 'rgba(0,0,0,.25)', 1); for (let x = 0.36; x < 1.0; x += 0.08) for (let y = 0.18; y < 0.6; y += 0.1) { const [hx, hy] = T.P(x, y, 0.933); circle(hx, hy, 1, 'rgba(255,255,255,.22)'); }
      T.line([0.65, 0.04, 0.93], [0.65, 0.04, 1.18], AD.black, 2.2); T.line([0.65, 0.04, 1.18], [0.65, 0.24, 1.12], AD.black, 2.2);
      T.box(0.08, 0.12, 0.93, 0.16, 0.16, 0.12, AD.adobeDark); const [cx, cy] = T.P(0.16, 0.2, 1.05); ell(cx, cy - 8, 3.5, 9, '#4F8A5A'); ell(cx - 5, cy - 9, 2, 5, '#4F8A5A', null, -0.4); ell(cx + 5, cy - 11, 2, 5, '#4F8A5A', null, 0.4); for (let k = 0; k < 4; k++) limb(cx - 1, cy - 3 - k * 4, cx + 1, cy - 3 - k * 4, '#F4ECD8', 0.8); circle(cx, cy - 17, 1.6, AD.rust); },
    // Neon: black steel with mesh fronts, a cyan strip at the kick, a dark glass top edged in magenta, a steel basin and a holo panel at the end.
    neon: (T, o) => { const b = cl(o);
      T.box(0, 0, 0, 2.8, 0.8, 0.86, b); for (let x = 0.04; x < 2.8; x += 0.08) T.line([x, 0.801, 0.14], [x, 0.801, 0.76], 'rgba(255,255,255,.07)', 1); for (let z = 0.18; z < 0.76; z += 0.08) T.line([0, 0.801, z], [2.8, 0.801, z], 'rgba(255,255,255,.06)', 1);
      [0.7, 1.4, 2.1].forEach(x => T.line([x, 0.802, 0.04], [x, 0.802, 0.84], NE.steel, 1.6)); neon(T, [0, 0.803, 0.08], [2.8, 0.803, 0.08], NE.cyan, power);
      T.box(-0.05, -0.04, 0.86, 2.9, 0.88, 0.07, NE.glass); neon(T, [-0.05, 0.84, 0.93], [2.85, 0.84, 0.93], NE.magenta, power); T.line([-0.05, 0.84, 0.86], [2.85, 0.84, 0.86], NE.steel, 1);
      T.poly([[0.3, 0.13, 0.932], [1.0, 0.13, 0.932], [1.0, 0.6, 0.932], [0.3, 0.6, 0.932]], NE.steel, 'rgba(255,255,255,.25)', 1); T.poly([[0.38, 0.2, 0.933], [0.92, 0.2, 0.933], [0.92, 0.53, 0.933], [0.38, 0.53, 0.933]], NE.mesh);
      T.line([0.65, 0.04, 0.93], [0.65, 0.04, 1.2], '#9AA0A6', 2.4); T.line([0.65, 0.04, 1.2], [0.65, 0.26, 1.13], '#9AA0A6', 2.4);
      T.box(0.1, 0.3, 0.93, 0.26, 0.02, 0.26, power ? NE.cyan : NE.steel); if (power) { T.poly([[0.1, 0.3, 0.93], [0.36, 0.3, 0.93], [0.36, 0.3, 1.19], [0.1, 0.3, 1.19]], hexA(NE.cyan, 0.3)); for (let z = 0.98; z < 1.18; z += 0.05) T.line([0.13, 0.29, z], [0.33 - (Math.round(z * 100) % 3) * 0.04, 0.29, z], NE.cyan, 1); } },
    // Candy: mint fronts with a scalloped top edge, a cream top with sprinkles, a pink basin, a cherry tap and a cupcake stand at the end.
    candy: (T, o) => { const m = cl(o);
      T.box(0, 0, 0, 2.8, 0.8, 0.86, m); [0.7, 1.4, 2.1].forEach(x => T.line([x, 0.802, 0.04], [x, 0.802, 0.84], 'rgba(0,0,0,.08)', 1.2));
      scallops(T, [0, 0.801, 0.86], [2.8, 0.801, 0.86], 14, 5, CA.cream); [0.35, 1.05, 1.75, 2.45].forEach(x => { const [px, py] = T.P(x, 0.803, 0.46); circle(px, py, 2.4, CA.cream); circle(px, py, 1.2, CA.cherry); });
      T.box(-0.05, -0.04, 0.86, 2.9, 0.88, 0.07, CA.cream); const [tx, ty] = T.P(1.1, 0.0, 0.931); sprinkles(tx, ty, 50, 30, 26, 0.1); T.line([-0.05, 0.84, 0.86], [2.85, 0.84, 0.86], CA.pink, 1.4);
      T.poly([[0.3, 0.13, 0.932], [1.0, 0.13, 0.932], [1.0, 0.6, 0.932], [0.3, 0.6, 0.932]], CA.pink, 'rgba(0,0,0,.12)', 1); T.poly([[0.38, 0.2, 0.933], [0.92, 0.2, 0.933], [0.92, 0.53, 0.933], [0.38, 0.53, 0.933]], CA.pinkDark);
      T.line([0.65, 0.04, 0.93], [0.65, 0.04, 1.18], CA.cherry, 2.2); T.line([0.65, 0.04, 1.18], [0.65, 0.24, 1.12], CA.cherry, 2.2);
      T.box(0.08, 0.12, 0.93, 0.2, 0.2, 0.02, CA.cream); T.line([0.18, 0.22, 0.95], [0.18, 0.22, 1.1], CA.cream, 2); T.box(0.08, 0.12, 1.1, 0.2, 0.2, 0.02, CA.cream); const [cx, cy] = T.P(0.18, 0.22, 1.12); ctx.beginPath(); ctx.moveTo(cx - 4, cy); ctx.lineTo(cx + 4, cy); ctx.lineTo(cx + 3, cy - 5); ctx.lineTo(cx - 3, cy - 5); ctx.closePath(); ctx.fillStyle = CA.butter; ctx.fill(); circle(cx, cy - 7, 3.5, CA.pink); circle(cx, cy - 10, 1.2, CA.cherry); },
  });
  Object.assign(LOOK_DRAWERS.fridge, {
    // Provence: cream enamel with lavender sprigs on the door, a toile band and iron handles. Returns the open door's colour.
    provence: (T, o) => { const body = cl(o);
      T.box(0, 0, 0, 0.9, 0.85, 1.95, body); T.line([0, 0.85, 1.3], [0.9, 0.85, 1.3], 'rgba(0,0,0,.18)', 1.2);
      [[0.2, 0.5], [0.42, 0.7], [0.62, 0.45], [0.3, 1.0], [0.55, 1.05]].forEach(([x, z], k) => { const [sx, sy] = T.P(x, 0.851, z); sprig(sx, sy, 10 + (k % 2) * 3, PR.lavender); });
      T.line([0.06, 0.851, 1.48], [0.84, 0.851, 1.48], PR.toile, 1.2); T.line([0.06, 0.851, 1.74], [0.84, 0.851, 1.74], PR.toile, 1.2); const [bx, by] = T.P(0.4, 0.851, 1.61); ell(bx, by, 4, 2.6, PR.toile); limb(bx - 7, by + 4, bx + 7, by + 4, PR.toile, 1); circle(bx - 6, by - 3, 1.4, PR.toile); circle(bx + 6, by - 3, 1.4, PR.toile);
      [[0.7, 1.15], [1.42, 1.78]].forEach(([z0, z1]) => T.line([0.78, 0.855, z0], [0.78, 0.855, z1], PR.iron, 3));
      return body; },
    // Adobe: a turquoise fridge with a serape band across the door, a rust handle and a cream cap. Returns the open door's colour.
    adobe: (T, o) => { const body = cl(o);
      T.box(0, 0, 0, 0.9, 0.85, 1.87, body); T.box(0, 0, 1.87, 0.9, 0.85, 0.08, AD.cream);
      T.line([0, 0.85, 1.3], [0.9, 0.85, 1.3], 'rgba(0,0,0,.25)', 1.2);
      serape(T, [0.06, 0.851, 0.5], [0.84, 0.851, 0.5], [AD.rust, AD.cream, AD.black, AD.cream, AD.rust], 0.08);
      for (let x = 0.1; x < 0.84; x += 0.12) { const [dx, dy] = T.P(x, 0.851, 1.55); ctx.beginPath(); ctx.moveTo(dx, dy - 3); ctx.lineTo(dx + 3, dy); ctx.lineTo(dx, dy + 3); ctx.lineTo(dx - 3, dy); ctx.closePath(); ctx.fillStyle = AD.cream; ctx.fill(); }
      [[0.7, 1.15], [1.42, 1.78]].forEach(([z0, z1]) => T.line([0.78, 0.855, z0], [0.78, 0.855, z1], AD.rust, 3.4));
      return body; },
    // Neon: a black body with a magenta strip down the door, a cyan holo panel and a glowing seam between the doors. Returns the open door's colour.
    neon: (T, o) => { const body = cl(o);
      T.box(0, 0, 0, 0.9, 0.85, 0.06, NE.steel); T.box(0, 0, 0.06, 0.9, 0.85, 1.89, body);
      neon(T, [0, 0.851, 1.3], [0.9, 0.851, 1.3], NE.cyan, power);
      neon(T, [0.14, 0.852, 0.14], [0.14, 0.852, 1.22], NE.magenta, power); neon(T, [0.14, 0.852, 1.38], [0.14, 0.852, 1.88], NE.magenta, power);
      T.poly([[0.3, 0.851, 0.6], [0.66, 0.851, 0.6], [0.66, 0.851, 0.98], [0.3, 0.851, 0.98]], power ? hexA(NE.cyan, 0.22) : NE.mesh, power ? NE.cyan : NE.steel, 1); if (power) for (let z = 0.66; z < 0.96; z += 0.06) T.line([0.34, 0.852, z], [0.62 - (Math.round(z * 100) % 4) * 0.05, 0.852, z], NE.cyan, 1);
      [[0.7, 1.15], [1.42, 1.78]].forEach(([z0, z1]) => T.line([0.78, 0.855, z0], [0.78, 0.855, z1], NE.steel, 3.2));
      return body; },
    // Candy: a pastel pink fridge with a bow on the upper door, sprinkles on the lower one and cream handles. Returns the open door's colour.
    candy: (T, o) => { const body = cl(o);
      T.box(0, 0, 0, 0.9, 0.85, 1.87, body); T.box(0, 0, 1.87, 0.9, 0.85, 0.08, CA.cream); scallops(T, [0, 0.851, 1.87], [0.9, 0.851, 1.87], 6, 4, CA.cream);
      T.line([0, 0.85, 1.3], [0.9, 0.85, 1.3], 'rgba(0,0,0,.14)', 1.2);
      const [bx, by] = T.P(0.4, 0.851, 1.6); ell(bx - 7, by, 6, 3.5, CA.cherry, null, -0.35); ell(bx + 7, by, 6, 3.5, CA.cherry, null, 0.35); circle(bx, by, 2.6, CA.cherry); limb(bx - 2, by + 2, bx - 5, by + 10, CA.cherry, 1.6); limb(bx + 2, by + 2, bx + 5, by + 10, CA.cherry, 1.6);
      const [sx, sy] = T.P(0.08, 0.851, 1.2); sprinkles(sx, sy, 34, 40, 18, 0.4);
      [[0.7, 1.15], [1.42, 1.78]].forEach(([z0, z1]) => T.line([0.78, 0.855, z0], [0.78, 0.855, z1], CA.cream, 3.4));
      return body; },
  });

  // ---- Cuddle Clouds: pastel bears, clouds, rainbows, hearts and stars ----
  const CC = { cloud: '#FFFFFF', cloudShade: '#E4ECF6', sky: '#AEDDF7', skyDeep: '#8EC9F2', pink: '#F6B7CC', pinkDeep: '#EE8FAE', yellow: '#F9E27A', green: '#9FDB9A', orange: '#F7B46A', lilac: '#C7A8F0', red: '#F58A8A', bear: '#F6B7CC', bearBlue: '#9CCBF2', bearYellow: '#F9E27A', muzzle: '#FFF4E6', ink: '#5A4A5E', bands: ['#F58A8A', '#F7B46A', '#F9E27A', '#9FDB9A', '#8EC9F2', '#C7A8F0'] };
  /** A cloud in screen space: a row of puffs on a flat base. */
  const cloud = (sx, sy, w, col = CC.cloud) => { ell(sx, sy + 1, w, w * 0.4, col); circle(sx - w * 0.45, sy - w * 0.1, w * 0.36, col); circle(sx, sy - w * 0.3, w * 0.46, col); circle(sx + w * 0.45, sy - w * 0.05, w * 0.34, col); };
  /** A rainbow arc in screen space: the six pastel bands, outermost first. */
  const rainbow = (sx, sy, r, w, a0 = Math.PI, a1 = Math.PI * 2) => { CC.bands.forEach((c, k) => { ctx.beginPath(); ctx.arc(sx, sy, Math.max(0.4, r - k * w), a0, a1); ctx.strokeStyle = c; ctx.lineWidth = w; ctx.stroke(); }); };
  /** A bear's face in screen space: round head, round ears, a pale muzzle, two eyes and a nose. */
  const bearFace = (sx, sy, r, col) => { circle(sx - r * 0.75, sy - r * 0.7, r * 0.36, col); circle(sx + r * 0.75, sy - r * 0.7, r * 0.36, col); circle(sx - r * 0.75, sy - r * 0.7, r * 0.18, CC.muzzle); circle(sx + r * 0.75, sy - r * 0.7, r * 0.18, CC.muzzle); circle(sx, sy, r, col); ell(sx, sy + r * 0.3, r * 0.5, r * 0.36, CC.muzzle); circle(sx - r * 0.35, sy - r * 0.15, r * 0.1, CC.ink); circle(sx + r * 0.35, sy - r * 0.15, r * 0.1, CC.ink); ell(sx, sy + r * 0.2, r * 0.14, r * 0.1, CC.ink); };
  /** A five-point star in screen space. */
  const star5 = (sx, sy, r, col) => { ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; ctx.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr); } ctx.closePath(); ctx.fillStyle = col; ctx.fill(); };
  /** A rainbow band along a line in the piece's frame: six stripes stacked in z. */
  const rainbowBand = (T, from, to, w) => { CC.bands.forEach((c, k) => T.line([from[0], from[1], from[2] + k * w], [to[0], to[1], to[2] + k * w], c, 1.8)); };
  Object.assign(LOOK_DRAWERS.sofa, {
    // Cuddle Clouds: a puffy white cloud sofa with a rainbow band along the base, sky-blue cushions with a heart and a star, and a bear plush in the corner.
    cuddle: (o, s1, s2) => { const c = cl(o); return [
      B(0, 0, 0, 2.4, 1.0, 0.38, c, { name: 'base' }), B(0, 0, 0.38, 2.4, 0.3, 0.52, c), B(0, 0, 0.38, 0.24, 1.0, 0.3, c), B(2.16, 0, 0.38, 0.24, 1.0, 0.3, c),
      B(0.24, 0.3, 0.38 - s1 * 0.018, 0.96, 0.66, 0.1 - s1 * 0.035, CC.sky), B(1.2, 0.3, 0.38 - s2 * 0.018, 0.96, 0.66, 0.1 - s2 * 0.035, CC.sky),
      F(0, 0, 2.4, 1.0, (T) => {
        for (let x = 0.3; x < 2.3; x += 0.4) { const [px, py] = T.P(x, 0.15, 0.9); ell(px, py, 9, 5, c, 'rgba(0,0,0,.06)'); } [[0.12, 0.5], [2.28, 0.5]].forEach(([x, y]) => { const [px, py] = T.P(x, y, 0.68); ell(px, py, 7, 4.5, c, 'rgba(0,0,0,.06)'); });
        rainbowBand(T, [0.02, 1.001, 0.06], [2.38, 1.001, 0.06], 0.035);
        const [hx, hy] = T.P(0.72, 0.481, 0.62); heart(hx, hy, 1.33, CC.pinkDeep); const [sx, sy] = T.P(1.68, 0.481, 0.62); star5(sx, sy, 5, CC.yellow);
        const [bx, by] = T.P(2.0, 0.5, 0.62); ell(bx, by + 4, 6, 5, CC.bearYellow); bearFace(bx, by - 4, 5, CC.bearYellow); heart(bx, by + 4, 0.67, CC.pinkDeep);
      }, { onTop: true })]; },
  });
  Object.assign(LOOK_DRAWERS.dining, {
    // Cuddle Clouds: a cloud table on a stack of puffs, chairs with bear-face backs in pink and blue, and a rainbow hanging from a cloud.
    cuddle: (o) => { const ps = [], c = cl(o);
      const chair = (y0, back, col) => { [[0.39, y0 + 0.04], [0.83, y0 + 0.04], [0.39, y0 + 0.48], [0.83, y0 + 0.48]].forEach(([x, y]) => ps.push(B(x, y, 0, 0.05, 0.05, 0.42, CC.cloud)));
        ps.push(B(0.35, y0, 0.42, 0.6, 0.58, 0.07, col, { name: y0 === 0 ? 'seat1' : 'seat2' }));
        ps.push(F(0.35, back - 0.02, 0.95, back + 0.08, (T) => { const [cx, cy] = T.P(0.65, back + 0.03, 0.56); bearFace(cx, cy, 9, col); }, { onTop: true })); };
      chair(0, 0, CC.bear); chair(1.89, 2.42, CC.bearBlue);
      ps.push(B(0.45, 1.04, 0, 0.4, 0.4, 0.2, CC.cloud), B(0.5, 1.09, 0.2, 0.3, 0.3, 0.25, CC.cloudShade), B(0.45, 1.04, 0.45, 0.4, 0.4, 0.25, CC.cloud));
      ps.push(B(0, 0.74, 0.7, 1.3, 1.0, 0.07, c, { name: 'top' }));
      ps.push(F(0, 0.74, 1.3, 1.74, (T) => { scallops(T, [0, 1.74, 0.7], [1.3, 1.74, 0.7], 7, 5, c); scallops(T, [1.3, 0.74, 0.7], [1.3, 1.74, 0.7], 5, 5, c); const [rx, ry] = T.P(0.3, 1.5, 0.772); rainbow(rx, ry, 8, 1.4); [[1.1, 0.9], [0.2, 0.95]].forEach(([x, y], k) => { const [px, py] = T.P(x, y, 0.772); k ? star5(px, py, 3, CC.yellow) : heart(px, py, 0.87, CC.pinkDeep); }); }, { onTop: true }));
      ps.push(diningLife(), diningLight('rainbow'));
      return ps; },
  });
  Object.assign(LOOK_DRAWERS.lamp, {
    // Cuddle Clouds: a cloud shade on a sky-blue pole with a star on top and rainbow drops hanging under it.
    cuddle: (T, o) => { const lit = isLit(o.id), c = cl(o);
      T.box(0.06, 0.06, 0, 0.28, 0.28, 0.05, CC.sky); const [bx, by] = T.P(0.2, 0.2, 0.05); cloud(bx, by - 2, 7, CC.cloud); T.line([0.2, 0.2, 0.05], [0.2, 0.2, 1.3], CC.sky, 2.6);
      const [px, py] = T.P(0.2, 0.2, 1.42); if (lit) ell(px, py + 4, 20, 12, 'rgba(255,241,201,.28)'); cloud(px, py, 15, lit ? '#FFFDF2' : c);
      CC.bands.forEach((col, k) => { const x = px - 10 + k * 4; limb(x, py + 6, x, py + 12 + (k % 2) * 3, col, 1); circle(x, py + 13 + (k % 2) * 3, 1.5, col); });
      star5(px, py - 12, 4, lit ? CC.yellow : CC.cloudShade); },
  });
  Object.assign(LOOK_DRAWERS.plant, {
    // Cuddle Clouds: a puffy white pot with cloud bumps round the rim and a rainbow on the front.
    cuddle: (T, o) => { const c = cl(o); T.box(0.05, 0.05, 0, 0.4, 0.4, 0.4, c); for (let x = 0.1; x < 0.45; x += 0.1) { const [px, py] = T.P(x, 0.451, 0.4); circle(px, py, 3.2, c); } for (let y = 0.1; y < 0.45; y += 0.1) { const [px, py] = T.P(0.451, y, 0.4); circle(px, py, 3.2, c); } const [rx, ry] = T.P(0.25, 0.452, 0.14); rainbow(rx, ry, 6, 1.1); const [sx, sy] = T.P(0.452, 0.25, 0.22); star5(sx, sy, 2.6, CC.yellow); },
  });
  Object.assign(LOOK_DRAWERS.counter, {
    // Cuddle Clouds: cloud-white fronts with a rainbow band at the kick, cloud puffs along the top edge, a sky top with stars, a pink heart basin and a bear plush at the end.
    cuddle: (T, o) => { const c = cl(o);
      T.box(0, 0, 0, 2.8, 0.8, 0.86, c); [0.7, 1.4, 2.1].forEach(x => T.line([x, 0.802, 0.1], [x, 0.802, 0.84], 'rgba(0,0,0,.07)', 1.2));
      rainbowBand(T, [0, 0.801, 0.06], [2.8, 0.801, 0.06], 0.035); [0.35, 1.05, 1.75, 2.45].forEach((x, k) => { const [px, py] = T.P(x, 0.803, 0.5); k % 2 ? heart(px, py, 1.17, CC.pinkDeep) : star5(px, py, 4, CC.yellow); });
      for (let x = 0.12; x < 2.8; x += 0.25) { const [px, py] = T.P(x, 0.801, 0.86); circle(px, py, 4, c); }
      T.box(-0.05, -0.04, 0.86, 2.9, 0.88, 0.07, CC.sky); for (let k = 0; k < 12; k++) { const x = ((k * 0.618 * 5.3) % 2.8) + 0.0, y = (k * 0.414 * 3.1) % 0.8; const [sx, sy] = T.P(x, y, 0.931); star5(sx, sy, 2.2, k % 3 ? CC.cloud : CC.yellow); } T.line([-0.05, 0.84, 0.86], [2.85, 0.84, 0.86], CC.skyDeep, 1.2);
      T.poly([[0.3, 0.13, 0.932], [1.0, 0.13, 0.932], [1.0, 0.6, 0.932], [0.3, 0.6, 0.932]], CC.pink, 'rgba(0,0,0,.1)', 1); const [hx, hy] = T.P(0.65, 0.37, 0.933); heart(hx, hy, 2.33, CC.pinkDeep);
      T.line([0.65, 0.04, 0.93], [0.65, 0.04, 1.18], CC.yellow, 2.2); T.line([0.65, 0.04, 1.18], [0.65, 0.24, 1.12], CC.yellow, 2.2);
      const [bx, by] = T.P(0.18, 0.22, 0.95); ell(bx, by - 4, 6, 6, CC.bearBlue); ell(bx - 5, by, 2.5, 3, CC.bearBlue); ell(bx + 5, by, 2.5, 3, CC.bearBlue); bearFace(bx, by - 13, 5, CC.bearBlue); rainbow(bx, by - 2, 3.5, 0.8); },
  });
  Object.assign(LOOK_DRAWERS.fridge, {
    // Cuddle Clouds: a sky-blue fridge with a cloud cap, a rainbow across the upper door, a bear's face on the lower one and heart handles. Returns the open door's colour.
    cuddle: (T, o) => { const body = cl(o);
      T.box(0, 0, 0, 0.9, 0.85, 1.87, body); T.box(0, 0, 1.87, 0.9, 0.85, 0.08, CC.cloud); for (let x = 0.1; x < 0.9; x += 0.16) { const [px, py] = T.P(x, 0.851, 1.95); circle(px, py, 4, CC.cloud); }
      T.line([0, 0.85, 1.3], [0.9, 0.85, 1.3], 'rgba(0,0,0,.12)', 1.2);
      const [rx, ry] = T.P(0.4, 0.851, 1.42); rainbow(rx, ry, 15, 2.2); cloud(rx - 14, ry + 2, 6); cloud(rx + 14, ry + 2, 6);
      const [bx, by] = T.P(0.4, 0.851, 0.7); bearFace(bx, by, 11, CC.bear); heart(bx, by + 16, 1.17, CC.pinkDeep);
      [[0.95, 1.1], [1.55, 1.72]].forEach(([z0, z1]) => { T.line([0.78, 0.855, z0], [0.78, 0.855, z1], CC.cloud, 3.2); const [hx, hy] = T.P(0.78, 0.856, (z0 + z1) / 2); heart(hx, hy, 0.8, CC.pinkDeep); });
      for (let k = 0; k < 5; k++) { const [sx, sy] = T.P(0.1 + (k * 0.618 * 2.3) % 0.7, 0.851, 0.2 + (k * 0.414 * 1.7) % 0.3); star5(sx, sy, 2, CC.yellow); }
      return body; },
  });

  // ---- Arcade: black cabinets, marquee lights, neon piping and the carpet from every arcade you remember ----
  const AR = { ink: '#15121F', cab: '#1E1A2E', magenta: '#FF2E9A', cyan: '#19E6F0', yellow: '#F4C430', red: '#E63946', violet: '#7A5CFF', green: '#39D353', chrome: '#9AA0A6', vinyl: '#C2413A', carpet: '#1E1740' };
  /** Chasing marquee bulbs along a screen-space line: lit in sequence while on, dark while off. */
  const chaser = (x0, y0, x1, y1, n, seed, on) => { const step = Math.floor(animT * 6 + (typeof seed === 'string' ? seed.length : 0)); for (let k = 0; k <= n; k++) { const u = k / n, lit = on && (k + step) % 3 === 0; circle(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, 1.3, lit ? '#FFF6C8' : on ? AR.yellow : '#4A4036'); if (lit) circle(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, 2.6, 'rgba(255,246,200,.3)'); } };
  /** A pixel sprite in screen space: rows of 0/1 strings, each 1 a square of side px. */
  const sprite = (sx, sy, px, rows, col) => { ctx.fillStyle = col; rows.forEach((row, r) => { for (let c = 0; c < row.length; c++) if (row[c] === '1') ctx.fillRect(sx + (c - row.length / 2) * px, sy + (r - rows.length / 2) * px, px, px); }); };
  const INVADER = ['0100010', '0011100', '0111110', '1101011', '1111111', '0100010', '1000001'];
  const PIXHEART = ['01010', '11111', '11111', '01110', '00100'];
  /** The arcade screen colour: a slow hue cycle with the power on, a fast one while someone plays. */
  const screenHue = (t, playing) => power ? `hsl(${(t * (playing ? 400 : 60)) % 360},90%,${playing ? 60 + Math.sin(t * 20) * 8 : 48}%)` : '#0E0C14';
  Object.assign(LOOK_DRAWERS.sofa, {
    // Arcade: black vinyl with yellow piping, red cushions with pixel hearts and a chaser strip along the base.
    arcade: (o, s1, s2) => { const v = cl(o), vc = shade(v, 0.06); return [
      B(0, 0, 0, 2.4, 1.0, 0.1, AR.ink), B(0, 0, 0.1, 2.4, 1.0, 0.28, v, { name: 'base' }), B(0, 0, 0.38, 2.4, 0.3, 0.54, v), B(0, 0, 0.38, 0.22, 1.0, 0.32, v), B(2.18, 0, 0.38, 0.22, 1.0, 0.32, v),
      B(0.22, 0.3, 0.38 - s1 * 0.018, 0.98, 0.66, 0.1 - s1 * 0.035, AR.red), B(1.2, 0.3, 0.38 - s2 * 0.018, 0.98, 0.66, 0.1 - s2 * 0.035, AR.red),
      B(0.3, 0.34, 0.48, 0.42, 0.14, 0.3, AR.cyan), B(1.7, 0.34, 0.48, 0.42, 0.14, 0.3, AR.magenta),
      F(0, 0, 2.4, 1.0, (T, ob) => {
        T.line([0, 1.002, 0.38], [2.4, 1.002, 0.38], AR.yellow, 1.4); T.line([0.22, 0.301, 0.9], [2.18, 0.301, 0.9], AR.yellow, 1.4); [[0.11, 0.7], [2.29, 0.7]].forEach(([x, z]) => T.line([x, 0.0, z], [x, 1.0, z], AR.yellow, 1.2));
        const [ax, ay] = T.P(0.04, 1.003, 0.1), [bx, by] = T.P(2.36, 1.003, 0.1); chaser(ax, ay, bx, by, 18, ob.id, power);
        [[0.5, AR.yellow], [1.9, AR.cyan]].forEach(([x, c]) => { const [hx, hy] = T.P(x, 0.481, 0.62); sprite(hx, hy, 1.6, PIXHEART, c); });
        const [gx, gy] = T.P(1.2, 0.301, 0.66); sprite(gx, gy, 1.8, INVADER, AR.green);
      }, { onTop: true })]; },
  });
  Object.assign(LOOK_DRAWERS.dining, {
    // Arcade: a cocktail cabinet to eat off, the screen glowing up through the top, two red vinyl stools and a marquee overhead.
    arcade: (o) => { const ps = [], cab = cl(o);
      const stool = (y0) => { ps.push(B(0.55, y0 + 0.19, 0, 0.2, 0.2, 0.04, AR.chrome), B(0.62, y0 + 0.26, 0.04, 0.06, 0.06, 0.31, AR.chrome), B(0.4, y0 + 0.04, 0.35, 0.5, 0.5, 0.07, AR.vinyl), B(0.35, y0, 0.42, 0.6, 0.58, 0.07, AR.vinyl, { name: y0 === 0 ? 'seat1' : 'seat2' })); ps.push(F(0.35, y0, 0.95, y0 + 0.58, (T) => { T.line([0.36, y0 + 0.581, 0.45], [0.94, y0 + 0.581, 0.45], AR.chrome, 1.2); }, { onTop: true })); };
      stool(0); stool(1.89);
      ps.push(B(0.05, 0.79, 0, 1.2, 0.9, 0.7, cab));
      ps.push(B(0, 0.74, 0.7, 1.3, 1.0, 0.07, AR.ink, { name: 'top' }));
      ps.push(F(0, 0.74, 1.3, 1.74, (T, ob, t) => { T.poly([[0.18, 0.9, 0.772], [1.12, 0.9, 0.772], [1.12, 1.58, 0.772], [0.18, 1.58, 0.772]], screenHue(t, usingSlot(ob.id + ':c1') || usingSlot(ob.id + ':c2') || live(ob.id))); const [gx, gy] = T.P(0.65, 1.24, 0.773); sprite(gx, gy, 1.4, INVADER, 'rgba(0,0,0,.45)'); T.line([0, 0.74, 0.77], [1.3, 0.74, 0.77], AR.cyan, 1.2); T.line([1.3, 0.74, 0.77], [1.3, 1.74, 0.77], AR.cyan, 1.2); [[0.1, 1.7], [1.2, 0.78]].forEach(([x, y]) => { const [jx, jy] = T.P(x, y, 0.772); circle(jx, jy, 2, AR.red); circle(jx + 4, jy, 1.4, AR.yellow); }); for (let x = 0.1; x < 1.2; x += 0.12) { const [cx, cy] = T.P(x, 1.741, 0.2); circle(cx, cy, 1.2, AR.yellow); } }, { onTop: true }));
      ps.push(diningLife(), diningLight('marquee'));
      return ps; },
  });
  Object.assign(LOOK_DRAWERS.lamp, {
    // Arcade: a joystick lamp, a red ball on a black stick that glows, on a base ringed with marquee bulbs.
    arcade: (T, o) => { const lit = isLit(o.id), ball = cl(o);
      T.box(0.02, 0.02, 0, 0.36, 0.36, 0.1, AR.ink); T.box(0.06, 0.06, 0.1, 0.28, 0.28, 0.04, AR.chrome); const [ax, ay] = T.P(0.04, 0.381, 0.06), [bx, by] = T.P(0.36, 0.381, 0.06); chaser(ax, ay, bx, by, 5, o.id, power); const [cx, cy] = T.P(0.381, 0.04, 0.06), [dx, dy] = T.P(0.381, 0.36, 0.06); chaser(cx, cy, dx, dy, 5, o.id, power);
      [[0.1, 0.3, AR.yellow], [0.3, 0.3, AR.cyan]].forEach(([x, y, c]) => { const [px, py] = T.P(x, y, 0.14); circle(px, py, 2.6, c); });
      T.line([0.2, 0.2, 0.14], [0.2, 0.2, 1.35], AR.ink, 4); const [kx, ky] = T.P(0.2, 0.2, 0.6); ell(kx, ky, 4, 2, AR.ink);
      const [px, py] = T.P(0.2, 0.2, 1.45); if (lit) circle(px, py, 18, hexA(ball, 0.18)); circle(px, py, 11, lit ? shade(ball, 0.25) : ball, 'rgba(0,0,0,.2)'); circle(px - 4, py - 4, 3, 'rgba(255,255,255,.55)'); },
  });
  Object.assign(LOOK_DRAWERS.plant, {
    // Arcade: a black pot with a pixel invader on the front and a pixel coin on the side.
    arcade: (T, o) => { const g = cl(o); T.box(0.05, 0.05, 0, 0.4, 0.4, 0.42, g); T.line([0.05, 0.451, 0.4], [0.45, 0.451, 0.4], AR.cyan, 1.4); T.line([0.451, 0.05, 0.4], [0.451, 0.45, 0.4], AR.cyan, 1.4); const [ix, iy] = T.P(0.25, 0.452, 0.22); sprite(ix, iy, 1.5, INVADER, AR.green); const [cx, cy] = T.P(0.452, 0.25, 0.22); sprite(cx, cy, 1.4, ['0110', '1111', '1111', '0110'], AR.yellow); },
  });
  Object.assign(LOOK_DRAWERS.counter, {
    // Arcade: black cabinet fronts with coin slots, a chaser strip under a cyan-edged top, a steel basin, and a joystick and buttons at the end.
    arcade: (T, o) => { const c = cl(o);
      T.box(0, 0, 0, 2.8, 0.8, 0.86, c); [0.7, 1.4, 2.1].forEach(x => T.line([x, 0.802, 0.04], [x, 0.802, 0.84], AR.chrome, 1.2));
      [0.35, 1.05, 1.75, 2.45].forEach(x => { T.poly([[x - 0.12, 0.803, 0.44], [x + 0.12, 0.803, 0.44], [x + 0.12, 0.803, 0.56], [x - 0.12, 0.803, 0.56]], AR.yellow); T.line([x - 0.05, 0.804, 0.5], [x + 0.05, 0.804, 0.5], AR.ink, 1.6); T.line([x - 0.16, 0.803, 0.1], [x + 0.16, 0.803, 0.1], AR.magenta, 1.4); T.line([x - 0.16, 0.803, 0.78], [x + 0.16, 0.803, 0.78], AR.cyan, 1.4); });
      const [ax, ay] = T.P(0, 0.803, 0.84), [bx, by] = T.P(2.8, 0.803, 0.84); chaser(ax, ay, bx, by, 24, o.id, power);
      T.box(-0.05, -0.04, 0.86, 2.9, 0.88, 0.07, AR.ink); neon(T, [-0.05, 0.84, 0.93], [2.85, 0.84, 0.93], AR.cyan, power);
      const [sx, sy] = T.P(0.65, 0.37, 0.931); ell(sx, sy, 12, 6.5, AR.chrome, 'rgba(255,255,255,.3)'); ell(sx, sy + 0.8, 9, 4.6, '#6B7078');
      T.line([0.65, 0.04, 0.93], [0.65, 0.04, 1.2], AR.chrome, 2.4); T.line([0.65, 0.04, 1.2], [0.65, 0.26, 1.13], AR.chrome, 2.4);
      T.box(0.06, 0.1, 0.93, 0.3, 0.26, 0.05, AR.cab); T.line([0.14, 0.2, 0.98], [0.14, 0.2, 1.12], AR.ink, 2.2); const [jx, jy] = T.P(0.14, 0.2, 1.13); circle(jx, jy, 3.2, AR.red); [[0.24, 0.16, AR.yellow], [0.3, 0.22, AR.cyan], [0.24, 0.28, AR.green]].forEach(([x, y, col]) => { const [px, py] = T.P(x, y, 0.985); circle(px, py, 1.8, col); }); },
  });
  Object.assign(LOOK_DRAWERS.fridge, {
    // Arcade: a black cabinet with a marquee on top, a screen glowing in the upper door, a control panel on the lower one and a joystick-ball handle. Returns the open door's colour.
    arcade: (T, o) => { const body = cl(o);
      T.box(0, 0, 0, 0.9, 0.85, 1.75, body); T.box(0, 0, 1.75, 0.9, 0.85, 0.2, AR.yellow); T.line([0, 0.85, 1.3], [0.9, 0.85, 1.3], AR.chrome, 1.2);
      const [mx, my] = T.P(0.05, 0.851, 1.92), [nx, ny] = T.P(0.85, 0.851, 1.92); chaser(mx, my, nx, ny, 8, o.id, power); const [px2, py2] = T.P(0.05, 0.851, 1.78), [qx, qy] = T.P(0.85, 0.851, 1.78); chaser(px2, py2, qx, qy, 8, o.id, power);
      T.poly([[0.1, 0.851, 1.38], [0.8, 0.851, 1.38], [0.8, 0.851, 1.7], [0.1, 0.851, 1.7]], screenHue(animT, live(o.id))); const [ix, iy] = T.P(0.45, 0.852, 1.54); sprite(ix, iy, 1.6, INVADER, 'rgba(0,0,0,.4)');
      T.poly([[0.08, 0.851, 0.14], [0.82, 0.851, 0.14], [0.82, 0.851, 0.34], [0.08, 0.851, 0.34]], AR.cab); [[0.22, AR.red], [0.34, AR.yellow], [0.46, AR.cyan], [0.58, AR.green]].forEach(([x, c]) => { const [bx, by] = T.P(x, 0.852, 0.24); circle(bx, by, 2.4, c); });
      T.line([0.1, 0.851, 0.5], [0.8, 0.851, 0.5], AR.magenta, 1.4); T.line([0.1, 0.851, 1.2], [0.8, 0.851, 1.2], AR.magenta, 1.4);
      T.line([0.78, 0.855, 0.62], [0.78, 0.855, 1.1], AR.ink, 3.4); const [hx, hy] = T.P(0.78, 0.856, 1.1); circle(hx, hy, 3, AR.red); T.line([0.78, 0.855, 1.42], [0.78, 0.855, 1.7], AR.ink, 3.4);
      return body; },
  });

  const DRAWN = {
    sofa: {    
      parts: (o) => { const s1 = usingSlot(o.id + ':s1') ? 1 : 0, s2 = usingSlot(o.id + ':s2') ? 1 : 0;
        if (LOOK_DRAWERS.sofa[skinId(o)]) return LOOK_DRAWERS.sofa[skinId(o)](o, s1, s2);
        // Retro: a vinyl davenport, buttoned back and chrome trim, in the piece's colour. Same blocks, same seats.
        if (skinId(o) === 'retro') {
          const v = cl(o), vc = shade(v, 0.2);
          return [B(0, 0, 0.38, 2.4, 0.32, 0.6, v), B(0, 0, 0, 2.4, 1.0, 0.38, v, { name: 'base' }),
            B(0.2, 0.32, 0.38 - s1 * 0.018, 1.0, 0.62, 0.1 - s1 * 0.035, vc),
            B(1.2, 0.32, 0.38 - s2 * 0.018, 1.0, 0.62, 0.1 - s2 * 0.035, vc),
            B(0, 0, 0, 0.2, 1.0, 0.62, v), B(2.2, 0, 0, 0.2, 1.0, 0.62, v), B(0.26, 0.34, 0.48, 0.42, 0.14, 0.32, '#F4EAD0'),
            F(0, 0, 2.4, 1.0, (T) => {
              T.line([0, 1.0, 0.38], [2.4, 1.0, 0.38], '#E8ECEF', 2.2);
              for (let i = 0; i < 6; i++) { const [bx, by] = T.P(0.3 + i * 0.36, 0.33, 0.78); circle(bx, by, 1.5, shade(v, -0.35)); }
            }, { onTop: true })];
        }
        // Modern: a low sofa with tight flat cushions, slab arms and a thin dark plinth.
        if (skinId(o) === 'modern') {
          const v = cl(o), vc = shade(v, 0.12);
          return [B(0, 0, 0.38, 2.4, 0.32, 0.6, v), B(0, 0, 0, 2.4, 1.0, 0.38, v, { name: 'base' }), B(0.02, 0.02, 0, 2.36, 0.96, 0.06, '#1B1A1F'),
            B(0.2, 0.32, 0.38 - s1 * 0.018, 1.0, 0.62, 0.1 - s1 * 0.035, vc),
            B(1.2, 0.32, 0.38 - s2 * 0.018, 1.0, 0.62, 0.1 - s2 * 0.035, vc),
            B(0, 0, 0, 0.2, 1.0, 0.62, shade(v, -0.12)), B(2.2, 0, 0, 0.2, 1.0, 0.62, shade(v, -0.12)),
            F(0, 0, 2.4, 1.0, (T) => { T.line([1.2, 0.33, 0.48], [1.2, 0.94, 0.48], 'rgba(0,0,0,.4)', 1); T.line([0.2, 1.001, 0.06], [2.2, 1.001, 0.06], 'rgba(0,0,0,.5)', 1.6); }, { onTop: true })];
        }
        // Farmhouse: a linen slipcover sofa with a skirt, welted seams and a gingham cushion.
        if (skinId(o) === 'farmhouse') {
          const v = cl(o), vc = shade(v, 0.1);
          return [B(0, 0, 0.38, 2.4, 0.32, 0.6, v), B(0, 0, 0, 2.4, 1.0, 0.38, v, { name: 'base' }),
            B(0.2, 0.32, 0.38 - s1 * 0.018, 1.0, 0.62, 0.1 - s1 * 0.035, vc),
            B(1.2, 0.32, 0.38 - s2 * 0.018, 1.0, 0.62, 0.1 - s2 * 0.035, vc),
            B(0, 0, 0, 0.2, 1.0, 0.62, v), B(2.2, 0, 0, 0.2, 1.0, 0.62, v), B(0.26, 0.34, 0.48, 0.42, 0.14, 0.32, '#F4F1E8'),
            F(0, 0, 2.4, 1.0, (T) => {
              for (let x = 0.08; x < 2.4; x += 0.12) T.line([x, 1.001, 0], [x, 1.001, 0.13], 'rgba(90,70,40,.3)', 1);
              T.line([0, 1.001, 0.13], [2.4, 1.001, 0.13], 'rgba(90,70,40,.35)', 1.4); T.line([0.2, 1.002, 0.38], [2.2, 1.002, 0.38], 'rgba(255,255,255,.55)', 1.2);
              const [gx, gy] = T.P(0.47, 0.5, 0.55); for (let k = -1; k <= 1; k++) { limb(gx + k * 4 - 6, gy - 8, gx + k * 4 - 6, gy + 6, 'rgba(194,65,58,.7)', 1.6); limb(gx - 8, gy + k * 3, gx + 8, gy + k * 3, 'rgba(194,65,58,.55)', 1.4); }
            }, { onTop: true })];
        }
        return [B(0, 0, 0.38, 2.4, 0.32, 0.6, C.sofa), B(0, 0, 0, 2.4, 1.0, 0.38, C.sofa, { name: 'base' }),
          B(0.2, 0.32, 0.38 - s1 * 0.018, 1.0, 0.62, 0.1 - s1 * 0.035, C.cushion),
          B(1.2, 0.32, 0.38 - s2 * 0.018, 1.0, 0.62, 0.1 - s2 * 0.035, C.cushion),
          B(0, 0, 0, 0.2, 1.0, 0.62, C.sofa), B(2.2, 0, 0, 0.2, 1.0, 0.62, C.sofa), B(0.26, 0.34, 0.48, 0.42, 0.14, 0.32, '#E0A43A')]; },
       },
    bed: {    
      parts: (o) => { if (LOOK_DRAWERS.bed[skinId(o)]) return LOOK_DRAWERS.bed[skinId(o)](o); const lux = has('bed'), z = lux ? 0.56 : 0.5; return [B(0, 0, 0, 0.14, 1.6, lux ? 1.3 : 1.0, lux ? '#6E4A5E' : C.dark), B(0.14, 0, 0, 2.36, 1.6, 0.32, lux ? '#5A3E4C' : C.wood), B(0.18, 0.04, 0.32, 2.28, 1.52, lux ? 0.24 : 0.18, '#F1ECE4', { name: 'mattress' }),
        B(0.23, 0.12, z, 0.5, 0.58, 0.12, '#FFFFFF'), B(0.23, 0.9, z, 0.5, 0.58, 0.12, '#FFFFFF'), B(0.95, 0, z, 1.55, 1.6, 0.07, lux ? '#C9A24A' : '#3D6B73', { cover: true }), B(0.95, 0, z + 0.07, 0.2, 1.6, 0.02, lux ? '#E0C26E' : '#5E8A92', { cover: true })]; },
       },
    // The single beds two friends sleep in: the same bed, one pillow wide.
    bedA: { parts: () => singleBed('#3D6B73', '#5E8A92') },
    bedB: { parts: () => singleBed('#7E4458', '#9A5C72') },
    dining: {    
      parts: (o) => {
        if (LOOK_DRAWERS.dining[skinId(o)]) return LOOK_DRAWERS.dining[skinId(o)](o);
        const ps = [];
        // Retro: a boomerang-top laminate table on chrome legs, with vinyl chairs in the piece's colour.
        const rt = skinId(o) === 'retro', fm = skinId(o) === 'farmhouse', md = skinId(o) === 'modern', leg = rt ? '#D5DAE0' : fm ? '#7A5236' : md ? '#1B1A1F' : C.dark, seat = rt || fm || md ? cl(o) : C.wood, topc = rt ? '#F4EAD0' : fm ? shade(cl(o), 0.05) : md ? '#D3E8EE' : C.wood;
        [[0.39, 0.04], [0.83, 0.04], [0.39, 0.48], [0.83, 0.48]].forEach(([x, y]) => ps.push(B(x, y, 0, 0.06, 0.06, 0.42, leg)));
        ps.push(B(0.35, 0, 0.42, 0.6, 0.58, 0.07, seat, { name: 'seat1' }), B(0.35, 0, 0.49, 0.6, 0.07, 0.62, seat));
        [[0.05, 0.79], [1.18, 0.79], [0.05, 1.64], [1.18, 1.64]].forEach(([x, y]) => ps.push(B(x, y, 0, 0.07, 0.07, 0.7, leg)));
        ps.push(B(0, 0.74, 0.7, 1.3, 1.0, 0.07, topc, { name: 'top' }));
        // Modern: a glass top on slim black legs, with a bright edge and reflections; sleek shell chairs.
        if (md) ps.push(F(0, 0.74, 1.3, 1.74, (T) => {
          T.line([0, 0.74, 0.7], [1.3, 0.74, 0.7], '#7FA7B3', 1.6); T.line([0, 1.74, 0.7], [1.3, 1.74, 0.7], '#7FA7B3', 1.6);
          T.line([0.1, 1.64, 0.772], [0.6, 0.84, 0.772], 'rgba(255,255,255,.7)', 2); T.line([0.3, 1.64, 0.772], [0.8, 0.84, 0.772], 'rgba(255,255,255,.4)', 1.4);
        }, { onTop: true }));
        if (fm) ps.push(F(0, 0.74, 1.3, 1.74, (T) => {
          for (let y = 0.74 + 0.25; y < 1.74; y += 0.25) T.line([0.02, y, 0.772], [1.28, y, 0.772], 'rgba(60,35,15,.35)', 1);
          T.line([0, 0.74, 0.7], [1.3, 0.74, 0.7], 'rgba(60,35,15,.4)', 1.4);
        }, { onTop: true }));
        // Spindle-back chairs: three spindles up each chair back.
        if (fm) [[0, 0.071], [2.4, 2.471]].forEach(([y0, y]) => ps.push(F(0.35, y0, 0.95, y0 + 0.08, (T) => { for (let i = 0; i < 3; i++) { const x = 0.45 + i * 0.2; T.line([x, y, 0.6], [x, y, 1.08], 'rgba(60,35,15,.6)', 1.8); } }, { onTop: true })));
        if (rt) ps.push(F(0, 0.74, 1.3, 1.74, (T) => {
          T.line([0, 0.74, 0.7], [1.3, 0.74, 0.7], '#C9CED6', 2); T.line([0, 1.74, 0.7], [1.3, 1.74, 0.7], '#C9CED6', 2);
          T.poly([[0.08, 0.92, 0.772], [0.62, 1.0, 0.772], [0.5, 1.12, 0.772], [0.26, 1.06, 0.772], [0.14, 1.34, 0.772], [0.06, 1.2, 0.772]], '#6FBFB0');
          T.poly([[0.7, 1.3, 0.772], [1.2, 1.2, 0.772], [1.14, 1.5, 0.772], [0.9, 1.4, 0.772], [0.84, 1.6, 0.772]], '#F08A6B');
        }, { onTop: true }));
        ps.push(diningLife());
        [[0.39, 1.93], [0.83, 1.93], [0.39, 2.37], [0.83, 2.37]].forEach(([x, y]) => ps.push(B(x, y, 0, 0.06, 0.06, 0.42, leg)));
        ps.push(B(0.35, 1.89, 0.42, 0.6, 0.58, 0.07, seat, { name: 'seat2' }), B(0.35, 2.4, 0.49, 0.6, 0.07, 0.62, seat));
        ps.push(diningLight());
        return ps;
      }, 
       },
    lamp: {     
      parts: () => [F(0, 0, 0.4, 0.4, (T, o) => {
        if (LOOK_DRAWERS.lamp[skinId(o)]) { LOOK_DRAWERS.lamp[skinId(o)](T, o); return; }
        // Retro: an atomic lamp, a chrome stem with a starburst of arms ending in glowing balls. The light stays where it was.
        if (skinId(o) === 'retro') {
          const lit = isLit(o.id), arm = '#D5DAE0';
          T.box(0.05, 0.05, 0, 0.3, 0.3, 0.05, '#C9CED6'); T.box(0.14, 0.14, 0.05, 0.12, 0.12, 0.08, '#F4F7FA');
          T.line([0.2, 0.2, 0.13], [0.2, 0.2, 1.3], arm, 2.4);
          [[0.05, 0.2, 1.52], [0.35, 0.2, 1.52], [0.2, 0.05, 1.52], [0.2, 0.35, 1.52], [0.2, 0.2, 1.72], [0.08, 0.08, 1.64], [0.32, 0.32, 1.64]].forEach(([x, y, z]) => { T.line([0.2, 0.2, 1.3], [x, y, z], arm, 1.4); const [bx, by] = T.P(x, y, z); circle(bx, by, 3.2, lit ? '#FFE2A8' : cl(o)); circle(bx - 0.8, by - 0.8, 1, 'rgba(255,255,255,.8)'); });
          return;
        }
        // Modern: a slim torchiere, a black pole with a round white head. The light stays where it was.
        if (skinId(o) === 'modern') {
          const c = cl(o), lit = isLit(o.id);
          T.box(0.07, 0.07, 0, 0.26, 0.26, 0.04, c); T.line([0.2, 0.2, 0.04], [0.2, 0.2, 1.5], c, 1.8);
          T.box(0.02, 0.02, 1.5, 0.36, 0.36, 0.06, lit ? '#FFF1C9' : '#F4F4F2'); T.box(0.05, 0.05, 1.56, 0.3, 0.3, 0.14, lit ? '#FFE2A8' : '#E8E8E6');
          return;
        }
        // Farmhouse: a wooden tripod with a linen drum shade. The light stays where it was.
        if (skinId(o) === 'farmhouse') {
          const wood = cl(o);
          [[0.05, 0.05], [0.35, 0.05], [0.2, 0.35]].forEach(([x, y]) => T.line([x, y, 0], [0.2, 0.2, 1.38], wood, 2.6));
          T.line([0.2, 0.2, 0.9], [0.2, 0.2, 1.38], shade(wood, -0.2), 2);
          T.box(0.03, 0.03, 1.38, 0.34, 0.34, 0.34, isLit(o.id) ? '#FFE2A8' : '#EFE3C8');
          T.line([0.03, 0.371, 1.5], [0.37, 0.371, 1.5], 'rgba(120,90,50,.35)', 1);
          return;
        }
        T.box(0.05, 0.05, 0, 0.3, 0.3, 0.05, '#3A3340'); T.line([0.2, 0.2, 0.05], [0.2, 0.2, 1.4], '#3A3340', 2); T.box(0, 0, 1.38, 0.4, 0.4, 0.34, isLit(o.id) ? '#FFE2A8' : '#EFD9B4'); })],  },
    plant: {    
      parts: () => [F(0, 0, 0.5, 0.5, (T, o, t) => {
        if (LOOK_DRAWERS.plant[skinId(o)]) LOOK_DRAWERS.plant[skinId(o)](T, o);
        // Retro: an atomic planter, a glazed pot in the piece's colour on three splayed wooden legs, with a cream band.
        else if (skinId(o) === 'retro') {
          [[0.1, 0.1], [0.36, 0.1], [0.23, 0.36]].forEach(([x, y]) => T.box(x, y, 0, 0.05, 0.05, 0.2, '#7A5236'));
          T.box(0.04, 0.04, 0.2, 0.42, 0.42, 0.22, cl(o)); T.box(0.04, 0.04, 0.3, 0.42, 0.42, 0.05, '#F4EAD0');
        } else if (skinId(o) === 'farmhouse') {
          // Farmhouse: a galvanized or enamel pail in a slatted wooden crate.
          T.box(0, 0, 0, 0.5, 0.5, 0.2, '#B98A6A');
          [0.1, 0.2, 0.3, 0.4].forEach(x => T.line([x, 0.501, 0.02], [x, 0.501, 0.19], 'rgba(60,35,15,.4)', 1));
          T.line([0, 0.501, 0.1], [0.5, 0.501, 0.1], 'rgba(60,35,15,.4)', 1);
          T.box(0.06, 0.06, 0.2, 0.38, 0.38, 0.22, cl(o)); T.line([0.06, 0.441, 0.4], [0.44, 0.441, 0.4], 'rgba(255,255,255,.4)', 1.4);
        } else if (skinId(o) === 'modern') {
          // Modern: a square matte planter with a pale gravel top.
          T.box(0.02, 0.02, 0, 0.46, 0.46, 0.4, cl(o)); T.box(0.02, 0.02, 0.4, 0.46, 0.46, 0.03, shade(cl(o), 0.18));
          T.line([0.02, 0.481, 0.2], [0.48, 0.481, 0.2], 'rgba(255,255,255,.12)', 1);
        } else T.box(0, 0, 0, 0.5, 0.5, 0.42, o.pot || '#C26B4A');
        T.poly([[0.05, 0.05, 0.421], [0.45, 0.05, 0.421], [0.45, 0.45, 0.421], [0.05, 0.45, 0.421]], skinId(o) === 'modern' ? '#B9B4AC' : '#4A3426'); const [sx, sy] = T.P(0.25, 0.25, 0.55), sway = Math.sin(t * 0.8 + o.x) * 0.04;
        [[-10, -14, -0.7, '#3F7D4E'], [9, -16, 0.6, '#4F9460'], [-4, -26, -0.25, '#4F9460'], [5, -30, 0.3, '#3F7D4E'], [0, -20, 0, '#5BA36C']].forEach(([dx, dy, r, c]) => ell(sx + dx, sy + dy, 5, 13, c, null, r + sway)); })],
       },
    bookshelf: {    
      parts: () => [F(0, 0, 1.4, 0.38, (T) => { T.box(0, 0, 0, 1.4, 0.38, 1.6, C.dark); const cols = ['#C2413A', '#3D6B73', '#E0A43A', '#4A5DA8', '#F2EEE8', '#7E4458', '#4F9460'];
        [0.12, 0.52, 0.92, 1.32].forEach((z, r) => { T.line([0, 0.381, z], [1.4, 0.381, z], 'rgba(0,0,0,.35)', 1.2); for (let i = 0; i < 9; i++) { const x = 0.06 + i * 0.145; if ((i * 3 + r) % 7 === 6) continue; const hh = 0.28 + (i % 3) * 0.03; T.poly([[x, 0.382, z + 0.02], [x + 0.11, 0.382, z + 0.02], [x + 0.11, 0.382, z + hh], [x, 0.382, z + hh]], cols[(i + r * 2) % 7]); } }); })] },
    records: {    
      parts: () => [F(0, 0, 0.85, 0.45, (T, o, t) => { T.box(0, 0, 0, 0.85, 0.45, 0.55, '#5A3E2E'); [0.17, 0.67].forEach(x => { const [sx, sy] = T.P(x, 0.46, 0.27); circle(sx, sy, 4, '#2B2B30'); circle(sx, sy, 1.6, '#4A4450'); });
        const [px, py] = T.P(0.42, 0.22, 0.56); ell(px, py, 10, 5, '#1B1A1F'); ell(px, py, 3.5, 1.8, '#D24A7A'); if (usingSlot(o.id + ':r') || live(o.id)) limb(px + Math.cos(t * 6) * 6, py + Math.sin(t * 6) * 3, px, py, 'rgba(255,255,255,.4)', 1);
        if (live(o.id)) for (let k = 0; k < 3; k++) { const u = (t * 0.6 + k / 3) % 1; ctx.globalAlpha = 1 - u; ctx.fillStyle = ['#E48AAE', '#7FB2FF', '#E0A43A'][k]; ctx.font = '700 9px Inter, system-ui, sans-serif'; ctx.fillText('♪', px - 6 + k * 6 + Math.sin(u * 6 + k) * 3, py - 8 - u * 26); ctx.globalAlpha = 1; } })],
       },
    arcade: {    
      parts: () => [F(0, 0, 0.56, 0.5, (T, o, t) => { T.box(0, 0, 0, 0.56, 0.5, 1.3, '#2B2440'); T.poly([[0.05, 0.501, 0.72], [0.51, 0.501, 0.72], [0.51, 0.501, 1.12], [0.05, 0.501, 1.12]], power ? `hsl(${(t * (live(o.id) ? 400 : 80)) % 360},${live(o.id) ? 90 : 70}%,${live(o.id) ? 62 + Math.sin(t * 20) * 10 : 55}%)` : '#1B1A1F'); T.box(0.02, 0.45, 0.62, 0.52, 0.18, 0.06, '#C2413A'); T.poly([[0, 0.501, 1.16], [0.56, 0.501, 1.16], [0.56, 0.501, 1.28], [0, 0.501, 1.28]], '#E0A43A'); })],
       },
    tread: {    
      parts: () => [B(0, 0, 0, 1.35, 0.62, 0.16, '#2E2A33', { name: 'deck' }), F(0.07, 0.05, 1.2, 0.57, (T, o, t) => { T.poly([[0.07, 0.05, 0.161], [1.2, 0.05, 0.161], [1.2, 0.57, 0.161], [0.07, 0.57, 0.161]], '#18161B'); const run = usingSlot(o.id + ':t') || live(o.id);
        for (let i = 0; i < 6; i++) { const x = 0.07 + ((i * 0.19 + (run ? -t * 0.9 : 0)) % 1.13 + 1.13) % 1.13; T.line([x, 0.07, 0.162], [x, 0.55, 0.162], 'rgba(255,255,255,.12)', 1); } }, { onTop: true }),
        F(1.17, 0, 1.39, 0.68, (T, o) => { T.box(1.25, 0.03, 0.16, 0.06, 0.06, 0.95, '#4A4450'); T.box(1.25, 0.51, 0.16, 0.06, 0.06, 0.95, '#4A4450'); T.box(1.17, 0, 1.08, 0.22, 0.62, 0.1, '#3A3340'); T.poly([[1.18, 0.2, 1.181], [1.37, 0.2, 1.181], [1.37, 0.46, 1.181], [1.18, 0.46, 1.181]], (usingSlot(o.id + ':t') || live(o.id)) && power ? '#5CC48A' : '#23402E'); })],
       },
    gym: {     
      parts: () => [F(0, 0, 1.1, 1.0, (T) => { T.poly([[0, 0, 0.01], [1.1, 0, 0.01], [1.1, 1.0, 0.01], [0, 1.0, 0.01]], '#3D6B73'); T.poly([[0.1, 0.1, 0.012], [1.0, 0.1, 0.012], [1.0, 0.9, 0.012], [0.1, 0.9, 0.012]], null, 'rgba(255,255,255,.25)', 1); }, { decal: true }),
        F(1.15, 0.15, 1.43, 0.85, (T) => { T.box(1.15, 0.15, 0, 0.28, 0.7, 0.42, '#3A3340'); [0.25, 0.48, 0.7].forEach(y => T.box(1.19, y, 0.42, 0.2, 0.12, 0.08, '#1F1D22')); })],
       },
    desk: {    
      parts: () => [B(0.05, 0.05, 0, 0.06, 0.06, 0.72, C.dark), B(1.09, 0.05, 0, 0.06, 0.06, 0.72, C.dark), B(0.05, 0.49, 0, 0.06, 0.06, 0.72, C.dark), B(1.09, 0.49, 0, 0.06, 0.06, 0.72, C.dark),
        B(0, 0, 0.72, 1.2, 0.6, 0.06, '#E4DDD2', { name: 'top' }),
        F(0.3, 0.05, 0.9, 0.3, (T, o) => { T.box(0.55, 0.12, 0.78, 0.1, 0.08, 0.2, '#3A3340'); T.box(0.3, 0.08, 0.98, 0.6, 0.06, 0.38, '#2B2B30'); T.poly([[0.33, 0.141, 1.01], [0.87, 0.141, 1.01], [0.87, 0.141, 1.33], [0.33, 0.141, 1.33]], usingSlot(o.id + ':d') && power ? '#9EC1F5' : '#3A3F4A'); }, { onTop: true }),
        F(0.92, 0.05, 1.18, 0.3, (T, o) => { T.box(0.98, 0.1, 0.78, 0.14, 0.14, 0.03, '#3A3340'); T.line([1.05, 0.17, 0.81], [1.05, 0.17, 1.02], '#3A3340', 1.5); T.box(0.96, 0.08, 1.0, 0.2, 0.2, 0.1, isLit(o.id) ? '#FFE2A8' : '#EFD9B4'); }, { onTop: true }),
        B(0.3, 0.75, 0.42, 0.6, 0.5, 0.07, '#3A3340', { name: 'seat' }), B(0.3, 1.18, 0.49, 0.6, 0.07, 0.55, '#3A3340')],
        },
    dresser: {    
      parts: () => [F(0, 0, 1.2, 0.5, (T, o) => { if (LOOK_DRAWERS.dresser[skinId(o)]) { LOOK_DRAWERS.dresser[skinId(o)](T, o); return; } T.box(0, 0, 0, 1.2, 0.5, 0.85, '#B98A6A'); [0.28, 0.55].forEach(z => T.line([0.03, 0.501, z], [1.17, 0.501, z], 'rgba(0,0,0,.25)', 1)); [0.3, 0.9].forEach(x => { const [sx, sy] = T.P(x, 0.502, 0.42); circle(sx, sy, 1.5, '#5A3E2E'); }); T.box(0.15, 0.15, 0.85, 0.18, 0.18, 0.22, '#F2EEE8'); })] },
    nightstand: {    
      parts: () => [F(0, 0, 0.45, 0.45, (T, o) => { if (LOOK_DRAWERS.nightstand[skinId(o)]) { LOOK_DRAWERS.nightstand[skinId(o)](T, o); return; } T.box(0, 0, 0, 0.45, 0.45, 0.5, '#B98A6A'); T.box(0.14, 0.14, 0.5, 0.16, 0.16, 0.04, '#3A3340'); T.line([0.22, 0.22, 0.54], [0.22, 0.22, 0.72], '#3A3340', 1.5); T.box(0.1, 0.1, 0.7, 0.24, 0.24, 0.14, isLit(o.id) ? '#FFE2A8' : '#EFD9B4'); })],  },
    // ---- built-ins ----
    counter: {    
      parts: () => [F(0, 0, 2.8, 0.84, (T, o, t) => {
        // Retro: a two-tone diner counter. The cabinets take the colour, the top is cream laminate edged in chrome,
        // and the sink is a deep white basin with a chrome tap. The sink, stove and coffee machine stay where they are.
        const rt = skinId(o) === 'retro';
        if (LOOK_DRAWERS.counter[skinId(o)]) LOOK_DRAWERS.counter[skinId(o)](T, o);
        else if (skinId(o) === 'farmhouse') {
          // Farmhouse: shiplap-fronted cabinets, a butcher-block top and a deep apron-front sink.
          T.box(0, 0, 0, 2.8, 0.8, 0.86, cl(o));
          for (let x = 0.12; x < 2.8; x += 0.14) T.line([x, 0.801, 0.08], [x, 0.801, 0.8], 'rgba(90,70,40,.22)', 0.8);
          [0.7, 1.4, 2.1].forEach(x => T.line([x, 0.802, 0.06], [x, 0.802, 0.8], 'rgba(60,40,20,.4)', 1.2));
          [0.3, 1.0, 1.7, 2.4].forEach(x => T.line([x, 0.803, 0.64], [x + 0.2, 0.803, 0.64], '#2B2B30', 2.6));
          T.box(-0.05, -0.04, 0.86, 2.9, 0.88, 0.09, '#C99A62');
          for (let x = 0.05; x < 2.85; x += 0.32) T.line([x, 0.84, 0.86], [x, 0.84, 0.95], 'rgba(90,55,25,.35)', 1);
          T.poly([[0.28, 0.8, 0.5], [1.02, 0.8, 0.5], [1.02, 0.8, 0.86], [0.28, 0.8, 0.86]], '#FBFAF4', 'rgba(0,0,0,.3)', 1.2);
          T.poly([[0.36, 0.14, 0.951], [0.94, 0.14, 0.951], [0.94, 0.62, 0.951], [0.36, 0.62, 0.951]], '#F1EFE6', 'rgba(0,0,0,.28)', 1.1);
          T.line([0.65, 0.04, 0.95], [0.65, 0.04, 1.2], '#2B2B30', 2.4); T.line([0.65, 0.04, 1.2], [0.65, 0.24, 1.14], '#2B2B30', 2.4);
        } else if (skinId(o) === 'modern') {
          // Modern: handleless slab fronts, a thin stone top and a squared steel sink with a tall black tap.
          T.box(0, 0, 0, 2.8, 0.8, 0.86, cl(o));
          [0.7, 1.4, 2.1].forEach(x => T.line([x, 0.801, 0.04], [x, 0.801, 0.84], 'rgba(0,0,0,.45)', 1.2));
          T.line([0, 0.802, 0.45], [2.8, 0.802, 0.45], 'rgba(0,0,0,.3)', 1);
          [0.3, 1.0, 1.7, 2.4].forEach(x => T.line([x, 0.803, 0.78], [x + 0.2, 0.803, 0.78], 'rgba(255,255,255,.35)', 1.4));
          T.box(-0.05, -0.04, 0.86, 2.9, 0.88, 0.05, '#E8E8E6');
          T.line([-0.05, 0.84, 0.86], [2.85, 0.84, 0.86], 'rgba(0,0,0,.25)', 1);
          T.poly([[0.3, 0.13, 0.911], [1.0, 0.13, 0.911], [1.0, 0.6, 0.911], [0.3, 0.6, 0.911]], '#B9BEC3', 'rgba(0,0,0,.35)', 1.2);
          T.poly([[0.36, 0.19, 0.912], [0.94, 0.19, 0.912], [0.94, 0.54, 0.912], [0.36, 0.54, 0.912]], '#9AA0A6', 'rgba(0,0,0,.25)', 1);
          T.line([0.65, 0.05, 0.91], [0.65, 0.05, 1.3], '#1B1A1F', 2.4); T.line([0.65, 0.05, 1.3], [0.65, 0.26, 1.26], '#1B1A1F', 2.4);
        } else {
        if (rt) T.box(0, 0, 0, 2.8, 0.8, 0.07, '#C9CED6');
        T.box(0, 0, rt ? 0.07 : 0, 2.8, 0.8, rt ? 0.79 : 0.86, rt ? cl(o) : '#E4DDD2');
        [0.7, 1.4, 2.1].forEach(x => T.line([x, 0.8, 0.1], [x, 0.8, 0.78], rt ? 'rgba(255,255,255,.5)' : 'rgba(60,40,50,.28)', 1));
        [0.3, 1.0, 1.7, 2.4].forEach(x => T.line([x, 0.8, 0.66], [x + 0.18, 0.8, 0.66], rt ? '#E8ECEF' : '#8B8189', rt ? 2.4 : 1.6));
        T.box(-0.05, -0.04, 0.86, 2.9, 0.88, 0.07, rt ? '#F4EAD0' : '#3A3340');
        if (rt) { T.line([-0.05, 0.84, 0.86], [2.85, 0.84, 0.86], '#D5DAE0', 2.4); T.line([-0.05, 0.84, 0.93], [2.85, 0.84, 0.93], '#F4F7FA', 1.4); }
        T.poly([[0.3, 0.13, 0.931], [1.0, 0.13, 0.931], [1.0, 0.6, 0.931], [0.3, 0.6, 0.931]], rt ? '#FBFBF8' : '#B9C3C8', rt ? 'rgba(0,0,0,.28)' : 'rgba(0,0,0,.2)', rt ? 1.2 : 0.8);
        if (rt) T.poly([[0.38, 0.2, 0.932], [0.92, 0.2, 0.932], [0.92, 0.53, 0.932], [0.38, 0.53, 0.932]], '#E9ECEA', 'rgba(0,0,0,.2)', 0.8);
        T.line([0.65, 0.04, 0.93], [0.65, 0.04, 1.18], rt ? '#F4F7FA' : '#AEB6BB', rt ? 2.8 : 2); T.line([0.65, 0.04, 1.18], [0.65, 0.24, 1.12], rt ? '#F4F7FA' : '#AEB6BB', rt ? 2.8 : 2);
        }
        if (has('chefstove')) { T.poly([[1.25, 0.03, 0.932], [2.05, 0.03, 0.932], [2.05, 0.73, 0.932], [1.25, 0.73, 0.932]], '#B9BEC3', 'rgba(0,0,0,.25)', 0.8); [1.35, 1.55, 1.75, 1.95].forEach(x => { const [sx, sy] = T.P(x, 0.8, 0.8); circle(sx, sy, 1.6, '#C2413A'); }); }
        const b1 = T.P(1.45, 0.23, 0.94), b2 = T.P(1.85, 0.5, 0.94); ell(b1[0], b1[1], 9, 4.5, '#1E1A20', '#6B6170'); ell(b2[0], b2[1], 8, 4, '#1E1A20', '#6B6170');
        if (has('espresso')) { T.box(2.3, 0.04, 0.93, 0.34, 0.32, 0.46, '#C9CED6'); T.box(2.3, 0.04, 1.32, 0.34, 0.32, 0.06, '#C2413A'); } else { T.box(2.3, 0.04, 0.93, 0.32, 0.3, 0.44, '#2B2B30'); T.box(2.34, 0.35, 0.93, 0.24, 0.14, 0.18, '#6B4A35'); }
        if (has('plants')) { T.box(0.05, 0.12, 0.93, 0.18, 0.18, 0.15, '#C26B4A'); const [px, py] = T.P(0.14, 0.21, 1.15); ell(px - 3, py - 3, 3, 7, '#4F9460', null, -0.4); ell(px + 3, py - 4, 3, 7, '#3F7D4E', null, 0.4); }
        if (live(o.id, 'stove') && !usingSlot(o.id + ':stove', ['cook'])) { const g = 0.6 + Math.sin(t * 9) * 0.2; ell(b1[0], b1[1], 7, 3.4, `rgba(255,${(90 + g * 60) | 0},40,${0.55 + g * 0.3})`); }
        if (live(o.id, 'sink')) { const [fx, fy] = T.P(0.65, 0.2, 1.12); for (let k = 0; k < 4; k++) { const u = (t * 3 + k / 4) % 1; limb(fx, fy + u * 10, fx, fy + u * 10 + 3, `rgba(170,215,245,${0.9 - u * 0.5})`, 1.6); } }
        if (live(o.id, 'coffee')) steamAt(T, 2.46, 0.19, 1.4, t, 4, 1);
        if (usingSlot(o.id + ':stove', ['cook'])) { ell(b1[0], b1[1] - 2, 10, 5, '#3B3B40'); limb(b1[0] + 8, b1[1] - 2, b1[0] + 20, b1[1] + 3, '#3B3B40', 2.4); ell(b1[0], b1[1] - 3, 7, 3.2, '#D9822B'); steamAt(T, 1.45, 0.23, 1.0, t, 5, 0.9); }
        if (usingSlot(o.id + ':coffee', ['coffee'])) steamAt(T, 2.46, 0.19, 1.4, t);
        if (usingSlot(o.id + ':sink', ['wash'])) for (let i = 0; i < 5; i++) { const ph = (t * 0.8 + i / 5) % 1; const [sx, sy] = T.P(0.65 + Math.sin(i * 7) * 0.15, 0.36, 0.95 + ph * 0.25); circle(sx, sy, 1.5 + ph * 1.5, `rgba(255,255,255,${0.9 - ph * 0.8})`); }
      })],
       },
    fridge: {    
      parts: () => [F(0, 0, 0.9, 0.85, (T) => {
        const LK = LOOK_DRAWERS.fridge[skinId(T.o)]; let door = ['retro', 'farmhouse', 'modern'].includes(skinId(T.o)) ? cl(T.o) : '#DCE3E6';
        if (LK) door = LK(T, T.o) || door;
        // Retro: the pastel icebox. Same box; a rounded cap, a chrome badge and fat chrome handles instead of the stock grey ones.
        else if (skinId(T.o) === 'retro') {
          const body = cl(T.o);
          T.box(0, 0, 0, 0.9, 0.85, 0.07, '#C9CED6');
          T.box(0, 0, 0.07, 0.9, 0.85, 1.88, body);
          T.box(0, 0, 1.86, 0.9, 0.85, 0.09, shade(body, 0.28));
          T.line([0, 0.85, 1.3], [0.9, 0.85, 1.3], 'rgba(60,70,80,.4)', 1.4);
          [[0.7, 1.15], [1.42, 1.78]].forEach(([z0, z1]) => { T.line([0.78, 0.855, z0], [0.78, 0.855, z1], '#8E979C', 4.2); T.line([0.78, 0.856, z0], [0.78, 0.856, z1], '#F4F7FA', 2.4); });
          T.poly([[0.38, 0.851, 1.5], [0.66, 0.851, 1.5], [0.66, 0.851, 1.62], [0.38, 0.851, 1.62]], '#E4E8EC', 'rgba(60,70,80,.45)', 1);
        } else if (skinId(T.o) === 'farmhouse') {
          // Farmhouse: a cream enamel icebox with a butcher-block top, a wooden foot and black iron pulls.
          const body = cl(T.o);
          T.box(0, 0, 0, 0.9, 0.85, 0.1, '#8A5E3B');
          T.box(0, 0, 0.1, 0.9, 0.85, 1.78, body);
          T.box(0, 0, 1.88, 0.9, 0.85, 0.07, '#C99A62');
          T.line([0, 0.85, 1.3], [0.9, 0.85, 1.3], 'rgba(90,70,40,.4)', 1.4);
          [[0.7, 1.15], [1.42, 1.78]].forEach(([z0, z1]) => { T.line([0.78, 0.855, z0], [0.78, 0.855, z1], '#2B2B30', 3.4); });
          T.line([0.05, 0.851, 0.1], [0.85, 0.851, 0.1], 'rgba(60,40,20,.45)', 1);
        } else if (skinId(T.o) === 'modern') {
          // Modern: a flat slab of steel or matte black, one full-height bar handle and a small display. No rounded anything.
          const body = cl(T.o), dark = shade(body, -0.5) === body ? body : shade(body, -0.35);
          T.box(0, 0, 0, 0.9, 0.85, 1.95, body);
          T.line([0, 0.85, 1.3], [0.9, 0.85, 1.3], dark, 1.2);
          T.line([0.8, 0.855, 0.1], [0.8, 0.855, 1.85], '#1B1A1F', 3); T.line([0.8, 0.856, 0.1], [0.8, 0.856, 1.85], '#8E979C', 1.2);
          for (let z = 0.2; z < 1.9; z += 0.3) T.line([0.04, 0.851, z], [0.7, 0.851, z + 0.14], 'rgba(255,255,255,.07)', 5);
          T.poly([[0.1, 0.851, 1.55], [0.3, 0.851, 1.55], [0.3, 0.851, 1.65], [0.1, 0.851, 1.65]], '#1B1A1F');
        } else {
        T.box(0, 0, 0, 0.9, 0.85, 1.95, '#DCE3E6'); T.line([0, 0.85, 1.3], [0.9, 0.85, 1.3], 'rgba(60,70,80,.3)', 1); T.line([0.78, 0.85, 0.7], [0.78, 0.85, 1.15], '#8E979C', 2); T.line([0.78, 0.85, 1.42], [0.78, 0.85, 1.75], '#8E979C', 2);
        }
        const n = fridge.basic + fridge.fresh; T.poly([[0.08, 0.851, 1.45], [0.32, 0.851, 1.45], [0.32, 0.851, 1.68], [0.08, 0.851, 1.68]], n === 0 ? '#C2413A' : '#E0A43A');
        if (live(T.o.id)) { T.poly([[0.04, 0.851, 0.05], [0.86, 0.851, 0.05], [0.86, 0.851, 1.25], [0.04, 0.851, 1.25]], 'rgba(255,248,220,.95)'); [0.4, 0.75].forEach(z => T.line([0.06, 0.852, z], [0.84, 0.852, z], 'rgba(150,160,170,.6)', 1)); [[0.2, 0.42, '#C2413A'], [0.5, 0.42, '#7FB069'], [0.3, 0.77, '#F2EEE8'], [0.62, 0.77, '#E0A43A']].forEach(([x, z, col]) => { const [cx, cy] = T.P(x, 0.853, z + 0.06); rr(cx - 3, cy - 5, 6, 6, 1, col); }); T.poly([[0.86, 0.851, 0.05], [0.86, 1.6, 0.05], [0.86, 1.6, 1.25], [0.86, 0.851, 1.25]], door, 'rgba(60,70,80,.3)', 1); } })],
       },
    tvunit: {    
      parts: () => [F(0, 0, 1.6, 0.45, (T) => { T.box(0, 0, 0, 1.6, 0.45, 0.42, '#3A3340'); T.line([0.8, 0.45, 0.06], [0.8, 0.45, 0.36], 'rgba(255,255,255,.12)', 1); if (!has('bigtv')) { T.box(0.1, 0.08, 0.42, 0.18, 0.18, 0.3, '#2B2B30'); T.box(1.32, 0.08, 0.42, 0.18, 0.18, 0.3, '#2B2B30'); } })] },
    shower: {    
      parts: (o) => LOOK_DRAWERS.shower[skinId(o)] ? LOOK_DRAWERS.shower[skinId(o)](o) : [F(0, 0, 1.18, 1.18, (T) => { T.box(0, 0, 0, 1.18, 1.18, 0.1, '#E6ECEE'); const [dx, dy] = T.P(0.6, 0.58, 0.1); ell(dx, dy, 3, 1.5, '#9AA3A8'); T.line([0.57, 0, 2.15], [0.57, 0.2, 2.15], '#9AA3A8', 2.5); const [hx, hy] = T.P(0.57, 0.22, 2.1); ell(hx, hy, 5, 2.5, '#9AA3A8'); if (usingSlot(T.o.id + ':s') || live(T.o.id)) { steamAt(T, 0.6, 0.6, 0.9, 0, 6, 1); steamAt(T, 0.5, 0.75, 1.5, 0, 3, 0.8); const [wx, wy] = T.W(0.57, 0.22); PFX.emit(T.o.id + ':splash', 'splash', T.o.level, wx, wy, 1.95, 1); }
          T.poly([[0, 0, 0.1], [0, 1.18, 0.1], [0, 1.18, 2.1], [0, 0, 2.1]], 'rgba(186,222,232,.22)', 'rgba(140,180,195,.7)', 1); }, { name: 'tray' }),
        F(0, 1.16, 1.18, 1.2, (T) => { T.poly([[0, 1.18, 0.1], [1.18, 1.18, 0.1], [1.18, 1.18, 2.1], [0, 1.18, 2.1]], 'rgba(186,222,232,.26)', 'rgba(140,180,195,.7)', 1); T.line([0.2, 1.18, 1.9], [0.65, 1.18, 1.2], 'rgba(255,255,255,.55)', 2); }),
        F(1.16, 0, 1.2, 1.18, (T) => { T.poly([[1.18, 0, 0.1], [1.18, 1.18, 0.1], [1.18, 1.18, 2.1], [1.18, 0, 2.1]], 'rgba(186,222,232,.22)', 'rgba(140,180,195,.7)', 1); })],
       },
    toilet: {     parts: () => [F(0, 0, 0.42, 0.62, (T, o) => { if (LOOK_DRAWERS.toilet[skinId(o)]) { LOOK_DRAWERS.toilet[skinId(o)](T, o); return; } T.box(0.03, 0, 0.3, 0.36, 0.16, 0.42, '#F2EEE8'); T.box(0.06, 0.14, 0, 0.3, 0.42, 0.36, '#F2EEE8'); const [sx, sy] = T.P(0.21, 0.38, 0.37); ell(sx, sy, 6, 3.5, '#E1DCD5'); if (live(T.o.id)) { ell(sx, sy, 4.5, 2.5, '#BFE2F0'); ctx.strokeStyle = 'rgba(90,150,200,.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(sx, sy, 3, 1.6, animT * 9, 0, Math.PI * 1.4); ctx.stroke(); } })] },
    vanity: {     parts: () => [F(0, 0, 1.0, 0.5, (T, o) => { if (LOOK_DRAWERS.vanity[skinId(o)]) { LOOK_DRAWERS.vanity[skinId(o)](T, o); return; } T.box(0, 0, 0, 1.0, 0.5, 0.8, '#7A5236'); T.box(-0.02, -0.02, 0.8, 1.04, 0.54, 0.05, '#E4DDD2'); const [sx, sy] = T.P(0.5, 0.25, 0.86); ell(sx, sy, 8, 4, '#B9C3C8'); T.line([0.5, 0.03, 0.85], [0.5, 0.03, 1.0], '#AEB6BB', 2); })] },
    flightY: {     parts: () => flightParts('y') },
    flightX: {     parts: () => flightParts('x') },
    holeY: {     parts: () => holeParts('y') },
    holeX: {     parts: () => holeParts('x') },
    // ---- basement utility ----
    waterheater: {     
      parts: () => [F(0, 0, 0.7, 0.7, (T, o, t) => {
        const [bx, by] = T.P(0.35, 0.35, 0), [, ty] = T.P(0.35, 0.35, 1.5), rx = 14.5, ry = 7.2;
        const g = ctx.createLinearGradient(bx - rx, 0, bx + rx, 0); g.addColorStop(0, '#C9CDD1'); g.addColorStop(0.45, '#E9ECEE'); g.addColorStop(1, '#9AA0A6');
        ctx.fillStyle = g; ctx.fillRect(bx - rx, ty, rx * 2, by - ty); ell(bx, by, rx, ry, '#9AA0A6'); ctx.fillStyle = g; ctx.fillRect(bx - rx, ty, rx * 2, by - ty - 1);
        ell(bx, ty, rx, ry, '#D8DCDF', 'rgba(0,0,0,.18)'); ell(bx, ty, 4, 2, '#8E959B');
        [0.35, 1.2].forEach(z => { const [, yy] = T.P(0.35, 0.35, z); ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(bx - rx, yy, rx * 2, 1.5); });
        const [, ly] = T.P(0.35, 0.35, 0.95); rr(bx - 5, ly - 6, 10, 8, 1, '#F2EEE8'); ctx.fillStyle = '#C2413A'; ctx.fillRect(bx - 3, ly - 4, 6, 1.5);
        const [, py] = T.P(0.35, 0.35, 0.14), fl = 0.6 + Math.sin(t * 13) * 0.25 + Math.sin(t * 7.3) * 0.15; rr(bx - 3.5, py - 4, 7, 4, 1, '#1E1A20'); ell(bx, py - 2, 2.2, 1.4, `rgba(255,${(150 + fl * 60) | 0},60,${0.6 + fl * 0.4})`);
        T.line([0.25, 0.35, 1.5], [0.25, 0.35, WH], '#C27A4A', 2.2); T.line([0.45, 0.35, 1.5], [0.45, 0.35, WH], '#4A88B8', 2.2); T.line([0.6, 0.45, 1.3], [0.75, 0.45, 1.3], '#C27A4A', 1.6);
      })] },
    furnace: {     
      parts: () => [F(0, 0, 0.85, 1.0, (T, o, t) => {
        T.box(0, 0, 0, 0.85, 1.0, 1.45, '#9AA0A6'); T.box(0.08, 0.12, 1.45, 0.7, 0.76, 0.22, '#8E959B');
        T.poly([[0.851, 0.1, 0.75], [0.851, 0.9, 0.75], [0.851, 0.9, 1.38], [0.851, 0.1, 1.38]], null, 'rgba(0,0,0,.25)', 1);
        for (let z = 0.15; z < 0.62; z += 0.08) T.line([0.852, 0.18, z], [0.852, 0.82, z], 'rgba(30,30,40,.45)', 1);
        const h = hour(), on = power && (h < 8 || h >= 20), fl = Math.sin(t * 11) * 0.5 + 0.5;
        T.poly([[0.853, 0.4, 0.82], [0.853, 0.6, 0.82], [0.853, 0.6, 0.92], [0.853, 0.4, 0.92]], on ? `rgba(255,${(120 + fl * 80) | 0},40,.95)` : '#2B2830');
        const [lx, ly] = T.P(0.853, 0.78, 1.25); circle(lx, ly, 1.6, power ? '#5CC48A' : '#3A3340');
        T.box(0.05, 0.3, 1.67, 0.35, 0.4, WH - 1.67, '#B9BEC3'); T.line([0.05, 0.7, 2.0], [0.4, 0.7, 2.0], 'rgba(0,0,0,.2)', 1);
      })] },
    laundry: {     
      parts: () => [F(0, 0, 1.5, 0.75, (T, o, t) => {
        const on = usingSlot(o.id + ':w') || (o.runUntil && absMin() < o.runUntil) || live(o.id), wob = on ? Math.sin(t * 30) * 0.6 : 0;
        [0, 0.76].forEach((x, i) => { T.box(x, 0, 0, 0.74, 0.72, 0.92, '#F2EEE8'); T.box(x, 0, 0.92, 0.74, 0.16, 0.12, '#E4DDD2'); const [cx, cy] = T.P(x + 0.37, 0.721, 0.46); ell(cx + (i ? 0 : wob), cy, 9, 9, '#9AA3A8'); ell(cx + (i ? 0 : wob), cy, 7, 7, i ? '#3A3F4A' : '#4A88B8');
          if (on && !i) for (let k = 0; k < 4; k++) { const a = t * 6 + k * 1.6; circle(cx + Math.cos(a) * 4 + wob, cy + Math.sin(a) * 4, 2.2, ['#C2413A', '#E0A43A', '#F2EEE8', '#4A5DA8'][k]); }
          const [px, py] = T.P(x + 0.6, 0.73, 0.98); circle(px, py, 1.4, on && !i ? '#5CC48A' : '#8B8189'); });
      })],  },
    shelves: {    
      parts: () => [F(0, 0, 1.6, 0.5, (T) => {
        const cols = ['#B98A57', '#C49A68', '#A97C4C', '#3D6B73', '#C2413A', '#7E4458', '#E0A43A'];
        [[0.03, 0.03], [1.57, 0.03], [0.03, 0.47], [1.57, 0.47]].forEach(([x, y]) => T.line([x, y, 0], [x, y, 1.8], '#5A5560', 2));
        [0.06, 0.6, 1.14, 1.68].forEach((z, r) => { T.box(0, 0, z, 1.6, 0.5, 0.03, '#8E8A90'); if (r === 3) return; let x = 0.06; for (let k = 0; k < 3 && x < 1.5; k++) { const w = 0.34 + ((r * 3 + k) % 3) * 0.08, hh = 0.25 + ((r + k) % 2) * 0.12; T.box(x, 0.06, z + 0.03, w, 0.38, hh, cols[(r * 2 + k) % cols.length]); x += w + 0.08; } });
      })],  },
    boxes: {    
      parts: () => [F(0, 0, 0.9, 0.6, (T) => { T.box(0, 0.05, 0, 0.48, 0.5, 0.45, '#B98A57'); T.box(0.46, 0.08, 0, 0.42, 0.48, 0.36, '#C49A68'); T.box(0.06, 0.1, 0.45, 0.4, 0.4, 0.34, '#A97C4C');
        T.line([0.24, 0.55, 0.45], [0.24, 0.55, 0.3], 'rgba(240,230,200,.8)', 3); T.line([0.67, 0.56, 0.36], [0.67, 0.56, 0.22], 'rgba(240,230,200,.8)', 3); T.line([0.12, 0.505, 0.62], [0.36, 0.505, 0.62], '#3A3340', 1); })] },
    pbox: {    
      parts: () => [F(0, 0, 0.62, 0.52, (T, o) => { T.box(0, 0, 0, 0.62, 0.52, 0.55, '#C49A68'); T.line([0.31, 0, 0.551], [0.31, 0.52, 0.551], 'rgba(240,230,200,.9)', 3); T.line([0.31, 0.521, 0.55], [0.31, 0.521, 0.38], 'rgba(240,230,200,.9)', 3);
        const [lx, ly] = T.P(0.31, 0.521, 0.2); ctx.fillStyle = '#3A3340'; ctx.font = '700 7px "IBM Plex Mono", ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillText((BOX_LABEL[o.contains && o.contains.type] || 'STUFF'), lx, ly + 2); ctx.textAlign = 'start'; })] },
    // A brown paper bag of groceries, folded shut, something green poking out; and the groceries once it is opened.
    bag: {
      parts: () => [F(0, 0, 0.42, 0.36, (T) => { T.box(0.02, 0.02, 0, 0.38, 0.32, 0.44, '#C8A06A'); T.box(0, 0, 0.44, 0.42, 0.36, 0.07, '#B88D5A'); const [gx, gy] = T.P(0.21, 0.1, 0.56); ell(gx, gy - 2, 3, 6, '#4F9460', null, -0.3); })],
    },
    food: {
      parts: () => [F(0, 0, 0.5, 0.42, (T) => { T.box(0, 0, 0, 0.5, 0.42, 0.22, '#B98A57'); T.box(0.04, 0.04, 0.22, 0.2, 0.16, 0.12, '#F2EEE8'); T.box(0.27, 0.05, 0.22, 0.18, 0.14, 0.09, '#D9593D'); const [gx, gy] = T.P(0.16, 0.3, 0.36); ell(gx, gy, 5, 4, '#4F9460'); const [bx, by] = T.P(0.38, 0.3, 0.3); ell(bx, by, 4, 3, '#E0A43A'); })],
    },
    // ---- backyard ----
    tree: {      
      parts: () => [F(0.3, 0.3, 1.1, 1.1, (T, o, t) => { const [bx, by] = T.P(0.7, 0.7, 0), [, ty] = T.P(0.7, 0.7, 2.0); ell(bx + 6, by + 2, 46, 20, 'rgba(30,50,20,.18)'); rr(bx - 5, ty, 10, by - ty, 3, '#6B4A35'); limb(bx, ty + 14, bx - 14, ty - 4, '#6B4A35', 4); limb(bx, ty + 10, bx + 16, ty - 8, '#6B4A35', 3.5);
        const sway = Math.sin(t * 0.7) * 1.5, si = seasonIdx(), blobs = [[-22, -6, 26], [20, -10, 24], [0, -30, 30], [-12, -40, 20], [16, -36, 22]];
        if (si === 3) { [[-20, -30], [18, -34], [-6, -46], [8, -48], [-28, -14], [26, -18]].forEach(([dx, dy]) => limb(bx, ty + 8, bx + dx, ty + dy, '#5E4232', 2)); if (YARD.tiles.some(q => q.snow > 0.3)) [[-20, -31], [18, -35], [-6, -47]].forEach(([dx, dy]) => ell(bx + dx, ty + dy, 5, 2, '#F4F6F8')); return; }
        const pal = si === 0 ? ['#5E9A44', '#6DAA4E', '#4F8A3A'] : si === 1 ? ['#4F8A3A', '#5E9A44', '#4A8236'] : ['#C2632B', '#D98F2B', '#B5482A'];
        blobs.forEach(([dx, dy, r], k) => circle(bx + dx + sway, ty + dy, r, pal[k % 3]));
        if (si === 0) for (let k = 0; k < 14; k++) circle(bx + Math.sin(k * 2.3) * 30 + sway, ty - 20 + Math.cos(k * 1.7) * 22, 2.2, '#F2B8C6');
        if (si === 2) for (let k = 0; k < 5; k++) { const ph = (t * 0.25 + k / 5) % 1; circle(bx - 30 + k * 15 + Math.sin(t + k) * 8, ty - 20 + ph * 90, 2, '#D98F2B'); } })] },
    garden: {    
      parts: () => [F(0, 0, 2.0, 1.0, (T, o, t) => { T.box(0, 0, 0, 2.0, 1.0, 0.28, '#8A6A50'); T.poly([[0.08, 0.08, 0.281], [1.92, 0.08, 0.281], [1.92, 0.92, 0.281], [0.08, 0.92, 0.281]], (o.wet || 0) > 0.3 ? '#4A3426' : '#7A5E44');
        if (usingSlot(o.id + ':t')) { const [gx, gy] = T.W(1.0, 0.5); PFX.emit(o.id + ':splash', 'splash', o.level, gx, gy, 0.55, 1); }
        if (seasonIdx() === 3) { T.poly([[0.08, 0.08, 0.282], [1.92, 0.08, 0.282], [1.92, 0.92, 0.282], [0.08, 0.92, 0.282]], 'rgba(244,246,248,.9)'); return; }
        const g = o.grow || 0; for (let k = 0; k < 6; k++) { const [sx, sy] = T.P(0.3 + (k % 3) * 0.7, 0.3 + Math.floor(k / 3) * 0.42, 0.29), hh = 4 + g * 18, sw = Math.sin(t * 1.4 + k) * 1.2; limb(sx, sy, sx + sw, sy - hh, '#3F7D4E', 1.6); ell(sx - 3 + sw, sy - hh * 0.55, 3.5 + g * 2, 1.8 + g, '#4F9460', null, -0.5); ell(sx + 3 + sw, sy - hh * 0.75, 3.5 + g * 2, 1.8 + g, '#5BA36C', null, 0.5); if (g >= 1) { circle(sx - 2 + sw, sy - hh * 0.45, 2.4, '#C2413A'); circle(sx + 3 + sw, sy - hh * 0.65, 2.2, k % 2 ? '#E0A43A' : '#C2413A'); } } })],
       },
    sprinkler: {    
      parts: () => [F(0, 0, 0.4, 0.4, (T, o, t) => { T.box(0.1, 0.1, 0, 0.2, 0.2, 0.1, '#4A88B8'); T.line([0.2, 0.2, 0.1], [0.2, 0.2, 0.3], '#9AA3A8', 2); const on = o.runUntil && absMin() < o.runUntil; if (on) { const [cx, cy] = T.P(0.2, 0.2, 0.3), sw = Math.sin(t * 2) * 0.9; ctx.strokeStyle = 'rgba(170,215,240,.55)'; ctx.lineWidth = 1.2; for (let k = -3; k <= 3; k++) { const a = sw + k * 0.12; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.quadraticCurveTo(cx + Math.sin(a) * 60, cy - 50, cx + Math.sin(a) * 95, cy + 18 + Math.cos(a) * 20); ctx.stroke(); } for (let k = 0; k < 14; k++) { const ph = (t * 1.2 + k / 14) % 1, a = sw + ((k % 7) - 3) * 0.12; circle(cx + Math.sin(a) * 95 * ph, cy - Math.sin(ph * Math.PI) * 50 + 18 * ph, 1.3, 'rgba(200,230,250,.8)'); } } })],
       },
    fireplace: {     
      parts: () => [F(0, 0, 1.3, 0.55, (T, o, t) => { T.box(0.15, 0, 1.25, 1.0, 0.4, WH - 1.25, '#9A8F86'); T.box(0, 0, 0, 1.3, 0.5, 1.2, '#B5A99E'); T.box(-0.05, 0, 1.2, 1.4, 0.58, 0.08, '#6B4A35');
        T.poly([[0.3, 0.501, 0.12], [1.0, 0.501, 0.12], [1.0, 0.501, 0.85], [0.3, 0.501, 0.85]], '#1E1A20');
        const lit = !fireOut.has(o.id), fl = Math.sin(t * 9) * 0.5 + Math.sin(t * 13.7) * 0.3; if (lit && (darkness() > 0.05 || seasonIdx() === 3)) { const [fx, fy] = T.P(0.65, 0.48, 0.2); ell(fx, fy - 6 - fl, 9, 10 + fl * 2, 'rgba(240,120,40,.9)'); ell(fx - 3, fy - 4, 5, 7 + fl, 'rgba(255,200,90,.95)'); ell(fx + 4, fy - 3, 4, 6 - fl, 'rgba(255,170,60,.9)'); const [ex, ey] = T.W(0.65, 0.4); PFX.emit(o.id + ':ember', 'ember', o.level, ex, ey, 0.2, 0.45); }
        [[0.4, 0.3], [0.9, 0.3]].forEach(([x, y]) => T.line([x, y, 0.13], [x + 0.2, y + 0.1, 0.13], '#5A3E2E', 3)); })],
        },
    bathtub: {     
      parts: () => [F(0, 0, 1.6, 0.8, (T, o) => { T.box(0.05, 0.05, 0.08, 1.5, 0.7, 0.5, '#F2EEE8'); T.poly([[0.15, 0.15, 0.581], [1.45, 0.15, 0.581], [1.45, 0.65, 0.581], [0.15, 0.65, 0.581]], usingSlot(o.id + ':b') || live(o.id) ? '#BFE2F0' : '#E6ECEE'); if (usingSlot(o.id + ':b') || live(o.id)) { steamAt(T, 0.5, 0.4, 0.6, 0, 3, 0.7); steamAt(T, 1.1, 0.4, 0.6, 0, 3, 0.7); } [[0.1, 0.1], [1.5, 0.1], [0.1, 0.7], [1.5, 0.7]].forEach(([x, y]) => { const [sx, sy] = T.P(x, y, 0.04); circle(sx, sy, 2.5, '#C9A24A'); }); }, { name: 'basin' })],
       },
    bar: {     
      parts: () => [F(0, 0, 1.8, 0.6, (T, o, t) => { T.box(0, 0, 0, 1.8, 0.6, 1.05, '#5A3E2E'); T.box(-0.05, -0.05, 1.05, 1.9, 0.7, 0.06, '#2B2830'); [0.3, 0.7, 1.1, 1.5].forEach((x, k) => T.box(x, 0.2, 1.11, 0.08, 0.08, 0.22 + (k % 2) * 0.06, ['#4F9460', '#C2413A', '#E0A43A', '#4A88B8'][k])); const [lx, ly] = T.P(0.9, 0.61, 0.6); ctx.fillStyle = 'rgba(224,164,58,.35)'; ctx.fillRect(lx - 30, ly - 2, 60, 2); })],
       },
    pool: {     
      parts: () => [F(0, 0, 3.2, 2.0, (T, o, t) => { T.poly([[0, 0, 0.02], [3.2, 0, 0.02], [3.2, 2.0, 0.02], [0, 2.0, 0.02]], '#D9D3C8', 'rgba(0,0,0,.15)', 1); const cov = seasonIdx() >= 2;
        T.poly([[0.18, 0.18, 0.021], [3.02, 0.18, 0.021], [3.02, 1.82, 0.021], [0.18, 1.82, 0.021]], cov ? '#3D6B73' : '#5FB8D6');
        if (!cov) { for (let k = 0; k < 7; k++) { const u = 0.3 + ((k * 0.41 + t * 0.12) % 2.5), v = 0.3 + ((k * 0.27 + Math.sin(t + k) * 0.1) % 1.3); T.line([u, v, 0.022], [u + 0.25, v + 0.03, 0.022], 'rgba(255,255,255,.55)', 1.2); } } else for (let u = 0.4; u < 3; u += 0.4) T.line([u, 0.2, 0.023], [u, 1.8, 0.023], 'rgba(0,0,0,.15)', 1); }, { name: 'water' })],
       },
    daybed: {     
      parts: () => [B(0, 0, 0, 1.9, 0.9, 0.35, '#8A6A50'), B(0.05, 0.05, 0.35, 1.8, 0.8, 0.14, '#E8DCC8'), B(0, 0, 0.35, 1.9, 0.12, 0.45, '#7A5E44'), B(1.5, 0.2, 0.49, 0.3, 0.5, 0.1, '#C8D7D1')] },
    snowman: {    
      parts: () => [F(0, 0, 0.6, 0.6, (T) => { const [x, y] = T.P(0.3, 0.3, 0); circle(x, y - 10, 13, '#F4F6F8'); circle(x, y - 30, 10, '#FBFCFD'); circle(x, y - 46, 7.5, '#FFFFFF'); circle(x - 2.5, y - 48, 1.2, '#1B1A1F'); circle(x + 2.5, y - 48, 1.2, '#1B1A1F'); ctx.fillStyle = '#E07A2B'; ctx.beginPath(); ctx.moveTo(x, y - 46); ctx.lineTo(x + 9, y - 44.5); ctx.lineTo(x, y - 44); ctx.fill(); rr(x - 8, y - 56, 16, 3, 1, '#2B2B30'); rr(x - 5, y - 64, 10, 9, 1.5, '#2B2B30'); limb(x - 9, y - 30, x - 20, y - 38, '#6B4A35', 1.5); limb(x + 9, y - 30, x + 20, y - 36, '#6B4A35', 1.5); rr(x - 8, y - 39, 16, 3.5, 1.5, '#C2413A'); })] },
    bench: {     
      parts: () => [B(0.1, 0.1, 0, 0.08, 0.08, 0.42, '#5A4A40'), B(1.42, 0.1, 0, 0.08, 0.08, 0.42, '#5A4A40'), B(0, 0.05, 0.42, 1.6, 0.5, 0.06, '#9C6B45', { name: 'seat' }), B(0, 0, 0.48, 1.6, 0.08, 0.42, '#8A5E3B')],
       },
    // ---- pets and lights ----
    bowl: {    
      parts: () => [F(0, 0, 0.5, 0.4, (T, o) => { const p = PETS.find(q => q.bowl === o.id); [[0.13, '#3D6B73'], [0.37, '#C2413A']].forEach(([x, c], i) => { const [sx, sy] = T.P(x, 0.2, 0.06); ell(sx, sy + 2, 7, 3.5, shade(c, -0.25)); ell(sx, sy, 7, 3.5, c); ell(sx, sy, 5, 2.4, i ? '#4A3426' : '#9EC1F5'); if (i && p && p.bowlFood > 0) for (let k = 0; k < Math.min(6, p.bowlFood * 2); k++) circle(sx - 3.5 + k * 1.4, sy - 0.4 - (k % 2) * 0.8, 1.1, '#C07A3C'); }); })],
       },
    petbed: {    
      parts: () => [F(0, 0, 0.8, 0.7, (T) => { T.box(0, 0, 0, 0.8, 0.7, 0.08, '#6E3C50'); T.poly([[0.08, 0.1, 0.081], [0.72, 0.1, 0.081], [0.72, 0.64, 0.081], [0.08, 0.64, 0.081]], '#E8C9A0'); T.box(0, 0, 0.08, 0.8, 0.1, 0.14, '#8E5468'); T.box(0, 0.1, 0.08, 0.08, 0.6, 0.12, '#8E5468'); T.box(0.72, 0.1, 0.08, 0.08, 0.6, 0.12, '#8E5468'); T.box(0.08, 0.62, 0.08, 0.64, 0.08, 0.06, '#8E5468'); })],
       },
    litter: {    
      parts: () => [F(0, 0, 0.7, 0.55, (T, o) => { const p = PETS.find(q => q.litter === o.id), n = p ? p.litterUses : 0; T.box(0, 0, 0, 0.7, 0.55, 0.22, '#7F9A90'); T.poly([[0.06, 0.06, 0.2], [0.64, 0.06, 0.2], [0.64, 0.49, 0.2], [0.06, 0.49, 0.2]], '#D9CBB0'); for (let k = 0; k < Math.min(6, n); k++) { const [sx, sy] = T.P(0.16 + ((k * 0.37) % 0.42), 0.14 + ((k * 0.23) % 0.3), 0.205); ell(sx, sy, 2.6, 1.5, '#8A6A50'); } })],
       },
    arclamp: {      
      parts: () => [F(0, 0, 0.45, 0.5, (T, o) => { T.box(0.05, 0.08, 0, 0.35, 0.35, 0.08, '#C9CED6'); let prev = null; for (let i = 0; i <= 14; i++) { const a = i / 14, pt = [0.22 + 0.82 * Math.pow(a, 1.6), 0.25, 0.08 + 3.2 * a - 1.65 * a * a]; if (prev) T.line(prev, pt, '#9AA3A8', 2); prev = pt; }
        const [hx, hy] = T.P(1.04, 0.25, 1.52), on = isLit(o.id); ctx.beginPath(); ctx.ellipse(hx, hy, 10, 9, 0, Math.PI, 0); ctx.fillStyle = on ? '#F4E3B5' : '#D8CFC2'; ctx.fill(); ell(hx, hy, 10, 3.6, on ? '#FFF6D8' : '#BDB3A6'); })],
       },
    // ---- the catalog: seating ----
    armchair: {      
      parts: (o) => { const c = cl(o); return [B(0, 0, 0, 0.95, 0.9, 0.4, shade(c, -0.15), { name: 'base' }), B(0, 0, 0.4, 0.95, 0.24, 0.55, c), B(0, 0.24, 0, 0.16, 0.66, 0.64, c), B(0.79, 0.24, 0, 0.16, 0.66, 0.64, c), B(0.16, 0.24, 0.4, 0.63, 0.64, 0.1, shade(c, 0.12))]; },
       },
    loveseat: {      
      parts: (o) => { const c = cl(o); return [B(0, 0, 0, 1.7, 0.92, 0.38, shade(c, -0.15), { name: 'base' }), B(0, 0, 0.38, 1.7, 0.28, 0.58, c), B(0, 0, 0, 0.18, 0.92, 0.62, c), B(1.52, 0, 0, 0.18, 0.92, 0.62, c), B(0.18, 0.28, 0.38, 0.67, 0.62, 0.1, shade(c, 0.1)), B(0.85, 0.28, 0.38, 0.67, 0.62, 0.1, shade(c, 0.1))]; },
       },
    beanbag: {      
      parts: (o) => [F(0, 0, 0.85, 0.85, (T) => { const c = cl(o), [x, y] = T.P(0.42, 0.42, 0.1); ell(x, y + 3, 23, 11, shade(c, -0.3)); ell(x, y - 3, 22, 14, c); ell(x - 5, y - 9, 9, 4, shade(c, 0.22)); }, { name: 'base' })],
       },
    rocker: {      
      parts: (o) => [F(0, 0, 0.8, 0.95, (T, ob, t) => { const c = cl(o), rk = usingSlot(ob.id + ':s') ? Math.sin(t * 2.2) * 0.05 : 0; [0.05, 0.71].forEach(x => { let prev = null; for (let k = 0; k <= 6; k++) { const yy = k / 6 * 0.95, pt = [x, yy, 0.04 + Math.pow((yy - 0.47) / 0.47, 2) * 0.06 + rk * (yy - 0.47)]; if (prev) T.line(prev, pt, shade(c, -0.2), 2.4); prev = pt; } });
        [0.08, 0.68].forEach(x => [0.25, 0.75].forEach(y => T.line([x + 0.02, y, 0.08], [x + 0.02, y, 0.45], c, 2))); T.box(0.05, 0.15, 0.45 + rk, 0.7, 0.7, 0.06, c); T.box(0.1, 0.2, 0.51 + rk, 0.6, 0.6, 0.05, '#E8DCC8'); [0.12, 0.3, 0.5, 0.68].forEach(x => T.line([x, 0.17, 0.5 + rk], [x, 0.12, 1.12 + rk], c, 2.2)); T.line([0.08, 0.13, 1.12 + rk], [0.72, 0.13, 1.12 + rk], c, 3); }, { name: 'base' })],
       },
    accent: {      
      parts: (o) => { const c = cl(o); return [B(0.04, 0.04, 0, 0.05, 0.05, 0.4, '#5A3E2E'), B(0.63, 0.04, 0, 0.05, 0.05, 0.4, '#5A3E2E'), B(0.04, 0.63, 0, 0.05, 0.05, 0.4, '#5A3E2E'), B(0.63, 0.63, 0, 0.05, 0.05, 0.4, '#5A3E2E'), B(0, 0, 0.4, 0.72, 0.72, 0.1, c, { name: 'seat' }), B(0, 0, 0.5, 0.72, 0.12, 0.42, c)]; },
       },
    ottoman: {      
      parts: (o) => { const c = cl(o); return [B(0.03, 0.03, 0, 0.54, 0.54, 0.34, shade(c, -0.1)), B(0, 0, 0.34, 0.6, 0.6, 0.08, c)]; } },
    // ---- tables and storage ----
    coffeetable: {      
      parts: (o) => { const c = cl(o); return [B(0.05, 0.05, 0, 0.06, 0.06, 0.38, shade(c, -0.2)), B(1.09, 0.05, 0, 0.06, 0.06, 0.38, shade(c, -0.2)), B(0.05, 0.54, 0, 0.06, 0.06, 0.38, shade(c, -0.2)), B(1.09, 0.54, 0, 0.06, 0.06, 0.38, shade(c, -0.2)), B(0.1, 0.1, 0.12, 1.0, 0.45, 0.03, shade(c, -0.1)), B(0, 0, 0.38, 1.2, 0.65, 0.06, c, { name: 'top' }),
        F(0.15, 0.15, 0.6, 0.5, (T) => { T.box(0.18, 0.2, 0.44, 0.34, 0.25, 0.04, '#C2413A'); T.box(0.2, 0.22, 0.48, 0.3, 0.22, 0.04, '#F2EEE8'); T.box(0.8, 0.3, 0.44, 0.1, 0.1, 0.1, '#E9E4DD'); }, { onTop: true })]; } },
    sidetable: {      
      parts: (o) => [F(0, 0, 0.5, 0.5, (T) => { const c = cl(o); T.box(0.05, 0.05, 0, 0.4, 0.4, 0.55, c); T.line([0.06, 0.451, 0.32], [0.44, 0.451, 0.32], 'rgba(0,0,0,.25)', 1); T.box(0.17, 0.17, 0.55, 0.14, 0.14, 0.18, '#E8DCC8'); const [x, y] = T.P(0.24, 0.24, 0.76); ell(x - 3, y - 3, 2.5, 5, '#4F9460', null, -0.4); ell(x + 3, y - 4, 2.5, 5, '#5BA36C', null, 0.4); })] },
    console: {       
      parts: (o) => { const c = cl(o); return [B(0.04, 0.04, 0, 0.05, 0.3, 0.8, shade(c, -0.15)), B(1.21, 0.04, 0, 0.05, 0.3, 0.8, shade(c, -0.15)), B(0.04, 0.04, 0.2, 1.22, 0.3, 0.03, shade(c, -0.1)), B(0, 0, 0.8, 1.3, 0.38, 0.05, c, { name: 'top' }),
        F(0.2, 0.05, 1.1, 0.33, (T) => { T.box(0.22, 0.12, 0.85, 0.16, 0.16, 0.32, '#4A5DA8'); const [x, y] = T.P(0.3, 0.2, 1.17); limb(x, y, x - 6, y - 14, '#6B5A3A', 1); limb(x, y, x + 5, y - 16, '#6B5A3A', 1); circle(x - 6, y - 15, 2.5, '#E8C9A0'); circle(x + 5, y - 17, 2.5, '#E8C9A0'); T.box(0.75, 0.1, 0.85, 0.3, 0.2, 0.08, '#2B2B30'); T.box(0.78, 0.12, 0.93, 0.24, 0.16, 0.06, '#C2413A'); }, { onTop: true })]; } },
    cabinet: {       
      parts: (o) => [F(0, 0, 1.0, 0.45, (T) => { const c = cl(o); T.box(0.03, 0.03, 0, 0.94, 0.4, 0.08, '#2B2B30'); T.box(0, 0, 0.08, 1.0, 0.45, 0.95, c); T.line([0.5, 0.451, 0.12], [0.5, 0.451, 0.98], 'rgba(0,0,0,.3)', 1); [0.44, 0.56].forEach(x => { const [sx, sy] = T.P(x, 0.452, 0.6); circle(sx, sy, 1.6, '#C9A24A'); }); T.box(0.62, 0.1, 1.03, 0.2, 0.2, 0.26, '#E9E4DD'); })] },
    wardrobe: {       
      parts: (o) => [F(0, 0, 1.2, 0.6, (T) => { const c = cl(o); T.box(0, 0, 0, 1.2, 0.6, 2.0, c); T.box(-0.02, -0.02, 2.0, 1.24, 0.64, 0.05, shade(c, -0.15)); T.line([0.6, 0.601, 0.1], [0.6, 0.601, 1.95], 'rgba(0,0,0,.3)', 1); [0.52, 0.68].forEach(x => T.line([x, 0.603, 0.9], [x, 0.603, 1.2], '#C9A24A', 2)); })] },
    cubeshelf: {       
      parts: (o) => [F(0, 0, 1.0, 0.35, (T) => { const c = cl(o); T.box(0, 0, 0, 1.0, 0.35, 1.0, c); const bins = ['#E0A43A', '#3D6B73', '#D24A7A', '#7FB069']; [[0.04, 0.04], [0.52, 0.04], [0.04, 0.52], [0.52, 0.52]].forEach(([x, z], k) => { T.poly([[x, 0.351, z], [x + 0.44, 0.351, z], [x + 0.44, 0.351, z + 0.44], [x, 0.351, z + 0.44]], 'rgba(0,0,0,.28)'); if (k !== 2) T.poly([[x + 0.04, 0.352, z + 0.02], [x + 0.4, 0.352, z + 0.02], [x + 0.4, 0.352, z + 0.32], [x + 0.04, 0.352, z + 0.32]], bins[k]); else T.poly([[x + 0.06, 0.352, z + 0.02], [x + 0.36, 0.352, z + 0.02], [x + 0.36, 0.352, z + 0.36], [x + 0.06, 0.352, z + 0.36]], '#4A5DA8'); }); })] },
    // ---- rugs (you can walk on them) ----
    // The rugs the house comes with, drawn as they were when they were painted on: the living room's wine rug with its cream border and bars, the bedroom's lilac one.
    rugwide: {
      parts: (o) => [F(0, 0, 3.3, 1.9, (T) => { const c = cl(o), q = (a, b, x, y, z, col, st) => T.poly([[a, b, z], [x, b, z], [x, y, z], [a, y, z]], col, st, 1.2); q(0, 0, 3.3, 1.9, 0.01, c); q(0.18, 0.18, 3.12, 1.72, 0.012, null, '#E8C9A0'); for (let k = 0; k < 4; k++) { const yy = 0.45 + k * 0.38; q(0.4, yy, 2.9, yy + 0.12, 0.013, shade(c, -0.16)); } }, { decal: true })] },
    rugsquare: {
      parts: (o) => [F(0, 0, 2.0, 2.1, (T) => { const c = cl(o), q = (a, b, x, y, z, col, st) => T.poly([[a, b, z], [x, b, z], [x, y, z], [a, y, z]], col, st, 1); q(0, 0, 2.0, 2.1, 0.01, c); q(0.15, 0.15, 1.85, 1.95, 0.012, null, 'rgba(255,255,255,.5)'); }, { decal: true })] },
    rugrect: {        
      parts: (o) => [F(0, 0, 2.4, 1.6, (T) => { const c = cl(o), q = (a, b, x, y, z, col, st) => T.poly([[a, b, z], [x, b, z], [x, y, z], [a, y, z]], col, st, 1.2); q(0, 0, 2.4, 1.6, 0.008, c); q(0.15, 0.15, 2.25, 1.45, 0.01, null, shade(c, 0.45)); q(0.3, 0.3, 2.1, 1.3, 0.011, shade(c, -0.12)); for (let k = 0; k < 4; k++) { const x = 0.55 + k * 0.45; T.poly([[x, 0.8, 0.012], [x + 0.18, 0.55, 0.012], [x + 0.36, 0.8, 0.012], [x + 0.18, 1.05, 0.012]], shade(c, 0.35)); } }, { decal: true })] },
    rugrunner: {        
      parts: (o) => [F(0, 0, 2.8, 0.8, (T) => { const c = cl(o); T.poly([[0, 0, 0.008], [2.8, 0, 0.008], [2.8, 0.8, 0.008], [0, 0.8, 0.008]], c); for (let x = 0.2; x < 2.7; x += 0.3) T.line([x, 0.1, 0.01], [x, 0.7, 0.01], shade(c, 0.3), 1.4); T.line([0.08, 0.08, 0.011], [2.72, 0.08, 0.011], shade(c, -0.3), 1.6); T.line([0.08, 0.72, 0.011], [2.72, 0.72, 0.011], shade(c, -0.3), 1.6); }, { decal: true })] },
    ruground: {        
      parts: (o) => [F(0, 0, 1.8, 1.8, (T) => { const c = cl(o); [[0.9, c], [0.7, shade(c, 0.25)], [0.45, c], [0.22, shade(c, -0.15)]].forEach(([r, col]) => { const pts = []; for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; pts.push([0.9 + Math.cos(a) * r, 0.9 + Math.sin(a) * r, 0.009]); } T.poly(pts, col); }); }, { decal: true })] },
    // ---- decor ----
    floormirror: {       
      parts: (o) => [F(0, 0, 0.7, 0.18, (T) => { const c = cl(o); T.box(0, 0, 0, 0.7, 0.12, 1.8, c); T.poly([[0.07, 0.121, 0.07], [0.63, 0.121, 0.07], [0.63, 0.121, 1.73], [0.07, 0.121, 1.73]], '#DCE8EE'); T.poly([[0.07, 0.122, 1.1], [0.63, 0.122, 1.4], [0.63, 0.122, 1.6], [0.07, 0.122, 1.3]], 'rgba(255,255,255,.55)'); T.line([0.12, 0.123, 0.5], [0.3, 0.123, 0.8], 'rgba(255,255,255,.7)', 1.2); })] },
    gclock: {       
      parts: (o) => [F(0, 0, 0.55, 0.38, (T, ob, t) => { const c = cl(o); T.box(0, 0, 0, 0.55, 0.38, 0.25, shade(c, -0.15)); T.box(0.05, 0.03, 0.25, 0.45, 0.33, 1.35, c); T.box(0, 0, 1.6, 0.55, 0.38, 0.45, shade(c, 0.05)); T.box(-0.02, -0.02, 2.05, 0.59, 0.42, 0.05, shade(c, -0.2));
        T.poly([[0.12, 0.361, 0.35], [0.43, 0.361, 0.35], [0.43, 0.361, 1.5], [0.12, 0.361, 1.5]], 'rgba(20,15,10,.55)'); const sw = Math.sin(t * 3.1) * 0.08; T.line([0.275, 0.362, 1.45], [0.275 + sw, 0.362, 0.75], '#C9A24A', 1.4); const [px, py] = T.P(0.275 + sw, 0.363, 0.7); circle(px, py, 4, '#E0B85A');
        const [cx, cy] = T.P(0.275, 0.381, 1.83); circle(cx, cy, 8, '#F2EEE8'); const hh = (hour() % 12) / 12 * Math.PI * 2, mm = (minutes % 60) / 60 * Math.PI * 2; limb(cx, cy, cx + Math.sin(hh) * 4.5, cy - Math.cos(hh) * 4.5, '#2B2B30', 1.4); limb(cx, cy, cx + Math.sin(mm) * 6.5, cy - Math.cos(mm) * 6.5, '#2B2B30', 1); })] },
    pampas: {      
      parts: (o) => [F(0, 0, 0.42, 0.42, (T, ob, t) => { const c = cl(o); T.box(0.06, 0.06, 0, 0.3, 0.3, 0.55, c); const [x, y] = T.P(0.21, 0.21, 0.55); [[-14, -38, -0.3], [0, -46, 0], [12, -40, 0.3], [-7, -32, -0.15], [7, -34, 0.15]].forEach(([dx, dy, r], k) => { const sw = Math.sin(t * 0.7 + k) * 1.5; limb(x, y, x + dx * 0.7 + sw, y + dy * 0.75, '#A88E6A', 1); ell(x + dx + sw, y + dy, 4, 11, 'rgba(236,222,196,.95)', null, r); }); })] },
    lantern: {      
      parts: (o) => [F(0, 0, 0.36, 0.36, (T, ob) => { const c = cl(o), on = isLit(ob.id); T.box(0.03, 0.03, 0, 0.3, 0.3, 0.06, c); T.box(0.06, 0.06, 0.06, 0.24, 0.24, 0.42, on ? 'rgba(255,214,140,.9)' : 'rgba(220,210,190,.6)'); [[0.06, 0.06], [0.28, 0.06], [0.06, 0.28], [0.28, 0.28]].forEach(([x, y]) => T.line([x + 0.01, y + 0.01, 0.06], [x + 0.01, y + 0.01, 0.48], c, 1.6)); T.box(0.03, 0.03, 0.48, 0.3, 0.3, 0.05, c); const [hx, hy] = T.P(0.18, 0.18, 0.62); ell(hx, hy, 4, 3, null, c); })],  },
    candles: {
      parts: (o) => [F(0, 0, 0.5, 0.4, (T, ob, t) => {
        const c = cl(o), on = isLit(ob.id);
        T.box(0.04, 0.04, 0, 0.42, 0.32, 0.04, '#C9A24A');
        [[0.1, 0.1, 0.38], [0.28, 0.12, 0.5], [0.2, 0.24, 0.28]].forEach(([x, y, h], k) => {
          T.box(x, y, 0.04, 0.11, 0.11, h - 0.04, k === 1 ? shade(c, -0.08) : c);
          const [fx, fy] = T.P(x + 0.055, y + 0.055, h + 0.03);
          if (on) { const fl = Math.sin(t * 9 + k * 2.1) * 0.7; ell(fx, fy - 3, 2.3, 4 + fl * 0.4, 'rgba(255,190,80,.95)'); ell(fx, fy - 2, 1.1, 2.2, 'rgba(255,246,210,.95)'); }
          else ell(fx, fy, 0.9, 1.2, '#2B2B30');
        });
      })] },
    basket: {
      parts: (o) => [F(0, 0, 0.8, 0.8, (T) => {
        const c = cl(o);
        T.box(0.08, 0.08, 0, 0.64, 0.64, 0.4, c);
        for (let z = 0.08; z < 0.4; z += 0.1) { T.line([0.08, 0.72, z], [0.72, 0.72, z], shade(c, -0.25), 1); T.line([0.72, 0.08, z], [0.72, 0.72, z], shade(c, -0.3), 1); }
        T.box(0.06, 0.06, 0.4, 0.68, 0.68, 0.05, shade(c, 0.1));
        // A throw blanket heaped in it, one corner trailing over the rim.
        const [bx, by] = T.P(0.4, 0.4, 0.5);
        ell(bx, by, 19, 9, '#C9A9A0'); ell(bx - 3, by - 2, 13, 6, '#E4D3CB'); ell(bx + 4, by + 1, 9, 4, '#B5476E');
        T.poly([[0.62, 0.72, 0.42], [0.8, 0.72, 0.34], [0.78, 0.76, 0.12], [0.6, 0.76, 0.2]], '#C9A9A0');
      })] },
    coatrack: {
      parts: (o) => [F(0, 0, 0.45, 0.45, (T) => {
        const c = cl(o);
        T.box(0.1, 0.1, 0, 0.25, 0.25, 0.05, shade(c, -0.1));
        T.line([0.225, 0.225, 0.05], [0.225, 0.225, 1.75], c, 3);
        [[-0.16, -0.1], [0.16, -0.1], [0, 0.16], [0, -0.16]].forEach(([dx, dy], k) => { T.line([0.225, 0.225, 1.62 - (k % 2) * 0.08], [0.225 + dx, 0.225 + dy, 1.7 - (k % 2) * 0.08], c, 2); });
        // A coat and a scarf hanging from it.
        T.poly([[0.12, 0.38, 1.58], [0.34, 0.38, 1.58], [0.36, 0.38, 0.85], [0.1, 0.38, 0.85]], '#3F5B4C');
        T.poly([[0.1, 0.4, 1.3], [0.2, 0.4, 1.3], [0.2, 0.4, 0.8], [0.1, 0.4, 0.8]], '#B5476E');
      })] },
    bookstack: {
      parts: (o) => [F(0, 0, 0.45, 0.35, (T) => {
        const c = cl(o);
        [[0.02, 0.04, 0, 0.4, 0.3, 0.1, c], [0.05, 0.06, 0.1, 0.36, 0.26, 0.09, '#2E3B57'], [0.0, 0.05, 0.19, 0.38, 0.27, 0.1, '#C9A24A'], [0.06, 0.07, 0.29, 0.32, 0.24, 0.09, '#3F5B4C'], [0.03, 0.06, 0.38, 0.34, 0.24, 0.08, '#B5476E']]
          .forEach(([x, y, z, w, d, h, col]) => { T.box(x, y, z, w, d, h, col); T.line([x + 0.02, y + d, z + h / 2], [x + w - 0.02, y + d, z + h / 2], 'rgba(255,255,255,.35)', 1); });
      })] },
    eucalyptus: {
      parts: (o) => [F(0, 0, 0.42, 0.42, (T, ob, t) => {
        const c = cl(o);
        T.box(0.08, 0.08, 0, 0.26, 0.26, 0.5, c); T.box(0.12, 0.12, 0.5, 0.18, 0.18, 0.1, shade(c, -0.12));
        const [x, y] = T.P(0.21, 0.21, 0.6);
        [[-16, -64, -0.2], [-4, -86, 0], [12, -72, 0.25], [-9, -48, -0.3], [7, -54, 0.2], [20, -52, 0.5]].forEach(([dx, dy, r], k) => {
          const sw = Math.sin(t * 0.8 + k) * 1.6;
          limb(x, y, x + dx + sw * 0.5, y + dy, '#7F8F70', 1.2);
          for (let j = 1; j <= 4; j++) { const f = j / 4; ell(x + dx * f + (j % 2 ? 3 : -3) + sw * f, y + dy * f, 3.2, 5, j % 2 ? '#9AB09E' : '#8AA391', null, r + (j % 2 ? 0.6 : -0.6)); }
        });
      })] },
    bust: {
      parts: (o) => [F(0, 0, 0.5, 0.5, (T) => {
        const c = cl(o);
        T.box(0.1, 0.1, 0, 0.3, 0.3, 0.9, '#E4DDD2'); T.box(0.07, 0.07, 0.9, 0.36, 0.36, 0.06, '#CFC7BA'); T.box(0.07, 0.07, 0, 0.36, 0.36, 0.05, '#CFC7BA');
        const [x, y] = T.P(0.25, 0.25, 0.96);
        ell(x, y - 6, 12, 7, c); rr(x - 4, y - 16, 8, 12, 3, c); ell(x, y - 24, 8, 10, c); ell(x - 3, y - 26, 3, 4, shade(c, 0.35));
        ell(x + 2, y - 10, 5, 4, shade(c, -0.12));
      })] },
    tablelamp: {
      parts: (o) => [F(0, 0, 0.5, 0.5, (T, ob) => {
        const c = cl(o), on = isLit(ob.id);
        [[0.06, 0.06], [0.4, 0.06], [0.06, 0.4], [0.4, 0.4]].forEach(([x, y]) => T.box(x, y, 0, 0.05, 0.05, 0.55, shade(c, -0.15)));
        T.box(0.03, 0.03, 0.55, 0.44, 0.44, 0.05, c);
        T.box(0.2, 0.2, 0.6, 0.1, 0.1, 0.22, '#C9A24A');
        T.box(0.12, 0.12, 0.82, 0.26, 0.26, 0.3, on ? 'rgba(255,226,160,.96)' : 'rgba(240,232,214,.95)');
      })] },
    candelabra: {
      parts: (o) => [F(0, 0, 0.4, 0.4, (T, ob, t) => {
        const c = cl(o), on = isLit(ob.id);
        T.box(0.08, 0.08, 0, 0.24, 0.24, 0.05, c); T.line([0.2, 0.2, 0.05], [0.2, 0.2, 1.1], c, 3);
        T.line([0.2, 0.2, 1.1], [0.06, 0.2, 1.3], c, 2); T.line([0.2, 0.2, 1.1], [0.34, 0.2, 1.3], c, 2); T.line([0.2, 0.2, 1.1], [0.2, 0.2, 1.38], c, 2);
        [[0.06, 0.2, 1.3], [0.34, 0.2, 1.3], [0.2, 0.2, 1.38]].forEach(([x, y, z], k) => {
          T.box(x - 0.03, y - 0.03, z, 0.06, 0.06, 0.1, '#F2EEE8');
          const [fx, fy] = T.P(x, y, z + 0.13);
          if (on) { const fl = Math.sin(t * 9 + k * 2) * 0.7; ell(fx, fy - 2, 2, 3.8 + fl * 0.4, 'rgba(255,190,80,.95)'); ell(fx, fy - 1, 0.9, 2, 'rgba(255,246,210,.95)'); }
        });
      })] },
    blanketladder: {
      parts: (o) => [F(0, 0, 0.7, 0.25, (T) => {
        const c = cl(o);
        T.line([0.1, 0.1, 0], [0.16, 0.14, 1.6], c, 3); T.line([0.6, 0.1, 0], [0.54, 0.14, 1.6], c, 3);
        [0.35, 0.7, 1.05, 1.4].forEach((z) => T.line([0.12, 0.12, z], [0.58, 0.12, z], c, 2.4));
        // Blankets draped over the rungs.
        T.poly([[0.1, 0.17, 1.4], [0.6, 0.17, 1.4], [0.6, 0.17, 0.98], [0.1, 0.17, 0.98]], '#C9A9A0');
        T.poly([[0.12, 0.19, 1.05], [0.58, 0.19, 1.05], [0.58, 0.19, 0.62], [0.12, 0.19, 0.62]], '#B5476E');
        T.poly([[0.16, 0.21, 0.7], [0.54, 0.21, 0.7], [0.54, 0.21, 0.4], [0.16, 0.21, 0.4]], '#3F5B4C');
        T.line([0.1, 0.17, 1.2], [0.6, 0.17, 1.2], 'rgba(255,255,255,.35)', 1);
      })] },
    plantstand: {
      parts: (o) => [F(0, 0, 0.5, 0.5, (T, ob, t) => {
        const c = cl(o);
        T.box(0.12, 0.12, 0, 0.05, 0.05, 0.62, c); T.box(0.33, 0.12, 0, 0.05, 0.05, 0.62, c); T.box(0.12, 0.33, 0, 0.05, 0.05, 0.62, c); T.box(0.33, 0.33, 0, 0.05, 0.05, 0.62, c);
        T.box(0.08, 0.08, 0.62, 0.34, 0.34, 0.05, c);
        T.box(0.14, 0.14, 0.67, 0.22, 0.22, 0.2, '#C27A5A');
        const [x, y] = T.P(0.25, 0.25, 0.9);
        for (let k = 0; k < 7; k++) { const a = -Math.PI + k / 6 * Math.PI, sw = Math.sin(t * 0.9 + k) * 0.05; ctx.strokeStyle = k % 2 ? '#3F7D4E' : '#4F9460'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a + sw) * 12, y - 14, x + Math.cos(a + sw) * 20, y + 6 + (k % 3) * 8); ctx.stroke(); ell(x + Math.cos(a + sw) * 20, y + 8 + (k % 3) * 8, 3, 4, '#4F9460'); }
      })] },
    woodstool: {
      parts: (o) => [F(0, 0, 0.45, 0.45, (T) => {
        const c = cl(o);
        [[0.07, 0.07], [0.33, 0.07], [0.07, 0.33], [0.33, 0.33]].forEach(([x, y]) => T.box(x, y, 0, 0.05, 0.05, 0.46, shade(c, -0.18)));
        T.box(0.04, 0.04, 0.46, 0.37, 0.37, 0.07, c);
      })] },
    flowervase: {
      parts: (o) => [F(0, 0, 0.3, 0.3, (T, ob, t) => {
        const c = cl(o);
        T.box(0.08, 0.08, 0, 0.14, 0.14, 0.2, c); T.box(0.1, 0.1, 0.2, 0.1, 0.1, 0.08, shade(c, -0.1));
        const [x, y] = T.P(0.15, 0.15, 0.3);
        [[-10, -22, '#E8798E'], [0, -30, '#F2C14E'], [10, -23, '#F2EEE8'], [-4, -16, '#B5476E'], [5, -14, '#E8798E']].forEach(([dx, dy, col], k) => {
          const sw = Math.sin(t * 0.9 + k) * 0.8;
          limb(x, y, x + dx * 0.8 + sw, y + dy * 0.8 + 3, '#4F9460', 1); circle(x + dx + sw, y + dy, 3.4, col); circle(x + dx + sw, y + dy, 1.2, '#F2C14E');
        });
      })] },
    succulents: {
      parts: (o) => [F(0, 0, 0.35, 0.35, (T) => {
        const c = cl(o);
        [[0.05, 0.12, 0.17, 0.16], [0.2, 0.05, 0.13, 0.12], [0.18, 0.2, 0.15, 0.14]].forEach(([x, y, s, h], k) => {
          T.box(x, y, 0, s, s, h, k === 1 ? shade(c, 0.12) : c);
          const [px, py] = T.P(x + s / 2, y + s / 2, h);
          for (let j = 0; j < 6; j++) { const a = j / 6 * Math.PI * 2; ell(px + Math.cos(a) * 3.4, py - 1 + Math.sin(a) * 1.6, 2.6, 4, j % 2 ? '#6FA079' : '#8DBB8F', null, a); }
          ell(px, py - 2, 2.2, 3, '#A9D2A2');
        });
      })] },
    desklamp: {
      parts: (o) => [F(0, 0, 0.3, 0.3, (T, ob) => {
        const c = cl(o), on = isLit(ob.id);
        T.box(0.06, 0.06, 0, 0.18, 0.18, 0.04, c);
        T.line([0.15, 0.15, 0.04], [0.15, 0.15, 0.34], c, 2.2); T.line([0.15, 0.15, 0.34], [0.2, 0.2, 0.5], c, 2);
        T.box(0.14, 0.14, 0.44, 0.14, 0.14, 0.1, on ? 'rgba(255,226,160,.98)' : shade(c, 0.15));
      })] },
    photoframes: {
      parts: (o) => [F(0, 0, 0.4, 0.15, (T) => {
        const c = cl(o);
        [[0.02, 0.2, 0.28, '#9EC1C9'], [0.17, 0.2, 0.22, '#E8B39A'], [0.3, 0.2, 0.16, '#B7C79B']].forEach(([x, h, w, pic]) => {
          T.box(x, 0.04, 0, w * 0.45, 0.06, h + 0.06, c);
          T.poly([[x + 0.012, 0.1 + 0.001, 0.03], [x + w * 0.45 - 0.012, 0.1 + 0.001, 0.03], [x + w * 0.45 - 0.012, 0.1 + 0.001, h + 0.045], [x + 0.012, 0.1 + 0.001, h + 0.045]], pic);
        });
      })] },
    umbrella: {
      parts: (o) => [F(0, 0, 0.4, 0.4, (T) => {
        const c = cl(o);
        T.box(0.06, 0.06, 0, 0.28, 0.28, 0.5, c); T.box(0.04, 0.04, 0.5, 0.32, 0.32, 0.04, shade(c, -0.2));
        [['#2B2B30', 0.13, 0.15, 0.78], ['#B5476E', 0.25, 0.2, 0.72], ['#2E3B57', 0.2, 0.28, 0.66]].forEach(([col, ux, uy, h]) => {
          T.line([ux, uy, 0.3], [ux, uy, h], col, 2.2);
          const [hx, hy] = T.P(ux, uy, h); ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(hx + 3, hy, 3, Math.PI, Math.PI * 2.2); ctx.stroke();
        });
      })] },
    // ---- plants (they all need watering) ----
    fern: {      
      parts: (o) => [F(0, 0, 0.55, 0.55, (T, ob, t) => { T.box(0.08, 0.08, 0, 0.4, 0.4, 0.42, cl(o)); const [x, y] = T.P(0.27, 0.27, 0.45); for (let k = 0; k < 9; k++) { const a = -Math.PI + k / 8 * Math.PI, sw = Math.sin(t * 0.8 + k) * 0.05, ex = x + Math.cos(a + sw) * 22, ey = y - 6 + Math.sin(a + sw) * 12 + 6; ctx.strokeStyle = k % 2 ? '#3F7D4E' : '#4F9460'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo((x + ex) / 2, y - 20, ex, ey); ctx.stroke(); } })],
       },
    cactus: {      
      parts: (o) => [F(0, 0, 0.45, 0.45, (T) => { T.box(0.06, 0.06, 0, 0.33, 0.33, 0.32, cl(o)); const [x, y] = T.P(0.22, 0.22, 0.33); rr(x - 5, y - 46, 10, 46, 5, '#4F8A5B'); rr(x - 15, y - 34, 7, 16, 3.5, '#4F8A5B'); rr(x - 15, y - 22, 12, 6, 3, '#4F8A5B'); rr(x + 7, y - 40, 7, 18, 3.5, '#5A9765'); rr(x + 3, y - 26, 11, 6, 3, '#5A9765'); limb(x, y - 44, x, y - 4, 'rgba(255,255,255,.25)', 1); circle(x, y - 47, 2.5, '#E07A9A'); })],
       },
    fiddle: {      
      parts: (o) => [F(0, 0, 0.6, 0.6, (T, ob, t) => { T.box(0.1, 0.1, 0, 0.4, 0.4, 0.45, cl(o)); const [x, y] = T.P(0.3, 0.3, 0.45); limb(x, y, x + 2, y - 50, '#6B4A35', 2.5); [[-10, -30, -0.6], [10, -36, 0.6], [-8, -44, -0.4], [9, -50, 0.5], [0, -58, 0], [-12, -52, -0.8], [12, -24, 0.9]].forEach(([dx, dy, r], k) => ell(x + dx + Math.sin(t * 0.6 + k) * 0.8, y + dy, 6, 9, k % 2 ? '#2F6B40' : '#3F7D4E', null, r)); })],
       },
    snake: {      
      parts: (o) => [F(0, 0, 0.45, 0.45, (T) => { T.box(0.06, 0.06, 0, 0.33, 0.33, 0.36, cl(o)); const [x, y] = T.P(0.22, 0.22, 0.37); [[-7, 30, -0.15], [-2, 40, -0.05], [4, 36, 0.08], [8, 26, 0.2], [0, 22, 0]].forEach(([dx, hh, r], k) => { ell(x + dx + Math.sin(r) * hh * 0.5, y - hh / 2, 3.2, hh / 2, k % 2 ? '#4E7A3E' : '#5E8A48', null, r); ell(x + dx + Math.sin(r) * hh * 0.5, y - hh / 2, 1.4, hh / 2 - 2, 'rgba(220,210,120,.35)', null, r); }); })],
       },
    palm: {      
      parts: (o) => [F(0, 0, 0.7, 0.7, (T, ob, t) => { T.box(0.12, 0.12, 0, 0.46, 0.46, 0.45, cl(o)); const [x, y] = T.P(0.35, 0.35, 0.45); for (let k = 0; k < 7; k++) { const a = -Math.PI * 0.9 + k / 6 * Math.PI * 0.8, sw = Math.sin(t * 0.7 + k) * 0.04, tx = x + Math.cos(a + sw) * 30, ty = y - 50 + Math.sin(a + sw) * 8 + 18; limb(x, y, (x + tx) / 2, ty - 10, '#5A7A3A', 1.5); for (let m = 0; m < 5; m++) { const f = 0.4 + m * 0.13, px = x + (tx - x) * f, py = y + (ty - 8 - y) * f; ell(px, py, 2, 6, '#4F9460', null, a + 1.2); } } })],
       },
    // ---- hobbies: each one is something they can do ----
    aquarium: {       
      parts: (o) => [F(0, 0, 1.2, 0.45, (T, ob, t) => { const c = cl(o); T.box(0, 0, 0, 1.2, 0.45, 0.72, c); T.box(0.02, 0.02, 0.72, 1.16, 0.41, 0.52, power ? 'rgba(95,184,214,.55)' : 'rgba(80,110,120,.6)'); T.box(-0.01, -0.01, 1.24, 1.22, 0.47, 0.05, c); T.poly([[0.03, 0.43, 0.74], [1.17, 0.43, 0.74], [1.17, 0.43, 0.8], [0.03, 0.43, 0.8]], '#E8D9B0');
        [[0.25, '#3F7D4E'], [0.95, '#4F9460']].forEach(([x, col], k) => { const [sx, sy] = T.P(x, 0.3, 0.78); ell(sx, sy - 9, 2, 9, col, null, Math.sin(t + k) * 0.2); ell(sx + 4, sy - 7, 2, 7, col, null, 0.3 + Math.sin(t * 1.2 + k) * 0.2); });
        ['#E07A2B', '#E0B85A', '#D24A7A', '#4A88B8'].forEach((col, k) => { const ph = t * (0.25 + k * 0.07) + k * 1.7, u = 0.6 + Math.sin(ph) * 0.45, z = 0.88 + k * 0.08 + Math.sin(ph * 2.3) * 0.03, [fx, fy] = T.P(u, 0.44, z), dir = Math.cos(ph) > 0 ? 1 : -1; ell(fx, fy, 3.2, 1.8, col); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(fx - dir * 3, fy); ctx.lineTo(fx - dir * 6, fy - 2); ctx.lineTo(fx - dir * 6, fy + 2); ctx.fill(); }); })],
        },
    piano: {       
      parts: (o) => { const c = cl(o); return [F(0, 0, 1.5, 0.62, (T, ob, t) => { T.box(0, 0, 0, 1.5, 0.5, 1.25, c); T.box(0.05, 0.5, 0.68, 1.4, 0.12, 0.08, c); T.poly([[0.07, 0.5, 0.761], [1.43, 0.5, 0.761], [1.43, 0.62, 0.761], [0.07, 0.62, 0.761]], '#F7F3EE'); for (let k = 0; k < 18; k++) if (k % 7 !== 2 && k % 7 !== 6) { const x = 0.12 + k * 0.074; T.poly([[x, 0.5, 0.765], [x + 0.035, 0.5, 0.765], [x + 0.035, 0.57, 0.765], [x, 0.57, 0.765]], '#1B1A1F'); } if (usingSlot(ob.id + ':p')) for (let k = 0; k < 3; k++) { const ph = (t * 0.7 + k / 3) % 1, [nx, ny] = T.P(0.4 + k * 0.35, 0.4, 1.35 + ph * 0.6); ctx.fillStyle = `rgba(60,50,70,${1 - ph})`; ctx.font = '11px serif'; ctx.fillText('♪', nx, ny); } }), B(0.45, 0.8, 0, 0.6, 0.3, 0.45, shade(c, 0.1), { name: 'bench' })]; },
       },
    easel: {      
      parts: (o) => [F(0, 0, 0.8, 0.6, (T, ob) => { const c = cl(o); T.line([0.12, 0.5, 0], [0.4, 0.3, 1.7], c, 2.5); T.line([0.68, 0.5, 0], [0.4, 0.3, 1.7], c, 2.5); T.line([0.4, 0.05, 0], [0.4, 0.3, 1.6], c, 2.2); T.line([0.15, 0.45, 0.62], [0.65, 0.45, 0.62], c, 2.5);
        T.poly([[0.12, 0.42, 0.66], [0.68, 0.42, 0.66], [0.68, 0.36, 1.4], [0.12, 0.36, 1.4]], '#F7F3EE', 'rgba(0,0,0,.2)', 1); const n = ob.art || 0, pal = ['#D24A7A', '#E0A43A', '#3D6B73', '#4F9460', '#4A5DA8', '#C2413A'];
        for (let k = 0; k < Math.min(7, 1 + n); k++) { const u = 0.2 + ((k * 0.37 + n * 0.13) % 0.42), z = 0.75 + ((k * 0.29 + n * 0.21) % 0.55), [px, py] = T.P(u, 0.4 - (z - 0.66) * 0.08, z); ell(px, py, 4 + (k % 3), 3, pal[(k + n) % 6], null, k * 0.7); } })],
       },
    telescope: {      
      parts: (o) => [F(0, 0, 0.6, 0.6, (T) => { const c = cl(o); [[0.05, 0.55], [0.55, 0.55], [0.3, 0.05]].forEach(([x, y]) => T.line([x, y, 0], [0.3, 0.35, 1.0], '#3A3340', 2)); const a = [0.12, 0.5, 0.92], b = [0.55, 0.1, 1.38]; T.line(a, b, c, 7); T.line(a, [0.18, 0.44, 0.97], '#2B2B30', 7.5); const [ex, ey] = T.P(...b); circle(ex, ey, 3.5, '#9EC1F5'); })],
       },
    punchbag: {      
      parts: (o) => [F(0, 0, 0.8, 0.8, (T, ob, t) => { const c = cl(o); T.box(0.05, 0.05, 0, 0.7, 0.7, 0.04, '#2B2B30'); T.line([0.08, 0.08, 0.04], [0.08, 0.08, 2.05], '#4A4450', 3); T.line([0.08, 0.08, 2.05], [0.4, 0.4, 2.05], '#4A4450', 3); const hit = usingSlot(ob.id + ':b'), sw = hit ? Math.sin(t * 7) * 0.06 : 0; T.line([0.4, 0.4, 2.05], [0.4 + sw, 0.4, 1.65], '#9AA3A8', 1); const [bx, by] = T.P(0.4 + sw, 0.4, 1.0); rr(bx - 9, by - 38, 18, 52, 8, c); rr(bx - 9, by - 30, 18, 4, 1, shade(c, -0.3)); })],
       },
    bike: {      
      parts: (o) => { const c = cl(o); return [F(0, 0, 1.3, 0.55, (T, ob, t) => { T.box(0.1, 0.12, 0, 1.1, 0.3, 0.06, '#3A3340'); T.line([0.4, 0.27, 0.06], [0.45, 0.27, 0.6], c, 4); T.line([0.95, 0.27, 0.06], [1.0, 0.27, 1.0], c, 4); T.line([0.45, 0.27, 0.35], [0.98, 0.27, 0.5], c, 3); const [wx, wy] = T.P(0.95, 0.27, 0.32); ctx.beginPath(); ctx.arc(wx, wy, 9, 0, 7); ctx.strokeStyle = '#4A4450'; ctx.lineWidth = 2; ctx.stroke(); const sp = usingSlot(ob.id + ':r') ? t * 6 : 0; limb(wx, wy, wx + Math.cos(sp) * 8, wy + Math.sin(sp) * 8, '#9AA3A8', 1.2); T.line([1.0, 0.1, 1.0], [1.0, 0.45, 1.0], '#2B2B30', 3); T.box(0.95, 0.2, 0.9, 0.12, 0.15, 0.1, usingSlot(ob.id + ':r') && power ? '#5CC48A' : '#23402E'); }), B(0.33, 0.17, 0.6, 0.26, 0.2, 0.06, '#1B1A1F', { name: 'seat' })]; },
       },
    yogamat: {        
      parts: (o) => [F(0, 0, 1.8, 0.7, (T) => { const c = cl(o); T.poly([[0, 0, 0.012], [1.8, 0, 0.012], [1.8, 0.7, 0.012], [0, 0.7, 0.012]], c); T.poly([[0, 0, 0.013], [0.12, 0, 0.013], [0.12, 0.7, 0.013], [0, 0.7, 0.013]], shade(c, -0.2)); T.line([0.2, 0.35, 0.014], [1.7, 0.35, 0.014], 'rgba(255,255,255,.2)', 1); }, { decal: true })],
       },
    massage: {      
      parts: (o) => { const c = cl(o); return [B(0, 0, 0, 0.95, 1.0, 0.42, shade(c, -0.12), { name: 'base' }), B(0.12, 0, 0.42, 0.71, 0.3, 0.72, c), B(0, 0.1, 0.3, 0.14, 0.85, 0.42, shade(c, 0.08)), B(0.81, 0.1, 0.3, 0.14, 0.85, 0.42, shade(c, 0.08)), B(0.14, 0.3, 0.42, 0.67, 0.65, 0.1, shade(c, 0.15)), B(0.2, 1.0, 0, 0.55, 0.15, 0.3, shade(c, -0.2)),
        F(0.84, 0.3, 0.95, 0.6, (T, ob) => { T.box(0.85, 0.35, 0.73, 0.08, 0.15, 0.04, usingSlot(ob.id + ':m') && power ? '#9EC1F5' : '#4A4450'); }, { onTop: true })]; },
       },
    barcart: {      
      parts: (o) => [F(0, 0, 0.9, 0.5, (T) => { const c = cl(o); [[0.04, 0.04], [0.82, 0.04], [0.04, 0.42], [0.82, 0.42]].forEach(([x, y]) => T.line([x + 0.02, y + 0.02, 0.06], [x + 0.02, y + 0.02, 0.86], c, 1.8)); T.box(0.03, 0.03, 0.2, 0.84, 0.44, 0.03, 'rgba(220,230,235,.55)'); T.box(0.03, 0.03, 0.8, 0.84, 0.44, 0.03, 'rgba(220,230,235,.55)'); [[0.15, '#4F9460', 0.24], [0.32, '#C2413A', 0.2], [0.5, '#E0A43A', 0.28], [0.68, '#4A88B8', 0.18]].forEach(([x, col, hh]) => T.box(x, 0.18, 0.83, 0.07, 0.07, hh, col)); [0.2, 0.7].forEach(x => { const [wx, wy] = T.P(x, 0.25, 0.1); circle(wx, wy, 3, '#2B2B30'); }); })],
       },
    guitar: {      
      parts: (o) => [F(0, 0, 0.5, 0.4, (T) => { const c = cl(o); T.line([0.1, 0.35, 0], [0.25, 0.2, 0.35], '#2B2B30', 1.5); T.line([0.4, 0.35, 0], [0.25, 0.2, 0.35], '#2B2B30', 1.5); const [x, y] = T.P(0.25, 0.25, 0.1); ell(x, y - 10, 10, 12, c); ell(x, y - 26, 8, 9, c); circle(x, y - 18, 3, '#2B1A12'); limb(x, y - 30, x + 1, y - 64, '#5A3E2E', 3); rr(x - 2, y - 70, 6, 8, 1.5, '#2B1A12'); })],
       },
    cattree: {      
      parts: (o) => [F(0, 0, 0.8, 0.8, (T) => { const c = cl(o); T.box(0, 0, 0, 0.8, 0.8, 0.08, c); T.box(0.32, 0.32, 0.08, 0.16, 0.16, 1.5, '#C9B48E'); for (let z = 0.2; z < 1.5; z += 0.08) T.line([0.32, 0.48, z], [0.48, 0.48, z + 0.03], 'rgba(120,95,60,.4)', 1); T.box(0.05, 0.4, 0.6, 0.5, 0.4, 0.06, c); T.box(0.25, 0.1, 1.05, 0.5, 0.45, 0.06, c); T.box(0.15, 0.15, 1.58, 0.5, 0.5, 0.08, c); })] },
    // ---- outdoor ----
    hammock: {       
      parts: (o) => [F(0, 0, 2.4, 1.0, (T) => { const c = cl(o); [0.05, 2.28].forEach(x => T.box(x, 0.4, 0, 0.08, 0.08, 1.25, '#6B4A35')); T.box(0, 0.3, 0, 2.4, 0.28, 0.05, '#6B4A35'); const pts = [], back = []; for (let k = 0; k <= 10; k++) { const u = 0.3 + k / 10 * 1.8, z = 0.95 - Math.sin(k / 10 * Math.PI) * 0.45; pts.push([u, 0.25, z]); back.push([u, 0.75, z]); } T.poly(pts.concat(back.reverse()), c, shade(c, -0.25), 1); T.line([0.09, 0.44, 1.2], [0.3, 0.25, 0.95], '#C9B48E', 1); T.line([0.09, 0.44, 1.2], [0.3, 0.75, 0.95], '#C9B48E', 1); T.line([2.32, 0.44, 1.2], [2.1, 0.25, 0.95], '#C9B48E', 1); T.line([2.32, 0.44, 1.2], [2.1, 0.75, 0.95], '#C9B48E', 1); }, { name: 'bed' })],
       },
    firepit: {       
      parts: (o) => [F(0, 0, 1.2, 1.2, (T, ob, t) => { const c = cl(o); for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2, [sx, sy] = T.P(0.6 + Math.cos(a) * 0.45, 0.6 + Math.sin(a) * 0.45, 0.05); rr(sx - 6, sy - 7, 12, 9, 3, k % 2 ? c : shade(c, -0.15)); } const [fx, fy] = T.P(0.6, 0.6, 0.12); ell(fx, fy, 14, 6, '#2B2420'); const dark = darkness() > 0.05, fl = Math.sin(t * 9) * 0.5 + Math.sin(t * 13.7) * 0.3; if (dark || seasonIdx() >= 2) { ell(fx, fy - 7 - fl, 8, 10 + fl * 2, 'rgba(240,120,40,.9)'); ell(fx - 3, fy - 5, 5, 7 + fl, 'rgba(255,200,90,.95)'); ell(fx + 4, fy - 4, 4, 6 - fl, 'rgba(255,170,60,.9)'); const [px, py] = T.W(0.6, 0.6); PFX.emit(o.id + ':smoke', 'smoke', o.level, px, py, 0.45, raining() ? 1.5 : 1); PFX.emit(o.id + ':ember', 'ember', o.level, px, py, 0.25); } })],
        },
    grill: {       
      parts: (o) => [F(0, 0, 0.9, 0.6, (T, ob, t) => { const c = cl(o); [[0.2, 0.15], [0.7, 0.15], [0.45, 0.5]].forEach(([x, y]) => T.line([x, y, 0], [0.45, 0.3, 0.6], '#4A4450', 2)); const [x, y] = T.P(0.45, 0.3, 0.75); ctx.beginPath(); ctx.ellipse(x, y, 17, 13, 0, 0, Math.PI); ctx.fillStyle = c; ctx.fill(); ell(x, y, 17, 6, shade(c, 0.12)); if (usingSlot(ob.id + ':g')) { ell(x, y, 14, 4.5, '#3A2420'); [-6, 0, 6].forEach(dx => ell(x + dx, y - 1, 3, 1.6, '#8A4A2A')); steamAt(T, 0.45, 0.3, 0.8, t, 3, 0.7); } else { ctx.beginPath(); ctx.ellipse(x, y - 1, 17, 12, 0, Math.PI, 0); ctx.fillStyle = shade(c, 0.05); ctx.fill(); circle(x, y - 13, 2, '#9AA3A8'); } })],
       },
    patio: {       
      parts: (o) => { const c = cl(o); return [B(0.05, 0.4, 0, 0.45, 0.5, 0.4, c, { name: 'seatA' }), B(0.05, 0.4, 0.4, 0.1, 0.5, 0.45, c), B(1.3, 0.4, 0, 0.45, 0.5, 0.4, c, { name: 'seatB' }), B(1.65, 0.4, 0, 0.1, 0.5, 0.85, c),
        F(0.62, 0.3, 1.18, 0.95, (T) => { T.line([0.9, 0.62, 0], [0.9, 0.62, 0.68], '#4A4450', 3); const pts = []; for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; pts.push([0.9 + Math.cos(a) * 0.28, 0.62 + Math.sin(a) * 0.3, 0.7]); } T.poly(pts, shade(c, -0.08), 'rgba(0,0,0,.2)', 1); T.box(0.84, 0.56, 0.7, 0.1, 0.1, 0.12, '#E0A43A'); })]; },
       },
    birdfeeder: {       
      parts: (o) => [F(0, 0, 0.5, 0.5, (T, ob, t) => { const c = cl(o); T.line([0.25, 0.25, 0], [0.25, 0.25, 1.3], '#4A4450', 2.4); T.box(0.1, 0.1, 1.25, 0.3, 0.3, 0.05, c); T.box(0.15, 0.15, 1.3, 0.2, 0.2, 0.2, 'rgba(230,220,180,.8)'); T.poly([[0.05, 0.05, 1.5], [0.45, 0.05, 1.5], [0.25, 0.25, 1.68]], shade(c, -0.15)); T.poly([[0.45, 0.05, 1.5], [0.45, 0.45, 1.5], [0.25, 0.25, 1.68]], c);
        const h = hour(); if (h > 6.5 && h < 19 && seasonIdx() !== 3) [0, 1].forEach(k => { const ph = (t * 0.12 + k * 0.5) % 1; if (ph < 0.6) { const [bx, by] = T.P(k ? 0.42 : 0.08, 0.25, 1.3); const hop = Math.abs(Math.sin(t * 5 + k)) * 2; ell(bx, by - 3 - hop, 4, 3, k ? '#C2413A' : '#4A88B8'); circle(bx + (k ? 3 : -3), by - 6 - hop, 2.2, k ? '#C2413A' : '#4A88B8'); } }); })],
       },
    // ---- rotation and seasonal pieces (they show up in Today's picks) ----
    xmastree: {      
      parts: (o) => [F(0, 0, 0.95, 0.95, (T, ob, t) => { const c = cl(o); T.box(0.3, 0.3, 0, 0.35, 0.35, 0.22, '#C2413A'); const [x, y] = T.P(0.47, 0.47, 0.25); [[0, 30, 24], [16, 25, 20], [30, 19, 15], [42, 13, 10]].forEach(([dy, wdt, hh]) => { ctx.fillStyle = shade(c, dy / 120); ctx.beginPath(); ctx.moveTo(x - wdt, y - dy); ctx.lineTo(x + wdt, y - dy); ctx.lineTo(x, y - dy - hh - 10); ctx.closePath(); ctx.fill(); });
        const pal = ['#FFD27A', '#FF7AA8', '#7AD8FF', '#FFFFFF']; for (let k = 0; k < 16; k++) { const fy = 4 + (k * 37 % 50), fx = Math.sin(k * 2.3) * (26 - fy * 0.45); circle(x + fx, y - fy - 3, 1.7, Math.sin(t * 3 + k) > 0 ? pal[k % 4] : 'rgba(255,255,255,.3)'); } ctx.fillStyle = '#FFD25F'; ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 2.5 : 6; ctx.lineTo(x + Math.cos(a) * r, y - 66 + Math.sin(a) * r); } ctx.fill();
        T.box(0.0, 0.62, 0, 0.26, 0.26, 0.2, '#4A5DA8'); T.box(0.66, 0.05, 0, 0.24, 0.24, 0.16, '#D24A7A'); })],  },
    pumpkins: {      
      parts: (o) => [F(0, 0, 0.85, 0.6, (T) => { const c = cl(o), lit = darkness() > 0.1; [[0.22, 0.3, 11, 8], [0.55, 0.32, 14, 10], [0.75, 0.22, 8, 6]].forEach(([u, v, rx, ry], k) => { const [x, y] = T.P(u, v, 0.02); ell(x, y - ry, rx, ry, k === 2 ? shade(c, 0.2) : c); [-0.5, 0.5].forEach(d => ell(x + d * rx * 0.6, y - ry, rx * 0.35, ry * 0.95, null, shade(c, -0.25))); limb(x, y - ry * 2, x + 1, y - ry * 2 - 4, '#5A6A2A', 2); if (k === 1) { const f = lit ? '#FFD27A' : '#5A2A10'; ctx.fillStyle = f; [[-5, -12], [3, -12]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.moveTo(x + dx, y + dy); ctx.lineTo(x + dx + 3, y + dy); ctx.lineTo(x + dx + 1.5, y + dy - 3); ctx.fill(); }); rr(x - 5, y - 7, 10, 2.5, 1, f); } }); })],  },
    beachchair: {       
      parts: (o) => [F(0, 0, 0.7, 1.3, (T) => { const c = cl(o); [[0.04, 0.1], [0.62, 0.1], [0.04, 1.2], [0.62, 1.2]].forEach(([x, y]) => T.line([x, y, 0], [x, y, 0.25], '#C9B48E', 2)); T.poly([[0.05, 0.1, 0.75], [0.65, 0.1, 0.75], [0.65, 0.5, 0.28], [0.05, 0.5, 0.28]], c, 'rgba(0,0,0,.2)', 1); T.poly([[0.05, 0.5, 0.28], [0.65, 0.5, 0.28], [0.65, 1.25, 0.25], [0.05, 1.25, 0.25]], shade(c, 0.15), 'rgba(0,0,0,.2)', 1); for (let k = 1; k < 4; k++) { const x = 0.05 + k * 0.15; T.line([x, 0.1, 0.75], [x, 0.5, 0.28], 'rgba(255,255,255,.7)', 2); T.line([x, 0.5, 0.28], [x, 1.25, 0.25], 'rgba(255,255,255,.7)', 2); } }, { name: 'base' })],
       },
    blossomvase: {      
      parts: (o) => [F(0, 0, 0.45, 0.45, (T, ob, t) => { T.box(0.08, 0.08, 0, 0.3, 0.3, 0.5, cl(o)); const [x, y] = T.P(0.22, 0.22, 0.5); [[-16, -52], [4, -62], [18, -46], [-6, -40]].forEach(([dx, dy], k) => { limb(x, y, x + dx, y + dy, '#5A3E2E', 1.6); for (let m = 0; m < 5; m++) { const f = 0.45 + m * 0.13; circle(x + dx * f + Math.sin(k + m) * 3, y + dy * f + Math.cos(k * m) * 2, 2.6, m % 2 ? '#F3B6C8' : '#F7D0DC'); } }); })] },
    clawmachine: {
      // A claw machine: a cabinet in the piece's colour, a glass case full of plushies, a marquee on top with chasing bulbs,
      // and a claw that swings out and drops while someone plays (or the player pokes it).
      parts: (o) => { const c = cl(o); return [B(0, 0, 0, 0.7, 0.6, 0.7, c), B(0.26, 0.5, 0.18, 0.2, 0.1, 0.16, AR.ink),
        F(0, 0, 0.7, 0.6, (T, ob, t) => { const playing = usingSlot(ob.id + ':c') || live(ob.id);
          T.box(0.02, 0.02, 0.7, 0.66, 0.56, 0.02, AR.chrome);
          // The plushies, piled up behind the glass.
          [[0.15, 0.2, '#F6B7CC'], [0.4, 0.15, '#9CCBF2'], [0.55, 0.35, '#F9E27A'], [0.25, 0.42, '#9FDB9A'], [0.45, 0.45, '#C7A8F0']].forEach(([x, y, col]) => { const [px, py] = T.P(x, y, 0.78); circle(px, py, 5, col); circle(px - 3.5, py - 4, 2, col); circle(px + 3.5, py - 4, 2, col); circle(px - 1.5, py - 1, 0.7, '#5A4A5E'); circle(px + 1.5, py - 1, 0.7, '#5A4A5E'); });
          // The claw: a cable from the top, three prongs, swinging over the pile and dropping while it plays.
          const sw = playing ? Math.sin(t * 3) * 0.14 : 0, drop = playing ? Math.max(0, Math.sin(t * 1.5)) * 0.3 : 0;
          const top = [0.35 + sw, 0.3, 1.46], tip = [0.35 + sw, 0.3, 1.16 - drop]; T.line(top, tip, AR.chrome, 1.2); const [cx, cy] = T.P(...tip); circle(cx, cy, 2, AR.chrome); [[-5, 6], [0, 7], [5, 6]].forEach(([dx, dy]) => { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.quadraticCurveTo(cx + dx * 1.2, cy + dy * 0.4, cx + dx, cy + dy); ctx.strokeStyle = AR.chrome; ctx.lineWidth = 1.4; ctx.stroke(); });
          // The glass: four translucent faces on chrome posts, then the marquee.
          [[0.02, 0.02], [0.68, 0.02], [0.02, 0.58], [0.68, 0.58]].forEach(([x, y]) => T.line([x, y, 0.72], [x, y, 1.48], AR.chrome, 1.6));
          T.poly([[0.02, 0.58, 0.72], [0.68, 0.58, 0.72], [0.68, 0.58, 1.48], [0.02, 0.58, 1.48]], 'rgba(180,230,255,.16)', 'rgba(255,255,255,.35)', 0.8); T.poly([[0.68, 0.02, 0.72], [0.68, 0.58, 0.72], [0.68, 0.58, 1.48], [0.68, 0.02, 1.48]], 'rgba(180,230,255,.1)', 'rgba(255,255,255,.3)', 0.8);
          T.box(0, 0, 1.48, 0.7, 0.6, 0.22, power ? AR.magenta : shade(AR.magenta, -0.5)); const [ax, ay] = T.P(0.04, 0.601, 1.66), [bx, by] = T.P(0.66, 0.601, 1.66); chaser(ax, ay, bx, by, 8, ob.id, power); const [dx2, dy2] = T.P(0.04, 0.601, 1.52), [ex, ey] = T.P(0.66, 0.601, 1.52); chaser(dx2, dy2, ex, ey, 8, ob.id, power);
          const [sx, sy] = T.P(0.35, 0.602, 1.59); sprite(sx, sy, 1.5, PIXHEART, '#FFF6C8');
          // The control panel: a joystick and a button on the front ledge, and the prize chute below.
          T.box(0.04, 0.6, 0.62, 0.62, 0.08, 0.08, AR.ink); T.line([0.2, 0.64, 0.7], [0.2, 0.64, 0.82], AR.ink, 2); const [jx, jy] = T.P(0.2, 0.64, 0.83); circle(jx, jy, 2.6, AR.red); const [kx, ky] = T.P(0.45, 0.64, 0.705); circle(kx, ky, 2.2, AR.yellow);
          T.poly([[0.28, 0.601, 0.2], [0.44, 0.601, 0.2], [0.44, 0.601, 0.34], [0.28, 0.601, 0.34]], AR.ink, AR.chrome, 1);
        }, { onTop: true })]; },
       },
    overseer: {
      // A concrete plinth, a jointed arm and a capsule head with one red lens that follows whoever is nearest, and glows
      // harder while it talks.
      parts: (o) => [F(0, 0, 0.6, 0.6, (T, ob, t) => { const c = cl(o); const talking = speechNow(ob.id, t) != null;
        const [sx, sy] = T.P(0.3, 0.3, 0); ell(sx, sy, 20, 9, 'rgba(0,0,0,.22)');
        T.box(0.08, 0.08, 0, 0.44, 0.44, 0.14, '#8E939A'); T.box(0.18, 0.18, 0.14, 0.24, 0.24, 0.06, '#6E737A');
        const sway = Math.sin(t * 0.7) * 0.03, j1 = [0.3, 0.3, 1.1], hd = [0.3 + sway, 0.42, 1.6];
        T.line([0.3, 0.3, 0.2], j1, c, 7); T.line([0.3, 0.3, 0.2], j1, shade(c, 0.25), 2);
        T.line(j1, [0.3 + sway, 0.4, 1.5], c, 6);
        const [jx, jy] = T.P(...j1); circle(jx, jy, 5, shade(c, -0.2)); circle(jx, jy, 2.2, '#C9CED6');
        T.line([0.42, 0.3, 0.2], [0.4, 0.34, 1.05], '#1B1A1F', 1.2);
        // The cage it is kept in, bolted to the top of the stand: the bars behind the head go first, the front ones last.
        const k0 = 0, k1 = 0.6, z0 = 1.2, z1 = 2.02, bar = '#3A3D44', N = 3;
        const ring = (z, col, w) => { T.line([k0, k0, z], [k1, k0, z], col, w); T.line([k0, k0, z], [k0, k1, z], col, w); T.line([k1, k0, z], [k1, k1, z], col, w); T.line([k0, k1, z], [k1, k1, z], col, w); };
        T.poly([[k0, k0, z0], [k1, k0, z0], [k1, k1, z0], [k0, k1, z0]], '#5A5E66', '#2B2B30', 1);
        for (let i = 0; i <= N; i++) { const u = k0 + (k1 - k0) * i / N; T.line([u, k0, z0], [u, k0, z1], bar, 1.6); T.line([k0, u, z0], [k0, u, z1], bar, 1.6); }
        const [ex, ey] = T.P(...hd);
        ell(ex, ey, 14, 11, '#E8EAEC', shade(c, -0.2)); ell(ex - 2, ey - 3, 8, 4.5, 'rgba(255,255,255,.55)');
        ctx.strokeStyle = shade('#E8EAEC', -0.25); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ex - 13, ey + 2); ctx.lineTo(ex + 13, ey + 2); ctx.stroke();
        ell(ex + 1, ey + 2, 8, 6.5, '#1B1A1F');
        const [wx, wy] = T.W(...hd.slice(0, 2)); let best = null, bd = 1e9;
        [jordan, maya].forEach(p => { if (!p || p.level !== ob.level || p.hidden) return; const d = Math.hypot(p.x - wx, p.y - wy); if (d < bd) { bd = d; best = p; } });
        let dx = 0, dy = 0; if (best && bd < 8) { const [px, py] = iso(best.x, best.y, 1.2); const L = Math.hypot(px - ex, py - ey) || 1; dx = (px - ex) / L * 3.5; dy = (py - ey) / L * 2.5; }
        const lx = ex + 1 + dx, ly = ey + 2 + dy, pulse = talking ? 0.6 + 0.4 * Math.abs(Math.sin(t * 9)) : 0.55 + 0.25 * Math.sin(t * 1.5);
        ctx.save(); ctx.globalAlpha = pulse * 0.55; circle(lx, ly, 8, '#FF2A2A'); ctx.restore();
        circle(lx, ly, 4.5, '#D01818'); circle(lx - 1, ly - 1, 1.8, `rgba(255,${talking ? 230 : 170},${talking ? 210 : 140},1)`);
        for (let i = 0; i <= N; i++) { const u = k0 + (k1 - k0) * i / N; T.line([u, k1, z0], [u, k1, z1], bar, 1.5); T.line([k1, u, z0], [k1, u, z1], bar, 1.5); }
        ring(z0 + 0.02, '#2B2B30', 2.4); ring(z1, '#2B2B30', 2.4);
        T.poly([[k0, k0, z1], [k1, k0, z1], [k1, k1, z1], [k0, k1, z1]], 'rgba(58,61,68,.6)', '#2B2B30', 1);
        const [hx, hy] = T.P(0.3, 0.3, z1); ctx.strokeStyle = '#2B2B30'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(hx, hy - 5, 4, Math.PI * 0.15, Math.PI * 0.85, true); ctx.stroke();
      }, { onTop: true })],
    },
    jukebox: {      
      parts: (o) => [F(0, 0, 0.8, 0.5, (T, ob, t) => { const c = cl(o); T.box(0, 0, 0, 0.8, 0.5, 1.05, '#5A3E2E'); const pts = []; for (let k = 0; k <= 12; k++) { const a = Math.PI * k / 12; pts.push([0.4 - Math.cos(a) * 0.4, 0.501, 1.05 + Math.sin(a) * 0.38]); } T.poly([[0, 0.501, 1.05]].concat(pts, [[0.8, 0.501, 1.05]]), c); for (let k = 0; k < 5; k++) { const h2 = (t * 60 + k * 50) % 360; T.line([0.1 + k * 0.15, 0.502, 0.12], [0.1 + k * 0.15, 0.502, 1.0], power ? `hsl(${h2},80%,62%)` : '#4A4450', 2.2); } T.poly([[0.15, 0.503, 0.55], [0.65, 0.503, 0.55], [0.65, 0.503, 0.9], [0.15, 0.503, 0.9]], '#F2EEE8'); })],
        },
    eggchair: {      
      parts: (o) => [F(0, 0, 1.0, 1.0, (T, ob, t) => { const c = cl(o); T.box(0.2, 0.2, 0, 0.6, 0.6, 0.04, '#2B2B30'); T.line([0.2, 0.2, 0.04], [0.15, 0.2, 1.9], '#2B2B30', 3); T.line([0.15, 0.2, 1.9], [0.5, 0.45, 1.95], '#2B2B30', 3); T.line([0.5, 0.45, 1.95], [0.5, 0.45, 1.45], '#9AA3A8', 1); const [x, y] = T.P(0.5, 0.45, 0.9); ell(x, y, 20, 28, c, shade(c, -0.3)); ell(x + 3, y + 4, 14, 20, shade(c, -0.25)); ell(x + 3, y + 12, 12, 6, '#F2EEE8'); }, { name: 'base' })],
       },
    lavalamp: {      
      parts: (o) => [F(0, 0, 0.3, 0.3, (T, ob, t) => { const c = cl(o); T.box(0.05, 0.05, 0, 0.2, 0.2, 0.15, '#C9CED6'); T.box(0.08, 0.08, 0.15, 0.14, 0.14, 0.35, 'rgba(255,240,200,.65)'); for (let k = 0; k < 3; k++) { const ph = (t * 0.15 + k / 3) % 1, [x, y] = T.P(0.15, 0.15, 0.18 + ph * 0.3); ell(x, y, 3 + Math.sin(t + k) * 0.8, 4, c); } T.box(0.07, 0.07, 0.5, 0.16, 0.16, 0.08, '#C9CED6'); })],  },
    chesterfield: {      
      parts: (o) => { const c = cl(o); return [B(0, 0, 0, 2.0, 0.95, 0.4, shade(c, -0.1), { name: 'base' }), B(0, 0, 0.4, 2.0, 0.26, 0.45, c), B(0, 0, 0, 0.2, 0.95, 0.75, c), B(1.8, 0, 0, 0.2, 0.95, 0.75, c), B(0.2, 0.26, 0.4, 0.8, 0.66, 0.1, shade(c, 0.08)), B(1.0, 0.26, 0.4, 0.8, 0.66, 0.1, shade(c, 0.08)),
        F(0, 0, 2.0, 0.27, (T) => { for (let k = 0; k < 8; k++) for (let m = 0; m < 2; m++) { const [x, y] = T.P(0.25 + k * 0.215 + m * 0.1, 0.261, 0.55 + m * 0.15); circle(x, y, 1.1, 'rgba(0,0,0,.35)'); } }, { onTop: true })]; },
       },
    trunk: {      
      parts: (o) => { const c = cl(o); return [B(0, 0, 0, 0.9, 0.55, 0.38, c), B(0, 0, 0.38, 0.9, 0.55, 0.12, shade(c, -0.15)), B(0.12, 0, 0, 0.07, 0.55, 0.5, '#C9A24A'), B(0.71, 0, 0, 0.07, 0.55, 0.5, '#C9A24A'),
        F(0, 0, 0.9, 0.55, (T) => { const [x, y] = T.P(0.45, 0.0, 0.36); rr(x - 3, y - 3, 6, 6, 1, '#C9A24A'); }, { onTop: true })]; } },
    dressform: {      
      parts: (o) => [F(0, 0, 0.5, 0.5, (T) => { const c = cl(o); T.box(0.15, 0.15, 0, 0.2, 0.2, 0.04, '#2B2B30'); T.line([0.25, 0.25, 0.04], [0.25, 0.25, 0.75], '#9AA3A8', 2.5); const [x, y] = T.P(0.25, 0.25, 1.0); ell(x, y, 13, 22, c, shade(c, -0.3)); ell(x + 3, y + 2, 8, 16, shade(c, 0.12)); circle(x, y - 26, 3, '#9AA3A8'); })] },
    gramophone: {      
      parts: (o) => { const c = cl(o); return [B(0.08, 0.08, 0, 0.44, 0.44, 0.55, c), F(0, 0, 0.6, 0.6, (T, ob, t) => { const spin = usingSlot(ob.id + ':r') ? t * 6 : 0; const [dx, dy] = T.P(0.3, 0.3, 0.57); ell(dx, dy, 11, 5, '#1B1A1F'); ell(dx + Math.cos(spin) * 5, dy + Math.sin(spin) * 2.2, 1.6, 0.9, '#C9A24A'); T.line([0.3, 0.3, 0.57], [0.3, 0.42, 0.95], '#C9A24A', 2.5); const [hx, hy] = T.P(0.3, 0.45, 1.02); ell(hx, hy, 14, 10, '#C9A24A', shade('#C9A24A', -0.3), -0.4); ell(hx + 2, hy + 2, 9, 6, '#3A2E2A'); })]; },
       },
    floorcushion: {      
      parts: (o) => { const c = cl(o); return [B(0.05, 0.05, 0, 1.0, 1.0, 0.14, c, { name: 'base' }), B(0.12, 0.12, 0.14, 0.5, 0.5, 0.1, shade(c, 0.14)), B(0.55, 0.5, 0.14, 0.4, 0.4, 0.09, shade(c, -0.12))]; },
       },
    crates: {      
      parts: (o) => { const c = cl(o); return [B(0, 0, 0, 0.8, 0.5, 0.28, c), B(0.05, 0.05, 0.28, 0.7, 0.4, 0.2, shade(c, -0.12)),
        F(0, 0, 0.8, 0.5, (T) => { const pal = ['#C2413A', '#4A5DA8', '#E0A43A', '#3F5B4C', '#F2EEE8']; for (let k = 0; k < 6; k++) { const x = 0.1 + k * 0.11; T.poly([[x, 0.1, 0.49], [x + 0.08, 0.1, 0.49], [x + 0.08, 0.4, 0.49], [x, 0.4, 0.49]], pal[k % 5], 'rgba(0,0,0,.25)', 0.6); } }, { onTop: true })]; } },
    globe: {      
      parts: (o) => [F(0, 0, 0.5, 0.5, (T, ob, t) => { const c = cl(o); [[0.08, 0.08], [0.42, 0.08], [0.25, 0.45]].forEach(([x, y]) => T.line([x, y, 0], [0.25, 0.25, 0.55], c, 2.4)); const [x, y] = T.P(0.25, 0.25, 0.85); circle(x, y, 13, '#D9C9A0'); const r = t * 0.3; [[-4, -3, 5, 4], [5, 4, 4, 3], [-2, 6, 3, 2]].forEach(([dx, dy, rx, ry]) => ell(x + ((dx + r * 6) % 22 + 22) % 22 - 11, y + dy, rx, ry, '#7A9A6A')); ctx.strokeStyle = '#C9A24A'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 15, Math.PI * 0.6, Math.PI * 2.1); ctx.stroke(); })] }


  };
  // Sizes, spots, lights and blockers come from state/objects.ts; this file only adds how each type is drawn.
  const TYPES = Object.fromEntries(Object.entries(DRAWN).map(([k, d]) => [k, Object.assign({}, STATE_TYPES[k], d)]));


  const T_OF = (o) => TYPES[o.type];
  const isFixed = (o) => !!T_OF(o).fixed;

  // ======================================================================
  // transforms
  // ======================================================================
  function xf(o, lx, ly) { const { W: w, D: d } = T_OF(o); switch (o.rot) { case 1: return [o.x + (d - ly), o.y + lx]; case 2: return [o.x + (w - lx), o.y + (d - ly)]; case 3: return [o.x + ly, o.y + (w - lx)]; default: return [o.x + lx, o.y + ly]; } }
  function xdir(o, dx, dy) { switch (o.rot) { case 1: return [-dy, dx]; case 2: return [-dx, -dy]; case 3: return [dy, -dx]; default: return [dx, dy]; } }
  function fp(o) { const t = T_OF(o); return o.rot % 2 ? [t.D, t.W] : [t.W, t.D]; }
  function xrect(o, r) { const a = xf(o, r[0], r[1]), b = xf(o, r[2], r[3]); return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])]; }
  function makeT(o) {
    // A piece sitting on a table or shelf is drawn that much higher.
    const up = o.z || 0;
    return {
      o, W: (lx, ly) => xf(o, lx, ly),
      P: (lx, ly, lz) => { const [x, y] = xf(o, lx, ly); return iso(x, y, lz + up); },
      box: (lx, ly, lz, w, d, h, c) => { const r = xrect(o, [lx, ly, lx + w, ly + d]); box(r[0], r[1], lz + up, r[2] - r[0], r[3] - r[1], h, c); },
      poly: (pts, fill, stroke, lw) => poly(pts.map(p => { const [x, y] = xf(o, p[0], p[1]); return [x, y, p[2] + up]; }), fill, stroke, lw),
      line: (a, b, c, w) => { const [ax, ay] = xf(o, a[0], a[1]), [bx, by] = xf(o, b[0], b[1]); line3([ax, ay, a[2] + up], [bx, by, b[2] + up], c, w); }
    };
  }
  const facing = (d) => { const [a, b] = VD(d[0], d[1]); return { front: a + b > 0.01, flip: a - b >= 0 ? 1 : -1 }; };

  function wallPoint(plane, u, z) { return plane === 'L' ? [0, u, z] : plane === 'B' ? [u, 0, z] : plane === 'R' ? [WX, u, z] : [u, WY, z]; }
  const planeLen = (pl) => (pl === 'L' || pl === 'R' ? WY : WX);
  // A picture hung across a whole wall (a photo or a gradient), cropped to the
  // wall's shape and laid onto it. Photos load the first time a wall wants one.
  function paperImage(S) {
    if (S.img) return S.img;
    if (S.stops) {
      const c = document.createElement('canvas'); c.width = 512; c.height = 256;
      const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
      S.stops.forEach(([at, col]) => gr.addColorStop(at, col)); g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
      return (S.img = c);
    }
    if (S.url && !S.loading) {
      S.loading = true;
      const im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = () => { S.img = im; }; im.onerror = () => { S.loading = false; S.failed = true; };
      im.src = S.url;
    }
    return null;
  }
  function drawImagePaper(S, plane, len) {
    const im = paperImage(S); if (!im) return;
    const w = im.naturalWidth || im.width, h = im.naturalHeight || im.height; if (!w || !h) return;
    // "Cover": the biggest slice of the picture with the wall's proportions.
    const want = len / WH; let cw = w, ch = h; if (w / h > want) cw = h * want; else ch = w / want;
    const cx = (w - cw) / 2, cy = (h - ch) / 2, ku = len / cw, kz = WH / ch;
    const o = iso(...wallPoint(plane, 0, 0)), du = iso(...wallPoint(plane, 1, 0)), dz = iso(...wallPoint(plane, 0, 1));
    const ux = du[0] - o[0], uy = du[1] - o[1], zx = dz[0] - o[0], zy = dz[1] - o[1];
    ctx.save();
    ctx.beginPath(); [[0, 0], [len, 0], [len, WH], [0, WH]].forEach(([u, z], i) => { const [sx, sy] = iso(...wallPoint(plane, u, z)); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); ctx.closePath(); ctx.clip();
    ctx.transform(ux * ku, uy * ku, -zx * kz, -zy * kz, o[0] - ux * ku * cx + zx * kz * (cy + ch), o[1] - uy * ku * cx + zy * kz * (cy + ch));
    ctx.drawImage(im, 0, 0);
    ctx.restore();
    // A little shade so it sits in the room rather than glowing.
    poly([wallPoint(plane, 0, 0), wallPoint(plane, len, 0), wallPoint(plane, len, WH), wallPoint(plane, 0, WH)], 'rgba(20,14,24,.12)');
  }
  function drawPattern(paper, plane, len) {
    const S = paper && PAPERS[paper]; if (!S) return;
    if (S.pat === 'image') { drawImagePaper(S, plane, len); return; }
    const P = (u, z) => wallPoint(plane, u, z), pat = S.pat, ink = S.ink;
    const rect = (a, b, z0, z1, c, st, lw) => poly([P(a, z0), P(b, z0), P(b, z1), P(a, z1)], c, st, lw);
    const path = (pts, st, lw) => { ctx.beginPath(); pts.forEach(([u, z], i) => { const [sx, sy] = iso(...P(u, z)); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); ctx.strokeStyle = st; ctx.lineWidth = lw; ctx.stroke(); };
    if (pat === 'dots') { for (let z = 0.4, r = 0; z < WH - 0.1; z += 0.42, r++) for (let u = 0.25 + (r % 2) * 0.25; u < len; u += 0.5) { const [sx, sy] = iso(...P(u, z)); ell(sx, sy, 2.6, 3, ink || 'rgba(255,255,255,.85)'); } }
    else if (pat === 'stripes') { for (let u = 0; u < len; u += 0.5) rect(u, Math.min(len, u + 0.2), 0.14, WH, ink || 'rgba(255,255,255,.32)'); }
    else if (pat === 'brick') { for (let z = 0.14, r = 0; z < WH; z += 0.2, r++) for (let u = -(r % 2) * 0.25; u < len; u += 0.5) { const a = Math.max(0, u), b = Math.min(len, u + 0.48); if (b <= a) continue; const tone = (S.tones || ['#A2533C', '#B05E44', '#97493A', '#A85A40'])[(r * 7 + Math.floor(u * 4 + 9)) % 4]; rect(a, b, z, z + 0.18, tone, S.tones ? ink : 'rgba(240,225,210,.35)', 0.7); } }
    else if (pat === 'birch') { for (let u = 0.25; u < len - 0.1; u += 0.55) { const w = 0.07 + ((u * 7) % 3) * 0.015; rect(u, u + w, 0.14, WH, ink); for (let z = 0.4 + ((u * 13) % 5) * 0.08; z < WH - 0.1; z += 0.5) line3(P(u, z), P(u + w, z + 0.04), S.ink2, 1.4); } }
    else if (pat === 'block') { for (let z = 0.34, r = 0; z < WH; z += 0.2, r++) for (let u = -(r % 2) * 0.2; u < len; u += 0.4) { const a = Math.max(0, u), b = Math.min(len, u + 0.4); if (b <= a) continue; const tone = ['rgba(0,0,0,.035)', 'rgba(255,255,255,.05)', 'rgba(0,0,0,.07)', 'rgba(255,255,255,.02)'][(r * 5 + Math.floor(u * 5 + 7)) % 4]; rect(a + 0.012, b - 0.012, z + 0.012, Math.min(WH, z + 0.19), tone, 'rgba(225,220,212,.35)', 0.6); } }
    else if (pat === 'deco') { for (let z = 0.5; z < WH; z += 0.5) for (let u = 0.25; u < len; u += 0.5) poly([P(u, z - 0.2), P(u + 0.2, z), P(u, z + 0.2), P(u - 0.2, z)], null, ink || 'rgba(201,164,74,.75)', 1); }
    else if (pat === 'botanical') { const c = ink || 'rgba(70,120,80,.55)'; for (let z = 0.45, r = 0; z < WH; z += 0.5, r++) for (let u = 0.3 + (r % 2) * 0.25; u < len; u += 0.5) { const [sx, sy] = iso(...P(u, z)); ell(sx - 2, sy, 2, 4.5, c, null, -0.5); ell(sx + 2, sy - 1, 2, 4.5, c, null, 0.5); } }
    else if (pat === 'pin') { for (let u = 0.15; u < len; u += 0.3) line3(P(u, 0.14), P(u, WH), ink, 1); }
    else if (pat === 'gingham') { for (let u = 0; u < len; u += 0.4) rect(u, Math.min(len, u + 0.2), 0.14, WH, ink); for (let z = 0.14; z < WH; z += 0.4) rect(0, len, z, Math.min(WH, z + 0.2), ink); }
    else if (pat === 'plaid') { for (let u = 0.1; u < len; u += 0.8) { rect(u, Math.min(len, u + 0.26), 0.14, WH, S.ink2); if (u + 0.45 < len) line3(P(u + 0.45, 0.14), P(u + 0.45, WH), ink, 1.3); } for (let z = 0.3; z < WH; z += 0.8) { rect(0, len, z, Math.min(WH, z + 0.26), S.ink2); if (z + 0.45 < WH) line3(P(0, z + 0.45), P(len, z + 0.45), ink, 1.3); } }
    else if (pat === 'chevron') { for (let z = 0.4; z < WH - 0.1; z += 0.36) { const pts = []; for (let u = 0, k = 0; u < len + 0.24; u += 0.25, k++) pts.push([Math.min(u, len), z + (k % 2) * 0.16]); path(pts, ink, 1.6); } }
    else if (pat === 'scallop') { for (let z = 0.45, r = 0; z < WH; z += 0.24, r++) for (let u = (r % 2) * 0.2; u < len - 0.05; u += 0.4) { const pts = []; for (let k = 0; k <= 8; k++) { const a = Math.PI * k / 8; pts.push([Math.min(len, u + 0.2 - Math.cos(a) * 0.2), z - Math.sin(a) * 0.15]); } path(pts, ink, 1.1); } }
    else if (pat === 'damask') { for (let z = 0.55, r = 0; z < WH - 0.1; z += 0.6, r++) for (let u = 0.3 + (r % 2) * 0.35; u < len - 0.1; u += 0.7) { poly([P(u, z - 0.22), P(u + 0.12, z), P(u, z + 0.22), P(u - 0.12, z)], ink); const [sx, sy] = iso(...P(u, z)); ell(sx - 6, sy, 2.5, 5, ink, null, 0.5); ell(sx + 6, sy, 2.5, 5, ink, null, -0.5); circle(sx, sy - 11, 1.6, ink); circle(sx, sy + 11, 1.6, ink); } }
    else if (pat === 'starburst') { for (let z = 0.55, r = 0; z < WH - 0.05; z += 0.55, r++) for (let u = 0.3 + (r % 2) * 0.3; u < len - 0.05; u += 0.6) { const [sx, sy] = iso(...P(u, z)); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, l = k % 2 ? 4 : 7; limb(sx - Math.cos(a) * 1.5, sy - Math.sin(a) * 1.5, sx + Math.cos(a) * l, sy + Math.sin(a) * l, ink, 1.1); } circle(sx, sy, 1.2, S.ink2 || ink); } }
    // Board-formed concrete: the seams of the formwork boards, and a grid of tie holes.
    else if (pat === 'formwork') { for (let z = 0.34; z < WH; z += 0.26) line3(P(0, z), P(len, z), ink, 0.9); for (let z = 0.6; z < WH - 0.1; z += 0.78) for (let u = 0.3; u < len - 0.1; u += 0.6) { const [sx, sy] = iso(...P(u, z)); circle(sx, sy, 1.3, S.ink2); } }
    else if (pat === 'shiplap') { for (let z = 0.34; z < WH; z += 0.2) line3(P(0, z), P(len, z), ink, 1); }
    else if (pat === 'wainscot') { rect(0, len, 0.14, 1.0, ink); rect(0, len, 0.97, 1.04, shade(ink, -0.12)); for (let u = 0.12; u < len - 0.3; u += 0.6) rect(u, Math.min(len - 0.05, u + 0.48), 0.28, 0.86, null, 'rgba(0,0,0,.16)', 1); }
    else if (pat === 'subway') { for (let z = 0.14, r = 0; z < WH; z += 0.15, r++) { line3(P(0, z), P(len, z), ink, 0.8); for (let u = (r % 2) * 0.15; u < len; u += 0.3) line3(P(u, z), P(u, Math.min(WH, z + 0.15)), ink, 0.8); } }
    else if (pat === 'stars') { for (let k = 0; k < len * 9; k++) { const u = (k * 0.618 * 7.3) % len, z = 0.3 + ((k * 0.414 * 5.1) % (WH - 0.4)); const [sx, sy] = iso(...P(u, z)); circle(sx, sy, 0.8 + (k % 3) * 0.6, ink); } }
    else if (pat === 'waves') { for (let z = 0.35; z < WH; z += 0.28) { const pts = []; for (let u = 0; u <= len + 0.001; u += 0.1) pts.push([Math.min(u, len), z + Math.sin(u * 9) * 0.05]); path(pts, ink, 1.2); } }
    else if (pat === 'hexes') { for (let z = 0.4, r = 0; z < WH - 0.1; z += 0.27, r++) for (let u = 0.18 + (r % 2) * 0.18; u < len - 0.1; u += 0.36) { const pts = []; for (let k = 0; k <= 6; k++) { const a = Math.PI / 3 * k; pts.push([u + Math.cos(a) * 0.17, z + Math.sin(a) * 0.15]); } path(pts, ink, 1); } }
    else if (pat === 'arches') { for (let u = 0.15; u < len - 0.45; u += 0.75) { const pts = [P(u, 0.3), P(u + 0.5, 0.3)]; for (let k = 0; k <= 8; k++) { const a = Math.PI * k / 8; pts.push(P(u + 0.25 + Math.cos(a) * 0.25, 1.55 + Math.sin(a) * 0.3)); } poly(pts, ink); } }
    else if (pat === 'grid') { for (let u = 0.3; u < len; u += 0.3) line3(P(u, 0.14), P(u, WH), ink, 0.8); for (let z = 0.44; z < WH; z += 0.3) line3(P(0, z), P(len, z), ink, 0.8); }
    else if (pat === 'tuft') { for (let z = 0.4, r = 0; z < WH; z += 0.3, r++) for (let u = (r % 2) * 0.2; u < len; u += 0.4) { if (u + 0.2 <= len) { line3(P(u, z), P(u + 0.2, z + 0.15), ink, 1); line3(P(u, z), P(u + 0.2, z - 0.15), ink, 1); } const [sx, sy] = iso(...P(u, z)); circle(sx, sy, 1.3, 'rgba(0,0,0,.3)'); } }
    else if (pat === 'sunset') { const bands = ['#8F5E8E', '#C97389', '#E8907A', '#F2B48A', '#F6D6A8', '#F8E6C6']; bands.forEach((c, k) => rect(0, len, 0.14 + k * (WH - 0.14) / 6, 0.14 + (k + 1) * (WH - 0.14) / 6 + 0.01, c)); if (plane === 'B' || plane === 'F') { const cu = len * 0.62, pts = []; for (let k = 0; k <= 12; k++) { const a = Math.PI * k / 12; pts.push(P(cu + Math.cos(a) * 0.7, 0.9 + Math.sin(a) * 0.6)); } poly(pts, 'rgba(255,236,190,.85)'); } }
    else if (pat === 'blossom') { for (let z = 0.45, r = 0; z < WH; z += 0.55, r++) for (let u = 0.3 + (r % 2) * 0.3; u < len; u += 0.6) { const [sx, sy] = iso(...P(u, z)); limb(sx - 8, sy + 5, sx + 6, sy - 4, 'rgba(90,62,46,.6)', 1.2); [[-4, 1], [2, -2], [6, -5], [-1, 3]].forEach(([dx, dy], k) => circle(sx + dx, sy + dy, 2.4, k % 2 ? '#F3B6C8' : '#E88AA8')); } }
    else if (pat === 'palms') { for (let z = 0.6, r = 0; z < WH; z += 0.7, r++) for (let u = 0.3 + (r % 2) * 0.4; u < len; u += 0.8) { const [sx, sy] = iso(...P(u, z)); for (let k = 0; k < 5; k++) { const a = -2.6 + k * 0.55; ell(sx + Math.cos(a) * 7, sy + Math.sin(a) * 7, 2.2, 7, k % 2 ? 'rgba(47,107,64,.7)' : 'rgba(79,148,96,.7)', null, a + 1.57); } } }
    else if (pat === 'leaves') { for (let k = 0; k < len * 7; k++) { const u = (k * 0.618 * 4.1) % len, z = 0.3 + ((k * 0.414 * 3.3) % (WH - 0.4)); const [sx, sy] = iso(...P(u, z)); ell(sx, sy, 2.4, 4.2, ['#C27A4A', '#D9A84A', '#A8553A'][k % 3], null, k * 0.9); } }
    else if (pat === 'snow') { for (let k = 0; k < len * 9; k++) { const u = (k * 0.618 * 5.3) % len, z = 0.25 + ((k * 0.414 * 4.7) % (WH - 0.35)); const [sx, sy] = iso(...P(u, z)), r = 1.5 + (k % 3); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 0.8; for (let m = 0; m < 3; m++) { const a = m * Math.PI / 3; ctx.beginPath(); ctx.moveTo(sx - Math.cos(a) * r, sy - Math.sin(a) * r); ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r); ctx.stroke(); } } }
    else if (pat === 'zellige') { for (let z = 0.14, r = 0; z < 1.1; z += 0.16, r++) for (let u = 0; u < len; u += 0.16) rect(u + 0.01, Math.min(len, u + 0.15), z + 0.01, z + 0.15, S.pal[(Math.round(u / 0.16) * 5 + r * 3) % S.pal.length]); line3(P(0, 1.12), P(len, 1.12), ink, 1.6); }
    else if (pat === 'monstera') { for (let z = 0.6, r = 0; z < WH; z += 0.75, r++) for (let u = 0.35 + (r % 2) * 0.4; u < len; u += 0.8) { const [sx, sy] = iso(...P(u, z)); monstera(sx, sy, 11, (r + Math.round(u)) % 2 ? ink : S.ink2, S.base, ((r * 3 + Math.round(u * 2)) % 5 - 2) * 0.25); if ((r + Math.round(u * 2)) % 3 === 0) circle(sx + 9, sy + 8, 2.2, '#F08AA0'); } }
    else if (pat === 'squiggle') { for (let z = 0.45, r = 0; z < WH - 0.1; z += 0.5, r++) for (let u = 0.15 + (r % 2) * 0.3; u < len - 0.3; u += 0.6) { const pts = []; for (let k = 0; k <= 8; k++) pts.push([u + k * 0.035, z + (k % 2 ? 0.04 : -0.04)]); path(pts, ink, 1.4); const [sx, sy] = iso(...P(u + 0.42, z + 0.12)); const c = S.pal[(r + Math.round(u * 3)) % 3]; if ((r + Math.round(u * 2)) % 3 === 0) circle(sx, sy, 2.4, c); else if ((r + Math.round(u * 2)) % 3 === 1) { ctx.beginPath(); ctx.moveTo(sx - 3, sy + 2.5); ctx.lineTo(sx + 3, sy + 2.5); ctx.lineTo(sx, sy - 3); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); } else { ctx.fillStyle = c; ctx.fillRect(sx - 2.5, sy - 2.5, 5, 5); } } }
    else if (pat === 'sprig') { for (let z = 0.55, r = 0; z < WH; z += 0.5, r++) for (let u = 0.25 + (r % 2) * 0.25; u < len; u += 0.5) { const [sx, sy] = iso(...P(u, z)); sprig(sx, sy + 6, 12, ink, S.ink2); } }
    else if (pat === 'serape') { S.pal.forEach((c, k) => rect(0, len, 0.3 + k * 0.1, 0.4 + k * 0.1, c)); const pts = []; for (let u = 0, k = 0; u < len + 0.1; u += 0.12, k++) pts.push([Math.min(u, len), 0.86 + (k % 2) * 0.06]); path(pts, ink, 1.4); const pts2 = []; for (let u = 0, k = 0; u < len + 0.1; u += 0.12, k++) pts2.push([Math.min(u, len), 0.2 + (k % 2) * 0.06]); path(pts2, ink, 1.4); }
    else if (pat === 'circuit') { for (let u = 0.3; u < len; u += 0.6) line3(P(u, 0.14), P(u, WH), ink, 0.8); for (let z = 0.5; z < WH; z += 0.6) line3(P(0, z), P(len, z), ink, 0.8); for (let z = 0.5, r = 0; z < WH; z += 0.6, r++) for (let u = 0.3; u < len; u += 0.6) { const [sx, sy] = iso(...P(u, z)); if ((r + Math.round(u * 3)) % 3 === 0) circle(sx, sy, 2, S.ink2); else { ctx.fillStyle = ink; ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3); } } for (let u = 0.6; u < len - 0.3; u += 1.2) line3(P(u, 0.8), P(u + 0.3, 1.1), S.ink2, 1); }
    else if (pat === 'sprinkles') { for (let k = 0; k < len * 22; k++) { const u = (k * 0.618 * 4.7) % len, z = 0.2 + ((k * 0.414 * 3.9) % (WH - 0.3)), [sx, sy] = iso(...P(u, z)), a = (k * 1.7) % Math.PI; limb(sx - Math.cos(a) * 2.6, sy - Math.sin(a) * 2.6, sx + Math.cos(a) * 2.6, sy + Math.sin(a) * 2.6, S.pal[k % 5], 1.8); } }
    else if (pat === 'clouds') { for (let z = 0.6, r = 0; z < WH; z += 0.7, r++) for (let u = 0.4 + (r % 2) * 0.45; u < len; u += 0.9) { const [sx, sy] = iso(...P(u, z)); cloud(sx, sy, 9, ink); const m = (r * 3 + Math.round(u * 2)) % 4; if (m === 0) heart(sx + 14, sy - 10, 0.9, '#EE8FAE'); else if (m === 1) star5(sx - 14, sy - 10, 3, '#F9E27A'); else if (m === 2) rainbow(sx + 16, sy - 2, 6, 1, Math.PI, Math.PI * 2); } }
    else if (pat === 'pixels') { for (let z = 0.55, r = 0; z < WH - 0.1; z += 0.55, r++) for (let u = 0.3 + (r % 2) * 0.3; u < len - 0.1; u += 0.6) { const [sx, sy] = iso(...P(u, z)); const m = (r * 3 + Math.round(u * 2)) % 4; if (m === 3) sprite(sx, sy, 1.6, PIXHEART, S.pal[1]); else sprite(sx, sy, 1.5, INVADER, S.pal[m]); } }
    else if (pat === 'cork') { for (let k = 0; k < len * 40; k++) { const u = (k * 0.618 * 3.7) % len, z = 0.16 + ((k * 0.414 * 2.3) % (WH - 0.2)); const [sx, sy] = iso(...P(u, z)); circle(sx, sy, 0.6 + (k % 2) * 0.5, ink); } }
  }
  function featPoly(f, inset = 0, dz = 0) { const P = (u, z) => wallPoint(f.p, u, z); return [P(f.u[0] + inset, f.z[0] + inset + dz), P(f.u[1] - inset, f.z[0] + inset + dz), P(f.u[1] - inset, f.z[1] - inset), P(f.u[0] + inset, f.z[1] - inset)]; }
  // Rain on a window: a few drops that gather at the top of the glass and slide down, each leaving a short trail.
  function glassDrops(f, inset) {
    const P = (u, z) => wallPoint(f.p, u, z), u0 = f.u[0] + inset, u1 = f.u[1] - inset, z0 = f.z[0] + inset, z1 = f.z[1] - inset;
    const n = Math.max(3, Math.round((u1 - u0) * 5));
    gMat = MATERIAL.window;
    for (let i = 0; i < n; i++) {
      const sd = Math.sin((f.u[0] + 1) * 12.9 + i * 78.2) * 43758.5453, r = sd - Math.floor(sd);
      const ph = (animT * (0.05 + r * 0.07) + r * 5.3) % 1, u = u0 + (i + 0.3 + r * 0.4) / n * (u1 - u0), z = z1 - ph * ph * (z1 - z0);
      line3(P(u, Math.min(z1, z + 0.22 * ph)), P(u, z), 'rgba(225,240,255,.35)', 1);
      const [sx, sy] = iso(...P(u, z));
      circle(sx, sy, 0.9 + r * 0.5, 'rgba(235,246,255,.8)');
    }
    gMat = MATERIAL.matte;
  }
  function drawFeature(level, f) {
    const P = (u, z) => wallPoint(f.p, u, z);
    if (f.k === 'window') { poly(featPoly(f), '#F7F3EE', EDGE, 0.8); gMat = MATERIAL.window; poly(featPoly(f, 0.08), skyColor()); gMat = MATERIAL.matte; if (raining()) glassDrops(f, 0.08); const mu = (f.u[0] + f.u[1]) / 2, mz = (f.z[0] + f.z[1]) / 2; line3(P(mu, f.z[0] + 0.08), P(mu, f.z[1] - 0.08), '#F7F3EE', 2); line3(P(f.u[0] + 0.08, mz), P(f.u[1] - 0.08, mz), '#F7F3EE', 2); }
    else if (f.k === 'highwin') { poly(featPoly(f), '#E9E4DD', EDGE, 0.8); gMat = MATERIAL.window; poly(featPoly(f, 0.06), skyColor()); gMat = MATERIAL.matte; }
    else if (f.k === 'door') { poly([P(f.u[0] - 0.08, 0), P(f.u[1] + 0.08, 0), P(f.u[1] + 0.08, f.z[1] + 0.05), P(f.u[0] - 0.08, f.z[1] + 0.05)], '#EFE8DE', EDGE, 0.8); poly(featPoly(f), '#7A5236'); poly([P(f.u[0] + 0.1, 1.15), P(f.u[1] - 0.1, 1.15), P(f.u[1] - 0.1, 1.9), P(f.u[0] + 0.1, 1.9)], null, 'rgba(0,0,0,.25)', 1); poly([P(f.u[0] + 0.1, 0.2), P(f.u[1] - 0.1, 0.2), P(f.u[1] - 0.1, 0.95), P(f.u[0] + 0.1, 0.95)], null, 'rgba(0,0,0,.25)', 1); const [kx, ky] = iso(...P(f.u[0] + 0.15, 1.02)); circle(kx, ky, 2, '#E0B85A'); }
    else if (f.k === 'switch') { poly(featPoly(f), '#F7F3EE', EDGE, 0.8); const mid = (f.u[0] + f.u[1]) / 2; poly(party ? [P(mid - 0.03, 1.11), P(mid + 0.03, 1.11), P(mid + 0.03, 1.19), P(mid - 0.03, 1.19)] : [P(mid - 0.03, 1.03), P(mid + 0.03, 1.03), P(mid + 0.03, 1.11), P(mid - 0.03, 1.11)], party ? '#D24A7A' : '#9C9298'); }
    else if (f.k === 'tv') {
      const big = has('bigtv'), u0 = big ? f.u[0] - 0.15 : f.u[0], u1 = big ? f.u[1] + 0.15 : f.u[1], z0 = big ? 0.72 : f.z[0], z1 = big ? 1.9 : f.z[1];
      poly([P(u0, z0), P(u1, z0), P(u1, z1), P(u0, z1)], '#1B1A1F');
      const pts = [P(u0 + 0.06, z0 + 0.06), P(u1 - 0.06, z0 + 0.06), P(u1 - 0.06, z1 - 0.06), P(u0 + 0.06, z1 - 0.06)];
      if (tvF < 0.05) poly(pts, '#2A2D35');
      else { const t = animT, hue = (t * 25) % 360; poly(pts, `hsl(${hue},55%,${28 + tvF * 18}%)`); for (let i = 0; i < 4; i++) { const uu = u0 + 0.1 + ((i * 0.37 + t * 0.15) % (u1 - u0 - 0.35)), zz = z0 + 0.1 + ((i * 0.23 + Math.sin(t + i) * 0.1 + 0.3) % (z1 - z0 - 0.3)); poly([P(uu, zz), P(uu + 0.18, zz), P(uu + 0.18, zz + 0.12), P(uu, zz + 0.12)], `hsla(${(hue + i * 70) % 360},80%,70%,${0.5 * tvF})`); } }
    }
    else if (f.k === 'art') {
      if (has('art')) { poly(featPoly(f), '#F2EEE8', EDGE, 0.8); poly(featPoly(f, 0.08), '#1F2A44'); poly([P(f.u[0] + 0.15, f.z[0] + 0.15), P(f.u[0] + 0.95, f.z[0] + 0.15), P(f.u[0] + 0.55, f.z[1] - 0.15)], '#E0A43A'); poly([P(f.u[0] + 0.75, f.z[0] + 0.15), P(f.u[1] - 0.12, f.z[0] + 0.15), P(f.u[1] - 0.45, f.z[1] - 0.25)], '#D24A7A'); }
      else { const g = { u: [f.u[0] + 0.2, f.u[1] - 0.2], z: [f.z[0] + 0.1, f.z[1] - 0.1], p: f.p }; poly(featPoly(g), '#2B2430'); poly(featPoly(g, 0.06), '#E8C9A0'); poly([P(g.u[0] + 0.2, g.z[0] + 0.1), P(g.u[0] + 0.8, g.z[0] + 0.1), P(g.u[0] + 0.5, g.z[1] - 0.1)], '#B5476E'); }
    }
    else if (f.k === 'screen') { if (!has('projector')) return; poly([P(f.u[0] - 0.06, f.z[1] + 0.02), P(f.u[1] + 0.06, f.z[1] + 0.02), P(f.u[1] + 0.06, f.z[1] + 0.1), P(f.u[0] - 0.06, f.z[1] + 0.1)], '#2B2B30'); poly(featPoly(f), '#1B1A1F'); poly(featPoly(f, 0.04), video.id && video.screen === 'proj' ? '#0E0E12' : '#F2F0EC'); }
    else if (f.k === 'hallart') { poly(featPoly(f), '#2B2430'); poly(featPoly(f, 0.06), '#C8D7D1'); const [cx, cy] = iso(...P((f.u[0] + f.u[1]) / 2, (f.z[0] + f.z[1]) / 2)); circle(cx, cy, 8, '#E0A43A'); }
    else if (f.k === 'poster') { poly(featPoly(f), '#2B2430'); poly(featPoly(f, 0.05), '#C2413A'); const [cx, cy] = iso(...P((f.u[0] + f.u[1]) / 2, (f.z[0] + f.z[1]) / 2)); ctx.fillStyle = '#F2EEE8'; ctx.font = '700 9px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.fillText('LIFT', cx, cy + 3); ctx.textAlign = 'start'; }
    else if (f.k === 'mirror') { poly(featPoly(f), '#C9CED6', EDGE, 0.8); poly(featPoly(f, 0.04), '#E8F1F5'); line3(P(f.u[0] + 0.15, f.z[1] - 0.15), P(f.u[0] + 0.35, f.z[1] - 0.4), 'rgba(255,255,255,.9)', 1.5); }
    else if (f.k === 'tiles') { for (let u = f.u[0]; u < f.u[1] - 0.01; u += 0.23) for (let z = f.z[0], k = 0; z < f.z[1] - 0.01; z += 0.24, k++) { poly([P(u, z), P(Math.min(u + 0.23, f.u[1]), z), P(Math.min(u + 0.23, f.u[1]), z + 0.24), P(u, z + 0.24)], (Math.round(u / 0.23) + k) % 2 ? '#D5E6EB' : '#C7DDE3', 'rgba(255,255,255,.55)', 0.6); } }
  }
  function drawWalls(level) {
    if (isOutdoor(level)) { drawYardBack(); return; }
    const lk = LOOKS[level], c = wallTone(level), back = BACK[VR];
    const quad = (pl, z0, z1) => [wallPoint(pl, 0, z0), wallPoint(pl, planeLen(pl), z0), wallPoint(pl, planeLen(pl), z1), wallPoint(pl, 0, z1)];
    const segq = (pl, u0, u1, z0, z1) => [wallPoint(pl, u0, z0), wallPoint(pl, u1, z0), wallPoint(pl, u1, z1), wallPoint(pl, u0, z1)];
    back.forEach((pl, i) => {
      poly(quad(pl, 0, WH), i === 0 ? shade(c, -0.07) : c); drawPattern(lk.paper, pl, planeLen(pl)); if (lk.paper && i === 0) poly(quad(pl, 0, WH), 'rgba(0,0,0,.06)');
      if (!hasRoomLooks(level)) return;
      planeRooms(level, pl).forEach(([rn, u0, u1]) => { const ov = ROOMLOOK[level][rn]; if (!ov || !Object.keys(ov).length) return; const rl = lookAt(level, rn), rc = toneOf(rl);
        ctx.save(); poly(segq(pl, u0, u1, 0, WH), i === 0 ? shade(rc, -0.07) : rc); ctx.clip(); drawPattern(rl.paper, pl, planeLen(pl)); if (rl.paper && i === 0) poly(quad(pl, 0, WH), 'rgba(0,0,0,.06)'); ctx.restore(); });
    });
    const B0 = level === 0, bh = B0 ? 0.34 : 0.14, tk = B0 ? 0.36 : 0.16, foot = B0 ? '#8C8884' : null;
    back.forEach((pl, i) => { poly(quad(pl, 0, bh), foot ? (i === 0 ? shade(foot, -0.1) : foot) : shade(c, i === 0 ? -0.32 : -0.26)); if (!foot && hasRoomLooks(level)) planeRooms(level, pl).forEach(([rn, u0, u1]) => { if (ROOMLOOK[level][rn]) poly(segq(pl, u0, u1, 0, bh), shade(wallTone(level, rn), i === 0 ? -0.32 : -0.26)); }); if (B0) line3(wallPoint(pl, 0, bh), wallPoint(pl, planeLen(pl), bh), 'rgba(0,0,0,.25)', 1); });
    drawWallDecor(level, back);
    LEVELS[level].feats.forEach(f => { if (back.includes(f.p)) drawFeature(level, f); });
    if (B0) drawBasementBones(back);
    drawWallLights(level); drawWallDirt(level);
    const cap = B0 ? '#77726E' : shade(c, -0.36), vw = viewW(), vd = viewD();
    polyV([[-tk, -tk, WH], [vw, -tk, WH], [vw, 0, WH], [0, 0, WH], [0, vd, WH], [-tk, vd, WH]], cap);
    polyV([[vw, -tk, -0.25], [vw, 0, -0.25], [vw, 0, WH], [vw, -tk, WH]], B0 ? '#5E5A57' : shade(c, -0.46));
    polyV([[-tk, vd, -0.25], [0, vd, -0.25], [0, vd, WH], [-tk, vd, WH]], B0 ? '#86817C' : shade(c, -0.22));
  }
  function drawBasementBones(back) {
    if (back.includes('B')) {
    for (let u = 0.35; u < WX - 0.1; u += 0.6) box(u, 0, 2.44, 0.1, 0.34, 0.16, '#8A6A50');
    line3([0, 0.34, 2.6], [WX, 0.34, 2.6], 'rgba(90,60,40,.5)', 1.2);
    }
    if (!back.includes('L')) return;
    box(0.04, 0.3, 2.32, 0.32, 6.0, 0.24, '#B9BEC3');
    for (let y = 0.9; y < 6.3; y += 0.9) line3([0.36, y, 2.32], [0.36, y, 2.56], 'rgba(0,0,0,.18)', 1);
    box(0.3, 0.04, 2.32, 0.6, 0.32, 0.24, '#B9BEC3');
    [[1.92, '#C27A4A'], [1.98, '#4A88B8']].forEach(([z, col]) => line3([0.03, 0.3, z], [0.03, 5.15, z], col, 2));
    line3([0.03, 0.3, 1.92], [0.6, 0.03, 1.92], '#C27A4A', 2);
    [[2.4, 2.1], [6.2, 1.7]].forEach(([u, z]) => { const [x, y] = iso(0, u, z); ctx.strokeStyle = 'rgba(40,40,50,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 3, y - 4); ctx.lineTo(x + 3, y + 4); ctx.stroke(); });
  }
  function drawFloor(level) {
    if (isOutdoor(level)) { drawYardGround(); return; }
    const f = FLOORS[LOOKS[level].floor] || FLOORS.wood;
    if (gOn && GLOSS_FLOORS.has(f.kind)) gMat = MATERIAL.gloss;
    for (let i = 0; i < WX; i++) for (let j = 0; j < WY; j++) floorTile(f, i, j);
    if (hasRoomLooks(level)) LEVELS[level].rooms.forEach(rm => { const ov = ROOMLOOK[level][rm.n]; if (!ov || !ov.floor) return; const rf = FLOORS[ov.floor] || f, [x1, y1, x2, y2] = rm.r;
      ctx.save(); poly([[x1, y1, 0], [x2, y1, 0], [x2, y2, 0], [x1, y2, 0]], null); ctx.clip(); for (let i = Math.floor(x1); i < Math.ceil(x2); i++) for (let j = Math.floor(y1); j < Math.ceil(y2); j++) floorTile(rf, i, j); ctx.restore(); });
    { const vw = viewW(), vd = viewD(); polyV([[0, vd, 0], [vw, vd, 0], [vw, vd, -0.25], [0, vd, -0.25]], shade(f.a, -0.28)); polyV([[vw, 0, 0], [vw, vd, 0], [vw, vd, -0.25], [vw, 0, -0.25]], shade(f.a, -0.42)); }
    gMat = MATERIAL.matte;
    if (level === 0 && LOOKS[0].floor === 'concrete') { [2.5, 5.1, 7.5].forEach(x => line3([x, 0, 0.003], [x, WY, 0.003], 'rgba(60,55,55,.22)', 1)); line3([0, 4.0, 0.003], [WX, 4.0, 0.003], 'rgba(60,55,55,.22)', 1); const [dx, dy] = iso(1.3, 6.3, 0.004); ell(dx, dy, 7, 3.5, '#5E5A57'); ell(dx, dy, 5.5, 2.6, '#2B2830'); for (let k = -1; k <= 1; k++) limb(dx + k * 2.5 - 1.5, dy - 1.5, dx + k * 2.5 + 1.5, dy + 1.5, '#7A7570', 0.8); }
    if (level === 1 && parcel && !parcel.taken) { const [px, py] = PARCEL.box; if (parcel.kind === 'groceries') { /* a brown paper bag: tall, with its top folded over, and a leaf of something green poking out */ box(px + 0.04, py + 0.04, 0, 0.34, 0.3, 0.46, '#C8A06A'); box(px + 0.02, py + 0.02, 0.46, 0.38, 0.34, 0.07, '#B88D5A'); const [gx, gy] = iso(px + 0.2, py + 0.12, 0.56); ell(gx - 3, gy - 4, 3, 6, '#4F9460', null, -0.3); } else { box(px + 0.05, py + 0.05, 0, 0.3, 0.22, 0.36, '#D9C3A0'); const [lx, ly] = iso(px + 0.2, py + 0.27, 0.2); circle(lx, ly, 2.5, '#C2413A'); } }
  }
  function floorTile(f, i, j) {
    const q = (x1, y1, x2, y2, c, st, lw) => poly([[x1, y1, 0], [x2, y1, 0], [x2, y2, 0], [x1, y2, 0]], c, st, lw), hsh = (k) => ((i * 73 + j * 37 + k * 11) % 17) / 17;
    let col = f.a; if (f.kind === 'check') col = (i + j) % 2 ? f.a : f.b; if (f.kind === 'plank') col = j % 2 ? f.a : f.b; if (f.kind === 'stone') col = hsh(1) < 0.5 ? f.a : f.b;
    q(i, j, i + 1, j + 1, col, f.kind === 'hex' || f.kind === 'herring' || f.kind === 'parquet' || f.kind === 'brick' || f.kind === 'mosaic' ? null : f.line, 0.8);
    if (f.kind === 'plank') { const off = (j * 0.37) % 1; if (off > 0.05) line3([i + off, j, 0.001], [i + off, j + 1, 0.001], f.line, 0.7); }
    else if (f.kind === 'speck') for (let k = 0; k < 4; k++) { const [sx, sy] = iso(i + ((k * 37 + i * 13 + j * 7) % 10) / 10, j + ((k * 53 + j * 11 + i * 3) % 10) / 10, 0); circle(sx, sy, 1.3, (f.pal || ['#C2413A', '#3D6B73', '#E0A43A', '#7A6F78'])[(i + j + k) % 4]); }
    else if (f.kind === 'herring') { for (let k = 0; k < 4; k++) { const y0 = j + k * 0.25; poly([[i, y0, 0], [i + 0.5, y0 + 0.25, 0], [i + 0.5, y0 + 0.5, 0], [i, y0 + 0.25, 0]], k % 2 ? f.a : f.b, f.line, 0.6); poly([[i + 0.5, y0 + 0.25, 0], [i + 1, y0, 0], [i + 1, y0 + 0.25, 0], [i + 0.5, y0 + 0.5, 0]], k % 2 ? f.b : f.a, f.line, 0.6); } }
    else if (f.kind === 'parquet') { [[0, 0], [0.5, 0], [0, 0.5], [0.5, 0.5]].forEach(([dx, dy], k) => { const h = (k === 0 || k === 3) !== ((i + j) % 2 === 1); for (let m = 0; m < 3; m++) { const a = m / 6; if (h) q(i + dx, j + dy + a, i + dx + 0.5, j + dy + a + 1 / 6, m % 2 ? f.a : f.b, f.line, 0.5); else q(i + dx + a, j + dy, i + dx + a + 1 / 6, j + dy + 0.5, m % 2 ? f.a : f.b, f.line, 0.5); } }); }
    else if (f.kind === 'marble') { if (hsh(2) < 0.55) { const a = hsh(3), b = hsh(4); line3([i + a, j, 0.001], [i + 0.5 + b * 0.3, j + 0.5, 0.001], f.vein, 0.8); line3([i + 0.5 + b * 0.3, j + 0.5, 0.001], [i + 1, j + 0.3 + a * 0.6, 0.001], f.vein, 0.8); } }
    else if (f.kind === 'hex') { for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) { const cx = i + 0.25 + c * 0.5, cy = j + 0.25 + r * 0.5 + (c % 2) * 0.0; const pts = []; for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k; pts.push([cx + Math.cos(a) * 0.24, cy + Math.sin(a) * 0.21, 0.001]); } poly(pts, null, f.line, 0.7); } }
    else if (f.kind === 'mosaic') { for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) q(i + a / 3, j + b / 3, i + (a + 1) / 3, j + (b + 1) / 3, f.pal[(i * 7 + j * 3 + a * 5 + b * 2) % 4], f.line, 0.5); }
    else if (f.kind === 'tile') { q(i + 0.04, j + 0.04, i + 0.96, j + 0.96, null, 'rgba(255,255,255,.12)', 0.6); }
    else if (f.kind === 'brick') { for (let r = 0; r < 4; r++) { const off = r % 2 ? 0.25 : 0; for (let u = -off; u < 1; u += 0.5) q(i + Math.max(0, u), j + r * 0.25, i + Math.min(1, u + 0.5), j + (r + 1) * 0.25, (r + Math.round(u * 2) + i) % 3 ? f.a : f.b, f.line, 0.6); } }
    else if (f.kind === 'sisal') { for (let k = 1; k < 6; k++) line3([i, j + k / 6, 0.001], [i + 1, j + k / 6, 0.001], 'rgba(120,95,60,.18)', 0.7); }
  }
  function roomPath() { const vw = viewW(), vd = viewD(), pts = [isoV(-0.4, vd + 0.2, -0.25), isoV(-0.4, vd + 0.2, WH + 0.1), isoV(-0.4, -0.4, WH + 0.1), isoV(vw + 0.2, -0.4, WH + 0.1), isoV(vw + 0.2, -0.4, -0.25), isoV(vw + 0.2, vd + 0.2, -0.25)]; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); }

  function seeded(n) { let v = (n * 7919) % 233280; return () => { v = (v * 9301 + 49297) % 233280; return v / 233280; }; }

  function floorBlob(x, y, r, col, rnd, n) { for (let i = 0; i < n; i++) { const [sx, sy] = iso(x + (rnd() - 0.5) * r * 1.3, y + (rnd() - 0.5) * r * 1.3, 0.002); ell(sx, sy, r * TW * (0.45 + rnd() * 0.5), r * TH * (0.45 + rnd() * 0.5), col); } }
  function drawFloorDirt(level) {
    DIRT.forEach(d => {
      if (d.level !== level || d.kind !== 'floor') return;
      const al = Math.min(1, d.a), rnd = seeded(d.id); if (al < 0.02) return;
      const A = (o) => Math.min(1, al * o * Math.min(1.3, d.max));
      if (d.type === 'mud' || d.type === 'paws') {
        const ang = rnd() * Math.PI * 2, c = `rgba(92,62,38,${A(0.7)})`;
        for (let i = 0; i < 3; i++) { const side = i % 2 ? 0.07 : -0.07, x = d.x + Math.cos(ang) * i * 0.3 - Math.sin(ang) * side, y = d.y + Math.sin(ang) * i * 0.3 + Math.cos(ang) * side, [sx, sy] = iso(x, y, 0.002);
          if (d.type === 'paws') { ell(sx, sy, 3, 2, c); [-3, -1, 1, 3].forEach(k => circle(sx + k * 1.3, sy - 2.8, 1.05, c)); } else { ell(sx, sy, 5, 2.3, c, null, 0.2); ell(sx + 3.6, sy + 1.4, 2.5, 1.5, c); } }
      } else if (d.type === 'crumbs') { for (let i = 0; i < 10; i++) { const [sx, sy] = iso(d.x + (rnd() - 0.5) * 0.5, d.y + (rnd() - 0.5) * 0.5, 0.002); circle(sx, sy, 0.9 + rnd() * 1.1, `rgba(${(150 + rnd() * 40) | 0},${(105 + rnd() * 30) | 0},60,${A(0.9)})`); } }
      else if (d.type === 'spill') floorBlob(d.x, d.y, 0.22, `rgba(110,70,40,${A(0.4)})`, rnd, 6);
      else if (d.type === 'water') floorBlob(d.x, d.y, 0.26, `rgba(120,175,215,${A(0.45)})`, rnd, 6);
      else if (d.type === 'puddle') floorBlob(d.x, d.y, 0.2, `rgba(214,186,80,${A(0.42)})`, rnd, 5);
      else if (d.type === 'sweat') { for (let i = 0; i < 6; i++) { const [sx, sy] = iso(d.x + (rnd() - 0.5) * 0.6, d.y + (rnd() - 0.5) * 0.6, 0.002); ell(sx, sy, 2 + rnd() * 1.5, 1 + rnd(), `rgba(130,175,200,${A(0.45)})`); } }
      else if (d.type === 'fur') { ctx.lineWidth = 1; for (let i = 0; i < 4; i++) { const [sx, sy] = iso(d.x + (rnd() - 0.5) * 0.6, d.y + (rnd() - 0.5) * 0.6, 0.002); ctx.strokeStyle = `rgba(${d.col || '150,130,110'},${A(0.8)})`; for (let k = 0; k < 5; k++) { const a2 = rnd() * 6.28; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(a2) * 3.5, sy + Math.sin(a2) * 2); ctx.stroke(); } } }
      else if (d.type === 'dust') { const [sx, sy] = iso(d.x, d.y, 0.04); ell(sx, sy, 6, 4, `rgba(135,130,138,${A(0.55)})`); ell(sx - 3, sy - 1.5, 3.5, 2.5, `rgba(170,165,172,${A(0.55)})`); ctx.strokeStyle = `rgba(120,115,125,${A(0.5)})`; ctx.lineWidth = 0.8; for (let k = 0; k < 6; k++) { const a2 = k * 1.05; ctx.beginPath(); ctx.moveTo(sx + Math.cos(a2) * 5, sy + Math.sin(a2) * 3.4); ctx.lineTo(sx + Math.cos(a2) * 8, sy + Math.sin(a2) * 5); ctx.stroke(); } }
      else { const [sx, sy] = iso(d.x, d.y, 0.002); ell(sx, sy, 10, 2.6, `rgba(70,60,60,${A(0.34)})`, null, 0.4 * (rnd() - 0.5)); }
    });
  }
  function drawWallDirt(level) {
    DIRT.forEach(d => {
      if (d.level !== level || d.kind !== 'wall' || !BACK[VR].includes(d.p)) return;
      const al = Math.min(1, d.a), rnd = seeded(d.id); if (al < 0.02) return;
      const A = (o) => Math.min(1, al * o * Math.min(1.3, d.max)), rot = d.p === 'B' ? ANG : -ANG, at = (du, dz) => iso(...wallPoint(d.p, d.u + du, d.z + dz)), lean = d.p === 'B' ? 1 : -1;
      if (d.type === 'hand') { const [sx, sy] = at(0, 0), c = `rgba(80,62,55,${A(0.4)})`; ell(sx, sy, 3.6, 4.2, c, null, rot); [-3, -1, 1, 3].forEach((k, i) => ell(sx + k, sy - 6.5 + k * 0.45 * lean - (i === 1 || i === 2 ? 1 : 0), 1, 2.7, c, null, rot)); ell(sx - 4.5, sy - 1 - 2 * lean, 1, 2.2, c, null, rot - 0.8); }
      else if (d.type === 'grease') { for (let i = 0; i < 8; i++) { const [sx, sy] = at((rnd() - 0.5) * 0.55, (rnd() - 0.5) * 0.3); circle(sx, sy, 0.8 + rnd() * 2, `rgba(175,125,45,${A(0.5)})`); } }
      else if (d.type === 'scuffw') { const [x1, y1] = at(-0.22, 0), [x2, y2] = at(0.22, 0.04); ctx.strokeStyle = `rgba(40,35,40,${A(0.45)})`; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
      else { for (let i = 0; i < 3; i++) { const [sx, sy] = at((rnd() - 0.5) * 0.25, (rnd() - 0.5) * 0.15); ell(sx, sy, 8 + rnd() * 5, 4 + rnd() * 3, `rgba(90,78,78,${A(0.2)})`, null, rot); } }
    });
  }
  // The cloud that hides a moving box for a moment while what was inside takes its place.
  function drawPoofs(level) {
    for (let i = poofs.length - 1; i >= 0; i--) {
      const f = poofs[i]; f.t += rdt; if (f.t > 0.9) { poofs.splice(i, 1); continue; } if (f.level !== level) continue;
      const u = f.t / 0.9, grow = Math.min(1, u * 2.6), al = u < 0.5 ? 1 : 1 - (u - 0.5) / 0.5;
      const [cx, cy] = iso(f.x, f.y, 0.4);
      ctx.save(); ctx.globalAlpha = al * 0.95;
      for (const [dx, dy, r] of [[0, 0, 15], [-13, 3, 11], [13, 3, 11], [-7, -8, 11], [8, -9, 10], [0, 6, 12]]) {
        ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = 'rgba(120,110,130,.45)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(cx + dx * grow * 1.5, cy + dy * grow * 1.2 - u * 8, r * (0.5 + grow * 0.7), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }
  }
  function drawSparkles(level) {
    for (let i = sparkles.length - 1; i >= 0; i--) {
      const s = sparkles[i]; s.t += rdt; if (s.t > 1.2) { sparkles.splice(i, 1); continue; } if (s.level !== level) continue;
      const [sx, sy] = iso(...s.pt), al = 1 - s.t / 1.2; ctx.strokeStyle = `rgba(255,255,255,${al})`; ctx.lineWidth = 1.4;
      for (let k = 0; k < 5; k++) { const a = k * 1.256 + s.t * 2, r = 5 + s.t * 10, x = sx + Math.cos(a) * r, y = sy - s.t * 14 + Math.sin(a) * r * 0.5; ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x + 3, y); ctx.moveTo(x, y - 3); ctx.lineTo(x, y + 3); ctx.stroke(); }
    }
  }

  const PRIVATE = new Set(['Bedroom', 'Bathroom', 'Gym', 'Utility', 'Primary bedroom', 'Guest room', 'Home gym']);
  const ALIAS = { Bedroom: 'Primary bedroom', 'Rec room': 'Theater', Entry: 'Dining room', 'Hall office': 'Office', Gym: 'Home gym' };
  const roomFor = (n) => (flags.house === 'craftsman' && ALIAS[n] ? ALIAS[n] : n);
  const LA = {}, occ = {}, occLevel = {};
  let rdt = 0.016;
  const PFX = createParticles(360, rand);
  const FAB = createFabric();
  function drawParticles(level, glow) {
    if (glow) ctx.globalCompositeOperation = 'lighter';
    PFX.forEach(level, (p, t) => {
      if ((p.kind === 'ember') !== glow) return;
      const [sx, sy] = iso(p.x, p.y, p.z), fadeIn = Math.min(1, t * 5);
      if (p.kind === 'steam') circle(sx, sy, 2.5 + t * 6, `rgba(255,255,255,${(1 - t) * 0.42 * fadeIn})`);
      else if (p.kind === 'smoke') circle(sx, sy, 4 + t * 13, `rgba(118,112,118,${(1 - t) * 0.26 * fadeIn})`);
      else if (p.kind === 'dust') circle(sx, sy, 1.5 + t * 5, `rgba(150,140,130,${(1 - t) * 0.3 * fadeIn})`);
      else if (p.kind === 'splash') circle(sx, sy, 1 + t * 1.6, `rgba(190,225,248,${(1 - t) * 0.55 * fadeIn})`);
      else if (p.kind === 'leaf') {
        // A tumbling leaf in autumn colours.
        const spin = animT * (2 + p.seed * 3) + p.seed * 10, col = ['#C2410C', '#D97706', '#B45309', '#A16207'][Math.floor(p.seed * 4)];
        ctx.globalAlpha = Math.min(1, (1 - t) * 3) * fadeIn;
        ell(sx, sy, 2.6, 1.2 + Math.abs(Math.sin(spin)) * 0.9, col, null, spin);
        ctx.globalAlpha = 1;
      }
      else circle(sx, sy, 0.9 + p.seed * 0.8, `rgba(255,${150 + Math.round(p.seed * 90)},70,${(1 - t) * (0.6 + 0.4 * Math.sin(animT * 20 + p.seed * 30))})`);
    });
    ctx.globalCompositeOperation = 'source-over';
  }
  const isLit = (key) => (LA[key] || 0) > 0.35;
  const lightCv = document.createElement('canvas'), lctx = lightCv.getContext('2d');

  function levelDark(level) { return Math.min(level === 0 ? 0.7 : 0.62, darkness() + (level === 0 ? 0.32 : 0) + (!power && !isOutdoor(level) ? 0.1 : 0) + (isOutdoor(level) && raining() ? 0.08 : 0)); }
  function wantLight(level, room, night, amb) {
    if (!power || levelDark(level) < 0.05) return 0;
    const now = absMin(), h = hour(), k = level + ':' + room;
    if (level === 0 && (room === 'Rec room' || room === 'Theater') && video.id && video.screen === 'proj') return 0.12;
    if (occ[k] !== undefined && now - occ[k] < 20) return 1;
    if ((!PRIVATE.has(room) || amb) && occLevel[level] !== undefined && now - occLevel[level] < 30 && h >= 16 && h < 23.5) return 0.85;
    return night && levelDark(level) > 0.3 ? 0.35 : 0;
  }
  function ease(key, target) { const v = LA[key] || 0; LA[key] = v + (target - v) * Math.min(1, rdt * 5); return LA[key]; }
  const MOTES = Array.from({ length: 54 }, () => ({ x: 40 + rand() * (W - 80), y: 70 + rand() * (H - 120), s: 0.4 + rand() * 1.1, ph: rand() * 6.28 }));
  function drawMotes(lights) {
    const pts = lights.map(l => { const [sx, sy] = iso(...l.src), [px, py] = iso(...l.pool); return { sx, sy, px, py, r: l.r, s: l.s }; });
    MOTES.forEach(m => {
      m.y -= rdt * 2.2 * m.s; m.x += Math.sin(animT * 0.4 + m.ph) * rdt * 3;
      if (m.y < 50) { m.y = H - 40; m.x = 40 + rand() * (W - 80); }
      let b = 0; pts.forEach(q => { const d1 = Math.hypot(m.x - q.sx, m.y - q.sy) / (q.r * 0.6), d2 = Math.hypot(m.x - q.px, (m.y - q.py) * 1.8) / q.r; b += q.s * Math.max(0, 1 - Math.min(d1, d2)); });
      const al = Math.min(0.75, 0.06 + b * 0.6) * (0.6 + 0.4 * Math.sin(animT * 1.3 + m.ph));
      if (al > 0.03) circle(m.x, m.y, 0.5 + m.s * 0.6, `rgba(255,238,210,${al})`);
    });
  }
  function activeLights(level) {
    const out = [];
    WALL_LIGHTS.forEach((L, i) => { if (L.level !== level || (L.need && !has(L.need)) || lightSkipped(L) || (L.onlyIn && flags.house !== L.onlyIn)) return; const manual = wallLightOverrides.get(i); const target = manual === true ? 1 : manual === false ? 0 : wantLight(level, roomFor(L.room), L.night, L.amb); const s = ease('w' + i, target); if (s < 0.02) return; const um = (L.u[0] + L.u[1]) / 2, off = L.k === 'under' ? 0.5 : 0.2; out.push({ src: L.p === 'B' ? [um, off, L.z] : [off, um, L.z], pool: L.p === 'B' ? [um, L.k === 'under' ? 1.1 : 1.4, 0] : [1.4, um, 0], r: L.r, s, col: L.col, vis: BACK[VR].includes(L.p) }); });
    OBJS.forEach(o => { const lt = T_OF(o).light; if (!lt || o.level !== level) return; const [x, y] = xf(o, lt.at[0], lt.at[1]); const manual = objectLights.get(o.id); const target = manual === true ? Math.max(0.75, wantLight(level, roomName(level, x, y))) : manual === false ? 0 : wantLight(level, roomName(level, x, y)); const s = ease(o.id, target); if (s < 0.02) return; out.push({ src: [x, y, lt.at[2] + (o.z || 0)], pool: [x, y, 0], r: lt.r, s, col: lt.col, vis: true }); });
    return out;
  }
  function drawWallLights(level) {
    WALL_LIGHTS.forEach((L, i) => {
      if (L.level !== level || (L.need && !has(L.need)) || !BACK[VR].includes(L.p) || lightSkipped(L) || (L.onlyIn && flags.house !== L.onlyIn)) return;
      const on = wallLightOverrides.get(i) === true || (wallLightOverrides.get(i) !== false && isLit('w' + i)), um = (L.u[0] + L.u[1]) / 2, P = (u, z, off = 0) => iso(...(L.p === 'B' ? [u, off, z] : [off, u, z]));
      if (gOn && on && L.k !== 'under') G.emissive(L.z);
      if (L.k === 'sconce') { const [bx, by] = P(um, L.z - 0.12); rr(bx - 2.5, by - 6, 5, 9, 1.5, '#5A4A40'); const [sx, sy] = P(um, L.z + 0.06, 0.12); ctx.beginPath(); ctx.moveTo(sx - 7, sy + 4); ctx.lineTo(sx - 4, sy - 7); ctx.lineTo(sx + 4, sy - 7); ctx.lineTo(sx + 7, sy + 4); ctx.closePath(); ctx.fillStyle = on ? '#FFF0C4' : '#E7DCC8'; ctx.fill(); ctx.strokeStyle = 'rgba(60,40,30,.35)'; ctx.lineWidth = 0.8; ctx.stroke(); }
      else if (L.k === 'strip' || L.k === 'bar') { const a = P(L.u[0], L.z, 0.04), b = P(L.u[1], L.z, 0.04); limb(a[0], a[1], b[0], b[1], '#5A4A40', 5); limb(a[0], a[1] + 0.5, b[0], b[1] + 0.5, on ? '#FFF6D8' : '#D8D2C8', 2.4); }
      else if (L.k === 'string') { let prev = null; for (let k = 0; k <= 16; k++) { const u = L.u[0] + (L.u[1] - L.u[0]) * k / 16, sag = Math.sin(Math.PI * ((k % 8) / 8)) * 0.12, q = P(u, L.z - sag, 0.02); if (prev) limb(prev[0], prev[1], q[0], q[1], '#3A3340', 0.8); if (k % 2) circle(q[0], q[1] + 2, 2, on ? ['#FFD27A', '#FF9EC2', '#9EE0FF'][k % 3] : '#B9B0A6'); prev = q; } }
      else if (L.k === 'bulb') { const [bx, by] = P(um, L.z + 0.08, 0.02); circle(bx, by, 3, '#E9E4DD'); const [gx, gy] = P(um, L.z - 0.06, 0.14); circle(gx, gy, 4.5, on ? '#FFF6D0' : '#D8D2C8'); limb(gx + 3, gy, gx + 3, gy + 16, 'rgba(160,150,140,.8)', 0.7); circle(gx + 3, gy + 17, 1.2, '#B9B0A6'); }
      else if (L.k === 'under') {
        if (on) poly([[L.u[0], 0.002, 0.93], [L.u[1], 0.002, 0.93], [L.u[1], 0.002, 1.55], [L.u[0], 0.002, 1.55]], 'rgba(255,226,160,.45)');
        box(L.u[0], 0, 1.55, L.u[1] - L.u[0], 0.36, 0.68, '#E4DDD2');
        for (let k = 1; k < 4; k++) { const u = L.u[0] + (L.u[1] - L.u[0]) * k / 4; line3([u, 0.36, 1.6], [u, 0.36, 2.18], 'rgba(60,40,50,.25)', 1); }
        for (let k = 0; k < 4; k++) { const u = L.u[0] + (L.u[1] - L.u[0]) * (k + 0.5) / 4 + (k % 2 ? -0.12 : 0.12); line3([u, 0.37, 1.64], [u, 0.37, 1.78], '#8B8189', 1.6); }
        if (on) { const a = P(L.u[0] + 0.05, 1.55, 0.3), b = P(L.u[1] - 0.05, 1.55, 0.3); limb(a[0], a[1], b[0], b[1], '#FFF6D8', 1.6); }
      }
      if (gOn) G.clearBase();
    });
  }

  const wallH = {};

  function focusRect(level) {
    if (tapFocus && tapFocus.level === level && performance.now() - tapFocus.at < 25000) return tapFocus.r;
    const who = [jordan, maya].find(c => !c.away && c.level === level && (c === jordan || jordan.level !== level));
    if (!who) return null;
    const rm = LEVELS[level].rooms.find(r => r.n === roomName(level, who.x, who.y)); return rm ? rm.r : null;
  }
  function wallTarget(level, cx, cy) {
    if (arranging || wallMode === 'down') return IW;
    if (wallMode === 'up') return WH;
    const r = focusRect(level); if (!r) return IW;
    const [vx, vy] = V(cx, cy), vr = vrect(r[0], r[1], r[2], r[3]); return vx > vr[0] + 0.15 && vy > vr[1] + 0.15 ? IW : WH;
  }
  function easedH(key, target) { const v = wallH[key] === undefined ? target : wallH[key]; const n = v + (target - v) * Math.min(1, rdt * 7); wallH[key] = n; return n; }
  function wallItemsFull(level, items) {
    const c = wallTone(level), side = c.startsWith('#') ? c : '#E9DCCB', top = shade(side, -0.38);
    const walls = LEVELS[level].walls;
    walls.forEach((w, wi) => {
      const vertical = w.x !== undefined;
      for (let s = w.a; s < w.b - 0.001; s += 0.5) {
        const e = Math.min(w.b, s + 0.5), r = vertical ? [w.x - 0.06, s, w.x + 0.06, e] : [s, w.y - 0.06, e, w.y + 0.06];
        const cx = (r[0] + r[2]) / 2, cy = (r[1] + r[3]) / 2, key = `${level}:${wi}:${s}`;
        items.push({ x1: r[0], y1: r[1], x2: r[2], y2: r[3], key: vs(cx, cy), d: () => { const h = easedH(key, wallTarget(level, cx, cy)), sc = wallTone(level, wallSideRoom(level, r, vertical)); box(r[0], r[1], 0, r[2] - r[0], r[3] - r[1], h, sc.startsWith('#') ? sc : side); poly([[r[0], r[1], h + 0.001], [r[2], r[1], h + 0.001], [r[2], r[3], h + 0.001], [r[0], r[3], h + 0.001]], top); if (h > 1) { line3(vertical ? [r[2], r[1], 0.12] : [r[0], r[3], 0.12], vertical ? [r[2], r[3], 0.12] : [r[2], r[3], 0.12], 'rgba(0,0,0,.18)', 1); } } });
      }
    });
    // door headers over gaps between wall pieces on the same line
    walls.forEach((w, wi) => walls.forEach((v, vi) => {
      const vert = w.x !== undefined; if ((v.x !== undefined) !== vert || (vert ? v.x !== w.x : v.y !== w.y) || v.a <= w.b) return;
      if (walls.some(q => q !== v && (q.x !== undefined) === vert && (vert ? q.x === w.x : q.y === w.y) && q.a > w.b && q.a < v.a)) return;
      const g0 = w.b, g1 = v.a; if (g1 - g0 > 1.7) return;
      const r = vert ? [w.x - 0.06, g0, w.x + 0.06, g1] : [g0, w.y - 0.06, g1, w.y + 0.06], cx = (r[0] + r[2]) / 2, cy = (r[1] + r[3]) / 2, key = `${level}:h${wi}:${vi}`;
      items.push({ x1: r[0], y1: r[1], x2: r[2], y2: r[3], key: vs(cx, cy), d: () => { const h = easedH(key, wallTarget(level, cx, cy)); if (h < 2.15) return; box(r[0], r[1], 2.1, r[2] - r[0], r[3] - r[1], h - 2.1, side); poly([[r[0], r[1], h + 0.001], [r[2], r[1], h + 0.001], [r[2], r[3], h + 0.001], [r[0], r[3], h + 0.001]], top); } });
    }));
  }
  function extWindowColor(level) { if (levelDark(level) > 0.2) return Object.keys(LA).some(k => LA[k] > 0.35) && level !== 0 ? '#F3C77A' : '#2B2F45'; return raining() ? '#8E99A8' : '#A9C3D3'; }
  function drawFrontWalls(level) {
    if (isOutdoor(level)) return;
    const h = easedH('front' + level, arranging || wallMode !== 'up' ? 0.32 : WH), sid = level === 0 ? '#8C8884' : '#D9CDBD', col = extWindowColor(level);
    FRONT[VR].forEach(pl => {
      const r = pl === 'F' ? [0, WY, WX + 0.16, WY + 0.16] : pl === 'R' ? [WX, -0.16, WX + 0.16, WY + 0.16] : pl === 'L' ? [-0.16, -0.16, 0, WY + 0.16] : [-0.16, -0.16, WX + 0.16, 0];
      box(r[0], r[1], -0.25, r[2] - r[0], r[3] - r[1], h + 0.25, sid);
      const out = (u, z) => (pl === 'F' ? [u, WY + 0.162, z] : pl === 'R' ? [WX + 0.162, u, z] : pl === 'L' ? [-0.162, u, z] : [u, -0.162, z]), len = planeLen(pl);
      if (level > 0 && h > 0.6) for (let z = 0.25; z < h - 0.05; z += 0.22) line3(out(0, z), out(len, z), 'rgba(0,0,0,.08)', 1);
      if (level === 0 || h < 2.0) return;
      LEVELS[level].feats.forEach(f => {
        if (f.p !== pl) return;
        const q = (a, b, z0, z1) => [out(a, z0), out(b, z0), out(b, z1), out(a, z1)];
        if (f.k === 'window' || f.k === 'highwin') { poly(q(f.u[0], f.u[1], f.z[0], f.z[1]), '#F7F3EE'); poly(q(f.u[0] + 0.07, f.u[1] - 0.07, f.z[0] + 0.07, f.z[1] - 0.07), col); line3(out((f.u[0] + f.u[1]) / 2, f.z[0] + 0.07), out((f.u[0] + f.u[1]) / 2, f.z[1] - 0.07), '#F7F3EE', 2); }
        else if (f.k === 'door') { poly(q(f.u[0] - 0.06, f.u[1] + 0.06, 0, f.z[1] + 0.05), '#EFE8DE'); poly(q(f.u[0], f.u[1], 0, f.z[1]), '#7A5236'); }
      });
    });
  }

  const YARD = { tiles: [], rainAt: 0, rainUntil: 0, rainCheck: -1, rainLogged: false };
  for (let i = 0; i < 10; i++) for (let j = 0; j < 8; j++) YARD.tiles.push({ i, j, len: 0.3 + rand() * 0.15, water: 0.6 + rand() * 0.2, weed: 0, seed: rand(), burn: 0, mowedAt: -9999, leaves: 0, snow: 0 });
  const isPatio = (i, j) => i <= 2 && j >= 2 && j <= 4;
  const tileAt = (x, y) => YARD.tiles[Math.min(9, Math.max(0, Math.floor(x))) * 8 + Math.min(7, Math.max(0, Math.floor(y)))];
  const raining = () => absMin() >= YARD.rainAt && absMin() < YARD.rainUntil;

  function grassColor(t) {
    const w = Math.min(1, t.water * 1.4), dry = [194, 176, 96], wet = [94, 158, 69];
    let c = dry.map((v, k) => v + (wet[k] - v) * w);
    if (t.burn > 0.05) c = c.map((v, k) => v + ([180, 154, 76][k] - v) * Math.min(1, t.burn));
    if (seasonIdx() === 3) c = c.map((v, k) => v + ([167, 159, 120][k] - v) * 0.7); else if (seasonIdx() === 2) c = c.map((v, k) => v + ([150, 150, 80][k] - v) * 0.2);
    const dark = 1 - t.len * 0.16 + (absMin() - t.mowedAt < 2160 ? (t.j % 2 ? 0.06 : -0.05) : 0);
    return `rgb(${c.map(v => Math.round(Math.min(255, v * dark))).join(',')})`;
  }
  function drawYardGround() {
    YARD.tiles.forEach(t => {
      const { i, j } = t;
      if (isPatio(i, j)) { if (flags.house === 'craftsman') { poly([[i, j, 0.03], [i + 1, j, 0.03], [i + 1, j + 1, 0.03], [i, j + 1, 0.03]], '#9C6B45', 'rgba(60,40,20,.3)', 1); for (let k = 0.2; k < 1; k += 0.2) poly([[i + k, j, 0.031], [i + k, j + 1, 0.031]], null, 'rgba(60,40,20,.3)', 1); return; } poly([[i, j, 0], [i + 1, j, 0], [i + 1, j + 1, 0], [i, j + 1, 0]], '#B9B2A8', 'rgba(80,70,60,.35)', 1); poly([[i + 0.5, j, 0.001], [i + 0.5, j + 1, 0.001]], null, 'rgba(80,70,60,.25)', 1); return; }
      const col = grassColor(t); poly([[i, j, 0], [i + 1, j, 0], [i + 1, j + 1, 0], [i, j + 1, 0]], col, 'rgba(40,70,30,.12)', 0.6);
      if ((t.snow || 0) > 0.05) { poly([[i, j, 0.004], [i + 1, j, 0.004], [i + 1, j + 1, 0.004], [i, j + 1, 0.004]], `rgba(246,248,250,${Math.min(0.96, t.snow * 1.1)})`); if (t.snow > 0.5) return; }
      if ((t.leaves || 0) > 0.12) { const n = Math.floor(t.leaves * 9); for (let k = 0; k < n; k++) { const [sx, sy] = iso(i + ((k * 41 + i * 17 + j * 5) % 10) / 10, j + ((k * 29 + j * 13 + i * 7) % 10) / 10, 0.005); ell(sx, sy, 2.6, 1.4, ['#C2632B', '#D98F2B', '#8A5A3B', '#B5482A'][(k + i + j) % 4], null, k); } }
      if (t.len > 0.3) { const n = Math.floor(t.len * 8), hgt = 3 + t.len * 10, bc = shade(col.startsWith('rgb') ? '#4E8A3A' : col, -0.1); ctx.strokeStyle = t.water < 0.3 ? 'rgba(140,120,60,.8)' : 'rgba(58,110,44,.85)'; ctx.lineWidth = 1; ctx.beginPath(); for (let k = 0; k < n; k++) { const px = i + ((k * 37 + i * 13 + j * 7) % 10) / 10, py = j + ((k * 53 + j * 11 + i * 3) % 10) / 10, [sx, sy] = iso(px, py, 0), sw = Math.sin(animT * 1.5 + px * 2 + py) * 1.5; ctx.moveTo(sx - 1.5, sy); ctx.lineTo(sx + sw - 0.5, sy - hgt); ctx.moveTo(sx + 1.5, sy); ctx.lineTo(sx + sw + 1.5, sy - hgt * 0.8); } ctx.stroke(); }
      if (t.weed > 0.35) { const px = i + 0.3 + t.seed * 0.4, py = j + 0.3 + ((t.seed * 7) % 1) * 0.4, [sx, sy] = iso(px, py, 0); ell(sx - 3, sy - 1, 4, 1.6, '#4F7A36', null, -0.4); ell(sx + 3, sy - 1, 4, 1.6, '#4F7A36', null, 0.4); limb(sx, sy, sx, sy - 6 - t.weed * 6, '#5A8A40', 1); if (t.weed > 0.85 && t.seed > 0.7) circle(sx, sy - 7 - t.weed * 6, 3.2, 'rgba(250,250,245,.9)'); else circle(sx, sy - 7 - t.weed * 6, 2.6, '#F2C230'); }
    });
    { const vw = viewW(), vd = viewD(); polyV([[0, vd, 0], [vw, vd, 0], [vw, vd, -0.25], [0, vd, -0.25]], '#6B4A35'); polyV([[vw, 0, 0], [vw, vd, 0], [vw, vd, -0.25], [vw, 0, -0.25]], '#5A3E2E'); }
  }
  function drawYardBack() {
    const back = BACK[VR], sid = '#D9CDBD';
    if (back.includes('L')) {
      poly([[0, 0, 0], [0, WY, 0], [0, WY, WH], [0, 0, WH]], shade(sid, -0.05));
      for (let z = 0.22; z < WH; z += 0.22) line3([0, 0, z], [0, WY, z], 'rgba(0,0,0,.09)', 1);
      poly([[0, 0, 0], [0, WY, 0], [0, WY, 0.3], [0, 0, 0.3]], '#8C8884');
      LEVELS[3].feats.forEach(f => { if (f.k === 'extwin') { const col = extWindowColor(1); poly(featPoly(f), '#F7F3EE', EDGE, 0.8); poly(featPoly(f, 0.07), col); const mu = (f.u[0] + f.u[1]) / 2; line3([0, mu, f.z[0] + 0.07], [0, mu, f.z[1] - 0.07], '#F7F3EE', 2); } else drawFeature(3, f); });
      poly([[-0.3, -0.3, WH], [0.12, -0.3, WH], [0.12, WY, WH], [-0.3, WY, WH]], '#5A4A44');
    }
    back.filter(pl => pl !== 'L').forEach(pl => { const len = planeLen(pl); for (let u = 0; u <= len + 0.01; u += 0.2) poly([wallPoint(pl, u, 0), wallPoint(pl, u + 0.13, 0), wallPoint(pl, u + 0.13, 1.15), wallPoint(pl, u + 0.065, 1.25), wallPoint(pl, u, 1.15)], '#EFE6D8', 'rgba(0,0,0,.12)', 0.6); [0.3, 0.85].forEach(z => poly([wallPoint(pl, 0, z), wallPoint(pl, len, z), wallPoint(pl, len, z + 0.08), wallPoint(pl, 0, z + 0.08)], '#DCD2C2')); });
    drawWallLights(3);
  }
  function drawRain() { if (!raining()) return; if (seasonIdx() === 3) { ctx.save(); for (let k = 0; k < 80; k++) { const x = ((k * 97.3 + Math.sin(animT + k) * 20 + animT * 8) % W + W) % W, y = ((k * 53.7 + animT * 30) % H); circle(x, y, 1.2 + (k % 3) * 0.5, 'rgba(255,255,255,.85)'); } ctx.restore(); return; } ctx.save(); ctx.strokeStyle = 'rgba(200,215,235,.55)'; ctx.lineWidth = 1; ctx.beginPath(); for (let k = 0; k < 90; k++) { const x = ((k * 97.3 + animT * 40) % W), y = ((k * 53.7 + animT * 420) % H); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 10); } ctx.stroke(); ctx.restore(); }

  const video = { id: null, screen: null, theater: false, loaded: false };

  function screenQuad() { if (video.screen === 'proj') return { level: 0, u: [6.0, 8.0], z: [0.8, 1.9] }; const big = has('bigtv'); return { level: 1, u: big ? [6.02, 7.58] : [6.16, 7.44], z: big ? [0.78, 1.84] : [0.88, 1.62] }; }

  function drawProjector(level) {
    if (level !== 0 || !has('projector')) return;
    const playing = video.id && video.screen === 'proj' && doing(jordan, 'movie'), [px, py] = iso(7.0, 3.4, 2.3);
    limb(px, py - 4, px, py - 16, '#3A3340', 1.5); rr(px - 9, py - 5, 18, 9, 2, '#2B2B30'); circle(px - 5, py + 1, 2.6, playing ? '#DCEBFF' : '#4A4450');
    if (playing) { const a = iso(6.0, 0.01, 1.9), b = iso(8.0, 0.01, 1.9), c = iso(8.0, 0.01, 0.8), d = iso(6.0, 0.01, 0.8); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(190,210,255,.07)'; ctx.beginPath(); ctx.moveTo(px - 5, py + 1); ctx.lineTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fill(); ctx.restore(); }
  }

  const BOX_LABEL = { flowervase: 'VASE', succulents: 'PLANTS', desklamp: 'LAMP', photoframes: 'PHOTOS', tablelamp: 'LAMP', candelabra: 'CANDLES', blanketladder: 'LADDER', plantstand: 'PLANT', woodstool: 'STOOL', candles: 'CANDLES', basket: 'BASKET', floormirror: 'MIRROR', coatrack: 'COAT RACK', bookstack: 'BOOKS', eucalyptus: 'VASE', bust: 'BUST', umbrella: 'UMBRELLAS', coffeetable: 'TABLE', sidetable: 'TABLE', bookshelf: 'SHELF', armchair: 'CHAIR', rugrect: 'RUG', sofa: 'COUCH', lamp: 'LAMP', plant: 'PLANT', bed: 'BED', fridge: 'FRIDGE', dining: 'TABLE', desk: 'DESK', dresser: 'DRESSER', nightstand: 'NIGHTSTAND', tread: 'TREADMILL', gym: 'WEIGHTS', bench: 'BENCH', boxes: 'MISC', rug: 'RUG' };

  // Just-placed furniture lands with a squash and a little bounce.
  // Three ways a piece arrives: it lands with a squash (set down), pops out of its box (revealed) or drops from above (delivered).
  const placedAt = new Map();
  const ARRIVAL = { land: 0.5, pop: 0.6, drop: 0.7 };
  function bouncy(o, draw) {
    const a = placedAt.get(o.id);
    if (a == null) return draw;
    const dur = ARRIVAL[a.kind], u = (animT - a.t) / dur;
    if (u < 0 || u >= 1) { if (u >= 1) placedAt.delete(o.id); return draw; }
    return () => {
      const T = T_OF(o), [cx, cy] = xf(o, T.W / 2, T.D / 2), [bx, by] = iso(cx, cy, 0);
      ctx.save();
      if (a.kind === 'land') {
        const b = Math.sin(u * Math.PI * 2.5) * (1 - u);
        ctx.translate(bx, by); ctx.scale(1 + b * 0.07, 1 - b * 0.1); ctx.translate(-bx, -by);
      } else if (a.kind === 'pop') {
        // Springs up out of the box: small, overshoots, settles.
        const e = 1 - Math.pow(1 - Math.min(1, u * 1.5), 3), s = 0.25 + 0.75 * e + Math.sin(Math.min(1, u * 1.4) * Math.PI) * 0.14;
        ctx.globalAlpha = Math.min(1, u * 5); ctx.translate(bx, by); ctx.scale(s, s * (1 + (1 - e) * 0.25)); ctx.translate(-bx, -by);
      } else {
        // Falls from above, hits the floor and squashes once.
        const f = 0.62;
        if (u < f) { const k = u / f; ctx.translate(0, -52 * (1 - k * k)); ctx.globalAlpha = Math.min(1, u * 8); }
        else { const k = (u - f) / (1 - f), sq = Math.sin(k * Math.PI) * (1 - k) * 0.9; ctx.translate(bx, by); ctx.scale(1 + sq * 0.12, 1 - sq * 0.16); ctx.translate(-bx, -by); }
      }
      draw();
      ctx.restore();
    };
  }
  function arrive(id, kind) { if (OBJS.some(x => x.id === id)) placedAt.set(id, { t: animT, kind }); }
  function objectPlaced(id) {
    const o = OBJS.find(x => x.id === id);
    if (!o) return;
    placedAt.set(id, { t: animT, kind: 'land' });
    const T = T_OF(o);
    // A puff of dust where it lands.
    for (let i = 0; i < 4; i++) {
      const [x, y] = xf(o, T.W * (0.2 + 0.2 * i), i % 2 ? 0.05 : T.D - 0.05);
      PFX.burst('dust', o.level, x, y, 0.02, 4);
    }
  }

  function objItems(o, items, t) {
    const parts = T_OF(o).parts(o), T = makeT(o);
    let maxSit = 0;
    if (T_OF(o).spots) Object.keys(T_OF(o).spots).forEach(sn => { const s = SLOTS[o.id + ':' + sn]; if (s && s.sitKey) maxSit = Math.max(maxSit, s.sitKey); });
    parts.forEach(p => {
      if (p.decal) return;
      const r = p.box ? [p.box[0], p.box[1], p.box[0] + p.box[3], p.box[1] + p.box[4]] : p.rect, w = xrect(o, r);
      let key = vs((w[0] + w[2]) / 2, (w[1] + w[3]) / 2) + (p.onTop ? 0.002 : 0) + (p.box ? p.box[2] * 0.001 : 0) + (o.on ? 0.4 + o.z * 0.01 : 0);
      let rect = w;
      if (p.cover) { key = maxSit + 0.05; rect = xrect(o, [0, 0, T_OF(o).W, T_OF(o).D]); }
      const draw = p.box ? () => T.box(p.box[0], p.box[1], p.box[2], p.box[3], p.box[4], p.box[5], typeof p.c === 'function' ? p.c(o) : p.c) : () => { if (gOn) G.billboard(iso((w[0] + w[2]) / 2, (w[1] + w[3]) / 2, 0)[1], ZH, MATERIAL.matte); p.fn(T, o, t); if (gOn) G.clearBase(); };
      items.push({ x1: rect[0], y1: rect[1], x2: rect[2], y2: rect[3], key, d: bouncy(o, draw) });
    });
  }
  function decals(level, t) { OBJS.forEach(o => { if (o.level !== level) return; const T = makeT(o); T_OF(o).parts(o).forEach(p => { if (p.decal) p.fn(T, o, t); }); }); }
  function wallItems(level, items) {
    const c = wallTone(level), top = shade(c, -0.3), side = c.startsWith('#') ? c : '#E9DCCB';
    LEVELS[level].walls.forEach(w => {
      const vertical = w.x !== undefined;
      for (let s = w.a; s < w.b - 0.001; s += 0.5) {
        const e = Math.min(w.b, s + 0.5);
        const r = vertical ? [w.x - 0.06, s, w.x + 0.06, e] : [s, w.y - 0.06, e, w.y + 0.06];
        items.push({ x1: r[0], y1: r[1], x2: r[2], y2: r[3], key: (r[0] + r[2]) / 2 + (r[1] + r[3]) / 2, d: () => { const sc = wallTone(level, wallSideRoom(level, r, vertical)); box(r[0], r[1], 0, r[2] - r[0], r[3] - r[1], IW, sc.startsWith('#') ? sc : side); poly([[r[0], r[1], IW + 0.001], [r[2], r[1], IW + 0.001], [r[2], r[3], IW + 0.001], [r[0], r[3], IW + 0.001]], top); } });
      }
    });
  }

  function depthSort(items) {
    const n = items.length, visited = new Uint8Array(n), out = [];
    const VRc = items.map(it => vrect(it.x1, it.y1, it.x2, it.y2));
    const before = (a, b) => {
      const A = VRc[a], Bb = VRc[b];
      const ab = A[2] <= Bb[0] + 1e-3 || A[3] <= Bb[1] + 1e-3, ba = Bb[2] <= A[0] + 1e-3 || Bb[3] <= A[1] + 1e-3;
      if (ab && !ba) return true; if (ba && !ab) return false;
      return items[a].key < items[b].key;
    };
    const idx = [...Array(n).keys()].sort((a, b) => items[a].key - items[b].key);
    function visit(i) { if (visited[i]) return; visited[i] = 1; for (const j of idx) if (j !== i && !visited[j] && before(j, i)) visit(j); out.push(items[i]); }
    idx.forEach(visit);
    return out;
  }
  function gpuLighting(level, lights, a) {
    const gpu = tier() !== 'low' && opts.gpuLights && opts.gpuLights();
    if (!gpu) return false;
    const frame = {
      width: W, height: H, scale: cv.width / W, alpha: a, glow: Math.min(1, a / 0.35), t: animT,
      dark: level === 0 ? [8, 14, 30] : [16, 13, 46],
      lights: lights.map(l => { const [sx, sy] = iso(...l.src), [px, py] = iso(...l.pool); return { sx, sy, px, py, r: l.r, s: l.s, col: l.col }; }),
    };
    const darkCv = gpu.render(frame, 'dark');
    if (!darkCv) return false;
    ctx.drawImage(darkCv, 0, 0, W, H);
    const glowCv = gpu.render({ ...frame, lights: frame.lights.filter((_, i) => lights[i].vis) }, 'glow');
    if (glowCv) { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glowCv, 0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
    return true;
  }
  function deferredLighting(level, lights) {
    const R = opts.deferredLights && opts.deferredLights();
    if (!R || !G) return false;
    const dk = darkness(), si = seasonIdx(), rain = raining() ? 1 : 0, a = levelDark(level), h = hour();
    const sun = sunLight(h, si, rain, 1 - dk), [sa, sb] = VD(sun.dir[0], sun.dir[1]);
    const windows = [];
    LEVELS[level].feats.forEach(f => {
      if ((f.k !== 'window' && f.k !== 'highwin') || !BACK[VR].includes(f.p)) return;
      const p0 = wallPoint(f.p, f.u[0], 0), p1 = wallPoint(f.p, f.u[1], 0), [a0, b0] = V(p0[0], p0[1]), [a1, b1] = V(p1[0], p1[1]);
      windows.push(Math.abs(a0) < 1e-3 && Math.abs(a1) < 1e-3 ? { axis: 0, u0: b0, u1: b1, z0: f.z[0], z1: f.z[1] } : { axis: 1, u0: a0, u1: a1, z0: f.z[0], z1: f.z[1] });
    });
    const frame = {
      view: [W, H], origin: [OX, OY], iso: [TW, TH, ZH],
      darkA: a, night: level === 0 ? [0.14, 0.19, 0.34] : isOutdoor(level) ? [0.17, 0.2, 0.4] : [0.2, 0.18, 0.42], outdoor: isOutdoor(level), glow: Math.min(1, a / 0.35),
      sunDir: [sa, sb, sun.dir[2]], sunCol: sun.col, sky: rgb(skyColor()).map(v => v / 255), daylight: 1 - dk, rain,
      grade: gradeTint(h, si), t: animT, quality: tier() === 'high' ? 'high' : 'medium', windows,
      lights: lights.map(l => { const [la, lb] = V(l.src[0], l.src[1]), [sx, sy] = iso(...l.src); return { a: la, b: lb, z: l.src[2], range: l.r / 30, s: l.s, col: l.col, sx, sy, glow: l.r, vis: l.vis }; }),
    };
    const mul = R.render(frame, G.canvas, 'mul');
    if (!mul) return false;
    ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(mul, 0, 0, W, H);
    const add = R.render(frame, G.canvas, 'add');
    if (add) { ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(add, 0, 0, W, H); }
    ctx.globalCompositeOperation = 'source-over';
    return true;
  }
  function lighting(level, lights, deferred) {
    const a = levelDark(level);
    ctx.save(); roomPath(); ctx.clip();
    const litOnGpu = deferred && deferredLighting(level, lights);
    if (!litOnGpu && a > 0.01 && !gpuLighting(level, lights, a)) {
      if (lightCv.width !== cv.width || lightCv.height !== cv.height) { lightCv.width = cv.width; lightCv.height = cv.height; }
      const dpr = cv.width / W;
      lctx.setTransform(dpr, 0, 0, dpr, 0, 0); lctx.globalCompositeOperation = 'source-over'; lctx.clearRect(0, 0, W, H);
      lctx.fillStyle = level === 0 ? `rgba(8,14,30,${a})` : `rgba(16,13,46,${a})`; lctx.fillRect(0, 0, W, H);
      lctx.globalCompositeOperation = 'destination-out';
      lights.forEach(l => {
        const [sx, sy] = iso(...l.src), [px, py] = iso(...l.pool);
        let g = lctx.createRadialGradient(sx, sy, 2, sx, sy, l.r * 0.5); g.addColorStop(0, `rgba(0,0,0,${0.92 * l.s})`); g.addColorStop(1, 'rgba(0,0,0,0)'); lctx.fillStyle = g; lctx.fillRect(0, 0, W, H);
        lctx.save(); lctx.translate(px, py); lctx.scale(1, 0.52); g = lctx.createRadialGradient(0, 0, 4, 0, 0, l.r); g.addColorStop(0, `rgba(0,0,0,${0.85 * l.s})`); g.addColorStop(0.55, `rgba(0,0,0,${0.45 * l.s})`); g.addColorStop(1, 'rgba(0,0,0,0)'); lctx.fillStyle = g; lctx.fillRect(-W, -H * 2, W * 2, H * 4); lctx.restore();
      });
      ctx.drawImage(lightCv, 0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      lights.forEach(l => { if (!l.vis) return; const [sx, sy] = iso(...l.src), col = l.col || '255,190,120', g = ctx.createRadialGradient(sx, sy, 1, sx, sy, l.r * 0.55); g.addColorStop(0, `rgba(${col},${0.3 * l.s * Math.min(1, a / 0.35)})`); g.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); });
      ctx.globalCompositeOperation = 'source-over';
    }
    if (level === 0) {
      ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = 'rgba(128,128,128,0.25)'; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = 'rgba(70,110,170,0.2)'; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
      drawMotes(lights);
    }
    if (level === 1 && tvF > 0.02) { ctx.globalCompositeOperation = 'lighter'; const [tx, ty] = iso(6.8, 0.3, 1.25), hue = (animT * 25) % 360, g = ctx.createRadialGradient(tx, ty, 6, tx, ty, has('bigtv') ? 190 : 150); g.addColorStop(0, `hsla(${hue},70%,65%,${(0.12 + a * 0.5) * tvF})`); g.addColorStop(1, 'hsla(0,0%,0%,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
    if (level === 1 && partyF > 0.02) {
      const t = animT, [rx1, ry1, rx2, ry2] = LEVELS[1].rug, cx = (rx1 + rx2) / 2, cy = (ry1 + ry2) / 2;
      ctx.fillStyle = `rgba(18,8,40,${0.45 * partyF})`; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) { const ang = t * 0.9 + i * 1.05, [sx, sy] = iso(cx + Math.cos(ang) * 1.7, cy + Math.sin(ang * 1.3) * 1.3, 0), hue = (t * 70 + i * 60) % 360, g = ctx.createRadialGradient(sx, sy, 2, sx, sy, 55); g.addColorStop(0, `hsla(${hue},95%,60%,${0.45 * partyF})`); g.addColorStop(1, 'hsla(0,0%,0%,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      for (let i = 0; i < 4; i++) { const u = (t * 0.25 + i / 4) % 1, [wx, wy] = iso(5 + u * 4.8, 0, 1.6 + Math.cos(t * 2 + i) * 0.4), hue = (t * 90 + i * 90) % 360, g = ctx.createRadialGradient(wx, wy, 1, wx, wy, 26); g.addColorStop(0, `hsla(${hue},95%,65%,${0.5 * partyF})`); g.addColorStop(1, 'hsla(0,0%,0%,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      ctx.globalCompositeOperation = 'source-over';
      const [bx, by] = iso(cx, cy, 2.75), [cx2, cy2] = iso(cx, cy, 3.4);
      ctx.globalAlpha = partyF; limb(cx2, cy2, bx, by - 6, 'rgba(200,200,210,.6)', 1); circle(bx, by, 7, '#C9CED6');
      for (let i = 0; i < 6; i++) { const a2 = t * 2 + i; circle(bx + Math.cos(a2) * 4, by + Math.sin(a2 * 1.3) * 4, 1.2, `hsl(${(i * 60 + t * 100) % 360},90%,75%)`); }
      ctx.globalAlpha = 1;
    }
    if (tier() !== 'low' && a > 0.01) {
      ctx.globalCompositeOperation = 'lighter';
      lights.forEach(l => { if (!l.vis) return; const [sx, sy] = iso(...l.src), col = l.col || '255,190,120', s = l.s * Math.min(1, a / 0.35), g = ctx.createRadialGradient(sx, sy, 1, sx, sy, l.r * 1.5); g.addColorStop(0, `rgba(${col},${0.12 * s})`); g.addColorStop(0.4, `rgba(${col},${0.05 * s})`); g.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); });
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  function sync(s) {
    minutes = s.minutes; day = s.day; viewLevel = s.level; animT = s.t; rdt = s.dt;
    dimNow += (dimTarget - dimNow) * Math.min(1, rdt * 1.6);
    wallMode = s.wallMode || 'cut';
    OBJS = s.objs;
    if (s.rot !== VR) { VR = s.rot; setOrigin(); }
    // Who's doing what, where: the stove steams while someone cooks, the
    // washer spins during laundry, the shower runs while they shower.
    const who = (c, name) => c ? { name, away: !!c.hidden && false, level: c.level, x: c.x, y: c.y,
      task: c.act ? { name: c.act, phase: 'do', slot: c.slot || null } : null, queue: [], needs: {} } : offstage();
    if (s.chars) { jordan = who(s.chars[0], 'Jordan'); maya = who(s.chars[1], 'Maya'); }
    // Arrange mode: walls come down, and the overlay below shows what can move.
    arrState = s.arrange || null;
    arranging = !!arrState;
  }

  function applySave(s) {
    if (!s || typeof s !== 'object') return;
    if (s.flags && typeof s.flags === 'object') flags = s.flags;
    if (Array.isArray(s.owned)) { owned = new Set(s.owned); }
    if (Array.isArray(s.LOOKS)) s.LOOKS.forEach((lk, i) => { if (LOOKS[i] && lk) Object.assign(LOOKS[i], lk); });
    if (Array.isArray(s.ROOMLOOK)) ROOMLOOK.forEach((r, i) => { Object.keys(r).forEach(k => delete r[k]); Object.assign(r, s.ROOMLOOK[i] || {}); });
    WALLOBJS.length = 0; (s.WALLOBJS || []).forEach(w => { if (w && WTYPES[w.type]) WALLOBJS.push(w); });
    if (s.yard && Array.isArray(s.yard.t)) { s.yard.t.forEach((a, k) => { const t = YARD.tiles[k]; if (t && Array.isArray(a)) [t.len, t.water, t.weed, t.burn, t.mowedAt] = a; }); YARD.rainAt = s.yard.rainAt || 0; YARD.rainUntil = s.yard.rainUntil || 0; YARD.rainCheck = s.yard.rainCheck ?? -1; }
    if (typeof s.dishes === 'number') dishes = s.dishes;
    if (typeof s.power === 'boolean') power = s.power;
    if (typeof s.laundryPile === 'number') laundryPile = s.laundryPile;
    if (s.fridge && typeof s.fridge === 'object') fridge = s.fridge;
    if (s.wallMode) wallMode = s.wallMode;
  }

  function blinkAmt(t, seed) {
    const cyc = 3.8 + (seed % 1) * 2.4, u = (t + seed * 1.7) % cyc;
    const b = x => x >= 0 && x < 0.14 ? Math.sin(x / 0.14 * Math.PI) : 0;
    return Math.max(b(u), Math.floor(seed * 7) % 3 === 0 ? b(u - 0.34) : 0);
  }

  const walkStates = new Map();
  // A pet's stride, like a person's: the phase comes from the ground covered, so planted feet hold the floor.
  const petWalks = new Map();
  function petWalkState(p) {
    let ws = petWalks.get(p.id);
    if (!ws) { ws = { px: p.x, py: p.y, ph: p.seed * 7, amp: 0 }; petWalks.set(p.id, ws); }
    const q = QUAD[p.kind] || QUAD.dog, dd = Math.hypot(p.x - ws.px, p.y - ws.py), moving = p.pose === 'walk' || p.pose === 'run';
    if (moving && dd < 0.6) ws.ph += dd / (2 * q.reach) * Math.PI;
    ws.amp += ((moving ? 1 : 0) - ws.amp) * Math.min(1, (rdt || 0.016) * 8);
    ws.px = p.x; ws.py = p.y;
    return ws;
  }
  const poseStates = new Map();

  function poseState(c) {
    let ps = poseStates.get(c.seed);
    if (!ps) { ps = { a: {} }; poseStates.set(c.seed, ps); }
    return ps;
  }

  function ease2(ps, side, tx, ty, dt, rate = 9) {
    const k = Math.min(1, dt * rate);
    let a = ps.a[side];
    if (!a) { a = ps.a[side] = [tx, ty]; }
    a[0] += (tx - a[0]) * k; a[1] += (ty - a[1]) * k;
    return a;
  }

  function walkState(c) {
    let ws = walkStates.get(c.seed);
    if (!ws) { ws = { px: c.x, py: c.y, ph: 0, amp: 0 }; walkStates.set(c.seed, ws); }
    const dd = Math.hypot(c.x - ws.px, c.y - ws.py);
    // Half a cycle per footfall: a stride on the floor, one tread on the stairs.
    if (c.walking && dd < 0.6) ws.ph += dd / (c.slope ? FL.RUN : GAIT.cycle / 2) * Math.PI;
    ws.amp += ((c.walking ? 1 : 0) - ws.amp) * Math.min(1, rdt * 7);
    ws.px = c.x; ws.py = c.y;
    return ws;
  }

  let talking = false, mood = 0.5;
  function setTalking(v) { talking = Boolean(v); }
  function setMood(v) { mood = Math.max(0, Math.min(1, Number(v) || 0)); }

  // Things in hand for an activity, drawn over the arms.
  const PROP_ZOOM = { spoon: 1.5, fork: 1.6, cup: 1.4, phone: 1.5, knife: 1.5, brush: 1.5, pen: 1.5, comb: 1.5, spatula: 1.4, apple: 1.3, rag: 1.3, can: 1.3, ball: 1.3, roller: 1.2 };
  function drawProps(rig, hand, c, t, hd, local, pass) {
    (rig.props || []).forEach(p => {
      // The guitar's body sits behind the hands that play it; everything else is held in front.
      if ((p.kind === 'guitar') !== (pass === 'back')) return;
      const h = hand[p.side || 1] || hand[1];
      // Hand-sized props are drawn small; scale them up around the hand so they read.
      const zoom = PROP_ZOOM[p.kind];
      if (zoom) { ctx.save(); ctx.translate(h[0], h[1]); ctx.scale(zoom, zoom); ctx.translate(-h[0], -h[1]); }
      switch (p.kind) {
        case 'spoon': limb(h[0], h[1], h[0] + 1.5, h[1] + 7, '#8A5A3B', 1.6); break;
        case 'fork':
          limb(h[0], h[1], h[0] + 0.5, h[1] - 6, '#C9CED6', 1.2);
          if (p.food) circle(h[0] + 0.5, h[1] - 7, 1.5, '#C2703D');
          break;
        case 'cup':
          rr(h[0] - 2.5, h[1] - 4, 5, 6, 1.2, '#F4EFE6'); limb(h[0] + 2.5, h[1] - 2.5, h[0] + 4, h[1] - 1, '#F4EFE6', 1.2);
          if (p.steam) for (let k = 0; k < 2; k++) { const u = (t * 0.9 + k * 0.5) % 1; ctx.globalAlpha = 0.55 * (1 - u); limb(h[0] - 1 + k * 2 + Math.sin(u * 6 + k) * 0.8, h[1] - 5 - u * 6, h[0] - 1 + k * 2 + Math.sin(u * 6 + k + 1) * 0.8, h[1] - 7 - u * 6, '#FFFFFF', 0.9); ctx.globalAlpha = 1; }
          break;
        case 'phone': rr(h[0] - 1.6, h[1] - 3.5, 3.2, 6, 0.8, '#1E1B2E'); if (p.scroll != null) limb(h[0] - 0.6, h[1] - 2.6 + p.scroll * 4, h[0] + 0.6, h[1] - 2.6 + p.scroll * 4, '#7FB2FF', 0.8); break;
        case 'dumbbell': limb(h[0] - 4, h[1], h[0] + 4, h[1], '#3B3F4A', 1.8); circle(h[0] - 4, h[1], 2.2, '#2A2D35'); circle(h[0] + 4, h[1], 2.2, '#2A2D35'); break;
        case 'brush': limb(h[0], h[1], h[0] + 2, h[1] - 6, '#8A5A3B', 1.2); circle(h[0] + 2, h[1] - 6, 1.1, '#E48AAE'); break;
        case 'palette': ell(h[0], h[1] - 1, 5, 3, '#D9B98C'); circle(h[0] - 2, h[1] - 2, 0.9, '#E5484D'); circle(h[0] + 1, h[1] - 2.5, 0.9, '#3B82F6'); circle(h[0] + 2.5, h[1] - 0.5, 0.9, '#22C55E'); break;
        case 'knife': limb(h[0], h[1], h[0] + 1, h[1] + 6, '#C9CED6', 1.4); limb(h[0], h[1], h[0] - 0.5, h[1] - 2, '#3B2A20', 2); break;
        case 'plate': { const a = hand[-1] || h, b = hand[1] || h; ell((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 1, 7, 2.6, '#F4EFE6'); ell((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 2, 3.5, 1.4, '#C2703D'); break; }
        case 'spatula': { const tip = [h[0] + 3, h[1] + 5 - (p.flip || 0) * 4]; limb(h[0], h[1], tip[0], tip[1], '#3B2A20', 1.4); rr(tip[0] - 2, tip[1] - 1, 4, 2.5, 0.5, '#C9CED6'); if (p.flip > 0.3) ell(tip[0], tip[1] - 5 * p.flip, 2.6, 1.2, '#8B4A2B'); break; }
        case 'guitar': { const body = local([0.16, -0.02, -0.3], 1), neck = local([0.24, 0.26, -0.1], -1); limb(body[0], body[1], neck[0], neck[1], '#5A3A22', 2.6); ell(body[0], body[1], 7.5, 5.5, '#B5651D'); ell(body[0] + 1.6, body[1] - 0.8, 3, 2, 'rgba(255,255,255,.14)'); circle(body[0], body[1], 1.9, '#2A1A10'); break; }
        case 'gloves': [-1, 1].forEach(sd => { const g = hand[sd]; if (g) { circle(g[0], g[1], 3.5, '#D7263D'); ell(g[0] - 0.8, g[1] - 1.2, 1.3, 0.8, 'rgba(255,255,255,.35)'); } }); break;
        case 'parcel': { const a = hand[-1] || h, b = hand[1] || h; rr((a[0] + b[0]) / 2 - 5, (a[1] + b[1]) / 2 - 7, 10, 7, 1, '#C79A5B'); limb((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 7, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, '#E8D2A6', 1); break; }
        case 'cloth': { const a = hand[-1] || h, b = hand[1] || h; ctx.fillStyle = '#9EC5E8'; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(b[0], b[1] + 4 + (p.open || 0) * 4); ctx.lineTo(a[0], a[1] + 4 + (p.open || 0) * 4); ctx.fill(); break; }
        case 'ball': circle(h[0] + 3, h[1] - 6, 2.4, '#E5484D'); break;
        case 'paper': {
          // A broadsheet held open in both hands; a page lifts when they turn it.
          const a = hand[-1] || h, b = hand[1] || h, mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
          rr(mx - 12, my - 10, 24, 12, 0.6, '#ECE8DF');
          ctx.fillStyle = 'rgba(60,60,70,.35)'; for (let k = 0; k < 4; k++) ctx.fillRect(mx - 10 + (k % 2) * 11, my - 8 + Math.floor(k / 2) * 5, 9, 1.2);
          ctx.fillStyle = 'rgba(60,60,70,.6)'; ctx.fillRect(mx - 10, my - 9.5, 20, 1.6);
          if (p.flip > 0.05) { ctx.fillStyle = '#F6F3EC'; ctx.beginPath(); ctx.moveTo(mx, my - 10); ctx.lineTo(mx + 12 * (1 - p.flip * 2), my - 10 - p.flip * 4); ctx.lineTo(mx + 12 * (1 - p.flip * 2), my + 2 - p.flip * 4); ctx.lineTo(mx, my + 2); ctx.fill(); }
          break;
        }
        case 'rake': {
          const a = hand[-1] || h, end = local([0.75 - (p.pull || 0) * 0.25, 0, -1.04], 1);
          limb(a[0], a[1], end[0], end[1], '#B08A5A', 1.6);
          limb(end[0] - 6, end[1], end[0] + 6, end[1], '#6B6F7A', 1.6);
          for (let k = -5; k <= 5; k += 2.5) limb(end[0] + k, end[1], end[0] + k, end[1] + 3, '#6B6F7A', 0.9);
          // Leaves gathering in front of the rake.
          for (let k = 0; k < 5; k++) circle(end[0] - 4 + k * 2.2, end[1] + 4 + (k % 2), 1.6, ['#D98F2B', '#C2632B', '#B5482A'][k % 3]);
          break;
        }
        case 'apple': circle(h[0] + 1, h[1] - 3, 2.6, '#D2393E'); limb(h[0] + 1, h[1] - 5.6, h[0] + 1.6, h[1] - 7.2, '#5A3E2E', 0.8); break;
        case 'rag': rr(h[0] - 3, h[1] - 1, 6, 3.5, 1, '#7FB2D9'); break;
        case 'pen': limb(h[0], h[1], h[0] + 1.5, h[1] - 6, '#2E3B57', 1.1); break;
        case 'comb': rr(h[0] - 0.8, h[1] - 6, 1.6, 7, 0.6, '#E48AAE'); break;
        case 'rope': {
          // The rope's loop, swinging over the head and under the feet.
          const a = hand[-1] || h, b = hand[1] || h, mx = (a[0] + b[0]) / 2, s = Math.sin(p.turn || 0);
          ctx.strokeStyle = '#E0A43A'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(a[0], a[1]);
          ctx.quadraticCurveTo(mx, a[1] - s * 46 + 14, b[0], b[1]); ctx.stroke();
          break;
        }
        case 'book': {
          const a = hand[-1] || h, b = hand[1] || h, mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
          rr(mx - 7, my - 6, 14, 8, 1, c.seed % 1 > 0.5 ? '#7A3B5C' : '#2F5D7C');
          rr(mx - 6, my - 5, 12, 6, 0.5, '#F4EFE6');
          if (p.flip > 0.05) { ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.moveTo(mx, my - 5); ctx.lineTo(mx + 6 * (1 - p.flip * 2), my - 5 - p.flip * 3); ctx.lineTo(mx + 6 * (1 - p.flip * 2), my + 1 - p.flip * 3); ctx.lineTo(mx, my + 1); ctx.fill(); }
          break;
        }
        case 'can': {
          rr(h[0] - 1, h[1] - 3, 7, 5, 1.5, '#3FA36B');
          const spout = local([0.5, 0.06, -0.2], 1);
          limb(h[0] + 5, h[1] - 2, spout[0], spout[1], '#3FA36B', 1.4);
          for (let i = 0; i < 3; i++) { const u = (t * 2.2 + i / 3) % 1; circle(spout[0] + 1, spout[1] + u * 14, 0.9, `rgba(140,200,255,${1 - u})`); }
          break;
        }
        case 'mop': {
          const a = hand[-1] || h, end = local([0.6, (p.sweep || 0) * 0.3, -1.04], 1);
          limb(a[0], a[1], end[0], end[1], "#B08A5A", 2);
          ell(end[0], end[1], 8, 3, '#C9CED6');
          break;
        }
        case 'roller': {
          const top = [h[0] + 1, h[1] - 12];
          limb(h[0], h[1], top[0], top[1], '#6B6F7A', 1.4);
          rr(top[0] - 5, top[1] - 3, 10, 4, 1.5, LOOKS[viewLevel]?.paint || '#E48AAE');
          break;
        }
        case 'water':
          for (let i = 0; i < 7; i++) {
            const u = (t * 1.6 + i / 7) % 1, x = hd[0] + (i - 3) * 2.6, y = hd[1] - 26 + u * 34;
            limb(x, y, x, y + 4, `rgba(170,210,255,${0.7 * (1 - u)})`, 1);
          }
          break;
        case 'notes': {
          const u = (t * 0.5 + c.seed) % 1;
          ctx.globalAlpha = 1 - u; ctx.fillStyle = '#E48AAE'; ctx.font = '700 10px Inter, system-ui, sans-serif';
          ctx.fillText('♪', hd[0] + 8 + Math.sin(u * 6) * 3, hd[1] - 12 - u * 16); ctx.globalAlpha = 1;
          break;
        }
        case 'splash': {
          const base = local([0, 0, -0.3], 1), r = 11 + Math.sin(t * 4) * 1.5;
          ctx.strokeStyle = 'rgba(220,240,255,.7)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(base[0], base[1], r, r * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
          break;
        }
        default: break;
      }
      if (zoom) ctx.restore();
    });
  }

  /**
   * A damped spring that trails an anchor point: returns the offset (screen
   * px) of something hanging off it. Moving the anchor fast swings it the
   * other way, then it settles back.
   */
  function springAt(ps, key, ax, ay, drag, k, damp) {
    let s = ps[key];
    if (!s) { s = ps[key] = { px: ax, py: ay, ox: 0, oy: 0, vx: 0, vy: 0 }; }
    const dt = Math.min(0.05, Math.max(0.001, rdt || 0.016));
    const mvx = (ax - s.px) / dt, mvy = (ay - s.py) / dt;
    s.px = ax; s.py = ay;
    // A big jump (teleport, level change) shouldn't fling the hair.
    if (Math.abs(mvx) > 2000 || Math.abs(mvy) > 2000) { s.ox = s.oy = s.vx = s.vy = 0; return [0, 0]; }
    s.vx += (-mvx * drag * k - k * s.ox - damp * s.vx) * dt;
    s.vy += (-mvy * drag * k - k * s.oy - damp * s.vy) * dt;
    s.ox = Math.max(-5, Math.min(5, s.ox + s.vx * dt));
    s.oy = Math.max(-4, Math.min(4, s.oy + s.vy * dt));
    return [s.ox, s.oy];
  }

  // A person's real avatar head (state/headSprites.ts), drawn about twice the
  // old head's size so faces read: classic big-head cartoon proportions.
  const HEAD_W = 24;
  // Shoes follow the pants: white sneakers with jeans, brown boots with breeches, black boots with leather and uniforms.
  const SHOE_COLOR = { jeans: '#EDE8E0', baggy: '#EDE8E0', shorts: '#EDE8E0', cheer_skirt: '#F6F6F4', scrub_pants: '#F4F4F2', breeches: '#3A2A1C', leather: '#101013', cop_pants: '#17171B' };
  // The drawn head, for anyone without avatar head sprites (visitors, and a resident whose sprites
  // have not loaded yet). Built at the sprites' size and turned in three-quarters: `rt` is how far
  // right the head points (-1..1) and `fr` how far toward the camera, so the features slide across
  // the face as the head turns and the hair takes over as it turns away.
  function drawSimpleHead(cx, cy, R, o) {
    const L = o.L, skin = L.skin, hair = L.hair, fr = o.fr, rt = o.rt;
    const vis = Math.max(0, Math.min(1, (fr + 0.35) / 0.7)); // how much of the face shows
    const off = rt * R * 0.42; // the features lead the turn
    ctx.save(); ctx.translate(cx, cy); if (o.rot) ctx.rotate(o.rot);
    [-1, 1].forEach(sd => circle(sd * R * 0.92 - rt * R * 0.25, R * 0.08, R * 0.2, skin)); // ears, behind
    circle(0, 0, R, skin);
    if (L.longHair) [-1, 1].forEach(sd => ell(sd * R * 0.9 - rt * R * 0.2, R * 0.35, R * 0.3, R * 0.75, hair));
    // The hair cap: over the top from the front, most of the head from behind.
    const back = Math.max(0, -fr), sw = o.sway || 0;
    ell(-rt * R * 0.22 + sw * 0.3, -R * 0.45 + back * R * 0.35, R * 1.03, R * 0.62 + back * R * 0.45, hair);
    ell(-rt * R * 0.22 + sw * 0.3 - R * 0.3, -R * 0.8, R * 0.32, R * 0.12, shade(hair, 0.28), null, -0.3);
    if (vis > 0.01) {
      ctx.save(); ctx.globalAlpha *= vis;
      const eyeY = -R * 0.05 + (o.headDown ? R * 0.12 : 0) - (o.lookUp ? R * 0.1 : 0);
      const gap = R * 0.42 * (1 - Math.abs(rt) * 0.35), g = (o.gaze || 0) * 0.5;
      const a0 = ctx.globalAlpha;
      ctx.globalAlpha = a0 * 0.18; [-1, 1].forEach(sd => circle(off + sd * R * 0.6, R * 0.3, R * 0.22, '#E0607A')); ctx.globalAlpha = a0;
      // Eyes: whites, pupils that follow the gaze and the turn, lids that close for a blink and droop when tired.
      const lids = o.tired || o.yawn ? 0.5 : 1, open = Math.max(0, lids * (1 - (o.blink || 0)));
      const bi = o.expr === 'annoyed' ? R * 0.06 : o.expr === 'sad' ? -R * 0.07 : 0;
      [-1, 1].forEach(sd => {
        const ex = off + sd * gap, ry = R * 0.2 * open;
        if (open > 0.08) {
          ell(ex, eyeY, R * 0.17, ry, '#F6F3EE');
          ell(ex + g + rt * R * 0.05, eyeY + R * 0.01, R * 0.09, Math.min(ry, R * 0.1), '#241B25');
        } else { ctx.fillStyle = '#241B25'; ctx.fillRect(ex - R * 0.16, eyeY - 0.5, R * 0.32, 1); }
        // Brows: level by default, down at the inner end when annoyed, up when sad.
        ctx.strokeStyle = shade(hair, -0.3); ctx.lineWidth = 1; ctx.beginPath();
        ctx.moveTo(ex - sd * R * 0.2, eyeY - R * 0.3 - bi * 0.3); ctx.lineTo(ex + sd * R * 0.2, eyeY - R * 0.3 + bi); ctx.stroke();
      });
      circle(off + rt * R * 0.12, eyeY + R * 0.3, R * 0.08, shade(skin, -0.2)); // the nose leads the turn
      const mx = off * 0.9, my = R * 0.5;
      ctx.strokeStyle = '#4A2B2B'; ctx.lineWidth = 1.1;
      if (o.talk) ell(mx, my, R * 0.16, (0.5 + 0.5 * Math.sin((o.t || 0) * 13 + (o.seed || 0) * 7)) * R * 0.18 + R * 0.04, '#8C4A42');
      else if (o.yawn) ell(mx, my, R * 0.14, R * 0.2, '#5A2A2A');
      else if (o.smile) { ctx.beginPath(); ctx.arc(mx, my - R * 0.12, R * 0.22, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
      else if (o.sad) { ctx.beginPath(); ctx.arc(mx, my + R * 0.2, R * 0.18, 1.2 * Math.PI, 1.8 * Math.PI); ctx.stroke(); }
      else { ctx.beginPath(); ctx.moveTo(mx - R * 0.14, my); ctx.lineTo(mx + R * 0.14, my); ctx.stroke(); }
      ctx.restore();
    }
    ctx.restore();
  }
  function drawHeadImage(img, cx, chinY, w, mirror, rot) {
    const h = w * 1.04;
    ctx.save(); ctx.translate(cx, chinY);
    if (rot) ctx.rotate(rot);
    if (mirror) ctx.scale(-1, 1);
    ctx.drawImage(img, -w / 2, -h * (90 / 104), w, h);
    ctx.restore();
  }

  // How long one activity takes to melt into the next, in seconds.
  const CLIP_BLEND = 0.32;
  const smooth01 = (k) => k * k * (3 - 2 * k);

  // Smooths what the sim hands over as instant changes: the way someone faces swings round at a
  // human pace, a jump to or from a seat or bed slides instead of popping, and the body-level
  // parts of a clip (lean, bob, head nod) blend from the last clip into the new one.
  function settle(c) {
    const ps = poseState(c), dt = Math.max(0.001, Math.min(0.05, rdt || 0.016));
    const want = Math.atan2(c.face[1], c.face[0]);
    ps.want = want;
    if (!ps.init || ps.lv !== c.level) {
      Object.assign(ps, { init: true, lv: c.level, fa: want, spin: 0, tph: 0, ox: 0, oy: 0, oz: 0, lx: c.x, ly: c.y, lz: c.z, key: null });
    }
    // Facing: turn the short way at up to ~16 rad/s.
    let d = want - ps.fa; d = Math.atan2(Math.sin(d), Math.cos(d));
    const step = Math.max(-16 * dt, Math.min(16 * dt, d));
    ps.fa += step;
    ps.spin += (step / dt - ps.spin) * Math.min(1, dt * 14);
    ps.tph += Math.abs(ps.spin) * dt * 2.4;
    // Position: absorb a jump (to a seat, a bed, a spot at a stove) and ease it out.
    const jx = c.x - ps.lx, jy = c.y - ps.ly, jz = c.z - ps.lz;
    if (Math.hypot(jx, jy) > 0.5 && Math.hypot(jx, jy) < 4) { ps.ox -= jx; ps.oy -= jy; }
    if (Math.abs(jz) > 0.08 && Math.abs(jz) < 2) ps.oz -= jz;
    ps.lx = c.x; ps.ly = c.y; ps.lz = c.z;
    const k = Math.exp(-dt * 9);
    ps.ox *= k; ps.oy *= k; ps.oz *= k;
    ps.turn = Math.min(1, Math.abs(ps.spin) / 4);
    return { ...c, x: c.x + ps.ox, y: c.y + ps.oy, z: Math.max(0, c.z + ps.oz), face: [Math.cos(ps.fa), Math.sin(ps.fa)] };
  }

  // The body-level numbers of the current clip, blended from the clip before it for a moment after a change.
  function blendClip(c, rig, target) {
    const ps = poseState(c), dt = Math.max(0.001, Math.min(0.05, rdt || 0.016));
    const key = (c.walking ? 'walk' : c.pose) + '|' + (c.act || '') + '|' + (c.sit ? 1 : 0);
    if (ps.key == null) { ps.key = key; ps.k = 1; ps.cur = target; ps.last = rig; ps.prev = null; }
    else if (ps.key !== key) { ps.key = key; ps.k = 0; ps.from = ps.cur; ps.prev = ps.last; }
    ps.k = Math.min(1, ps.k + dt / CLIP_BLEND);
    const e = smooth01(ps.k);
    const out = {};
    for (const n in target) out[n] = ps.k >= 1 || !ps.from ? target[n] : ps.from[n] + (target[n] - ps.from[n]) * e;
    ps.cur = out; ps.last = rig;
    if (ps.k >= 1) ps.prev = null;
    return { v: out, e, active: ps.k < 1, prev: ps.prev };
  }

  // What a visitor carries in their arms, drawn over the front of the torso.
  function drawCarried(c) {
    // Whoever is carrying walks with a little bob.
    // The box rides at the hips, so it bobs with the stride instead of on its own clock.
    const ps = poseState(c), [fx, fy] = iso(c.x, c.y, 0), f = facing(c.face), x = fx + f.flip * 2, y = ps.hipY != null ? ps.hipY + 4 : fy - 17;
    const rect = (px, py, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(px, py, w, h); };
    ctx.save();
    switch (c.carrying) {
      case 'groceries':
        rect(x - 7, y - 8, 14, 15, '#C9A06A'); rect(x - 7, y - 8, 14, 2.5, '#B58A55'); rect(x - 4, y - 12, 3, 6, '#7FB069'); rect(x + 1, y - 11, 3, 5, '#D9593D');
        break;
      case 'parcel':
        rect(x - 8, y - 5, 16, 11, '#C9A06A'); rect(x - 8, y - 5, 16, 2, '#B58A55'); rect(x - 1, y - 5, 2, 11, '#F2EEE8');
        break;
      case 'paint':
        rect(x - 5, y - 6, 10, 12, '#B9BEC6'); rect(x - 5, y - 6, 10, 3, '#E0A43A'); rect(x - 6, y - 7, 12, 1.6, '#8E939B');
        break;
      default: // 'pbox' and anything else: a moving box
        rect(x - 9, y - 7, 18, 14, '#C9A06A'); rect(x - 9, y - 7, 18, 3, '#B58A55'); rect(x - 1.5, y - 7, 3, 14, '#E4D3B2');
    }
    ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = 0.8; ctx.strokeRect(x - 9, y - 7, 18, 14);
    ctx.restore();
  }
  // A visitor's name, small, above their head.
  function drawNameTag(c) {
    const [fx, fy] = iso(c.x, c.y, 0);
    ctx.save(); ctx.font = '600 8px Inter, system-ui, sans-serif'; ctx.textAlign = 'center';
    const w = ctx.measureText(c.name).width + 8;
    ctx.fillStyle = 'rgba(36,27,37,.72)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(fx - w / 2, fy - 64, w, 11, 5) : ctx.rect(fx - w / 2, fy - 64, w, 11); ctx.fill();
    ctx.fillStyle = '#F7F3EE'; ctx.fillText(c.name, fx, fy - 56);
    ctx.restore();
  }
  // A line said in passing, in a bubble that fades.
  // A "!" that pops over someone's head when they notice something, like a handheld RPG: it jumps up, settles and hops once.
  function drawAlert(c, age) {
    if (age < 0 || age > 1.6) return;
    const [fx, fy] = iso(c.x, c.y, 0);
    const pop = age < 0.14 ? (age / 0.14) * 1.4 : age < 0.28 ? 1.4 - 0.4 * ((age - 0.14) / 0.14) : 1;
    const hop = age > 0.45 && age < 0.7 ? Math.sin(((age - 0.45) / 0.25) * Math.PI) * 4 : 0;
    ctx.save(); ctx.globalAlpha = Math.min(1, (1.6 - age) * 4);
    ctx.translate(fx, fy - 68 - hop); ctx.scale(pop, pop);
    ctx.fillStyle = '#FFFDF8'; ctx.strokeStyle = '#241B25'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-8, -24, 16, 22, 5) : ctx.rect(-8, -24, 16, 22); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-3, -2); ctx.lineTo(0, 4); ctx.lineTo(3, -2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#E8384F'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-2, -20, 4, 11, 2) : ctx.rect(-2, -20, 4, 11); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -5, 2.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // Little hearts that float up from someone who is pleased.
  function drawHearts(c, age) {
    if (age < 0 || age > 2.2) return;
    const [fx, fy] = iso(c.x, c.y, 0);
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const a = age - i * 0.22; if (a < 0 || a > 1.6) continue;
      const rise = a * 26, sway = Math.sin(a * 5 + i * 2) * 5 + (i - 1) * 7, s = 0.55 + 0.35 * Math.min(1, a * 3);
      ctx.globalAlpha = Math.min(1, a * 5) * Math.min(1, (1.6 - a) * 2.5);
      heart(fx + sway, fy - 62 - rise, s, i === 1 ? '#F0436B' : '#F58AA6');
    }
    ctx.restore();
  }
  // What the talking pieces are saying: their lines and when they started. One line at a time, each held for its length.
  const speech = new Map();
  const lineSecs = (s) => 1.6 + s.length * 0.055;
  function speechNow(id, t) {
    const sp = speech.get(id); if (!sp) return null;
    let at = sp.at;
    for (const line of sp.lines) { const d = lineSecs(line); if (t < at + d) return t >= at ? { line, age: t - at, d } : null; at += d; }
    speech.delete(id); return null;
  }
  function drawObjectSpeech(level, t) {
    for (const id of [...speech.keys()]) {
      const o = OBJS.find(ob => ob.id === id); if (!o) { speech.delete(id); continue; }
      const now = speechNow(id, t); if (!now || o.level !== level) continue;
      const W2 = TYPES[o.type]?.W ?? 0.6, D2 = TYPES[o.type]?.D ?? 0.6, [fx, fy] = iso(o.x + W2 / 2, o.y + D2 / 2, 2.1);
      ctx.save(); ctx.globalAlpha = Math.min(1, now.age * 6, (now.d - now.age) * 4); ctx.font = '600 9px Inter, system-ui, sans-serif'; ctx.textAlign = 'center';
      const words = now.line.split(' '), lines = [''];
      for (const w of words) { const cur = lines[lines.length - 1]; if (ctx.measureText(cur + ' ' + w).width > 150 && cur) lines.push(w); else lines[lines.length - 1] = (cur ? cur + ' ' : '') + w; }
      const bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14, bh = lines.length * 11 + 8, bx = fx - bw / 2, by = fy - 14 - bh;
      ctx.fillStyle = 'rgba(24,22,26,.94)'; ctx.strokeStyle = 'rgba(255,60,60,.8)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx, by, bw, bh, 4) : ctx.rect(bx, by, bw, bh); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fx - 3, by + bh); ctx.lineTo(fx, by + bh + 5); ctx.lineTo(fx + 3, by + bh); ctx.fill();
      ctx.fillStyle = '#F2EEE8'; lines.forEach((l, i) => ctx.fillText(l, fx, by + 12 + i * 11));
      ctx.restore();
    }
  }
  function drawBubble(c, t) {
    const age = t - c.bubble.at;
    if (c.bubble.text === '!') { drawAlert(c, age); return; }
    if (c.bubble.text === '♥') { drawHearts(c, age); return; }
    if (age < 0 || age > 4) return;
    const [fx, fy] = iso(c.x, c.y, 0);
    ctx.save(); ctx.globalAlpha = Math.min(1, (4 - age) * 1.2); ctx.font = '600 9px Inter, system-ui, sans-serif'; ctx.textAlign = 'center';
    const words = c.bubble.text.split(' '), lines = [''];
    for (const w of words) { const cur = lines[lines.length - 1]; if (ctx.measureText(cur + ' ' + w).width > 120 && cur) lines.push(w); else lines[lines.length - 1] = (cur ? cur + ' ' : '') + w; }
    const bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 12, bh = lines.length * 11 + 8, bx = fx - bw / 2, by = fy - 70 - bh;
    ctx.fillStyle = 'rgba(255,253,248,.96)'; ctx.strokeStyle = 'rgba(36,27,37,.35)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx, by, bw, bh, 6) : ctx.rect(bx, by, bw, bh); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(fx - 3, by + bh); ctx.lineTo(fx, by + bh + 5); ctx.lineTo(fx + 3, by + bh); ctx.fill();
    ctx.fillStyle = '#241B25'; lines.forEach((l, i) => ctx.fillText(l, fx, by + 12 + i * 11));
    ctx.restore();
  }

  function drawPerson(c, t) {
    c = settle(c);
    const L = c.look, pose = c.pose, f = facing(c.face);
    const P3 = (dx, dy, dz) => iso(c.x + dx, c.y + dy, c.z + dz);
    const [fx, fy] = P3(0, 0, 0);
    // The head has its own heading: at whoever they're with, else where the body is turning to
    // (so it leads the turn), with a glance to one side now and then while standing around.
    const hps = poseState(c), bodyA = Math.atan2(c.face[1], c.face[0]);
    const lookA = c.lookAt ? Math.atan2(c.lookAt[1] - c.y, c.lookAt[0] - c.x) : null;
    const glance = !c.walking && !c.sit && pose === 'stand' && !c.lookAt ? idleGlance(t, c.seed) : 0;
    hps.ha = turnHead(hps.ha ?? bodyA, headTarget(bodyA, hps.want ?? bodyA, lookA, glance), Math.max(0.001, Math.min(0.05, rdt || 0.016)));
    const hdir = [Math.cos(hps.ha), Math.sin(hps.ha)], hf = facing(hdir);
    if (pose === 'sleep') {
      // Under the covers: breathing, and rolling over now and then, eased rather than popped.
      const sps = poseState(c), [lx, ly] = c.face, breath = Math.sin(t * 1.2 + c.seed * 4) * 0.012;
      const wantRoll = Math.floor((t + c.seed * 37) / 24) % 2 === 1 ? 1 : -1;
      const sdt = Math.max(0.001, Math.min(0.05, rdt || 0.016));
      if (sps.roll == null) sps.roll = wantRoll;
      sps.roll += (wantRoll - sps.roll) * Math.min(1, sdt * 2.5);
      const roll = sps.roll;
      const head = P3(0, 0, 0.16), shd = P3(lx * 0.28, ly * 0.28, 0.16 + breath), hips = P3(lx * 0.78, ly * 0.78, 0.13), feet = P3(lx * 1.45, ly * 1.45, 0.1);
      const cover = shade(L.top, 0.25);
      // The body under the cover: broad at the shoulders, narrower down the legs, a bump for the feet.
      limb(hips[0], hips[1], feet[0], feet[1], cover, 11);
      ell(feet[0], feet[1] - 1, 5, 3.2, shade(L.top, 0.32));
      limb(shd[0], shd[1], hips[0], hips[1], cover, 16 + breath * 60);
      limb(shd[0], shd[1] + 2, hips[0], hips[1] + 2, shade(L.top, 0.1), 1.2); // the fold
      // An arm draped over the cover on the upper side of the roll.
      const bvx = feet[0] - head[0], bvy = feet[1] - head[1], bl0 = Math.hypot(bvx, bvy) || 1, ux = bvx / bl0, uy = bvy / bl0, px = -uy, py = ux;
      const up = Math.abs(roll) > 0.3 ? Math.sign(roll) : 0;
      if (up) {
        ctx.save(); ctx.globalAlpha *= Math.min(1, (Math.abs(roll) - 0.3) / 0.5);
        const s0 = [shd[0] + px * up * 5, shd[1] + py * up * 5], e0 = [shd[0] + ux * 6 + px * up * 7.5, shd[1] + uy * 6 + py * up * 7.5], h0 = [shd[0] + ux * 13 + px * up * 4, shd[1] + uy * 13 + py * up * 4];
        limb(s0[0], s0[1], e0[0], e0[1], L.top, 4); limb(e0[0], e0[1], h0[0], h0[1], L.skin, 3.2); circle(h0[0], h0[1], 2.2, L.skin);
        ctx.restore();
      }
      if (L.heads && L.heads.neutral) drawHeadImage(L.heads.blink || L.heads.neutral, head[0], head[1] + 4, HEAD_W * 0.9, roll < 0, -roll * 1.1);
      else drawSimpleHead(head[0], head[1] - 5, 9, { L, fr: 0.6, rt: -roll * 0.7, blink: 1, rot: -roll * 1.1, t, seed: c.seed });
      const zz = (t * 0.6 + c.seed) % 1; ctx.globalAlpha = 1 - zz; ctx.fillStyle = '#F2EEE8'; ctx.font = '600 9px Inter, system-ui, sans-serif'; ctx.fillText('z', head[0] + 6 + zz * 6, head[1] - 10 - zz * 12); ctx.globalAlpha = 1;
      return;
    }
    if (c.z < 0.05) ell(fx, fy, 8, 3.5, 'rgba(0,0,0,.22)');
    const ws = walkState(c), amp = ws.amp, ph = ws.ph;
    // What this activity looks like right now (null: plain standing/walking).
    const standing = !c.walking && !c.sit && pose === 'stand';
    // Activity clip, or while standing around, an idle fidget now and then.
    const rig = c.walking ? null : (poseRig(pose, t, c.seed, c.act, c.actMin || 0) || (standing && !c.lookAt ? idleRig(t, c.seed, c.expr) : null));
    const bl = pose === 'sleep' ? 1 : blinkAmt(t, c.seed), idle = (!rig || rig.idle) && !c.walking && !c.sit && pose !== 'sleep' && pose !== 'dance';
    const breathe = Math.sin(t * 1.9 + c.seed * 2) * (idle ? 0.012 : 0.005);
    const sway = Math.sin(t * 2.2 + c.seed * 3) * (c.walking ? 2.6 : idle ? 0.9 : 0.4);
    // Eyes follow whoever they're with; otherwise they wander while idle.
    const look = c.lookAt ? iso(c.lookAt[0], c.lookAt[1], 1.1) : null;
    const gaze = look ? Math.max(-2.6, Math.min(2.6, (look[0] - fx) / 14)) : idle ? Math.sin(t * 0.45 + c.seed * 5) * 2.2 + Math.sin(t * 0.13 + c.seed) * 1.2 : 0;
    const shift = idle ? Math.sin(t * 0.6 + c.seed * 4) * 1.1 : 0;
    const dance = pose === 'dance' && !rig;
    // A walk rides up over the planted leg (under the hip at |sin| = 1, the other foot mid-swing) and dips as the feet
    // pass apart; the hips sit a touch lower than standing so the stride fits the legs.
    const bob = dance ? Math.abs(Math.sin(t * 6 + c.seed)) * 0.06 : Math.abs(Math.sin(ph)) * 0.03 * amp;
    const clip = blendClip(c, rig, { drop: rig?.drop || 0, bob: rig?.bob || 0, lean: rig?.lean || 0, head: (rig?.nod || 0) - (rig?.headDown ? 0.05 : 0) + (rig?.lookUp ? 0.03 : 0) });
    // Seated: the hips, knees and feet come from the leg solver, so the shins keep their length on any seat.
    const seat = c.sit ? seatLegs(c.z) : null;
    const stairs = c.slope || 0;
    const hipZ = (seat ? seat.hip[1] : 0.62 - 0.02 * amp - (stairs ? 0.06 : 0) - clip.v.drop) + bob + breathe + clip.v.bob, shZ = hipZ + 0.42, hdZ = shZ + 0.14 + clip.v.head;
    const [dx, dy] = c.face, lean = clip.v.lean + 0.025 * amp + stairs * 0.03;
    const hip = P3(0, 0, hipZ), sh = P3(dx * lean, dy * lean, shZ), hd = P3(dx * lean * 1.25, dy * lean * 1.25, hdZ);
    // A turned head slides a little toward where it looks, as a neck does.
    const nk1 = P3(hdir[0] * 0.06, hdir[1] * 0.06, 0), nk0 = P3(dx * 0.06, dy * 0.06, 0);
    const hx = hd[0] + (nk1[0] - nk0[0]), hy = hd[1] + (nk1[1] - nk0[1]);
    // The body's own sideways axis, signed so side +1 is screen-right (matching the shoulders).
    let rx = -dy, ry = dx;
    if (P3(rx, ry, 0)[0] < fx) { rx = -rx; ry = -ry; }
    const local = (v, side) => P3(dx * v[0] + rx * side * v[1], dy * v[0] + ry * side * v[1], shZ + v[2]);
    // Shoes: the foot is a short bone from heel to toe along the facing, projected like
    // every other bone, so it is long seen from the side and short seen head-on, and it
    // tucks behind the shin when the character faces away.
    const toe = P3(dx * FOOT.length, dy * FOOT.length, 0), tvx = toe[0] - fx, tvy = toe[1] - fy;
    const shoeW = Math.abs(tvy) > Math.abs(tvx) ? 3.0 : 2.4, shoeCol = L.shoes || SHOE_COLOR[L.bottomStyle] || '#2B2630';
    const shoeAt = (x, y) => {
      const hx = x - tvx * FOOT.heel, hy = y - tvy * FOOT.heel + 0.6, ex = x + tvx * (1 - FOOT.heel), ey = y + tvy * (1 - FOOT.heel) + 0.6;
      limb(hx, hy + 1.1, ex, ey + 1.1, '#E9E4DC', shoeW);
      limb(hx, hy, ex, ey, shoeCol, shoeW);
      ell(ex - tvx * 0.25, ey - tvy * 0.25 - 0.7, 1.3, 0.6, 'rgba(255,255,255,.18)', null, Math.atan2(tvy, tvx));
    };
    const shoeFirst = tvy < -0.5;
    // The cut of the pants: bare legs below shorts and skirts, boots under breeches, wide baggy legs, slim leather.
    const bs = L.bottomStyle || 'pants', skirty = bs === 'skirt' || bs === 'cheer_skirt', bareLegs = skirty || bs === 'shorts';
    const thighCol = skirty ? L.skin : L.bottom, tw = bs === 'baggy' ? 6.6 : bs === 'leather' ? 4.2 : 5, sw = bs === 'baggy' ? 6.2 : bs === 'leather' ? 3.8 : 4.5;
    const shinCol = bareLegs ? L.skin : bs === 'breeches' ? (L.bottomAccent || '#2b1d12') : L.bottom;
    const checks = (x1, y1, x2, y2) => { if (bs === 'chef_pants') { ctx.save(); ctx.setLineDash([1.3, 1.3]); limb(x1, y1, x2, y2, L.bottomAccent || '#f4f1ea', 1.5); ctx.restore(); } };
    const BG = L.bottomGarment && !skirty ? L.bottomGarment : null;
    const shin = (kx, ky, ax, ay) => { if (shoeFirst) shoeAt(ax, ay); limb(kx, ky, ax, ay, shinCol, sw); if (BG && !bareLegs) FAB.paint(ctx, [[kx, ky], [ax, ay]], sw, BG, { hem: 0, hemEnd: true }); checks(kx, ky, ax, ay); if (!shoeFirst) shoeAt(ax, ay); };
    const thighLimb = (x1, y1, x2, y2) => { limb(x1, y1, x2, y2, thighCol, tw); if (BG) FAB.paint(ctx, [[x1, y1], [x2, y2]], tw, BG, { hem: 0 }); checks(x1, y1, x2, y2); };
    // Arms: shoulder, elbow and hand, worked out once per frame, then drawn
    // behind the torso (the far arm) or in front of it.
    const SLEEVES = { tank: 0, tee: 0.55, jersey: 0.5, dress: 0.4, cheer: 0, cop: 0.55, scrubs: 0.55 };
    const sleeve = L.topGarment ? (SLEEVE_BY_CUT[L.topGarment.cut] ?? 1) : L.topStyle ? (SLEEVES[L.topStyle] ?? 1) : 0.55;
    const NOT_HELD = new Set(['notes', 'water', 'splash']), OPEN_KINDS = new Set(['book', 'plate', 'parcel', 'cloth', 'paper']);
    // Props too wide to grip by a handle: no fingers drawn over them.
    const NO_FINGERS = new Set(['guitar', 'gloves']);
    const mix2 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    // Shoulders sit either side of the body's sideways axis, projected: seen from the side one shoulder is behind the other.
    const shOff = (side) => { const q = P3(dx * lean + rx * side * 0.14, dy * lean + ry * side * 0.14, shZ); const ox = q[0] - sh[0]; return [Math.abs(ox) < 1.8 ? side * 1.8 : ox, q[1] - sh[1]]; };
    const armGeo = (side) => {
      const psA = poseState(c);
      const [sox, soy] = shOff(side);
      const sx0 = sh[0] + shift * 1.4 + sox, sy0 = sh[1] + 1 + soy;
      const spec = rig && rig.hands ? rig.hands[side] : null;
      let tx, ty, el = null;
      if (rig && rig.hands) {
        if (spec) { const h = local(spec, side); tx = h[0]; ty = h[1]; el = rig.elbows && rig.elbows[side] ? local(rig.elbows[side], side) : null; }
        else { tx = sx0 + side * 2; ty = sy0 + 13; }
      } else {
        if (dance) [tx, ty] = [sh[0] + side * 9, sh[1] - 12 + Math.sin(t * 6 + side) * 3];
        else if (['cook', 'reach', 'water', 'desk', 'arcade'].includes(pose)) [tx, ty] = [sh[0] + side * 4 + f.flip * 5, sh[1] + 8];
        else if (['phone', 'read', 'sip', 'eat'].includes(pose)) [tx, ty] = [sh[0] + side * 2, sh[1] + 6];
        else if (c.carrying) {
          // Both hands on the box, held low in front: no swing while carrying.
          const h = local([0.12, 0.1, -0.4], side); tx = h[0]; ty = h[1]; el = local([0.1, 0.17, -0.2], side);
        } else {
          // Standing or walking: the arms hang from the shoulders and swing forward and back
          // in the body's own frame, opposite the legs, so they read the same from every side.
          const w = walkRig(ph, amp), h = local(w.hands[side], side);
          tx = h[0]; ty = h[1]; el = local(w.elbows[side], side);
        }
      }
      // Walking arms track the stride closely; a slow ease here leaves them trailing behind the body.
      const armRate = rig && rig.hands ? (rig.snap ? 28 : 12) : c.walking ? 26 : 9;
      const e = ease2(psA, side, tx, ty, rdt, clip.active ? Math.min(armRate, 4 + 9 * clip.e) : armRate);
      if (!el) el = spec ? [(sx0 + e[0]) / 2 + sox * 0.55, (sy0 + e[1]) / 2 + 3] : [(sx0 + e[0]) / 2, (sy0 + e[1]) / 2];
      const held = rig && rig.props ? rig.props.find(q => !NOT_HELD.has(q.kind) && (q.side == null || q.side === side)) : null;
      const grip = (rig && rig.grip && rig.grip[side]) || (held ? (OPEN_KINDS.has(held.kind) ? 'open' : 'fist') : spec && spec[2] > 0.3 ? 'open' : 'relaxed');
      return { sx0, sy0, el, e, grip, reach: spec ? spec[0] : 0, fingers: !!held && !NO_FINGERS.has(held.kind) };
    };
    const arms = { [-1]: armGeo(-1), 1: armGeo(1) };
    // The arm on the far side of the body sits behind the torso, unless it is reaching out front.
    const sideY = (sd) => P3(rx * sd, ry * sd, 0)[1];
    const farSide = Math.abs(sideY(1) - sideY(-1)) < 0.5 ? 0 : sideY(1) < sideY(-1) ? 1 : -1;
    const armBehind = (sd) => sd === farSide && arms[sd].reach < 0.15;
    const drawArm = (g, side) => {
      const { sx0, sy0, el, e, grip } = g;
      limb3(sx0, sy0, el[0], el[1], e[0], e[1], L.skin, 3.2);
      if (sleeve > 0) {
        const long = sleeve >= 1, from = long ? el : [sx0, sy0], end = long ? mix2(el, e, 0.8) : mix2([sx0, sy0], el, sleeve);
        if (long) limb3(sx0, sy0, el[0], el[1], end[0], end[1], L.top, 4.1); else limb(sx0, sy0, end[0], end[1], L.top, 4.1);
        if (L.topGarment) FAB.paint(ctx, long ? [[sx0, sy0], el, end] : [[sx0, sy0], end], 4.1, L.topGarment, {});
        // A shadowed underside and a lit top edge, like the shirt's folds.
        const edge = (a, b) => {
          const sx = b[0] - a[0], sy = b[1] - a[1], sl = Math.hypot(sx, sy) || 1; let nx = -sy / sl, ny = sx / sl;
          if (ny < 0) { nx = -nx; ny = -ny; }
          limb(a[0] + nx * 1.3, a[1] + ny * 1.3, b[0] + nx * 1.3, b[1] + ny * 1.3, shade(L.top, -0.2), 1.3);
          limb(a[0] - nx * 1.1, a[1] - ny * 1.1, b[0] - nx * 1.1, b[1] - ny * 1.1, shade(L.top, 0.14), 0.9);
        };
        if (long) { edge([sx0, sy0], el); edge(el, end); } else edge([sx0, sy0], end);
        const vx = end[0] - from[0], vy = end[1] - from[1], vl = Math.hypot(vx, vy) || 1;
        limb(end[0] - vx / vl * 0.9, end[1] - vy / vl * 0.9, end[0], end[1], shade(L.top, -0.18), 4.3);
      }
      circle(sx0 - side * 0.4, sy0, 2.5, sleeve > 0 ? L.top : L.skin);
      // The hand, pointing the way the forearm does.
      let ax = e[0] - el[0], ay = e[1] - el[1];
      const al = Math.hypot(ax, ay);
      if (al < 0.5) { ax = 0; ay = 1; } else { ax /= al; ay /= al; }
      const ang = Math.atan2(ay, ax), hx = e[0] + ax * 1.2, hy = e[1] + ay * 1.2, px = -ay, py = ax;
      const hand = handImage(grip, L.body);
      if (hand) {
        // The avatar's own hand, turned to the forearm and mirrored for the other side.
        const K = 0.2, H = HAND_SPRITE;
        ctx.save(); ctx.imageSmoothingQuality = 'high';
        ctx.translate(e[0] - ax * 2, e[1] - ay * 2); ctx.rotate(ang); if (side > 0) ctx.scale(1, -1);
        ctx.drawImage(hand, -H.wristX * K, -H.wristY * K, H.w * K, H.h * K);
        ctx.restore();
        return;
      }
      const fist = grip === 'fist';
      ell(hx, hy, fist ? 2.4 : 2.8, fist ? 2.3 : 2.1, L.skin, null, ang);
      const tn = side > 0 ? -1 : 1;
      ell(hx + px * tn * 1.9 + ax * 0.5, hy + py * tn * 1.9 + ay * 0.5, 1.2, 0.85, L.skin, null, ang);
      if (grip === 'open') [-1, 0, 1].forEach(k => ell(hx + ax * 2.5 + px * k * 1.15, hy + ay * 2.5 + py * k * 1.15, 1.05, 0.75, L.skin, null, ang));
    };
    // The legs sit either side of the body's own sideways axis, projected like the rest, so a
    // character seen from the side has one leg behind the other; a little screen-x is kept so
    // the far leg never vanishes entirely. The far leg is drawn first.
    const legOff = (side) => { const q = P3(rx * side * 0.1, ry * side * 0.1, 0); const ox = q[0] - fx; return [Math.abs(ox) < 1.5 ? side * 1.5 : ox, q[1] - fy]; };
    const LO = { [-1]: legOff(-1), 1: legOff(1) };
    const legOrder = LO[1][1] < LO[-1][1] ? [1, -1] : [-1, 1];
    legOrder.forEach(side => {
      const [ox, oy] = LO[side];
      if (rig && rig.legs === 'pedal') {
        const p = rig.phase + (side > 0 ? 0 : Math.PI);
        // Pedals sit below a bike seat, or in front when standing on the floor.
        const footZ = seat ? -c.z * 0.5 : 0.16, ff = 0.16 + Math.cos(p) * 0.1, fz = footZ + Math.sin(p) * 0.1;
        const kn = legIK([0, hipZ], [ff, fz]);
        const foot = P3(dx * ff, dy * ff, fz), knee = P3(dx * kn[0], dy * kn[0], kn[1]);
        thighLimb(hip[0] + ox, hip[1] + oy, knee[0] + ox, knee[1] + oy);
        shin(knee[0] + ox, knee[1] + oy, foot[0] + ox, foot[1] + oy);
        return;
      }
      if (seat) { const knee = P3(dx * seat.knee[0], dy * seat.knee[0], seat.knee[1]), foot = P3(dx * seat.foot[0], dy * seat.foot[0], seat.foot[1]); thighLimb(hip[0] + ox, hip[1] + oy, knee[0] + ox, knee[1] + oy); shin(knee[0] + ox, knee[1] + oy, foot[0] + ox, foot[1] + oy); return; }
      if (dance) {
        const sw = Math.sin(t * 6 + side) * 0.05, kn = legIK([0, hipZ], [sw, 0]);
        const foot = P3(dx * sw, dy * sw, 0), knee = P3(dx * kn[0], dy * kn[0], kn[1]);
        thighLimb(hip[0] + ox, hip[1] + oy, knee[0] + ox, knee[1] + oy); shin(knee[0] + ox, knee[1] + oy, foot[0] + ox, foot[1] + oy); return;
      }
      if (rig && rig.legs === 'crouch') {
        const kn = legIK([0, hipZ], [0.06, 0]), knee = P3(dx * kn[0], dy * kn[0], kn[1]), foot = P3(dx * 0.06, dy * 0.06, 0);
        thighLimb(hip[0] + ox, hip[1] + oy, knee[0] + ox * 1.2, knee[1] + oy);
        shin(knee[0] + ox * 1.2, knee[1] + oy, foot[0] + ox, foot[1] + oy);
        return;
      }
      if (rig && rig.legs === 'swim') return; // underwater
      if (rig && rig.legs === 'jack') {
        // Jumping jacks: feet out to the sides and back together.
        const out = (rig.spread || 0) * side, kn = legIK([0, hipZ], [Math.abs(out), 0]);
        const foot = P3(rx * out, ry * out, 0), knee = P3(rx * side * kn[0], ry * side * kn[0], kn[1]); // knees bend outward
        thighLimb(hip[0] + ox, hip[1] + oy, knee[0] + ox, knee[1] + oy); shin(knee[0] + ox, knee[1] + oy, foot[0] + ox, foot[1] + oy);
        return;
      }

      if (rig && rig.legs === 'tree' && side > 0) {
        // Tree pose: this foot rests against the other knee, its own knee turned out.
        const tl = treeLeg(hipZ), knee = P3(rx * tl.knee[0], ry * tl.knee[0], hipZ + tl.knee[1]), foot = P3(rx * tl.foot[0], ry * tl.foot[0], hipZ + tl.foot[1]);
        thighLimb(hip[0] + ox, hip[1] + oy, knee[0] + ox, knee[1] + oy);
        shin(knee[0] + ox, knee[1] + oy, foot[0] + ox, foot[1] + oy);
        return;
      }
      if (rig && rig.legs === 'lunge') {
        const fw = side > 0 ? 0.33 : -0.29, kn = legIK([0, hipZ], [fw, 0]), knee = P3(dx * kn[0], dy * kn[0], kn[1]), foot = P3(dx * fw, dy * fw, 0);
        thighLimb(hip[0] + ox, hip[1] + oy, knee[0] + ox, knee[1] + oy);
        shin(knee[0] + ox, knee[1] + oy, foot[0] + ox, foot[1] + oy);
        return;
      }
      if (rig && (rig.legs === 'run' || rig.legs === 'step')) {
        const big = rig.legs === 'run', off = side > 0 ? 0 : Math.PI, p = rig.phase + off;
        const sw = Math.sin(p) * (big ? 0.22 : 0.12), lift = Math.max(0, Math.sin(p)) * (big ? 0.15 : 0.06);
        const kn = legIK([0, hipZ], [sw, lift]);
        const foot = P3(dx * sw, dy * sw, lift), knee = P3(dx * kn[0], dy * kn[0], kn[1]);
        thighLimb(hip[0] + ox, hip[1] + oy, knee[0] + ox, knee[1] + oy);
        shin(knee[0] + ox, knee[1] + oy, foot[0] + ox, foot[1] + oy);
        return;
      }
      const off = side > 0 ? 0 : Math.PI;
      // Turning on the spot: small alternating steps, so the feet carry the body round.
      const tp = poseState(c), shuf = c.walking ? 0 : tp.turn || 0;
      // On the stairs the reach is half a tread, so each footfall lands on the next tread, and the foot
      // follows the slope of the flight: a tread higher ahead going up, lower going down.
      const gf = gaitFoot(ph + off, stairs ? amp * (FL.RUN / 2) / GAIT.reach : amp);
      const sw = gf[0] + Math.sin(tp.tph + off) * 0.06 * shuf, lift = (c.z < 0.05 || stairs ? gf[1] + Math.max(0, Math.sin(tp.tph + off)) * 0.045 * shuf : 0) + stairs * sw;
      const kn = legIK([0, hipZ], [sw, lift]);
      const foot = P3(dx * sw, dy * sw, lift), knee = P3(dx * kn[0], dy * kn[0], kn[1]);
      thighLimb(hip[0] + ox, hip[1] + oy, knee[0] + ox, knee[1] + oy);
      shin(knee[0] + ox, knee[1] + oy, foot[0] + ox, foot[1] + oy);
    });
    // Secondary motion: hair and hems trail the body on springs, so they
    // swing when someone moves, turns or bounces, then settle.
    const sp = poseState(c);
    sp.hipY = hip[1];
    const hair = springAt(sp, 'hair', hd[0], hd[1], 0.05, 26, 7);
    const hem = springAt(sp, 'hem', hip[0], hip[1], 0.035, 32, 8);
    const hairBack = () => {
      if (!L.longHair) return;
      ell(hx + sway * 0.7 + hair[0] * 0.6, hy - 2 + hair[1] * 0.3, 6, 7.5, L.hair);
      // The ends swing a little further than the rest.
      ell(hx + sway * 0.7 + hair[0], hy + 3 + hair[1] * 0.5, 4.6, 3.6, L.hair);
    };
    if (hf.front && !L.heads) hairBack();
    if ((L.topStyle === 'dress' || skirty) && !c.sit) {
      // A skirt that flares and swings at the hem: a dress's, or the skirt worn as pants (shorter, pleated for the cheer skirt).
      const kz = P3(0, 0, hipZ * (skirty ? 0.66 : 0.55)), fl = skirty ? 7.6 : 7;
      ctx.fillStyle = skirty ? L.bottom : L.top; ctx.beginPath();
      ctx.moveTo(hip[0] + shift - 5, hip[1] - 2); ctx.lineTo(hip[0] + shift + 5, hip[1] - 2);
      ctx.lineTo(kz[0] + fl + hem[0], kz[1] + hem[1] * 0.4); ctx.lineTo(kz[0] - fl + hem[0], kz[1] + hem[1] * 0.4); ctx.closePath(); ctx.fill();
      const skirtCloth = skirty ? L.bottomGarment : L.topGarment;
      if (skirtCloth) { ctx.save(); ctx.clip(); FAB.fill(ctx, skirtCloth, [hip[0] - 20, hip[1] - 6, 40, 40], [0, 0]); ctx.restore(); }
      if (skirty) {
        for (let k = -2; k <= 2; k++) limb(hip[0] + shift + k * 1.8, hip[1] - 1, kz[0] + k * fl * 0.42 + hem[0], kz[1] + hem[1] * 0.4 - 0.4, shade(L.bottom, -0.22), 0.7);
        limb(kz[0] - fl + hem[0], kz[1] + hem[1] * 0.4, kz[0] + fl + hem[0], kz[1] + hem[1] * 0.4, L.bottomAccent || '#f4f1ea', bs === 'cheer_skirt' ? 1.6 : 0.8);
      }
    }
    [-1, 1].forEach(sd => { if (armBehind(sd)) drawArm(arms[sd], sd); });
    limb(hip[0] + shift, hip[1], sh[0] + shift * 1.4, sh[1], L.top, 11);
    if (L.topGarment) FAB.paint(ctx, [[hip[0] + shift, hip[1]], [sh[0] + shift * 1.4, sh[1]]], 11, L.topGarment, { torso: true, front: f.front });
    if (!skirty && ['pants', 'jeans', 'trousers', 'cop_pants', 'leather', 'baggy', 'breeches'].includes(bs)) {
      // A belt at the waist, with a buckle when you can see the front.
      const belt = bs === 'cop_pants' ? '#17171b' : bs === 'leather' ? '#2a2a30' : bs === 'breeches' ? '#2b1d12' : shade(L.bottom, -0.38);
      limb(hip[0] + shift - 5.2, hip[1] + 0.8, hip[0] + shift + 5.2, hip[1] + 0.8, belt, 1.9);
      if (f.front) circle(hip[0] + shift, hip[1] + 0.8, 1.15, bs === 'cop_pants' ? '#c9a24a' : '#c8ccd2');
    }
    // Fold shading: a soft shadow down the far side of the shirt, a highlight on the near side.
    limb(hip[0] + shift + 3.2, hip[1], sh[0] + shift * 1.4 + 3.2, sh[1] + 1, shade(L.top, -0.18), 3.2);
    limb(hip[0] + shift - 3, hip[1] - 1, sh[0] + shift * 1.4 - 3, sh[1] + 2, shade(L.top, 0.14), 1.6);
    const pat = L.topStyle && L.topStyle !== 'tee' && !L.topGarment ? L.topStyle : null;
    if (pat && f.front) {
      const tx = hip[0] + shift, ty = hip[1], tx2 = sh[0] + shift * 1.4, ty2 = sh[1];
      const mx = (tx + tx2) / 2, my = (ty + ty2) / 2;
      const ang = Math.atan2(ty2 - ty, tx2 - tx);
      const nx = Math.cos(ang), ny = Math.sin(ang);
      ctx.save();
      ctx.translate(mx, my); ctx.rotate(ang);
      // Keep the pattern on the shirt: clip to the torso's shape.
      const half = Math.hypot(tx2 - tx, ty2 - ty) / 2 + 5.5;
      ctx.beginPath(); ctx.rect(-half, -5.5, half * 2, 11); ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,.5)';
      if (pat === 'sweater' || pat === 'tank') {
        ctx.lineWidth = 1.6;
        for (let i = -14; i <= 14; i += 5.5) { ctx.beginPath(); ctx.moveTo(-7, i); ctx.lineTo(7, i); ctx.stroke(); }
      } else if (pat === 'flannel') {
        ctx.lineWidth = 1.6;
        for (let i = -14; i <= 14; i += 5) { ctx.beginPath(); ctx.moveTo(-7, i); ctx.lineTo(7, i); ctx.moveTo(i, -7); ctx.lineTo(i, 7); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 0.9;
        for (let i = -11.5; i <= 14; i += 5) { ctx.beginPath(); ctx.moveTo(-7, i); ctx.lineTo(7, i); ctx.moveTo(i, -7); ctx.lineTo(i, 7); ctx.stroke(); }
      } else if (pat === 'dress') {
        ctx.fillStyle = 'rgba(255,255,255,.55)';
        for (let r = -14; r <= 14; r += 4.5) for (let q = -6 + (r % 9 === 0 ? 0 : 2.2); q <= 6; q += 4.5) { ctx.beginPath(); ctx.arc(q, r, 0.8, 0, 7); ctx.fill(); }
      } else if (pat === 'jersey') {
        ctx.fillStyle = 'rgba(255,255,255,.75)';
        [-4, 4].forEach(o => ctx.fillRect(-7, o - 0.8, 14, 1.6));
      } else if (pat === 'hoodie' || pat === 'puffer') {
        ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = 1.2;
        for (let i = -12; i <= 12; i += 4) { ctx.beginPath(); ctx.moveTo(-6.5, i); ctx.lineTo(6.5, i); ctx.stroke(); }
      } else if (pat === 'denim') {
        ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 0.7;
        for (let i = -14; i <= 14; i += 2.6) { ctx.beginPath(); ctx.moveTo(-7, i); ctx.lineTo(7, i); ctx.stroke(); }
      } else {
        // Signature outfits from the avatar wardrobe. +x runs up to the neckline.
        const hl = half - 5.5, A = L.accent;
        const tri = (pts, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(q => ctx.lineTo(q[0], q[1])); ctx.closePath(); ctx.fill(); };
        const line = (a, b, col, lw) => { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); };
        if (pat === 'blazer') {
          tri([[hl, -2.8], [hl, 2.8], [hl - 8, 0]], '#f2efe8');
          ctx.fillStyle = A || '#8a2d3b'; ctx.fillRect(hl - 9, -0.8, 8.5, 1.6);
          line([hl, -3.2], [hl - 9, -0.6], 'rgba(0,0,0,.35)', 0.8); line([hl, 3.2], [hl - 9, 0.6], 'rgba(0,0,0,.35)', 0.8);
        } else if (pat === 'chef') {
          ctx.fillStyle = A || '#1f2937';
          [hl - 3, hl - 6.5, hl - 10].forEach(x => [-2.2, 2.2].forEach(y => { ctx.beginPath(); ctx.arc(x, y, 0.7, 0, 7); ctx.fill(); }));
        } else if (pat === 'labcoat') {
          tri([[hl, -3], [hl, 3], [hl - 11, 0]], A || '#9cc3e6');
          line([hl, -3.2], [-hl, -1.4], 'rgba(0,0,0,.22)', 0.7); line([hl, 3.2], [-hl, 1.4], 'rgba(0,0,0,.22)', 0.7);
        } else if (pat === 'pirate') {
          ctx.fillStyle = A || '#5a1f2b';
          ctx.fillRect(-hl - 6, -5.5, hl * 2 + 5, 3.9); ctx.fillRect(-hl - 6, 1.6, hl * 2 + 5, 3.9);
          line([-hl - 6, -1.6], [hl - 1, -1.6], '#c9a24a', 0.6); line([-hl - 6, 1.6], [hl - 1, 1.6], '#c9a24a', 0.6);
          line([hl, -1.2], [hl - 4, 1.2], '#5b4632', 0.5); line([hl, 1.2], [hl - 4, -1.2], '#5b4632', 0.5);
        } else if (pat === 'linen') {
          line([hl, -2], [hl - 5, 0], A || '#8a6a4a', 0.5); line([hl - 5, 0], [hl, 2], A || '#8a6a4a', 0.5);
          line([hl - 1.5, -1.4], [hl - 3, 1], A || '#8a6a4a', 0.4);
        } else if (pat === 'cheer') {
          // A V-neck with a trim, two stripes across the chest and a star.
          tri([[hl, -3], [hl, 3], [hl - 7, 0]], L.skin);
          line([hl, -3.2], [hl - 7.4, 0], A || '#f4f1ea', 0.9); line([hl, 3.2], [hl - 7.4, 0], A || '#f4f1ea', 0.9);
          line([hl - 12, -5.5], [hl - 12, 5.5], A || '#f4f1ea', 1.4); line([hl - 14.6, -5.5], [hl - 14.6, 5.5], A || '#f4f1ea', 0.7);
          ctx.fillStyle = A || '#f4f1ea'; ctx.beginPath(); ctx.arc(hl - 8.2, 0, 1.3, 0, 7); ctx.fill();
        } else if (pat === 'cop') {
          // Collar points, a black tie, a gold badge and a name tag.
          tri([[hl, -3.2], [hl - 3.2, -2], [hl, -0.8]], shade(L.top, 0.2)); tri([[hl, 3.2], [hl - 3.2, 2], [hl, 0.8]], shade(L.top, 0.2));
          line([hl - 1, 0], [hl - 14, 0], '#17171b', 1.5);
          ctx.fillStyle = A || '#c9a24a'; ctx.fillRect(hl - 7.6, 2.2, 2.4, 2.6);
          ctx.fillStyle = '#e8e8ec'; ctx.fillRect(hl - 7.2, -4.6, 1.2, 2.6);
        } else if (pat === 'scrubs') {
          tri([[hl, -2.8], [hl, 2.8], [hl - 8, 0]], L.skin);
          line([hl, -3], [hl - 8.4, 0], A || '#e8f3f3', 0.9); line([hl, 3], [hl - 8.4, 0], A || '#e8f3f3', 0.9);
          ctx.strokeStyle = shade(L.top, -0.3); ctx.lineWidth = 0.6; ctx.strokeRect(hl - 15, 1.2, 4.6, 3.6);
        } else if (pat === 'rockstar') {
          // The band tee between black lapels, with studs.
          tri([[hl, -2.4], [hl, 2.4], [hl - 11, 0]], '#e9e9ee');
          line([hl, -3.4], [hl - 11, -0.6], 'rgba(255,255,255,.32)', 0.7); line([hl, 3.4], [hl - 11, 0.6], 'rgba(255,255,255,.32)', 0.7);
          [0.2, 0.5, 0.8].forEach(t => { ctx.fillStyle = A || '#b8bcc4'; [-1, 1].forEach(sd => { ctx.beginPath(); ctx.arc(hl - 11 * t, sd * (3.2 - 2.6 * t), 0.5, 0, 7); ctx.fill(); }); });
          line([hl - 4, 0.5], [hl - 7.5, -0.6], '#c2262e', 0.9);
        } else if (pat === 'streetwear') {
          // The hood at the neck, drawstrings and a round logo.
          line([hl, -4.6], [hl, 4.6], shade(L.top, -0.28), 2.2);
          line([hl - 1.5, -1.3], [hl - 8.5, -1.5], A || '#17171b', 0.7); line([hl - 1.5, 1.3], [hl - 8.5, 1.5], A || '#17171b', 0.7);
          ctx.fillStyle = A || '#17171b'; ctx.beginPath(); ctx.arc(hl - 14, 0, 1.9, 0, 7); ctx.fill();
        } else if (pat === 'president') {
          tri([[hl, -2.8], [hl, 2.8], [hl - 9, 0]], '#f2efe8');
          ctx.fillStyle = A || '#b3202f'; ctx.fillRect(hl - 11, -0.8, 10, 1.6);
          line([hl, -3.4], [hl - 11, -0.5], 'rgba(0,0,0,.35)', 0.8); line([hl, 3.4], [hl - 11, 0.5], 'rgba(0,0,0,.35)', 0.8);
          ctx.fillStyle = '#f4f4f2'; ctx.fillRect(hl - 9.6, -4.3, 2.4, 1.6);
          ctx.fillStyle = '#b3202f'; ctx.fillRect(hl - 9.6, -3.5, 2.4, 0.5); ctx.fillStyle = '#2a4a9a'; ctx.fillRect(hl - 9.6, -4.3, 1, 0.9);
          ctx.fillStyle = '#c8ccd2'; [-1, 1].forEach(sd => { ctx.beginPath(); ctx.arc(hl - 17, sd * 2.4, 0.6, 0, 7); ctx.fill(); });
        }
      }
      ctx.restore();
    }
    const handAt = {};
    [-1, 1].forEach(sd => { handAt[sd] = arms[sd].e; });
    // Props fade in with the new clip, and the last clip's fade out, instead of popping.
    const propsOf = (r, pass, a) => { if (!r || !r.hands) return; ctx.save(); ctx.globalAlpha *= a; drawProps(r, handAt, c, t, hd, local, pass); ctx.restore(); };
    const fadeIn = clip.active ? clip.e : 1, fadeOut = clip.active && clip.prev ? 1 - clip.e : 0;
    propsOf(clip.prev, 'back', fadeOut); propsOf(rig, 'back', fadeIn);
    [-1, 1].forEach(sd => { if (!armBehind(sd)) drawArm(arms[sd], sd); });
    propsOf(clip.prev, 'front', fadeOut); propsOf(rig, 'front', fadeIn);
    // Fingers curl over whatever they hold.
    [-1, 1].forEach(sd => {
      const g = arms[sd];
      if (g.grip !== 'fist' || !g.fingers || armBehind(sd)) return;
      let ax = g.e[0] - g.el[0], ay = g.e[1] - g.el[1]; const al = Math.hypot(ax, ay) || 1; ax /= al; ay /= al;
      [-1, 1].forEach(k => ell(g.e[0] + ax * 1.6 - ay * k * 0.95, g.e[1] + ay * 1.6 + ax * k * 0.95, 0.95, 0.8, L.skin));
    });
    if (L.heads && L.heads.neutral) {
      const frame = headFrameFor({ front: hf.front, talking: talking || !!rig?.talk, t, seed: c.seed, blink: bl > 0.5, expr: c.expr, mood }, L.heads);
      drawHeadImage(L.heads[frame] || L.heads.neutral, hx + shift * 1.6, hy + 1.2, HEAD_W, hf.flip < 0, 0);
      return;
    }
    // No sprites: the drawn head, turned the way the head points (three-quarter views included).
    const [hva, hvb] = VD(hdir[0], hdir[1]), hfr = (hva + hvb) / Math.SQRT2, hrt = (hva - hvb) / Math.SQRT2;
    const smiling = c.expr === 'happy' || c.expr === 'playful' || (!c.expr && mood > 0.6), sadFace = c.expr === 'sad' || (!c.expr && mood < 0.3);
    if (!hf.front) hairBack();
    drawSimpleHead(hx + shift * 1.6, hy - 9, 10, { L, fr: hfr, rt: hrt, gaze, blink: bl, expr: c.expr, tired: c.expr === 'tired', yawn: !!rig?.yawn, headDown: !!rig?.headDown, lookUp: !!rig?.lookUp, talk: talking || !!rig?.talk, smile: smiling, sad: sadFace, sway, t, seed: c.seed });
  }

  // Depth of field: while two people talk, everything away from them softens. The frame is shrunk and stretched
  // back (a cheap blur that works in every browser), then a clear hole is cut around the focus.
  let dofAmt = 0, dofSmall = null, dofBlur = null, lastFocus = null;
  function drawDof(focus) {
    const cvs = ctx.canvas, w = cvs.width, h = cvs.height;
    if (!dofSmall) { dofSmall = document.createElement('canvas'); dofBlur = document.createElement('canvas'); }
    const sw = Math.max(1, w >> 2), sh = Math.max(1, h >> 2);
    if (dofSmall.width !== sw || dofSmall.height !== sh) { dofSmall.width = sw; dofSmall.height = sh; }
    if (dofBlur.width !== w || dofBlur.height !== h) { dofBlur.width = w; dofBlur.height = h; }
    const a = dofSmall.getContext('2d'), b = dofBlur.getContext('2d');
    a.imageSmoothingQuality = 'high'; b.imageSmoothingQuality = 'high';
    a.clearRect(0, 0, sw, sh); a.drawImage(cvs, 0, 0, w, h, 0, 0, sw, sh);
    b.globalCompositeOperation = 'source-over'; b.clearRect(0, 0, w, h); b.drawImage(dofSmall, 0, 0, sw, sh, 0, 0, w, h);
    const m = ctx.getTransform(), p = m.transformPoint(new DOMPoint(focus.x, focus.y)), r = focus.r * m.a;
    const g = b.createRadialGradient(p.x, p.y, r * 0.35, p.x, p.y, r);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    b.globalCompositeOperation = 'destination-out'; b.fillStyle = g; b.fillRect(0, 0, w, h);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = Math.min(1, dofAmt); ctx.drawImage(dofBlur, 0, 0); ctx.restore();
  }
  // ---- Pets: a cat or a dog, drawn from a few shapes in their own screen frame (+x is the way they face) ----
  function drawPetShape(kind, coat, pose, t, front, seed = 0, gait = null) {
    const c = coat.c, d = coat.d, eye = '#1B1A1F';
    const q = QUAD[kind] || QUAD.dog, ph = gait ? gait.ph : t * (pose === 'run' ? 18 : 11) + seed, amp = gait ? gait.amp : (pose === 'walk' || pose === 'run' ? 1 : 0);
    // Four legs, each two bones: the hip (or shoulder) at (hx, hy), the foot where the stride puts it, the joint from the
    // solver, bending back at a front elbow and forward at a hind knee. Lifted feet (a hop) stretch the leg out.
    const feet = quadGait(ph, kind, pose === 'run', amp);
    const legs = (hips, hy, baseY, cols, w) => {
      hips.forEach(([hx, k], i) => {
        const fi = hx > 0 ? (k ? 1 : 0) : (k ? 3 : 2), [fwd, lift] = feet[fi];
        const foot = [hx + fwd * q.px, Math.min(baseY, baseY - lift * q.px)];
        const j = limbIK([hx, hy], foot, q.upper, q.lower, hx > 0 ? -1 : 1);
        limb(hx, hy, j[0], j[1], cols[k], w + 0.3); limb(j[0], j[1], foot[0], foot[1], cols[k], w);
        ell(foot[0] + (hx > 0 ? 0.6 : 0.3), foot[1], w * 0.62, w * 0.36, cols[k]);
      });
    };
    const tri = (pts, col) => { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); ctx.lineTo(pts[2], pts[3]); ctx.lineTo(pts[4], pts[5]); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); };
    const curve = (x0, y0, cx, cy, x1, y1, col, w) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx, cy, x1, y1); ctx.stroke(); };
    const walk = pose === 'walk' || pose === 'run';
    const sit = ['sit', 'happy', 'groom'].includes(pose);
    if (kind === 'cat') {
      const head = (hx, hy, closed) => {
        circle(hx, hy, 5.4, c); tri([hx - 4.8, hy - 1.5, hx - 3.6, hy - 9, hx - 0.4, hy - 4.6], c); tri([hx + 0.4, hy - 4.8, hx + 3.6, hy - 9.2, hx + 5, hy - 1.8], c); tri([hx - 3.6, hy - 3, hx - 3.1, hy - 7, hx - 1.4, hy - 4.6], '#E8A0AE');
        if (closed) { ctx.strokeStyle = eye; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(hx + 2.4, hy - 0.4, 1.3, 0.2, Math.PI - 0.2); ctx.stroke(); }
        else if (front) { circle(hx + 2.6, hy - 0.6, 1.05, eye); circle(hx + 4.6, hy + 1.7, 0.8, '#D98C9A'); }
        if (front || closed) { ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(hx + 4, hy + 1.8); ctx.lineTo(hx + 9, hy + 0.8); ctx.moveTo(hx + 4, hy + 2.2); ctx.lineTo(hx + 9, hy + 3); ctx.stroke(); }
      };
      if (pose === 'sleep') { ell(0, -5, 11, 6, c); curve(-9, -3, -6, 3, 6, 1, c, 3.2); head(8, -6, true); for (let i = 0; i < 3; i++) curve(-6 + i * 4, -10, -5 + i * 4, -7, -6 + i * 4, -3, d, 1.2); return; }
      const tw = Math.sin(t * 2 + seed) * 0.35;
      const hop = pose === 'play' ? -Math.abs(Math.sin(t * 5 + seed)) * 8 : 0;
      if (sit) {
        curve(-5, -2, -13, 0, -11 + tw * 4, 3, c, 3);
        ell(-1, -9, 7, 8.5, c); for (let i = 0; i < 2; i++) curve(-6, -12 + i * 4, -3, -11 + i * 4, -1, -13 + i * 4, d, 1.1);
        limb(3, -5, 3.5, 0, d, 2.4); limb(6, -5, 6.5, 0, c, 2.4);
        const hy = -20 + (pose === 'groom' ? Math.sin(t * 6 + seed) * 0.8 : 0); head(3, hy, pose === 'happy');
        if (pose === 'groom') limb(6, -8, 7, hy + 4 + Math.sin(t * 9 + seed) * 1.5, c, 2.4);
        return;
      }
      const by = (pose === 'crouch' ? -5 : -8) - Math.abs(Math.sin(ph)) * 0.5 * amp, eat = pose === 'eat', nod = Math.sin(ph * 2) * 0.5 * amp;
      curve(-9, by - 1 + hop, -16, by - 4 + hop, -15 + tw * 6, by - 13 + hop, c, 3);
      legs([[-6, 0], [-3, 1], [4, 0], [7, 1]], by + 2 + hop, Math.min(0, hop * 0.4), [c, d], 2.4);
      ell(0, by + hop, 10, 5.5, c); for (let i = 0; i < 3; i++) curve(-6 + i * 4, by - 5 + hop, -5 + i * 4, by - 2 + hop, -6 + i * 4, by + 1 + hop, d, 1.1);
      head(eat ? 11 : 10, (eat ? by + 3 : by - 6) + hop + nod, false);
      return;
    }
    const head = (hx, hy, closed, tongue) => {
      circle(hx, hy, 7, c); ell(hx + 6, hy + 2, 5.2, 3.6, c); circle(hx + 10.6, hy + 0.8, 1.9, eye);
      if (closed) { ctx.strokeStyle = eye; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(hx + 2.5, hy - 1.5, 1.5, 0.2, Math.PI - 0.2); ctx.stroke(); } else if (front) circle(hx + 3, hy - 2, 1.25, eye);
      if (tongue) ell(hx + 7.5, hy + 6.2, 1.6, 2.6, '#E07A8A');
      ell(hx - 2.5, hy + 1.5, 3, 6.5, d, null, 0.25);
    };
    const wag = ['happy', 'play', 'walk', 'run', 'sit'].includes(pose) ? Math.sin(t * 14 + seed) * 0.6 : 0.1;
    if (pose === 'sleep') { ell(0, -7, 14, 7, c); ell(-4, -9, 5, 3.5, d); limb(-12, -6, -6, -1, c, 3); head(11, -6, true, false); return; }
    const hop = pose === 'play' ? -Math.abs(Math.sin(t * 5 + seed)) * 7 : 0;
    if (sit) {
      limb(-9, -3, -16, -6 + wag * 5, c, 3.2);
      ell(-2, -12, 9, 11, c); ell(-4, -14, 4, 3, d);
      limb(3, -6, 4, 0, c, 3); limb(7, -6, 8, 0, c, 3);
      head(5, -26, false, pose === 'happy');
      // Grooming, for a dog, is a good scratch behind the ear with a hind leg.
      if (pose === 'groom') limb(-2, -8, 6 + Math.sin(t * 13 + seed) * 2.5, -22, c, 3);
      return;
    }
    // Crouching (a squat in the yard) brings the body low on bent legs.
    const by = (pose === 'crouch' ? -11 : -15 + (pose === 'eat' ? 1 : 0)) - Math.abs(Math.sin(ph)) * 0.6 * amp, nod = Math.sin(ph * 2) * 0.6 * amp;
    limb(-12, by - 2 + hop, -19, by - 9 + wag * 6 + hop, c, 3.2);
    legs([[-8, 0], [-5, 1], [6, 0], [9, 1]], by + 4 + hop, Math.min(0, hop * 0.4), [c, shade(c, -0.15)], 3);
    ell(0, by + hop, 13, 7, c); ell(-4, by - 2 + hop, 5, 3.5, d);
    if (pose === 'eat') head(15, by + 9, false, false); else head(14, by - 8 + hop + nod, false, pose === 'play' || walk);
  }
  function drawPet(p, t) {
    const [fx, fy] = iso(p.x, p.y, p.z), f = facing(p.face || [0, 1]), sc = p.kind === 'dog' ? 1.05 : 0.95;
    ctx.save(); ctx.globalAlpha *= p.alpha == null ? 1 : p.alpha;
    if (p.pose !== 'sleep' && p.z <= 0.05) ell(fx, fy, p.kind === 'dog' ? 11 : 8, 3.2, 'rgba(30,15,30,.16)');
    const ws = petWalkState(p);
    ctx.save(); ctx.translate(fx, fy); ctx.scale(f.flip * sc, sc); drawPetShape(p.kind, p.coat, p.pose, t, f.front, p.seed || 0, ws);
    if (p.pose === 'play' && p.kind === 'dog') { const k = Math.sin(t * 5 + (p.seed || 0)); circle(26 + k * 6, -4 - Math.abs(k) * 12, 2.8, '#C9D94A'); }
    ctx.restore();
    const top = fy - (p.kind === 'dog' ? 40 : 30);
    if (p.pose === 'sleep') for (let i = 0; i < 2; i++) { const ph = (t * 0.4 + i / 2 + (p.seed || 0)) % 1; ctx.fillStyle = `rgba(80,70,140,${1 - ph})`; ctx.font = `600 ${8 + ph * 4}px "IBM Plex Mono", ui-monospace, monospace`; ctx.fillText('z', fx + 6 + ph * 10, fy - 12 - ph * 16); }
    if (p.hearts > 0) heart(fx + 6, top - 2 - (1 - Math.min(3, p.hearts) / 3) * 10, 1, 'rgba(205,70,110,.9)');
    if (p.want || p.door) thought(fx + 15, top - 10 + Math.sin(t * 3) * 1.5, p.door ? 'leash' : p.want === 'feed' ? 'bowl' : p.want === 'play' ? 'ball' : 'love');
    ctx.restore();
  }

  function render(s) {
    // What the household is doing to the house (the power, the dishes, the fridge) comes in with every frame, so the art never shows stale state.
    if (s.house) { power = s.house.power; dishes = s.house.dishes; laundryPile = s.house.laundryPile; fridge = s.house.fridge; parcel = s.house.parcel || null; if (s.house.owned) owned = s.house.owned; }
    sync(s);
    // The pets, so the bowls and litter boxes can show what is in them.
    PETS.length = 0; if (s.pets) for (const p of s.pets) PETS.push(p);
    const t = animT, lv = viewLevel;
    const watching = [jordan, maya].some(c => c && c.task && c.task.phase === 'do' && (c.task.name === 'tv' || c.task.name === 'movie'));
    tvF += ((power && (watching || tvOn) ? 1 : 0) - tvF) * Math.min(1, rdt * 4);
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    const lights = activeLights(lv);
    PFX.step(rdt, isOutdoor(lv) ? [0.16 + (raining() ? 0.2 : 0), 0.06] : [0.015, 0], tier() === 'low' ? 0.5 : 1);
    // Fall: leaves blow across the yard from the trees' side.
    if (isOutdoor(lv) && seasonIdx() === 2 && tier() !== 'low') {
      for (let i = 0; i < 3; i++) PFX.emit('leaves' + i, 'leaf', 3, 1 + i * 3.2, 0.6 + (i % 2) * 2.4, 2.2 + i * 0.3, 1);
    }
    const deferred = !!(G && opts.deferredLights && opts.deferredLights()) && tier() !== 'low';
    if (deferred) { G.begin(W, H, Math.min((cv.width / W) * (tier() === 'high' ? 0.75 : 0.5), 1600 / W)); ctx = G.wrap(ctx0); gOn = true; }
    try {
    drawWalls(lv); drawFloor(lv); decals(lv, t); drawFloorDirt(lv);
    const items = [];
    wallItemsFull(lv, items);
    OBJS.forEach(o => { if (o.level === lv && TYPES[o.type] && !(arr.hold && arr.hold === o)) objItems(o, items, t); });
    (s.chars || []).forEach(c0 => {
      // Someone on the stairs climbs the flight on the floor below, and comes up out of the stairwell on the floor above.
      let c = c0, pit = null;
      if (c0.stair && !c0.hidden) {
        const st = c0.stair, k = Math.max(0, Math.min(1, st.s)), up = st.up;
        const x = st.bx + (st.tx - st.bx) * k, y = st.by + (st.ty - st.by) * k;
        // The body rises smoothly with the flight; the feet do the stepping (see the slope in drawPerson).
        const z = k * FL.TOP, slope = (up ? 1 : -1) * FL.RISE / FL.RUN;
        const dx = st.tx - st.bx, dy = st.ty - st.by, dl = Math.hypot(dx, dy) || 1, fdir = up ? [dx / dl, dy / dl] : [-dx / dl, -dy / dl];
        if (lv === st.low) c = Object.assign({}, c0, { level: lv, x, y, z, face: fdir, walking: true, slope });
        else if (lv === st.high && z > FL.TOP * 0.62) {
          const hole = OBJS.find(o => o.level === lv && (o.type === 'holeX' || o.type === 'holeY') && Math.hypot(o.x + (TYPES[o.type].W || 1) / 2 - st.tx, o.y + (TYPES[o.type].D || 1) / 2 - st.ty) < 3);
          if (!hole) return;
          pit = hole; c = Object.assign({}, c0, { level: lv, x, y, z: z - FL.TOP, face: fdir, walking: true, slope });
        } else return;
      } else if (c0.level !== lv || c0.hidden) return;
      const settled = c.z > 0.05 || c.pose === 'sleep', r = settled ? 0.05 : 0.12; if (c.walking && !settled && isOutdoor(lv)) { const ph = (t * 10 + c.seed); if (Math.sin(ph) > 0.96 || Math.sin(ph + Math.PI) > 0.96) { const [fx, fy] = c.face; PFX.emit(c.id + ':dust', 'dust', lv, c.x - fx * 0.18, c.y - fy * 0.18, 0.02, 0.6); } } items.push({ x1: c.x - r, y1: c.y - r, x2: c.x + r, y2: c.y + r, key: vs(c.x, c.y) + (settled ? 0.6 : 0.001), d: () => { if (gOn) G.billboard(iso(c.x, c.y, 0)[1], ZH, MATERIAL.body); if (pit) { const W = TYPES[pit.type].W, D = TYPES[pit.type].D, P = [iso(pit.x, pit.y, 0), iso(pit.x + W, pit.y, 0), iso(pit.x + W, pit.y + D, 0), iso(pit.x, pit.y + D, 0)], lo = P.slice().sort((a, b) => a[0] - b[0]), bot = P.reduce((m, q) => (q[1] > m[1] ? q : m)); ctx.save(); ctx.beginPath(); ctx.moveTo(lo[0][0], lo[0][1]); ctx.lineTo(bot[0], bot[1]); ctx.lineTo(lo[3][0], lo[3][1]); ctx.lineTo(lo[3][0], -2000); ctx.lineTo(lo[0][0], -2000); ctx.closePath(); ctx.clip(); }
        drawPerson(c, t); if (c.carrying) drawCarried(c); if (gOn) G.clearBase(); if (c.npc && c.name) drawNameTag(c); if (c.bubble) drawBubble(c, t);
        if (pit) ctx.restore(); } }); });
    (s.pets || []).forEach(p => {
      if (p.level !== lv || p.hidden) return;
      const r = p.z > 0.05 ? 0.04 : 0.14;
      items.push({ x1: p.x - r, y1: p.y - r, x2: p.x + r, y2: p.y + r, key: vs(p.x, p.y) + 0.0005 + (p.z > 0.05 ? 0.3 : 0), d: () => { if (gOn) G.billboard(iso(p.x, p.y, 0)[1], ZH * 0.5, MATERIAL.body); drawPet(p, t); if (gOn) G.clearBase(); } });
    });
    depthSort(items).forEach(it => it.d());
    drawFrontWalls(lv); drawProjector(lv); drawObjectSpeech(lv, t);
    if (arrState) drawArrangeOverlay(arrState, lv);
    drawGuides(lv, t);
    drawPoofs(lv);
    drawSparkles(lv);
    } finally { gOn = false; ctx = ctx0; gMat = MATERIAL.matte; }
    drawParticles(lv, false);
    lighting(lv, lights, deferred);
    drawParticles(lv, true);
    if (isOutdoor(lv)) drawRain();
    dofAmt += ((s.focus && tier() === 'high' ? 0.85 : 0) - dofAmt) * Math.min(1, rdt * 3);
    if (s.focus) lastFocus = s.focus;
    if (dofAmt > 0.02 && lastFocus) drawDof(lastFocus);
    ctx.restore();
    ctx.fillStyle = 'rgba(34,26,35,.55)'; ctx.font = '600 12px "IBM Plex Mono", ui-monospace, monospace'; ctx.textAlign = 'right'; ctx.fillText(LEVEL_NAMES[lv].toUpperCase(), W - 14, H - 12); ctx.textAlign = 'start';
  }

  function applyPaint(level, color) { if (LOOKS[level]) LOOKS[level].paint = color; }
  function applyWallpaper(level, pattern) { if (LOOKS[level]) LOOKS[level].paper = pattern; }
  function applyFloor(level, floor) { if (LOOKS[level]) LOOKS[level].floor = floor; }
  // Pictures that can hang as wallpaper: { id, base (a matching tone, used while loading), url | stops }.
  function registerPictures(list) { list.forEach(p => { if (p && p.id && !PAPERS[p.id]) PAPERS[p.id] = { pat: 'image', base: p.base, url: p.url, stops: p.stops }; }); }
  const getLooks = () => LOOKS.map(l => Object.assign({}, l));
  // Everything the art owns that has to survive a reload: house looks (paint, wallpaper, floors, per-room
  // overrides), wall decor, and the yard's grass, weeds, burns and rain. The mirror image of applySave.
  const exportLooks = () => ({
    LOOKS: getLooks(),
    ROOMLOOK: ROOMLOOK.map(r => JSON.parse(JSON.stringify(r))),
    WALLOBJS: WALLOBJS.map(w => Object.assign({}, w)),
    yard: { t: YARD.tiles.map(t => [t.len, t.water, t.weed, t.burn, t.mowedAt]), rainAt: YARD.rainAt, rainUntil: YARD.rainUntil, rainCheck: YARD.rainCheck },
  });
  const lookInfo = (kind, key) => (kind === 'paper' ? PAPERS[key] : kind === 'floor' ? FLOORS[key] : null) || null;
  function toggleObjectLight(id) { const next = objectLights.get(id) !== true; objectLights.set(id, next); return next; }
  let lastToggled = null;
  function toggleLightAt(level, sx, sy) {
    let best = null, bestDist = 34;
    WALL_LIGHTS.forEach((L, i) => {
      if (L.level !== level || (L.need && !has(L.need)) || lightSkipped(L) || (L.onlyIn && flags.house !== L.onlyIn)) return;
      const um = (L.u[0] + L.u[1]) / 2, p = L.p === 'B' ? [um, 0.2, L.z] : [0.2, um, L.z], q = iso(...p), d = Math.hypot(sx - q[0], sy - q[1]);
      if (d < bestDist) { bestDist = d; best = { kind: 'wall', index: i }; }
    });
    OBJS.forEach(o => {
      const lt = T_OF(o).light; if (!lt || o.level !== level) return;
      const [x, y] = xf(o, lt.at[0], lt.at[1]), q = iso(x, y, lt.at[2] + (o.z || 0)), d = Math.hypot(sx - q[0], sy - q[1]);
      if (d < bestDist) { bestDist = d; best = { kind: 'object', id: o.id }; }
    });
    if (!best) return null;
    lastToggled = best.kind === 'object' ? best.id : null;
    if (best.kind === 'wall') { const next = wallLightOverrides.get(best.index) !== true; wallLightOverrides.set(best.index, next); return next; }
    return toggleObjectLight(best.id);
  }

  // Guides for scripts: a pulsing outline on the piece to tap, and a ghost of where a piece should go.
  let spotIds = [], ghost = null;
  function drawGuides(level, t) {
    if (!spotIds.length && !ghost) return;
    const pulse = 0.55 + 0.45 * Math.sin(t * 4.2);
    ctx.save();
    const trace = (o, col, w, dash) => {
      const hull = objHull(o);
      ctx.beginPath(); hull.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
      ctx.setLineDash(dash); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
    };
    OBJS.forEach(o => { if (o.level === level && spotIds.includes(o.id) && TYPES[o.type]) trace(o, `rgba(255,214,102,${pulse})`, 2.4, []); });
    if (ghost && ghost.level === level && TYPES[ghost.type]) {
      const col = ghost.color === 'partner' ? '214,74,122' : '120,200,150';
      const o = { id: '_ghost', type: ghost.type, level, x: ghost.x, y: ghost.y, rot: ghost.rot || 0 };
      const hull = objHull(o);
      ctx.beginPath(); hull.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
      ctx.fillStyle = `rgba(${col},${0.1 + 0.1 * pulse})`; ctx.fill();
      ctx.setLineDash([6, 4]); ctx.lineDashOffset = -t * 14; ctx.strokeStyle = `rgba(${col},${0.55 + 0.4 * pulse})`; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.restore();
  }

  // The outline of an object on screen: its footprint and its top, wrapped.
  function objHull(o) {
    const [fw, fd] = fp(o), up = o.z || 0, h = (T_OF(o).h || 1) + up, pts = [];
    [[o.x, o.y], [o.x + fw, o.y], [o.x + fw, o.y + fd], [o.x, o.y + fd]].forEach(([x, y]) => { pts.push(iso(x, y, up)); pts.push(iso(x, y, h)); });
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (q, a, b) => (a[0] - q[0]) * (b[1] - q[1]) - (a[1] - q[1]) * (b[0] - q[0]);
    const lower = [], upper = [];
    for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
    for (const p of pts.slice().reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
    return lower.slice(0, -1).concat(upper.slice(0, -1));
  }

  // Arrange mode, the Animal Crossing part: every movable piece outlined, the
  // one under your finger highlighted, and the one you're carrying showing a
  // green (fits) or red (doesn't) footprint, with marks where people will
  // stand to use it.
  function drawArrangeOverlay(a, level) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(0, 0, W, H);
    const pick = a.held || a.selected;
    OBJS.forEach(o => {
      if (o.level !== level || !a.movable.includes(o.id) || o.id === pick) return;
      const hull = objHull(o), hot = o.id === a.hover;
      ctx.beginPath(); hull.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath();
      ctx.strokeStyle = hot ? 'rgba(214,74,122,.95)' : 'rgba(214,74,122,.35)'; ctx.lineWidth = hot ? 2 : 1; ctx.setLineDash(hot ? [] : [4, 4]); ctx.stroke();
    });
    ctx.setLineDash([]);
    const o = pick && OBJS.find(q => q.id === pick);
    if (o && o.level === level) {
      // Picked up (being dragged) shows whether it fits; just selected glows
      // gold with a slow pulse so it's clear which piece the next drag moves.
      const dragging = a.held === o.id;
      const pulse = 0.5 + 0.5 * Math.sin(animT * 4);
      const [fw, fd] = fp(o), col = dragging ? (a.valid ? '47,143,91' : '194,65,58') : '255,200,70';
      poly([[o.x, o.y, 0.01], [o.x + fw, o.y, 0.01], [o.x + fw, o.y + fd, 0.01], [o.x, o.y + fd, 0.01]], `rgba(${col},${dragging ? 0.25 : 0.16 + 0.1 * pulse})`, `rgba(${col},.9)`, 2);
      const st = T_OF(o).spots;
      if (st) Object.values(st).forEach(sp => { const [sx, sy] = xf(o, sp.stand[0], sp.stand[1]), [px, py] = iso(sx, sy, 0); ell(px, py, 6, 3, `rgba(${col},.85)`); ell(px, py, 2, 1, '#fff'); });
      // A gentle lift, so a carried piece reads as carried.
      const lift = dragging ? 3 : 0;
      const hull = objHull(o); ctx.beginPath(); hull.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1] - lift) : ctx.moveTo(p[0], p[1] - lift))); ctx.closePath();
      if (!dragging) { ctx.fillStyle = `rgba(${col},${0.08 + 0.08 * pulse})`; ctx.fill(); ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(36,27,37,.55)'; ctx.lineWidth = 5; ctx.stroke(); }
      ctx.strokeStyle = `rgba(${col},.98)`; ctx.lineWidth = dragging ? 2 : 3; ctx.stroke();
    }
    ctx.restore();
  }

  const inPoly = (px, py, poly) => { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside; } return inside; };

  // Which piece is under a view-space point: the one in front when several
  // overlap, a rug only when nothing else is there, and a little give around
  // the point so a fingertip lands what it's aiming at. `ids` limits the search.
  function hitObject(level, px, py, ids) {
    const slop = [[0, 0], [9, 0], [-9, 0], [0, 9], [0, -9]];
    let best = null, bestScore = -Infinity;
    OBJS.forEach(o => {
      if (o.level !== level || !TYPES[o.type] || (ids && !ids.includes(o.id))) return;
      const hull = objHull(o);
      const direct = inPoly(px, py, hull);
      if (!direct && !slop.some(([dx, dy]) => inPoly(px + dx, py + dy, hull))) return;
      const [fw, fd] = fp(o);
      const score = (TYPES[o.type].rug ? 0 : 2 + (direct ? 1 : 0)) * 1000 + vs(o.x + fw / 2, o.y + fd / 2) * 10 + (direct ? 1 : 0) + (o.on ? 3000 : 0);
      if (score > bestScore) { bestScore = score; best = o; }
    });
    return best;
  }

  // Tapping an object brings it to life for a moment (or flips its switch).
  // Returns what happened, for the log, or null if it does nothing on a tap.
  function poke(o, part = '') {
    const run = (secs, msg) => { liveUntil.set(o.id + ':' + part, animT + secs); return msg; };
    switch (o.type) {
      case 'overseer': return 'The eye turns toward you.';
      case 'tvunit': tvOn = !tvOn; return tvOn ? 'The TV flickers on.' : 'TV off.';
      case 'fireplace': if (fireOut.has(o.id)) { fireOut.delete(o.id); return 'The fire crackles back to life.'; } fireOut.add(o.id); return 'The fire dies down.';
      case 'laundry': return run(12, 'The washer churns into a spin cycle.');
      case 'records': return run(14, 'The needle drops. A record starts spinning.');
      case 'arcade': return run(6, 'The arcade lights up: INSERT COIN.');
      case 'clawmachine': return run(6, 'The claw swings out, drops, and comes up with a plush. Lucky.');
      case 'tread': return run(8, 'The treadmill belt whirs to life.');
      case 'shower': return run(8, 'The shower hisses on, then off.');
      case 'bathtub': return run(10, 'The tub fills with steaming water.');
      case 'toilet': return run(3, 'Flush.');
      case 'fridge': return run(3, 'The fridge door swings open. Snacks.');
      case 'counter': {
        const msg = { sink: 'The faucet runs.', stove: 'Click, click, whoomph: the burner lights.', coffee: 'The coffee machine gurgles.' }[part];
        return msg ? run(part === 'stove' ? 8 : 5, msg) : null;
      }
      default: return null;
    }
  }

  return { render, applySave, applyPaint, applyWallpaper, applyFloor, registerPictures, getLooks, exportLooks, lookInfo, toggleObjectLight, objectLightOn: (id) => objectLights.get(id) === true, setObjectLight: (id, on) => { objectLights.set(id, !!on); }, toggleLightAt, setTalking, setMood, objectSay: (id, lines) => { speech.set(id, { lines: lines.slice(), at: animT }); }, objectPlaced, poke, lastToggledLight: () => lastToggled, reveal: (id) => arrive(id, 'pop'), drop: (id) => arrive(id, 'drop'), poof: (level, x, y) => { poofs.push({ t: 0, level, x, y }); for (let i = 0; i < 6; i++) sparkles.push({ t: i * -0.05, level, pt: [x + (i % 3 - 1) * 0.35, y + (Math.floor(i / 3) - 0.5) * 0.35, 0.5 + (i % 2) * 0.3] }); }, setDim: (v) => { dimTarget = Math.max(0, Math.min(0.42, v || 0)); }, burst: (level, x, y, z = 0.5) => { for (let i = 0; i < 6; i++) sparkles.push({ t: i * -0.08, level, pt: [x + (i % 3 - 1) * 0.4, y + (Math.floor(i / 3) - 0.5) * 0.4, z + (i % 2) * 0.3] }); }, spotlight: (ids) => { spotIds = Array.isArray(ids) ? ids : []; }, setGhost: (g) => { ghost = g || null; }, project: (x, y, z = 0) => iso(x, y, z), unproject: (sx, sy) => unIso(sx, sy), hitObject, TYPES, WTYPES };
}

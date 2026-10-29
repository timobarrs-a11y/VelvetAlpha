/* eslint-disable */
// Ported verbatim from the original Velvet House renderer. Live game state is copied in by `render()` each frame.
import { MATERIAL } from '../engine/gbuffer';
import { sunLight, gradeTint } from '../engine/deferredLights';
import { createParticles } from '../engine/particles';
import { drawWallLamp } from './wallLamps.js';
import { drawFoliage, pot as plantPot, seedOf } from './plants.js';
import { poseRig, idleRig, walkRig, seatLegs, legIK, gaitFoot, headTarget, turnHead, idleGlance, treeLeg, quadGait, limbIK, QUAD, FOOT, GAIT } from './poseAnim.js';
import { headFrameFor } from '../state/headSprites';
import { handImage, HAND_SPRITE } from '../state/bodySprites';
import { TYPES as STATE_TYPES, skinOf, colsOf } from '../state/objects';
import { isOutdoor } from '../state/scenes';
import { rand } from '../state/rng';
import { createFabric } from './fabric.js';
import { SLEEVE_BY_CUT } from '../state/garment';
import { LEVELS, STAIRS, WALL_LIGHTS, LEVEL_NAMES, DOOR, OFFICE } from '../state/house';
import { stageAt } from '../state/plantGrowth';
import { drawCrop, drawGroundSpot } from './cropArt.js';
import { createWeatherFx, hull } from './weatherFx.js';
import { drawTree, mix as treeMix } from './treeArt.js';
import { darknessAt } from '../state/daylight';
const wfx = createWeatherFx();
import { CROPS } from '../state/crops';
import { defaultWallLamps, lampRoom } from '../state/wallLamps';

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
  // Switches you flip by tapping: each TV (by id), and the fireplace (lit by default). A TV is also on while someone on
  // its floor watches.
  const tvTapped = new Set();
  let tvWatchLevel = -1;
  const tvLit = (o) => (!power ? 0 : tvTapped.has(o.id) ? 1 : o.level === tvWatchLevel ? tvF : 0);
  const fireOut = new Set();
  let parcel = null, flags = {}, owned = new Set(), arranging = false, wallMode = 'cut', tapFocus = null;
  let OBJS = [];
  const reserved = {};
  const arr = { hold: null, wHold: null, orig: null, valid: false, hover: null, mouse: null };
  let arrState = null;
  // The wall lamps (they can be moved: see systems/wallLamps.ts) and what is selected or held among them.
  let LAMPS = defaultWallLamps(), lampUi = null;
  const offstage = () => ({ name: '', away: true, level: -1, x: -10, y: -10, task: null, queue: [], needs: {} });
  let jordan = offstage(), maya = offstage(), others = [];
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
  // Outside, the yard sits right of centre so its far fence runs off the edge of the picture instead of ending in view.
  let YS = 0;
  function setOrigin() { const vw = viewW(), vd = viewD(); OX = 320 - (vw / 2 - vd / 2) * TW + YS; OY = 272 - (vw / 2 + vd / 2) * TH; }
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
  function baseDarkness() { return darknessAt(hour(), seasonIdx()); }
  function skyColor() { const h = hour(); if (raining() && darkness() < 0.3) return seasonIdx() === 3 ? '#D2D8E0' : '#9AA6B5'; if (darkness() > 0.3) return '#2A2F55'; if (h >= 17.5 && h < 21) return '#F0B98E'; if (h < 7.5) return '#E9C7B5'; return '#BFE2F0'; }

  const LOOKS = [{ paint: '#B9B4AF', paper: 'block', floor: 'concrete' }, { paint: '#E9DCCB', paper: null, floor: 'wood' }, { paint: '#E9DCCB', paper: null, floor: 'wood' }, { paint: '#D9CDBD', paper: null, floor: 'wood' }, { paint: '#E4D6C2', paper: 'shiplap', floor: 'wood' }, { paint: '#E4DFD6', paper: null, floor: 'office' }];
  const FLOORS = {
    wood: { kind: 'plank', a: '#C9A27A', b: '#C09670', line: 'rgba(90,60,30,.22)' },
    concrete: { kind: 'flat', a: '#A7A29D', b: '#A7A29D', line: 'rgba(0,0,0,.06)' },
    office: { kind: 'check', a: '#9AA3AE', b: '#929BA7', line: 'rgba(0,0,0,.05)' },
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
    nanaplush: { kind: 'speck', a: '#FBF0F4', b: '#FBF0F4', line: 'rgba(160,110,160,.05)', pal: ['#F8C8DC', '#E4D6F7', '#FFF1B8'] },
    confetti: { kind: 'speck', a: '#F7E9F1', b: '#F7E9F1', line: 'rgba(120,100,150,.06)', pal: ['#F9C6DA', '#BFE3F5', '#FFF2B8', '#C9F0DC'] },
    birchplank: { kind: 'plank', a: '#EBDDBF', b: '#E3D3B0', line: 'rgba(120,90,50,.16)' }, honey: { kind: 'plank', a: '#D9A85A', b: '#CF9C4E', line: 'rgba(90,55,15,.22)' },
    chestnut: { kind: 'plank', a: '#8A5A3A', b: '#7F5233', line: 'rgba(0,0,0,.3)' }, frostpine: { kind: 'plank', a: '#D9DCDD', b: '#CFD3D5', line: 'rgba(60,70,80,.18)' },
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
    stardust: { kind: 'speck', a: '#CDC4E6', b: '#CDC4E6', line: 'rgba(255,255,255,.06)', pal: ['#F4F1F8', '#E2C46A', '#B9A9DE', '#FFFFFF'] },
    hinokiboards: { kind: 'plank', a: '#E3CDA6', b: '#D9C29A', line: 'rgba(120,95,55,.22)' },
    mahoganyherring: { kind: 'herring', a: '#5E3A28', b: '#523222', line: 'rgba(20,8,4,.35)' },
    riverslate: { kind: 'stone', a: '#6E6A64', b: '#62605A', line: 'rgba(0,0,0,.28)' },
    whiteherring: { kind: 'herring', a: '#F1EDE6', b: '#E3DCD1', line: 'rgba(120,105,90,.22)' },
    walnutparquet: { kind: 'parquet', a: '#8A5A36', b: '#7A4E2D', line: 'rgba(40,20,8,.32)' },
    paintedpine: { kind: 'plank', a: '#EDE3D0', b: '#E4D8C2', line: 'rgba(120,95,60,.22)' },
    marblecheck: { kind: 'check', a: '#F2EEE6', b: '#26262B', line: 'rgba(0,0,0,.08)' },
    teakdeck: { kind: 'plank', a: '#9C6B45', b: '#8E6040', line: 'rgba(40,25,10,.32)' },
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
    'cloudnine-sky': { pat: 'cloudnine', base: '#CFE8F6' },
    'blossom-mint': { pat: 'blossom', base: '#E4F1E6' }, 'stripe-sun': { pat: 'stripes', base: '#FFF4CC', ink: 'rgba(240,160,60,.5)' },
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
    'constellations': { pat: 'starmap', base: '#232A5C', ink: 'rgba(232,230,255,.9)', ink2: 'rgba(226,196,106,.9)' },
    'clay-plaster': { pat: 'limewash', base: '#C8B496', ink: 'rgba(120,95,60,.07)', ink2: 'rgba(255,245,225,.1)' },
    'damask-rose': { pat: 'damask', base: '#E9D3D0', ink: 'rgba(140,60,70,.32)' },
    'knotty-pine': { pat: 'knotty', base: '#D2A770', ink: 'rgba(110,70,30,.3)', ink2: 'rgba(110,65,25,.55)' },
    'banana-leaf': { pat: 'monstera', base: '#F7F1EC', ink: 'rgba(63,140,92,.85)', ink2: 'rgba(38,104,66,.85)' },
    'starburst-amber': { pat: 'starburst', base: '#F3E6CC', ink: 'rgba(210,105,58,.7)', ink2: 'rgba(63,127,122,.85)' },
    'ditsy-cream': { pat: 'ditsy', base: '#F8F1E1', ink: 'rgba(232,160,168,.9)', pal: ['#E8A0A8', '#F2D98A', '#9DB7D5', '#A9BFA0'] },
    'pinstripe-gold': { pat: 'pinstripe2', base: '#EFE6D2', ink: 'rgba(201,162,74,.6)' },
    limewash: { pat: 'limewash', base: '#E7E0D2', ink: 'rgba(160,145,120,.06)', ink2: 'rgba(255,255,255,.1)' },
    formwork: { pat: 'formwork', base: '#A9A7A2', ink: 'rgba(0,0,0,.14)', ink2: 'rgba(0,0,0,.3)' },
    'nana-sky': { pat: 'ditsy', base: '#F9D8E6', ink: 'rgba(255,255,255,.9)' },
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
  const ROOMLOOK = [{}, {}, {}, {}, {}, {}];
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
    marquee: { name: 'Marquee sign', w: 1.2, h: 0.5, cols: ['#F4C430', '#FF2E9A', '#19E6F0'], tags: 'playful bold vintage',
      // A lightbox that says PLAY in pixels, ringed with bulbs that chase while the power is on.
      draw: (W, o, t) => { const c = o.col || '#F4C430', on = power; W.r(0, 0, 1.2, 0.5, '#15121F'); W.r(0.05, 0.05, 1.15, 0.45, on ? c : shade(c, -0.55));
        const px = 0.05, letters = { P: ['111', '101', '111', '100', '100'], L: ['100', '100', '100', '100', '111'], A: ['111', '101', '111', '101', '101'], Y: ['101', '101', '111', '010', '010'] };
        ['P', 'L', 'A', 'Y'].forEach((ch, i) => { const u0 = 0.22 + i * 0.22; letters[ch].forEach((row, r) => { for (let k = 0; k < 3; k++) if (row[k] === '1') W.r(u0 + k * px, 0.375 - (r + 1) * px, u0 + (k + 1) * px, 0.375 - r * px, on ? '#15121F' : '#2A2535'); }); });
        const step = Math.floor(t * 6); for (let k = 0; k <= 12; k++) { const u = 0.05 + k * (1.1 / 12), lit = on && (k + step) % 3 === 0; [0.025, 0.475].forEach((z) => W.circ(u, z, 0.018, lit ? '#FFF6C8' : on ? '#F4C430' : '#4A4036')); } } },
    pixelprint: { name: 'Pixel art print', w: 0.7, h: 0.7, cols: ['#19E6F0', '#FF2E9A', '#39D353'], tags: 'playful bold vintage',
      // A framed pixel invader with a pixel heart in the corner.
      draw: (W, o) => { const c = o.col || '#19E6F0'; W.r(0, 0, 0.7, 0.7, '#15121F', 'rgba(255,255,255,.45)'); W.r(0.05, 0.05, 0.65, 0.65, '#1E1A2E', 'rgba(255,255,255,.25)'); const px = 0.05;
        INVADER.forEach((row, r) => { for (let k = 0; k < row.length; k++) if (row[k] === '1') W.r(0.175 + k * px, 0.55 - (r + 1) * px, 0.175 + (k + 1) * px, 0.55 - r * px, c); });
        PIXHEART.forEach((row, r) => { for (let k = 0; k < row.length; k++) if (row[k] === '1') W.r(0.5 + k * 0.03, 0.2 - (r + 1) * 0.03, 0.5 + (k + 1) * 0.03, 0.2 - r * 0.03, '#FF2E9A'); }); } },
    rainbowarch: { name: 'Rainbow arch', w: 1.2, h: 0.7, cols: ['#F58A8A', '#AEDDF7'], tags: 'soft playful cozy',
      // A rainbow between two clouds.
      draw: (W) => { CC.bands.forEach((c, k) => { const r = 0.52 - k * 0.06, pts = []; for (let i = 0; i <= 16; i++) { const a = Math.PI * i / 16; pts.push([0.6 - Math.cos(a) * r, 0.1 + Math.sin(a) * r]); } W.pl(pts, c, 5); });
        [[0.14, 0.12], [1.06, 0.12]].forEach(([u, z]) => { W.e(u, z, 0.13, 0.08, '#FFFFFF'); W.e(u - 0.08, z + 0.03, 0.07, 0.06, '#FFFFFF'); W.e(u + 0.08, z + 0.04, 0.07, 0.06, '#FFFFFF'); W.e(u, z + 0.08, 0.08, 0.07, '#FFFFFF'); }); } },
    cloudlight: { name: 'Cloud night light', w: 0.7, h: 0.45, cols: ['#FFFFFF', '#F9E27A'], tags: 'soft playful cozy',
      // A cloud that glows with the power on, with three stars that twinkle.
      draw: (W, o, t) => { const on = power, c = on ? '#FFFDF2' : '#E4ECF6'; if (on) W.e(0.35, 0.2, 0.42, 0.3, 'rgba(255,241,201,.22)'); W.e(0.35, 0.16, 0.3, 0.12, c); W.e(0.2, 0.2, 0.14, 0.13, c); W.e(0.38, 0.26, 0.17, 0.16, c); W.e(0.54, 0.2, 0.13, 0.12, c);
        [[0.08, 0.4, 0], [0.62, 0.42, 1], [0.1, 0.06, 2]].forEach(([u, z, k]) => { const tw = on ? 0.5 + Math.sin(t * 3 + k * 2) * 0.5 : 0; W.circ(u, z, 0.018 + tw * 0.01, on ? '#F9E27A' : '#C9D3E0'); }); } },
    neonbolt: { name: 'Neon bolt', w: 0.6, h: 0.9, cols: ['#19E6F0', '#FF2E9A', '#FFB020'], tags: 'bold modern industrial',
      // A lightning bolt in neon tube that flickers now and then while the power is on.
      draw: (W, o, t) => { const c = o.col || '#19E6F0', on = power && Math.sin(t * 17) > -0.92, pts = [[0.38, 0.9], [0.14, 0.48], [0.3, 0.48], [0.2, 0.0], [0.5, 0.46], [0.34, 0.46]];
        W.r(0.02, 0.02, 0.58, 0.88, 'rgba(0,0,0,.25)'); if (on) { W.p(pts, hexA(c, 0.18)); W.p(pts, null, hexA(c, 0.5)); } W.p(pts, on ? c : shade(c, -0.55), on ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.15)'); } },
    holoposter: { name: 'Holo poster', w: 0.8, h: 1.1, cols: ['#111118', '#19E6F0', '#FF2E9A'], tags: 'bold modern industrial',
      // A dark panel of circuit lines and scanlines with a magenta ring and a cyan diamond; a scan bar rolls down it with the power on.
      draw: (W, o, t) => { const on = power; W.r(0, 0, 0.8, 1.1, '#111118', NE.steel); for (let z = 0.08; z < 1.05; z += 0.08) W.l([0.04, z], [0.76, z], 'rgba(255,255,255,.05)', 1);
        for (let u = 0.15; u < 0.8; u += 0.25) W.l([u, 0.05], [u, 1.05], on ? hexA(NE.cyan, 0.5) : 'rgba(25,230,240,.15)', 1); for (let z = 0.2; z < 1.05; z += 0.3) W.l([0.05, z], [0.75, z], on ? hexA(NE.cyan, 0.5) : 'rgba(25,230,240,.15)', 1);
        if (on) { const yy = 0.15 + ((t * 0.15) % 0.8); W.r(0.04, yy, 0.76, yy + 0.04, 'rgba(25,230,240,.25)'); }
        W.e(0.4, 0.6, 0.18, 0.18, null, on ? NE.magenta : shade(NE.magenta, -0.5)); W.e(0.4, 0.6, 0.1, 0.1, on ? hexA(NE.magenta, 0.5) : '#2A1A24'); W.p([[0.4, 0.35], [0.56, 0.6], [0.4, 0.85], [0.24, 0.6]], null, on ? NE.cyan : shade(NE.cyan, -0.5)); } },
    stainedglass: { name: 'Stained glass panel', w: 0.7, h: 1.1, cols: ['#8E2E3C', '#2E4C9A', '#C9A24A'], tags: 'luxe vintage cozy',
      // A pointed-arch panel of coloured panes with lead lines; the panes glow with the power on.
      draw: (W) => { const on = power, pts = [[0.05, 0.05], [0.65, 0.05], [0.65, 0.7]]; for (let k = 1; k <= 8; k++) { const a = Math.PI * k / 8; pts.push([0.35 + Math.cos(a) * 0.3, 0.7 + Math.sin(a) * 0.36]); } pts.push([0.05, 0.7]);
        W.p(pts, '#2A2224'); const pane = (poly, col) => W.p(poly, on ? col : shade(col, -0.45), 'rgba(20,15,20,.8)');
        pane([[0.1, 0.1], [0.35, 0.1], [0.35, 0.45], [0.1, 0.45]], GO.panes[0]); pane([[0.35, 0.1], [0.6, 0.1], [0.6, 0.45], [0.35, 0.45]], GO.panes[1]); pane([[0.1, 0.45], [0.35, 0.45], [0.35, 0.72], [0.1, 0.72]], GO.panes[2]); pane([[0.35, 0.45], [0.6, 0.45], [0.6, 0.72], [0.35, 0.72]], GO.panes[3]);
        pane([[0.1, 0.72], [0.6, 0.72], [0.6, 0.8], [0.35, 1.0], [0.1, 0.8]], GO.panes[1]); W.e(0.35, 0.78, 0.1, 0.1, on ? GO.panes[2] : shade(GO.panes[2], -0.45), 'rgba(20,15,20,.8)'); W.e(0.35, 0.78, 0.04, 0.04, on ? '#FFF1C9' : GO.panes[0]);
        W.l([0.1, 0.28], [0.6, 0.28], 'rgba(20,15,20,.6)', 1); W.l([0.22, 0.1], [0.22, 0.72], 'rgba(20,15,20,.6)', 1); W.l([0.48, 0.1], [0.48, 0.72], 'rgba(20,15,20,.6)', 1); if (on) W.p(pts, 'rgba(255,230,180,.08)'); } },
    sconce: { name: 'Candle sconce', w: 0.4, h: 0.6, cols: ['#2A2224', '#B08D57'], tags: 'luxe vintage cozy',
      // An iron bracket holding two candles whose flames waver.
      draw: (W, o, t) => { const c = o.col || '#2A2224'; W.l([0.2, 0.0], [0.2, 0.3], c, 2.4); W.pl([[0.2, 0.3], [0.08, 0.34], [0.06, 0.4]], c, 2); W.pl([[0.2, 0.3], [0.32, 0.34], [0.34, 0.4]], c, 2); W.e(0.2, 0.05, 0.05, 0.03, GO.brass);
        [0.06, 0.34].forEach((u, k) => { W.r(u - 0.03, 0.4, u + 0.03, 0.52, '#F6EFE0'); const fl = Math.sin(t * 9 + k * 2) * 0.008; W.e(u, 0.55 + fl, 0.02, 0.035 + fl, 'rgba(255,190,80,.95)'); W.e(u, 0.545, 0.01, 0.018, 'rgba(255,246,210,.95)'); W.e(u, 0.55, 0.06, 0.07, 'rgba(255,200,120,.14)'); }); } },
    lollipops: { name: 'Lollipop wall', w: 1.0, h: 0.8, cols: ['#F6B7CC', '#BFE8D6', '#D6C4F0'], tags: 'soft playful warm',
      // Three lollipops crossed, each with a white swirl.
      draw: (W) => { [[0.22, 0.6, CA.pink, 0.1], [0.5, 0.65, CA.mint, 0], [0.78, 0.6, CA.lilac, -0.1]].forEach(([u, z, col, lean]) => { W.l([u + lean * 2, 0.02], [u, z], '#FFFFFF', 3); W.e(u, z, 0.14, 0.14, col, 'rgba(0,0,0,.08)'); const pts = []; for (let a = 0; a < Math.PI * 4; a += 0.25) pts.push([u + Math.cos(a) * a * 0.01, z + Math.sin(a) * a * 0.01]); W.pl(pts, 'rgba(255,255,255,.85)', 1.6); W.e(u - 0.05, z + 0.05, 0.03, 0.02, 'rgba(255,255,255,.6)'); }); } },
    candysign: { name: 'Sweet shop sign', w: 1.1, h: 0.5, cols: ['#F6B7CC', '#FFF8F0', '#E04A6A'], tags: 'soft playful warm',
      // A pink sign with a scalloped top, a cupcake on it and bulbs that chase along the bottom.
      draw: (W, o, t) => { const c = o.col || '#F6B7CC', on = power; W.r(0, 0.08, 1.1, 0.42, c, 'rgba(0,0,0,.08)'); for (let u = 0.08; u < 1.1; u += 0.16) W.e(u, 0.42, 0.08, 0.06, c);
        W.r(0.38, 0.14, 0.52, 0.26, CA.butter); W.e(0.45, 0.3, 0.09, 0.06, '#FFFFFF'); W.e(0.45, 0.34, 0.06, 0.05, '#FFFFFF'); W.circ(0.45, 0.4, 0.02, CA.cherry);
        W.e(0.72, 0.26, 0.09, 0.09, CA.mint, 'rgba(0,0,0,.08)'); W.e(0.72, 0.26, 0.04, 0.04, 'rgba(255,255,255,.7)'); W.r(0.12, 0.18, 0.26, 0.34, CA.lilac, 'rgba(0,0,0,.08)'); W.l([0.12, 0.26], [0.26, 0.26], 'rgba(255,255,255,.6)', 1);
        const step = Math.floor(t * 6); for (let k = 0; k <= 10; k++) { const u = 0.05 + k * 0.1, lit = on && (k + step) % 3 === 0; W.circ(u, 0.04, 0.018, lit ? '#FFF6C8' : on ? CA.butter : '#C9B8A8'); } } },
    tikimasks: { name: 'Tiki masks', w: 0.9, h: 0.9, cols: ['#8A5A3A', '#D9BE82', '#F08AA0'], tags: 'playful natural bold',
      // Two carved wooden masks with cream eyes and a pink feather each.
      draw: (W, o) => { const c = o.col || '#8A5A3A'; [[0.24, 0.0], [0.66, 0.1]].forEach(([u, dz], k) => { const z = 0.1 + dz; W.p([[u - 0.18, z], [u + 0.18, z], [u + 0.2, z + 0.5], [u, z + 0.62], [u - 0.2, z + 0.5]], c, 'rgba(0,0,0,.25)'); W.p([[u - 0.1, z + 0.36], [u - 0.03, z + 0.4], [u - 0.1, z + 0.44]], '#F7F1E3'); W.p([[u + 0.1, z + 0.36], [u + 0.03, z + 0.4], [u + 0.1, z + 0.44]], '#F7F1E3');
        W.r(u - 0.1, z + 0.12, u + 0.1, z + 0.2, '#F7F1E3'); for (let x = u - 0.08; x < u + 0.1; x += 0.04) W.l([x, z + 0.12], [x, z + 0.2], c, 1); W.l([u - 0.14, z + 0.28], [u + 0.14, z + 0.28], 'rgba(0,0,0,.3)', 1); W.e(u + (k ? -0.1 : 0.1), z + 0.68, 0.03, 0.09, TR.pink, null); W.e(u, z + 0.66, 0.03, 0.08, TR.coral, null); }); } },
    flamingoneon: { name: 'Flamingo neon', w: 0.7, h: 0.9, cols: ['#F08AA0', '#19E6F0', '#F9E27A'], tags: 'playful natural bold',
      // A flamingo in pink neon tube on a dark board, glowing with the power on.
      draw: (W, o, t) => { const c = o.col || '#F08AA0', on = power && Math.sin(t * 11) > -0.95; W.r(0.02, 0.02, 0.68, 0.88, 'rgba(0,0,0,.25)');
        const body = [[0.2, 0.3], [0.28, 0.22], [0.42, 0.22], [0.5, 0.32], [0.46, 0.42], [0.34, 0.46], [0.22, 0.42], [0.18, 0.36], [0.2, 0.3]], neck = [[0.44, 0.42], [0.5, 0.56], [0.48, 0.7], [0.4, 0.78], [0.3, 0.78], [0.26, 0.72]], legs = [[0.32, 0.22], [0.32, 0.08], [0.26, 0.04]], leg2 = [[0.38, 0.22], [0.38, 0.12]];
        [body, neck, legs, leg2].forEach((pts) => { if (on) W.pl(pts, hexA(c, 0.35), 6); W.pl(pts, on ? c : shade(c, -0.5), 2); if (on) W.pl(pts, 'rgba(255,255,255,.6)', 0.8); }); W.e(0.42, 0.75, 0.025, 0.025, on ? '#111118' : '#2A2F3A'); W.l([0.26, 0.72], [0.22, 0.66], on ? '#111118' : '#2A2F3A', 2); } },
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
  // Wall pieces taken down in Arrange: off the wall, still the player's, saved with the house.
  const WALLSTORE = [];
  let wallSeq = 0;
  const wallId = () => `wall-${++wallSeq}-${(Date.now() + wallSeq * 7919) & 0xffff}`;
  /** Whether a wall piece sits clear of the others on its wall and of the windows and doors (with a little air round each). */
  function wallClear(w) {
    const T = WTYPES[w.type]; if (!T) return false;
    const over = (a0, a1, b0, b1, pad) => !(a1 + pad < b0 || a0 > b1 + pad);
    if (WALLOBJS.some((o) => o !== w && o.level === w.level && o.p === w.p && WTYPES[o.type] && over(w.u, w.u + T.w, o.u, o.u + WTYPES[o.type].w, 0.1) && over(w.z, w.z + T.h, o.z, o.z + WTYPES[o.type].h, 0.1))) return false;
    return !(LEVELS[w.level].feats || []).some((f) => f.p === w.p && Array.isArray(f.u) && Array.isArray(f.z) && over(w.u, w.u + T.w, f.u[0], f.u[1], 0.1) && over(w.z, w.z + T.h, f.z[0], f.z[1], 0.1));
  }
  /** Hangs a bought wall piece on one of the level's back walls, at eye height, on the first free stretch nearest the middle. */
  function hangWallObj(level, type, col, id) {
    const T = WTYPES[type]; if (!T) return false;
    const z = Math.max(0.9, Math.min(WH - T.h - 0.15, 1.55 - T.h / 2));
    const piece = { id: id || wallId(), type, level, p: 'B', u: 0, z, col };
    // The long back wall first, from its middle outward; then the side wall from its far corner (the stairs take its near end).
    for (const pl of ['B', 'L']) {
      const len = planeLen(pl), mid = (len - T.w) / 2, cands = [];
      if (pl === 'B') for (let d = 0; mid - d >= 0.3; d += 0.25) { cands.push(mid - d); if (d > 0 && mid + d <= len - T.w - 0.3) cands.push(mid + d); }
      else for (let u = 0.4; u <= len - T.w - 0.3; u += 0.25) cands.push(u);
      for (const u of cands) { piece.p = pl; piece.u = u; if (wallClear(piece)) { WALLOBJS.push(piece); return true; } }
    }
    piece.p = BACK[0][1]; piece.u = (planeLen(BACK[0][1]) - T.w) / 2;
    WALLOBJS.push(piece);
    return true;
  }
  // ---- Wall pieces in Arrange: find one under the pointer, slide it along its wall, take it down, hang it again ----
  const wallQuad = (w) => { const T = WTYPES[w.type]; return [[0, 0], [T.w, 0], [T.w, T.h], [0, T.h]].map(([du, dz]) => iso(...wallPoint(w.p, w.u + du, w.z + dz))); };
  const wallName = (w) => (WTYPES[w.type] ? WTYPES[w.type].name : w.type);
  /** The wall pieces on a level, on the walls the view shows, for the Arrange list. */
  function wallObjsOn(level) { return WALLOBJS.filter((w) => w.level === level && WTYPES[w.type]).map((w) => ({ id: w.id, type: w.type, name: wallName(w), level: w.level, p: w.p, u: w.u, z: w.z, col: w.col, shown: BACK[VR].includes(w.p) })); }
  /** Every wall piece in the house, for the Arrange list. */
  function wallObjsAll() { return WALLOBJS.filter((w) => WTYPES[w.type]).map((w) => ({ id: w.id, type: w.type, name: wallName(w), level: w.level, col: w.col })); }
  /** The id of the wall piece under a view point on the walls the view shows, if any. */
  function hitWallObj(level, sx, sy) { let hit = null; WALLOBJS.forEach((w) => { if (w.level === level && WTYPES[w.type] && BACK[VR].includes(w.p) && inPoly(sx, sy, wallQuad(w))) hit = w; }); return hit ? hit.id : null; }
  /** The view point at a wall piece's centre, for framing and tests. */
  function wallObjView(id) { const w = WALLOBJS.find((x) => x.id === id); if (!w || !WTYPES[w.type]) return null; const T = WTYPES[w.type]; return iso(...wallPoint(w.p, w.u + T.w / 2, w.z + T.h / 2)); }
  /** Slides a wall piece so its centre follows a view point (less where it was grabbed), kept on its wall and off the floor and ceiling. */
  function moveWallObj(id, sx, sy, grab = [0, 0]) {
    const w = WALLOBJS.find((x) => x.id === id); if (!w || !WTYPES[w.type]) return false;
    const T = WTYPES[w.type];
    // The wall is a plane in view space: a point on it is p0 + u * au + z * az. Solve the two for the point under the pointer.
    const p0 = iso(...wallPoint(w.p, 0, 0)), pu = iso(...wallPoint(w.p, 1, 0)), pz = iso(...wallPoint(w.p, 0, 1));
    const au = [pu[0] - p0[0], pu[1] - p0[1]], az = [pz[0] - p0[0], pz[1] - p0[1]];
    const det = au[0] * az[1] - au[1] * az[0]; if (Math.abs(det) < 1e-6) return false;
    const dx = sx - grab[0] - p0[0], dy = sy - grab[1] - p0[1];
    const u = (dx * az[1] - dy * az[0]) / det - T.w / 2, z = (au[0] * dy - au[1] * dx) / det - T.h / 2;
    w.u = Math.max(0.1, Math.min(planeLen(w.p) - T.w - 0.1, u));
    w.z = Math.max(0.3, Math.min(WH - T.h - 0.1, z));
    return true;
  }
  const wallObjClear = (id) => { const w = WALLOBJS.find((x) => x.id === id); return !!w && wallClear(w); };
  /** Takes a wall piece down into storage. Returns its name, or null. */
  function takeDownWallObj(id) { const i = WALLOBJS.findIndex((x) => x.id === id); if (i < 0) return null; const [w] = WALLOBJS.splice(i, 1); WALLSTORE.push(w); return wallName(w); }
  function storedWallObjs() { return WALLSTORE.map((w) => ({ id: w.id, type: w.type, name: wallName(w), col: w.col })); }
  /** Hangs a stored wall piece on a level's back wall again. */
  function rehangWallObj(id, level) { const i = WALLSTORE.findIndex((x) => x.id === id); if (i < 0) return false; const w = WALLSTORE[i]; if (!hangWallObj(level, w.type, w.col, w.id)) return false; WALLSTORE.splice(i, 1); return true; }
  function drawWallDecor(level, back) { WALLOBJS.forEach(w => { if (w.level === level && back.includes(w.p) && !(arranging && arr.wHold === w)) drawWallObj(w); }); }

  const PARCEL = { stand: [1.5, 6.0], box: [0.55, 5.75] };
  function roomName(level, x, y) { x = Math.min(9.99, Math.max(0.01, x)); y = Math.min(7.99, Math.max(0.01, y)); const r = LEVELS[level].rooms.find(rm => x >= rm.r[0] && x <= rm.r[2] && y >= rm.r[1] && y <= rm.r[3]); return r ? r.n : LEVEL_NAMES[level]; }

  const C = { sofa: '#4F6F74', cushion: '#5E8187', wood: '#9C6B45', dark: '#7A5236', plum: '#7E4458' };
  const B = (x, y, z, w, d, h, c, f = {}) => Object.assign({ box: [x, y, z, w, d, h], c }, f);
  const F = (x1, y1, x2, y2, fn, f = {}) => Object.assign({ rect: [x1, y1, x2, y2], fn }, f);
  const doing = (ch, name) => ch.task && ch.task.name === name && ch.task.phase === 'do';
  // A desk's screen lights while someone sits in the chair tucked in at it (the chairs are pieces of their own).
  const deskInUse = (o, wide = 0.6, deep = 1.5) => OBJS.some(c => (c.type === 'officechair' || c.type === 'bosschair') && c.level === o.level && Math.abs(c.x + (c.type === 'bosschair' ? 0.45 : 0.3) - (o.x + (o.type === 'bossdesk' ? 1.0 : 0.6))) < wide + (o.type === 'bossdesk' ? 0.5 : 0) && Math.abs(c.y - o.y) < deep && usingSlot(c.id + ':s'));
  const usingSlot = (sid, names) => [jordan, maya, ...others].some(c => c.task && c.task.phase === 'do' && c.task.slot === sid && (!names || names.includes(c.task.name)));
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
  // Pillows drawn as one part over the whole mattress, so the depth sort always puts them after (on top of) the mattress.
  const pillowsOn = (mattress, boxes) => F(mattress[0], mattress[1], mattress[0] + mattress[3], mattress[1] + mattress[4], (T) => boxes.forEach(([x, y, z, w, d, h, c]) => T.box(x, y, z, w, d, h, c)), { onTop: true });
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

  // Spa Retreat: oiled teak, honed limestone, sage linen and steam.
  const SP = { teak: '#9C6B45', teakDark: '#7A5236', teakLite: '#B98A62', stone: '#D8D0C2', stoneDark: '#BFB5A4', linen: '#EEEAE0', sage: '#9DB3A5', white: '#F6F4EE' };
  const slats = (T, x0, x1, y, z0, z1, n, col) => { for (let k = 0; k <= n; k++) { const x = x0 + (x1 - x0) * k / n; T.line([x, y, z0], [x, y, z1], col, 1); } };
  Object.assign(LOOK_DRAWERS.bed, {
    // A low teak platform wider than the mattress, a slatted teak panel behind, sage linen and a folded throw.
    spa: (o) => { const c = cl(o); return [
      B(0, 0, 0, 0.1, 1.6, 0.85, SP.teak), B(0.1, 0, 0, 2.4, 1.6, 0.18, SP.teakDark), B(0.1, 0, 0.18, 2.4, 1.6, 0.04, SP.teak),
      B(0.2, 0.1, 0.22, 0.75, 1.4, 0.24, SP.linen, { name: 'mattress' }),
      B(0.26, 0.16, 0.46, 0.46, 0.54, 0.12, SP.white), B(0.26, 0.9, 0.46, 0.46, 0.54, 0.12, SP.white),
      // The linen over the foot of the bed is its own block, so it shows with nobody in it (see the brutalist bed).
      B(0.95, 0.08, 0.22, 1.45, 1.44, 0.24, c), B(0.95, 0.08, 0.46, 1.45, 1.44, 0.02, shade(c, 0.05), { cover: true }),
      B(1.95, 0.05, 0.22, 0.32, 1.5, 0.28, shade(c, -0.2)),
      F(0, 0, 0.11, 1.6, (T) => { for (let k = 1; k < 12; k++) T.line([0.101, 1.6 * k / 12, 0.05], [0.101, 1.6 * k / 12, 0.85], 'rgba(40,25,10,.3)', 1); }, { onTop: true })]; },
  });
  Object.assign(LOOK_DRAWERS.nightstand, {
    // A floating teak box with a limestone top, a pebble dish and a paper globe that glows.
    spa: (T, o) => { const lit = isLit(o.id);
      T.box(0.04, 0.04, 0.18, 0.37, 0.37, 0.28, SP.teak); T.box(0.02, 0.02, 0.46, 0.41, 0.41, 0.04, SP.stone);
      T.line([0.06, 0.411, 0.32], [0.39, 0.411, 0.32], 'rgba(40,25,10,.35)', 1);
      const [dx, dy] = T.P(0.3, 0.3, 0.51); ell(dx, dy, 5, 2.5, SP.stoneDark); circle(dx - 1, dy - 1, 1.2, '#8E8A84'); circle(dx + 2, dy, 1, '#6E6A64');
      const [gx, gy] = T.P(0.15, 0.15, 0.68); if (lit) circle(gx, gy, 13, 'rgba(255,236,200,.28)'); circle(gx, gy, 8, lit ? '#FFF2DA' : SP.white, 'rgba(0,0,0,.12)'); },
  });
  Object.assign(LOOK_DRAWERS.dresser, {
    // A floating teak dresser with slatted fronts, a stone tray and a sprig of eucalyptus in a jar.
    spa: (T, o) => { const c = cl(o);
      T.box(0, 0, 0.12, 1.2, 0.5, 0.72, c); slats(T, 0.03, 1.17, 0.501, 0.16, 0.8, 22, 'rgba(40,25,10,.28)'); T.line([0, 0.502, 0.48], [1.2, 0.502, 0.48], 'rgba(40,25,10,.45)', 1.2);
      T.box(0.02, 0.02, 0.84, 1.16, 0.46, 0.03, SP.stone); T.box(0.15, 0.12, 0.87, 0.36, 0.22, 0.02, SP.stoneDark);
      T.box(0.85, 0.18, 0.87, 0.1, 0.1, 0.16, 'rgba(220,235,230,.7)'); for (let k = 0; k < 4; k++) T.line([0.9, 0.23, 1.0], [0.84 + k * 0.05, 0.2 + (k % 2) * 0.06, 1.24 - (k % 2) * 0.05], SP.sage, 1.6); },
  });
  Object.assign(LOOK_DRAWERS.toilet, {
    // A soft white rimless bowl with a teak seat, and a limestone ledge behind with a rolled towel.
    spa: (T, o) => {
      T.box(0, 0, 0.62, 0.42, 0.16, 0.06, SP.stone); T.box(0.06, 0.02, 0.68, 0.3, 0.1, 0.07, SP.sage);
      T.box(0.06, 0, 0, 0.3, 0.16, 0.62, SP.white); T.box(0.09, 0.14, 0, 0.24, 0.3, 0.3, SP.white);
      const [bx, by] = T.P(0.21, 0.4, 0.3); ell(bx, by, 7, 5.5, SP.white, 'rgba(0,0,0,.1)'); const [sx, sy] = T.P(0.21, 0.38, 0.385); ell(sx, sy, 7, 4, SP.teak); ell(sx, sy, 5, 2.8, '#E8EEF0');
      if (live(T.o.id)) { ell(sx, sy, 4.5, 2.5, '#BFE2F0'); ctx.strokeStyle = 'rgba(90,150,200,.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(sx, sy, 3, 1.6, animT * 9, 0, Math.PI * 1.4); ctx.stroke(); } },
  });
  Object.assign(LOOK_DRAWERS.vanity, {
    // A floating teak vanity with a stone vessel basin, a tall spout and a stack of rolled towels underneath.
    spa: (T, o) => {
      T.box(0, 0.02, 0.4, 1.0, 0.46, 0.38, SP.teak); slats(T, 0.03, 0.97, 0.481, 0.43, 0.75, 16, 'rgba(40,25,10,.28)');
      T.box(-0.02, 0, 0.78, 1.04, 0.5, 0.04, SP.stone);
      [[0.2, 0.25], [0.42, 0.25], [0.31, 0.25]].forEach(([x, y], k) => { const [tx, ty] = T.P(x, y, k === 2 ? 0.2 : 0.08); ell(tx, ty, 5, 4, k === 2 ? SP.sage : SP.white, 'rgba(0,0,0,.12)'); });
      const [vx, vy] = T.P(0.5, 0.26, 0.86); ell(vx, vy + 2, 10, 6, SP.stoneDark); ell(vx, vy, 10, 5, SP.stone); ell(vx, vy, 7, 3.4, '#C7D9DC');
      T.line([0.5, 0.03, 0.82], [0.5, 0.03, 1.02], SP.teakDark, 2.2); T.line([0.5, 0.03, 1.02], [0.5, 0.16, 1.02], SP.teakDark, 2.2); },
  });
  Object.assign(LOOK_DRAWERS.shower, {
    // A rain shower behind glass on a pebble floor, a limestone back wall with a niche, a teak bench and a bamboo in the corner.
    // Steam comes up thick while it runs.
    spa: (o) => [F(0, 0, 1.18, 1.18, (T) => {
        T.box(0, 0, 0, 1.18, 1.18, 0.06, SP.stoneDark);
        for (let k = 0; k < 26; k++) { const [px, py] = T.P(0.08 + ((k * 0.61) % 1.02), 0.15 + ((k * 0.37) % 0.98), 0.061); ell(px, py, 1.6, 1, ['#CFC6B6', '#BDB3A2', '#E2DACB'][k % 3]); }
        T.box(0, 0, 0.06, 1.18, 0.08, 2.04, SP.stone); T.poly([[0.75, 0.081, 1.0], [1.05, 0.081, 1.0], [1.05, 0.081, 1.3], [0.75, 0.081, 1.3]], SP.stoneDark);
        T.box(0.8, 0.05, 1.0, 0.08, 0.04, 0.12, SP.sage); T.box(0.95, 0.05, 1.0, 0.06, 0.04, 0.09, SP.white);
        T.box(0.1, 0.1, 0.06, 0.24, 0.9, 0.04, SP.teak); T.box(0.1, 0.1, 0.4, 0.24, 0.9, 0.04, SP.teak); [[0.12, 0.12], [0.12, 0.96]].forEach(([x, y]) => T.box(x, y, 0.1, 0.2, 0.04, 0.3, SP.teakDark));
        T.line([0.6, 0.08, 2.08], [0.6, 0.45, 2.08], '#B9BEC3', 2); const [hx, hy] = T.P(0.6, 0.5, 2.06); ell(hx, hy, 9, 4.5, '#B9BEC3');
        const on = usingSlot(T.o.id + ':s') || live(T.o.id);
        if (on) { steamAt(T, 0.6, 0.6, 0.9, 0, 9, 1.3); steamAt(T, 0.4, 0.8, 1.5, 0, 6, 1.1); steamAt(T, 0.8, 0.4, 1.2, 0, 6, 1.1); const [wx, wy] = T.W(0.6, 0.5); PFX.emit(T.o.id + ':splash', 'splash', T.o.level, wx, wy, 1.95, 1); }
        T.box(1.0, 1.0, 0.06, 0.14, 0.14, 0.18, SP.stoneDark); [[1.05, 0.0], [1.09, 0.25], [1.12, 0.1]].forEach(([x, dz]) => { T.line([x, 1.07, 0.24], [x, 1.07, 1.5 + dz], '#7FA06A', 2.2); [0.7, 1.0, 1.3].forEach((z) => { const [lx, ly] = T.P(x, 1.07, z + dz); ell(lx - 4, ly - 1, 5, 1.6, '#8DB06E', null, -0.4); }); });
      }, { name: 'tray' }),
      F(0, 1.16, 1.18, 1.2, (T) => { const fog = usingSlot(T.o.id + ':s') || live(T.o.id); T.poly([[0, 1.18, 0.06], [1.18, 1.18, 0.06], [1.18, 1.18, 2.08], [0, 1.18, 2.08]], fog ? 'rgba(235,240,240,.55)' : 'rgba(200,226,232,.2)', 'rgba(185,190,195,.8)', 1); T.line([0.2, 1.18, 1.9], [0.65, 1.18, 1.2], 'rgba(255,255,255,.55)', 2); T.line([0, 1.18, 2.08], [1.18, 1.18, 2.08], 'rgba(185,190,195,.9)', 1.6); }),
      F(1.16, 0, 1.2, 1.18, (T) => { const fog = usingSlot(T.o.id + ':s') || live(T.o.id); T.poly([[1.18, 0.08, 0.06], [1.18, 1.18, 0.06], [1.18, 1.18, 2.08], [1.18, 0.08, 2.08]], fog ? 'rgba(235,240,240,.5)' : 'rgba(200,226,232,.18)', 'rgba(185,190,195,.8)', 1); T.line([1.18, 0.08, 2.08], [1.18, 1.18, 2.08], 'rgba(185,190,195,.9)', 1.6); }, { onTop: true })],
  });

  // Grand Hotel: walnut, veined marble, brass and velvet, with crisp white linen.
  const HO = { walnut: '#4A3226', walnutLite: '#6B4A36', marble: '#EFEBE4', vein: 'rgba(120,110,100,.35)', brass: '#C9A24A', brassLite: '#E0C26E', black: '#1E1E22', cream: '#F4EEE2', white: '#FAF8F4' };
  const veins = (T, pts) => pts.forEach(([a, b]) => T.line(a, b, HO.vein, 0.8));
  const knob = (T, x, y, z) => { const [kx, ky] = T.P(x, y, z); circle(kx, ky, 1.6, HO.brass); };
  Object.assign(LOOK_DRAWERS.bed, {
    // A tall channel-tufted velvet headboard edged in brass, a velvet base on a brass trim, a full-length mattress with
    // upright euro shams and two pillows, a white duvet folded back at the top, and a velvet runner across the foot.
    // The mattress runs the whole length (as the stock bed's does) so the base never paints over it.
    hotel: (o) => { const c = cl(o); return [
      // The headboard and its channels in one part, so the pillows in front of it cover the channel lines.
      F(0, 0, 0.16, 1.6, (T) => { T.box(0, 0, 0, 0.16, 1.6, 1.45, shade(c, -0.08)); for (let k = 1; k < 10; k++) T.line([0.161, 1.6 * k / 10, 0.2], [0.161, 1.6 * k / 10, 1.38], 'rgba(0,0,0,.25)', 1.2); }),
      B(0.16, 0.02, 0, 2.34, 1.56, 0.04, HO.brass), B(0.16, 0.02, 0.04, 2.34, 1.56, 0.3, c),
      B(0.18, 0.05, 0.34, 2.3, 1.5, 0.18, HO.cream, { name: 'mattress' }),
      // Euro shams upright against the headboard and pillows in front, each pair spanning the mattress edge to edge.
      pillowsOn([0.18, 0.05, 0.34, 2.3, 1.5], [[0.16, 0.05, 0.52, 0.16, 0.74, 0.32, HO.white], [0.16, 0.81, 0.52, 0.16, 0.74, 0.32, HO.white], [0.32, 0.05, 0.52, 0.4, 0.74, 0.12, HO.white], [0.32, 0.81, 0.52, 0.4, 0.74, 0.12, HO.white]]),
      B(0.9, 0.05, 0.52, 1.58, 1.5, 0.06, HO.white), B(0.9, 0.05, 0.58, 1.58, 1.5, 0.01, HO.white, { cover: true }),
      // The brass frame round the headboard: a cap along the top and a post at each end, as boxes so the pillows sort in front.
      B(-0.01, -0.01, 1.45, 0.18, 1.62, 0.035, HO.brass), B(-0.01, -0.01, 0.04, 0.18, 0.035, 1.41, HO.brass), B(-0.01, 1.575, 0.04, 0.18, 0.035, 1.41, HO.brass),
      F(0.9, 0.04, 2.5, 1.56, (T) => {
        T.poly([[0.9, 0.05, 0.591], [1.06, 0.05, 0.591], [1.06, 1.55, 0.591], [0.9, 1.55, 0.591]], '#E9E4DA'); T.line([1.06, 0.05, 0.592], [1.06, 1.55, 0.592], 'rgba(0,0,0,.12)', 1);
        T.poly([[1.9, 0.03, 0.592], [2.2, 0.03, 0.592], [2.2, 1.57, 0.592], [1.9, 1.57, 0.592]], c); T.line([1.9, 0.03, 0.593], [1.9, 1.57, 0.593], HO.brass, 1); T.line([2.2, 0.03, 0.593], [2.2, 1.57, 0.593], HO.brass, 1);
        T.poly([[1.9, 1.57, 0.592], [2.2, 1.57, 0.592], [2.2, 1.57, 0.4], [1.9, 1.57, 0.4]], shade(c, -0.12)); }, { onTop: true })]; },
  });
  Object.assign(LOOK_DRAWERS.nightstand, {
    // A walnut bedside chest with a marble top and brass pulls, and a brass lamp with a pleated shade.
    hotel: (T, o) => { const lit = isLit(o.id), c = cl(o);
      [[0.04, 0.04], [0.37, 0.04], [0.04, 0.37], [0.37, 0.37]].forEach(([x, y]) => T.line([x, y, 0], [x, y, 0.1], HO.brass, 1.6));
      T.box(0.02, 0.02, 0.1, 0.41, 0.41, 0.38, c); T.line([0.02, 0.431, 0.3], [0.43, 0.431, 0.3], 'rgba(0,0,0,.35)', 1); knob(T, 0.22, 0.432, 0.4); knob(T, 0.22, 0.432, 0.2);
      T.box(0, 0, 0.48, 0.45, 0.45, 0.03, HO.marble); veins(T, [[[0.05, 0.1, 0.511], [0.3, 0.4, 0.511]]]);
      T.box(0.12, 0.12, 0.51, 0.1, 0.1, 0.03, HO.brass); T.line([0.17, 0.17, 0.54], [0.17, 0.17, 0.74], HO.brass, 1.6);
      const [sx, sy] = T.P(0.17, 0.17, 0.8); if (lit) ell(sx, sy + 6, 14, 8, 'rgba(255,226,168,.3)');
      ctx.beginPath(); ctx.moveTo(sx - 6, sy - 5); ctx.lineTo(sx + 6, sy - 5); ctx.lineTo(sx + 9, sy + 5); ctx.lineTo(sx - 9, sy + 5); ctx.closePath(); ctx.fillStyle = lit ? '#FFF0D2' : HO.cream; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 0.8; ctx.stroke();
      for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(sx + k * 2.4, sy - 5); ctx.lineTo(sx + k * 3.6, sy + 5); ctx.stroke(); } },
  });
  Object.assign(LOOK_DRAWERS.dresser, {
    // A walnut lowboy on brass-capped legs: three rows of drawers with brass bails, a marble top and a vase of roses.
    hotel: (T, o) => { const c = cl(o);
      [[0.05, 0.05], [1.12, 0.05], [0.05, 0.42], [1.12, 0.42]].forEach(([x, y]) => { T.line([x, y, 0.03], [x, y, 0.14], HO.walnut, 3); T.line([x, y, 0], [x, y, 0.03], HO.brass, 3); });
      T.box(0, 0, 0.14, 1.2, 0.5, 0.68, c); [0.37, 0.6].forEach((z) => T.line([0.02, 0.501, z], [1.18, 0.501, z], 'rgba(0,0,0,.35)', 1)); T.line([0.6, 0.501, 0.14], [0.6, 0.501, 0.37], 'rgba(0,0,0,.35)', 1);
      [[0.3, 0.26], [0.9, 0.26], [0.3, 0.49], [0.9, 0.49], [0.3, 0.71], [0.9, 0.71]].forEach(([x, z]) => { const [px, py] = T.P(x, 0.502, z); ctx.strokeStyle = HO.brass; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(px, py - 1, 3, 0.1, Math.PI - 0.1); ctx.stroke(); });
      T.box(-0.02, -0.02, 0.82, 1.24, 0.54, 0.04, HO.marble); veins(T, [[[0.1, 0.05, 0.861], [0.6, 0.45, 0.861]], [[0.7, 0.05, 0.861], [1.1, 0.3, 0.861]]]);
      T.box(0.9, 0.18, 0.86, 0.12, 0.12, 0.2, HO.white); [['#B5243A', -4, -2], ['#C9384E', 0, -5], ['#9E1F33', 4, -1], ['#B5243A', 1, 1]].forEach(([col, dx, dy]) => { const [rx, ry] = T.P(0.96, 0.24, 1.12); circle(rx + dx, ry + dy, 2.6, col); });
      T.box(0.15, 0.15, 0.86, 0.3, 0.2, 0.02, HO.brass); },
  });
  Object.assign(LOOK_DRAWERS.toilet, {
    // A white pedestal toilet with a black seat and a brass lever, under a framed print on the wall.
    hotel: (T, o) => {
      T.box(0.04, 0, 0.36, 0.34, 0.16, 0.38, HO.white); T.box(0.02, -0.01, 0.74, 0.38, 0.18, 0.03, HO.white); T.line([0.06, 0.161, 0.68], [0.13, 0.161, 0.66], HO.brass, 1.8);
      T.box(0.09, 0.16, 0, 0.24, 0.26, 0.32, HO.white); const [bx, by] = T.P(0.21, 0.42, 0.3); ell(bx, by, 7.5, 6, HO.white, 'rgba(0,0,0,.12)');
      const [sx, sy] = T.P(0.21, 0.4, 0.385); ell(sx, sy, 7, 4, HO.black); ell(sx, sy, 5, 2.8, '#E8EEF0');
      if (live(T.o.id)) { ell(sx, sy, 4.5, 2.5, '#BFE2F0'); ctx.strokeStyle = 'rgba(90,150,200,.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(sx, sy, 3, 1.6, animT * 9, 0, Math.PI * 1.4); ctx.stroke(); } },
  });
  Object.assign(LOOK_DRAWERS.vanity, {
    // A walnut vanity with brass knobs under a veined marble top, a deep basin, a brass gooseneck tap and a monogrammed towel.
    hotel: (T, o) => { const c = cl(o);
      T.box(0, 0, 0.08, 1.0, 0.5, 0.72, c); T.box(0.02, 0.02, 0, 0.96, 0.46, 0.08, HO.black);
      T.line([0.5, 0.501, 0.1], [0.5, 0.501, 0.78], 'rgba(0,0,0,.35)', 1); [0.04, 0.54].forEach((x) => T.poly([[x + 0.03, 0.502, 0.16], [x + 0.39, 0.502, 0.16], [x + 0.39, 0.502, 0.72], [x + 0.03, 0.502, 0.72]], null, 'rgba(0,0,0,.25)', 1)); knob(T, 0.44, 0.503, 0.5); knob(T, 0.56, 0.503, 0.5);
      T.box(-0.03, -0.01, 0.8, 1.06, 0.53, 0.05, HO.marble); veins(T, [[[0.0, 0.1, 0.851], [0.4, 0.45, 0.851]], [[0.6, 0.0, 0.851], [1.0, 0.35, 0.851]]]);
      const [vx, vy] = T.P(0.5, 0.27, 0.851); ell(vx, vy, 10, 5, '#DCE6E8', 'rgba(0,0,0,.15)');
      T.line([0.5, 0.04, 0.85], [0.5, 0.04, 1.05], HO.brass, 2.2); T.line([0.5, 0.04, 1.05], [0.5, 0.18, 1.0], HO.brass, 2.2);
      T.box(0.82, 0.28, 0.85, 0.16, 0.2, 0.05, HO.white); T.line([0.82, 0.481, 0.875], [0.98, 0.481, 0.875], HO.brass, 1.2); },
  });
  Object.assign(LOOK_DRAWERS.shower, {
    // Marble walls, a black and white hex floor, a brass rain head and a brass-framed glass door, and a stack of white towels.
    hotel: (o) => [F(0, 0, 1.18, 1.18, (T) => {
        T.box(0, 0, 0, 1.18, 1.18, 0.06, HO.white);
        for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) if ((i * 7 + j * 3) % 5 === 0) { const [hx, hy] = T.P(0.08 + i * 0.13, 0.12 + j * 0.12, 0.061); ell(hx, hy, 2.6, 1.4, HO.black); }
        T.box(0, 0, 0.06, 1.18, 0.08, 2.04, HO.marble); veins(T, [[[0.1, 0.081, 1.8], [0.5, 0.081, 0.9]], [[0.5, 0.081, 0.9], [0.4, 0.081, 0.3]], [[0.8, 0.081, 2.0], [1.1, 0.081, 1.2]]]);
        T.line([0.6, 0.08, 2.08], [0.6, 0.45, 2.08], HO.brass, 2.4); const [hx, hy] = T.P(0.6, 0.5, 2.06); ell(hx, hy, 9, 4.5, HO.brass, shade(HO.brass, -0.3));
        T.line([0.15, 0.081, 1.0], [0.45, 0.081, 1.0], HO.brass, 2);
        if (usingSlot(T.o.id + ':s') || live(T.o.id)) { steamAt(T, 0.6, 0.6, 0.9, 0, 6, 1); steamAt(T, 0.5, 0.75, 1.5, 0, 3, 0.8); const [wx, wy] = T.W(0.6, 0.5); PFX.emit(T.o.id + ':splash', 'splash', T.o.level, wx, wy, 1.95, 1); }
      }, { name: 'tray' }),
      F(0, 1.16, 1.18, 1.2, (T) => { T.poly([[0, 1.18, 0.06], [1.18, 1.18, 0.06], [1.18, 1.18, 2.06], [0, 1.18, 2.06]], 'rgba(200,226,232,.2)', HO.brass, 1.6); T.line([0.59, 1.18, 0.06], [0.59, 1.18, 2.06], HO.brass, 1.4); T.line([0.5, 1.18, 1.0], [0.5, 1.18, 1.3], HO.brass, 2.2); T.line([0.2, 1.18, 1.9], [0.45, 1.18, 1.4], 'rgba(255,255,255,.5)', 2); }),
      F(1.16, 0, 1.2, 1.18, (T) => { T.poly([[1.18, 0, 0.06], [1.18, 1.18, 0.06], [1.18, 1.18, 2.06], [1.18, 0, 2.06]], 'rgba(200,226,232,.18)', HO.brass, 1.6); })],
  });

  // Cottagecore: white iron, painted pine, patchwork, chintz and copper.
  const CO = { cream: '#F6EFDF', sage: '#A9BFA0', rose: '#E8A0A8', butter: '#F2D98A', blue: '#9DB7D5', iron: '#F2F0EA', ironShade: '#D8D4CA', pine: '#C69C6D', copper: '#B87333', lace: 'rgba(255,255,255,.85)' };
  const PATCH = [CO.rose, CO.butter, CO.sage, CO.blue, CO.cream, '#D98C6A'];
  const ditsy = (T, x0, x1, y, z0, z1, n) => { for (let k = 0; k < n; k++) { const [fx, fy] = T.P(x0 + ((k * 0.618) % 1) * (x1 - x0), y, z0 + ((k * 0.382) % 1) * (z1 - z0)); circle(fx, fy, 1.2, PATCH[k % 4]); } };
  Object.assign(LOOK_DRAWERS.bed, {
    // A white iron bedstead (edged darker so it reads against pale walls) with an arched headboard and brass knobs, a
    // ruffled white bed skirt to the floor, plump frilled pillows, and a patchwork quilt that drapes down the side and
    // over the foot.
    cottage: (o) => { const c = cl(o), iron = (T, a, b, w) => { T.line(a, b, '#9C978C', w + 1.2); T.line(a, b, CO.iron, w); }; return [
      F(0, 0, 0.1, 1.6, (T) => { [0.03, 1.57].forEach((y) => { T.box(0.02, y - 0.03, 0, 0.06, 0.06, 1.25, CO.iron); const [kx, ky] = T.P(0.05, y, 1.29); circle(kx, ky, 2.8, '#C9A24A', '#8E6E2A'); });
        const arch = (y) => 1.15 + 0.16 * Math.sin(Math.PI * (y - 0.03) / 1.54);
        for (let k = 0; k < 16; k++) { const y0 = 0.03 + 1.54 * k / 16, y1 = 0.03 + 1.54 * (k + 1) / 16; iron(T, [0.05, y0, arch(y0)], [0.05, y1, arch(y1)], 2.2); }
        iron(T, [0.05, 0.03, 0.52], [0.05, 1.57, 0.52], 2.2);
        for (let k = 1; k < 9; k++) { const y = 1.6 * k / 9; iron(T, [0.05, y, 0.52], [0.05, y, arch(y)], 1.2); } }),
      // The bed skirt: white with gathered ruffle lines, from the floor to the mattress.
      F(0.1, 0.02, 2.44, 1.58, (T) => { T.box(0.1, 0.02, 0, 2.34, 1.56, 0.3, '#FBF8F1');
        for (let x = 0.14; x < 2.42; x += 0.07) T.line([x, 1.581, 0.02], [x, 1.581, 0.28], 'rgba(150,140,125,.35)', 0.8);
        for (let y = 0.06; y < 1.56; y += 0.07) T.line([2.441, y, 0.02], [2.441, y, 0.28], 'rgba(150,140,125,.35)', 0.8); }),
      B(0.1, 0.04, 0.3, 2.34, 1.52, 0.2, '#FBF7EE', { name: 'mattress' }),
      // Plump pillows: a softer box, a rounded top, and a white frill round the front edge.
      F(0.1, 0.04, 2.44, 1.56, (T) => [0.06, 0.82].forEach((y) => { T.box(0.14, y, 0.5, 0.38, 0.7, 0.1, shade(c, 0.45));
        const [ax, ay] = T.P(0.33, y + 0.35, 0.62); ell(ax, ay, 15, 5, shade(c, 0.55)); T.line([0.52, y, 0.5], [0.52, y + 0.7, 0.5], '#FFFFFF', 2.4); T.line([0.52, y, 0.6], [0.52, y + 0.7, 0.6], '#FFFFFF', 1.6); }), { onTop: true }),
      // The quilt: patches on top, the near side and the foot hanging down over the skirt, with a scalloped hem.
      B(0.8, 0.02, 0.5, 1.66, 1.56, 0.05, c), B(0.8, 0.02, 0.55, 1.66, 1.56, 0.01, c, { cover: true }),
      F(0.8, 0, 2.5, 1.6, (T) => { const cols = [c, ...PATCH.filter((p) => p !== c)], patch = (q, k) => T.poly(q, cols[k % cols.length], 'rgba(255,255,255,.65)', 0.6);
        for (let i = 0; i < 6; i++) for (let j = 0; j < 5; j++) { const x = 0.82 + i * 0.27, y = 0.04 + j * 0.305; patch([[x, y, 0.561], [x + 0.26, y, 0.561], [x + 0.26, y + 0.295, 0.561], [x, y + 0.295, 0.561]], i * 2 + j * 3); }
        for (let i = 0; i < 6; i++) { const x = 0.82 + i * 0.27; patch([[x, 1.585, 0.56], [x + 0.26, 1.585, 0.56], [x + 0.26, 1.585, 0.24], [x, 1.585, 0.24]], i * 2 + 4 * 3 + 1); }
        for (let j = 0; j < 5; j++) { const y = 0.04 + j * 0.305; patch([[2.465, y, 0.56], [2.465, y + 0.295, 0.56], [2.465, y + 0.295, 0.24], [2.465, y, 0.24]], 5 * 2 + j * 3 + 1); }
        for (let x = 0.82; x < 2.44; x += 0.09) { const [hx, hy] = T.P(x + 0.045, 1.585, 0.24); ctx.beginPath(); ctx.arc(hx, hy, 2.2, 0, Math.PI); ctx.fillStyle = shade(c, -0.1); ctx.fill(); } }, { onTop: true }),
      F(2.42, 0, 2.5, 1.6, (T) => { [0.03, 1.57].forEach((y) => { T.box(2.42, y - 0.03, 0, 0.06, 0.06, 0.82, CO.iron); const [kx, ky] = T.P(2.45, y, 0.86); circle(kx, ky, 2.6, '#C9A24A', '#8E6E2A'); }); iron(T, [2.47, 0.03, 0.78], [2.47, 1.57, 0.78], 2.2); for (let k = 1; k < 9; k++) iron(T, [2.47, 1.6 * k / 9, 0.6], [2.47, 1.6 * k / 9, 0.78], 1.2); }, { onTop: true })]; },
  });
  Object.assign(LOOK_DRAWERS.nightstand, {
    // A painted pine table with a drawer and a ceramic knob, a lamp with a floral shade and a jar of wildflowers.
    cottage: (T, o) => { const lit = isLit(o.id), c = cl(o);
      [[0.04, 0.04], [0.37, 0.04], [0.04, 0.37], [0.37, 0.37]].forEach(([x, y]) => T.line([x, y, 0], [x, y, 0.38], shade(c, -0.15), 2.4));
      T.box(0.02, 0.02, 0.36, 0.41, 0.41, 0.12, c); T.box(0, 0, 0.48, 0.45, 0.45, 0.03, shade(c, 0.08)); const [kx, ky] = T.P(0.22, 0.431, 0.42); circle(kx, ky, 1.8, '#FFFFFF');
      T.box(0.1, 0.1, 0.51, 0.1, 0.1, 0.12, CO.cream); const [sx, sy] = T.P(0.15, 0.15, 0.76); if (lit) ell(sx, sy + 6, 14, 8, 'rgba(255,226,168,.3)');
      ctx.beginPath(); ctx.moveTo(sx - 5, sy - 5); ctx.lineTo(sx + 5, sy - 5); ctx.lineTo(sx + 8, sy + 4); ctx.lineTo(sx - 8, sy + 4); ctx.closePath(); ctx.fillStyle = lit ? '#FFF4DE' : CO.cream; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.15)'; ctx.lineWidth = 0.8; ctx.stroke();
      [[-4, -1], [0, 1], [4, -2], [-1, -3]].forEach(([dx, dy], k) => circle(sx + dx, sy + dy, 1.1, PATCH[k]));
      T.box(0.3, 0.28, 0.51, 0.07, 0.07, 0.08, 'rgba(200,225,230,.7)'); [[-3, -2, CO.rose], [0, -5, CO.butter], [3, -2, CO.blue]].forEach(([dx, dy, col]) => { const [fx, fy] = T.P(0.335, 0.315, 0.66); limb(fx, fy + 6, fx + dx, fy + dy, '#6E8F5A', 0.8); circle(fx + dx, fy + dy, 1.8, col); }); },
  });
  Object.assign(LOOK_DRAWERS.dresser, {
    // A painted chest with hand-painted flowers on the drawers, white ceramic knobs, a lace runner and a jug of wildflowers.
    cottage: (T, o) => { const c = cl(o);
      T.box(0.02, 0.02, 0, 1.16, 0.46, 0.08, shade(c, -0.15)); T.box(0, 0, 0.08, 1.2, 0.5, 0.74, c);
      [0.32, 0.56].forEach((z) => T.line([0.02, 0.501, z], [1.18, 0.501, z], 'rgba(0,0,0,.2)', 1));
      [[0.25, 0.2], [0.95, 0.2], [0.25, 0.44], [0.95, 0.44], [0.25, 0.68], [0.95, 0.68]].forEach(([x, z]) => { const [kx, ky] = T.P(x, 0.502, z); circle(kx, ky, 2, '#FFFFFF'); circle(kx, ky, 0.8, CO.rose); });
      // A painted posy in the middle of each drawer: three flowers on short stems with a leaf.
      [0.2, 0.44, 0.68].forEach((z, r) => { const [fx, fy] = T.P(0.6, 0.502, z - 0.03); [[-4, -3], [0, -6], [4, -3]].forEach(([dx, dy], k) => { limb(fx, fy + 3, fx + dx, fy + dy, '#6E8F5A', 0.8); circle(fx + dx, fy + dy, 1.9, PATCH[(k + r) % 4]); circle(fx + dx, fy + dy, 0.7, '#FFFFFF'); }); ell(fx + 3, fy + 1, 1.8, 0.8, '#6E8F5A', null, 0.5); });
      T.box(-0.02, -0.02, 0.82, 1.24, 0.54, 0.03, shade(c, 0.08)); T.poly([[0.2, 0.04, 0.851], [1.0, 0.04, 0.851], [1.0, 0.46, 0.851], [0.2, 0.46, 0.851]], CO.lace, 'rgba(0,0,0,.08)', 0.6);
      T.box(0.82, 0.16, 0.85, 0.14, 0.14, 0.18, CO.blue); [[-4, -6, CO.rose], [0, -9, CO.butter], [4, -6, '#FFFFFF'], [-1, -4, CO.sage]].forEach(([dx, dy, col]) => { const [fx, fy] = T.P(0.89, 0.23, 1.04); limb(fx, fy + 4, fx + dx, fy + dy, '#6E8F5A', 0.8); circle(fx + dx, fy + dy, 2, col); }); },
  });
  Object.assign(LOOK_DRAWERS.toilet, {
    // A white toilet with a pine seat under a high cistern on the wall with a pull chain.
    cottage: (T, o) => {
      T.box(0.05, 0, 1.45, 0.32, 0.14, 0.2, CO.iron); T.line([0.21, 0.07, 1.45], [0.21, 0.07, 0.4], '#9AA3A8', 1.6); T.line([0.33, 0.14, 1.5], [0.33, 0.16, 1.05], '#9AA3A8', 0.8); const [hx, hy] = T.P(0.33, 0.16, 1.03); circle(hx, hy, 2, CO.pine);
      T.box(0.09, 0.08, 0, 0.24, 0.3, 0.34, '#FFFFFF'); const [bx, by] = T.P(0.21, 0.4, 0.3); ell(bx, by, 7.5, 6, '#FFFFFF', 'rgba(0,0,0,.12)');
      const [sx, sy] = T.P(0.21, 0.38, 0.385); ell(sx, sy, 7, 4, CO.pine); ell(sx, sy, 5, 2.8, '#E8EEF0');
      if (live(T.o.id)) { ell(sx, sy, 4.5, 2.5, '#BFE2F0'); ctx.strokeStyle = 'rgba(90,150,200,.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(sx, sy, 3, 1.6, animT * 9, 0, Math.PI * 1.4); ctx.stroke(); } },
  });
  Object.assign(LOOK_DRAWERS.vanity, {
    // A sink in a gathered gingham skirt, a pine top, copper taps and a jug and soap dish.
    cottage: (T, o) => { const c = cl(o);
      T.box(0.02, 0.02, 0, 0.96, 0.46, 0.78, c); for (let k = 0; k <= 12; k++) T.line([0.02 + k * 0.08, 0.481, 0.02], [0.02 + k * 0.08, 0.481, 0.76], 'rgba(255,255,255,.45)', 1.2); for (let z = 0.1; z < 0.76; z += 0.16) T.line([0.02, 0.482, z], [0.98, 0.482, z], 'rgba(255,255,255,.35)', 1.2);
      T.box(-0.02, -0.02, 0.78, 1.04, 0.54, 0.05, CO.pine); const [vx, vy] = T.P(0.5, 0.26, 0.831); ell(vx, vy, 10, 5, '#FFFFFF', 'rgba(0,0,0,.15)'); ell(vx, vy, 7, 3.2, '#DCE6E8');
      [0.38, 0.62].forEach((x) => { T.line([x, 0.05, 0.83], [x, 0.05, 0.98], CO.copper, 2); T.line([x, 0.05, 0.98], [x, 0.14, 0.95], CO.copper, 2); const [cx, cy] = T.P(x, 0.05, 1.0); circle(cx, cy, 2, CO.copper); });
      T.box(0.8, 0.25, 0.83, 0.12, 0.12, 0.16, CO.blue); T.box(0.1, 0.3, 0.83, 0.14, 0.1, 0.02, '#FFFFFF'); const [px, py] = T.P(0.17, 0.35, 0.86); ell(px, py, 3, 1.6, CO.rose); },
  });
  Object.assign(LOOK_DRAWERS.shower, {
    // Whitewashed beadboard walls, exposed copper pipes to a big rain head, a pine duckboard, and a floral curtain on a rail.
    cottage: (o) => [F(0, 0, 1.18, 1.18, (T) => {
        T.box(0, 0, 0, 1.18, 1.18, 0.06, '#E6E2D8'); for (let k = 0; k < 7; k++) T.box(0.25, 0.25 + k * 0.1, 0.06, 0.7, 0.06, 0.03, CO.pine);
        T.box(0, 0, 0.06, 1.18, 0.06, 2.04, '#F7F4EC'); for (let k = 1; k < 16; k++) T.line([1.18 * k / 16, 0.061, 0.06], [1.18 * k / 16, 0.061, 1.3], 'rgba(0,0,0,.12)', 0.8); T.line([0, 0.061, 1.3], [1.18, 0.061, 1.3], CO.pine, 2);
        T.line([0.6, 0.07, 0.9], [0.6, 0.07, 2.08], CO.copper, 2.2); T.line([0.6, 0.07, 2.08], [0.6, 0.45, 2.08], CO.copper, 2.2); const [hx, hy] = T.P(0.6, 0.5, 2.05); ell(hx, hy, 10, 5, CO.copper, shade(CO.copper, -0.3));
        [[0.48, 1.0], [0.72, 1.0]].forEach(([x, z]) => { const [kx, ky] = T.P(x, 0.07, z); circle(kx, ky, 2.6, CO.copper); circle(kx, ky, 1, '#FFFFFF'); });
        if (usingSlot(T.o.id + ':s') || live(T.o.id)) { steamAt(T, 0.6, 0.6, 0.9, 0, 6, 1); steamAt(T, 0.5, 0.75, 1.5, 0, 3, 0.8); const [wx, wy] = T.W(0.6, 0.5); PFX.emit(T.o.id + ':splash', 'splash', T.o.level, wx, wy, 1.95, 1); }
      }, { name: 'tray' }),
      F(0, 1.14, 1.18, 1.2, (T, ob) => { const c = cl(ob); T.line([0, 1.17, 2.06], [1.18, 1.17, 2.06], CO.copper, 1.8);
        const open = usingSlot(T.o.id + ':s') ? 0.45 : 0.85;
        for (let k = 0; k < 10; k++) { const y0 = k * open / 10 * 1.18, y1 = (k + 1) * open / 10 * 1.18; T.poly([[y0, 1.17 + (k % 2) * 0.02, 0.2], [y1, 1.17 + ((k + 1) % 2) * 0.02, 0.2], [y1, 1.17 + ((k + 1) % 2) * 0.02, 2.04], [y0, 1.17 + (k % 2) * 0.02, 2.04]], k % 2 ? c : shade(c, -0.08)); }
        ditsy(T, 0.02, open * 1.18, 1.2, 0.3, 1.95, 24); })],
  });

  // Mid-Century: walnut on tapered legs, cane, mustard and teal, chrome and pastel tile.
  const MC = { walnut: '#7A4E2D', walnutDark: '#5E3A20', walnutLite: '#9A6A44', cane: '#D9BC86', mustard: '#D9A441', teal: '#3F7F7A', orange: '#D2693A', chrome: '#C9CED6', cream: '#F3E6CC' };
  const taperLegs = (T, pts, z, col) => pts.forEach(([x, y, dx, dy]) => T.line([x, y, z], [x + dx, y + dy, 0], col, 2.4));
  // A cane panel on a face that looks along +x: the panel, then a fine weave of straight and diagonal strands clipped to it.
  const cane = (T, x, y0, y1, z0, z1) => { const q = [[x, y0, z0], [x, y1, z0], [x, y1, z1], [x, y0, z1]]; T.poly(q, MC.cane);
    ctx.save(); ctx.beginPath(); q.forEach((p, k) => { const [px, py] = T.P(...p); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.closePath(); ctx.clip();
    const st = 'rgba(120,80,30,.4)', h = z1 - z0;
    for (let y = y0; y <= y1; y += 0.06) T.line([x + 0.001, y, z0], [x + 0.001, y, z1], st, 0.6);
    for (let z = z0; z <= z1; z += 0.06) T.line([x + 0.001, y0, z], [x + 0.001, y1, z], st, 0.6);
    for (let y = y0 - h; y <= y1; y += 0.085) { T.line([x + 0.001, y, z0], [x + 0.001, y + h, z1], st, 0.6); T.line([x + 0.001, y + h, z0], [x + 0.001, y, z1], st, 0.6); }
    ctx.restore(); };
  Object.assign(LOOK_DRAWERS.bed, {
    // A walnut bed on tapered legs with a cane-panelled headboard, a full mattress, two pillows and a cover in the piece's colour.
    midcentury: (o) => { const c = cl(o); return [
      F(0, 0, 0.12, 1.6, (T) => { T.box(0, 0, 0.1, 0.12, 1.6, 1.0, MC.walnut); cane(T, 0.121, 0.12, 1.48, 0.42, 0.96); }),
      F(0.12, 0, 2.5, 1.6, (T) => taperLegs(T, [[0.2, 0.1, -0.03, -0.03], [2.4, 0.1, 0.03, -0.03], [0.2, 1.5, -0.03, 0.03], [2.4, 1.5, 0.03, 0.03]], 0.14, MC.walnutDark)),
      B(0.12, 0.02, 0.14, 2.36, 1.56, 0.16, MC.walnut), B(0.15, 0.05, 0.3, 2.32, 1.5, 0.18, '#F7F3EA', { name: 'mattress' }),
      pillowsOn([0.15, 0.05, 0.3, 2.32, 1.5], [[0.16, 0.05, 0.48, 0.4, 0.72, 0.13, shade(c, 0.5)], [0.16, 0.83, 0.48, 0.4, 0.72, 0.13, shade(c, 0.5)]]),
      B(0.86, 0.03, 0.48, 1.62, 1.54, 0.06, c), B(0.86, 0.03, 0.54, 1.62, 1.54, 0.01, c, { cover: true }),
      F(0.86, 0, 2.5, 1.6, (T) => { T.poly([[1.95, 0.03, 0.551], [2.3, 0.03, 0.551], [2.3, 1.57, 0.551], [1.95, 1.57, 0.551]], MC.orange); for (let k = 0; k < 6; k++) T.line([1.97 + k * 0.06, 0.03, 0.552], [1.97 + k * 0.06, 1.57, 0.552], 'rgba(255,255,255,.35)', 0.8); }, { onTop: true })]; },
  });
  Object.assign(LOOK_DRAWERS.nightstand, {
    // A walnut nightstand on splayed legs with a long recessed pull, and a white mushroom lamp.
    midcentury: (T, o) => { const lit = isLit(o.id), c = cl(o);
      taperLegs(T, [[0.06, 0.06, -0.03, -0.03], [0.39, 0.06, 0.03, -0.03], [0.06, 0.39, -0.03, 0.03], [0.39, 0.39, 0.03, 0.03]], 0.2, MC.walnutDark);
      T.box(0.02, 0.02, 0.2, 0.41, 0.41, 0.3, c); T.poly([[0.08, 0.431, 0.38], [0.37, 0.431, 0.38], [0.37, 0.431, 0.4], [0.08, 0.431, 0.4]], MC.walnutDark);
      T.box(0.15, 0.15, 0.5, 0.06, 0.06, 0.16, '#FFFFFF'); const [lx, ly] = T.P(0.18, 0.18, 0.72); if (lit) circle(lx, ly + 4, 16, 'rgba(255,214,150,.3)');
      ctx.beginPath(); ctx.ellipse(lx, ly + 3, 10, 9, 0, Math.PI, Math.PI * 2); ctx.ellipse(lx, ly + 3, 10, 2.5, 0, 0, Math.PI); ctx.closePath(); ctx.fillStyle = lit ? '#FFF6E6' : '#F7F4EE'; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.15)'; ctx.lineWidth = 0.8; ctx.stroke(); },
  });
  Object.assign(LOOK_DRAWERS.dresser, {
    // A long, low walnut dresser on splayed legs: six drawers with recessed pulls, a ceramic vase and a brass sunburst.
    midcentury: (T, o) => { const c = cl(o);
      taperLegs(T, [[0.08, 0.08, -0.04, -0.04], [1.12, 0.08, 0.04, -0.04], [0.08, 0.42, -0.04, 0.04], [1.12, 0.42, 0.04, 0.04]], 0.16, MC.walnutDark);
      T.box(0, 0, 0.16, 1.2, 0.5, 0.64, c); T.line([0.6, 0.501, 0.16], [0.6, 0.501, 0.8], 'rgba(0,0,0,.3)', 1); [0.37, 0.58].forEach((z) => T.line([0.01, 0.501, z], [1.19, 0.501, z], 'rgba(0,0,0,.3)', 1));
      [[0.12, 0.48], [0.72, 1.08]].forEach(([a, b]) => [0.33, 0.54, 0.75].forEach((z) => T.poly([[a, 0.502, z - 0.025], [b, 0.502, z - 0.025], [b, 0.502, z], [a, 0.502, z]], MC.walnutDark)));
      T.box(-0.01, -0.01, 0.8, 1.22, 0.52, 0.02, MC.walnutLite);
      T.box(0.2, 0.18, 0.82, 0.1, 0.1, 0.24, MC.teal); const [vx, vy] = T.P(0.25, 0.23, 1.06); ell(vx, vy, 3, 1.4, shade(MC.teal, -0.3));
      const [sx, sy] = T.P(0.85, 0.2, 1.05); for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; limb(sx, sy, sx + Math.cos(a) * 9, sy + Math.sin(a) * 9, '#C9A24A', 1); } circle(sx, sy, 3, '#E0C26E'); T.line([0.85, 0.2, 0.82], [0.85, 0.2, 0.98], '#C9A24A', 1.4); },
  });
  Object.assign(LOOK_DRAWERS.toilet, {
    // A pastel toilet in the piece's colour, with a chrome flush handle on the tank.
    midcentury: (T, o) => { const c = cl(o);
      T.box(0.04, 0, 0.36, 0.34, 0.16, 0.38, c); T.box(0.02, -0.01, 0.74, 0.38, 0.18, 0.03, shade(c, 0.08)); T.line([0.06, 0.161, 0.68], [0.13, 0.161, 0.68], MC.chrome, 1.8);
      T.box(0.09, 0.16, 0, 0.24, 0.26, 0.32, c); const [bx, by] = T.P(0.21, 0.42, 0.3); ell(bx, by, 7.5, 6, c, 'rgba(0,0,0,.12)');
      const [sx, sy] = T.P(0.21, 0.4, 0.385); ell(sx, sy, 7, 4, shade(c, -0.1)); ell(sx, sy, 5, 2.8, '#E8EEF0');
      if (live(T.o.id)) { ell(sx, sy, 4.5, 2.5, '#BFE2F0'); ctx.strokeStyle = 'rgba(90,150,200,.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(sx, sy, 3, 1.6, animT * 9, 0, Math.PI * 1.4); ctx.stroke(); } },
  });
  Object.assign(LOOK_DRAWERS.vanity, {
    // A laminate vanity in the piece's colour on chrome legs, a round basin and chrome tap, and a square-tile backsplash.
    midcentury: (T, o) => { const c = cl(o);
      [[0.06, 0.06], [0.94, 0.06], [0.06, 0.44], [0.94, 0.44]].forEach(([x, y]) => T.line([x, y, 0], [x, y, 0.3], MC.chrome, 2));
      T.box(0, 0, 0.3, 1.0, 0.5, 0.5, c); T.line([0.5, 0.501, 0.32], [0.5, 0.501, 0.78], 'rgba(0,0,0,.25)', 1); [0.44, 0.56].forEach((x) => T.line([x, 0.502, 0.5], [x, 0.502, 0.62], MC.chrome, 1.8));
      T.box(-0.02, -0.02, 0.8, 1.04, 0.54, 0.04, '#F4F1EA'); T.line([-0.02, 0.521, 0.82], [1.02, 0.521, 0.82], MC.chrome, 1.2);
      for (let i = 0; i < 10; i++) for (let j = 0; j < 2; j++) T.poly([[i * 0.1 + 0.005, 0.001, 0.845 + j * 0.1], [i * 0.1 + 0.095, 0.001, 0.845 + j * 0.1], [i * 0.1 + 0.095, 0.001, 0.94 + j * 0.1], [i * 0.1 + 0.005, 0.001, 0.94 + j * 0.1]], (i + j) % 2 ? shade(c, 0.3) : '#FFFFFF');
      const [vx, vy] = T.P(0.5, 0.27, 0.841); ell(vx, vy, 9, 4.5, '#FFFFFF', 'rgba(0,0,0,.15)'); T.line([0.5, 0.06, 0.84], [0.5, 0.06, 0.98], MC.chrome, 2); T.line([0.5, 0.06, 0.98], [0.5, 0.18, 0.96], MC.chrome, 2); },
  });
  Object.assign(LOOK_DRAWERS.shower, {
    // Square pastel tile in the piece's colour with a black pencil trim, a chrome head, and a sliding door of reeded glass.
    midcentury: (o) => [F(0, 0, 1.18, 1.18, (T, ob) => { const c = cl(ob);
        T.box(0, 0, 0, 1.18, 1.18, 0.06, '#FFFFFF'); for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) if ((i + j) % 2) T.poly([[i * 0.098, j * 0.098, 0.061], [i * 0.098 + 0.098, j * 0.098, 0.061], [i * 0.098 + 0.098, j * 0.098 + 0.098, 0.061], [i * 0.098, j * 0.098 + 0.098, 0.061]], shade(c, 0.2));
        T.box(0, 0, 0.06, 1.18, 0.06, 2.04, c); for (let k = 1; k < 12; k++) T.line([1.18 * k / 12, 0.061, 0.06], [1.18 * k / 12, 0.061, 2.1], 'rgba(255,255,255,.55)', 0.7); for (let z = 0.16; z < 2.1; z += 0.1) T.line([0, 0.061, z], [1.18, 0.061, z], 'rgba(255,255,255,.55)', 0.7); T.line([0, 0.062, 1.2], [1.18, 0.062, 1.2], '#1E1E22', 2.2);
        T.line([0.6, 0.06, 1.9], [0.6, 0.3, 1.95], MC.chrome, 2.2); const [hx, hy] = T.P(0.6, 0.32, 1.94); ell(hx, hy, 6, 3, MC.chrome, '#8E939A'); [[0.48, 1.05], [0.72, 1.05]].forEach(([x, z]) => { const [kx, ky] = T.P(x, 0.062, z); circle(kx, ky, 2.4, MC.chrome); });
        if (usingSlot(T.o.id + ':s') || live(T.o.id)) { steamAt(T, 0.6, 0.6, 0.9, 0, 6, 1); steamAt(T, 0.5, 0.75, 1.5, 0, 3, 0.8); const [wx, wy] = T.W(0.6, 0.32); PFX.emit(T.o.id + ':splash', 'splash', T.o.level, wx, wy, 1.85, 1); }
      }, { name: 'tray' }),
      F(0, 1.16, 1.18, 1.2, (T) => { const open = usingSlot(T.o.id + ':s') ? 0.55 : 0; T.line([0, 1.18, 2.02], [1.18, 1.18, 2.02], MC.chrome, 2);
        [[0, 0.6], [0.58, 1.18]].forEach(([a, b], k) => { const s0 = k ? a - open : a, s1 = k ? b - open : b; T.poly([[s0, 1.18, 0.06], [s1, 1.18, 0.06], [s1, 1.18, 2.0], [s0, 1.18, 2.0]], 'rgba(220,235,238,.55)', MC.chrome, 1.2); for (let u = s0 + 0.03; u < s1; u += 0.04) T.line([u, 1.18, 0.1], [u, 1.18, 1.96], 'rgba(255,255,255,.35)', 0.7); }); }),
      F(1.16, 0, 1.2, 1.18, (T) => { T.poly([[1.18, 0.06, 0.06], [1.18, 1.18, 0.06], [1.18, 1.18, 2.02], [1.18, 0.06, 2.02]], 'rgba(220,235,238,.5)', MC.chrome, 1.2); for (let v = 0.09; v < 1.18; v += 0.04) T.line([1.18, v, 0.1], [1.18, v, 1.98], 'rgba(255,255,255,.3)', 0.7); T.line([1.18, 0.06, 2.02], [1.18, 1.18, 2.02], MC.chrome, 2); }, { onTop: true })],
  });

  // Hollywood Regency: blush velvet, black lacquer, mirror, gold and a white orchid.
  const RG = { black: '#151517', white: '#FAF7F2', gold: '#D4AF37', goldLite: '#EBD27A', mirror: '#DCE6EE', mirrorDark: '#B9C8D4', marble: '#F1EEE9' };
  const glint = (T, x, y, z0, z1) => T.line([x, y, z0], [x, y, z1], 'rgba(255,255,255,.7)', 1.4);
  const mirrorFace = (T, a, b, z0, z1, y) => { T.poly([[a, y, z0], [b, y, z0], [b, y, z1], [a, y, z1]], RG.mirror, RG.mirrorDark, 1); T.line([a + (b - a) * 0.2, y + 0.001, z0 + (z1 - z0) * 0.2], [a + (b - a) * 0.45, y + 0.001, z0 + (z1 - z0) * 0.8], 'rgba(255,255,255,.75)', 1.4); };
  Object.assign(LOOK_DRAWERS.bed, {
    // A towering channel-tufted headboard in the piece's colour with a gold scalloped crest, black lacquer base on gold
    // feet, white bedding with a black border, and a lumbar cushion to match the headboard.
    regency: (o) => { const c = cl(o); return [
      F(0, 0, 0.16, 1.6, (T) => { T.box(0, 0, 0, 0.16, 1.6, 1.6, c); for (let k = 1; k < 12; k++) T.line([0.161, 1.6 * k / 12, 0.36], [0.161, 1.6 * k / 12, 1.54], 'rgba(0,0,0,.2)', 1.2);
        // The crest: six gold scallops standing on the top edge, drawn along the headboard so they follow it at any rotation.
        for (let k = 0; k < 6; k++) { const y0 = k * 1.6 / 6, pts = []; for (let m = 0; m <= 10; m++) { const f = m / 10; pts.push([0.08, y0 + f * 1.6 / 6, 1.6 + Math.sin(f * Math.PI) * 0.12]); }
          T.poly([...pts, [0.08, y0 + 1.6 / 6, 1.6], [0.08, y0, 1.6]], 'rgba(212,175,55,.25)'); for (let m = 1; m < pts.length; m++) T.line(pts[m - 1], pts[m], RG.gold, 2); }
        T.line([0.162, 0, 1.6], [0.162, 1.6, 1.6], RG.gold, 2.2); T.line([0.162, 0.005, 0.36], [0.162, 0.005, 1.6], RG.gold, 1.6); T.line([0.162, 1.595, 0.36], [0.162, 1.595, 1.6], RG.gold, 1.6); }),
      F(0.16, 0, 2.5, 1.6, (T) => [[0.22, 0.06], [2.44, 0.06], [0.22, 1.54], [2.44, 1.54]].forEach(([x, y]) => T.box(x - 0.03, y - 0.03, 0, 0.06, 0.06, 0.1, RG.gold))),
      B(0.16, 0.02, 0.1, 2.34, 1.56, 0.22, RG.black), B(0.16, 0.02, 0.32, 2.34, 1.56, 0.015, RG.gold),
      B(0.18, 0.05, 0.335, 2.3, 1.5, 0.18, RG.white, { name: 'mattress' }),
      pillowsOn([0.18, 0.05, 0.335, 2.3, 1.5], [[0.18, 0.05, 0.515, 0.16, 0.74, 0.3, RG.white], [0.18, 0.81, 0.515, 0.16, 0.74, 0.3, RG.white], [0.36, 0.45, 0.515, 0.16, 0.7, 0.18, c]]),
      B(0.9, 0.05, 0.515, 1.58, 1.5, 0.06, RG.white), B(0.9, 0.05, 0.575, 1.58, 1.5, 0.01, RG.white, { cover: true }),
      F(0.9, 0, 2.5, 1.6, (T) => { [[2.3, 2.36], [2.4, 2.44]].forEach(([a, b]) => T.poly([[a, 0.05, 0.586], [b, 0.05, 0.586], [b, 1.55, 0.586], [a, 1.55, 0.586]], RG.black)); T.poly([[0.9, 1.55, 0.585], [2.48, 1.55, 0.585], [2.48, 1.55, 0.45], [0.9, 1.55, 0.45]], RG.white, 'rgba(0,0,0,.1)', 0.6); T.line([0.9, 1.551, 0.47], [2.48, 1.551, 0.47], RG.black, 1.6); }, { onTop: true })]; },
  });
  Object.assign(LOOK_DRAWERS.nightstand, {
    // A mirrored nightstand with a gold ring pull, on gold feet, and a gold gourd lamp with a white drum shade.
    regency: (T, o) => { const lit = isLit(o.id);
      [[0.05, 0.05], [0.38, 0.05], [0.05, 0.38], [0.38, 0.38]].forEach(([x, y]) => T.box(x - 0.02, y - 0.02, 0, 0.04, 0.04, 0.06, RG.gold));
      T.box(0.02, 0.02, 0.06, 0.41, 0.41, 0.44, RG.mirrorDark); mirrorFace(T, 0.04, 0.41, 0.09, 0.47, 0.431); mirrorFace(T, 0.04, 0.41, 0.09, 0.47, 0.431);
      const [rx, ry] = T.P(0.22, 0.432, 0.3); ctx.strokeStyle = RG.gold; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(rx, ry, 2.6, 0, Math.PI * 2); ctx.stroke();
      T.box(0.02, 0.02, 0.5, 0.41, 0.41, 0.01, RG.gold);
      const [gx, gy] = T.P(0.17, 0.17, 0.56); ell(gx, gy, 5, 5, RG.gold, shade(RG.gold, -0.3)); T.line([0.17, 0.17, 0.6], [0.17, 0.17, 0.7], RG.gold, 1.4);
      const [sx, sy] = T.P(0.17, 0.17, 0.76); if (lit) ell(sx, sy + 6, 14, 8, 'rgba(255,226,168,.3)'); rr(sx - 8, sy - 6, 16, 11, 1.5, lit ? '#FFF6E6' : RG.white); },
  });
  Object.assign(LOOK_DRAWERS.dresser, {
    // A mirrored chest of three drawers on gold legs, gold ring pulls, a gold tray and a white orchid.
    regency: (T, o) => {
      [[0.06, 0.06], [1.14, 0.06], [0.06, 0.44], [1.14, 0.44]].forEach(([x, y]) => T.line([x, y, 0], [x, y, 0.14], RG.gold, 2.6));
      T.box(0, 0, 0.14, 1.2, 0.5, 0.68, RG.mirrorDark); [[0.16, 0.36], [0.38, 0.58], [0.6, 0.8]].forEach(([z0, z1]) => { mirrorFace(T, 0.02, 1.18, z0 + 0.01, z1 - 0.01, 0.501); const [rx, ry] = T.P(0.6, 0.502, (z0 + z1) / 2); ctx.strokeStyle = RG.gold; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(rx, ry, 2.8, 0, Math.PI * 2); ctx.stroke(); });
      T.box(-0.01, -0.01, 0.82, 1.22, 0.52, 0.02, RG.mirror); T.box(0.15, 0.12, 0.84, 0.36, 0.24, 0.015, RG.gold);
      T.box(0.88, 0.2, 0.84, 0.1, 0.1, 0.08, RG.white); T.line([0.93, 0.25, 0.92], [0.95, 0.24, 1.2], '#4E7A3A', 1.2); [[0, -2], [5, 1], [-4, 3], [2, 6]].forEach(([dx, dy]) => { const [fx, fy] = T.P(0.95, 0.24, 1.14); ell(fx + dx, fy + dy, 3, 2.2, '#FFFFFF', '#E6C4D8'); circle(fx + dx, fy + dy, 0.8, '#C2417A'); }); },
  });
  Object.assign(LOOK_DRAWERS.toilet, {
    // A black toilet with a gold flush plate.
    regency: (T, o) => {
      T.box(0.04, 0, 0.36, 0.34, 0.16, 0.38, RG.black); T.box(0.02, -0.01, 0.74, 0.38, 0.18, 0.03, RG.black); T.poly([[0.15, 0.161, 0.58], [0.27, 0.161, 0.58], [0.27, 0.161, 0.66], [0.15, 0.161, 0.66]], RG.gold);
      T.box(0.09, 0.16, 0, 0.24, 0.26, 0.32, RG.black); const [bx, by] = T.P(0.21, 0.42, 0.3); ell(bx, by, 7.5, 6, RG.black, '#000000');
      const [sx, sy] = T.P(0.21, 0.4, 0.385); ell(sx, sy, 7, 4, '#2A2A2E'); ell(sx, sy, 5, 2.8, '#C8D2D8');
      if (live(T.o.id)) { ell(sx, sy, 4.5, 2.5, '#BFE2F0'); ctx.strokeStyle = 'rgba(90,150,200,.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(sx, sy, 3, 1.6, animT * 9, 0, Math.PI * 1.4); ctx.stroke(); } },
  });
  Object.assign(LOOK_DRAWERS.vanity, {
    // Black lacquer on gold legs, a white marble top, a gold tap, and a blush hand towel on a gold ring.
    regency: (T, o) => { const c = cl(o);
      [[0.05, 0.05], [0.95, 0.05], [0.05, 0.45], [0.95, 0.45]].forEach(([x, y]) => T.line([x, y, 0], [x, y, 0.32], RG.gold, 2.4));
      T.box(0, 0, 0.32, 1.0, 0.5, 0.46, RG.black); T.line([0.5, 0.501, 0.34], [0.5, 0.501, 0.76], 'rgba(255,255,255,.15)', 1); [0.44, 0.56].forEach((x) => { const [kx, ky] = T.P(x, 0.502, 0.55); circle(kx, ky, 1.8, RG.gold); });
      T.box(-0.02, -0.02, 0.78, 1.04, 0.54, 0.04, RG.marble); T.line([0.1, 0.0, 0.821], [0.5, 0.5, 0.821], 'rgba(120,110,100,.3)', 0.8);
      const [vx, vy] = T.P(0.5, 0.27, 0.821); ell(vx, vy, 9, 4.5, '#FFFFFF', 'rgba(0,0,0,.15)'); T.line([0.5, 0.05, 0.82], [0.5, 0.05, 1.0], RG.gold, 2.2); T.line([0.5, 0.05, 1.0], [0.5, 0.18, 0.97], RG.gold, 2.2);
      const [tx, ty] = T.P(1.0, 0.25, 0.7); ctx.strokeStyle = RG.gold; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(tx, ty, 4, 0, Math.PI * 2); ctx.stroke(); T.poly([[1.002, 0.17, 0.66], [1.002, 0.33, 0.66], [1.002, 0.33, 0.4], [1.002, 0.17, 0.4]], c); },
  });
  Object.assign(LOOK_DRAWERS.shower, {
    // Black subway tile with white grout, gold fixtures and a gold-framed glass door, on a white floor with black dots.
    regency: (o) => [F(0, 0, 1.18, 1.18, (T) => {
        T.box(0, 0, 0, 1.18, 1.18, 0.06, RG.white); for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) { const [dx, dy] = T.P(0.07 + i * 0.13, 0.07 + j * 0.13, 0.061); ell(dx, dy, 1.6, 0.9, RG.black); }
        T.box(0, 0, 0.06, 1.18, 0.06, 2.04, RG.black); for (let z = 0.06, r = 0; z < 2.1; z += 0.1, r++) { T.line([0, 0.061, z], [1.18, 0.061, z], 'rgba(255,255,255,.4)', 0.7); for (let u = (r % 2) * 0.1; u < 1.18; u += 0.2) T.line([u, 0.061, z], [u, 0.061, Math.min(2.1, z + 0.1)], 'rgba(255,255,255,.4)', 0.7); }
        T.line([0.6, 0.06, 2.08], [0.6, 0.45, 2.08], RG.gold, 2.4); const [hx, hy] = T.P(0.6, 0.5, 2.06); ell(hx, hy, 9, 4.5, RG.gold, shade(RG.gold, -0.3)); [[0.48, 1.05], [0.72, 1.05]].forEach(([x, z]) => { const [kx, ky] = T.P(x, 0.062, z); circle(kx, ky, 2.4, RG.gold); });
        if (usingSlot(T.o.id + ':s') || live(T.o.id)) { steamAt(T, 0.6, 0.6, 0.9, 0, 6, 1); steamAt(T, 0.5, 0.75, 1.5, 0, 3, 0.8); const [wx, wy] = T.W(0.6, 0.5); PFX.emit(T.o.id + ':splash', 'splash', T.o.level, wx, wy, 1.95, 1); }
      }, { name: 'tray' }),
      F(0, 1.16, 1.18, 1.2, (T) => { T.poly([[0, 1.18, 0.06], [1.18, 1.18, 0.06], [1.18, 1.18, 2.06], [0, 1.18, 2.06]], 'rgba(200,226,232,.2)', RG.gold, 1.8); T.line([0.59, 1.18, 0.06], [0.59, 1.18, 2.06], RG.gold, 1.4); T.line([0.5, 1.18, 1.0], [0.5, 1.18, 1.3], RG.gold, 2.2); T.line([0.2, 1.18, 1.9], [0.45, 1.18, 1.4], 'rgba(255,255,255,.5)', 2); }),
      F(1.16, 0, 1.2, 1.18, (T) => { T.poly([[1.18, 0, 0.06], [1.18, 1.18, 0.06], [1.18, 1.18, 2.06], [1.18, 0, 2.06]], 'rgba(200,226,232,.18)', RG.gold, 1.8); })],
  });

  // Alpine Chalet: honey logs, knotty pine, buffalo check, sheepskin, river stone and black iron.
  const AL = { log: '#B07A45', logDark: '#8A5A30', logEnd: '#D9B07A', pine: '#C89A62', iron: '#2A2826', red: '#B3262E', cream: '#F2EADB', stone: '#9A948A', stoneDark: '#7E786E', sheep: '#F5F0E6' };
  // A round log seen side-on along x or y: a box with rounded shading, and its end grain where it shows.
  const logEnd = (T, x, y, z, r) => { const [ex, ey] = T.P(x, y, z); circle(ex, ey, r, AL.logEnd, AL.logDark); circle(ex, ey, r * 0.55, null, 'rgba(120,80,40,.5)'); };
  const check = (T, x0, x1, y0, y1, z, base) => { T.poly([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], base); for (let x = x0; x < x1 - 0.01; x += 0.16) T.poly([[x, y0, z + 0.001], [Math.min(x1, x + 0.08), y0, z + 0.001], [Math.min(x1, x + 0.08), y1, z + 0.001], [x, y1, z + 0.001]], 'rgba(20,10,10,.32)'); for (let y = y0; y < y1 - 0.01; y += 0.16) T.poly([[x0, y, z + 0.002], [x1, y, z + 0.002], [x1, Math.min(y1, y + 0.08), z + 0.002], [x0, Math.min(y1, y + 0.08), z + 0.002]], 'rgba(20,10,10,.32)'); };
  Object.assign(LOOK_DRAWERS.bed, {
    // A log bed: thick round posts, a headboard of stacked logs, a buffalo-check blanket in the piece's colour, a sheepskin
    // over the foot, and flannel pillows.
    chalet: (o) => { const c = cl(o); return [
      F(0, 0, 0.18, 1.6, (T) => { for (let k = 0; k < 6; k++) { const z = 0.25 + k * 0.17; T.box(0.03, 0.08, z, 0.12, 1.44, 0.15, k % 2 ? AL.log : shade(AL.log, -0.06)); logEnd(T, 0.09, 1.52, z + 0.075, 4); }
        [0.06, 1.54].forEach((y) => { T.box(0.02, y - 0.07, 0, 0.14, 0.14, 1.35, AL.logDark); logEnd(T, 0.09, y, 1.36, 5.5); }); }),
      F(0.18, 0, 2.5, 1.6, (T) => [0.06, 1.54].forEach((y) => { T.box(2.36, y - 0.07, 0, 0.14, 0.14, 0.7, AL.logDark); logEnd(T, 2.43, y, 0.71, 5.5); }), { onTop: true }),
      B(0.16, 0.02, 0.1, 2.24, 1.56, 0.2, AL.log), B(0.18, 0.05, 0.3, 2.2, 1.5, 0.2, AL.cream, { name: 'mattress' }),
      pillowsOn([0.18, 0.05, 0.3, 2.2, 1.5], [[0.2, 0.06, 0.5, 0.4, 0.72, 0.14, shade(c, 0.35)], [0.2, 0.82, 0.5, 0.4, 0.72, 0.14, shade(c, 0.35)]]),
      B(0.86, 0.03, 0.5, 1.5, 1.54, 0.05, c), B(0.86, 0.03, 0.55, 1.5, 1.54, 0.01, c, { cover: true }),
      F(0.86, 0, 2.36, 1.6, (T) => { check(T, 0.86, 2.36, 0.03, 1.57, 0.561, c); T.poly([[0.86, 1.57, 0.56], [2.36, 1.57, 0.56], [2.36, 1.57, 0.34], [0.86, 1.57, 0.34]], shade(c, -0.12));
        // A cream cable-knit throw folded across the foot, hanging over the near side.
        T.poly([[1.98, 0.03, 0.575], [2.3, 0.03, 0.575], [2.3, 1.58, 0.575], [1.98, 1.58, 0.575]], AL.sheep, 'rgba(0,0,0,.1)', 0.8); T.poly([[1.98, 1.58, 0.575], [2.3, 1.58, 0.575], [2.3, 1.58, 0.32], [1.98, 1.58, 0.32]], shade(AL.sheep, -0.06));
        [2.06, 2.14, 2.22].forEach((x) => { for (let y = 0.05; y < 1.56; y += 0.08) T.line([x - 0.02, y, 0.576], [x + 0.02, y + 0.04, 0.576], 'rgba(150,135,110,.45)', 0.8); }); }, { onTop: true })]; },
  });
  Object.assign(LOOK_DRAWERS.nightstand, {
    // A tree-stump side table with bark and rings, and a black iron lantern with a candle glow.
    chalet: (T, o) => { const lit = isLit(o.id);
      const [bx, by] = T.P(0.22, 0.22, 0), [tx, ty] = T.P(0.22, 0.22, 0.5); ctx.fillStyle = AL.logDark; ctx.fillRect(bx - 13, ty, 26, by - ty); ctx.strokeStyle = 'rgba(40,20,5,.35)'; ctx.lineWidth = 1; for (let k = -10; k <= 10; k += 5) { ctx.beginPath(); ctx.moveTo(bx + k, ty + 3); ctx.lineTo(bx + k + 1, by - 2); ctx.stroke(); }
      ell(bx, by, 13, 6.5, AL.logDark); ell(tx, ty, 13, 6.5, AL.logEnd, AL.logDark); [9, 6, 3].forEach((r) => ell(tx, ty, r, r / 2, null, 'rgba(120,80,40,.45)'));
      T.box(0.14, 0.14, 0.5, 0.14, 0.14, 0.2, 'rgba(40,38,36,.35)'); T.line([0.14, 0.14, 0.5], [0.14, 0.14, 0.7], AL.iron, 1.4); T.line([0.28, 0.28, 0.5], [0.28, 0.28, 0.7], AL.iron, 1.4); T.box(0.13, 0.13, 0.7, 0.16, 0.16, 0.03, AL.iron);
      const [lx, ly] = T.P(0.21, 0.21, 0.6); if (lit) { circle(lx, ly, 14, 'rgba(255,190,110,.28)'); circle(lx, ly, 3, '#FFD27A'); } else circle(lx, ly, 2, '#E8DCC4'); const [hx, hy] = T.P(0.21, 0.21, 0.76); ctx.strokeStyle = AL.iron; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(hx, hy, 3, Math.PI, 0); ctx.stroke(); },
  });
  Object.assign(LOOK_DRAWERS.dresser, {
    // A rough-hewn pine chest with black iron strap hinges and ring pulls, a candle and a bowl of pinecones.
    chalet: (T, o) => { const c = cl(o);
      T.box(0, 0, 0, 1.2, 0.5, 0.82, c); for (let k = 0; k < 6; k++) T.line([0.01 + k * 0.2, 0.501, 0.02], [0.01 + k * 0.2, 0.501, 0.8], 'rgba(60,35,10,.22)', 0.8); [[0.25, 0.3], [0.85, 0.6]].forEach(([x, z]) => { const [kx, ky] = T.P(x, 0.501, z); ell(kx, ky, 2.4, 1.4, 'rgba(90,55,20,.45)'); });
      [0.3, 0.56].forEach((z) => T.line([0.01, 0.501, z], [1.19, 0.501, z], 'rgba(40,20,5,.4)', 1.2));
      [0.17, 0.43, 0.69].forEach((z) => { [0.04, 1.02].forEach((x) => T.poly([[x, 0.502, z - 0.03], [x + 0.14, 0.502, z - 0.03], [x + 0.14, 0.502, z + 0.03], [x, 0.502, z + 0.03]], AL.iron)); const [rx, ry] = T.P(0.6, 0.503, z); ctx.strokeStyle = AL.iron; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(rx, ry + 1.5, 2, 0, Math.PI * 2); ctx.stroke(); });
      T.box(-0.03, -0.03, 0.82, 1.26, 0.56, 0.06, shade(c, -0.08));
      T.box(0.2, 0.2, 0.88, 0.08, 0.08, 0.12, AL.cream); const [fx, fy] = T.P(0.24, 0.24, 1.03); circle(fx, fy, 3, 'rgba(255,200,120,.35)'); ell(fx, fy, 1.2, 2.2, '#FFC861');
      const [px, py] = T.P(0.85, 0.25, 0.9); ell(px, py, 9, 4, AL.logDark); [[-4, -3], [3, -3], [0, -6], [-1, -1]].forEach(([dx, dy]) => ell(px + dx, py + dy, 2.6, 3.2, '#6E4A28', '#4A3018')); },
  });
  Object.assign(LOOK_DRAWERS.toilet, {
    // A white toilet with a knotty pine seat and a pine-boxed tank.
    chalet: (T, o) => {
      T.box(0.04, 0, 0.36, 0.34, 0.16, 0.42, AL.pine); for (let k = 1; k < 4; k++) T.line([0.04 + k * 0.085, 0.161, 0.37], [0.04 + k * 0.085, 0.161, 0.77], 'rgba(60,35,10,.3)', 0.8); T.line([0.06, 0.161, 0.7], [0.13, 0.161, 0.7], AL.iron, 1.6);
      T.box(0.09, 0.16, 0, 0.24, 0.26, 0.32, '#FFFFFF'); const [bx, by] = T.P(0.21, 0.42, 0.3); ell(bx, by, 7.5, 6, '#FFFFFF', 'rgba(0,0,0,.12)');
      const [sx, sy] = T.P(0.21, 0.4, 0.385); ell(sx, sy, 7, 4, AL.pine); ell(sx, sy, 5, 2.8, '#E8EEF0');
      if (live(T.o.id)) { ell(sx, sy, 4.5, 2.5, '#BFE2F0'); ctx.strokeStyle = 'rgba(90,150,200,.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(sx, sy, 3, 1.6, animT * 9, 0, Math.PI * 1.4); ctx.stroke(); } },
  });
  Object.assign(LOOK_DRAWERS.vanity, {
    // A hammered copper basin on a thick pine plank over a log-legged stand, a black iron tap and a wool towel.
    chalet: (T, o) => { const c = cl(o);
      [[0.08, 0.08], [0.92, 0.08], [0.08, 0.42], [0.92, 0.42]].forEach(([x, y]) => { T.box(x - 0.05, y - 0.05, 0, 0.1, 0.1, 0.74, AL.logDark); });
      T.box(0.06, 0.06, 0.2, 0.88, 0.38, 0.04, AL.pine); T.box(0.15, 0.12, 0.24, 0.3, 0.24, 0.12, AL.red); T.box(0.55, 0.12, 0.24, 0.28, 0.24, 0.1, AL.cream);
      T.box(-0.03, -0.02, 0.74, 1.06, 0.54, 0.08, c); const [vx, vy] = T.P(0.5, 0.27, 0.82); ell(vx, vy + 3, 11, 6, '#9A5A30'); ell(vx, vy, 11, 5.5, '#C27A45', '#8A4A20'); ell(vx, vy, 8, 3.8, '#A8653A');
      T.line([0.5, 0.04, 0.82], [0.5, 0.04, 1.0], AL.iron, 2.2); T.line([0.5, 0.04, 1.0], [0.5, 0.16, 0.98], AL.iron, 2.2); },
  });
  Object.assign(LOOK_DRAWERS.shower, {
    // River-stone walls, a cedar slat floor, black iron pipes to a big rain head, and a frosted glass door.
    chalet: (o) => [F(0, 0, 1.18, 1.18, (T) => {
        T.box(0, 0, 0, 1.18, 1.18, 0.06, AL.logDark); for (let k = 0; k < 9; k++) T.box(0.04 + k * 0.125, 0.06, 0.06, 0.1, 1.06, 0.02, k % 2 ? AL.pine : shade(AL.pine, -0.06));
        T.box(0, 0, 0.06, 1.18, 0.08, 2.04, AL.stone); for (let k = 0; k < 60; k++) { const u = 0.04 + ((k * 0.618) % 1) * 1.1, z = 0.12 + ((k * 0.382) % 1) * 1.92, [rx, ry] = T.P(u, 0.081, z); ell(rx, ry, 4 + (k % 3), 2.6 + (k % 2), [AL.stoneDark, '#B0AA9E', '#8C867C', '#A39C90'][k % 4], 'rgba(0,0,0,.18)'); }
        T.line([0.6, 0.08, 0.9], [0.6, 0.08, 2.08], AL.iron, 2.2); T.line([0.6, 0.08, 2.08], [0.6, 0.45, 2.08], AL.iron, 2.2); const [hx, hy] = T.P(0.6, 0.5, 2.05); ell(hx, hy, 10, 5, AL.iron); [[0.48, 1.0], [0.72, 1.0]].forEach(([x, z]) => { const [kx, ky] = T.P(x, 0.082, z); circle(kx, ky, 2.6, AL.iron); });
        if (usingSlot(T.o.id + ':s') || live(T.o.id)) { steamAt(T, 0.6, 0.6, 0.9, 0, 6, 1); steamAt(T, 0.5, 0.75, 1.5, 0, 3, 0.8); const [wx, wy] = T.W(0.6, 0.5); PFX.emit(T.o.id + ':splash', 'splash', T.o.level, wx, wy, 1.95, 1); }
      }, { name: 'tray' }),
      // A frosted glass enclosure in black iron frames: the door on the front, a fixed pane on the open side, and a header
      // rail round the top tying both to the stone wall.
      F(0, 1.16, 1.18, 1.2, (T) => { T.poly([[0, 1.18, 0.06], [1.18, 1.18, 0.06], [1.18, 1.18, 2.04], [0, 1.18, 2.04]], 'rgba(235,240,240,.5)', AL.iron, 1.6); T.line([0.59, 1.18, 0.06], [0.59, 1.18, 2.04], AL.iron, 1.2); T.line([0.5, 1.18, 1.0], [0.5, 1.18, 1.3], AL.iron, 2.2); T.line([0, 1.18, 2.04], [1.18, 1.18, 2.04], AL.iron, 2.6); }),
      F(1.16, 0, 1.2, 1.18, (T) => { T.poly([[1.18, 0.08, 0.06], [1.18, 1.18, 0.06], [1.18, 1.18, 2.04], [1.18, 0.08, 2.04]], 'rgba(235,240,240,.45)', AL.iron, 1.6); T.line([1.18, 0.08, 2.04], [1.18, 1.18, 2.04], AL.iron, 2.6); T.line([1.18, 0.6, 0.06], [1.18, 0.6, 2.04], AL.iron, 1); }, { onTop: true })],
  });

  // Victorian Boudoir: carved mahogany, rose damask, velvet, lace, brass and blue-and-white china.
  const VI = { mahog: '#5A2A1E', mahogLite: '#7A3E2C', mahogDark: '#3E1C14', brass: '#C9A24A', lace: '#FBF6EE', rose: '#C98A94', marble: '#EEE8E2', china: '#2E4C9A' };
  const lacePillow = (x, y) => [x, y, 0.5, 0.4, 0.72, 0.14, VI.lace];
  Object.assign(LOOK_DRAWERS.bed, {
    // A carved mahogany four-poster with a canopy and valance in the piece's colour, velvet drapes tied back at the foot
    // posts, lace pillows and a damask coverlet.
    victorian: (o) => { const c = cl(o), post = (T, x, y) => { T.box(x - 0.05, y - 0.05, 0, 0.1, 0.1, 2.2, VI.mahog); const [kx, ky] = T.P(x, y, 2.24); circle(kx, ky, 3.4, VI.mahogLite, VI.mahogDark); };
      // A valance along one top rail, from a to b: a band in the piece's colour with a gold-swagged hem.
      const valance = (T, a, b) => { const q = (p, z) => [p[0], p[1], z]; T.poly([q(a, 2.18), q(b, 2.18), q(b, 1.98), q(a, 1.98)], c, 'rgba(0,0,0,.2)', 0.6);
        const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.2)); for (let k = 0; k < n; k++) { const f0 = k / n, f1 = (k + 1) / n; const p0 = [a[0] + (b[0] - a[0]) * f0, a[1] + (b[1] - a[1]) * f0], p1 = [a[0] + (b[0] - a[0]) * f1, a[1] + (b[1] - a[1]) * f1];
          for (let m = 0; m < 6; m++) { const g0 = m / 6, g1 = (m + 1) / 6; T.line([p0[0] + (p1[0] - p0[0]) * g0, p0[1] + (p1[1] - p0[1]) * g0, 1.98 - Math.sin(g0 * Math.PI) * 0.06], [p0[0] + (p1[0] - p0[0]) * g1, p0[1] + (p1[1] - p0[1]) * g1, 1.98 - Math.sin(g1 * Math.PI) * 0.06], VI.brass, 1.2); } } };
      // A drape hanging from the canopy beside a post, gathered and tied back halfway down with a gold tassel.
      const drape = (T, x, y, dy) => { const top = (f) => [x, y + dy * f, 2.0]; T.poly([top(0), top(1), [x, y + dy * 0.35, 1.15], [x, y + dy * 0.55, 0.05], [x, y, 0.05]], shade(c, -0.05), 'rgba(0,0,0,.25)', 0.6);
        T.line([x, y + dy * 0.5, 1.95], [x, y + dy * 0.2, 1.18], 'rgba(0,0,0,.18)', 0.8); T.line([x, y + dy * 0.8, 1.95], [x, y + dy * 0.3, 1.16], 'rgba(0,0,0,.18)', 0.8); const [tx, ty] = T.P(x, y + dy * 0.2, 1.15); circle(tx, ty, 2.4, VI.brass); limb(tx, ty, tx, ty + 7, VI.brass, 1.2); };
      return [
      F(0, 0, 0.16, 1.6, (T) => { post(T, 0.06, 0.06); post(T, 0.06, 1.54); T.box(0.02, 0.1, 0.3, 0.1, 1.4, 1.0, VI.mahog);
        const arch = (y) => 1.3 + 0.18 * Math.sin(Math.PI * (y - 0.1) / 1.4); const pts = []; for (let k = 0; k <= 14; k++) { const y = 0.1 + 1.4 * k / 14; pts.push([0.121, y, arch(y)]); } T.poly([[0.121, 0.1, 1.3], ...pts, [0.121, 1.5, 1.3]], VI.mahog, VI.mahogDark, 1);
        T.poly([[0.122, 0.3, 0.55], [0.122, 1.3, 0.55], [0.122, 1.3, 1.15], [0.122, 0.3, 1.15]], c, VI.brass, 1);
        T.line([0.06, 0.06, 2.18], [0.06, 1.54, 2.18], VI.mahog, 3); T.line([0.06, 0.06, 2.18], [2.44, 0.06, 2.18], VI.mahog, 3); valance(T, [0.06, 0.06], [0.06, 1.54]); valance(T, [0.06, 0.06], [2.44, 0.06]); }),
      B(0.12, 0.04, 0.12, 2.32, 1.52, 0.2, VI.mahog), B(0.16, 0.06, 0.32, 2.26, 1.48, 0.2, VI.lace, { name: 'mattress' }),
      pillowsOn([0.16, 0.06, 0.32, 2.26, 1.48], [lacePillow(0.18, 0.06), lacePillow(0.18, 0.82), [0.38, 0.4, 0.5, 0.16, 0.8, 0.14, c]]),
      B(0.86, 0.04, 0.52, 1.58, 1.52, 0.05, c), B(0.86, 0.04, 0.57, 1.58, 1.52, 0.01, c, { cover: true }),
      F(0.86, 0, 2.5, 1.6, (T) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const [dx, dy] = T.P(1.05 + i * 0.4, 0.22 + j * 0.38, 0.581); ell(dx, dy, 4, 2.2, null, shade(c, 0.25)); circle(dx, dy, 1, shade(c, 0.25)); }
        T.poly([[0.86, 1.56, 0.57], [2.44, 1.56, 0.57], [2.44, 1.56, 0.3], [0.86, 1.56, 0.3]], shade(c, -0.12)); for (let x = 0.9; x < 2.44; x += 0.08) { const [hx, hy] = T.P(x, 1.56, 0.3); circle(hx, hy, 1.2, VI.lace); } }, { onTop: true }),
      // The foot posts, the near rails with their valances, and drapes tied back at the foot posts.
      F(0, 0, 2.5, 1.6, (T) => { post(T, 2.44, 0.06); post(T, 2.44, 1.54);
        T.line([0.06, 1.54, 2.18], [2.44, 1.54, 2.18], VI.mahog, 3); T.line([2.44, 0.06, 2.18], [2.44, 1.54, 2.18], VI.mahog, 3);
        drape(T, 2.46, 1.54, -1); drape(T, 2.46, 0.06, 1); drape(T, 2.44, 1.56, 0); valance(T, [0.06, 1.55], [2.45, 1.55]); valance(T, [2.45, 0.06], [2.45, 1.55]);
        [[2.3, 1.56], [0.2, 1.56]].forEach(([x, y]) => { T.poly([[x, y, 2.0], [x + (x > 1 ? 0.14 : -0.14), y, 2.0], [x + (x > 1 ? 0.06 : -0.06), y, 1.15], [x + (x > 1 ? 0.1 : -0.1), y, 0.05], [x, y, 0.05]], shade(c, -0.05), 'rgba(0,0,0,.25)', 0.6); const [tx, ty] = T.P(x + (x > 1 ? 0.06 : -0.06), y, 1.15); circle(tx, ty, 2.4, VI.brass); }); }, { onTop: true })]; },
  });
  Object.assign(LOOK_DRAWERS.nightstand, {
    // A mahogany bedside table on cabriole legs with a marble top, and a lamp under a fringed rose shade.
    victorian: (T, o) => { const lit = isLit(o.id);
      [[0.06, 0.06, -1, -1], [0.39, 0.06, 1, -1], [0.06, 0.39, -1, 1], [0.39, 0.39, 1, 1]].forEach(([x, y, dx, dy]) => { const [ax, ay] = T.P(x, y, 0.3), [bx, by] = T.P(x + dx * 0.03, y + dy * 0.03, 0); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(ax + dx * 4, (ay + by) / 2, bx, by); ctx.strokeStyle = VI.mahog; ctx.lineWidth = 2.6; ctx.stroke(); });
      T.box(0.03, 0.03, 0.3, 0.39, 0.39, 0.2, VI.mahog); const [kx, ky] = T.P(0.22, 0.421, 0.4); circle(kx, ky, 1.6, VI.brass); T.box(0, 0, 0.5, 0.45, 0.45, 0.03, VI.marble);
      T.box(0.13, 0.13, 0.53, 0.08, 0.08, 0.14, VI.brass); const [sx, sy] = T.P(0.17, 0.17, 0.78); if (lit) ell(sx, sy + 6, 14, 8, 'rgba(255,200,170,.32)');
      ctx.beginPath(); ctx.moveTo(sx - 5, sy - 6); ctx.lineTo(sx + 5, sy - 6); ctx.lineTo(sx + 9, sy + 4); ctx.lineTo(sx - 9, sy + 4); ctx.closePath(); ctx.fillStyle = lit ? '#F6C9CF' : VI.rose; ctx.fill(); for (let k = -8; k <= 8; k += 2) limb(sx + k, sy + 4, sx + k, sy + 7, VI.brass, 0.8); },
  });
  Object.assign(LOOK_DRAWERS.dresser, {
    // A mahogany chest with brass escutcheons on carved feet, a tall oval mirror in a carved frame, a lace runner and
    // cut-glass perfume bottles.
    victorian: (T, o) => { const c = cl(o);
      [[0.06, 0.06], [1.14, 0.06], [0.06, 0.44], [1.14, 0.44]].forEach(([x, y]) => { const [fx, fy] = T.P(x, y, 0.04); ell(fx, fy, 3.4, 2.4, VI.mahogDark); });
      T.box(0, 0, 0.06, 1.2, 0.5, 0.76, c); [0.3, 0.55].forEach((z) => T.line([0.02, 0.501, z], [1.18, 0.501, z], 'rgba(0,0,0,.35)', 1));
      [[0.3, 0.18], [0.9, 0.18], [0.3, 0.43], [0.9, 0.43], [0.3, 0.68], [0.9, 0.68]].forEach(([x, z]) => { const [ex, ey] = T.P(x, 0.502, z); ell(ex, ey, 3.4, 2.2, VI.brass); circle(ex, ey, 0.8, VI.mahogDark); });
      T.box(-0.02, -0.02, 0.82, 1.24, 0.54, 0.04, VI.mahogLite); T.poly([[0.1, 0.06, 0.861], [1.1, 0.06, 0.861], [1.1, 0.44, 0.861], [0.1, 0.44, 0.861]], VI.lace, 'rgba(0,0,0,.08)', 0.6);
      T.line([0.35, 0.06, 0.86], [0.35, 0.06, 1.05], c, 3); T.line([0.85, 0.06, 0.86], [0.85, 0.06, 1.05], c, 3);
      const [mx, my] = T.P(0.6, 0.06, 1.35); ctx.save(); ctx.translate(mx, my); ctx.scale(1, 1.25); ell(0, 0, 16, 16, c, VI.mahogDark); ell(0, 0, 13, 13, '#D8E2EA', VI.brass); ctx.restore(); limb(mx - 6, my - 10, mx + 2, my + 8, 'rgba(255,255,255,.6)', 1.2);
      [[0.25, '#C98A94'], [0.33, '#9DB7D5'], [0.95, '#E8C468']].forEach(([x, col]) => { T.box(x, 0.24, 0.86, 0.05, 0.05, 0.09, col); const [bx, by] = T.P(x + 0.025, 0.265, 0.97); circle(bx, by, 1.6, VI.brass); }); },
  });
  Object.assign(LOOK_DRAWERS.toilet, {
    // A blue-and-white china bowl with a mahogany seat, under a mahogany high tank with a brass pull chain.
    victorian: (T, o) => {
      T.box(0.04, 0, 1.45, 0.34, 0.14, 0.22, VI.mahog); T.line([0.21, 0.07, 1.45], [0.21, 0.07, 0.4], VI.brass, 1.6); T.line([0.34, 0.14, 1.5], [0.34, 0.16, 1.05], VI.brass, 0.8); const [hx, hy] = T.P(0.34, 0.16, 1.03); circle(hx, hy, 2, VI.lace);
      T.box(0.09, 0.08, 0, 0.24, 0.3, 0.34, '#FFFFFF'); for (let k = 0; k < 5; k++) { const [px, py] = T.P(0.1 + k * 0.05, 0.381, 0.12 + (k % 2) * 0.08); circle(px, py, 1.6, VI.china); limb(px, py, px + 3, py + 2, VI.china, 0.6); }
      const [bx, by] = T.P(0.21, 0.4, 0.3); ell(bx, by, 7.5, 6, '#FFFFFF', 'rgba(0,0,0,.12)'); const [sx, sy] = T.P(0.21, 0.38, 0.385); ell(sx, sy, 7, 4, VI.mahog); ell(sx, sy, 5, 2.8, '#E8EEF0');
      if (live(T.o.id)) { ell(sx, sy, 4.5, 2.5, '#BFE2F0'); ctx.strokeStyle = 'rgba(90,150,200,.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(sx, sy, 3, 1.6, animT * 9, 0, Math.PI * 1.4); ctx.stroke(); } },
  });
  Object.assign(LOOK_DRAWERS.vanity, {
    // A marble-topped mahogany washstand with a china basin and jug, a brass tap and a lace-edged towel on the rail.
    victorian: (T, o) => { const c = cl(o);
      T.box(0.02, 0.02, 0, 0.96, 0.46, 0.78, c); [0.04, 0.52].forEach((x) => T.poly([[x + 0.03, 0.481, 0.08], [x + 0.39, 0.481, 0.08], [x + 0.39, 0.481, 0.7], [x + 0.03, 0.481, 0.7]], null, VI.mahogLite, 1.2)); [0.44, 0.56].forEach((x) => { const [kx, ky] = T.P(x, 0.482, 0.42); circle(kx, ky, 1.6, VI.brass); });
      T.box(-0.02, -0.02, 0.78, 1.04, 0.54, 0.05, VI.marble); T.box(-0.02, -0.02, 0.83, 1.04, 0.06, 0.2, VI.marble);
      const [vx, vy] = T.P(0.45, 0.27, 0.83); ell(vx, vy, 10, 5, '#FFFFFF', VI.china); ell(vx, vy, 7, 3.4, '#DCE6EE'); T.line([0.45, 0.06, 0.83], [0.45, 0.06, 0.98], VI.brass, 2); T.line([0.45, 0.06, 0.98], [0.45, 0.16, 0.95], VI.brass, 2);
      T.box(0.78, 0.2, 0.83, 0.1, 0.1, 0.17, '#FFFFFF'); const [jx, jy] = T.P(0.83, 0.25, 0.9); circle(jx, jy, 1.8, VI.china); circle(jx + 3, jy + 1, 1.2, VI.china);
      T.line([1.0, 0.1, 0.65], [1.0, 0.4, 0.65], VI.brass, 1.4); T.poly([[1.002, 0.14, 0.65], [1.002, 0.36, 0.65], [1.002, 0.36, 0.42], [1.002, 0.14, 0.42]], VI.lace, 'rgba(0,0,0,.1)', 0.6); },
  });
  Object.assign(LOOK_DRAWERS.shower, {
    // A rose and cream mosaic floor, green tile below a damask wall, a brass riser to a big rose head, and a lace curtain
    // round a brass ring rail.
    victorian: (o) => [F(0, 0, 1.18, 1.18, (T, ob) => { const c = cl(ob);
        T.box(0, 0, 0, 1.18, 1.18, 0.06, '#F2EADF'); for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) if ((i * 3 + j * 5) % 7 < 2) { const [px, py] = T.P(0.05 + i * 0.09, 0.05 + j * 0.09, 0.061); ell(px, py, 2, 1.1, (i + j) % 2 ? VI.rose : '#7A9A7A'); }
        T.box(0, 0, 0.06, 1.18, 0.06, 1.0, '#4E7A5E'); for (let z = 0.16; z < 1.06; z += 0.1) T.line([0, 0.061, z], [1.18, 0.061, z], 'rgba(255,255,255,.35)', 0.7); T.box(0, 0, 1.06, 1.18, 0.06, 1.04, '#E9D3D0'); T.line([0, 0.061, 1.06], [1.18, 0.061, 1.06], VI.mahog, 2.4);
        T.line([0.6, 0.07, 0.4], [0.6, 0.07, 2.0], VI.brass, 2.4); T.line([0.6, 0.07, 2.0], [0.6, 0.35, 2.0], VI.brass, 2.4); const [hx, hy] = T.P(0.6, 0.4, 1.98); ell(hx, hy, 9, 4.5, VI.brass, shade(VI.brass, -0.3)); [[0.5, 1.0], [0.7, 1.0]].forEach(([x, z]) => { const [kx, ky] = T.P(x, 0.07, z); circle(kx, ky, 2.6, VI.brass); circle(kx, ky, 0.9, '#FFFFFF'); });
        if (usingSlot(T.o.id + ':s') || live(T.o.id)) { steamAt(T, 0.6, 0.6, 0.9, 0, 6, 1); steamAt(T, 0.5, 0.75, 1.5, 0, 3, 0.8); const [wx, wy] = T.W(0.6, 0.4); PFX.emit(T.o.id + ':splash', 'splash', T.o.level, wx, wy, 1.9, 1); }
      }, { name: 'tray' }),
      F(0, 1.14, 1.18, 1.2, (T) => { const open = usingSlot(T.o.id + ':s') ? 0.45 : 0.95; T.line([0, 1.17, 2.06], [1.18, 1.17, 2.06], VI.brass, 1.8);
        for (let k = 0; k < 10; k++) { const y0 = k * open / 10 * 1.18, y1 = (k + 1) * open / 10 * 1.18; T.poly([[y0, 1.17 + (k % 2) * 0.02, 0.15], [y1, 1.17 + ((k + 1) % 2) * 0.02, 0.15], [y1, 1.17 + ((k + 1) % 2) * 0.02, 2.04], [y0, 1.17 + (k % 2) * 0.02, 2.04]], 'rgba(251,246,238,.78)', 'rgba(200,190,175,.4)', 0.5); }
        for (let y = 0.02; y < open * 1.18; y += 0.06) { const [lx, ly] = T.P(y, 1.19, 0.15); circle(lx, ly, 1.1, VI.lace); } }),
      F(1.14, 0, 1.2, 1.18, (T) => { T.line([1.17, 0, 2.06], [1.17, 1.18, 2.06], VI.brass, 1.8); for (let k = 0; k < 8; k++) { const y0 = 0.1 + k * 0.135, y1 = y0 + 0.135; T.poly([[1.17 + (k % 2) * 0.02, y0, 0.15], [1.17 + ((k + 1) % 2) * 0.02, y1, 0.15], [1.17 + ((k + 1) % 2) * 0.02, y1, 2.04], [1.17 + (k % 2) * 0.02, y0, 2.04]], 'rgba(251,246,238,.7)', 'rgba(200,190,175,.4)', 0.5); } }, { onTop: true })],
  });

  // Wabi-Sabi Ryokan: pale hinoki, tatami, clay plaster, river stone, indigo and paper.
  const RY = { hinoki: '#E2C99E', hinokiDark: '#C9AC7E', tatami: '#C9C48E', tatamiEdge: '#2B2B30', clay: '#B7A184', stone: '#8E8A84', stoneLite: '#B4AFA6', indigo: '#2E3F66', paper: '#F7F1E3', iron: '#2A2826', moss: '#6E8A4E' };
  Object.assign(LOOK_DRAWERS.bed, {
    // A futon on a low hinoki dais edged in tatami: a thin mattress, a buckwheat pillow, and a quilt in the piece's colour
    // folded back at the top, with a paper screen behind.
    ryokan: (o) => { const c = cl(o); return [
      F(0, 0, 0.1, 1.6, (T) => { T.box(0.02, 0, 0, 0.06, 1.6, 1.1, RY.hinokiDark); T.poly([[0.081, 0.04, 0.1], [0.081, 1.56, 0.1], [0.081, 1.56, 1.06], [0.081, 0.04, 1.06]], RY.paper); for (let k = 1; k < 6; k++) T.line([0.082, 1.6 * k / 6, 0.1], [0.082, 1.6 * k / 6, 1.06], RY.hinokiDark, 1.2); for (let z = 0.3; z < 1.06; z += 0.24) T.line([0.082, 0.04, z], [0.082, 1.56, z], RY.hinokiDark, 1.2); }),
      B(0.1, 0, 0, 2.4, 1.6, 0.14, RY.hinoki), F(0.1, 0, 2.5, 1.6, (T) => { T.poly([[0.1, 0, 0.141], [2.5, 0, 0.141], [2.5, 1.6, 0.141], [0.1, 1.6, 0.141]], RY.tatamiEdge); T.poly([[0.14, 0.04, 0.142], [2.46, 0.04, 0.142], [2.46, 1.56, 0.142], [0.14, 1.56, 0.142]], RY.tatami); for (let x = 0.2; x < 2.46; x += 0.06) T.line([x, 0.04, 0.143], [x, 1.56, 0.143], 'rgba(90,85,40,.18)', 0.6); }, { decal: false }),
      B(0.2, 0.15, 0.142, 2.2, 1.3, 0.1, RY.paper, { name: 'mattress' }),
      pillowsOn([0.2, 0.15, 0.142, 2.2, 1.3], [[0.24, 0.55, 0.242, 0.32, 0.5, 0.08, '#D9CBB0']]),
      B(0.7, 0.13, 0.242, 1.72, 1.34, 0.05, c), B(0.7, 0.13, 0.292, 1.72, 1.34, 0.01, c, { cover: true }),
      F(0.7, 0.1, 2.44, 1.5, (T) => { T.poly([[0.7, 0.13, 0.303], [0.95, 0.13, 0.303], [0.95, 1.47, 0.303], [0.7, 1.47, 0.303]], shade(c, 0.35)); for (let y = 0.2; y < 1.45; y += 0.24) T.line([0.98, y, 0.303], [2.4, y, 0.303], shade(c, -0.15), 0.8); }, { onTop: true })]; },
  });
  Object.assign(LOOK_DRAWERS.nightstand, {
    // A low hinoki box with a paper andon lantern and a single branch in a stoneware vase.
    ryokan: (T, o) => { const lit = isLit(o.id);
      T.box(0.04, 0.04, 0, 0.37, 0.37, 0.24, RY.hinoki); T.line([0.04, 0.411, 0.12], [0.41, 0.411, 0.12], RY.hinokiDark, 1);
      T.box(0.08, 0.08, 0.24, 0.16, 0.16, 0.34, lit ? '#FFF4DC' : RY.paper); [0.08, 0.24].forEach((x) => [0.08, 0.24].forEach((y) => T.line([x, y, 0.24], [x, y, 0.58], RY.iron, 1.2))); T.line([0.08, 0.241, 0.41], [0.24, 0.241, 0.41], RY.iron, 0.8);
      if (lit) { const [lx, ly] = T.P(0.16, 0.16, 0.42); circle(lx, ly, 16, 'rgba(255,226,170,.28)'); }
      T.box(0.29, 0.27, 0.24, 0.07, 0.07, 0.1, '#5A5450'); const [bx, by] = T.P(0.325, 0.305, 0.34); limb(bx, by, bx - 6, by - 16, '#4A3A2A', 1); limb(bx - 4, by - 10, bx + 2, by - 14, '#4A3A2A', 0.8); [[-6, -16], [2, -14], [-3, -12]].forEach(([dx, dy]) => circle(bx + dx, by + dy, 1.4, '#E8B4C0')); },
  });
  Object.assign(LOOK_DRAWERS.dresser, {
    // A dark kiri tansu: stepped drawers with black iron pulls and corner plates, and a tea set on a tray.
    ryokan: (T, o) => { const c = cl(o);
      T.box(0, 0, 0, 1.2, 0.5, 0.84, c); [0.28, 0.56].forEach((z) => T.line([0.01, 0.501, z], [1.19, 0.501, z], 'rgba(0,0,0,.4)', 1)); T.line([0.6, 0.501, 0.56], [0.6, 0.501, 0.84], 'rgba(0,0,0,.4)', 1);
      [[0.6, 0.14], [0.6, 0.42], [0.3, 0.7], [0.9, 0.7]].forEach(([x, z]) => { const [px, py] = T.P(x, 0.502, z); rr(px - 4, py - 2, 8, 4, 1, RY.iron); ctx.strokeStyle = RY.iron; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(px, py + 2, 3, 0, Math.PI); ctx.stroke(); });
      // Small iron L-plates on the front corners.
      [[0.03, 0.03, 1, 1], [1.17, 0.81, -1, -1], [0.03, 0.81, 1, -1], [1.17, 0.03, -1, 1]].forEach(([x, z, sx, sz]) => { T.line([x, 0.502, z], [x + sx * 0.08, 0.502, z], RY.iron, 1.8); T.line([x, 0.502, z], [x, 0.502, z + sz * 0.08], RY.iron, 1.8); });
      T.box(0.15, 0.12, 0.84, 0.4, 0.26, 0.02, RY.hinokiDark); T.box(0.22, 0.18, 0.86, 0.1, 0.1, 0.08, '#6E6A64'); [0.38, 0.46].forEach((x) => T.box(x, 0.2, 0.86, 0.05, 0.05, 0.05, '#9A948A')); },
  });
  Object.assign(LOOK_DRAWERS.toilet, {
    // A plain white toilet with a hinoki seat, and a river-stone shelf behind with a tiny bonsai.
    ryokan: (T, o) => {
      T.box(0, 0, 0.66, 0.42, 0.14, 0.05, RY.stone); T.box(0.24, 0.03, 0.71, 0.08, 0.08, 0.05, '#5A5450'); const [bx2, by2] = T.P(0.28, 0.07, 0.8); ell(bx2, by2, 5, 3, RY.moss); limb(bx2, by2 + 3, bx2 + 1, by2 - 1, '#4A3A2A', 1);
      T.box(0.06, 0, 0, 0.3, 0.16, 0.62, '#FFFFFF'); T.box(0.09, 0.14, 0, 0.24, 0.3, 0.3, '#FFFFFF');
      const [bx, by] = T.P(0.21, 0.4, 0.3); ell(bx, by, 7.5, 6, '#FFFFFF', 'rgba(0,0,0,.12)'); const [sx, sy] = T.P(0.21, 0.38, 0.385); ell(sx, sy, 7, 4, RY.hinoki); ell(sx, sy, 5, 2.8, '#E8EEF0');
      if (live(T.o.id)) { ell(sx, sy, 4.5, 2.5, '#BFE2F0'); ctx.strokeStyle = 'rgba(90,150,200,.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(sx, sy, 3, 1.6, animT * 9, 0, Math.PI * 1.4); ctx.stroke(); } },
  });
  Object.assign(LOOK_DRAWERS.vanity, {
    // A hinoki counter with a river-stone vessel basin and a bamboo spout, a folded indigo tenugui underneath.
    ryokan: (T, o) => { const c = cl(o);
      T.box(0.02, 0.04, 0.5, 0.96, 0.42, 0.28, c); T.box(0.06, 0.08, 0, 0.06, 0.34, 0.5, RY.hinokiDark); T.box(0.88, 0.08, 0, 0.06, 0.34, 0.5, RY.hinokiDark); T.box(0.12, 0.08, 0.1, 0.76, 0.34, 0.03, RY.hinokiDark); T.box(0.3, 0.14, 0.13, 0.36, 0.22, 0.05, RY.indigo);
      T.box(-0.02, 0, 0.78, 1.04, 0.5, 0.04, RY.hinoki);
      const [vx, vy] = T.P(0.5, 0.26, 0.82); ell(vx, vy + 3, 11, 6, RY.stone); ell(vx, vy, 11, 5.5, RY.stoneLite, '#6E6A64'); ell(vx, vy, 8, 3.6, '#7E8A8C');
      T.line([0.5, 0.03, 0.82], [0.5, 0.03, 1.02], '#7FA06A', 3); T.line([0.5, 0.03, 1.02], [0.5, 0.18, 0.99], '#7FA06A', 3); const [nx, ny] = T.P(0.5, 0.03, 0.92); limb(nx - 2, ny, nx + 2, ny, '#5E7E4E', 1); },
  });
  Object.assign(LOOK_DRAWERS.shower, {
    // A wet room of hinoki: slatted walls and floor, a stone back wall, a bamboo rain spout, a wooden stool and bucket, and an
    // indigo noren hanging at the open front.
    ryokan: (o) => [F(0, 0, 1.18, 1.18, (T, ob) => { const c = cl(ob);
        T.box(0, 0, 0, 1.18, 1.18, 0.06, RY.hinokiDark); for (let k = 0; k < 10; k++) T.box(0.02 + k * 0.116, 0.02, 0.06, 0.09, 1.14, 0.015, RY.hinoki);
        T.box(0, 0, 0.06, 1.18, 0.08, 2.04, RY.stone); for (let k = 0; k < 40; k++) { const u = 0.04 + ((k * 0.618) % 1) * 1.1, z = 0.12 + ((k * 0.382) % 1) * 1.92, [rx, ry] = T.P(u, 0.081, z); ell(rx, ry, 5, 3, [RY.stoneLite, '#9A948A', '#A39C90'][k % 3], 'rgba(0,0,0,.15)'); }
        T.line([0.6, 0.08, 2.0], [0.6, 0.5, 2.0], '#7FA06A', 4); const [sx, sy] = T.P(0.6, 0.52, 1.98); ell(sx, sy, 3, 2, '#5E7E4E');
        T.box(0.15, 0.6, 0.075, 0.24, 0.24, 0.22, RY.hinoki); T.box(0.82, 0.25, 0.075, 0.2, 0.2, 0.16, RY.hinokiDark); T.line([0.82, 0.25, 0.2], [1.02, 0.45, 0.2], RY.iron, 1.2);
        if (usingSlot(T.o.id + ':s') || live(T.o.id)) { steamAt(T, 0.6, 0.6, 0.9, 0, 6, 1); steamAt(T, 0.5, 0.75, 1.5, 0, 3, 0.8); const [wx, wy] = T.W(0.6, 0.52); PFX.emit(T.o.id + ':splash', 'splash', T.o.level, wx, wy, 1.9, 1); }
      }, { name: 'tray' }),
      F(1.14, 0, 1.2, 1.18, (T) => { T.box(1.14, 0.08, 0.06, 0.04, 1.1, 2.04, RY.hinokiDark); for (let k = 0; k < 12; k++) T.line([1.181, 0.1 + k * 0.09, 0.08], [1.181, 0.1 + k * 0.09, 2.08], RY.hinoki, 3); }, { onTop: true }),
      F(0, 1.14, 1.18, 1.2, (T, ob) => { const c = cl(ob); T.line([0, 1.17, 2.06], [1.18, 1.17, 2.06], RY.hinokiDark, 2.4); const parts = 3, gap = 0.012;
        for (let k = 0; k < parts; k++) { const y0 = k * 1.18 / parts + gap, y1 = (k + 1) * 1.18 / parts - gap; T.poly([[y0, 1.18, 2.06], [y1, 1.18, 2.06], [y1, 1.18, 1.4], [y0, 1.18, 1.4]], c, 'rgba(0,0,0,.2)', 0.6); }
        const [mx, my] = T.P(0.59, 1.181, 1.75); circle(mx, my, 6, null, '#F2EBDD'); ctx.strokeStyle = '#F2EBDD'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(mx, my, 6, 0, Math.PI * 2); ctx.stroke(); }, { onTop: true })],
  });

  // Celestial Dream: pearl white, moon gold, night navy and lavender, opal glass and stars.
  const CE = { pearl: '#F4F1F8', pearlShade: '#DCD6E8', gold: '#E2C46A', navy: '#1F2550', lav: '#B9A9DE', opal: 'rgba(200,220,255,.55)' };
  const star4 = (x, y, r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.28, y - r * 0.28); ctx.lineTo(x + r, y); ctx.lineTo(x + r * 0.28, y + r * 0.28); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.28, y + r * 0.28); ctx.lineTo(x - r, y); ctx.lineTo(x - r * 0.28, y - r * 0.28); ctx.closePath(); ctx.fill(); };
  const opalTint = (k) => ['rgba(214,228,255,.9)', 'rgba(232,214,250,.9)', 'rgba(214,246,240,.9)', 'rgba(250,226,238,.9)'][k % 4];
  Object.assign(LOOK_DRAWERS.bed, {
    // A cloud-white upholstered bed under a great gold crescent moon, puffy white pillows, and a duvet in the piece's colour
    // scattered with gold stars.
    celestial: (o) => { const c = cl(o); return [
      F(0, 0, 0.16, 1.6, (T) => { T.box(0, 0.05, 0, 0.14, 1.5, 0.9, CE.pearl); for (let k = 1; k < 6; k++) T.line([0.141, 0.05 + k * 0.25, 0.1], [0.141, 0.05 + k * 0.25, 0.85], CE.pearlShade, 1);
        // The crescent rises from the headboard: both horns rest on its top edge.
        const pts = [], inner = []; for (let k = 0; k <= 16; k++) { const a = Math.PI * k / 16; pts.push([0.07, 0.8 - Math.cos(a) * 0.72, 0.9 + Math.sin(a) * 0.72]); inner.push([0.07, 0.92 - Math.cos(a) * 0.6, 0.9 + Math.sin(a) * 0.5]); }
        T.poly([...pts, ...inner.reverse()], CE.gold, shade(CE.gold, -0.25), 1); [[0.07, 0.3, 1.55], [0.07, 1.35, 1.5], [0.07, 0.9, 1.75]].forEach((p, k) => { const [sx, sy] = T.P(...p); star4(sx, sy, 3 + k, CE.gold); }); }),
      B(0.14, 0.04, 0.08, 2.32, 1.52, 0.24, CE.pearl), B(0.16, 0.06, 0.32, 2.28, 1.48, 0.2, '#FFFFFF', { name: 'mattress' }),
      pillowsOn([0.16, 0.06, 0.32, 2.28, 1.48], [[0.18, 0.06, 0.52, 0.42, 0.72, 0.16, CE.pearl], [0.18, 0.82, 0.52, 0.42, 0.72, 0.16, CE.pearl], [0.4, 0.5, 0.52, 0.18, 0.6, 0.12, CE.lav]]),
      B(0.84, 0.03, 0.52, 1.62, 1.54, 0.06, c), B(0.84, 0.03, 0.58, 1.62, 1.54, 0.01, c, { cover: true }),
      F(0.84, 0, 2.46, 1.6, (T) => { for (let k = 0; k < 22; k++) { const [sx, sy] = T.P(0.9 + ((k * 0.618) % 1) * 1.5, 0.1 + ((k * 0.382) % 1) * 1.4, 0.591); star4(sx, sy, 1.2 + (k % 3) * 0.6, CE.gold); } T.poly([[0.84, 1.57, 0.58], [2.46, 1.57, 0.58], [2.46, 1.57, 0.34], [0.84, 1.57, 0.34]], shade(c, -0.12)); }, { onTop: true })]; },
  });
  Object.assign(LOOK_DRAWERS.nightstand, {
    // A round pearl side table on a gold stem, and a moon lamp: a cratered sphere that glows when on.
    celestial: (T, o) => { const lit = isLit(o.id);
      const [bx, by] = T.P(0.22, 0.22, 0); ell(bx, by, 10, 5, CE.gold); T.line([0.22, 0.22, 0], [0.22, 0.22, 0.48], CE.gold, 2.6); const [tx, ty] = T.P(0.22, 0.22, 0.5); ell(tx, ty + 2, 14, 7, CE.pearlShade); ell(tx, ty, 14, 7, CE.pearl, CE.pearlShade);
      const [mx, my] = T.P(0.22, 0.22, 0.66); if (lit) circle(mx, my, 18, 'rgba(255,244,214,.3)'); circle(mx, my, 9, lit ? '#FFF6E2' : '#E8E4DA', 'rgba(0,0,0,.12)'); [[-3, -2, 2], [3, 2, 1.6], [2, -4, 1.1]].forEach(([dx, dy, r]) => circle(mx + dx, my + dy, r, lit ? 'rgba(210,190,150,.5)' : 'rgba(150,145,135,.45)')); },
  });
  Object.assign(LOOK_DRAWERS.dresser, {
    // A dresser in the piece's colour with moon-phase knobs waxing across the drawers, and an amethyst geode and a star lamp on top.
    celestial: (T, o) => { const c = cl(o);
      T.box(0.03, 0.03, 0, 1.14, 0.44, 0.08, CE.gold); T.box(0, 0, 0.08, 1.2, 0.5, 0.74, c); [0.33, 0.58].forEach((z) => T.line([0.02, 0.501, z], [1.18, 0.501, z], 'rgba(0,0,0,.18)', 1));
      [0.2, 0.45, 0.7].forEach((z) => [0.2, 0.4, 0.6, 0.8, 1.0].forEach((x, k) => { const [kx, ky] = T.P(x, 0.502, z); circle(kx, ky, 2.4, CE.gold); if (k < 4) { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(kx + (k - 1.5) * 0.8, ky, 2.4 * (1 - k / 4), 2.4, 0, 0, Math.PI * 2); ctx.fill(); } }));
      T.box(-0.02, -0.02, 0.82, 1.24, 0.54, 0.03, CE.pearl);
      const [gx, gy] = T.P(0.3, 0.25, 0.86); ell(gx, gy, 8, 5, '#6E6A7A'); ell(gx, gy - 2, 6, 3.4, '#9A6FD0'); [[-2, -3], [1, -4], [3, -2]].forEach(([dx, dy]) => star4(gx + dx, gy + dy, 1.4, '#E8DCFF'));
      const [sx, sy] = T.P(0.9, 0.25, 1.05); T.line([0.9, 0.25, 0.85], [0.9, 0.25, 1.0], CE.gold, 1.4); star4(sx, sy, 7, '#FFF0B8'); circle(sx, sy, 10, 'rgba(255,240,184,.25)'); },
  });
  Object.assign(LOOK_DRAWERS.toilet, {
    // A pearl toilet with a lavender seat and a little gold star on the tank.
    celestial: (T, o) => {
      T.box(0.04, 0, 0.36, 0.34, 0.16, 0.38, CE.pearl); T.box(0.02, -0.01, 0.74, 0.38, 0.18, 0.03, CE.pearlShade); const [gx, gy] = T.P(0.21, 0.161, 0.58); star4(gx, gy, 3, CE.gold);
      T.box(0.09, 0.16, 0, 0.24, 0.26, 0.32, CE.pearl); const [bx, by] = T.P(0.21, 0.42, 0.3); ell(bx, by, 7.5, 6, CE.pearl, 'rgba(0,0,0,.12)');
      const [sx, sy] = T.P(0.21, 0.4, 0.385); ell(sx, sy, 7, 4, CE.lav); ell(sx, sy, 5, 2.8, '#E8EEF8');
      if (live(T.o.id)) { ell(sx, sy, 4.5, 2.5, '#BFE2F0'); ctx.strokeStyle = 'rgba(90,150,200,.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(sx, sy, 3, 1.6, animT * 9, 0, Math.PI * 1.4); ctx.stroke(); } },
  });
  Object.assign(LOOK_DRAWERS.vanity, {
    // A lavender vanity on a gold plinth: two framed doors with gold star knobs, a pearl top with an opal shell basin and a gold tap.
    celestial: (T, o) => { const c = cl(o);
      T.box(0.02, 0.02, 0, 0.96, 0.46, 0.06, CE.gold); T.box(0, 0, 0.06, 1.0, 0.5, 0.74, c);
      [0.03, 0.51].forEach((x) => T.poly([[x + 0.03, 0.501, 0.12], [x + 0.43, 0.501, 0.12], [x + 0.43, 0.501, 0.74], [x + 0.03, 0.501, 0.74]], shade(c, 0.08), CE.gold, 1.1));
      [0.42, 0.58].forEach((x) => { const [kx, ky] = T.P(x, 0.502, 0.48); star4(kx, ky, 3, CE.gold); });
      T.box(-0.02, -0.02, 0.8, 1.04, 0.54, 0.04, CE.pearl); T.line([-0.02, 0.521, 0.8], [1.02, 0.521, 0.8], CE.gold, 1); const [vx, vy] = T.P(0.5, 0.27, 0.841);
      ctx.beginPath(); ctx.moveTo(vx - 11, vy + 1); for (let k = 0; k <= 8; k++) { const a = Math.PI + Math.PI * k / 8; ctx.lineTo(vx + Math.cos(a) * 11, vy + Math.sin(a) * 6 - (k % 2 ? 1 : 0)); } ctx.closePath(); ctx.fillStyle = opalTint(1); ctx.fill(); ctx.strokeStyle = CE.pearlShade; ctx.lineWidth = 0.8; ctx.stroke(); ell(vx, vy, 8, 3.4, opalTint(0));
      T.line([0.5, 0.05, 0.84], [0.5, 0.05, 1.0], CE.gold, 2); T.line([0.5, 0.05, 1.0], [0.5, 0.17, 0.97], CE.gold, 2); },
  });
  Object.assign(LOOK_DRAWERS.shower, {
    // Opal glass tile shimmering in four tints, a gold star head, and glass frosted with a scatter of stars on all open sides.
    celestial: (o) => [F(0, 0, 1.18, 1.18, (T) => {
        T.box(0, 0, 0, 1.18, 1.18, 0.06, CE.pearl); for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) T.poly([[i * 0.1475, j * 0.1475, 0.061], [(i + 1) * 0.1475, j * 0.1475, 0.061], [(i + 1) * 0.1475, (j + 1) * 0.1475, 0.061], [i * 0.1475, (j + 1) * 0.1475, 0.061]], opalTint(i + j * 3), 'rgba(255,255,255,.6)', 0.5);
        T.box(0, 0, 0.06, 1.18, 0.06, 2.04, CE.pearl); for (let i = 0; i < 8; i++) for (let k = 0; k < 14; k++) T.poly([[i * 0.1475, 0.061, 0.06 + k * 0.146], [(i + 1) * 0.1475, 0.061, 0.06 + k * 0.146], [(i + 1) * 0.1475, 0.061, 0.06 + (k + 1) * 0.146], [i * 0.1475, 0.061, 0.06 + (k + 1) * 0.146]], opalTint(i * 2 + k), 'rgba(255,255,255,.6)', 0.5);
        T.box(0, 0.06, 0.06, 0.06, 1.12, 2.04, CE.pearl); for (let j = 0; j < 8; j++) for (let k = 0; k < 14; k++) T.poly([[0.061, 0.06 + j * 0.14, 0.06 + k * 0.146], [0.061, 0.06 + (j + 1) * 0.14, 0.06 + k * 0.146], [0.061, 0.06 + (j + 1) * 0.14, 0.06 + (k + 1) * 0.146], [0.061, 0.06 + j * 0.14, 0.06 + (k + 1) * 0.146]], opalTint(j * 3 + k + 1), 'rgba(255,255,255,.6)', 0.5);
        T.line([0, 0.061, 2.1], [1.18, 0.061, 2.1], CE.gold, 1.6); T.line([0.061, 0, 2.1], [0.061, 1.18, 2.1], CE.gold, 1.6);
        T.line([0.6, 0.06, 2.06], [0.6, 0.4, 2.06], CE.gold, 2.2); const [hx, hy] = T.P(0.6, 0.45, 2.04); star4(hx, hy, 5, CE.gold); [[0.48, 1.05], [0.72, 1.05]].forEach(([x, z]) => { const [kx, ky] = T.P(x, 0.062, z); circle(kx, ky, 2.4, CE.gold); });
        if (usingSlot(T.o.id + ':s') || live(T.o.id)) { steamAt(T, 0.6, 0.6, 0.9, 0, 6, 1); steamAt(T, 0.5, 0.75, 1.5, 0, 3, 0.8); const [wx, wy] = T.W(0.6, 0.45); PFX.emit(T.o.id + ':splash', 'splash', T.o.level, wx, wy, 1.9, 1); }
      }, { name: 'tray' }),
      F(0, 1.16, 1.18, 1.2, (T) => { T.poly([[0, 1.18, 0.06], [1.18, 1.18, 0.06], [1.18, 1.18, 2.06], [0, 1.18, 2.06]], 'rgba(220,230,255,.22)', CE.gold, 1.4); T.line([0.59, 1.18, 0.06], [0.59, 1.18, 2.06], CE.gold, 1.2); for (let k = 0; k < 14; k++) { const [sx, sy] = T.P(0.05 + ((k * 0.618) % 1) * 1.1, 1.181, 0.2 + ((k * 0.382) % 1) * 1.8); star4(sx, sy, 1.6, 'rgba(255,255,255,.85)'); } }),
      F(1.16, 0, 1.2, 1.18, (T) => { T.poly([[1.18, 0.06, 0.06], [1.18, 1.18, 0.06], [1.18, 1.18, 2.06], [1.18, 0.06, 2.06]], 'rgba(220,230,255,.2)', CE.gold, 1.4); for (let k = 0; k < 12; k++) { const [sx, sy] = T.P(1.181, 0.1 + ((k * 0.618) % 1) * 1.0, 0.2 + ((k * 0.382) % 1) * 1.8); star4(sx, sy, 1.6, 'rgba(255,255,255,.85)'); } }, { onTop: true })],
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
    if (style === 'cloudlamp') { T.line([0.65, 1.24, WH], [0.65, 1.24, 1.96], NA.gold, 1.2); if (on) ell(px, py + 2, 18, 11, 'rgba(255,214,232,.26)'); cloudLight(px, py, 8, on ? '#FFFAFD' : NA.white); circle(px - 5, py + 9, 1.2, NA.pinkDeep); circle(px + 5, py + 10, 1.2, NA.lilacDeep); return; }
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

  // ---- Nana: the soft-girl era. Pastel pink, lilac and butter; ruffles, bows, hearts, daisies, butterflies, pearls, lace and fairy lights ----
  const NA = { pink: '#F8C8DC', pinkDeep: '#EFA3C4', lilac: '#D9C8F2', lilacDeep: '#B9A2E0', butter: '#FFF1B8', blue: '#C5E3F6', mint: '#CFEBDD', cream: '#FFF8F0', white: '#FFFFFF', peach: '#FFD9C7', gold: '#E8C877', ink: '#6A5470', edge: '#E7A8C4' };
  /** A bow in screen space: two loops, a knot and two short tails. */
  const bow = (sx, sy, s, col) => { ell(sx - s * 0.9, sy, s, s * 0.65, col, 'rgba(0,0,0,.08)', -0.3); ell(sx + s * 0.9, sy, s, s * 0.65, col, 'rgba(0,0,0,.08)', 0.3); limb(sx, sy + s * 0.3, sx - s * 0.5, sy + s * 1.5, shade(col, -0.1), s * 0.45); limb(sx, sy + s * 0.3, sx + s * 0.5, sy + s * 1.5, shade(col, -0.1), s * 0.45); circle(sx, sy, s * 0.42, shade(col, -0.16)); };
  /** A daisy in screen space: white petals round a butter-yellow eye. */
  const daisy = (sx, sy, r) => { for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; ell(sx + Math.cos(a) * r * 0.75, sy + Math.sin(a) * r * 0.75, r * 0.55, r * 0.32, NA.white, 'rgba(0,0,0,.08)', a); } circle(sx, sy, r * 0.42, '#F6D86B'); };
  /** A butterfly in screen space: four soft wings, a body and two feelers; `flap` 0..1 opens and closes the wings. */
  const butterfly = (sx, sy, s, col, col2, flap = 1) => { const w = s * (0.35 + 0.65 * flap); [[-1, -0.55, col], [1, -0.55, col], [-1, 0.5, col2], [1, 0.5, col2]].forEach(([d, v, c]) => ell(sx + d * w * 0.8, sy + v * s * 0.7, w * 0.8, s * 0.6, c, 'rgba(120,70,110,.35)', d * 0.5)); limb(sx, sy - s * 0.7, sx, sy + s * 0.8, '#6A5470', 1); limb(sx, sy - s * 0.7, sx - s * 0.4, sy - s * 1.2, '#6A5470', 0.6); limb(sx, sy - s * 0.7, sx + s * 0.4, sy - s * 1.2, '#6A5470', 0.6); };
  /**
   * A scalloped hem along a line in the piece's frame: half-rounds hanging below it, as wide as their spacing so each
   * meets the next, in one fill with a thin pink edge. This is the ruffle, lace and valance of the pack; it reads as a
   * trim and never as a row of beads.
   */
  const scallopTrim = (T, from, to, n, _r, col, edge = NA.edge) => {
    let a = T.P(...from), b = T.P(...to); if (b[0] < a[0]) [a, b] = [b, a];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, ang = Math.atan2(dy, dx), r = L / n / 2;
    ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = edge; ctx.lineWidth = 0.8;
    for (let k = 0; k < n; k++) { const cx = a[0] + dx * (k + 0.5) / n, cy = a[1] + dy * (k + 0.5) / n; ctx.beginPath(); ctx.arc(cx, cy, r, ang, ang + Math.PI); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    ctx.restore();
  };
  const ruffle = scallopTrim;
  /** Round puffs drawn as one cloudy shape: every outline first, then every fill, so they merge. Used only for the pack's cloud lights. */
  const puffRow = (pts, r, col, edge = '#EFB4CD') => { pts.forEach(([x, y]) => circle(x, y, r + 1.1, edge)); pts.forEach(([x, y]) => circle(x, y, r, col)); pts.forEach(([x, y]) => circle(x - r * 0.25, y - r * 0.3, r * 0.35, 'rgba(255,255,255,.9)')); };
  /** A cloud light: one soft silhouette of five puffs. */
  const cloudLight = (sx, sy, w, col) => puffRow([[sx - w * 0.9, sy + w * 0.2], [sx - w * 0.4, sy - w * 0.2], [sx + w * 0.2, sy - w * 0.35], [sx + w * 0.8, sy], [sx + w * 0.1, sy + w * 0.3]], w * 0.5, col);
  /** Gingham along a band of a vertical face: alternate pink and white squares. */
  const gingham = (T, x0, x1, y, z0, z1, cols, step = 0.09) => { let i = 0; for (let x = x0; x < x1 - 1e-6; x += step, i++) for (let z = z0, j = 0; z < z1 - 1e-6; z += step, j++) T.poly([[x, y, z], [Math.min(x + step, x1), y, z], [Math.min(x + step, x1), y, Math.min(z + step, z1)], [x, y, Math.min(z + step, z1)]], (i + j) % 2 ? cols[0] : cols[1]); };
  Object.assign(LOOK_DRAWERS.sofa, {
    // Nana: a plush lilac sofa with a cream skirt and a scalloped hem, pink pillows with a heart and a bow, and a butter throw over one arm.
    nana: (o, s1, s2) => { const c = cl(o); return [
      B(0, 0, 0, 2.4, 1.0, 0.38, c, { name: 'base' }), B(0, 0, 0.38, 2.4, 0.3, 0.52, c), B(0, 0, 0.38, 0.24, 1.0, 0.3, c), B(2.16, 0, 0.38, 0.24, 1.0, 0.3, c),
      B(0.24, 0.3, 0.38 - s1 * 0.018, 0.96, 0.66, 0.1 - s1 * 0.035, NA.pink), B(1.2, 0.3, 0.38 - s2 * 0.018, 0.96, 0.66, 0.1 - s2 * 0.035, NA.pink),
      F(0, 0, 2.4, 1.0, (T) => {
        T.poly([[0.02, 1.002, 0.02], [2.38, 1.002, 0.02], [2.38, 1.002, 0.2], [0.02, 1.002, 0.2]], NA.cream, NA.edge, 0.8);
        scallopTrim(T, [0.02, 1.003, 0.2], [2.38, 1.003, 0.2], 24, 0, NA.cream);
        for (let x = 0.3; x < 2.3; x += 0.4) { const [px, py] = T.P(x, 0.15, 0.9); ell(px, py, 9, 5, shade(c, 0.06), 'rgba(0,0,0,.06)'); }
        const [hx, hy] = T.P(0.7, 0.481, 0.6); heart(hx, hy, 1.4, NA.pinkDeep); const [bx, by] = T.P(1.62, 0.481, 0.64); bow(bx, by, 3.4, NA.lilacDeep);
        T.box(-0.02, 0.02, 0.62, 0.3, 0.96, 0.05, NA.butter); T.box(-0.02, 0.98, 0.18, 0.3, 0.05, 0.49, NA.butter);
        for (let y = 0.1; y < 1.0; y += 0.12) T.line([-0.02, y, 0.62], [-0.02, y, 0.55], shade(NA.butter, -0.12), 1);
        const [sx, sy] = T.P(2.28, 0.5, 0.66); star5(sx, sy, 3, NA.butter);
      }, { onTop: true })]; },
  });
  Object.assign(LOOK_DRAWERS.dining, {
    // Nana: a tea-party table in a pink cloth with a lace hem, a lilac runner, a teapot and cups, chairs with padded bow backs, and a cloud light overhead.
    nana: (o) => { const ps = [], c = cl(o);
      const chair = (y0, back, col) => { [[0.39, y0 + 0.04], [0.83, y0 + 0.04], [0.39, y0 + 0.48], [0.83, y0 + 0.48]].forEach(([x, y]) => ps.push(B(x, y, 0, 0.05, 0.05, 0.42, NA.gold)));
        ps.push(B(0.35, y0, 0.42, 0.6, 0.58, 0.07, col, { name: y0 === 0 ? 'seat1' : 'seat2' }));
        // A real back, as wide as the seat: one padded panel in the chair's colour with a scalloped top and a single bow.
        ps.push(B(0.35, back, 0.49, 0.6, 0.08, 0.46, col));
        ps.push(F(0.35, back - 0.02, 0.95, back + 0.1, (T) => {
          const fy = back + 0.085, edge = shade(col, -0.16);
          for (let x = 0.4; x < 0.93; x += 0.1) { const [px, py] = T.P(x, fy, 0.95); circle(px, py, 3.3, edge); }
          for (let x = 0.4; x < 0.93; x += 0.1) { const [px, py] = T.P(x, fy, 0.95); circle(px, py, 2.7, col); }
          const [bx, by] = T.P(0.65, fy, 0.74); bow(bx, by, 3.4, y0 === 0 ? NA.lilacDeep : NA.pinkDeep);
        }, { onTop: true })); };
      chair(0, 0, NA.pink); chair(1.89, 2.42, NA.lilac);
      ps.push(B(0.52, 1.11, 0, 0.26, 0.26, 0.7, NA.gold));
      ps.push(B(0, 0.74, 0.7, 1.3, 1.0, 0.07, c, { name: 'top' }));
      ps.push(F(0, 0.74, 1.3, 1.74, (T) => {
        // One cloth: the top's cream carries down both visible sides to a lace hem, with a pink runner along the middle.
        T.poly([[0, 1.74, 0.7], [1.3, 1.74, 0.7], [1.3, 1.74, 0.5], [0, 1.74, 0.5]], c, 'rgba(176,96,132,.3)', 0.8); T.poly([[1.3, 0.74, 0.7], [1.3, 1.74, 0.7], [1.3, 1.74, 0.5], [1.3, 0.74, 0.5]], shade(c, -0.06), 'rgba(176,96,132,.3)', 0.8);
        scallopTrim(T, [0, 1.745, 0.5], [1.3, 1.745, 0.5], 13, 0, NA.pink); scallopTrim(T, [1.305, 0.74, 0.5], [1.305, 1.74, 0.5], 10, 0, shade(NA.pink, -0.05));
        T.poly([[0.42, 0.76, 0.772], [0.88, 0.76, 0.772], [0.88, 1.72, 0.772], [0.42, 1.72, 0.772]], NA.pink, 'rgba(176,96,132,.35)', 1);
        const [px, py] = T.P(0.65, 1.2, 0.78); ell(px, py, 9, 4.5, NA.white, 'rgba(0,0,0,.1)'); ell(px, py - 5, 5.5, 5, NA.lilac, 'rgba(0,0,0,.1)'); limb(px + 5, py - 6, px + 9, py - 4, NA.lilacDeep, 1.4); circle(px, py - 11, 1.3, NA.lilacDeep);
        [[0.55, 1.5], [0.76, 0.98]].forEach(([x, y]) => { const [cx, cy] = T.P(x, y, 0.78); ell(cx, cy, 4, 2, NA.white, 'rgba(0,0,0,.1)'); ell(cx, cy - 2, 2.6, 2.2, NA.cream, 'rgba(0,0,0,.1)'); });
        const [dx, dy] = T.P(0.65, 1.62, 0.78); daisy(dx, dy, 3);
      }, { onTop: true }));
      ps.push(diningLife(), diningLight('cloudlamp'));
      return ps; },
  });
  Object.assign(LOOK_DRAWERS.lamp, {
    // Nana: a cloud light: one soft cloud shade on a gold stem with a little star on top and pearls and stars hanging under it.
    nana: (T, o) => { const lit = isLit(o.id), c = cl(o);
      T.box(0.06, 0.06, 0, 0.28, 0.28, 0.05, NA.gold); T.line([0.2, 0.2, 0.05], [0.2, 0.2, 1.3], NA.gold, 2.4);
      const [px, py] = T.P(0.2, 0.2, 1.42); if (lit) { ell(px, py + 4, 24, 14, 'rgba(255,214,232,.3)'); ell(px, py + 2, 14, 9, 'rgba(255,241,201,.3)'); }
      cloudLight(px, py, 11, lit ? '#FFFAFD' : c);
      [[-7, 0], [-2, 3], [4, 1], [9, 4]].forEach(([dx, d], k) => { limb(px + dx, py + 8, px + dx, py + 13 + d, NA.gold, 0.7); if (k % 2) star5(px + dx, py + 15 + d, 2.4, NA.butter); else circle(px + dx, py + 14 + d, 1.6, NA.white); });
      star5(px, py - 14, 3.6, lit ? NA.butter : shade(NA.butter, -0.1)); },
  });
  Object.assign(LOOK_DRAWERS.plant, {
    // Nana: a pink pot with a scalloped rim and a bow, daisies in the leaves.
    nana: (T, o) => { const c = cl(o); T.box(0.05, 0.05, 0, 0.4, 0.4, 0.36, c); T.box(0.03, 0.03, 0.36, 0.44, 0.44, 0.06, shade(c, 0.08));
      scallopTrim(T, [0.03, 0.475, 0.36], [0.47, 0.475, 0.36], 7, 0, shade(c, 0.1)); scallopTrim(T, [0.475, 0.03, 0.36], [0.475, 0.47, 0.36], 7, 0, shade(c, 0.04));
      const [bx, by] = T.P(0.25, 0.476, 0.2); bow(bx, by, 3, NA.lilacDeep); const [sx, sy] = T.P(0.476, 0.25, 0.2); circle(sx, sy, 1.3, NA.butter); },
  });
  Object.assign(LOOK_DRAWERS.counter, {
    // Nana: cream cabinets with heart knobs under a pink scalloped valance, a butter top scattered with hearts, a lilac basin with a gold tap and a posy.
    nana: (T, o) => { const c = cl(o);
      T.box(0, 0, 0, 2.8, 0.8, 0.86, c); [0.7, 1.4, 2.1].forEach(x => T.line([x, 0.802, 0.1], [x, 0.802, 0.78], 'rgba(120,80,100,.14)', 1.2));
      [0.35, 1.05, 1.75, 2.45].forEach((x) => { const [px, py] = T.P(x, 0.803, 0.46); heart(px, py, 0.9, NA.pinkDeep); [0, 0.7].forEach((d) => { const [kx, ky] = T.P(x + 0.3 + d - 0.35, 0.803, 0.62); circle(kx, ky, 1.2, NA.gold); }); });
      T.poly([[0, 0.802, 0.86], [2.8, 0.802, 0.86], [2.8, 0.802, 0.74], [0, 0.802, 0.74]], NA.pink, NA.edge, 0.8); scallopTrim(T, [0, 0.803, 0.74], [2.8, 0.803, 0.74], 28, 0, NA.pink);
      T.box(-0.05, -0.04, 0.86, 2.9, 0.88, 0.07, NA.butter); for (let k = 0; k < 11; k++) { const x = ((k * 0.618 * 5.3) % 2.8), y = (k * 0.414 * 3.1) % 0.8; const [sx, sy] = T.P(x, y, 0.931); heart(sx, sy, 0.5, k % 2 ? NA.pink : NA.lilac); } T.line([-0.05, 0.84, 0.86], [2.85, 0.84, 0.86], shade(NA.butter, -0.15), 1.2);
      T.poly([[0.3, 0.13, 0.932], [1.0, 0.13, 0.932], [1.0, 0.6, 0.932], [0.3, 0.6, 0.932]], NA.lilac, 'rgba(0,0,0,.1)', 1); const [hx, hy] = T.P(0.65, 0.37, 0.933); heart(hx, hy, 1.6, NA.lilacDeep);
      T.line([0.65, 0.04, 0.93], [0.65, 0.04, 1.18], NA.gold, 2.2); T.line([0.65, 0.04, 1.18], [0.65, 0.24, 1.12], NA.gold, 2.2);
      const [vx, vy] = T.P(0.18, 0.22, 0.95); ell(vx, vy, 4, 3, NA.white, 'rgba(0,0,0,.1)'); limb(vx, vy - 2, vx - 1, vy - 11, '#6FA878', 1); limb(vx, vy - 2, vx + 3, vy - 10, '#6FA878', 1); daisy(vx - 1, vy - 12, 2.6); daisy(vx + 3, vy - 11, 2.2); },
  });
  // Nana: a plush rug. A rounded blush rug with a big heart and daisies in the middle, a shag of little tufts in two tones, and pom-poms along the short ends.
  LOOK_DRAWERS.rugwide = LOOK_DRAWERS.rugwide || {};
  LOOK_DRAWERS.rugwide.nana = (T, o) => {
    const c = cl(o), W = 3.3, D = 1.9, r = 0.34, rounded = (x0, y0, x1, y1, rad, z) => { const pts = []; [[x1 - rad, y0 + rad, -90], [x1 - rad, y1 - rad, 0], [x0 + rad, y1 - rad, 90], [x0 + rad, y0 + rad, 180]].forEach(([cx, cy, a0]) => { for (let k = 0; k <= 5; k++) { const a = (a0 + k * 18) * Math.PI / 180; pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, z]); } }); return pts; };
    T.poly(rounded(0, 0, W, D, r, 0.01), shade(c, -0.08));
    T.poly(rounded(0.07, 0.07, W - 0.07, D - 0.07, r - 0.05, 0.012), c);
    T.poly(rounded(0.22, 0.22, W - 0.22, D - 0.22, r - 0.12, 0.013), shade(c, 0.1), 'rgba(255,255,255,.55)', 1.2);
    for (let i = 0; i < 20; i++) for (let j = 0; j < 11; j++) {
      const x = 0.22 + i * 0.158 + ((j % 2) * 0.07), y = 0.18 + j * 0.15, k = (i * 7 + j * 13) % 5;
      T.line([x, y, 0.014], [x + 0.045, y + 0.035, 0.014], k < 2 ? NA.cream : k === 2 ? shade(c, -0.14) : shade(c, 0.2), 1.5);
    }
    const [cx, cy] = T.P(W / 2, D / 2, 0.02); heart(cx, cy - 2, 3.6, NA.pinkDeep); heart(cx, cy - 3, 2.6, '#F7B6D0');
    [[-17, 5], [17, 5], [-9, 11], [9, 11]].forEach(([dx, dy]) => daisy(cx + dx, cy + dy, 3.2));
    for (let y = 0.22; y < D - 0.1; y += 0.24) [0.02, W - 0.02].forEach((x) => { const [px, py] = T.P(x, y, 0.02); circle(px, py, 2.8, NA.edge); circle(px, py, 2.3, NA.cream); circle(px - 0.6, py - 0.6, 0.9, '#FFFFFF'); });
  };
  Object.assign(LOOK_DRAWERS.fridge, {
    // Nana: a pink fridge with a cream scalloped cap, butterflies, hearts and little frames on the upper door, a pink gingham band and a bow on the lower one, lilac heart handles. Returns the open door's colour.
    nana: (T, o) => { const body = cl(o);
      T.box(0, 0, 0, 0.9, 0.85, 1.87, body); T.box(0, 0, 1.87, 0.9, 0.85, 0.08, NA.cream); scallopTrim(T, [0, 0.852, 1.87], [0.9, 0.852, 1.87], 9, 0, NA.cream);
      T.line([0, 0.85, 1.3], [0.9, 0.85, 1.3], 'rgba(120,60,90,.16)', 1.2);
      [[0.2, 1.62, NA.pinkDeep, NA.lilacDeep], [0.62, 1.52, NA.lilacDeep, NA.pinkDeep]].forEach(([x, z, c1, c2], k) => { const [cx, cy] = T.P(x, 0.851, z); butterfly(cx, cy, 5, c1, c2, 0.75 + 0.25 * Math.sin(animT * 3 + k * 2)); });
      [[0.18, 1.4], [0.46, 1.38], [0.72, 1.46]].forEach(([x, z], k) => { const [px, py] = T.P(x, 0.851, z); ctx.fillStyle = NA.white; ctx.fillRect(px - 4, py - 4.5, 8, 9); ctx.fillStyle = [NA.butter, NA.blue, NA.mint][k]; ctx.fillRect(px - 3, py - 3.5, 6, 5.5); });
      const [mx, my] = T.P(0.42, 0.851, 1.62); heart(mx, my, 1.0, NA.pinkDeep);
      gingham(T, 0.03, 0.87, 0.851, 0.7, 0.88, [NA.pink, NA.white], 0.07); T.line([0.03, 0.852, 0.7], [0.87, 0.852, 0.7], NA.edge, 1); T.line([0.03, 0.852, 0.88], [0.87, 0.852, 0.88], NA.edge, 1);
      const [bx, by] = T.P(0.4, 0.851, 0.5); bow(bx, by, 6.5, NA.lilacDeep); heart(bx, by + 16, 1.3, NA.white);
      [[0.95, 1.1], [1.55, 1.72]].forEach(([z0, z1]) => { T.line([0.78, 0.855, z0], [0.78, 0.855, z1], NA.lilac, 3.2); const [hx, hy] = T.P(0.78, 0.856, (z0 + z1) / 2); heart(hx, hy, 0.8, NA.white); });
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


  // ---- The four seasonal packs (spring, summer, fall, winter): one block per piece, added to the registry above ----
  // One palette per season (wood, legs, table top, trim, a pop colour and a leaf colour); each piece adds its own accent.
  const SEAS = {
    spring: { wood: '#E4C9A0', leg: '#F2EEE8', top: '#EAD3AD', trim: '#F7F3E8', pop: '#F3A6BE', leaf: '#6FB38A' },
    summer: { wood: '#D9B87A', leg: '#C79B5B', top: '#E8C987', trim: '#FFF4CC', pop: '#F6D56E', leaf: '#4F9460' },
    fall: { wood: '#8A5E3B', leg: '#4A3426', top: '#7A4E32', trim: '#F1E2C6', pop: '#E07A2B', leaf: '#B5532F' },
    winter: { wood: '#B7A88F', leg: '#5A3E2E', top: '#B79B76', trim: '#F4F7FA', pop: '#C0392B', leaf: '#2F6B40' },
  };
  const petals = (T, x, y, z, col, mid = '#F6D56E', r = 2.6, pr = 1.9) => { const [fx, fy] = T.P(x, y, z); for (let i = 0; i < 5; i++) { const a = i * 1.2566; circle(fx + Math.cos(a) * r, fy + Math.sin(a) * r, pr, col); } circle(fx, fy, pr * 0.8, mid); };
  const seasonFridge = (sk) => (T, o) => { const P = SEAS[sk], body = cl(o);
    T.box(0, 0, 0, 0.9, 0.85, 0.1, P.wood); T.box(0, 0, 0.1, 0.9, 0.85, 1.78, body); T.box(0, 0, 1.88, 0.9, 0.85, 0.07, P.trim);
    T.line([0, 0.85, 1.3], [0.9, 0.85, 1.3], 'rgba(60,50,40,.35)', 1.4);
    [[0.7, 1.15], [1.42, 1.78]].forEach(([z0, z1]) => T.line([0.78, 0.855, z0], [0.78, 0.855, z1], sk === 'winter' ? '#8E1F2F' : sk === 'summer' ? '#C79B5B' : P.wood, 3.6));
    if (sk === 'spring') [[0.16, 1.62], [0.34, 1.48], [0.5, 1.64]].forEach(([x, z], k) => petals(T, x, 0.853, z, k % 2 ? '#FFF3B0' : P.pop));
    if (sk === 'summer') { T.poly([[0.04, 0.851, 1.52], [0.7, 0.851, 1.52], [0.7, 0.851, 1.6], [0.04, 0.851, 1.6]], '#F2EEE8'); T.poly([[0.04, 0.851, 1.44], [0.7, 0.851, 1.44], [0.7, 0.851, 1.5], [0.04, 0.851, 1.5]], '#3FA3A5'); const [sx, sy] = T.P(0.22, 0.853, 1.0); circle(sx, sy, 4.2, '#F2A38A'); circle(sx, sy, 2.6, '#FFF1B0'); }
    if (sk === 'fall') [[0.18, 1.6, 0.5], [0.4, 1.46, -0.6], [0.52, 1.66, 0.2]].forEach(([x, z, r], k) => { const [lx, ly] = T.P(x, 0.853, z); ell(lx, ly, 2.6, 5, ['#E07A2B', '#D9A84A', '#B5532F'][k], null, r); });
    if (sk === 'winter') for (let x = 0.06; x < 0.88; x += 0.1) T.line([x, 0.856, 1.88], [x, 0.856, 1.8 - ((x * 37) % 0.08)], '#BFE3F5', 2.2);
    T.line([0.05, 0.851, 0.1], [0.85, 0.851, 0.1], 'rgba(60,40,20,.4)', 1);
    return body; };
  const seasonCounter = (sk) => (T, o) => { const P = SEAS[sk];
    T.box(0, 0, 0, 2.8, 0.8, 0.86, cl(o));
    [0.7, 1.4, 2.1].forEach(x => T.line([x, 0.801, 0.06], [x, 0.801, 0.8], 'rgba(0,0,0,.3)', 1.2));
    [0.3, 1.0, 1.7, 2.4].forEach(x => T.line([x, 0.803, 0.64], [x + 0.2, 0.803, 0.64], sk === 'winter' ? '#E8ECEF' : P.trim, 2.6));
    T.box(-0.05, -0.04, 0.86, 2.9, 0.88, 0.07, sk === 'winter' ? '#F1F3F4' : P.wood);
    T.poly([[0.3, 0.13, 0.931], [1.0, 0.13, 0.931], [1.0, 0.6, 0.931], [0.3, 0.6, 0.931]], '#F4F2EC', 'rgba(0,0,0,.28)', 1.1);
    T.line([0.65, 0.04, 0.93], [0.65, 0.04, 1.2], '#B9C3C8', 2.4); T.line([0.65, 0.04, 1.2], [0.65, 0.24, 1.14], '#B9C3C8', 2.4);
    if (sk === 'spring') [[1.06, 0.18], [1.14, 0.42]].forEach(([x, y], k) => { T.box(x, y, 0.93, 0.1, 0.1, 0.09, '#C26B4A'); const [hx, hy] = T.P(x + 0.05, y + 0.05, 1.08); ell(hx - 2, hy - 2, 2, 5, P.leaf, null, -0.4); ell(hx + 2, hy - 3, 2, 5, k ? P.pop : '#6FB38A', null, 0.4); });
    if (sk === 'summer') { T.box(1.04, 0.16, 0.93, 0.2, 0.2, 0.1, '#C79B5B'); [[1.1, 0.22], [1.18, 0.28]].forEach(([x, y]) => { const [lx, ly] = T.P(x, y, 1.06); circle(lx, ly, 2.6, P.pop); }); }
    if (sk === 'fall') [[1.1, 0.2, 4.2], [1.19, 0.36, 3.2]].forEach(([x, y, r]) => { const [px, py] = T.P(x, y, 0.99); circle(px, py, r, P.pop); limb(px, py - r, px + 1, py - r - 2.4, '#4A3426', 1.4); });
    if (sk === 'winter') { const [fx, fy] = T.P(1.12, 0.26, 0.98); [[-5, 3], [5, 3], [-3, -1], [3, -1], [0, -6]].forEach(([dx, dy], k) => { ell(fx + dx * 0.5, fy + dy, 5 - (k > 1 ? 1.6 : 0), 2.4, k % 2 ? '#2F6B40' : '#3F7D4E'); }); circle(fx, fy - 2, 1.5, '#C0392B'); } };
  const seasonDining = (sk, light) => (o) => { const ps = [], P = SEAS[sk], seat = cl(o), leg = P.leg, z = 0.772;
    [[0.39, 0.04], [0.83, 0.04], [0.39, 0.48], [0.83, 0.48]].forEach(([x, y]) => ps.push(B(x, y, 0, 0.06, 0.06, 0.42, leg)));
    ps.push(B(0.35, 0, 0.42, 0.6, 0.58, 0.07, seat, { name: 'seat1' }), B(0.35, 0, 0.49, 0.6, 0.07, 0.62, seat));
    [[0.05, 0.79], [1.18, 0.79], [0.05, 1.64], [1.18, 1.64]].forEach(([x, y]) => ps.push(B(x, y, 0, 0.07, 0.07, 0.7, leg)));
    ps.push(B(0, 0.74, 0.7, 1.3, 1.0, 0.07, P.top, { name: 'top' }));
    ps.push(F(0, 0.74, 1.3, 1.74, (T) => {
      const band = (x0, x1, col) => T.poly([[x0, 0.78, z], [x1, 0.78, z], [x1, 1.7, z], [x0, 1.7, z]], col);
      if (sk === 'spring') for (let k = 0; k < 9; k++) { const [px, py] = T.P(0.12 + (k * 0.37) % 1.05, 0.84 + (k * 0.53) % 0.8, z); circle(px, py, 1.7, k % 2 ? '#F3A6BE' : '#FFF3B0'); }
      if (sk === 'summer') { for (let y = 0.9; y < 1.74; y += 0.18) T.line([0.03, y, z], [1.27, y, z], 'rgba(150,100,40,.3)', 1); for (let i = 0; i < 5; i++) band(0.5 + i * 0.1, 0.55 + i * 0.1, i % 2 ? '#F2EEE8' : '#3FA3A5'); }
      if (sk === 'fall') { band(0.48, 0.82, '#B5532F'); for (let y = 0.84; y < 1.7; y += 0.2) T.line([0.48, y, z + 0.001], [0.82, y, z + 0.001], '#1B1A1F', 1.2); T.line([0.58, 0.78, z + 0.001], [0.58, 1.7, z + 0.001], '#1B1A1F', 1.2); T.line([0.72, 0.78, z + 0.001], [0.72, 1.7, z + 0.001], '#1B1A1F', 1.2); }
      if (sk === 'winter') { band(0.5, 0.8, '#F4F7FA'); [[0.5, 0.9], [0.8, 1.6]].forEach(([x, y]) => { T.box(x, y, 0.77, 0.06, 0.06, 0.12, '#F2EEE8'); const [cx, cy] = T.P(x + 0.03, y + 0.03, 0.9); ell(cx, cy - 1, 1.6, 3, isLit(o.id) ? '#FFD36B' : '#F6B34A'); }); }
    }, { onTop: true }));
    ps.push(B(0.35, 1.89, 0.42, 0.6, 0.58, 0.07, seat, { name: 'seat2' }), B(0.35, 2.4, 0.49, 0.6, 0.07, 0.62, seat));
    [[0.39, 1.93], [0.83, 1.93], [0.39, 2.37], [0.83, 2.37]].forEach(([x, y]) => ps.push(B(x, y, 0, 0.06, 0.06, 0.42, leg)));
    ps.push(diningLife(), diningLight(light));
    return ps; };
  const seasonSofa = (sk) => (o, s1, s2) => { const P = SEAS[sk], v = cl(o), vc = shade(v, 0.14);
    return [B(0, 0, 0.38, 2.4, 0.32, 0.6, v), B(0, 0, 0, 2.4, 1.0, 0.38, v, { name: 'base' }), B(0, 0, 0, 2.4, 1.0, 0.05, P.wood),
      B(0.2, 0.32, 0.38 - s1 * 0.018, 1.0, 0.62, 0.1 - s1 * 0.035, vc), B(1.2, 0.32, 0.38 - s2 * 0.018, 1.0, 0.62, 0.1 - s2 * 0.035, vc),
      B(0, 0, 0, 0.2, 1.0, 0.62, v), B(2.2, 0, 0, 0.2, 1.0, 0.62, v), B(0.26, 0.34, 0.48, 0.42, 0.14, 0.32, sk === 'winter' ? '#C0392B' : sk === 'fall' ? '#D9A84A' : sk === 'summer' ? '#3FA3A5' : '#FFF3B0'),
      F(0, 0, 2.4, 1.0, (T) => {
        if (sk === 'spring') petals(T, 0.47, 0.5, 0.62, P.pop, '#F6D56E', 3, 2);
        if (sk === 'summer') for (let i = 0; i < 4; i++) T.line([0.3 + i * 0.1, 0.5, 0.5], [0.3 + i * 0.1, 0.5, 0.78], '#F2EEE8', 2);
        if (sk === 'fall') { T.poly([[2.2, 1.001, 0.1], [2.4, 1.001, 0.1], [2.4, 1.001, 0.62], [2.2, 1.001, 0.62]], '#B5532F'); for (let z = 0.2; z < 0.62; z += 0.14) T.line([2.2, 1.002, z], [2.4, 1.002, z], '#1B1A1F', 1.2); T.line([2.3, 1.002, 0.1], [2.3, 1.002, 0.62], '#1B1A1F', 1.2); }
        if (sk === 'winter') { T.poly([[2.2, 1.001, 0.1], [2.4, 1.001, 0.1], [2.4, 1.001, 0.62], [2.2, 1.001, 0.62]], '#F2EEE8'); for (let z = 0.14; z < 0.62; z += 0.1) T.line([2.2, 1.002, z], [2.4, 1.002, z + 0.05], 'rgba(120,110,100,.55)', 1.4); }
      }, { onTop: true })]; };
  const seasonLamp = (sk) => (T, o) => { const P = SEAS[sk], c = cl(o), lit = isLit(o.id);
    T.box(0.07, 0.07, 0, 0.26, 0.26, 0.04, sk === 'spring' ? P.leaf : sk === 'fall' ? '#2B2B30' : P.wood);
    T.line([0.2, 0.2, 0.04], [0.2, 0.2, sk === 'fall' ? 1.3 : 1.45], sk === 'spring' ? P.leaf : sk === 'summer' ? '#8A5E3B' : sk === 'fall' ? '#2B2B30' : '#E8ECEF', 2);
    const [hx, hy] = T.P(0.2, 0.2, sk === 'fall' ? 1.5 : 1.6);
    if (sk === 'spring') { for (let i = 0; i < 8; i++) { const a = i * 0.785; ell(hx + Math.cos(a) * 7, hy + Math.sin(a) * 4.5, 4.2, 2.2, c, null, a); } circle(hx, hy, 4, lit ? '#FFE2A8' : '#F6D56E'); }
    if (sk === 'summer') { for (let i = 0; i < 6; i++) { const a = -2.7 + i * 0.55; ell(hx + Math.cos(a) * 9, hy + Math.sin(a) * 6, 8, 2.2, i % 2 ? '#3F7D4E' : P.leaf, null, a); } circle(hx, hy + 1, 3.6, lit ? '#FFE2A8' : '#F6D56E'); }
    if (sk === 'fall') { T.box(0.08, 0.08, 1.3, 0.24, 0.24, 0.3, lit ? '#FFB45A' : '#7A4E32'); T.box(0.05, 0.05, 1.6, 0.3, 0.3, 0.05, '#2B2B30'); T.box(0.05, 0.05, 1.27, 0.3, 0.3, 0.04, '#2B2B30'); T.line([0.08, 0.321, 1.3], [0.08, 0.321, 1.6], '#2B2B30', 1.4); T.line([0.32, 0.321, 1.3], [0.32, 0.321, 1.6], '#2B2B30', 1.4); }
    if (sk === 'winter') { circle(hx, hy, 9, lit ? '#FFF1C9' : '#E6EEF4'); circle(hx - 2, hy - 3, 2.4, 'rgba(255,255,255,.75)'); ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(hx, hy + 2, 9, 2.6, 0, 0, Math.PI); ctx.stroke(); } };
  const seasonPlant = (sk) => (T, o) => { const P = SEAS[sk];
    T.box(0, 0, 0, 0.5, 0.5, 0.42, cl(o)); T.box(-0.01, -0.01, 0.36, 0.52, 0.52, 0.06, sk === 'summer' ? '#F2EEE8' : shade(cl(o), 0.22));
    if (sk === 'summer') { T.line([0.02, 0.511, 0.2], [0.48, 0.511, 0.2], '#3FA3A5', 3); T.line([0.02, 0.511, 0.12], [0.48, 0.511, 0.12], '#F6D56E', 2); }
    if (sk === 'fall') T.line([0.02, 0.501, 0.2], [0.48, 0.501, 0.2], 'rgba(255,255,255,.2)', 1.2); };
  // What goes on the leaves once they are drawn: blooms, palm tips, mums or a dusting of snow.
  /** The drawing tools the plant kit (art/plants.js) draws with; the canvas can change under it, so it is read each time. */
  const plantH = () => ({ ctx, ell, circle, limb, rr, shade });
  const SEASON_BLOOM = {
    spring: (T, o, sx, sy) => { [[-9, -24, '#F3A6BE'], [8, -30, '#FFF3B0'], [-2, -36, '#F3A6BE'], [11, -17, '#FFB3C7']].forEach(([dx, dy, c]) => { circle(sx + dx, sy + dy, 3.2, c); circle(sx + dx, sy + dy, 1.2, '#F6D56E'); }); },
    summer: (T, o, sx, sy) => { [[-6, -22], [7, -27], [0, -33]].forEach(([dx, dy]) => { ell(sx + dx, sy + dy, 2, 7, '#3F7D4E', null, dx * 0.1); }); },
    fall: (T, o, sx, sy) => { [[-9, -20, '#E07A2B'], [7, -26, '#D9A84A'], [-1, -33, '#E07A2B'], [10, -15, '#B5532F']].forEach(([dx, dy, c]) => { circle(sx + dx, sy + dy, 3.6, c); circle(sx + dx, sy + dy, 1.4, '#7A4E32'); }); },
    winter: (T, o, sx, sy) => { [[-10, -26], [9, -32], [-2, -38]].forEach(([dx, dy]) => ell(sx + dx, sy + dy, 4.2, 1.8, '#F4F7FA')); [[-4, -18], [5, -22]].forEach(([dx, dy]) => circle(sx + dx, sy + dy, 1.6, '#C0392B')); },
  };
  const SEASON_LIGHT = { spring: 'lantern', summer: 'dome', fall: 'cage', winter: 'dome' };
  for (const sk of Object.keys(SEAS)) {
    LOOK_DRAWERS.fridge[sk] = seasonFridge(sk); LOOK_DRAWERS.counter[sk] = seasonCounter(sk); LOOK_DRAWERS.dining[sk] = seasonDining(sk, SEASON_LIGHT[sk]);
    LOOK_DRAWERS.sofa[sk] = seasonSofa(sk); LOOK_DRAWERS.lamp[sk] = seasonLamp(sk); LOOK_DRAWERS.plant[sk] = seasonPlant(sk);
  }

  // ---- Cloud Nine (a pastel shop pack): clouds, rainbows, stars and hearts ----
  const CN = { rainbow: ['#F27C8D', '#F6B26B', '#F6E06B', '#8FD3A0', '#7FB7E8'], white: '#FFFFFF', pink: '#F9C6DA', blue: '#BFE3F5', yellow: '#FFF2B8', lilac: '#E2D3F7' };
  const cloudPuff = (cx, cy, k = 1) => { circle(cx - 3.2 * k, cy + 0.6 * k, 2.6 * k, CN.white); circle(cx, cy - 1.2 * k, 3.2 * k, CN.white); circle(cx + 3.4 * k, cy + 0.6 * k, 2.4 * k, CN.white); };
  const rainbowArc = (cx, cy, r) => { ctx.lineCap = 'round'; CN.rainbow.forEach((c, i) => { ctx.strokeStyle = c; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.ellipse(cx, cy, r - i * 1.8, (r - i * 1.8) * 0.8, 0, Math.PI, 0); ctx.stroke(); }); };
  const heartAt = (cx, cy, r, col) => { circle(cx - r * 0.5, cy - r * 0.2, r * 0.55, col); circle(cx + r * 0.5, cy - r * 0.2, r * 0.55, col); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(cx - r * 1.0, cy); ctx.lineTo(cx + r * 1.0, cy); ctx.lineTo(cx, cy + r * 1.1); ctx.closePath(); ctx.fill(); };
  const starAt = (cx, cy, R, col, edge) => { ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? R * 0.45 : R; k ? ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } ctx.closePath(); ctx.fillStyle = col; ctx.fill(); if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = 1; ctx.stroke(); } };
  Object.assign(LOOK_DRAWERS.fridge, { cloud: (T, o) => { const body = cl(o);
    T.box(0, 0, 0, 0.9, 0.85, 0.1, CN.white); T.box(0, 0, 0.1, 0.9, 0.85, 1.78, body); T.box(0, 0, 1.88, 0.9, 0.85, 0.07, CN.white);
    for (let x = 0.12; x < 0.9; x += 0.2) { const [bx, by] = T.P(x, 0.85, 1.95); circle(bx, by - 1, 3.2, CN.white); }
    T.line([0, 0.85, 1.3], [0.9, 0.85, 1.3], 'rgba(120,100,150,.3)', 1.4);
    [[0.7, 1.15], [1.42, 1.78]].forEach(([z0, z1]) => { T.line([0.78, 0.855, z0], [0.78, 0.855, z1], '#CDB9EA', 3.6); T.line([0.78, 0.856, z0], [0.78, 0.856, z1], CN.white, 1.6); });
    const [rx, ry] = T.P(0.34, 0.853, 1.5); rainbowArc(rx, ry + 3, 10); cloudPuff(rx - 9, ry + 3); cloudPuff(rx + 9, ry + 3);
    const [hx, hy] = T.P(0.2, 0.853, 0.55); heartAt(hx, hy, 3, '#F27C8D');
    return body; } });
  Object.assign(LOOK_DRAWERS.counter, { cloud: (T, o) => {
    T.box(0, 0, 0, 2.8, 0.8, 0.86, cl(o));
    [0.7, 1.4, 2.1].forEach(x => T.line([x, 0.801, 0.06], [x, 0.801, 0.8], 'rgba(120,100,150,.3)', 1.2));
    T.box(-0.05, -0.04, 0.86, 2.9, 0.88, 0.07, CN.white);
    for (let x = 0.02; x < 2.9; x += 0.17) { const [sx, sy] = T.P(x, 0.84, 0.88); circle(sx, sy, 2.3, CN.white); }
    [0.3, 1.0, 1.7, 2.4].forEach(x => { const [px, py] = T.P(x + 0.1, 0.803, 0.64); heartAt(px, py - 1, 2.2, '#F27C8D'); });
    T.poly([[0.3, 0.13, 0.931], [1.0, 0.13, 0.931], [1.0, 0.6, 0.931], [0.3, 0.6, 0.931]], '#E8F4FB', 'rgba(0,0,0,.25)', 1.1);
    T.line([0.65, 0.04, 0.93], [0.65, 0.04, 1.2], '#CDB9EA', 2.6); T.line([0.65, 0.04, 1.2], [0.65, 0.24, 1.14], '#CDB9EA', 2.6);
    T.box(1.06, 0.18, 0.93, 0.13, 0.13, 0.15, '#EAF6FB'); [[1.09, 0.22, '#F27C8D'], [1.14, 0.25, '#F6E06B'], [1.1, 0.27, '#8FD3A0']].forEach(([x, y, c]) => { const [dx, dy] = T.P(x, y, 1.0); circle(dx, dy, 1.6, c); }); } });
  Object.assign(LOOK_DRAWERS.dining, { cloud: (o) => { const ps = [], seat = cl(o), leg = CN.pink;
    [[0.39, 0.04], [0.83, 0.04], [0.39, 0.48], [0.83, 0.48]].forEach(([x, y]) => ps.push(B(x, y, 0, 0.06, 0.06, 0.42, leg)));
    ps.push(B(0.35, 0, 0.42, 0.6, 0.58, 0.07, seat, { name: 'seat1' }), B(0.35, 0, 0.49, 0.6, 0.07, 0.62, seat));
    ps.push(F(0.35, 0, 0.95, 0.08, (T) => { const [hx, hy] = T.P(0.65, 0.071, 0.85); heartAt(hx, hy, 4, CN.white); }, { onTop: true }));
    [[0.05, 0.79], [1.18, 0.79], [0.05, 1.64], [1.18, 1.64]].forEach(([x, y]) => ps.push(B(x, y, 0, 0.07, 0.07, 0.7, leg)));
    ps.push(B(0, 0.74, 0.7, 1.3, 1.0, 0.07, '#FFFFFF', { name: 'top' }));
    ps.push(F(0, 0.74, 1.3, 1.74, (T) => { T.line([0, 0.74, 0.7], [1.3, 0.74, 0.7], CN.pink, 2); T.line([0, 1.74, 0.7], [1.3, 1.74, 0.7], CN.pink, 2);
      [[0.3, 0.95], [1.0, 1.5]].forEach(([x, y], k) => { const [px, py] = T.P(x, y, 0.775); ell(px, py, 9, 4.6, k ? CN.blue : CN.pink); ell(px, py - 1, 4.5, 2.2, CN.white); circle(px + 1, py - 3, 2.2, k ? '#F27C8D' : '#F6E06B'); });
      const [sx, sy] = T.P(0.65, 1.24, 0.775); starAt(sx, sy - 1, 4, CN.yellow, '#E0C86A'); }, { onTop: true }));
    ps.push(B(0.35, 1.89, 0.42, 0.6, 0.58, 0.07, seat, { name: 'seat2' }), B(0.35, 2.4, 0.49, 0.6, 0.07, 0.62, seat));
    ps.push(F(0.35, 2.4, 0.95, 2.48, (T) => { const [hx, hy] = T.P(0.65, 2.471, 0.85); heartAt(hx, hy, 4, CN.white); }, { onTop: true }));
    [[0.39, 1.93], [0.83, 1.93], [0.39, 2.37], [0.83, 2.37]].forEach(([x, y]) => ps.push(B(x, y, 0, 0.06, 0.06, 0.42, leg)));
    ps.push(diningLife(), diningLight('lantern'));
    return ps; } });
  Object.assign(LOOK_DRAWERS.sofa, { cloud: (o, s1, s2) => { const v = cl(o), vc = shade(v, 0.06);
    return [B(0, 0, 0.38, 2.4, 0.32, 0.6, v), B(0, 0, 0, 2.4, 1.0, 0.38, v, { name: 'base' }), B(0, 0, 0, 2.4, 1.0, 0.05, CN.white),
      B(0.2, 0.32, 0.38 - s1 * 0.018, 1.0, 0.62, 0.1 - s1 * 0.035, vc), B(1.2, 0.32, 0.38 - s2 * 0.018, 1.0, 0.62, 0.1 - s2 * 0.035, vc),
      B(0, 0, 0, 0.2, 1.0, 0.62, v), B(2.2, 0, 0, 0.2, 1.0, 0.62, v), B(0.26, 0.34, 0.48, 0.42, 0.14, 0.32, CN.pink),
      F(0, 0, 2.4, 1.0, (T) => { for (let x = 0.25; x < 2.4; x += 0.38) { const [bx, by] = T.P(x, 0.16, 1.0); circle(bx, by - 1, 5, v); circle(bx, by - 1, 5, 'rgba(255,255,255,.35)'); }
        const [hx, hy] = T.P(0.47, 0.5, 0.62); heartAt(hx, hy, 3.4, '#F27C8D'); const [sx, sy] = T.P(1.7, 0.62, 0.55); starAt(sx, sy, 4.2, CN.yellow, '#E0C86A'); }, { onTop: true })]; } });
  Object.assign(LOOK_DRAWERS.lamp, { cloud: (T, o) => { const c = cl(o), lit = isLit(o.id);
    T.box(0.07, 0.07, 0, 0.26, 0.26, 0.04, c); T.line([0.2, 0.2, 0.04], [0.2, 0.2, 1.45], c, 2.2);
    const [hx, hy] = T.P(0.2, 0.2, 1.62); if (lit) circle(hx, hy, 15, 'rgba(255,235,160,.25)'); starAt(hx, hy, 11, lit ? '#FFE9A0' : CN.yellow, '#E0C86A'); circle(hx - 2, hy - 2, 2, 'rgba(255,255,255,.7)'); } });
  Object.assign(LOOK_DRAWERS.plant, { cloud: (T, o) => {
    T.box(0, 0, 0, 0.5, 0.5, 0.42, cl(o)); T.box(-0.01, -0.01, 0.36, 0.52, 0.52, 0.06, CN.white);
    CN.rainbow.slice(0, 4).forEach((c, i) => T.line([0.02, 0.501, 0.06 + i * 0.07], [0.48, 0.501, 0.06 + i * 0.07], c, 3)); } });
  SEASON_BLOOM.cloud = (T, o, sx, sy) => { [[-9, -22, '#F9C6DA'], [8, -28, '#FFF2B8'], [0, -35, '#E2D3F7'], [11, -16, '#BFE3F5']].forEach(([dx, dy, c]) => { circle(sx + dx, sy + dy, 3, c); circle(sx + dx, sy + dy, 1.1, '#FFFFFF'); }); };
  // Nana: daisies in the leaves.
  SEASON_BLOOM.nana = (T, o, sx, sy) => { [[-9, -22], [8, -26], [0, -33], [11, -15]].forEach(([dx, dy]) => daisy(sx + dx, sy + dy, 3.2)); };

  // ---- The chest freezer: the fridge's second model, low and wide, with its own looks ----
  // One shape, drawn for every look: a foot (or feet), the body, and the lid, shut or standing up on its back hinge while
  // someone is in it. A look gives its colours ({ foot, footH, lid, lidH, liner }) and what makes it that look: `feet`
  // instead of the plain foot, `front` on the body, `top` on the shut lid, `handle` on the lid's front edge.
  const CHEST = { W: 1.2, D: 0.75, Z: 0.78 };
  const CF = CHEST.D + 0.004;
  const CHEST_LOOKS = {
    stock: (b) => ({ lid: shade(b, 0.05) }),
    // Camp: a camping cooler grown up. Ribbed steel in forest green, a white lid, chrome corners, latches and a side handle.
    camp: (b) => ({ foot: '#2B2B30', footH: 0.05, lid: '#F2EEE6', lidH: 0.14, liner: '#F2EEE6',
      front: (T) => {
        for (let z = 0.16; z < 0.66; z += 0.1) { T.line([0.04, CF, z], [CHEST.W - 0.04, CF, z], 'rgba(0,0,0,.2)', 1.4); T.line([0.04, CF + 0.001, z + 0.012], [CHEST.W - 0.04, CF + 0.001, z + 0.012], 'rgba(255,255,255,.14)', 1); }
        [0, CHEST.W - 0.08].forEach((x) => T.box(x, CHEST.D - 0.08, 0.05, 0.08, 0.085, 0.1, '#C9CED6'));
        T.poly([[0.42, CF + 0.002, 0.46], [0.78, CF + 0.002, 0.46], [0.78, CF + 0.002, 0.58], [0.42, CF + 0.002, 0.58]], '#F2EEE6', 'rgba(0,0,0,.25)', 1);
        T.line([0.47, CF + 0.003, 0.52], [0.73, CF + 0.003, 0.52], '#B5332F', 2.4);
        T.line([CHEST.W + 0.004, 0.22, CHEST.Z - 0.1], [CHEST.W + 0.05, 0.3, CHEST.Z - 0.04], '#C9CED6', 2.4);
        T.line([CHEST.W + 0.05, 0.3, CHEST.Z - 0.04], [CHEST.W + 0.05, 0.45, CHEST.Z - 0.04], '#C9CED6', 2.4);
        T.line([CHEST.W + 0.05, 0.45, CHEST.Z - 0.04], [CHEST.W + 0.004, 0.53, CHEST.Z - 0.1], '#C9CED6', 2.4);
      },
      top: (T, z) => { for (let k = 1; k < 5; k++) { const y = (CHEST.D * k) / 5; T.line([0.06, y, z], [CHEST.W - 0.06, y, z], 'rgba(0,0,0,.12)', 1.6); T.line([0.06, y + 0.015, z], [CHEST.W - 0.06, y + 0.015, z], 'rgba(255,255,255,.6)', 1); } },
      handle: (T, Z, lh) => {
        [0.16, CHEST.W - 0.24].forEach((x) => { T.box(x, CHEST.D, Z - 0.1, 0.08, 0.03, lh + 0.06, '#C9CED6'); T.line([x + 0.01, CF + 0.032, Z - 0.08], [x + 0.07, CF + 0.032, Z - 0.08], '#FFFFFF', 1); });
      } }),
  };
  function chestFreezer(T, o) {
    const { W, D, Z } = CHEST, sk = skinId(o), body = sk ? cl(o) : '#E9EEF0';
    const L = (CHEST_LOOKS[sk] || CHEST_LOOKS.stock)(body);
    const fh = L.footH ?? 0.06, lh = L.lidH ?? 0.12, open = live(o.id) || usingSlot(o.id + ':f');
    if (L.feet) L.feet(T); else T.box(0.03, 0.03, 0, W - 0.06, D - 0.06, fh, L.foot ?? '#9AA3A8');
    T.box(0, 0, fh, W, D, Z - fh, body);
    for (let k = 0; k < 4; k++) T.line([W + 0.002, 0.2, fh + 0.08 + k * 0.05], [W + 0.002, 0.55, fh + 0.08 + k * 0.05], 'rgba(0,0,0,.22)', 1.2);
    if (L.front) L.front(T, body);
    // The light that says whether there is food in it, as on the fridge.
    const n = fridge.basic + fridge.fresh, [ix, iy] = T.P(W - 0.1, CF + 0.001, Z - 0.07);
    circle(ix, iy, 1.9, n === 0 ? '#C2413A' : '#E0A43A');
    if (!open) {
      T.box(-0.01, -0.01, Z, W + 0.02, D + 0.02, lh, L.lid);
      T.line([-0.01, D + 0.012, Z], [W + 0.01, D + 0.012, Z], 'rgba(0,0,0,.28)', 1.2);
      if (L.top) L.top(T, Z + lh);
      if (L.handle) L.handle(T, Z, lh);
      else T.line([0.42, CF + 0.016, Z + lh * 0.45], [0.78, CF + 0.016, Z + lh * 0.45], '#8E979C', 3);
      return;
    }
    // Open: the lid stands up on its hinge behind, and the frosted inside shows, with the food in it.
    const liner = L.liner ?? '#E3ECF0';
    T.box(-0.01, -lh + 0.01, Z, W + 0.02, lh, D + 0.02, L.lid);
    T.poly([[0.05, 0.012, Z + 0.05], [W - 0.05, 0.012, Z + 0.05], [W - 0.05, 0.012, Z + D - 0.05], [0.05, 0.012, Z + D - 0.05]], liner, 'rgba(0,0,0,.18)', 1);
    const rim = [[0.07, 0.07], [W - 0.07, 0.07], [W - 0.07, D - 0.07], [0.07, D - 0.07]].map(([x, y]) => T.P(x, y, Z));
    ctx.save(); ctx.beginPath(); rim.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.clip();
    const deep = Z - 0.5;
    T.poly([[0.07, 0.07, deep], [W - 0.07, 0.07, deep], [W - 0.07, D - 0.07, deep], [0.07, D - 0.07, deep]], '#CFE0E8');
    T.poly([[0.07, 0.07, Z], [W - 0.07, 0.07, Z], [W - 0.07, 0.07, deep], [0.07, 0.07, deep]], shade(liner, -0.08));
    T.poly([[0.07, 0.07, Z], [0.07, D - 0.07, Z], [0.07, D - 0.07, deep], [0.07, 0.07, deep]], shade(liner, -0.18));
    const pal = ['#C2413A', '#7FB069', '#F2EEE8', '#E0A43A', '#4A88B8', '#D9822B'];
    for (let i = 0; i < Math.min(n, 8); i++) { const [fx, fy] = T.P(0.22 + (i % 4) * 0.24, 0.24 + Math.floor(i / 4) * 0.26, deep + 0.06); rr(fx - 5, fy - 4, 10, 7, 1.5, pal[i % pal.length]); }
    ctx.restore();
    T.poly([[0.07, 0.07, Z + 0.001], [W - 0.07, 0.07, Z + 0.001], [W - 0.07, D - 0.07, Z + 0.001], [0.07, D - 0.07, Z + 0.001]], null, 'rgba(255,255,255,.6)', 1.2);
    const [mx, my] = T.P(W / 2, D / 2, Z + 0.06), drift = Math.sin(animT * 2) * 2;
    ell(mx - 8, my - 4 - drift, 16, 4, 'rgba(240,250,255,.32)'); ell(mx + 10, my - 9 + drift, 12, 3, 'rgba(240,250,255,.22)');
  }

  // ---- The media console: the TV unit's V2 model, long and low under the screen on the wall ----
  const CON = { W: 2.0, D: 0.5 }, CONF = CON.D + 0.004;
  function mediaConsole(T, o) {
    const { W, D } = CON;
    if (skinId(o) === 'midcentury') {
      // Mid-century: a walnut credenza floating on splayed, tapered legs. Two slatted walnut doors between two coloured
      // ones, brass pulls, and a little ceramic vase at one end.
      const wal = '#6B4A35', panel = cl(o), z0 = 0.18;
      [[0.12, 0.08, -1, -1], [W - 0.12, 0.08, 1, -1], [0.12, D - 0.08, -1, 1], [W - 0.12, D - 0.08, 1, 1]].forEach(([x, y, sx, sy]) => {
        T.line([x, y, z0], [x + sx * 0.05, y + sy * 0.03, 0], '#3E2A1E', 3.2); T.line([x, y, z0], [x + sx * 0.05, y + sy * 0.03, 0], '#7A5640', 1.4);
      });
      T.box(0, 0, z0, W, D, 0.5 - z0, wal);
      const doors = [0.03, 0.51, 1.0, 1.49, 1.97];
      for (let k = 0; k < 4; k++) {
        const x0 = doors[k] + 0.01, x1 = doors[k + 1] - 0.01, zb = z0 + 0.04, zt = 0.46;
        if (k === 0 || k === 3) T.poly([[x0, CONF, zb], [x1, CONF, zb], [x1, CONF, zt], [x0, CONF, zt]], panel, 'rgba(0,0,0,.25)', 1);
        else { T.poly([[x0, CONF, zb], [x1, CONF, zb], [x1, CONF, zt], [x0, CONF, zt]], shade(wal, -0.06), 'rgba(0,0,0,.3)', 1); for (let x = x0 + 0.05; x < x1 - 0.02; x += 0.06) T.line([x, CONF + 0.001, zb + 0.02], [x, CONF + 0.001, zt - 0.02], 'rgba(0,0,0,.28)', 1.2); }
        const [px, py] = T.P(k < 2 ? x1 - 0.05 : x0 + 0.05, CONF + 0.002, 0.33); circle(px, py, 1.8, '#C9A24A'); circle(px - 0.5, py - 0.5, 0.7, '#F0DCA0');
      }
      for (let k = 1; k < 6; k++) T.line([0.02, (D * k) / 6, 0.5], [W - 0.02, (D * k) / 6 + 0.01, 0.5], 'rgba(255,255,255,.06)', 1.2);
      T.box(1.8, 0.16, 0.5, 0.12, 0.12, 0.18, '#E8DCC8'); T.box(1.82, 0.18, 0.68, 0.08, 0.08, 0.06, '#E8DCC8');
      const [vx, vy] = T.P(1.86, 0.22, 0.74); ell(vx, vy, 2.4, 1.1, '#8E8A84');
    } else {
      // Stock: pale oak on a dark plinth. Two drawers either side of an open shelf with the game console in it.
      const oak = '#D8C7A8';
      T.box(0.04, 0.04, 0, W - 0.08, D - 0.08, 0.06, '#2B2B30');
      T.box(0, 0, 0.06, W, D, 0.44, oak);
      T.poly([[0.68, CONF, 0.1], [1.32, CONF, 0.1], [1.32, CONF, 0.44], [0.68, CONF, 0.44]], '#3A3340');
      T.box(0.78, D - 0.2, 0.1, 0.36, 0.18, 0.08, '#F2EEE8'); const [lx, ly] = T.P(1.08, CONF, 0.14); circle(lx, ly, 1.1, '#5BE3E6');
      [[0.06, 0.64], [1.36, 1.94]].forEach(([x0, x1]) => {
        [[0.1, 0.26], [0.28, 0.44]].forEach(([zb, zt]) => { T.poly([[x0, CONF, zb], [x1, CONF, zb], [x1, CONF, zt], [x0, CONF, zt]], shade(oak, 0.04), 'rgba(80,60,40,.35)', 1); const [kx, ky] = T.P((x0 + x1) / 2, CONF + 0.002, (zb + zt) / 2); circle(kx, ky, 1.6, '#2B2B30'); });
      });
    }
  }

  // ---- TVs: pieces of their own, on a wall or standing on something ----
  // The picture on a flat screen (local corners: bottom left, bottom right, top right, top left): dark glass with a sheen
  // when off; when on, a slow wash of colour with shapes drifting across it.
  function tvPicture(T, q, lit) {
    const at = (u, v) => [0, 1, 2].map((k) => q[0][k] + (q[1][k] - q[0][k]) * u + (q[3][k] - q[0][k]) * v);
    if (lit < 0.05) { T.poly(q, '#2A2D35'); T.line(at(0.08, 0.82), at(0.3, 0.55), 'rgba(255,255,255,.08)', 3); return; }
    const hue = (animT * 25) % 360;
    T.poly(q, `hsl(${hue},55%,${28 + lit * 18}%)`);
    for (let i = 0; i < 4; i++) {
      const u = 0.05 + ((i * 0.37 + animT * 0.15) % 0.72), v = 0.08 + ((i * 0.23 + Math.sin(animT + i) * 0.1 + 0.3) % 0.66);
      T.poly([at(u, v), at(u + 0.2, v), at(u + 0.2, v + 0.18), at(u, v + 0.18)], `hsla(${(hue + i * 70) % 360},80%,70%,${0.5 * lit})`);
    }
  }
  const TV_DRAWERS = {
    // On the wall: a slim black panel on a bracket.
    walltv: (T, o) => {
      const big = has('bigtv'), x0 = big ? -0.1 : 0, x1 = big ? 1.5 : 1.4, z0 = big ? 0.74 : 0.82, z1 = big ? 1.86 : 1.68;
      T.box(0.55, -0.08, 1.1, 0.3, 0.09, 0.3, '#2B2B30');
      T.box(x0, 0.01, z0, x1 - x0, 0.06, z1 - z0, '#1B1A1F');
      tvPicture(T, [[x0 + 0.05, 0.072, z0 + 0.05], [x1 - 0.05, 0.072, z0 + 0.05], [x1 - 0.05, 0.072, z1 - 0.05], [x0 + 0.05, 0.072, z1 - 0.05]], tvLit(o));
      const [lx, ly] = T.P(x1 - 0.08, 0.073, z0 + 0.025); circle(lx, ly, 0.9, tvLit(o) > 0.05 ? '#7FD36A' : '#C2413A');
    },
    // A flat screen on a foot, for a TV unit, a console or the entertainment center.
    tvflat: (T, o) => {
      T.box(0.3, 0.04, 0, 0.4, 0.18, 0.03, '#2B2B30'); T.box(0.47, 0.08, 0.03, 0.06, 0.05, 0.1, '#2B2B30');
      T.box(0, 0.1, 0.12, 1.0, 0.05, 0.6, '#1B1A1F');
      tvPicture(T, [[0.04, 0.152, 0.16], [0.96, 0.152, 0.16], [0.96, 0.152, 0.68], [0.04, 0.152, 0.68]], tvLit(o));
    },
    // A little screen in a coloured frame, for a desk or a dresser.
    tvdesk: (T, o) => {
      const c = cl(o);
      T.box(0.16, 0.03, 0, 0.2, 0.14, 0.025, c); T.box(0.23, 0.07, 0.025, 0.06, 0.04, 0.06, shade(c, -0.15));
      T.box(0, 0.08, 0.08, 0.52, 0.04, 0.36, c);
      tvPicture(T, [[0.04, 0.122, 0.11], [0.48, 0.122, 0.11], [0.48, 0.122, 0.41], [0.04, 0.122, 0.41]], tvLit(o));
    },
    // A tube TV: a deep cabinet, knobs and a grille beside the screen, and rabbit ears.
    tvtube: (T, o) => {
      const c = cl(o);
      T.box(0, 0, 0, 0.6, 0.4, 0.48, c);
      T.poly([[0.03, 0.401, 0.05], [0.46, 0.401, 0.05], [0.46, 0.401, 0.44], [0.03, 0.401, 0.44]], '#1B1A1F');
      tvPicture(T, [[0.06, 0.402, 0.09], [0.43, 0.402, 0.09], [0.43, 0.402, 0.4], [0.06, 0.402, 0.4]], tvLit(o));
      [0.35, 0.24].forEach((z) => { const [kx, ky] = T.P(0.53, 0.402, z); circle(kx, ky, 2.4, '#2B2B30'); circle(kx - 0.6, ky - 0.6, 0.9, '#9AA0A6'); });
      for (let z = 0.08; z < 0.17; z += 0.03) T.line([0.49, 0.402, z], [0.57, 0.402, z], 'rgba(0,0,0,.4)', 1);
      const [bx, by] = T.P(0.3, 0.2, 0.48); ell(bx, by, 4, 2, '#2B2B30');
      T.line([0.3, 0.2, 0.49], [0.12, 0.12, 0.84], '#9AA0A6', 1.3); T.line([0.3, 0.2, 0.49], [0.5, 0.26, 0.86], '#9AA0A6', 1.3);
    },
  };
  // The entertainment center: two tall shelf towers, a cabinet and a bridge round a niche the TV stands in.
  function entCenter(T, o) {
    const c = cl(o), dk = shade(c, -0.35), W = 2.4, D = 0.55;
    T.box(0.52, 0, 0, 1.36, D, 0.62, shade(c, -0.05));
    T.poly([[0.52, 0.012, 0.62], [1.88, 0.012, 0.62], [1.88, 0.012, 1.6], [0.52, 0.012, 1.6]], dk);
    [[0.52, 1.2], [1.2, 1.88]].forEach(([x0, x1]) => { T.poly([[x0 + 0.03, D + 0.001, 0.05], [x1 - 0.03, D + 0.001, 0.05], [x1 - 0.03, D + 0.001, 0.57], [x0 + 0.03, D + 0.001, 0.57]], null, 'rgba(0,0,0,.3)', 1); });
    [1.14, 1.26].forEach((x) => { const [px, py] = T.P(x, D + 0.002, 0.34); circle(px, py, 1.6, '#C9A24A'); });
    const books = ['#B5476E', '#3F5B4C', '#2E3B57', '#C9A24A', '#E8DCC8', '#7A4E32'];
    [[0, 0.52], [1.88, 2.4]].forEach(([x0, x1], side) => {
      T.box(x0, 0, 0, x1 - x0, D, 1.85, c);
      [0.45, 0.9, 1.35].forEach((z, row) => {
        T.poly([[x0 + 0.04, D + 0.001, z - 0.38], [x1 - 0.04, D + 0.001, z - 0.38], [x1 - 0.04, D + 0.001, z], [x0 + 0.04, D + 0.001, z]], dk);
        for (let k = 0; k < 6; k++) { const x = x0 + 0.07 + k * 0.065, h = 0.22 + ((k * 7 + row * 3 + side) % 4) * 0.03; T.line([x, D + 0.002, z - 0.37], [x, D + 0.002, z - 0.37 + h], books[(k + row * 2 + side) % books.length], 2.6); }
        T.line([x0 + 0.02, D + 0.002, z], [x1 - 0.02, D + 0.002, z], shade(c, 0.12), 1.6);
      });
    });
    T.box(0.52, 0, 1.6, 1.36, D, 0.25, c);
    T.box(-0.02, -0.02, 1.85, W + 0.04, D + 0.04, 0.08, shade(c, 0.1));
  }
  // ---- Trees: seven species painted once into cached layers and swayed every frame (see treeArt.js) ----
  const treeSnow = () => seasonIdx() === 3 && YARD.tiles.some(q => q.snow > 0.3);
  const scatter = (k, s) => Math.abs(Math.sin(k * 12.9898 + s * 78.233) * 43758.5453 % 1);
  const idHash = (id) => { let h = 0; for (let i = 0; i < String(id).length; i++) h = (h * 31 + String(id).charCodeAt(i)) | 0; return Math.abs(h); };
  // Petals, blossom or leaves drifting down past a tree, a few at a time, each on its own steady track.
  const fallers = (bx, by, n, col, spread, top, t, r = 2) => { for (let k = 0; k < n; k++) { const ph = (t * 0.22 + scatter(k, 5)) % 1; circle(bx - spread + scatter(k, 1) * spread * 2 + Math.sin(t + k) * 8, by - top + ph * top, r, col); } };
  // A tree that has just been shaken: when, and how many pieces of fruit fell, so they can be shown dropping.
  const SHAKES = new Map();
  // Whether someone is in the meeting room right now (the sign over the door lights up).
  let officeMeeting = false;
  const treeAt = (kind, cx, cy, drift) => (T, o, t) => {
    const [bx, by] = T.P(cx, cy, 0), season = seasonIdx(), fruity = !!STATE_TYPES[o.type] && ['treeapple', 'treecherry', 'treepalm'].includes(o.type), sk = SHAKES.get(o.id);
    drawTree(ctx, kind, bx, by, t, { season, snowy: treeSnow(), variant: idHash(o.id) % 3, scale: cv.width / W,
      ...(fruity ? { grow: o.grow ?? 0, fruit: { t: o.fruit ?? 0 } } : {}), ...(sk ? { shake: animT - sk.t0, fallen: sk.n } : {}) });
    if (drift && drift[season]) { const [col, n, spread, top] = drift[season]; fallers(bx, by, n, col, spread, top, t); }
  };

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
        } else plantPot(plantH(), T, o.pot || '#C26B4A', 0.44, 0.42, 0.03, 0.03);
        if (skinId(o)) T.poly([[0.05, 0.05, 0.421], [0.45, 0.05, 0.421], [0.45, 0.45, 0.421], [0.05, 0.45, 0.421]], skinId(o) === 'modern' ? '#B9B4AC' : '#4A3426');
        const [sx, sy] = T.P(0.25, 0.25, 0.55);
        drawFoliage(plantH(), 'houseplant', ...T.P(0.25, 0.25, 0.43), t, seedOf(o.id));
        if (SEASON_BLOOM[skinId(o)]) SEASON_BLOOM[skinId(o)](T, o, sx, sy); })],
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
    // Nana: a plush pink lounger with a tufted back set with pearls, rolled arms, a scalloped skirt, a heart pillow and a butter throw, under a sheer canopy with twinkling fairy lights, hanging stars and butterflies.
    cloudnook: {
      parts: (o) => { const c = cl(o); return [
        B(0, 0, 0, 1.5, 1.1, 0.36, NA.lilac, { name: 'base' }), B(0, 0, 0.36, 1.5, 0.34, 0.66, NA.pink), B(0, 0.34, 0.36, 0.22, 0.76, 0.34, NA.pink), B(1.28, 0.34, 0.36, 0.22, 0.76, 0.34, NA.pink),
        B(0.22, 0.34, 0.36, 1.06, 0.76, 0.12, c),
        F(0, 0, 1.5, 1.1, (T, ob, t) => {
          const lit = isLit(ob.id);
          // The skirt: cream, with a scalloped hem all round the front.
          T.poly([[0.02, 1.102, 0.02], [1.48, 1.102, 0.02], [1.48, 1.102, 0.18], [0.02, 1.102, 0.18]], NA.cream, NA.edge, 0.8); scallopTrim(T, [0.02, 1.103, 0.18], [1.48, 1.103, 0.18], 14, 0, NA.cream);
          T.poly([[1.502, 0.34, 0.02], [1.502, 1.1, 0.02], [1.502, 1.1, 0.18], [1.502, 0.34, 0.18]], shade(NA.cream, -0.05), NA.edge, 0.8); scallopTrim(T, [1.503, 0.34, 0.18], [1.503, 1.1, 0.18], 8, 0, shade(NA.cream, -0.05));
          // The canopy: two slim gold posts, sheer pink panels and a scalloped valance.
          [[0.04, 0.04], [1.4, 0.04]].forEach(([x, y]) => T.box(x, y, 0.96, 0.05, 0.05, 0.92, NA.gold));
          T.poly([[0.02, 0.07, 1.86], [1.48, 0.07, 1.86], [1.48, 0.07, 1.42], [0.02, 0.07, 1.42]], 'rgba(255,226,240,.55)', 'rgba(205,150,185,.35)', 1);
          T.poly([[0.02, 0.07, 1.86], [0.3, 0.07, 1.86], [0.3, 0.07, 1.0], [0.02, 0.07, 1.0]], 'rgba(255,214,232,.5)');
          T.poly([[1.2, 0.07, 1.86], [1.48, 0.07, 1.86], [1.48, 0.07, 1.0], [1.2, 0.07, 1.0]], 'rgba(255,214,232,.5)');
          scallopTrim(T, [0.02, 0.07, 1.42], [1.48, 0.07, 1.42], 16, 0, NA.white);
          // Fairy lights along the arch, twinkling, with a few stars hanging from it and two butterflies.
          for (let k = 0; k <= 12; k++) { const x = 0.06 + k * 0.1175, z = 1.82 - Math.sin((k / 12) * Math.PI) * 0.12, [bx, by] = T.P(x, 0.075, z), tw = lit ? 0.6 + 0.4 * Math.sin(t * 3 + k * 1.7) : 0.35; if (lit) circle(bx, by, 4.2, `rgba(255,236,170,${0.3 * tw})`); circle(bx, by, 1.7, lit ? `rgba(255,244,190,${0.55 + 0.45 * tw})` : '#F2E4B8'); }
          [[0.3, 1.64], [0.75, 1.58], [1.2, 1.64]].forEach(([x, z], k) => { const [sx, sy] = T.P(x, 0.075, z); T.line([x, 0.075, z + 0.14], [x, 0.075, z], '#E8C877', 0.8); if (k === 1) butterfly(sx, sy + 2, 4.2, NA.pinkDeep, NA.lilacDeep, 0.6 + 0.4 * Math.sin(t * 4)); else star5(sx, sy + 1, 3, k ? NA.butter : NA.pinkDeep); });
          // The tufted back: a quilting of diagonal lines with a pearl at every crossing, and a scalloped top edge.
          const fy = 0.341;
          for (let k = 0; k <= 4; k++) { T.line([0.1 + k * 0.2, fy, 0.4], [0.1 + k * 0.2 + 0.42, fy, 0.96], 'rgba(176,96,132,.22)', 0.8); T.line([0.1 + k * 0.2 + 0.42, fy, 0.4], [0.1 + k * 0.2, fy, 0.96], 'rgba(176,96,132,.22)', 0.8); }
          for (let r = 0; r < 3; r++) for (let x = 0.2 + (r % 2) * 0.1; x < 1.42; x += 0.2) { const [px, py] = T.P(x, fy, 0.5 + r * 0.2); circle(px, py, 2.2, NA.edge); circle(px, py, 1.7, NA.white); }
          scallopTrim(T, [0.02, fy, 1.0], [1.48, fy, 1.0], 22, 0, NA.pink);
          // A heart pillow, a star pillow and the butter throw over one arm.
          T.box(0.26, 0.42, 0.48, 0.34, 0.26, 0.2, NA.lilac); const [hx, hy] = T.P(0.43, 0.68, 0.62); heart(hx, hy, 1.1, NA.white);
          T.box(0.92, 0.46, 0.48, 0.3, 0.22, 0.16, NA.butter); const [sx, sy] = T.P(1.07, 0.68, 0.6); star5(sx, sy, 3.2, NA.pinkDeep);
          T.box(1.26, 0.4, 0.7, 0.26, 0.62, 0.05, NA.butter); T.box(1.26, 1.0, 0.36, 0.26, 0.05, 0.36, NA.butter);
          if (lit) ell(...T.P(0.75, 0.5, 1.2), 34, 24, 'rgba(255,214,232,.16)');
        }, { onTop: true })]; },
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
    chestfreezer: { parts: () => [F(0, 0, 1.2, 0.75, (T) => chestFreezer(T, T.o))] },
    mediaconsole: { parts: () => [F(0, 0, 2.0, 0.5, (T) => mediaConsole(T, T.o))] },
    walltv: { parts: () => [F(0, 0, 1.4, 0.1, (T) => TV_DRAWERS.walltv(T, T.o))] },
    tvflat: { parts: () => [F(0, 0, 1.0, 0.26, (T) => TV_DRAWERS.tvflat(T, T.o))] },
    tvdesk: { parts: () => [F(0, 0, 0.52, 0.2, (T) => TV_DRAWERS.tvdesk(T, T.o))] },
    tvtube: { parts: () => [F(0, 0, 0.62, 0.55, (T) => TV_DRAWERS.tvtube(T, T.o))] },
    entcenter: { parts: () => [F(0, 0, 2.4, 0.55, (T) => entCenter(T, T.o))] },
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
    // The trees you can plant (the shop's Outdoor tab): seven kinds, each its own shape.
    treeoak: { parts: () => [F(0.2, 0.2, 1.4, 1.4, treeAt('oak', 0.8, 0.8, { 2: ['#D98F2B', 7, 60, 90] }))] },
    treecherry: { parts: () => [F(0.2, 0.2, 1.4, 1.4, treeAt('cherry', 0.8, 0.8, { 0: ['#FBD6E0', 12, 54, 80], 2: ['#E0762C', 5, 50, 80] }))] },
    treepine: { parts: () => [F(0.2, 0.2, 1.0, 1.0, treeAt('pine', 0.6, 0.6))] },
    treebirch: { parts: () => [F(0.2, 0.2, 0.8, 0.8, treeAt('birch', 0.5, 0.5, { 2: ['#EBC23A', 6, 30, 100] }))] },
    treewillow: { parts: () => [F(0.2, 0.2, 1.6, 1.6, treeAt('willow', 0.9, 0.9, { 2: ['#D8B442', 8, 70, 90] }))] },
    treepalm: { parts: () => [F(0.2, 0.2, 1.0, 1.0, treeAt('palm', 0.6, 0.6))] },
    treeapple: { parts: () => [F(0.2, 0.2, 1.0, 1.0, treeAt('apple', 0.6, 0.6, { 0: ['#FBF3F5', 8, 34, 60], 2: ['#B6A23A', 4, 34, 60] }))] },
    // ---- the office ----
    officedesk: {
      // A 1.2 x 0.62 top on side panels, a low partition behind it, a monitor (its screen lights while someone sits at it), a keyboard, a mouse on its pad, a mug, a desk phone
      // and a PC tower standing at the left end. The chair is a piece of its own (officechair), tucked in at the desk's front. Everything that stands on the top is
      // painted in one pass over it (back to front), so the depth order cannot tangle.
      parts: () => [B(0.03, 0.05, 0, 0.05, 0.55, 0.72, '#B9B09A'), B(1.12, 0.05, 0, 0.05, 0.55, 0.72, '#B9B09A'), B(0.08, 0.05, 0.12, 1.04, 0.03, 0.6, '#A59C86'),
        B(0, 0, 0.72, 1.2, 0.62, 0.05, '#CDBFA3', { name: 'top' }), B(0, 0, 0.77, 1.2, 0.04, 0.46, '#8E98A6'),
        F(0, 0, 1.2, 0.62, (T, o) => {
          const on = deskInUse(o), z0 = 0.77;
          // The monitor, at the back, then the PC tower at the left end.
          T.box(0.58, 0.12, z0, 0.1, 0.08, 0.14, '#2B2F38'); T.box(0.41, 0.09, z0 + 0.13, 0.5, 0.05, 0.3, '#23272F');
          T.poly([[0.44, 0.141, 0.93], [0.88, 0.141, 0.93], [0.88, 0.141, 1.17], [0.44, 0.141, 1.17]], on ? '#9FD0FF' : '#1B2230');
          if (on) [1.12, 1.07, 1.02, 0.97].forEach((z, i) => T.line([0.48, 0.142, z], [0.48 + (i % 2 ? 0.26 : 0.34), 0.142, z], '#FFFFFF', 1));
          T.box(0.1, 0.12, z0, 0.2, 0.44, 0.46, '#2E323B');
          const fy = 0.561;
          T.poly([[0.12, fy, z0 + 0.36], [0.28, fy, z0 + 0.36], [0.28, fy, z0 + 0.4], [0.12, fy, z0 + 0.4]], '#15181D');                    // the drive bay
          T.poly([[0.12, fy, z0 + 0.3], [0.28, fy, z0 + 0.3], [0.28, fy, z0 + 0.33], [0.12, fy, z0 + 0.33]], '#22262E');
          T.box(0.15, fy, z0 + 0.2, 0.05, 0.012, 0.05, '#4A5262');                                                                        // the power button
          T.box(0.235, fy, z0 + 0.215, 0.03, 0.012, 0.03, on ? '#5BE08A' : '#2E5A3E');                                                     // its light
          [0.06, 0.09, 0.12, 0.15].forEach(z => T.line([0.13, fy + 0.001, z0 + z], [0.27, fy + 0.001, z0 + z], '#15181D', 1));            // the vents
          const sx = 0.301, cy = 0.34, cz = z0 + 0.23;                                                                                    // the side panel and its fan
          T.poly([[sx, 0.16, z0 + 0.05], [sx, 0.52, z0 + 0.05], [sx, 0.52, z0 + 0.42], [sx, 0.16, z0 + 0.42]], '#3A4150');
          const ring = [], hub = [];
          for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ring.push([sx + 0.001, cy + Math.cos(a) * 0.1, cz + Math.sin(a) * 0.1]); }
          for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; hub.push([sx + 0.002, cy + Math.cos(a) * 0.03, cz + Math.sin(a) * 0.03]); }
          T.poly(ring, '#1B1E24'); T.poly(hub, '#6B7280');
          // The mouse pad and the mouse: a pale shell with a split for the buttons and a wheel, easy to tell from the dark pad.
          T.box(0.77, 0.33, z0, 0.16, 0.24, 0.008, '#2B2F38');
          T.box(0.81, 0.39, z0 + 0.008, 0.08, 0.13, 0.035, '#E4E7EC'); T.line([0.81, 0.44, z0 + 0.043], [0.89, 0.44, z0 + 0.043], '#6B7280', 1); T.line([0.85, 0.39, z0 + 0.043], [0.85, 0.44, z0 + 0.043], '#6B7280', 1); T.box(0.842, 0.4, z0 + 0.044, 0.016, 0.035, 0.006, '#3A3F4A');
          // The desk phone at the right end: a base with a keypad, the handset across its cradle and a red light.
          T.box(0.95, 0.32, z0, 0.22, 0.24, 0.06, '#4A5262'); T.box(0.98, 0.4, z0 + 0.06, 0.12, 0.14, 0.012, '#8E98A6'); T.box(0.94, 0.34, z0 + 0.06, 0.06, 0.2, 0.05, '#1E2128'); T.box(1.13, 0.34, z0 + 0.06, 0.06, 0.2, 0.05, '#1E2128'); T.box(0.94, 0.38, z0 + 0.11, 0.25, 0.12, 0.04, '#1E2128'); T.box(1.06, 0.35, z0 + 0.072, 0.05, 0.05, 0.012, '#E0453A');
        }, { onTop: true }),
        B(0.4, 0.4, 0.77, 0.36, 0.13, 0.02, '#3A3F4A'), B(0.98, 0.14, 0.77, 0.09, 0.09, 0.11, '#C2413A')],
    },
    officechair: {
      parts: () => [B(0.12, 0.2, 0.0, 0.36, 0.2, 0.04, '#2B2F38'), B(0.27, 0.27, 0.04, 0.06, 0.06, 0.36, '#2B2F38'),
        B(0.05, 0.1, 0.4, 0.5, 0.45, 0.07, '#3A4150', { name: 'seat' }), B(0.05, 0.5, 0.47, 0.5, 0.07, 0.5, '#3A4150')],
    },
    // The boss's desk: dark walnut, twice the size, drawer pedestals either side, a green leather blotter, a brass lamp and nameplate. The piece is placed turned (rot 2) so the
    // boss works on the far side, facing the room; its chair (bosschair) is a piece of its own.
    bossdesk: {
      parts: () => [B(0.05, 0.05, 0, 0.5, 0.85, 0.72, '#4E3224'), B(1.45, 0.05, 0, 0.5, 0.85, 0.72, '#4E3224'), B(0.55, 0.05, 0.1, 0.9, 0.04, 0.6, '#43281C'),
        B(0, 0, 0.72, 2.0, 0.95, 0.07, '#6B4630', { name: 'top' }),
        B(0.62, 0.3, 0.79, 0.76, 0.46, 0.012, '#2B3A2F'),
        F(0.8, 0.04, 1.3, 0.3, (T, o) => { const on = deskInUse(o); T.box(0.95, 0.12, 0.79, 0.1, 0.08, 0.15, '#1E2128'); T.box(0.78, 0.09, 0.93, 0.44, 0.05, 0.3, '#1E2128'); T.poly([[0.81, 0.141, 0.96], [1.19, 0.141, 0.96], [1.19, 0.141, 1.2], [0.81, 0.141, 1.2]], on ? '#9FD0FF' : '#1B2230'); }, { onTop: true }),
        F(0.1, 0.1, 0.5, 0.5, (T) => { T.box(0.14, 0.14, 0.79, 0.14, 0.14, 0.03, '#C9A24A'); T.line([0.21, 0.21, 0.82], [0.21, 0.21, 1.05], '#C9A24A', 2); T.box(0.1, 0.1, 1.04, 0.22, 0.22, 0.1, '#2F6B4F'); }, { onTop: true }),
        B(1.55, 0.62, 0.79, 0.34, 0.07, 0.07, '#C9A24A'), B(1.6, 0.22, 0.79, 0.28, 0.2, 0.06, '#1E2128')],
    },
    // A big leather chair: a swivel base on a column, a deep seat, arms, and a tall back. Placed turned (rot 2) so it faces the room from behind the desk.
    bosschair: {
      parts: () => [B(0.2, 0.18, 0.0, 0.5, 0.36, 0.05, '#1E2128'), B(0.38, 0.32, 0.05, 0.12, 0.12, 0.35, '#1E2128'),
        B(0.05, 0.1, 0.4, 0.8, 0.62, 0.1, '#33241E', { name: 'seat' }), B(0.05, 0.6, 0.5, 0.8, 0.14, 1.0, '#33241E'),
        B(0.0, 0.1, 0.5, 0.07, 0.55, 0.28, '#1F1613'), B(0.83, 0.1, 0.5, 0.07, 0.55, 0.28, '#1F1613')],
    },
    visitorchair: {
      // An upholstered chair for the visitor, its back toward the room and its seat toward the boss's desk.
      parts: () => [B(0.05, 0.05, 0, 0.05, 0.05, 0.4, '#2B2F38'), B(0.5, 0.05, 0, 0.05, 0.05, 0.4, '#2B2F38'), B(0.05, 0.5, 0, 0.05, 0.05, 0.4, '#2B2F38'), B(0.5, 0.5, 0, 0.05, 0.05, 0.4, '#2B2F38'),
        B(0.02, 0.1, 0.4, 0.56, 0.46, 0.08, '#4A5262', { name: 'seat' }), B(0.02, 0.52, 0.48, 0.56, 0.07, 0.5, '#4A5262')],
    },
    officerug: {
      // The boss's rug: deep red with a gold border.
      parts: () => [F(0, 0, 3.0, 3.0, (T) => { const q = (a, b, x, y, z, col, st) => T.poly([[a, b, z], [x, b, z], [x, y, z], [a, y, z]], col, st, 1); q(0, 0, 3.0, 3.0, 0.01, '#6A2A2E'); q(0.12, 0.12, 2.88, 2.88, 0.012, null, '#C9A24A'); q(0.25, 0.25, 2.75, 2.75, 0.012, null, 'rgba(201,162,74,.5)'); })],
    },
    officerunner: {
      // A long corporate runner laid from the meeting room door down the aisle: charcoal-blue with a pale edge stripe and a darker inner border.
      parts: () => [F(0, 0, 1.1, 6.4, (T) => { const q = (a, b, x, y, z, col, st) => T.poly([[a, b, z], [x, b, z], [x, y, z], [a, y, z]], col, st, 1); q(0, 0, 1.1, 6.4, 0.01, '#3C4A63'); q(0.07, 0, 1.03, 6.33, 0.012, null, '#9AA7BD'); q(0.15, 0, 0.95, 6.25, 0.012, null, 'rgba(154,167,189,.45)'); })],
    },
    officeprinter: {
      // A floor-standing copier: a cabinet with two paper drawers, a white body, a scanner lid with a glass top, an angled control panel with buttons, and a tray with paper.
      parts: () => [B(0.05, 0.05, 0, 1.5, 0.6, 0.5, '#8E98A6'), B(0, 0, 0.5, 1.6, 0.7, 0.5, '#F1EEE8'), B(0.04, 0.04, 1.0, 1.1, 0.62, 0.07, '#DDE1E7'),
        F(0, 0, 1.6, 0.75, (T) => {
          T.poly([[0.12, 0.12, 1.075], [1.02, 0.12, 1.075], [1.02, 0.6, 1.075], [0.12, 0.6, 1.075]], '#9FC4DA', 'rgba(0,0,0,.25)');   // the scanner glass
          T.box(1.18, 0.06, 1.0, 0.36, 0.42, 0.14, '#3A3F4A');                                                                         // the control panel
          [['#3F9A5A', 1.24], ['#C2413A', 1.32], ['#E0B64A', 1.4]].forEach(([c, x]) => T.box(x, 0.12, 1.14, 0.05, 0.05, 0.015, c));
          T.box(1.22, 0.24, 1.14, 0.28, 0.12, 0.012, '#7FC0E6');
          [0.1, 0.3].forEach(z => { T.poly([[0.12, 0.701, z + 0.04], [1.48, 0.701, z + 0.04], [1.48, 0.701, z + 0.17], [0.12, 0.701, z + 0.17]], '#A5AEBA', 'rgba(0,0,0,.3)'); T.box(0.7, 0.702, z + 0.1, 0.2, 0.012, 0.03, '#3A3F4A'); });
          T.box(0.1, 0.7, 0.55, 0.62, 0.15, 0.025, '#C9CED6'); T.box(0.14, 0.72, 0.575, 0.54, 0.11, 0.03, '#FFFFFF');                  // the output tray and its paper
        })],
    },
    officecooler: {
      parts: () => [B(0, 0, 0, 0.4, 0.4, 0.9, '#E8EEF2'), B(0.05, 0.05, 0.9, 0.3, 0.3, 0.55, '#7FC0E6')],
    },
    officecabinet: { parts: () => [B(0, 0, 0, 0.5, 0.6, 1.2, '#8E98A6')] },
    officeplant: { parts: () => [B(0.05, 0.05, 0, 0.4, 0.4, 0.32, '#B07A55'), B(0.1, 0.1, 0.32, 0.3, 0.3, 0.8, '#3F7A4A')] },
    officecounter: {
      parts: () => [B(0, 0, 0, 2.2, 0.62, 0.9, '#C9C3B8'), B(0.2, 0.08, 0.9, 0.5, 0.4, 0.4, '#2B2F38')],
    },
    officefridge: { parts: () => [B(0, 0, 0, 0.7, 0.7, 1.9, '#E8EEF2')] },
    officevending: { parts: () => [B(0, 0, 0, 0.7, 0.7, 1.8, '#2F5FA8'), B(0.05, 0.62, 0.9, 0.6, 0.06, 0.7, '#CFE4F0')] },
    garden: {    
      parts: () => [F(0, 0, 2.0, 1.0, (T, o, t) => { T.box(0, 0, 0, 2.0, 1.0, 0.28, '#8A6A50'); T.poly([[0.08, 0.08, 0.281], [1.92, 0.08, 0.281], [1.92, 0.92, 0.281], [0.08, 0.92, 0.281]], (o.wet || 0) > 0.3 ? '#4A3426' : '#7A5E44');
        if (usingSlot(o.id + ':t')) { const [gx, gy] = T.W(1.0, 0.5); PFX.emit(o.id + ':splash', 'splash', o.level, gx, gy, 0.55, 1); }
        if (seasonIdx() === 3) { T.poly([[0.08, 0.08, 0.282], [1.92, 0.08, 0.282], [1.92, 0.92, 0.282], [0.08, 0.92, 0.282]], 'rgba(244,246,248,.9)'); return; }
        const g = o.grow || 0; const stage = stageAt(g).name; const dead = !!o.dead;
        // A ground vine lies on the soil instead of standing up on stems.
        // Ground crops (vines, roots, rosettes) lie on the soil instead of standing up on stems.
        const groundForm = o.crop ? CROPS[o.crop]?.form : null;
        const ground = groundForm === 'ground-vine' || groundForm === 'root' || groundForm === 'rosette';
        if (ground) for (let k = 0; k < 6; k++) { const [vx, vy] = T.P(0.3 + (k % 3) * 0.7, 0.3 + Math.floor(k / 3) * 0.42, 0.29); drawGroundSpot(ctx, vx, vy, groundForm, o.crop, stage, dead, t, k); }
        for (let k = 0; k < (ground ? 0 : 6); k++) { const [sx, sy] = T.P(0.3 + (k % 3) * 0.7, 0.3 + Math.floor(k / 3) * 0.42, 0.29), hh = 4 + g * 18, sw = Math.sin(t * 2.2 + k * 0.9) * 2.2; limb(sx, sy, sx + sw, sy - hh, dead ? '#8A6A3A' : '#3F7D4E', 1.6); ell(sx - 3 + sw, sy - hh * 0.55, 3.5 + g * 2, 1.8 + g, dead ? '#9A7A44' : '#4F9460', null, -0.5); ell(sx + 3 + sw, sy - hh * 0.75, 3.5 + g * 2, 1.8 + g, dead ? '#A8864E' : '#5BA36C', null, 0.5); if (o.crop) { if (stage !== 'seed' && !dead) drawCrop(ctx, sx + sw, sy - hh, stage === 'final' ? 0.9 : 0.55, o.crop, Math.sin(t * 2.2 + k * 0.9) * 0.16, stage); } else if (g >= 1) { circle(sx - 2 + sw, sy - hh * 0.45, 2.4, '#C2413A'); circle(sx + 3 + sw, sy - hh * 0.65, 2.2, k % 2 ? '#E0A43A' : '#C2413A'); } } })],
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
      parts: (o) => [F(0, 0, 3.3, 1.9, (T, ob, t) => { if (LOOK_DRAWERS.rugwide[skinId(o)]) { LOOK_DRAWERS.rugwide[skinId(o)](T, o, t); return; } const c = cl(o), q = (a, b, x, y, z, col, st) => T.poly([[a, b, z], [x, b, z], [x, y, z], [a, y, z]], col, st, 1.2); q(0, 0, 3.3, 1.9, 0.01, c); q(0.18, 0.18, 3.12, 1.72, 0.012, null, '#E8C9A0'); for (let k = 0; k < 4; k++) { const yy = 0.45 + k * 0.38; q(0.4, yy, 2.9, yy + 0.12, 0.013, shade(c, -0.16)); } }, { decal: true })] },
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
      parts: (o) => [F(0, 0, 0.55, 0.55, (T, ob, t) => { const [x, y] = plantPot(plantH(), T, cl(o), 0.4, 0.38, 0.075, 0.075); drawFoliage(plantH(), 'fern', x, y, t, seedOf(ob.id)); })],
       },
    cactus: {      
      parts: (o) => [F(0, 0, 0.45, 0.45, (T, ob, t) => { const [x, y] = plantPot(plantH(), T, cl(o), 0.34, 0.3, 0.055, 0.055); drawFoliage(plantH(), 'cactus', x, y, t, seedOf(ob.id)); })],
       },
    fiddle: {      
      parts: (o) => [F(0, 0, 0.6, 0.6, (T, ob, t) => { const [x, y] = plantPot(plantH(), T, cl(o), 0.42, 0.44, 0.09, 0.09); drawFoliage(plantH(), 'fiddle', x, y, t, seedOf(ob.id)); })],
       },
    snake: {      
      parts: (o) => [F(0, 0, 0.45, 0.45, (T, ob, t) => { const [x, y] = plantPot(plantH(), T, cl(o), 0.34, 0.36, 0.055, 0.055); drawFoliage(plantH(), 'snake', x, y, t, seedOf(ob.id)); })],
       },
    palm: {      
      parts: (o) => [F(0, 0, 0.7, 0.7, (T, ob, t) => { const [x, y] = plantPot(plantH(), T, cl(o), 0.46, 0.45, 0.12, 0.12); drawFoliage(plantH(), 'palm', x, y, t, seedOf(ob.id)); })],
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
    rugarcade: {
      // The arcade carpet as a rug: ink with a yellow border, neon confetti and three invaders.
      parts: (o) => [F(0, 0, 2.4, 1.6, (T) => { const c = cl(o); T.poly([[0, 0, 0.008], [2.4, 0, 0.008], [2.4, 1.6, 0.008], [0, 1.6, 0.008]], c); T.poly([[0.1, 0.1, 0.009], [2.3, 0.1, 0.009], [2.3, 1.5, 0.009], [0.1, 1.5, 0.009]], null, AR.yellow, 2.4); T.poly([[0.2, 0.2, 0.009], [2.2, 0.2, 0.009], [2.2, 1.4, 0.009], [0.2, 1.4, 0.009]], null, AR.cyan, 1);
        for (let k = 0; k < 60; k++) { const x = 0.2 + ((k * 0.618 * 5.3) % 2.0), y = 0.2 + ((k * 0.414 * 3.1) % 1.2); const [sx, sy] = T.P(x, y, 0.01); circle(sx, sy, 1.4, [AR.magenta, AR.cyan, AR.yellow, AR.violet][k % 4]); }
        [[0.6, 0.8, AR.cyan], [1.2, 0.5, AR.magenta], [1.8, 0.95, AR.green]].forEach(([x, y, col]) => { const [sx, sy] = T.P(x, y, 0.011); sprite(sx, sy, 1.8, INVADER, col); }); }, { decal: true })] },
    cartridges: {
      // Three game cartridges stacked, labels up, and one standing against them.
      parts: (o) => { const c = cl(o), grey = '#B9BEC3', dark = '#8E939A'; return [B(0.02, 0.04, 0, 0.3, 0.28, 0.07, grey), B(0.04, 0.05, 0.07, 0.3, 0.27, 0.07, dark), B(0.01, 0.03, 0.14, 0.3, 0.28, 0.07, grey), B(0.36, 0.04, 0, 0.08, 0.28, 0.26, dark),
        F(0, 0, 0.45, 0.35, (T) => { [[0.21, c], [0.14, AR.cyan], [0.07, AR.magenta]].forEach(([z, col]) => T.poly([[0.07, 0.1, z + 0.001], [0.26, 0.1, z + 0.001], [0.26, 0.26, z + 0.001], [0.07, 0.26, z + 0.001]], col)); T.poly([[0.441, 0.08, 0.06], [0.441, 0.24, 0.06], [0.441, 0.24, 0.2], [0.441, 0.08, 0.2]], AR.yellow); const [sx, sy] = T.P(0.165, 0.18, 0.212); sprite(sx, sy, 0.9, INVADER, '#15121F'); }, { onTop: true })]; } },
    pinball: {
      // A pinball machine: a dark base with chrome legs, a cabinet in its colour, a glass playfield with lane guides, slingshots, drop targets, a
      // ramp, bumpers that flash, flippers that flip and a ball that flies about while someone plays, and a backbox with a glowing screen and a
      // marquee of chasing bulbs. The player stands at the near end (high y). The F part shares the cabinet's footprint so it sorts after it.
      parts: (o) => { const c = cl(o); return [
        B(0.08, 0.1, 0, 0.59, 1.35, 0.62, '#2B2B30'), B(0, 0.05, 0.62, 0.75, 1.45, 0.3, c), B(0, 0, 0.92, 0.75, 0.22, 0.98, c),
        F(0, 0.05, 0.75, 1.5, (T, ob, t) => { const playing = usingSlot(ob.id + ':p') || live(ob.id), hot = (k) => playing && Math.floor(t * 5 + k) % 3 === 0;
          // Chrome legs on the base's faces, and the coin door on the front.
          [0.14, 0.61].forEach((x) => { T.line([x, 1.451, 0.02], [x, 1.451, 0.6], AR.chrome, 2.4); }); [0.2, 1.3].forEach((y) => { T.line([0.671, y, 0.02], [0.671, y, 0.6], AR.chrome, 2.4); });
          T.poly([[0.22, 1.501, 0.68], [0.53, 1.501, 0.68], [0.53, 1.501, 0.86], [0.22, 1.501, 0.86]], '#2B2B30', AR.chrome, 1); const [qx, qy] = T.P(0.3, 1.502, 0.77); circle(qx, qy, 1.6, AR.yellow); T.line([0.4, 1.502, 0.74], [0.4, 1.502, 0.8], AR.chrome, 1.4); const [rx, ry] = T.P(0.48, 1.502, 0.77); circle(rx, ry, 1.8, AR.red);
          // The playfield under glass: a navy field with a cyan rim, lane guides down both sides and the shooter lane on the right.
          T.poly([[0.04, 0.28, 0.921], [0.71, 0.28, 0.921], [0.71, 1.46, 0.921], [0.04, 1.46, 0.921]], '#141226', AR.cyan, 1);
          T.line([0.64, 0.34, 0.923], [0.64, 1.44, 0.923], AR.chrome, 1); T.line([0.1, 0.34, 0.923], [0.1, 1.1, 0.923], AR.magenta, 1); T.line([0.58, 0.34, 0.923], [0.58, 1.1, 0.923], AR.magenta, 1);
          // A ramp curling over the top, drop targets across it, and a spinner.
          const ramp = []; for (let k = 0; k <= 10; k++) { const a = Math.PI * k / 10; ramp.push(T.P(0.34 + Math.cos(a) * 0.24, 0.62 - Math.sin(a) * 0.26, 0.93)); } ctx.beginPath(); ramp.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.strokeStyle = AR.cyan; ctx.lineWidth = 1.6; ctx.stroke();
          [0.22, 0.3, 0.38, 0.46].forEach((x, k) => T.poly([[x, 0.4, 0.924], [x + 0.06, 0.4, 0.924], [x + 0.06, 0.46, 0.924], [x, 0.46, 0.924]], hot(k) ? '#FFF6C8' : AR.yellow));
          T.line([0.46, 0.7, 0.924], [0.54, 0.7, 0.924], playing ? (Math.floor(t * 10) % 2 ? AR.chrome : AR.yellow) : AR.chrome, 1.6);
          // Lane lights down the left, the three bumpers, and the slingshots either side of the flippers.
          for (let y = 0.5; y < 1.1; y += 0.12) { const [lx, ly] = T.P(0.15, y, 0.923); circle(lx, ly, 1, hot(Math.round(y * 10)) ? '#FFF6C8' : AR.cyan); }
          [[0.25, 0.68, AR.red], [0.47, 0.62, AR.cyan], [0.36, 0.86, AR.yellow]].forEach(([x, y, col], k) => { const [bx, by] = T.P(x, y, 0.925); if (hot(k)) circle(bx, by, 8, 'rgba(255,246,200,.25)'); circle(bx, by, 4.5, hot(k) ? '#FFF6C8' : col, 'rgba(255,255,255,.35)'); circle(bx, by, 2, hot(k) ? AR.yellow : '#15121F'); });
          T.poly([[0.12, 1.08, 0.924], [0.22, 1.08, 0.924], [0.12, 1.26, 0.924]], AR.yellow, AR.chrome, 0.8); T.poly([[0.56, 1.08, 0.924], [0.46, 1.08, 0.924], [0.56, 1.26, 0.924]], AR.yellow, AR.chrome, 0.8);
          const fl = playing ? Math.abs(Math.sin(t * 7)) * 0.12 : 0; T.line([0.2, 1.3, 0.926], [0.33, 1.4 - fl, 0.926], AR.yellow, 2.8); T.line([0.52, 1.3, 0.926], [0.39, 1.4 - fl, 0.926], AR.yellow, 2.8); T.line([0.2, 1.3, 0.927], [0.33, 1.4 - fl, 0.927], AR.red, 1);  T.line([0.52, 1.3, 0.927], [0.39, 1.4 - fl, 0.927], AR.red, 1);
          if (playing) { const [sx, sy] = T.P(0.36 + Math.sin(t * 3.1) * 0.22, 0.85 + Math.sin(t * 2.3 + 1) * 0.4, 0.93); circle(sx, sy, 2.4, '#E8EAEC'); circle(sx - 0.8, sy - 0.8, 0.9, '#FFFFFF'); }
          T.line([0.675, 1.47, 0.9], [0.675, 1.47 + (playing ? 0.05 : 0.1), 0.9], AR.red, 3); const [gx0, gy0] = T.P(0.675, 1.47 + (playing ? 0.05 : 0.1), 0.9); circle(gx0, gy0, 2, AR.red);
          // Glass glint across the field.
          T.line([0.1, 0.5, 0.95], [0.5, 1.3, 0.95], 'rgba(255,255,255,.14)', 1.2);
          // The backbox: a glowing screen with an invader, the marquee and the bulbs round the top.
          T.poly([[0.06, 0.221, 1.0], [0.69, 0.221, 1.0], [0.69, 0.221, 1.62], [0.06, 0.221, 1.62]], screenHue(t, playing), AR.chrome, 1); const [gx, gy] = T.P(0.375, 0.222, 1.36); sprite(gx, gy, 2.2, INVADER, 'rgba(0,0,0,.45)'); const [hx, hy] = T.P(0.375, 0.222, 1.1); sprite(hx, hy, 1.4, PIXHEART, 'rgba(255,255,255,.55)');
          T.poly([[0.1, 0.222, 1.66], [0.65, 0.222, 1.66], [0.65, 0.222, 1.84], [0.1, 0.222, 1.84]], AR.yellow); const [ax, ay] = T.P(0.12, 0.223, 1.75), [bx, by] = T.P(0.63, 0.223, 1.75); chaser(ax, ay, bx, by, 8, ob.id, power);
          const [cx, cy] = T.P(0.04, 0.223, 1.9), [dx, dy] = T.P(0.71, 0.223, 1.9); chaser(cx, cy, dx, dy, 9, ob.id, power); const [ex, ey] = T.P(0.751, 0.02, 1.9), [fx, fy] = T.P(0.751, 0.2, 1.9); chaser(ex, ey, fx, fy, 2, ob.id, power);
          // Side art on the cabinet and the backbox.
          T.poly([[0.751, 0.3, 0.66], [0.751, 1.4, 0.66], [0.751, 1.4, 0.88], [0.751, 0.3, 0.88]], AR.magenta); const [ix, iy] = T.P(0.752, 0.85, 0.77); sprite(ix, iy, 1.8, INVADER, AR.yellow); T.line([0.752, 0.35, 0.72], [0.752, 1.35, 0.72], AR.cyan, 1); T.line([0.752, 0.35, 0.82], [0.752, 1.35, 0.82], AR.cyan, 1);
          T.poly([[0.751, 0.02, 1.0], [0.751, 0.2, 1.0], [0.751, 0.2, 1.7], [0.751, 0.02, 1.7]], AR.magenta); const [jx, jy] = T.P(0.752, 0.11, 1.35); sprite(jx, jy, 1.2, PIXHEART, AR.yellow);
        }, { onTop: true })]; } },
    rugcloud: {
      // A cloud-shaped rug with a rainbow band across it.
      parts: (o) => [F(0, 0, 2.2, 1.6, (T) => { const c = cl(o); const blob = (x, y, rx, ry) => { const pts = []; for (let k = 0; k < 20; k++) { const a = k / 20 * Math.PI * 2; pts.push([x + Math.cos(a) * rx, y + Math.sin(a) * ry, 0.009]); } T.poly(pts, c); };
        [[1.1, 0.9, 1.0, 0.5], [0.5, 0.6, 0.48, 0.42], [1.1, 0.42, 0.6, 0.42], [1.7, 0.62, 0.48, 0.4], [0.7, 1.15, 0.5, 0.4], [1.5, 1.18, 0.55, 0.38]].forEach(([x, y, rx, ry]) => blob(x, y, rx, ry));
        CC.bands.forEach((col, k) => T.line([0.45, 0.78 + k * 0.07, 0.011], [1.75, 0.78 + k * 0.07, 0.011], col, 2.2)); }, { decal: true })] },
    rugneon: {
      // A black rug ruled in cyan and magenta, edged in neon that lights with the power.
      parts: (o) => [F(0, 0, 2.4, 1.6, (T) => { const c = cl(o); T.poly([[0, 0, 0.008], [2.4, 0, 0.008], [2.4, 1.6, 0.008], [0, 1.6, 0.008]], c); for (let x = 0.3; x < 2.4; x += 0.3) T.line([x, 0.05, 0.009], [x, 1.55, 0.009], 'rgba(25,230,240,.35)', 1); for (let y = 0.3; y < 1.6; y += 0.3) T.line([0.05, y, 0.009], [2.35, y, 0.009], 'rgba(255,46,154,.35)', 1);
        neon(T, [0.06, 0.06, 0.01], [2.34, 0.06, 0.01], NE.cyan, power); neon(T, [2.34, 0.06, 0.01], [2.34, 1.54, 0.01], NE.cyan, power); neon(T, [2.34, 1.54, 0.01], [0.06, 1.54, 0.01], NE.magenta, power); neon(T, [0.06, 1.54, 0.01], [0.06, 0.06, 0.01], NE.magenta, power); }, { decal: true })] },
    plushpile: {
      // A heap of three pastel bear plushies with a star on top.
      parts: (o) => [B(0.1, 0.1, 0, 0.6, 0.5, 0.1, '#F6EEF2'), F(0.1, 0.1, 0.7, 0.6, (T) => { const c = cl(o); [[0.3, 0.45, CC.bearBlue, 0.3], [0.55, 0.45, CC.bearYellow, -0.3], [0.42, 0.25, c, 0]].forEach(([x, y, col, rot]) => { const [px, py] = T.P(x, y, 0.14); ell(px, py + 2, 8, 6, col); ell(px - 6, py + 3, 3, 4, col, null, rot); ell(px + 6, py + 3, 3, 4, col, null, -rot); bearFace(px, py - 7, 6, col); heart(px, py + 2, 0.7, CC.pinkDeep); }); const [sx, sy] = T.P(0.42, 0.5, 0.34); star5(sx, sy, 3, CC.yellow); }, { onTop: true })] },
    serverstack: {
      // A little black server tower whose rows of lights blink with the power on.
      parts: (o) => [B(0.05, 0.05, 0, 0.35, 0.35, 0.42, cl(o)), F(0.05, 0.05, 0.4, 0.4, (T, ob, t) => { for (let z = 0.06; z < 0.4; z += 0.08) { T.line([0.06, 0.401, z], [0.39, 0.401, z], NE.steel, 1); for (let k = 0; k < 4; k++) { const [lx, ly] = T.P(0.1 + k * 0.08, 0.402, z + 0.03); const on = power && Math.floor(t * 7 + k * 3 + z * 50) % 4 !== 0; circle(lx, ly, 0.9, on ? (k % 2 ? NE.cyan : NE.magenta) : '#2A2F3A'); } } T.line([0.401, 0.06, 0.4], [0.401, 0.39, 0.4], NE.steel, 1); }, { onTop: true })] },
    cloudswing: {
      // A swing seat hanging from a cloud on a pole: the cloud bobs and glows as a lamp, hearts float up while someone swings.
      parts: (o) => { const c = cl(o); return [B(0.45, 0.02, 0, 0.3, 0.26, 0.06, CC.sky), B(0.3, 0.3, 0.42, 0.6, 0.42, 0.08, c, { name: 'seat' }),
        F(0.3, 0.3, 0.9, 0.72, (T, ob, t) => { const lit = isLit(ob.id), using = usingSlot(ob.id + ':s'), bob = Math.sin(t * 1.2) * 0.02;
          T.line([0.6, 0.15, 0.06], [0.6, 0.15, 1.75], CC.sky, 3.4); T.line([0.6, 0.15, 1.75], [0.6, 0.5, 1.78], CC.sky, 3.4);
          [[0.34, 0.34], [0.86, 0.34], [0.34, 0.68], [0.86, 0.68]].forEach(([x, y]) => T.line([x, y, 0.5], [0.6 + (x - 0.6) * 0.5, 0.5 + (y - 0.5) * 0.4, 1.74 + bob], CC.cloudShade, 1.2));
          T.line([0.3, 0.721, 0.46], [0.9, 0.721, 0.46], CC.pinkDeep, 1.2);
          const [cx, cy] = T.P(0.6, 0.5, 1.8 + bob); if (lit) ell(cx, cy + 4, 24, 12, 'rgba(255,241,201,.25)'); cloud(cx, cy, 20, lit ? '#FFFDF2' : CC.cloud); star5(cx, cy - 16, 4, lit ? CC.yellow : CC.cloudShade);
          if (using) for (let k = 0; k < 3; k++) { const ph = (t * 0.6 + k / 3) % 1; const [hx, hy] = T.P(0.6 + Math.sin(ph * 6 + k) * 0.15, 0.5, 0.8 + ph * 0.8); heart(hx, hy, 0.6 + (1 - ph) * 0.3, `rgba(238,143,174,${(1 - ph).toFixed(2)})`); }
        }, { onTop: true })]; } },
    vrpod: {
      // A reclined pod: a steel base ringed in light, a seat with armrests and a footrest, a shell with a screen panel that pulses, a headrest,
      // and a visor on an arm. While someone is in it the visor lights and a holo cube spins above. Armrests and footrest are drawn in the
      // detail part so their lights sit on top of them.
      parts: (o) => { const c = cl(o); return [B(0.1, 0.1, 0, 0.8, 1.4, 0.2, NE.steel), B(0.15, 0.45, 0.2, 0.7, 0.75, 0.25, '#1E2230', { name: 'seat' }), B(0.1, 0.05, 0.2, 0.8, 0.42, 0.78, c),
        F(0.15, 0.45, 0.85, 1.2, (T, ob, t) => { const using = usingSlot(ob.id + ':s') || live(ob.id), pulse = using ? 0.6 + Math.sin(t * 6) * 0.4 : 0;
          // Ring lights round the base and along the shell's top edge.
          neon(T, [0.1, 1.501, 0.19], [0.9, 1.501, 0.19], NE.cyan, power); neon(T, [0.901, 0.1, 0.19], [0.901, 1.5, 0.19], NE.cyan, power); neon(T, [0.1, 0.05, 0.98], [0.9, 0.05, 0.98], NE.magenta, power); neon(T, [0.9, 0.05, 0.98], [0.9, 0.47, 0.98], NE.magenta, power);
          // The screen panel on the shell, facing the seat: a cyan frame, scanlines and a pulse of light while someone is in.
          T.poly([[0.2, 0.471, 0.5], [0.8, 0.471, 0.5], [0.8, 0.471, 0.9], [0.2, 0.471, 0.9]], using && power ? hexA(NE.cyan, 0.25 + pulse * 0.2) : '#0E1016', power ? NE.cyan : NE.steel, 1); for (let z = 0.55; z < 0.9; z += 0.06) T.line([0.22, 0.472, z], [0.78, 0.472, z], 'rgba(255,255,255,.06)', 1);
          if (power) { const [ax, ay] = T.P(0.5, 0.473, 0.7); circle(ax, ay, 4, null); ctx.beginPath(); ctx.ellipse(ax, ay, 6, 3, 0, 0, Math.PI * 2); ctx.strokeStyle = using ? NE.magenta : hexA(NE.magenta, 0.5); ctx.lineWidth = 1.2; ctx.stroke(); }
          // Headrest, armrests with a glowing button each, and the footrest.
          T.box(0.3, 0.1, 0.98, 0.4, 0.3, 0.12, '#1E2230'); T.line([0.3, 0.401, 1.04], [0.7, 0.401, 1.04], NE.steel, 1);
          T.box(0.1, 0.45, 0.45, 0.1, 0.7, 0.12, c); T.box(0.8, 0.45, 0.45, 0.1, 0.7, 0.12, c); [[0.15, 1.0], [0.85, 1.0]].forEach(([x, y], k) => { const [bx, by] = T.P(x, y, 0.575); circle(bx, by, 1.8, power ? (k ? NE.magenta : NE.cyan) : '#2A2F3A'); if (power) circle(bx, by, 3.5, hexA(k ? NE.magenta : NE.cyan, 0.25)); });
          T.box(0.25, 1.2, 0.2, 0.5, 0.25, 0.12, '#1E2230'); for (let x = 0.3; x < 0.75; x += 0.1) T.line([x, 1.451, 0.22], [x, 1.451, 0.3], NE.steel, 1);
          // The visor on its arm over the seat.
          T.line([0.5, 0.3, 1.1], [0.5, 0.72, 1.28], NE.steel, 2.6); const [vx, vy] = T.P(0.5, 0.75, 1.24); ell(vx, vy, 8, 4.5, '#111118', NE.steel); ell(vx, vy, 6, 2.4, using && power ? NE.cyan : '#2A2F3A'); if (using && power) ell(vx, vy + 6, 9, 4, hexA(NE.cyan, 0.2));
          // Side vents on the shell.
          for (let y = 0.12; y < 0.44; y += 0.08) T.line([0.901, y, 0.4], [0.901, y + 0.04, 0.72], 'rgba(255,255,255,.1)', 1.2);
          // The holo cube.
          if (using && power) { const [hx, hy] = T.P(0.5, 0.8, 1.75); circle(hx, hy, 14, hexA(NE.cyan, 0.12 + pulse * 0.1)); const a = t * 2, r = 7; [[0, NE.cyan], [-8, NE.magenta]].forEach(([dy, col]) => { ctx.beginPath(); for (let k = 0; k <= 4; k++) { const ang = a + k * Math.PI / 2; const x = hx + Math.cos(ang) * r, y = hy + dy + Math.sin(ang) * r * 0.5; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.strokeStyle = col; ctx.lineWidth = 1.3; ctx.stroke(); }); for (let k = 0; k < 4; k++) { const ang = a + k * Math.PI / 2; limb(hx + Math.cos(ang) * r, hy + Math.sin(ang) * r * 0.5, hx + Math.cos(ang) * r, hy - 8 + Math.sin(ang) * r * 0.5, hexA(NE.cyan, 0.7), 1); } }
        }, { onTop: true })]; } },
    ruggothic: {
      // An oxblood rug with an ebony border and brass damask motifs.
      parts: (o) => [F(0, 0, 2.4, 1.6, (T) => { const c = cl(o); T.poly([[0, 0, 0.008], [2.4, 0, 0.008], [2.4, 1.6, 0.008], [0, 1.6, 0.008]], GO.ebony); T.poly([[0.12, 0.12, 0.009], [2.28, 0.12, 0.009], [2.28, 1.48, 0.009], [0.12, 1.48, 0.009]], c); T.poly([[0.2, 0.2, 0.0095], [2.2, 0.2, 0.0095], [2.2, 1.4, 0.0095], [0.2, 1.4, 0.0095]], null, GO.brass, 1);
        for (let y = 0.5, r = 0; y < 1.3; y += 0.4, r++) for (let x = 0.5 + (r % 2) * 0.3; x < 2.0; x += 0.6) { T.poly([[x, y - 0.14, 0.01], [x + 0.08, y, 0.01], [x, y + 0.14, 0.01], [x - 0.08, y, 0.01]], GO.brass); const [sx, sy] = T.P(x, y, 0.01); ell(sx - 6, sy, 2, 4, GO.brass, null, 0.5); ell(sx + 6, sy, 2, 4, GO.brass, null, -0.5); } }, { decal: true })] },
    rugcandy: {
      // A round lollipop rug: pink and white rings with a swirl.
      parts: (o) => [F(0, 0, 1.8, 1.8, (T) => { const c = cl(o); [[0.9, c], [0.72, '#FFFFFF'], [0.54, c], [0.36, '#FFFFFF'], [0.18, c]].forEach(([r, col]) => { const pts = []; for (let k = 0; k < 28; k++) { const a = k / 28 * Math.PI * 2; pts.push([0.9 + Math.cos(a) * r, 0.9 + Math.sin(a) * r, 0.009]); } T.poly(pts, col); });
        const sw = []; for (let a = 0; a < Math.PI * 6; a += 0.2) sw.push(T.P(0.9 + Math.cos(a) * a * 0.045, 0.9 + Math.sin(a) * a * 0.045, 0.01)); ctx.beginPath(); sw.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.strokeStyle = CA.cherry; ctx.lineWidth = 1.4; ctx.stroke(); }, { decal: true })] },
    rugtropical: {
      // A cream rug with a pink border and big monstera leaves.
      parts: (o) => [F(0, 0, 2.4, 1.6, (T) => { const c = cl(o); T.poly([[0, 0, 0.008], [2.4, 0, 0.008], [2.4, 1.6, 0.008], [0, 1.6, 0.008]], c); T.poly([[0.1, 0.1, 0.009], [2.3, 0.1, 0.009], [2.3, 1.5, 0.009], [0.1, 1.5, 0.009]], null, TR.pink, 2.2);
        [[0.6, 0.6, TR.leaf, 0.3], [1.3, 1.0, TR.leafLight, -0.4], [1.9, 0.5, TR.leaf, 0.9], [0.9, 1.25, TR.leafLight, 2.2]].forEach(([x, y, col, rot]) => { const [sx, sy] = T.P(x, y, 0.01); monstera(sx, sy, 11, col, c, rot); }); }, { decal: true })] },
    grimoires: {
      // Three dark tomes with brass clasps, and a quill.
      parts: (o) => [B(0.02, 0.04, 0, 0.36, 0.28, 0.08, cl(o)), B(0.05, 0.03, 0.08, 0.34, 0.27, 0.07, '#2E3B57'), B(0.0, 0.05, 0.15, 0.36, 0.26, 0.08, GO.ebony),
        F(0.0, 0.03, 0.38, 0.33, (T) => { [[0.04, 0.38], [0.11, 0.39], [0.19, 0.36]].forEach(([z, x]) => { T.line([x, 0.05, z], [x, 0.3, z], GO.brass, 2); const [bx, by] = T.P(x, 0.18, z); circle(bx, by, 1.2, GO.brassLight); }); T.line([0.02, 0.321, 0.02], [0.02, 0.321, 0.22], GO.brassLight, 1); const [qx, qy] = T.P(0.3, 0.1, 0.23); limb(qx, qy, qx + 6, qy - 14, '#F6EFE0', 1.2); ell(qx + 5, qy - 12, 2.2, 6, '#F6EFE0', null, 0.4); }, { onTop: true })] },
    candyjars: {
      // Three glass jars of sweets with pink lids.
      parts: (o) => [B(0.0, 0.04, 0, 0.5, 0.32, 0.03, '#FFFFFF'), F(0.0, 0.04, 0.5, 0.36, (T) => { const c = cl(o); [[0.06, 0.08, 0.3, CA.cherry], [0.22, 0.1, 0.22, CA.mint], [0.36, 0.08, 0.26, CA.lilac]].forEach(([x, y, h, col]) => { T.box(x, y, 0.03, 0.13, 0.13, h, 'rgba(225,240,250,.55)'); for (let k = 0; k < 5; k++) { const [px, py] = T.P(x + 0.03 + (k % 3) * 0.04, y + 0.131, 0.07 + Math.floor(k / 3) * 0.06 + (k % 2) * 0.02); circle(px, py, 1.5, [col, CA.butter, c][k % 3]); } T.box(x - 0.01, y - 0.01, 0.03 + h, 0.15, 0.15, 0.03, c); }); }, { onTop: true })] },
    coconuts: {
      // Two coconut drinks with straws and paper umbrellas.
      parts: (o) => [B(0.05, 0.05, 0, 0.4, 0.3, 0.02, TR.rattan), F(0.05, 0.05, 0.45, 0.35, (T) => { const c = cl(o); [[0.16, 0.2, 0.3], [0.34, 0.18, -0.3]].forEach(([x, y, lean], k) => { const [px, py] = T.P(x, y, 0.12); ell(px, py, 7, 6, c, 'rgba(0,0,0,.2)'); ell(px, py - 4, 5, 2.5, '#F7F1E3'); limb(px + 2, py - 4, px + 4 + lean * 6, py - 16, k ? TR.pink : TR.coral, 1.4); ctx.beginPath(); ctx.moveTo(px - 3 - lean * 10, py - 14); ctx.lineTo(px - 11 - lean * 10, py - 10); ctx.lineTo(px + 5 - lean * 10, py - 10); ctx.closePath(); ctx.fillStyle = k ? CA.butter : TR.pink; ctx.fill(); limb(px - 3 - lean * 10, py - 14, px - 3 - lean * 10, py - 6, '#F7F1E3', 1); }); }, { onTop: true })] },
    fortuneteller: {
      // A fortune-telling machine: an oxblood cabinet with brass trim, a glass case with a turbaned teller over a crystal ball that glows
      // while someone asks, and a card that drops from the slot.
      parts: (o) => { const c = cl(o); return [B(0, 0, 0, 0.8, 0.6, 0.9, c), B(0.05, 0.05, 0.9, 0.7, 0.5, 0.8, 'rgba(180,230,255,.14)'), B(0, 0, 1.7, 0.8, 0.6, 0.2, GO.brass),
        F(0, 0, 0.8, 0.6, (T, ob, t) => { const asking = usingSlot(ob.id + ':f') || live(ob.id), glow = power ? (asking ? 0.5 + Math.sin(t * 5) * 0.3 : 0.2) : 0;
          T.line([0, 0.601, 0.9], [0.8, 0.601, 0.9], GO.brass, 1.6); T.line([0, 0.601, 0.05], [0.8, 0.601, 0.05], GO.brass, 1.6); [[0.05, 0.05], [0.75, 0.05], [0.05, 0.55], [0.75, 0.55]].forEach(([x, y]) => T.line([x, y, 0.9], [x, y, 1.7], GO.brass, 1.4));
          const [ax, ay] = T.P(0.4, 0.601, 0.5); arch(ax, ay, 9, 18, null, GO.brass, 1); T.poly([[0.28, 0.602, 0.22], [0.52, 0.602, 0.22], [0.52, 0.602, 0.26], [0.28, 0.602, 0.26]], GO.ebony); if (asking) T.poly([[0.32, 0.603, 0.14], [0.48, 0.603, 0.14], [0.48, 0.603, 0.24], [0.32, 0.603, 0.24]], '#F6EFE0');
          const [bx, by] = T.P(0.4, 0.42, 1.0); if (glow) circle(bx, by - 2, 12, `rgba(201,162,74,${glow.toFixed(2)})`); circle(bx, by - 2, 6, power ? '#E8DCC8' : '#8E8A84'); circle(bx - 2, by - 4, 2, 'rgba(255,255,255,.7)'); ell(bx, by + 4, 7, 2.5, GO.brass);
          const [hx, hy] = T.P(0.4, 0.3, 1.42); ell(hx, hy + 10, 11, 9, GO.oxblood); ell(hx, hy, 6, 7, '#C68E62'); ell(hx, hy - 7, 8, 5, '#2E4C9A'); circle(hx, hy - 10, 2, GO.brass); limb(hx - 4, hy + 2, hx + 4, hy + 2, '#2A2224', 1.4); circle(hx - 2.5, hy - 1, 0.8, '#2A2224'); circle(hx + 2.5, hy - 1, 0.8, '#2A2224');
          const sway = asking ? Math.sin(t * 4) * 3 : 0; ell(bx - 9 + sway, by - 6, 3, 2, '#C68E62'); ell(bx + 9 - sway, by - 6, 3, 2, '#C68E62');
          const [mx, my] = T.P(0.4, 0.601, 1.8); sunburst(mx, my + 2, 10, 7, GO.brassLight, 1); for (let k = 0; k < 5; k++) { const [sx, sy] = T.P(0.1 + k * 0.15, 0.601, 1.75); star5(sx, sy, 2, power && (Math.floor(t * 4) + k) % 2 ? '#FFF1C9' : GO.ebony); }
        }, { onTop: true })]; } },
    gumball: {
      // A gumball machine: a red base with a chrome dial, a glass globe full of gumballs and a chrome cap; a gumball rattles down the chute when used.
      parts: (o) => { const c = cl(o); return [B(0.1, 0.1, 0, 0.3, 0.3, 0.5, c), F(0.1, 0.1, 0.4, 0.4, (T, ob, t) => { const using = usingSlot(ob.id + ':g') || live(ob.id);
          T.line([0.1, 0.401, 0.48], [0.4, 0.401, 0.48], '#B9BEC3', 1.4); const [dx, dy] = T.P(0.25, 0.402, 0.3); circle(dx, dy, 3.5, '#B9BEC3'); limb(dx - 2.5, dy, dx + 2.5, dy, '#6B7078', 1.4); T.poly([[0.18, 0.402, 0.1], [0.32, 0.402, 0.1], [0.32, 0.402, 0.2], [0.18, 0.402, 0.2]], '#2B2B30'); if (using) { const [gx, gy] = T.P(0.25, 0.403, 0.15 - ((t * 2) % 1) * 0.08); circle(gx, gy, 2, [CA.cherry, CA.mint, CA.lilac, CA.butter][Math.floor(t) % 4]); }
          const [px, py] = T.P(0.25, 0.25, 0.78); circle(px, py, 15, 'rgba(225,240,250,.45)', 'rgba(255,255,255,.7)'); for (let k = 0; k < 22; k++) { const a = k * 2.4, r = 3 + (k * 0.618 % 1) * 9, jig = using ? Math.sin(t * 20 + k) * 0.8 : 0; circle(px + Math.cos(a) * r, py + Math.sin(a) * r * 0.9 + 2 + jig, 2.2, [CA.cherry, CA.mint, CA.lilac, CA.butter, CA.sky, CA.pinkDeep][k % 6]); } circle(px - 5, py - 6, 3, 'rgba(255,255,255,.5)');
          const [tx, ty] = T.P(0.25, 0.25, 1.12); ell(tx, ty, 6, 3, '#B9BEC3'); ell(tx, ty - 3, 3, 2.5, c);
        }, { onTop: true })]; } },
    tikibar: {
      // A tiki bar: a bamboo counter under a thatched roof on bamboo posts, bottles on the back shelf, a blender, and a torch at each end that
      // flickers with the power on. Someone stands at the front to mix a drink.
      parts: (o) => { const c = cl(o); return [B(0, 0, 0, 2.0, 0.8, 0.9, c), B(-0.1, -0.05, 1.7, 2.2, 0.9, 0.2, TR.rattan),
        F(0, 0, 2.0, 0.8, (T, ob, t) => { const mixing = usingSlot(ob.id + ':t') || live(ob.id);
          for (let x = 0.04; x < 2.0; x += 0.08) bambooPole(T, [x, 0.801, 0.03], [x, 0.801, 0.86], 2.4, shade(c, (Math.round(x * 25) % 3) * 0.04 - 0.04)); T.line([0, 0.802, 0.3], [2.0, 0.802, 0.3], TR.teak, 1.6); T.line([0, 0.802, 0.62], [2.0, 0.802, 0.62], TR.teak, 1.6);
          T.box(-0.05, -0.04, 0.9, 2.1, 0.88, 0.06, TR.teak); bambooPole(T, [0.08, 0.08, 0.96], [0.08, 0.08, 1.7], 4); bambooPole(T, [1.92, 0.08, 0.96], [1.92, 0.08, 1.7], 4);
          fringe(T, [-0.1, 0.851, 1.7], [2.1, 0.851, 1.7], 44, 0.14, TR.bambooDark); fringe(T, [2.101, -0.05, 1.7], [2.101, 0.85, 1.7], 18, 0.14, TR.bambooDark); for (let k = 0; k < 6; k++) T.line([-0.1, -0.05 + k * 0.17, 1.901], [2.1, -0.05 + k * 0.17, 1.901], 'rgba(90,60,30,.25)', 1);
          [[0.3, TR.pink], [0.5, TR.leafLight], [0.7, CA.butter], [0.9, TR.coral], [1.1, TR.cream]].forEach(([x, col]) => { T.box(x, 0.06, 0.96, 0.1, 0.1, 0.26, col); T.box(x + 0.03, 0.09, 1.22, 0.04, 0.04, 0.08, '#2B2B30'); });
          T.box(1.45, 0.35, 0.96, 0.22, 0.22, 0.12, '#2B2B30'); T.box(1.47, 0.37, 1.08, 0.18, 0.18, 0.3, 'rgba(225,240,250,.5)'); if (mixing) { const [jx, jy] = T.P(1.56, 0.46, 1.22); for (let k = 0; k < 6; k++) circle(jx + Math.cos(t * 30 + k) * 3, jy + Math.sin(t * 30 + k) * 2, 1.4, k % 2 ? TR.pink : CA.butter); }
          const [px, py] = T.P(1.0, 0.4, 0.96); ell(px, py - 7, 5, 7, '#E3B23C'); [[-3, -0.4], [0, 0], [3, 0.4]].forEach(([dx, rot]) => ell(px + dx, py - 18, 1.6, 5, TR.leaf, null, rot));
          [[-0.08, 0.9], [2.08, 0.9]].forEach(([x, y], k) => { bambooPole(T, [x, y, 0.0], [x, y, 1.4], 3); const [fx, fy] = T.P(x, y, 1.42); if (power) { const fl = Math.sin(t * 9 + k * 2) * 1.2; ell(fx, fy - 5, 3 + fl * 0.3, 7 + fl, 'rgba(255,170,60,.95)'); ell(fx, fy - 4, 1.5, 3.5, 'rgba(255,246,210,.95)'); ell(fx, fy - 4, 12, 12, 'rgba(255,190,90,.14)'); } else ell(fx, fy - 2, 2, 2.5, '#2B2B30'); });
        }, { onTop: true })]; } },
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
    starprojector: {
      // A little dome of a star projector, pierced with stars. Switched on it glows violet, turns slowly, and throws drifting
      // constellations across the back walls while the room dims (see drawStarfield). Small, so it sits on a table; on the
      // floor it has a pearl stand of its own.
      parts: (o) => [F(0, 0, 0.3, 0.3, (T, ob, t) => { const c = cl(o), on = isLit(ob.id), z0 = ob.on ? 0 : 0.5;
        if (!ob.on) { const [sx, sy] = T.P(0.15, 0.15, 0); ell(sx, sy, 8, 4, CE.pearlShade); T.line([0.15, 0.15, 0], [0.15, 0.15, z0], CE.gold, 2); T.box(0.04, 0.04, z0 - 0.02, 0.22, 0.22, 0.02, CE.pearl); }
        T.box(0.06, 0.06, z0, 0.18, 0.18, 0.06, c); const [dx, dy] = T.P(0.15, 0.15, z0 + 0.06);
        if (on) circle(dx, dy - 6, 16, 'rgba(170,150,255,.22)');
        ctx.beginPath(); ctx.ellipse(dx, dy, 9, 4.5, 0, Math.PI, 0); ctx.bezierCurveTo(dx + 9, dy - 13, dx - 9, dy - 13, dx - 9, dy); ctx.fillStyle = on ? '#3A2E7A' : CE.navy; ctx.fill();
        for (let k = 0; k < 6; k++) { const a = k * 1.05 + (on ? t * 0.6 : 0); const px = dx + Math.cos(a) * 6, py = dy - 5 + Math.sin(a) * 2.5 - Math.abs(Math.cos(a)) * 2; if (Math.sin(a) > -0.3) star4(px, py, 1.4, on ? '#FFF6C8' : '#8A86B0'); }
      })],
    },
    shishiodoshi: {
      // A shishi-odoshi on a bed of river pebbles: water runs from a bamboo spout into a pivoting bamboo arm, which fills,
      // tips, spills into a stone basin and knocks back against a rock with a "tok".
      parts: (o) => [F(0, 0, 0.9, 0.7, (T, ob, t) => { const CYC = 4, ph = ((t + (ob.x * 7 % 3)) % CYC) / CYC, tip = ph > 0.86 ? Math.sin((ph - 0.86) / 0.14 * Math.PI) : 0, fill = Math.min(1, ph / 0.86);
        T.poly([[0, 0, 0.01], [0.9, 0, 0.01], [0.9, 0.7, 0.01], [0, 0.7, 0.01]], '#C9C2B4', 'rgba(0,0,0,.1)', 0.6); for (let k = 0; k < 30; k++) { const [px, py] = T.P(0.05 + ((k * 0.618) % 1) * 0.8, 0.05 + ((k * 0.382) % 1) * 0.6, 0.012); ell(px, py, 2.2, 1.3, ['#9A948A', '#B4AFA6', '#7E786E'][k % 3]); }
        const [rx, ry] = T.P(0.2, 0.3, 0.1); ell(rx, ry, 9, 6, '#8E8A84', '#6E6A64'); const [mx, my] = T.P(0.2, 0.3, 0.17); ell(mx, my, 5, 2.4, RY.moss);
        const [px, py] = T.P(0.65, 0.4, 0.05); ell(px, py, 14, 7, '#7E786E'); ell(px, py - 2, 11, 5, '#5E6A70'); ell(px - 2, py - 3, 4, 1.4, 'rgba(255,255,255,.35)');
        T.line([0.85, 0.15, 0.0], [0.85, 0.15, 0.7], '#7FA06A', 4); T.line([0.85, 0.15, 0.7], [0.62, 0.3, 0.62], '#7FA06A', 3);
        const [wx, wy] = T.P(0.62, 0.3, 0.6); limb(wx, wy, wx - 1, wy + 8, 'rgba(160,200,220,.85)', 1.2);
        // The rocking arm: pivot posts, then the tube tilted by how far the cycle has gone.
        [0.38, 0.48].forEach((y) => T.line([0.45, y, 0], [0.45, y, 0.32], '#6E8F5A', 2.4)); const piv = T.P(0.45, 0.43, 0.3), a = -0.35 + fill * 0.15 + tip * 0.85;
        const L = 20, ex = piv[0] + Math.cos(Math.PI + a) * L, ey = piv[1] + Math.sin(Math.PI + a) * L * 0.7 - 6, bx = piv[0] - Math.cos(Math.PI + a) * L * 0.6, by = piv[1] - Math.sin(Math.PI + a) * L * 0.42;
        limb(bx, by, ex, ey, '#8DB06E', 4); limb(bx, by, ex, ey, '#A9C88A', 1.6); ell(ex, ey, 2.6, 2.2, '#5E7E4E');
        if (tip > 0.2) { for (let k = 0; k < 4; k++) circle(ex + k * 2, ey + 4 + k * 3, 1.2, 'rgba(160,200,220,.85)'); }
        if (ph < 0.12) { ctx.save(); ctx.globalAlpha = 1 - ph / 0.12; ctx.font = '700 9px Inter, system-ui, sans-serif'; ctx.fillStyle = '#4A3A2A'; ctx.textAlign = 'center'; ctx.fillText('tok', bx, by - 10 - ph * 60); ctx.restore(); }
      }, { onTop: true })],
    },
    tallcandelabra: {
      // A tall brass candelabra with five candles on scrolled arms. Lit or snuffed one candle after another.
      parts: (o) => [F(0, 0, 0.45, 0.45, (T, ob, t) => { const n = candlesLitCount(ob.id, t);
        const [bx, by] = T.P(0.225, 0.225, 0); ell(bx, by, 9, 4.5, VI.brass, shade(VI.brass, -0.3)); T.line([0.225, 0.225, 0.02], [0.225, 0.225, 1.45], VI.brass, 3); [0.5, 1.0].forEach((z) => { const [kx, ky] = T.P(0.225, 0.225, z); ell(kx, ky, 4, 2.4, VI.brass); });
        const arms = [[0.225, -0.18], [0.225, -0.09], [0.225, 0], [0.225, 0.09], [0.225, 0.18]];
        arms.forEach(([x, dy], k) => { const y = 0.225 + dy, z = 1.45 + (k === 2 ? 0.12 : Math.abs(k - 2) === 1 ? 0.05 : 0);
          if (k !== 2) { const [ax, ay] = T.P(0.225, 0.225, 1.4), [cx2, cy2] = T.P(x, y, z); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo((ax + cx2) / 2, ay + 6, cx2, cy2); ctx.strokeStyle = VI.brass; ctx.lineWidth = 1.8; ctx.stroke(); }
          const [cx, cy] = T.P(x, y, z); ell(cx, cy, 3, 1.4, VI.brass); rr(cx - 1.4, cy - 9, 2.8, 9, 0.8, '#F6EEDC');
          const lit = [2, 1, 3, 0, 4].indexOf(k) < n;
          if (lit) { circle(cx, cy - 11, 6, 'rgba(255,200,120,.25)'); ell(cx, cy - 11 + Math.sin(t * 8 + k) * 0.4, 1.3, 2.6, '#FFC861'); }
          else { limb(cx, cy - 9, cx, cy - 10, '#2A2224', 0.8); if (candleSmoke(ob.id, t, k)) { ctx.save(); ctx.globalAlpha = 0.4; limb(cx, cy - 11, cx + Math.sin(t * 3 + k) * 2, cy - 18, '#BBB4AC', 1); ctx.restore(); } } });
      })],
    },
    woodstove: {
      // A black cast-iron stove on stone hearth tiles, a glass door, a flue pipe up to the ceiling and a log basket.
      // Lit, flames dance behind the glass, embers glow, sparks rise from the flue collar and the room warms orange.
      parts: (o) => [F(0, 0, 0.9, 0.8, (T, ob, t) => { const lit = isLit(ob.id), fl = Math.sin(t * 9) * 0.5 + Math.sin(t * 13.7) * 0.3;
        T.box(0, 0, 0, 0.9, 0.8, 0.05, AL.stoneDark); for (let k = 1; k < 3; k++) T.line([k * 0.3, 0, 0.051], [k * 0.3, 0.8, 0.051], 'rgba(0,0,0,.25)', 0.8);
        [[0.18, 0.2], [0.62, 0.2], [0.18, 0.5], [0.62, 0.5]].forEach(([x, y]) => T.box(x, y, 0.05, 0.05, 0.05, 0.12, AL.iron));
        T.box(0.16, 0.18, 0.17, 0.52, 0.38, 0.5, AL.iron); T.box(0.14, 0.16, 0.67, 0.56, 0.42, 0.04, '#3A3634');
        T.poly([[0.24, 0.561, 0.24], [0.6, 0.561, 0.24], [0.6, 0.561, 0.58], [0.24, 0.561, 0.58]], lit ? '#3A1A0A' : '#1A1816', '#5A5450', 1.6);
        // The fire stays behind the glass: everything is clipped to the door.
        if (lit) { const door = [[0.24, 0.562, 0.24], [0.6, 0.562, 0.24], [0.6, 0.562, 0.58], [0.24, 0.562, 0.58]].map((p) => T.P(...p)), [fx, fy] = T.P(0.42, 0.562, 0.28);
          ctx.save(); ctx.beginPath(); door.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath(); ctx.clip();
          ell(fx, fy + 1, 9, 3, '#C2410C'); ctx.globalAlpha = 0.9; ell(fx, fy - 5 - fl * 1.5, 5, 6 + fl * 1.5, '#F28C28'); ell(fx - 3, fy - 3, 3, 4, '#FFC861'); ell(fx + 3, fy - 2 + fl, 2.4, 3.5, '#FFD98A'); ctx.restore();
          if ((t * 3) % 1 < 0.5) { const [sx, sy] = T.P(0.42, 0.37, 0.75 + ((t * 0.8) % 1) * 0.4); circle(sx + Math.sin(t * 7) * 3, sy, 1, '#FFB347'); } }
        T.line([0.42, 0.37, 0.71], [0.42, 0.37, 2.6], AL.iron, 5); T.line([0.42, 0.37, 0.95], [0.42, 0.37, 0.98], '#4A4644', 7);
        const [bx, by] = T.P(0.8, 0.65, 0); ell(bx, by - 4, 9, 4, '#7A5A3A'); [[-4, -8], [2, -9], [-1, -12]].forEach(([dx, dy]) => { limb(bx + dx - 4, by + dy, bx + dx + 5, by + dy - 3, AL.logDark, 3.5); circle(bx + dx + 5, by + dy - 3, 1.8, AL.logEnd); });
      })],
    },
    glamtable: {
      // A Hollywood dressing table: a blush-skirted table with a gold-legged stool, a tall mirror ringed with round bulbs.
      // Tapped, the bulbs light one after another until all are on; getting glam, they blaze and sparkles flash round it.
      parts: (o) => [F(0, 0, 1.1, 0.5, (T, ob, t) => { const c = cl(o), on = isLit(ob.id), glam = usingSlot(ob.id + ':g'), chase = live(ob.id);
        T.box(0.02, 0.02, 0, 1.06, 0.44, 0.72, c); for (let k = 0; k <= 14; k++) T.line([0.04 + k * 0.073, 0.461, 0.02], [0.04 + k * 0.073, 0.461, 0.7], 'rgba(255,255,255,.3)', 1); T.box(0, 0, 0.72, 1.1, 0.48, 0.04, RG.white); T.line([0, 0.481, 0.74], [1.1, 0.481, 0.74], RG.gold, 1.4);
        T.box(0.2, 0.06, 0.76, 0.7, 0.06, 0.95, RG.white); T.poly([[0.27, 0.121, 0.83], [0.83, 0.121, 0.83], [0.83, 0.121, 1.64], [0.27, 0.121, 1.64]], RG.mirror, RG.mirrorDark, 1); T.line([0.35, 0.122, 0.95], [0.5, 0.122, 1.5], 'rgba(255,255,255,.75)', 1.6);
        const bulbs = []; for (let k = 0; k <= 4; k++) bulbs.push([0.23, 0.83 + k * 0.2], [0.87, 0.83 + k * 0.2]); for (let k = 1; k < 4; k++) bulbs.push([0.23 + k * 0.16, 1.68]);
        const lit = chase ? Math.floor((t * 6) % (bulbs.length + 4)) : on || glam ? bulbs.length : 0;
        bulbs.forEach(([x, z], k) => { const [bx, by] = T.P(x, 0.125, z), b = k < lit; if (b) circle(bx, by, glam ? 7 : 5, 'rgba(255,236,190,.35)'); circle(bx, by, 2.6, b ? '#FFF7E0' : '#E8E2D6', b ? null : 'rgba(0,0,0,.2)'); });
        T.box(0.3, 0.3, 0.76, 0.1, 0.08, 0.06, RG.gold); T.box(0.75, 0.25, 0.76, 0.06, 0.06, 0.1, '#F2C4CE'); const [px, py] = T.P(0.6, 0.3, 0.77); ell(px, py, 4, 2, RG.gold);
        if (glam) for (let k = 0; k < 5; k++) { const a = (t * 1.5 + k * 1.3) % 6.28, [sx, sy] = T.P(0.55 + Math.cos(a) * 0.45, 0.4, 1.2 + Math.sin(a * 1.3) * 0.4); ctx.fillStyle = '#FFF7C8'; ctx.beginPath(); ctx.moveTo(sx, sy - 4); ctx.lineTo(sx + 1, sy - 1); ctx.lineTo(sx + 4, sy); ctx.lineTo(sx + 1, sy + 1); ctx.lineTo(sx, sy + 4); ctx.lineTo(sx - 1, sy + 1); ctx.lineTo(sx - 4, sy); ctx.lineTo(sx - 1, sy - 1); ctx.closePath(); ctx.fill(); }
      }),
      F(0.35, 0.55, 0.75, 0.9, (T, ob) => { const c = cl(o); [[0.42, 0.62], [0.68, 0.62], [0.42, 0.84], [0.68, 0.84]].forEach(([x, y]) => T.line([x, y, 0], [x, y, 0.42], RG.gold, 1.8)); const [sx, sy] = T.P(0.55, 0.73, 0.46); ell(sx, sy, 11, 6, shade(c, -0.08), 'rgba(0,0,0,.15)'); ell(sx, sy - 1, 9, 4.5, c); })],
    },
    hificonsole: {
      // A long walnut hi-fi on splayed legs: woven speaker grilles either end, a turntable under a smoked lid in the middle.
      // Playing, the lid lifts, the record spins, notes rise, and its amber light comes on and fills the room.
      parts: (o) => [F(0, 0, 1.8, 0.5, (T, ob, t) => { const c = cl(o), playing = usingSlot(ob.id + ':r') || live(ob.id);
        if (playing && objectLights.get(ob.id) !== true) objectLights.set(ob.id, true);
        taperLegs(T, [[0.1, 0.08, -0.04, -0.04], [1.7, 0.08, 0.04, -0.04], [0.1, 0.42, -0.04, 0.04], [1.7, 0.42, 0.04, 0.04]], 0.18, MC.walnutDark);
        T.box(0, 0, 0.18, 1.8, 0.5, 0.5, c);
        [[0.04, 0.5], [1.3, 1.76]].forEach(([a, b]) => { T.poly([[a, 0.501, 0.22], [b, 0.501, 0.22], [b, 0.501, 0.64], [a, 0.501, 0.64]], MC.cane); for (let x = a + 0.03; x < b; x += 0.04) T.line([x, 0.502, 0.22], [x, 0.502, 0.64], 'rgba(120,80,30,.3)', 0.7); });
        T.poly([[0.55, 0.501, 0.3], [1.25, 0.501, 0.3], [1.25, 0.501, 0.6], [0.55, 0.501, 0.6]], shade(c, -0.15)); [0.75, 0.9, 1.05].forEach((x) => { const [kx, ky] = T.P(x, 0.502, 0.45); circle(kx, ky, 2.4, MC.chrome); });
        T.box(-0.01, -0.01, 0.68, 1.82, 0.52, 0.02, MC.walnutLite);
        const [px, py] = T.P(0.9, 0.25, 0.71), spin = playing ? t * 4 : 0; ell(px, py, 13, 6, '#1B1A1F'); ell(px, py, 4, 2, MC.orange); limb(px + Math.cos(spin) * 9, py + Math.sin(spin) * 4, px + Math.cos(spin) * 5, py + Math.sin(spin) * 2, 'rgba(255,255,255,.35)', 1);
        const [ax, ay] = T.P(1.15, 0.1, 0.72); limb(ax, ay, px + 6, py - 2, MC.chrome, 1.4);
        const lid = playing ? 0.28 : 0.06; T.poly([[0.6, 0.02, 0.7], [1.2, 0.02, 0.7], [1.2, 0.02 + (0.46 - lid * 1.4), 0.7 + lid], [0.6, 0.02 + (0.46 - lid * 1.4), 0.7 + lid]], 'rgba(60,50,45,.28)', 'rgba(60,50,45,.5)', 0.8);
        if (playing) { ctx.save(); ctx.font = '700 9px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; for (let k = 0; k < 3; k++) { const u = (t * 0.6 + k / 3) % 1; ctx.globalAlpha = Math.sin(u * Math.PI); ctx.fillStyle = [MC.mustard, MC.orange, MC.teal][k]; ctx.fillText(k % 2 ? '♫' : '♪', px - 8 + k * 8, py - 10 - u * 24); } ctx.restore(); }
      })],
    },
    musicbox: {
      // A painted music box; wound or tapped, the lid opens, a little dancer turns and notes float up. Small, so it sits on a
      // table; on the floor it has a painted stand of its own.
      parts: (o) => [F(0, 0, 0.32, 0.26, (T, ob, t) => { const c = cl(o), z0 = ob.on ? 0 : 0.6, playing = live(ob.id) || usingSlot(ob.id + ':m');
        if (!ob.on) { [[0.05, 0.04], [0.27, 0.04], [0.05, 0.22], [0.27, 0.22]].forEach(([x, y]) => T.line([x, y, 0], [x, y, z0], CO.cream, 2)); T.box(0.02, 0.02, z0 - 0.03, 0.28, 0.22, 0.03, CO.cream); }
        T.box(0.04, 0.03, z0, 0.24, 0.2, 0.1, c); T.line([0.04, 0.231, z0 + 0.05], [0.28, 0.231, z0 + 0.05], '#C9A24A', 1);
        ditsy(T, 0.06, 0.26, 0.232, z0 + 0.02, z0 + 0.09, 6);
        if (playing) { T.poly([[0.04, 0.03, z0 + 0.1], [0.28, 0.03, z0 + 0.1], [0.28, 0.03, z0 + 0.3], [0.04, 0.03, z0 + 0.3]], shade(c, -0.1), 'rgba(0,0,0,.2)', 0.8); T.poly([[0.07, 0.035, z0 + 0.12], [0.25, 0.035, z0 + 0.12], [0.25, 0.035, z0 + 0.28], [0.07, 0.035, z0 + 0.28]], '#DCE6EC');
          const [dx, dy] = T.P(0.16, 0.13, z0 + 0.1), sp = t * 3, w = Math.cos(sp); limb(dx, dy, dx, dy - 11, '#F6E0D8', 1.6); ell(dx, dy - 6, 6 * Math.abs(w) + 1.5, 2.4, CO.rose); circle(dx, dy - 13, 2.3, '#F6E0D8'); limb(dx, dy - 10, dx + 4.5 * w, dy - 15, '#F6E0D8', 1.1); limb(dx, dy - 10, dx - 4.5 * w, dy - 15, '#F6E0D8', 1.1);
          ctx.save(); ctx.font = '600 9px system-ui, sans-serif'; ctx.textAlign = 'center'; for (let k = 0; k < 3; k++) { const a = ((t * 0.5 + k / 3) % 1); ctx.globalAlpha = Math.sin(a * Math.PI); ctx.fillStyle = PATCH[k]; ctx.fillText(k % 2 ? '♫' : '♪', dx + Math.sin(a * 6 + k) * 8, dy - 14 - a * 26); } ctx.restore(); }
        else T.box(0.04, 0.03, z0 + 0.1, 0.24, 0.2, 0.025, shade(c, 0.08));
      })],
    },
    servicebell: {
      // A brass hotel desk bell on a walnut block; it jumps when rung. Small, so it sits on a table; on the floor it has a brass pedestal.
      parts: (o) => [F(0, 0, 0.3, 0.3, (T, ob, t) => { const z0 = ob.on ? 0 : 0.85, ring = live(ob.id), hop = ring ? Math.abs(Math.sin(t * 22)) * 0.02 : 0;
        if (!ob.on) { const [bx, by] = T.P(0.15, 0.15, 0); ell(bx, by, 9, 4.5, HO.black); T.line([0.15, 0.15, 0.02], [0.15, 0.15, z0 - 0.02], HO.brass, 3); T.box(0.03, 0.03, z0 - 0.03, 0.24, 0.24, 0.03, HO.brass); }
        T.box(0.05, 0.05, z0, 0.2, 0.2, 0.04, HO.walnut);
        const [dx, dy] = T.P(0.15, 0.15, z0 + 0.04 + hop); ctx.beginPath(); ctx.ellipse(dx, dy, 8, 4, 0, Math.PI, 0); ctx.lineTo(dx + 8, dy); ctx.closePath();
        ctx.beginPath(); ctx.moveTo(dx - 8, dy); ctx.bezierCurveTo(dx - 8, dy - 11, dx + 8, dy - 11, dx + 8, dy); ctx.closePath(); ctx.fillStyle = HO.brass; ctx.fill(); ctx.strokeStyle = shade(HO.brass, -0.35); ctx.lineWidth = 0.8; ctx.stroke();
        ell(dx - 2, dy - 5, 3, 1.6, HO.brassLite); circle(dx, dy - 9, 1.5, HO.brass);
        if (ring) { ctx.strokeStyle = 'rgba(224,194,110,.8)'; ctx.lineWidth = 1.2; [10, 15].forEach((r) => { ctx.beginPath(); ctx.arc(dx, dy - 6, r + (t * 30) % 5, -2.4, -0.7); ctx.stroke(); }); }
      })],
    },
    diffuser: {
      // A stone cone on a teak base; it glows when on, and mist curls up from the top while it runs or someone breathes it in.
      // On a table it sits on the top; on the floor it stands on a slim teak stand of its own.
      parts: (o) => [F(0, 0, 0.35, 0.35, (T, ob, t) => { const c = cl(o), on = isLit(ob.id), busy = usingSlot(ob.id + ':d') || live(ob.id), z0 = ob.on ? 0 : 0.5;
        if (!ob.on) { T.box(0.08, 0.08, 0, 0.19, 0.19, 0.03, '#7A5236'); [[0.1, 0.1], [0.25, 0.1], [0.1, 0.25], [0.25, 0.25]].forEach(([x, y]) => T.line([x, y, 0.03], [x, y, z0 - 0.03], '#7A5236', 1.8)); T.box(0.02, 0.02, z0 - 0.03, 0.31, 0.31, 0.03, '#9C6B45'); }
        T.box(0.05, 0.05, z0, 0.25, 0.25, 0.06, '#9C6B45');
        const [bx, by] = T.P(0.175, 0.175, z0 + 0.06), [tx, ty] = T.P(0.175, 0.175, z0 + 0.42);
        ctx.beginPath(); ctx.moveTo(bx - 10, by); ctx.quadraticCurveTo(bx - 9, (by + ty) / 2, tx - 3, ty); ctx.lineTo(tx + 3, ty); ctx.quadraticCurveTo(bx + 9, (by + ty) / 2, bx + 10, by); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); ctx.strokeStyle = shade(c, -0.2); ctx.lineWidth = 0.8; ctx.stroke();
        if (on) { ctx.save(); ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 1.2); circle(bx, by - 6, 9, '#CFEBDD'); ctx.restore(); }
        ell(tx, ty, 3, 1.4, '#6E6A64');
        if (on || busy) steamAt(T, 0.175, 0.175, z0 + 0.44, t, busy ? 5 : 2, busy ? 0.9 : 0.5);
      })],
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
    // A star map: scattered stars, a few bright gold ones joined into constellations, and a crescent here and there.
    else if (pat === 'starmap') { const br = []; for (let k = 0; k < len * 12; k++) { const u = 0.05 + ((k * 0.618 * 3.1) % (len - 0.1)), z = 0.3 + ((k * 0.414 * 2.3) % (WH - 0.4)), [sx, sy] = iso(...P(u, z)); if (k % 11 === 0) { star4(sx, sy, 2.6, S.ink2); br.push([sx, sy]); } else circle(sx, sy, 0.7 + (k % 3) * 0.3, ink); }
      ctx.strokeStyle = 'rgba(226,196,106,.45)'; ctx.lineWidth = 0.7; for (let k = 0; k + 2 < br.length; k += 3) { ctx.beginPath(); ctx.moveTo(...br[k]); ctx.lineTo(...br[k + 1]); ctx.lineTo(...br[k + 2]); ctx.stroke(); }
      for (let u = 0.6; u < len; u += 2.2) { const [mx, my] = iso(...P(u, WH - 0.5)); circle(mx, my, 5, S.ink2); circle(mx + 2, my - 1, 4.4, S.base); } }
    // Knotty pine: tongue-and-groove boards with a knot here and there.
    else if (pat === 'knotty') { for (let u = 0.16; u < len; u += 0.16) line3(P(u, 0.14), P(u, WH), ink, 1); for (let k = 0; k < len * 3; k++) { const u = 0.08 + ((k * 0.618 * 4.1) % (len - 0.16)), z = 0.4 + ((k * 0.414 * 3.3) % (WH - 0.6)), [sx, sy] = iso(...P(u, z)); ell(sx, sy, 2.4, 1.8, S.ink2); ell(sx, sy, 1, 0.8, 'rgba(70,40,15,.6)'); } }
    // Ditsy floral: tiny four-petal flowers in a scatter of colours, with a leaf beside each.
    else if (pat === 'ditsy') { const pal = S.pal || [ink]; for (let z = 0.35, r = 0; z < WH - 0.05; z += 0.28, r++) for (let u = 0.12 + (r % 2) * 0.14; u < len - 0.05; u += 0.28) { const [sx, sy] = iso(...P(u, z)), col = pal[(r * 3 + Math.round(u * 7)) % pal.length]; [[-1.6, 0], [1.6, 0], [0, -1.6], [0, 1.6]].forEach(([dx, dy]) => circle(sx + dx, sy + dy, 1.3, col)); circle(sx, sy, 0.9, '#FFF6D8'); ell(sx + 3, sy + 2, 1.8, 0.8, 'rgba(110,143,90,.7)', null, 0.6); } }
    // Hotel pinstripe: pairs of fine gold lines.
    else if (pat === 'pinstripe2') { for (let u = 0.2; u < len; u += 0.45) { line3(P(u, 0.14), P(u, WH), ink, 0.9); if (u + 0.05 < len) line3(P(u + 0.05, 0.14), P(u + 0.05, WH), ink, 0.9); } }
    // Limewash: soft clouds of darker and lighter wash, brushed across the wall.
    else if (pat === 'limewash') { for (let k = 0; k < len * 3; k++) { const u = (k * 0.618 * 3.7) % len, z = 0.2 + ((k * 0.414 * 2.9) % (WH - 0.6)), w = 0.5 + (k % 3) * 0.3; rect(u, Math.min(len, u + w), z, Math.min(WH, z + 0.35 + (k % 2) * 0.25), k % 3 ? ink : S.ink2); } }
    // Board-formed concrete: the seams of the formwork boards, and a grid of tie holes.
    else if (pat === 'formwork') { for (let z = 0.34; z < WH; z += 0.26) line3(P(0, z), P(len, z), ink, 0.9); for (let z = 0.6; z < WH - 0.1; z += 0.78) for (let u = 0.3; u < len - 0.1; u += 0.6) { const [sx, sy] = iso(...P(u, z)); circle(sx, sy, 1.3, S.ink2); } }
    else if (pat === 'cloudnine') { for (let z = 0.5, r = 0; z < WH - 0.1; z += 0.6, r++) for (let u = 0.3 + (r % 2) * 0.4; u < len - 0.1; u += 0.8) { const [sx, sy] = iso(...P(u, z)); cloudPuff(sx, sy, 1.15); circle(sx + 13, sy - 9, 1.3, '#F6E06B'); if (r % 2) circle(sx - 12, sy + 6, 1.1, '#F9C6DA'); } }
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
    else if (pat === 'ditsy') {
      // Nana: soft cream stripes, a scalloped dado rail, and tiny daisies and bows scattered between.
      for (let u = 0.2; u < len; u += 0.4) line3(P(u, 0.1), P(u, WH), 'rgba(255,255,255,.34)', 3.4);
      line3(P(0, 1.02), P(len, 1.02), 'rgba(255,255,255,.8)', 2);
      for (let u = 0.1; u < len; u += 0.2) { const [sx, sy] = iso(...P(u, 1.02)); ell(sx, sy + 2.5, 3.2, 2.8, 'rgba(255,255,255,.78)'); }
      for (let z = 1.35, r = 0; z < WH - 0.1; z += 0.42, r++) for (let u = 0.2 + (r % 2) * 0.4; u < len; u += 0.8) { const [sx, sy] = iso(...P(u, z)); if ((r + Math.round(u * 2)) % 3 === 2) bow(sx, sy, 2.4, '#D9C8F2'); else daisy(sx, sy, 2.8); }
    }
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
  /** Breezy drapes at a window: sheer panels hung from a gold rod, pinched at a tie-back and swaying a little. */
  function drawDrapes(level, f, style) {
    const P = (u, z) => wallPoint(f.p, u, z);
    const u0 = f.u[0] - 0.1, u1 = f.u[1] + 0.1, zt = f.z[1] + 0.14, zb = f.z[0] - 0.22, zm = (zt + zb) / 2 + 0.12, w = (u1 - u0) * 0.3;
    const gold = '#E8C877', sheer = ['rgba(255,244,249,.84)', 'rgba(255,226,240,.74)', 'rgba(250,236,252,.8)', 'rgba(255,226,240,.74)'];
    line3(P(u0 - 0.06, zt), P(u1 + 0.06, zt), gold, 2.4);
    [u0 - 0.06, u1 + 0.06].forEach(u => { const [x, y] = iso(...P(u, zt)); circle(x, y, 2.2, gold); circle(x - 0.6, y - 0.6, 0.8, '#FFF3CF'); });
    [-1, 1].forEach((side) => {
      const edge = side < 0 ? u0 : u1, away = -side;            // the panel's outer edge, and the way toward the window's middle
      for (let i = 0; i < 4; i++) {
        const a = edge + away * (w * i) / 4, b = edge + away * (w * (i + 1)) / 4, sway = Math.sin(animT * 0.9 + i * 0.8 + side * 1.3) * 0.035 * (i + 1), pinch = away * w * 0.16;
        poly([P(a, zt), P(b, zt), P(b + pinch * 0.8, zm), P(b + away * (0.02 + 0.015 * i) + sway, zb), P(a + away * 0.015 + sway * 0.6, zb), P(a + pinch * 0.8, zm)], sheer[i], 'rgba(205,150,185,.3)', 0.6);
      }
      // The tie-back: a lilac cord with a little bow at the panel's inner edge.
      line3(P(edge, zm), P(edge + away * w * 0.78, zm), '#C9B2EC', 2.6);
      const [bx, by] = iso(...P(edge + away * w * 0.82, zm)); bow(bx, by, 2, '#B9A2E0');
    });
    // A little frill along the top of the rod.
    for (let u = u0; u < u1; u += 0.14) { const [x, y] = iso(...P(u + 0.07, zt - 0.05)); ell(x, y + 1.5, 4, 3.4, 'rgba(250,200,222,.8)'); }
  }
  function drawFeature(level, f) {
    const P = (u, z) => wallPoint(f.p, u, z);
    if (f.k === 'window') { poly(featPoly(f), '#F7F3EE', EDGE, 0.8); gMat = MATERIAL.window; poly(featPoly(f, 0.08), skyColor()); gMat = MATERIAL.matte; if (raining()) glassDrops(f, 0.08); const mu = (f.u[0] + f.u[1]) / 2, mz = (f.z[0] + f.z[1]) / 2; line3(P(mu, f.z[0] + 0.08), P(mu, f.z[1] - 0.08), '#F7F3EE', 2); line3(P(f.u[0] + 0.08, mz), P(f.u[1] - 0.08, mz), '#F7F3EE', 2); if (LOOKS[level] && LOOKS[level].drapes) drawDrapes(level, f, LOOKS[level].drapes); }
    else if (f.k === 'highwin') { poly(featPoly(f), '#E9E4DD', EDGE, 0.8); gMat = MATERIAL.window; poly(featPoly(f, 0.06), skyColor()); gMat = MATERIAL.matte; }
    else if (f.k === 'meetdoor') {
      // The meeting room is behind this door, under the company sign. Nothing inside is ever drawn: people walk to it and go out of sight. The sign
      // glows red and reads IN A MEETING while someone is in there.
      const on = !!officeMeeting;
      poly([P(f.u[0] - 0.12, 0), P(f.u[1] + 0.12, 0), P(f.u[1] + 0.12, f.z[1] + 0.12), P(f.u[0] - 0.12, f.z[1] + 0.12)], '#F4F1EA', EDGE, 0.8);
      poly(featPoly(f), '#7A5A3C'); poly(featPoly(f, 0.1), '#8A6A48');
      const [kx, ky] = iso(...P(f.u[1] - 0.18, 1.0)); circle(kx, ky, 2, '#D8C27A');
      const sz = [f.z[1] + 0.18, f.z[1] + 0.5], su = [f.u[0] - 0.5, f.u[1] + 0.5];
      poly([P(su[0], sz[0]), P(su[1], sz[0]), P(su[1], sz[1]), P(su[0], sz[1])], on ? '#C2413A' : '#2F5FA8', '#1B2A4A', 1);
      const [tx, ty] = iso(...P((su[0] + su[1]) / 2, (sz[0] + sz[1]) / 2)); ctx.save(); ctx.translate(tx, ty); ctx.transform(1, 0.5, 0, 1, 0, 0); ctx.fillStyle = '#FFFFFF'; ctx.font = '700 7.5px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(on ? 'IN A MEETING' : 'MERIDIAN', 0, 3); ctx.restore();
    }
    else if (f.k === 'whiteboard') {
      poly(featPoly(f), '#F6F6F2', '#8E98A6', 1.4);
      line3(P(f.u[0] + 0.25, f.z[1] - 0.3), P(f.u[0] + 1.1, f.z[1] - 0.3), '#2F5FA8', 1.2); line3(P(f.u[0] + 0.25, f.z[1] - 0.55), P(f.u[0] + 1.5, f.z[1] - 0.55), '#C2413A', 1.2); line3(P(f.u[0] + 0.25, f.z[1] - 0.8), P(f.u[0] + 0.9, f.z[1] - 0.8), '#3F7A4A', 1.2);
      poly([P(f.u[0] - 0.03, f.z[0] - 0.03), P(f.u[1] + 0.03, f.z[0] - 0.03), P(f.u[1] + 0.03, f.z[0] + 0.03), P(f.u[0] - 0.03, f.z[0] + 0.03)], '#8E98A6');
    }
    else if (f.k === 'door') { poly([P(f.u[0] - 0.08, 0), P(f.u[1] + 0.08, 0), P(f.u[1] + 0.08, f.z[1] + 0.05), P(f.u[0] - 0.08, f.z[1] + 0.05)], '#EFE8DE', EDGE, 0.8); poly(featPoly(f), '#7A5236'); poly([P(f.u[0] + 0.1, 1.15), P(f.u[1] - 0.1, 1.15), P(f.u[1] - 0.1, 1.9), P(f.u[0] + 0.1, 1.9)], null, 'rgba(0,0,0,.25)', 1); poly([P(f.u[0] + 0.1, 0.2), P(f.u[1] - 0.1, 0.2), P(f.u[1] - 0.1, 0.95), P(f.u[0] + 0.1, 0.95)], null, 'rgba(0,0,0,.25)', 1); const [kx, ky] = iso(...P(f.u[0] + 0.15, 1.02)); circle(kx, ky, 2, '#E0B85A'); }
    else if (f.k === 'switch') { poly(featPoly(f), '#F7F3EE', EDGE, 0.8); const mid = (f.u[0] + f.u[1]) / 2; poly(party ? [P(mid - 0.03, 1.11), P(mid + 0.03, 1.11), P(mid + 0.03, 1.19), P(mid - 0.03, 1.19)] : [P(mid - 0.03, 1.03), P(mid + 0.03, 1.03), P(mid + 0.03, 1.11), P(mid - 0.03, 1.11)], party ? '#D24A7A' : '#9C9298'); }
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

  // An office keeps its lights on: at night it is only a little dimmer, with the dark showing in the windows.
  function levelDark(level) { if (level === OFFICE) return darkness() * 0.3; return Math.min(level === 0 ? 0.7 : 0.62, darkness() + (level === 0 ? 0.32 : 0) + (!power && !isOutdoor(level) ? 0.1 : 0) + (isOutdoor(level) && raining() ? 0.08 : 0)); }
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
  /** How far every light reaches, against its authored radius: more means pools of light that read more strongly. */
  const LIGHT_GAIN = 1.1;
  function activeLights(level) {
    const out = [];
    WALL_LIGHTS.forEach((L, i) => { if (L.k === 'sconce' || L.level !== level || (L.need && !has(L.need)) || lightSkipped(L) || (L.onlyIn && flags.house !== L.onlyIn)) return; const manual = wallLightOverrides.get(i); const target = manual === true ? 1 : manual === false ? 0 : wantLight(level, roomFor(L.room), L.night, L.amb); const s = ease('w' + i, target); if (s < 0.02) return; const um = (L.u[0] + L.u[1]) / 2, off = L.k === 'under' ? 0.5 : 0.2; out.push({ src: L.p === 'B' ? [um, off, L.z] : [off, um, L.z], pool: L.p === 'B' ? [um, L.k === 'under' ? 1.1 : 1.4, 0] : [1.4, um, 0], r: L.r * LIGHT_GAIN, s, col: L.col, vis: BACK[VR].includes(L.p), room: roomFor(L.room) }); });
    LAMPS.forEach(L => {
      if (L.level !== level || (L.onlyIn && flags.house !== L.onlyIn)) return;
      const room = roomFor(lampRoom(L)), manual = wallLightOverrides.get(L.id);
      const target = manual === true ? 1 : manual === false ? 0 : wantLight(level, room, L.night, L.amb), s = ease('wl:' + L.id, target);
      if (s < 0.02) return;
      out.push({ src: L.p === 'B' ? [L.u, 0.2, L.z] : [0.2, L.u, L.z], pool: L.p === 'B' ? [L.u, 1.4, 0] : [1.4, L.u, 0], r: L.r * LIGHT_GAIN, s, vis: BACK[VR].includes(L.p), room });
    });
    OBJS.forEach(o => { const lt = T_OF(o).light; if (!lt || o.level !== level) return; const [x, y] = xf(o, lt.at[0], lt.at[1]); const manual = objectLights.get(o.id); const target = manual === true ? Math.max(0.75, wantLight(level, roomName(level, x, y))) : manual === false ? 0 : wantLight(level, roomName(level, x, y)); const s = ease(o.id, target); if (s < 0.02) return; out.push({ src: [x, y, lt.at[2] + (o.z || 0)], pool: [x, y, 0], r: lt.r * LIGHT_GAIN, s, col: lt.col, vis: true, room: roomFor(roomName(level, x, y)) }); });
    return out;
  }
  /** The drawing tools a wall fixture gets, in its wall's own frame (see art/wallLamps.js). */
  function lampTools(p, um, z) {
    const W = (u, o, zz) => (p === 'B' ? [u, o, zz] : [o, u, zz]);
    return {
      um, z, ctx, ell, circle, shade, W,
      sp: (u, o, zz) => iso(...W(u, o, zz)),
      wb: (u, o, zz, du, dof, dz, c) => (p === 'B' ? box(u, o, zz, du, dof, dz, c) : box(o, u, zz, dof, du, dz, c)),
      wp: (pts, fill, stroke, lw) => poly(pts.map(([u, o, zz]) => W(u, o, zz)), fill, stroke, lw),
      wl: (a, b, c, w) => line3(W(...a), W(...b), c, w),
    };
  }
  /** The movable lamps on the back walls of this floor, each lit or not. */
  function drawLamps(level) {
    LAMPS.forEach((L) => {
      if (L.level !== level || !BACK[VR].includes(L.p) || (L.onlyIn && flags.house !== L.onlyIn)) return;
      const on = wallLightOverrides.get(L.id) === true || (wallLightOverrides.get(L.id) !== false && isLit('wl:' + L.id));
      if (gOn && on) G.emissive(L.z);
      if (lampUi && lampUi.id === L.id) {
        const [x, y] = iso(...(L.p === 'B' ? [L.u, 0.1, L.z] : [0.1, L.u, L.z])), pulse = 0.5 + 0.5 * Math.sin(animT * 4);
        const col = lampUi.held ? (lampUi.valid ? '47,143,91' : '194,65,58') : '255,200,70';
        ell(x, y, 21, 24, `rgba(${col},${lampUi.held ? 0.22 : 0.14 + 0.1 * pulse})`, `rgba(${col},.9)`);
      }
      drawWallLamp(lampTools(L.p, L.u, L.z), L.style, on);
      if (gOn) G.clearBase();
    });
  }
  function drawWallLights(level) {
    drawLamps(level);
    WALL_LIGHTS.forEach((L, i) => {
      if (L.k === 'sconce' || L.level !== level || (L.need && !has(L.need)) || !BACK[VR].includes(L.p) || lightSkipped(L) || (L.onlyIn && flags.house !== L.onlyIn)) return;
      const on = wallLightOverrides.get(i) === true || (wallLightOverrides.get(i) !== false && isLit('w' + i)), um = (L.u[0] + L.u[1]) / 2, P = (u, z, off = 0) => iso(...(L.p === 'B' ? [u, off, z] : [off, u, z]));
      if (gOn && on && L.k !== 'under') G.emissive(L.z);
      const frame = () => lampTools(L.p, um, L.z);
      if (L.k === 'strip' || L.k === 'bar') {
        const h = frame(), [u0, u1] = L.u, bar = L.k === 'bar';
        h.wp([[u0 + 0.03, 0.004, L.z - 0.07], [u1 + 0.03, 0.004, L.z - 0.07], [u1 + 0.03, 0.004, L.z - 0.2], [u0 + 0.03, 0.004, L.z - 0.2]], 'rgba(30,15,10,.15)');
        h.wb(u0, 0, L.z - 0.06, u1 - u0, 0.1, 0.12, '#5A4A40');
        h.wb(u0 + 0.03, 0.1, L.z - 0.045, u1 - u0 - 0.06, 0.015, 0.09, on ? '#FFF6D8' : '#E2DDD3');
        if (bar) [u0, u1].forEach(u => h.wb(u - 0.02, 0, L.z - 0.08, 0.04, 0.12, 0.16, '#8E939A'));
        if (on) h.wp([[u0, 0.004, L.z - 0.06], [u1, 0.004, L.z - 0.06], [u1 + 0.1, 0.004, L.z - 0.5], [u0 - 0.1, 0.004, L.z - 0.5]], 'rgba(255,230,170,.16)');
      }
      else if (L.k === 'string') { let prev = null; for (let k = 0; k <= 16; k++) { const u = L.u[0] + (L.u[1] - L.u[0]) * k / 16, sag = Math.sin(Math.PI * ((k % 8) / 8)) * 0.12, q = P(u, L.z - sag, 0.02); if (prev) limb(prev[0], prev[1], q[0], q[1], '#3A3340', 0.8); if (k % 2) circle(q[0], q[1] + 2, 2, on ? ['#FFD27A', '#FF9EC2', '#9EE0FF'][k % 3] : '#B9B0A6'); prev = q; } }
      else if (L.k === 'bulb') {
        const h = frame();
        h.wp([[um - 0.04, 0.004, L.z - 0.08], [um + 0.08, 0.004, L.z - 0.08], [um + 0.08, 0.004, L.z - 0.24], [um - 0.04, 0.004, L.z - 0.24]], 'rgba(30,15,10,.14)');
        h.wb(um - 0.05, 0, L.z - 0.05, 0.1, 0.03, 0.1, '#8E939A');
        h.wb(um - 0.03, 0.03, L.z - 0.03, 0.06, 0.07, 0.06, '#E9E4DD');
        const [gx, gy] = h.sp(um, 0.15, L.z - 0.02);
        if (on) { h.ell(gx, gy, 16, 13, 'rgba(255,230,170,.22)'); }
        circle(gx, gy, 5, on ? '#FFF6D0' : '#EADFC4'); ctx.beginPath(); ctx.arc(gx, gy, 5, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(70,45,40,.55)'; ctx.lineWidth = 0.9; ctx.stroke(); h.ell(gx - 1.6, gy - 1.8, 1.8, 1.2, 'rgba(255,255,255,.8)');
      }
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
  // The weather comes in with every frame from the game's state (see state/weather.ts), so the art and the garden agree.
  let weatherNow = { on: false, rainAt: 0, rainUntil: 0 };
  const raining = () => absMin() >= weatherNow.rainAt && absMin() < weatherNow.rainUntil;

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
      if (isPatio(i, j)) { if (flags.house === 'craftsman') { poly([[i, j, 0.03], [i + 1, j, 0.03], [i + 1, j + 1, 0.03], [i, j + 1, 0.03]], '#9C6B45', 'rgba(60,40,20,.3)', 1); for (let k = 0.2; k < 1; k += 0.2) poly([[i + k, j, 0.031], [i + k, j + 1, 0.031]], null, 'rgba(60,40,20,.3)', 1); return; } poly([[i, j, 0], [i + 1, j, 0], [i + 1, j + 1, 0], [i, j + 1, 0]], '#D9B97C', 'rgba(150,110,60,.3)', 1);
        // Swirled rings, like a packed dirt path: each tile's rings are offset by its place so the path flows.
        for (let k = 1; k <= 3; k++) { const pts = []; const r = 0.1 + k * 0.12; for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.3) pts.push([i + 0.5 + Math.cos(a + k * 0.7 + j) * r * (1 + 0.25 * Math.sin(a * 2 + i)), j + 0.5 + Math.sin(a + k * 0.7 + j) * r * 0.8, 0.001]); poly(pts, null, 'rgba(160,116,60,.55)', 1); }
        return; }
      const col = grassColor(t); poly([[i, j, 0], [i + 1, j, 0], [i + 1, j + 1, 0], [i, j + 1, 0]], col, 'rgba(40,70,30,.12)', 0.6);
      // Little leaves scattered over the grass, dark and light, turned by place so no two tiles match.
      for (let k = 0; k < 7; k++) { const h = ((i * 73 + j * 151 + k * 97) * 2654435761) >>> 0; const u = 0.1 + (h % 80) / 100, v = 0.1 + ((h >>> 8) % 80) / 100, rot = ((h >>> 16) % 4) * Math.PI / 2; const c2 = Math.cos(rot), s2 = Math.sin(rot); const tri = [[0, -0.1], [0.075, 0.07], [-0.075, 0.07]].map(([x, y]) => [i + u + x * c2 - y * s2, j + v + x * s2 + y * c2, 0.002]); poly(tri, (h >>> 3) % 3 === 0 ? '#2C8A3C' : '#5CC05E', null); }
      if ((t.snow || 0) > 0.05) { poly([[i, j, 0.004], [i + 1, j, 0.004], [i + 1, j + 1, 0.004], [i, j + 1, 0.004]], `rgba(246,248,250,${Math.min(0.96, t.snow * 1.1)})`); if (t.snow > 0.5) return; }
      if ((t.leaves || 0) > 0.12) { const n = Math.floor(t.leaves * 9); for (let k = 0; k < n; k++) { const [sx, sy] = iso(i + ((k * 41 + i * 17 + j * 5) % 10) / 10, j + ((k * 29 + j * 13 + i * 7) % 10) / 10, 0.005); ell(sx, sy, 2.6, 1.4, ['#C2632B', '#D98F2B', '#8A5A3B', '#B5482A'][(k + i + j) % 4], null, k); } }
      if (t.len > 0.3) { const n = Math.floor(t.len * 8), hgt = 3 + t.len * 10, bc = shade(col.startsWith('rgb') ? '#4E8A3A' : col, -0.1); ctx.strokeStyle = t.water < 0.3 ? 'rgba(140,120,60,.8)' : 'rgba(58,110,44,.85)'; ctx.lineWidth = 1; ctx.beginPath(); for (let k = 0; k < n; k++) { const px = i + ((k * 37 + i * 13 + j * 7) % 10) / 10, py = j + ((k * 53 + j * 11 + i * 3) % 10) / 10, [sx, sy] = iso(px, py, 0), sw = Math.sin(animT * 1.5 + px * 2 + py) * 1.5; ctx.moveTo(sx - 1.5, sy); ctx.lineTo(sx + sw - 0.5, sy - hgt); ctx.moveTo(sx + 1.5, sy); ctx.lineTo(sx + sw + 1.5, sy - hgt * 0.8); } ctx.stroke(); }
      if (t.weed > 0.35) { const px = i + 0.3 + t.seed * 0.4, py = j + 0.3 + ((t.seed * 7) % 1) * 0.4, [sx, sy] = iso(px, py, 0); ell(sx - 3, sy - 1, 4, 1.6, '#4F7A36', null, -0.4); ell(sx + 3, sy - 1, 4, 1.6, '#4F7A36', null, 0.4); limb(sx, sy, sx, sy - 6 - t.weed * 6, '#5A8A40', 1); if (t.weed > 0.85 && t.seed > 0.7) circle(sx, sy - 7 - t.weed * 6, 3.2, 'rgba(250,250,245,.9)'); else circle(sx, sy - 7 - t.weed * 6, 2.6, '#F2C230'); }
    });
    // Puddles, splashes and the falling rain all go in the ground pass, so the house and furniture cover them.
    wfx.drawGround(ctx, iso, YARD.tiles);
    // Rain and snow fall from out of frame over the whole scene: the yard's own over the lot, and a stateless layer over everything past the fence.
    wfx.drawAir(ctx, iso, null);
    if (nbWet > 0.02) wfx.drawField(ctx, animT, nbRain('air'));
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
    // The yard's own fences are drawn by the same code as every neighbour's (nbFence), so pickets, rails, posts, height and colour are one thing.
    back.filter(pl => pl !== 'L').forEach(pl => { const a = wallPoint(pl, 0, 0), b = wallPoint(pl, planeLen(pl), 0), keepOn = gOn; gOn = false; nbFence(a[0], a[1], b[0], b[1]); gOn = keepOn; });
    drawWallLights(3);
  }
  // The neighbourhood around the yard. This is a back yard, so the lot is seen from behind the houses: our house is behind its
  // x = 0 wall, the neighbours' back yards run along both sides (y < 0 and y > WY), the rows' back fences stand at x = WX, a lane
  // runs behind them and the next street's back yards and the backs of its houses lie beyond. Everything is placed in world space
  // and drawn through the yard's own camera (V / VR), so it turns with the lot. It is drawn once per camera / season / light and kept.
  // Everything sits on whole tiles like the yard: fences on tile edges, one clear tile between a fence and a shed, a tile of verge either side of the lane.
  const NB = { lane0: WX + 1, lane1: WX + 4, rear0: WX + 5, depth: 7, front: 5 };
  const nbBack = { ground: null, objects: null, key: '' };
  // What rain can land on, recorded as the objects are drawn: a roof or canopy (a flat shape at a height) and the outline that hides what is behind it.
  let nbOcc = [];
  // Lights in the neighbourhood (lit windows, the street lamps), drawn after the game's own night lighting so they glow instead of being darkened by it.
  let nbGlows = [];
  let nbWet = 0;
  const nbHash = (a, b) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
  // A face is seen when its outward normal turns toward the camera, which always sits at +a, +b.
  const nbFacing = (nx, ny) => { const [da, db] = VD(nx, ny); return da + db > 0; };
  // Tall things are only drawn behind the lot (view a or b <= 0); on the near side they would hang over the yard.
  const nbBehind = (x1, y1, x2, y2) => { const r = vrect(x1, y1, x2, y2); return r[2] <= 0.2 || r[3] <= 0.2; };
  function nbWindow(plane, at, u0, u1, z0, z1, lit) {
    const q = plane === 'x' ? [[at, u0, z0], [at, u1, z0], [at, u1, z1], [at, u0, z1]] : [[u0, at, z0], [u1, at, z0], [u1, at, z1], [u0, at, z1]];
    poly(q, lit === 1 ? '#FFD98A' : lit === 3 ? '#B4D6FF' : lit === 2 ? '#2B2F45' : raining() ? '#8E99A8' : '#A9C3D3', lit === 1 || lit === 3 ? 'rgba(255,240,200,.9)' : '#F7F3EE', 1);
    if (lit === 1 || lit === 3) {
      const mu = (u0 + u1) / 2, mz = (z0 + z1) / 2, [gx, gy] = plane === 'x' ? iso(at, mu, mz) : iso(mu, at, mz);
      nbGlows.push({ x: gx, y: gy, r: 17, col: lit === 3 ? '170,205,255' : '255,200,120', a: lit === 3 ? 0.45 : 0.55 });
    }
  }
  // Whether a neighbour's window has its light on at this hour: most come on between dusk and the late evening and go off before dawn, some
  // are up early, and a few glow the blue of a television. (0: by day, plain glass; 1 warm light; 2 dark; 3 a screen's blue.)
  function nbWindowState(seed, k) {
    const r1 = nbHash(seed * 7 + k, 3), r2 = nbHash(seed * 7 + k, 4), r3 = nbHash(seed * 7 + k, 5), h = hour(), hh = h < 5 ? h + 24 : h;
    const evening = hh >= 17.4 + r1 * 3.4 && hh < 22.2 + r2 * 4.6, early = r3 > 0.55 && h >= 5.2 + r1 * 1.2 && h < 7.4 + r2 * 0.8, on = evening || early;
    if (darkness() < 0.06 && !on) return 0;
    return on ? (r3 < 0.22 && hh > 19 ? 3 : 1) : darkness() > 0.12 ? 2 : 0;
  }
  // A house seen from its back. `rear` is the side the back wall faces along x (+1: the body lies at x < x0, -1: at x > x0).
  function nbHouse(x0, y0, y1, rear, h, wall, roof, seed, o = {}) {
    const dep = NB.depth, xa = rear > 0 ? x0 - dep : x0, xb = rear > 0 ? x0 : x0 + dep, z0 = o.z0 || 0;
    if (!nbBehind(xa - 0.5, y0 - 0.5, xb + 0.5, y1 + 0.5)) return;
    const win = (k) => nbWindowState(seed, k);
    box(xa, y0, z0, xb - xa, y1 - y0, h - z0, wall);
    const rx = rear > 0 ? xb + 0.012 : xa - 0.012, rn = rear > 0 ? 1 : -1;
    const floors = h > 4 ? [0.55, 2.75] : [0.55];
    if (nbFacing(rn, 0)) {
      const n = Math.max(2, Math.round((y1 - y0) / 2.2)), step = (y1 - y0) / n;
      floors.forEach((fz, f) => { if (fz < z0) return; for (let k = 0; k < n; k++) { const u = y0 + step * (k + 0.5); if (f === 0 && z0 === 0 && k === (seed * 5 | 0) % n) { poly([[rx, u - 0.45, 0], [rx, u + 0.45, 0], [rx, u + 0.45, 2.0], [rx, u - 0.45, 2.0]], '#7A5236', '#F7F3EE', 1); continue; } nbWindow('x', rx, u - 0.45, u + 0.45, fz, fz + 1.2, win(f * 9 + k)); } });
    }
    [[y0, -1], [y1, 1]].forEach(([yy, sn]) => { if (!nbFacing(0, sn)) return; const sy = yy + sn * 0.012; for (let f = 0; f < floors.length; f++) { if (floors[f] < z0) continue; nbWindow('y', sy, (xa + xb) / 2 - 0.45, (xa + xb) / 2 + 0.45, floors[f], floors[f] + 1.2, win(40 + f)); } });
    const ym = (y0 + y1) / 2, rise = (y1 - y0) * 0.32, ov = 0.3, ze = h - 0.1, snow = seasonIdx() === 3, rc = snow ? '#EEF2F5' : roof;
    const slope = (ya, yb, sn) => poly([[xa - ov, ya, ze], [xb + ov, ya, ze], [xb + ov, yb, h + rise], [xa - ov, yb, h + rise]], shade(rc, sn > 0 ? -0.06 : 0.04), 'rgba(30,20,25,.18)', 0.8);
    const nearIsB = nbFacing(0, 1);
    const sA = () => slope(y0 - ov, ym, -1), sB = () => slope(y1 + ov, ym, 1);
    if (nearIsB) sA(); else sB();
    [[xb, 1], [xa, -1]].forEach(([gx, sn]) => { if (nbFacing(sn, 0)) poly([[gx, y0, h], [gx, y1, h], [gx, ym, h + rise]], shade(wall, sn > 0 ? -0.04 : -0.2), EDGE, 0.8); });
    if (nearIsB) sB(); else sA();
    if (seed > 0.5) { const cy2 = ym + (seed - 0.5) * 2; box(xa + dep * 0.5, cy2 - 0.3, h - 0.3, 0.6, 0.6, rise + 0.6, '#9C6B45'); }
  }
  // The fence's colours at this hour, for the face turned toward us: the yard's own fence and every neighbour's use these, so they always
  // match. The sun is front-left (the +b face is lit, the +a face shaded); at dawn and dusk the lit side warms and the shade goes lilac,
  // at night the whole fence turns to cool moonlit blue, darker on the shaded side, and rain greys it a little.
  // How tall every fence is, the yard's own and the neighbours' alike: pickets, their pointed tips and the two rails.
  const FENCE = { h: 0.98, tip: 1.07, rails: [0.26, 0.68] };
  function fenceColors(nx, ny) {
    const lit = VD(nx, ny)[1] > 0, dk = darkness(), night = Math.max(0, Math.min(1, (dk - 0.04) / 0.5)), h = hour();
    const warm = Math.max(0, 1 - Math.abs(h - 6.6) / 1.6, 1 - Math.abs(h - 19.2) / 1.9) * (1 - night), rain = raining() ? 0.14 : 0, snow = seasonIdx() === 3;
    const k = (c, dusk, moon) => { let o = treeMix(c, dusk, warm * 0.4); o = treeMix(o, moon, night * 0.88); return rain ? treeMix(o, '#98A2AE', rain) : o; };
    return {
      board: k(lit ? (snow ? '#F8FAFC' : '#F6EFE0') : (snow ? '#D6DEE6' : '#D8CCBA'), lit ? '#F4B27E' : '#A08CB0', lit ? '#95A2C6' : '#566080'),
      rail: k(lit ? '#E8DCC8' : '#C2B5A2', lit ? '#E8A878' : '#8E7CA0', lit ? '#7C88AC' : '#48516E'),
      edge: night > 0.5 ? 'rgba(10,14,34,.3)' : 'rgba(0,0,0,.12)',
    };
  }
  function nbFence(xa, ya, xb, yb) {
    const len = Math.hypot(xb - xa, yb - ya), ux = (xb - xa) / len, uy = (yb - ya) / len;
    // The face we see is the one turned toward the camera.
    const n1 = [-uy, ux], n2 = [uy, -ux], vis = VD(n1[0], n1[1]).reduce((s, v) => s + v, 0) > 0 ? n1 : n2, fc = fenceColors(vis[0], vis[1]);
    for (const k of [0.22, -0.14]) poly([[xa, ya, 0.003], [xb, yb, 0.003], [xb - uy * k, yb + ux * k, 0.003], [xa - uy * k, ya + ux * k, 0.003]], 'rgba(28,40,26,.18)');
    for (const z of FENCE.rails) poly([[xa, ya, z], [xb, yb, z], [xb, yb, z + 0.08], [xa, ya, z + 0.08]], fc.rail);
    // One continuous run of pickets on a single grid (every 0.2 from the run's start), from its first corner to its last, drawn from the far end
    // toward the camera. Where two runs meet, each ends with a picket on the corner itself, so they join without a post or a gap.
    const step = 0.2, n = Math.max(1, Math.round(len / step)), fwd = VD(ux, uy).reduce((s, v) => s + v, 0) > 0;
    for (let i = 0; i <= n; i++) {
      const k = fwd ? i : n - i, d = Math.min(len - 0.13, k * step), x = xa + ux * d, y = ya + uy * d, px = ux * 0.13, py = uy * 0.13;
      poly([[x, y, 0], [x + px, y + py, 0], [x + px, y + py, FENCE.h], [x + px / 2, y + py / 2, FENCE.tip], [x, y, FENCE.h]], fc.board, fc.edge, 0.6);
    }
  }
  function nbTree(x, y, seed) {
    if (!nbBehind(x - 1.4, y - 1.4, x + 1.4, y + 1.4)) return;
    const si = seasonIdx(), [sx, sy] = iso(x, y, 0), pine = seed > 0.66, s = 0.8 + seed * 0.5;
    nbOcc.push(pine ? { ell: { cx: sx, cy: sy - 34 * s, rx: 15 * s, ry: 7.5 * s }, zr: s, sil: { cx: sx, cy: sy - 30 * s, rx: 16 * s, ry: 26 * s } } : { ell: { cx: sx, cy: sy - 38 * s, rx: 24 * s, ry: 12 * s }, zr: 1.12 * s, sil: { cx: sx, cy: sy - 34 * s, rx: 24 * s, ry: 24 * s } });
    ell(sx + 6, sy + 1, 22 * s, 8 * s, 'rgba(28,40,26,.2)');
    rr(sx - 2, sy - 22 * s, 4, 22 * s, 1.5, '#5A3E2E');
    if (pine) { const c = si === 3 ? '#8DA8A0' : '#3F7A4A'; for (let k = 0; k < 3; k++) { const w = (17 - k * 4) * s, yy = sy - (14 + k * 11) * s; ctx.fillStyle = shade(c, k * 0.05); ctx.beginPath(); ctx.moveTo(sx - w, yy + 8 * s); ctx.lineTo(sx + w, yy + 8 * s); ctx.lineTo(sx, yy - 12 * s); ctx.closePath(); ctx.fill(); } return; }
    const c = ['#6CB45A', '#4E9A48', '#C9803A', '#A9B4B0'][si];
    circle(sx - 8 * s, sy - 30 * s, 12 * s, shade(c, -0.08)); circle(sx + 8 * s, sy - 29 * s, 12 * s, shade(c, -0.12)); circle(sx, sy - 38 * s, 14 * s, c); circle(sx - 4 * s, sy - 42 * s, 8 * s, shade(c, 0.1));
  }
  function nbShed(x, y, seed) {
    if (!nbBehind(x, y, x + 2, y + 2)) return;
    const c = ['#8C6A4E', '#A9B8A6', '#B8A07C'][(seed * 3 | 0) % 3];
    box(x, y, 0, 2, 2, 1.5, c);
    nbOcc.push({ roof: [iso(x - 0.1, y - 0.1, 1.62), iso(x + 2.1, y - 0.1, 1.62), iso(x + 2.1, y + 2.1, 1.62), iso(x - 0.1, y + 2.1, 1.62)], zr: 1.62, sil: hull([0, 1.62].flatMap(z => [iso(x - 0.1, y - 0.1, z), iso(x + 2.1, y - 0.1, z), iso(x + 2.1, y + 2.1, z), iso(x - 0.1, y + 2.1, z)])) });
    // The door faces into the yard (+y, away from the fence the shed stands against); the wall seen from the other side gets a window.
    if (nbFacing(0, 1)) poly([[x + 0.6, y + 2.012, 0], [x + 1.4, y + 2.012, 0], [x + 1.4, y + 2.012, 1.1], [x + 0.6, y + 2.012, 1.1]], shade(c, -0.35), '#F7F3EE', 0.8);
    const wx = nbFacing(1, 0) ? x + 2.012 : x - 0.012;
    if (nbFacing(1, 0) || nbFacing(-1, 0)) {
      const lit = darkness() > 0.2 && nbHash(seed * 11, 9) > 0.6;
      poly([[wx, y + 0.5, 0.65], [wx, y + 1.3, 0.65], [wx, y + 1.3, 1.15], [wx, y + 0.5, 1.15]], lit ? '#FFD98A' : darkness() > 0.2 ? '#2B2F45' : raining() ? '#8E99A8' : '#A9C3D3', '#F7F3EE', 0.8);
      if (lit) { const [gx, gy] = iso(wx, y + 0.9, 0.9); nbGlows.push({ x: gx, y: gy, r: 14, col: '255,200,120', a: 0.5 }); }
    }
    box(x - 0.1, y - 0.1, 1.5, 2.2, 2.2, 0.12, '#5A4A44');
  }
  function nbPole(x, y, lamp) {
    if (!nbBehind(x - 0.3, y - 0.3, x + 0.3, y + 0.3)) return;
    const zt = 3.7, za = 3.35, [sx, sy] = iso(x, y, 0), arm = shade('#5A4A44', 0.05);
    ell(sx + 5, sy + 1, 7, 3, 'rgba(28,40,26,.25)');
    line3([x, y, 0], [x, y, zt], '#5A4A44', 3);
    line3([x, y - 0.6, za], [x, y + 0.6, za], arm, 2.2);
    // Every other pole carries a street lamp reaching out over the lane: a dark hood and a lens, and at night a pool of light on the road.
    if (lamp) {
      const lx = x + 1.5, lz = 3.5;
      line3([x, y, lz - 0.1], [lx, y, lz], '#3F3A3F', 2.4);
      const [hx, hy] = iso(lx, y, lz);
      rr(hx - 5.5, hy - 2.5, 11, 4.4, 2, '#3A363C'); ell(hx, hy + 2.2, 3.6, 1.5, darkness() > 0.12 ? '#FFF0C0' : '#D8D2C0');
      nbGlows.push({ x: hx, y: hy + 3, r: 22, col: '255,224,150', a: 0.8 }, { pool: true, x: iso(lx, y, 0)[0], y: iso(lx, y, 0)[1], rx: 3.4 * TW, ry: 3.4 * TH, col: '255,214,140', a: 0.5 });
    }
    for (const off of [-0.5, 0.5]) {
      const [ix, iy] = iso(x, y + off, za + 0.08); circle(ix, iy, 1.7, '#9CB5B8');
      // The wire to the next pole sags between them.
      ctx.strokeStyle = 'rgba(40,36,44,.65)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let s = 0; s <= 10; s++) { const u = s / 10, [wx, wy] = iso(x, y + off + u * WY, za + 0.08 - 0.5 * 4 * u * (1 - u)); s ? ctx.lineTo(wx, wy) : ctx.moveTo(wx, wy); }
      ctx.stroke();
    }
  }
  function nbLot(x0, x1, y0, y1, seed, grass) {
    poly([[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0]], grass);
    // The same tiles and blades as the yard's own lawn, so the two read as one lawn.
    for (let i = x0; i < x1; i++) for (let j = y0; j < y1; j++) {
      const [sx, sy] = iso(i + 0.5, j + 0.5, 0); if (sx < -40 || sx > W + 40 || sy < -40 || sy > H + 40) continue;
      const h = nbHash(i * 31 + seed, j * 17 + 5);
      poly([[i, j, 0], [i + 1, j, 0], [i + 1, j + 1, 0], [i, j + 1, 0]], shade(grass, (h - 0.5) * 0.05), 'rgba(40,70,30,.12)', 0.6);
      for (let k = 0; k < 3; k++) { const px = i + nbHash(i + k, j * 7 + seed), py = j + nbHash(i * 5 + seed, j + k * 3), [bx, by] = iso(px, py, 0); limb(bx, by, bx - 1, by - 3, 'rgba(60,110,44,.55)', 1); limb(bx, by, bx + 1.5, by - 2.5, 'rgba(60,110,44,.55)', 1); }
    }
    const px = x0 + 1 + Math.floor(nbHash(seed, 2) * 3), py = y0 + 4 + Math.floor(nbHash(seed, 4) * 2);
    poly([[px, py, 0.01], [px + 3, py, 0.01], [px + 3, py + 2, 0.01], [px, py + 2, 0.01]], '#CFC9C0', 'rgba(60,50,40,.2)', 0.8);
    if (nbHash(seed, 6) > 0.4) poly([[x1 - 4, y1 - 2, 0.01], [x1 - 2, y1 - 2, 0.01], [x1 - 2, y1 - 1, 0.01], [x1 - 4, y1 - 1, 0.01]], '#6B4A35');
  }
  // `part` is 'ground' (the lawns and the lane) or 'objects' (what stands on them), kept apart so the rain's ripples can sit between the two.
  function buildBackdrop(part) {
    const si = seasonIdx(), grass = grassColor({ water: 0.72, len: 0.38, burn: 0, j: 0, mowedAt: -9999 }), asphalt = si === 3 ? '#6A6F78' : '#5A5E66';
    // The yard's own lawn is brighter and greener than a flat tile (its blades and mowing stripes), so the neighbours' is lifted to match; a step in colour reads as a step in height.
    const [lr, lg, lb] = rgb(grass), lawn = `rgb(${Math.min(255, Math.round(lr * 1.1))},${Math.min(255, Math.round(lg * 1.145))},${Math.round(lb * 0.96)})`;
    const R = 14, big = 90, rows = [];
    if (part === 'ground') {
    // Ground. The whole canvas is grass first, so no edge of the neighbourhood ever shows.
    ctx.fillStyle = lawn; ctx.fillRect(0, 0, W, H);
    poly([[-big, -big, -0.02], [big, -big, -0.02], [big, big, -0.02], [-big, big, -0.02]], lawn);
    // The lane behind the back fences, with gravel shoulders and a concrete apron at each back gate.
    poly([[NB.lane0 - 1, -big, -0.01], [NB.lane1 + 1, -big, -0.01], [NB.lane1 + 1, big, -0.01], [NB.lane0 - 1, big, -0.01]], si === 3 ? '#D5DADF' : '#B8AE9C');
    poly([[NB.lane0, -big, 0], [NB.lane1, -big, 0], [NB.lane1, big, 0], [NB.lane0, big, 0]], asphalt);
    for (let k = -R; k <= R; k++) { const y = k * WY + 3, y2 = y + 2; poly([[WX, y, 0.005], [NB.lane0, y, 0.005], [NB.lane0, y2, 0.005], [WX, y2, 0.005]], '#CFC9C0'); }
    for (let k = -R; k <= R; k++) for (let t = 0; t < 4; t++) { const y = k * WY + 1 + t * 2; poly([[NB.lane0 + 0.1, y, 0.002], [NB.lane0 + 0.1, y + 0.15, 0.002], [NB.lane1 - 0.1, y + 0.15, 0.002], [NB.lane1 - 0.1, y, 0.002]], 'rgba(0,0,0,.06)'); }
    // Back yards: ours and the neighbours' on this side, then the next street's on the far side of the lane.
    for (let k = -R; k <= R; k++) if (k !== 0) nbLot(0, WX, k * WY, k * WY + WY, k + 40, lawn);
    for (let k = -R; k <= R; k++) nbLot(NB.rear0, NB.rear0 + 10, k * WY + 4, k * WY + 4 + WY, k + 90, lawn);
    for (let k = -R; k <= R; k++) { nbLot(-NB.front, 0, k * WY, k * WY + WY, k + 140, lawn); }
    }
    if (part === 'objects') {
    nbOcc = []; nbGlows = [];
    // Back-to-front: fences go in the same sort as the houses, sheds and trees (a fence in front of a shed has to cover it), in short runs
    // so each run is sorted by its own depth.
    const fenceRows = (xa, ya, xb, yb) => { const len = Math.hypot(xb - xa, yb - ya), n = Math.max(1, Math.round(len / 2)); for (let i = 0; i < n; i++) { const a = [xa + (xb - xa) * i / n, ya + (yb - ya) * i / n], b = [xa + (xb - xa) * (i + 1) / n, ya + (yb - ya) * (i + 1) / n]; rows.push({ key: vs((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), d: () => nbFence(a[0], a[1], b[0], b[1]) }); } };
    for (let k = -R; k <= R + 1; k++) {
      if (k !== 0 && k !== 1) fenceRows(0, k * WY, WX, k * WY);
      const ys = k * WY + 4; fenceRows(NB.rear0, ys, NB.rear0 + 10, ys);
      if (k !== 0 && k < R + 1) fenceRows(WX, k * WY, WX, k * WY + WY);
      if (k < R + 1) fenceRows(NB.rear0, k * WY + 4, NB.rear0, k * WY + 4 + WY);
    }
    const wallPal = ['#D9CDBD', '#B9C7CF', '#E3D3A8', '#C9A9A0', '#A9BFA8', '#E8E2D6'], roofPal = ['#5A4A44', '#4B5D6B', '#6E3B3B', '#3F3A3D'];
    for (let k = -R; k <= R; k++) {
      const s = nbHash(k + 11, 1), y0 = k * WY;
      if (k !== 0) rows.push({ key: vs(-NB.depth / 2, y0 + WY / 2), d: () => nbHouse(0, y0 + 1, y0 + WY - 1, 1, s > 0.45 ? 5.4 : 2.9, wallPal[(s * 6 | 0) % 6], roofPal[(s * 13 | 0) % 4], s) });
      const ry = k * WY + 4, rs = nbHash(k + 71, 1);
      rows.push({ key: vs(NB.rear0 + 10 + NB.depth / 2, ry + WY / 2), d: () => nbHouse(NB.rear0 + 10, ry + 1, ry + WY - 1, -1, rs > 0.45 ? 5.4 : 2.9, wallPal[(rs * 6 | 0) % 6], roofPal[(rs * 13 | 0) % 4], rs) });
      if (k !== 0) { const tx = 4.5 + Math.floor(nbHash(k, 8) * 3), ty = y0 + 4.5 + Math.floor(nbHash(k, 9) * 3); rows.push({ key: vs(tx, ty), d: () => nbTree(tx, ty, nbHash(k, 10)) }); if (nbHash(k, 12) > 0.5) rows.push({ key: vs(8, y0 + 2), d: () => nbShed(7, y0 + 1, nbHash(k, 13)) }); }
      const qx = NB.rear0 + 4.5 + Math.floor(nbHash(k, 14) * 4), qy = ry + 4.5 + Math.floor(nbHash(k, 15) * 3); rows.push({ key: vs(qx, qy), d: () => nbTree(qx, qy, nbHash(k, 16)) });
      if (nbHash(k, 17) > 0.5) rows.push({ key: vs(NB.rear0 + 2, ry + 2), d: () => nbShed(NB.rear0 + 1, ry + 1, nbHash(k, 18)) });
    }
    // Our own house behind the back wall: the upper floor and the roof above the wall the yard draws.
    rows.push({ key: vs(-NB.depth / 2, WY / 2), d: () => nbHouse(-0.3, 0, WY, 1, 5.4, '#D9CDBD', '#5A4A44', 0.5, { z0: 2.6 }) });
    // Utility poles down the lane's verge, in world space like everything else: the crossarm runs along the lane (so it slopes with the grid), and the wires sag to the next pole.
    for (let k = -R; k <= R; k++) { const px = NB.lane0 - 0.5, py = k * WY + 2; rows.push({ key: vs(px, py), d: () => nbPole(px, py, k % 2 === 0) }); }
    rows.sort((a, b) => a.key - b.key).forEach(r => r.d());
    }
  }
  // Haze toward the top (the light pass darkens it at night with the yard), then the edges fade to nothing, so the neighbourhood never ends on a line.
  function nbFinish() {
    const si = seasonIdx();
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.55); g.addColorStop(0, si === 3 ? 'rgba(228,234,240,.5)' : 'rgba(214,226,232,.42)'); g.addColorStop(1, 'rgba(214,226,232,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'destination-out';
    [[0, 0, 40, 0], [W, 0, W - 40, 0], [0, 0, 0, 36], [0, H, 0, H - 32]].forEach(([x0, y0, x1, y1]) => { const e = ctx.createLinearGradient(x0, y0, x1, y1); e.addColorStop(0, 'rgba(0,0,0,1)'); e.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = e; ctx.fillRect(0, 0, W, H); });
    ctx.globalCompositeOperation = 'source-over';
  }
  // The neighbourhood's lights, over everything lit: lit windows, the street lamps and the pools they make on the lane. They come up as it
  // gets dark and fade at dawn.
  function drawNbGlows() {
    const night = Math.max(0, Math.min(1, (darkness() - 0.05) / 0.3));
    if (night < 0.02 || !nbGlows.length) return;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const g of nbGlows) {
      if (g.pool) { ctx.save(); ctx.translate(g.x, g.y); ctx.scale(1, g.ry / g.rx); const gr = ctx.createRadialGradient(0, 0, 2, 0, 0, g.rx); gr.addColorStop(0, `rgba(${g.col},${g.a * night * 0.55})`); gr.addColorStop(1, `rgba(${g.col},0)`); ctx.fillStyle = gr; ctx.fillRect(-g.rx, -g.rx, g.rx * 2, g.rx * 2); ctx.restore(); continue; }
      const gr = ctx.createRadialGradient(g.x, g.y, 1, g.x, g.y, g.r); gr.addColorStop(0, `rgba(${g.col},${g.a * night})`); gr.addColorStop(1, `rgba(${g.col},0)`);
      ctx.fillStyle = gr; ctx.fillRect(g.x - g.r, g.y - g.r, g.r * 2, g.r * 2);
    }
    ctx.restore();
  }
  function drawBackdrop() {
    const key = `${VR}|${seasonIdx()}|${Math.round(darkness() * 20)}|${Math.floor(hour() * 2)}|${raining() ? 1 : 0}|${cv.width}`;
    if (nbBack.key !== key) {
      const keepCtx = ctx, keepOn = gOn;
      for (const part of ['ground', 'objects']) {
        const c2 = (nbBack[part] = nbBack[part] || document.createElement('canvas')).getContext('2d');
        nbBack[part].width = cv.width; nbBack[part].height = cv.height;
        c2.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
        ctx = c2; gOn = false;
        try { buildBackdrop(part); } finally { ctx = keepCtx; gOn = keepOn; }
      }
      nbBack.key = key;
    }
    ctx.drawImage(nbBack.ground, 0, 0, W, H);
    // Where rain lands past the fence it rings the ground, under the fences, sheds and houses, so a ripple can never sit on top of something tall.
    nbWet += ((raining() ? 1 : 0) - nbWet) * Math.min(1, rdt * 1.5);
    if (nbWet > 0.02 && !(weatherNow.snow ?? seasonIdx() === 3)) wfx.drawField(ctx, animT, nbRain('ground'));
    ctx.drawImage(nbBack.objects, 0, 0, W, H);
    nbFinish();
  }
  const nbRain = (part) => ({ part, occ: nbOcc, n: Math.round(dropCaps().rain * 2.2 * nbWet), snow: !!(weatherNow.snow ?? seasonIdx() === 3), W, H, TW, TH, ZH, skip: [iso(0, 0), iso(WX, 0), iso(WX, WY), iso(0, WY)] });
  // How many drops the quality tier allows, scaled by how heavy the rain is (light, medium, heavy).
  function dropCaps() {
    const base = tier() === 'high' ? { rain: 700, snow: 500 } : tier() === 'medium' ? { rain: 400, snow: 300 } : { rain: 200, snow: 150 };
    const k = { light: 0.2, medium: 0.45, heavy: 1 }[weatherNow.level] ?? 0.45;
    return { rain: Math.round(base.rain * k), snow: Math.round(base.snow * k) };
  }
  // The lot's outline on screen: its floor and the top of its walls, so the weather is clipped to the yard.
  function lotOutline() {
    const pts = [];
    for (const z of [0, WH]) for (const [x, y] of [[0, 0], [WX, 0], [WX, WY], [0, WY]]) pts.push(iso(x, y, z));
    return hull(pts);
  }
  function drawRain() { return; if (weatherNow.snow ?? seasonIdx() === 3) { ctx.save(); for (let k = 0; k < 80; k++) { const x = ((k * 97.3 + Math.sin(animT + k) * 20 + animT * 8) % W + W) % W, y = ((k * 53.7 + animT * 30) % H); circle(x, y, 1.2 + (k % 3) * 0.5, 'rgba(255,255,255,.85)'); } ctx.restore(); return; } ctx.save(); ctx.strokeStyle = 'rgba(200,215,235,.55)'; ctx.lineWidth = 1; ctx.beginPath(); for (let k = 0; k < 90; k++) { const x = ((k * 97.3 + animT * 40) % W), y = ((k * 53.7 + animT * 420) % H); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 10); } ctx.stroke(); ctx.restore(); }

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
  /**
   * Each room has a brightness of its own: with its light off a room sits darker than one whose light is on, at night
   * a lot darker and by day a little. A lit room gets a warm lift over the whole room, not just a pool round the lamp.
   * `lit` is the brightest light in the room, 0..1.
   */
  function roomAmbient(level, lights) {
    const a = levelDark(level);
    if (isOutdoor(level) && a < 0.05) return;
    LEVELS[level].rooms.forEach((rm) => {
      let lit = 0; const rn = roomFor(rm.n); lights.forEach((l) => { if (l.room === rn && l.s > lit) lit = l.s; });
      const dim = (1 - Math.min(1, lit)) * (0.05 + 0.55 * a), warm = Math.min(1, lit) * (0.03 + 0.2 * a);
      if (dim < 0.01 && warm < 0.01) return;
      // A soft patch over the middle of the room that fades out toward its edges, so neighbours blend and no box shows.
      const [a1, b1, a2, b2] = vrect(rm.r[0], rm.r[1], rm.r[2], rm.r[3]);
      const [cx, cy] = isoV((a1 + a2) / 2, (b1 + b2) / 2, 0.9), rx = ((a2 - a1) + (b2 - b1)) * TW * 0.62 + 20;
      const patch = (col, alpha, mode) => {
        ctx.save(); ctx.globalCompositeOperation = mode; ctx.transform(1, 0, 0, 0.72, 0, cy * 0.28);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
        g.addColorStop(0, `rgba(${col},${alpha})`); g.addColorStop(0.55, `rgba(${col},${alpha * 0.8})`); g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g; ctx.fillRect(cx - rx, cy - rx, rx * 2, rx * 2); ctx.restore();
      };
      if (dim >= 0.01) patch('10,8,28', Math.min(0.6, dim), 'source-over');
      // Soft-light so a pale room is warmed rather than burnt out, plus a little plain light so a dark room still lifts.
      if (warm >= 0.01) { patch('255,206,150', Math.min(0.4, warm * 1.3), 'soft-light'); patch('255,196,128', warm * 0.22, 'lighter'); }
    });
  }
  function lighting(level, lights, deferred) {
    const a = levelDark(level);
    // Outside, the light and the grade cover the whole view, so the neighbourhood is lit like the yard and the lot never shows as a lit block.
    ctx.save(); if (isOutdoor(level)) { ctx.beginPath(); ctx.rect(0, 0, W, H); } else roomPath(); ctx.clip();
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
    // Each TV that is on lights the room round it a little, in the colour of its picture.
    for (const o of OBJS) {
      const sc = STATE_TYPES[o.type]?.screen, lit = sc && o.level === level ? tvLit(o) : 0;
      if (lit < 0.02) continue;
      const [wx, wy] = xf(o, sc[0], sc[1]), [tx, ty] = iso(wx, wy, sc[2] + (o.z || 0)), hue = (animT * 25) % 360, g = ctx.createRadialGradient(tx, ty, 6, tx, ty, 60 + STATE_TYPES[o.type].W * 65);
      g.addColorStop(0, `hsla(${hue},70%,65%,${(0.12 + a * 0.5) * lit})`); g.addColorStop(1, 'hsla(0,0%,0%,0)');
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over';
    }
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
    roomAmbient(level, lights);
    ctx.restore();
  }

  function sync(s) {
    minutes = s.minutes; day = s.day; viewLevel = s.level; animT = s.t; rdt = s.dt;
    dimNow += (dimTarget - dimNow) * Math.min(1, rdt * 1.6);
    wallMode = s.wallMode || 'cut';
    OBJS = s.objs;
    { const ys = isOutdoor(s.level) ? 56 : 0; if (s.rot !== VR || ys !== YS) { VR = s.rot; YS = ys; setOrigin(); } }
    // Who's doing what, where: the stove steams while someone cooks, the
    // washer spins during laundry, the shower runs while they shower.
    const who = (c, name) => c ? { name, away: !!c.hidden && false, level: c.level, x: c.x, y: c.y,
      task: c.act ? { name: c.act, phase: 'do', slot: c.slot || null } : null, queue: [], needs: {} } : offstage();
    if (s.chars) { jordan = who(s.chars[0], 'Jordan'); maya = who(s.chars[1], 'Maya'); others = s.chars.slice(2).map((c) => who(c, 'visitor')); }
    // Arrange mode: walls come down, and the overlay below shows what can move.
    arrState = s.arrange || null;
    arranging = !!arrState;
    LAMPS = s.wallLamps || LAMPS; lampUi = s.lampUi || null;
    // Whoever is in a room has its light on (see wantLight).
    [jordan, maya].forEach(c => { if (!c || c.away || !c.level && c.level !== 0) return; const now = absMin(); occ[c.level + ':' + roomFor(roomName(c.level, c.x, c.y))] = now; occLevel[c.level] = now; });
  }

  function applySave(s) {
    if (!s || typeof s !== 'object') return;
    if (s.flags && typeof s.flags === 'object') flags = s.flags;
    if (Array.isArray(s.owned)) { owned = new Set(s.owned); }
    if (Array.isArray(s.LOOKS)) s.LOOKS.forEach((lk, i) => { if (LOOKS[i] && lk) Object.assign(LOOKS[i], lk); });
    if (Array.isArray(s.ROOMLOOK)) ROOMLOOK.forEach((r, i) => { Object.keys(r).forEach(k => delete r[k]); Object.assign(r, s.ROOMLOOK[i] || {}); });
    WALLOBJS.length = 0; (s.WALLOBJS || []).forEach(w => { if (w && WTYPES[w.type]) { if (!w.id) w.id = wallId(); WALLOBJS.push(w); } });
    WALLSTORE.length = 0; (s.WALLSTORE || []).forEach(w => { if (w && WTYPES[w.type]) { if (!w.id) w.id = wallId(); WALLSTORE.push(w); } });
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

  // A hand eases toward its target, but as an offset from the shoulder: eased on the screen, a walking body would
  // pull its hands along behind it, trailing by its speed over the rate.
  function ease2(ps, side, tx, ty, dt, rate = 9, ox = 0, oy = 0) {
    const k = Math.min(1, dt * rate);
    let a = ps.a[side];
    if (!a) { a = ps.a[side] = [tx - ox, ty - oy]; }
    a[0] += (tx - ox - a[0]) * k; a[1] += (ty - oy - a[1]) * k;
    return [a[0] + ox, a[1] + oy];
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
  // A star projector that is on dims its floor and throws constellations across the back walls, drifting slowly along.
  function drawStarfield(level, t) {
    if (!OBJS.some((o) => o.level === level && o.type === 'starprojector' && isLit(o.id))) return;
    ctx.save(); ctx.fillStyle = 'rgba(20,18,60,.32)'; ctx.fillRect(-4000, -4000, 8000, 8000);
    const plane = { L: (u, z) => [0.02, u, z], B: (u, z) => [u, 0.02, z], R: (u, z) => [WX - 0.02, u, z], F: (u, z) => [u, WY - 0.02, z] }, len = { L: WY, R: WY, B: WX, F: WX };
    for (const p of BACK[VR]) {
      const L = len[p], drift = t * 0.05, pts = [];
      for (let k = 0; k < L * 7; k++) { const u = ((k * 0.618 * 5.3 + drift) % L + L) % L, z = 0.35 + ((k * 0.414 * 3.7) % (WH - 0.5)), [sx, sy] = iso(...plane[p](u, z)), tw = 0.6 + 0.4 * Math.sin(t * 2 + k);
        ctx.globalAlpha = tw; star4(sx, sy, k % 9 === 0 ? 3 : 1.2, k % 5 === 0 ? '#FFF2B8' : '#E8E6FF'); if (k % 9 === 0) pts.push([sx, sy]); }
      // Constellations: each bright star joined to its nearest bright neighbour, and only when it is close.
      ctx.globalAlpha = 0.4; ctx.strokeStyle = '#D8D4FF'; ctx.lineWidth = 0.8; pts.forEach((a, i) => { let best = null, bd = 70; pts.forEach((b, j) => { if (j !== i) { const d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (d < bd) { bd = d; best = b; } } }); if (best) { ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...best); ctx.stroke(); } });
    }
    ctx.restore();
  }
  // Candles that catch or go out one after another: when the change started, and which way. With no change, the
  // piece's light decides (all lit or none).
  const candleFx = new Map(), CANDLE_STEP = 0.5;
  function candlesLitCount(id, t) { const fx = candleFx.get(id); if (!fx) return isLit(id) ? 5 : 0; const k = Math.floor((t - fx.at) / CANDLE_STEP); return fx.on ? Math.min(5, k + 1) : Math.max(0, 5 - k - 1); }
  const candleSmoke = (id, t, k) => { const fx = candleFx.get(id); return !!fx && !fx.on && t - fx.at < (5 - [2, 1, 3, 0, 4].indexOf(k)) * CANDLE_STEP + 2; };
  // Room service: a breakfast cart that rolls along a path to the bed, waits there, and rolls back out.
  let cart = null;
  const CART_SPEED = 1.1, CART_WAIT = 25;
  const pathLen = (pts) => pts.slice(1).reduce((s, p, k) => s + Math.hypot(p[0] - pts[k][0], p[1] - pts[k][1]), 0);
  function along(pts, d) { for (let k = 1; k < pts.length; k++) { const [a, b] = [pts[k - 1], pts[k]], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (d <= L || k === pts.length - 1) { const f = L ? Math.min(1, d / L) : 1; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, [b[0] - a[0], b[1] - a[1]]]; } d -= L; } return [pts[0][0], pts[0][1], [1, 0]]; }
  function cartAt(t) {
    if (!cart) return null;
    const L = pathLen(cart.pts), go = L / CART_SPEED, e = t - cart.at;
    if (e < 0) return null;
    if (e > go * 2 + CART_WAIT) { cart = null; return null; }
    const d = e < go ? e * CART_SPEED : e < go + CART_WAIT ? L : L - (e - go - CART_WAIT) * CART_SPEED;
    const [x, y, dir] = along(cart.pts, d);
    return { x, y, dir, parked: e >= go && e < go + CART_WAIT, lifted: e >= go + 2 };
  }
  // The cart: a trolley on brass legs and casters with a lower shelf, a white cloth skirt to the shelf, and on top a
  // silver cloche (lifted once it has arrived), a coffee pot, juice and a rose. Solid boxes, so nothing shows through.
  function drawCart(c, t) {
    const X = c.x, Y = c.y, [gx, gy] = iso(X, Y, 0);
    ell(gx, gy, 20, 9, 'rgba(0,0,0,.2)');
    [[-0.32, -0.2], [0.32, -0.2], [-0.32, 0.2], [0.32, 0.2]].forEach(([dx, dy]) => { line3([X + dx, Y + dy, 0.04], [X + dx, Y + dy, 0.72], HO.brass, 1.6); const [wx, wy] = iso(X + dx, Y + dy, 0.03); circle(wx, wy, 2.2, '#3A3A40'); });
    box(X - 0.34, Y - 0.22, 0.12, 0.68, 0.44, 0.03, '#C9CED6');
    box(X - 0.37, Y - 0.25, 0.4, 0.74, 0.5, 0.33, '#F4F1EA');
    box(X - 0.37, Y - 0.25, 0.73, 0.74, 0.5, 0.02, '#FFFFFF');
    const [cx, cy] = iso(X - 0.08, Y, 0.75); ctx.beginPath(); ctx.moveTo(cx - 9, cy); ctx.bezierCurveTo(cx - 9, cy - (c.lifted ? 4 : 12), cx + 9, cy - (c.lifted ? 4 : 12), cx + 9, cy); ctx.closePath(); ctx.fillStyle = '#D5DAE0'; ctx.fill(); ctx.strokeStyle = '#9AA3A8'; ctx.lineWidth = 0.8; ctx.stroke();
    if (c.lifted) { ell(cx, cy - 1, 7, 3, '#F2C14E'); circle(cx - 2, cy - 2, 2, '#FFF6D8'); } else circle(cx, cy - 12, 1.6, '#9AA3A8');
    box(X + 0.15, Y - 0.14, 0.75, 0.08, 0.08, 0.16, '#C9CED6'); box(X + 0.18, Y + 0.08, 0.75, 0.06, 0.06, 0.12, '#F4A93B');
    const [fx, fy] = iso(X + 0.06, Y + 0.16, 0.75); limb(fx, fy, fx, fy - 8, '#3F6B3A', 1); circle(fx, fy - 9, 2.2, '#B5243A');
    if (c.parked) PFX.emit('cart:coffee', 'steam', c.level, X + 0.19, Y - 0.1, 0.92, 0.4);
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
    // Walking, the hair swings once a stride, with the feet, not on a clock of its own.
    const sway = c.walking ? Math.sin(ph) * 2.2 * amp : Math.sin(t * 2.2 + c.seed * 3) * (idle ? 0.9 : 0.4);
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
    const SLEEVES = { tank: 0, tee: 0.55, jersey: 0.5, dress: 0.4, cheer: 0, cop: 0.55, scrubs: 0.55, hero: 0.55, uniform: 0.55, sundress: 0.4 };
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
      // Walking arms are the stride itself (amp fades the swing in and out), so they are not eased: an ease would put them a step behind the legs.
      const armRate = rig && rig.hands ? (rig.snap ? 28 : 12) : c.walking ? 1e4 : 9;
      const e = ease2(psA, side, tx, ty, rdt, clip.active ? Math.min(armRate, 4 + 9 * clip.e) : armRate, sx0, sy0);
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
    if ((L.topStyle === 'dress' || L.topStyle === 'sundress' || skirty) && !c.sit) {
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
        } else if (pat === 'letterman') {
          // A ribbed collar, the snap front and a letter on the chest.
          line([hl, -4.4], [hl, 4.4], A || '#f4f1ea', 2.2);
          line([hl - 1.5, 0], [-hl, 0], 'rgba(0,0,0,.3)', 0.7);
          [hl - 6, hl - 12, hl - 18].forEach(x => { ctx.fillStyle = A || '#f4f1ea'; ctx.beginPath(); ctx.arc(x, 0, 0.6, 0, 7); ctx.fill(); });
          line([hl - 7.5, -4.8], [hl - 12.5, -3.4], A || '#f4f1ea', 1.3); line([hl - 12.5, -3.4], [hl - 7.5, -2], A || '#f4f1ea', 1.3);
        } else if (pat === 'hero') {
          // A long scarf wound round the neck, one tail down the chest.
          line([hl, -4.6], [hl, 4.6], A || '#c2262e', 2.8);
          line([hl - 1.5, 2.2], [hl - 13, 3], A || '#c2262e', 2.2);
          line([hl - 13, 3], [hl - 15, 3.2], shade(A || '#c2262e', -0.3), 1.2);
        } else if (pat === 'cardigan') {
          // A shirt and bow tie under an open cardigan with buttons.
          tri([[hl, -2.6], [hl, 2.6], [hl - 10, 0]], '#f4f4f2');
          tri([[hl - 1, 0], [hl - 3.4, -1.9], [hl - 3.4, 1.9]], A || '#8a2d3b'); tri([[hl - 1, 0], [hl + 1.4, -1.9], [hl + 1.4, 1.9]], A || '#8a2d3b');
          [hl - 12, hl - 16, hl - 20].forEach(x => { ctx.fillStyle = shade(L.top, -0.35); ctx.beginPath(); ctx.arc(x, 0, 0.6, 0, 7); ctx.fill(); });
        } else if (pat === 'uniform') {
          // A sailor blouse: a V of skin, the wide white collar and a ribbon.
          tri([[hl, -3], [hl, 3], [hl - 8, 0]], L.skin);
          tri([[hl, -3.4], [hl - 2.5, -5.5], [hl - 10, -2], [hl - 8, 0]], '#f4f1ea'); tri([[hl, 3.4], [hl - 2.5, 5.5], [hl - 10, 2], [hl - 8, 0]], '#f4f1ea');
          tri([[hl - 8.6, 0], [hl - 11.4, -1.9], [hl - 11.4, 1.9]], A || '#c2262e');
        } else if (pat === 'doublet') {
          // A stiff lace ruff, a line of gold trim and buttons down the front.
          line([hl, -4.8], [hl, 4.8], '#f4f1ea', 3.2);
          line([hl - 3.5, 0], [-hl, 0], A || '#c9a24a', 1.1);
          [hl - 8, hl - 13, hl - 18].forEach(x => { ctx.fillStyle = A || '#c9a24a'; ctx.beginPath(); ctx.arc(x, 0, 0.7, 0, 7); ctx.fill(); });
        } else if (pat === 'sundress') {
          // A sweetheart neckline edged with lace and a sash at the waist.
          tri([[hl, -3.4], [hl, 3.4], [hl - 6, 0]], L.skin);
          line([hl, -3.6], [hl - 6.4, 0], A || '#f4f1ea', 0.9); line([hl, 3.6], [hl - 6.4, 0], A || '#f4f1ea', 0.9);
          line([-hl + 4, -5.5], [-hl + 4, 5.5], A || '#f4f1ea', 1.6);
        } else if (pat === 'bosssuit') {
          // The boss: white collar, a broad gold tie, wide lapels, two columns of gold buttons and a white pocket square.
          tri([[hl, -3.2], [hl, 3.2], [hl - 9.5, 0]], '#f2efe8');
          ctx.fillStyle = A || '#C9A24A'; ctx.fillRect(hl - 11, -1.3, 10.5, 2.6);
          line([hl, -4], [hl - 11, -1.6], 'rgba(0,0,0,.45)', 1); line([hl, 4], [hl - 11, 1.6], 'rgba(0,0,0,.45)', 1);
          ctx.fillStyle = '#E0B64A'; [hl - 4, hl - 7.5, hl - 11].forEach(x => [-2.6, 2.6].forEach(y => { ctx.beginPath(); ctx.arc(x, y, 0.85, 0, 7); ctx.fill(); }));
          ctx.fillStyle = '#f4f4f2'; ctx.fillRect(hl - 8.4, -5.2, 2.6, 1.7);
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
    if (s.weather) weatherNow = s.weather;
    // What the household is doing to the house (the power, the dishes, the fridge) comes in with every frame, so the art never shows stale state.
    if (s.house) { power = s.house.power; dishes = s.house.dishes; laundryPile = s.house.laundryPile; fridge = s.house.fridge; parcel = s.house.parcel || null; if (s.house.owned) owned = s.house.owned; }
    sync(s);
    // The pets, so the bowls and litter boxes can show what is in them.
    PETS.length = 0; if (s.pets) for (const p of s.pets) PETS.push(p);
    const t = animT, lv = viewLevel;
    const watcher = [jordan, maya].find(c => c && c.task && c.task.phase === 'do' && (c.task.name === 'tv' || c.task.name === 'movie'));
    if (watcher) tvWatchLevel = watcher.level;
    tvF += ((power && watcher ? 1 : 0) - tvF) * Math.min(1, rdt * 4);
    ctx.clearRect(0, 0, W, H);
    // Outside, the lot sits in its neighbourhood: the street and the neighbours' houses are drawn first, behind the yard.
    if (isOutdoor(lv)) drawBackdrop();
    ctx.save();
    const lights = activeLights(lv);
    PFX.step(rdt, isOutdoor(lv) ? [0.16 + (raining() ? 0.2 : 0), 0.06] : [0.015, 0], tier() === 'low' ? 0.5 : 1);
    // Winter snow builds up on the lawn while it snows, and only melts once spring comes.
    // Rain and snow fall in the yard's own space and land on the ground (see weatherFx.js).
    if (isOutdoor(lv)) wfx.step(rdt, { raining: raining(), snow: !!(weatherNow.snow ?? seasonIdx() === 3), top: (x, y) => (iso(x, y, 0)[1] + 30) / ZH + 0.5 + Math.random() * 0.8 }, YARD.tiles, dropCaps());
    if (isOutdoor(lv)) { const snowing = !!(weatherNow.snow ?? seasonIdx() === 3); for (const tt of YARD.tiles) { const sn = tt.snow || 0; tt.snow = snowing ? sn : Math.max(0, sn - rdt * 0.03); } }
    // Fall: leaves blow across the yard from the trees' side.
    if (isOutdoor(lv) && seasonIdx() === 2 && tier() !== 'low') {
      for (let i = 0; i < 3; i++) PFX.emit('leaves' + i, 'leaf', 3, 1 + i * 3.2, 0.6 + (i % 2) * 2.4, 2.2 + i * 0.3, 1);
    }
    const deferred = !!(G && opts.deferredLights && opts.deferredLights()) && tier() !== 'low';
    if (deferred) { G.begin(W, H, Math.min((cv.width / W) * (tier() === 'high' ? 0.75 : 0.5), 1600 / W)); ctx = G.wrap(ctx0); gOn = true; }
    try {
    drawWalls(lv); drawFloor(lv); decals(lv, t); drawFloorDirt(lv); drawStarfield(lv, t);
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
    { const c = cartAt(t); if (c && cart.level === lv) { const r = 0.3; items.push({ x1: c.x - r, y1: c.y - r, x2: c.x + r, y2: c.y + r, key: vs(c.x, c.y) + 0.0004, d: () => drawCart(Object.assign(c, { level: cart.level }), t) }); } }
    (s.pets || []).forEach(p => {
      if (p.level !== lv || p.hidden) return;
      const r = p.z > 0.05 ? 0.04 : 0.14;
      items.push({ x1: p.x - r, y1: p.y - r, x2: p.x + r, y2: p.y + r, key: vs(p.x, p.y) + 0.0005 + (p.z > 0.05 ? 0.3 : 0), d: () => { if (gOn) G.billboard(iso(p.x, p.y, 0)[1], ZH * 0.5, MATERIAL.body); drawPet(p, t); if (gOn) G.clearBase(); } });
    });
    depthSort(items).forEach(it => it.d());
    drawFrontWalls(lv); drawProjector(lv); drawObjectSpeech(lv, t);
    if (arrState) drawArrangeOverlay(arrState, lv);
    drawGuides(lv, t);
    drawRoomHint(lv, s.roomHint, t);
    drawPoofs(lv);
    drawSparkles(lv);
    } finally { gOn = false; ctx = ctx0; gMat = MATERIAL.matte; }
    drawParticles(lv, false);
    lighting(lv, lights, deferred);
    if (isOutdoor(lv)) drawNbGlows();
    drawParticles(lv, true);
    if (isOutdoor(lv)) drawRain();
    dofAmt += ((s.focus && tier() === 'high' ? 0.85 : 0) - dofAmt) * Math.min(1, rdt * 3);
    if (s.focus) lastFocus = s.focus;
    if (dofAmt > 0.02 && lastFocus) drawDof(lastFocus);
    ctx.restore();
    ctx.fillStyle = 'rgba(34,26,35,.55)'; ctx.font = '600 12px "IBM Plex Mono", ui-monospace, monospace'; ctx.textAlign = 'right'; ctx.fillText(LEVEL_NAMES[lv].toUpperCase(), W - 14, H - 12); ctx.textAlign = 'start';
  }

  // Paint, wallpaper and floors go on one room of a floor, or on the whole floor (`room` left out), which then puts every
  // room of it back to the one look. Paint goes over wallpaper, so painting takes the paper down where it goes.
  function restyle(level, room, set) {
    if (!LOOKS[level]) return;
    const rooms = ROOMLOOK[level];
    if (room && LEVELS[level].rooms.some((r) => r.n === room)) {
      rooms[room] = Object.assign(rooms[room] || {}, set);
      return;
    }
    Object.assign(LOOKS[level], set);
    for (const rn of Object.keys(rooms)) {
      for (const k of Object.keys(set)) delete rooms[rn][k];
      if (!Object.keys(rooms[rn]).length) delete rooms[rn];
    }
  }
  function applyPaint(level, color, room) { restyle(level, room, { paint: color, paper: null }); }
  function applyWallpaper(level, pattern, room) { restyle(level, room, { paper: pattern }); }
  function applyFloor(level, floor, room) { restyle(level, room, { floor }); }
  /** What a room (or, with no room, the whole floor) looks like: its paint, wallpaper and floor. */
  const roomLook = (level, room) => Object.assign({}, lookAt(level, room));
  /** Drapes on the windows of a floor ('' takes them down); kept with the house's looks, so they survive a reload. */
  function applyDrapes(level, style) { if (LOOKS[level]) { if (style) LOOKS[level].drapes = style; else delete LOOKS[level].drapes; } }
  // Pictures that can hang as wallpaper: { id, base (a matching tone, used while loading), url | stops }.
  function registerPictures(list) { list.forEach(p => { if (p && p.id && !PAPERS[p.id]) PAPERS[p.id] = { pat: 'image', base: p.base, url: p.url, stops: p.stops }; }); }
  const getLooks = () => LOOKS.map(l => Object.assign({}, l));
  // Everything the art owns that has to survive a reload: house looks (paint, wallpaper, floors, per-room
  // overrides), wall decor, and the yard's grass, weeds, burns and rain. The mirror image of applySave.
  const exportLooks = () => ({
    LOOKS: getLooks(),
    ROOMLOOK: ROOMLOOK.map(r => JSON.parse(JSON.stringify(r))),
    WALLOBJS: WALLOBJS.map(w => Object.assign({}, w)),
    WALLSTORE: WALLSTORE.map(w => Object.assign({}, w)),
    yard: { t: YARD.tiles.map(t => [t.len, t.water, t.weed, t.burn, t.mowedAt]), rainAt: YARD.rainAt, rainUntil: YARD.rainUntil, rainCheck: YARD.rainCheck },
  });
  const lookInfo = (kind, key) => (kind === 'paper' ? PAPERS[key] : kind === 'floor' ? FLOORS[key] : null) || null;
  function toggleObjectLight(id) { const next = objectLights.get(id) !== true; objectLights.set(id, next); return next; }
  let lastToggled = null;
  function toggleLightAt(level, sx, sy) {
    let best = null, bestDist = 34;
    LAMPS.forEach((L) => {
      if (L.level !== level || (L.onlyIn && flags.house !== L.onlyIn)) return;
      const q = iso(...(L.p === 'B' ? [L.u, 0.2, L.z] : [0.2, L.u, L.z])), d = Math.hypot(sx - q[0], sy - q[1]);
      if (d < bestDist) { bestDist = d; best = { kind: 'lamp', id: L.id }; }
    });
    WALL_LIGHTS.forEach((L, i) => {
      if (L.k === 'sconce' || L.level !== level || (L.need && !has(L.need)) || lightSkipped(L) || (L.onlyIn && flags.house !== L.onlyIn)) return;
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
    if (best.kind === 'lamp') { const next = wallLightOverrides.get(best.id) !== true; wallLightOverrides.set(best.id, next); return next; }
    if (best.kind === 'wall') { const next = wallLightOverrides.get(best.index) !== true; wallLightOverrides.set(best.index, next); return next; }
    return toggleObjectLight(best.id);
  }

  // The room the shop's paint, wallpaper and floors will go on: a soft tint and a dashed line round its floor.
  function drawRoomHint(level, name, t) {
    const rm = name && LEVELS[level]?.rooms.find((r) => r.n === name);
    if (!rm) return;
    const [x1, y1, x2, y2] = rm.r, pulse = 0.5 + 0.5 * Math.sin(t * 3), pts = [[x1, y1, 0.01], [x2, y1, 0.01], [x2, y2, 0.01], [x1, y2, 0.01]].map((p) => iso(...p));
    ctx.save(); ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
    ctx.fillStyle = `rgba(255,214,102,${0.08 + 0.06 * pulse})`; ctx.fill();
    ctx.setLineDash([6, 4]); ctx.strokeStyle = `rgba(255,214,102,${0.6 + 0.3 * pulse})`; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
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
    // A piece on a table starts at its top; one hung on a wall at the height it hangs.
    const [fw, fd] = fp(o), up = (o.z || 0) + (T_OF(o).mount ?? 0), h = (T_OF(o).h || 1) + (o.z || 0), pts = [];
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
    WALLOBJS.forEach((w) => {
      if (w.level !== level || !WTYPES[w.type] || !BACK[VR].includes(w.p)) return;
      const q = wallQuad(w), mine = w.id === a.wall;
      ctx.beginPath(); q.forEach((pt, i) => (i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1]))); ctx.closePath();
      ctx.strokeStyle = mine ? (a.wallValid === false ? 'rgba(220,70,60,.95)' : 'rgba(143,217,168,.95)') : 'rgba(214,74,122,.35)'; ctx.lineWidth = mine ? 2 : 1; ctx.setLineDash(mine ? [] : [4, 4]); ctx.stroke();
    });
    ctx.setLineDash([]);
    if (lampUi) LAMPS.forEach((L) => {
      if (L.level !== level || !BACK[VR].includes(L.p) || L.id === lampUi.id) return;
      const [x, y] = lampAt(L); ctx.beginPath(); ctx.ellipse(x, y, 17, 20, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(214,74,122,.45)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
    });
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
  const lampAt = (L, o = 0.12) => iso(...(L.p === 'B' ? [L.u, o, L.z] : [o, L.u, L.z]));
  /** The lamp under a screen point (the nearest one within a thumb's reach), or its id null. */
  function hitWallLamp(level, sx, sy) {
    let best = null, bestD = 26;
    LAMPS.forEach((L) => {
      if (L.level !== level || !BACK[VR].includes(L.p) || (L.onlyIn && flags.house !== L.onlyIn)) return;
      const [x, y] = lampAt(L), d = Math.hypot(sx - x, sy - y);
      if (d < bestD) { bestD = d; best = L.id; }
    });
    return best;
  }
  /**
   * Where a screen point falls on the walls you can see: { p, u, z } (which wall, how far along, how high), or null.
   * Each wall is a flat plane, so its screen position is linear in (u, z) and the point is found by solving for them.
   */
  function wallPointAt(level, sx, sy) {
    let best = null, bestScore = Infinity;
    ['B', 'L'].forEach((p) => {
      if (!BACK[VR].includes(p)) return;
      const at = (u, z) => iso(...(p === 'B' ? [u, 0, z] : [0, u, z]));
      const [x0, y0] = at(0, 0), [x1, y1] = at(1, 0), [x2, y2] = at(0, 1), ux = x1 - x0, uy = y1 - y0, zx = x2 - x0, zy = y2 - y0, det = ux * zy - uy * zx;
      if (Math.abs(det) < 1e-6) return;
      const u = ((sx - x0) * zy - (sy - y0) * zx) / det, z = (ux * (sy - y0) - uy * (sx - x0)) / det;
      const len = p === 'B' ? WX : WY;
      // How far outside the wall's face the point lies, so the nearest wall wins when the pointer is off both.
      const out = Math.max(0, -u, u - len) + Math.max(0, 0.3 - z, z - (WH + 0.2));
      if (out < bestScore) { bestScore = out; best = { p, u, z }; }
    });
    return best && bestScore < 1.2 ? best : null;
  }
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

  function flipTv(tv) {
    if (tvTapped.has(tv.id)) { tvTapped.delete(tv.id); return 'TV off.'; }
    tvTapped.add(tv.id); return 'The TV flickers on.';
  }
  function tvFor(host) {
    const on = OBJS.find((o) => o.on === host.id && STATE_TYPES[o.type]?.screen);
    if (on) return on;
    const [hw, hd] = fp(host), cx = host.x + hw / 2, cy = host.y + hd / 2;
    let best = null, bd = 1.6;
    for (const o of OBJS) {
      const sc = STATE_TYPES[o.type]?.screen;
      if (!sc || o.level !== host.level) continue;
      const [x, y] = xf(o, sc[0], sc[1]), d = Math.hypot(x - cx, y - cy);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  // Tapping an object brings it to life for a moment (or flips its switch).
  // Returns what happened, for the log, or null if it does nothing on a tap.
  function poke(o, part = '') {
    const run = (secs, msg) => { liveUntil.set(o.id + ':' + part, animT + secs); return msg; };
    switch (o.type) {
      case 'overseer': return 'The eye turns toward you.';
      case 'starprojector': { const on = toggleObjectLight(o.id); return on ? 'The room dims and the stars come out.' : 'The stars fade from the walls.'; }
      case 'shishiodoshi': return 'Water trickles in. The bamboo tips, spills, and knocks: tok.';
      case 'tallcandelabra': return isLit(o.id) ? 'The candle flames waver.' : 'Five fresh candles, waiting for a match.';
      case 'woodstove': { const on = toggleObjectLight(o.id); return on ? 'The kindling catches and the stove roars into life.' : 'The fire in the stove settles down to embers and goes out.'; }
      case 'glamtable': return run(4, 'The bulbs light up one after another round the mirror.');
      case 'hificonsole': return run(40, 'The lid lifts, the needle drops, and the room goes amber.');
      case 'musicbox': return run(30, 'The lid opens and a tinkly little tune starts to play.');
      case 'servicebell': return run(1.2, 'Ding!');
      case 'diffuser': return run(20, 'The diffuser hums and puffs out eucalyptus.');
      case 'walltv': case 'tvflat': case 'tvdesk': case 'tvtube': return flipTv(o);
      // A stand switches the TV on it, or the one on the wall above it.
      case 'tvunit': case 'mediaconsole': case 'entcenter': { const tv = tvFor(o); return tv ? flipTv(tv) : null; }
      case 'fireplace': if (fireOut.has(o.id)) { fireOut.delete(o.id); return 'The fire crackles back to life.'; } fireOut.add(o.id); return 'The fire dies down.';
      case 'laundry': return run(12, 'The washer churns into a spin cycle.');
      case 'records': return run(14, 'The needle drops. A record starts spinning.');
      case 'arcade': return run(6, 'The arcade lights up: INSERT COIN.');
      case 'clawmachine': return run(6, 'The claw swings out, drops, and comes up with a plush. Lucky.');
      case 'pinball': return run(8, 'The ball rockets off the plunger. Bumpers everywhere.');
      case 'cloudswing': return run(6, 'The swing rocks and the cloud bobs along.');
      case 'vrpod': return run(8, 'The pod lights up and a world loads.');
      case 'fortuneteller': return run(8, 'The crystal ball glows. A card drops: something good is coming.');
      case 'gumball': return run(4, 'A gumball rattles down the chute.');
      case 'tikibar': return run(8, 'The blender whirs and the torches flare.');
      case 'tread': return run(8, 'The treadmill belt whirs to life.');
      case 'shower': return run(8, 'The shower hisses on, then off.');
      case 'bathtub': return run(10, 'The tub fills with steaming water.');
      case 'toilet': return run(3, 'Flush.');
      case 'fridge': return run(3, 'The fridge door swings open. Snacks.');
      case 'chestfreezer': return run(3, 'The lid swings up on a breath of cold air.');
      case 'counter': {
        const msg = { sink: 'The faucet runs.', stove: 'Click, click, whoomph: the burner lights.', coffee: 'The coffee machine gurgles.' }[part];
        return msg ? run(part === 'stove' ? 8 : 5, msg) : null;
      }
      default: return null;
    }
  }

  // Shake a tree: it shudders, and what was ripe on it drops, bounces and is gone.
  function shakeTree(id, fell) { SHAKES.set(id, { t0: animT, n: fell }); }
  const setMeeting = (on) => { officeMeeting = !!on; };
  return { setMeeting, shakeTree, render, applySave, applyPaint, applyWallpaper, applyFloor, applyDrapes, roomLook, registerPictures, hangWallObj, wallObjsOn, wallObjsAll, hitWallObj, wallObjView, moveWallObj, wallObjClear, takeDownWallObj, storedWallObjs, rehangWallObj, getLooks, exportLooks, lookInfo, toggleObjectLight, objectLightOn: (id) => objectLights.get(id) === true, setObjectLight: (id, on) => { objectLights.set(id, !!on); }, toggleLightAt, setTalking, setMood, roomService: (level, pts) => { cart = { level, pts, at: animT }; }, roomServiceBusy: () => cart != null, candles: (id, on) => { candleFx.set(id, { on: !!on, at: animT }); objectLights.set(id, !!on); }, candlesOn: (id) => objectLights.get(id) === true, objectSay: (id, lines) => { speech.set(id, { lines: lines.slice(), at: animT }); }, objectPlaced, poke, lastToggledLight: () => lastToggled, reveal: (id) => arrive(id, 'pop'), drop: (id) => arrive(id, 'drop'), poof: (level, x, y) => { poofs.push({ t: 0, level, x, y }); for (let i = 0; i < 6; i++) sparkles.push({ t: i * -0.05, level, pt: [x + (i % 3 - 1) * 0.35, y + (Math.floor(i / 3) - 0.5) * 0.35, 0.5 + (i % 2) * 0.3] }); }, setDim: (v) => { dimTarget = Math.max(0, Math.min(0.42, v || 0)); }, burst: (level, x, y, z = 0.5) => { for (let i = 0; i < 6; i++) sparkles.push({ t: i * -0.08, level, pt: [x + (i % 3 - 1) * 0.4, y + (Math.floor(i / 3) - 0.5) * 0.4, z + (i % 2) * 0.3] }); }, spotlight: (ids) => { spotIds = Array.isArray(ids) ? ids : []; }, setGhost: (g) => { ghost = g || null; }, project: (x, y, z = 0) => iso(x, y, z), unproject: (sx, sy) => unIso(sx, sy), hitObject, hitWallLamp, wallPointAt, TYPES, WTYPES };
}

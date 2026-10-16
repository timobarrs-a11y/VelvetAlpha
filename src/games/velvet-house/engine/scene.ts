import { LEVELS, WX, WY, WH, type WallFeat, type WallSide } from '../state/house';
import { TYPES, footprint, type ObjectInstance } from '../state/objects';
import { isPatio, grassColor, type YardTile } from '../state/yard';
import { darkness, seasonIdx, absMin } from '../state/time';
import { BACK, FRONT, VIEW_W, VIEW_H, depthSort, planeLen, wallPoint, type DepthItem, type Projection, type Pt3 } from './projection';
import { Painter, shade, EDGE } from './painter';

interface FloorDef {
  kind: 'plank' | 'flat';
  a: string;
  b: string;
  line: string;
}

const FLOORS: Record<string, FloorDef> = {
  wood: { kind: 'plank', a: '#C9A27A', b: '#C09670', line: 'rgba(90,60,30,.22)' },
  concrete: { kind: 'flat', a: '#A7A29D', b: '#A7A29D', line: 'rgba(0,0,0,.06)' },
};

const LOOKS = [
  { paint: '#B9B4AF', floor: 'concrete' },
  { paint: '#E9DCCB', floor: 'wood' },
  { paint: '#E9DCCB', floor: 'wood' },
  { paint: '#D9CDBD', floor: 'wood' },
];

const TYPE_COLORS: Record<string, string> = {
  sofa: '#8A2D54', bed: '#E8DCC8', dining: '#9C6B45', lamp: '#E0A43A', plant: '#4F9460',
  tread: '#3A3A3F', gym: '#3D6B73', desk: '#B98A6A', dresser: '#B98A6A', nightstand: '#9C6B45',
  counter: '#F2EEE8', fridge: '#E4E7EA', tvunit: '#3A2E2A', shower: '#CFE3EA', toilet: '#F4F2EE',
  vanity: '#F2EEE8', waterheater: '#C9CED6', furnace: '#8C8884', laundry: '#F2EEE8',
  shelves: '#8A6A50', boxes: '#C9A27A', pbox: '#C9A27A', tree: '#3F7A3A', garden: '#6B4A35',
  sprinkler: '#4A88B8', bench: '#9C6B45', flightX: '#B98A6A', flightY: '#B98A6A',
};

export interface SceneInput {
  level: number;
  day: number;
  minutes: number;
  objs: ObjectInstance[];
  yardTiles: YardTile[];
  wallsUp: boolean;
  t: number;
}

const CUT_H = 0.32;
const IW = 0.12;

export function renderScene(ctx: CanvasRenderingContext2D, proj: Projection, s: SceneInput): void {
  const p = new Painter(ctx, proj);
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  const sky = s.level === 3 ? skyFor(s) : null;
  if (sky) {
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  if (s.level === 3) {
    drawYardBack(p, proj, s);
    drawYardGround(p, proj, s);
  } else {
    drawBackWalls(p, proj, s);
    drawFloor(p, proj, s.level);
  }

  const items: DepthItem[] = [];
  interiorWallItems(p, proj, s, items);
  s.objs.forEach((o) => {
    if (o.level === s.level && TYPES[o.type]) items.push(objectItem(p, proj, o, s));
  });
  depthSort(items, proj).forEach((it) => it.draw());

  if (s.level !== 3) drawFrontWalls(p, proj, s);
  drawDarkness(ctx, s);

  ctx.fillStyle = s.level === 3 || darkness(s.minutes / 60, s.day) > 0.25 ? 'rgba(255,253,248,.7)' : 'rgba(34,26,35,.55)';
  ctx.font = '600 12px "IBM Plex Mono", ui-monospace, monospace';
  ctx.textAlign = 'right';
  ctx.fillText(['BASEMENT', 'MAIN FLOOR', 'UPSTAIRS', 'BACKYARD'][s.level], VIEW_W - 14, VIEW_H - 12);
  ctx.textAlign = 'start';
}

function skyFor(s: SceneInput): string {
  const d = darkness(s.minutes / 60, s.day);
  const h = s.minutes / 60;
  if (d > 0.3) return '#2A2F55';
  if (h >= 17.5 && h < 21) return '#F0B98E';
  if (h < 7.5) return '#E9C7B5';
  return '#BFE2F0';
}

function windowGlass(s: SceneInput): string {
  const d = darkness(s.minutes / 60, s.day);
  return d > 0.3 ? '#2A2F55' : d > 0.1 ? '#E9C7B5' : '#BFE2F0';
}

function featQuad(f: WallFeat, inset = 0): Pt3[] {
  const [u0, u1] = f.u;
  const [z0, z1] = f.z;
  return [
    wallPoint(f.p, u0 + inset, z0 + inset),
    wallPoint(f.p, u1 - inset, z0 + inset),
    wallPoint(f.p, u1 - inset, z1 - inset),
    wallPoint(f.p, u0 + inset, z1 - inset),
  ];
}

function drawFeature(p: Painter, f: WallFeat, s: SceneInput): void {
  switch (f.k) {
    case 'window':
    case 'highwin':
    case 'extwin': {
      p.poly(featQuad(f), '#F7F3EE', EDGE, 0.8);
      p.poly(featQuad(f, 0.07), windowGlass(s));
      const mu = (f.u[0] + f.u[1]) / 2;
      p.line3(wallPoint(f.p, mu, f.z[0] + 0.07), wallPoint(f.p, mu, f.z[1] - 0.07), '#F7F3EE', 2);
      break;
    }
    case 'door':
      p.poly(featQuad({ ...f, u: [f.u[0] - 0.06, f.u[1] + 0.06], z: [0, f.z[1] + 0.05] }), '#EFE8DE');
      p.poly(featQuad(f), '#7A5236', EDGE, 0.8);
      break;
    case 'tv':
    case 'screen':
      p.poly(featQuad(f), '#1E1C22', EDGE, 0.8);
      p.poly(featQuad(f, 0.05), '#2E3340');
      break;
    case 'art':
    case 'hallart':
    case 'poster':
      p.poly(featQuad(f), '#3A2E2A');
      p.poly(featQuad(f, 0.06), f.k === 'poster' ? '#D24A7A' : '#C9A24A');
      break;
    case 'mirror':
      p.poly(featQuad(f), '#C9A24A');
      p.poly(featQuad(f, 0.05), '#DCE8EC');
      break;
    case 'tiles':
      p.poly(featQuad(f), '#E1ECEF', 'rgba(0,0,0,.08)', 0.6);
      break;
    case 'switch':
      p.poly(featQuad(f), '#F7F3EE', EDGE, 0.6);
      break;
  }
}

function drawBackWalls(p: Painter, proj: Projection, s: SceneInput): void {
  const c = LOOKS[s.level].paint;
  const back = BACK[proj.rot];
  const quad = (pl: WallSide, z0: number, z1: number): Pt3[] => [
    wallPoint(pl, 0, z0), wallPoint(pl, planeLen(pl), z0), wallPoint(pl, planeLen(pl), z1), wallPoint(pl, 0, z1),
  ];
  const basement = s.level === 0;
  back.forEach((pl, i) => {
    p.poly(quad(pl, 0, WH), i === 0 ? shade(c, -0.07) : c);
    const bh = basement ? 0.34 : 0.14;
    p.poly(quad(pl, 0, bh), basement ? (i === 0 ? '#7E7A77' : '#8C8884') : shade(c, i === 0 ? -0.32 : -0.26));
  });
  LEVELS[s.level].feats.forEach((f) => {
    if (back.includes(f.p)) drawFeature(p, f, s);
  });
  const tk = basement ? 0.36 : 0.16;
  const cap = basement ? '#77726E' : shade(c, -0.36);
  const vw = proj.viewW();
  const vd = proj.viewD();
  p.polyV([[-tk, -tk, WH], [vw, -tk, WH], [vw, 0, WH], [0, 0, WH], [0, vd, WH], [-tk, vd, WH]], cap);
  p.polyV([[vw, -tk, -0.25], [vw, 0, -0.25], [vw, 0, WH], [vw, -tk, WH]], basement ? '#5E5A57' : shade(c, -0.46));
  p.polyV([[-tk, vd, -0.25], [0, vd, -0.25], [0, vd, WH], [-tk, vd, WH]], basement ? '#86817C' : shade(c, -0.22));
}

function drawFloor(p: Painter, proj: Projection, level: number): void {
  const f = FLOORS[LOOKS[level].floor];
  for (let i = 0; i < WX; i++) {
    for (let j = 0; j < WY; j++) {
      const col = f.kind === 'plank' && j % 2 ? f.b : f.a;
      p.poly([[i, j, 0], [i + 1, j, 0], [i + 1, j + 1, 0], [i, j + 1, 0]], col, f.line, 0.8);
      if (f.kind === 'plank') {
        const off = (j * 0.37) % 1;
        if (off > 0.05) p.line3([i + off, j, 0.001], [i + off, j + 1, 0.001], f.line, 0.7);
      }
    }
  }
  const vw = proj.viewW();
  const vd = proj.viewD();
  p.polyV([[0, vd, 0], [vw, vd, 0], [vw, vd, -0.25], [0, vd, -0.25]], shade(f.a, -0.28));
  p.polyV([[vw, 0, 0], [vw, vd, 0], [vw, vd, -0.25], [vw, 0, -0.25]], shade(f.a, -0.42));

  if (level === 1) {
    const [x1, y1, x2, y2] = LEVELS[1].rug!;
    p.poly([[x1, y1, 0.01], [x2, y1, 0.01], [x2, y2, 0.01], [x1, y2, 0.01]], '#B5476E');
    p.poly([[x1 + 0.18, y1 + 0.18, 0.012], [x2 - 0.18, y1 + 0.18, 0.012], [x2 - 0.18, y2 - 0.18, 0.012], [x1 + 0.18, y2 - 0.18, 0.012]], null, '#E8C9A0', 1.2);
  }
  if (level === 2) {
    p.poly([[2.6, 0.9, 0.01], [4.6, 0.9, 0.01], [4.6, 3.0, 0.01], [2.6, 3.0, 0.01]], '#C8B6C9');
  }
}

function drawYardBack(p: Painter, proj: Projection, s: SceneInput): void {
  const back = BACK[proj.rot];
  const sid = '#D9CDBD';
  if (back.includes('L')) {
    p.poly([[0, 0, 0], [0, WY, 0], [0, WY, WH], [0, 0, WH]], shade(sid, -0.05));
    for (let z = 0.22; z < WH; z += 0.22) p.line3([0, 0, z], [0, WY, z], 'rgba(0,0,0,.09)', 1);
    p.poly([[0, 0, 0], [0, WY, 0], [0, WY, 0.3], [0, 0, 0.3]], '#8C8884');
    LEVELS[3].feats.forEach((f) => drawFeature(p, f, s));
    p.poly([[-0.3, -0.3, WH], [0.12, -0.3, WH], [0.12, WY, WH], [-0.3, WY, WH]], '#5A4A44');
  }
  back.filter((pl) => pl !== 'L').forEach((pl) => {
    const len = planeLen(pl);
    for (let u = 0; u <= len + 0.01; u += 0.2) {
      p.poly([wallPoint(pl, u, 0), wallPoint(pl, u + 0.13, 0), wallPoint(pl, u + 0.13, 1.15), wallPoint(pl, u + 0.065, 1.25), wallPoint(pl, u, 1.15)], '#EFE6D8', 'rgba(0,0,0,.12)', 0.6);
    }
    [0.3, 0.85].forEach((z) => p.poly([wallPoint(pl, 0, z), wallPoint(pl, len, z), wallPoint(pl, len, z + 0.08), wallPoint(pl, 0, z + 0.08)], '#DCD2C2'));
  });
}

function drawYardGround(p: Painter, proj: Projection, s: SceneInput): void {
  const si = seasonIdx(s.day);
  const now = absMin(s.day, s.minutes);
  s.yardTiles.forEach((t) => {
    const { i, j } = t;
    const q: Pt3[] = [[i, j, 0], [i + 1, j, 0], [i + 1, j + 1, 0], [i, j + 1, 0]];
    if (isPatio(i, j)) {
      p.poly(q, '#B9B2A8', 'rgba(80,70,60,.35)', 1);
      return;
    }
    p.poly(q, grassColor(t, si, now), 'rgba(40,70,30,.12)', 0.6);
    if ((t.snow || 0) > 0.05) p.poly(q.map(([x, y]) => [x, y, 0.004] as Pt3), `rgba(246,248,250,${Math.min(0.96, t.snow * 1.1)})`);
  });
  const vw = proj.viewW();
  const vd = proj.viewD();
  p.polyV([[0, vd, 0], [vw, vd, 0], [vw, vd, -0.25], [0, vd, -0.25]], '#6B4A35');
  p.polyV([[vw, 0, 0], [vw, vd, 0], [vw, vd, -0.25], [vw, 0, -0.25]], '#5A3E2E');
}

function interiorWallItems(p: Painter, proj: Projection, s: SceneInput, items: DepthItem[]): void {
  const c = LOOKS[s.level].paint;
  const h = s.wallsUp ? WH : CUT_H;
  LEVELS[s.level].walls.forEach((w) => {
    const r: [number, number, number, number] = w.x !== undefined
      ? [w.x - IW / 2, w.a, w.x + IW / 2, w.b]
      : [w.a, w.y! - IW / 2, w.b, w.y! + IW / 2];
    items.push({
      x1: r[0], y1: r[1], x2: r[2], y2: r[3],
      key: proj.depth((r[0] + r[2]) / 2, (r[1] + r[3]) / 2),
      draw: () => p.box(r[0], r[1], 0, r[2] - r[0], r[3] - r[1], h, c),
    });
  });
}

function objectItem(p: Painter, proj: Projection, o: ObjectInstance, s: SceneInput): DepthItem {
  const t = TYPES[o.type];
  const [fw, fd] = footprint(o);
  const col = o.col || TYPE_COLORS[o.type] || t.cols?.[0] || '#B98A6A';
  const base = { x1: o.x, y1: o.y, x2: o.x + fw, y2: o.y + fd, key: proj.depth(o.x + fw / 2, o.y + fd / 2) };
  const draw = (): void => {
    if (t.rug) {
      p.poly([[o.x, o.y, 0.01], [o.x + fw, o.y, 0.01], [o.x + fw, o.y + fd, 0.01], [o.x, o.y + fd, 0.01]], col, EDGE, 0.8);
    } else if (o.type === 'holeX' || o.type === 'holeY') {
      p.poly([[o.x, o.y, 0.002], [o.x + fw, o.y, 0.002], [o.x + fw, o.y + fd, 0.002], [o.x, o.y + fd, 0.002]], '#2B2228');
    } else if (o.type === 'flightX' || o.type === 'flightY') {
      drawStairs(p, o, fw, fd, col, s.wallsUp ? t.h : Math.min(t.h, 1.2));
    } else if (o.type === 'tree') {
      p.box(o.x + 0.55, o.y + 0.55, 0, 0.3, 0.3, 1.6, '#6B4A35');
      p.box(o.x, o.y, 1.6, fw, fd, 1.8, seasonIdx(s.day) === 2 ? '#D98F2B' : seasonIdx(s.day) === 3 ? '#E8EDF0' : col);
    } else if (o.type === 'plant' || o.type === 'garden') {
      p.box(o.x + 0.05, o.y + 0.05, 0, fw - 0.1, fd - 0.1, 0.35, o.pot || '#C26B4A');
      p.box(o.x, o.y, 0.35, fw, fd, Math.max(0.2, t.h - 0.35) * (o.type === 'garden' ? 0.3 + (o.grow || 0) : 1), col);
    } else {
      p.box(o.x, o.y, 0, fw, fd, t.h, col);
    }
  };
  return { ...base, draw };
}

function drawStairs(p: Painter, o: ObjectInstance, fw: number, fd: number, col: string, h: number): void {
  const steps = 10;
  const alongY = fd > fw;
  for (let k = 0; k < steps; k++) {
    const f = k / steps;
    const sz = (h * (k + 1)) / steps;
    if (alongY) p.box(o.x, o.y + fd - (f + 1 / steps) * fd, 0, fw, fd / steps, sz, shade(col, k % 2 ? -0.04 : 0));
    else p.box(o.x + f * fw, o.y, 0, fw / steps, fd, sz, shade(col, k % 2 ? -0.04 : 0));
  }
}

function drawFrontWalls(p: Painter, proj: Projection, s: SceneInput): void {
  const h = s.wallsUp ? WH : CUT_H;
  const sid = s.level === 0 ? '#8C8884' : '#D9CDBD';
  FRONT[proj.rot].forEach((pl) => {
    const r = pl === 'F' ? [0, WY, WX + 0.16, WY + 0.16]
      : pl === 'R' ? [WX, -0.16, WX + 0.16, WY + 0.16]
      : pl === 'L' ? [-0.16, -0.16, 0, WY + 0.16]
      : [-0.16, -0.16, WX + 0.16, 0];
    p.box(r[0], r[1], -0.25, r[2] - r[0], r[3] - r[1], h + 0.25, sid);
  });
}

function drawDarkness(ctx: CanvasRenderingContext2D, s: SceneInput): void {
  const d = darkness(s.minutes / 60, s.day);
  if (d <= 0) return;
  ctx.fillStyle = `rgba(16,18,48,${d})`;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

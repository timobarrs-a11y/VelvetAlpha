import type { HairStyle, HairTexture } from '../types/avatar-v2';
import { FaceGeometry, faceHalfWidthAt, chinY } from './faceGeometry';
import { shade } from './outfitRenderer';

// Hair in two layers, so it sits on the head instead of behind it:
//   back:  drawn before the body. Volume behind the head, long lengths behind
//          the shoulders, ponytails and buns.
//   front: drawn over the face. The cap that hugs the crown and ends at a real
//          hairline on the forehead, sideburns, and locks that frame the face.
// Strand texture is seeded, so a style draws the same way every time.

export interface HairRenderParams {
  hairStyle: HairStyle;
  hairTexture: HairTexture;
  hairColor: string;
  // A second colour for streaks through the hair, or 'none'.
  hairHighlight?: string;
  skinTone: string;
  geometry: FaceGeometry;
  idPrefix: string;
  // Seen from behind, long hair is the outside of the hair, not its shadowed underside.
  fromBehind?: boolean;
}

type Pt = [number, number];
type Hairline = 'natural' | 'high' | 'fringe' | 'sweep' | 'part' | 'center' | 'curly';
type Texture = 'straight' | 'wavy' | 'coily' | 'buzz' | 'locs' | 'braids' | 'slick' | 'twists' | 'parted';

interface HairSpec {
  v: number;            // height of the hair above the crown
  sv: number;           // width of the hair past the sides of the head
  sideY: number;        // where the cap ends at the sides, relative to face centre
  hairline: Hairline;
  texture: Texture;
  back?: { length: number; spread: number; edge: 'blunt' | 'soft' | 'curly' };
  locks?: { length: number; width: number };
  extra?: 'ponytail' | 'bun' | 'fade' | 'afro' | 'puff' | 'knots' | 'topknot' | 'mohawk';
  sideburn?: boolean;
  opacity?: number;
}

const STYLES: Record<HairStyle, HairSpec> = {
  buzz:       { v: 0.8, sv: 0.3, sideY: -4, hairline: 'natural', texture: 'buzz', sideburn: true, opacity: 0.85 },
  fade:       { v: 4.2, sv: 0, sideY: -4, hairline: 'natural', texture: 'straight', extra: 'fade', sideburn: true },
  short:      { v: 3.6, sv: 1, sideY: -3, hairline: 'part', texture: 'straight', sideburn: true },
  short_wavy: { v: 5.5, sv: 2, sideY: -1, hairline: 'sweep', texture: 'wavy', sideburn: true },
  slick_back: { v: 3.2, sv: 0.8, sideY: -3, hairline: 'high', texture: 'slick', sideburn: true },
  afro:       { v: 14, sv: 10, sideY: 5, hairline: 'curly', texture: 'coily', extra: 'afro' },
  locs_short: { v: 4, sv: 2, sideY: 2, hairline: 'natural', texture: 'locs', back: { length: 112, spread: 4, edge: 'blunt' }, locks: { length: 104, width: 7 } },
  bun:        { v: 2.6, sv: 0.8, sideY: -2, hairline: 'high', texture: 'slick', extra: 'bun' },
  ponytail:   { v: 2.6, sv: 0.8, sideY: -2, hairline: 'high', texture: 'slick', extra: 'ponytail' },
  sleek:      { v: 3, sv: 1.5, sideY: 2, hairline: 'center', texture: 'straight', back: { length: 122, spread: 4, edge: 'blunt' }, locks: { length: 110, width: 6.5 } },
  wavy:       { v: 5, sv: 3, sideY: 2, hairline: 'part', texture: 'wavy', back: { length: 124, spread: 7, edge: 'soft' }, locks: { length: 114, width: 7.5 } },
  curly:      { v: 8, sv: 7, sideY: 4, hairline: 'curly', texture: 'coily', back: { length: 108, spread: 10, edge: 'curly' }, locks: { length: 100, width: 8.5 } },
  braids:     { v: 2.6, sv: 1, sideY: 2, hairline: 'center', texture: 'braids', back: { length: 124, spread: 4, edge: 'blunt' }, locks: { length: 118, width: 5 } },
  locs:       { v: 4, sv: 2.5, sideY: 2, hairline: 'center', texture: 'locs', back: { length: 126, spread: 5, edge: 'blunt' }, locks: { length: 116, width: 7 } },
  // No hair at all: drawn as nothing (see renderHair).
  bald:       { v: 0, sv: 0, sideY: -4, hairline: 'natural', texture: 'buzz' },
  // Tight rows braided back from the hairline, flat to the head.
  cornrows:   { v: 1.4, sv: 0.3, sideY: -3, hairline: 'natural', texture: 'braids', sideburn: true },
  // Two-strand twists falling to the jaw.
  twists:     { v: 6, sv: 3.5, sideY: 3, hairline: 'curly', texture: 'twists', back: { length: 92, spread: 6, edge: 'curly' }, locks: { length: 88, width: 6.5 } },
  // Small coiled knots on a neatly parted, close scalp.
  bantu_knots:{ v: 1.6, sv: 0.4, sideY: -3, hairline: 'natural', texture: 'parted', extra: 'knots' },
  // Natural hair gathered into one round puff on top.
  high_puff:  { v: 2.4, sv: 0.6, sideY: -2, hairline: 'curly', texture: 'coily', extra: 'puff' },
  long_straight: { v: 3.4, sv: 1.6, sideY: 2, hairline: 'sweep', texture: 'straight', back: { length: 130, spread: 4, edge: 'soft' }, locks: { length: 122, width: 7 } },
  bob:        { v: 4.4, sv: 2.6, sideY: 3, hairline: 'part', texture: 'straight', back: { length: 86, spread: 4, edge: 'blunt' }, locks: { length: 84, width: 8 } },
  pixie:      { v: 4, sv: 1, sideY: -2, hairline: 'sweep', texture: 'straight' },
  bangs:      { v: 3.6, sv: 1.8, sideY: 2, hairline: 'fringe', texture: 'straight', back: { length: 124, spread: 4, edge: 'blunt' }, locks: { length: 114, width: 6.5 } },
  // Shaved sides, the rest tied in a small knot on the crown.
  top_knot:   { v: 3, sv: 0, sideY: -4, hairline: 'high', texture: 'slick', extra: 'topknot', sideburn: true },
  // Shaved sides under a long top swept to one side.
  undercut:   { v: 7, sv: 0, sideY: -4, hairline: 'sweep', texture: 'straight', extra: 'fade', sideburn: true },
  // A strip standing up down the middle; the sides are shaved.
  mohawk:     { v: 1, sv: 0, sideY: -4, hairline: 'natural', texture: 'buzz', extra: 'mohawk', opacity: 0.55 },
};

// Long hair takes on its texture: wavy hair has more body, coily much more.
function withTexture(spec: HairSpec, texture: HairTexture): HairSpec {
  if (!spec.back || spec.texture === 'locs' || spec.texture === 'braids' || spec.texture === 'coily' || spec.texture === 'twists') return spec;
  if (texture === 'wavy') return { ...spec, v: spec.v + 1.5, sv: spec.sv + 2, texture: 'wavy', back: { ...spec.back, spread: spec.back.spread + 3, edge: 'soft' } };
  if (texture === 'coily') return { ...spec, v: spec.v + 5, sv: spec.sv + 6, texture: 'coily', back: { ...spec.back, length: spec.back.length - 12, spread: spec.back.spread + 8, edge: 'curly' } };
  return spec;
}

function seeded(i: number, salt: number): number {
  const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

const f = (n: number) => n.toFixed(2);
const pt = ([x, y]: Pt) => `${f(x)},${f(y)}`;

function smooth(pts: Pt[], closed: boolean, tension = 1): string {
  const n = pts.length;
  const at = (i: number) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${pt(pts[0])}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1: Pt = [p1[0] + ((p2[0] - p0[0]) / 6) * tension, p1[1] + ((p2[1] - p0[1]) / 6) * tension];
    const c2: Pt = [p2[0] - ((p3[0] - p1[0]) / 6) * tension, p2[1] - ((p3[1] - p1[1]) / 6) * tension];
    d += ` C${pt(c1)} ${pt(c2)} ${pt(p2)}`;
  }
  return closed ? d + ' Z' : d;
}

interface Frame {
  T: number; W: number; cy: number; chin: number;
  hw: (y: number) => number;
}

// The outer edge of the hair over the top of the head, left side to right side.
function crownPoints(fr: Frame, s: HairSpec, sideY: number): Pt[] {
  const { T, W, hw } = fr;
  const v = s.v, sv = s.sv;
  const mid = T + (sideY - T) * 0.35;
  return [
    [50 - hw(sideY) - sv, sideY],
    [50 - Math.max(hw(mid), W * 0.95) - sv, mid - v * 0.25],
    [50 - W * 0.62 - sv * 0.6, T - v * 0.8],
    [50, T - v],
    [50 + W * 0.62 + sv * 0.6, T - v * 0.8],
    [50 + Math.max(hw(mid), W * 0.95) + sv, mid - v * 0.25],
    [50 + hw(sideY) + sv, sideY],
  ];
}

// The hairline, right side to left side.
function hairlinePoints(fr: Frame, kind: Hairline, sideY: number): { pts: Pt[]; part: number | null } {
  const { T, W, hw } = fr;
  const side = (s: 1 | -1, y: number): Pt => [50 + s * (hw(y) - 0.5), y];
  switch (kind) {
    case 'high':
      return { pts: [side(1, sideY), [50 + W * 0.66, T + 6], [50 + W * 0.3, T + 5.5], [50, T + 6.5], [50 - W * 0.3, T + 5.5], [50 - W * 0.66, T + 6], side(-1, sideY)], part: null };
    case 'fringe':
      return { pts: [side(1, sideY), [50 + W * 0.82, T + 15], [50 + W * 0.4, T + 19], [50, T + 19.5], [50 - W * 0.4, T + 19], [50 - W * 0.82, T + 15], side(-1, sideY)], part: null };
    case 'sweep':
      return { pts: [side(1, sideY), [50 + W * 0.7, T + 8], [50 + W * 0.3, T + 9], [50 - W * 0.1, T + 13], [50 - W * 0.55, T + 16.5], [50 - W * 0.86, T + 15], side(-1, sideY)], part: 50 + W * 0.32 };
    case 'part':
      return { pts: [side(1, sideY), [50 + W * 0.7, T + 8], [50 + W * 0.32, T + 7.4], [50, T + 8.6], [50 - W * 0.4, T + 9.4], [50 - W * 0.72, T + 8.8], side(-1, sideY)], part: 50 + W * 0.32 };
    case 'center':
      return { pts: [side(1, sideY), [50 + W * 0.72, T + 9.5], [50 + W * 0.3, T + 8.6], [50, T + 7.6], [50 - W * 0.3, T + 8.6], [50 - W * 0.72, T + 9.5], side(-1, sideY)], part: 50 };
    case 'curly':
    case 'natural':
    default:
      return { pts: [side(1, sideY), [50 + W * 0.7, T + 8], [50 + W * 0.3, T + 8.6], [50, T + 8.8], [50 - W * 0.3, T + 8.6], [50 - W * 0.7, T + 8], side(-1, sideY)], part: null };
  }
}

function capPath(crown: Pt[], hairline: Pt[]): string {
  // Out along the crown, back along the hairline, as one closed shape.
  return `${smooth(crown, false)} L${pt(hairline[0])} ${smooth(hairline, false).replace(/^M[^C]*/, '')} Z`;
}

// A strip that frames the face, from the temple down past the jaw.
function lockPoints(fr: Frame, s: 1 | -1, width: number, length: number, startY: number, wave: number): { outline: Pt[]; spine: Pt[] } {
  const ys = [startY, fr.cy, fr.chin - 6, fr.chin + 4, (fr.chin + length) / 2, length];
  const inner = ys.map((y, i) => {
    const edge = y < fr.chin - 4 ? fr.hw(y) - 2.2 : fr.hw(fr.chin - 6) - 3 - (i - 3) * 0.6;
    return 50 + s * edge + (i > 2 ? Math.sin(i * 1.7) * wave * s : 0);
  });
  const widths = ys.map((_, i) => width * (i === 0 ? 0.7 : i === ys.length - 1 ? 0.35 : 1 + i * 0.06));
  const out: Pt[] = ys.map((y, i) => [inner[i] + s * widths[i], y]);
  const inn: Pt[] = ys.map((y, i) => [inner[i], y]);
  const spine: Pt[] = ys.map((y, i) => [inner[i] + s * widths[i] * 0.5, y]);
  return { outline: [...out, ...inn.reverse()], spine };
}

export function renderHair(p: HairRenderParams): { back: React.ReactNode; front: React.ReactNode } {
  if (p.hairStyle === 'bald') return { back: null, front: null };
  const g = p.geometry;
  const s = withTexture(STYLES[p.hairStyle] ?? STYLES.short, p.hairTexture);
  const fr: Frame = {
    T: g.faceTop, W: g.fRx, cy: g.faceCenterY, chin: chinY(g),
    hw: (y: number) => faceHalfWidthAt(g, y),
  };
  const base = p.hairColor;
  const dark = shade(base, -0.32);
  const deep = shade(base, -0.5);
  const streak = p.hairHighlight && p.hairHighlight !== 'none' ? p.hairHighlight : null;
  // Highlights replace the usual lighter strands, and add a few broad streaks.
  const light = streak ?? shade(base, 0.28);
  const id = (k: string) => `${p.idPrefix}-hair-${k}`;
  const sideY = fr.cy + s.sideY;
  const crown = crownPoints(fr, s, sideY);
  const { pts: hairline, part } = hairlinePoints(fr, s.hairline, sideY);
  const cap = capPath(crown, hairline);
  const origin: Pt = [part ?? 50, fr.T - s.v * 0.4];

  // ---- texture inside the cap ----
  const capStrands: React.ReactNode[] = [];
  if (s.texture === 'buzz') {
    for (let i = 0; i < 260; i++) {
      const x = 50 - fr.W - 2 + seeded(i, 1) * (fr.W * 2 + 4);
      const y = fr.T - 2 + seeded(i, 2) * (sideY - fr.T + 2);
      capStrands.push(<circle key={i} cx={x} cy={y} r="0.32" fill={i % 4 === 0 ? light : deep} opacity="0.55" />);
    }
  } else if (s.texture === 'coily') {
    for (let i = 0; i < 70; i++) {
      const x = 50 - fr.W - s.sv + seeded(i, 3) * (2 * (fr.W + s.sv));
      const y = fr.T - s.v + seeded(i, 4) * (sideY - fr.T + s.v);
      const r = 1.1 + seeded(i, 5) * 1.1;
      capStrands.push(<path key={i} d={`M${f(x - r)},${f(y)} a${f(r)},${f(r)} 0 1 1 ${f(r * 1.6)},${f(r * 0.9)}`}
        stroke={i % 5 === 0 ? light : dark} strokeWidth="0.7" fill="none" opacity="0.7" strokeLinecap="round" />);
    }
  } else if (s.texture === 'parted') {
    // A close scalp sectioned into neat parts, one knot to each section.
    for (let i = 0; i < 160; i++) {
      const x = 50 - fr.W + seeded(i, 13) * fr.W * 2;
      const y = fr.T - 2 + seeded(i, 14) * (sideY - fr.T + 2);
      capStrands.push(<circle key={i} cx={x} cy={y} r="0.45" fill={deep} opacity="0.5" />);
    }
    [-0.45, 0, 0.45].forEach((k, i) => capStrands.push(
      <path key={`p${i}`} d={`M${f(50 + k * fr.W)},${f(fr.T + 8)} Q${f(50 + k * fr.W * 1.15)},${f(fr.T - 1)} ${f(50 + k * fr.W * 0.9)},${f(fr.T - 6)}`}
        stroke={shade(p.skinTone, -0.08)} strokeWidth="0.7" fill="none" opacity="0.8" />,
    ));
  } else if (s.texture === 'twists') {
    // Short twisted coils pointing out from the crown.
    for (let i = 0; i < 46; i++) {
      const a = Math.PI * (1.05 + seeded(i, 15) * 0.9);
      const r = 0.35 + seeded(i, 16) * 0.65;
      const x = 50 + Math.cos(a) * (fr.W + s.sv) * r, y = fr.T + 6 + Math.sin(a) * (s.v + 8) * r;
      capStrands.push(<path key={i} d={`M${f(x)},${f(y)} l${f(Math.cos(a) * 3)},${f(Math.sin(a) * 3)}`}
        stroke={i % 5 === 0 ? light : deep} strokeWidth="1.6" strokeDasharray="1 0.6" fill="none" opacity="0.75" strokeLinecap="round" />);
    }
  } else if (s.texture === 'braids' && !s.back) {
    // Cornrows: raised braided rows from the hairline to the crown, with
    // scalp showing in the parts between them.
    const rows = 9;
    for (let i = 0; i < rows; i++) {
      const t = (i + 0.5) / rows;
      const seg = t * (hairline.length - 1);
      const a = hairline[Math.floor(seg)], b = hairline[Math.min(hairline.length - 1, Math.floor(seg) + 1)];
      const k = seg - Math.floor(seg);
      const start: Pt = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k - 0.6];
      const end: Pt = [50 + (start[0] - 50) * 0.35, fr.T - s.v - 2];
      const mid: Pt = [start[0] + (start[0] - 50) * 0.12, (start[1] + end[1]) / 2];
      const d = `M${pt(start)} Q${pt(mid)} ${pt(end)}`;
      if (i > 0) {
        const pa = (t - 0.5 / rows);
        const ps = hairline[Math.round(pa * (hairline.length - 1))];
        capStrands.push(<path key={`pt${i}`} d={`M${f(ps[0])},${f(ps[1])} Q${f(ps[0] + (ps[0] - 50) * 0.12)},${f((ps[1] + end[1]) / 2)} ${f(50 + (ps[0] - 50) * 0.35)},${f(end[1])}`}
          stroke={shade(p.skinTone, -0.12)} strokeWidth="0.6" fill="none" opacity="0.7" />);
      }
      capStrands.push(<path key={`rw${i}`} d={d} stroke={dark} strokeWidth="2.6" fill="none" strokeLinecap="round" />);
      capStrands.push(<path key={`rb${i}`} d={d} stroke={i % 3 === 0 ? light : deep} strokeWidth="1.6" strokeDasharray="1.1 0.9" fill="none" opacity="0.8" />);
    }
  } else if (s.texture === 'braids') {
    // Cornrows running back from the hairline.
    hairline.slice(1, -1).forEach((h, i) => {
      for (let k = -1; k <= 1; k += 2) {
        const sx = h[0] + k * 2.2;
        capStrands.push(<path key={`${i}${k}`} d={`M${f(sx)},${f(h[1])} Q${f(sx + (sx - 50) * 0.15)},${f((h[1] + origin[1]) / 2)} ${f(50 + (sx - 50) * 0.5)},${f(fr.T - s.v)}`}
          stroke={deep} strokeWidth="0.7" fill="none" opacity="0.6" />);
      }
    });
  } else {
    const count = 26;
    const amp = s.texture === 'wavy' ? 1.8 : 0;
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      // A point along the hairline (or the cap's bottom edge at the sides).
      const seg = t * (hairline.length - 1);
      const a = hairline[Math.floor(seg)], b = hairline[Math.min(hairline.length - 1, Math.floor(seg) + 1)];
      const k = seg - Math.floor(seg);
      const end: Pt = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
      const bend = (end[0] - origin[0]) * 0.18;
      const mid: Pt = [(origin[0] + end[0]) / 2 + bend + Math.sin(i * 1.3) * amp, (origin[1] + end[1]) / 2 - 3];
      capStrands.push(<path key={i} d={`M${pt(origin)} Q${pt(mid)} ${pt(end)}`}
        stroke={i % 6 === 0 ? light : dark} strokeWidth={s.texture === 'slick' ? 0.6 : 0.8}
        fill="none" opacity={0.5 + seeded(i, 6) * 0.3} strokeLinecap="round" />);
    }
  }

  // A soft sheen across the crown, the classic cartoon highlight.
  const sheen = s.texture === 'buzz' || s.texture === 'coily' ? null : (
    <path d={`M${f(50 - fr.W * 0.55)},${f(fr.T - s.v * 0.35 + 3)} Q${f(origin[0] - 2)},${f(fr.T - s.v * 0.9 + 1)} ${f(50 + fr.W * 0.45)},${f(fr.T - s.v * 0.3 + 3.5)}`}
      stroke={light} strokeWidth="2.2" fill="none" opacity="0.35" strokeLinecap="round" />
  );

  const partLine = part === null || s.texture === 'coily' ? null : (
    <path d={`M${f(part)},${f(hairline[3][1] - 0.5)} L${f(origin[0] + (part > 50 ? 1 : 0))},${f(origin[1] + 1)}`}
      stroke={shade(p.skinTone, -0.05)} strokeWidth="0.6" opacity="0.6" strokeLinecap="round" />
  );

  // ---- back layer ----
  const back: React.ReactNode[] = [];

  if (s.extra === 'afro') {
    const rx = fr.W + s.sv, ryTop = s.v + (sideY - fr.T) * 0.5;
    const acy = fr.T + (sideY - fr.T) * 0.5;
    back.push(<ellipse key="afro" cx="50" cy={acy} rx={rx} ry={ryTop + (sideY - fr.T) * 0.15} fill={base} />);
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2;
      back.push(<circle key={`b${i}`} cx={50 + Math.cos(a) * rx * 0.97} cy={acy + Math.sin(a) * (ryTop + (sideY - fr.T) * 0.15) * 0.97}
        r={2.4 + seeded(i, 7) * 1.4} fill={i % 7 === 0 ? shade(base, 0.08) : base} />);
    }
    for (let i = 0; i < 90; i++) {
      const a = seeded(i, 8) * Math.PI * 2, r = Math.sqrt(seeded(i, 9));
      const x = 50 + Math.cos(a) * rx * r * 0.95, y = acy + Math.sin(a) * (ryTop + 4) * r * 0.95;
      const cr = 1 + seeded(i, 10) * 1.2;
      back.push(<path key={`c${i}`} d={`M${f(x - cr)},${f(y)} a${f(cr)},${f(cr)} 0 1 1 ${f(cr * 1.6)},${f(cr * 0.9)}`}
        stroke={i % 6 === 0 ? light : dark} strokeWidth="0.7" fill="none" opacity="0.6" />);
    }
  }

  if (s.back) {
    const { length, spread, edge } = s.back;
    const top = crownPoints(fr, s, sideY);
    const L = 50 - fr.W - s.sv, R = 50 + fr.W + s.sv;
    const bottom: Pt[] = [];
    const n = edge === 'blunt' ? 2 : 6;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = R + spread - (R - L + 2 * spread) * t;
      const y = length - (edge === 'curly' ? seeded(i, 11) * 6 : edge === 'soft' ? Math.sin(t * Math.PI * 3) * 2.5 : Math.sin(t * Math.PI) * 2);
      bottom.push([x, y]);
    }
    const outline: Pt[] = [...top, [R + spread * 0.6, (sideY + length) / 2], ...bottom, [L - spread * 0.6, (sideY + length) / 2]];
    back.push(<path key="mass" d={smooth(outline, true, 0.9)} fill={p.fromBehind ? base : dark} />);
    if (p.fromBehind && s.texture !== 'locs' && s.texture !== 'braids' && s.texture !== 'twists') {
      for (let i = 0; i < 14; i++) {
        const x = L - spread + ((R - L + 2 * spread) * (i + 0.5)) / 14;
        back.push(<path key={`fb${i}`} d={`M${f(50 + (x - 50) * 0.3)},${f(fr.T)} Q${f(x)},${f(fr.cy)} ${f(x + (x - 50) * 0.08)},${f(length - 3)}`}
          stroke={i % 4 === 0 ? light : dark} strokeWidth="0.8" fill="none" opacity="0.5" />);
      }
    }
    if (s.texture === 'locs' || s.texture === 'braids' || s.texture === 'twists') {
      const ropes = s.texture === 'twists' ? 12 : 9;
      for (let i = 0; i < ropes; i++) {
        const x = L - spread + ((R - L + 2 * spread) * (i + 0.5)) / ropes;
        back.push(<path key={`r${i}`} d={`M${f(x)},${f(sideY - 4)} Q${f(x + (x - 50) * 0.1)},${f((sideY + length) / 2)} ${f(x + (x - 50) * 0.15)},${f(length - 2)}`}
          stroke={base} strokeWidth={s.texture === 'locs' ? 5 : s.texture === 'twists' ? 3.4 : 4} fill="none" strokeLinecap="round" />);
        if (s.texture === 'twists') {
          back.push(<path key={`rt${i}`} d={`M${f(x)},${f(sideY - 4)} Q${f(x + (x - 50) * 0.1)},${f((sideY + length) / 2)} ${f(x + (x - 50) * 0.15)},${f(length - 2)}`}
            stroke={i % 4 === 0 ? light : deep} strokeWidth="1.4" strokeDasharray="1.2 1" fill="none" opacity="0.6" />);
        }
      }
    }
  }

  if (s.extra === 'ponytail') {
    const ax = 50 + fr.W * 0.7, ay = fr.T + 6;
    const tail: Pt[] = [[ax, ay - 3], [ax + 9, ay + 2], [ax + 12, fr.cy + 8], [ax + 8, fr.cy + 34], [ax + 3, fr.cy + 46], [ax + 2, fr.cy + 30], [ax + 4, fr.cy + 8], [ax, ay + 6]];
    back.push(<path key="tail" d={smooth(tail, true, 0.9)} fill={base} />);
    for (let i = 0; i < 6; i++) {
      back.push(<path key={`t${i}`} d={`M${f(ax + 2 + i)},${f(ay + 2)} Q${f(ax + 11 + i * 0.3)},${f(fr.cy + 10)} ${f(ax + 4 + i * 0.6)},${f(fr.cy + 40 - i * 2)}`}
        stroke={i % 3 === 0 ? light : dark} strokeWidth="0.6" fill="none" opacity="0.55" />);
    }
    back.push(<ellipse key="tie" cx={ax + 4} cy={ay + 3} rx="2.4" ry="3" fill={deep} />);
  }

  if (s.extra === 'puff') {
    // A round puff of coils on top, tied at its base.
    const py = fr.T - s.v - 5.5, pr = 11;
    back.push(<circle key="puff" cx="50" cy={py} r={pr} fill={base} />);
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2;
      back.push(<circle key={`pe${i}`} cx={50 + Math.cos(a) * pr * 0.96} cy={py + Math.sin(a) * pr * 0.96} r={2 + seeded(i, 17) * 1.2} fill={base} />);
    }
    for (let i = 0; i < 40; i++) {
      const a = seeded(i, 18) * Math.PI * 2, r = Math.sqrt(seeded(i, 19)) * pr * 0.9;
      const x = 50 + Math.cos(a) * r, y = py + Math.sin(a) * r, cr = 0.9 + seeded(i, 20);
      back.push(<path key={`pc${i}`} d={`M${f(x - cr)},${f(y)} a${f(cr)},${f(cr)} 0 1 1 ${f(cr * 1.6)},${f(cr * 0.9)}`}
        stroke={i % 6 === 0 ? light : dark} strokeWidth="0.7" fill="none" opacity="0.6" />);
    }
    back.push(<rect key="pband" x="44" y={py + pr - 2.5} width="12" height="2.4" rx="1.1" fill={deep} />);
  }

  // Five coiled knots across the top of the head. Drawn in the back layer
  // (for the view from behind) and again in front, where they sit on the head.
  const knotNodes: React.ReactNode[] = [];
  if (s.extra === 'knots') {
    const knots: Pt[] = [[50, fr.T - s.v - 3], [50 - fr.W * 0.6, fr.T + 2], [50 + fr.W * 0.6, fr.T + 2], [50 - fr.W * 0.9, fr.T + 11], [50 + fr.W * 0.9, fr.T + 11]];
    knots.forEach(([x, y], i) => {
      knotNodes.push(
        <g key={`k${i}`}>
          <circle cx={x} cy={y} r="5" fill={base} />
          <path d={`M${f(x + 3.4)},${f(y)} A3.4,3.4 0 1 1 ${f(x)},${f(y - 3.4)} A2,2 0 1 1 ${f(x - 1.6)},${f(y + 0.6)}`}
            stroke={dark} strokeWidth="0.8" fill="none" opacity="0.8" />
          <circle cx={x - 1.4} cy={y - 1.6} r="1.2" fill={light} opacity="0.35" />
        </g>,
      );
    });
    back.push(<g key="knots">{knotNodes}</g>);
  }

  if (s.extra === 'mohawk') {
    // The crest standing above the head, front to back.
    const crest: Pt[] = [[50 - 5, fr.T + 10], [50 - 6.5, fr.T - 2], [50 - 4, fr.T - 12], [50, fr.T - 15], [50 + 4, fr.T - 12], [50 + 6.5, fr.T - 2], [50 + 5, fr.T + 10]];
    back.push(<path key="crest" d={smooth(crest, true, 0.9)} fill={base} />);
    for (let i = 0; i < 7; i++) {
      const x = 50 - 4.5 + i * 1.5;
      back.push(<path key={`cr${i}`} d={`M${f(x)},${f(fr.T + 6)} Q${f(x + (x - 50) * 0.2)},${f(fr.T - 6)} ${f(50 + (x - 50) * 0.5)},${f(fr.T - 13)}`}
        stroke={i % 3 === 0 ? light : dark} strokeWidth="0.7" fill="none" opacity="0.6" />);
    }
  }

  if (s.extra === 'bun' || s.extra === 'topknot') {
    const small = s.extra === 'topknot';
    const by = fr.T - s.v - (small ? 4.5 : 6.5);
    back.push(<circle key="bun" cx="50" cy={by} r={small ? 6 : 9} fill={base} />);
    for (let i = 0; i < 4; i++) {
      back.push(<path key={`s${i}`} d={`M${f(43 + i)},${f(by + 3 - i)} Q50,${f(by - 9 + i * 1.5)} ${f(57 - i)},${f(by + 1 + i)}`}
        stroke={i % 2 ? light : dark} strokeWidth="0.7" fill="none" opacity="0.6" />);
    }
    back.push(<rect key="band" x={small ? 46 : 44} y={by + (small ? 4 : 6.5)} width={small ? 8 : 12} height="2.2" rx="1" fill={deep} />);
  }

  // ---- front layer ----
  const front: React.ReactNode[] = [];
  const capClip = id('cap');
  const isFade = s.extra === 'fade' || s.extra === 'topknot';
  const capFill = isFade ? `url(#${id('fade')})` : base;

  front.push(
    <defs key="defs">
      <clipPath id={capClip}><path d={cap} /></clipPath>
      {isFade && (
        <linearGradient id={id('fade')} gradientUnits="userSpaceOnUse" x1="0" y1={fr.T} x2="0" y2={sideY}>
          <stop offset="0.35" stopColor={base} stopOpacity="1" />
          <stop offset="1" stopColor={base} stopOpacity="0.3" />
        </linearGradient>
      )}
    </defs>,
  );

  // Hair sits on skin: a faint shadow under the hairline.
  front.push(<path key="contact" d={smooth(hairline, false)} stroke={shade(p.skinTone, -0.4)} strokeWidth="1.8" fill="none" opacity="0.22" style={{ filter: 'blur(0.6px)' }} />);

  if (s.sideburn) {
    // A narrow wedge from the temple down in front of the ear, tapering out.
    const top = sideY - 1.5, bot = fr.cy + 5;
    for (const sd of [-1, 1] as const) {
      const ot = 50 + sd * (fr.hw(top) + 0.2), ob = 50 + sd * (fr.hw(bot) + 0.2);
      front.push(<path key={`sb${sd}`}
        d={`M${f(ot)},${f(top)} L${f(ot - sd * 2.4)},${f(top)} Q${f(ob - sd * 2)},${f((top + bot) / 2)} ${f(ob - sd * 0.5)},${f(bot)} L${f(ob)},${f(bot)} Z`}
        fill={base} opacity={isFade ? 0.35 : 0.85} />);
    }
  }

  front.push(<path key="cap" d={cap} fill={capFill} opacity={s.opacity ?? 1} />);
  front.push(
    <g key="tex" clipPath={`url(#${capClip})`}>
      {capStrands}
      {sheen}
    </g>,
  );
  if (partLine) front.push(<g key="part">{partLine}</g>);

  if (knotNodes.length) front.push(<g key="knots">{knotNodes}</g>);

  if (s.extra === 'mohawk') {
    // The strip running over the top of the head to the forehead.
    const strip: Pt[] = [[50 - 4.5, fr.T + 9], [50 - 5.5, fr.T + 2], [50 - 4, fr.T - 3], [50, fr.T - 4.5], [50 + 4, fr.T - 3], [50 + 5.5, fr.T + 2], [50 + 4.5, fr.T + 9], [50, fr.T + 10]];
    front.push(<path key="strip" d={smooth(strip, true, 0.9)} fill={base} />);
    for (let i = 0; i < 6; i++) {
      const x = 50 - 3.6 + i * 1.45;
      front.push(<path key={`st${i}`} d={`M${f(x)},${f(fr.T + 9)} L${f(50 + (x - 50) * 0.7)},${f(fr.T - 3)}`}
        stroke={i % 3 === 0 ? light : dark} strokeWidth="0.6" opacity="0.55" />);
    }
  }

  if (streak && s.texture !== 'buzz' && s.texture !== 'parted') {
    // Highlights: a few broad streaks from the crown to the hairline.
    front.push(
      <g key="streaks" clipPath={`url(#${capClip})`}>
        {[0.2, 0.45, 0.72].map((t, i) => {
          const h = hairline[Math.round(t * (hairline.length - 1))];
          return <path key={i} d={`M${pt(origin)} Q${f((origin[0] + h[0]) / 2 + (h[0] - origin[0]) * 0.2)},${f((origin[1] + h[1]) / 2 - 3)} ${pt(h)}`}
            stroke={streak} strokeWidth="2.2" fill="none" opacity="0.6" strokeLinecap="round" />;
        })}
      </g>,
    );
  }

  if (s.hairline === 'curly' || s.texture === 'coily') {
    // A soft, curly hairline instead of a hard edge.
    hairline.slice(1, -1).forEach((h, i) => {
      front.push(<circle key={`cl${i}`} cx={h[0]} cy={h[1] - 0.3} r={1.8 + seeded(i, 12) * 0.8} fill={base} />);
    });
  }

  if (s.locks) {
    const wave = s.texture === 'wavy' ? 1.6 : s.texture === 'coily' ? 2.4 : 0;
    for (const sd of [-1, 1] as const) {
      const { outline, spine } = lockPoints(fr, sd, s.locks.width, s.locks.length, fr.T + 10, wave);
      const lockId = id(`lock${sd}`);
      front.push(
        <g key={`lock${sd}`}>
          <defs><clipPath id={lockId}><path d={smooth(outline, true, 0.85)} /></clipPath></defs>
          <path d={smooth(outline, true, 0.85)} fill={base} />
          <g clipPath={`url(#${lockId})`}>
            {s.texture === 'locs' || s.texture === 'braids' || s.texture === 'twists'
              ? [-1, 0, 1].map((k) => (
                <path key={k} d={smooth(spine.map(([x, y]) => [x + k * s.locks!.width * 0.3, y] as Pt), false)}
                  stroke={k === 0 ? dark : deep} strokeWidth={s.texture === 'locs' ? 2.2 : 1.6}
                  strokeDasharray={s.texture === 'braids' ? '2 1.4' : s.texture === 'twists' ? '1.2 1' : '3.5 0.9'} fill="none" opacity="0.7" />
              ))
              : [-0.35, -0.1, 0.15, 0.4].map((k, i) => (
                <path key={k} d={smooth(spine.map(([x, y], j) => [x + k * s.locks!.width + (s.texture === 'coily' ? Math.sin(j * 2 + i) * 1.5 : 0), y] as Pt), false)}
                  stroke={i % 3 === 0 ? light : dark} strokeWidth="0.7" fill="none" opacity="0.55" />
              ))}
            <path d={smooth(spine.map(([x, y]) => [x - sd * s.locks!.width * 0.2, y] as Pt), false)}
              stroke={light} strokeWidth={streak ? 2 : 1.4} fill="none" opacity={streak ? 0.55 : 0.25} />
          </g>
        </g>,
      );
    }
  }

  return { back: <g>{back}</g>, front: <g>{front}</g> };
}

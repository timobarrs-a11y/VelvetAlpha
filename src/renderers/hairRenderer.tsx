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
  // Rope styles: curly ends (boho braids, goddess locs), loose curly wisps
  // between the ropes, criss-cross parts on the scalp, thicker ropes.
  ends?: 'curly';
  wisps?: boolean;
  parts?: 'crisscross';
  ropeScale?: number;
}

const STYLES: Record<HairStyle, HairSpec> = {
  buzz:       { v: 0.8, sv: 0.3, sideY: -4, hairline: 'natural', texture: 'buzz', sideburn: true, opacity: 0.85 },
  fade:       { v: 4.2, sv: 0, sideY: -4, hairline: 'natural', texture: 'straight', extra: 'fade', sideburn: true },
  short:      { v: 3.6, sv: 1, sideY: -3, hairline: 'part', texture: 'straight', sideburn: true },
  short_wavy: { v: 5.5, sv: 2, sideY: -1, hairline: 'sweep', texture: 'wavy', sideburn: true },
  slick_back: { v: 3.2, sv: 0.8, sideY: -3, hairline: 'high', texture: 'slick', sideburn: true },
  afro:       { v: 14, sv: 10, sideY: 5, hairline: 'curly', texture: 'coily', extra: 'afro' },
  locs_short: { v: 4, sv: 2, sideY: 2, hairline: 'natural', texture: 'locs', back: { length: 112, spread: 4, edge: 'blunt' }, locks: { length: 104, width: 9 } },
  bun:        { v: 2.6, sv: 0.8, sideY: -2, hairline: 'high', texture: 'slick', extra: 'bun' },
  ponytail:   { v: 2.6, sv: 0.8, sideY: -2, hairline: 'high', texture: 'slick', extra: 'ponytail' },
  sleek:      { v: 3, sv: 1.5, sideY: 2, hairline: 'center', texture: 'straight', back: { length: 122, spread: 4, edge: 'blunt' }, locks: { length: 110, width: 6.5 } },
  wavy:       { v: 5, sv: 3, sideY: 2, hairline: 'part', texture: 'wavy', back: { length: 124, spread: 7, edge: 'soft' }, locks: { length: 114, width: 7.5 } },
  curly:      { v: 8, sv: 7, sideY: 4, hairline: 'curly', texture: 'coily', back: { length: 108, spread: 10, edge: 'curly' }, locks: { length: 100, width: 8.5 } },
  braids:     { v: 2.6, sv: 1, sideY: 2, hairline: 'center', texture: 'braids', back: { length: 124, spread: 4, edge: 'blunt' }, locks: { length: 118, width: 9.5 } },
  locs:       { v: 4, sv: 2.5, sideY: 2, hairline: 'center', texture: 'locs', back: { length: 126, spread: 5, edge: 'blunt' }, locks: { length: 116, width: 10 } },
  // No hair at all: drawn as nothing (see renderHair).
  bald:       { v: 0, sv: 0, sideY: -4, hairline: 'natural', texture: 'buzz' },
  // Tight rows braided back from the hairline, flat to the head.
  cornrows:   { v: 1.4, sv: 0.3, sideY: -3, hairline: 'natural', texture: 'braids', sideburn: true },
  // Two-strand twists falling to the jaw.
  twists:     { v: 4.5, sv: 2.5, sideY: 3, hairline: 'center', texture: 'twists', back: { length: 94, spread: 5, edge: 'soft' }, locks: { length: 92, width: 9 } },
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
  // Knotless braids that finish in loose curls, with curly pieces left out.
  boho_braids:   { v: 2.6, sv: 1, sideY: 2, hairline: 'center', texture: 'braids', back: { length: 126, spread: 6, edge: 'soft' }, locks: { length: 118, width: 10 }, ends: 'curly', wisps: true },
  // Soft locs with curly pieces along them and curly ends.
  goddess_locs:  { v: 4, sv: 2.5, sideY: 2, hairline: 'part', texture: 'locs', back: { length: 126, spread: 6, edge: 'soft' }, locks: { length: 116, width: 10.5 }, ends: 'curly', wisps: true },
  // Thick twisted locs from a criss-cross parted scalp.
  barrel_twists: { v: 4, sv: 1.5, sideY: 1, hairline: 'natural', texture: 'twists', back: { length: 102, spread: 3, edge: 'soft' }, locks: { length: 98, width: 9 }, parts: 'crisscross', ropeScale: 1.5 },
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

// One braid, twist or loc: two strands wrapped round each other, drawn as
// alternating dark segments either side of the centre, with a soft shine.
// `period` is the length of one wrap: tight for braids, longer for locs.
interface RopeColors { base: string; dark: string; deep: string; light: string }
function twistedRope(key: string, d: string, w: number, c: RopeColors, period: number, shine = c.light, shineStrong = false): React.ReactNode {
  const half = `${f(period / 2)} ${f(period / 2)}`;
  return (
    <g key={key}>
      {/* A dark edge all round, so each rope stands apart from the next and ends round. */}
      <path d={d} stroke={shade(c.base, -0.62)} strokeWidth={w + 0.9} fill="none" strokeLinecap="round" opacity="0.85" />
      <path d={d} stroke={c.base} strokeWidth={w} fill="none" strokeLinecap="round" />
      <path d={d} stroke={c.dark} strokeWidth={w * 0.5} strokeDasharray={half} fill="none" opacity="0.75" transform={`translate(${f(-w * 0.22)} 0)`} />
      <path d={d} stroke={c.deep} strokeWidth={w * 0.5} strokeDasharray={half} strokeDashoffset={f(period / 2)} fill="none" opacity="0.6" transform={`translate(${f(w * 0.22)} 0)`} />
      <path d={d} stroke={shine} strokeWidth={w * (shineStrong ? 0.3 : 0.16)} fill="none" opacity={shineStrong ? 0.8 : 0.35} transform={`translate(${f(-w * 0.3)} 0)`} />
    </g>
  );
}

const ROPE_PERIOD = { braids: 2.4, twists: 2.8, locs: 3.8 } as const;

// A soft cluster of curls finishing a rope (boho braids, goddess locs).
function curlyEnd(key: string, x: number, y: number, w: number, c: RopeColors): React.ReactNode {
  return (
    <g key={key}>
      {[-1, 0, 1].map((k) => {
        const cx = x + k * w * 0.55, cy = y + 1.2 + Math.abs(k) * -0.6, r = w * 0.55;
        return <path key={k} d={`M${f(cx - r)},${f(cy - r)} a${f(r)},${f(r)} 0 1 0 ${f(r * 1.4)},${f(r * 1.6)} a${f(r * 0.6)},${f(r * 0.6)} 0 1 1 ${f(-r * 0.6)},${f(r * 1.2)}`}
          stroke={k === 0 ? c.base : c.dark} strokeWidth={w * 0.42} fill="none" strokeLinecap="round" />;
      })}
    </g>
  );
}

// A loose curly piece hanging beside the ropes.
function curlyWisp(key: string, x: number, y0: number, y1: number, c: RopeColors, salt: number): React.ReactNode {
  let d = `M${f(x)},${f(y0)}`;
  const steps = Math.max(3, Math.round((y1 - y0) / 4));
  for (let i = 1; i <= steps; i++) {
    const y = y0 + ((y1 - y0) * i) / steps;
    d += ` Q${f(x + (i % 2 ? 1.6 : -1.6))},${f(y - 2)} ${f(x + (seeded(i, salt) - 0.5) * 0.8)},${f(y)}`;
  }
  return (
    <g key={key}>
      <path d={d} stroke={c.dark} strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <path d={d} stroke={c.light} strokeWidth="0.35" fill="none" opacity="0.45" />
    </g>
  );
}
const isRope = (t: string): t is keyof typeof ROPE_PERIOD => t in ROPE_PERIOD;

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

// Styles are drawn for the default face (half width 28, chin near 86). When
// the face sliders change the head, volume and widths follow the face width,
// and lengths stay the same distance from the chin, so hair keeps its
// proportions instead of clashing with a wider jaw or a longer face.
const BASE_W = 28, BASE_CHIN = 86;
function fitToFace(spec: HairSpec, fr: Frame): HairSpec {
  const k = fr.W / BASE_W, dy = fr.chin - BASE_CHIN;
  return {
    ...spec,
    sv: spec.sv * k,
    back: spec.back && { ...spec.back, length: spec.back.length + dy, spread: spec.back.spread * k },
    locks: spec.locks && { ...spec.locks, length: spec.locks.length + dy, width: spec.locks.width * k },
  };
}

// A strip that frames the face, from the temple down past the jaw.
function lockPoints(fr: Frame, s: 1 | -1, width: number, length: number, startY: number, wave: number): { outline: Pt[]; spine: Pt[] } {
  const ys = [startY, fr.cy, fr.chin - 6, fr.chin + 4, (fr.chin + length) / 2, length];
  // Hair falls straight from the widest point above it; it never tucks in to
  // follow a narrow jaw onto the cheeks.
  let widest = 0;
  const inner = ys.map((y, i) => {
    widest = Math.max(widest, fr.hw(Math.min(y, fr.chin - 6)));
    const edge = y <= fr.cy ? fr.hw(y) - 2.2 : widest - 1.6 - Math.max(0, i - 3) * 0.4;
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
  const fr: Frame = {
    T: g.faceTop, W: g.fRx, cy: g.faceCenterY, chin: chinY(g),
    hw: (y: number) => faceHalfWidthAt(g, y),
  };
  const s = fitToFace(withTexture(STYLES[p.hairStyle] ?? STYLES.short, p.hairTexture), fr);
  const base = p.hairColor;
  const dark = shade(base, -0.32);
  const deep = shade(base, -0.5);
  const streak = p.hairHighlight && p.hairHighlight !== 'none' ? p.hairHighlight : null;
  // Highlights replace the usual lighter strands, and add a few broad streaks.
  const light = streak ?? shade(base, 0.28);
  const rope: RopeColors = { base, dark, deep, light: shade(base, 0.28) };
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
  } else if (isRope(s.texture)) {
    // Braids, twists and locs grow from sections parted on the scalp: the
    // parts show as fine lines of scalp, and each section starts a rope that
    // runs from the parting out to the hairline, where it falls.
    const n = 10;
    const at = (t: number): Pt => {
      const seg = t * (hairline.length - 1);
      const a = hairline[Math.floor(seg)], b = hairline[Math.min(hairline.length - 1, Math.floor(seg) + 1)];
      const k = seg - Math.floor(seg);
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    };
    const from = (end: Pt): Pt => [origin[0] + (end[0] - origin[0]) * 0.15, origin[1] + 2];
    const curve = (end: Pt) => {
      const st = from(end);
      return `M${pt(st)} Q${f((st[0] + end[0]) / 2 + (end[0] - 50) * 0.18)},${f((st[1] + end[1]) / 2 - 2)} ${pt(end)}`;
    };
    if (s.parts === 'crisscross') {
      // Parts crossing diagonally, so the scalp shows in diamonds.
      for (let i = -4; i <= 4; i++) {
        for (const dir of [-1, 1]) {
          const x = 50 + i * 6;
          capStrands.push(<path key={`x${i}${dir}`} d={`M${f(x - dir * 14)},${f(fr.T - s.v - 2)} L${f(x + dir * 14)},${f(sideY + 2)}`}
            stroke={shade(p.skinTone, -0.1)} strokeWidth="0.6" opacity="0.75" />);
        }
      }
    } else {
      for (let i = 1; i < n; i++) {
        capStrands.push(<path key={`pt${i}`} d={curve(at(i / n))} stroke={shade(p.skinTone, -0.1)} strokeWidth="0.45" fill="none" opacity="0.65" />);
      }
    }
    for (let i = 0; i < n; i++) {
      // With highlights, every third rope carries the colour.
      const marked = !!streak && i % 3 === 1;
      capStrands.push(twistedRope(`cr${i}`, curve(at((i + 0.5) / n)), 2.6 * (s.ropeScale ? 1.25 : 1), rope, ROPE_PERIOD[s.texture as keyof typeof ROPE_PERIOD], marked ? streak! : rope.light, marked));
    }
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
  const sheen = s.texture === 'buzz' || s.texture === 'coily' || isRope(s.texture) ? null : (
    <path d={`M${f(50 - fr.W * 0.55)},${f(fr.T - s.v * 0.35 + 3)} Q${f(origin[0] - 2)},${f(fr.T - s.v * 0.9 + 1)} ${f(50 + fr.W * 0.45)},${f(fr.T - s.v * 0.3 + 3.5)}`}
      stroke={rope.light} strokeWidth="2.2" fill="none" opacity="0.35" strokeLinecap="round" />
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
    const roped = isRope(s.texture);
    // Rope styles: a short mass behind the head only, ending round at the jaw;
    // below it every rope hangs on its own, with gaps between them.
    const massEnd = roped ? Math.min(length, fr.chin + 2) : length;
    const massBottom: Pt[] = roped
      ? [[R + spread * 0.3, massEnd - 4], [50, massEnd + 2], [L - spread * 0.3, massEnd - 4]]
      : bottom;
    const outline: Pt[] = [...top, [R + spread * (roped ? 0.3 : 0.6), (sideY + massEnd) / 2], ...massBottom, [L - spread * (roped ? 0.3 : 0.6), (sideY + massEnd) / 2]];
    back.push(<path key="mass" d={smooth(outline, true, 0.9)} fill={p.fromBehind ? base : dark} />);
    if (p.fromBehind && s.texture !== 'locs' && s.texture !== 'braids' && s.texture !== 'twists') {
      for (let i = 0; i < 14; i++) {
        const x = L - spread + ((R - L + 2 * spread) * (i + 0.5)) / 14;
        back.push(<path key={`fb${i}`} d={`M${f(50 + (x - 50) * 0.3)},${f(fr.T)} Q${f(x)},${f(fr.cy)} ${f(x + (x - 50) * 0.08)},${f(length - 3)}`}
          stroke={i % 4 === 0 ? light : dark} strokeWidth="0.8" fill="none" opacity="0.5" />);
      }
    }
    // Ropes hanging inside the mass: they start within the head's width and
    // fan out only as far as the hair does, so none hang loose at the edges.
    // From behind, renderHairBehind draws them instead.
    if (roped && !p.fromBehind) {
      const scale = s.ropeScale ?? 1;
      const w = (s.texture === 'locs' ? 4.2 : s.texture === 'twists' ? 3.2 : 3.4) * scale;
      const count = Math.round(((R - L + spread) / (w + 1.1)));
      const half = (R - L) / 2 - 1.5;
      for (let i = 0; i < count; i++) {
        const k = ((i + 0.5) / count) * 2 - 1;
        const x0 = 50 + k * half, x1 = 50 + k * (half + spread * 0.7);
        // Lengths vary a little, so the ends make a soft, uneven line.
        const end = length - 4 - seeded(i, 21) * 6;
        const d = `M${f(x0)},${f(sideY - 4)} Q${f((x0 + x1) / 2)},${f((sideY + end) / 2)} ${f(x1)},${f(end)}`;
        back.push(twistedRope(`r${i}`, d, w, rope, ROPE_PERIOD[s.texture as keyof typeof ROPE_PERIOD] * scale));
        if (s.ends === 'curly') back.push(curlyEnd(`re${i}`, x1, end, w, rope));
        if (s.wisps && i % 3 === 1) back.push(curlyWisp(`rw${i}`, (x0 + x1) / 2 + w * 0.6, fr.chin, end - 2, rope, i));
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

  if (streak && s.texture !== 'buzz' && s.texture !== 'parted' && !isRope(s.texture)) {
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
      if (isRope(s.texture)) {
        // A bundle of separate ropes over the shoulder, side by side, each
        // with its own rounded end at a slightly different length.
        const n = s.texture === 'locs' ? 2 : 3;
        const w = (s.locks.width / n) * 0.95 * (s.ropeScale && n === 3 ? 0.9 : 1);
        const len = s.locks.length;
        front.push(
          <g key={`lock${sd}`}>
            {Array.from({ length: n }, (_, i) => {
              const k = ((i + 0.5) / n - 0.5) * s.locks!.width;
              const drop = seeded(i + (sd > 0 ? 7 : 0), 22) * 7;
              const pts = spine.map(([x, y]) => [x + k, y > fr.chin ? y - ((y - fr.chin) / (len - fr.chin)) * drop : y] as Pt);
              const d = smooth(pts, false);
              const highlighted = !!streak && i === (sd > 0 ? 0 : n - 1);
              const endPt = pts[pts.length - 1];
              return (
                <g key={i}>
                  {twistedRope(`l${i}`, d, w, rope, ROPE_PERIOD[s.texture as keyof typeof ROPE_PERIOD] * (s.ropeScale ?? 1), highlighted ? streak! : rope.light, highlighted)}
                  {s.ends === 'curly' && curlyEnd(`le${i}`, endPt[0], endPt[1], w, rope)}
                  {s.wisps && i === 1 && curlyWisp(`lw${i}`, endPt[0] + sd * w * 0.9, fr.chin + 3, endPt[1] - 4, rope, i + 3)}
                </g>
              );
            })}
          </g>,
        );
        continue;
      }
      const lockId = id(`lock${sd}`);
      front.push(
        <g key={`lock${sd}`}>
          <defs><clipPath id={lockId}><path d={smooth(outline, true, 0.85)} /></clipPath></defs>
          <path d={smooth(outline, true, 0.85)} fill={base} />
          <g clipPath={`url(#${lockId})`}>
            {[-0.35, -0.1, 0.15, 0.4].map((k, i) => (
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

// The back of the head for styles whose pattern is the whole point from
// behind: braids, locs and twists hang in ropes from the crown, cornrows run
// in rows down to the nape, and Bantu knots sit in parted sections all over.
// Drawn over the hair-coloured head: cornrows and knots are clipped to it,
// while long ropes carry on down past it. Null for every other style, which
// keep the plain falling strands.
export function renderHairBehind(p: { hairStyle: HairStyle; hairColor: string; hairHighlight?: string; skinTone: string; geometry: FaceGeometry }): { node: React.ReactNode; clipToHead: boolean; onHead?: React.ReactNode } | null {
  const { hairStyle, hairColor: base, skinTone } = p;
  const g = p.geometry;
  const T = g.faceTop, B = g.faceBottom, cy = g.faceCenterY, W = g.fRx;
  const streak = p.hairHighlight && p.hairHighlight !== 'none' ? p.hairHighlight : null;
  const dark = shade(base, -0.32), deep = shade(base, -0.5), light = streak ?? shade(base, 0.28);
  const scalp = shade(skinTone, -0.12);

  // Ropes from the crown. Long ones fan out a little as they fall.
  const colors: RopeColors = { base, dark, deep, light: shade(base, 0.28) };
  const ropes = (count: number, end: number, width: number, period: number, parts: boolean, fan: number, extra: { curly?: boolean; wisps?: boolean; vary?: boolean } = {}) => {
    const out: React.ReactNode[] = [];
    const vary = extra.vary ?? end > B;
    const endOf = (i: number) => end - (vary ? seeded(i, 23) * 6 : 0);
    const path = (x: number, e = end) => `M${f(50 + (x - 50) * 0.3)},${f(T + 1)} Q${f(x)},${f(cy - 4)} ${f(x + (x - 50) * fan)},${f(e)}`;
    for (let i = 0; i < count; i++) {
      const x = 50 - W - 1 + ((i + 0.5) * (W * 2 + 2)) / count;
      if (parts && i > 0) {
        out.push(<path key={`p${i}`} d={path(50 - W - 1 + (i * (W * 2 + 2)) / count)} stroke={scalp} strokeWidth="0.5" fill="none" opacity="0.6" />);
      }
      const marked = !!streak && i % 3 === 1;
      const e = endOf(i);
      out.push(twistedRope(`r${i}`, path(x, e), width, colors, period, marked ? streak! : colors.light, marked));
      if (extra.curly) out.push(curlyEnd(`e${i}`, x + (x - 50) * fan, e, width, colors));
      if (extra.wisps && i % 3 === 1 && i < count - 1) out.push(curlyWisp(`w${i}`, x + (x - 50) * fan * 0.6 + width * 0.6, cy + 6, e - 3, colors, i));
    }
    return out;
  };

  switch (hairStyle) {
    case 'braids':
      return { node: <g>{ropes(11, 104, 3.4, ROPE_PERIOD.braids, false, 0.3)}</g>, clipToHead: false };
    case 'boho_braids':
      return { node: <g>{ropes(11, 102, 3.4, ROPE_PERIOD.braids, false, 0.32, { curly: true, wisps: true })}</g>, clipToHead: false };
    case 'goddess_locs':
      return { node: <g>{ropes(9, 102, 4.4, ROPE_PERIOD.locs, false, 0.32, { curly: true, wisps: true })}</g>, clipToHead: false };
    case 'barrel_twists': {
      // Thick twists from a criss-cross parted scalp.
      const parts = Array.from({ length: 9 }, (_, i) => [-1, 1].map(dir => {
        const x = 50 + (i - 4) * 6;
        return <path key={`x${i}${dir}`} d={`M${f(x - dir * 14)},${f(T - 2)} L${f(x + dir * 14)},${f(cy + 10)}`} stroke={scalp} strokeWidth="0.6" opacity="0.7" />;
      }));
      return { onHead: <g>{parts}</g>, node: <g>{ropes(7, B + 18, 5.4, ROPE_PERIOD.twists * 1.5, false, 0.25)}</g>, clipToHead: false };
    }
    case 'locs':
    case 'locs_short':
      return { node: <g>{ropes(9, 104, 4.4, ROPE_PERIOD.locs, false, 0.3)}</g>, clipToHead: false };
    case 'twists':
      return { node: <g>{ropes(12, B + 10, 3.2, ROPE_PERIOD.twists, false, 0.35)}</g>, clipToHead: false };
    case 'cornrows':
      // Rows lie flat to the head and end in a neat line at the nape.
      return { node: <g>{ropes(9, cy + 16, 2.6, 2, true, 0.1)}</g>, clipToHead: true };
    case 'bantu_knots': {
      // Sections parted in a grid, a knot in the middle of each.
      const rows: Array<{ y: number; xs: number[] }> = [
        { y: T + 9, xs: [-0.5, 0, 0.5] },
        { y: cy - 1, xs: [-0.66, -0.22, 0.22, 0.66] },
        { y: cy + 11, xs: [-0.4, 0.4] },
      ];
      const parts: React.ReactNode[] = [];
      [T + 15, cy + 5].forEach((y, i) => parts.push(
        <path key={`h${i}`} d={`M${f(50 - W - 2)},${f(y + 4)} Q50,${f(y - 4)} ${f(50 + W + 2)},${f(y + 4)}`} stroke={scalp} strokeWidth="0.5" fill="none" opacity="0.55" />,
      ));
      rows.forEach((r, ri) => r.xs.slice(1).forEach((k, i) => {
        const x = 50 + ((r.xs[i] + k) / 2) * W;
        const y0 = ri === 0 ? T : ri === 1 ? T + 15 : cy + 5, y1 = ri === 0 ? T + 15 : ri === 1 ? cy + 5 : B + 6;
        parts.push(<path key={`v${ri}${i}`} d={`M${f(x)},${f(y0 + 1)} Q${f(x + (x - 50) * 0.15)},${f((y0 + y1) / 2)} ${f(x + (x - 50) * 0.08)},${f(y1 + 1)}`} stroke={scalp} strokeWidth="0.5" fill="none" opacity="0.55" />);
      }));
      const knots = rows.flatMap((r, ri) => r.xs.map((k, i) => {
        const x = 50 + k * W, y = r.y;
        return (
          <g key={`k${ri}${i}`}>
            <circle cx={x} cy={y} r="4.4" fill={base} />
            <circle cx={x} cy={y} r="4.4" fill="none" stroke={deep} strokeWidth="0.5" opacity="0.6" />
            <path d={`M${f(x + 3)},${f(y)} A3,3 0 1 1 ${f(x)},${f(y - 3)} A1.8,1.8 0 1 1 ${f(x - 1.4)},${f(y + 0.5)}`}
              stroke={dark} strokeWidth="0.8" fill="none" opacity="0.85" />
            <circle cx={x - 1.3} cy={y - 1.5} r="1.1" fill={light} opacity="0.35" />
          </g>
        );
      }));
      return { node: <g>{parts}{knots}</g>, clipToHead: true };
    }
    default:
      return null;
  }
}

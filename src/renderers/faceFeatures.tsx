import type {
  EyeShape, EyebrowShape, NoseShape, Eyeliner, EyeShadow, MakeupIntensity, Gender, LipShape,
} from '../types/avatar-v2';
import { FaceGeometry, faceHalfWidthAt } from './faceGeometry';
import { shade } from './outfitRenderer';

// Eyes, brows, nose and ears, drawn the way cartoon artists do: a lidded eye
// with the iris tucked under the upper lid, tapered brows, a nose built from a
// shadow and a highlight rather than outlines. The light comes from the upper left.

type Pt = [number, number];
type Side = -1 | 1;

const EYE_Y = 50;
const EYES: Array<{ cx: number; side: Side }> = [{ cx: 38, side: -1 }, { cx: 62, side: 1 }];

interface EyeSpec { w: number; up: number; lo: number; tilt: number; crease: 'normal' | 'none' | 'hood' | 'deep' }

const EYE_SPECS: Record<EyeShape, EyeSpec> = {
  almond:   { w: 6.8, up: 4.4, lo: 2.6, tilt: 0.6, crease: 'normal' },
  round:    { w: 6.2, up: 5.2, lo: 4.0, tilt: 0,   crease: 'normal' },
  hooded:   { w: 6.8, up: 3.9, lo: 2.6, tilt: 0.2, crease: 'hood' },
  wide:     { w: 7.6, up: 4.6, lo: 3.2, tilt: 0.3, crease: 'normal' },
  monolid:  { w: 7.0, up: 3.1, lo: 2.3, tilt: 0.9, crease: 'none' },
  deepset:  { w: 6.4, up: 4.0, lo: 2.8, tilt: 0,   crease: 'deep' },
  upturned: { w: 6.8, up: 4.2, lo: 2.4, tilt: 2.2, crease: 'normal' },
};

interface EyeGeom {
  cx: number; side: Side; spec: EyeSpec;
  inner: Pt; outer: Pt;
  upperC: [Pt, Pt]; lowerC: [Pt, Pt];
}

function eyeGeom(cx: number, side: Side, shape: EyeShape): EyeGeom {
  const s = EYE_SPECS[shape] ?? EYE_SPECS.almond;
  const inner: Pt = [cx - side * s.w, EYE_Y + 0.4];
  const outer: Pt = [cx + side * s.w, EYE_Y - s.tilt];
  return {
    cx, side, spec: s, inner, outer,
    upperC: [[cx - side * s.w * 0.45, EYE_Y - s.up * 1.3], [cx + side * s.w * 0.55, EYE_Y - s.up * 1.2 - s.tilt * 0.5]],
    lowerC: [[cx + side * s.w * 0.5, EYE_Y + s.lo * 1.2 - s.tilt * 0.3], [cx - side * s.w * 0.5, EYE_Y + s.lo * 1.3]],
  };
}

const p = ([x, y]: Pt) => `${x.toFixed(2)},${y.toFixed(2)}`;
const upperPath = (e: EyeGeom) => `M${p(e.inner)} C${p(e.upperC[0])} ${p(e.upperC[1])} ${p(e.outer)}`;
const openingPath = (e: EyeGeom) => `${upperPath(e)} C${p(e.lowerC[0])} ${p(e.lowerC[1])} ${p(e.inner)} Z`;

function bezierAt(a: Pt, b: Pt, c: Pt, d: Pt, t: number): Pt {
  const u = 1 - t;
  return [
    u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
    u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
  ];
}
const upperAt = (e: EyeGeom, t: number) => bezierAt(e.inner, e.upperC[0], e.upperC[1], e.outer, t);

export interface EyeParams {
  eyeShape: EyeShape;
  eyeColor: string;
  skinTone: string;
  idPrefix: string;
}

export function renderEyes({ eyeShape, eyeColor, skinTone, idPrefix }: EyeParams): React.ReactNode {
  const lidLine = '#2b1d18';
  const crease = shade(skinTone, -0.22);
  return EYES.map(({ cx, side }) => {
    const e = eyeGeom(cx, side, eyeShape);
    const s = e.spec;
    const clipId = `${idPrefix}-eye${side}`;
    const irisR = Math.min(4.7, Math.max(3.4, s.up * 1.02));
    const ic: Pt = [cx, EYE_Y + 0.4];
    const creaseLift = s.up * 1.25 + 1.6;
    return (
      <g key={side}>
        <defs><clipPath id={clipId}><path d={openingPath(e)} /></clipPath></defs>
        {s.crease === 'deep' && (
          <ellipse cx={cx + side * 0.5} cy={EYE_Y - s.up - 1} rx={s.w + 1.5} ry="3.4" fill={shade(skinTone, -0.3)} opacity="0.28" style={{ filter: 'blur(1.2px)' }} />
        )}
        <path d={openingPath(e)} fill="#f8f4ef" />
        <g clipPath={`url(#${clipId})`}>
          <circle cx={ic[0]} cy={ic[1]} r={irisR} fill={eyeColor} />
          <circle cx={ic[0]} cy={ic[1]} r={irisR * 0.62} fill={shade(eyeColor, 0.18)} opacity="0.55" />
          <circle cx={ic[0]} cy={ic[1]} r={irisR - 0.35} fill="none" stroke={shade(eyeColor, -0.45)} strokeWidth="0.7" />
          <circle cx={ic[0]} cy={ic[1]} r={irisR * 0.42} fill="#120c0a" />
          {/* The upper lid casts a little shadow onto the eye. */}
          <path d={upperPath(e)} stroke="#000" strokeOpacity="0.16" strokeWidth="2.6" fill="none" />
          <circle cx={ic[0] - 1.4} cy={ic[1] - 1.6} r="1.1" fill="#fff" opacity="0.95" />
          <circle cx={ic[0] + 1.3} cy={ic[1] + 1.1} r="0.5" fill="#fff" opacity="0.6" />
        </g>
        <path d={`M${p(e.outer)} C${p(e.lowerC[0])} ${p(e.lowerC[1])} ${p(e.inner)}`}
          stroke={shade(skinTone, -0.28)} strokeWidth="0.6" fill="none" opacity="0.7" strokeLinecap="round" />
        <path d={upperPath(e)} stroke={lidLine} strokeWidth="1.25" fill="none" strokeLinecap="round" />
        {s.crease === 'normal' || s.crease === 'deep' ? (
          <path d={`M${p(upperAt(e, 0.12))} Q${cx},${EYE_Y - creaseLift - 0.6} ${p([e.outer[0] - side * 0.5, e.outer[1] - creaseLift * 0.55])}`}
            transform={`translate(0 ${-1.2})`}
            stroke={crease} strokeWidth="0.7" fill="none" opacity="0.6" strokeLinecap="round" />
        ) : null}
        {s.crease === 'hood' && (
          <>
            <path d={`M${p(e.inner)} Q${cx},${EYE_Y - s.up * 1.55} ${p(e.outer)} Q${cx + side * 1},${EYE_Y - s.up * 0.75} ${p(e.inner)} Z`}
              fill={skinTone} />
            <path d={`M${p(e.inner)} Q${cx + side * 1},${EYE_Y - s.up * 0.75} ${p(e.outer)}`}
              stroke={crease} strokeWidth="0.8" fill="none" opacity="0.7" strokeLinecap="round" />
          </>
        )}
      </g>
    );
  });
}

export function renderEyelashes(eyeShape: EyeShape): React.ReactNode {
  return EYES.map(({ cx, side }) => {
    const e = eyeGeom(cx, side, eyeShape);
    return (
      <g key={side} stroke="#1a1210" strokeWidth="0.8" fill="none" strokeLinecap="round">
        {[0.5, 0.62, 0.74, 0.85, 0.95].map((t, i) => {
          const [x, y] = upperAt(e, t);
          const len = 1.6 + i * 0.35;
          return <path key={t} d={`M${x},${y} q${side * len * 0.2},${-len * 0.8} ${side * len * 0.8},${-len}`} />;
        })}
      </g>
    );
  });
}

export function renderEyeliner(eyeliner: Eyeliner | undefined, eyeShape: EyeShape): React.ReactNode {
  if (!eyeliner || eyeliner === 'none') return null;
  const ink = '#0f0a09';
  const weight = { thin: 1.5, winged: 1.7, bold: 2.3 }[eyeliner];
  const wing = { thin: 0, winged: 3.6, bold: 4.8 }[eyeliner];
  return EYES.map(({ cx, side }) => {
    const e = eyeGeom(cx, side, eyeShape);
    const base = upperAt(e, 0.78);
    const tip: Pt = [e.outer[0] + side * wing, e.outer[1] - wing * 0.68 - e.spec.tilt * 0.3];
    return (
      <g key={side}>
        <path d={upperPath(e)} stroke={ink} strokeWidth={weight} fill="none" strokeLinecap="round" />
        {wing > 0 && (
          <path d={`M${p(base)} L${p(tip)} L${p([e.outer[0], e.outer[1] + 0.7])} Z`} fill={ink} />
        )}
        {eyeliner === 'bold' && (
          <path d={`M${p(e.outer)} C${p(e.lowerC[0])} ${p(e.lowerC[1])} ${p(e.inner)}`}
            stroke={ink} strokeWidth="0.9" fill="none" opacity="0.85" strokeLinecap="round" />
        )}
      </g>
    );
  });
}

export function renderEyeShadow(eyeShadow: EyeShadow | undefined, eyeShape: EyeShape, intensity: MakeupIntensity | undefined): React.ReactNode {
  if (!eyeShadow || eyeShadow === 'none') return null;
  const color = { smoky: '#3a3446', natural: '#b07a62', colorful: '#8a4fa0' }[eyeShadow] ?? '#3a3446';
  const opacity = intensity === 'glam' ? 0.6 : intensity === 'subtle' ? 0.3 : 0.45;
  return (
    <g opacity={opacity}>
      {EYES.map(({ cx, side }) => {
        const s = EYE_SPECS[eyeShape] ?? EYE_SPECS.almond;
        return (
          <ellipse key={side} cx={cx + side * 1} cy={EYE_Y - s.up - 0.6} rx={s.w + 1.4} ry="3.4"
            fill={color} style={{ filter: 'blur(1.3px)' }} />
        );
      })}
    </g>
  );
}

interface BrowSpec { arch: number; thick: number; peak: number; tailDrop: number }
const BROWS: Record<EyebrowShape, BrowSpec> = {
  natural:  { arch: 2.0, thick: 2.2, peak: 0.6, tailDrop: 1.0 },
  arched:   { arch: 3.8, thick: 2.0, peak: 0.66, tailDrop: 1.6 },
  straight: { arch: 0.5, thick: 2.2, peak: 0.55, tailDrop: 0.6 },
  thick:    { arch: 2.0, thick: 3.4, peak: 0.6, tailDrop: 1.0 },
  thin:     { arch: 2.4, thick: 1.2, peak: 0.62, tailDrop: 1.0 },
};

export function renderEyebrows(shape: EyebrowShape, eyeShape: EyeShape, hairColor: string, gender: Gender): React.ReactNode {
  const b = BROWS[shape] ?? BROWS.natural;
  const eye = EYE_SPECS[eyeShape] ?? EYE_SPECS.almond;
  const t = b.thick * (gender === 'male' ? 1.15 : 1);
  const color = shade(hairColor, -0.15);
  return EYES.map(({ cx, side }) => {
    const base = EYE_Y - eye.up - 5.6;
    const xi = cx - side * (eye.w - 0.2), xt = cx + side * (eye.w + 2.6);
    const xp = xi + (xt - xi) * b.peak;
    const A: Pt = [xi, base + 0.4], P: Pt = [xp, base - b.arch], B: Pt = [xt, base - b.arch + b.tailDrop + 1.2];
    const top = (q: Pt, k: number): Pt => [q[0], q[1] - t * k];
    const bot = (q: Pt, k: number): Pt => [q[0], q[1] + t * k];
    const midAP = (A[0] + P[0]) / 2, midPB = (P[0] + B[0]) / 2;
    const d = [
      `M${p(bot(A, 0.5))}`,
      `Q${p([A[0] - side * 0.6, A[1]])} ${p(top(A, 0.45))}`,
      `Q${p([midAP, P[1] - t * 0.55])} ${p(top(P, 0.5))}`,
      `Q${p([midPB, P[1] - t * 0.35 + (B[1] - P[1]) * 0.25])} ${p(B)}`,
      `Q${p([midPB, P[1] + t * 0.45 + (B[1] - P[1]) * 0.35])} ${p(bot(P, 0.42))}`,
      `Q${p([midAP, P[1] + t * 0.5])} ${p(bot(A, 0.5))} Z`,
    ].join(' ');
    return (
      <g key={side}>
        <path d={d} fill={color} opacity="0.92" />
        {/* A few hairs at the head of the brow, where they grow upward. */}
        {[0, 1, 2].map((i) => (
          <path key={i} d={`M${xi + side * (0.6 + i * 0.9)},${base + t * 0.4} l${side * 0.5},${-t * 0.9}`}
            stroke={shade(hairColor, 0.15)} strokeWidth="0.35" opacity="0.6" strokeLinecap="round" />
        ))}
      </g>
    );
  });
}

interface NoseSpec { tipY: number; wide: number; tip: number; top: number; hump: number; flare: number }
const NOSES: Record<NoseShape, NoseSpec> = {
  button:   { tipY: 63,   wide: 3.4, tip: 2.6, top: 56, hump: 0,   flare: 0.8 },
  straight: { tipY: 64.5, wide: 3.6, tip: 2.3, top: 52, hump: 0,   flare: 0.9 },
  broad:    { tipY: 64.5, wide: 5.2, tip: 3.1, top: 53, hump: 0,   flare: 1.4 },
  upturned: { tipY: 62.8, wide: 3.4, tip: 2.4, top: 55, hump: -0.4, flare: 1.2 },
  aquiline: { tipY: 65,   wide: 3.5, tip: 2.2, top: 51, hump: 1.2, flare: 0.8 },
  hawk:     { tipY: 66,   wide: 3.6, tip: 2.0, top: 51, hump: 2.0, flare: 0.7 },
  flat:     { tipY: 63.5, wide: 4.8, tip: 3.2, top: 58, hump: 0,   flare: 1.5 },
};

export function renderNose(shape: NoseShape, skinTone: string): React.ReactNode {
  const n = NOSES[shape] ?? NOSES.straight;
  const shadow = shade(skinTone, -0.3);
  const deep = shade(skinTone, -0.5);
  const y = n.tipY;
  // Hooked noses dip their tip below the nostrils.
  const tipDrop = Math.max(0, n.hump - 0.8) * 0.9;
  return (
    <g>
      <path d={`M51.2,${n.top} Q${52.4 + n.hump},${(n.top + y) / 2} ${50 + n.tip * 0.8},${y - 1.2}`}
        stroke={shadow} strokeWidth="1.1" fill="none" opacity="0.45" strokeLinecap="round" style={{ filter: 'blur(0.3px)' }} />
      <ellipse cx="49.3" cy={y - 1.4} rx={n.tip * 0.55} ry={n.tip * 0.45} fill={shade(skinTone, 0.16)} opacity="0.55" />
      {([-1, 1] as const).map((s) => (
        <g key={s}>
          <path d={`M${50 + s * n.wide},${y - 2.2} Q${50 + s * (n.wide + n.flare)},${y + 0.6} ${50 + s * n.wide * 0.42},${y + 1.4}`}
            stroke={shadow} strokeWidth="0.85" fill="none" opacity="0.65" strokeLinecap="round" />
          <ellipse cx={50 + s * n.wide * 0.48} cy={y + 0.9} rx={shape === 'upturned' ? 1.3 : 1.05} ry={shape === 'upturned' ? 0.8 : 0.5}
            fill={deep} opacity="0.7" transform={`rotate(${s * 12} ${50 + s * n.wide * 0.48} ${y + 0.9})`} />
        </g>
      ))}
      <path d={`M${50 - n.wide * 0.38},${y + 1.6} Q50,${y + 2.4 + tipDrop} ${50 + n.wide * 0.38},${y + 1.6}`}
        stroke={shadow} strokeWidth="0.7" fill="none" opacity="0.5" strokeLinecap="round" />
    </g>
  );
}

export interface EarParams { geometry: FaceGeometry; skinTone: string }

// Where each ear's lobe sits, for earrings.
export function earLobes(g: FaceGeometry): Array<{ x: number; y: number; side: Side }> {
  const hw = faceHalfWidthAt(g, 58);
  return ([-1, 1] as const).map((side) => ({ x: 50 + side * (hw + 0.6), y: 62.5, side }));
}

// Drawn before the face, so only the outer half shows past the cheek.
export function renderEars({ geometry, skinTone }: EarParams): React.ReactNode {
  const hw = faceHalfWidthAt(geometry, 56);
  const inner = shade(skinTone, -0.22);
  return ([-1, 1] as const).map((side) => {
    const cx = 50 + side * (hw + 0.3);
    return (
      <g key={side}>
        <ellipse cx={cx} cy="56" rx="3.6" ry="6.9" fill={skinTone} />
        <ellipse cx={cx} cy="56" rx="3.6" ry="6.9" fill="none" stroke={shade(skinTone, -0.12)} strokeWidth="0.4" />
        <path d={`M${cx + side * 0.6},51.2 Q${cx + side * 2.6},55.5 ${cx + side * 0.9},60.4`}
          stroke={inner} strokeWidth="0.85" fill="none" opacity="0.75" strokeLinecap="round" />
      </g>
    );
  });
}

// ---- Mouth ----
// Built the way cartoonists build it: two corners, the line where the lips
// meet, a darker upper lip with a cupid's bow, a fuller lower lip with a
// highlight, the groove under the nose and a soft shadow under the lower lip.
// The mood moves the corners and can part the lips, so expressions reuse it.

export type MouthMood = 'neutral' | 'smile' | 'sad' | 'grin';

const MOUTH_Y = 76.6;

interface LipSpec { w: number; up: number; lo: number; bow: number }
const LIPS: Record<LipShape, LipSpec> = {
  natural: { w: 7.4, up: 2.3, lo: 3.0, bow: 0.8 },
  full:    { w: 8.4, up: 3.3, lo: 4.4, bow: 0.9 },
  thin:    { w: 7.0, up: 1.3, lo: 1.8, bow: 0.5 },
  heart:   { w: 7.0, up: 2.6, lo: 3.0, bow: 1.6 },
};

const MOODS: Record<MouthMood, { lift: number; curve: number; open: number }> = {
  neutral: { lift: 0.35, curve: 0.45, open: 0 },
  smile:   { lift: 2.0, curve: 1.5, open: 0 },
  sad:     { lift: -1.3, curve: -0.2, open: 0 },
  grin:    { lift: 2.5, curve: 1.1, open: 3.6 },
};

// Everything facial hair needs to fit around a mouth: its corners, the top
// of the upper lip (cupid's bow included) and its whole outline. Facial hair
// is built from this, so it fits every lip shape in every mood.
export interface MouthGeometry {
  w: number;
  L: Pt; R: Pt;
  // Top of the upper lip, left corner to right corner.
  upperTop: string;
  // The whole mouth, upper lip and lower lip, as one closed shape.
  outline: string;
  top: number; bottom: number;
}

export function mouthGeometry(lipShape: LipShape, mood: MouthMood = 'neutral'): MouthGeometry {
  const l = LIPS[lipShape] ?? LIPS.natural;
  const m = MOODS[mood];
  const M = MOUTH_Y;
  const L: Pt = [50 - l.w, M - m.lift], R: Pt = [50 + l.w, M - m.lift];
  const peakY = M - l.up - m.lift * 0.35;
  const shoulder = M - l.up * 0.55 - m.lift * 0.6;
  const upperTop = [
    `M${p(L)}`,
    `C${p([50 - l.w * 0.6, shoulder])} ${p([50 - 3.6, peakY])} ${p([50 - 2.4, peakY])}`,
    `Q${p([50 - 1, peakY])} ${p([50, peakY + l.bow])}`,
    `Q${p([50 + 1, peakY])} ${p([50 + 2.4, peakY])}`,
    `C${p([50 + 3.6, peakY])} ${p([50 + l.w * 0.6, shoulder])} ${p(R)}`,
  ].join(' ');
  const bottom = M + m.curve * 0.6 + m.open + l.lo * 1.25;
  const outline = `${upperTop} C${p([50 + l.w * 0.55, bottom])} ${p([50 - l.w * 0.55, bottom])} ${p(L)} Z`;
  return { w: l.w, L, R, upperTop, outline, top: peakY, bottom: M + m.curve * 0.45 + m.open + l.lo * 0.95 };
}

export interface MouthParams {
  lipShape: LipShape;
  lipColor: string;
  skinTone: string;
  mood?: MouthMood;
  idPrefix: string;
}

export function renderMouth({ lipShape, lipColor, skinTone, mood = 'neutral', idPrefix }: MouthParams): React.ReactNode {
  const l = LIPS[lipShape] ?? LIPS.natural;
  const m = MOODS[mood];
  const M = MOUTH_Y;
  const L: Pt = [50 - l.w, M - m.lift], R: Pt = [50 + l.w, M - m.lift];
  // The line where the lips meet, and (when the mouth is open) the lower one.
  const topC: [Pt, Pt] = [[50 - l.w * 0.5, M + m.curve], [50 + l.w * 0.5, M + m.curve]];
  const botC: [Pt, Pt] = [[50 - l.w * 0.5, M + m.curve + m.open * 1.33], [50 + l.w * 0.5, M + m.curve + m.open * 1.33]];
  const parting = `M${p(L)} C${p(topC[0])} ${p(topC[1])} ${p(R)}`;
  const partingBack = `C${p(topC[1])} ${p(topC[0])} ${p(L)}`;
  const lowerTop = `M${p(L)} C${p(botC[0])} ${p(botC[1])} ${p(R)}`;

  const geo = mouthGeometry(lipShape, mood);
  const peakY = geo.top;
  const upper = `${geo.upperTop} ${partingBack} Z`;
  const lowBottom = M + m.curve * 0.6 + m.open + l.lo * 1.25;
  const lower = `${lowerTop} C${p([50 + l.w * 0.55, lowBottom])} ${p([50 - l.w * 0.55, lowBottom])} ${p(L)} Z`;

  const lipDark = shade(lipColor, -0.14);
  const line = shade(lipColor, -0.58);
  const skinShadow = shade(skinTone, -0.28);
  const openId = `${idPrefix}-mouth-open`;
  const chinY = lowBottom + 1.6;

  return (
    <g>
      {/* The groove between nose and lip. */}
      {([-1, 1] as const).map((s) => (
        <path key={s} d={`M${50 + s * 1.1},67.6 Q${50 + s * 1.5},${(67.6 + peakY) / 2} ${50 + s * 2.1},${peakY - 0.3}`}
          stroke={shade(skinTone, -0.14)} strokeWidth="0.55" fill="none" opacity="0.45" strokeLinecap="round" />
      ))}
      {m.open > 0 && (
        <>
          <defs><clipPath id={openId}><path d={`${parting} C${p(botC[1])} ${p(botC[0])} ${p(L)} Z`} /></clipPath></defs>
          <path d={`${parting} C${p(botC[1])} ${p(botC[0])} ${p(L)} Z`} fill="#4a2226" />
          <g clipPath={`url(#${openId})`}>
            {/* The top row of teeth follows the curve of the smile. */}
            <path d={`${parting} L${p([R[0], R[1] + 2])} C${p([topC[1][0], topC[1][1] + 2.9])} ${p([topC[0][0], topC[0][1] + 2.9])} ${p([L[0], L[1] + 2])} Z`}
              fill="#f7f3ee" />
            <path d={`M50,${M + m.curve * 0.7} L50,${M + m.curve * 0.7 + 2.2}`} stroke="#ddd5cb" strokeWidth="0.3" />
            <ellipse cx="50" cy={M + m.curve + m.open + 0.9} rx={l.w * 0.42} ry="1.3" fill="#c0606a" opacity="0.75" />
          </g>
        </>
      )}
      <path d={lower} fill={lipColor} />
      <path d={upper} fill={lipDark} />
      <path d={parting} stroke={line} strokeWidth="0.75" fill="none" strokeLinecap="round" opacity="0.85" />
      {/* Corners tuck in; a smile pushes up little creases beside them. */}
      {([L, R] as Pt[]).map(([x, y], i) => {
        const s = i === 0 ? -1 : 1;
        return m.lift > 1
          ? <path key={i} d={`M${x + s * 0.6},${y - 1.6} q${s * 1},${1.4} ${s * 0.2},${3}`} stroke={skinShadow} strokeWidth="0.6" fill="none" opacity="0.5" strokeLinecap="round" />
          : <circle key={i} cx={x + s * 0.2} cy={y + 0.1} r="0.45" fill={line} opacity="0.55" />;
      })}
      <path d={`M${50 - l.w * 0.45},${chinY} Q50,${chinY + 0.9} ${50 + l.w * 0.45},${chinY}`}
        stroke={skinShadow} strokeWidth="0.9" fill="none" opacity="0.32" strokeLinecap="round" style={{ filter: 'blur(0.4px)' }} />
    </g>
  );
}

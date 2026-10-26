import type { Bottom, Outfit } from '../types/avatar-v2';
import { shade } from './outfitRenderer';
import { renderHand, HAND_BOX } from './handRenderer';

// Everything below the shoulders for the full-body view: pants, shoes, sleeves, arms and hands, in the
// same style as the face and outfits (soft gradients, a darker edge, simple highlights). The torso itself
// comes from outfitRenderer, drawn once and stretched per body type; this fits around it.

export interface FullBodyParams {
  // The neck's y; the torso starts a little below it.
  N: number;
  // Shoulder radius for the body type, and the horizontal scale the torso is drawn with.
  S: number;
  sx: number;
  skin: string;
  outfit: Outfit;
  outfitMain: string;
  outfitAccent: string;
  bottom: Bottom;
  bottomColor: string;
  bottomAccent: string;
  idPrefix: string;
}

// Where things sit, from the neck down.
export const HIP_OFFSET = 66;     // the waistband starts here
const HEM = 6;                     // the waistband's height
const LEG_TOP = HIP_OFFSET + 4;
const ANKLE = 130;
const SOLE = 143;

interface LegSpec {
  // Width at the hip and at the ankle, and the style of finish.
  top: number;
  bottom: number;
  // Where the cloth ends (offset from the neck): the ankle, the knee, or higher.
  hem: number;
  kind: 'straight' | 'skirt' | 'tucked';
}

const LEGS: Record<Bottom, LegSpec> = {
  jeans: { top: 34, bottom: 26, hem: ANKLE, kind: 'straight' },
  trousers: { top: 34, bottom: 27, hem: ANKLE, kind: 'straight' },
  chef_pants: { top: 35, bottom: 28, hem: ANKLE, kind: 'straight' },
  cop_pants: { top: 34, bottom: 27, hem: ANKLE, kind: 'straight' },
  scrub_pants: { top: 35, bottom: 28, hem: ANKLE, kind: 'straight' },
  leather: { top: 32, bottom: 19, hem: ANKLE, kind: 'straight' },
  baggy: { top: 40, bottom: 37, hem: ANKLE + 2, kind: 'straight' },
  breeches: { top: 36, bottom: 30, hem: 108, kind: 'tucked' },
  shorts: { top: 36, bottom: 34, hem: 96, kind: 'straight' },
  skirt: { top: 70, bottom: 78, hem: 100, kind: 'skirt' },
  cheer_skirt: { top: 70, bottom: 84, hem: 98, kind: 'skirt' },
};

// Shoes follow the pants: boots with breeches, leather and uniforms, clogs with scrubs and whites.
interface ShoeSpec { kind: 'sneaker' | 'boot' | 'dress' | 'clog'; color: string; sole: string; sock?: string }
const SHOES: Record<Bottom, ShoeSpec> = {
  jeans: { kind: 'sneaker', color: '#f2eee8', sole: '#c9c3b8' },
  trousers: { kind: 'dress', color: '#26211f', sole: '#120f0e' },
  chef_pants: { kind: 'clog', color: '#1f1f23', sole: '#0e0e10' },
  cop_pants: { kind: 'boot', color: '#17171b', sole: '#0a0a0c' },
  scrub_pants: { kind: 'clog', color: '#f4f4f2', sole: '#cfcfca' },
  leather: { kind: 'boot', color: '#101013', sole: '#050506' },
  baggy: { kind: 'sneaker', color: '#f2eee8', sole: '#c9c3b8' },
  breeches: { kind: 'boot', color: '#3a2a1c', sole: '#1e140b' },
  shorts: { kind: 'sneaker', color: '#f2eee8', sole: '#c9c3b8', sock: '#f4f1ea' },
  skirt: { kind: 'dress', color: '#26211f', sole: '#120f0e', sock: '#f4f1ea' },
  cheer_skirt: { kind: 'sneaker', color: '#f6f6f4', sole: '#cfcfca', sock: '#f6f6f4' },
};

// How long each shirt's sleeves are: none, short (to the elbow) or long (to the wrist).
type Sleeve = 'none' | 'short' | 'long';
const SLEEVES: Record<Outfit, Sleeve> = {
  tee: 'short', linen: 'long', suit: 'long', chef: 'long', labcoat: 'long', pirate: 'long',
  rockstar: 'long', cheer: 'none', cop: 'short', scrubs: 'short', streetwear: 'long', president: 'long',
};

function legCentres(w: number): [number, number] {
  return [50 - (w / 2 + 1), 50 + (w / 2 + 1)];
}

// ---- Pants and shoes: drawn behind the torso.
// How wide the body is compared with an average one (the torso's hem at an average build is ~36.5 either side),
// so legs and waistbands stay in proportion with slim, athletic and curvy bodies.
export function bodyWidth(p: Pick<FullBodyParams, 'S' | 'sx'>): number {
  return ((p.S + 13.5) * p.sx) / 36.5;
}

export function renderLegs(p: FullBodyParams): React.ReactNode {
  const k = bodyWidth(p);
  const base0 = LEGS[p.bottom];
  const spec: LegSpec = { ...base0, top: base0.top * k, bottom: base0.bottom * k };
  const shoe = SHOES[p.bottom];
  const top = p.N + LEG_TOP, ankle = p.N + ANKLE;
  const overShoe = spec.kind === 'straight' && spec.hem >= ANKLE && shoe.kind !== 'boot';
  const hem = p.N + spec.hem + (overShoe ? 1 : 0);
  const base = p.bottomColor, edge = shade(base, -0.4), accent = p.bottomAccent;
  const gradId = `${p.idPrefix}-pants`, skinId = `${p.idPrefix}-legskin`;
  const defs = (
    <defs>
      <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={shade(base, -0.14)} />
        <stop offset="0.45" stopColor={shade(base, 0.06)} />
        <stop offset="1" stopColor={shade(base, -0.22)} />
      </linearGradient>
      <linearGradient id={skinId} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={shade(p.skin, -0.1)} />
        <stop offset="0.45" stopColor={shade(p.skin, 0.05)} />
        <stop offset="1" stopColor={shade(p.skin, -0.16)} />
      </linearGradient>
      <pattern id={`${p.idPrefix}-check`} width="6" height="6" patternUnits="userSpaceOnUse">
        <rect width="3" height="3" fill={accent} opacity="0.5" />
        <rect x="3" y="3" width="3" height="3" fill={accent} opacity="0.5" />
      </pattern>
    </defs>
  );

  if (spec.kind === 'skirt') {
    const half = spec.top / 2, flare = spec.bottom / 2, c = 50;
    const legW = 17, legTop = hem - 4;
    const [lc, rc] = [c - 10, c + 10];
    const pleats = Array.from({ length: 7 }, (_, i) => {
      const t = (i + 1) / 8, x0 = c - half + spec.top * t, x1 = c - flare + spec.bottom * t;
      return <path key={i} d={`M${x0} ${top + 2} L${x1} ${hem - 1}`} stroke={shade(base, -0.28)} strokeWidth="0.9" opacity="0.7" />;
    });
    return (
      <g>
        {defs}
        {/* bare legs, with socks and shoes */}
        {[lc, rc].map((cx, k) => (
          <g key={k}>
            <path d={`M${cx - legW / 2} ${legTop} L${cx - 6.5} ${ankle} L${cx + 6.5} ${ankle} L${cx + legW / 2} ${legTop} Z`} fill={`url(#${skinId})`} />
            {shoe.sock && <rect x={cx - 7.3} y={ankle - 18} width="14.6" height="18" rx="2" fill={shoe.sock} stroke={shade(shoe.sock, -0.18)} strokeWidth="0.6" />}
          </g>
        ))}
        {shoes(p, shoe, [lc, rc], ankle, undefined, 14 * k)}
        {/* the skirt */}
        <path d={`M${c - half} ${top} L${c - flare} ${hem} Q${c} ${hem + 4} ${c + flare} ${hem} L${c + half} ${top} Z`} fill={`url(#${gradId})`} stroke={edge} strokeWidth="0.8" />
        {pleats}
        <path d={`M${c - flare} ${hem - 1.4} Q${c} ${hem + 2.6} ${c + flare} ${hem - 1.4}`} stroke={accent} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      </g>
    );
  }

  const [lc, rc] = legCentres(spec.top);
  const legs = [lc, rc].map((cx, k) => {
    const side = k === 0 ? -1 : 1;
    const wt = spec.top / 2, wb = spec.bottom / 2;
    const d = `M${cx - wt} ${top} L${cx - wb} ${hem} Q${cx} ${hem + 1.6} ${cx + wb} ${hem} L${cx + wt} ${top} Z`;
    const clip = `${p.idPrefix}-leg${k}`;
    const extras: React.ReactNode[] = [];
    // The shorts' bare knees, and the tucked-in boots below breeches.
    if (p.bottom === 'shorts') {
      extras.push(<path key="skin" d={`M${cx - wb + 3} ${hem} L${cx - 7} ${ankle} L${cx + 7} ${ankle} L${cx + wb - 3} ${hem} Z`} fill={`url(#${skinId})`} />);
    }
    const detail: React.ReactNode[] = [];
    switch (p.bottom) {
      case 'jeans':
      case 'baggy':
        detail.push(<path key="seam" d={`M${cx + side * (wt - 1.2)} ${top + 4} L${cx + side * (wb - 1.2)} ${hem - 3}`} stroke={accent} strokeWidth="0.8" strokeDasharray="1.6 1.2" />);
        detail.push(<path key="pocket" d={`M${cx + side * (wt - 3)} ${top + 1.5} Q${cx + side * (wt - 11)} ${top + 7} ${cx + side * (wt - 14)} ${top + 1.5}`} stroke={accent} strokeWidth="0.9" fill="none" />);
        if (p.bottom === 'baggy') detail.push(<path key="fold" d={`M${cx - wb + 2} ${hem - 6} Q${cx} ${hem - 3} ${cx + wb - 2} ${hem - 6} M${cx - wb + 3} ${hem - 11} Q${cx} ${hem - 8.5} ${cx + wb - 3} ${hem - 11}`} stroke={shade(base, -0.3)} strokeWidth="0.9" fill="none" opacity="0.8" />);
        break;
      case 'trousers':
      case 'cop_pants':
        detail.push(<path key="crease" d={`M${cx} ${top + 8} L${cx} ${hem - 2}`} stroke="#ffffff" strokeWidth="0.9" opacity="0.18" />);
        break;
      case 'chef_pants':
        detail.push(<rect key="check" x={cx - wt} y={top} width={wt * 2} height={hem - top} fill={`url(#${p.idPrefix}-check)`} />);
        break;
      case 'scrub_pants':
        detail.push(<rect key="pocket" x={cx + side * 2 - 5} y={top + 8} width="10" height="9" rx="1.2" fill="none" stroke={shade(base, -0.3)} strokeWidth="0.9" />);
        detail.push(<path key="fold" d={`M${cx - wb + 2} ${hem - 4} L${cx + wb - 2} ${hem - 4}`} stroke={shade(base, -0.25)} strokeWidth="0.8" opacity="0.7" />);
        break;
      case 'leather':
        detail.push(<path key="shine" d={`M${cx - wt * 0.45} ${top + 3} L${cx - wb * 0.35} ${hem - 4}`} stroke="#ffffff" strokeWidth="2.4" opacity="0.16" strokeLinecap="round" />);
        detail.push(<path key="knee" d={`M${cx - wt + 3} ${top + 32} Q${cx} ${top + 36} ${cx + wt - 3} ${top + 32}`} stroke={shade(base, 0.2)} strokeWidth="0.8" fill="none" opacity="0.6" />);
        break;
      case 'breeches':
        detail.push(<path key="gather" d={`M${cx - wb} ${hem - 3} Q${cx} ${hem + 4} ${cx + wb} ${hem - 3}`} stroke={shade(base, -0.3)} strokeWidth="1" fill="none" />);
        break;
      default: break;
    }
    return (
      <g key={k}>
        <defs><clipPath id={clip}><path d={d} /></clipPath></defs>
        {extras}
        <path d={d} fill={`url(#${gradId})`} stroke={edge} strokeWidth="0.8" strokeLinejoin="round" />
        <g clipPath={`url(#${clip})`}>{detail}</g>
      </g>
    );
  });

  const shoeCentres: [number, number] = [lc - (spec.top - spec.bottom) / 4 - 1, rc + (spec.top - spec.bottom) / 4 + 1];
  const shoeWidth = spec.bottom;
  const bootTop = p.bottom === 'breeches' ? hem - 4 : undefined;
  return (
    <g>
      {defs}
      {/* a shadow on the floor ties the feet to the ground */}
      {shoeCentres.map((c, i) => <ellipse key={`sh${i}`} cx={c + (i === 0 ? -1.5 : 1.5)} cy={p.N + SOLE - 0.6} rx={shoeWidth / 2 + 6} ry="2.6" fill="#000" opacity="0.22" />)}
      {overShoe && shoes(p, shoe, shoeCentres, ankle, bootTop, shoeWidth)}
      {legs}
      {!overShoe && shoes(p, shoe, shoeCentres, ankle, bootTop, shoeWidth)}
      {/* the fly, where the two legs meet */}
      {!['shorts'].includes(p.bottom) && <path d={`M50 ${top} L50 ${top + 13}`} stroke={edge} strokeWidth="0.8" opacity="0.7" />}
    </g>
  );
}

// Shoes sit under the trouser hem (or, for boots, over it) at the width of the leg, so they join the leg
// instead of hanging off it. `legWidth` is the leg's width at the ankle.
function shoes(p: FullBodyParams, s: ShoeSpec, cx: [number, number], ankle: number, bootTop: number | undefined, legWidth: number): React.ReactNode {
  const gradId = `${p.idPrefix}-shoe-${s.kind}`;
  const yb = p.N + SOLE, footTop = ankle - 4;
  const top = bootTop ?? ankle - 24;
  const half = Math.max(8.5, legWidth / 2);
  return (
    <g>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={shade(s.color, -0.16)} />
          <stop offset="0.4" stopColor={shade(s.color, 0.1)} />
          <stop offset="1" stopColor={shade(s.color, -0.24)} />
        </linearGradient>
      </defs>
      {cx.map((c, k) => {
        const side = k === 0 ? -1 : 1, out = side * 1.5;
        const x0 = c - half, x1 = c + half;
        // From the ankle, flaring a little to the toe, which points slightly outward.
        const tail = `L${x1 + 0.8} ${yb - 9} Q${x1 + 3.4 + out} ${yb - 7.5} ${x1 + 3.4 + out} ${yb - 3.6} L${x0 - 3.4 + out} ${yb - 3.6} Q${x0 - 3.4 + out} ${yb - 7.5} ${x0 - 0.8} ${yb - 9} L${x0} ${footTop}`;
        const upper = s.kind === 'boot'
          ? `M${x0 - 1} ${top} L${x1 + 1} ${top} L${x1} ${footTop} ${tail} Z`
          : `M${x0} ${footTop} L${x1} ${footTop} ${tail} Z`;
        const left = x0 - 3.4 + out, right = x1 + 3.4 + out;
        return (
          <g key={k}>
            <path d={upper} fill={`url(#${gradId})`} stroke={shade(s.color, -0.45)} strokeWidth="0.9" strokeLinejoin="round" />
            <rect x={left - 0.5} y={yb - 5} width={right - left + 1} height="5" rx="2.2" fill={s.sole} stroke={shade(s.sole, -0.4)} strokeWidth="0.6" />
            {s.kind === 'sneaker' && (
              <g fill="none" strokeLinecap="round">
                <path d={`M${c - half * 0.6 + out * 0.5} ${yb - 15} Q${c + out * 0.5} ${yb - 19} ${c + half * 0.6 + out * 0.5} ${yb - 15}`} stroke={shade(s.color, -0.3)} strokeWidth="0.9" />
                <path d={`M${c - 4} ${footTop + 3} L${c + 4} ${footTop + 5.4} M${c - 4} ${footTop + 7} L${c + 4} ${footTop + 9.4}`} stroke={shade(s.color, -0.35)} strokeWidth="0.8" />
              </g>
            )}
            {s.kind === 'dress' && <path d={`M${c - half * 0.6 + out * 0.5} ${yb - 12} Q${c + out * 0.5} ${yb - 15.5} ${c + half * 0.6 + out * 0.5} ${yb - 12}`} stroke="#ffffff" strokeWidth="1.2" opacity="0.2" fill="none" strokeLinecap="round" />}
            {s.kind === 'clog' && <path d={`M${x0} ${footTop + 5} L${x1} ${footTop + 5}`} stroke={shade(s.color, -0.3)} strokeWidth="1.4" />}
            {s.kind === 'boot' && (
              <g fill="none" strokeLinecap="round">
                <path d={`M${x0 - 1} ${top + 4} L${x1 + 1} ${top + 4}`} stroke={shade(s.color, 0.28)} strokeWidth="1.3" opacity="0.7" />
                <path d={`M${c - half * 0.6} ${top + 7} L${c - half * 0.6} ${footTop - 2}`} stroke="#ffffff" strokeWidth="1.8" opacity="0.1" />
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}

// ---- The waistband and belt, over the shirt's hem.
export function renderWaist(p: FullBodyParams, hemHalf: number): React.ReactNode {
  const y = p.N + HIP_OFFSET, base = p.bottomColor, accent = p.bottomAccent;
  const x0 = 50 - hemHalf, w = hemHalf * 2;
  const band = (fill: string) => <rect x={x0} y={y} width={w} height={HEM} rx="1.4" fill={fill} stroke={shade(fill, -0.4)} strokeWidth="0.7" />;
  switch (p.bottom) {
    case 'trousers':
    case 'jeans':
    case 'cop_pants':
    case 'leather': {
      const belt = p.bottom === 'cop_pants' ? '#17171b' : p.bottom === 'leather' ? '#2a2a30' : shade(accent, 0.06);
      const buckle = p.bottom === 'cop_pants' ? '#c9a24a' : '#c8ccd2';
      return (
        <g>
          <rect x={x0} y={y} width={w} height={HEM} fill={base} />
          <rect x={x0} y={y + 0.4} width={w} height={HEM - 0.8} rx="1.2" fill={belt} stroke={shade(belt, -0.4)} strokeWidth="0.6" />
          <rect x={50 - 4} y={y + 0.4} width="8" height={HEM - 0.8} rx="1" fill={buckle} stroke={shade(buckle, -0.4)} strokeWidth="0.6" />
          {p.bottom === 'leather' && [-24, -17, -10, 10, 17, 24].map((dx) => <circle key={dx} cx={50 + dx} cy={y + HEM / 2} r="1" fill={accent} />)}
          {p.bottom === 'cop_pants' && <rect x={50 + 12} y={y - 1} width="8" height={HEM + 5} rx="1.2" fill="#0f1013" stroke="#2a2b31" strokeWidth="0.5" />}
        </g>
      );
    }
    case 'scrub_pants':
      return (
        <g>
          {band(base)}
          <path d={`M50 ${y + 2.5} Q${50 - 6} ${y - 1} ${50 - 8} ${y + 4} M50 ${y + 2.5} Q${50 + 6} ${y - 1} ${50 + 8} ${y + 4}`} stroke={accent} strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'chef_pants':
    case 'baggy':
    case 'shorts':
    case 'breeches':
      return band(base);
    case 'cheer_skirt':
      return (
        <g>
          {band(base)}
          <rect x={x0} y={y + HEM - 2} width={w} height="1.6" fill={accent} />
        </g>
      );
    default:
      return band(base);
  }
}

// ---- Arms: sleeves, forearms and hands.
export function renderArms(p: FullBodyParams): React.ReactNode {
  const sleeve = SLEEVES[p.outfit] ?? 'short';
  const cloth = p.outfit === 'pirate' ? '#efe6d2' : p.outfitMain;
  const gradId = `${p.idPrefix}-sleeve`, skinId = `${p.idPrefix}-armskin`;
  const sh = (50 - 0) , shoulderX = (p.S + 8) * p.sx, y0 = p.N + 24;
  const elbowY = p.N + 52, wristY = p.N + 80;
  const sides: Array<-1 | 1> = [-1, 1];
  return (
    <g>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={shade(cloth, -0.12)} />
          <stop offset="0.45" stopColor={shade(cloth, 0.08)} />
          <stop offset="1" stopColor={shade(cloth, -0.24)} />
        </linearGradient>
        <linearGradient id={skinId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={shade(p.skin, -0.08)} />
          <stop offset="0.5" stopColor={shade(p.skin, 0.06)} />
          <stop offset="1" stopColor={shade(p.skin, -0.16)} />
        </linearGradient>
      </defs>
      {sides.map((side) => {
        const sxp = sh + side * shoulderX, ex = sxp + side * 4, wx = ex + side * 1.5;
        // A tapering limb as a filled quad between two joints.
        const limb = (x1: number, y1: number, w1: number, x2: number, y2: number, w2: number, fill: string, edge: string) => (
          <path d={`M${x1 - w1 / 2} ${y1} L${x2 - w2 / 2} ${y2} Q${x2} ${y2 + w2 * 0.35} ${x2 + w2 / 2} ${y2} L${x1 + w1 / 2} ${y1} Z`} fill={fill} stroke={edge} strokeWidth="0.8" strokeLinejoin="round" />
        );
        const upperEnd = sleeve === 'short' ? elbowY - 4 : elbowY;
        const clothEdge = shade(cloth, -0.4), skinEdge = shade(p.skin, -0.32);
        return (
          <g key={side}>
            {/* the forearm: bare unless the sleeve is long */}
            {sleeve === 'long'
              ? limb(ex, elbowY - 2, 12.5, wx, wristY - 4, 10.5, `url(#${gradId})`, clothEdge)
              : limb(ex, elbowY - 2, 11, wx, wristY - 3, 9, `url(#${skinId})`, skinEdge)}
            {/* the upper arm */}
            {sleeve === 'none'
              ? limb(sxp, y0 + 2, 12, ex, elbowY, 11, `url(#${skinId})`, skinEdge)
              : limb(sxp, y0 + 2, 15, ex, upperEnd, sleeve === 'short' ? 14 : 12.5, `url(#${gradId})`, clothEdge)}
            {sleeve === 'short' && <path d={`M${ex - 7} ${upperEnd + 0.4} Q${ex} ${upperEnd + 4} ${ex + 7} ${upperEnd + 0.4}`} stroke={shade(cloth, -0.3)} strokeWidth="1.2" fill="none" />}
            {sleeve === 'long' && <path d={`M${wx - 5.4} ${wristY - 3} Q${wx} ${wristY} ${wx + 5.4} ${wristY - 3}`} stroke={p.outfit === 'pirate' ? p.outfitAccent : shade(cloth, -0.35)} strokeWidth="2" fill="none" strokeLinecap="round" />}
            {/* shoulder cap, so the sleeve rounds into the torso */}
            <circle cx={sxp} cy={y0 + 4} r="7.4" fill={sleeve === 'none' ? `url(#${skinId})` : `url(#${gradId})`} />
            {/* the hand, pointing down the arm; thumb to the front */}
            <g transform={`translate(${wx} ${wristY - 1}) rotate(90) ${side > 0 ? 'scale(1 -1)' : ''} scale(0.42) translate(${-HAND_BOX.wristX} ${-HAND_BOX.wristY})`}>
              {renderHand('relaxed', p.skin, `${p.idPrefix}-hand${side}`)}
            </g>
          </g>
        );
      })}
    </g>
  );
}

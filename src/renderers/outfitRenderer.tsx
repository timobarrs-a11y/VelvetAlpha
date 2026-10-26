import type { Outfit, Headwear, FaceAccessory } from '../types/avatar-v2';

// Clothes and hats for AvatarV2. The torso is drawn once and stretched per body
// type by the caller, so every garment here fits slim through curvy for free.
// Only the shoulders and upper chest are in frame (y up to 130), so garments
// put their character there: collars, lapels, ties, buttons.

export interface OutfitRenderParams {
  outfit: Outfit;
  main: string;
  accent: string;
  skin: string;
  neckY: number;
  shoulderRx: number;
  gradientId: string;
}

export interface HeadwearRenderParams {
  headwear: Headwear;
  fRx: number;
  faceTop: number;
}

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Lighten (amt > 0) or darken (amt < 0) toward white or black.
export function shade(hex: string, amt: number): string {
  const target = amt < 0 ? 0 : 255;
  const p = Math.min(1, Math.abs(amt));
  return '#' + rgb(hex).map((v) => Math.round(v + (target - v) * p).toString(16).padStart(2, '0')).join('');
}

const pts = (list: Array<[number, number]>) => list.map(([x, y]) => `${x},${y}`).join(' ');

// A five-pointed star centred on (cx, cy), as polygon points.
function star(cx: number, cy: number, outer: number, inner: number): string {
  const list: Array<[number, number]> = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner, a = -Math.PI / 2 + (i * Math.PI) / 5;
    list.push([+(cx + Math.cos(a) * r).toFixed(2), +(cy + Math.sin(a) * r).toFixed(2)]);
  }
  return pts(list);
}

function torsoPath(N: number, S: number): string {
  return `M50 ${N + 12} Q${50 - S} ${N + 16} ${50 - S - 10} ${N + 36} Q${50 - S - 14} ${N + 53} ${50 - S - 14} ${N + 73} L${50 + S + 14} ${N + 73} Q${50 + S + 14} ${N + 53} ${50 + S + 10} ${N + 36} Q${50 + S} ${N + 16} 50 ${N + 12} Z`;
}

const LINEN = '#efe6d2';

export function outfitGradient(p: OutfitRenderParams): React.ReactNode {
  const base = p.outfit === 'pirate' ? LINEN : p.main;
  return (
    <linearGradient id={p.gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stopColor={base} />
      <stop offset="100%" stopColor={shade(base, -0.45)} />
    </linearGradient>
  );
}

// Behind the neck: the garment's body.
export function renderOutfitBody(p: OutfitRenderParams): React.ReactNode {
  const { outfit, main, accent, neckY: N, shoulderRx: S, gradientId } = p;
  const torso = <path d={torsoPath(N, S)} fill={`url(#${gradientId})`} />;

  switch (outfit) {
    case 'pirate': {
      const vest = (side: 1 | -1) => (
        <polygon
          points={pts([
            [50 + side * 13, N + 11], [50 + side * 22, N + 13], [50 + side * (S + 3), N + 42],
            [50 + side * (S + 7), N + 75], [50 + side * 5, N + 75], [50 + side * 5, N + 50],
          ])}
          fill={main} stroke={shade(main, -0.4)} strokeWidth="0.6" />
      );
      return (
        <g>
          {torso}
          {vest(-1)}
          {vest(1)}
          <path d={`M${50 - 13} ${N + 11} L${50 - 5} ${N + 50} L${50 - 5} ${N + 75} M${50 + 13} ${N + 11} L${50 + 5} ${N + 50} L${50 + 5} ${N + 75}`}
            stroke={accent} strokeWidth="1.2" fill="none" />
          {[N + 38, N + 46].map((y) => <circle key={y} cx={50 - 8} cy={y} r="1.3" fill={accent} />)}
        </g>
      );
    }
    case 'tee':
      return (
        <g>
          {torso}
          <path d={`M${50 - 14} ${N + 12} Q${50 - 6} ${N + 24} 50 ${N + 28} Q${50 + 6} ${N + 24} ${50 + 14} ${N + 12}`}
            stroke={accent} strokeWidth="1.5" fill="none" />
        </g>
      );
    case 'cheer': {
      // A team top: a V-neck with a trim, two stripes across the chest and a star.
      const half = S + 11;
      return (
        <g>
          {torso}
          <polygon points={pts([[50 - 12, N + 11], [50, N + 30], [50 + 12, N + 11]])} fill={p.skin} />
          <path d={`M${50 - 13} ${N + 11} L50 ${N + 31} L${50 + 13} ${N + 11}`} stroke={accent} strokeWidth="2.4" fill="none" strokeLinejoin="round" />
          <rect x={50 - half} y={N + 43} width={half * 2} height="3.4" fill={accent} />
          <rect x={50 - half} y={N + 49} width={half * 2} height="1.6" fill={accent} />
          <polygon points={star(50, N + 61, 7, 3)} fill={accent} />
        </g>
      );
    }
    case 'scrubs':
      return (
        <g>
          {torso}
          <polygon points={pts([[50 - 10, N + 10], [50, N + 32], [50 + 10, N + 10]])} fill={p.skin} />
          <path d={`M${50 - 11} ${N + 10} L50 ${N + 33} L${50 + 11} ${N + 10}`} stroke={accent} strokeWidth="2.2" fill="none" strokeLinejoin="round" />
          <rect x={50 - S + 2} y={N + 44} width="13" height="12" rx="1.5" fill="none" stroke={shade(main, -0.3)} strokeWidth="0.9" />
          <path d={`M${50 - S + 6} ${N + 40} L${50 - S + 6} ${N + 48}`} stroke="#2a5db0" strokeWidth="1.3" strokeLinecap="round" />
        </g>
      );
    case 'cop':
      return (
        <g>
          {torso}
          {([-1, 1] as const).map((side) => (
            <polygon key={side}
              points={pts([[50 + side * (S - 2), N + 17], [50 + side * (S + 9), N + 24], [50 + side * (S + 8), N + 30], [50 + side * (S - 3), N + 24]])}
              fill={shade(main, -0.25)} stroke={accent} strokeWidth="0.7" />
          ))}
          <rect x={50 + 8} y={N + 42} width="10" height="3" rx="0.6" fill="#e8e8ec" />
          <rect x={50 - 22} y={N + 52} width="13" height="11" rx="1" fill="none" stroke={shade(main, -0.35)} strokeWidth="0.9" />
        </g>
      );
    case 'rockstar':
      return (
        <g>
          {torso}
          {/* the band tee showing between the lapels */}
          <polygon points={pts([[50 - 12, N + 9], [50 + 12, N + 9], [50 + 2, N + 54], [50 - 2, N + 54]])} fill="#e9e9ee" />
          <polygon points={pts([[50 + 2, N + 26], [50 - 5, N + 36], [50 - 1, N + 36], [50 - 4, N + 46], [50 + 5, N + 33], [50 + 1, N + 33]])} fill="#c2262e" />
        </g>
      );
    case 'streetwear':
      return (
        <g>
          {/* the hood, bunched behind the neck */}
          <path d={`M${50 - 27} ${N + 14} Q${50 - 24} ${N - 4} 50 ${N - 2} Q${50 + 24} ${N - 4} ${50 + 27} ${N + 14} Z`} fill={shade(main, -0.25)} />
          {torso}
          <circle cx="50" cy={N + 49} r="7" fill={accent} />
          <path d={`M${50 - 3} ${N + 51} L50 ${N + 45} L${50 + 3} ${N + 51} M${50 - 2} ${N + 49.5} L${50 + 2} ${N + 49.5}`} stroke={main} strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
    case 'president':
      return <g>{torso}</g>;
    default:
      return torso;
  }
}

function openCollar(N: number, skin: string, shirt: string, lace: string): React.ReactNode {
  const halfW = (y: number) => 8 * (1 - (y - (N + 10)) / 24);
  return (
    <g>
      <polygon points={pts([[50 - 8, N + 10], [50, N + 34], [50 + 8, N + 10]])} fill={skin} />
      <polygon points={pts([[50 - 8, N + 10], [50, N + 34], [50 + 8, N + 10]])} fill="#000" opacity="0.08" />
      {[N + 15, N + 21].map((y) => {
        const a = halfW(y), b = halfW(y + 5);
        return (
          <path key={y} d={`M${50 - a} ${y} L${50 + b} ${y + 5} M${50 + a} ${y} L${50 - b} ${y + 5}`}
            stroke={lace} strokeWidth="0.8" />
        );
      })}
      {([-1, 1] as const).map((side) => (
        <polygon key={side}
          points={pts([[50 + side * 12, N + 8], [50 + side * 3, N + 27], [50 + side * 18, N + 21]])}
          fill={shade(shirt, 0.15)} stroke={shade(shirt, -0.3)} strokeWidth="0.5" />
      ))}
    </g>
  );
}

function lapels(N: number, color: string, edge: string, wide: boolean): React.ReactNode {
  const w = wide ? 2 : 0;
  return ([-1, 1] as const).map((side) => (
    <polygon key={side}
      points={pts([
        [50 + side * 12, N + 9], [50 + side * 1, N + 54 + w], [50 + side * (12 + w), N + 40 + w],
        [50 + side * (21 + w), N + 27], [50 + side * (16 + w / 2), N + 24], [50 + side * (18 + w / 2), N + 12],
      ])}
      fill={color} stroke={edge} strokeWidth="0.6" />
  ));
}

function shirtCollar(N: number, color: string, edge: string): React.ReactNode {
  return ([-1, 1] as const).map((side) => (
    <polygon key={side}
      points={pts([[50 + side * 11, N + 8], [50 + side * 1, N + 16], [50 + side * 9, N + 19]])}
      fill={color} stroke={edge} strokeWidth="0.5" />
  ));
}

// In front of the neck: collars, lapels, ties.
export function renderOutfitFront(p: OutfitRenderParams): React.ReactNode {
  const { outfit, main, accent, skin, neckY: N } = p;

  switch (outfit) {
    case 'linen':
      return openCollar(N, skin, main, accent);

    case 'pirate':
      return openCollar(N, skin, LINEN, '#5b4632');

    case 'suit':
      return (
        <g>
          <polygon points={pts([[50 - 12, N + 9], [50 + 12, N + 9], [50, N + 54]])} fill="#f4f4f2" />
          {shirtCollar(N, '#fafaf8', '#cfcfca')}
          <polygon points={pts([[50 - 2.6, N + 14], [50 + 2.6, N + 14], [50 + 1.8, N + 19], [50 - 1.8, N + 19]])} fill={shade(accent, -0.1)} />
          <polygon points={pts([[50 - 1.8, N + 19], [50 + 1.8, N + 19], [50 + 4.2, N + 46], [50, N + 51], [50 - 4.2, N + 46]])} fill={accent} />
          <path d={`M${50 - 0.6} ${N + 21} L${50 - 1.6} ${N + 44}`} stroke={shade(accent, 0.3)} strokeWidth="0.6" opacity="0.6" />
          {lapels(N, shade(main, 0.08), shade(main, -0.4), false)}
          <polygon points={pts([[50 + 16, N + 38], [50 + 26, N + 38], [50 + 22, N + 33]])} fill="#f4f4f2" />
          <path d={`M${50 + 15} ${N + 38} L${50 + 27} ${N + 38}`} stroke={shade(main, -0.4)} strokeWidth="0.6" />
        </g>
      );

    case 'labcoat':
      return (
        <g>
          <polygon points={pts([[50 - 12, N + 9], [50 + 12, N + 9], [50, N + 56]])} fill={accent} />
          {shirtCollar(N, shade(accent, 0.2), shade(accent, -0.3))}
          {lapels(N, shade(main, -0.03), '#c3c8ce', true)}
          <rect x={50 - 27} y={N + 34} width="10" height="9" fill="none" stroke="#c3c8ce" strokeWidth="0.6" />
          <path d={`M${50 - 24} ${N + 30} L${50 - 24} ${N + 37}`} stroke="#2a5db0" strokeWidth="1.2" strokeLinecap="round" />
          <path d={`M${50 - 14} ${N + 12} C${50 - 18} ${N + 38} ${50 + 18} ${N + 38} ${50 + 14} ${N + 12}`}
            stroke="#2f3a45" strokeWidth="1.6" fill="none" />
          <path d={`M${50 + 9} ${N + 31} Q${50 + 14} ${N + 40} ${50 + 13} ${N + 45}`} stroke="#2f3a45" strokeWidth="1.4" fill="none" />
          <circle cx={50 + 13} cy={N + 48} r="3" fill="#c0c6cc" stroke="#6b7480" strokeWidth="0.6" />
        </g>
      );

    case 'president':
      return (
        <g>
          <polygon points={pts([[50 - 12, N + 9], [50 + 12, N + 9], [50, N + 56]])} fill="#f4f4f2" />
          {shirtCollar(N, '#fafaf8', '#cfcfca')}
          <polygon points={pts([[50 - 2.6, N + 14], [50 + 2.6, N + 14], [50 + 1.8, N + 19], [50 - 1.8, N + 19]])} fill={shade(accent, -0.1)} />
          <polygon points={pts([[50 - 1.8, N + 19], [50 + 1.8, N + 19], [50 + 4.4, N + 48], [50, N + 53], [50 - 4.4, N + 48]])} fill={accent} />
          {lapels(N, shade(main, 0.1), shade(main, -0.45), true)}
          {/* double-breasted: two columns of buttons */}
          {[-1, 1].flatMap((side) => [N + 58, N + 66].map((y) => (
            <circle key={`${side}${y}`} cx={50 + side * 11} cy={y} r="1.5" fill="#c8ccd2" stroke={shade(main, -0.5)} strokeWidth="0.4" />
          )))}
          {/* the flag pin */}
          <g transform={`translate(${50 + 17} ${N + 36})`}>
            <rect width="8" height="5.4" fill="#f4f4f2" />
            {[0.6, 2.4, 4.2].map((y) => <rect key={y} y={y} width="8" height="0.9" fill="#b3202f" />)}
            <rect width="3.4" height="2.8" fill="#2a4a9a" />
          </g>
        </g>
      );

    case 'cop':
      return (
        <g>
          {shirtCollar(N, shade(main, 0.12), shade(main, -0.4))}
          <polygon points={pts([[50 - 2, N + 12], [50 + 2, N + 12], [50 + 3, N + 45], [50, N + 49], [50 - 3, N + 45]])} fill="#17171b" />
          <path d={`M50 ${N + 49} L50 ${N + 75}`} stroke={shade(main, -0.35)} strokeWidth="0.8" />
          {/* the badge */}
          <path d={`M${50 - 15} ${N + 34} L${50 - 10.5} ${N + 36} L${50 - 10.5} ${N + 41} Q${50 - 15} ${N + 46} ${50 - 19.5} ${N + 41} L${50 - 19.5} ${N + 36} Z`}
            fill={accent} stroke={shade(accent, -0.4)} strokeWidth="0.7" />
          <polygon points={star(50 - 15, N + 39.6, 2.6, 1.1)} fill={shade(accent, -0.35)} />
        </g>
      );

    case 'rockstar':
      return (
        <g>
          {lapels(N, shade(main, 0.1), shade(main, -0.5), true)}
          {/* studs along the lapel edges, and a zip across the chest */}
          {([-1, 1] as const).flatMap((side) => [0.12, 0.3, 0.48, 0.66, 0.84].map((t) => {
            const x = 50 + side * (12 - 11 * t), y = N + 9 + (45 + 2) * t;
            return <circle key={`${side}${t}`} cx={x + side * 0.5} cy={y} r="1.1" fill={accent} />;
          }))}
          <path d={`M${50 + 3} ${N + 52} L${50 + 28} ${N + 70}`} stroke={accent} strokeWidth="1.3" strokeDasharray="1.6 1.2" />
        </g>
      );

    case 'streetwear':
      return (
        <g>
          <path d={`M${50 - 6} ${N + 12} Q${50 - 8} ${N + 24} ${50 - 5} ${N + 34}`} stroke={accent} strokeWidth="1.4" fill="none" strokeLinecap="round" />
          <path d={`M${50 + 6} ${N + 12} Q${50 + 8} ${N + 24} ${50 + 5} ${N + 34}`} stroke={accent} strokeWidth="1.4" fill="none" strokeLinecap="round" />
          <circle cx={50 - 5} cy={N + 35} r="1.4" fill={accent} />
          <circle cx={50 + 5} cy={N + 35} r="1.4" fill={accent} />
        </g>
      );

    case 'chef':
      return (
        <g>
          <rect x={50 - 12.5} y={N + 6} width="25" height="7.5" rx="3" fill={main} stroke={shade(main, -0.18)} strokeWidth="0.6" />
          <path d={`M${50 - 11} ${N + 6.6} L${50 + 11} ${N + 6.6}`} stroke={accent} strokeWidth="0.7" />
          <path d={`M${50 + 1} ${N + 13} Q${50 + 3} ${N + 30} ${50 + 12} ${N + 56}`} stroke={shade(main, -0.2)} strokeWidth="0.8" fill="none" />
          {[N + 22, N + 33, N + 44].map((y) => (
            <g key={y}>
              <circle cx={50 - 6} cy={y} r="1.5" fill={accent} />
              <circle cx={50 + 13} cy={y} r="1.5" fill={accent} />
            </g>
          ))}
        </g>
      );

    default:
      return null;
  }
}

// Where hair stops under a hat. Hair above this line is tucked away.
export function headwearHairCut(p: HeadwearRenderParams): number | null {
  switch (p.headwear) {
    case 'chef_hat': return p.faceTop + 7;
    case 'bandana': return p.faceTop + 9;
    case 'tricorn': return p.faceTop + 5;
    case 'top_hat': return p.faceTop + 5;
    case 'cop_cap': return p.faceTop + 8;
    case 'nurse_cap': return p.faceTop + 7;
    case 'snapback': return p.faceTop + 7;
    case 'beanie': return p.faceTop + 8;
    case 'baseball_cap': return p.faceTop + 7;
    case 'cowboy_hat': return p.faceTop + 6;
    case 'beret': return p.faceTop + 7;
    case 'bucket_hat': return p.faceTop + 6;
    case 'headwrap': return p.faceTop + 9;
    // A headband sits on the hair instead of covering it.
    default: return null;
  }
}

export function renderHeadwear(p: HeadwearRenderParams): React.ReactNode {
  const { headwear, fRx, faceTop } = p;

  switch (headwear) {
    case 'chef_hat': {
      const band = faceTop + 8;
      const puffY = Math.max(12, band - 14);
      return (
        <g>
          <circle cx={50 - fRx * 0.5} cy={puffY + 2} r={fRx * 0.5} fill="#f7f5f0" stroke="#d8d4cc" strokeWidth="0.6" />
          <circle cx={50 + fRx * 0.5} cy={puffY + 2} r={fRx * 0.5} fill="#f7f5f0" stroke="#d8d4cc" strokeWidth="0.6" />
          <circle cx="50" cy={puffY - 2} r={fRx * 0.58} fill="#fbfaf6" stroke="#d8d4cc" strokeWidth="0.6" />
          <rect x={50 - fRx - 1} y={band - 9} width={fRx * 2 + 2} height="10" rx="2" fill="#f7f5f0" stroke="#d8d4cc" strokeWidth="0.6" />
          {[-0.5, 0, 0.5].map((k) => (
            <path key={k} d={`M${50 + k * fRx} ${band - 8} L${50 + k * fRx} ${band}`} stroke="#e2ded6" strokeWidth="0.8" />
          ))}
        </g>
      );
    }
    case 'bandana': {
      const edge = faceTop + 10;
      return (
        <g>
          <path d={`M${50 - fRx - 2} ${edge} Q${50 - fRx - 2} ${faceTop - 6} 50 ${faceTop - 6} Q${50 + fRx + 2} ${faceTop - 6} ${50 + fRx + 2} ${edge} Q50 ${edge - 4} ${50 - fRx - 2} ${edge} Z`}
            fill="#a8322d" />
          {[[-12, 2], [0, -1], [12, 2], [-6, 6], [6, 6], [-18, 7], [18, 7]].map(([dx, dy]) => (
            <circle key={`${dx},${dy}`} cx={50 + dx} cy={faceTop + dy} r="1.1" fill="#f4ede0" opacity="0.9" />
          ))}
          <path d={`M${50 - fRx - 2} ${edge} Q50 ${edge - 4} ${50 + fRx + 2} ${edge}`} stroke="#7d201c" strokeWidth="1" fill="none" />
          <polygon points={pts([[50 + fRx, edge - 3], [50 + fRx + 9, edge + 6], [50 + fRx + 3, edge + 8]])} fill="#962b27" />
          <polygon points={pts([[50 + fRx, edge - 2], [50 + fRx + 4, edge + 12], [50 + fRx - 1, edge + 10]])} fill="#a8322d" />
          <circle cx={50 + fRx} cy={edge - 2} r="2.2" fill="#8a2622" />
        </g>
      );
    }
    case 'tricorn': {
      const brim = faceTop + 6;
      const tip = fRx + 17;
      return (
        <g>
          <ellipse cx="50" cy={brim - 6} rx={fRx - 3} ry="11" fill="#2a2320" />
          <path d={`M${50 - tip} ${brim - 11} Q${50 - fRx * 0.5} ${brim + 4} 50 ${brim + 4} Q${50 + fRx * 0.5} ${brim + 4} ${50 + tip} ${brim - 11} Q${50 + fRx * 0.6} ${brim - 4} 50 ${brim - 14} Q${50 - fRx * 0.6} ${brim - 4} ${50 - tip} ${brim - 11} Z`}
            fill="#332a26" />
          <path d={`M${50 - tip} ${brim - 11} Q${50 - fRx * 0.5} ${brim + 4} 50 ${brim + 4} Q${50 + fRx * 0.5} ${brim + 4} ${50 + tip} ${brim - 11}`}
            stroke="#c9a24a" strokeWidth="1.2" fill="none" />
          <path d={`M${50 - fRx * 0.35} ${brim - 6} Q50 ${brim - 10} ${50 + fRx * 0.35} ${brim - 6}`} stroke="#1c1715" strokeWidth="0.8" fill="none" opacity="0.6" />
        </g>
      );
    }
    case 'top_hat': {
      const brim = faceTop + 6;
      const crownTop = Math.max(1, brim - 22);
      const cw = fRx - 5;
      return (
        <g>
          <rect x={50 - cw} y={crownTop} width={cw * 2} height={brim - crownTop} fill="#1b1b1f" />
          <rect x={50 - cw} y={crownTop} width={cw * 0.35} height={brim - crownTop} fill="#ffffff" opacity="0.06" />
          <rect x={50 - cw} y={brim - 6} width={cw * 2} height="4" fill="#7a1f2b" />
          <path d={`M${50 + cw * 0.5} ${brim - 7.5} l1 2.2 2.4 0.2 -1.8 1.6 0.6 2.3 -2.2 -1.2 -2.2 1.2 0.6 -2.3 -1.8 -1.6 2.4 -0.2 Z`} fill="#d4af37" />
          <ellipse cx="50" cy={brim} rx={fRx + 9} ry="3.5" fill="#141417" />
        </g>
      );
    }
    case 'cop_cap': {
      const brim = faceTop + 8;
      return (
        <g>
          <path d={`M${50 - fRx - 2} ${brim} Q${50 - fRx - 4} ${faceTop - 10} 50 ${faceTop - 13} Q${50 + fRx + 4} ${faceTop - 10} ${50 + fRx + 2} ${brim} Z`} fill="#1d2b4a" />
          <path d={`M${50 - fRx * 0.5} ${faceTop - 8} Q50 ${faceTop - 14} ${50 + fRx * 0.5} ${faceTop - 8}`} stroke="#ffffff" strokeWidth="1.2" fill="none" opacity="0.1" />
          <rect x={50 - fRx - 2} y={brim - 7} width={fRx * 2 + 4} height="7" rx="1.5" fill="#12161d" />
          <path d={`M50 ${brim - 15} L${50 + 4.4} ${brim - 13} L${50 + 4.4} ${brim - 8} Q50 ${brim - 3} ${50 - 4.4} ${brim - 8} L${50 - 4.4} ${brim - 13} Z`} fill="#c9a24a" stroke="#8f7430" strokeWidth="0.7" />
          <circle cx="50" cy={brim - 10} r="1.4" fill="#8f7430" />
          <path d={`M${50 - fRx + 3} ${brim} Q50 ${brim + 10} ${50 + fRx - 3} ${brim} Q50 ${brim + 3.5} ${50 - fRx + 3} ${brim} Z`} fill="#0d0f13" />
        </g>
      );
    }
    case 'nurse_cap': {
      const base = faceTop + 7;
      return (
        <g>
          <path d={`M${50 - 17} ${base} L${50 - 13} ${faceTop - 8} Q50 ${faceTop - 12} ${50 + 13} ${faceTop - 8} L${50 + 17} ${base} Q50 ${base - 5} ${50 - 17} ${base} Z`} fill="#fbfbf9" stroke="#d6d6d0" strokeWidth="0.7" />
          <path d={`M${50 - 17} ${base} Q50 ${base - 5} ${50 + 17} ${base}`} stroke="#e4e4de" strokeWidth="2" fill="none" />
          <rect x={50 - 1.6} y={faceTop - 6.5} width="3.2" height="9" rx="0.5" fill="#c2262e" />
          <rect x={50 - 4.5} y={faceTop - 3.7} width="9" height="3.2" rx="0.5" fill="#c2262e" />
        </g>
      );
    }
    case 'hair_bow': {
      const cx = 50 + fRx * 0.52, cy = faceTop + 3;
      return (
        <g>
          <path d={`M${cx} ${cy} Q${cx - 8} ${cy - 11} ${cx - 15} ${cy - 5} Q${cx - 13} ${cy + 4} ${cx} ${cy} Z`} fill="#c2262e" stroke="#8f1a21" strokeWidth="0.6" />
          <path d={`M${cx} ${cy} Q${cx + 8} ${cy - 11} ${cx + 15} ${cy - 5} Q${cx + 13} ${cy + 4} ${cx} ${cy} Z`} fill="#c2262e" stroke="#8f1a21" strokeWidth="0.6" />
          <path d={`M${cx - 2} ${cy + 1} L${cx - 7} ${cy + 11} L${cx - 2} ${cy + 8} Z M${cx + 2} ${cy + 1} L${cx + 7} ${cy + 11} L${cx + 2} ${cy + 8} Z`} fill="#a81f27" />
          <path d={`M${cx - 11} ${cy - 5} Q${cx - 6} ${cy - 7} ${cx - 3} ${cy - 3}`} stroke="#ffffff" strokeWidth="1" fill="none" opacity="0.28" strokeLinecap="round" />
          <circle cx={cx} cy={cy} r="3" fill="#e0353d" stroke="#8f1a21" strokeWidth="0.6" />
        </g>
      );
    }
    case 'snapback': {
      const brim = faceTop + 8;
      return (
        <g>
          <path d={`M${50 - fRx - 1} ${brim} Q${50 - fRx - 2} ${faceTop - 9} 50 ${faceTop - 11} Q${50 + fRx + 2} ${faceTop - 9} ${50 + fRx + 1} ${brim} Z`} fill="#17171b" />
          <path d={`M50 ${faceTop - 11} L50 ${brim}`} stroke="#2c2c33" strokeWidth="0.8" />
          <path d={`M${50 - fRx * 0.55} ${faceTop - 6} Q${50 - fRx * 0.4} ${brim - 6} ${50 - fRx * 0.2} ${brim}`} stroke="#2c2c33" strokeWidth="0.8" fill="none" />
          <path d={`M${50 + fRx * 0.55} ${faceTop - 6} Q${50 + fRx * 0.4} ${brim - 6} ${50 + fRx * 0.2} ${brim}`} stroke="#2c2c33" strokeWidth="0.8" fill="none" />
          <circle cx="50" cy={faceTop - 11} r="1.7" fill="#2c2c33" />
          <polygon points={pts([[50, brim - 12], [50 + 3.4, brim - 8], [50, brim - 4], [50 - 3.4, brim - 8]])} fill="#c9a24a" />
          <ellipse cx="50" cy={brim + 1.5} rx={fRx + 7} ry="4.2" fill="#c2262e" />
          <ellipse cx="50" cy={brim + 0.6} rx={fRx + 4} ry="2.4" fill="#e0353d" opacity="0.55" />
        </g>
      );
    }
    case 'beanie': {
      const brow = faceTop + 9, main = '#3d6b73', top = faceTop - 11;
      return (
        <g>
          <path d={`M${50 - fRx - 1.5} ${brow - 6} C${50 - fRx - 2.5} ${faceTop - 4} ${50 - fRx * 0.55} ${top} 50 ${top} C${50 + fRx * 0.55} ${top} ${50 + fRx + 2.5} ${faceTop - 4} ${50 + fRx + 1.5} ${brow - 6} Z`} fill={main} />
          {[-0.72, -0.43, -0.14, 0.14, 0.43, 0.72].map((k) => (
            <path key={k} d={`M${50 + k * (fRx + 1)} ${brow - 6} Q${50 + k * fRx * 0.8} ${faceTop - 2} ${50 + k * fRx * 0.45} ${top + 2}`} stroke={shade(main, -0.22)} strokeWidth="0.6" fill="none" opacity="0.55" />
          ))}
          <rect x={50 - fRx - 2.4} y={brow - 7} width={fRx * 2 + 4.8} height="7.8" rx="2.4" fill={shade(main, 0.14)} stroke={shade(main, -0.2)} strokeWidth="0.5" />
          {Array.from({ length: Math.floor((fRx * 2 + 1) / 3.2) }, (_, i) => (
            <path key={i} d={`M${50 - fRx - 0.4 + i * 3.2} ${brow - 6.2} L${50 - fRx - 0.4 + i * 3.2} ${brow + 0.2}`} stroke={shade(main, -0.2)} strokeWidth="0.5" opacity="0.5" />
          ))}
          <circle cx="50" cy={top - 1.2} r="4.2" fill="#f0e9dc" stroke="#d8d0c0" strokeWidth="0.6" />
        </g>
      );
    }
    case 'baseball_cap': {
      const brow = faceTop + 8, main = '#27406b', top = faceTop - 9;
      return (
        <g>
          <path d={`M${50 - fRx - 1} ${brow} C${50 - fRx - 2} ${faceTop - 3} ${50 - fRx * 0.6} ${top} 50 ${top} C${50 + fRx * 0.6} ${top} ${50 + fRx + 2} ${faceTop - 3} ${50 + fRx + 1} ${brow} Q50 ${brow + 3} ${50 - fRx - 1} ${brow} Z`} fill={main} />
          {[-1, 1].map((sd) => (
            <path key={sd} d={`M50 ${top} Q${50 + sd * fRx * 0.45} ${faceTop} ${50 + sd * fRx * 0.55} ${brow + 0.6}`} stroke={shade(main, -0.28)} strokeWidth="0.6" fill="none" />
          ))}
          <path d={`M50 ${top} L50 ${brow + 1.4}`} stroke={shade(main, -0.28)} strokeWidth="0.6" />
          <circle cx="50" cy={top} r="1.6" fill={shade(main, -0.12)} />
          <path d={`M${50 - fRx + 2} ${brow - 1} Q50 ${brow + 15} ${50 + fRx - 2} ${brow - 1} Q50 ${brow + 5} ${50 - fRx + 2} ${brow - 1} Z`} fill={shade(main, -0.25)} stroke={shade(main, -0.4)} strokeWidth="0.4" />
        </g>
      );
    }
    case 'cowboy_hat': {
      const brow = faceTop + 8;
      return (
        <g>
          <path d={`M${50 - fRx + 3} ${brow} C${50 - fRx + 3} ${faceTop + 2} ${50 - fRx + 5} ${faceTop - 9} 44 ${faceTop - 10} Q50 ${faceTop - 5.5} 56 ${faceTop - 10} C${50 + fRx - 5} ${faceTop - 9} ${50 + fRx - 3} ${faceTop + 2} ${50 + fRx - 3} ${brow} Z`} fill="#a9754a" />
          <path d={`M${50 - fRx + 3} ${brow - 5} Q50 ${brow - 2.2} ${50 + fRx - 3} ${brow - 5} L${50 + fRx - 3} ${brow - 0.5} Q50 ${brow + 2.5} ${50 - fRx + 3} ${brow - 0.5} Z`} fill="#4a2f1d" />
          <rect x="47.8" y={brow - 3.4} width="4.4" height="3.6" rx="0.6" fill="none" stroke="#d4af37" strokeWidth="0.8" />
          <path d={`M${50 - fRx - 15} ${brow - 6} Q${50 - fRx - 5} ${brow + 3} 50 ${brow + 3.5} Q${50 + fRx + 5} ${brow + 3} ${50 + fRx + 15} ${brow - 6} Q${50 + fRx + 6} ${brow - 1.5} ${50 + fRx - 3} ${brow - 1} L${50 - fRx + 3} ${brow - 1} Q${50 - fRx - 6} ${brow - 1.5} ${50 - fRx - 15} ${brow - 6} Z`} fill="#8b5e3c" stroke="#6e4528" strokeWidth="0.5" />
          <path d={`M${50 - fRx - 11} ${brow - 3.6} Q${50 - fRx - 4} ${brow + 1.8} 50 ${brow + 2} Q${50 + fRx + 4} ${brow + 1.8} ${50 + fRx + 11} ${brow - 3.6}`} stroke="#6e4528" strokeWidth="0.5" strokeDasharray="1.4 1.1" fill="none" />
        </g>
      );
    }
    case 'beret': {
      const main = '#7a1f2b', cy = faceTop + 1;
      return (
        <g>
          <g transform={`rotate(-7 50 ${cy})`}>
            <ellipse cx="54" cy={cy} rx={fRx + 3} ry="10" fill={main} />
            <ellipse cx="52" cy={cy - 2.5} rx={fRx - 4} ry="5.5" fill={shade(main, 0.12)} opacity="0.55" />
            <rect x="57.5" y={cy - 12.8} width="2.2" height="3.4" rx="0.9" fill={shade(main, -0.22)} />
          </g>
          <path d={`M${50 - fRx - 1} ${faceTop + 8} Q50 ${faceTop + 12.5} ${50 + fRx + 1} ${faceTop + 8}`} stroke={shade(main, -0.32)} strokeWidth="1.3" fill="none" strokeLinecap="round" />
        </g>
      );
    }
    case 'headband': {
      const main = '#e8707a', t = faceTop;
      return (
        <g>
          <path d={`M${50 - fRx + 0.6} ${t + 15} Q50 ${t + 0.5} ${50 + fRx - 0.6} ${t + 15} L${50 + fRx - 0.6} ${t + 20} Q50 ${t + 5.5} ${50 - fRx + 0.6} ${t + 20} Z`} fill={main} stroke={shade(main, -0.25)} strokeWidth="0.5" />
          <path d={`M${50 - fRx + 3} ${t + 16.6} Q50 ${t + 3} ${50 + fRx - 3} ${t + 16.6}`} stroke={shade(main, 0.4)} strokeWidth="0.8" fill="none" opacity="0.7" />
        </g>
      );
    }
    case 'bucket_hat': {
      const brow = faceTop + 8, main = '#c9b88a';
      return (
        <g>
          <path d={`M${50 - fRx + 1} ${brow - 0.5} C${50 - fRx + 1} ${faceTop - 1} ${50 - fRx + 4} ${faceTop - 8} 50 ${faceTop - 8} C${50 + fRx - 4} ${faceTop - 8} ${50 + fRx - 1} ${faceTop - 1} ${50 + fRx - 1} ${brow - 0.5} Z`} fill={main} />
          <path d={`M${50 - fRx + 1} ${brow - 4} Q50 ${brow - 1.2} ${50 + fRx - 1} ${brow - 4}`} stroke={shade(main, -0.25)} strokeWidth="0.6" fill="none" />
          <path d={`M${50 - fRx - 8} ${brow + 3} Q${50 - fRx - 3} ${brow - 2.5} ${50 - fRx + 1} ${brow - 1} L${50 + fRx - 1} ${brow - 1} Q${50 + fRx + 3} ${brow - 2.5} ${50 + fRx + 8} ${brow + 3} Q50 ${brow + 11} ${50 - fRx - 8} ${brow + 3} Z`} fill={shade(main, -0.08)} stroke={shade(main, -0.3)} strokeWidth="0.5" />
          <path d={`M${50 - fRx - 5} ${brow + 2.3} Q50 ${brow + 8.8} ${50 + fRx + 5} ${brow + 2.3}`} stroke={shade(main, -0.3)} strokeWidth="0.5" strokeDasharray="1.3 1" fill="none" />
        </g>
      );
    }
    case 'headwrap': {
      const main = '#d9a441', dot = '#7a1f2b', t = faceTop;
      return (
        <g>
          <path d={`M${50 - fRx - 1.5} ${t + 18} C${50 - fRx - 3} ${t - 2} ${50 - fRx * 0.5} ${t - 10} 50 ${t - 10} C${50 + fRx * 0.5} ${t - 10} ${50 + fRx + 3} ${t - 2} ${50 + fRx + 1.5} ${t + 18} Q50 ${t + 9.5} ${50 - fRx - 1.5} ${t + 18} Z`} fill={main} />
          {[0.25, 0.5, 0.75].map((k) => (
            <path key={k} d={`M${50 - fRx - 1 + k * 6} ${t + 17 - k * 4} Q50 ${t - 9 + k * 14} ${50 + fRx + 1 - k * 6} ${t + 17 - k * 4}`} stroke={shade(main, -0.25)} strokeWidth="0.7" fill="none" opacity="0.6" />
          ))}
          {[[-17, 6], [-8, -2], [4, 3], [14, -3], [20, 9], [-22, 13], [0, 10], [9, 12]].map(([dx, dy]) => (
            <circle key={`${dx},${dy}`} cx={50 + dx * (fRx / 28)} cy={t + dy} r="1" fill={dot} opacity="0.85" />
          ))}
          <ellipse cx="46.5" cy={t - 10.5} rx="6" ry="3.2" transform={`rotate(-22 46.5 ${t - 10.5})`} fill={shade(main, 0.08)} stroke={shade(main, -0.25)} strokeWidth="0.5" />
          <ellipse cx="53.5" cy={t - 10.5} rx="6" ry="3.2" transform={`rotate(22 53.5 ${t - 10.5})`} fill={shade(main, 0.08)} stroke={shade(main, -0.25)} strokeWidth="0.5" />
          <circle cx="50" cy={t - 10.2} r="2.3" fill={shade(main, -0.12)} stroke={shade(main, -0.3)} strokeWidth="0.5" />
        </g>
      );
    }
    default:
      return null;
  }
}

export function renderFaceAccessory(accessory: FaceAccessory | undefined): React.ReactNode {
  if (accessory !== 'eyepatch') return null;
  return (
    <g>
      <path d="M44 45 L80 33" stroke="#141414" strokeWidth="1.4" />
      <path d="M31 47 L20 41" stroke="#141414" strokeWidth="1.4" />
      <ellipse cx="38" cy="50" rx="8.5" ry="7.5" fill="#141414" />
      <ellipse cx="36" cy="47.5" rx="3.5" ry="2" fill="#ffffff" opacity="0.08" />
    </g>
  );
}

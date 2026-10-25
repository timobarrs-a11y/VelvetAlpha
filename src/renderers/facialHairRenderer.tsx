import type { FacialHair } from '../types/avatar-v2';
import { FaceGeometry, faceOutlinePath, chinY } from './faceGeometry';
import { shade } from './outfitRenderer';

// Facial hair follows the jaw of each face shape (it is clipped to the face
// outline, grown a little for volume) and always leaves the mouth open, so
// the lips stay visible. Texture is seeded, never random, so the same beard
// draws the same way every time.

export interface FacialHairRenderParams {
  facialHair: FacialHair;
  hairColor: string;
  geometry: FaceGeometry;
  // Half the width of the lips, so the mouth opening fits them.
  mouthHalfWidth: number;
  idPrefix: string;
}

function seeded(i: number, salt: number): number {
  const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  return `M${cx - rx},${cy} A${rx},${ry} 0 1 0 ${cx + rx},${cy} A${rx},${ry} 0 1 0 ${cx - rx},${cy} Z`;
}

const MOUTH_Y = 77.3;

export function renderFacialHair(p: FacialHairRenderParams): React.ReactNode {
  const { facialHair, hairColor, geometry: g, mouthHalfWidth: m, idPrefix } = p;
  if (!facialHair || facialHair === 'none') return null;

  const dark = shade(hairColor, -0.35);
  const light = shade(hairColor, 0.3);
  const cy = g.faceCenterY;
  const C = chinY(g);
  const faceD = faceOutlinePath(g);
  const faceClipId = `${idPrefix}-fh-face`;
  const regionClipId = `${idPrefix}-fh-region`;
  const grown = (k: number) => `translate(50 ${cy}) scale(${k}) translate(-50 ${-cy})`;

  // From the sideburns, down the cheeks to a moustache line over the lip.
  const cheekLine = `M${50 - g.fRx - 5},${cy + 5} L${50 - g.fRx + 1},${cy + 5} Q${50 - g.fRx + 6},${cy + 15} ${50 - m - 3},70.5 Q${50 - 6},68.5 50,69.2 Q${50 + 6},68.5 ${50 + m + 3},70.5 Q${50 + g.fRx - 6},${cy + 15} ${50 + g.fRx - 1},${cy + 5} L${50 + g.fRx + 5},${cy + 5} L${50 + g.fRx + 5},${C + 14} L${50 - g.fRx - 5},${C + 14} Z`;
  const mouth = (extra: number) => ellipsePath(50, MOUTH_Y, m + extra, 3.8);

  // Short strands combed down and in toward the chin.
  const strands = (step: number, salt: number, len: number, width: number) => {
    const out: React.ReactNode[] = [];
    let i = 0;
    for (let y = cy + 3; y < C + 8; y += step) {
      for (let x = 50 - g.fRx - 4; x < 50 + g.fRx + 4; x += step) {
        i++;
        const jx = x + (seeded(i, salt) - 0.5) * step;
        const jy = y + (seeded(i, salt + 1) - 0.5) * step;
        const lean = ((50 - jx) / g.fRx) * 0.7;
        out.push(
          <path key={i}
            d={`M${jx},${jy} q${lean * 0.5},${len * 0.5} ${lean},${len}`}
            stroke={i % 9 === 0 ? light : dark} strokeWidth={width}
            opacity={0.35 + seeded(i, salt + 2) * 0.3} fill="none" strokeLinecap="round" />,
        );
      }
    }
    return out;
  };

  const clipDefs = (regionD: string, growth: number) => (
    <defs>
      <clipPath id={faceClipId}>
        <path d={faceD} transform={grown(growth)} />
      </clipPath>
      <clipPath id={regionClipId} clipPath={`url(#${faceClipId})`}>
        <path d={regionD} clipRule="evenodd" />
      </clipPath>
    </defs>
  );
  const box = <rect x="0" y={cy - 10} width="100" height="80" />;

  switch (facialHair) {
    case 'stubble': {
      const dots: React.ReactNode[] = [];
      let i = 0;
      for (let y = cy + 3; y < C + 3; y += 1.7) {
        for (let x = 50 - g.fRx; x < 50 + g.fRx; x += 1.7) {
          i++;
          dots.push(
            <circle key={i} cx={x + (seeded(i, 7) - 0.5) * 1.4} cy={y + (seeded(i, 8) - 0.5) * 1.4}
              r={0.32} fill={dark} opacity={0.35 + seeded(i, 9) * 0.3} />,
          );
        }
      }
      return (
        <g>
          {clipDefs(`${cheekLine} ${mouth(0.6)}`, 1.0)}
          <g clipPath={`url(#${regionClipId})`}>
            <g fill={hairColor} opacity="0.2">{box}</g>
            {dots}
          </g>
        </g>
      );
    }

    case 'beard':
      return (
        <g>
          {clipDefs(`${cheekLine} ${mouth(0.8)}`, 1.09)}
          <g clipPath={`url(#${regionClipId})`}>
            <g fill={hairColor} opacity="0.95">{box}</g>
            <ellipse cx="50" cy={C + 4} rx={g.fRx - 4} ry="9" fill={dark} opacity="0.35" />
            {strands(2.6, 3, 2.8, 0.8)}
          </g>
        </g>
      );

    case 'goatee': {
      const w = m + 4;
      const region = `M${50 - w + 1},70.5 Q${50 - 6},68.5 50,69.2 Q${50 + 6},68.5 ${50 + w - 1},70.5 Q${50 + w + 1},79 ${50 + w - 3},${C - 3} Q50,${C + 3} ${50 - w + 3},${C - 3} Q${50 - w - 1},79 ${50 - w + 1},70.5 Z`;
      return (
        <g>
          {clipDefs(`${region} ${mouth(0.6)}`, 1.05)}
          <g clipPath={`url(#${regionClipId})`}>
            <g fill={hairColor} opacity="0.95">{box}</g>
            {strands(2.2, 5, 2.4, 0.7)}
          </g>
        </g>
      );
    }

    case 'mustache': {
      const d = `M${50 - m - 3},74.6 Q${50 - m - 2},70 ${50 - 6},69.3 Q${50 - 2},68.8 50,69.8 Q${50 + 2},68.8 ${50 + 6},69.3 Q${50 + m + 2},70 ${50 + m + 3},74.6 Q${50 + m - 1},73 ${50 + 4},73.2 Q50,72.6 ${50 - 4},73.2 Q${50 - m + 1},73 ${50 - m - 3},74.6 Z`;
      return (
        <g>
          <defs>
            <clipPath id={regionClipId}><path d={d} /></clipPath>
          </defs>
          <path d={d} fill={hairColor} opacity="0.95" />
          <g clipPath={`url(#${regionClipId})`}>
            {Array.from({ length: 16 }, (_, i) => {
              const x = 50 - m - 2 + i * ((2 * m + 4) / 15);
              const lean = (x - 50) * 0.08;
              return (
                <path key={i} d={`M${x},68.8 q${lean * 0.5},2.5 ${lean},5`}
                  stroke={i % 4 === 0 ? light : dark} strokeWidth="0.7" opacity="0.5" fill="none" strokeLinecap="round" />
              );
            })}
          </g>
        </g>
      );
    }

    default:
      return null;
  }
}

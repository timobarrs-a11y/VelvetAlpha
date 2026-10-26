import type { FacialHair } from '../types/avatar-v2';
import { FaceGeometry, faceOutlinePath, chinY } from './faceGeometry';
import { shade } from './outfitRenderer';
import type { MouthGeometry } from './faceFeatures';

// Facial hair follows the jaw of each face shape (it is clipped to the face
// outline, grown a little for volume) and is built around the mouth: it
// leaves the mouth's own outline clear and the moustache sits on the upper
// lip, for every lip shape and mood. Texture is seeded, never random, so the
// same beard draws the same way every time.

export interface FacialHairRenderParams {
  facialHair: FacialHair;
  hairColor: string;
  geometry: FaceGeometry;
  // The mouth it has to fit around, in its current shape and mood.
  mouth: MouthGeometry;
  idPrefix: string;
}

function seeded(i: number, salt: number): number {
  const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

const f = (n: number) => n.toFixed(2);

export function renderFacialHair(p: FacialHairRenderParams): React.ReactNode {
  const { facialHair, hairColor, geometry: g, mouth, idPrefix } = p;
  if (!facialHair || facialHair === 'none') return null;

  const dark = shade(hairColor, -0.35);
  // A gentle highlight: stronger ones read as grey flecks on dark hair.
  const light = shade(hairColor, 0.16);
  const cy = g.faceCenterY;
  const C = chinY(g);
  const faceD = faceOutlinePath(g);
  const faceClipId = `${idPrefix}-fh-face`;
  const maskId = `${idPrefix}-fh-mask`;
  const grown = (k: number) => `translate(50 ${cy}) scale(${k}) translate(-50 ${-cy})`;

  const { w, L, R } = mouth;
  // Ends of the moustache: just past each mouth corner, rising and falling with it.
  const la: [number, number] = [50 - w - 2.2, L[1] + 0.6];
  const ra: [number, number] = [50 + w + 2.2, R[1] + 0.6];
  // Across the upper lip, under the nose: the top of a moustache.
  const lipLine = `Q${f(50 - w * 0.7)},68.6 ${f(50 - 2.6)},68.4 Q50,67.9 ${f(50 + 2.6)},68.4 Q${f(50 + w * 0.7)},68.6 ${f(ra[0])},${f(ra[1])}`;
  // The mouth itself, a little larger, is always left clear.
  const midY = (mouth.top + mouth.bottom) / 2;
  const mouthHole = (mx: number, my: number) => {
    const sx = (w + mx) / w, sy = (mouth.bottom - mouth.top + 2 * my) / (mouth.bottom - mouth.top);
    return <path d={mouth.outline} fill="#000" transform={`translate(50 ${f(midY)}) scale(${f(sx)} ${f(sy)}) translate(-50 ${f(-midY)})`} />;
  };

  // From the sideburns down the cheeks to the moustache, then everything below.
  const fullRegion = `M${50 - g.fRx - 5},${cy + 5} L${50 - g.fRx + 1},${cy + 5} Q${50 - g.fRx + 6},${cy + 15} ${f(la[0])},${f(la[1])} ${lipLine} Q${50 + g.fRx - 6},${cy + 15} ${50 + g.fRx - 1},${cy + 5} L${50 + g.fRx + 5},${cy + 5} L${50 + g.fRx + 5},${C + 14} L${50 - g.fRx - 5},${C + 14} Z`;

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
            d={`M${f(jx)},${f(jy)} q${f(lean * 0.5)},${f(len * 0.5)} ${f(lean)},${f(len)}`}
            stroke={i % 13 === 0 ? light : dark} strokeWidth={width}
            opacity={0.3 + seeded(i, salt + 2) * 0.25} fill="none" strokeLinecap="round" />,
        );
      }
    }
    return out;
  };

  // Hair fills the region, follows the (slightly grown) jaw, and skips the mouth.
  const defs = (region: string, growth: number, hole: React.ReactNode) => (
    <defs>
      <clipPath id={faceClipId}>
        <path d={faceD} transform={grown(growth)} />
      </clipPath>
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="140">
        <path d={region} fill="#fff" />
        {hole}
      </mask>
    </defs>
  );
  const layer = (children: React.ReactNode) => (
    <g clipPath={`url(#${faceClipId})`}><g mask={`url(#${maskId})`}>{children}</g></g>
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
            <circle key={i} cx={f(x + (seeded(i, 7) - 0.5) * 1.4)} cy={f(y + (seeded(i, 8) - 0.5) * 1.4)}
              r={0.32} fill={dark} opacity={0.35 + seeded(i, 9) * 0.3} />,
          );
        }
      }
      return (
        <g>
          {defs(fullRegion, 1.0, mouthHole(0.35, 0.25))}
          {layer(<><g fill={hairColor} opacity="0.2">{box}</g>{dots}</>)}
        </g>
      );
    }

    case 'beard':
      return (
        <g>
          {defs(fullRegion, 1.09, mouthHole(0.7, 0.45))}
          {layer(
            <>
              <g fill={hairColor} opacity="0.95">{box}</g>
              <ellipse cx="50" cy={C + 4} rx={g.fRx - 4} ry="9" fill={dark} opacity="0.35" />
              {strands(2.6, 3, 2.8, 0.8)}
            </>,
          )}
        </g>
      );

    case 'goatee': {
      const side = w + 3.6;
      const region = `M${f(la[0])},${f(la[1])} ${lipLine} Q${f(50 + side + 0.8)},${f((ra[1] + C) / 2)} ${f(50 + side - 2.4)},${f(C - 3)} Q50,${f(C + 3)} ${f(50 - side + 2.4)},${f(C - 3)} Q${f(50 - side - 0.8)},${f((la[1] + C) / 2)} ${f(la[0])},${f(la[1])} Z`;
      return (
        <g>
          {defs(region, 1.05, mouthHole(0.6, 0.4))}
          {layer(<><g fill={hairColor} opacity="0.95">{box}</g>{strands(2.2, 5, 2.4, 0.7)}</>)}
        </g>
      );
    }

    case 'mustache': {
      // Between the line under the nose and the top of the upper lip, with
      // the ends dipping just past the corners of the mouth.
      // The tips finish just past the corners instead of wrapping the lower lip.
      const region = `M${f(la[0])},${f(la[1])} ${lipLine} L${f(R[0] + 0.9)},${f(R[1] + 1.5)} L${f(R[0] - 0.6)},${f(R[1] + 0.5)} L50,${f(midY)} L${f(L[0] + 0.6)},${f(L[1] + 0.5)} L${f(L[0] - 0.9)},${f(L[1] + 1.5)} Z`;
      return (
        <g>
          <defs>
            <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="140">
              <path d={region} fill="#fff" />
              {mouthHole(0.25, 0.15)}
            </mask>
          </defs>
          <g mask={`url(#${maskId})`}>
            <path d={region} fill={hairColor} opacity="0.95" />
            {Array.from({ length: 18 }, (_, i) => {
              const x = la[0] + i * ((ra[0] - la[0]) / 17);
              const lean = (x - 50) * 0.08;
              return (
                <path key={i} d={`M${f(x)},68.2 q${f(lean * 0.5)},3 ${f(lean)},${f(6 + Math.abs(x - 50) * 0.08)}`}
                  stroke={i % 6 === 0 ? light : dark} strokeWidth="0.7" opacity="0.4" fill="none" strokeLinecap="round" />
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

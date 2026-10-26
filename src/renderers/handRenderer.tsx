import { shade } from './outfitRenderer';

// Hands for the Velvet Sims game: the same skin, shading and soft outline as
// the avatar's face, drawn as small sprites the game rotates onto each wrist.
// Every hand points along +x with the wrist at the left edge and the thumb on
// the top edge, in a 60x40 box; the game mirrors it for the other side.

export type HandPose = 'relaxed' | 'fist' | 'open' | 'point';
export const HAND_POSES: readonly HandPose[] = ['relaxed', 'fist', 'open', 'point'];

// Where the wrist sits in the box, and the box size, for whoever places the sprite.
export const HAND_BOX = { w: 60, h: 40, wristX: 5, wristY: 20 } as const;

type Pt = [number, number];

// A finger or thumb: a capsule of the given width from a base to a tip, curling a little.
function finger(a: Pt, b: Pt, curl: number): string {
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  return `M${a[0]},${a[1]} Q${mx},${my + curl} ${b[0]},${b[1]}`;
}

function polar(origin: Pt, deg: number, len: number): Pt {
  const r = (deg * Math.PI) / 180;
  return [origin[0] + Math.cos(r) * len, origin[1] + Math.sin(r) * len];
}

interface Shape {
  // Filled blocks (the palm, a fist).
  blocks: string[];
  // Stroked capsules, drawn as [path, width].
  digits: Array<[string, number]>;
  // Fine lines on top: knuckle creases, finger gaps.
  creases: string[];
}

function shapeOf(pose: HandPose): Shape {
  const palm = 'M3,13 C10,10.5 20,10 27,12 L27,28 C20,30 10,29.5 3,27 Z';
  const W = 4.6;
  switch (pose) {
    case 'fist':
      return {
        blocks: ['M3,12 C9,9.5 20,9 28,10.5 Q35,12.5 35,20 Q35,27.5 28,29.5 C20,31 9,30.5 3,28 Z'],
        digits: [
          [finger([21, 11.4], [32, 11.6], 0), 4.8], // thumb folded across the top
        ],
        creases: ['M26,14.6 L33,15.2', 'M26,19.6 L34.2,20', 'M26,24.4 L33.6,24.8', 'M20,11 L20,15'],
      };
    case 'point':
      return {
        blocks: ['M3,12 C9,9.5 20,9 27,10.5 Q33,12.5 33,20 Q33,27.5 27,29.5 C20,31 9,30.5 3,28 Z'],
        digits: [
          [finger([24, 14.6], [50, 14.4], 0.4), W], // the index finger, out straight
          [finger([20, 11.4], [30, 11.8], 0), 4.8],
        ],
        creases: ['M25,19.6 L32.4,20', 'M25,24.4 L31.8,24.8'],
      };
    case 'open': {
      const o: Pt = [24, 20];
      const tips: Array<[number, number]> = [[-27, 19], [-9, 21], [8, 19.5], [25, 15]];
      return {
        blocks: [palm],
        digits: [
          ...tips.map(([deg, len]) => [finger(polar(o, deg, 5), polar(o, deg, len + 5), 0), W] as [string, number]),
          [finger([13, 13.5], polar([13, 13.5], -52, 11.5), -1), 5], // thumb, out and up
        ],
        creases: [],
      };
    }
    default:
      return {
        blocks: [palm],
        digits: [
          [finger([26, 14.4], [43, 15.6], 0.6), W],
          [finger([26, 18.8], [45, 20.2], 0.8), W],
          [finger([26, 23.2], [43, 24.6], 0.6), W],
          [finger([26, 27.2], [38, 28.2], 0.4), 4.2],
          [finger([14, 12.6], [29, 8.4], -1), 5],
        ],
        creases: [],
      };
  }
}

export function renderHand(pose: HandPose, skin: string, idPrefix = 'hand'): React.ReactNode {
  const { blocks, digits, creases } = shapeOf(pose);
  const gradId = `${idPrefix}-skin`;
  const edge = shade(skin, -0.3), line = shade(skin, -0.2), glow = shade(skin, 0.18);
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(skin, 0.1)} />
          <stop offset="0.55" stopColor={skin} />
          <stop offset="1" stopColor={shade(skin, -0.12)} />
        </linearGradient>
      </defs>
      {/* Outline first, so overlapping fingers merge into one soft silhouette. */}
      {digits.map(([d, w], i) => <path key={`o${i}`} d={d} fill="none" stroke={edge} strokeWidth={w + 1.8} />)}
      {blocks.map((d, i) => <path key={`b${i}`} d={d} fill={`url(#${gradId})`} stroke={edge} strokeWidth="1.8" />)}
      {digits.map(([d, w], i) => <path key={`f${i}`} d={d} fill="none" stroke={`url(#${gradId})`} strokeWidth={w} />)}
      {/* The palm covers the finger roots, so draw its edge-free fill again over the seam. */}
      {blocks.map((d, i) => <path key={`s${i}`} d={d} fill={`url(#${gradId})`} stroke="none" />)}
      {digits.map(([d, w], i) => <path key={`g${i}`} d={d} fill="none" stroke={glow} strokeWidth={Math.max(0.8, w * 0.2)} opacity="0.55" transform="translate(0,-1)" />)}
      {creases.map((d, i) => <path key={`c${i}`} d={d} fill="none" stroke={line} strokeWidth="0.9" opacity="0.8" />)}
    </g>
  );
}

export function handSvg(pose: HandPose, skin: string, idPrefix?: string): React.ReactElement {
  return (
    <svg viewBox={`0 0 ${HAND_BOX.w} ${HAND_BOX.h}`} width={HAND_BOX.w} height={HAND_BOX.h}>
      {renderHand(pose, skin, idPrefix ?? `hand-${pose}`)}
    </svg>
  );
}

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { HAIRSTYLES, FACE_SHAPES, type FaceShape, type FaceTune } from '../../types/avatar-v2';
import { AvatarV2 } from '../../components/AvatarV2';
import { buildFaceGeometry } from '../faceGeometry';
import { layoutHair } from '../hairRenderer';

// The face-width and jaw sliders move the head; hair has to move with it.
// These checks hold for every style, every face shape and the slider ends.
const TUNES: FaceTune[] = [
  {},
  { faceWidth: -1 }, { faceWidth: 1 },
  { jawWidth: -1 }, { jawWidth: 1 },
  { faceWidth: 1, jawWidth: 1 }, { faceWidth: -1, jawWidth: -1 },
];
const styles = HAIRSTYLES.map(h => h.value).filter(v => v !== 'bald');

describe('face geometry from the sliders', () => {
  it('face width widens and narrows the head by a tenth either way', () => {
    const base = buildFaceGeometry('oval').fRx;
    expect(buildFaceGeometry('oval', { faceWidth: 1 }).fRx).toBeCloseTo(base * 1.1);
    expect(buildFaceGeometry('oval', { faceWidth: -1 }).fRx).toBeCloseTo(base * 0.9);
  });

  it('junk slider values are held to the ends', () => {
    expect(buildFaceGeometry('oval', { faceWidth: 50 }).fRx).toBeCloseTo(buildFaceGeometry('oval', { faceWidth: 1 }).fRx);
  });
});

describe('hair stays on the head at every slider position', () => {
  for (const shape of FACE_SHAPES.map(s => s.value) as FaceShape[]) {
    it.each(styles)(`${shape}: %s keeps its crown, hairline and whorl on the head`, (style) => {
      for (const tune of TUNES) {
        const g = buildFaceGeometry(shape, tune);
        const { fr, s, sideY, crown, hairline, origin } = layoutHair(style, 'straight', g);
        const where = `${style} on a ${shape} head, ${JSON.stringify(tune)}`;

        for (const [x, y] of [...crown, ...hairline, origin]) {
          expect(Number.isFinite(x) && Number.isFinite(y), where).toBe(true);
        }
        // The strands grow from a point on the head, not out in the air.
        expect(Math.abs(origin[0] - 50), `whorl x, ${where}`).toBeLessThanOrEqual(fr.W);
        expect(origin[1], `whorl y, ${where}`).toBeLessThanOrEqual(sideY);
        expect(origin[1], `whorl y, ${where}`).toBeGreaterThanOrEqual(fr.T - s.v - 12);
        // The hair's edge clears the sides of the head, and the hairline sits inside it.
        expect(Math.abs(crown[0][0] - 50), `crown edge, ${where}`).toBeGreaterThanOrEqual(fr.hw(sideY));
        expect(Math.abs(hairline[0][0] - 50), `hairline, ${where}`).toBeLessThanOrEqual(fr.hw(sideY));
        // It covers the full width of the head at its widest.
        expect(Math.max(...crown.map(([x]) => Math.abs(x - 50))), `crown width, ${where}`).toBeGreaterThanOrEqual(fr.W * 0.95);
      }
    });
  }

  it('the whorl moves out from the middle in step with the face width', () => {
    const narrow = layoutHair('pixie', 'straight', buildFaceGeometry('oval', { faceWidth: -1 }));
    const wide = layoutHair('pixie', 'straight', buildFaceGeometry('oval', { faceWidth: 1 }));
    const offset = (l: ReturnType<typeof layoutHair>) => l.origin[0] - 50;
    expect(offset(wide) / offset(narrow)).toBeCloseTo(wide.fr.W / narrow.fr.W);
    // And, for the record, it is nowhere near the 100 it used to land on.
    expect(wide.origin[0]).toBeLessThan(60);
  });

  it('long hair gets longer with the face and wider with its width', () => {
    const base = layoutHair('sleek', 'straight', buildFaceGeometry('oval'));
    const wide = layoutHair('sleek', 'straight', buildFaceGeometry('oval', { faceWidth: 1 }));
    expect(wide.s.locks!.width).toBeGreaterThan(base.s.locks!.width);
    const long = layoutHair('sleek', 'straight', buildFaceGeometry('oblong'));
    expect(long.s.back!.length).toBeGreaterThan(base.s.back!.length);
  });
});

describe('things with a fixed size grow with the head', () => {
  const biggestCentredCircle = (hairStyle: 'bun' | 'high_puff', faceWidth: number) => {
    const { container } = render(<AvatarV2 part="head" config={{ gender: 'female', hairStyle, _version: 4, faceTune: { faceWidth } }} />);
    const radii = [...container.querySelectorAll('circle[cx="50"]')]
      .filter(c => Number(c.getAttribute('cy')) < 20)
      .map(c => Number(c.getAttribute('r')));
    return Math.max(...radii);
  };

  it.each(['bun', 'high_puff'] as const)('the %s is bigger on a wider head', (style) => {
    expect(biggestCentredCircle(style, 1)).toBeGreaterThan(biggestCentredCircle(style, -1));
  });
});

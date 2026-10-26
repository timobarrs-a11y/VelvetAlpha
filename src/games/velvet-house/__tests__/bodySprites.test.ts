import { describe, it, expect } from 'vitest';
import { validBodySvgs, handImage, HAND_PIECES, type BodyImages } from '../state/bodySprites';

const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
const all = { relaxed: svg, fist: svg, open: svg, point: svg };

describe('body sprites', () => {
  it('only accepts SVG pieces, and needs a relaxed hand', () => {
    expect(validBodySvgs(all)).toEqual(all);
    expect(validBodySvgs({ relaxed: svg, fist: 'javascript:alert(1)' })).toEqual({ relaxed: svg });
    expect(validBodySvgs({ fist: svg })).toBeNull();
    expect(validBodySvgs('nope')).toBeNull();
    expect(validBodySvgs({ relaxed: '<svg' + 'x'.repeat(100_000) })).toBeNull();
  });

  it('knows the four grips the animations ask for', () => {
    expect([...HAND_PIECES]).toEqual(['relaxed', 'fist', 'open', 'point']);
  });

  it('picks the hand for a grip, falling back to a relaxed hand, or nothing to draw by hand', () => {
    const relaxed = {} as CanvasImageSource, fist = {} as CanvasImageSource;
    const has: BodyImages = { relaxed, fist };
    expect(handImage('fist', has)).toBe(fist);
    expect(handImage('point', has)).toBe(relaxed);
    expect(handImage('fist', undefined)).toBeNull();
    expect(handImage('fist', {})).toBeNull();
  });
});

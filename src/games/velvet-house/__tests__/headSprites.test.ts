import { describe, it, expect } from 'vitest';
import { validHeadSvgs, headFrameFor, type FrameState } from '../state/headSprites';
import { validOutfit, wearOnAgent } from '../state/clothing';

const svg = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';
const all = { neutral: svg, smile: svg, sad: svg, talk: svg, blink: svg, blinkSmile: svg, back: svg };
const base: FrameState = { front: true, talking: false, t: 0, seed: 0, blink: false, mood: 0.5 };

describe('head sprites', () => {
  it('only accepts SVG frames, and needs a neutral one', () => {
    expect(validHeadSvgs({ neutral: svg, smile: 'javascript:alert(1)' })).toEqual({ neutral: svg });
    expect(validHeadSvgs({ smile: svg })).toBeNull();
    expect(validHeadSvgs('nope')).toBeNull();
    expect(validHeadSvgs({ neutral: '<svg' + 'x'.repeat(500_000) })).toBeNull();
  });

  it('picks the frame for how they look right now', () => {
    expect(headFrameFor({ ...base, front: false }, all)).toBe('back');
    expect(headFrameFor({ ...base, blink: true }, all)).toBe('blink');
    expect(headFrameFor({ ...base, blink: true, expr: 'happy' }, all)).toBe('blinkSmile');
    expect(headFrameFor({ ...base, expr: 'happy' }, all)).toBe('smile');
    expect(headFrameFor({ ...base, expr: 'sad' }, all)).toBe('sad');
    expect(headFrameFor({ ...base, mood: 0.8 }, all)).toBe('smile');
    expect(headFrameFor(base, all)).toBe('neutral');
  });

  it('flaps between talking and closed while someone speaks', () => {
    const seen = new Set([0, 0.05, 0.1, 0.15, 0.2, 0.25].map((t) => headFrameFor({ ...base, talking: true, t }, all)));
    expect(seen.has('talk')).toBe(true);
    expect(seen.has('neutral')).toBe(true);
  });

  it('falls back to neutral when a frame is missing', () => {
    expect(headFrameFor({ ...base, front: false }, { neutral: svg })).toBe('neutral');
    expect(headFrameFor({ ...base, blink: true }, { neutral: svg })).toBe('neutral');
  });
});

describe('signature outfit', () => {
  const ok = { style: 'pirate', color: '#EFE6D2', accent: '#5a1f2b', bottom: '#4A3A2A', key: 'k' };
  it('accepts known styles with real colours only', () => {
    expect(validOutfit(ok)).toEqual(ok);
    expect(validOutfit({ ...ok, style: 'spacesuit' })).toBeNull();
    expect(validOutfit({ ...ok, color: 'red' })).toBeNull();
    expect(validOutfit(null)).toBeNull();
  });

  it('puts a closet piece on a game character as colours, with the accent', () => {
    const look = { top: '#000000', topStyle: 'tee', bottom: '#111111', accent: undefined as string | undefined };
    wearOnAgent(look, { slot: 'top', style: 'blazer', col: '#1f2a44', accent: '#8a2d3b', name: 'x', id: 'sig-top' });
    wearOnAgent(look, { slot: 'bottom', style: 'pants', col: '#3D5B8A', name: 'Jeans', id: 'c-jeans' });
    expect(look).toEqual({ top: '#1f2a44', topStyle: 'blazer', accent: '#8a2d3b', bottom: '#3D5B8A' });
  });
});

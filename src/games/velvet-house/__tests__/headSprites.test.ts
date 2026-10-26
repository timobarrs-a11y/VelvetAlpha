import { describe, it, expect } from 'vitest';
import { validHeadSvgs, headFrameFor, type FrameState } from '../state/headSprites';
import { validOutfit, wearOnAgent, validWardrobe, SIGNATURE_STYLES, BOTTOM_STYLES } from '../state/clothing';

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
    // Older hosts send no pants style: plain pants, trimmed in the pants' own colour.
    expect(validOutfit(ok)).toEqual({ ...ok, bottomStyle: 'pants', bottomAccent: ok.bottom });
    expect(validOutfit({ ...ok, style: 'spacesuit' })).toBeNull();
    expect(validOutfit({ ...ok, color: 'red' })).toBeNull();
    expect(validOutfit(null)).toBeNull();
  });

  it('puts a closet piece on a game character as colours, with the accent', () => {
    const look = { top: '#000000', topStyle: 'tee', bottom: '#111111', accent: undefined as string | undefined };
    wearOnAgent(look, { slot: 'top', style: 'blazer', col: '#1f2a44', accent: '#8a2d3b', name: 'x', id: 'sig-top' });
    wearOnAgent(look, { slot: 'bottom', style: 'pants', col: '#3D5B8A', name: 'Jeans', id: 'c-jeans' });
    expect(look).toEqual({ top: '#1f2a44', topStyle: 'blazer', accent: '#8a2d3b', bottom: '#3D5B8A', bottomStyle: 'pants', bottomAccent: undefined });
  });
});

describe('signature outfit with pants', () => {
  const base = { style: 'cop', color: '#2c4a7a', accent: '#c9a24a', bottom: '#1f2f4f', key: 'k' };

  it('knows every shirt and cut of pants the avatar can wear', () => {
    for (const style of ['rockstar', 'cheer', 'cop', 'scrubs', 'streetwear', 'president']) expect(SIGNATURE_STYLES.has(style), style).toBe(true);
    for (const cut of ['jeans', 'trousers', 'breeches', 'chef_pants', 'leather', 'cheer_skirt', 'cop_pants', 'scrub_pants', 'baggy', 'shorts', 'skirt', 'pants']) {
      expect(BOTTOM_STYLES.has(cut), cut).toBe(true);
    }
  });

  it('keeps the pants cut and trim it is sent, and ignores a cut it does not know', () => {
    expect(validOutfit({ ...base, bottomStyle: 'cop_pants', bottomAccent: '#17171b' })).toMatchObject({ bottomStyle: 'cop_pants', bottomAccent: '#17171b' });
    expect(validOutfit({ ...base, bottomStyle: 'spacesuit' })?.bottomStyle).toBe('pants');
    expect(validOutfit({ ...base, bottomAccent: 'red' })?.bottomAccent).toBe(base.bottom);
  });

  it('puts pants on a game character with their cut and trim', () => {
    const look = { top: '#000000', topStyle: 'tee', bottom: '#111111' } as Parameters<typeof wearOnAgent>[0];
    wearOnAgent(look, { slot: 'bottom', style: 'cheer_skirt', col: '#c2262e', accent: '#f4f1ea', name: 'Cheer skirt', id: 'w-bottom-cheer_skirt' });
    expect(look).toMatchObject({ bottom: '#c2262e', bottomStyle: 'cheer_skirt', bottomAccent: '#f4f1ea' });
  });
});

describe('wardrobe from the host', () => {
  const pieces = [
    { id: 'w-top-cop', slot: 'top', style: 'cop', col: '#2c4a7a', accent: '#c9a24a', name: 'Police shirt' },
    { id: 'w-bottom-cop_pants', slot: 'bottom', style: 'cop_pants', col: '#1f2f4f', accent: '#17171b', name: 'Uniform trousers' },
    { id: 'w-hat-cop_cap', slot: 'hat', style: 'cop_cap', col: '#1d2b4a', name: 'Police cap' },
  ];
  const persona = { id: 'cop', label: 'Cop', icon: '👮', top: 'w-top-cop', bottom: 'w-bottom-cop_pants', hat: 'w-hat-cop_cap' };

  it('accepts pieces and the personas that bundle them', () => {
    const w = validWardrobe({ pieces, personas: [persona] });
    expect(w?.pieces).toHaveLength(3);
    expect(w?.personas[0]).toEqual(persona);
  });

  it('drops anything malformed, unknown or oversized, and a persona that names a missing piece', () => {
    const w = validWardrobe({
      pieces: [...pieces, { ...pieces[0], id: 'bad id!' }, { ...pieces[0], id: 'x1', style: 'spacesuit' }, { ...pieces[0], id: 'x2', col: 'red' }, { ...pieces[0], id: 'x3', slot: 'shoes' }, 'nope'],
      personas: [persona, { ...persona, id: 'ghost', hat: 'w-hat-missing' }, { ...persona, id: 'long', label: 'x'.repeat(60) }],
    });
    expect(w?.pieces.map(p => p.id)).toEqual(pieces.map(p => p.id));
    expect(w?.personas.map(p => p.id)).toEqual(['cop']);
    expect(validWardrobe(null)).toBeNull();
    expect(validWardrobe({ pieces: 'x', personas: [] })).toBeNull();
  });
});

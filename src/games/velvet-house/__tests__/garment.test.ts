import { describe, it, expect } from 'vitest';
import {
  validateGarment, generateGarment, encodeGarment, decodeGarment, priceOf, luminance, CUTS, FABRICS, PATTERN_KINDS, SLOTS,
  garmentStyle, bodyPart, sameCloth, cleanName, type Garment,
} from '../state/garment';
import { STYLE_TAGS } from '../state/taste';

const SEEDS = Array.from({ length: 300 }, (_, i) => i * 7919 + 13);

describe('validateGarment', () => {
  it('rejects things that are not garments', () => {
    expect(validateGarment(null)).toBeNull();
    expect(validateGarment('tee')).toBeNull();
    expect(validateGarment({ slot: 'cape' })).toBeNull();
  });

  it('clamps every value to what the renderer handles', () => {
    const g = validateGarment({
      slot: 'top', cut: 'tee', fabric: 'nylon', base: 'red', name: '<b>Evil\u0000 name that is far too long to keep</b>',
      pattern: { kind: 'stripes', colors: ['#FF0000', 'x', '#00ff00', '#0000ff', '#ffffff'], scale: 99, angle: 500, density: 7, seed: -5, layer2: { kind: 'polka', colors: ['#ffffff'], scale: 0, angle: 0, seed: 1, layer2: { kind: 'zebra', colors: ['#000000'] } } },
      details: { pocket: 'yes', distress: 9, wash: -3, cuffs: 'huge' }, tags: ['cozy', 'cozy', 'nonsense', 'bold'], rarity: 'mythic',
    } as unknown)!;
    expect(g.fabric).toBe('cotton');
    expect(g.base).toBe('#808080');
    expect(g.name.length).toBeLessThanOrEqual(24);
    expect(g.name).not.toMatch(/[<>\u0000]/);
    expect(g.pattern!.colors).toEqual(['#ff0000', '#00ff00', '#0000ff']);
    expect(g.pattern!.scale).toBe(4);
    expect(g.pattern!.angle).toBe(90);
    expect(g.pattern!.density).toBe(1);
    expect(g.pattern!.layer2!.scale).toBe(0.25);
    expect((g.pattern!.layer2 as { layer2?: unknown }).layer2).toBeUndefined();
    expect(g.details).toEqual({ distress: 1, wash: 0 });
    expect(g.tags).toEqual(['bold', 'cozy']);
    expect(g.rarity).toBe('common');
  });

  it('puts a cut that does not fit the slot back to a cut that does', () => {
    expect(validateGarment({ slot: 'bottom', cut: 'hoodie', base: '#112233' })!.cut).toBe('slim');
  });

  it('is idempotent', () => {
    for (const s of SEEDS.slice(0, 50)) {
      const g = generateGarment(s);
      expect(validateGarment(g)).toEqual(g);
    }
  });
});

describe('generateGarment', () => {
  it('makes the same garment from the same seed, and different ones from different seeds', () => {
    expect(generateGarment(42)).toEqual(generateGarment(42));
    const names = new Set(SEEDS.map((s) => JSON.stringify(generateGarment(s))));
    expect(names.size).toBeGreaterThan(280);
  });

  it('always makes something valid and sensible', () => {
    for (const s of SEEDS) {
      const g = generateGarment(s);
      expect(SLOTS).toContain(g.slot);
      expect(CUTS[g.slot]).toContain(g.cut);
      expect(FABRICS).toContain(g.fabric);
      g.tags.forEach((t) => expect(STYLE_TAGS as readonly string[]).toContain(t));
      if (g.pattern) {
        expect(PATTERN_KINDS).toContain(g.pattern.kind);
        // A pattern never disappears into the cloth.
        g.pattern.colors.forEach((c) => expect(Math.abs(luminance(c) - luminance(g.base))).toBeGreaterThan(0.02));
        // No overlay on motifs that are already busy.
        if (['camo', 'leopard', 'zebra', 'tie-dye', 'graphic'].includes(g.pattern.kind)) expect(g.pattern.layer2).toBeUndefined();
      }
      if (g.fabric === 'leather' || g.fabric === 'puffer') expect(['color-block', 'stripes', 'leopard', 'camo']).toContain(g.pattern?.kind ?? 'color-block');
    }
  });

  it('weights rarity so rare pieces are rare', () => {
    const counts: Record<string, number> = {};
    for (let s = 1; s <= 2000; s++) counts[generateGarment(s).rarity] = (counts[generateGarment(s).rarity] ?? 0) + 1;
    expect(counts.common).toBeGreaterThan(counts.uncommon);
    expect(counts.uncommon).toBeGreaterThan(counts.rare);
    expect(counts.rare).toBeGreaterThan(counts['one-of-a-kind']);
  });

  it('obeys a slot, rarity and palette when asked', () => {
    const g = generateGarment(5, { slot: 'bottom', rarity: 'rare', palette: 'forest' });
    expect(g.slot).toBe('bottom');
    expect(g.rarity).toBe('rare');
    expect(g.name).toContain('Forest');
  });

  it('leans toward the tags it is asked for', () => {
    const cozy = SEEDS.slice(0, 200).filter((s) => generateGarment(s, { tags: ['cozy'] }).tags.includes('cozy')).length;
    const any = SEEDS.slice(0, 200).filter((s) => generateGarment(s).tags.includes('cozy')).length;
    expect(cozy).toBeGreaterThan(any);
  });
});

describe('share codes', () => {
  it('round-trips every generated garment', () => {
    for (const s of SEEDS) {
      const g = generateGarment(s);
      const code = encodeGarment(g);
      expect(code).toMatch(/^VH-[0-9A-Z]{4}(-[0-9A-Z]{1,5})+$/);
      expect(decodeGarment(code)).toEqual(g);
    }
  });

  it('is forgiving about spaces, dashes and case, and catches typos and cut-off codes', () => {
    const g = generateGarment(99);
    const code = encodeGarment(g);
    expect(decodeGarment(code.toLowerCase().replace(/-/g, ' '))).toEqual(g);
    expect(decodeGarment(code.replace(/-/g, ''))).toEqual(g);
    const flipped = code.slice(0, 12) + (code[12] === 'A' ? 'B' : 'A') + code.slice(13);
    expect(decodeGarment(flipped)).toBeNull();
    expect(decodeGarment(code.slice(0, code.length - 6))).toBeNull();
    expect(decodeGarment('VH-0000-0000')).toBeNull();
    expect(decodeGarment('hello')).toBeNull();
    expect(decodeGarment('')).toBeNull();
  });

  it('keeps codes a typeable length', () => {
    for (const s of SEEDS.slice(0, 100)) expect(encodeGarment(generateGarment(s)).length).toBeLessThan(180);
  });

  it('keeps a plain recipe\'s details as set', () => {
    const g = validateGarment({ slot: 'bottom', cut: 'straight', fabric: 'denim', base: '#3d5b8a', details: { wash: 0.4 }, name: 'Blue' })!;
    const back = decodeGarment(encodeGarment(g))!;
    expect(back.details).toEqual({ wash: 0.4 });
  });
});

describe('the rest of the game', () => {
  it('names a style the game already draws for each cut', () => {
    expect(garmentStyle(validateGarment({ slot: 'top', cut: 'hoodie', base: '#112233' })!)).toBe('hoodie');
    expect(garmentStyle(validateGarment({ slot: 'bottom', cut: 'shorts', base: '#112233' })!)).toBe('shorts');
  });

  it('says which part of the body wears it', () => {
    expect(bodyPart({ slot: 'dress' })).toBe('top');
    expect(bodyPart({ slot: 'bottom' })).toBe('bottom');
    expect(bodyPart({ slot: 'hat' })).toBeNull();
  });

  it('prices by cut, cloth, pattern and rarity', () => {
    const plain = validateGarment({ slot: 'top', cut: 'tee', fabric: 'cotton', base: '#112233' })!;
    const fancy: Garment = { ...plain, fabric: 'satin', rarity: 'rare', pattern: { kind: 'floral', colors: ['#ffffff'], scale: 1, angle: 0, seed: 1 } };
    expect(priceOf(plain)).toBe(20);
    expect(priceOf(fancy)).toBeGreaterThan(priceOf(plain) * 2);
  });

  it('compares what two garments draw, not what they are called', () => {
    const a = generateGarment(3);
    expect(sameCloth(a, { ...a, name: 'Other', tags: [] })).toBe(true);
    expect(sameCloth(a, { ...a, base: '#010203' })).toBe(false);
    expect(cleanName('  hi\n there ')).toBe('hi there');
  });
});

describe('pixel designs', () => {
  const art = { w: 8, h: 8, palette: ['#ff0000', '#00ff00', '#0000ff'], data: Array.from({ length: 64 }, (_, i) => String(i % 4)).join('') };
  const make = (pixels: unknown) => validateGarment({ slot: 'top', cut: 'tee', base: '#ffffff', name: 'Pixel tee', pattern: { kind: 'pixel', colors: ['#000000'], scale: 1, angle: 0, seed: 1, pixels } });

  it('keeps a good picture and drops a pattern with a bad one', () => {
    expect(make(art)!.pattern!.pixels).toEqual(art);
    expect(make({ ...art, w: 9, h: 9 })!.pattern).toBeUndefined();
    expect(make({ ...art, data: '1'.repeat(10) })!.pattern).toBeUndefined();
    expect(make({ ...art, data: 'x'.repeat(64) })!.pattern).toBeUndefined();
    expect(make(undefined)!.pattern).toBeUndefined();
  });

  it('points no cell at a colour that does not exist, and caps the palette at seven', () => {
    const r = make({ ...art, palette: ['#ff0000'], data: '3'.repeat(64) })!.pattern!.pixels!;
    expect(r.data).toBe('0'.repeat(64));
    const many = make({ ...art, palette: Array.from({ length: 12 }, (_, i) => '#' + String(i).padStart(6, '1')) })!.pattern!.pixels!;
    expect(many.palette).toHaveLength(7);
  });

  it('survives a share code, 8 and 16 cells square', () => {
    for (const w of [8, 16]) {
      const pixels = { w, h: w, palette: ['#ff0000', '#00ff00', '#0000ff', '#ffffff'], data: Array.from({ length: w * w }, (_, i) => String((i * 7 + (i >> 3)) % 5)).join('') };
      const g = make(pixels)!;
      expect(decodeGarment(encodeGarment(g))).toEqual(g);
    }
  });

  it('is never made by the generator', () => {
    for (const s of SEEDS) expect(generateGarment(s).pattern?.kind).not.toBe('pixel');
  });
});

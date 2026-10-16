import { describe, it, expect } from 'vitest';
import {
  STYLE_TAGS, rollStyle, rawTaste, computeTasteNorm, tasteOf,
  styleWords, TASTE_LINE,
} from '../state/taste';
import type { CatalogItem, StyleProfile } from '../state/taste';

const mockItems: CatalogItem[] = [
  { id: 'paint-sand', name: 'Sand paint', tags: ['warm', 'soft', 'natural'] },
  { id: 'paint-concrete', name: 'Concrete', tags: ['industrial', 'minimal'] },
  { id: 'paint-blush', name: 'Blush', tags: ['soft', 'playful', 'warm'] },
  { id: 'paint-sage', name: 'Sage', tags: ['natural', 'soft', 'cool'] },
  { id: 'paint-plum', name: 'Plum', tags: ['bold', 'luxe', 'cozy'] },
  { id: 'paper-dots', name: 'Dots', tags: ['playful', 'vintage'] },
];

function seededRng(seed: number): () => number {
  let x = seed >>> 0;
  return () => {
    x = (x + 0x6D2B79F5) | 0;
    let t = x;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('taste — style profile', () => {
  it('rollStyle produces all 12 tags', () => {
    const rng = seededRng(42);
    const st = rollStyle(rng, { soft: 0.45, natural: 0.5 });
    for (const tag of STYLE_TAGS) {
      expect(st[tag]).toBeDefined();
      expect(typeof st[tag]).toBe('number');
    }
    expect(st.seed).toBeGreaterThanOrEqual(0);
  });

  it('rollStyle applies bias', () => {
    const rng = seededRng(42);
    const st = rollStyle(rng, { cozy: 0.4 });
    // biased value should be higher than unbiased average on average
    expect(st.cozy).toBeGreaterThan(-0.6);
  });
});

describe('taste — rawTaste', () => {
  it('returns 0 for items without tags', () => {
    const st = rollStyle(seededRng(1));
    expect(rawTaste({ id: 'x', name: 'X' }, st)).toBe(0);
  });

  it('produces a number for tagged items', () => {
    const st = rollStyle(seededRng(1));
    const v = rawTaste(mockItems[0], st);
    expect(typeof v).toBe('number');
    expect(Number.isFinite(v)).toBe(true);
  });

  it('is deterministic for same style + item', () => {
    const st = rollStyle(seededRng(1));
    expect(rawTaste(mockItems[0], st)).toBe(rawTaste(mockItems[0], st));
  });
});

describe('taste — computeTasteNorm', () => {
  it('returns mean and sd', () => {
    const st = rollStyle(seededRng(1));
    const norm = computeTasteNorm(mockItems, st);
    expect(norm.mean).toBeTypeOf('number');
    expect(norm.sd).toBeGreaterThan(0);
    expect(norm.key).toBe(JSON.stringify(st));
  });

  it('handles empty list gracefully', () => {
    const st = rollStyle(seededRng(1));
    const norm = computeTasteNorm([], st);
    expect(norm.mean).toBe(0);
    expect(norm.sd).toBe(1);
  });
});

describe('taste — tasteOf', () => {
  it('returns integer in [-2, 2]', () => {
    const st = rollStyle(seededRng(1), { soft: 0.5, natural: 0.5, warm: 0.4 });
    const norm = computeTasteNorm(mockItems, st);
    for (const item of mockItems) {
      const v = tasteOf(item, st, norm);
      expect(v).toBeGreaterThanOrEqual(-2);
      expect(v).toBeLessThanOrEqual(2);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('returns 0 for items without tags', () => {
    const st = rollStyle(seededRng(1));
    const norm = computeTasteNorm(mockItems, st);
    expect(tasteOf({ id: 'x', name: 'X' }, st, norm)).toBe(0);
  });
});

describe('taste — styleWords', () => {
  it('returns loves and hates arrays', () => {
    const st: StyleProfile = {
      seed: 1, warm: 0.5, soft: 0.4, natural: 0.3,
      cool: 0.1, bold: 0, modern: -0.1, vintage: -0.2,
      playful: -0.3, luxe: -0.4, industrial: -0.5, cozy: 0.2, minimal: -0.15,
    };
    const w = styleWords(st);
    expect(w.loves.length).toBeGreaterThan(0);
    expect(w.loves.length).toBeLessThanOrEqual(3);
    expect(Array.isArray(w.hates)).toBe(true);
  });

  it('loves only includes tags above 0.15', () => {
    const st: StyleProfile = {
      seed: 1, warm: 0.5, soft: 0.2, natural: 0.16,
      cool: 0.1, bold: 0, modern: 0, vintage: 0,
      playful: 0, luxe: 0, industrial: 0, cozy: 0, minimal: 0,
    };
    const w = styleWords(st);
    expect(w.loves).toContain('warm');
    expect(w.loves).not.toContain('cool');
  });
});

describe('taste — TASTE_LINE', () => {
  it('has descriptions for all taste levels', () => {
    expect(TASTE_LINE[2]).toContain('loves');
    expect(TASTE_LINE[1]).toContain('likes');
    expect(TASTE_LINE[0]).toContain('lukewarm');
    expect(TASTE_LINE[-1]).toContain('not really');
    expect(TASTE_LINE[-2]).toContain('can not stand');
  });
});

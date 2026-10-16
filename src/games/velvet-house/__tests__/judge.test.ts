import { describe, it, expect } from 'vitest';
import { tasteOf, rawTaste, computeTasteNorm, rollStyle, type CatalogItem } from './taste';

describe('judge / taste outcomes', () => {
  const rng = () => 0.5;

  it('returns a score in [-2, 2]', () => {
    const style = rollStyle(rng);
    const items: CatalogItem[] = [
      { id: 'chair', name: 'Chair', tags: ['warm', 'cozy'] },
      { id: 'lamp', name: 'Lamp', tags: ['modern', 'cool'] },
    ];
    const norm = computeTasteNorm(items, style);
    const score = tasteOf(items[0], style, norm);
    expect(score).toBeGreaterThanOrEqual(-2);
    expect(score).toBeLessThanOrEqual(2);
  });

  it('items with no tags score 0', () => {
    const style = rollStyle(rng);
    const item: CatalogItem = { id: 'x', name: 'X' };
    const norm = computeTasteNorm([item], style);
    expect(tasteOf(item, style, norm)).toBe(0);
  });

  it('higher style match yields higher raw taste', () => {
    const style = rollStyle(rng);
    style.warm = 1;
    style.cool = -1;
    const warmItem: CatalogItem = { id: 'warm-chair', name: 'Warm Chair', tags: ['warm'] };
    const coolItem: CatalogItem = { id: 'cool-lamp', name: 'Cool Lamp', tags: ['cool'] };
    expect(rawTaste(warmItem, style)).toBeGreaterThan(rawTaste(coolItem, style));
  });

  it('computeTasteNorm returns mean and sd', () => {
    const style = rollStyle(rng);
    const items: CatalogItem[] = [
      { id: 'a', name: 'A', tags: ['warm'] },
      { id: 'b', name: 'B', tags: ['cool'] },
    ];
    const norm = computeTasteNorm(items, style);
    expect(typeof norm.mean).toBe('number');
    expect(typeof norm.sd).toBe('number');
    expect(norm.sd).toBeGreaterThan(0);
  });
});

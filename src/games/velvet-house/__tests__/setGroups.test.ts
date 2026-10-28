import { describe, it, expect } from 'vitest';
import { CATALOG, itemsForTab, catalogById } from '../state/catalog';
import { groupSets, groupsWithTag, PROMO_FILTER } from '../state/setGroups';

describe('the Sets tab, grouped by theme', () => {
  const shelf = () => itemsForTab('Sets');

  it('makes one group per theme, in catalog order, the set first and its finishing touches under it', () => {
    const groups = groupSets(shelf());
    const sets = shelf().filter((c) => c.id.startsWith('set-'));
    expect(groups.map((g) => g.set.id)).toEqual(sets.map((s) => s.id));
    const arcade = groups.find((g) => g.theme === 'arcade')!;
    expect(arcade.name).toBe('Arcade');
    expect(arcade.extras.map((e) => e.id)).toEqual(['touches-arcade']);
    expect(arcade.tags).toEqual(catalogById('set-arcade')!.tags);
    const retro = groups.find((g) => g.theme === 'retro')!;
    expect(retro.extras).toEqual([]);
    for (const g of groups) { expect(g.name).not.toMatch(/kitchen and living room/); for (const e of g.extras) expect(e.id).toBe(`touches-${g.theme}`); }
  });

  it('shows a promo pack in its place like the rest (locked until a code gives it), and has a Promo filter for them', () => {
    const promoThemes = CATALOG.filter((c) => c.promo && c.id.startsWith('set-')).map((c) => c.id.replace(/^set-/, ''));
    expect(promoThemes).toContain('cuddle');
    const groups = groupSets(shelf());
    for (const t of promoThemes) expect(groups.some((g) => g.theme === t), t).toBe(true);
    const cuddle = groups.find((g) => g.theme === 'cuddle')!;
    expect(cuddle.extras.map((e) => e.id)).toEqual(['touches-cuddle']);
    expect(groupsWithTag(groups, PROMO_FILTER).map((g) => g.theme)).toEqual(promoThemes);
  });

  it('filters by a feel: a tag keeps the themes that carry it, no tag keeps them all', () => {
    const groups = groupSets(shelf());
    expect(groupsWithTag(groups, null)).toHaveLength(groups.length);
    const playful = groupsWithTag(groups, 'playful').map((g) => g.theme);
    expect(playful).toContain('arcade');
    expect(playful).toContain('candy');
    expect(playful).not.toContain('gothic');
    expect(groupsWithTag(groups, 'luxe').map((g) => g.theme)).toContain('gothic');
    expect(groupsWithTag(groups, 'nonsense')).toEqual([]);
  });
});

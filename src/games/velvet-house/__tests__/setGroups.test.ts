import { describe, it, expect } from 'vitest';
import { CATALOG, itemsForTab, visibleItems, catalogById } from '../state/catalog';
import { groupSets, groupsWithTag } from '../state/setGroups';

describe('the Sets tab, grouped by theme', () => {
  const shelf = () => visibleItems(itemsForTab('Sets'), new Set());

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

  it('leaves a secret pack out until it is owned, then groups it like the rest', () => {
    const secretThemes = CATALOG.filter((c) => c.secret && c.set).map((c) => c.id.replace(/^set-/, ''));
    expect(secretThemes.length).toBeGreaterThan(0);
    for (const t of secretThemes) expect(groupSets(shelf()).some((g) => g.theme === t), t).toBe(false);
    const owned = new Set(CATALOG.filter((c) => c.secret).map((c) => c.id));
    for (const t of secretThemes) expect(groupSets(visibleItems(itemsForTab('Sets'), owned)).some((g) => g.theme === t), t).toBe(true);
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

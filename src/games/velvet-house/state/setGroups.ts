import type { CatalogEntry } from './catalog';

/** A theme in the Sets tab: its kitchen-and-living-room set, with its finishing touches (and any later extras) under it. */
export interface SetGroup { theme: string; name: string; tags: string[]; set: CatalogEntry; extras: CatalogEntry[] }

/** Groups the Sets tab's bundles by theme, in the order the sets appear: `set-<theme>` leads, `touches-<theme>` follows it. */
export function groupSets(items: CatalogEntry[]): SetGroup[] {
  const by = new Map<string, SetGroup>();
  const order: string[] = [];
  for (const it of items) {
    if (!it.set) continue;
    const m = /^(set|touches)-(.+)$/.exec(it.id);
    if (!m) continue;
    const [, kind, theme] = m;
    let gp = by.get(theme);
    if (!gp) { gp = { theme, name: theme, tags: [], set: null as unknown as CatalogEntry, extras: [] }; by.set(theme, gp); }
    if (kind === 'set') { gp.set = it; gp.name = it.name.replace(/ kitchen and living room$/i, ''); gp.tags = it.tags ?? []; order.push(theme); }
    else gp.extras.push(it);
  }
  return order.map((t) => by.get(t)!);
}

/** The groups that carry a tag; no tag means all of them. */
export function groupsWithTag(groups: SetGroup[], tag: string | null): SetGroup[] {
  return tag ? groups.filter((gp) => gp.tags.includes(tag)) : groups;
}

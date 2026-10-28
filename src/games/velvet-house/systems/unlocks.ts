import { unlockFor } from '../state/unlockCodes';
import { catalogById, setQuote } from '../state/catalog';
import { isPaintable } from '../state/scenes';
import type { Game } from '../kernel/game';

/** Unlock codes (state/unlockCodes.ts) applied to the house. */
export function createUnlocks(g: Game): Partial<Game> {
  const { view, owned, log } = g;

  /** True if `text` was a code (so chat should not handle it). */
  function tryUnlock(text: string): boolean {
    const code = unlockFor(text);
    if (!code) return false;
    const set = catalogById(code.setId);
    if (!set?.set) return false;
    if (owned.has(set.id)) { log('You already have that one. It is in your Sets tab.'); return true; }
    // Everything in the set is theirs, free; and if they are looking at a floor of the house, it goes on.
    const members = setQuote(set, new Set()).members;
    for (const m of members) owned.add(m.id);
    owned.add(set.id);
    if (isPaintable(view.level)) for (const m of members) g.handleBuy(m, undefined, true);
    log(code.welcome);
    g.refreshDrawer();
    return true;
  }
  return { tryUnlock };
}

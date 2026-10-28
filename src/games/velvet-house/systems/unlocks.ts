import { unlockFor, UNLOCK_CODES, type UnlockCode } from '../state/unlockCodes';
import { catalogById, setQuote } from '../state/catalog';
import { isPaintable } from '../state/scenes';
import { run } from '../kernel/config';
import { TYPES } from '../state/objects';
import type { Game } from '../kernel/game';

/** How long the new look gets to show (camera pull-back and sparkle) before the picture is taken. */
const SHOT_DELAY_MS = 1700;

/** Unlock codes (state/unlockCodes.ts) applied to the house, with a pop-up showing what was unlocked. */
export function createUnlocks(g: Game): Partial<Game> {
  const { owned, log, flags } = g;
  const pending = (): string[] => ((flags.pendingUnlocks as string[] | undefined) ??= []);
  let presenting = false;

  /** The pack goes on the house, and once it has settled a picture of the room goes in the pop-up. */
  function present(code: UnlockCode): void {
    const set = catalogById(code.setId);
    if (!set?.set) return;
    presenting = true;
    if (!isPaintable(g.view.level)) g.setLevel(1);
    for (const m of setQuote(set, new Set()).members) g.handleBuy(m, undefined, true);
    // The pack's furniture is set out with it (it waits in storage until then).
    for (const type of code.objects ?? []) g.unstore(`${type}-gift`);
    setTimeout(() => {
      let image: string | undefined;
      try { image = g.canvas.toDataURL('image/jpeg', 0.88); } catch { /* no picture: the pop-up still says what they got */ }
      g.celebrate({ kicker: 'Congrats, you just unlocked', title: code.packName, tagline: 'Try it out today!', image });
      log(code.welcome);
      presenting = false;
    }, SHOT_DELAY_MS);
  }

  const ready = (): boolean => g.s.settleDone && !g.s.scriptMode && !presenting;

  function codeForSet(id: string): UnlockCode | undefined {
    return Object.values(UNLOCK_CODES).find((c) => c.setId === id);
  }

  /** True if `text` was a code (so chat should not handle it). */
  function tryUnlock(text: string): boolean {
    const code = unlockFor(text);
    if (!code) return false;
    const set = catalogById(code.setId);
    if (!set?.set) return false;
    if (owned.has(set.id)) { log('You already have that one. It is in your Sets tab.'); return true; }
    // Everything in the set is theirs, free, from this moment.
    for (const m of setQuote(set, new Set()).members) owned.add(m.id);
    owned.add(set.id);
    for (const id of code.also ?? []) owned.add(id);
    if (code.lamps?.length) g.stockLamps(code.lamps);
    for (const type of code.objects ?? []) if (TYPES[type] && !g.storage.some((o) => o.id === `${type}-gift`) && !g.world.objs.some((o) => o.id === `${type}-gift`)) g.storage.push({ id: `${type}-gift`, type, level: 1, x: 5, y: 5, rot: 0 });
    if (ready()) present(code);
    else { pending().push(set.id); log(`${code.packName} is yours. It will be waiting once you have moved in.`); }
    g.refreshDrawer();
    return true;
  }

  // Packs unlocked mid-story or before moving in wait for a quiet moment.
  if (!run.attract) {
    setInterval(() => {
      if (!pending().length || !ready()) return;
      const code = codeForSet(pending().shift()!);
      if (code) present(code);
    }, 1000);
  }
  return { tryUnlock };
}

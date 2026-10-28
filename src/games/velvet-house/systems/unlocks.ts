import { unlockFor, codeWord, UNLOCK_CODES, type UnlockCode } from '../state/unlockCodes';
import { catalogById, setQuote, type CatalogEntry } from '../state/catalog';
import { isPaintable } from '../state/scenes';
import { run } from '../kernel/config';
import { createHostPromo, type PromoClaim } from '../bridge/hostPromo';
import type { Game } from '../kernel/game';

/** How long the new look gets to show (camera pull-back and sparkle) before the picture is taken. */
const SHOT_DELAY_MS = 1700;

/**
 * Promo codes (state/unlockCodes.ts) applied to the house, with a pop-up showing what was unlocked. Inside the app a
 * code is claimed for the account first (once per account); standalone there is no account, so it just works.
 */
export function createUnlocks(g: Game, claim: PromoClaim | null = createHostPromo()): Partial<Game> {
  const { owned, log, flags } = g;
  const pending = (): string[] => ((flags.pendingUnlocks as string[] | undefined) ??= []);
  let presenting = false;

  const setsOf = (code: UnlockCode): CatalogEntry[] =>
    code.setIds.map((id) => catalogById(id)).filter((s): s is CatalogEntry => !!s?.set);

  /** The packs go on the house, and once they have settled a picture of the room goes in the pop-up. */
  function present(code: UnlockCode): void {
    const sets = setsOf(code);
    if (!sets.length) return;
    presenting = true;
    if (!isPaintable(g.view.level)) g.setLevel(1);
    for (const set of sets) for (const m of setQuote(set, new Set()).members) g.handleBuy(m, undefined, true);
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
    return Object.values(UNLOCK_CODES).find((c) => c.setIds.includes(id));
  }

  /** Everything in the packs is theirs, free, from this moment. */
  function grant(code: UnlockCode, sets: CatalogEntry[]): void {
    for (const set of sets) {
      for (const m of setQuote(set, new Set()).members) owned.add(m.id);
      owned.add(set.id);
    }
    if (ready()) present(code);
    else { pending().push(sets[0].id); log(`${code.packName} is yours. It will be waiting once you have moved in.`); }
    g.refreshDrawer();
  }

  /** True if `text` was a code (so chat should not handle it). */
  function tryUnlock(text: string): boolean {
    const code = unlockFor(text);
    if (!code) return false;
    const sets = setsOf(code);
    if (!sets.length) return false;
    if (sets.every((s) => owned.has(s.id))) { log('You already have that one. It is in your Sets tab.'); return true; }
    if (!claim) { grant(code, sets); return true; }
    claim(codeWord(code)).then((answer) => {
      if (answer === 'used') { log('That code has already been used on your account, in another house. Each code works once per account.'); return; }
      grant(code, sets);
    });
    return true;
  }

  // Packs unlocked mid-story or before moving in wait for a quiet moment.
  if (!run.attract && !run.visit) {
    setInterval(() => {
      if (!pending().length || !ready()) return;
      const code = codeForSet(pending().shift()!);
      if (code) present(code);
    }, 1000);
  }
  return { tryUnlock };
}

import { unlockFor, codeWord, UNLOCK_CODES, type UnlockCode } from '../state/unlockCodes';
import { catalogById, setQuote, type CatalogEntry } from '../state/catalog';
import { isPaintable } from '../state/scenes';
import { run } from '../kernel/config';
import { createHostPromo, type HostPromo } from '../bridge/hostPromo';
import { TYPES } from '../state/objects';
import type { Game } from '../kernel/game';

/** How long the new look gets to show (camera pull-back and sparkle) before the picture is taken. */
const SHOT_DELAY_MS = 1700;

/**
 * Promo codes (state/unlockCodes.ts). However a pack is unlocked (said in chat, typed on the start menu's Cheats
 * screen, or already on the account from another house), the game stops once the player is in the house with no story
 * playing and a pop-up says what they unlocked: Apply it now (it goes on, then a picture of it) or Not now (it waits in
 * the Sets tab with Apply). Inside the app a code is the account's: the host records it, and every house on the account
 * gets the packs when it opens.
 */
export function createUnlocks(g: Game, host: HostPromo | null = createHostPromo()): Partial<Game> {
  const { owned, log, flags } = g;
  const pending = (): string[] => ((flags.pendingUnlocks as string[] | undefined) ??= []);
  let presenting = false;

  const setsOf = (code: UnlockCode): CatalogEntry[] =>
    code.setIds.map((id) => catalogById(id)).filter((s): s is CatalogEntry => !!s?.set);

  /** "You unlocked Nana": what they got, with Apply it now or Not now. */
  function offer(code: UnlockCode): void {
    const sets = setsOf(code);
    if (!sets.length) return;
    presenting = true;
    const pieces = sets.reduce((n, s) => n + (s.set?.items.length ?? 0), 0) + (code.also?.length ?? 0);
    g.celebrate({
      kicker: 'You unlocked',
      title: code.packName,
      detail: `${sets.map((s) => s.name).join(' and ')}: ${pieces} pieces, free. It's in your shop now.`,
      button: 'Apply it now',
      onButton: () => { presenting = false; present(code); },
      secondary: 'Not now',
      onSecondary: () => { presenting = false; log(`${code.packName} is in your Sets tab, ready to Apply whenever you want it.`); },
    });
  }

  /** The packs go on the house, and once they have settled a picture of the room goes in the pop-up. */
  function present(code: UnlockCode): void {
    const sets = setsOf(code);
    if (!sets.length) return;
    presenting = true;
    if (!isPaintable(g.view.level)) g.setLevel(1);
    for (const set of sets) for (const m of setQuote(set, new Set()).members) g.handleBuy(m, undefined, true);
    // The pack's furniture is set out with it (it waits in storage until then).
    for (const type of code.objects ?? []) g.unstore(`${type}-gift`);
    setTimeout(() => {
      let image: string | undefined;
      try { image = g.canvas.toDataURL('image/jpeg', 0.88); } catch { /* no picture: the pop-up still says what they got */ }
      g.celebrate({ kicker: 'Here it is', title: code.packName, tagline: 'Arrange can switch any piece back.', image });
      log(code.welcome);
      presenting = false;
    }, SHOT_DELAY_MS);
  }

  // Not over the story while it is telling something; an open objective is fine (the player may never finish it).
  const ready = (): boolean => g.s.settleDone && g.s.scriptMode !== 'cutscene' && !g.s.storyCard && !presenting;

  function codeForSet(id: string): UnlockCode | undefined {
    return Object.values(UNLOCK_CODES).find((c) => c.setIds.includes(id));
  }

  /** Everything in the packs is theirs, free, from this moment: the sets, anything else the code gives, its wall lamps and its furniture (in storage). */
  function own(code: UnlockCode, sets: CatalogEntry[]): void {
    for (const set of sets) {
      for (const m of setQuote(set, new Set()).members) owned.add(m.id);
      owned.add(set.id);
    }
    for (const id of code.also ?? []) owned.add(id);
    if (code.lamps?.length) g.stockLamps(code.lamps);
    for (const type of code.objects ?? []) {
      const id = `${type}-gift`;
      if (TYPES[type] && !g.storage.some((o) => o.id === id) && !g.world.objs.some((o) => o.id === id)) g.storage.push({ id, type, level: 1, x: 5, y: 5, rot: 0 });
    }
  }

  function grant(code: UnlockCode, sets: CatalogEntry[]): void {
    own(code, sets);
    if (ready()) offer(code);
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
    grant(code, sets);
    host?.record(codeWord(code));
    return true;
  }

  // Codes on the account (typed on the start menu, or redeemed in another house): this house has those packs too, and
  // says so with the same pop-up, so the player chooses whether to put them on.
  host?.onAccountCodes((words) => {
    for (const w of words) {
      const code = unlockFor(w);
      if (!code) continue;
      const sets = setsOf(code);
      if (!sets.length || sets.every((s) => owned.has(s.id))) continue;
      own(code, sets);
      if (ready()) offer(code);
      else pending().push(sets[0].id);
    }
    g.refreshDrawer();
  });

  // Packs unlocked mid-story or before moving in wait for a quiet moment.
  if (!run.attract && !run.visit) {
    setInterval(() => {
      if (!pending().length || !ready()) return;
      const code = codeForSet(pending().shift()!);
      if (code) offer(code);
    }, 1000);
  }
  return { tryUnlock };
}

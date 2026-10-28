import { readQueue, writeQueue } from '../state/codeQueue';
import { SAVE_KEY } from '../kernel/config';
import type { Game } from '../kernel/game';

/**
 * Where the title screen's saved codes wait (the title screen and the game share this key). It is the same for every
 * house: the title screen can open with one companion and the player then move in with another, so a code typed there
 * must not be tied to the house the menu happened to open with. The old per-house key is still read.
 */
export const CODE_QUEUE_KEY = 'velvet-sims:codes';
const OLD_KEY = `${SAVE_KEY}:codes`;

/** Redeems the codes saved from the title screen (unlock codes and the developer's money phrase) once the player is in their house. */
export function createCodeQueue(g: Game): Partial<Game> {
  function drain(): void {
    const queue = [...readQueue(localStorage, CODE_QUEUE_KEY), ...(OLD_KEY === CODE_QUEUE_KEY ? [] : readQueue(localStorage, OLD_KEY))];
    if (!queue.length) return;
    for (const text of queue) { if (!g.tryUnlock(text)) g.tryDevMoney(text); }
    writeQueue(localStorage, CODE_QUEUE_KEY, []);
    writeQueue(localStorage, OLD_KEY, []);
  }
  setTimeout(drain, 1500);
  return {};
}

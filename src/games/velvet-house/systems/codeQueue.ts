import { readQueue, writeQueue } from '../state/codeQueue';
import { unlockFor } from '../state/unlockCodes';
import { SAVE_KEY } from '../kernel/config';
import type { Game } from '../kernel/game';

/** Where the title screen's saved codes wait (the title screen and the game share this key). */
export const CODE_QUEUE_KEY = `${SAVE_KEY}:codes`;

/**
 * Redeems the codes saved from the title screen once the player is in their house. An unlock code goes straight away;
 * a cheat code waits for the move-in to be over (the same rule as the in-game console).
 */
export function createCodeQueue(g: Game): Partial<Game> {
  function drain(): void {
    const queue = readQueue(localStorage, CODE_QUEUE_KEY);
    if (!queue.length) return;
    const waiting: string[] = [];
    for (const text of queue) {
      if (unlockFor(text)) g.tryUnlock(text);
      else if (g.cheatsBlocked()) waiting.push(text);
      else g.runCheat(text);
    }
    writeQueue(localStorage, CODE_QUEUE_KEY, waiting);
  }
  setTimeout(drain, 1500);
  setInterval(drain, 3000);
  return {};
}

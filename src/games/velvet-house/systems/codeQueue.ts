import { readQueue, writeQueue } from '../state/codeQueue';
import { SAVE_KEY } from '../kernel/config';
import type { Game } from '../kernel/game';

/** Where the title screen's saved codes wait (the title screen and the game share this key). */
export const CODE_QUEUE_KEY = `${SAVE_KEY}:codes`;

/** Redeems the unlock codes saved from the title screen once the player is in their house. */
export function createCodeQueue(g: Game): Partial<Game> {
  function drain(): void {
    const queue = readQueue(localStorage, CODE_QUEUE_KEY);
    if (!queue.length) return;
    for (const text of queue) g.tryUnlock(text);
    writeQueue(localStorage, CODE_QUEUE_KEY, []);
  }
  setTimeout(drain, 1500);
  return {};
}

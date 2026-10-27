import { postToParent, isStartAnswerMessage, isCompanionsMessage, isValidOrigin, type StartMode } from './protocol';

/**
 * A player can have several companions (a partner and a friend, say), each with a house of their own. The host tells
 * the game how many there are and how many already have a house. With more than one, choosing Start or Continue on
 * the title screen asks the host to put up its "who?" screen, and the game waits for the answer. (Picking someone
 * else replaces the whole game page, so the wait simply ends.)
 */
export const companionChoices = { count: 0, houses: 0 };
const watchers: Array<() => void> = [];

export function setCompanionCount(n: number, houses = 0): void {
  companionChoices.count = Math.max(0, Math.floor(n));
  companionChoices.houses = Math.max(0, Math.floor(houses));
  watchers.forEach((w) => w());
}

export const hasChoice = (): boolean => companionChoices.count >= 2;
/** Some companion has a house to continue, whoever the page opened with. */
export const anyHouse = (): boolean => companionChoices.houses > 0;
/** The title screen redraws when the answer arrives late. */
export function onCompanionsChanged(fn: () => void): void { watchers.push(fn); }

const hostOrigins = (): string[] => {
  try { const o = new URL(document.referrer).origin; return o ? [o] : []; } catch { return []; }
};

/** On the title screen, before the game proper has started: ask the host how many companions there are. */
export function listenForCompanions(): void {
  window.addEventListener('message', (e: MessageEvent) => {
    if (isValidOrigin(e.origin, hostOrigins()) && isCompanionsMessage(e.data)) setCompanionCount(e.data.count, e.data.houses ?? 0);
  });
  postToParent({ type: 'velvet:menuReady', game: 'velvet-house' });
}

/** Ask the host who: to move in (`new`) or whose house to go back to (`continue`). Resolves 'go' to carry on with the current companion, or 'cancel' if they backed out. */
export function askWho(mode: StartMode): Promise<'go' | 'cancel'> {
  return new Promise((resolve) => {
    const onMessage = (e: MessageEvent): void => {
      if (!isValidOrigin(e.origin, hostOrigins()) || !isStartAnswerMessage(e.data)) return;
      window.removeEventListener('message', onMessage);
      resolve(e.data.type === 'velvet:startGo' ? 'go' : 'cancel');
    };
    window.addEventListener('message', onMessage);
    postToParent({ type: 'velvet:startRequested', game: 'velvet-house', mode });
  });
}

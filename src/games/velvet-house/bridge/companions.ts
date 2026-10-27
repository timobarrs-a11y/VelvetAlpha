import { postToParent, isStartAnswerMessage, isCompanionsMessage, isValidOrigin } from './protocol';

/**
 * A player can have several companions (a partner and a friend, say). The host tells the game how many; with more
 * than one, choosing Start on the title screen asks the host to put up its "who moves in?" screen, and the game waits
 * for the answer. (Picking someone else replaces the whole game page, so the wait simply ends.)
 */
export const companionChoices = { count: 0 };

export function setCompanionCount(n: number): void {
  companionChoices.count = Math.max(0, Math.floor(n));
}

export const hasChoice = (): boolean => companionChoices.count >= 2;

const hostOrigins = (): string[] => {
  try { const o = new URL(document.referrer).origin; return o ? [o] : []; } catch { return []; }
};

/** On the title screen, before the game proper has started: ask the host how many companions there are. */
export function listenForCompanions(): void {
  window.addEventListener('message', (e: MessageEvent) => {
    if (isValidOrigin(e.origin, hostOrigins()) && isCompanionsMessage(e.data)) setCompanionCount(e.data.count);
  });
  postToParent({ type: 'velvet:menuReady', game: 'velvet-house' });
}

/** Ask the host who is moving in. Resolves 'go' to carry on with the current companion, or 'cancel' if they backed out. */
export function askWhoMovesIn(): Promise<'go' | 'cancel'> {
  return new Promise((resolve) => {
    const allowed: string[] = (() => {
      try { const o = new URL(document.referrer).origin; return o ? [o] : []; } catch { return []; }
    })();
    const onMessage = (e: MessageEvent): void => {
      if (!isValidOrigin(e.origin, allowed) || !isStartAnswerMessage(e.data)) return;
      window.removeEventListener('message', onMessage);
      resolve(e.data.type === 'velvet:startGo' ? 'go' : 'cancel');
    };
    window.addEventListener('message', onMessage);
    postToParent({ type: 'velvet:startRequested', game: 'velvet-house' });
  });
}

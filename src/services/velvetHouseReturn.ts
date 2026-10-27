/**
 * Velvet House is a home you share with a companion. A player who opens it with none is sent through the companion
 * pipeline (questionnaire, voice, avatar, environment) and brought back to the house when it is done. The mark says
 * "bring me back"; it expires, so a pipeline started for some other reason never lands in the game.
 */
const KEY = 'velvetHouseReturn';
const MAX_AGE_MS = 2 * 60 * 60 * 1000;
export const HOUSE_ROUTE = '/velvet-house';

export function markReturnToHouse(now = Date.now()): void {
  try { sessionStorage.setItem(KEY, String(now)); } catch { /* storage blocked: the pipeline just ends where it usually does */ }
}

/** True once, when the player came from the house and the mark has not expired; the mark is used up either way. */
export function takeReturnToHouse(now = Date.now()): boolean {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    const at = raw === null ? NaN : Number(raw);
    return Number.isFinite(at) && now - at >= 0 && now - at <= MAX_AGE_MS;
  } catch { return false; }
}

/** Put the mark away without using it (they got to the house some other way). */
export function clearReturnToHouse(): void {
  try { sessionStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}

/**
 * Promo codes: a phrase said to the partner in chat (or typed on the start menu's Cheats screen) that gives the player
 * promo packs for free. Promo packs are in the shop by name, locked, and can't be bought: a code is the only way in.
 * During the alpha they are handed out to players to get them trying the game. A code works once per account (the app
 * records it; restarting the same house gets it back). A code is caught in `handleTalk` before anything is sent to the
 * AI or written to the chat history, so it is not remembered or answered.
 *
 * To add one: mark the pack and its pieces `promo(...)` in state/catalog.ts, and add a line here.
 */

export interface UnlockCode {
  /** The catalog ids of the promo sets it gives (each set's looks, wallpaper, floor and pieces come with it). */
  setIds: string[];
  /** The pack's short name, for the celebration popup and the log: "Cuddle Clouds". */
  packName: string;
  /** What the log says when it works. */
  welcome: string;
}

/** Codes are lower case; what the player types is compared in any case with the spaces around it ignored. */
export const UNLOCK_CODES: Record<string, UnlockCode> = {
  rainbowhugs: { setIds: ['set-cuddle', 'touches-cuddle'], packName: 'Cuddle Clouds', welcome: 'Cuddle Clouds is yours, free: bears, clouds and rainbows, and its finishing touches. It is in your Sets tab, and Arrange can switch any piece to it.' },
  luv2dance: { setIds: ['set-nana'], packName: 'Nana', welcome: 'Nana is yours, free: pastel pink, lilac and butter, ruffles, bows and cloud lights. It is in your Sets tab, and Arrange can switch any piece to it.' },
};

/** The code the text is exactly, or null (so it goes on to the partner as an ordinary message). */
export function unlockFor(text: string): UnlockCode | null {
  return UNLOCK_CODES[text.trim().toLowerCase()] ?? null;
}

/** The code's own word, for recording it against the account. */
export function codeWord(code: UnlockCode): string {
  return Object.entries(UNLOCK_CODES).find(([, c]) => c === code)![0];
}

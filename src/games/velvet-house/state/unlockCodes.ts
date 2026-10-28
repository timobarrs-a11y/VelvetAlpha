/**
 * Unlock codes: a phrase said to the partner in chat that gives the player something for free, such as a secret pack
 * that is not on the shop's shelves. They are gifts and keepsakes: the developer hands a code to a person, and nobody
 * else ever finds it in the shop. A code is caught in `handleTalk` before anything is sent to the AI or written to the
 * chat history, so it is not remembered or answered.
 *
 * To add one: add a secret set to the catalog (`secret(...)` in state/catalog.ts) and a line here.
 */

export interface UnlockCode {
  /** The catalog id of the secret set it gives (the set's looks, wallpaper and floor come with it). */
  setId: string;
  /** The pack's short name, for the celebration popup and the log: "Cloud Nine". */
  packName: string;
  /** What the log says when it works. */
  welcome: string;
}

/** Codes are lower case; what the player types is compared in any case with the spaces around it ignored. */
export const UNLOCK_CODES: Record<string, UnlockCode> = {
  rainbowhugs: { setId: 'set-cloud', packName: 'Cloud Nine', welcome: 'Cloud Nine is yours, free: clouds, rainbows and stars. It is in your Sets tab, and Arrange can switch any piece to it.' },
};

/** The code the text is exactly, or null (so it goes on to the partner as an ordinary message). */
export function unlockFor(text: string): UnlockCode | null {
  return UNLOCK_CODES[text.trim().toLowerCase()] ?? null;
}

/**
 * The developer's money phrase, for testing the shop (the mix-and-match sets). It is one of the game's two code
 * mechanisms: this one is the developer's (a phrase said to the partner in chat, no menu, key or gesture); the other is
 * the unlock codes given to players (state/unlockCodes.ts). It is caught in `handleTalk` before anything is sent to the AI or written to the chat history, so it leaves no
 * trace there. Money is all it does: no story flag, no clock.
 */

export const DEV_PHRASE = 'xoxotimoisgodxoxo';
/** Typed without the second "i" by mistake more than once, so it counts too: a miss would look like a broken code. */
const PHRASES = new Set([DEV_PHRASE, 'xoxotimosgodxoxo']);
export const DEV_FUND = 500_000;

/** The money to add if the text is exactly the phrase (any case, spaces around it ignored), else null: an ordinary message. */
export function parseFund(text: string): number | null {
  return PHRASES.has(text.trim().toLowerCase()) ? DEV_FUND : null;
}

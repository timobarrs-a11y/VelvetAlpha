import { TASTE_DECK_CARDS } from '../questionnaire/personalBank';

// "This or that" in the feed: the old onboarding swipe deck, one pair a day,
// saved to user_profiles.taste_picks for companions to pick up.

export type TastePicks = Record<string, string>;
export type TasteCard = (typeof TASTE_DECK_CARDS)[number];

export const pairKey = (card: TasteCard) => `${card.left.label} / ${card.right.label}`;

/** Today's pair: the first one they haven't answered, starting from today's spot in the deck. */
export function todaysPair(picks: TastePicks, now = new Date()): TasteCard | null {
  const day = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86_400_000);
  for (let i = 0; i < TASTE_DECK_CARDS.length; i++) {
    const card = TASTE_DECK_CARDS[(day + i) % TASTE_DECK_CARDS.length];
    if (!picks[pairKey(card)]) return card;
  }
  return null;
}

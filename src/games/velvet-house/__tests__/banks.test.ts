import { describe, it, expect } from 'vitest';
import { humorKey, commKey, BANKS, HUMOR_KEYS, COMM_KEYS } from '../content/banks';

// The exact answers the companion questionnaire offers (pages/QuestionnairePage.tsx), in both the long form it
// shows and the short form the random companion stores.
describe('companion styles map to word banks', () => {
  it('every humor answer finds its bank', () => {
    expect(humorKey('Witty & Clever - Smart Jokes & Wordplay')).toBe('witty');
    expect(humorKey('Goofy & Random - Silly & Unpredictable')).toBe('goofy');
    expect(humorKey('Sarcastic & Dry - Subtle & Deadpan')).toBe('dry');
    expect(humorKey('Warm & Light - Positive & Feel-Good Humor')).toBe('warm');
    expect(['Witty & Clever', 'Goofy & Random', 'Sarcastic & Dry', 'Warm & Light'].map(humorKey)).toEqual(['witty', 'goofy', 'dry', 'warm']);
  });
  it('every communication answer finds its bank', () => {
    expect(commKey('Very Direct & Straightforward - Says Exactly What She Means')).toBe('direct');
    expect(commKey('Diplomatic & Tactful - Gentle, Considers Your Feelings')).toBe('diplomatic');
    expect(commKey('Playfully Indirect - Hints, Teases, Makes You Guess')).toBe('playful');
    expect(commKey('Subtle & Suggestive - Reads Between Lines')).toBe('subtle');
    expect(['Very Direct & Straightforward', 'Diplomatic & Tactful', 'Playfully Indirect', 'Subtle & Suggestive'].map(commKey)).toEqual(['direct', 'diplomatic', 'playful', 'subtle']);
  });
  it('nothing set falls back to the gentlest style', () => {
    expect(humorKey(undefined)).toBe('warm');
    expect(commKey(null)).toBe('diplomatic');
  });
  it('every style has the same slots', () => {
    for (const [bank, keys] of [['humor', HUMOR_KEYS], ['communication', COMM_KEYS]] as const) {
      const slots = keys.map((k) => Object.keys(BANKS[bank][k]).sort().join());
      expect(new Set(slots).size).toBe(1);
    }
  });
});

describe('a humor that is a mix', () => {
  it('goes by the first style named, since that is the main one', () => {
    expect(humorKey('Witty & Clever + Warm & Light')).toBe('witty');
    expect(humorKey('Warm & Light + Sarcastic & Dry')).toBe('warm');
    expect(humorKey('Sarcastic & Dry + Goofy & Random')).toBe('dry');
    expect(humorKey('Goofy & Random + Witty & Clever')).toBe('goofy');
  });
});

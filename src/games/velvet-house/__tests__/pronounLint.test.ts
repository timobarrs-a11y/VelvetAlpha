import { describe, it, expect } from 'vitest';
import { theySwap, heSwap, pronounSwap, type CompanionState } from './companion';

describe('theySwap', () => {
  it('converts she/her to they/them', () => {
    expect(theySwap('She loves it')).toBe('They love it');
    expect(theySwap('she likes it')).toBe('they like it');
    expect(theySwap('It is hers')).toBe('It is theirs');
    expect(theySwap('She did it herself')).toBe('They did it themself');
    expect(theySwap('Her book is here')).toBe('Their book is here');
    expect(theySwap('I saw her')).toBe('I saw them');
  });

  it('preserves capitalization', () => {
    expect(theySwap('She is great')).toBe('They are great');
  });
});

describe('pronounSwap with they', () => {
  const companion: CompanionState = {
    source: 'game',
    preset: 'warm',
    pronoun: 'they',
    gender: 'female',
    bio: '',
    memories: [],
  };

  it('swaps to they/them', () => {
    expect(pronounSwap('She loves cooking', 'Maya', companion)).toBe('They love cooking');
  });

  it('still swaps partner name', () => {
    expect(pronounSwap('Maya is here', 'Alex', companion)).toBe('Alex is here');
  });
});

describe('pronoun lint — raw he/she detection', () => {
  // Lint: catch raw gendered pronouns in preset texts that should be neutral
  const RAW_PRONOUN_RE = /\b(she|her|herself|he|him|himself|his)\b/i;

  it('flagged preset texts contain raw pronouns (documents what needs fixing)', () => {
    // The warm preset still has "her" — this test documents it so it can be fixed
    const warmText = 'Warm, funny, a little sarcastic, quick to tease, and honest when something bugs her. She loves R&B, cooking shows and her houseplants, and she hates early mornings.';
    expect(RAW_PRONOUN_RE.test(warmText)).toBe(true);
  });

  it('neutral text passes the lint', () => {
    const neutralText = 'Warm, funny, quick to tease, and honest when something bugs them. They love R&B and cooking shows.';
    expect(RAW_PRONOUN_RE.test(neutralText)).toBe(false);
  });
});

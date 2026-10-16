import { describe, it, expect } from 'vitest';
import {
  PRESETS, heSwap, replaceName, pronounSwap, playerPronounSwap,
} from '../state/companion';
import type { CompanionState } from '../state/companion';

function sheCompanion(): CompanionState {
  return { source: 'game', preset: 'warm', pronoun: 'she', gender: 'female', bio: '', memories: [] };
}

function heCompanion(): CompanionState {
  return { source: 'game', preset: 'warm', pronoun: 'he', gender: 'male', bio: '', memories: [] };
}

describe('companion — PRESETS', () => {
  it('has 4 presets', () => {
    expect(Object.keys(PRESETS).length).toBe(4);
  });

  it('has warm preset', () => {
    expect(PRESETS.warm.label).toBe('Warm and teasing');
    expect(PRESETS.warm.text).toContain('R&B');
  });

  it('has calm preset', () => {
    expect(PRESETS.calm.label).toBe('Calm and thoughtful');
  });

  it('has bubbly preset', () => {
    expect(PRESETS.bubbly.label).toBe('Bubbly and chaotic');
  });

  it('has dry preset', () => {
    expect(PRESETS.dry.label).toBe('Dry and witty');
  });
});

describe('companion — heSwap', () => {
  it('swaps she to he', () => {
    expect(heSwap('She is here')).toBe('He is here');
    expect(heSwap('she is here')).toBe('he is here');
  });

  it("swaps she's to he's", () => {
    expect(heSwap("She's happy")).toBe("He's happy");
    expect(heSwap("she's happy")).toBe("he's happy");
  });

  it('swaps herself to himself', () => {
    expect(heSwap('She did it herself')).toBe('He did it himself');
  });

  it('swaps hers to his', () => {
    expect(heSwap('It is hers')).toBe('It is his');
  });

  it('swaps her to him when followed by object word', () => {
    expect(heSwap('Maya told her about it')).toBe('Maya told him about it');
  });

  it('swaps her to his when followed by noun', () => {
    expect(heSwap('Maya opened her book')).toBe('Maya opened his book');
  });

  it('swaps Her to His at start of sentence with noun', () => {
    expect(heSwap('Her book is on the table')).toBe('His book is on the table');
  });

  it('swaps Her to Him at start of sentence with object word', () => {
    expect(heSwap('Her and Maya went to the store')).toBe('Him and Maya went to the store');
  });

  it('handles complex sentences', () => {
    const s = "She put her coat on her chair and she's happy about it";
    const r = heSwap(s);
    expect(r).toBe("He put his coat on his chair and he's happy about it");
  });
});

describe('companion — replaceName', () => {
  it('replaces whole-word occurrences', () => {
    expect(replaceName('Maya went home', 'Maya', 'Jordan')).toBe('Jordan went home');
  });

  it('does not replace partial matches', () => {
    expect(replaceName('Mayan ruins', 'Maya', 'Jordan')).toBe('Mayan ruins');
  });

  it('returns same string when names match', () => {
    expect(replaceName('Maya is here', 'Maya', 'Maya')).toBe('Maya is here');
  });

  it('replaces multiple occurrences', () => {
    expect(replaceName('Maya and Maya went out', 'Maya', 'Jordan')).toBe('Jordan and Jordan went out');
  });
});

describe('companion — pronounSwap', () => {
  it('returns non-string input unchanged', () => {
    expect(pronounSwap(42 as unknown as string, 'Maya', sheCompanion())).toBe(42);
  });

  it('leaves Maya text unchanged with default companion', () => {
    expect(pronounSwap('Maya is here', 'Maya', sheCompanion())).toBe('Maya is here');
  });

  it('replaces Maya name when partnerName differs', () => {
    expect(pronounSwap('Maya is here', 'Jordan', sheCompanion())).toBe('Jordan is here');
  });

  it('replaces pronouns when companion uses he', () => {
    expect(pronounSwap('She opened her book', 'Maya', heCompanion())).toBe('He opened his book');
  });

  it('replaces both name and pronouns', () => {
    expect(pronounSwap('Maya opened her book', 'Alex', heCompanion())).toBe('Alex opened his book');
  });
});

describe('companion — playerPronounSwap', () => {
  it('keeps player text pronouns (starts with simName)', () => {
    const s = 'Jordan: I told Maya about it';
    expect(playerPronounSwap(s, 'Jordan', 'Alex', heCompanion())).toBe('Jordan: I told Alex about it');
  });

  it('applies full pronoun swap for non-player text', () => {
    const s = 'Maya opened her book';
    expect(playerPronounSwap(s, 'Jordan', 'Alex', heCompanion())).toBe('Alex opened his book');
  });

  it('does not rename Maya in player text when partner is Maya', () => {
    const s = 'Jordan: I told Maya about it';
    expect(playerPronounSwap(s, 'Jordan', 'Maya', sheCompanion())).toBe(s);
  });
});

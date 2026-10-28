import { describe, it, expect, vi } from 'vitest';

vi.mock('../../shared/supabase/client', () => ({ supabase: {} }));

const { isModerationBlock, throwIfModerated, saveErrorMessage, cleanTerm, ModerationBlockedError } = await import('../moderation');

const block = { code: 'VM001', message: "That includes a slur or hate speech, which Velvet doesn't allow." };

describe('moderation helpers', () => {
  it('recognizes the database block code', () => {
    expect(isModerationBlock(block)).toBe(true);
    expect(isModerationBlock({ code: '23505', message: 'duplicate' })).toBe(false);
    expect(isModerationBlock(null)).toBe(false);
  });

  it('re-throws only blocks, keeping the message', () => {
    expect(() => throwIfModerated(block)).toThrow(ModerationBlockedError);
    expect(() => throwIfModerated(block)).toThrow(block.message);
    expect(() => throwIfModerated({ code: '42501', message: 'rls' })).not.toThrow();
    expect(() => throwIfModerated(null)).not.toThrow();
  });

  it('shows the block reason, otherwise the fallback', () => {
    expect(saveErrorMessage(new ModerationBlockedError('No slurs.'), 'Try again.')).toBe('No slurs.');
    expect(saveErrorMessage(new Error('network down'), 'Try again.')).toBe('Try again.');
  });

  it('cleans admin input into the shape the database accepts', () => {
    expect(cleanTerm('  Porch-Monkey!! ')).toBe('porch monkey');
    expect(cleanTerm('14  88')).toBe('14 88');
    expect(cleanTerm('***')).toBe('');
  });
});

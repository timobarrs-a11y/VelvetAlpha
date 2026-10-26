import { describe, it, expect } from 'vitest';
import { isLookChangedMessage, isAvatarLookMessage, sanitizeMessage } from '../bridge/protocol';

const base = { type: 'velvet:lookChanged', game: 'velvet-house', who: 'player' };
const top = { style: 'cop', color: '#2c4a7a', accent: '#c9a24a' };
const bottom = { style: 'cop_pants', color: '#1f2f4f' };

describe('look changed messages', () => {
  it('accepts a shirt, pants or hat on their own, or all together', () => {
    expect(isLookChangedMessage({ ...base, top })).toBe(true);
    expect(isLookChangedMessage({ ...base, bottom })).toBe(true);
    expect(isLookChangedMessage({ ...base, hat: 'cop_cap' })).toBe(true);
    expect(isLookChangedMessage({ ...base, top, bottom, hat: 'none' })).toBe(true);
  });

  it('rejects a change that changes nothing, and malformed pieces', () => {
    expect(isLookChangedMessage(base)).toBe(false);
    expect(isLookChangedMessage({ ...base, top: { style: 5, color: '#fff' } })).toBe(false);
    expect(isLookChangedMessage({ ...base, bottom: { style: 'x' } })).toBe(false);
    expect(isLookChangedMessage({ ...base, hat: 12 })).toBe(false);
    expect(isLookChangedMessage({ ...base, hat: 'x'.repeat(50) })).toBe(false);
    expect(isLookChangedMessage({ ...base, who: 'partner', top })).toBe(false);
  });

  it('lets the whole change through the whitelist and nothing else', () => {
    const out = sanitizeMessage({ ...base, top, bottom, hat: 'cop_cap', secret: 'x' });
    expect(Object.keys(out).sort()).toEqual(['bottom', 'game', 'hat', 'top', 'type', 'who']);
  });
});

describe('avatar look messages', () => {
  it('carry fresh head frames for the player', () => {
    expect(isAvatarLookMessage({ type: 'velvet:avatarLook', who: 'player', sprites: { neutral: '<svg></svg>' } })).toBe(true);
    expect(isAvatarLookMessage({ type: 'velvet:avatarLook', who: 'player' })).toBe(false);
    expect(isAvatarLookMessage({ type: 'velvet:avatarLook', who: 'partner', sprites: {} })).toBe(false);
  });
});

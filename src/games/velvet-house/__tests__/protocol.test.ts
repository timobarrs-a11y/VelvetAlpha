import { describe, it, expect } from 'vitest';
import { isLookChangedMessage, isAvatarLookMessage, sanitizeMessage, isDesignsRequestMessage, isDesignsResultMessage } from '../bridge/protocol';

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

describe('design sharing messages', () => {
  const ok = { type: 'velvet:designs', game: 'velvet-house', seq: 1 };

  it('accepts the operations the game uses, with short plain arguments', () => {
    expect(isDesignsRequestMessage({ ...ok, op: 'friends' })).toBe(true);
    expect(isDesignsRequestMessage({ ...ok, op: 'publish', args: { name: 'Plaid', code: 'VH-ABCD-EFGHJ', visibility: 'friends' } })).toBe(true);
    expect(isDesignsRequestMessage({ ...ok, op: 'review', args: { id: 'abc', approve: true } })).toBe(true);
    expect(isDesignsRequestMessage({ ...ok, op: 'gallery', args: { offset: 40 } })).toBe(true);
  });

  it('refuses anything else', () => {
    expect(isDesignsRequestMessage({ ...ok, op: 'dropTables' })).toBe(false);
    expect(isDesignsRequestMessage({ ...ok, op: 'publish', args: { name: 'x'.repeat(25) } })).toBe(false);
    expect(isDesignsRequestMessage({ ...ok, op: 'publish', args: { code: 'x'.repeat(701) } })).toBe(false);
    expect(isDesignsRequestMessage({ ...ok, op: 'publish', args: { sql: 'select 1' } })).toBe(false);
    expect(isDesignsRequestMessage({ ...ok, op: 'review', args: { name: true } })).toBe(false);
    expect(isDesignsRequestMessage({ ...ok, op: 'gallery', args: { offset: -1 } })).toBe(false);
    expect(isDesignsRequestMessage({ ...ok, op: 'mine', args: [1] })).toBe(false);
    expect(isDesignsRequestMessage({ ...ok, seq: 'one', op: 'mine' })).toBe(false);
    expect(isDesignsRequestMessage({ ...ok, type: 'velvet:sample', op: 'mine' })).toBe(false);
  });

  it('reads results and drops unknown fields on the way out', () => {
    expect(isDesignsResultMessage({ type: 'velvet:designsResult', seq: 1, ok: true, data: [] })).toBe(true);
    expect(isDesignsResultMessage({ type: 'velvet:designsResult', seq: 1, ok: 'yes' })).toBe(false);
    expect(sanitizeMessage({ type: 'velvet:designs', game: 'velvet-house', seq: 1, op: 'mine', evil: 1 })).toEqual({ type: 'velvet:designs', game: 'velvet-house', seq: 1, op: 'mine' });
  });
});

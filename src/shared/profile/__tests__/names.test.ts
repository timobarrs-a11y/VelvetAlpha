import { describe, it, expect } from 'vitest';
import { callName, publicName, realNameOf } from '../names';
import { NICKNAME_BANK, pickNickname, validateNickname } from '../../../features/questionnaire/nicknames';

describe('what we call people', () => {
  it('uses the nickname everywhere, and shows only the nickname to other people', () => {
    const p = { nickname: ' Sunny Otter ', name: 'Alex Real' };
    expect(callName(p)).toBe('Sunny Otter');
    expect(publicName(p)).toBe('Sunny Otter');
  });

  it('falls back to a real first name in private, never in public', () => {
    const p = { nickname: '', name: 'Alex Real' };
    expect(callName(p)).toBe('Alex');
    expect(publicName(p)).toBeUndefined();
  });

  it('ignores placeholder names', () => {
    expect(realNameOf({ name: 'there' })).toBe('');
    expect(realNameOf({ name: 'babe' })).toBe('');
    expect(callName({ nickname: null, name: 'there' })).toBeUndefined();
    expect(callName(null)).toBeUndefined();
  });
});

describe('the nickname bank', () => {
  const all = Object.values(NICKNAME_BANK).flat();

  it('is big, and every entry is a valid, unique nickname', () => {
    expect(all.length).toBeGreaterThanOrEqual(150);
    expect(new Set(all.map(n => n.toLowerCase())).size).toBe(all.length);
    for (const nick of all) expect(validateNickname(nick), nick).toBeNull();
  });

  it('has funny, classic, screen-name and cozy nicknames', () => {
    for (const kind of ['funny', 'classic', 'screen', 'cozy'] as const) expect(NICKNAME_BANK[kind].length).toBeGreaterThanOrEqual(30);
    expect(NICKNAME_BANK.screen.some(n => /\d/.test(n))).toBe(true);
    expect(NICKNAME_BANK.classic).toContain('Ace');
  });

  it('picks one from the bank, never the one it was asked to avoid', () => {
    for (let i = 0; i < 50; i++) {
      const pick = pickNickname('Ace');
      expect(all).toContain(pick);
      expect(pick.toLowerCase()).not.toBe('ace');
    }
  });

  it('turns up every flavor over time, and is repeatable with a seeded random', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const pick = pickNickname();
      seen.add((Object.keys(NICKNAME_BANK) as (keyof typeof NICKNAME_BANK)[]).find(k => NICKNAME_BANK[k].includes(pick))!);
    }
    expect(seen.size).toBe(4);
    const seeded = () => { let n = 7; return () => ((n = (n * 9301 + 49297) % 233280) / 233280); };
    expect(pickNickname('', seeded())).toEqual(pickNickname('', seeded()));
  });
});

describe('validateNickname', () => {
  it('accepts friendly nicknames', () => {
    for (const ok of ['Ace', 'Big Himmy', "C-note", 'Mónica', 'DeLo_23', 'Mr. Z']) expect(validateNickname(ok)).toBeNull();
  });

  it('rejects too short, too long, and anything that is private information', () => {
    expect(validateNickname('A')).toMatch(/At least 2/);
    expect(validateNickname('x'.repeat(25))).toMatch(/24 characters/);
    expect(validateNickname('me@mail.com')).toMatch(/emails, links/);
    expect(validateNickname('www.site.com')).toMatch(/emails, links/);
    expect(validateNickname('call 555 123 4567')).toMatch(/phone numbers/);
    expect(validateNickname('nice 🚀')).toMatch(/Use letters/);
  });
});

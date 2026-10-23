import { describe, it, expect, vi, afterEach } from 'vitest';
import { passwordProblem, isBreachedPassword, passwordErrorMessage, MIN_PASSWORD_LENGTH } from '../passwordPolicy';

describe('passwordProblem', () => {
  it('rejects short passwords', () => {
    expect(passwordProblem('abc12345')).toMatch(`${MIN_PASSWORD_LENGTH} characters`);
  });
  it('needs letters and numbers', () => {
    expect(passwordProblem('abcdefghijkl')).toMatch('letters and numbers');
    expect(passwordProblem('123456789012')).toMatch('letters and numbers');
  });
  it('accepts a long password with both', () => {
    expect(passwordProblem('velvet-house-2026')).toBeNull();
  });
});

describe('isBreachedPassword', () => {
  afterEach(() => vi.unstubAllGlobals());
  // SHA-1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
  it('finds a breached password by hash suffix, sending only the prefix', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n1E4C9B93F3F0682250B6CF8331B7EE68FD8:9545824\r\n' });
    vi.stubGlobal('fetch', fetchMock);
    await expect(isBreachedPassword('password')).resolves.toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.pwnedpasswords.com/range/5BAA6');
  });
  it('ignores padding rows with a zero count', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => '1E4C9B93F3F0682250B6CF8331B7EE68FD8:0\r\n' }));
    await expect(isBreachedPassword('password')).resolves.toBe(false);
  });
  it('never blocks when the service is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(isBreachedPassword('password')).resolves.toBe(false);
  });
});

describe('passwordErrorMessage', () => {
  it('explains Supabase weak_password errors', () => {
    expect(passwordErrorMessage({ code: 'weak_password', message: 'x' }, 'fallback')).toMatch('too weak');
  });
  it('falls back to the message, then the fallback', () => {
    expect(passwordErrorMessage({ message: 'Boom' }, 'fallback')).toBe('Boom');
    expect(passwordErrorMessage(null, 'fallback')).toBe('fallback');
  });
});

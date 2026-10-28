import { describe, expect, it } from 'vitest';
import { buildAuthUrl, buildEvent, eventDay, needsReconnect, safeReturnPath, signState, verifyState } from '../../../supabase/functions/_shared/googleCalendar';

describe('google calendar state', () => {
  it('round-trips and carries who it was for', async () => {
    const s = await signState('user-1', '/coaching-commitments', 'secret', 1000);
    expect(await verifyState(s, 'secret', 2000)).toMatchObject({ userId: 'user-1', returnPath: '/coaching-commitments' });
  });
  it('rejects a forged, wrong-secret or expired state', async () => {
    const s = await signState('user-1', '/x', 'secret', 1000);
    expect(await verifyState(s, 'other', 2000)).toBeNull();
    expect(await verifyState(`${s.split('.')[0]}.abc`, 'secret', 2000)).toBeNull();
    expect(await verifyState(s, 'secret', 1000 + 11 * 60 * 1000)).toBeNull();
    expect(await verifyState('nonsense', 'secret')).toBeNull();
  });
  it('only returns to a path inside the app', () => {
    expect(safeReturnPath('/notes')).toBe('/notes');
    for (const bad of ['https://evil.com', '//evil.com', 'notes', '/\\evil', undefined, 5]) expect(safeReturnPath(bad)).toBe('/coaching-commitments');
  });
});

describe('google calendar events', () => {
  it('is an all-day event on the due day, ending the next day', () => {
    const e = buildEvent({ id: 't1', description: '  File   the\nform ', due_date: '2026-11-03T15:00:00Z', companion_name: 'Maya' }, 'Start a business', 'https://x/y');
    expect(e.summary).toBe('File the form');
    expect(e.start).toEqual({ date: '2026-11-03' });
    expect(e.end).toEqual({ date: '2026-11-04' });
    expect(e.description).toContain('from Maya');
    expect(e.description).toContain('Goal: Start a business');
    expect(e.extendedProperties.private.velvetTaskId).toBe('t1');
  });
  it('uses today when a task has no date, and rolls over a month end', () => {
    const now = new Date('2026-12-31T10:00:00Z');
    expect(eventDay(null, now)).toBe('2026-12-31');
    expect(buildEvent({ id: 'a', description: 'x', due_date: null }, null, 'l', now).end).toEqual({ date: '2027-01-01' });
  });
});

describe('google calendar auth', () => {
  it('asks for offline access so a refresh token comes back', () => {
    const u = new URL(buildAuthUrl({ clientId: 'cid', redirectUri: 'https://r', state: 's' }));
    expect(u.searchParams.get('access_type')).toBe('offline');
    expect(u.searchParams.get('prompt')).toBe('consent');
    expect(u.searchParams.get('scope')).toContain('calendar.events');
  });
  it('treats a dead token as needing a reconnect, other errors not', () => {
    expect(needsReconnect(400, '{"error":"invalid_grant"}')).toBe(true);
    expect(needsReconnect(500, 'invalid_grant')).toBe(false);
    expect(needsReconnect(400, '{"error":"redirect_uri_mismatch"}')).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import {
  decideImDelivery, isQuietNow, isOnlineNow, previewText, buildImPayload, minutesInZone, type DeliveryInput,
} from '../../../supabase/functions/_shared/pushRules';

const NOW = new Date('2026-10-27T15:00:00Z');
const base = (over: Partial<DeliveryInput> = {}): DeliveryInput => ({
  settings: { push_enabled: true, people_messages: true },
  hasSubscription: true, blocked: false, recipientPresence: null, now: NOW, ...over,
});

describe('who gets a notification for a message from a person', () => {
  it('sends to someone who opted in, has a device, and is away', () => {
    expect(decideImDelivery(base())).toEqual({ send: true });
  });
  it('does nothing until push is switched on, or when people messages are off', () => {
    expect(decideImDelivery(base({ settings: {} }))).toEqual({ send: false, reason: 'disabled' });
    expect(decideImDelivery(base({ settings: { push_enabled: true, people_messages: false } }))).toEqual({ send: false, reason: 'disabled' });
  });
  it('needs a saved device', () => {
    expect(decideImDelivery(base({ hasSubscription: false }))).toEqual({ send: false, reason: 'no_subscription' });
  });
  it('never notifies about someone they blocked', () => {
    expect(decideImDelivery(base({ blocked: true }))).toEqual({ send: false, reason: 'blocked' });
  });
  it('skips people who are looking at the app (the in-app popup covers it)', () => {
    const live = { is_online: true, last_seen_at: new Date(NOW.getTime() - 30_000).toISOString() };
    expect(decideImDelivery(base({ recipientPresence: live }))).toEqual({ send: false, reason: 'online' });
    // A stale "online" flag (closed tab, no heartbeat) does not suppress notifications.
    const stale = { is_online: true, last_seen_at: new Date(NOW.getTime() - 10 * 60_000).toISOString() };
    expect(isOnlineNow(stale, NOW)).toBe(false);
    expect(decideImDelivery(base({ recipientPresence: stale }))).toEqual({ send: true });
  });
  it('respects quiet hours', () => {
    const quiet = { start: '14:00', end: '16:00', tz: 'UTC' };
    expect(decideImDelivery(base({ settings: { push_enabled: true, quiet_hours: quiet } }))).toEqual({ send: false, reason: 'quiet_hours' });
  });
});

describe('quiet hours', () => {
  it('handles a window that crosses midnight, in the person\'s own time zone', () => {
    const q = { start: '22:00', end: '07:00', tz: 'America/Chicago' };
    // 15:00 UTC is 10:00 in Chicago (CDT): awake.
    expect(isQuietNow(q, new Date('2026-10-27T15:00:00Z'))).toBe(false);
    // 04:00 UTC is 23:00 the night before in Chicago: quiet.
    expect(isQuietNow(q, new Date('2026-10-27T04:00:00Z'))).toBe(true);
    // 11:30 UTC is 06:30 in Chicago: still quiet.
    expect(isQuietNow(q, new Date('2026-10-27T11:30:00Z'))).toBe(true);
  });
  it('ignores a missing, empty or malformed window, and an unknown time zone does not crash', () => {
    expect(isQuietNow(null, NOW)).toBe(false);
    expect(isQuietNow({ start: '10:00', end: '10:00', tz: 'UTC' }, NOW)).toBe(false);
    expect(isQuietNow({ start: 'x', end: '07:00', tz: 'UTC' }, NOW)).toBe(false);
    expect(minutesInZone(NOW, 'Not/AZone')).toBe(15 * 60);
  });
});

describe('what the notification says', () => {
  it('hides the message text unless the person chose to show it', () => {
    const args = { senderName: 'Sam', content: 'meet me at 5, the door code is 4821', conversationId: 'c1', senderId: 'u1' };
    expect(buildImPayload({ ...args, showPreview: false }).body).toBe('Sent you a message');
    expect(buildImPayload({ ...args, showPreview: true }).body).toContain('door code');
  });
  it('one notification per conversation, and a link that opens the chat', () => {
    const p = buildImPayload({ senderName: 'Sam Lee', content: 'hi', conversationId: 'c1', senderId: 'u1', showPreview: true });
    expect(p.tag).toBe('im:c1');
    expect(p.title).toBe('Sam Lee');
    const url = new URL(p.url, 'https://x.test');
    expect(url.pathname).toBe('/lobby');
    expect(url.searchParams.get('im')).toBe('u1');
    expect(url.searchParams.get('conv')).toBe('c1');
    expect(url.searchParams.get('n')).toBe('Sam Lee');
  });
  it('turns pictures and game invites into a phrase, and shortens long messages', () => {
    expect(previewText('[game:rps] play?')).toBe('wants to play a game');
    expect(previewText('[doodle]data:image/png;base64,AAAA')).toBe('sent you a doodle');
    expect(previewText('x'.repeat(500)).length).toBeLessThanOrEqual(120);
    expect(buildImPayload({ senderName: '  ', content: 'hi', conversationId: 'c', senderId: 'u', showPreview: false }).title).toBe('Someone');
  });
});

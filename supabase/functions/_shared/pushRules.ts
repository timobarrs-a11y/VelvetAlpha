// The rules for phone notifications, kept free of any server or browser API so they can be tested directly.
// Used by the `push-notify` edge function and its tests.

export interface QuietHours {
  /** "HH:MM", 24-hour, in `tz`. A window that crosses midnight (22:00 to 07:00) is fine. */
  start: string;
  end: string;
  /** IANA time zone, e.g. "America/Chicago". */
  tz: string;
}

/** The part of `user_profiles.notification_settings` that decides push delivery. */
export interface PushSettings {
  /** Master switch. Off until the player turns it on (the subscription itself is also required). */
  push_enabled?: boolean;
  /** Messages from real people. On by default once push is enabled. */
  people_messages?: boolean;
  /** Show the message text on the lock screen. Off by default, so private messages stay private. */
  show_preview?: boolean;
  quiet_hours?: QuietHours | null;
}

export interface Presence {
  is_online: boolean | null;
  last_seen_at: string | null;
}

// Matches the app's own "online" window (src/shared/supabase/queries/messaging.ts).
export const ONLINE_WINDOW_MS = 2 * 60 * 1000;

export type SkipReason = 'disabled' | 'no_subscription' | 'blocked' | 'online' | 'quiet_hours';
export type Decision = { send: true } | { send: false; reason: SkipReason };

export function isOnlineNow(p: Presence | null | undefined, now: Date): boolean {
  if (!p?.is_online || !p.last_seen_at) return false;
  return now.getTime() - new Date(p.last_seen_at).getTime() < ONLINE_WINDOW_MS;
}

const toMinutes = (hhmm: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  return h > 23 || min > 59 ? null : h * 60 + min;
};

/** Minutes past midnight in a time zone (falls back to UTC for an unknown zone). */
export function minutesInZone(now: Date, tz: string): number {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  }
  const h = Number(parts.find(p => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find(p => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

export function isQuietNow(q: QuietHours | null | undefined, now: Date): boolean {
  if (!q) return false;
  const start = toMinutes(q.start), end = toMinutes(q.end);
  if (start === null || end === null || start === end) return false;
  const t = minutesInZone(now, q.tz);
  return start < end ? t >= start && t < end : t >= start || t < end;
}

export interface DeliveryInput {
  settings: PushSettings | null | undefined;
  /** The person has at least one saved device. */
  hasSubscription: boolean;
  /** The recipient has blocked the sender. */
  blocked: boolean;
  recipientPresence: Presence | null | undefined;
  now: Date;
}

/** Should a message from a person become a notification? */
export function decideImDelivery(i: DeliveryInput): Decision {
  const s = i.settings ?? {};
  if (!s.push_enabled || s.people_messages === false) return { send: false, reason: 'disabled' };
  if (!i.hasSubscription) return { send: false, reason: 'no_subscription' };
  if (i.blocked) return { send: false, reason: 'blocked' };
  // Looking at the app right now: the in-app popup already tells them.
  if (isOnlineNow(i.recipientPresence, i.now)) return { send: false, reason: 'online' };
  if (isQuietNow(s.quiet_hours, i.now)) return { send: false, reason: 'quiet_hours' };
  return { send: true };
}

export interface PushPayload {
  title: string;
  body: string;
  /** Notifications with the same tag replace each other: one per conversation. */
  tag: string;
  /** Where tapping goes. */
  url: string;
  data: { kind: 'im'; conversationId: string; senderId: string; senderName: string };
}

const MAX_BODY = 120;

/** What the lock screen may show of a message. Pictures and game invites become a short phrase. */
export function previewText(content: string): string {
  if (content.startsWith('[doodle') || content.includes('data:image/')) return 'sent you a doodle';
  const game = /^\[game:(checkers|draw|rps|paint)\]/.exec(content);
  if (game) return 'wants to play a game';
  const text = content.replace(/\s+/g, ' ').trim();
  return text.length > MAX_BODY ? text.slice(0, MAX_BODY - 1).trimEnd() + '…' : text;
}

export function buildImPayload(i: { senderName: string; content: string; conversationId: string; senderId: string; showPreview: boolean }): PushPayload {
  const name = i.senderName.trim() || 'Someone';
  const params = new URLSearchParams({ im: i.senderId, conv: i.conversationId, n: name });
  return {
    title: name,
    body: i.showPreview ? previewText(i.content) : 'Sent you a message',
    tag: `im:${i.conversationId}`,
    url: `/lobby?${params.toString()}`,
    data: { kind: 'im', conversationId: i.conversationId, senderId: i.senderId, senderName: name },
  };
}

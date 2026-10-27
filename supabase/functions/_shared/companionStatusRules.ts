// Rules for companion statuses and the @system that decides when a companion answers.
// Kept free of any server or browser API so they can be tested directly.
// Used by the `companion-status` edge function and its tests.

/** One entry of `daily_experiences.status_timeline`, as the model writes it. */
export interface TimelineEntry {
  time: string;      // "6:30 AM"
  status: string;    // "just woke up 😴"
  activity?: string; // "waking_up"
}

// A companion shows up on your feed a few times a day, not every time the model wrote a line.
export const MAX_STATUSES_PER_COMPANION_PER_DAY = 3;
// A status newer than this can still be posted; older ones are skipped, not back-filled.
export const STATUS_FRESH_HOURS = 8;
export const MAX_STATUS_LENGTH = 280;

// The @system limits: the companion answers only when mentioned, and only this much.
export const MAX_COMPANION_REPLIES_PER_POST = 4;
export const MAX_COMPANION_REPLIES_PER_USER_PER_DAY = 40;
export const MAX_USER_COMMENTS_PER_HOUR = 30;
export const REPLY_COOLDOWN_SECONDS = 8;
export const MAX_COMMENT_LENGTH = 500;

const TIME_RE = /^\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*$/i;

/** "6:30 AM" -> hours and minutes on a 24-hour clock, or null if it isn't a time. */
export function parseClockTime(raw: string): { hour: number; minute: number } | null {
  const m = TIME_RE.exec(raw ?? '');
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 1 || hour > 12 || minute > 59) return null;
  const pm = m[3].toUpperCase() === 'PM';
  if (hour === 12) hour = pm ? 12 : 0;
  else if (pm) hour += 12;
  return { hour, minute };
}

/** The calendar day (YYYY-MM-DD) an instant falls on in a time zone. Unknown zones fall back to UTC. */
export function localDateString(at: Date, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
  } catch {
    return at.toISOString().slice(0, 10);
  }
}

function offsetMinutes(at: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

/** The instant when a wall clock in `tz` reads `dateStr` + `hour:minute`. Unknown zones fall back to UTC. */
export function zonedTimeToUtc(dateStr: string, hour: number, minute: number, tz: string): Date {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const guess = new Date(Date.UTC(y, mo - 1, d, hour, minute));
  try {
    const first = new Date(guess.getTime() - offsetMinutes(guess, tz) * 60000);
    // One more pass settles days where the offset changes (daylight saving).
    return new Date(guess.getTime() - offsetMinutes(first, tz) * 60000);
  } catch {
    return guess;
  }
}

export interface DueStatus {
  slot: number;
  body: string;
  activity: string | null;
  visibleAt: Date;
}

/** Collapses whitespace and trims a model-written status; empty or absurd ones are dropped. */
export function cleanStatus(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text || text.length > MAX_STATUS_LENGTH) return null;
  return text;
}

/**
 * Which lines of a day's timeline should be on the feed right now.
 * `localDate` is the day the timeline was written for, in the member's time zone.
 * Only lines whose time has come and that are still fresh are returned, newest first,
 * and at most `quota` of them (what's left of the companion's daily allowance).
 */
export function dueStatuses(timeline: unknown, localDate: string, tz: string, now: Date, quota: number): DueStatus[] {
  if (!Array.isArray(timeline) || quota <= 0) return [];
  const freshAfter = now.getTime() - STATUS_FRESH_HOURS * 3600_000;
  const due: DueStatus[] = [];
  timeline.forEach((entry: Partial<TimelineEntry> | null, slot) => {
    const clock = parseClockTime(entry?.time ?? '');
    const body = cleanStatus(entry?.status);
    if (!clock || !body) return;
    const visibleAt = zonedTimeToUtc(localDate, clock.hour, clock.minute, tz);
    if (visibleAt.getTime() > now.getTime() || visibleAt.getTime() < freshAfter) return;
    due.push({ slot, body, activity: typeof entry?.activity === 'string' ? entry.activity : null, visibleAt });
  });
  due.sort((a, b) => b.visibleAt.getTime() - a.visibleAt.getTime());
  return due.slice(0, quota);
}

export interface MentionableCompanion {
  id: string;
  custom_name: string | null;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The companion a comment @-mentions, or null. "@Lola" and, for a two-word name,
 * "@Lola Mae" both work, and so does the first word alone ("@Lola"). A bare
 * "@" in an email address doesn't count, and neither does a mention buried in a word.
 */
export function findMentionedCompanion(body: string, companions: MentionableCompanion[]): string | null {
  const text = (body ?? '').toLowerCase();
  let best: { id: string; length: number } | null = null;
  for (const c of companions) {
    const name = (c.custom_name ?? '').trim().toLowerCase();
    if (!name) continue;
    const candidates = new Set([name, name.split(/\s+/)[0]]);
    for (const candidate of candidates) {
      const re = new RegExp(`(^|[^\\p{L}\\p{N}_])@${escapeRe(candidate)}(?![\\p{L}\\p{N}_])`, 'u');
      if (re.test(text) && (!best || candidate.length > best.length)) best = { id: c.id, length: candidate.length };
    }
  }
  return best?.id ?? null;
}

export type ReplySkip = 'not_mentioned' | 'post_limit' | 'daily_limit' | 'cooldown';
export type ReplyDecision = { reply: true } | { reply: false; reason: ReplySkip };

export interface ReplyInput {
  mentionedCompanionId: string | null;
  /** Companion replies already under this post. */
  repliesOnPost: number;
  /** Companion replies to this member in the last 24 hours, across every post. */
  repliesToday: number;
  /** Seconds since this member's last companion reply; null if none. */
  secondsSinceLastReply: number | null;
}

/** The @system: a companion answers when mentioned, within limits, never otherwise. */
export function decideReply(i: ReplyInput): ReplyDecision {
  if (!i.mentionedCompanionId) return { reply: false, reason: 'not_mentioned' };
  if (i.repliesOnPost >= MAX_COMPANION_REPLIES_PER_POST) return { reply: false, reason: 'post_limit' };
  if (i.repliesToday >= MAX_COMPANION_REPLIES_PER_USER_PER_DAY) return { reply: false, reason: 'daily_limit' };
  if (i.secondsSinceLastReply !== null && i.secondsSinceLastReply < REPLY_COOLDOWN_SECONDS) return { reply: false, reason: 'cooldown' };
  return { reply: true };
}

/** The model's reply as a comment: one tidy line of text, no leading @, within the limit. */
export function cleanReply(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw.replace(/\s+/g, ' ').replace(/^["“]+|["”]+$/g, '').replace(/^@\S+\s*/, '').trim();
  if (!text) return null;
  return text.length > MAX_COMMENT_LENGTH ? text.slice(0, MAX_COMMENT_LENGTH - 1).trimEnd() + '…' : text;
}

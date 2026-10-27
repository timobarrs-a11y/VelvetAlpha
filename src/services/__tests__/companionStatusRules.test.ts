import { describe, it, expect } from 'vitest';
import {
  parseClockTime, zonedTimeToUtc, localDateString, dueStatuses, cleanStatus,
  findMentionedCompanion, decideReply, cleanReply,
  MAX_COMPANION_REPLIES_PER_POST, MAX_COMPANION_REPLIES_PER_USER_PER_DAY, REPLY_COOLDOWN_SECONDS,
} from '../../../supabase/functions/_shared/companionStatusRules';

describe('reading the time the model wrote', () => {
  it('reads morning, noon, midnight and evening', () => {
    expect(parseClockTime('6:30 AM')).toEqual({ hour: 6, minute: 30 });
    expect(parseClockTime('12:05 PM')).toEqual({ hour: 12, minute: 5 });
    expect(parseClockTime('12:00 AM')).toEqual({ hour: 0, minute: 0 });
    expect(parseClockTime('11:00 pm')).toEqual({ hour: 23, minute: 0 });
  });
  it('rejects anything that is not a clock time', () => {
    for (const bad of ['', 'noon', '25:00 AM', '13:00 PM', '6:75 AM', '6 AM', null as unknown as string]) {
      expect(parseClockTime(bad)).toBeNull();
    }
  });
});

describe('time zones', () => {
  it('turns a wall-clock time in a zone into the right instant', () => {
    // October 27, 2026: New York is on daylight time (UTC-4).
    expect(zonedTimeToUtc('2026-10-27', 9, 0, 'America/New_York').toISOString()).toBe('2026-10-27T13:00:00.000Z');
    // After clocks go back on November 1 it is UTC-5.
    expect(zonedTimeToUtc('2026-11-02', 9, 0, 'America/New_York').toISOString()).toBe('2026-11-02T14:00:00.000Z');
  });
  it('falls back to UTC for an unknown zone', () => {
    expect(zonedTimeToUtc('2026-10-27', 9, 0, 'Not/AZone').toISOString()).toBe('2026-10-27T09:00:00.000Z');
    expect(localDateString(new Date('2026-10-27T03:00:00Z'), 'Not/AZone')).toBe('2026-10-27');
  });
  it('finds the member\'s calendar day, not the server\'s', () => {
    // 3 AM UTC is still the evening before in Chicago.
    expect(localDateString(new Date('2026-10-27T03:00:00Z'), 'America/Chicago')).toBe('2026-10-26');
  });
});

describe('which timeline lines are on the feed now', () => {
  const timeline = [
    { time: '6:30 AM', status: 'just woke up 😴', activity: 'waking_up' },
    { time: '9:00 AM', status: 'deep in it 🎯', activity: 'working' },
    { time: '12:30 PM', status: 'starving, need food NOW' },
    { time: '3:00 PM', status: 'afternoon slump' },
    { time: 'later', status: 'ignored: no time' },
    { time: '5:00 PM', status: '   ' },
  ];
  const tz = 'America/New_York';
  const date = '2026-10-27';
  const at = (h: number, m = 0) => zonedTimeToUtc(date, h, m, tz);

  it('shows nothing before the first line is due', () => {
    expect(dueStatuses(timeline, date, tz, at(6, 0), 3)).toEqual([]);
  });
  it('shows a line once its time has come', () => {
    const due = dueStatuses(timeline, date, tz, at(9, 30), 3);
    expect(due.map(d => d.slot)).toEqual([1, 0]);
    expect(due[0].body).toBe('deep in it 🎯');
    expect(due[0].activity).toBe('working');
  });
  it('skips lines that are stale instead of back-filling a whole day', () => {
    const due = dueStatuses(timeline, date, tz, at(18, 0), 3);
    expect(due.map(d => d.slot)).toEqual([3, 2]); // 9:00 AM is 9 hours old, past the 8-hour window
  });
  it('never posts more than what is left of the daily allowance', () => {
    expect(dueStatuses(timeline, date, tz, at(15, 30), 1).map(d => d.slot)).toEqual([3]);
    expect(dueStatuses(timeline, date, tz, at(15, 30), 0)).toEqual([]);
  });
  it('copes with a timeline that is not a list', () => {
    expect(dueStatuses(null, date, tz, at(12), 3)).toEqual([]);
    expect(dueStatuses({ a: 1 }, date, tz, at(12), 3)).toEqual([]);
  });
});

describe('cleaning a status', () => {
  it('tidies whitespace and drops empty or oversized text', () => {
    expect(cleanStatus('  still   up at 4am \n ')).toBe('still up at 4am');
    expect(cleanStatus('')).toBeNull();
    expect(cleanStatus('x'.repeat(400))).toBeNull();
    expect(cleanStatus(42)).toBeNull();
  });
});

describe('who a comment mentions', () => {
  const cast = [
    { id: 'lola', custom_name: 'Lola' },
    { id: 'mae', custom_name: 'Lola Mae' },
    { id: 'kel', custom_name: 'Kelicia' },
    { id: 'blank', custom_name: null },
  ];
  it('needs an @, not just the name', () => {
    expect(findMentionedCompanion('Lola you up?', cast)).toBeNull();
    expect(findMentionedCompanion('@Kelicia you up?', cast)).toBe('kel');
  });
  it('ignores case and punctuation after the name', () => {
    expect(findMentionedCompanion('haha @kelicia!', cast)).toBe('kel');
    expect(findMentionedCompanion('(@KELICIA)', cast)).toBe('kel');
  });
  it('prefers the longer name when two companions share a first word', () => {
    expect(findMentionedCompanion('@Lola Mae what happened', cast)).toBe('mae');
    expect(findMentionedCompanion('@Lola what happened', cast)).toBe('lola');
  });
  it('does not match inside a longer word or an email address', () => {
    expect(findMentionedCompanion('@Lolando is a different person', cast)).toBeNull();
    expect(findMentionedCompanion('mail me at x@Kelicia.com', cast)).toBeNull();
  });
  it('returns null when nothing is mentioned or there is no cast', () => {
    expect(findMentionedCompanion('just a comment', cast)).toBeNull();
    expect(findMentionedCompanion('@Lola', [])).toBeNull();
  });
});

describe('the @system: when a companion answers', () => {
  const ok = { mentionedCompanionId: 'lola', repliesOnPost: 0, repliesToday: 0, secondsSinceLastReply: null };
  it('answers when mentioned', () => {
    expect(decideReply(ok)).toEqual({ reply: true });
  });
  it('stays quiet on a plain comment', () => {
    expect(decideReply({ ...ok, mentionedCompanionId: null })).toEqual({ reply: false, reason: 'not_mentioned' });
  });
  it('stops after the per-post limit', () => {
    expect(decideReply({ ...ok, repliesOnPost: MAX_COMPANION_REPLIES_PER_POST - 1 })).toEqual({ reply: true });
    expect(decideReply({ ...ok, repliesOnPost: MAX_COMPANION_REPLIES_PER_POST })).toEqual({ reply: false, reason: 'post_limit' });
  });
  it('stops after the daily limit', () => {
    expect(decideReply({ ...ok, repliesToday: MAX_COMPANION_REPLIES_PER_USER_PER_DAY })).toEqual({ reply: false, reason: 'daily_limit' });
  });
  it('waits out the cooldown', () => {
    expect(decideReply({ ...ok, secondsSinceLastReply: REPLY_COOLDOWN_SECONDS - 1 })).toEqual({ reply: false, reason: 'cooldown' });
    expect(decideReply({ ...ok, secondsSinceLastReply: REPLY_COOLDOWN_SECONDS })).toEqual({ reply: true });
  });
});

describe('cleaning a reply', () => {
  it('flattens it to one line, no quotes, no leading @name', () => {
    expect(cleanReply('"@Tim  okay\nbut why 😂"')).toBe('okay but why 😂');
  });
  it('drops empty replies and trims very long ones', () => {
    expect(cleanReply('   ')).toBeNull();
    expect(cleanReply(undefined)).toBeNull();
    expect(cleanReply('a'.repeat(900))!.length).toBe(500);
  });
});

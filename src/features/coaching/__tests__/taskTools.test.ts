import { describe, it, expect } from 'vitest';
import { buildIcs, dueDay, googleCalendarUrl, taskHelpPrompt } from '../taskTools';

const task = { id: 't1', description: 'Register the company, with the state', due_date: '2026-10-30', companion_name: 'Dana', progress_note: null };
const today = new Date(2026, 9, 27);

describe('taskHelpPrompt', () => {
  it('takes the task, its goal and its date to the coach and asks for it to be broken down', () => {
    const p = taskHelpPrompt(task, 'Start my own company');
    expect(p).toContain('"Register the company, with the state"');
    expect(p).toContain('my goal: Start my own company');
    expect(p).toContain('due Friday, October 30');
    expect(p).toContain('Break it down into small steps');
  });

  it('leaves out what it does not have, and includes where they have got to', () => {
    const p = taskHelpPrompt({ description: 'Pick a name', due_date: null, progress_note: 'Have three ideas' });
    expect(p).not.toContain('goal');
    expect(p).not.toContain('due');
    expect(p).toContain("Where I've got to: Have three ideas.");
  });
});

describe('dueDay', () => {
  it('reads a date or the date part of a timestamp, nothing else', () => {
    expect(dueDay('2026-10-30')?.toISOString().slice(0, 10)).toBe('2026-10-30');
    expect(dueDay('2026-10-30T23:00:00Z')?.toISOString().slice(0, 10)).toBe('2026-10-30');
    expect(dueDay(null)).toBeNull();
    expect(dueDay('soon')).toBeNull();
  });
});

describe('googleCalendarUrl', () => {
  it('fills in an all-day entry on the due date', () => {
    const url = new URL(googleCalendarUrl(task, 'Start my own company', 'https://velvet.example/tasks', today));
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('text')).toBe('Register the company, with the state');
    expect(url.searchParams.get('dates')).toBe('20261030/20261031');
    expect(url.searchParams.get('details')).toContain('Goal: Start my own company');
    expect(url.searchParams.get('details')).toContain('https://velvet.example/tasks');
  });

  it('uses today when the task has no date, and rolls over month ends', () => {
    expect(new URL(googleCalendarUrl({ ...task, due_date: null }, null, 'x', today)).searchParams.get('dates')).toBe('20261027/20261028');
    expect(new URL(googleCalendarUrl({ ...task, due_date: '2026-10-31' }, null, 'x', today)).searchParams.get('dates')).toBe('20261031/20261101');
  });
});

describe('buildIcs', () => {
  const ics = buildIcs([{ ...task, goalTitle: 'Start my own company' }, { id: 't2', description: 'Pick a name', due_date: '2026-11-02', companion_name: 'You' }], 'https://velvet.example/tasks', new Date(Date.UTC(2026, 9, 27, 12, 0, 0)));

  it('is a calendar with one all-day entry per task', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain('UID:t1@velvet');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261030');
    expect(ics).toContain('DTEND;VALUE=DATE:20261031');
    expect(ics).toContain('DTSTAMP:20261027T120000Z');
  });

  it('escapes semicolons, backslashes and line breaks too', () => {
    const odd = buildIcs([{ id: 'x', description: 'a;b\\c', due_date: null, companion_name: 'You', goalTitle: 'one\ntwo' }], 'l');
    expect(odd).toContain('SUMMARY:a\\;b\\\\c');
    expect(odd).toContain('Goal: one two');
  });

  it('escapes commas and folds long lines', () => {
    expect(ics).toContain('SUMMARY:Register the company\\, with the state');
    for (const line of ics.split('\r\n')) expect(line.length).toBeLessThanOrEqual(75);
  });
});

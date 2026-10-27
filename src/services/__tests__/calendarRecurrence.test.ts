import { describe, it, expect } from 'vitest';
import {
  expandOccurrences, withOccurrenceCompleted, seriesOf, localDateKey, occurrenceKey,
} from '../calendarRecurrence';
import type { UserEvent } from '../calendarService';

function event(overrides: Partial<UserEvent>): UserEvent {
  return {
    id: 'e1',
    user_id: 'u1',
    companion_id: null,
    title: 'Test',
    description: '',
    event_type: 'task',
    event_date: new Date(2026, 0, 1, 9, 0).toISOString(),
    reminder_time: null,
    all_day: false,
    location: null,
    completed: false,
    recurring: 'none',
    metadata: {},
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);
const endOf = (y: number, m: number, d: number) => new Date(y, m - 1, d, 23, 59, 59);
const keys = (events: UserEvent[]) => events.map(e => localDateKey(new Date(e.event_date)));

describe('expandOccurrences', () => {
  it('passes one-off events through unchanged', () => {
    const e = event({});
    expect(expandOccurrences([e], day(2026, 1, 1), endOf(2026, 1, 31))).toEqual([e]);
  });

  it('shows a yearly birthday every year on the same day, keeping the birth date', () => {
    const born = new Date(1969, 2, 12).toISOString();
    const e = event({ event_type: 'birthday', recurring: 'yearly', all_day: true, event_date: born });
    const [occ] = expandOccurrences([e], day(2026, 3, 1), endOf(2026, 3, 31));
    expect(localDateKey(new Date(occ.event_date))).toBe('2026-03-12');
    expect(occ.series_date).toBe(born);
    expect(occ.occurrence_date).toBe('2026-03-12');
  });

  it('puts a 29 February birthday on the 28th in other years', () => {
    const e = event({ recurring: 'yearly', all_day: true, event_date: new Date(2000, 1, 29).toISOString() });
    expect(keys(expandOccurrences([e], day(2027, 2, 1), endOf(2027, 2, 28)))).toEqual(['2027-02-28']);
    expect(keys(expandOccurrences([e], day(2028, 2, 1), endOf(2028, 2, 29)))).toEqual(['2028-02-29']);
  });

  it('repeats daily within the range, never before the series starts', () => {
    const e = event({ recurring: 'daily', event_date: new Date(2026, 9, 25, 7, 30).toISOString() });
    expect(keys(expandOccurrences([e], day(2026, 10, 24), endOf(2026, 10, 27))))
      .toEqual(['2026-10-25', '2026-10-26', '2026-10-27']);
  });

  it('keeps the time of day on each occurrence', () => {
    const e = event({ recurring: 'daily', event_date: new Date(2026, 9, 1, 7, 30).toISOString() });
    const [occ] = expandOccurrences([e], day(2026, 10, 26), endOf(2026, 10, 26));
    const d = new Date(occ.event_date);
    expect([d.getHours(), d.getMinutes()]).toEqual([7, 30]);
  });

  it('repeats weekly on the same weekday as the series', () => {
    const e = event({ recurring: 'weekly', event_date: new Date(2026, 9, 5, 18, 0).toISOString() });
    expect(keys(expandOccurrences([e], day(2026, 10, 10), endOf(2026, 10, 31))))
      .toEqual(['2026-10-12', '2026-10-19', '2026-10-26']);
  });

  it('puts a monthly event on the 31st on the last day of shorter months', () => {
    const e = event({ recurring: 'monthly', event_date: new Date(2026, 0, 31, 9, 0).toISOString() });
    expect(keys(expandOccurrences([e], day(2026, 1, 1), endOf(2026, 4, 30))))
      .toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });

  it('shows nothing for a series that starts after the range', () => {
    const e = event({ recurring: 'daily', event_date: new Date(2027, 0, 1).toISOString() });
    expect(expandOccurrences([e], day(2026, 1, 1), endOf(2026, 12, 31))).toEqual([]);
  });

  it('reads completion per occurrence from the ticked-off dates', () => {
    const e = event({
      recurring: 'daily',
      event_date: new Date(2026, 9, 1, 8, 0).toISOString(),
      completed: true,
      metadata: { completed_dates: ['2026-10-25'] },
    });
    const occ = expandOccurrences([e], day(2026, 10, 25), endOf(2026, 10, 26));
    expect(occ.map(o => o.completed)).toEqual([true, false]);
  });

  it('sorts one-off and repeating events together by time', () => {
    const daily = event({ id: 'daily', recurring: 'daily', event_date: new Date(2026, 9, 1, 12, 0).toISOString() });
    const morning = event({ id: 'morning', event_date: new Date(2026, 9, 26, 8, 0).toISOString() });
    const ids = expandOccurrences([daily, morning], day(2026, 10, 26), endOf(2026, 10, 26)).map(e => e.id);
    expect(ids).toEqual(['morning', 'daily']);
  });
});

describe('withOccurrenceCompleted', () => {
  it('ticks off one day without touching the others or other metadata', () => {
    const next = withOccurrenceCompleted({ source: 'atlas', completed_dates: ['2026-10-24'] }, '2026-10-26', true);
    expect(next).toEqual({ source: 'atlas', completed_dates: ['2026-10-24', '2026-10-26'] });
  });

  it('un-ticks one day', () => {
    expect(withOccurrenceCompleted({ completed_dates: ['2026-10-24', '2026-10-26'] }, '2026-10-26', false))
      .toEqual({ completed_dates: ['2026-10-24'] });
  });

  it('starts the list when there is no metadata yet', () => {
    expect(withOccurrenceCompleted(null, '2026-10-26', true)).toEqual({ completed_dates: ['2026-10-26'] });
  });
});

describe('seriesOf and occurrenceKey', () => {
  it('edits the series from its original date, not the occurrence', () => {
    const born = new Date(1969, 2, 12).toISOString();
    const [occ] = expandOccurrences(
      [event({ recurring: 'yearly', event_date: born })], day(2026, 3, 1), endOf(2026, 3, 31),
    );
    const series = seriesOf(occ);
    expect(series.event_date).toBe(born);
    expect(series.series_date).toBeUndefined();
    expect(series.occurrence_date).toBeUndefined();
  });

  it('gives each occurrence its own key', () => {
    const occ = expandOccurrences(
      [event({ recurring: 'daily', event_date: new Date(2026, 9, 1).toISOString() })], day(2026, 10, 1), endOf(2026, 10, 2),
    );
    expect(new Set(occ.map(occurrenceKey)).size).toBe(2);
    expect(occurrenceKey(event({}))).toBe('e1');
  });
});

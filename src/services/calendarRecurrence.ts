import type { UserEvent } from './calendarService';

// Repeating events are stored once, on the date they start. These helpers turn
// them into the dates they actually fall on within a range, in local time, so
// the calendar, Today and the morning brief all see every occurrence.

/** A Date's local calendar day as YYYY-MM-DD. */
export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** A stable React key for an event, unique per occurrence of a repeating one. */
export function occurrenceKey(event: UserEvent): string {
  return event.occurrence_date ? `${event.id}:${event.occurrence_date}` : event.id;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** The same local time of day as `series`, on the given local calendar day. */
function atDay(series: Date, year: number, month: number, day: number): Date {
  return new Date(year, month, day, series.getHours(), series.getMinutes(), series.getSeconds());
}

function occurrenceDates(series: Date, recurring: UserEvent['recurring'], start: Date, end: Date): Date[] {
  const out: Date[] = [];
  if (series > end) return out;

  if (recurring === 'daily' || recurring === 'weekly') {
    const stepDays = recurring === 'daily' ? 1 : 7;
    const first = new Date(series.getFullYear(), series.getMonth(), series.getDate());
    const from = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    // Days between the series start and the range start, counted on the
    // calendar so a daylight-saving change can't shift the count.
    const gap = Math.round((Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
      - Date.UTC(first.getFullYear(), first.getMonth(), first.getDate())) / 86_400_000);
    let n = gap > 0 ? Math.ceil(gap / stepDays) : 0;
    for (;; n++) {
      const d = atDay(series, first.getFullYear(), first.getMonth(), first.getDate() + n * stepDays);
      if (d > end) break;
      if (d >= start) out.push(d);
    }
    return out;
  }

  if (recurring === 'monthly') {
    // Months counted from year 0, starting from whichever is later: the
    // series or the range.
    const first = Math.max(series.getFullYear() * 12 + series.getMonth(), start.getFullYear() * 12 + start.getMonth());
    for (let m = first; ; m++) {
      const year = Math.floor(m / 12);
      const month = m % 12;
      // The 31st falls on the last day of shorter months.
      const d = atDay(series, year, month, Math.min(series.getDate(), daysInMonth(year, month)));
      if (d > end) break;
      if (d >= start && d >= series) out.push(d);
    }
    return out;
  }

  if (recurring === 'yearly') {
    for (let year = Math.max(series.getFullYear(), start.getFullYear()); year <= end.getFullYear(); year++) {
      // 29 February falls on the 28th in other years.
      const d = atDay(series, year, series.getMonth(), Math.min(series.getDate(), daysInMonth(year, series.getMonth())));
      if (d >= start && d <= end && d >= series) out.push(d);
    }
    return out;
  }

  return out;
}

/**
 * Every event that falls between start and end. One-off events pass through
 * unchanged; a repeating event becomes one copy per occurrence, with
 * `event_date` set to that occurrence, `series_date` to the date it started,
 * and `completed` read from the dates ticked off in its metadata.
 */
export function expandOccurrences(events: UserEvent[], start: Date, end: Date): UserEvent[] {
  const out: UserEvent[] = [];
  for (const event of events) {
    const recurring = event.recurring ?? 'none';
    if (recurring === 'none') {
      out.push(event);
      continue;
    }
    const series = new Date(event.event_date);
    const done: string[] = Array.isArray(event.metadata?.completed_dates) ? event.metadata.completed_dates : [];
    for (const d of occurrenceDates(series, recurring, start, end)) {
      const key = localDateKey(d);
      out.push({
        ...event,
        event_date: d.toISOString(),
        series_date: event.event_date,
        occurrence_date: key,
        completed: done.includes(key),
      });
    }
  }
  return out.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
}

/**
 * The metadata to save when one occurrence of a repeating event is ticked off
 * or un-ticked. Only that day changes, never the rest of the series.
 */
export function withOccurrenceCompleted(metadata: Record<string, unknown> | null | undefined, occurrenceDate: string, completed: boolean): Record<string, unknown> {
  const current = Array.isArray(metadata?.completed_dates) ? (metadata!.completed_dates as string[]) : [];
  const next = completed
    ? [...new Set([...current, occurrenceDate])].sort()
    : current.filter(d => d !== occurrenceDate);
  return { ...(metadata ?? {}), completed_dates: next };
}

/** The series as stored, for editing: an occurrence edits the whole series. */
export function seriesOf(event: UserEvent): UserEvent {
  if (!event.series_date) return event;
  const { series_date, occurrence_date: _occurrence, ...rest } = event;
  return { ...rest, event_date: series_date };
}

import type { UserEvent } from '../../services/calendarService';
import type { CoachingCommitment } from '../../services/coachingService';

// What Today on the home screen shows: today's calendar events (one occurrence
// per repeating event) and open commitments due today or overdue, in one list.

export interface TodayItem {
  key: string;
  kind: 'event' | 'commitment';
  title: string;
  /** "9:00 AM", "All day", "Due today" or "Overdue". */
  timeLabel: string;
  /** Who set it up: "Atlas" or a coach's name. Null for the user's own. */
  by: string | null;
  /** The goal it serves, when known. */
  goal: string | null;
  done: boolean;
  overdue: boolean;
  /** A goal step (target), a lesson or practice from a coach (book), or a plain event. */
  icon: 'goal' | 'lesson' | null;
  /** Proposed by Atlas and pencilled in, not yet confirmed. */
  tentative: boolean;
  sortTime: number;
  event?: UserEvent;
  commitment?: CoachingCommitment;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function eventItem(event: UserEvent): TodayItem {
  const at = new Date(event.event_date);
  const meta = event.metadata ?? {};
  return {
    key: `event:${event.id}:${event.occurrence_date ?? ''}`,
    kind: 'event',
    title: event.title,
    timeLabel: event.all_day ? 'All day' : at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    by: meta.source === 'atlas' ? 'Atlas' : null,
    goal: typeof meta.goal === 'string' && meta.goal.trim() ? meta.goal.trim() : null,
    icon: meta.commitment_id ? 'goal' : null,
    done: event.completed,
    overdue: false,
    tentative: meta.tentative === true,
    // All-day items lead the day.
    sortTime: event.all_day ? startOfDay(at).getTime() : at.getTime(),
    event,
  };
}

function commitmentItem(c: CoachingCommitment, goalTitles: Map<string, string>, now: Date): TodayItem {
  const due = new Date(c.due_date as string);
  const overdue = due < startOfDay(now);
  const by = c.companion_name && c.companion_name !== 'You' ? c.companion_name : null;
  return {
    key: `commitment:${c.id}`,
    kind: 'commitment',
    title: c.description,
    timeLabel: overdue ? 'Overdue' : 'Due today',
    by,
    goal: c.goal_id ? goalTitles.get(c.goal_id) ?? null : null,
    icon: c.companion_relationship_type === 'mentor' ? 'lesson' : 'goal',
    done: c.status === 'completed',
    overdue,
    tentative: false,
    sortTime: due.getTime(),
    commitment: c,
  };
}

/** Today's items: open ones first in time order (overdue at the top), then done ones. */
export function buildTodayItems(
  events: UserEvent[],
  commitments: CoachingCommitment[],
  goalTitles: Map<string, string>,
  now: Date,
): TodayItem[] {
  const items = [
    ...events.map(eventItem),
    ...commitments.filter(c => c.due_date).map(c => commitmentItem(c, goalTitles, now)),
  ];
  return items.sort((a, b) => Number(a.done) - Number(b.done) || a.sortTime - b.sortTime);
}

/** "Monday, October 26" */
export function todayHeading(now: Date): string {
  return now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

/** "Tomorrow", "Saturday" within the week, otherwise "Sat, Nov 7". */
export function nextLabel(when: Date, now: Date): string {
  const days = Math.round((startOfDay(when).getTime() - startOfDay(now).getTime()) / 86_400_000);
  if (days === 1) return 'Tomorrow';
  if (days > 1 && days < 7) return when.toLocaleDateString('en-US', { weekday: 'long' });
  return when.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

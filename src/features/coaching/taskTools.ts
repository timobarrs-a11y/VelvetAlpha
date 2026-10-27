import type { CoachingCommitment } from '../../services/coachingService';

// Two things to do with a task from the task list: take it to the coach for help, and put it on a calendar.

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/** The message that takes a task to the coach: what it is, when, for which goal, and what to help with. */
export function taskHelpPrompt(task: Pick<CoachingCommitment, 'description' | 'due_date' | 'progress_note'>, goalTitle?: string | null): string {
  const due = dueDay(task.due_date);
  const lines = [
    `I need help with this task: "${clean(task.description)}".`,
    goalTitle ? `It's part of my goal: ${clean(goalTitle)}.` : '',
    due ? `It's due ${due.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.` : '',
    task.progress_note ? `Where I've got to: ${clean(task.progress_note)}.` : '',
    "Break it down into small steps I can do one at a time, tell me what I need to know or have ready before I start, and what I should do first.",
  ];
  return lines.filter(Boolean).join(' ');
}

/** The calendar day a task is due: a date, or the date part of a timestamp. Null when it has none. */
export function dueDay(due: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(due ?? '');
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
const nextDay = (d: Date) => new Date(d.getTime() + 86_400_000);

/** An all-day entry on the due day (today when it has none). */
function dayRange(task: Pick<CoachingCommitment, 'due_date'>, today: Date): [string, string] {
  const day = dueDay(task.due_date) ?? new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  return [ymd(day), ymd(nextDay(day))];
}

function details(task: Pick<CoachingCommitment, 'companion_name'>, goalTitle: string | null | undefined, link: string): string {
  const by = task.companion_name && task.companion_name !== 'You' ? ` from ${task.companion_name}` : '';
  return [`A task${by} on Velvet.`, goalTitle ? `Goal: ${clean(goalTitle)}` : '', link].filter(Boolean).join('\n');
}

/** A Google Calendar page with the task already filled in, all day on its due date; they press Save. */
export function googleCalendarUrl(
  task: Pick<CoachingCommitment, 'description' | 'due_date' | 'companion_name'>,
  goalTitle: string | null | undefined,
  link: string,
  today: Date = new Date(),
): string {
  const [start, end] = dayRange(task, today);
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: clean(task.description),
    dates: `${start}/${end}`,
    details: details(task, goalTitle, link),
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Lines over 75 characters continue on the next line, indented by a space. */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) { out.push(rest.slice(0, 74)); rest = ` ${rest.slice(74)}`; }
  out.push(rest);
  return out.join('\r\n');
}

/** A calendar file (works in Apple, Outlook and Google Calendar) with each task as an all-day entry. */
export function buildIcs(
  tasks: Array<Pick<CoachingCommitment, 'id' | 'description' | 'due_date' | 'companion_name'> & { goalTitle?: string | null }>,
  link: string,
  now: Date = new Date(),
): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Velvet//Tasks//EN', 'CALSCALE:GREGORIAN'];
  for (const t of tasks) {
    const [start, end] = dayRange(t, now);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${t.id}@velvet`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${end}`,
      `SUMMARY:${icsText(clean(t.description))}`,
      `DESCRIPTION:${icsText(details(t, t.goalTitle, link))}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

/** Hands the calendar file to the browser as a download. */
export function downloadIcs(filename: string, ics: string): void {
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

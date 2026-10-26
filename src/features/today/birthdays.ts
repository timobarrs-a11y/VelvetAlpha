import type { RealPerson } from '../../services/realPeopleService';

// Birthdays of the people who matter (`real_people`), worked out for Today:
// which fall in a range, and how old each person turns.

/** The year stored when the user doesn't know the birth year: a leap year, so 29 February fits. */
export const UNKNOWN_BIRTH_YEAR = 2000;

export interface BirthdayOccurrence {
  person: RealPerson;
  /** Local midnight on the day of the birthday. */
  date: Date;
  /** The age they turn, or null when the birth year isn't known. */
  age: number | null;
}

/** "1969-03-12" as its parts, without going through UTC (which can shift the day). */
export function parseDateOnly(value: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) - 1, day: Number(m[3]) };
}

/** A date as "YYYY-MM-DD" from its local parts. */
export function dateOnly(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st, 22nd, 101st… */
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/** "Queen's 57th birthday", or "Queen's birthday" without an age. */
export function birthdayTitle(name: string, age: number | null): string {
  const possessive = name.endsWith('s') ? `${name}'` : `${name}'s`;
  return age !== null && age > 0 ? `${possessive} ${ordinal(age)} birthday` : `${possessive} birthday`;
}

/** Every birthday between start and end (inclusive), soonest first. */
export function birthdaysBetween(people: RealPerson[], start: Date, end: Date): BirthdayOccurrence[] {
  const from = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const out: BirthdayOccurrence[] = [];
  for (const person of people) {
    if (!person.birthday) continue;
    const born = parseDateOnly(person.birthday);
    if (!born) continue;
    const yearKnown = person.birthday_year_known !== false;
    for (let year = from.getFullYear(); year <= end.getFullYear(); year++) {
      // 29 February falls on the 28th in other years.
      const lastDay = new Date(year, born.month + 1, 0).getDate();
      const date = new Date(year, born.month, Math.min(born.day, lastDay));
      if (date < from || date > end) continue;
      out.push({ person, date, age: yearKnown ? year - born.year : null });
    }
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}

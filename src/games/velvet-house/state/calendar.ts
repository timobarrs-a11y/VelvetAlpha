export interface GiftInfo {
  bond: number;
  say: string;
}

export const GIFTS: Record<string, GiftInfo> = {
  flowers: { bond: 3, say: 'Maya put the flowers in the nicest glass you own and kept moving them to better light.' },
  sketch: { bond: 4, say: 'Maya flipped through the new sketchbook and started drawing immediately.' },
  tickets: { bond: 6, say: 'Maya screamed at the concert tickets. Then hugged you. Then screamed again.' },
  earrings: { bond: 8, say: 'Maya put the earrings on right away and checked them in every mirror.' },
  spa: { bond: 5, say: 'Maya read the spa voucher twice and said you might be the best.' },
};

export function nextOn(day: number, first: number, every: number): number {
  if (day <= first) return first;
  return first + Math.ceil((day - first) / every) * every;
}

export interface CalendarEvent {
  d: number;
  t: string;
}

export interface UpcomingInput {
  day: number;
  seasonDay: number;
  seasonIdxOf: (d: number) => number;
  festivalName: (si: number) => string;
  seasonName: (si: number) => string;
  partnerName: string;
  billDueDay: number | null;
}

export function upcoming(input: UpcomingInput): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  if (input.billDueDay !== null) out.push({ d: input.billDueDay, t: 'Rent due' });
  out.push({ d: nextOn(input.day, 12, 28), t: 'Your anniversary' });
  out.push({ d: nextOn(input.day, 20, 28), t: `${input.partnerName}'s birthday` });
  const fd = input.day - input.seasonDay + 4 + (input.seasonDay > 4 ? 7 : 0);
  out.push({ d: fd, t: input.festivalName(input.seasonIdxOf(fd)) });
  const sd = input.day - input.seasonDay + 8;
  out.push({ d: sd, t: `${input.seasonName(input.seasonIdxOf(sd))} starts` });
  return out.filter(e => e.d >= input.day && e.d - input.day <= 14).sort((a, b) => a.d - b.d).slice(0, 4);
}

export interface DateEvent {
  key: 'anniv' | 'bday';
  first: number;
  every: number;
  gain: number;
  name: string;
}

export const DATE_EVENTS: DateEvent[] = [
  { key: 'anniv', first: 12, every: 28, gain: 6, name: 'your anniversary' },
  { key: 'bday', first: 20, every: 28, gain: 10, name: "Maya's birthday" },
];

export function isDateToday(day: number, evt: DateEvent): boolean {
  return day >= evt.first && (day - evt.first) % evt.every === 0;
}

export interface DateCheckInput {
  day: number;
  giftDay: number | null;
  togetherDay: number | null;
  datesDone: string[];
}

export interface DateCheckResult {
  evt: DateEvent;
  wasRemembered: boolean;
  bondChange: number;
  key: string;
}

export function checkDate(evt: DateEvent, input: DateCheckInput): DateCheckResult | null {
  if (!isDateToday(input.day, evt)) return null;
  const key = evt.key + input.day;
  if (input.datesDone.includes(key)) return null;
  const wasRemembered =
    evt.key === 'bday'
      ? input.giftDay !== null && input.day - input.giftDay <= 1
      : input.togetherDay === input.day || input.giftDay === input.day;
  return {
    evt,
    wasRemembered,
    bondChange: wasRemembered ? evt.gain : -evt.gain,
    key,
  };
}

export interface GiftCalcInput {
  kind: string;
  day: number;
  giftDay: number | null;
  seasonIdx: number;
  seasonDay: number;
  sketchStoryKnown: boolean;
}

export function giftBondGain(input: GiftCalcInput): number {
  const g = GIFTS[input.kind];
  if (!g) return 0;
  const special =
    [12, 20].some(f => input.day >= f && (input.day - f) % 28 === 0) ||
    (input.seasonIdx === 3 && input.seasonDay >= 1 && input.seasonDay <= 4);
  let b = g.bond * (special ? 1.6 : 1) * (input.kind === 'sketch' && input.sketchStoryKnown ? 1.5 : 1);
  if (input.giftDay === input.day) b *= 0.4;
  return b;
}

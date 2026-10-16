import { describe, it, expect } from 'vitest';
import {
  GIFTS, nextOn, upcoming, DATE_EVENTS, isDateToday, checkDate, giftBondGain,
} from '../state/calendar';
import type { UpcomingInput, DateCheckInput } from '../state/calendar';

function upcomingInput(over: Partial<UpcomingInput> = {}): UpcomingInput {
  return {
    day: 1,
    seasonDay: 1,
    seasonIdxOf: (d) => Math.floor((d - 1) / 7) % 4,
    festivalName: (si) => ['First warm day', 'Summer cookout', 'Leaf day', 'Holiday'][si],
    seasonName: (si) => ['Spring', 'Summer', 'Fall', 'Winter'][si],
    partnerName: 'Maya',
    billDueDay: null,
    ...over,
  };
}

describe('calendar — GIFTS', () => {
  it('has 5 gift types', () => {
    expect(Object.keys(GIFTS).length).toBe(5);
  });

  it('flowers give bond 3', () => {
    expect(GIFTS.flowers.bond).toBe(3);
  });

  it('earrings give bond 8', () => {
    expect(GIFTS.earrings.bond).toBe(8);
  });
});

describe('calendar — nextOn', () => {
  it('returns first when day <= first', () => {
    expect(nextOn(1, 12, 28)).toBe(12);
  });

  it('returns first when day equals first', () => {
    expect(nextOn(12, 12, 28)).toBe(12);
  });

  it('calculates next anniversary', () => {
    expect(nextOn(13, 12, 28)).toBe(40);
  });

  it('calculates next birthday', () => {
    expect(nextOn(21, 20, 28)).toBe(48);
  });

  it('handles exact multiple', () => {
    expect(nextOn(40, 12, 28)).toBe(40);
  });

  it('handles day after exact multiple', () => {
    expect(nextOn(41, 12, 28)).toBe(68);
  });
});

describe('calendar — upcoming', () => {
  it('includes anniversary and birthday', () => {
    const r = upcoming(upcomingInput({ day: 10 }));
    const texts = r.map(e => e.t);
    expect(texts).toContain('Your anniversary');
    expect(texts).toContain("Maya's birthday");
  });

  it('includes rent when bill due', () => {
    const r = upcoming(upcomingInput({ day: 1, billDueDay: 3 }));
    expect(r.some(e => e.t === 'Rent due')).toBe(true);
  });

  it('excludes rent when no bill', () => {
    const r = upcoming(upcomingInput({ day: 10, billDueDay: null }));
    expect(r.some(e => e.t === 'Rent due')).toBe(false);
  });

  it('filters events beyond 14 days', () => {
    const r = upcoming(upcomingInput({ day: 10 }));
    expect(r.every(e => e.d - 10 <= 14)).toBe(true);
  });

  it('limits to 4 events', () => {
    const r = upcoming(upcomingInput({ day: 10 }));
    expect(r.length).toBeLessThanOrEqual(4);
  });

  it('sorts by day ascending', () => {
    const r = upcoming(upcomingInput({ day: 10 }));
    for (let i = 1; i < r.length; i++) expect(r[i].d).toBeGreaterThanOrEqual(r[i - 1].d);
  });

  it('uses partnerName in birthday text', () => {
    const r = upcoming(upcomingInput({ day: 10, partnerName: 'Alex' }));
    expect(r.some(e => e.t === "Alex's birthday")).toBe(true);
  });
});

describe('calendar — DATE_EVENTS', () => {
  it('has anniversary on day 12 every 28 days', () => {
    const anniv = DATE_EVENTS.find(e => e.key === 'anniv')!;
    expect(anniv.first).toBe(12);
    expect(anniv.every).toBe(28);
    expect(anniv.gain).toBe(6);
  });

  it('has birthday on day 20 every 28 days', () => {
    const bday = DATE_EVENTS.find(e => e.key === 'bday')!;
    expect(bday.first).toBe(20);
    expect(bday.every).toBe(28);
    expect(bday.gain).toBe(10);
  });
});

describe('calendar — isDateToday', () => {
  it('true on anniversary day', () => {
    const anniv = DATE_EVENTS.find(e => e.key === 'anniv')!;
    expect(isDateToday(12, anniv)).toBe(true);
    expect(isDateToday(40, anniv)).toBe(true);
  });

  it('false on non-anniversary day', () => {
    const anniv = DATE_EVENTS.find(e => e.key === 'anniv')!;
    expect(isDateToday(13, anniv)).toBe(false);
  });

  it('true on birthday', () => {
    const bday = DATE_EVENTS.find(e => e.key === 'bday')!;
    expect(isDateToday(20, bday)).toBe(true);
    expect(isDateToday(48, bday)).toBe(true);
  });
});

describe('calendar — checkDate', () => {
  function dateInput(over: Partial<DateCheckInput> = {}): DateCheckInput {
    return { day: 12, giftDay: null, togetherDay: null, datesDone: [], ...over };
  }

  it('returns null for non-date day', () => {
    const anniv = DATE_EVENTS.find(e => e.key === 'anniv')!;
    expect(checkDate(anniv, dateInput({ day: 13 }))).toBeNull();
  });

  it('returns null for already-processed date', () => {
    const anniv = DATE_EVENTS.find(e => e.key === 'anniv')!;
    expect(checkDate(anniv, dateInput({ day: 12, datesDone: ['anniv12'] }))).toBeNull();
  });

  it('anniversary remembered when togetherDay matches', () => {
    const anniv = DATE_EVENTS.find(e => e.key === 'anniv')!;
    const r = checkDate(anniv, dateInput({ day: 12, togetherDay: 12 }));
    expect(r).not.toBeNull();
    expect(r!.wasRemembered).toBe(true);
    expect(r!.bondChange).toBe(6);
  });

  it('anniversary remembered when gift given same day', () => {
    const anniv = DATE_EVENTS.find(e => e.key === 'anniv')!;
    const r = checkDate(anniv, dateInput({ day: 12, giftDay: 12 }));
    expect(r!.wasRemembered).toBe(true);
  });

  it('anniversary forgotten when no gift or together', () => {
    const anniv = DATE_EVENTS.find(e => e.key === 'anniv')!;
    const r = checkDate(anniv, dateInput({ day: 12 }));
    expect(r!.wasRemembered).toBe(false);
    expect(r!.bondChange).toBe(-6);
  });

  it('birthday remembered when gift within 1 day', () => {
    const bday = DATE_EVENTS.find(e => e.key === 'bday')!;
    const r = checkDate(bday, dateInput({ day: 20, giftDay: 20 }));
    expect(r!.wasRemembered).toBe(true);
    expect(r!.bondChange).toBe(10);
  });

  it('birthday remembered when gift previous day', () => {
    const bday = DATE_EVENTS.find(e => e.key === 'bday')!;
    const r = checkDate(bday, dateInput({ day: 20, giftDay: 19 }));
    expect(r!.wasRemembered).toBe(true);
  });

  it('birthday forgotten when gift 2 days ago', () => {
    const bday = DATE_EVENTS.find(e => e.key === 'bday')!;
    const r = checkDate(bday, dateInput({ day: 20, giftDay: 18 }));
    expect(r!.wasRemembered).toBe(false);
    expect(r!.bondChange).toBe(-10);
  });

  it('returns unique key', () => {
    const anniv = DATE_EVENTS.find(e => e.key === 'anniv')!;
    const r = checkDate(anniv, dateInput({ day: 40 }));
    expect(r!.key).toBe('anniv40');
  });
});

describe('calendar — giftBondGain', () => {
  it('returns base bond for flowers', () => {
    expect(giftBondGain({ kind: 'flowers', day: 5, giftDay: null, seasonIdx: 0, seasonDay: 5, sketchStoryKnown: false })).toBe(3);
  });

  it('multiplies by 1.6 on anniversary day', () => {
    expect(giftBondGain({ kind: 'flowers', day: 12, giftDay: null, seasonIdx: 0, seasonDay: 5, sketchStoryKnown: false })).toBeCloseTo(4.8);
  });

  it('multiplies by 1.6 on birthday day', () => {
    expect(giftBondGain({ kind: 'flowers', day: 20, giftDay: null, seasonIdx: 0, seasonDay: 5, sketchStoryKnown: false })).toBeCloseTo(4.8);
  });

  it('multiplies by 1.6 during holiday festival (winter days 1-4)', () => {
    expect(giftBondGain({ kind: 'flowers', day: 22, giftDay: null, seasonIdx: 3, seasonDay: 2, sketchStoryKnown: false })).toBeCloseTo(4.8);
  });

  it('applies sketch bonus when story known', () => {
    const base = giftBondGain({ kind: 'sketch', day: 5, giftDay: null, seasonIdx: 0, seasonDay: 5, sketchStoryKnown: false });
    const bonus = giftBondGain({ kind: 'sketch', day: 5, giftDay: null, seasonIdx: 0, seasonDay: 5, sketchStoryKnown: true });
    expect(bonus).toBeCloseTo(base * 1.5);
  });

  it('reduces to 40% when already gifted today', () => {
    expect(giftBondGain({ kind: 'flowers', day: 5, giftDay: 5, seasonIdx: 0, seasonDay: 5, sketchStoryKnown: false })).toBeCloseTo(1.2);
  });

  it('returns 0 for unknown gift', () => {
    expect(giftBondGain({ kind: 'unknown', day: 5, giftDay: null, seasonIdx: 0, seasonDay: 5, sketchStoryKnown: false })).toBe(0);
  });
});

import { describe, it, expect } from 'vitest';
import {
  FESTIVALS, SEASON_TURN_LOG, festivalName, isFestivalDay,
  isNewSeason, holidayGiftReceived, holidayGiftOutcome,
  HOLIDAY_GIFT_LOG_RECEIVED, HOLIDAY_GIFT_LOG_FORGOT,
} from '../state/festivals';

describe('festivals — FESTIVALS', () => {
  it('has 4 festivals, one per season', () => {
    expect(FESTIVALS.length).toBe(4);
    FESTIVALS.forEach((f, i) => expect(f.si).toBe(i));
  });

  it('spring festival is First warm day', () => {
    expect(FESTIVALS[0].name).toBe('First warm day');
  });

  it('summer festival is Summer cookout', () => {
    expect(FESTIVALS[1].name).toBe('Summer cookout');
  });

  it('fall festival is Leaf day', () => {
    expect(FESTIVALS[2].name).toBe('Leaf day');
  });

  it('winter festival is Holiday', () => {
    expect(FESTIVALS[3].name).toBe('Holiday');
  });
});

describe('festivals — SEASON_TURN_LOG', () => {
  it('has 4 entries', () => {
    expect(SEASON_TURN_LOG.length).toBe(4);
  });

  it('spring mentions melting', () => {
    expect(SEASON_TURN_LOG[0]).toContain('melting');
  });

  it('winter mentions furnace', () => {
    expect(SEASON_TURN_LOG[3]).toContain('furnace');
  });
});

describe('festivals — festivalName', () => {
  it('returns correct name for each season', () => {
    expect(festivalName(0)).toBe('First warm day');
    expect(festivalName(1)).toBe('Summer cookout');
    expect(festivalName(2)).toBe('Leaf day');
    expect(festivalName(3)).toBe('Holiday');
  });

  it('wraps around for out-of-range indices', () => {
    expect(festivalName(4)).toBe('First warm day');
    expect(festivalName(5)).toBe('Summer cookout');
    expect(festivalName(-1)).toBe('Holiday');
  });
});

describe('festivals — isFestivalDay', () => {
  it('true on season day 4', () => {
    expect(isFestivalDay(4)).toBe(true);
  });

  it('false on other days', () => {
    expect(isFestivalDay(1)).toBe(false);
    expect(isFestivalDay(3)).toBe(false);
    expect(isFestivalDay(5)).toBe(false);
    expect(isFestivalDay(7)).toBe(false);
  });
});

describe('festivals — isNewSeason', () => {
  it('true on season day 1 after day 1', () => {
    expect(isNewSeason(1, 8)).toBe(true);
  });

  it('false on day 1', () => {
    expect(isNewSeason(1, 1)).toBe(false);
  });

  it('false on non-day-1', () => {
    expect(isNewSeason(3, 10)).toBe(false);
  });
});

describe('festivals — holidayGiftReceived', () => {
  it('true when gift given today', () => {
    expect(holidayGiftReceived({ giftDay: 20, day: 20 })).toBe(true);
  });

  it('true when gift given within 3 days', () => {
    expect(holidayGiftReceived({ giftDay: 18, day: 21 })).toBe(true);
  });

  it('false when gift given more than 3 days ago', () => {
    expect(holidayGiftReceived({ giftDay: 15, day: 20 })).toBe(false);
  });

  it('false when no gift given', () => {
    expect(holidayGiftReceived({ giftDay: null, day: 20 })).toBe(false);
  });
});

describe('festivals — holidayGiftOutcome', () => {
  it('positive outcome when gift received', () => {
    const r = holidayGiftOutcome({ giftDay: 20, day: 20 });
    expect(r.received).toBe(true);
    expect(r.bondChange).toBe(8);
    expect(r.mood).toBe('happy');
  });

  it('negative outcome when gift not received', () => {
    const r = holidayGiftOutcome({ giftDay: null, day: 20 });
    expect(r.received).toBe(false);
    expect(r.bondChange).toBe(-5);
    expect(r.mood).toBe('sad');
  });
});

describe('festivals — log constants', () => {
  it('received log mentions scarf', () => {
    expect(HOLIDAY_GIFT_LOG_RECEIVED).toContain('scarf');
  });

  it('forgotten log mentions not getting gift', () => {
    expect(HOLIDAY_GIFT_LOG_FORGOT).toContain("didn't");
  });
});

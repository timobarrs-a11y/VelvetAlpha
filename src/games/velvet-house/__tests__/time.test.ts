import { describe, it, expect } from 'vitest';
import {
  weekday,
  hour,
  absMin,
  inWindow,
  clockText,
  hText,
  whenText,
  seasonIdx,
  season,
  seasonDay,
  darkness,
  skyColor,
  DAYS,
  SEASONS,
} from '../state/time';

describe('time', () => {
  describe('weekday', () => {
    it('day 1 is Saturday (index 5)', () => {
      expect(weekday(1)).toBe(5);
    });
    it('day 2 is Sunday (index 6)', () => {
      expect(weekday(2)).toBe(6);
    });
    it('day 3 is Monday (index 0)', () => {
      expect(weekday(3)).toBe(0);
    });
    it('cycles every 7 days', () => {
      expect(weekday(8)).toBe(weekday(1));
      expect(weekday(10)).toBe(weekday(3));
    });
  });

  describe('hour', () => {
    it('converts minutes to fractional hours', () => {
      expect(hour(6 * 60 + 20)).toBeCloseTo(6.333, 2);
      expect(hour(0)).toBe(0);
      expect(hour(15 * 60)).toBe(15);
    });
  });

  describe('absMin', () => {
    it('combines day and minutes', () => {
      expect(absMin(1, 0)).toBe(1440);
      expect(absMin(2, 60)).toBe(2 * 1440 + 60);
    });
  });

  describe('inWindow', () => {
    it('normal range (a < b)', () => {
      expect(inWindow(10, 8, 12)).toBe(true);
      expect(inWindow(7, 8, 12)).toBe(false);
      expect(inWindow(12, 8, 12)).toBe(false);
    });
    it('wraparound range (a > b, crosses midnight)', () => {
      expect(inWindow(23, 22, 2)).toBe(true);
      expect(inWindow(1, 22, 2)).toBe(true);
      expect(inWindow(12, 22, 2)).toBe(false);
    });
    it('equal a and b matches everything (wraparound branch)', () => {
      expect(inWindow(5, 5, 5)).toBe(true);
    });
  });

  describe('clockText', () => {
    it('formats midnight as 12:00 AM', () => {
      expect(clockText(0)).toBe('12:00 AM');
    });
    it('formats noon as 12:00 PM', () => {
      expect(clockText(12 * 60)).toBe('12:00 PM');
    });
    it('formats 6:20 as 6:20 AM', () => {
      expect(clockText(6 * 60 + 20)).toBe('6:20 AM');
    });
    it('formats 15:45 as 3:45 PM', () => {
      expect(clockText(15 * 60 + 45)).toBe('3:45 PM');
    });
    it('pads minutes', () => {
      expect(clockText(9 * 60 + 5)).toBe('9:05 AM');
    });
  });

  describe('hText', () => {
    it('formats whole hours without :00', () => {
      expect(hText(14)).toBe('2 PM');
    });
    it('formats fractional hours', () => {
      expect(hText(6.5)).toBe('6:30 AM');
    });
  });

  describe('whenText', () => {
    it('combines day name and hour', () => {
      const abs = 3 * 1440 + 14 * 60;
      expect(whenText(abs)).toBe('Mon 2 PM');
    });
  });

  describe('seasonIdx', () => {
    it('days 1-7 are Spring (0)', () => {
      expect(seasonIdx(1)).toBe(0);
      expect(seasonIdx(7)).toBe(0);
    });
    it('days 8-14 are Summer (1)', () => {
      expect(seasonIdx(8)).toBe(1);
      expect(seasonIdx(14)).toBe(1);
    });
    it('days 15-21 are Fall (2)', () => {
      expect(seasonIdx(15)).toBe(2);
    });
    it('days 22-28 are Winter (3)', () => {
      expect(seasonIdx(22)).toBe(3);
    });
    it('cycles every 28 days', () => {
      expect(seasonIdx(29)).toBe(0);
      expect(seasonIdx(35)).toBe(0);
    });
  });

  describe('season', () => {
    it('returns season name', () => {
      expect(season(1)).toBe('Spring');
      expect(season(10)).toBe('Summer');
      expect(season(17)).toBe('Fall');
      expect(season(24)).toBe('Winter');
    });
  });

  describe('seasonDay', () => {
    it('returns day within season (1-7)', () => {
      expect(seasonDay(1)).toBe(1);
      expect(seasonDay(7)).toBe(7);
      expect(seasonDay(8)).toBe(1);
      expect(seasonDay(10)).toBe(3);
    });
  });

  describe('darkness', () => {
    it('is dark at midnight', () => {
      expect(darkness(0, 1)).toBeCloseTo(0.42, 2);
    });
    it('is dark at 3am', () => {
      expect(darkness(3, 1)).toBeCloseTo(0.42, 2);
    });
    it('is zero at midday', () => {
      expect(darkness(12, 1)).toBe(0);
    });
    it('transitions at dusk', () => {
      const d = darkness(19, 1);
      expect(d).toBeGreaterThan(0);
      expect(d).toBeLessThan(0.42);
    });
    it('winter has earlier evening (eve=-2.5)', () => {
      const winterNight = darkness(18.5, 22);
      expect(winterNight).toBeGreaterThan(0);
    });
  });

  describe('skyColor', () => {
    it('is blue at midday in spring', () => {
      expect(skyColor(12, false, 0, 1)).toBe('#BFE2F0');
    });
    it('is dark at night', () => {
      expect(skyColor(0, false, 0.42, 1)).toBe('#2A2F55');
    });
    it('has sunset glow in evening', () => {
      expect(skyColor(18, false, 0, 1)).toBe('#F0B98E');
    });
    it('returns grey when raining in daylight', () => {
      expect(skyColor(12, true, 0, 1)).toBe('#9AA6B5');
    });
  });

  describe('constants', () => {
    it('DAYS has 7 entries', () => {
      expect(DAYS).toHaveLength(7);
      expect(DAYS[0]).toBe('Mon');
    });
    it('SEASONS has 4 entries', () => {
      expect(SEASONS).toHaveLength(4);
    });
  });
});

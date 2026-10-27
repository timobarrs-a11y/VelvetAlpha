import { describe, it, expect } from 'vitest';
import { birthdaysBetween, birthdayTitle, ordinal, parseDateOnly, dateOnly, UNKNOWN_BIRTH_YEAR } from '../birthdays';
import type { RealPerson } from '../../../services/realPeopleService';

function person(overrides: Partial<RealPerson>): RealPerson {
  return {
    id: 'p1', user_id: 'u1', name: 'Queen', relationship: 'family', birthday: null,
    city: null, state: null, favorite_color: null, hobbies: [], favorite_foods: [],
    dietary_restrictions: [], favorite_tv_shows: [], movie_genres: [], sports_teams: [],
    music_genres: [], travel_destinations: [], clothing_size_shirt: null, clothing_size_shoe: null,
    clothing_size_dress: null, ring_size: null, things_mentioned_wanting: null,
    survey_completed: false, survey_completed_at: null, avatar_color: 'rose',
    created_at: '', updated_at: '',
    ...overrides,
  };
}

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d);
const endOf = (y: number, m: number, d: number) => new Date(y, m - 1, d, 23, 59, 59);

describe('ordinal', () => {
  it('uses the right ending', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 57, 101, 111, 112].map(ordinal))
      .toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '57th', '101st', '111th', '112th']);
  });
});

describe('birthdayTitle', () => {
  it('names the birthday with its age when known', () => {
    expect(birthdayTitle('Queen', 57)).toBe("Queen's 57th birthday");
    expect(birthdayTitle('Queen', null)).toBe("Queen's birthday");
  });

  it('writes the possessive of a name ending in s', () => {
    expect(birthdayTitle('James', 30)).toBe("James' 30th birthday");
  });
});

describe('parseDateOnly and dateOnly', () => {
  it('reads a date without shifting it through UTC', () => {
    expect(parseDateOnly('1969-03-12')).toEqual({ year: 1969, month: 2, day: 12 });
    expect(parseDateOnly('not a date')).toBeNull();
    expect(dateOnly(1969, 2, 12)).toBe('1969-03-12');
  });
});

describe('birthdaysBetween', () => {
  it('works out the age from the year they gave', () => {
    const [b] = birthdaysBetween([person({ birthday: '1969-10-26' })], day(2026, 10, 26), endOf(2026, 10, 26));
    expect(b.age).toBe(57);
    expect(b.date).toEqual(day(2026, 10, 26));
  });

  it('gives no age when the year is unknown', () => {
    const [b] = birthdaysBetween(
      [person({ birthday: `${UNKNOWN_BIRTH_YEAR}-10-26`, birthday_year_known: false })],
      day(2026, 10, 26), endOf(2026, 10, 26),
    );
    expect(b.age).toBeNull();
  });

  it('finds the birthdays in the week ahead, soonest first', () => {
    const found = birthdaysBetween(
      [
        person({ id: 'later', name: 'Later', birthday: '1990-11-01' }),
        person({ id: 'sooner', name: 'Sooner', birthday: '1990-10-28' }),
        person({ id: 'outside', name: 'Outside', birthday: '1990-12-25' }),
        person({ id: 'none', name: 'None', birthday: null }),
      ],
      day(2026, 10, 27), endOf(2026, 11, 2),
    );
    expect(found.map(b => b.person.id)).toEqual(['sooner', 'later']);
  });

  it('spans the new year', () => {
    const found = birthdaysBetween([person({ birthday: '1990-01-02' })], day(2026, 12, 28), endOf(2027, 1, 4));
    expect(found.map(b => b.date)).toEqual([day(2027, 1, 2)]);
    expect(found[0].age).toBe(37);
  });

  it('puts a 29 February birthday on the 28th in other years', () => {
    const p = person({ birthday: '2000-02-29' });
    expect(birthdaysBetween([p], day(2027, 2, 1), endOf(2027, 2, 28)).map(b => b.date)).toEqual([day(2027, 2, 28)]);
    expect(birthdaysBetween([p], day(2028, 2, 1), endOf(2028, 2, 29)).map(b => b.date)).toEqual([day(2028, 2, 29)]);
  });
});

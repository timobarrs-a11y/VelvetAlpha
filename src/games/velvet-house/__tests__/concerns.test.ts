import { describe, it, expect } from 'vitest';
import { NEW_CONCERNS, evaluateConcerns, moodOf, hardPassOf, bondDrift, worstConcern, parseConcerns, CONCERN_KINDS, type Signals } from '../state/concerns';
import { BANKS } from '../content/banks';

const quiet: Signals = { servings: 5, starving: false, overdue: false, dishes: 0, laundry: 0 };
const H = 60, DAY = 24 * 60;

describe('concerns', () => {
  it('says nothing while the tutorial still teaches the systems', () => {
    const st = NEW_CONCERNS();
    expect(evaluateConcerns(st, { ...quiet, servings: 0 }, 10 * DAY, 10, false).raised).toEqual([]);
    expect(moodOf(st)).toBe('content');
  });

  it('an empty fridge is noticed after two hours, escalates after a day, closes the door after two, and clears when food arrives', () => {
    const st = NEW_CONCERNS();
    const empty = { ...quiet, servings: 0 };
    expect(evaluateConcerns(st, empty, 0, 1, true).raised).toEqual([]);
    expect(evaluateConcerns(st, empty, 1 * H, 1, true).raised).toEqual([]);
    expect(evaluateConcerns(st, empty, 2 * H, 1, true).raised).toEqual([{ kind: 'food', level: 1 }]);
    expect(moodOf(st)).toBe('unsettled');
    // Same day: not again.
    expect(evaluateConcerns(st, empty, 5 * H, 1, true).raised).toEqual([]);
    // Next day, still at step one: brought up once more.
    expect(evaluateConcerns(st, empty, 23 * H, 2, true).raised).toEqual([{ kind: 'food', level: 1 }]);
    expect(evaluateConcerns(st, empty, 25 * H, 2, true).raised).toEqual([{ kind: 'food', level: 2 }]);
    expect(moodOf(st)).toBe('worried');
    expect(evaluateConcerns(st, empty, 49 * H, 3, true).raised).toEqual([{ kind: 'food', level: 3 }]);
    expect(hardPassOf(st)).toBe('food');
    expect(moodOf(st)).toBe('upset');
    expect(worstConcern(st, 49 * H)).toEqual({ kind: 'food', level: 3, hours: 49 });
    const ev = evaluateConcerns(st, { ...quiet, servings: 6 }, 50 * H, 3, true);
    expect(ev.cleared).toEqual(['food']);
    expect(hardPassOf(st)).toBeNull();
    expect(moodOf(st)).toBe('content');
  });

  it('starving skips the grace period', () => {
    const st = NEW_CONCERNS();
    expect(evaluateConcerns(st, { ...quiet, servings: 0, starving: true }, 5, 1, true).raised).toEqual([{ kind: 'food', level: 1 }]);
  });

  it('dishes and laundry never reach the hard pass; an overdue bill is noticed at once', () => {
    const st = NEW_CONCERNS();
    const messy = { ...quiet, dishes: 8, laundry: 9, overdue: true };
    evaluateConcerns(st, messy, 0, 1, true);
    expect(st.bills.level).toBe(1); expect(st.dishes.level).toBe(0);
    evaluateConcerns(st, messy, 3 * DAY, 4, true);
    expect(st.bills.level).toBe(3); expect(st.dishes.level).toBe(2); expect(st.laundry.level).toBe(2);
    expect(hardPassOf(st)).toBe('bills');
  });

  it('bond falls while something has gone on a day, and recovers when all is well', () => {
    const st = NEW_CONCERNS();
    expect(bondDrift(50, st, 60)).toBe(51);
    evaluateConcerns(st, { ...quiet, servings: 0 }, 0, 1, true);
    evaluateConcerns(st, { ...quiet, servings: 0 }, 2 * DAY, 3, true);
    expect(bondDrift(50, st, 60)).toBe(49);
    expect(bondDrift(10, st, 600)).toBe(10);
  });

  it('comes back from a save', () => {
    const st = parseConcerns({ food: { since: 5, level: 2, nagDay: 1 }, junk: {} });
    expect(st.food).toEqual({ since: 5, level: 2, nagDay: 1 });
    expect(st.bills.level).toBe(0);
  });

  it('every style has a masculine and a feminine line for every concern step and every relief', () => {
    const slots = ['concern.food.1', 'concern.food.2', 'concern.food.3', 'concern.bills.1', 'concern.bills.2', 'concern.bills.3', 'concern.dishes.1', 'concern.dishes.2', 'concern.laundry.1', 'concern.laundry.2', ...CONCERN_KINDS.map((k) => `relief.${k}`)];
    for (const [style, lines] of Object.entries(BANKS.humor)) for (const slot of slots) {
      const l = lines[slot];
      expect(l, `${style} ${slot}`).toBeDefined();
      if (typeof l !== 'string') { expect(l.m, `${style} ${slot} m`).toBeTruthy(); expect(l.f, `${style} ${slot} f`).toBeTruthy(); }
    }
  });
});

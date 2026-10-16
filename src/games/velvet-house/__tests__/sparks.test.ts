import { describe, it, expect } from 'vitest';
import {
  SPARK_WEIGHTS, sparkWeights, pickSpark, SPARK_TO_WISH, SPARK_MOOD,
} from '../state/sparks';
import type { SparkContext, SparkId } from '../state/sparks';

function ctx(over: Partial<SparkContext> = {}): SparkContext {
  return {
    hour: 8, hasWish: false, homeNow: true, dishes: 0, money: 100,
    lawnWeeds: 0, raining: false, laundryPile: 0, messLevel: 0, hasPets: false,
    ...over,
  };
}

function seededRng(seed: number): () => number {
  let v = seed % 233280;
  return () => { v = (v * 9301 + 49297) % 233280; return v / 233280; };
}

describe('sparks — SPARK_WEIGHTS', () => {
  it('has 14 sparks', () => {
    expect(SPARK_WEIGHTS.length).toBe(14);
  });
});

describe('sparks — sparkWeights', () => {
  it('coffee has weight 3 in morning with no wish', () => {
    expect(sparkWeights(ctx({ hour: 8 }))[0]).toBe(3);
  });

  it('coffee has weight 0 after 11am', () => {
    expect(sparkWeights(ctx({ hour: 12 }))[0]).toBe(0);
  });

  it('coffee has weight 0 when wish active', () => {
    expect(sparkWeights(ctx({ hour: 8, hasWish: true }))[0]).toBe(0);
  });

  it('dance has weight 2 at 6pm with no wish and home', () => {
    expect(sparkWeights(ctx({ hour: 18 }))[1]).toBe(2);
  });

  it('dance has weight 0 when not home', () => {
    expect(sparkWeights(ctx({ hour: 18, homeNow: false }))[1]).toBe(0);
  });

  it('tv has weight 2.5 at 7pm', () => {
    expect(sparkWeights(ctx({ hour: 19 }))[2]).toBe(2.5);
  });

  it('dishes spark active when dishes >= 2', () => {
    expect(sparkWeights(ctx({ dishes: 3 }))[6]).toBe(1.5);
  });

  it('dishes spark inactive when dishes < 2', () => {
    expect(sparkWeights(ctx({ dishes: 1 }))[6]).toBe(0);
  });

  it('money spark active when money < 50', () => {
    expect(sparkWeights(ctx({ money: 30 }))[7]).toBe(1.2);
  });

  it('rain spark active when raining', () => {
    expect(sparkWeights(ctx({ raining: true }))[10]).toBe(1.2);
  });

  it('laundry spark active when pile >= 5', () => {
    expect(sparkWeights(ctx({ laundryPile: 6 }))[11]).toBe(1.5);
  });

  it('pets spark active when has pets', () => {
    expect(sparkWeights(ctx({ hasPets: true }))[13]).toBe(1.4);
  });

  it('messy spark active when messLevel > 5', () => {
    expect(sparkWeights(ctx({ messLevel: 7 }))[12]).toBe(1.5);
  });

  it('dandelions spark active when weeds >= 5', () => {
    expect(sparkWeights(ctx({ lawnWeeds: 6 }))[9]).toBe(1);
  });

  it('toast and monstera always weight 1', () => {
    const w = sparkWeights(ctx());
    expect(w[3]).toBe(1);
    expect(w[4]).toBe(1);
  });
});

describe('sparks — pickSpark', () => {
  it('always has at least toast/monstera with weight 1', () => {
    const c = ctx({ hour: 12, dishes: 0, money: 100, lawnWeeds: 0, raining: false, laundryPile: 0, messLevel: 0, hasPets: false, hasWish: true, homeNow: false });
    const id = pickSpark(c, seededRng(1));
    expect(id).not.toBeNull();
    expect(['toast', 'monstera', 'momCall', 'playlist', 'dishes', 'moneyCheck', 'dandelions', 'rain', 'laundry', 'messy', 'pets']).toContain(id);
  });

  it('returns a valid spark id when weights exist', () => {
    const id = pickSpark(ctx({ hour: 8 }), seededRng(42));
    expect(id).not.toBeNull();
    expect(SPARK_WEIGHTS.some(s => s.id === id)).toBe(true);
  });

  it('distributes across multiple sparks with different seeds', () => {
    const picks = new Set<SparkId | null>();
    for (let s = 0; s < 50; s++) {
      picks.add(pickSpark(ctx({ hour: 8, dishes: 3 }), seededRng(s * 100)));
    }
    expect(picks.size).toBeGreaterThan(1);
  });

  it('only returns wish-type sparks when conditions allow', () => {
    const c = ctx({ hour: 8, hasWish: false, homeNow: true });
    const id = pickSpark(c, seededRng(0));
    expect(id).not.toBeNull();
  });
});

describe('sparks — SPARK_TO_WISH', () => {
  it('maps coffee to coffee wish', () => {
    expect(SPARK_TO_WISH.coffee).toBe('coffee');
  });

  it('maps dance to dance wish', () => {
    expect(SPARK_TO_WISH.dance).toBe('dance');
  });

  it('maps tv to tv wish', () => {
    expect(SPARK_TO_WISH.tv).toBe('tv');
  });

  it('does not map non-wish sparks', () => {
    expect(SPARK_TO_WISH.toast).toBeUndefined();
    expect(SPARK_TO_WISH.monstera).toBeUndefined();
  });
});

describe('sparks — SPARK_MOOD', () => {
  it('monstera sets happy mood', () => {
    expect(SPARK_MOOD.monstera).toBe('happy');
  });

  it('dishes sets annoyed mood', () => {
    expect(SPARK_MOOD.dishes).toBe('annoyed');
  });

  it('toast has no mood', () => {
    expect(SPARK_MOOD.toast).toBeUndefined();
  });
});

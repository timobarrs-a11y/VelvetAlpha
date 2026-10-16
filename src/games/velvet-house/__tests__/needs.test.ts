import { describe, it, expect } from 'vitest';
import {
  NEED_KEYS,
  NEED_LABELS,
  DECAY,
  DECAY_SLEEP,
  DECAY_AWAY,
  weight,
  tickNeeds,
  checkWarnings,
  totalNeedScore,
  lowestNeed,
  type TickContext,
  type NeedKey,
} from '../state/needs';
import type { CharacterNeeds } from '../state/types';

function fullNeeds(): CharacterNeeds {
  return { energy: 80, food: 80, hygiene: 80, fun: 80, comfort: 80, social: 80 };
}

function emptyCtx(overrides: Partial<TickContext> = {}): TickContext {
  return {
    away: false,
    asleep: false,
    fitness: 0,
    starving: false,
    messLevel: 0,
    hasBed: false,
    activity: null,
    activityName: null,
    foodScale: 1,
    coffeeBoost: 1,
    hasBigTv: false,
    hasBookshelf: false,
    hasRecords: false,
    ...overrides,
  };
}

describe('needs', () => {
  describe('NEED_KEYS', () => {
    it('has 6 need types', () => {
      expect(NEED_KEYS).toHaveLength(6);
      expect(NEED_KEYS).toContain('energy');
      expect(NEED_KEYS).toContain('social');
    });
  });

  describe('NEED_LABELS', () => {
    it('labels all 6 needs', () => {
      for (const k of NEED_KEYS) {
        expect(NEED_LABELS[k]).toBeTypeOf('string');
        expect(NEED_LABELS[k].length).toBeGreaterThan(0);
      }
    });
  });

  describe('DECAY rates', () => {
    it('DECAY has all 6 keys', () => {
      for (const k of NEED_KEYS) {
        expect(DECAY[k]).toBeTypeOf('number');
        expect(DECAY[k]).toBeGreaterThan(0);
      }
    });

    it('DECAY_SLEEP has zero energy decay', () => {
      expect(DECAY_SLEEP.energy).toBe(0);
    });

    it('DECAY_AWAY has lower food decay than normal', () => {
      expect(DECAY_AWAY.food).toBeLessThan(DECAY.food);
    });

    it('DECAY_SLEEP has lower social decay than normal', () => {
      expect(DECAY_SLEEP.social).toBeLessThan(DECAY.social);
    });
  });

  describe('weight', () => {
    it('returns 0 when need is at 100', () => {
      expect(weight(100)).toBe(0);
    });

    it('returns 1 when need is at 0', () => {
      expect(weight(0)).toBe(1);
    });

    it('is quadratic (0.5 → 0.25)', () => {
      expect(weight(50)).toBeCloseTo(0.25, 5);
    });

    it('increases as need decreases', () => {
      expect(weight(20)).toBeGreaterThan(weight(50));
      expect(weight(50)).toBeGreaterThan(weight(80));
    });
  });

  describe('tickNeeds', () => {
    it('decays all needs over time with no activity', () => {
      const needs = fullNeeds();
      const { needs: result } = tickNeeds(needs, emptyCtx(), 60);
      for (const k of NEED_KEYS) {
        expect(result[k]).toBeLessThan(needs[k]);
      }
    });

    it('does not decay energy while asleep', () => {
      const needs = fullNeeds();
      const { needs: result } = tickNeeds(needs, emptyCtx({ asleep: true }), 480);
      expect(result.energy).toBeCloseTo(80, 1);
    });

    it('clamps needs to 0 minimum', () => {
      const needs = { ...fullNeeds(), food: 1 };
      const { needs: result } = tickNeeds(needs, emptyCtx(), 120);
      expect(result.food).toBe(0);
    });

    it('clamps needs to 100 maximum', () => {
      const needs = { ...fullNeeds(), energy: 99 };
      const ctx = emptyCtx({
        asleep: true,
        activity: { rate: { energy: 10 } },
      });
      const { needs: result } = tickNeeds(needs, ctx, 60);
      expect(result.energy).toBe(100);
    });

    it('applies fitness multiplier to energy decay', () => {
      const needs = fullNeeds();
      const lowFit = tickNeeds(needs, emptyCtx({ fitness: 0 }), 60);
      const highFit = tickNeeds(needs, emptyCtx({ fitness: 2 }), 60);
      expect(highFit.needs.energy).toBeGreaterThan(lowFit.needs.energy);
    });

    it('increases fun decay when starving', () => {
      const needs = { ...fullNeeds(), food: 10 };
      const ctx = emptyCtx({ starving: true });
      const { needs: result } = tickNeeds(needs, ctx, 60);
      const normalCtx = emptyCtx({ starving: false });
      const { needs: normalResult } = tickNeeds(needs, normalCtx, 60);
      expect(result.fun).toBeLessThan(normalResult.fun);
    });

    it('increases comfort decay in messy environment', () => {
      const needs = fullNeeds();
      const clean = tickNeeds(needs, emptyCtx({ messLevel: 0 }), 60);
      const messy = tickNeeds(needs, emptyCtx({ messLevel: 10 }), 60);
      expect(messy.needs.comfort).toBeLessThan(clean.needs.comfort);
    });

    it('applies activity gives over duration', () => {
      const needs = { ...fullNeeds(), fun: 30 };
      const ctx = emptyCtx({
        activity: { gives: { fun: 40 }, dur: 30 },
        activityName: 'tv',
      });
      const { needs: result } = tickNeeds(needs, ctx, 30);
      expect(result.fun).toBeGreaterThan(30);
    });

    it('applies big tv bonus to fun', () => {
      const needs = { ...fullNeeds(), fun: 30 };
      const noBonus = tickNeeds(needs, emptyCtx({
        activity: { gives: { fun: 40 }, dur: 30 },
        activityName: 'tv',
        hasBigTv: false,
      }), 30);
      const withBonus = tickNeeds(needs, emptyCtx({
        activity: { gives: { fun: 40 }, dur: 30 },
        activityName: 'tv',
        hasBigTv: true,
      }), 30);
      expect(withBonus.needs.fun).toBeGreaterThan(noBonus.needs.fun);
    });

    it('applies bed bonus to energy rate', () => {
      const needs = { ...fullNeeds(), energy: 30 };
      const noBed = tickNeeds(needs, emptyCtx({
        asleep: true,
        activity: { rate: { energy: 0.01 } },
        hasBed: false,
      }), 60);
      const withBed = tickNeeds(needs, emptyCtx({
        asleep: true,
        activity: { rate: { energy: 0.01 } },
        hasBed: true,
      }), 60);
      expect(withBed.needs.energy).toBeGreaterThan(noBed.needs.energy);
    });

    it('does not mutate original needs object', () => {
      const needs = fullNeeds();
      const original = { ...needs };
      tickNeeds(needs, emptyCtx(), 60);
      expect(needs).toEqual(original);
    });
  });

  describe('checkWarnings', () => {
    it('returns warning when need drops below 20', () => {
      const needs = { ...fullNeeds(), food: 15 };
      const warned = new Set<NeedKey>();
      const { newWarnings } = checkWarnings(needs, warned, 'Jordan');
      expect(newWarnings).toHaveLength(1);
      expect(newWarnings[0].key).toBe('food');
      expect(newWarnings[0].message).toContain('Jordan');
    });

    it('does not re-warn if already warned', () => {
      const needs = { ...fullNeeds(), food: 15 };
      const warned = new Set<NeedKey>(['food']);
      const { newWarnings } = checkWarnings(needs, warned, 'Jordan');
      expect(newWarnings).toHaveLength(0);
    });

    it('clears warning when need recovers above 35', () => {
      const needs = { ...fullNeeds(), food: 50 };
      const warned = new Set<NeedKey>(['food']);
      const { toClear } = checkWarnings(needs, warned, 'Jordan');
      expect(toClear).toContain('food');
    });

    it('does not clear if need is still low', () => {
      const needs = { ...fullNeeds(), food: 25 };
      const warned = new Set<NeedKey>(['food']);
      const { toClear } = checkWarnings(needs, warned, 'Jordan');
      expect(toClear).toHaveLength(0);
    });
  });

  describe('totalNeedScore', () => {
    it('returns 80 when all needs are 80', () => {
      expect(totalNeedScore(fullNeeds())).toBe(80);
    });

    it('returns 0 when all needs are 0', () => {
      const needs: CharacterNeeds = { energy: 0, food: 0, hygiene: 0, fun: 0, comfort: 0, social: 0 };
      expect(totalNeedScore(needs)).toBe(0);
    });

    it('returns average across all needs', () => {
      const needs: CharacterNeeds = { energy: 60, food: 80, hygiene: 40, fun: 100, comfort: 20, social: 80 };
      expect(totalNeedScore(needs)).toBeCloseTo(63.33, 1);
    });
  });

  describe('lowestNeed', () => {
    it('returns the need with lowest value', () => {
      const needs: CharacterNeeds = { energy: 50, food: 20, hygiene: 80, fun: 80, comfort: 80, social: 80 };
      const result = lowestNeed(needs);
      expect(result.key).toBe('food');
      expect(result.value).toBe(20);
    });

    it('returns first need when all are equal', () => {
      const needs = fullNeeds();
      const result = lowestNeed(needs);
      expect(result.value).toBe(80);
      expect(NEED_KEYS).toContain(result.key);
    });
  });
});

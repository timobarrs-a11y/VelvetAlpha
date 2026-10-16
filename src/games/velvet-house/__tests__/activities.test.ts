import { describe, it, expect } from 'vitest';
import {
  ACTIVITIES,
  CHAINS,
  ERRANDS,
  chainOf,
  activityGives,
  activityDur,
} from '../state/activities';

describe('activities catalog', () => {
  it('has at least 60 activities', () => {
    expect(Object.keys(ACTIVITIES).length).toBeGreaterThanOrEqual(60);
  });

  it('every activity has pose, dur, verb', () => {
    for (const [name, a] of Object.entries(ACTIVITIES)) {
      expect(a.pose, `${name} needs pose`).toBeTruthy();
      expect(a.verb, `${name} needs verb`).toBeTruthy();
      expect(a.dur, `${name} needs dur`).toBeGreaterThanOrEqual(0);
    }
  });

  it('sleep has Infinity dur and rate', () => {
    expect(ACTIVITIES.sleep.dur).toBe(Infinity);
    expect(ACTIVITIES.sleep.rate?.energy).toBe(0.22);
  });

  it('eat gives food 72', () => {
    expect(ACTIVITIES.eat.gives?.food).toBe(72);
  });

  it('shower gives hygiene 95', () => {
    expect(ACTIVITIES.shower.gives?.hygiene).toBe(95);
  });

  it('tv has level 1', () => {
    expect(ACTIVITIES.tv.level).toBe(1);
  });

  it('bath gives hygiene 100', () => {
    expect(ACTIVITIES.bath.gives?.hygiene).toBe(100);
  });

  it('workout costs energy and hygiene', () => {
    expect(ACTIVITIES.workout.gives?.energy).toBe(-12);
    expect(ACTIVITIES.workout.gives?.hygiene).toBe(-25);
  });

  it('errand has Infinity dur', () => {
    expect(ACTIVITIES.errand.dur).toBe(Infinity);
  });
});

describe('CHAINS', () => {
  it('cookeat is cook+eat', () => {
    expect(CHAINS.cookeat).toEqual(['cook', 'eat']);
  });

  it('dance includes lights on/off', () => {
    expect(CHAINS.dance).toEqual(['lightsOn', 'dance', 'lightsOff']);
  });

  it('every chain references valid activities', () => {
    for (const [name, steps] of Object.entries(CHAINS)) {
      for (const s of steps) {
        expect(ACTIVITIES[s], `chain ${name} step ${s} not found`).toBeDefined();
      }
    }
  });
});

describe('ERRANDS', () => {
  it('has 5 errand types', () => {
    expect(Object.keys(ERRANDS)).toHaveLength(5);
  });

  it('work has zero dur', () => {
    expect(ERRANDS.work.baseDur).toBe(0);
  });

  it('friends costs 20', () => {
    expect(ERRANDS.friends.cost).toBe(20);
  });
});

describe('helpers', () => {
  it('chainOf returns chain or singleton', () => {
    expect(chainOf('cookeat')).toEqual(['cook', 'eat']);
    expect(chainOf('sleep')).toEqual(['sleep']);
  });

  it('activityGives returns gives object', () => {
    expect(activityGives('eat').food).toBe(72);
    expect(activityGives('wander')).toEqual({});
  });

  it('activityDur returns dur', () => {
    expect(activityDur('eat')).toBe(25);
    expect(activityDur('sleep')).toBe(Infinity);
  });
});

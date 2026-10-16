import { describe, it, expect } from 'vitest';
import { INITIAL_OBJS } from '../state/objects';
import { RNG } from '../state/rng';
import { buildWorld, createAgent, tickAgent, chooseChain, startChain, isAsleep, statusText, type Agent } from '../state/agents';

const LOOK = { skin: '#C68E6A', hair: '#2B1D16', top: '#3E6E8E', bottom: '#2F3542', longHair: false };

function setup() {
  const world = buildWorld(INITIAL_OBJS.map((o) => ({ ...o })));
  const j = createAgent('jordan', 'Jordan', undefined, LOOK);
  const m = createAgent('maya', 'Maya', undefined, LOOK);
  return { world, j, m, rng: new RNG(7) };
}

function run(world: ReturnType<typeof buildWorld>, a: Agent, b: Agent, rng: RNG, seconds: number, hourF: number) {
  for (let i = 0; i < seconds * 20; i++) {
    tickAgent(world, a, b, 0.05, 0.05 * 3, 3, hourF, () => rng.next());
    tickAgent(world, b, a, 0.05, 0.05 * 3, 3, hourF, () => rng.next());
  }
}

describe('household agents', () => {
  it('builds usable spots from the starting furniture', () => {
    const { world } = setup();
    expect(world.slots.length).toBeGreaterThan(5);
    expect(world.grids).toHaveLength(4);
    for (const s of world.slots) {
      expect(Number.isFinite(s.stand[0]) && Number.isFinite(s.stand[1])).toBe(true);
    }
  });

  it('a hungry person chooses to cook and eat', () => {
    const { world, j, rng } = setup();
    j.needs = { energy: 90, food: 5, hygiene: 90, fun: 90, comfort: 90, social: 90 };
    expect(chooseChain(world, j, null, 12, () => rng.next())).toBe('cookeat');
  });

  it('heads to bed late at night', () => {
    const { world, j, rng } = setup();
    j.needs.energy = 50;
    expect(chooseChain(world, j, null, 23.5, () => rng.next())).toBe('sleep');
  });

  it('two people never take the same bed side', () => {
    const { world, j, m, rng } = setup();
    expect(startChain(world, j, 'sleep', m, () => rng.next())).toBe(true);
    expect(startChain(world, m, 'sleep', j, () => rng.next())).toBe(true);
    expect(j.task!.slot!.id).not.toBe(m.task!.slot!.id);
  });

  it('walks across floors and actually ends up asleep', () => {
    const { world, j, m, rng } = setup();
    j.needs.energy = 40;
    startChain(world, j, 'sleep', m, () => rng.next());
    const bedLevel = j.task!.slot!.level;
    run(world, j, m, rng, 60, 23.5);
    expect(j.level).toBe(bedLevel);
    expect(isAsleep(j)).toBe(true);
    expect(statusText(j)).toBe('Sleeping');
  });

  it('needs stay within 0 to 100 over a long stretch', () => {
    const { world, j, m, rng } = setup();
    run(world, j, m, rng, 120, 14);
    for (const p of [j, m]) {
      for (const v of Object.values(p.needs)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });

  it('ignores corrupt saved needs', () => {
    const a = createAgent('maya', 'Maya', { food: Number.NaN, fun: 250 }, LOOK);
    expect(a.needs.food).toBe(70);
    expect(a.needs.fun).toBe(100);
  });
});

import { describe, it, expect } from 'vitest';
import { INITIAL_OBJS } from '../state/objects';
import { RNG } from '../state/rng';
import { buildWorld, createAgent, tickAgent, chooseChain, startChain, isAsleep, isWalking, statusText, turnToward, type Agent } from '../state/agents';

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
    expect(world.grids).toHaveLength(5);
    for (const s of world.slots) {
      expect(Number.isFinite(s.stand[0]) && Number.isFinite(s.stand[1])).toBe(true);
    }
  });

  it('someone with everything they need still finds something to do, all over the house', () => {
    const { world, j, rng } = setup();
    const chosen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      j.needs = { energy: 95, food: 95, hygiene: 95, fun: 95, comfort: 95, social: 95 };
      j.lastChain = null;
      const c = chooseChain(world, j, null, 10 + (i % 10), () => rng.next());
      expect(c, 'never just stands there').not.toBeNull();
      chosen.add(c!);
    }
    // Plenty of variety, from the starter house alone.
    expect(chosen.size).toBeGreaterThanOrEqual(12);
  });

  it('everyday activities each have somewhere to happen in the starter house', () => {
    const { world, j, m, rng } = setup();
    for (const chain of ['newspaper', 'tend', 'rakeYard', 'yardWorkout', 'phonePace', 'window', 'snack', 'wipeCounter',
      'soloDance', 'journal', 'freelance', 'mirror', 'foldClothes', 'makeBed', 'meditate', 'laundry', 'rummage', 'lift', 'jumprope', 'shadowbox']) {
      j.task = null;
      expect(startChain(world, j, chain, m, () => rng.next()), chain).toBe(true);
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

  it('turns toward a direction by at most a step, the short way round', () => {
    const half = turnToward([1, 0], [0, 1], 0.5);
    expect(half.left).toBeCloseTo(Math.PI / 2 - 0.5, 5);
    expect(Math.atan2(half.face[1], half.face[0])).toBeCloseTo(0.5, 5);
    expect(turnToward([1, 0], [0, 1], 2)).toEqual({ face: [0, 1], left: 0 });
    // Past straight-behind, it goes the other way instead of the long way.
    const back = turnToward([1, 0], [Math.cos(-3), Math.sin(-3)], 0.5);
    expect(Math.atan2(back.face[1], back.face[0])).toBeCloseTo(-0.5, 5);
  });

  it('turns on the spot before walking off the other way, then goes', () => {
    const { world, j, m, rng } = setup();
    startChain(world, j, 'wander', m, () => rng.next());
    expect(j.task!.phase).toBe('walk');
    const next = j.task!.route.find((l) => l.type !== 'stair' && l.pts.length)!;
    const [tx, ty] = (next as { pts: [number, number][] }).pts[0];
    const d = Math.hypot(tx - j.x, ty - j.y) || 1;
    // Facing exactly away from where the route heads.
    j.face = [-(tx - j.x) / d, -(ty - j.y) / d];
    const [x0, y0] = [j.x, j.y];
    let turned = 0;
    for (let i = 0; i < 80 && j.task?.phase === 'walk'; i++) {
      tickAgent(world, j, m, 0.05, 0.15, 3, 12, () => rng.next());
      if (j.turning) {
        turned++;
        expect([j.x, j.y], 'stays put while turning').toEqual([x0, y0]);
        expect(isWalking(j), 'not marching in place').toBe(false);
      }
    }
    expect(turned, 'pivots first').toBeGreaterThan(0);
    expect(turned, 'but only briefly').toBeLessThan(12);
    expect(j.turning).toBe(false);
    expect(Math.hypot(j.x - x0, j.y - y0)).toBeGreaterThan(0.05);
  });

  it('does not stop to turn for a gentle bend', () => {
    const { world, j, m, rng } = setup();
    startChain(world, j, 'wander', m, () => rng.next());
    const next = j.task!.route.find((l) => l.type !== 'stair' && l.pts.length)!;
    const [tx, ty] = (next as { pts: [number, number][] }).pts[0];
    const a = Math.atan2(ty - j.y, tx - j.x) + 0.5;
    j.face = [Math.cos(a), Math.sin(a)];
    tickAgent(world, j, m, 0.05, 0.15, 3, 12, () => rng.next());
    expect(j.turning).toBe(false);
  });

  it('ignores corrupt saved needs', () => {
    const a = createAgent('maya', 'Maya', { food: Number.NaN, fun: 250 }, LOOK);
    expect(a.needs.food).toBe(70);
    expect(a.needs.fun).toBe(100);
  });
});

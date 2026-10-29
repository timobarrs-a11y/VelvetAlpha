/**
 * The boss (Dale) lives at his desk. He hardly ever leaves it: now and then, in office hours, he walks to the water cooler and back, a few
 * minutes at most. While he is at his desk (`world.bossIn`) the chair in front of it can be used; when he is not, nobody may sit in it.
 * Pure rules: the game loop calls this once a tick.
 */
import { startChain, startGoto, type Agent, type HouseWorld } from './agents';

/** Chance per game minute, in office hours, that he leaves his seat: about once every two working weeks. */
export const BOSS_LEAVES_PER_MIN = 0.00005;
/** Where he goes: next to the water cooler. */
export const BOSS_ERRAND: { level: number; x: number; y: number } = { level: 5, x: 6.35, y: 1.4 };

const returnAt = new WeakMap<Agent, number>();

/** Sends him to the cooler now, for `minutes` (a test, and a way for a scene to call him away). */
export function bossLeave(world: HouseWorld, dale: Agent, absMin: number, minutes = 8): void {
  returnAt.set(dale, absMin + minutes);
  startGoto(world, dale, BOSS_ERRAND);
}

export function bossTick(world: HouseWorld, dale: Agent, absMin: number, hourF: number, gameMin: number, rng: () => number): void {
  const sitting = dale.task?.act === 'bosswork' && dale.task.phase === 'do';
  world.bossIn = sitting;
  const back = returnAt.get(dale);
  if (dale.task) {
    if (sitting && back === undefined && hourF >= 9 && hourF < 17 && rng() < gameMin * BOSS_LEAVES_PER_MIN) {
      returnAt.set(dale, absMin + 5 + rng() * 6);
      startGoto(world, dale, BOSS_ERRAND);
    }
    return;
  }
  // Idle: still on his errand, or back to his desk.
  if (back !== undefined && absMin < back) return;
  returnAt.delete(dale);
  startChain(world, dale, 'bosswork', null, rng);
}

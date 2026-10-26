import { earn } from '../state/household';
import { SETTLE, settleComplete, type GoalContext } from '../state/goals';
import { showDiscoveryCard } from '../ui/dialogue';
import type { Game } from '../kernel/game';

export function createGoals(g: Game): Partial<Game> {
  const { world, townName, flags, log } = g;
  // Goals tick
  function goalsTick(): void {
    if (g.s.settleDone) {
      // Check life goal progress
      if (g.s.lifeGoal) {
        const goalCtx: GoalContext = {
          flags: flags as never,
          career: { level: 0, perf: 0 } as never,
          bond: g.s.bond,
          hasSofaOnLevel1: true, hasPackedBoxes: false,
          lawnLabel: 'Lush', lawnWeeds: 0,
        };
        const result = checkLifeGoalSimple(g.s.lifeGoal, goalCtx);
        if (result) {
          flags.lifeStep = (flags.lifeStep as number) + 1;
          earn(world.household, result.reward);
          log(`Life goal step complete: ${result.stepText} (+$${result.reward})`);
        }
      }
      return;
    }
    const goalCtx: GoalContext = {
      flags: flags as never,
      career: { level: 0, perf: 0 } as never,
      bond: g.s.bond,
      hasSofaOnLevel1: world.objs.some(o => o.type === 'sofa' && o.level === 1),
      hasPackedBoxes: world.objs.some(o => o.type === 'pbox'),
      lawnLabel: 'Lush', lawnWeeds: 0,
    };
    const seen = flags.settleSeen as string[];
    const next = SETTLE.find(g => !seen.includes(g.id));
    if (next && next.done(goalCtx)) {
      seen.push(next.id);
      g.s.bond = Math.min(100, g.s.bond + 2);
      log(`Goal complete: ${next.text}`);
      if (settleComplete(goalCtx)) {
        g.s.settleDone = true;
        g.shake(0.7);
        g.s.freeWill = true;
        earn(world.household, 100);
        showDiscoveryCard('Welcome home!', `${townName} gave you a $100 welcome basket. The tutorial is over — make it yours.`);
        log('Settled in! +$100 welcome bonus. Free will is on.');
      }
    }
  }

  function checkLifeGoalSimple(goalId: string, ctx: GoalContext): { stepText: string; reward: number } | null {
    const LIFE_GOALS: Record<string, { text: string; done: (ctx: GoalContext) => boolean; reward: number }[]> = {
      career: [
        { text: 'Get promoted', done: c => c.career.level >= 1, reward: 75 },
      ],
      romance: [
        { text: 'Dance with partner', done: c => c.flags.danced, reward: 40 },
        { text: 'Reach g.s.bond 80', done: c => c.bond >= 80, reward: 150 },
      ],
      homebody: [
        { text: 'Unpack everything', done: c => !c.hasPackedBoxes, reward: 50 },
        { text: 'Buy 5 furniture', done: c => c.flags.furniture >= 5, reward: 150 },
      ],
      green: [
        { text: 'Mow the lawn', done: c => c.flags.mowed, reward: 30 },
        { text: 'Harvest 5 times', done: c => c.flags.harvests >= 5, reward: 150 },
      ],
    };
    const path = LIFE_GOALS[goalId];
    if (!path) return null;
    const step = path[flags.lifeStep as number];
    if (!step || !step.done(ctx)) return null;
    return { stepText: step.text, reward: step.reward };
  }
  return { goalsTick };
}

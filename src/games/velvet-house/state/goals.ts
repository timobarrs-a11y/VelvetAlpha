import type { CareerState } from './career';

export interface GameFlags {
  arranged: boolean;
  stocked: boolean;
  styled: boolean;
  talked: boolean;
  danced: boolean;
  watched: boolean;
  dinners: number;
  harvests: number;
  mowed: boolean;
  tvVideo: boolean;
  furniture: number;
  spotless: number;
  styledSet: string[];
  settleSeen: string[];
  lifeStep: number;
}

export interface GoalContext {
  flags: GameFlags;
  career: CareerState;
  bond: number;
  hasSofaOnLevel1: boolean;
  hasPackedBoxes: boolean;
  lawnLabel: string;
  lawnWeeds: number;
}

export interface SettleGoal {
  id: string;
  text: string;
  say: string;
  done: (ctx: GoalContext) => boolean;
}

export const SETTLE: SettleGoal[] = [
  { id: 'couch', text: 'Unpack the couch', say: "Can you help me get the couch out of its box first? My back says no.", done: ctx => ctx.hasSofaOnLevel1 },
  { id: 'arrange', text: 'Put something exactly where you want it (Arrange)', say: 'Move stuff around until it feels like us. Nothing has to stay where the movers dropped it.', done: ctx => ctx.flags.arranged },
  { id: 'food', text: 'Stock the fridge', say: 'We have, like, four meals. Grocery run?', done: ctx => ctx.flags.stocked },
  { id: 'room', text: 'Make one room yours (paint, wallpaper or floor)', say: "These primer walls are depressing. Let's make at least one room ours.", done: ctx => ctx.flags.styled },
  { id: 'talk', text: 'Talk to Maya', say: 'Come talk to me. I am a little stressed and a lot excited.', done: ctx => ctx.flags.talked },
  { id: 'unpack', text: 'Unpack every box', say: "Whatever you don't unpack, I'm putting where I want it. Fair warning.", done: ctx => !ctx.hasPackedBoxes },
];

export interface LifeStep {
  text: string;
  done: (ctx: GoalContext) => boolean;
  reward: number;
}

export interface LifePath {
  name: string;
  steps: LifeStep[];
}

export const LIFE: Record<string, LifePath> = {
  career: {
    name: 'Career climber',
    steps: [
      { text: 'Get promoted to Senior Associate (go to work rested and fed)', done: ctx => ctx.career.level >= 1, reward: 75 },
      { text: 'Make Team Lead', done: ctx => ctx.career.level >= 2, reward: 120 },
      { text: 'Make Manager', done: ctx => ctx.career.level >= 3, reward: 200 },
      { text: 'Make Director', done: ctx => ctx.career.level >= 4, reward: 400 },
    ],
  },
  romance: {
    name: 'Hopeless romantic',
    steps: [
      { text: 'Dance with Maya', done: ctx => ctx.flags.danced, reward: 40 },
      { text: 'Watch something together', done: ctx => ctx.flags.watched, reward: 50 },
      { text: 'Cook dinner for two, three times', done: ctx => ctx.flags.dinners >= 3, reward: 80 },
      { text: 'Reach "In love"', done: ctx => ctx.bond >= 80, reward: 150 },
    ],
  },
  homebody: {
    name: 'Homebody',
    steps: [
      { text: 'Unpack every box', done: ctx => !ctx.hasPackedBoxes, reward: 50 },
      { text: 'Make three spaces yours (paint, wallpaper or floors)', done: ctx => ctx.flags.styledSet.length >= 3, reward: 80 },
      { text: 'End a day with the house spotless', done: ctx => ctx.flags.spotless >= 1, reward: 80 },
      { text: 'Buy five pieces of furniture', done: ctx => ctx.flags.furniture >= 5, reward: 150 },
    ],
  },
  green: {
    name: 'Green thumb',
    steps: [
      { text: 'Mow the lawn', done: ctx => ctx.flags.mowed, reward: 30 },
      { text: 'Harvest the garden', done: ctx => ctx.flags.harvests >= 1, reward: 60 },
      { text: 'Get the lawn lush with no weeds', done: ctx => ctx.lawnLabel === 'Lush' && ctx.lawnWeeds === 0, reward: 80 },
      { text: 'Harvest five times', done: ctx => ctx.flags.harvests >= 5, reward: 150 },
    ],
  },
};

export function nextSettleGoal(ctx: GoalContext): SettleGoal | null {
  return SETTLE.find(g => !ctx.flags.settleSeen.includes(g.id)) || null;
}

export function settleComplete(ctx: GoalContext): boolean {
  return SETTLE.filter(g => g.id !== 'unpack').every(g => ctx.flags.settleSeen.includes(g.id));
}

export interface LifeGoalResult {
  completed: boolean;
  reward: number;
  stepText: string;
  pathName: string;
  finished: boolean;
}

export function checkLifeGoal(goalId: string, ctx: GoalContext): LifeGoalResult | null {
  const path = LIFE[goalId];
  if (!path) return null;
  const step = path.steps[ctx.flags.lifeStep];
  if (!step || !step.done(ctx)) return null;
  const newStep = ctx.flags.lifeStep + 1;
  return {
    completed: true,
    reward: step.reward,
    stepText: step.text,
    pathName: path.name,
    finished: newStep >= path.steps.length,
  };
}

export function lifeGoalProgress(goalId: string, step: number): { current: number; total: number } {
  const path = LIFE[goalId];
  if (!path) return { current: 0, total: 0 };
  return { current: Math.min(step, path.steps.length), total: path.steps.length };
}

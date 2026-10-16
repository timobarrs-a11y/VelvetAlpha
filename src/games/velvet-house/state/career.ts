export interface CareerState {
  level: number;
  perf: number;
}

export interface CareerLevel {
  t: string;
  w: number;
}

export const CAREER: CareerLevel[] = [
  { t: 'Associate', w: 20 },
  { t: 'Senior Associate', w: 24 },
  { t: 'Team Lead', w: 29 },
  { t: 'Manager', w: 35 },
  { t: 'Director', w: 44 },
];

export type LifeGoal = 'career' | 'romance' | 'homebody' | 'green' | null;

export function promoNeed(level: number): number {
  return 3 + level * 2;
}

export function promoProgress(state: CareerState): number {
  return Math.min(99, Math.round(state.perf / promoNeed(state.level) * 100));
}

export interface WorkReviewInput {
  workNeeds: number;
  sentHome: boolean;
  lifeGoal: LifeGoal;
}

export interface WorkReviewResult {
  gain: number;
  promoted: boolean;
  newLevel: number;
  newPerf: number;
  newWage: number;
  newTitle: string;
  bossNoticed: boolean;
}

export function workReview(state: CareerState, input: WorkReviewInput): WorkReviewResult {
  const n = input.workNeeds || 50;
  const baseGain = input.sentHome ? -1 : n > 55 ? 1 : n > 35 ? 0.4 : -0.5;
  const gain = baseGain * (input.lifeGoal === 'career' ? 1.3 : 1);

  const newPerf = Math.max(0, state.perf + gain);
  const canPromote = state.level < CAREER.length - 1 && newPerf >= promoNeed(state.level);

  return {
    gain,
    promoted: canPromote,
    newLevel: canPromote ? state.level + 1 : state.level,
    newPerf: canPromote ? 0 : newPerf,
    newWage: canPromote ? CAREER[state.level + 1].w : CAREER[state.level].w,
    newTitle: canPromote ? CAREER[state.level + 1].t : CAREER[state.level].t,
    bossNoticed: gain < 0,
  };
}

export function applyWorkReview(state: CareerState, result: WorkReviewResult): void {
  state.level = result.newLevel;
  state.perf = result.newPerf;
}

export function careerTitle(state: CareerState): string {
  return CAREER[state.level].t;
}

export function careerWage(state: CareerState): number {
  return CAREER[state.level].w;
}

export function isTopLevel(state: CareerState): boolean {
  return state.level >= CAREER.length - 1;
}

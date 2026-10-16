export interface MayaCareerState {
  level: number;
  perf: number;
  studio: boolean;
  offerDay: number | null;
  offer: boolean;
}

export interface MayaCareerLevel {
  t: string;
  w: number;
}

export const MCAREER: MayaCareerLevel[] = [
  { t: 'Junior Designer', w: 18 },
  { t: 'Designer', w: 22 },
  { t: 'Senior Designer', w: 27 },
  { t: 'Art Director', w: 33 },
];

export const STUDIO_STARTUP_COST = 1500;

export function promoNeedMaya(level: number): number {
  return 3 + level * 2;
}

export interface MayaWorkReviewInput {
  workNeeds: number;
  sentHome: boolean;
  studio: boolean;
}

export interface MayaWorkReviewResult {
  gain: number;
  promoted: boolean;
  newLevel: number;
  newPerf: number;
  newWage: number;
  newTitle: string;
  stressed: boolean;
}

export function mayaReview(state: MayaCareerState, input: MayaWorkReviewInput): MayaWorkReviewResult | null {
  if (input.studio) return null;
  const n = input.workNeeds || 50;
  const baseGain = input.sentHome ? -1 : n > 55 ? 1 : n > 35 ? 0.4 : -0.5;
  const gain = baseGain;

  const newPerf = Math.max(0, state.perf + gain);
  const canPromote = state.level < MCAREER.length - 1 && newPerf >= promoNeedMaya(state.level);

  return {
    gain,
    promoted: canPromote,
    newLevel: canPromote ? state.level + 1 : state.level,
    newPerf: canPromote ? 0 : newPerf,
    newWage: canPromote ? MCAREER[state.level + 1].w : MCAREER[state.level].w,
    newTitle: canPromote ? MCAREER[state.level + 1].t : MCAREER[state.level].t,
    stressed: gain < 0,
  };
}

export interface StudioCheckInput {
  storyKnown: boolean;
  bond: number;
  canTalk: boolean;
  day: number;
}

export function shouldOfferStudio(state: MayaCareerState, input: StudioCheckInput): boolean {
  if (state.studio || state.offer) return false;
  if (state.level < MCAREER.length - 1) return false;
  if (!input.storyKnown) return false;
  if (input.bond < 75) return false;
  if (!input.canTalk) return false;
  if (state.offerDay !== null && input.day - state.offerDay < 7) return false;
  return true;
}

export function acceptStudio(state: MayaCareerState, _day: number): void {
  state.studio = true;
  state.offer = false;
  state.offerDay = null;
}

export function declineStudio(state: MayaCareerState, day: number): void {
  state.offer = false;
  state.offerDay = day;
}

export function mayaCareerTitle(state: MayaCareerState): string {
  if (state.studio) return 'Studio owner';
  return MCAREER[state.level].t;
}

export function mayaCareerWage(state: MayaCareerState): number {
  if (state.studio) return 0;
  return MCAREER[state.level].w;
}

export function isTopMayaLevel(state: MayaCareerState): boolean {
  return state.level >= MCAREER.length - 1;
}

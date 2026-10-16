import { describe, it, expect } from 'vitest';
import {
  MCAREER, promoNeedMaya, mayaReview, shouldOfferStudio,
  acceptStudio, declineStudio, mayaCareerTitle, mayaCareerWage, isTopMayaLevel,
} from '../state/mayaCareer';
import type { MayaCareerState, MayaWorkReviewInput, StudioCheckInput } from '../state/mayaCareer';

function state(over: Partial<MayaCareerState> = {}): MayaCareerState {
  return { level: 0, perf: 0, studio: false, offerDay: null, offer: false, ...over };
}

function input(workNeeds: number, opts: Partial<MayaWorkReviewInput> = {}): MayaWorkReviewInput {
  return { workNeeds, sentHome: false, studio: false, ...opts };
}

function studioInput(opts: Partial<StudioCheckInput> = {}): StudioCheckInput {
  return { storyKnown: true, bond: 80, canTalk: true, day: 20, ...opts };
}

describe('mayaCareer — MCAREER ladder', () => {
  it('has 4 levels', () => {
    expect(MCAREER.length).toBe(4);
  });

  it('starts at Junior Designer $18/hr', () => {
    expect(MCAREER[0].t).toBe('Junior Designer');
    expect(MCAREER[0].w).toBe(18);
  });

  it('tops at Art Director $33/hr', () => {
    expect(MCAREER[3].t).toBe('Art Director');
    expect(MCAREER[3].w).toBe(33);
  });
});

describe('mayaCareer — promoNeedMaya', () => {
  it('scales with level', () => {
    expect(promoNeedMaya(0)).toBe(3);
    expect(promoNeedMaya(1)).toBe(5);
    expect(promoNeedMaya(2)).toBe(7);
    expect(promoNeedMaya(3)).toBe(9);
  });
});

describe('mayaCareer — mayaReview', () => {
  it('returns null when studio is active', () => {
    expect(mayaReview(state(), input(60, { studio: true }))).toBeNull();
  });

  it('gives positive gain when well-rested', () => {
    const r = mayaReview(state(0, 0), input(60));
    expect(r).not.toBeNull();
    expect(r!.gain).toBe(1);
    expect(r!.stressed).toBe(false);
  });

  it('gives 0.4 gain when adequate', () => {
    const r = mayaReview(state(0, 0), input(40));
    expect(r!.gain).toBe(0.4);
  });

  it('gives -0.5 when exhausted', () => {
    const r = mayaReview(state(0, 0), input(20));
    expect(r!.gain).toBe(-0.5);
    expect(r!.stressed).toBe(true);
  });

  it('gives -1 when sent home', () => {
    const r = mayaReview(state(0, 0), input(80, { sentHome: true }));
    expect(r!.gain).toBe(-1);
    expect(r!.stressed).toBe(true);
  });

  it('promotes when perf reaches threshold', () => {
    const r = mayaReview(state({ level: 0, perf: 2.5 }), input(60));
    expect(r!.promoted).toBe(true);
    expect(r!.newLevel).toBe(1);
    expect(r!.newPerf).toBe(0);
    expect(r!.newTitle).toBe('Designer');
    expect(r!.newWage).toBe(22);
  });

  it('does not promote above top level', () => {
    const r = mayaReview(state({ level: 3, perf: 100 }), input(60));
    expect(r!.promoted).toBe(false);
    expect(r!.newLevel).toBe(3);
  });
});

describe('mayaCareer — shouldOfferStudio', () => {
  it('returns true when all conditions met', () => {
    expect(shouldOfferStudio(state({ level: 3 }), studioInput())).toBe(true);
  });

  it('returns false when already in studio', () => {
    expect(shouldOfferStudio(state({ level: 3, studio: true }), studioInput())).toBe(false);
  });

  it('returns false when offer already made', () => {
    expect(shouldOfferStudio(state({ level: 3, offer: true }), studioInput())).toBe(false);
  });

  it('returns false when level too low', () => {
    expect(shouldOfferStudio(state({ level: 2 }), studioInput())).toBe(false);
  });

  it('returns false when story not known', () => {
    expect(shouldOfferStudio(state({ level: 3 }), studioInput({ storyKnown: false }))).toBe(false);
  });

  it('returns false when bond < 75', () => {
    expect(shouldOfferStudio(state({ level: 3 }), studioInput({ bond: 70 }))).toBe(false);
  });

  it('returns false when cannot talk', () => {
    expect(shouldOfferStudio(state({ level: 3 }), studioInput({ canTalk: false }))).toBe(false);
  });

  it('returns false when offered within last 7 days', () => {
    expect(shouldOfferStudio(state({ level: 3, offerDay: 18 }), studioInput({ day: 20 }))).toBe(false);
  });

  it('returns true when offer cooldown passed', () => {
    expect(shouldOfferStudio(state({ level: 3, offerDay: 10 }), studioInput({ day: 20 }))).toBe(true);
  });
});

describe('mayaCareer — accept/decline studio', () => {
  it('acceptStudio sets studio true and clears offer', () => {
    const s = state({ level: 3, offer: true, offerDay: 20 });
    acceptStudio(s, 22);
    expect(s.studio).toBe(true);
    expect(s.offer).toBe(false);
    expect(s.offerDay).toBeNull();
  });

  it('declineStudio clears offer and sets offerDay', () => {
    const s = state({ level: 3, offer: true });
    declineStudio(s, 22);
    expect(s.offer).toBe(false);
    expect(s.offerDay).toBe(22);
    expect(s.studio).toBe(false);
  });
});

describe('mayaCareer — helpers', () => {
  it('mayaCareerTitle returns current title', () => {
    expect(mayaCareerTitle(state({ level: 0 }))).toBe('Junior Designer');
    expect(mayaCareerTitle(state({ level: 2 }))).toBe('Senior Designer');
  });

  it('mayaCareerTitle returns Studio owner when studio active', () => {
    expect(mayaCareerTitle(state({ level: 3, studio: true }))).toBe('Studio owner');
  });

  it('mayaCareerWage returns 0 when studio active', () => {
    expect(mayaCareerWage(state({ level: 3, studio: true }))).toBe(0);
  });

  it('mayaCareerWage returns wage otherwise', () => {
    expect(mayaCareerWage(state({ level: 1 }))).toBe(22);
  });

  it('isTopMayaLevel true at level 3', () => {
    expect(isTopMayaLevel(state({ level: 2 }))).toBe(false);
    expect(isTopMayaLevel(state({ level: 3 }))).toBe(true);
  });
});

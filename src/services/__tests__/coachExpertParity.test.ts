import { describe, it, expect } from 'vitest';
import { SIGNATURE_EXPERTS } from '../../config/signatureExperts';
import { CURATED_EXPERT_MAP, buildCoachBehavioralInstructions as buildEdgeCoach } from '../../../supabase/functions/_shared/coachFramework';
import { buildCoachBehavioralInstructions as buildClientCoach } from '../../config/coachFramework';

// Guards against drift between the client's canonical curated-expert catalog
// (src/config/signatureExperts.ts) and the edge function's mirror
// (supabase/functions/_shared/coachFramework.ts). If these diverge, coaches
// silently lose their domain layer on the live chat path — this test makes that
// a build failure instead of a silent regression.
describe('curated expert catalog parity (client <-> edge)', () => {
  const clientIds = SIGNATURE_EXPERTS.map(e => e.id).sort();
  const edgeIds = Object.keys(CURATED_EXPERT_MAP).sort();

  it('every curated client expert exists in the edge map (and vice versa)', () => {
    expect(edgeIds).toEqual(clientIds);
  });

  it('domain, check-in style, and accountability level match for every expert', () => {
    const mismatches: string[] = [];
    for (const expert of SIGNATURE_EXPERTS) {
      const edge = CURATED_EXPERT_MAP[expert.id];
      if (!edge) continue; // covered by the id test above
      if (edge.domain !== expert.domain) {
        mismatches.push(`${expert.id}: domain "${edge.domain}" !== "${expert.domain}"`);
      }
      if (edge.checkInStyle !== expert.checkInStyle) {
        mismatches.push(`${expert.id}: checkInStyle "${edge.checkInStyle}" !== "${expert.checkInStyle}"`);
      }
      if (edge.accountabilityLevel !== expert.accountabilityLevel) {
        mismatches.push(`${expert.id}: accountabilityLevel "${edge.accountabilityLevel}" !== "${expert.accountabilityLevel}"`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('every curated coach says what it teaches', () => {
    const missing = Object.entries(CURATED_EXPERT_MAP).filter(([, e]) => !e.teaches || e.teaches.length < 80).map(([id]) => id);
    expect(missing).toEqual([]);
  });
});

describe('every coach teaches', () => {
  it('both copies of the framework carry the same teaching loop', () => {
    const input = { coachName: 'Sofia', userName: 'Alex', domain: 'Spanish' };
    const edge = buildEdgeCoach(input);
    const client = buildClientCoach(input);
    for (const step of ['FIND THEIR LEVEL', 'LAY OUT A CURRICULUM', 'TEACH IN SMALL LESSONS', 'FEEDBACK ON THEIR ATTEMPT', 'SET PRACTICE', "REVIEW WHAT'S FADING", 'CHECK UNDERSTANDING BY DOING']) {
      expect(edge).toContain(step);
      expect(client).toContain(step);
    }
    const loop = (s: string) => s.slice(s.indexOf('THE TEACHING LOOP'), s.indexOf('RESTATE THE PURPOSE'));
    expect(loop(client)).toEqual(loop(edge));
  });
});


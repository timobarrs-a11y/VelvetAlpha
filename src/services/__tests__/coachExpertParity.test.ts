import { describe, it, expect } from 'vitest';
import { SIGNATURE_EXPERTS } from '../../config/signatureExperts';
import { CURATED_EXPERT_MAP } from '../../../supabase/functions/_shared/coachFramework';

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
});

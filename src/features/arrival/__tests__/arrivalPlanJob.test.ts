import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearPlanJob, loadPlanJob, resumePlanJob, startPlanJob, type JobDeps, type TranscriptLine } from '../arrivalPlanJob';

const transcript: TranscriptLine[] = [{ role: 'user', content: 'Run a marathon by June' }];
const rec = { helperName: 'Sofia', helperGender: 'female', kind: 'coach', expertDomain: 'fitness', expertId: 'fitness_hype', isCustomExpert: false, accountabilityLevel: 'moderate', goalText: 'Run a marathon', recommendationText: 'I know just the person. Sofia will teach you, one lesson at a time. Sofia is patient.' };

function deps(overrides: Partial<Record<string, () => unknown>> = {}) {
  const call = vi.fn(async (body: Record<string, unknown>) => {
    const fn = overrides[body.phase as string];
    if (fn) return fn();
    if (body.phase === 'confirm') return { recommendation: rec };
    if (body.phase === 'provisioning') return { helperId: 'h1', goalId: 'g1', goalText: 'Run a marathon' };
    return { plan: { goal: { title: 'x' } }, summary: { finishDate: '2027-06-01', runTime: '8 months' } };
  });
  const d: JobDeps = { call, sanitizeAvatar: async c => c };
  return { d, call };
}

beforeEach(() => { localStorage.clear(); clearPlanJob('u'); });

describe('plan job', () => {
  it('confirms, creates the helper, then drafts the plan, using the ready-made coach', async () => {
    const { d, call } = deps();
    const job = await startPlanJob('u', transcript, d);
    expect(job.status).toBe('ready');
    expect(call.mock.calls.map(c => c[0].phase)).toEqual(['confirm', 'provisioning', 'plan']);
    expect(job.recommendation?.helperName).toBe('Marcus');
    // the introduction names the coach they will actually meet, not the name the server first picked
    expect(job.recommendation?.recommendationText).toBe('I know just the person. Marcus will teach you, one lesson at a time. Marcus is patient.');
    expect(call.mock.calls[1][0].helperName).toBe('Marcus');
    expect(job.plan).toBeTruthy();
    expect(loadPlanJob('u')?.status).toBe('ready');
  });

  it('shares the work when started twice', async () => {
    const { d, call } = deps();
    await Promise.all([startPlanJob('u', transcript, d), startPlanJob('u', transcript, d)]);
    expect(call.mock.calls.filter(c => c[0].phase === 'confirm')).toHaveLength(1);
  });

  it('after a failed plan, resumes without creating the helper again', async () => {
    const first = deps({ plan: () => { throw new Error('boom'); } });
    expect((await startPlanJob('u', transcript, first.d)).status).toBe('failed');
    const second = deps();
    const job = await resumePlanJob('u', second.d)!;
    expect(job.status).toBe('ready');
    expect(second.call.mock.calls.map(c => c[0].phase)).toEqual(['plan']);
  });

  it('has nothing to resume when no goal was locked', () => {
    expect(resumePlanJob('u', deps().d)).toBeNull();
  });
});

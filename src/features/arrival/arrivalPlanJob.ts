import type { ArrivalPlan } from '../../../supabase/functions/_shared/atlasArrival';
import type { AvatarConfigV2, Gender } from '../../types/avatar-v2';
import type { PlanSummary } from './PlanWalkthrough';
import { helperPresetFor } from './coachPresets';

export interface Recommendation {
  helperName: string;
  helperGender: Gender;
  kind: 'coach' | 'assistant';
  expertDomain: string;
  expertId: string | null;
  isCustomExpert: boolean;
  accountabilityLevel: string;
  goalText: string;
  recommendationText: string;
}

export interface Provisioned {
  helperId: string;
  goalId: string;
  goalText: string;
}

export interface TranscriptLine { role: 'atlas' | 'user'; content: string }

/**
 * The plan Atlas works on while they make their avatar and pick their house. It runs in the
 * background from the moment the goal is locked: who carries it (a ready-made coach or assistant),
 * the goal itself, and the drafted plan. Progress is kept per account so leaving and coming back
 * (or a refresh) picks up where it stopped, and nothing is created twice.
 */
export interface PlanJob {
  status: 'running' | 'ready' | 'failed';
  transcript: TranscriptLine[];
  recommendation?: Recommendation;
  helperAvatar?: AvatarConfigV2;
  provisioned?: Provisioned;
  plan?: ArrivalPlan;
  summary?: PlanSummary;
  /** Atlas's own words handing them to the coach or assistant, written about their goal and plan. */
  handoff?: string | null;
  startedAt: number;
}

export interface JobDeps {
  call: (body: Record<string, unknown>) => Promise<any>;
  /** The server's final say on what the look may wear. */
  sanitizeAvatar: (config: AvatarConfigV2) => Promise<AvatarConfigV2>;
}

const KEY = (userId: string) => `velvet.arrival.job:${userId}`;
const running = new Map<string, Promise<PlanJob>>();

export function loadPlanJob(userId: string): PlanJob | null {
  try {
    const raw = localStorage.getItem(KEY(userId));
    return raw ? (JSON.parse(raw) as PlanJob) : null;
  } catch {
    return null;
  }
}

function save(userId: string, job: PlanJob) {
  try { localStorage.setItem(KEY(userId), JSON.stringify(job)); } catch { /* storage full or blocked */ }
}

export function clearPlanJob(userId: string) {
  running.delete(userId);
  try { localStorage.removeItem(KEY(userId)); } catch { /* storage blocked */ }
}

async function run(userId: string, start: PlanJob, deps: JobDeps): Promise<PlanJob> {
  const job: PlanJob = { ...start, status: 'running' };
  const transcript = job.transcript;
  try {
    if (!job.recommendation || !job.helperAvatar) {
      const data = await deps.call({ phase: 'confirm', transcript });
      const rec = data.recommendation as Recommendation;
      const preset = helperPresetFor(rec);
      // The server picked a name for them and wrote its introduction with it; the ready-made coach has
      // their own name, so the introduction must say that one.
      const intro = rec.helperName ? (rec.recommendationText ?? '').split(rec.helperName).join(preset.name) : rec.recommendationText;
      job.recommendation = { ...rec, helperName: preset.name, helperGender: preset.gender, recommendationText: intro };
      job.helperAvatar = preset.avatar;
      save(userId, job);
    }
    if (!job.provisioned) {
      const avatarConfig = await deps.sanitizeAvatar(job.helperAvatar);
      const data = await deps.call({
        phase: 'provisioning',
        transcript,
        recommendation: job.recommendation,
        helperName: job.recommendation.helperName,
        avatarConfig,
      });
      job.provisioned = { helperId: data.helperId as string, goalId: data.goalId as string, goalText: data.goalText as string };
      save(userId, job);
    }
    if (!job.plan) {
      const data = await deps.call({
        phase: 'plan',
        transcript,
        goalText: job.provisioned.goalText,
        helper: { name: job.recommendation.helperName, kind: job.recommendation.kind, domain: job.recommendation.expertDomain, gender: job.recommendation.helperGender },
      });
      job.plan = data.plan as ArrivalPlan;
      job.summary = data.summary as PlanSummary;
      job.handoff = typeof data.handoff === 'string' && data.handoff.trim() ? data.handoff.trim() : null;
    }
    job.status = 'ready';
  } catch (err) {
    console.error('[arrival] plan job stopped:', err);
    job.status = 'failed';
  }
  save(userId, job);
  return job;
}

/** Starts the plan in the background. Calling it again while it runs returns the same work. */
export function startPlanJob(userId: string, transcript: TranscriptLine[], deps: JobDeps): Promise<PlanJob> {
  const existing = running.get(userId);
  if (existing) return existing;
  const saved = loadPlanJob(userId);
  const start: PlanJob = saved && saved.status !== 'ready' && saved.transcript.length > 0
    ? { ...saved, transcript: saved.transcript, startedAt: Date.now() }
    : { status: 'running', transcript, startedAt: Date.now() };
  const promise = run(userId, saved?.status === 'ready' ? saved : start, deps).finally(() => running.delete(userId));
  running.set(userId, promise);
  return promise;
}

/**
 * The plan when they come back from the avatar and house steps: ready now, or waited for, or
 * (after a refresh or a failure) picked up again from where it stopped. Null when
 * the goal was never locked, so there is no plan to wait for.
 */
export function resumePlanJob(userId: string, deps: JobDeps): Promise<PlanJob> | null {
  const live = running.get(userId);
  if (live) return live;
  const saved = loadPlanJob(userId);
  if (!saved) return null;
  if (saved.status === 'ready') return Promise.resolve(saved);
  return startPlanJob(userId, saved.transcript, deps);
}

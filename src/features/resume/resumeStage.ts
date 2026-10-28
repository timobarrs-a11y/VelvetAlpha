/**
 * Where someone stopped, worked out from their goal, plan and commitments, and where that sends them back to. Pure,
 * so the rules are in one place (the gate in ResumeGate.tsx reads the data and acts on the answer):
 *
 *   never reached a goal             → their Atlas conversation
 *   a goal, but no plan              → Atlas picks up, then hands off to the coach to build it
 *   a plan never accepted            → the coach's Plan tab, with the walkthrough
 *   commitments all done or overdue  → the coach chat, to set the next ones
 *   goal + active plan + open one    → nowhere: the app as usual
 */
export type ResumeStage = 'no_goal' | 'goal_no_plan' | 'plan_unaccepted' | 'commitments_due';

export interface ResumeFacts {
  goal: { id: string; title: string; coachId: string | null } | null;
  plans: Array<{ status: string; goal_id: string | null; companion_id: string | null }>;
  commitments: Array<{ status: string; due_date: string | null; goal_id: string | null; companion_id: string | null }>;
}

export interface ResumePoint {
  stage: ResumeStage;
  goalId: string | null;
  coachId: string | null;
}

export function resumePoint(f: ResumeFacts, now: Date = new Date()): ResumePoint | null {
  if (!f.goal) return { stage: 'no_goal', goalId: null, coachId: null };
  const { id: goalId, coachId } = f.goal;
  const mine = <T extends { goal_id: string | null; companion_id: string | null }>(r: T) =>
    r.goal_id === goalId || (!!coachId && r.companion_id === coachId);
  const plans = f.plans.filter(mine).filter((p) => ['proposed', 'active', 'paused'].includes(p.status));
  if (!plans.length) return { stage: 'goal_no_plan', goalId, coachId };
  // The plan stages need the coach whose chat they happen in.
  if (!coachId) return null;
  if (!plans.some((p) => p.status === 'active' || p.status === 'paused')) return { stage: 'plan_unaccepted', goalId, coachId };
  const open = f.commitments.filter(mine).some((c) =>
    (c.status === 'pending' || c.status === 'in_progress') && (!c.due_date || new Date(c.due_date).getTime() >= now.getTime()));
  return open ? null : { stage: 'commitments_due', goalId, coachId };
}

/** Where a resume point takes them. */
export function resumeRoute(p: ResumePoint, atlasConversationId: string | null): string {
  if (p.stage === 'no_goal' || p.stage === 'goal_no_plan') return atlasConversationId ? `/atlas?c=${atlasConversationId}` : '/atlas';
  if (p.stage === 'plan_unaccepted') return `/chat?companion=${p.coachId}&tab=plan&walkthrough=1`;
  return `/chat?companion=${p.coachId}`;
}

/** Whether the page they are on is already where the resume point would take them (then nothing moves). */
export function alreadyThere(p: ResumePoint, pathname: string, search: string): boolean {
  const q = new URLSearchParams(search);
  if (p.stage === 'no_goal' || p.stage === 'goal_no_plan') return pathname === '/atlas' || pathname === '/atlas-onboarding';
  return pathname === '/chat' && q.get('companion') === p.coachId;
}

/** Someone coming back to the app after this long away is picked up again. */
export const AWAY_MS = 30 * 60 * 1000;

/** "Not now"s used today, per person, in this browser: { day, used }. */
export function snoozesLeft(stored: { day: string; used: number } | null, allowed: number, today: string): number {
  const used = stored && stored.day === today ? stored.used : 0;
  return Math.max(0, allowed - used);
}

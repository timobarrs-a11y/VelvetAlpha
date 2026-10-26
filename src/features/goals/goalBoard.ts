import type { CoachingCommitment, CoachingGoal, CoachPlan } from '../../services/coachingService';

// The goal board's numbers: how far along the timeline they are, what's due
// this week, and progress toward the target. Design: docs/goals-and-coaches/plan.md.

/** "2026-10-26" (or a full timestamp) as a local date. */
function asDate(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
}

const DAY = 86_400_000;

/** The finish line: the goal's target date, else the last scheduled step. */
export function finishDate(goal: Pick<CoachingGoal, 'target_date'>, plans: CoachPlan[]): string | null {
  if (goal.target_date) return goal.target_date;
  const days = plans.flatMap(p => p.steps ?? []).map(s => s.scheduled_for).filter((d): d is string => !!d).sort();
  return days[days.length - 1] ?? null;
}

export interface Timeline {
  /** 0 to 100: how much of the time between start and finish has passed. */
  pct: number;
  daysLeft: number;
  runTime: string;
}

/** Where today falls between the start and the finish. */
export function timeline(start: string, finish: string, now = new Date()): Timeline {
  const s = asDate(start).getTime();
  const f = asDate(finish).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const total = Math.max(DAY, f - s);
  const pct = Math.min(100, Math.max(0, Math.round(((today - s) / total) * 100)));
  const days = Math.round(total / DAY);
  const runTime = days < 14 ? `${days} days` : days < 70 ? `${Math.round(days / 7)} weeks` : days < 700 ? `${Math.round(days / 30.4)} months` : `${Math.round(days / 365)} years`;
  return { pct, daysLeft: Math.round((f - today) / DAY), runTime };
}

/** Open commitments due in the next seven days, overdue ones first. */
export function thisWeek(commitments: CoachingCommitment[], now = new Date()): CoachingCommitment[] {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59).getTime();
  return commitments
    .filter(c => (c.status === 'pending' || c.status === 'in_progress' || c.status === 'missed') && c.due_date && new Date(c.due_date).getTime() <= end)
    .sort((a, b) => new Date(a.due_date as string).getTime() - new Date(b.due_date as string).getTime());
}

/** Progress toward the target, when the goal has a number to reach. */
export function targetProgress(goal: Pick<CoachingGoal, 'current_value' | 'target_value' | 'unit'>): { label: string; pct: number } | null {
  if (!goal.target_value) return null;
  const current = goal.current_value ?? 0;
  const money = goal.unit === '$';
  const fmt = (n: number) => (money ? `$${n.toLocaleString()}` : `${n.toLocaleString()}${goal.unit ? ` ${goal.unit}` : ''}`);
  return {
    label: `${fmt(current)} of ${fmt(goal.target_value)}`,
    pct: Math.min(100, Math.max(0, Math.round((current / goal.target_value) * 100))),
  };
}

/** Steps grouped by phase, in plan order. Steps without a phase share one group. */
export function phasesOf(steps: NonNullable<CoachPlan['steps']>): Array<{ phase: string | null; steps: NonNullable<CoachPlan['steps']> }> {
  const groups: Array<{ phase: string | null; steps: NonNullable<CoachPlan['steps']> }> = [];
  for (const step of steps) {
    const phase = step.phase ?? null;
    const last = groups[groups.length - 1];
    if (last && last.phase === phase) last.steps.push(step);
    else groups.push({ phase, steps: [step] });
  }
  return groups;
}

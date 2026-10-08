import { supabase } from '../shared/supabase/client';

export type CommitmentStatus = 'pending' | 'completed' | 'missed' | 'renegotiated';
export type GoalStatus = 'active' | 'completed' | 'paused' | 'abandoned';

export interface CoachingCommitment {
  id: string;
  companion_id: string;
  goal_id: string | null;
  description: string;
  due_date: string | null;
  status: CommitmentStatus;
  completed_at: string | null;
  created_at: string;
  companion_name?: string;
}

export interface CoachingGoal {
  id: string;
  title: string;
  goal_type: string;
  target_value: number | null;
  current_value: number | null;
  unit: string | null;
  start_date: string;
  target_date: string | null;
  status: GoalStatus;
  notes: string | null;
  created_at: string;
}

export interface WeeklyStats {
  kept: number;
  missed: number;
  pending: number;
  streak: number;
}

export async function getCommitments(userId: string): Promise<CoachingCommitment[]> {
  const { data, error } = await supabase
    .from('coaching_commitments')
    .select(`
      id,
      companion_id,
      goal_id,
      description,
      due_date,
      status,
      completed_at,
      created_at
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[coachingService] getCommitments error:', error);
    return [];
  }

  const commitments = (data ?? []) as CoachingCommitment[];

  if (commitments.length === 0) return commitments;

  const companionIds = [...new Set(commitments.map(c => c.companion_id))];
  const { data: companions } = await supabase
    .from('companions')
    .select('id, custom_name')
    .in('id', companionIds);

  const nameMap = new Map((companions ?? []).map(c => [c.id, c.custom_name]));
  return commitments.map(c => ({
    ...c,
    companion_name: nameMap.get(c.companion_id) ?? 'Coach',
  }));
}

export async function getGoals(userId: string): Promise<CoachingGoal[]> {
  const { data, error } = await supabase
    .from('user_goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[coachingService] getGoals error:', error);
    return [];
  }

  return (data ?? []) as CoachingGoal[];
}

export async function updateCommitmentStatus(
  commitmentId: string,
  status: CommitmentStatus,
): Promise<void> {
  const patch: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === 'completed') {
    patch.completed_at = new Date().toISOString();
  }
  await supabase.from('coaching_commitments').update(patch).eq('id', commitmentId);
}

export async function updateGoalProgress(
  goalId: string,
  currentValue: number,
  status?: GoalStatus,
): Promise<void> {
  const patch: Record<string, unknown> = {
    current_value: currentValue,
    updated_at: new Date().toISOString(),
  };
  if (status) patch.status = status;
  await supabase.from('user_goals').update(patch).eq('id', goalId);
}

export async function updateGoalStatus(goalId: string, status: GoalStatus): Promise<void> {
  await supabase
    .from('user_goals')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', goalId);
}

export function getWeeklyStats(commitments: CoachingCommitment[]): WeeklyStats {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);

  const thisWeek = commitments.filter(c => new Date(c.created_at) >= weekAgo);
  const kept = thisWeek.filter(c => c.status === 'completed').length;
  const missed = thisWeek.filter(c => c.status === 'missed').length;
  const pending = thisWeek.filter(c => c.status === 'pending').length;

  const streak = calculateStreak(commitments);

  return { kept, missed, pending, streak };
}

function calculateStreak(commitments: CoachingCommitment[]): number {
  const completed = commitments
    .filter(c => c.status === 'completed' && c.completed_at)
    .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime());

  if (completed.length === 0) return 0;

  let streak = 0;
  let expected = new Date();
  expected.setHours(0, 0, 0, 0);

  for (const c of completed) {
    const completedDate = new Date(c.completed_at!);
    completedDate.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((expected.getTime() - completedDate.getTime()) / 86400000);

    if (diffDays <= 1) {
      streak++;
      expected = new Date(completedDate);
      expected.setDate(expected.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

export function commitmentDueLabel(dueDate: string | null): string {
  if (!dueDate) return 'No due date';
  const due = new Date(dueDate);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / 86400000);

  if (diffDays < 0) return `Overdue by ${Math.abs(diffDays)}d`;
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  if (diffDays <= 7) return `Due in ${diffDays}d`;
  return due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function commitmentStatusColor(status: CommitmentStatus): string {
  switch (status) {
    case 'completed':
      return 'var(--ds-success, #10b981)';
    case 'missed':
      return 'var(--ds-error, #ef4444)';
    case 'renegotiated':
      return 'var(--ds-warning, #f59e0b)';
    case 'pending':
    default:
      return 'var(--ds-accent, #3b82f6)';
  }
}

export function goalProgressPercent(goal: CoachingGoal): number {
  if (goal.target_value && goal.current_value != null) {
    return Math.min(100, Math.round((Number(goal.current_value) / Number(goal.target_value)) * 100));
  }
  return 0;
}

export function goalDaysRemaining(goal: CoachingGoal): number | null {
  if (!goal.target_date) return null;
  const diff = Math.ceil(
    (new Date(goal.target_date).getTime() - new Date().getTime()) / 86400000,
  );
  return diff;
}

export const GOAL_TYPE_LABELS: Record<string, string> = {
  health_fitness: 'Health & Fitness',
  reading: 'Reading',
  creative: 'Creative',
  habit: 'Habit',
  deadline: 'Deadline',
  skill: 'Skill',
  project: 'Project',
};

export interface WeeklyReview {
  id: string;
  week_starting: string;
  review_text: string;
  stats: {
    commitments_total?: number;
    commitments_kept?: number;
    commitments_missed?: number;
    commitments_pending?: number;
    sessions_count?: number;
    goals_active?: number;
    goals_completed?: number;
  };
  read_at: string | null;
  created_at: string;
}

export async function getLatestWeeklyReview(userId: string): Promise<WeeklyReview | null> {
  const { data, error } = await supabase
    .from('weekly_reviews')
    .select('id, week_starting, review_text, stats, read_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[coachingService] getLatestWeeklyReview error:', error);
    return null;
  }

  return (data as WeeklyReview) ?? null;
}

export async function markReviewRead(reviewId: string): Promise<void> {
  await supabase
    .from('weekly_reviews')
    .update({ read_at: new Date().toISOString() })
    .eq('id', reviewId);
}

export interface ConfidenceCheck {
  id: string;
  goal_id: string | null;
  score: number;
  note: string | null;
  created_at: string;
}

export async function getConfidenceChecks(userId: string, limit = 30): Promise<ConfidenceCheck[]> {
  const { data, error } = await supabase
    .from('confidence_checks')
    .select('id, goal_id, score, note, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[coachingService] getConfidenceChecks error:', error);
    return [];
  }

  return (data ?? []) as ConfidenceCheck[];
}

export async function addConfidenceCheck(
  userId: string,
  score: number,
  goalId?: string | null,
  note?: string,
): Promise<void> {
  await supabase.from('confidence_checks').insert({
    user_id: userId,
    goal_id: goalId ?? null,
    score,
    note: note ?? null,
  });
}

export function confidenceTrend(checks: ConfidenceCheck[]): { direction: 'up' | 'down' | 'flat'; avg: number; recent: number; delta: number } {
  if (checks.length === 0) return { direction: 'flat', avg: 0, recent: 0, delta: 0 };

  const sorted = [...checks].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const avg = sorted.reduce((sum, c) => sum + c.score, 0) / sorted.length;
  const recent = sorted[sorted.length - 1].score;

  if (sorted.length < 2) return { direction: 'flat', avg: Math.round(avg * 10) / 10, recent, delta: 0 };

  const first = sorted[0].score;
  const delta = recent - first;
  const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';

  return { direction, avg: Math.round(avg * 10) / 10, recent, delta };
}

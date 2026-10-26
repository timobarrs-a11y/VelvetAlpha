import { supabase } from '../shared/supabase/client';

export type CommitmentStatus = 'pending' | 'in_progress' | 'completed' | 'missed' | 'renegotiated';
export type GoalStatus = 'active' | 'completed' | 'paused' | 'abandoned';

export interface CoachingCommitment {
  id: string;
  companion_id: string | null;
  goal_id: string | null;
  description: string;
  due_date: string | null;
  status: CommitmentStatus;
  completed_at: string | null;
  created_at: string;
  companion_name?: string;
  progress_note?: string | null;
  is_user_created?: boolean;
  category?: string | null;
  extracted_from_message?: string | null;
  plan_step_id?: string | null;
  companion_color?: string | null;
  show_on_profile?: boolean;
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
  deadline_precision?: string | null;
  source_companion_id?: string | null;
  companion_name?: string;
  companion_color?: string | null;
  show_on_profile?: boolean;
}

export interface WeeklyStats {
  kept: number;
  missed: number;
  pending: number;
  streak: number;
}

export async function getCommitments(userId: string, companionId?: string | null): Promise<CoachingCommitment[]> {
  let query = supabase
    .from('coaching_commitments')
    .select(`
      id,
      companion_id,
      goal_id,
      description,
      due_date,
      status,
      completed_at,
      created_at,
      progress_note,
      is_user_created,
      category,
      extracted_from_message,
      plan_step_id,
      show_on_profile
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (companionId) {
    query = query.eq('companion_id', companionId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[coachingService] getCommitments error:', error);
    return [];
  }

  return withCompanionInfo((data ?? []) as CoachingCommitment[]);
}

/**
 * Commitments for Today on the home screen: open ones (pending or in progress)
 * due by `end`, overdue ones included, plus any ticked off since `start`, so
 * the day's done count holds. Soonest first.
 */
export async function getTodayCommitments(userId: string, start: Date, end: Date): Promise<CoachingCommitment[]> {
  const columns = 'id, companion_id, goal_id, description, due_date, status, completed_at, created_at, is_user_created, plan_step_id';
  const [open, doneToday] = await Promise.all([
    supabase
      .from('coaching_commitments')
      .select(columns)
      .eq('user_id', userId)
      .in('status', ['pending', 'in_progress'])
      .not('due_date', 'is', null)
      .lte('due_date', end.toISOString()),
    supabase
      .from('coaching_commitments')
      .select(columns)
      .eq('user_id', userId)
      .eq('status', 'completed')
      .not('due_date', 'is', null)
      .gte('completed_at', start.toISOString()),
  ]);

  if (open.error || doneToday.error) {
    console.error('[coachingService] getTodayCommitments error:', open.error ?? doneToday.error);
    return [];
  }
  const rows = [...(open.data ?? []), ...(doneToday.data ?? [])] as CoachingCommitment[];
  rows.sort((a, b) => new Date(a.due_date as string).getTime() - new Date(b.due_date as string).getTime());
  return withCompanionInfo(rows);
}

/** The next open commitment due after `after`, if any. */
export async function getNextOpenCommitment(userId: string, after: Date): Promise<CoachingCommitment | null> {
  const { data, error } = await supabase
    .from('coaching_commitments')
    .select('id, companion_id, goal_id, description, due_date, status, completed_at, created_at, is_user_created, plan_step_id')
    .eq('user_id', userId)
    .in('status', ['pending', 'in_progress'])
    .gt('due_date', after.toISOString())
    .order('due_date', { ascending: true })
    .limit(1);

  if (error || !data || data.length === 0) return null;
  const [next] = await withCompanionInfo(data as CoachingCommitment[]);
  return next;
}

/** Adds each commitment's coach name and color. */
async function withCompanionInfo(commitments: CoachingCommitment[]): Promise<CoachingCommitment[]> {
  if (commitments.length === 0) return commitments;

  const companionIds = [...new Set(commitments.map(c => c.companion_id).filter(Boolean))] as string[];
  if (companionIds.length === 0) {
    return commitments.map(c => ({ ...c, companion_name: c.is_user_created ? 'You' : 'Coach' }));
  }

  const { data: companions } = await supabase
    .from('companions')
    .select('id, custom_name, coach_color')
    .in('id', companionIds);

  const infoMap = new Map((companions ?? []).map(c => [c.id, { name: c.custom_name, color: (c as Record<string, unknown>).coach_color as string | null }]));
  return commitments.map(c => ({
    ...c,
    companion_name: c.companion_id ? (infoMap.get(c.companion_id)?.name ?? 'Coach') : 'You',
    companion_color: c.companion_id ? (infoMap.get(c.companion_id)?.color ?? null) : null,
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

  const goals = (data ?? []) as CoachingGoal[];
  if (goals.length === 0) return goals;

  const companionIds = [...new Set(goals.map(g => g.source_companion_id).filter(Boolean))] as string[];
  if (companionIds.length > 0) {
    const { data: companions } = await supabase
      .from('companions')
      .select('id, custom_name, coach_color')
      .in('id', companionIds);
    const infoMap = new Map((companions ?? []).map(c => [c.id, { name: c.custom_name, color: (c as Record<string, unknown>).coach_color as string | null }]));
    goals.forEach(g => {
      if (g.source_companion_id && infoMap.has(g.source_companion_id)) {
        const info = infoMap.get(g.source_companion_id)!;
        g.companion_name = info.name;
        g.companion_color = info.color;
      }
    });
  }

  return goals;
}

export async function getGoalById(userId: string, goalId: string): Promise<CoachingGoal | null> {
  const { data, error } = await supabase
    .from('user_goals')
    .select('*, show_on_profile')
    .eq('user_id', userId)
    .eq('id', goalId)
    .maybeSingle();

  if (error || !data) return null;

  const goal = data as CoachingGoal;
  if (goal.source_companion_id) {
    const { data: companion } = await supabase
      .from('companions')
      .select('id, custom_name, coach_color')
      .eq('id', goal.source_companion_id)
      .maybeSingle();
    if (companion) {
      goal.companion_name = (companion as Record<string, unknown>).custom_name as string;
      goal.companion_color = (companion as Record<string, unknown>).coach_color as string | null;
    }
  }
  return goal;
}

/** A goal the user set themselves (from quick add in Today), with an optional target date. */
export async function createUserGoal(
  userId: string,
  title: string,
  targetDate: string | null,
): Promise<CoachingGoal | null> {
  const { data, error } = await supabase
    .from('user_goals')
    .insert({
      user_id: userId,
      title,
      goal_type: 'project',
      target_date: targetDate,
      source: 'stated',
      status: 'active',
    })
    .select('*')
    .single();

  if (error) {
    console.error('[coachingService] createUserGoal error:', error);
    return null;
  }
  return data as CoachingGoal;
}

export async function updateGoalDeadline(
  goalId: string,
  targetDate: string | null,
  deadlinePrecision: string,
): Promise<void> {
  await supabase
    .from('user_goals')
    .update({
      target_date: targetDate,
      deadline_precision: deadlinePrecision,
      updated_at: new Date().toISOString(),
    })
    .eq('id', goalId);
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

/**
 * Commitments are built from plan steps (goal → plan → commitments → progress),
 * so a step is required; the goal comes from the step's plan.
 */
export async function createCommitment(
  userId: string,
  params: {
    description: string;
    planStepId: string;
    dueDate?: string | null;
    companionId?: string | null;
    category?: string | null;
  },
): Promise<CoachingCommitment | null> {
  const { data: step } = await supabase
    .from('coach_plan_steps')
    .select('id, commitment_id, coach_plans!inner(goal_id, user_id)')
    .eq('id', params.planStepId)
    .maybeSingle();
  const plan = (step as { coach_plans?: { goal_id: string; user_id: string } } | null)?.coach_plans;
  if (!step || !plan || plan.user_id !== userId) {
    console.error('[coachingService] createCommitment: plan step not found');
    return null;
  }

  const { data, error } = await supabase
    .from('coaching_commitments')
    .insert({
      user_id: userId,
      companion_id: params.companionId ?? null,
      goal_id: plan.goal_id,
      plan_step_id: params.planStepId,
      description: params.description,
      due_date: params.dueDate ?? null,
      status: 'pending',
      is_user_created: true,
      category: params.category ?? null,
    })
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[coachingService] createCommitment error:', error);
    return null;
  }

  if (data && !(step as { commitment_id: string | null }).commitment_id) {
    await supabase.from('coach_plan_steps').update({ commitment_id: (data as CoachingCommitment).id }).eq('id', params.planStepId);
  }

  return (data as CoachingCommitment) ?? null;
}

export async function updateProgressNote(
  commitmentId: string,
  note: string,
): Promise<void> {
  await supabase
    .from('coaching_commitments')
    .update({ progress_note: note, updated_at: new Date().toISOString() })
    .eq('id', commitmentId);
}

export async function deleteCommitment(commitmentId: string): Promise<void> {
  await supabase
    .from('coaching_commitments')
    .delete()
    .eq('id', commitmentId);
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
  const pending = thisWeek.filter(c => c.status === 'pending' || c.status === 'in_progress').length;

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
    case 'in_progress':
      return 'var(--ds-accent, #3b82f6)';
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

// =====================================================
// Coach Plans
// =====================================================

export type PlanStatus = 'proposed' | 'active' | 'completed' | 'paused';
export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export interface CoachPlanStep {
  id: string;
  plan_id: string;
  commitment_id: string | null;
  title: string;
  description: string | null;
  order_index: number;
  status: StepStatus;
  resource_url: string | null;
  resource_note: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  coach_proposed_title: string | null;
  user_set_title: string | null;
  coach_minimum: string | null;
  is_below_floor: boolean;
  minimum_value?: number | null;
  target_unit?: string | null;
  user_target_value?: number | null;
  /** The day it's planned for, so the calendar shows which days hold what. */
  scheduled_for?: string | null;
  duration_minutes?: number | null;
}

export interface CoachPlan {
  id: string;
  companion_id: string | null;
  goal_id: string;
  title: string;
  description: string | null;
  status: PlanStatus;
  cadence: string | null;
  created_at: string;
  updated_at: string;
  companion_name?: string;
  steps?: CoachPlanStep[];
  companion_color?: string | null;
}

export async function getPlans(
  userId: string,
  companionId?: string | null,
): Promise<CoachPlan[]> {
  let query = supabase
    .from('coach_plans')
    .select('id, companion_id, goal_id, title, description, status, cadence, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (companionId) {
    query = query.eq('companion_id', companionId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[coachingService] getPlans error:', error);
    return [];
  }

  const plans = (data ?? []) as CoachPlan[];
  if (plans.length === 0) return plans;

  const companionIds = [...new Set(plans.map(p => p.companion_id).filter(Boolean))] as string[];
  if (companionIds.length > 0) {
    const { data: companions } = await supabase
      .from('companions')
      .select('id, custom_name, coach_color')
      .in('id', companionIds);
    const infoMap = new Map((companions ?? []).map(c => [c.id, { name: c.custom_name, color: (c as Record<string, unknown>).coach_color as string | null }]));
    plans.forEach(p => {
      if (p.companion_id) {
        const info = infoMap.get(p.companion_id);
        p.companion_name = info?.name ?? 'Coach';
        p.companion_color = info?.color ?? null;
      }
    });
  }

  const planIds = plans.map(p => p.id);
  const { data: steps } = await supabase
    .from('coach_plan_steps')
    .select('id, plan_id, commitment_id, title, description, order_index, status, resource_url, resource_note, completed_at, coach_proposed_title, user_set_title, coach_minimum, is_below_floor, minimum_value, target_unit, user_target_value, created_at, updated_at')
    .in('plan_id', planIds)
    .order('order_index', { ascending: true });

  const stepsByPlan = new Map<string, CoachPlanStep[]>();
  for (const step of (steps ?? []) as CoachPlanStep[]) {
    const arr = stepsByPlan.get(step.plan_id) ?? [];
    arr.push(step);
    stepsByPlan.set(step.plan_id, arr);
  }
  plans.forEach(p => { p.steps = stepsByPlan.get(p.id) ?? []; });

  return plans;
}

/** Every plan serves a goal (goal → plan → commitments → progress). */
export async function createPlan(
  userId: string,
  params: {
    goalId: string;
    title: string;
    description?: string | null;
    companionId?: string | null;
    cadence?: string | null;
    steps?: { title: string; description?: string | null }[];
  },
): Promise<CoachPlan | null> {
  const { data: planData, error: planError } = await supabase
    .from('coach_plans')
    .insert({
      user_id: userId,
      companion_id: params.companionId ?? null,
      goal_id: params.goalId,
      title: params.title,
      description: params.description ?? null,
      cadence: params.cadence ?? null,
      status: 'active',
    })
    .select('id, companion_id, goal_id, title, description, status, cadence, created_at, updated_at')
    .maybeSingle();

  if (planError || !planData) {
    console.error('[coachingService] createPlan error:', planError);
    return null;
  }

  const plan = planData as CoachPlan;
  plan.steps = [];

  if (params.steps && params.steps.length > 0) {
    const stepRows = params.steps.map((s, i) => ({
      plan_id: plan.id,
      title: s.title,
      description: s.description ?? null,
      order_index: i,
      status: 'pending' as StepStatus,
    }));
    const { data: insertedSteps } = await supabase
      .from('coach_plan_steps')
      .insert(stepRows)
      .select('id, plan_id, commitment_id, title, description, order_index, status, resource_url, resource_note, completed_at, coach_proposed_title, user_set_title, coach_minimum, is_below_floor, minimum_value, target_unit, user_target_value, created_at, updated_at');
    plan.steps = (insertedSteps ?? []) as CoachPlanStep[];
  }

  return plan;
}

export async function updatePlanStatus(planId: string, status: PlanStatus): Promise<void> {
  await supabase
    .from('coach_plans')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', planId);
}

export async function updatePlanStepStatus(
  stepId: string,
  status: StepStatus,
): Promise<void> {
  // The linked commitment (and the plan's own status) are kept in sync by database triggers,
  // in both directions, so this is the only write the client needs.
  const { error } = await supabase
    .from('coach_plan_steps')
    .update({
      status,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', stepId);
  if (error) throw new Error(error.message);
}

export interface StepEditResult {
  is_below_floor: boolean;
  minimum_value: number | null;
  minimum_text: string | null;
}

/**
 * Edit a step. The server compares the new quantity with the coach's minimum, records the
 * change in the step history, and tells the coach on their next message.
 */
export async function updatePlanStepTitle(
  stepId: string,
  newTitle: string,
): Promise<StepEditResult> {
  const { data, error } = await supabase.rpc('edit_plan_step', {
    p_step_id: stepId,
    p_title: newTitle,
  });
  if (error) throw new Error(error.message);
  return data as StepEditResult;
}

/** Accept or decline a plan the coach proposed. The coach is told on their next message. */
export async function respondToPlan(
  userId: string,
  plan: { id: string; title: string; companion_id: string | null },
  accept: boolean,
): Promise<void> {
  if (accept) {
    const { error } = await supabase
      .from('coach_plans')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', plan.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('coach_plans').delete().eq('id', plan.id);
    if (error) throw new Error(error.message);
  }
  await createTickEvent(userId, {
    eventType: accept ? 'plan_accepted' : 'plan_declined',
    targetType: 'plan',
    targetId: plan.id,
    companionId: plan.companion_id,
    details: { title: plan.title },
  });
}

export async function createTickEvent(
  userId: string,
  params: {
    eventType: string;
    targetType: string;
    targetId: string;
    companionId?: string | null;
    details?: Record<string, unknown>;
  },
): Promise<void> {
  await supabase.from('coaching_tick_events').insert({
    user_id: userId,
    companion_id: params.companionId ?? null,
    event_type: params.eventType,
    target_type: params.targetType,
    target_id: params.targetId,
    details: params.details ?? {},
  });
}

export async function deletePlan(planId: string): Promise<void> {
  await supabase.from('coach_plans').delete().eq('id', planId);
}

export function planProgressPercent(plan: CoachPlan): number {
  if (!plan.steps || plan.steps.length === 0) return 0;
  const done = plan.steps.filter(s => s.status === 'completed').length;
  return Math.round((done / plan.steps.length) * 100);
}

// =====================================================
// Coach Artifacts
// =====================================================

export type ArtifactType = 'reading_material' | 'plan' | 'routine' | 'practice_set' | 'worksheet' | 'resource_pick' | 'checklist' | 'progress_report';
export type ArtifactStatus = 'proposed' | 'accepted' | 'archived';

export interface CoachArtifact {
  id: string;
  companion_id: string | null;
  goal_id: string | null;
  plan_id: string | null;
  artifact_type: string;
  title: string;
  content: Record<string, unknown>;
  status: string;
  version: number;
  parent_artifact_id: string | null;
  created_at: string;
  updated_at: string;
  companion_name?: string;
  companion_color?: string | null;
}

export async function getArtifacts(
  userId: string,
  companionId?: string | null,
  status?: ArtifactStatus | 'all',
): Promise<CoachArtifact[]> {
  let query = supabase
    .from('coach_artifacts')
    .select('id, companion_id, goal_id, plan_id, artifact_type, title, content, status, version, parent_artifact_id, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (companionId) query = query.eq('companion_id', companionId);
  if (status && status !== 'all') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) {
    console.error('[coachingService] getArtifacts error:', error);
    return [];
  }

  const artifacts = (data ?? []) as CoachArtifact[];
  if (artifacts.length === 0) return artifacts;

  const companionIds = [...new Set(artifacts.map(a => a.companion_id).filter(Boolean))] as string[];
  if (companionIds.length > 0) {
    const { data: companions } = await supabase
      .from('companions')
      .select('id, custom_name, coach_color')
      .in('id', companionIds);
    const infoMap = new Map((companions ?? []).map(c => [c.id, { name: c.custom_name, color: (c as Record<string, unknown>).coach_color as string | null }]));
    artifacts.forEach(a => {
      if (a.companion_id) {
        const info = infoMap.get(a.companion_id);
        a.companion_name = info?.name ?? 'Coach';
        a.companion_color = info?.color ?? null;
      }
    });
  }
  return artifacts;
}

export async function updateArtifactStatus(
  artifactId: string,
  status: ArtifactStatus,
): Promise<void> {
  await supabase
    .from('coach_artifacts')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', artifactId);
}

export async function updateArtifactContent(
  artifactId: string,
  title: string,
  content: Record<string, unknown>,
): Promise<void> {
  await supabase
    .from('coach_artifacts')
    .update({ title, content, updated_at: new Date().toISOString() })
    .eq('id', artifactId);
}

export async function deleteArtifact(artifactId: string): Promise<void> {
  await supabase.from('coach_artifacts').delete().eq('id', artifactId);
}

export const ARTIFACT_TYPE_LABELS: Record<string, string> = {
  reading_material: 'Reading Material',
  plan: 'Plan',
  routine: 'Routine / Schedule',
  practice_set: 'Practice Set',
  worksheet: 'Worksheet',
  resource_pick: 'Resource Pick',
  checklist: 'Checklist',
  progress_report: 'Progress Report',
};

// =====================================================
// Resource Cache
// =====================================================

export interface CachedResource {
  id: string;
  video_id: string;
  title: string;
  channel: string;
  thumbnail: string;
  url: string;
  duration?: string;
}

export interface ResourceCacheEntry {
  id: string;
  cache_key: string;
  source: string;
  query: string;
  results: CachedResource[];
  created_at: string;
  expires_at: string;
}

export async function getCachedResources(
  userId: string,
  cacheKey: string,
): Promise<ResourceCacheEntry | null> {
  const { data, error } = await supabase
    .from('resource_cache')
    .select('id, cache_key, source, query, results, created_at, expires_at')
    .eq('user_id', userId)
    .eq('cache_key', cacheKey)
    .maybeSingle();

  if (error) {
    console.error('[coachingService] getCachedResources error:', error);
    return null;
  }

  if (!data) return null;

  const entry = data as ResourceCacheEntry;
  if (new Date(entry.expires_at) < new Date()) return null;

  return entry;
}

export async function cacheResources(
  userId: string,
  cacheKey: string,
  query: string,
  source: string,
  results: CachedResource[],
): Promise<void> {
  await supabase
    .from('resource_cache')
    .upsert(
      {
        user_id: userId,
        cache_key: cacheKey,
        source,
        query,
        results,
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
      },
      { onConflict: 'user_id,cache_key' },
    );
}

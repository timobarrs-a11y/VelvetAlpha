import { supabase } from '../shared/supabase/client';

export type GoalType = 'health_fitness' | 'reading' | 'creative' | 'habit' | 'deadline';
export type GoalStatus = 'active' | 'completed' | 'paused' | 'abandoned';

export interface UserGoal {
  id: string;
  user_id: string;
  title: string;
  goal_type: GoalType;
  target_value: number | null;
  current_value: number | null;
  unit: string | null;
  start_date: string;
  target_date: string | null;
  status: GoalStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type GoalInput = Omit<UserGoal, 'id' | 'user_id' | 'created_at' | 'updated_at'>;

export async function getActiveGoals(userId: string): Promise<UserGoal[]> {
  const { data } = await supabase
    .from('user_goals')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(10);
  return data ?? [];
}

export async function getAllGoals(userId: string): Promise<UserGoal[]> {
  const { data } = await supabase
    .from('user_goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return data ?? [];
}

export async function upsertGoal(
  userId: string,
  goal: GoalInput & { id?: string }
): Promise<UserGoal | null> {
  const payload = { ...goal, user_id: userId };
  if (goal.id) {
    const { data } = await supabase
      .from('user_goals')
      .update(payload)
      .eq('id', goal.id)
      .select()
      .maybeSingle();
    return data;
  }
  const { data } = await supabase
    .from('user_goals')
    .insert(payload)
    .select()
    .maybeSingle();
  return data;
}

export async function updateGoalProgress(
  goalId: string,
  current_value: number,
  status?: GoalStatus
): Promise<void> {
  const patch: Record<string, unknown> = { current_value };
  if (status) patch.status = status;
  await supabase.from('user_goals').update(patch).eq('id', goalId);
}

export async function updateGoalStatus(goalId: string, status: GoalStatus): Promise<void> {
  await supabase.from('user_goals').update({ status }).eq('id', goalId);
}

export async function deleteGoal(goalId: string): Promise<void> {
  await supabase.from('user_goals').delete().eq('id', goalId);
}

/** Formats active goals into a context string for the morning brief prompt. */
export function formatGoalsForBrief(goals: UserGoal[]): string {
  if (goals.length === 0) return '';

  const today = new Date();

  const lines = goals.slice(0, 5).map(g => {
    let line = `- ${g.title}`;

    // Progress with unit
    if (g.current_value != null && g.target_value != null && g.unit) {
      line += ` — ${g.current_value} / ${g.target_value} ${g.unit}`;
    } else if (g.current_value != null && g.unit) {
      line += ` — ${g.current_value} ${g.unit} so far`;
    }

    // Days-in for habit goals
    if (g.goal_type === 'habit' && g.start_date) {
      const dayIn = Math.floor(
        (today.getTime() - new Date(g.start_date).getTime()) / 86400000
      ) + 1;
      line += ` — day ${dayIn}`;
    }

    // Days remaining toward target_date
    if (g.target_date) {
      const daysLeft = Math.ceil(
        (new Date(g.target_date).getTime() - today.getTime()) / 86400000
      );
      if (daysLeft > 0) {
        line += ` — ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`;
      } else if (daysLeft === 0) {
        line += ` — deadline is TODAY`;
      } else {
        line += ` — overdue by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''}`;
      }
    }

    if (g.notes) line += ` (${g.notes})`;
    return line;
  });

  return `User's active goals:\n${lines.join('\n')}`;
}

/** Goal type display labels */
export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  health_fitness: 'Health & Fitness',
  reading: 'Reading',
  creative: 'Creative',
  habit: 'Habit',
  deadline: 'Deadline',
};

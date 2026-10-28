import { supabase } from '../../shared/supabase/client';
import type { ResumeFacts, ResumePoint, ResumeStage } from './resumeStage';

/** What the resume check needs about someone: their goal, its plans and its open commitments. */
export async function loadResumeFacts(userId: string): Promise<ResumeFacts> {
  const { data: goal } = await supabase
    .from('user_goals')
    .select('id, title, source_companion_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!goal) return { goal: null, plans: [], commitments: [] };
  const [plans, commitments] = await Promise.all([
    supabase.from('coach_plans').select('status, goal_id, companion_id').eq('user_id', userId),
    supabase.from('coaching_commitments').select('status, due_date, goal_id, companion_id').eq('user_id', userId).in('status', ['pending', 'in_progress']),
  ]);
  return {
    goal: { id: goal.id as string, title: goal.title as string, coachId: (goal.source_companion_id as string | null) ?? null },
    plans: (plans.data ?? []) as ResumeFacts['plans'],
    commitments: (commitments.data ?? []) as ResumeFacts['commitments'],
  };
}

/** Their latest Atlas conversation, where a pickup from Atlas is left. */
export async function latestAtlasConversation(userId: string): Promise<string | null> {
  const { data } = await supabase.from('atlas_conversations').select('id').eq('user_id', userId).order('updated_at', { ascending: false }).limit(1).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/**
 * Leaves the pickup message in the conversation being continued (resume-pickup). `handoff`: Atlas has picked up a goal
 * with no plan and the coach takes it from here. Returns the Atlas conversation it went into, when it was Atlas.
 */
export async function requestPickup(p: ResumePoint, handoff = false): Promise<{ conversationId: string | null } | null> {
  const { data, error } = await supabase.functions.invoke('resume-pickup', {
    body: { stage: p.stage satisfies ResumeStage, goalId: p.goalId, coachId: p.coachId, handoff },
  });
  if (error || !data || data.error) return null;
  return { conversationId: (data.conversationId as string | null) ?? null };
}

/** How many "Not now"s a day the admin allows (app_settings.resume_gate_snooze_per_day; 1 if unset). */
export async function snoozesAllowed(): Promise<number> {
  const { data } = await supabase.from('app_settings').select('value').eq('key', 'resume_gate_snooze_per_day').maybeSingle();
  const n = Number(data?.value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 1;
}

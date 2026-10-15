import { createClient } from 'npm:@supabase/supabase-js@2';

export interface CoachingState {
  goal: {
    title: string;
    goal_type: string;
    target_date: string | null;
    status: string;
  } | null;
  plans: Array<{
    id: string;
    title: string;
    status: string;
    cadence: string | null;
    steps: Array<{
      id: string;
      title: string;
      coach_proposed_title: string | null;
      user_set_title: string | null;
      status: string;
      coach_minimum: string | null;
      is_below_floor: boolean;
      completed_at: string | null;
    }>;
  }>;
  commitments: Array<{
    id: string;
    description: string;
    due_date: string | null;
    status: string;
    progress_note: string | null;
    is_user_created: boolean;
    plan_step_id: string | null;
  }>;
  tickEvents: Array<{
    event_type: string;
    target_type: string;
    details: Record<string, unknown>;
    created_at: string;
  }>;
  artifacts: Array<{
    id: string;
    artifact_type: string;
    title: string;
    status: string;
    created_at: string;
  }>;
  confidenceTrend: {
    latest: number | null;
    previous: number | null;
    direction: 'up' | 'down' | 'flat' | null;
  };
}

function buildConfidenceTrend(checks: Array<{ score: number; created_at: string }>) {
  if (!checks || checks.length === 0) return { latest: null, previous: null, direction: null };
  const sorted = checks.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const latest = sorted[sorted.length - 1].score;
  const previous = sorted.length > 1 ? sorted[sorted.length - 2].score : null;
  const direction = previous !== null
    ? latest > previous ? 'up' : latest < previous ? 'down' : 'flat'
    : null;
  return { latest, previous, direction };
}

export async function loadCoachingState(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  companionId: string,
): Promise<CoachingState> {
  const [goalRes, plansRes, commitmentsRes, tickRes, artifactRes, confidenceRes] = await Promise.all([
    supabaseAdmin
      .from('user_goals')
      .select('title, goal_type, target_date, status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('coach_plans')
      .select(`
        id, title, status, cadence,
        coach_plan_steps!inner(
          id, title, coach_proposed_title, user_set_title, status,
          coach_minimum, is_below_floor, completed_at, order_index
        )
      `)
      .eq('user_id', userId)
      .or(`companion_id.eq.${companionId},companion_id.is.null`)
      .in('status', ['active', 'paused']),
    supabaseAdmin
      .from('coaching_commitments')
      .select('id, description, due_date, status, progress_note, is_user_created, plan_step_id')
      .eq('user_id', userId)
      .or(`companion_id.eq.${companionId},companion_id.is.null`)
      .in('status', ['pending', 'in_progress', 'missed'])
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(10),
    supabaseAdmin
      .from('coaching_tick_events')
      .select('event_type, target_type, details, created_at')
      .eq('user_id', userId)
      .or(`companion_id.eq.${companionId},companion_id.is.null`)
      .eq('acknowledged', false)
      .order('created_at', { ascending: false })
      .limit(20),
    supabaseAdmin
      .from('coach_artifacts')
      .select('id, artifact_type, title, status, created_at')
      .eq('user_id', userId)
      .or(`companion_id.eq.${companionId},companion_id.is.null`)
      .in('status', ['proposed', 'accepted'])
      .order('created_at', { ascending: false })
      .limit(5),
    supabaseAdmin
      .from('confidence_checks')
      .select('score, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const plans = (plansRes.data ?? []).map((p: Record<string, unknown>) => ({
    id: p.id as string,
    title: p.title as string,
    status: p.status as string,
    cadence: p.cadence as string | null,
    steps: ((p.coach_plan_steps as Array<Record<string, unknown>>) ?? [])
      .sort((a, b) => (a.order_index as number) - (b.order_index as number))
      .map((s) => ({
        id: s.id as string,
        title: s.title as string,
        coach_proposed_title: s.coach_proposed_title as string | null,
        user_set_title: s.user_set_title as string | null,
        status: s.status as string,
        coach_minimum: s.coach_minimum as string | null,
        is_below_floor: s.is_below_floor as boolean,
        completed_at: s.completed_at as string | null,
      })),
  }));

  return {
    goal: goalRes.data as CoachingState['goal'],
    plans,
    commitments: (commitmentsRes.data ?? []) as CoachingState['commitments'],
    tickEvents: (tickRes.data ?? []) as CoachingState['tickEvents'],
    artifacts: (artifactRes.data ?? []) as CoachingState['artifacts'],
    confidenceTrend: buildConfidenceTrend(confidenceRes.data ?? []),
  };
}

export function formatCoachingStateBlock(state: CoachingState): string {
  const parts: string[] = [];

  if (state.goal) {
    const goalLines = [`GOAL: "${state.goal.title}" (${state.goal.goal_type})`];
    if (state.goal.target_date) {
      const days = Math.ceil((new Date(state.goal.target_date).getTime() - Date.now()) / 86400000);
      goalLines.push(days > 0 ? `  Target: ${days} days remaining` : `  Target: overdue`);
    }
    parts.push(goalLines.join('\n'));
  }

  if (state.plans.length > 0) {
    const planLines = state.plans.map(plan => {
      const stepCount = plan.steps.length;
      const doneCount = plan.steps.filter(s => s.status === 'completed').length;
      const lines = [`PLAN: "${plan.title}" (${doneCount}/${stepCount} steps${plan.cadence ? `, ${plan.cadence}` : ''})`];
      for (const step of plan.steps) {
        const displayTitle = step.user_set_title || step.title;
        const icon = step.status === 'completed' ? '[x]' : step.status === 'in_progress' ? '[~]' : '[ ]';
        let line = `  ${icon} ${displayTitle}`;
        if (step.coach_minimum && step.is_below_floor) {
          line += ` ⚠ BELOW COACH MINIMUM (${step.coach_minimum})`;
        }
        if (step.coach_proposed_title && step.user_set_title && step.coach_proposed_title !== step.user_set_title) {
          line += ` [user edited from "${step.coach_proposed_title}"]`;
        }
        lines.push(line);
      }
      return lines.join('\n');
    });
    parts.push(planLines.join('\n'));
  }

  if (state.commitments.length > 0) {
    const now = new Date();
    const commLines = state.commitments.map(c => {
      let line = `- ${c.description}`;
      if (c.due_date) {
        const days = Math.ceil((new Date(c.due_date).getTime() - now.getTime()) / 86400000);
        if (days < 0) line += ` — OVERDUE by ${Math.abs(days)}d`;
        else if (days === 0) line += ' — due TODAY';
        else line += ` — due in ${days}d`;
      }
      if (c.status === 'missed') line += ' [MISSED]';
      if (c.status === 'in_progress') line += ' [IN PROGRESS]';
      if (c.progress_note) line += ` | note: "${c.progress_note}"`;
      return line;
    });
    parts.push(`COMMITMENTS:\n${commLines.join('\n')}`);
  }

  if (state.tickEvents.length > 0) {
    const tickLines = state.tickEvents.map(e => {
      const ts = new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (e.event_type === 'step_completed') return `  [${ts}] Completed step: ${e.details.title ?? ''}`;
      if (e.event_type === 'step_edited') {
        const d = e.details as Record<string, string>;
        return `  [${ts}] Edited step: "${d.from ?? ''}" → "${d.to ?? ''}"`;
      }
      if (e.event_type === 'commitment_completed') return `  [${ts}] Completed commitment: ${e.details.description ?? ''}`;
      if (e.event_type === 'commitment_progress') return `  [${ts}] Progress on: ${e.details.description ?? ''} — "${e.details.note ?? ''}"`;
      return `  [${ts}] ${e.event_type}`;
    });
    parts.push(`SINCE LAST TIME (user updates):\n${tickLines.join('\n')}`);
  }

  if (state.artifacts.length > 0) {
    const artLines = state.artifacts.map(a => `  - [${a.status}] ${a.artifact_type}: "${a.title}"`);
    parts.push(`RECENT ARTIFACTS:\n${artLines.join('\n')}`);
  }

  if (state.confidenceTrend.latest !== null) {
    const ct = state.confidenceTrend;
    let line = `CONFIDENCE: ${ct.latest}/10`;
    if (ct.direction === 'up') line += ' (trending up)';
    else if (ct.direction === 'down') line += ' (trending down — check in on them)';
    parts.push(line);
  }

  // Build adjustment signals — conditions that should trigger coach action
  const signals: string[] = [];
  const now = new Date();

  // Missed commitments
  const missedCommitments = state.commitments.filter(c => c.status === 'missed');
  if (missedCommitments.length > 0) {
    signals.push(`${missedCommitments.length} missed commitment(s) — address these. Propose a revised plan or a smaller step to rebuild momentum.`);
  }

  // Overdue commitments
  const overdueCommitments = state.commitments.filter(c =>
    c.due_date && new Date(c.due_date) < now && (c.status === 'pending' || c.status === 'in_progress')
  );
  if (overdueCommitments.length > 0) {
    signals.push(`${overdueCommitments.length} overdue commitment(s) — check in without guilt, propose a smaller next step.`);
  }

  // Confidence drop
  if (state.confidenceTrend.direction === 'down' && state.confidenceTrend.latest !== null && state.confidenceTrend.latest < 5) {
    signals.push(`Confidence dropped to ${state.confidenceTrend.latest}/10 — acknowledge the dip, adjust expectations, propose one small win.`);
  }

  // Steps below coach minimum
  const belowFloorSteps = state.plans.flatMap(p => p.steps.filter(s => s.is_below_floor));
  if (belowFloorSteps.length > 0) {
    signals.push(`${belowFloorSteps.length} step(s) edited below your coach minimum — explain why the minimum matters or negotiate a middle ground.`);
  }

  // No tick events and no recent engagement (silence)
  if (state.tickEvents.length === 0 && state.commitments.length > 0) {
    signals.push(`No user updates since last session — they may be disengaged. Open warmly, ask what got in the way, propose a smaller step.`);
  }

  if (signals.length > 0) {
    parts.push(`ADJUSTMENT SIGNALS (act on these this session):\n${signals.map(s => `  ! ${s}`).join('\n')}`);
  }

  if (parts.length === 0) return '';

  return `\n\n[COACHING STATE — this is what you know about their progress]\n${parts.join('\n\n')}\n[END COACHING STATE]`;
}

export async function acknowledgeTickEvents(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  companionId: string,
): Promise<void> {
  await supabaseAdmin
    .from('coaching_tick_events')
    .update({ acknowledged: true })
    .eq('user_id', userId)
    .or(`companion_id.eq.${companionId},companion_id.is.null`)
    .eq('acknowledged', false);
}

import { createClient } from 'npm:@supabase/supabase-js@2';

type Admin = ReturnType<typeof createClient>;

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
      minimum_value: number | null;
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
  /** Most recent user message to this coach that is older than the current burst of chat. */
  lastUserMessageBeforeSession: string | null;
}

export interface Signal {
  key: string;
  text: string;
  /** Hours before the same signal may be raised again. */
  cooldownHours: number;
}

const SESSION_BURST_MINUTES = 30;
const SILENCE_DAYS = 4;

function buildConfidenceTrend(checks: Array<{ score: number; created_at: string }>) {
  if (!checks || checks.length === 0) return { latest: null, previous: null, direction: null };
  const sorted = [...checks].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const latest = sorted[sorted.length - 1].score;
  const previous = sorted.length > 1 ? sorted[sorted.length - 2].score : null;
  const direction = previous !== null
    ? latest > previous ? 'up' : latest < previous ? 'down' : 'flat'
    : null;
  return { latest, previous, direction } as CoachingState['confidenceTrend'];
}

export async function loadCoachingState(
  supabaseAdmin: Admin,
  userId: string,
  companionId: string,
): Promise<CoachingState> {
  const burstCutoff = new Date(Date.now() - SESSION_BURST_MINUTES * 60 * 1000).toISOString();

  const [goalRes, plansRes, commitmentsRes, tickRes, artifactRes, confidenceRes, lastMsgRes] = await Promise.all([
    supabaseAdmin
      .from('user_goals')
      .select('title, goal_type, target_date, status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    // Left join: a plan with no steps yet must still be visible to the coach.
    supabaseAdmin
      .from('coach_plans')
      .select(`
        id, title, status, cadence,
        coach_plan_steps(
          id, title, coach_proposed_title, user_set_title, status,
          coach_minimum, minimum_value, is_below_floor, completed_at, order_index
        )
      `)
      .eq('user_id', userId)
      .or(`companion_id.eq.${companionId},companion_id.is.null`)
      .in('status', ['proposed', 'active', 'paused']),
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
    supabaseAdmin
      .from('conversations')
      .select('created_at')
      .eq('user_id', userId)
      .eq('companion_id', companionId)
      .eq('role', 'user')
      .lt('created_at', burstCutoff)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
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
        minimum_value: s.minimum_value as number | null,
        is_below_floor: !!s.is_below_floor,
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
    lastUserMessageBeforeSession: (lastMsgRes.data as { created_at: string } | null)?.created_at ?? null,
  };
}

/** Conditions the coach should act on. Pure: callers filter by cooldown. */
export function computeSignals(state: CoachingState, now: Date = new Date()): Signal[] {
  const signals: Signal[] = [];

  const missed = state.commitments.filter(c => c.status === 'missed');
  if (missed.length > 0) {
    signals.push({
      key: 'missed_commitments',
      cooldownHours: 24,
      text: `${missed.length} missed commitment(s) — address them once. Propose a revised plan or a smaller step to rebuild momentum.`,
    });
  }

  const overdue = state.commitments.filter(c =>
    c.due_date && new Date(c.due_date) < now && (c.status === 'pending' || c.status === 'in_progress'),
  );
  if (overdue.length > 0) {
    signals.push({
      key: 'overdue_commitments',
      cooldownHours: 24,
      text: `${overdue.length} overdue commitment(s) — check in without guilt and propose a smaller next step.`,
    });
  }

  const { latest, direction } = state.confidenceTrend;
  if (direction === 'down' && latest !== null && latest < 5) {
    signals.push({
      key: 'confidence_drop',
      cooldownHours: 72,
      text: `Confidence dropped to ${latest}/10 — acknowledge the dip, adjust expectations, propose one small win.`,
    });
  }

  const below = state.plans.flatMap(p => p.steps.filter(s => s.is_below_floor));
  if (below.length > 0) {
    signals.push({
      key: 'below_floor',
      cooldownHours: 24,
      text: `${below.length} step(s) edited below your minimum — decide: adjust_step "hold" (explain why the minimum matters), "accept" (lower your minimum), or "revise" (a middle ground).`,
    });
  }

  const hasOpenWork = state.commitments.length > 0 || state.plans.some(p => p.status === 'active');
  if (hasOpenWork && state.lastUserMessageBeforeSession) {
    const days = (now.getTime() - new Date(state.lastUserMessageBeforeSession).getTime()) / 86400000;
    if (days >= SILENCE_DAYS) {
      signals.push({
        key: 'silence',
        cooldownHours: 72,
        text: `They have been away about ${Math.floor(days)} day(s) — welcome them back warmly, ask what got in the way, and propose a smaller step instead of pressing on the old one.`,
      });
    }
  }

  return signals;
}

export function formatCoachingStateBlock(state: CoachingState, signals: Signal[] = []): string {
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
      const proposed = plan.status === 'proposed' ? ' — PROPOSED, awaiting the user\'s acceptance' : '';
      const lines = [`PLAN [plan_id=${plan.id}] "${plan.title}" (${doneCount}/${stepCount} steps${plan.cadence ? `, ${plan.cadence}` : ''})${proposed}`];
      for (const step of plan.steps) {
        const displayTitle = step.user_set_title || step.title;
        const icon = step.status === 'completed' ? '[x]' : step.status === 'in_progress' ? '[~]' : '[ ]';
        let line = `  ${icon} [step_id=${step.id}] ${displayTitle}`;
        if (step.user_set_title && step.coach_proposed_title && step.coach_proposed_title !== step.user_set_title) {
          line += ` (you proposed "${step.coach_proposed_title}", they set "${step.user_set_title}")`;
        }
        if (step.coach_minimum || step.minimum_value !== null) {
          line += ` | your minimum: ${step.coach_minimum ?? step.minimum_value}`;
        }
        if (step.is_below_floor) line += ' ⚠ BELOW YOUR MINIMUM';
        lines.push(line);
      }
      return lines.join('\n');
    });
    parts.push(planLines.join('\n'));
  }

  if (state.commitments.length > 0) {
    const now = new Date();
    const commLines = state.commitments.map(c => {
      let line = `- [commitment_id=${c.id}] ${c.description}`;
      if (c.due_date) {
        const days = Math.ceil((new Date(c.due_date).getTime() - now.getTime()) / 86400000);
        if (days < 0) line += ` — OVERDUE by ${Math.abs(days)}d`;
        else if (days === 0) line += ' — due TODAY';
        else line += ` — due in ${days}d`;
      }
      if (c.status === 'missed') line += ' [MISSED]';
      if (c.status === 'in_progress') line += ' [IN PROGRESS]';
      if (c.progress_note) line += ` | note: "${c.progress_note}"`;
      if (c.plan_step_id) line += ` | linked to step ${c.plan_step_id}`;
      return line;
    });
    parts.push(`COMMITMENTS:\n${commLines.join('\n')}`);
  }

  if (state.tickEvents.length > 0) {
    const tickLines = state.tickEvents.map(e => {
      const ts = new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const d = e.details as Record<string, unknown>;
      if (e.event_type === 'step_completed') return `  [${ts}] Completed step: ${d.title ?? ''}`;
      if (e.event_type === 'step_edited') {
        return `  [${ts}] Edited step: "${d.from ?? ''}" → "${d.to ?? ''}"${d.below_floor ? ' (BELOW your minimum)' : ''}`;
      }
      if (e.event_type === 'plan_accepted') return `  [${ts}] Accepted your plan: ${d.title ?? ''}`;
      if (e.event_type === 'plan_declined') return `  [${ts}] Declined your plan: ${d.title ?? ''}`;
      if (e.event_type === 'commitment_completed') return `  [${ts}] Completed commitment: ${d.description ?? ''}`;
      if (e.event_type === 'commitment_progress') return `  [${ts}] Progress on: ${d.description ?? ''} — "${d.note ?? ''}"`;
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

  if (signals.length > 0) {
    parts.push(`ADJUSTMENT SIGNALS (raise each once this session, then move on):\n${signals.map(s => `  ! ${s.text}`).join('\n')}`);
  }

  if (parts.length === 0) return '';

  return `\n\n[COACHING STATE — this is what you know about their progress]\n${parts.join('\n\n')}\n[END COACHING STATE]`;
}

/**
 * Load the state, drop signals that were raised within their cooldown, and
 * return the prompt block plus the keys that were just raised so the caller
 * can record them once the reply is on its way.
 */
export async function buildCoachingStateBlock(
  supabaseAdmin: Admin,
  userId: string,
  companionId: string,
): Promise<{ block: string; raised: string[] }> {
  const state = await loadCoachingState(supabaseAdmin, userId, companionId);
  const candidates = computeSignals(state);

  let fresh = candidates;
  if (candidates.length > 0) {
    const { data } = await supabaseAdmin
      .from('coaching_signal_log')
      .select('signal_key, last_raised_at')
      .eq('user_id', userId)
      .eq('companion_id', companionId)
      .in('signal_key', candidates.map(s => s.key));
    const last = new Map(((data ?? []) as Array<{ signal_key: string; last_raised_at: string }>)
      .map(r => [r.signal_key, new Date(r.last_raised_at).getTime()]));
    fresh = candidates.filter(s => {
      const t = last.get(s.key);
      return t === undefined || Date.now() - t >= s.cooldownHours * 3600 * 1000;
    });
  }

  return { block: formatCoachingStateBlock(state, fresh), raised: fresh.map(s => s.key) };
}

export async function markSignalsRaised(
  supabaseAdmin: Admin,
  userId: string,
  companionId: string,
  keys: string[],
): Promise<void> {
  if (keys.length === 0) return;
  const now = new Date().toISOString();
  await supabaseAdmin.from('coaching_signal_log').upsert(
    keys.map(k => ({ user_id: userId, companion_id: companionId, signal_key: k, last_raised_at: now })),
    { onConflict: 'user_id,companion_id,signal_key' },
  );
}

export async function acknowledgeTickEvents(
  supabaseAdmin: Admin,
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

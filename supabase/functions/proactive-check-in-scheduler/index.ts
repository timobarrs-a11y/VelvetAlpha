import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { requireCronAuth } from "../_shared/cronAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? Deno.env.get('OPENAI_API_KEY') ?? '';

interface Companion {
  id: string;
  user_id: string;
  custom_name: string;
  relationship_type: string | null;
  last_message_at: string | null;
}

interface MemoryItem {
  id: string;
  kind: string;
  content: string;
  scope: string;
  companion_id: string | null;
  shared_origin_companion_id: string | null;
}

/** Why a companion or coach is reaching out. Every proactive message needs one. */
type Reason =
  | { kind: 'commitment_missed'; detail: string }
  | { kind: 'commitment_due_today'; detail: string }
  | { kind: 'commitment_due_tomorrow'; detail: string }
  | { kind: 'step_today'; detail: string }
  | { kind: 'plan_awaiting'; detail: string }
  | { kind: 'follow_up'; detail: string }
  | { kind: 'long_gap'; detail: string; gapDays: number };

// Most important first: when several companions have a reason, only the top one writes.
const REASON_PRIORITY: Reason['kind'][] = ['commitment_missed', 'commitment_due_today', 'step_today', 'commitment_due_tomorrow', 'follow_up', 'plan_awaiting', 'long_gap'];

const REASON_INSTRUCTION: Record<Reason['kind'], string> = {
  commitment_missed:
    'They missed a commitment they made with you. Reach out with empathy, no guilt. Ask what got in the way and offer to make the next step smaller or move it.',
  commitment_due_today:
    'They have a commitment due today. Give a short, encouraging nudge that names it, and offer help if something is in the way.',
  commitment_due_tomorrow:
    'They have a commitment due tomorrow. A light heads-up that names it, so they can make room for it. Offer to make it smaller if the timing is bad.',
  step_today:
    'A step from their plan is pencilled in for today. Name it, say roughly how long it takes, and make starting feel easy. Offer to move it if today is full.',
  plan_awaiting:
    'You proposed a plan that they have not accepted yet. Check whether it fits, and offer to adjust anything before they commit.',
  follow_up:
    'They told you about something that was coming up. Ask how it went, naturally, like a friend who remembered.',
  long_gap:
    'You have not heard from them in a while. Check in warmly about how they are doing. Never mention a specific number of days.',
};

async function generateCheckInMessage(
  companion: Companion,
  reason: Reason,
  memories: MemoryItem[],
  openCommitments: Array<{ description: string; due_date: string | null; status: string }>,
  companionNameMap: Map<string, string>,
): Promise<string> {
  const isMentor = companion.relationship_type === 'mentor' || companion.relationship_type === 'assistant';
  const companionName = companion.custom_name || (isMentor ? (companion.relationship_type === 'assistant' ? 'your assistant' : 'your coach') : 'your friend');
  // Build the context for the LLM
  const memoryLines: string[] = [];
  for (const m of memories) {
    let line = `- ${m.content}`;
    if (m.shared_origin_companion_id) {
      const originName = companionNameMap.get(m.shared_origin_companion_id);
      if (originName && originName !== companionName) {
        line += ` (originally shared by ${originName})`;
      }
    }
    memoryLines.push(line);
  }

  const commitmentLines = openCommitments.map(c => {
    let line = `- ${c.description}`;
    if (c.due_date) {
      const due = new Date(c.due_date);
      const daysLeft = Math.ceil((due.getTime() - Date.now()) / 86400000);
      if (daysLeft < 0) line += ` (overdue by ${Math.abs(daysLeft)} days)`;
      else if (daysLeft === 0) line += ` (due today)`;
      else line += ` (due in ${daysLeft} days)`;
    }
    if (c.status === 'missed') line += ' [MISSED]';
    return line;
  });

  const roleInstruction = isMentor
    ? 'You are the user\'s COACH. You check in on their goals and commitments with warmth, never scolding. You care about them as a person, not just their progress.'
    : 'You are the user\'s COMPANION/FRIEND. You check in on THEM — how they\'re doing, what\'s going on in their life. You\'re not here to push goals, you\'re here because you care.';

  const memoriesBlock = memoryLines.length > 0
    ? `\n\nWhat you know about the user and their life:\n${memoryLines.join('\n')}`
    : '';

  const commitmentsBlock = commitmentLines.length > 0
    ? `\n\nOpen commitments the user made:\n${commitmentLines.join('\n')}`
    : '';

  const prompt = `${roleInstruction}

Write a short message to the user. Keep it to 1-3 sentences, natural and conversational — like a real text from a friend.

Why you are reaching out: ${REASON_INSTRUCTION[reason.kind]}
Specifically: ${reason.detail}

Your name is ${companionName}.${memoriesBlock}${commitmentsBlock}

Rules:
- NEVER mention a specific number of days since you last talked. Use vague references like "a few days", "a while", "since Tuesday" if you reference time at all.
- If there\'s something personal in what you know (like a family member being sick, a job interview, a move), bring it up with genuine care — but only ONE thing, not a list.
- Don\'t list multiple memories or make it feel like you\'re reading from a file.
- Sound like you genuinely remember these things, not like you\'re checking boxes.
- Don\'t use exclamation marks excessively. Be real.
- If the user asked for something to stay private, do NOT bring it up.
- Keep it short. This is a check-in, not a paragraph.

Write only the message, no preamble, no quotes.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      console.error('[check-in-scheduler] LLM request failed:', res.status);
      return '';
    }

    const data = await res.json();
    const text = data.content?.[0]?.text?.trim() || '';
    return text;
  } catch (err) {
    console.error('[check-in-scheduler] LLM error:', err);
    return '';
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const unauthorized = requireCronAuth(req, corsHeaders);
  if (unauthorized) return unauthorized;

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const now = new Date();

    // Auto-retire threads older than 21 days
    const twentyOneDaysAgo = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from('memory_items')
      .update({ status: 'retired' })
      .eq('kind', 'thread')
      .eq('status', 'active')
      .lt('created_at', twentyOneDaysAgo)
      .then(() => {})
      .catch(() => {});

    const HOUR = 60 * 60 * 1000;
    const iso = (msAgo: number) => new Date(now.getTime() - msAgo).toISOString();

    const { data: allActive, error: fetchError } = await supabase
      .from('companions')
      .select('id, user_id, custom_name, relationship_type, last_message_at')
      .eq('is_active', true);
    if (fetchError) throw new Error(`Failed to fetch companions: ${fetchError.message}`);

    const byUser = new Map<string, Companion[]>();
    for (const c of (allActive ?? []) as Companion[]) {
      if (!byUser.has(c.user_id)) byUser.set(c.user_id, []);
      byUser.get(c.user_id)!.push(c);
    }

    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, subscription_tier, is_super_user')
      .in('id', Array.from(byUser.keys()));
    const tierMap = new Map<string, string>();
    for (const p of profiles ?? []) {
      tierMap.set(p.id, p.is_super_user ? 'elite' : (p.subscription_tier || 'free'));
    }

    let processed = 0;
    const skipped: Record<string, number> = {};
    const skip = (why: string) => { skipped[why] = (skipped[why] ?? 0) + 1; };

    for (const [userId, companions] of byUser) {
      // "Not often": at most one proactive message per person every 6 hours, from anyone.
      const { data: recentAny } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', userId)
        .eq('metadata->>type', 'check_in')
        .gte('created_at', iso(6 * HOUR))
        .limit(1);
      if (recentAny && recentAny.length > 0) { skip('user_recently_messaged'); continue; }

      const tier = tierMap.get(userId) || 'free';
      const candidates: Array<{ companion: Companion; reason: Reason }> = [];

      for (const companion of companions) {
        const isMentor = companion.relationship_type === 'mentor' || companion.relationship_type === 'assistant';
        // Coach and assistant check-ins are a paid feature.
        if (isMentor && tier === 'free') continue;

        const [{ data: lastProactive }, { data: lastUserMsg }] = await Promise.all([
          supabase.from('conversations').select('id')
            .eq('user_id', userId).eq('companion_id', companion.id)
            .eq('metadata->>type', 'check_in').gte('created_at', iso(24 * HOUR)).limit(1),
          supabase.from('conversations').select('created_at')
            .eq('user_id', userId).eq('companion_id', companion.id).eq('role', 'user')
            .order('created_at', { ascending: false }).limit(1),
        ]);
        // Once a day per companion at most.
        if (lastProactive && lastProactive.length > 0) continue;
        const lastUserAt = lastUserMsg?.[0]?.created_at ? new Date(lastUserMsg[0].created_at).getTime() : null;
        // Mid-conversation with this companion: they'll bring it up themselves.
        if (lastUserAt !== null && now.getTime() - lastUserAt < 2 * HOUR) continue;

        let reason: Reason | null = null;

        if (isMentor) {
          const { data: commits } = await supabase
            .from('coaching_commitments')
            .select('description, due_date, status, updated_at')
            .eq('user_id', userId).eq('companion_id', companion.id)
            .in('status', ['pending', 'in_progress', 'missed'])
            .order('due_date', { ascending: true, nullsFirst: false })
            .limit(10);
          const list = (commits ?? []) as Array<{ description: string; due_date: string | null; status: string; updated_at: string | null }>;
          const missed = list.find(c => c.status === 'missed' && c.updated_at && new Date(c.updated_at).getTime() > now.getTime() - 48 * HOUR);
          const today = now.toISOString().slice(0, 10);
          const dueToday = list.find(c => c.status !== 'missed' && c.due_date && c.due_date.slice(0, 10) === today);
          const tomorrow = new Date(now.getTime() + 24 * HOUR).toISOString().slice(0, 10);
          const dueTomorrow = list.find(c => c.status !== 'missed' && c.due_date && c.due_date.slice(0, 10) === tomorrow);
          let stepToday: { title: string; duration_minutes: number | null } | undefined;
          if (!missed && !dueToday) {
            const { data: steps } = await supabase
              .from('coach_plan_steps')
              .select('title, duration_minutes, coach_plans!inner(user_id, companion_id, status)')
              .eq('coach_plans.user_id', userId).eq('coach_plans.companion_id', companion.id).eq('coach_plans.status', 'active')
              .eq('scheduled_for', today).in('status', ['pending', 'in_progress'])
              .limit(1);
            stepToday = (steps ?? [])[0] as { title: string; duration_minutes: number | null } | undefined;
          }
          if (missed) {
            reason = { kind: 'commitment_missed', detail: `the missed commitment was "${missed.description}"` };
          } else if (dueToday) {
            reason = { kind: 'commitment_due_today', detail: `today's commitment is "${dueToday.description}"` };
          } else if (stepToday) {
            reason = { kind: 'step_today', detail: `today's step is "${stepToday.title}"${stepToday.duration_minutes ? `, about ${stepToday.duration_minutes} minutes` : ''}` };
          } else if (dueTomorrow) {
            reason = { kind: 'commitment_due_tomorrow', detail: `tomorrow's commitment is "${dueTomorrow.description}"` };
          } else {
            const { data: waiting } = await supabase
              .from('coach_plans').select('title')
              .eq('user_id', userId).eq('companion_id', companion.id).eq('status', 'proposed')
              .lt('created_at', iso(24 * HOUR)).limit(1);
            if (waiting && waiting.length > 0) {
              reason = { kind: 'plan_awaiting', detail: `the plan is "${(waiting[0] as { title: string }).title}"` };
            }
          }
        } else {
          // Something they mentioned that's worth following up on.
          const { data: threads } = await supabase
            .from('memory_items')
            .select('content, companion_id, scope')
            .eq('user_id', userId).eq('kind', 'thread').eq('status', 'active')
            .gte('updated_at', iso(7 * 24 * HOUR)).lt('updated_at', iso(24 * HOUR))
            .or(`and(scope.eq.global,companion_id.is.null),and(scope.eq.companion,companion_id.eq.${companion.id})`)
            .order('updated_at', { ascending: false })
            .limit(1);
          const thread = (threads ?? [])[0] as { content: string } | undefined;
          if (thread) {
            reason = { kind: 'follow_up', detail: `what they mentioned: "${thread.content}"` };
          }
        }

        if (!reason) {
          const lastContact = lastUserAt ?? (companion.last_message_at ? new Date(companion.last_message_at).getTime() : null);
          const gapDays = lastContact === null ? 7 : Math.floor((now.getTime() - lastContact) / (24 * HOUR));
          if (gapDays >= 4) reason = { kind: 'long_gap', detail: 'it has been a while since you last talked', gapDays };
        }

        if (reason) candidates.push({ companion, reason });
      }

      if (candidates.length === 0) { skip('no_reason'); continue; }
      candidates.sort((x, y) => REASON_PRIORITY.indexOf(x.reason.kind) - REASON_PRIORITY.indexOf(y.reason.kind));
      const { companion, reason } = candidates[0];

      // Fetch relevant memories: shared (global) + this companion's scoped memories
      const { data: memories } = await supabase
        .from('memory_items')
        .select('id, kind, content, scope, companion_id, shared_origin_companion_id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .in('kind', ['fact', 'person', 'thread'])
        .or(`and(scope.eq.global,companion_id.is.null),and(scope.eq.companion,companion_id.eq.${companion.id})`)
        .order('updated_at', { ascending: false })
        .limit(15);

      // Filter out boundary memories (things the user said not to bring up)
      const { data: boundaries } = await supabase
        .from('memory_items')
        .select('content')
        .eq('user_id', userId)
        .eq('kind', 'boundary')
        .eq('status', 'active');
      const boundaryContents = (boundaries || []).map(b => b.content.toLowerCase());
      const filteredMemories = (memories || []).filter(m => {
        const contentLower = m.content.toLowerCase();
        return !boundaryContents.some(b => contentLower.includes(b) || b.includes(contentLower));
      });
      if (boundaryContents.some(b => reason.detail.toLowerCase().includes(b))) { skip('boundary'); continue; }

      const companionNameMap = new Map<string, string>();
      for (const c of companions) {
        if (c.custom_name) companionNameMap.set(c.id, c.custom_name);
      }

      let openCommitments: Array<{ description: string; due_date: string | null; status: string }> = [];
      if (companion.relationship_type === 'mentor' || companion.relationship_type === 'assistant') {
        const { data: commitments } = await supabase
          .from('coaching_commitments')
          .select('description, due_date, status')
          .eq('user_id', userId)
          .eq('companion_id', companion.id)
          .in('status', ['pending', 'missed'])
          .order('due_date', { ascending: true, nullsFirst: false })
          .limit(3);
        openCommitments = commitments || [];
      }

      const checkInText = await generateCheckInMessage(companion, reason, filteredMemories, openCommitments, companionNameMap);
      if (!checkInText) { skip('generation_failed'); continue; }

      // Lands in the same thread as the chat screen and the dock, so memory carries over.
      const { error: insertError } = await supabase
        .from('conversations')
        .insert({
          user_id: userId,
          companion_id: companion.id,
          role: 'assistant',
          content: checkInText,
          message_type: 'text',
          metadata: { type: 'check_in', reason: reason.kind, ...(reason.kind === 'long_gap' ? { gap_days: reason.gapDays } : {}) },
          client_message_id: crypto.randomUUID(),
        });
      if (insertError) {
        console.error('[check-in-scheduler] insert failed:', insertError.message);
        skip('insert_failed');
        continue;
      }

      // Do NOT update last_message_at — that would erase the real gap.
      processed++;
    }

    return new Response(
      JSON.stringify({ processed, users: byUser.size, skipped }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error in proactive check-in scheduler:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

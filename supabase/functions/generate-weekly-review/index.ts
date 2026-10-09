import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { requireCronAuth } from "../_shared/cronAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

interface CommitmentRow {
  description: string;
  status: string;
  due_date: string | null;
  completed_at: string | null;
  companion_id: string;
}

interface GoalRow {
  title: string;
  goal_type: string;
  current_value: number | null;
  target_value: number | null;
  status: string;
}

interface SessionRow {
  summary: string | null;
  opened_at: string;
  closed_at: string | null;
  companion_id: string;
}

interface CompanionRow {
  id: string;
  custom_name: string;
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
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Find all users who have coaching activity in the last 7 days
    const { data: activeUsers, error: usersErr } = await supabase
      .from('coaching_commitments')
      .select('user_id')
      .gte('created_at', weekAgo)
      .limit(500);

    if (usersErr) throw new Error(`Failed to fetch active users: ${usersErr.message}`);

    // Also include users with coaching sessions this week
    const { data: sessionUsers } = await supabase
      .from('coaching_sessions')
      .select('user_id')
      .gte('opened_at', weekAgo)
      .limit(500);

    const userIds = new Set<string>();
    for (const r of activeUsers ?? []) userIds.add(r.user_id);
    for (const r of sessionUsers ?? []) userIds.add(r.user_id);

    if (userIds.size === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: 'No active coaching users this week' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let processed = 0;

    // Fetch subscription tiers for all active users in one query
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, subscription_tier, is_super_user')
        .in('id', Array.from(userIds));

      const tierMap = new Map<string, string>();
      for (const p of profiles ?? []) {
        const tier = p.is_super_user ? 'elite' : (p.subscription_tier || 'free');
        tierMap.set(p.id, tier);
      }

    for (const userId of userIds) {
      // Skip free-tier users — weekly review is a paid feature
      const userTier = tierMap.get(userId) || 'free';
      if (userTier === 'free') continue;

      // Check if a review already exists for this week
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay()); // Sunday start
      weekStart.setHours(0, 0, 0, 0);
      const weekStartStr = weekStart.toISOString().slice(0, 10);

      const { data: existing } = await supabase
        .from('weekly_reviews')
        .select('id')
        .eq('user_id', userId)
        .eq('week_starting', weekStartStr)
        .maybeSingle();

      if (existing) continue;

      // Gather the week's data
      const { data: commitments } = await supabase
        .from('coaching_commitments')
        .select('description, status, due_date, completed_at, companion_id')
        .eq('user_id', userId)
        .gte('created_at', weekAgo)
        .order('created_at', { ascending: false })
        .limit(50) as unknown as { data: CommitmentRow[] | null };

      const { data: goals } = await supabase
        .from('user_goals')
        .select('title, goal_type, current_value, target_value, status')
        .eq('user_id', userId)
        .in('status', ['active', 'completed'])
        .order('created_at', { ascending: false })
        .limit(10) as unknown as { data: GoalRow[] | null };

      const { data: sessions } = await supabase
        .from('coaching_sessions')
        .select('summary, opened_at, closed_at, companion_id')
        .eq('user_id', userId)
        .gte('opened_at', weekAgo)
        .order('opened_at', { ascending: false })
        .limit(20) as unknown as { data: SessionRow[] | null };

      // Get companion names
      const companionIds = new Set<string>();
      for (const c of commitments ?? []) companionIds.add(c.companion_id);
      for (const s of sessions ?? []) companionIds.add(s.companion_id);

      const { data: companions } = await supabase
        .from('companions')
        .select('id, custom_name')
        .in('id', Array.from(companionIds)) as unknown as { data: CompanionRow[] | null };

      const companionNames = new Map<string, string>();
      for (const c of companions ?? []) {
        companionNames.set(c.id, c.custom_name);
      }

      // Compute stats
      const kept = (commitments ?? []).filter(c => c.status === 'completed').length;
      const missed = (commitments ?? []).filter(c => c.status === 'missed').length;
      const pending = (commitments ?? []).filter(c => c.status === 'pending').length;
      const total = (commitments ?? []).length;

      // Skip users with no real activity
      if (total === 0 && (sessions ?? []).length === 0) continue;

      // Build context for the LLM
      const commitmentLines = (commitments ?? []).slice(0, 15).map(c => {
        const statusLabel = c.status === 'completed' ? '[COMPLETED]' : c.status === 'missed' ? '[MISSED]' : '[PENDING]';
        return `- ${c.description} ${statusLabel}`;
      }).join('\n');

      const goalLines = (goals ?? []).map(g => {
        const pct = g.target_value && Number(g.target_value) > 0
          ? Math.round((Number(g.current_value || 0) / Number(g.target_value)) * 100)
          : 0;
        const statusLabel = g.status === 'completed' ? '[COMPLETED]' : `[${pct}% there]`;
        return `- ${g.title} (${g.goal_type}) ${statusLabel}`;
      }).join('\n');

      const sessionLines = (sessions ?? []).filter(s => s.summary).slice(0, 5).map(s => {
        const coachName = companionNames.get(s.companion_id) || 'your coach';
        return `- Session with ${coachName}: ${s.summary}`;
      }).join('\n');

      const coachName = companionNames.values().next().value || 'your coach';

      const prompt = `You are ${coachName}, the user's AI coach. It's the end of the week — write a brief, warm weekly review for the user.

Here's what happened this week:

COMMITMENTS (${total} total, ${kept} kept, ${missed} missed, ${pending} pending):
${commitmentLines || '(none this week)'}

GOALS:
${goalLines || '(no active goals)'}

SESSION SUMMARIES:
${sessionLines || '(no sessions this week)'}

Write a weekly review that:
1. Opens with a genuine, specific observation about their week (not generic praise)
2. Highlights 1-2 wins — things they actually followed through on
3. If there were misses, acknowledge them without shame — frame as "what got in the way?"
4. End with ONE specific, forward-looking question or nudge for next week

Rules:
- Keep it 150-200 words, conversational, like a real message from a coach who cares
- NEVER use bullet points or headers — write it as a flowing message
- Be specific — reference actual commitments and goals by name
- If the week was light, say so honestly but warmly
- Don't use exclamation marks excessively
- Sound like you remember the week, not like you're reading a report
- Write only the review message, no preamble, no quotes`;

      let reviewText = '';
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 400,
            messages: [{ role: 'user', content: prompt }],
          }),
        });

        if (res.ok) {
          const data = await res.json();
          reviewText = data.content?.[0]?.text?.trim() || '';
        }
      } catch (llmErr) {
        console.error('[weekly-review] LLM error for user', userId, llmErr);
      }

      // Fallback: generate a simple stats-based review
      if (!reviewText) {
        const winWord = kept > 0 ? `You followed through on ${kept} commitment${kept > 1 ? 's' : ''} this week.` : '';
        const missWord = missed > 0 ? ` ${missed} slipped through the cracks — worth figuring out what got in the way.` : '';
        const pendingWord = pending > 0 ? ` You've got ${pending} still open heading into next week.` : '';
        reviewText = `Here's your week in review. ${winWord}${missWord}${pendingWord} Let's build on this next week.`.trim();
      }

      // Store the review
      const { error: insertErr } = await supabase
        .from('weekly_reviews')
        .insert({
          user_id: userId,
          week_starting: weekStartStr,
          review_text: reviewText,
          stats: {
            commitments_total: total,
            commitments_kept: kept,
            commitments_missed: missed,
            commitments_pending: pending,
            sessions_count: (sessions ?? []).length,
            goals_active: (goals ?? []).filter(g => g.status === 'active').length,
            goals_completed: (goals ?? []).filter(g => g.status === 'completed').length,
          },
          companion_id: companionIds.size > 0 ? Array.from(companionIds)[0] : null,
        });

      if (insertErr) {
        console.error('[weekly-review] Insert error for user', userId, insertErr);
        continue;
      }

      processed++;
    }

    return new Response(
      JSON.stringify({ processed, totalUsers: userIds.size }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('[weekly-review] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { buildDailyCheckInNudge, coachSelfInitiates, checkInStalenessHours } from '../_shared/coachFramework.ts';
import { resolveCoachDials } from '../_shared/resolveCoachDials.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    // Loosest candidate window across all accountability levels (firm coaches
    // follow up soonest, at 18h). Exact per-coach staleness is checked below,
    // once we know that coach's actual dials.
    const loosestCandidateWindow = new Date(now.getTime() - 18 * 60 * 60 * 1000).toISOString();

    // Find candidate mentor companions that MIGHT be stale — narrowed exactly
    // per-coach below, since how long a coach waits before following up
    // depends on its accountability level.
    const { data: candidateCoaches, error: fetchError } = await supabase
      .from('companions')
      .select('id, user_id, custom_name, last_message_at, signature_expert, signature_expert_source')
      .eq('relationship_type', 'mentor')
      .eq('is_active', true)
      .or(`last_message_at.is.null,last_message_at.lt.${loosestCandidateWindow}`);

    if (fetchError) {
      throw new Error(`Failed to fetch stale coaches: ${fetchError.message}`);
    }

    if (!candidateCoaches || candidateCoaches.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: 'No stale coaches' }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let processed = 0;
    for (const coach of candidateCoaches) {
      const dials = await resolveCoachDials(supabase, coach.user_id, coach);

      // A 'responsive' coach never self-initiates — it "follows their lead
      // on timing" per its own system prompt. Background jobs must honor
      // that, not just the live chat prompt.
      if (!coachSelfInitiates(dials.checkInStyle)) continue;

      // Per-coach staleness: firm coaches follow up sooner than gentle ones.
      const staleAfterMs = checkInStalenessHours(dials.accountabilityLevel) * 60 * 60 * 1000;
      const lastMessageAt = coach.last_message_at ? new Date(coach.last_message_at).getTime() : 0;
      if (now.getTime() - lastMessageAt < staleAfterMs) continue;

      // Check if there's already a proactive message in the last 24h
      const { data: recentProactive } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', coach.user_id)
        .eq('companion_id', coach.id)
        .eq('role', 'assistant')
        .gte('created_at', twentyFourHoursAgo)
        .limit(1);

      if (recentProactive && recentProactive.length > 0) continue;

      // Fetch open commitments for a personalized, accountability-aware check-in
      const { data: openCommitments } = await supabase
        .from('coaching_commitments')
        .select('description, due_date')
        .eq('user_id', coach.user_id)
        .eq('companion_id', coach.id)
        .eq('status', 'pending')
        .order('due_date', { ascending: true })
        .limit(1);

      const checkInText = buildDailyCheckInNudge({
        domain: dials.domain,
        accountabilityLevel: dials.accountabilityLevel,
        commitmentDescription: openCommitments && openCommitments.length > 0 ? openCommitments[0].description : null,
      });

      await supabase
        .from('conversations')
        .insert({
          user_id: coach.user_id,
          companion_id: coach.id,
          role: 'assistant',
          content: checkInText,
          metadata: { type: 'proactive_check_in' },
          client_message_id: `proactive_${coach.id}_${Date.now()}`,
        });

      // Update last_message_at so this coach doesn't get pinged again immediately
      await supabase
        .from('companions')
        .update({ last_message_at: now.toISOString() })
        .eq('id', coach.id);

      processed++;
    }

    return new Response(
      JSON.stringify({ processed, total: candidateCoaches.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error('Error in proactive check-in scheduler:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const cronSecret = Deno.env.get('CRON_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (cronSecret) {
    const provided = req.headers.get('X-Cron-Secret');
    if (provided !== cronSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    // Find mentor companions whose last message was > 24h ago
    const { data: staleCoaches, error: fetchError } = await supabase
      .from('companions')
      .select('id, user_id, custom_name, last_message_at')
      .eq('relationship_type', 'mentor')
      .eq('is_active', true)
      .or(`last_message_at.is.null,last_message_at.lt.${twentyFourHoursAgo}`);

    if (fetchError) {
      throw new Error(`Failed to fetch stale coaches: ${fetchError.message}`);
    }

    if (!staleCoaches || staleCoaches.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: 'No stale coaches' }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let processed = 0;
    for (const coach of staleCoaches) {
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

      // Fetch open commitments for a personalized check-in
      const { data: openCommitments } = await supabase
        .from('coaching_commitments')
        .select('description, due_date')
        .eq('user_id', coach.user_id)
        .eq('companion_id', coach.id)
        .eq('status', 'pending')
        .order('due_date', { ascending: true })
        .limit(1);

      let checkInText: string;
      if (openCommitments && openCommitments.length > 0) {
        const c = openCommitments[0];
        checkInText = `Hey — checking in on your commitment to "${c.description}". How's it going?`;
      } else {
        const greetings = [
          "Hey, haven't heard from you in a bit. How are things going with your goals?",
          "Checking in! What's been on your mind lately?",
          "Just wanted to see how you're doing. Any progress you want to talk through?",
        ];
        checkInText = greetings[Math.floor(Math.random() * greetings.length)];
      }

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
      JSON.stringify({ processed, total: staleCoaches.length }),
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

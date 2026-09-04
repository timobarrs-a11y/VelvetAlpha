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

  const cronSecret = Deno.env.get('CRON_SECRET');
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

    const now = new Date().toISOString();

    const { data: overdue, error: fetchError } = await supabase
      .from('coaching_commitments')
      .select('id, user_id, companion_id, description, due_date')
      .eq('status', 'pending')
      .not('due_date', 'is', null)
      .lt('due_date', now);

    if (fetchError) {
      throw new Error(`Failed to fetch overdue commitments: ${fetchError.message}`);
    }

    if (!overdue || overdue.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: 'No overdue commitments' }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let processed = 0;
    for (const commitment of overdue) {
      const { error: updateError } = await supabase
        .from('coaching_commitments')
        .update({ status: 'missed', updated_at: now })
        .eq('id', commitment.id);

      if (updateError) {
        console.error(`Failed to mark commitment ${commitment.id} as missed:`, updateError.message);
        continue;
      }

      const { data: conversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', commitment.user_id)
        .eq('companion_id', commitment.companion_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (conversation) {
        await supabase
          .from('conversations')
          .insert({
            user_id: commitment.user_id,
            companion_id: commitment.companion_id,
            role: 'assistant',
            content: `Following up on your commitment to "${commitment.description}" — it looks like the due date passed. How did it go? No judgment, just want to help you get back on track.`,
            metadata: { type: 'commitment_follow_up', commitment_id: commitment.id },
            client_message_id: `commitment_${commitment.id}_${Date.now()}`,
          });
      }

      processed++;
    }

    return new Response(
      JSON.stringify({ processed, total: overdue.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error('Error sweeping overdue commitments:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

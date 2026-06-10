import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();

    const { data: pendingCallbacks, error: fetchError } = await supabase
      .from('scheduled_callbacks')
      .select('*')
      .eq('completed', false)
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true })
      .limit(50);

    if (fetchError) {
      throw new Error(`Failed to fetch callbacks: ${fetchError.message}`);
    }

    if (!pendingCallbacks || pendingCallbacks.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: 'No pending callbacks' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let processed = 0;
    const errors: string[] = [];

    for (const callback of pendingCallbacks) {
      try {
        const { error: updateError } = await supabase
          .from('scheduled_callbacks')
          .update({
            completed: true,
            completed_at: new Date().toISOString(),
          })
          .eq('id', callback.id);

        if (updateError) {
          errors.push(`Callback ${callback.id}: ${updateError.message}`);
          continue;
        }

        processed++;
      } catch (err) {
        errors.push(`Callback ${callback.id}: ${err.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        processed,
        total: pendingCallbacks.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error processing scheduled callbacks:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

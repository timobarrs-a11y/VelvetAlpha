import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { executeCoachTool } from '../_shared/coachTools.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

/**
 * Thin authenticated wrapper around the shared coach tool executor. chat-turn runs the
 * same executor in-process; this endpoint exists for any client that needs to invoke a
 * tool directly. All ids are verified against the caller inside executeCoachTool.
 *
 * Body: { tool: string, companionId: string, input: object }
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return json({ error: 'unauthorized' }, 401);

    const body = await req.json().catch(() => null);
    const tool = body?.tool;
    const companionId = body?.companionId;
    const input = body?.input && typeof body.input === 'object' ? body.input : {};
    if (typeof tool !== 'string' || typeof companionId !== 'string') {
      return json({ error: 'tool and companionId are required' }, 400);
    }

    const { data: companion } = await admin
      .from('companions')
      .select('id, relationship_type')
      .eq('id', companionId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!companion) return json({ error: 'companion not found' }, 404);
    if (companion.relationship_type !== 'mentor') return json({ error: 'not a coach' }, 403);

    const outcome = await executeCoachTool(admin, user.id, companionId, tool, input);
    return json({ success: !outcome.isError, ...outcome.result, ...(outcome.artifact ? { artifact: outcome.artifact } : {}) }, outcome.isError ? 400 : 200);
  } catch (err) {
    console.error('[coach-tools] error:', err);
    return json({ error: 'internal error' }, 500);
  }
});

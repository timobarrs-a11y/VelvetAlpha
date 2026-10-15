import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { action, companionId, payload } = body;

    // Verify the companion belongs to this user
    if (companionId) {
      const { data: companion } = await supabaseAdmin
        .from('companions')
        .select('id, relationship_type')
        .eq('id', companionId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!companion) {
        return new Response(JSON.stringify({ error: 'companion not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (companion.relationship_type !== 'mentor') {
        return new Response(JSON.stringify({ error: 'not a coach' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    let result: unknown;

    switch (action) {
      case 'create_plan': {
        const { title, description, cadence, goalId, steps } = payload;
        const { data: plan, error } = await supabaseAdmin
          .from('coach_plans')
          .insert({
            user_id: user.id,
            companion_id: companionId,
            goal_id: goalId ?? null,
            title,
            description: description ?? null,
            cadence: cadence ?? null,
            status: 'active',
          })
          .select('id')
          .maybeSingle();
        if (error || !plan) throw new Error('Failed to create plan');

        if (steps && steps.length > 0) {
          const stepRows = steps.map((s: Record<string, unknown>, i: number) => ({
            plan_id: plan.id,
            title: s.title as string,
            description: s.description ?? null,
            coach_proposed_title: s.title as string,
            coach_minimum: s.coach_minimum ?? null,
            order_index: i,
            status: 'pending',
          }));
          await supabaseAdmin.from('coach_plan_steps').insert(stepRows);
        }

        result = { planId: plan.id };
        break;
      }

      case 'add_step': {
        const { planId, title, description, coachMinimum } = payload;
        // Get current max order_index
        const { data: existing } = await supabaseAdmin
          .from('coach_plan_steps')
          .select('order_index')
          .eq('plan_id', planId)
          .order('order_index', { ascending: false })
          .limit(1)
          .maybeSingle();
        const nextIndex = (existing?.order_index ?? -1) + 1;

        const { data: step, error } = await supabaseAdmin
          .from('coach_plan_steps')
          .insert({
            plan_id: planId,
            title,
            description: description ?? null,
            coach_proposed_title: title,
            coach_minimum: coachMinimum ?? null,
            order_index: nextIndex,
            status: 'pending',
          })
          .select('id')
          .maybeSingle();
        if (error || !step) throw new Error('Failed to add step');
        result = { stepId: step.id };
        break;
      }

      case 'create_commitment': {
        const { description, dueDate, goalId, planStepId } = payload;
        const { data: commit, error } = await supabaseAdmin
          .from('coaching_commitments')
          .insert({
            user_id: user.id,
            companion_id: companionId,
            goal_id: goalId ?? null,
            plan_step_id: planStepId ?? null,
            description,
            due_date: dueDate ?? null,
            status: 'pending',
            is_user_created: false,
          })
          .select('id')
          .maybeSingle();
        if (error || !commit) throw new Error('Failed to create commitment');
        result = { commitmentId: commit.id };
        break;
      }

      case 'adjust_step': {
        const { stepId, newTitle, newMinimum, override } = payload;
        const update: Record<string, unknown> = {};
        if (newTitle) update.title = newTitle;
        if (newMinimum !== undefined) update.coach_minimum = newMinimum;

        // Log the override
        if (override) {
          const { data: step } = await supabaseAdmin
            .from('coach_plan_steps')
            .select('title, override_log')
            .eq('id', stepId)
            .maybeSingle();
          if (step) {
            const log = Array.isArray(step.override_log) ? step.override_log : [];
            log.push({
              action: override.action,
              from: override.from,
              to: override.to,
              reason: override.reason,
              at: new Date().toISOString(),
            });
            update.override_log = log;
          }
        }

        const { error } = await supabaseAdmin
          .from('coach_plan_steps')
          .update(update)
          .eq('id', stepId);
        if (error) throw new Error('Failed to adjust step');
        result = { success: true };
        break;
      }

      case 'create_artifact': {
        const { artifactType, title, content, goalId, planId } = payload;
        const { data: artifact, error } = await supabaseAdmin
          .from('coach_artifacts')
          .insert({
            user_id: user.id,
            companion_id: companionId,
            goal_id: goalId ?? null,
            plan_id: planId ?? null,
            artifact_type: artifactType,
            title,
            content: content ?? {},
            status: 'proposed',
          })
          .select('id, artifact_type, title, content')
          .maybeSingle();
        if (error || !artifact) throw new Error('Failed to create artifact');
        result = { artifact };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: 'unknown action' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

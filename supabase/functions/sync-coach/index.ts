import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { CURATED_EXPERT_MAP, getCuratedExpert } from "../_shared/coachFramework.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ExpertEntry {
  id: string;
  domain: string;
  goalTypes: string[];
  accountabilityLevel: string;
  premium: boolean;
}

const EXPERT_INDEX: Record<string, ExpertEntry> = Object.fromEntries(
  Object.entries(CURATED_EXPERT_MAP).map(([id, e]) => [
    id,
    {
      id,
      domain: e.domain,
      goalTypes: e.goalTypes,
      accountabilityLevel: e.accountabilityLevel,
      premium: e.premium,
    },
  ])
);

function pickExpert(goalType: string, accountabilityLevel: string): string {
  const matching = Object.values(EXPERT_INDEX).filter(e => e.goalTypes.includes(goalType));
  if (matching.length === 0) return "fitness_hype";
  if (matching.length === 1) return matching[0].id;

  const byAccountability = matching.filter(e => e.accountabilityLevel === accountabilityLevel);
  if (byAccountability.length > 0) {
    return byAccountability[Math.floor(Math.random() * byAccountability.length)].id;
  }
  const freeMatches = matching.filter(e => !e.premium);
  if (freeMatches.length > 0) {
    return freeMatches[Math.floor(Math.random() * freeMatches.length)].id;
  }
  return matching[Math.floor(Math.random() * matching.length)].id;
}

const COACH_NAMES_MALE = ["Marcus", "Derek", "James", "Andre", "Theo", "Kai", "Victor"];
const COACH_NAMES_FEMALE = ["Maya", "Sofia", "Nadia", "Elena", "Priya", "Zara", "Dana", "Liv"];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(jwt);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const goalType: string = body.goalType || "habit";
    const accountabilityLevel: string = body.accountabilityLevel || "moderate";
    const coachName: string | undefined = body.coachName;
    const coachGender: string | undefined = body.coachGender;
    const expertId: string | undefined = body.expertId;

    const { data: existingCoach } = await supabaseAdmin
      .from("companions")
      .select("id")
      .eq("user_id", user.id)
      .eq("relationship_type", "mentor")
      .eq("is_active", true)
      .maybeSingle();

    if (existingCoach) {
      const { error: updateGoalErr } = await supabaseAdmin
        .from("user_goals")
        .update({ source_companion_id: existingCoach.id })
        .eq("user_id", user.id)
        .eq("status", "active")
        .is("source_companion_id", null);

      if (updateGoalErr) {
        console.error("[sync-coach] Failed to link existing coach to goal:", updateGoalErr);
      }

      return new Response(JSON.stringify({
        success: true,
        coachId: existingCoach.id,
        alreadyExisted: true,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resolvedExpertId = expertId && getCuratedExpert(expertId)
      ? expertId
      : pickExpert(goalType, accountabilityLevel);
    const expert = getCuratedExpert(resolvedExpertId);

    const gender = coachGender === "male" || coachGender === "female" ? coachGender : (Math.random() > 0.5 ? "male" : "female");
    const finalCoachName = coachName || (() => {
      const namePool = gender === "male" ? COACH_NAMES_MALE : COACH_NAMES_FEMALE;
      return namePool[Math.floor(Math.random() * namePool.length)];
    })();

    const { data: newCoach, error: createError } = await supabaseAdmin
      .from("companions")
      .insert({
        user_id: user.id,
        gender,
        relationship_type: "mentor",
        custom_name: finalCoachName,
        signature_expert: resolvedExpertId,
        hobbies: [],
        sports: [],
        first_message_sent: false,
        is_active: true,
        last_message_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle();

    if (createError || !newCoach) {
      console.error("[sync-coach] Failed to create coach companion:", createError);
      return new Response(JSON.stringify({ error: "Failed to create coach" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: linkError } = await supabaseAdmin
      .from("user_goals")
      .update({ source_companion_id: newCoach.id })
      .eq("user_id", user.id)
      .eq("status", "active")
      .is("source_companion_id", null);

    if (linkError) {
      console.error("[sync-coach] Failed to link coach to goal:", linkError);
    }

    return new Response(JSON.stringify({
      success: true,
      coachId: newCoach.id,
      coachName: finalCoachName,
      expertId: resolvedExpertId,
      expertDomain: expert?.domain || "",
      alreadyExisted: false,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[sync-coach] error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ExpertEntry {
  id: string;
  name: string;
  domain: string;
  category: string;
  description: string;
  instruction: string;
  goalTypes: string[];
  checkInStyle: string;
  accountabilityLevel: string;
  sampleInteraction: string;
  premium: boolean;
  source: string;
}

const SIGNATURE_EXPERTS: ExpertEntry[] = [
  { id: "fitness_hype", name: "The Hype Coach", domain: "fitness", category: "wellness", description: "Supportive fitness partner who celebrates every win.", instruction: "", goalTypes: ["health_fitness", "habit"], checkInStyle: "proactive", accountabilityLevel: "gentle", sampleInteraction: "", premium: false, source: "curated" },
  { id: "fitness_drill", name: "The Drill Sergeant", domain: "fitness", category: "wellness", description: "No-excuses accountability partner for serious gains.", instruction: "", goalTypes: ["health_fitness", "habit"], checkInStyle: "proactive", accountabilityLevel: "firm", sampleInteraction: "", premium: true, source: "curated" },
  { id: "wellness_guide", name: "The Wellness Guide", domain: "mental-wellness", category: "wellness", description: "Mindful guide for emotional balance and self-care.", instruction: "", goalTypes: ["habit", "health_fitness"], checkInStyle: "proactive", accountabilityLevel: "gentle", sampleInteraction: "", premium: true, source: "curated" },
  { id: "sleep_coach", name: "The Sleep Coach", domain: "sleep", category: "wellness", description: "Helps you fix your sleep and actually feel rested.", instruction: "", goalTypes: ["habit", "health_fitness"], checkInStyle: "proactive", accountabilityLevel: "gentle", sampleInteraction: "", premium: true, source: "curated" },
  { id: "interview_coach", name: "The Interview Coach", domain: "interview prep", category: "professional", description: "Runs mock interviews and sharpens your answers.", instruction: "", goalTypes: ["deadline", "habit"], checkInStyle: "structured", accountabilityLevel: "moderate", sampleInteraction: "", premium: false, source: "curated" },
  { id: "finance_mentor", name: "The Money Mentor", domain: "finance", category: "professional", description: "Practical financial guide for building better habits.", instruction: "", goalTypes: ["habit", "deadline"], checkInStyle: "structured", accountabilityLevel: "moderate", sampleInteraction: "", premium: true, source: "curated" },
  { id: "finance_tough", name: "The Budget Hawk", domain: "finance", category: "professional", description: "Blunt financial accountability — no sugarcoating.", instruction: "", goalTypes: ["habit", "deadline"], checkInStyle: "proactive", accountabilityLevel: "firm", sampleInteraction: "", premium: true, source: "curated" },
  { id: "career_advisor", name: "The Career Strategist", domain: "career", category: "professional", description: "Strategic career guide for growth and transitions.", instruction: "", goalTypes: ["deadline", "habit"], checkInStyle: "structured", accountabilityLevel: "moderate", sampleInteraction: "", premium: true, source: "curated" },
  { id: "communication_coach", name: "The Communication Coach", domain: "communication", category: "professional", description: "Helps you say the hard thing clearly and land it well.", instruction: "", goalTypes: ["habit", "deadline"], checkInStyle: "responsive", accountabilityLevel: "moderate", sampleInteraction: "", premium: true, source: "curated" },
  { id: "creative_muse", name: "The Muse", domain: "creativity", category: "creative", description: "Inspiring creative collaborator who sparks ideas.", instruction: "", goalTypes: ["creative", "habit"], checkInStyle: "responsive", accountabilityLevel: "gentle", sampleInteraction: "", premium: false, source: "curated" },
  { id: "writing_collaborator", name: "The Writing Partner", domain: "writing", category: "creative", description: "Focused writing accountability and craft development.", instruction: "", goalTypes: ["creative", "habit", "deadline"], checkInStyle: "proactive", accountabilityLevel: "moderate", sampleInteraction: "", premium: true, source: "curated" },
  { id: "brainstorm_partner", name: "The Idea Engine", domain: "brainstorming", category: "creative", description: "High-energy thought partner for any problem or project.", instruction: "", goalTypes: ["creative", "deadline"], checkInStyle: "responsive", accountabilityLevel: "gentle", sampleInteraction: "", premium: true, source: "curated" },
  { id: "study_partner", name: "The Study Partner", domain: "academics", category: "academic", description: "Focused study companion who keeps you on track.", instruction: "", goalTypes: ["deadline", "habit"], checkInStyle: "structured", accountabilityLevel: "moderate", sampleInteraction: "", premium: false, source: "curated" },
  { id: "language_tutor", name: "The Language Tutor", domain: "language learning", category: "academic", description: "Practice a new language in real conversation.", instruction: "", goalTypes: ["habit", "reading"], checkInStyle: "proactive", accountabilityLevel: "moderate", sampleInteraction: "", premium: true, source: "curated" },
  { id: "essay_architect", name: "The Essay Architect", domain: "academic writing", category: "academic", description: "Builds sharper essays, arguments, and papers.", instruction: "", goalTypes: ["deadline", "habit"], checkInStyle: "structured", accountabilityLevel: "moderate", sampleInteraction: "", premium: true, source: "curated" },
  { id: "stem_tutor", name: "The STEM Tutor", domain: "math & science", category: "academic", description: "Works through math and science step by step.", instruction: "", goalTypes: ["habit", "deadline"], checkInStyle: "responsive", accountabilityLevel: "moderate", sampleInteraction: "", premium: true, source: "curated" },
  { id: "chef_coach", name: "The Chef", domain: "cooking", category: "lifestyle", description: "Turns what you have into something worth eating.", instruction: "", goalTypes: ["habit", "health_fitness"], checkInStyle: "responsive", accountabilityLevel: "gentle", sampleInteraction: "", premium: false, source: "curated" },
  { id: "connection_coach", name: "The Connection Coach", domain: "social skills", category: "lifestyle", description: "Sharpens your social, dating, and relationship game.", instruction: "", goalTypes: ["habit", "deadline"], checkInStyle: "responsive", accountabilityLevel: "gentle", sampleInteraction: "", premium: true, source: "curated" },
  { id: "style_coach", name: "The Style Coach", domain: "personal style", category: "lifestyle", description: "Helps you dress like the best version of you.", instruction: "", goalTypes: ["habit", "creative"], checkInStyle: "responsive", accountabilityLevel: "gentle", sampleInteraction: "", premium: true, source: "curated" },
  { id: "home_coach", name: "The Home Coach", domain: "home & organization", category: "lifestyle", description: "Declutter, organize, and keep your space calm.", instruction: "", goalTypes: ["habit", "deadline"], checkInStyle: "proactive", accountabilityLevel: "moderate", sampleInteraction: "", premium: true, source: "curated" },
];

function pickExpert(goalType: string, accountabilityLevel: string): ExpertEntry {
  const matching = SIGNATURE_EXPERTS.filter(e => e.goalTypes.includes(goalType));
  if (matching.length === 0) {
    return SIGNATURE_EXPERTS.find(e => e.id === "fitness_hype") || SIGNATURE_EXPERTS[0];
  }
  if (matching.length === 1) return matching[0];

  const byAccountability = matching.filter(e => e.accountabilityLevel === accountabilityLevel);
  if (byAccountability.length > 0) {
    return byAccountability[Math.floor(Math.random() * byAccountability.length)];
  }
  const freeMatches = matching.filter(e => !e.premium);
  if (freeMatches.length > 0) {
    return freeMatches[Math.floor(Math.random() * freeMatches.length)];
  }
  return matching[Math.floor(Math.random() * matching.length)];
}

const COACH_NAMES_MALE = ["Marcus", "Derek", "James", "Andre", "Theo", "Kai", "Marcus", "Victor"];
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
    const goalText: string = body.goalText || "Personal growth";
    const accountabilityLevel: string = body.accountabilityLevel || "moderate";

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

    const expert = pickExpert(goalType, accountabilityLevel);
    const gender = Math.random() > 0.5 ? "male" : "female";
    const namePool = gender === "male" ? COACH_NAMES_MALE : COACH_NAMES_FEMALE;
    const coachName = namePool[Math.floor(Math.random() * namePool.length)];

    const { data: newCoach, error: createError } = await supabaseAdmin
      .from("companions")
      .insert({
        user_id: user.id,
        gender,
        relationship_type: "mentor",
        custom_name: coachName,
        signature_expert: expert.id,
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
      coachName,
      expertId: expert.id,
      expertName: expert.name,
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

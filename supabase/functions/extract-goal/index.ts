import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { MODEL_CONFIG } from "../_shared/modelConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const VALID_GOAL_TYPES = ["health_fitness", "habit", "deadline", "creative", "reading"];

const EXTRACTION_PROMPT = `You are an analysis engine. You receive a conversation transcript between Velvet (the host) and a new user. Your job is to extract structured data about the user's goal.

Read the conversation and return a JSON object with exactly these fields:

{
  "goalType": one of "health_fitness" | "habit" | "deadline" | "creative" | "reading",
  "goalText": "the user's goal in their own words, as a short phrase (max 15 words)",
  "accountabilityLevel": "gentle" | "moderate" | "firm",
  "confidence": 0.0 to 1.0
}

GUIDELINES:
- goalType: Map what the user said to the closest category. "Lose weight" → health_fitness. "Read more books" → reading. "Write a novel" → creative. "Stop biting nails" → habit. "Finish my thesis by May" → deadline. If truly ambiguous, pick the closest fit — never return null.
- goalText: Use the user's own words as much as possible. "Lose 20 pounds" not "weight loss goal".
- accountabilityLevel: Infer from the conversation. If the user said they want to be pushed, challenged, or held accountable → "firm". If they want patience, gentle encouragement → "gentle". If neutral or unclear → "moderate".
- confidence: How confident you are in the extraction. 1.0 = user stated the goal clearly. 0.5 = you had to infer. Below 0.3 = very uncertain.

Return ONLY the JSON object. No commentary, no markdown, no explanation.`;

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
    const transcript: Array<{ role: string; content: string }> = body.transcript || [];

    if (transcript.length === 0) {
      return new Response(JSON.stringify({ error: "Empty transcript" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const transcriptText = transcript
      .map(m => `${m.role === "velvet" ? "Velvet" : "User"}: ${m.content}`)
      .join("\n\n");

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL_CONFIG.HAIKU,
        max_tokens: 300,
        messages: [
          {
            role: "user",
            content: `${EXTRACTION_PROMPT}\n\n--- CONVERSATION TRANSCRIPT ---\n${transcriptText}\n--- END TRANSCRIPT ---\n\nReturn the JSON object now.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[extract-goal] Anthropic API error:", response.status, errText);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await response.json();
    const rawText: string = aiData.content?.[0]?.text || "";

    let extracted: { goalType: string; goalText: string; accountabilityLevel: string; confidence: number };
    try {
      const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      extracted = JSON.parse(cleaned);
    } catch {
      console.error("[extract-goal] Failed to parse AI response:", rawText);
      extracted = {
        goalType: "habit",
        goalText: "Personal growth",
        accountabilityLevel: "moderate",
        confidence: 0.3,
      };
    }

    if (!VALID_GOAL_TYPES.includes(extracted.goalType)) {
      extracted.goalType = "habit";
    }
    if (!["gentle", "moderate", "firm"].includes(extracted.accountabilityLevel)) {
      extracted.accountabilityLevel = "moderate";
    }
    if (typeof extracted.confidence !== "number" || isNaN(extracted.confidence)) {
      extracted.confidence = 0.5;
    }

    const { data: existingGoal } = await supabaseAdmin
      .from("user_goals")
      .select("id")
      .eq("user_id", user.id)
      .eq("source", "discovered")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const goalPayload = {
      user_id: user.id,
      title: extracted.goalText,
      goal_type: extracted.goalType,
      status: "active",
      source: "discovered",
      discovery_transcript: JSON.stringify(transcript),
      start_date: new Date().toISOString().split("T")[0],
    };

    if (existingGoal?.id) {
      const { error: goalError } = await supabaseAdmin
        .from("user_goals")
        .update({
          title: extracted.goalText,
          goal_type: extracted.goalType,
          discovery_transcript: JSON.stringify(transcript),
        })
        .eq("id", existingGoal.id);

      if (goalError) {
        console.error("[extract-goal] Failed to update goal:", goalError);
      }
    } else {
      const { error: goalError } = await supabaseAdmin
        .from("user_goals")
        .insert(goalPayload);

      if (goalError) {
        console.error("[extract-goal] Failed to insert goal:", goalError);
      }
    }

    return new Response(JSON.stringify({
      goalType: extracted.goalType,
      goalText: extracted.goalText,
      accountabilityLevel: extracted.accountabilityLevel,
      confidence: extracted.confidence,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[extract-goal] error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

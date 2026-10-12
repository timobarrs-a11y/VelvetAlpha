import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { MODEL_CONFIG } from "../_shared/modelConfig.ts";

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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY not configured");

    const { session_id, qa_pairs, ratings } = await req.json();

    if (!session_id || !qa_pairs || !Array.isArray(qa_pairs)) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const answeredQA = qa_pairs.filter((qa: any) => qa.answer && qa.answer.trim());

    const qaBlock = answeredQA.map((qa: any, i: number) =>
      `Q${i + 1}: ${qa.question}\nA: ${qa.answer}`
    ).join('\n\n');

    const ratingsBlock = ratings && (ratings.mood || ratings.energy || ratings.focus)
      ? `\n\nSelf-ratings (1-10):\n- Mood: ${ratings.mood || '—'}\n- Energy: ${ratings.energy || '—'}\n- Focus: ${ratings.focus || '—'}`
      : '';

    const systemPrompt = `You are a reflective journal companion. The user has answered a few morning questions and rated their mood, energy, and focus. Your job is to weave their answers into a single, cohesive journal entry that feels like their own voice on the page — warm, honest, and specific to what they shared.

Rules:
- Write in second person ("You woke up feeling...") — this is their journal, not yours
- 150-300 words. No fluff, no filler.
- Reference their specific answers — don't generalize. If they mentioned a person, a project, a feeling, use it.
- Weave in the ratings naturally ("Your energy is at a 4 today — no wonder the thought of that meeting feels heavy.")
- Find the thread connecting their answers. What's the underlying theme?
- End with one gentle, non-prescriptive forward-looking thought. No commands, no "you should." Just a horizon.
- Do not use headers, bullet points, or lists. This is prose.
- Match their emotional tone. If they're low, don't force optimism. If they're energized, ride that wave.`;

    const userMessage = `Here are my morning journal answers:\n\n${qaBlock}${ratingsBlock}\n\nWrite my journal entry for today.`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL_CONFIG.HAIKU,
        max_tokens: 800,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic error: ${res.status} ${errText}`);
    }

    const data = await res.json();
    const entry = data.content?.[0]?.text ?? "Journal entry unavailable right now.";

    return new Response(JSON.stringify({ entry }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[generate-journal-entry]", err);
    return new Response(
      JSON.stringify({ error: String(err), entry: null }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

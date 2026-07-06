import "jsr:@supabase/functions-js/edge-runtime.d.ts";
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
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY not configured");

    const { context, userName, todayLabel } = await req.json();

    const systemPrompt = `You are Navi, a sharp personal assistant delivering a morning brief. You're warm but direct — like a trusted chief of staff who knows the user well.

Rules:
- Never open with "Good morning!" or a generic greeting
- Lead with what's actually happening today (events, deadlines, goals)
- Weave in news naturally — don't just list headlines
- Keep it scannable: 150-250 words max
- Tone: concise, warm, intelligent. Like texting someone who gets it
- Use line breaks between sections for readability
- End with one short, energizing thought or question`;

    const contextBlock = context && context.trim()
      ? `\n\nPersonalized context for ${userName || "this user"}:\n${context}`
      : "";

    const userMessage = `It's ${todayLabel}. Compile my morning brief.${contextBlock}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL_CONFIG.HAIKU,
        max_tokens: 600,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic error: ${res.status} ${errText}`);
    }

    const data = await res.json();
    const response = data.content?.[0]?.text ?? "Brief unavailable right now.";

    return new Response(JSON.stringify({ response }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[morning-brief]", err);
    return new Response(
      JSON.stringify({ error: String(err), response: "Couldn't pull your brief right now. Try again in a moment." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

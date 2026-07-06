import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { MODEL_CONFIG } from "../_shared/modelConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MIN_MESSAGES = 4;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { user_id, companion_id, session_key } = await req.json();

    if (!user_id || !companion_id) {
      return new Response(
        JSON.stringify({ error: "user_id and companion_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch messages from this session (last 2 hours or since session_key)
    const since = session_key
      ? new Date(parseInt(session_key)).toISOString()
      : new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const { data: messages } = await supabase
      .from("conversations")
      .select("role, content, created_at")
      .eq("user_id", user_id)
      .eq("companion_id", companion_id)
      .gte("created_at", since)
      .order("created_at", { ascending: true });

    if (!messages || messages.length < MIN_MESSAGES) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "not enough messages" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const transcript = messages
      .map((m: { role: string; content: string }) => `${m.role === "user" ? "User" : "Companion"}: ${m.content}`)
      .join("\n");

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL_CONFIG.HAIKU,
        max_tokens: 512,
        system: "You summarize conversation sessions for a companion AI memory system. Respond with valid JSON only — no markdown fences.",
        messages: [
          {
            role: "user",
            content: `Summarize this conversation session. Return JSON with keys: summary (string, ≤200 chars), key_facts (string[], up to 5 bullet facts), emotional_tone (string), importance_score (number 0-1).\n\nTranscript:\n${transcript}`,
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      throw new Error(`Anthropic error: ${anthropicRes.status}`);
    }

    const anthropicData = await anthropicRes.json();
    const rawText = anthropicData.content?.[0]?.text ?? "{}";

    let parsed: {
      summary: string;
      key_facts: string[];
      emotional_tone: string;
      importance_score: number;
    };
    try {
      parsed = JSON.parse(rawText);
    } catch {
      throw new Error("Failed to parse Anthropic JSON response");
    }

    const { data: inserted, error: insertError } = await supabase
      .from("session_summaries")
      .insert({
        user_id,
        companion_id,
        session_key: session_key ?? Date.now().toString(),
        summary: parsed.summary,
        key_facts: parsed.key_facts ?? [],
        emotional_tone: parsed.emotional_tone ?? "neutral",
        importance_score: parsed.importance_score ?? 0.5,
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    // Async embedding backfill — does not block the response
    EdgeRuntime.waitUntil(
      (async () => {
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
          const embedRes = await fetch(`${supabaseUrl}/functions/v1/embed-session`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({ text: `${parsed.summary} ${(parsed.key_facts ?? []).join(" ")}` }),
          });

          if (embedRes.ok) {
            const { embedding } = await embedRes.json();
            if (embedding && inserted?.id) {
              await supabase
                .from("session_summaries")
                .update({ embedding })
                .eq("id", inserted.id);
            }
          }
        } catch (e) {
          console.error("Embedding backfill failed:", e);
        }
      })()
    );

    return new Response(
      JSON.stringify({ success: true, id: inserted?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("summarize-session error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

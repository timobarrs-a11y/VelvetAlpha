import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SONNET = "claude-sonnet-4-5-20250929";
const HAIKU = "claude-haiku-4-5";

const CONSOLIDATION_SYSTEM = `You are a memory consolidation engine for a companion AI. Your job is to merge session summaries and an existing core memory document into an updated, comprehensive core memory document.

Structure the document with exactly these 6 sections:
## IDENTITY & LIFE
## PEOPLE & PETS
## PREFERENCES & BOUNDARIES
## ONGOING THREADS
## OUR HISTORY
## EMOTIONAL PATTERNS

Rules:
- Keep the document under 1500 tokens
- Preserve all pinned_facts verbatim
- Do not remove information unless it is clearly superseded
- Write in third-person about the user (e.g. "User loves hiking")
- Respond with the document text only — no JSON, no markdown fences`;

const VALIDATION_SYSTEM = `You are a memory validation gate. You receive a proposed core memory document and must check two things:
1. Are all pinned_facts present verbatim?
2. Is the document substantive (not trivially short)?

Respond with valid JSON only: { "passed": boolean, "reason": string }`;

async function callAnthropic(
  apiKey: string,
  model: string,
  system: string,
  userContent: string,
  maxTokens: number
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic error: ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { user_id, companion_id, pinned_facts } = await req.json();

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

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

    // Fetch existing core memory
    const { data: existing } = await supabase
      .from("core_memories")
      .select("id, content, version, pinned_facts")
      .eq("user_id", user_id)
      .eq("companion_id", companion_id)
      .eq("validation_passed", true)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Fetch unconsolidated session summaries
    const { data: sessions } = await supabase
      .from("session_summaries")
      .select("id, summary, key_facts, emotional_tone, importance_score")
      .eq("user_id", user_id)
      .eq("companion_id", companion_id)
      .eq("consolidated_into_core", false)
      .order("created_at", { ascending: true });

    if (!sessions || sessions.length === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "no new sessions to consolidate" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sessionIds = sessions.map((s: { id: string }) => s.id);

    const sessionText = sessions
      .map((s: { summary: string; key_facts: string[]; emotional_tone: string; importance_score: number }) =>
        `- ${s.summary}\n  Facts: ${(s.key_facts ?? []).join("; ")}\n  Tone: ${s.emotional_tone} (importance: ${s.importance_score})`
      )
      .join("\n");

    const allPinnedFacts = [
      ...(existing?.pinned_facts ?? []),
      ...(pinned_facts ?? []),
    ];

    const userContent = [
      existing?.content ? `EXISTING CORE MEMORY:\n${existing.content}` : "EXISTING CORE MEMORY:\n(none)",
      `\nNEW SESSION SUMMARIES:\n${sessionText}`,
      allPinnedFacts.length > 0 ? `\nPINNED FACTS (must preserve verbatim):\n${allPinnedFacts.join("\n")}` : "",
    ].join("");

    const newContent = await callAnthropic(apiKey, SONNET, CONSOLIDATION_SYSTEM, userContent, 1800);

    // Reject if new doc is >30% shorter than existing
    if (existing?.content && newContent.length < existing.content.length * 0.7) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "new document too short vs existing — rejected" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Haiku validation gate
    const validationPrompt = [
      `Proposed document:\n${newContent}`,
      allPinnedFacts.length > 0 ? `\nPinned facts to verify:\n${allPinnedFacts.join("\n")}` : "",
    ].join("");

    let validationPassed = true;
    let validationReason = "no pinned facts to check";

    if (allPinnedFacts.length > 0) {
      const validationRaw = await callAnthropic(apiKey, HAIKU, VALIDATION_SYSTEM, validationPrompt, 128);
      try {
        const result = JSON.parse(validationRaw);
        validationPassed = result.passed === true;
        validationReason = result.reason ?? "";
      } catch {
        validationPassed = false;
        validationReason = "failed to parse validation response";
      }
    }

    const nextVersion = (existing?.version ?? 0) + 1;

    const { error: insertError } = await supabase.from("core_memories").insert({
      user_id,
      companion_id,
      version: nextVersion,
      content: newContent,
      pinned_facts: allPinnedFacts,
      validation_passed: validationPassed,
      validation_reason: validationReason,
    });

    if (insertError) throw insertError;

    // Mark sessions as consolidated
    if (validationPassed) {
      await supabase
        .from("session_summaries")
        .update({ consolidated_into_core: true })
        .in("id", sessionIds);
    }

    return new Response(
      JSON.stringify({ success: true, version: nextVersion, validation_passed: validationPassed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("consolidate-memory error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

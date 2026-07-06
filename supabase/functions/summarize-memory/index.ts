import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { MODEL_CONFIG } from "../_shared/modelConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const EXTRACTION_PROMPT = `You are analyzing a conversation between a user and their AI companion for memory preservation. Extract the essential relationship information.

[CONVERSATION CHUNK]
{messages}
[END CHUNK]

Return ONLY a valid JSON object with these fields:
{
  "user_facts": { "personal": [], "preferences": [], "schedule": [], "relationships": [] },
  "emotional_landscape": { "sensitivities": [], "comfort_sources": [], "love_language": "", "current_mood_arc": "" },
  "relationship_with_companion": { "nicknames": [], "inside_jokes": [], "milestones": [], "established_dynamics": [], "boundaries_expressed": [] },
  "key_moments": [],
  "ongoing_threads": []
}

Be concise. Only include meaningful relationship info. Skip small talk.`;

const MERGE_PROMPT = `Merge these two memory JSONs about the same relationship:

EXISTING: {existing}
NEW: {new_data}

Rules: Combine arrays (no duplicates), keep recent info, cap key_moments at 10, update ongoing_threads.
Return ONLY the merged JSON.`;

const PROSE_PROMPT = `Convert this memory JSON to natural prose (under 400 words). Write as notes the companion reads about their user. Be warm, include nicknames and inside jokes naturally.

{memory}

Return ONLY the prose text.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { user_id, companion_id } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey || !anthropicApiKey) {
      throw new Error("Missing environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: messages } = await supabase
      .from("conversations")
      .select("*")
      .eq("user_id", user_id)
      .eq("companion_id", companion_id)
      .eq("summarized", false)
      .order("created_at", { ascending: true })
      .limit(100);

    if (!messages || messages.length < 50) {
      return new Response(
        JSON.stringify({ status: "skipped", reason: "not enough messages" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const formattedMessages = messages
      .map((m) => `${m.role === "user" ? "USER" : "COMPANION"}: ${m.content}`)
      .join("\n");

    const extractionResponse = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL_CONFIG.HAIKU,
          max_tokens: 2000,
          messages: [
            {
              role: "user",
              content: EXTRACTION_PROMPT.replace("{messages}", formattedMessages),
            },
          ],
        }),
      }
    );

    if (!extractionResponse.ok) {
      throw new Error(`Extraction failed: ${extractionResponse.statusText}`);
    }

    const extractionData = await extractionResponse.json();
    const newMemoryJson = JSON.parse(extractionData.content[0].text);

    const { data: existingMemory } = await supabase
      .from("companion_memories")
      .select("*")
      .eq("user_id", user_id)
      .eq("companion_id", companion_id)
      .maybeSingle();

    let finalMemoryJson = newMemoryJson;
    let totalProcessed = messages.length;

    if (existingMemory?.memory_json && Object.keys(existingMemory.memory_json).length > 0) {
      const mergeResponse = await fetch(
        "https://api.anthropic.com/v1/messages",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": anthropicApiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: MODEL_CONFIG.HAIKU,
            max_tokens: 2000,
            messages: [
              {
                role: "user",
                content: MERGE_PROMPT.replace(
                  "{existing}",
                  JSON.stringify(existingMemory.memory_json)
                ).replace("{new_data}", JSON.stringify(newMemoryJson)),
              },
            ],
          }),
        }
      );

      if (!mergeResponse.ok) {
        throw new Error(`Merge failed: ${mergeResponse.statusText}`);
      }

      const mergeData = await mergeResponse.json();
      finalMemoryJson = JSON.parse(mergeData.content[0].text);
      totalProcessed = (existingMemory.messages_processed || 0) + messages.length;
    }

    const proseResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL_CONFIG.HAIKU,
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: PROSE_PROMPT.replace(
              "{memory}",
              JSON.stringify(finalMemoryJson)
            ),
          },
        ],
      }),
    });

    if (!proseResponse.ok) {
      throw new Error(`Prose conversion failed: ${proseResponse.statusText}`);
    }

    const proseData = await proseResponse.json();
    const memoryText = proseData.content[0].text;

    await supabase.from("companion_memories").upsert(
      {
        user_id,
        companion_id,
        memory_json: finalMemoryJson,
        memory_text: memoryText,
        messages_processed: totalProcessed,
        last_message_id: messages[messages.length - 1].id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,companion_id" }
    );

    const messageIds = messages.map((m) => m.id);
    await supabase.from("conversations").update({ summarized: true }).in("id", messageIds);

    return new Response(
      JSON.stringify({
        status: "success",
        messages_processed: messages.length,
        total_processed: totalProcessed,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Summarization error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
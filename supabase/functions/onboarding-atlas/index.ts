import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { MODEL_CONFIG } from "../_shared/modelConfig.ts";
import { moderateInput, MODERATION_REFUSAL } from "../_shared/moderation.ts";

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) throw new Error("Invalid authentication token");

    const body = await req.json();
    const {
      message,
      history = [],
      systemPrompt,
    } = body;

    if (!message) throw new Error("Missing required field: message");
    if (!systemPrompt) throw new Error("Missing required field: systemPrompt");

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY not configured");

    // Reject banned users and screen input before it reaches the model.
    const { data: modProfile } = await supabaseAdmin
      .from("user_profiles")
      .select("is_banned")
      .eq("id", user.id)
      .maybeSingle();
    if (modProfile?.is_banned === true) {
      return new Response(
        JSON.stringify({ error: "Account suspended", message: "Your account has been suspended for violating our content policy." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const moderationVerdict = await moderateInput(supabaseAdmin, anthropicKey, user.id, message);
    if (moderationVerdict.action === "block") {
      console.warn(`Blocked onboarding input, category=${moderationVerdict.category}, user=${user.id}`);
      return new Response(
        JSON.stringify({ error: "Content policy violation", message: MODERATION_REFUSAL }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const messages = [
      ...history.slice(-20).map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: message },
    ];

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": anthropicKey,
              "anthropic-version": "2023-06-01",
              "anthropic-beta": "messages-2023-06-01",
            },
            body: JSON.stringify({
              model: MODEL_CONFIG.HAIKU,
              max_tokens: 800,
              system: systemPrompt,
              messages,
              stream: true,
            }),
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Anthropic error: ${response.status} ${errText}`);
          }

          const reader = response.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;

              try {
                const event = JSON.parse(data);
                if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
                  const chunk = JSON.stringify({ type: "text", content: event.delta.text }) + "\n";
                  controller.enqueue(encoder.encode(chunk));
                }
              } catch {
                // skip malformed lines
              }
            }
          }

          controller.enqueue(encoder.encode(JSON.stringify({ type: "done" }) + "\n"));
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          controller.enqueue(encoder.encode(JSON.stringify({ type: "error", message: errMsg }) + "\n"));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

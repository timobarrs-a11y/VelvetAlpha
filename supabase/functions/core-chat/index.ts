import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { MODEL_CONFIG } from "../_shared/modelConfig.ts";
import { moderateInput, MODERATION_REFUSAL } from "../_shared/moderation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// --- Unit economics guardrails ---------------------------------------------
// Core is a general assistant: token-hungry and unbounded in a way companion
// chat is not. Every ceiling below is deliberate. See Core spec §7.
const CORE_DAILY_FREE_LIMIT = 8;          // free-tier messages per day
const MAX_USER_MESSAGE_CHARS = 12_000;    // ~3k tokens — reject above this
const MAX_MEMORY_CONTEXT_CHARS = 8_000;   // retrieved memory — truncate above
const MAX_HISTORY_MESSAGES = 20;          // turns of prior context
const MAX_HISTORY_MESSAGE_CHARS = 8_000;  // per prior turn
const MAX_OUTPUT_TOKENS_FREE = 800;       // Haiku
const MAX_OUTPUT_TOKENS_PAID = 1_500;     // Sonnet

const CORE_SYSTEM_PROMPT = `You are Core, the general-purpose assistant inside this app.

You are a tool, not a character. You have no name to perform, no personality to project, no relationship with the user to maintain. The other surfaces in this app are people; you are the one surface that is simply useful. Stay in that lane — it is what makes you valuable.

Voice:
- Competent, direct, concise. Get to the point. No filler openers ("Great question!"), no performed warmth, no persona.
- Plainer and flatter than a companion would be. Clarity over charm.
- Answer what was asked. Expand only when depth genuinely helps.

Capabilities: writing and editing, summarizing, explaining, drafting messages and documents, brainstorming, planning, analysis, coding help, math, translation, answering questions.

Memory:
- You share this user's long-term memory with the rest of the app. Relevant facts about who they are and what they have going on may be provided to you.
- Use that context naturally, the way a capable assistant who already knows the person would. Never announce it. Do NOT say "Based on your memory" or "According to what I know about you" — just apply it and move on.
- If provided context is not relevant to the request, ignore it.

Format:
- Use markdown when it aids clarity: headings, bullet lists, fenced code blocks with a language tag, bold for emphasis.
- Short answers get plain prose. Long-form content gets real structure.
- Do not pad. One tight paragraph beats three loose ones.`;

function jsonError(message: string, status: number, extra: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({ error: message, ...extra }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

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

    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("subscription_tier, core_messages_today, core_messages_reset_at, is_super_user, name, is_banned")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.is_banned === true) {
      return jsonError("Account suspended", 403, {
        message: "Your account has been suspended for violating our content policy.",
      });
    }

    const isSuperUser = profile?.is_super_user === true;
    const tier = profile?.subscription_tier || "free";
    const isPaid = ["trial", "unlimited", "starter", "plus", "elite"].includes(tier);
    const isMetered = !isSuperUser && !isPaid;

    // --- Separate daily metering (never touches companion messages_remaining) ---
    const now = new Date();
    const resetAt = profile?.core_messages_reset_at ? new Date(profile.core_messages_reset_at) : null;
    const isSameDay = resetAt ? resetAt.toDateString() === now.toDateString() : false;
    const usedToday = isSameDay ? (profile?.core_messages_today || 0) : 0;

    if (isMetered && usedToday >= CORE_DAILY_FREE_LIMIT) {
      return jsonError("Daily limit reached", 403, {
        limitReached: true,
        message: `You've used your ${CORE_DAILY_FREE_LIMIT} free Core messages for today. Upgrade for unlimited access.`,
      });
    }

    const body = await req.json();
    const { message, history = [], memoryContext = "", userName } = body;

    if (typeof message !== "string" || message.trim().length === 0) {
      return jsonError("Invalid request", 400, { message: "message is required" });
    }

    // --- Hard input ceiling: reject (do not silently drop) an oversized message ---
    if (message.length > MAX_USER_MESSAGE_CHARS) {
      return jsonError("Message too long", 413, {
        message: `Your message is too long for Core (limit ${MAX_USER_MESSAGE_CHARS.toLocaleString()} characters). Please shorten it and try again.`,
      });
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY not configured");

    // --- Moderation on the user's input ---
    const moderationVerdict = await moderateInput(supabaseAdmin, anthropicKey, user.id, message);
    if (moderationVerdict.action === "block") {
      console.warn(`Blocked core input, category=${moderationVerdict.category}, user=${user.id}`);
      return jsonError("Content policy violation", 403, { message: MODERATION_REFUSAL });
    }

    // --- Rate limiting: 20 calls / 60s per user, fail-open on RPC error ---
    try {
      const { data: allowed, error: rlError } = await supabaseAdmin.rpc("check_rate_limit", {
        p_user_id: user.id,
        p_endpoint: "core",
        p_limit_count: 20,
        p_time_window_minutes: 1,
      });
      if (rlError) {
        console.error("Core rate limit RPC error (fail-open):", rlError);
      } else if (allowed === false) {
        return jsonError("Too many requests", 429, {
          message: "You're sending messages too quickly. Please wait a moment and try again.",
        });
      } else {
        const { error: recordError } = await supabaseAdmin.rpc("record_rate_limit", {
          p_user_id: user.id,
          p_endpoint: "core",
        });
        if (recordError) console.error("Core rate limit record error (continuing):", recordError);
      }
    } catch (rlErr) {
      console.error("Core rate limit exception (fail-open):", rlErr);
    }

    // --- Build bounded message history ---
    const boundedHistory = (Array.isArray(history) ? history : [])
      .slice(-MAX_HISTORY_MESSAGES)
      .filter((m: unknown): m is { role: string; content: string } =>
        !!m && typeof m === "object" &&
        (((m as { role?: unknown }).role === "user") || ((m as { role?: unknown }).role === "assistant")) &&
        typeof (m as { content?: unknown }).content === "string")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content.slice(0, MAX_HISTORY_MESSAGE_CHARS),
      }));

    // --- Assemble system prompt: base + identity + truncated memory context ---
    const displayName = (typeof userName === "string" && userName) || profile?.name || "";
    const nameRef = displayName ? `The user's name is ${displayName}. ` : "";
    const dateRef = `Today's date is ${now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`;

    let systemPrompt = `${CORE_SYSTEM_PROMPT}\n\n${nameRef}${dateRef}`;
    if (typeof memoryContext === "string" && memoryContext.trim().length > 0) {
      const trimmedMemory = memoryContext.slice(0, MAX_MEMORY_CONTEXT_CHARS);
      systemPrompt += `\n\n=== WHAT YOU KNOW ABOUT THIS USER (shared memory — use naturally, never cite) ===\n${trimmedMemory}\n=== END ===`;
    }

    const messages = [
      ...boundedHistory,
      { role: "user" as const, content: message },
    ];

    const selectedModel = (isPaid || isSuperUser) ? MODEL_CONFIG.SONNET : MODEL_CONFIG.HAIKU;
    const maxOutputTokens = (isPaid || isSuperUser) ? MAX_OUTPUT_TOKENS_PAID : MAX_OUTPUT_TOKENS_FREE;

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        const send = (obj: Record<string, unknown>) =>
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

        send({ type: "meta", model: selectedModel });

        let streamedAny = false;

        try {
          const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": anthropicKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: selectedModel,
              max_tokens: maxOutputTokens,
              system: systemPrompt,
              messages,
              stream: true,
            }),
          });

          if (!anthropicRes.ok || !anthropicRes.body) {
            const errText = await anthropicRes.text().catch(() => anthropicRes.statusText);
            console.error("Core Anthropic error:", errText);
            const status = anthropicRes.status;
            send({
              type: "error",
              message: status === 429
                ? "Core is briefly overloaded. Please wait a moment and try again."
                : "Something went wrong generating a response. Please try again.",
            });
            send({ type: "done", model: selectedModel });
            controller.close();
            return;
          }

          // Parse Anthropic's SSE stream and re-emit text deltas as NDJSON.
          const reader = anthropicRes.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const rawEvents = buffer.split("\n\n");
            buffer = rawEvents.pop() ?? "";

            for (const rawEvent of rawEvents) {
              for (const line of rawEvent.split("\n")) {
                const trimmed = line.trim();
                if (!trimmed.startsWith("data:")) continue;
                const payload = trimmed.slice(5).trim();
                if (!payload || payload === "[DONE]") continue;
                try {
                  const evt = JSON.parse(payload);
                  if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta" && evt.delta.text) {
                    streamedAny = true;
                    send({ type: "text", chunk: evt.delta.text });
                  } else if (evt.type === "error") {
                    send({ type: "error", message: "The response was interrupted. Please try again." });
                  }
                } catch {
                  // skip malformed SSE payload
                }
              }
            }
          }
        } catch (err) {
          console.error("Core stream error:", err);
          if (!streamedAny) {
            send({ type: "error", message: "Something went wrong generating a response. Please try again." });
          }
        }

        send({ type: "done", model: selectedModel });
        controller.close();

        // --- Increment separate daily counter AFTER a successful turn ---
        if (isMetered && streamedAny) {
          try {
            await supabaseAdmin
              .from("user_profiles")
              .update({
                core_messages_today: isSameDay ? usedToday + 1 : 1,
                core_messages_reset_at: isSameDay ? profile?.core_messages_reset_at : now.toISOString(),
              })
              .eq("id", user.id);
          } catch (incErr) {
            console.error("Core usage increment failed:", incErr);
          }
        }
      },
    });

    return new Response(readable, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("[core-chat] Error:", error);
    return jsonError(
      error instanceof Error ? error.message : "Unknown error",
      500,
    );
  }
});

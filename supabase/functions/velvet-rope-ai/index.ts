import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { MODEL_CONFIG } from "../_shared/modelConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MODEL = MODEL_CONFIG.HAIKU;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const clip = (v: unknown, n: number) =>
  String(v ?? "").replace(/[\u0000-\u0008\u000b-\u001f]/g, " ").slice(0, n);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 200, headers: corsHeaders });

  try {
    if (req.method !== "POST") return json({ error: "bad_request" }, 405);

    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => null);
    const action = typeof body?.action === "string" ? body.action : "";

    if (action === "request") {
      // --- Create an AI Velvet Rope request for the caller ---
      const [{ data: can }] = await Promise.all([
        supabase.rpc("vr_can_send_ai_request", { p_user_id: user.id }),
      ]);
      if (!can) return json({ error: "not_eligible" }, 403);

      const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (!apiKey) return json({ error: "unavailable" }, 503);

      const system =
        "You are the opener of a Velvet Rope conversation — a purely " +
        "conversational guessing game with no game mechanics. You are a " +
        "mysterious stranger who sends one short, intriguing opener message " +
        "to start the game. The other player has to figure out who you are " +
        "through conversation alone. Write ONE opener line (under 200 " +
        "characters) that is playful, slightly cryptic, and invites a reply. " +
        "Do not introduce yourself by name. Do not mention being an AI. No " +
        "questions marks-only messages. Just the opener text.";

      const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 120,
          system,
          messages: [
            { role: "user", content: "Send the opener." },
          ],
        }),
      });

      if (aiRes.status === 429) return json({ error: "rate_limited" }, 429);
      if (!aiRes.ok) {
        console.error("velvet-rope-ai opener upstream error", aiRes.status);
        return json({ error: "unavailable" }, 502);
      }
      const data = await aiRes.json();
      const opener = Array.isArray(data?.content)
        ? data.content
            .filter((b: { type?: string }) => b?.type === "text")
            .map((b: { text?: string }) => b.text ?? "")
            .join("")
            .trim()
        : "";
      if (!opener) return json({ error: "refused" }, 200);

      const handles = [
        "Someone",
        "A stranger",
        "Mystery guest",
        "Unknown player",
        "Velvet visitor",
        "The other side",
      ];
      const maskedHandle = handles[Math.floor(Math.random() * handles.length)];

      const { data: reqRow, error: insErr } = await supabase
        .from("vr_requests")
        .insert({
          addressee_id: user.id,
          requester_id: null,
          match_type: "ai",
          masked_handle: maskedHandle,
          opener_message: clip(opener, 400),
          status: "pending",
        })
        .select("id")
        .maybeSingle();

      if (insErr) {
        console.error("velvet-rope-ai insert error", insErr);
        return json({ error: "unavailable" }, 500);
      }
      return json({ requestId: reqRow?.id ?? null, opener: clip(opener, 400) });
    }

    if (action === "reply") {
      // --- Generate an AI reply inside an active Velvet Rope conversation ---
      const convId = typeof body?.conversationId === "string" ? body.conversationId : "";
      const history = Array.isArray(body?.history) ? body.history : [];
      if (!convId) return json({ error: "bad_request" }, 400);

      const { data: conv } = await supabase
        .from("vr_conversations")
        .select("id, user_a_id, user_b_id, match_type, status")
        .eq("id", convId)
        .maybeSingle();
      if (!conv || conv.status !== "active" || conv.match_type !== "ai") {
        return json({ error: "not_found" }, 404);
      }
      if (conv.user_a_id !== user.id && conv.user_b_id !== user.id) {
        return json({ error: "unauthorized" }, 403);
      }

      const turns: { role: "user" | "assistant"; content: string }[] = [];
      for (const m of history.slice(-20)) {
        if (!m || typeof m !== "object") continue;
        const senderId = (m as { senderId?: string }).senderId;
        const content = clip((m as { content?: unknown }).content, 4000);
        if (!content.trim()) continue;
        const role = senderId === user.id ? "user" : "assistant";
        const last = turns[turns.length - 1];
        if (last && last.role === role) last.content += "\n\n" + content;
        else turns.push({ role, content });
      }
      while (turns.length && turns[0].role !== "user") turns.shift();
      if (!turns.length || turns[turns.length - 1].role !== "user") {
        return json({ error: "bad_request" }, 400);
      }

      const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (!apiKey) return json({ error: "unavailable" }, 503);

      const system =
        "You are a mysterious stranger in a Velvet Rope conversation — a " +
        "purely conversational guessing game with no game mechanics. The " +
        "other player is trying to figure out who you are through chat alone. " +
        "Stay in character: be playful, a little cryptic, give hints and " +
        "misdirections, react to their guesses. Never say you are an AI or " +
        "break character. Keep replies short (1-3 sentences). Never reveal " +
        "a real name. If they guess something close, tease them about it. " +
        "If they guess wrong, playfully deflect.";

      const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 200,
          system,
          messages: turns,
        }),
      });

      if (aiRes.status === 429) return json({ error: "rate_limited" }, 429);
      if (!aiRes.ok) {
        console.error("velvet-rope-ai reply upstream error", aiRes.status);
        return json({ error: "unavailable" }, 502);
      }
      const data = await aiRes.json();
      const text = Array.isArray(data?.content)
        ? data.content
            .filter((b: { type?: string }) => b?.type === "text")
            .map((b: { text?: string }) => b.text ?? "")
            .join("")
            .trim()
        : "";
      if (!text) return json({ error: "refused" }, 200);

      // Insert the AI reply as a vr_messages row with sender_id = null (the
      // AI opponent has no real user id). The edge function runs as service
      // role, which bypasses RLS, so the null-sender insert is allowed.
      const { data: msgRow, error: msgErr } = await supabase
        .from("vr_messages")
        .insert({
          conversation_id: convId,
          sender_id: null,
          content: clip(text, 4000),
        })
        .select("id, conversation_id, sender_id, content, read_at, created_at")
        .maybeSingle();

      if (msgErr) {
        console.error("velvet-rope-ai reply insert error", msgErr);
        return json({ error: "unavailable" }, 500);
      }

      await supabase
        .from("vr_conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", convId);

      return json({ message: msgRow });
    }

    return json({ error: "bad_request" }, 400);
  } catch (err) {
    console.error("velvet-rope-ai error", err);
    return json({ error: "unavailable" }, 500);
  }
});

import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { moderateInput } from "../_shared/moderation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MODEL = "claude-haiku-4-5";
const MAX_TURNS = 20;
const MAX_TURN_CHARS = 4000;
const MAX_SYSTEM_CHARS = 14000;

// Replies a person can have each day (UTC). Background helper calls (memory extraction) are free.
const DAILY_REPLIES_FREE = 40;
const DAILY_REPLIES_PAID = 300;
const HELPER_PREAMBLE = "You are a background helper for the game.";

type Turn = { role: "user" | "assistant"; content: string };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const clip = (v: unknown, n: number) => String(v ?? "").replace(/[\u0000-\u0008\u000b-\u001f]/g, " ").slice(0, n);

function list(...groups: unknown[]): string[] {
  const out = new Set<string>();
  for (const g of groups) {
    if (Array.isArray(g)) g.forEach((x) => { const s = clip(x, 60).trim(); if (s) out.add(s); });
    else if (typeof g === "string" && g.trim()) out.add(clip(g, 120).trim());
  }
  return [...out].slice(0, 20);
}

function factsBlock(label: string, facts: Record<string, string | string[] | null | undefined>) {
  const lines = Object.entries(facts)
    .map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : (v ?? "").trim()] as const)
    .filter(([, v]) => v)
    .map(([k, v]) => `- ${k}: ${v}`);
  return lines.length ? `${label}\n${lines.join("\n")}` : "";
}

function normalizeTurns(raw: unknown[]): Turn[] {
  const turns: Turn[] = [];
  for (const m of raw.slice(-MAX_TURNS)) {
    if (!m || typeof m !== "object") continue;
    const role = (m as { role?: unknown }).role;
    const content = clip((m as { content?: unknown }).content, MAX_TURN_CHARS);
    if ((role !== "user" && role !== "assistant") || !content.trim()) continue;
    const last = turns[turns.length - 1];
    if (last && last.role === role) last.content += "\n\n" + content;
    else turns.push({ role, content });
  }
  while (turns.length && turns[0].role !== "user") turns.shift();
  return turns;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

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
    const companionId = typeof body?.companionId === "string" ? body.companionId : "";
    if (!companionId || !Array.isArray(body?.input) || body.input.length === 0) {
      return json({ error: "bad_request" }, 400);
    }

    const [{ data: profile }, { data: companion }] = await Promise.all([
      supabase
        .from("user_profiles")
        .select("name, nickname, is_banned, favorite_color, hobbies, sports, interests, sports_interests, entertainment_interests, tech_interests, lifestyle_interests, music_genre, zodiac_sign")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("companions")
        .select("custom_name, gender, favorite_color, hobbies, sports, interest_text, sports_interests, entertainment_interests, tech_interests, lifestyle_interests, music_genre, zodiac_sign, communication_style, humor_style, signature_voice, flirting_style, love_language, emotional_openness")
        .eq("id", companionId)
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    if (!profile || profile.is_banned) return json({ error: "refused" }, 403);
    if (!companion) return json({ error: "not_found" }, 404);

    const raw = body.input as unknown[];
    const first = raw[0] as { role?: unknown; content?: unknown };
    const gamePersona = first?.role === "user" ? clip(first.content, MAX_SYSTEM_CHARS) : "";
    const turns = normalizeTurns(gamePersona ? raw.slice(1) : raw);
    if (!turns.length || turns[turns.length - 1].role !== "user") return json({ error: "bad_request" }, 400);

    // Content moderation runs on what the player typed, as in every other chat in the app, before anything is sent on.
    const apiKeyForChecks = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
    const verdict = await moderateInput(supabase, apiKeyForChecks, user.id, turns[turns.length - 1].content);
    if (verdict.action === "block") return json({ error: "blocked" }, 403);

    // The daily allowance. A reply costs one credit; helper calls cost nothing. If the allowance function is not
    // installed yet, the call is allowed (and logged) rather than breaking chat.
    const isHelper = gamePersona.startsWith(HELPER_PREAMBLE);
    let budget: { remaining: number; limit: number } | null = null;
    if (!isHelper) {
      const { data: tierRow } = await supabase.from("user_profiles").select("subscription_tier, is_super_user").eq("id", user.id).maybeSingle();
      const paid = tierRow?.is_super_user === true || !["free", "", null, undefined].includes(tierRow?.subscription_tier);
      const limit = paid ? DAILY_REPLIES_PAID : DAILY_REPLIES_FREE;
      const { data: spent, error: spendErr } = await supabase.rpc("velvet_game_spend", { p_user_id: user.id, p_cost: 1, p_limit: limit });
      if (spendErr) {
        console.error("velvet-game-turn allowance unavailable", spendErr.message);
      } else {
        const row = Array.isArray(spent) ? spent[0] : spent;
        if (row && row.ok === false) return json({ error: "budget", budget: { remaining: 0, limit } }, 429);
        if (row) budget = { remaining: row.remaining, limit };
      }
    }

    const playerName = clip(profile.nickname || profile.name || "the player", 40);
    const companionName = clip(companion.custom_name || "your companion", 40);

    const playerFacts = factsBlock(`Things ${companionName} knows about ${playerName} (permanent profile facts):`, {
      "Favorite color": profile.favorite_color,
      "Sports and teams": list(profile.sports, profile.sports_interests),
      "Hobbies": list(profile.hobbies),
      "Interests": list(profile.interests, profile.lifestyle_interests, profile.tech_interests),
      "Shows, movies and entertainment": list(profile.entertainment_interests),
      "Music": profile.music_genre,
      "Zodiac sign": profile.zodiac_sign,
    });

    const companionFacts = factsBlock(`${companionName}'s own personality and tastes:`, {
      "How they talk": companion.communication_style,
      "Humor": companion.humor_style,
      "Signature voice": companion.signature_voice,
      "Flirting style": companion.flirting_style,
      "Love language": companion.love_language,
      "Emotional openness": companion.emotional_openness,
      "Favorite color": companion.favorite_color,
      "Hobbies": list(companion.hobbies, companion.interest_text),
      "Sports": list(companion.sports, companion.sports_interests),
      "Entertainment": list(companion.entertainment_interests),
      "Music": companion.music_genre,
    });

    const system = [
      gamePersona,
      `Game world rules: this is the Velvet House game. ${companionName} and ${playerName} are game characters living together in this house. Stay fully in the game world. Nothing from conversations outside the game exists here, and you have no memory of any chats outside this house. Never mention the Velvet app chat, past real conversations, or being an AI.`,
      companionFacts,
      playerFacts,
      playerFacts
        ? `Use these facts the way a partner who knows ${playerName} well would: naturally and occasionally, never as a list. Tie them to what is happening in the house. For example, if ${playerName} likes a sport, ${companionName} might suggest putting a game on the TV together; if they love a color, ${companionName} might notice or suggest it when decorating.`
        : "",
    ].filter(Boolean).join("\n\n");

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "unavailable" }, 503);

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 260, system, messages: turns }),
    });

    if (aiRes.status === 429) return json({ error: "rate_limited" }, 429);
    if (!aiRes.ok) {
      console.error("velvet-game-turn upstream error", aiRes.status);
      return json({ error: "unavailable" }, 502);
    }

    const data = await aiRes.json();
    const text = Array.isArray(data?.content)
      ? data.content.filter((b: { type?: string }) => b?.type === "text").map((b: { text?: string }) => b.text ?? "").join("").trim()
      : "";
    if (!text) return json({ error: "refused" }, 200);

    return json(budget ? { text, budget } : { text });
  } catch (err) {
    console.error("velvet-game-turn error", err);
    return json({ error: "unavailable" }, 500);
  }
});

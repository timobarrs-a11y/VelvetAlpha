import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { MODEL_CONFIG } from "../_shared/modelConfig.ts";
import {
  buildPickupPrompt, pickupMessages, stockLineIn, echoes, firstSentences, PICKUP_MEMORY,
  type ResumeStage, type PickupContext,
} from "../_shared/resumePickup.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const STAGES: ResumeStage[] = ['no_goal', 'goal_no_plan', 'plan_unaccepted', 'commitments_due'];

async function claude(system: string, messages: Array<{ role: string; content: string }>): Promise<string | null> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return null;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL_CONFIG.SONNET, max_tokens: 300, system, messages, thinking: { type: "between_tools" } }),
  });
  if (!res.ok) { console.error("[resume-pickup] Anthropic error", res.status, await res.text()); return null; }
  const data = await res.json();
  const text = (data.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("").trim();
  return text || null;
}

/**
 * Someone is back where they left off: write the one message that picks the conversation up, in Atlas's voice (no
 * goal yet, or a goal with no plan) or their coach's (a plan to accept, commitments to set), and leave it in that
 * conversation. It quotes their own words, names one next step, never opens like a restart, never echoes one of the
 * last ten pickups, and after 14+ days away first asks whether the goal still fits.
 *
 * Body: { stage, goalId?, coachId?, handoff? }. Returns { message, conversationId? }.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const stage = body?.stage as ResumeStage;
    if (!STAGES.includes(stage)) return json({ error: "bad stage" }, 400);
    // A goal with no plan: Atlas picks up, then (handoff) the coach takes it on to build the plan.
    const atlasSpeaks = (stage === 'no_goal' || stage === 'goal_no_plan') && body.handoff !== true;

    const [profileRes, goalRes, wordsRes, pastRes] = await Promise.all([
      admin.from("user_profiles").select("nickname, name").eq("id", user.id).maybeSingle(),
      body.goalId
        ? admin.from("user_goals").select("id, title, source_companion_id").eq("id", body.goalId).eq("user_id", user.id).maybeSingle()
        : Promise.resolve({ data: null }),
      admin.from("user_own_words").select("words").eq("user_id", user.id).maybeSingle(),
      admin.from("resume_pickups").select("message").eq("user_id", user.id).order("created_at", { ascending: false }).limit(PICKUP_MEMORY),
    ]);
    const goal = goalRes.data as { id: string; title: string; source_companion_id: string | null } | null;

    // The coach: the one asked for if it is theirs, else the goal's.
    const coachId: string | null = body.coachId ?? goal?.source_companion_id ?? null;
    const { data: coach } = coachId
      ? await admin.from("companions").select("id, custom_name").eq("id", coachId).eq("user_id", user.id).maybeSingle()
      : { data: null };
    if (!atlasSpeaks && !coach) return json({ error: "no coach" }, 400);
    const coachName = (coach as { custom_name: string | null } | null)?.custom_name || null;

    // The conversation being continued, and its last few messages.
    let conversationId: string | null = null;
    let recent: Array<{ role: 'user' | 'assistant'; content: string; created_at: string }> = [];
    if (atlasSpeaks) {
      const { data: conv } = await admin.from("atlas_conversations").select("id").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(1).maybeSingle();
      conversationId = (conv as { id: string } | null)?.id ?? null;
      if (!conversationId) {
        const { data: made, error } = await admin.from("atlas_conversations").insert({ user_id: user.id, title: goal?.title ?? "Your goal" }).select("id").single();
        if (error) throw error;
        conversationId = (made as { id: string }).id;
      }
      const { data } = await admin.from("atlas_messages").select("role, content, created_at").eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(8);
      recent = ((data ?? []) as typeof recent).reverse();
    } else {
      const { data } = await admin.from("conversations").select("role, content, created_at").eq("user_id", user.id).eq("companion_id", coachId).in("role", ["user", "assistant"]).order("created_at", { ascending: false }).limit(8);
      recent = ((data ?? []) as typeof recent).reverse();
    }

    // Their own words: saved when they first told Atlas their goals; if they were not, from their first Atlas messages.
    let ownWords = (wordsRes.data as { words: string } | null)?.words ?? null;
    if (!ownWords) {
      const { data: firsts } = await admin.from("atlas_messages").select("content").eq("user_id", user.id).eq("role", "user").order("created_at", { ascending: true }).limit(3);
      const found = firstSentences(((firsts ?? []) as Array<{ content: string }>).map((m) => m.content));
      if (found) {
        ownWords = found;
        await admin.from("user_own_words").upsert({ user_id: user.id, words: found }, { onConflict: "user_id", ignoreDuplicates: true });
      }
    }

    const last = recent[recent.length - 1]?.created_at;
    const daysAway = last ? (Date.now() - new Date(last).getTime()) / 86400000 : 0;
    const profile = profileRes.data as { nickname: string | null; name: string | null } | null;
    const ctx: PickupContext = {
      stage,
      speaker: atlasSpeaks ? { kind: 'atlas', name: 'Atlas' } : { kind: 'coach', name: coachName ?? 'Your coach' },
      address: profile?.nickname?.trim() || null,
      goalTitle: goal?.title ?? null,
      ownWords,
      recent: recent.map(({ role, content }) => ({ role, content })),
      daysAway,
      coachName,
      pastPickups: ((pastRes.data ?? []) as Array<{ message: string }>).map((p) => p.message),
    };

    // One draft, and one retry told what it broke: a stock line, or an echo of an earlier pickup.
    const system = buildPickupPrompt(ctx);
    let message = await claude(system, pickupMessages(ctx));
    if (!message) return json({ error: "AI service error" }, 502);
    const problem = (m: string): string | null => {
      const stock = stockLineIn(m);
      if (stock) return `It opens like a restart ("${stock}").`;
      const echo = echoes(m, ctx.pastPickups, ownWords ?? '');
      return echo ? `It is too close to this earlier one: "${echo}".` : null;
    };
    const issue = problem(message);
    if (issue) {
      const retry = await claude(`${system}\n\nYOUR DRAFT BROKE A RULE. ${issue}\nThe draft was:\n${message}\n\nWrite it again, saying something new.`, pickupMessages(ctx));
      if (retry && !problem(retry)) message = retry;
    }

    // Left in the conversation it continues, and remembered so the next one is different.
    if (atlasSpeaks) {
      await admin.from("atlas_messages").insert({ conversation_id: conversationId, user_id: user.id, role: "assistant", content: message });
      await admin.from("atlas_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
    } else {
      await admin.from("conversations").insert({ user_id: user.id, companion_id: coachId, role: "assistant", content: message, metadata: { type: "pickup", stage } });
    }
    await admin.from("resume_pickups").insert({ user_id: user.id, stage, message });
    const { data: old } = await admin.from("resume_pickups").select("id").eq("user_id", user.id).order("created_at", { ascending: false }).range(PICKUP_MEMORY, PICKUP_MEMORY + 50);
    if (old?.length) await admin.from("resume_pickups").delete().in("id", (old as Array<{ id: string }>).map((r) => r.id));

    return json({ message, conversationId });
  } catch (err) {
    console.error("[resume-pickup]", err);
    return json({ error: String(err) }, 500);
  }
});

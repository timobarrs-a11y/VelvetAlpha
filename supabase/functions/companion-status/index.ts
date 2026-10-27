// Companion statuses on the owner's feed.
//
//   { action: "sync" }                    turn today's status timeline lines that are due into posts
//   { action: "comment", postId, body }   add the member's comment; when it @-mentions a companion
//                                         and the limits allow, the companion answers in kind.
//
// Called by the signed-in member's browser. Every write happens here, after checking the caller
// owns the post, so the limits and moderation in ../_shared/companionStatusRules.ts can't be skipped.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { MODEL_CONFIG } from "../_shared/modelConfig.ts";
import { buildPersonaLayer } from "../_shared/personaBuilder.ts";
import { moderateInput, MODERATION_REFUSAL } from "../_shared/moderation.ts";
import {
  MAX_COMMENT_LENGTH, MAX_STATUSES_PER_COMPANION_PER_DAY, MAX_USER_COMMENTS_PER_HOUR,
  cleanReply, decideReply, dueStatuses, findMentionedCompanion, localDateString,
} from "../_shared/companionStatusRules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const DAY_MS = 24 * 3600_000;
const HOUR_MS = 3600_000;

// deno-lint-ignore no-explicit-any
type Db = any;

const isHelper = (relationshipType: string | null) => relationshipType === "mentor" || relationshipType === "assistant";

async function memberTimezone(db: Db, userId: string): Promise<string> {
  const { data } = await db.from("user_profiles").select("timezone").eq("id", userId).maybeSingle();
  return (data?.timezone as string | undefined) || "America/New_York";
}

/** Today's (and yesterday's) timeline lines that are due become posts, within each companion's daily allowance. */
async function syncStatuses(db: Db, userId: string) {
  const now = new Date();
  const tz = await memberTimezone(db, userId);

  const { data: companions } = await db.from("companions").select("id, relationship_type").eq("user_id", userId);
  const ids = (companions ?? []).filter((c: { relationship_type: string | null }) => !isHelper(c.relationship_type)).map((c: { id: string }) => c.id);
  if (ids.length === 0) return { posted: 0 };

  const since = new Date(now.getTime() - 2 * DAY_MS).toISOString().slice(0, 10);
  const { data: experiences } = await db
    .from("daily_experiences")
    .select("id, companion_id, created_at, status_timeline")
    .eq("user_id", userId)
    .in("companion_id", ids)
    .gte("date", since)
    .order("created_at", { ascending: false });

  const { data: recent } = await db
    .from("companion_status_posts")
    .select("companion_id")
    .eq("user_id", userId)
    .gte("visible_at", new Date(now.getTime() - DAY_MS).toISOString());
  const usedToday = new Map<string, number>();
  for (const r of recent ?? []) usedToday.set(r.companion_id, (usedToday.get(r.companion_id) ?? 0) + 1);

  const rows: Record<string, unknown>[] = [];
  for (const exp of experiences ?? []) {
    const quota = MAX_STATUSES_PER_COMPANION_PER_DAY - (usedToday.get(exp.companion_id) ?? 0);
    // The timeline was written for the member's day when it was created.
    const localDate = localDateString(new Date(exp.created_at), tz);
    for (const s of dueStatuses(exp.status_timeline, localDate, tz, now, quota)) {
      rows.push({
        user_id: userId, companion_id: exp.companion_id, experience_id: exp.id,
        slot: s.slot, body: s.body, activity: s.activity, visible_at: s.visibleAt.toISOString(),
      });
      usedToday.set(exp.companion_id, (usedToday.get(exp.companion_id) ?? 0) + 1);
    }
  }
  if (rows.length === 0) return { posted: 0 };

  // A line already posted is left alone (same experience and slot).
  const { error } = await db.from("companion_status_posts").upsert(rows, { onConflict: "experience_id,slot", ignoreDuplicates: true });
  if (error) {
    console.error("companion-status sync error", error.message);
    return { posted: 0 };
  }
  return { posted: rows.length };
}

async function generateReply(
  apiKey: string,
  companion: Record<string, unknown>,
  userName: string | null,
  userNickname: string | null,
  statusBody: string,
  thread: { author: string; body: string }[],
  comment: string,
): Promise<string | null> {
  const persona = buildPersonaLayer(companion as Parameters<typeof buildPersonaLayer>[0], userName, userNickname);
  const system = `${persona}

=== YOUR STATUS ===
You posted this status on your own feed: "${statusBody}"
${userName ? userName : "Your person"} commented and tagged you with @. Answer them right there in the comments.

REPLY RULES: One or two short sentences, like a real social media reply, in your own voice. Stay on what they said and on your status. Do not start with an @ or their name, do not use quotation marks, and do not mention that you are an AI or that this is a feature.`;

  const messages = [
    ...thread.slice(-6).map(t => ({ role: t.author === "companion" ? "assistant" : "user", content: t.body })),
    { role: "user", content: comment },
  ];
  // The API wants the conversation to start with the member and alternate.
  while (messages.length > 1 && messages[0].role !== "user") messages.shift();
  const merged: { role: string; content: string }[] = [];
  for (const m of messages) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) last.content += `\n${m.content}`;
    else merged.push({ ...m });
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL_CONFIG.HAIKU, max_tokens: 200, system, messages: merged }),
  });
  if (!res.ok) {
    console.error("companion-status reply model error", res.status, await res.text());
    return null;
  }
  const data = await res.json();
  return cleanReply(data?.content?.[0]?.text);
}

async function addComment(db: Db, apiKey: string | undefined, userId: string, postId: string, rawBody: unknown) {
  const body = typeof rawBody === "string" ? rawBody.trim() : "";
  if (!body) return json({ error: "empty" }, 400);
  if (body.length > MAX_COMMENT_LENGTH) return json({ error: "too_long" }, 400);

  const { data: post } = await db.from("companion_status_posts").select("id, user_id, body").eq("id", postId).maybeSingle();
  if (!post || post.user_id !== userId) return json({ error: "not_found" }, 404);

  const now = Date.now();
  const { count: recentComments } = await db
    .from("companion_status_comments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId).eq("author_type", "user")
    .gte("created_at", new Date(now - HOUR_MS).toISOString());
  if ((recentComments ?? 0) >= MAX_USER_COMMENTS_PER_HOUR) return json({ error: "rate_limited" }, 429);

  if (apiKey) {
    const verdict = await moderateInput(db, apiKey, userId, body);
    if (verdict.action === "block") return json({ error: "blocked", message: MODERATION_REFUSAL }, 403);
  }

  const { data: companions } = await db.from("companions").select("*").eq("user_id", userId);
  const mentionedId = findMentionedCompanion(body, companions ?? []);

  const { data: comment, error: insertError } = await db
    .from("companion_status_comments")
    .insert({ post_id: postId, user_id: userId, author_type: "user", body, mentioned_companion_id: mentionedId })
    .select("*")
    .single();
  if (insertError || !comment) {
    console.error("companion-status comment insert error", insertError?.message);
    return json({ error: "unavailable" }, 500);
  }
  if (!mentionedId) return json({ comment, reply: null, replySkipped: "not_mentioned" });

  const [{ count: repliesOnPost }, { count: repliesToday }, { data: lastReply }] = await Promise.all([
    db.from("companion_status_comments").select("id", { count: "exact", head: true }).eq("post_id", postId).eq("author_type", "companion"),
    db.from("companion_status_comments").select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("author_type", "companion").gte("created_at", new Date(now - DAY_MS).toISOString()),
    db.from("companion_status_comments").select("created_at").eq("user_id", userId).eq("author_type", "companion")
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const decision = decideReply({
    mentionedCompanionId: mentionedId,
    repliesOnPost: repliesOnPost ?? 0,
    repliesToday: repliesToday ?? 0,
    secondsSinceLastReply: lastReply ? (now - new Date(lastReply.created_at).getTime()) / 1000 : null,
  });
  if (!decision.reply) return json({ comment, reply: null, replySkipped: decision.reason });
  if (!apiKey) return json({ comment, reply: null, replySkipped: "unavailable" });

  const companion = (companions ?? []).find((c: { id: string }) => c.id === mentionedId);
  if (!companion) return json({ comment, reply: null, replySkipped: "unavailable" });

  const [{ data: profile }, { data: thread }] = await Promise.all([
    db.from("user_profiles").select("name, nickname").eq("id", userId).maybeSingle(),
    db.from("companion_status_comments").select("author_type, body").eq("post_id", postId).neq("id", comment.id)
      .order("created_at", { ascending: true }).limit(12),
  ]);

  let replyText: string | null = null;
  try {
    replyText = await generateReply(
      apiKey, companion, profile?.name ?? null, profile?.nickname ?? null, post.body,
      (thread ?? []).map((t: { author_type: string; body: string }) => ({ author: t.author_type, body: t.body })),
      body,
    );
  } catch (err) {
    console.error("companion-status reply error", err);
  }
  if (!replyText) return json({ comment, reply: null, replySkipped: "unavailable" });

  const { data: reply, error: replyError } = await db
    .from("companion_status_comments")
    .insert({ post_id: postId, user_id: userId, author_type: "companion", companion_id: mentionedId, body: replyText, reply_to: comment.id })
    .select("*")
    .single();
  // The unique reply_to index means a retry can't make a second answer.
  if (replyError) return json({ comment, reply: null, replySkipped: "already_replied" });
  return json({ comment, reply });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: { user }, error: authError } = await db.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) return json({ error: "unauthorized" }, 401);

    const payload = await req.json().catch(() => null);
    if (payload?.action === "sync") return json(await syncStatuses(db, user.id));
    if (payload?.action === "comment" && typeof payload.postId === "string") {
      return await addComment(db, Deno.env.get("ANTHROPIC_API_KEY"), user.id, payload.postId, payload.body);
    }
    return json({ error: "bad_request" }, 400);
  } catch (err) {
    console.error("companion-status error", err);
    return json({ error: "unavailable" }, 500);
  }
});

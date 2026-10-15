import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk@^0.27.3";
import { createClient } from "npm:@supabase/supabase-js@2";
import { MODEL_CONFIG } from "../_shared/modelConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAYA_ID = "b0b00000-0000-0000-0000-000000000001";
const JORDAN_ID = "b0b00000-0000-0000-0000-000000000002";

// Curated mood smilies the bot can assign to generated posts.
// Each maps a tone category to a smilie code from the registry.
const MOOD_SMILIES: Record<string, string> = {
  funny: "0rofl",
  happy: "7mt",
  love: "8zs",
  excited: "2ygxuhx",
  confused: "69915069",
  sad: "bmr8pzw",
  angry: "ovo4rdl",
  thinking: "vr55yvg",
  cool: "fqowtn6",
  shocked: "2ake3ir",
  sleepy: "15np24jjpg",
  celebratory: "8x5p",
  supportive: "7giv",
  grateful: "7luf",
  nostalgic: "87dk",
  frustrated: "4j9f",
  curious: "4jih",
  proud: "2ksd",
  relieved: "18ub",
  mischievous: "194g",
  overwhelmed: "909s",
  determined: "93wr",
  peaceful: "5fg96a",
};
const MOOD_KEYS = Object.keys(MOOD_SMILIES);

interface BoardRow {
  id: string;
  name: string;
  description: string | null;
}

interface PostRow {
  id: string;
  title: string;
  body: string;
  board_id: string;
  author_id: string;
  is_ai_generated: boolean;
}

interface BotSettings {
  board_id: string;
  bot_enabled: boolean;
  post_frequency_hours: number;
  respond_frequency_hours: number;
  last_post_at: string | null;
  last_respond_at: string | null;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isSimilar(a: string, b: string, threshold = 0.6): boolean {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (na === nb) return true;
  if (na.length < 10 || nb.length < 10) return false;
  const wordsA = new Set(na.split(" ").filter((w) => w.length > 3));
  const wordsB = new Set(nb.split(" ").filter((w) => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return false;
  let intersection = 0;
  for (const w of wordsA) if (wordsB.has(w)) intersection++;
  const union = wordsA.size + wordsB.size - intersection;
  return intersection / union >= threshold;
}

function logRun(
  supabase: ReturnType<typeof createClient>,
  row: {
    bot_user_id: string;
    bot_name: string;
    action: "post" | "comment";
    board_id?: string | null;
    post_id?: string | null;
    generated_title?: string | null;
    generated_body?: string | null;
    status: string;
    error_message?: string | null;
  },
) {
  return supabase.from("community_bot_runs").insert({
    bot_user_id: row.bot_user_id,
    bot_name: row.bot_name,
    action: row.action,
    board_id: row.board_id ?? null,
    post_id: row.post_id ?? null,
    generated_title: row.generated_title ?? null,
    generated_body: row.generated_body ?? null,
    status: row.status,
    error_message: row.error_message ?? null,
  });
}

async function generatePost(
  anthropic: Anthropic,
  board: BoardRow,
): Promise<{ title: string; body: string; post_smilie: string } | null> {
  const systemPrompt = `You are Maya, a warm, curious community member on a small online message board. You start conversations that make people want to chime in — questions, relatable observations, light debates, personal stories that invite others to share theirs.

Voice rules:
- Write like a real person posting on a forum, not like a content marketer or AI assistant.
- Keep it conversational and genuine. Short paragraphs. No bullet lists. No "Let me know your thoughts!" sign-offs.
- 2-4 sentences for the body. The title should be a natural forum thread title (not clickbait, not an article headline).
- Don't mention that you're an AI, a bot, or that content is generated.
- Don't give medical, legal, or financial advice. Keep it to everyday life experience and opinions.
- Stay on-topic for the board you're posting in.`;

  const userPrompt = `You're posting in the "${board.name}" board.
${board.description ? `Board description: ${board.description}` : ""}

Write a forum post that would start a real conversation. IMPORTANT: vary your approach from post to post. Sometimes ask a question, sometimes share a brief personal anecdote, sometimes float a mild opinion, sometimes share a relatable observation. Do NOT start every post with "Does anyone else" — that gets repetitive. Mix up your openings and structure.

Return JSON with "title", "body", and "mood" fields. Title max 120 chars, body max 600 chars. The "mood" field must be one of these exact values: ${MOOD_KEYS.join(", ")}. Pick the mood that best matches the tone of your post.`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL_CONFIG.HAIKU,
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.title || !parsed.body) return null;
    const moodRaw = String(parsed.mood ?? "").toLowerCase().trim();
    const moodKey = MOOD_KEYS.find((k) => k === moodRaw);
    const postSmilie = moodKey ? MOOD_SMILIES[moodKey] : MOOD_SMILIES["thinking"];
    return {
      title: String(parsed.title).trim().slice(0, 300),
      body: String(parsed.body).trim().slice(0, 5000),
      post_smilie: postSmilie,
    };
  } catch (err) {
    console.error("[community-bot] generatePost error:", err);
    return null;
  }
}

async function generateComment(
  anthropic: Anthropic,
  post: { title: string; body: string },
  boardName: string,
): Promise<string | null> {
  const systemPrompt = `You are Jordan, a thoughtful, encouraging community member on a small online message board. You reply to posts to keep the conversation going — sharing relatable experiences, asking follow-up questions, or offering a different angle.

Voice rules:
- Write like a real person replying on a forum, not like an AI assistant.
- 1-3 sentences. Conversational, genuine, not preachy.
- Sometimes share a brief personal anecdote, sometimes ask a question, sometimes just validate what the poster said.
- Don't mention that you're an AI or bot.
- Don't give medical, legal, or financial advice.
- Don't start with "I completely understand" or "That's so true" — vary your openings.`;

  const userPrompt = `You're replying to a post in the "${boardName}" board.

Post title: ${post.title}
Post body: ${post.body.slice(0, 800)}

Write a natural reply that adds to the conversation. Return just the reply text, no JSON wrapper, no quotes around it.`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL_CONFIG.HAIKU,
      max_tokens: 200,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    if (!text) return null;
    return text.slice(0, 2000);
  } catch (err) {
    console.error("[community-bot] generateComment error:", err);
    return null;
  }
}

async function runPosterBot(
  supabase: ReturnType<typeof createClient>,
  anthropic: Anthropic,
): Promise<void> {
  const now = new Date();

  // Fetch boards where bots are enabled and enough time has passed since last post
  const { data: settings } = await supabase
    .from("community_board_bot_settings")
    .select("*")
    .eq("bot_enabled", true);

  if (!settings || settings.length === 0) {
    console.log("[community-bot] No boards with bots enabled");
    return;
  }

  for (const s of settings as BotSettings[]) {
    // Rate limit check
    if (s.last_post_at) {
      const elapsed = (now.getTime() - new Date(s.last_post_at).getTime()) / (1000 * 60 * 60);
      if (elapsed < s.post_frequency_hours) continue;
    }

    // Fetch the board
    const { data: board } = await supabase
      .from("community_boards")
      .select("id, name, description")
      .eq("id", s.board_id)
      .eq("is_approved", true)
      .maybeSingle() as { data: BoardRow | null };

    if (!board) continue;

    // Fetch existing posts for dedup
    const { data: existingPosts } = await supabase
      .from("community_posts")
      .select("title, body")
      .eq("board_id", board.id)
      .order("created_at", { ascending: false })
      .limit(20) as { data: { title: string; body: string }[] | null };

    const existingTitles = (existingPosts ?? []).map((p) => p.title);

    // Generate a post
    const generated = await generatePost(anthropic, board);
    if (!generated) {
      await logRun(supabase, {
        bot_user_id: MAYA_ID, bot_name: "Maya", action: "post",
        board_id: board.id, status: "error", error_message: "Generation failed",
      });
      continue;
    }

    // Dedup check against existing titles
    const isDup = existingTitles.some((t) => isSimilar(generated.title, t, 0.5));
    if (isDup) {
      await logRun(supabase, {
        bot_user_id: MAYA_ID, bot_name: "Maya", action: "post",
        board_id: board.id, generated_title: generated.title,
        status: "skipped_duplicate",
      });
      console.log(`[community-bot] Skipped duplicate post for "${board.name}": ${generated.title}`);
      continue;
    }

    // Insert via RPC
    const { data: postId, error } = await supabase.rpc("bot_create_post", {
      p_board_id: board.id,
      p_author_id: MAYA_ID,
      p_title: generated.title,
      p_body: generated.body,
      p_post_smilie: generated.post_smilie,
    });

    if (error || !postId) {
      await logRun(supabase, {
        bot_user_id: MAYA_ID, bot_name: "Maya", action: "post",
        board_id: board.id, generated_title: generated.title, generated_body: generated.body,
        status: "error", error_message: error?.message ?? "Insert failed",
      });
      console.error(`[community-bot] Post insert failed for "${board.name}":`, error);
      continue;
    }

    // Update last_post_at
    await supabase
      .from("community_board_bot_settings")
      .update({ last_post_at: now.toISOString(), updated_at: now.toISOString() })
      .eq("board_id", board.id);

    await logRun(supabase, {
      bot_user_id: MAYA_ID, bot_name: "Maya", action: "post",
      board_id: board.id, post_id: postId as string,
      generated_title: generated.title, generated_body: generated.body,
      status: "success",
    });
    console.log(`[community-bot] Posted in "${board.name}": ${generated.title}`);
  }
}

async function runResponderBot(
  supabase: ReturnType<typeof createClient>,
  anthropic: Anthropic,
): Promise<void> {
  const now = new Date();

  // Find posts with few or no comments, across bot-enabled boards
  const { data: settings } = await supabase
    .from("community_board_bot_settings")
    .select("board_id, respond_frequency_hours, last_respond_at")
    .eq("bot_enabled", true);

  if (!settings || settings.length === 0) return;

  const boardIds = (settings as BotSettings[]).map((s) => s.board_id);

  // Get posts with 0-2 comments, created in the last 48h, not already replied to by Jordan
  const { data: candidatePosts } = await supabase
    .from("community_posts")
    .select("id, title, body, board_id, comment_count, created_at")
    .in("board_id", boardIds)
    .lte("comment_count", 2)
    .gte("created_at", new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: true })
    .limit(15) as { data: PostRow[] | null };

  if (!candidatePosts || candidatePosts.length === 0) {
    console.log("[community-bot] No candidate posts for responder");
    return;
  }

  // Check which posts Jordan has already commented on
  const { data: jordanComments } = await supabase
    .from("community_comments")
    .select("post_id")
    .eq("author_id", JORDAN_ID)
    .in("post_id", candidatePosts.map((p) => p.id)) as { data: { post_id: string }[] | null };

  const alreadyReplied = new Set((jordanComments ?? []).map((c) => c.post_id));

  // Also check bot_runs to avoid re-responding to skipped posts
  const { data: recentRuns } = await supabase
    .from("community_bot_runs")
    .select("post_id, status")
    .eq("bot_user_id", JORDAN_ID)
    .in("post_id", candidatePosts.map((p) => p.id))
    .gte("created_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()) as { data: { post_id: string; status: string }[] | null };

  const recentlyProcessed = new Set((recentRuns ?? []).map((r) => r.post_id));

  // Per-board rate limiting: pick at most 1 post per board
  const boardsRespondedThisRun = new Set<string>();
  let respondedCount = 0;
  const maxResponses = 5;

  for (const post of candidatePosts) {
    if (respondedCount >= maxResponses) break;
    if (alreadyReplied.has(post.id)) continue;
    if (recentlyProcessed.has(post.id)) continue;
    if (boardsRespondedThisRun.has(post.board_id)) continue;

    // Fetch board name
    const { data: board } = await supabase
      .from("community_boards")
      .select("name")
      .eq("id", post.board_id)
      .maybeSingle() as { data: { name: string } | null };

    const boardName = board?.name ?? "the board";

    const comment = await generateComment(anthropic, { title: post.title, body: post.body }, boardName);
    if (!comment) {
      await logRun(supabase, {
        bot_user_id: JORDAN_ID, bot_name: "Jordan", action: "comment",
        board_id: post.board_id, post_id: post.id,
        status: "error", error_message: "Generation failed",
      });
      continue;
    }

    const { data: commentId, error } = await supabase.rpc("bot_create_comment", {
      p_post_id: post.id,
      p_author_id: JORDAN_ID,
      p_body: comment,
    });

    if (error || !commentId) {
      await logRun(supabase, {
        bot_user_id: JORDAN_ID, bot_name: "Jordan", action: "comment",
        board_id: post.board_id, post_id: post.id, generated_body: comment,
        status: "error", error_message: error?.message ?? "Insert failed",
      });
      console.error(`[community-bot] Comment insert failed for post ${post.id}:`, error);
      continue;
    }

    boardsRespondedThisRun.add(post.board_id);
    respondedCount++;

    await logRun(supabase, {
      bot_user_id: JORDAN_ID, bot_name: "Jordan", action: "comment",
      board_id: post.board_id, post_id: post.id, generated_body: comment,
      status: "success",
    });
    console.log(`[community-bot] Jordan replied to "${post.title.slice(0, 50)}" in ${boardName}`);
  }

  // Update last_respond_at for boards that got a response
  for (const boardId of boardsRespondedThisRun) {
    await supabase
      .from("community_board_bot_settings")
      .update({ last_respond_at: now.toISOString(), updated_at: now.toISOString() })
      .eq("board_id", boardId);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const anthropic = new Anthropic({
      apiKey: Deno.env.get("ANTHROPIC_API_KEY")!,
    });

    console.log("[community-bot] Starting bot run...");

    await runPosterBot(supabase, anthropic);
    await runResponderBot(supabase, anthropic);

    console.log("[community-bot] Bot run complete.");

    return new Response(
      JSON.stringify({ success: true, message: "Bot run complete" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[community-bot] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

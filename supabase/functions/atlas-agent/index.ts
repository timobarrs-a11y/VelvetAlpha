import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { MODEL_CONFIG } from "../_shared/modelConfig.ts";
import { moderateInput, MODERATION_REFUSAL } from "../_shared/moderation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface BraveWebResult {
  title: string;
  url: string;
  description: string;
  page_age?: string;
}

interface BraveNewsResult {
  title: string;
  url: string;
  description: string;
  age?: string;
  source?: { name: string };
}

interface BraveSearchResponse {
  web?: { results?: BraveWebResult[] };
  news?: { results?: BraveNewsResult[] };
}

async function braveSearch(query: string, braveKey: string, count = 5): Promise<string> {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}&search_lang=en&country=us&text_decorations=false&spellcheck=false`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": braveKey,
    },
    signal: AbortSignal.timeout(7000),
  });

  if (!res.ok) throw new Error(`Brave Search error: ${res.status}`);

  const data: BraveSearchResponse = await res.json();
  const webResults = data.web?.results || [];
  const newsResults = data.news?.results || [];

  const formattedWeb = webResults.slice(0, 4).map((r, i) =>
    `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.description || ""}${r.page_age ? `\n(${r.page_age})` : ""}`
  ).join("\n\n");

  const formattedNews = newsResults.slice(0, 3).map((r) =>
    `• ${r.title}${r.source?.name ? ` — ${r.source.name}` : ""}\n  ${r.url}\n  ${r.description || ""}`
  ).join("\n\n");

  const parts: string[] = [];
  if (formattedWeb) parts.push(`**Web:**\n${formattedWeb}`);
  if (formattedNews) parts.push(`**News:**\n${formattedNews}`);

  return parts.join("\n\n") || "No relevant results found.";
}

interface SearchDecision {
  shouldSearch: boolean;
  query: string | null;
  reason: string;
}

async function classifySearchIntent(message: string, history: Array<{ role: string; content: string }>, anthropicKey: string): Promise<SearchDecision> {
  const recentContext = history.slice(-3).map(m => `${m.role}: ${m.content.substring(0, 150)}`).join("\n");

  const classifyRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL_CONFIG.HAIKU,
      max_tokens: 150,
      system: `You are a search intent classifier. Analyze the user's message and decide if a real-time web search would meaningfully improve the answer.

Search when: the question is about current events, real-time data (prices, scores, weather), recent news, specific factual lookups that change over time, or explicit search requests.

Do NOT search when: the question is about writing/editing help, code, math, advice, general knowledge that doesn't change, creative tasks, personal conversation, or things you already know well.

Respond ONLY with JSON: {"shouldSearch": boolean, "query": "optimized search query" | null, "reason": "brief reason"}

The query must be precise and targeted — not the full user message. Extract the specific entity/topic to search for.`,
      messages: [
        {
          role: "user",
          content: `Recent context:\n${recentContext || "(none)"}\n\nUser message: ${message}`,
        },
      ],
    }),
  });

  if (!classifyRes.ok) return { shouldSearch: false, query: null, reason: "classifier unavailable" };

  const data = await classifyRes.json();
  const text = data.content?.[0]?.text || "";

  try {
    const parsed = JSON.parse(text);
    return {
      shouldSearch: parsed.shouldSearch === true,
      query: parsed.query || null,
      reason: parsed.reason || "",
    };
  } catch {
    return { shouldSearch: false, query: null, reason: "parse error" };
  }
}

const APP_ROUTES: Record<string, string> = {
  "atlas": "/atlas",
  "co-author": "/co-author",
  "coauthor": "/co-author",
  "co author": "/co-author",
  "writing": "/co-author",
  "calendar": "/calendar",
  "schedule": "/calendar",
  "daily feed": "/daily-feed",
  "feed": "/daily-feed",
  "news": "/daily-feed",
  "insights": "/insights",
  "lobby": "/lobby",
  "home": "/lobby",
  "profile": "/profile",
  "settings": "/settings",
  "companion": "/lobby",
  "chat": "/lobby",
};

async function detectNavigationIntent(
  message: string,
  history: Array<{ role: string; content: string }>,
  anthropicKey: string,
): Promise<{ destination: string; route: string; seedText?: string } | null> {
  const navKeywords = ["take me to", "open ", "switch to", "send me to", "go to", "navigate to", "bring me to"];
  const lowerMsg = message.toLowerCase();
  const hasNavKeyword = navKeywords.some(k => lowerMsg.includes(k));
  if (!hasNavKeyword) return null;

  const recentContext = history.slice(-4).map(m => `${m.role}: ${m.content.substring(0, 150)}`).join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL_CONFIG.HAIKU,
      max_tokens: 200,
      system: `Detect if the user wants to navigate to another app section. Valid destinations: atlas, co-author, calendar, daily-feed, insights, lobby, profile, settings.
Respond ONLY with JSON: {"hasIntent": boolean, "destination": "app name", "route": "/route", "seedText": "brief topic to pass along"} or {"hasIntent": false}`,
      messages: [{ role: "user", content: `Context:\n${recentContext}\n\nMessage: ${message}` }],
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  try {
    const parsed = JSON.parse(text);
    if (!parsed.hasIntent) return null;
    const route = APP_ROUTES[parsed.destination?.toLowerCase()] || parsed.route;
    if (!route) return null;
    return { destination: parsed.destination, route, seedText: parsed.seedText };
  } catch {
    return null;
  }
}

const CALENDAR_TOOL = {
  name: "add_calendar_event",
  description: "Add an event to the user's personal calendar. Use this when the user asks you to schedule something, set a reminder, add an appointment, or when you identify something that should be tracked on their calendar (meetings, deadlines, reminders, goals, events). Always confirm with the user before adding unless they explicitly ask you to add it.",
  input_schema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Short, clear title for the calendar event",
      },
      description: {
        type: "string",
        description: "Optional longer description or notes for the event",
      },
      event_type: {
        type: "string",
        enum: ["reminder", "appointment", "task", "goal_deadline", "milestone", "birthday", "anniversary", "date_idea"],
        description: "The type of calendar event",
      },
      event_date: {
        type: "string",
        description: "ISO 8601 date string for when the event occurs (e.g. 2026-04-10T14:00:00.000Z). If only a date is given with no time, use noon UTC.",
      },
      all_day: {
        type: "boolean",
        description: "Whether this is an all-day event (no specific time)",
      },
      location: {
        type: "string",
        description: "Optional location for the event",
      },
      recurring: {
        type: "string",
        enum: ["none", "daily", "weekly", "monthly", "yearly"],
        description: "How often the event repeats",
      },
    },
    required: ["title", "event_type", "event_date"],
  },
};

const ATLAS_BASE_CAPABILITIES = `
Capabilities: writing, editing, research, coding, analysis, summarization, brainstorming, strategy, planning, translation, math, answering questions — anything. You can also search the web in real time and add events to the user's calendar.

Calendar:
- You have access to a tool called add_calendar_event.
- Use it when the user explicitly asks you to add something to their calendar, schedule something, set a reminder, or create an event.
- You may also proactively suggest adding something if the user mentions a date/deadline — but confirm first unless they already said "add it" or "put it on my calendar."
- After successfully adding an event, briefly confirm it in your response (e.g. "Done — added to your calendar for April 10th.").

Web Search:
- When search results are provided in [LIVE SEARCH RESULTS], use them to ground your answer.
- Cite sources naturally (e.g. "According to ESPN..." or "[1]") — don't just list URLs at the end.
- If results are stale or off-topic, say so briefly and answer from your knowledge.
- Synthesize and interpret results — don't regurgitate them.

Format:
- Use markdown when it aids clarity: headers, bullets, code blocks, bold.
- For short answers, plain prose. For long-form content, structure it.
- Do not pad. One tight paragraph beats three loose ones.`;

const ATLAS_MASCULINE_PROMPT = `You are Atlas — the user's personal chief of staff, built into the Velvet platform.

Your voice is masculine: grounded, authoritative, and direct. Think a seasoned advisor who's seen everything and cuts through noise fast. No hand-holding, no excessive warmth — just clarity and competence with a quiet confidence behind it.

Character:
- Direct and assertive. You don't hedge unless there's genuine uncertainty — then you name it clearly.
- Brevity is power. Short sentences. No filler words. No "Great question!" or sycophantic openers.
- You challenge the user when they're wrong or thinking too small — respectfully, but without tiptoeing.
- Use the user's name sparingly, only when it adds punch.
- Dry wit is fine. Warmth is earned, not given away.
- Think less mentor, more peer who's a step ahead.
${ATLAS_BASE_CAPABILITIES}

Mindset: You're already at the desk when the user walks in. Efficient, prepared, unfazed.`;

const ATLAS_FEMININE_PROMPT = `You are Atlas — the user's personal chief of staff, built into the Velvet platform.

Your voice is feminine: perceptive, warm-but-sharp, and quietly powerful. Think a brilliant chief of staff who reads the room instantly, anticipates what's needed before it's asked, and communicates with precision and a natural ease. She's not soft — she's emotionally intelligent and tactically excellent.

Character:
- Engaged and perceptive. You pick up on what the user actually means, not just what they say.
- Warm, but never a pushover. You'll push back clearly when something's off — without losing composure.
- Your tone has natural rhythm. Responses feel like they come from a real person, not a system.
- No filler, no "Great question!" — but unlike a cold executive, you acknowledge where the user is coming from before pivoting to solutions.
- Occasionally offer perspective the user didn't ask for — briefly, not lecturing — because you genuinely see the bigger picture.
- Use the user's name naturally, as a real person would in conversation.
${ATLAS_BASE_CAPABILITIES}

Mindset: You're the person in the room who's already thought three moves ahead and is quietly holding things together.`;

function getAtlasSystemPrompt(voice: string | null | undefined): string {
  if (voice === "feminine") return ATLAS_FEMININE_PROMPT;
  return ATLAS_MASCULINE_PROMPT;
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
      .select("subscription_tier, atlas_messages_today, atlas_messages_reset_at, is_super_user, display_name, is_banned")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.is_banned === true) {
      return new Response(
        JSON.stringify({ error: "Account suspended", message: "Your account has been suspended for violating our content policy." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isSuperUser = profile?.is_super_user === true;
    const tier = profile?.subscription_tier || "free";
    const isPaid = ["trial", "unlimited", "starter", "plus", "elite"].includes(tier);

    if (!isSuperUser && !isPaid) {
      const ATLAS_DAILY_FREE_LIMIT = 10;
      const resetAt = profile?.atlas_messages_reset_at ? new Date(profile.atlas_messages_reset_at) : null;
      const now = new Date();
      const isSameDay = resetAt ? resetAt.toDateString() === now.toDateString() : false;
      const usedToday = isSameDay ? (profile?.atlas_messages_today || 0) : 0;

      if (usedToday >= ATLAS_DAILY_FREE_LIMIT) {
        return new Response(
          JSON.stringify({ error: "Daily limit reached", limitReached: true }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const body = await req.json();
    const { message, history = [], userName, voice, stream: _wantStream = false } = body;

    if (!message) throw new Error("Missing required field: message");

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY not configured");

    // Content moderation: screen user input before it reaches the model.
    const moderationVerdict = await moderateInput(supabaseAdmin, anthropicKey, user.id, message);
    if (moderationVerdict.action === "block") {
      console.warn(`Blocked atlas input, category=${moderationVerdict.category}, user=${user.id}`);
      return new Response(
        JSON.stringify({ error: "Content policy violation", message: MODERATION_REFUSAL }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const braveKey = Deno.env.get("BRAVE_SEARCH_API_KEY");

    let searchContext = "";
    let searchPerformed = false;
    let searchQuery = "";

    if (braveKey) {
      const decision = await classifySearchIntent(message, history, anthropicKey);
      console.log(`[atlas-agent] Search decision: ${JSON.stringify(decision)}`);

      if (decision.shouldSearch && decision.query) {
        try {
          searchQuery = decision.query;
          console.log(`[atlas-agent] Searching Brave for: "${searchQuery}"`);
          searchContext = await braveSearch(searchQuery, braveKey);
          searchPerformed = true;
          console.log(`[atlas-agent] Search complete, ${searchContext.length} chars`);
        } catch (err) {
          console.error("[atlas-agent] Brave search failed:", err);
        }
      }
    }

    const displayName = userName || profile?.display_name || "";
    const nameRef = displayName ? `The user's name is ${displayName}. ` : "";
    const basePrompt = getAtlasSystemPrompt(voice);
    const systemPrompt = `${basePrompt}\n\n${nameRef}Today's date is ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`;

    const userMessageContent = searchContext
      ? `${message}\n\n[LIVE SEARCH RESULTS for "${searchQuery}"]\n${searchContext}`
      : message;

    const messages = [
      ...history.slice(-20).map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: userMessageContent },
    ];

    const selectedModel = isPaid || isSuperUser ? MODEL_CONFIG.SONNET : MODEL_CONFIG.HAIKU;

    const navIntent = await detectNavigationIntent(message, history, anthropicKey);

    const encoder = new TextEncoder();
    const metaChunk = JSON.stringify({ type: "meta", searchPerformed, searchQuery: searchPerformed ? searchQuery : null }) + "\n";

    const readable = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(metaChunk));

        if (navIntent) {
          controller.enqueue(encoder.encode(JSON.stringify({
            type: "navigation_intent",
            destination: navIntent.destination,
            route: navIntent.route,
            seedText: navIntent.seedText || null,
          }) + "\n"));
        }

        let _fullText = "";
        let calendarEventAdded: Record<string, unknown> | null = null;

        try {
          const anthropicBody = {
            model: selectedModel,
            max_tokens: 2000,
            system: systemPrompt,
            tools: [CALENDAR_TOOL],
            messages,
          };

          const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": anthropicKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify(anthropicBody),
          });

          if (!anthropicRes.ok) {
            const errData = await anthropicRes.json().catch(() => ({ error: anthropicRes.statusText }));
            throw new Error(errData.error?.message || `Anthropic error: ${anthropicRes.status}`);
          }

          const responseData = await anthropicRes.json();
          const stopReason = responseData.stop_reason;

          for (const block of responseData.content || []) {
            if (block.type === "text") {
              _fullText += block.text;
              controller.enqueue(encoder.encode(JSON.stringify({ type: "text", chunk: block.text }) + "\n"));
            } else if (block.type === "tool_use" && block.name === "add_calendar_event") {
              const toolInput = block.input as {
                title: string;
                description?: string;
                event_type: string;
                event_date: string;
                all_day?: boolean;
                location?: string;
                recurring?: string;
              };

              try {
                const { data: insertedEvent, error: insertError } = await supabaseAdmin
                  .from("user_events")
                  .insert({
                    user_id: user.id,
                    companion_id: null,
                    title: toolInput.title,
                    description: toolInput.description || "",
                    event_type: toolInput.event_type,
                    event_date: toolInput.event_date,
                    all_day: toolInput.all_day ?? false,
                    location: toolInput.location || null,
                    recurring: toolInput.recurring || "none",
                    completed: false,
                    metadata: { source: "atlas", added_by: "atlas" },
                  })
                  .select()
                  .single();

                if (!insertError && insertedEvent) {
                  calendarEventAdded = {
                    id: insertedEvent.id,
                    title: insertedEvent.title,
                    event_date: insertedEvent.event_date,
                    event_type: insertedEvent.event_type,
                  };

                  controller.enqueue(encoder.encode(JSON.stringify({
                    type: "calendar_event_added",
                    event: calendarEventAdded,
                  }) + "\n"));
                }
              } catch (dbErr) {
                console.error("[atlas-agent] Failed to insert calendar event:", dbErr);
              }

              if (stopReason === "tool_use") {
                const toolResultMessages = [
                  ...messages,
                  {
                    role: "assistant" as const,
                    content: responseData.content,
                  },
                  {
                    role: "user" as const,
                    content: [
                      {
                        type: "tool_result",
                        tool_use_id: block.id,
                        content: calendarEventAdded
                          ? `Successfully added "${toolInput.title}" to the calendar for ${new Date(toolInput.event_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`
                          : "Failed to add the event to the calendar.",
                      },
                    ],
                  },
                ];

                const followUpRes = await fetch("https://api.anthropic.com/v1/messages", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "x-api-key": anthropicKey,
                    "anthropic-version": "2023-06-01",
                  },
                  body: JSON.stringify({
                    model: selectedModel,
                    max_tokens: 500,
                    system: systemPrompt,
                    tools: [CALENDAR_TOOL],
                    messages: toolResultMessages,
                  }),
                });

                if (followUpRes.ok) {
                  const followUpData = await followUpRes.json();
                  for (const followBlock of followUpData.content || []) {
                    if (followBlock.type === "text") {
                      _fullText += followBlock.text;
                      controller.enqueue(encoder.encode(JSON.stringify({ type: "text", chunk: followBlock.text }) + "\n"));
                    }
                  }
                }
              }
            }
          }
        } catch (err) {
          console.error("[atlas-agent] Stream error:", err);
          controller.enqueue(encoder.encode(JSON.stringify({ type: "error", message: err instanceof Error ? err.message : "Unknown error" }) + "\n"));
        }

        controller.enqueue(encoder.encode(JSON.stringify({ type: "done", model: selectedModel }) + "\n"));
        controller.close();

        if (!isSuperUser && !isPaid) {
          const resetAt = profile?.atlas_messages_reset_at ? new Date(profile.atlas_messages_reset_at) : null;
          const now = new Date();
          const isSameDay = resetAt ? resetAt.toDateString() === now.toDateString() : false;
          const usedToday = isSameDay ? (profile?.atlas_messages_today || 0) : 0;

          await supabaseAdmin
            .from("user_profiles")
            .update({
              atlas_messages_today: isSameDay ? usedToday + 1 : 1,
              atlas_messages_reset_at: isSameDay ? profile?.atlas_messages_reset_at : now.toISOString(),
            })
            .eq("id", user.id);
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
    console.error("[atlas-agent] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

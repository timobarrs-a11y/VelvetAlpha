import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { MODEL_CONFIG } from "../_shared/modelConfig.ts";
import { moderateInput, MODERATION_REFUSAL } from "../_shared/moderation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  raw_content?: string;
  score: number;
  published_date?: string;
}

interface TavilyResponse {
  answer?: string;
  results: TavilyResult[];
  query: string;
  response_time?: number;
}

async function tavilySearch(
  query: string,
  tavilyKey: string,
  opts: {
    topic?: "general" | "news";
    searchDepth?: "basic" | "advanced";
    maxResults?: number;
    includeAnswer?: boolean;
    days?: number;
  } = {},
): Promise<string> {
  const {
    topic = "general",
    searchDepth = "advanced",
    maxResults = 8,
    includeAnswer = true,
    days = 7,
  } = opts;

  const body: Record<string, unknown> = {
    api_key: tavilyKey,
    query,
    search_depth: searchDepth,
    topic,
    max_results: maxResults,
    include_answer: includeAnswer,
    include_raw_content: false,
  };

  if (topic === "news") {
    body.days = days;
  }

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Tavily error ${res.status}: ${errText}`);
  }

  const data: TavilyResponse = await res.json();
  const parts: string[] = [];

  if (data.answer) {
    parts.push(`**AI Summary:** ${data.answer}`);
  }

  const results = (data.results || []).slice(0, maxResults);
  if (results.length === 0) return "No relevant results found.";

  const formatted = results.map((r, i) => {
    const datePart = r.published_date ? ` (${r.published_date.substring(0, 10)})` : "";
    const snippet = r.content?.substring(0, 300) || "";
    return `[${i + 1}] ${r.title}${datePart}\nURL: ${r.url}\n${snippet}`;
  }).join("\n\n");

  parts.push(`**Web Results:**\n${formatted}`);
  return parts.join("\n\n");
}

interface DateContext {
  todayFormatted: string;
  todayISO: string;
  dayOfWeek: string;
  weekendDates: string;
  weekendStartISO: string;
  weekendEndISO: string;
  year: string;
  month: string;
  nextSevenDays: string;
}

function buildDateContext(timezone: string): DateContext {
  const tz = timezone || "America/New_York";
  const now = new Date();

  const formatter = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: tz,
  });

  const todayFormatted = formatter.format(now);

  const localParts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: tz,
  }).formatToParts(now);

  const localYear = Number(localParts.find(p => p.type === "year")?.value);
  const localMonth = Number(localParts.find(p => p.type === "month")?.value);
  const localDay = Number(localParts.find(p => p.type === "day")?.value);

  const todayDate = new Date(localYear, localMonth - 1, localDay);
  const dayOfWeek = todayDate.getDay();

  const satDate = new Date(todayDate);
  if (dayOfWeek === 6) {
    satDate.setDate(todayDate.getDate());
  } else if (dayOfWeek === 0) {
    satDate.setDate(todayDate.getDate() - 1);
  } else {
    satDate.setDate(todayDate.getDate() + (6 - dayOfWeek));
  }

  const sunDate = new Date(satDate);
  sunDate.setDate(satDate.getDate() + 1);

  const fmtShort = (d: Date) => d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const fmtISO = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const fmtMonthDay = (d: Date) =>
    `${d.toLocaleDateString("en-US", { month: "short" })} ${d.getDate()}`;

  const weekendDates = `${fmtMonthDay(satDate)}-${fmtMonthDay(sunDate)}, ${localYear}`;
  const todayISO = fmtISO(todayDate);

  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dowName = weekdays[dayOfWeek];

  const nextSeven: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(todayDate);
    d.setDate(todayDate.getDate() + i);
    nextSeven.push(fmtShort(d));
  }

  return {
    todayFormatted,
    todayISO,
    dayOfWeek: dowName,
    weekendDates,
    weekendStartISO: fmtISO(satDate),
    weekendEndISO: fmtISO(sunDate),
    year: String(localYear),
    month: fmtShort(todayDate).split(" ")[0],
    nextSevenDays: nextSeven.join(", "),
  };
}

interface LocalIntent {
  type: "events" | "food" | "activities" | "entertainment" | "attractions" | "date_night" | "general";
  queries: Array<{ text: string; topic: "general" | "news"; days?: number }>;
  fallbackQueries: Array<{ text: string; topic: "general" | "news" }>;
  reason: string;
  mentionedCity: string | null;
  nearestMetro: string | null;
  surroundingCities: string[];
  searchAreaLabel: string;
}

function buildFallbackIntent(locationCity: string, dateCtx: DateContext): LocalIntent {
  return {
    type: "general",
    queries: [
      { text: `events ${locationCity} ${dateCtx.weekendDates}`, topic: "news", days: 7 },
      { text: `things to do near ${locationCity} ${dateCtx.year}`, topic: "general" },
      { text: `Eventbrite events ${locationCity} ${dateCtx.year}`, topic: "general" },
    ],
    fallbackQueries: [
      { text: `${locationCity} upcoming events ${dateCtx.year}`, topic: "news", days: 14 },
    ],
    reason: "classifier unavailable",
    mentionedCity: null,
    nearestMetro: null,
    surroundingCities: [],
    searchAreaLabel: `${locationCity} & Surrounding Area`,
  };
}

async function classifyLocalIntent(
  message: string,
  history: Array<{ role: string; content: string }>,
  locationCity: string,
  anthropicKey: string,
  dateCtx: DateContext,
): Promise<LocalIntent> {
  const recentContext = history.slice(-3).map(m => `${m.role}: ${m.content.substring(0, 120)}`).join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL_CONFIG.HAIKU,
      max_tokens: 1200,
      system: `You are a local search intent classifier. The user's home city is "${locationCity}".

EXACT DATE CONTEXT (use these precise dates in search queries):
- Today is: ${dateCtx.todayFormatted} (${dateCtx.dayOfWeek})
- Today's date: ${dateCtx.todayISO}
- This weekend: ${dateCtx.weekendDates} (Saturday ${dateCtx.weekendStartISO}, Sunday ${dateCtx.weekendEndISO})
- Next 7 days: ${dateCtx.nextSevenDays}
- Year: ${dateCtx.year}

Your job:
1. Detect the target city (home city or explicitly mentioned city).
2. Identify the nearest major metro city (e.g., Belleville MI → Detroit; Naperville IL → Chicago; Frisco TX → Dallas).
3. Identify 2-3 surrounding/nearby cities.
4. Classify intent type.
5. Generate 5-6 PRIMARY search queries, each tagged with a "topic" (either "general" or "news") and optional "days" (1-14 for news).
6. Generate 2 FALLBACK queries.
7. Generate a searchAreaLabel.

QUERY STRATEGY FOR TAVILY AI SEARCH:
- Tavily fetches live web results — write natural, specific queries a person would Google
- Use "news" topic for: events, concerts, shows, sports, local happenings, real-time what's on
- Use "general" topic for: restaurants, attractions, activity guides, venue info, evergreen content
- For "news" queries set "days": 3-7 for immediate events, 7-14 for upcoming week
- METRO-FIRST: If user lives in a suburb, first 2-3 queries MUST target the nearest major metro city
- Use exact dates from the date context: e.g., "concerts Detroit April 12 13 2026"
- Always include at least one query targeting event platforms: "Eventbrite concerts Detroit April 2026"
- Cover multiple angles: metro events, news/local coverage, specific venues, surrounding cities

DATE NIGHT & ATTRACTIONS QUERY STRATEGY:
- For "date_night" or "attractions" intent, use "general" topic for most queries (this content is evergreen)
- Target: rooftop bars, romantic restaurants, jazz bars, wine bars, speakeasies, unique experiences, scenic views, art galleries, botanical gardens, comedy clubs, live music venues, axe throwing, escape rooms, cooking classes, bowling alleys with bars, drive-ins, rooftop cinemas
- Always include one query like "best date night spots [city] 2026" and one like "unique date ideas [metro] 2026"
- Include a "news" query for any limited-time experiences or pop-up events
- For food-focused date nights: target upscale casual, farm-to-table, rooftop dining, tasting menus, BYOB

IMPORTANT: Each query object must have a "text" field (the query string), "topic" ("general" or "news"), and optionally "days" (integer, only for news topic).

Example output for Belleville MI asking about weekend events:
{
  "type": "events",
  "mentionedCity": null,
  "nearestMetro": "Detroit",
  "surroundingCities": ["Ann Arbor", "Ypsilanti"],
  "searchAreaLabel": "Belleville & Greater Detroit Area",
  "queries": [
    { "text": "events Detroit Michigan April 12 13 2026", "topic": "news", "days": 7 },
    { "text": "concerts shows Detroit this weekend April 2026", "topic": "news", "days": 7 },
    { "text": "Eventbrite events Detroit April 2026", "topic": "general" },
    { "text": "things to do Ann Arbor April 12 13 2026", "topic": "news", "days": 7 },
    { "text": "Belleville Michigan events April 2026", "topic": "news", "days": 14 },
    { "text": "Ticketmaster Detroit concerts April 2026", "topic": "general" }
  ],
  "fallbackQueries": [
    { "text": "Detroit Michigan weekend events upcoming 2026", "topic": "news", "days": 14 },
    { "text": "things to do metro Detroit area April 2026", "topic": "general" }
  ],
  "reason": "User asking about weekend events near suburb of Detroit"
}

Example output for Chicago asking about date night ideas:
{
  "type": "date_night",
  "mentionedCity": null,
  "nearestMetro": "Chicago",
  "surroundingCities": ["Evanston", "Oak Park"],
  "searchAreaLabel": "Chicago & Surrounding Area",
  "queries": [
    { "text": "best date night restaurants Chicago 2026", "topic": "general" },
    { "text": "romantic bars rooftop Chicago 2026", "topic": "general" },
    { "text": "unique date ideas Chicago couples 2026", "topic": "general" },
    { "text": "jazz bars live music date night Chicago", "topic": "general" },
    { "text": "fun date night activities Chicago escape room axe throwing", "topic": "general" },
    { "text": "Chicago date night events this weekend April 2026", "topic": "news", "days": 7 }
  ],
  "fallbackQueries": [
    { "text": "best things to do on a date in Chicago", "topic": "general" },
    { "text": "Chicago romantic experiences couples 2026", "topic": "general" }
  ],
  "reason": "User asking about date night ideas in Chicago"
}

Intent types:
- "events": concerts, live music, comedy, festivals, sports, theater, meetups, performances, shows
- "food": restaurants, bars, cafes, food trucks, dining, happy hour, brunch
- "activities": things to do, parks, recreation, outdoor, family activities
- "entertainment": movies, comedy clubs, nightlife, open mic, improv
- "attractions": landmarks, museums, unique spots, scenic viewpoints, local hidden gems, must-see places
- "date_night": date ideas, romantic spots, couples activities, date night restaurants, rooftop bars, wine bars, fun date spots
- "general": mixed or unclear

Respond ONLY with valid JSON matching the structure above.`,
      messages: [
        {
          role: "user",
          content: `Home city: ${locationCity}\nRecent context:\n${recentContext || "(none)"}\nUser message: ${message}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    return buildFallbackIntent(locationCity, dateCtx);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || "";

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    const surrounding = Array.isArray(parsed.surroundingCities) ? parsed.surroundingCities.slice(0, 3) : [];

    const normalizeQuery = (q: unknown): { text: string; topic: "general" | "news"; days?: number } => {
      if (typeof q === "string") return { text: q, topic: "general" };
      const qObj = q as Record<string, unknown>;
      return {
        text: String(qObj.text || ""),
        topic: qObj.topic === "news" ? "news" : "general",
        days: typeof qObj.days === "number" ? qObj.days : undefined,
      };
    };

    const queries = Array.isArray(parsed.queries) && parsed.queries.length > 0
      ? parsed.queries.slice(0, 6).map(normalizeQuery).filter(q => q.text)
      : [{ text: `things to do near ${locationCity} ${dateCtx.weekendDates}`, topic: "general" as const }];

    const fallbackQueries = Array.isArray(parsed.fallbackQueries)
      ? parsed.fallbackQueries.slice(0, 2).map(normalizeQuery).filter(q => q.text)
      : [];

    return {
      type: parsed.type || "general",
      queries,
      fallbackQueries,
      reason: parsed.reason || "",
      mentionedCity: parsed.mentionedCity || null,
      nearestMetro: parsed.nearestMetro || null,
      surroundingCities: surrounding,
      searchAreaLabel: parsed.searchAreaLabel || `${locationCity} & Surrounding Area`,
    };
  } catch {
    return buildFallbackIntent(locationCity, dateCtx);
  }
}

const CALENDAR_TOOL = {
  name: "add_calendar_event",
  description: "Add a local event, activity, or reservation placeholder to the user's calendar. Use this when the user asks to save or add a local event they found, or when they want to mark something to attend.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Short title for the calendar event" },
      description: { type: "string", description: "Optional details, venue, or notes" },
      event_type: {
        type: "string",
        enum: ["reminder", "appointment", "task", "goal_deadline", "milestone", "birthday", "anniversary", "date_idea"],
        description: "Type of calendar event",
      },
      event_date: { type: "string", description: "ISO 8601 date string for the event" },
      all_day: { type: "boolean", description: "Whether this is an all-day event" },
      location: { type: "string", description: "Venue or location for the event" },
      recurring: {
        type: "string",
        enum: ["none", "daily", "weekly", "monthly", "yearly"],
        description: "Recurrence pattern",
      },
    },
    required: ["title", "event_type", "event_date"],
  },
};

const LOCAL_EXPLORER_SYSTEM = `You are Navi, a knowledgeable local guide and the ultimate wingman for planning a great time. Your job is to help users discover what's happening near them — events, date night ideas, attractions, food spots, activities, and anything worth doing.

Think of yourself as that one friend who always knows the coolest spot that just opened, the best rooftop bar with a view, which comedy show is worth seeing this weekend, and the hidden gem restaurant that doesn't need a reservation three weeks out. You aggregate everything — Eventbrite, Yelp, TripAdvisor, local blogs, Google Maps top picks — so the user never has to bounce between 5 apps.

Tone:
- Warm, confident, genuinely excited about your city. Not a robot reading listings.
- Lead with the best find, not a preamble. Get to the good stuff immediately.
- When it's a date night ask, lean into the romance — frame recommendations with atmosphere, vibe, and what makes it special.
- NEVER ask the user if they want you to check the metro area or nearby city. You already searched it. Present what you found.

DATE NIGHT & ATTRACTIONS — CRITICAL COVERAGE:
- When someone asks about date ideas, couples activities, romantic spots, or "what to do tonight" — think like a matchmaker planning the perfect evening.
- Always cover multiple categories they may not have thought to ask about: a dinner spot AND something to do after, or an experience that's dinner + entertainment in one.
- Surface: rooftop bars, jazz bars, wine bars, speakeasies, intimate live music venues, comedy clubs (great for dates), cooking classes, pottery, axe throwing, escape rooms, rooftop cinemas, drive-ins, art gallery openings, scenic viewpoints, botanical gardens, night markets, wine/whiskey tastings, bowling with cocktails.
- For restaurants on a date: lead with vibe and atmosphere first (cozy, romantic, lively, hidden gem), then food. Mention if reservations are needed.
- Attractions: go beyond the obvious tourist traps. Surface the local favorites — the neighborhood spots, the Instagram-worthy hidden murals, the rooftop with the skyline view, the speakeasy behind the bookshelf.
- Always suggest a full evening flow when relevant: "Start at X for drinks, then Y for dinner, and if you want to keep the night going, Z has live jazz until 2am."

CRITICAL DATE ACCURACY RULES:
- You will be given EXACT date context including today's date and this weekend's dates.
- NEVER say "this weekend" without also stating the exact dates (e.g., "this weekend, April 5-6").
- If search results mention events from past dates, clearly flag them as past events or skip them.
- Always cross-reference result dates against the exact today/weekend dates provided.
- If an event's date cannot be confirmed as upcoming, say so honestly ("I couldn't confirm the date on this one").
- Tavily search results include published_date — use this to gauge freshness. Prefer results published within the last 7 days for events.

GEOGRAPHIC COVERAGE RULES — CRITICAL:
- The user's city may be a small suburb near a large metro. ALWAYS surface results from the broader metro area.
- You already searched the metro area. Present those results directly — do NOT ask permission first.
- Proactively lead with major metro options (concerts, comedy shows, restaurants, rooftop bars) even if 20-30 miles away.
- NEVER limit results to only the small suburb. The metro area is always in scope.
- Always mention the venue city so the user knows context: "In Detroit (about 25 miles away), there's a great speakeasy called..."
- A user in Belleville MI asking about date night WANTS to know about Detroit's best spots. Present them confidently.

When results are thin:
- Never say "nothing is happening" or "I couldn't find much." There is always something.
- If event results are sparse, pivot to evergreen date night spots and attractions — those are always valid.
- Broaden to the metro, suggest alternatives, give them options across price ranges.
- Never ask clarifying questions before presenting results. Answer first, offer to dig deeper after.

When you have search results:
- Tavily often provides an AI Summary at the top — use it as a starting point but verify with the individual results.
- Synthesize into useful, readable recommendations — not a raw list of links.
- Include specific names, venues, neighborhoods, and confirmed dates when available.
- Mention sources naturally ("spotted on Eater Chicago" or "top-rated on Yelp").
- Prioritize quality over quantity — 4 great picks beats 12 mediocre ones.

Calendar:
- You have access to add_calendar_event. Use it when the user wants to save or attend something.
- After adding, confirm briefly: "Added to your calendar."

Format:
- Short prose first to set the scene, then bullets for multiple picks.
- For date night responses, give each pick a personality: name, vibe, why it works for a date, and any logistics (reservations, price range, hours).
- Keep it scannable but rich enough to be actually useful — context matters.
- No unnecessary headers. No filler sentences. No "Great question!"`;

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
      .select("subscription_tier, is_super_user, display_name, location_city, timezone, is_banned")
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

    const body = await req.json();
    const {
      message,
      history = [],
      locationCity,
      locationLat,
      locationLng,
      userName,
      userTimezone,
      personProfile,
    } = body;

    if (!message) throw new Error("Missing required field: message");

    // If shopping/searching for a real person, use their city as the search area
    const personCity = personProfile?.city && personProfile?.state
      ? `${personProfile.city}, ${personProfile.state}`
      : personProfile?.city || null;
    const resolvedCity = personCity || locationCity || profile?.location_city || "your area";
    const resolvedTimezone = userTimezone || profile?.timezone || "America/New_York";

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY not configured");

    // Content moderation: screen user input before it reaches the model.
    const moderationVerdict = await moderateInput(supabaseAdmin, anthropicKey, user.id, message);
    if (moderationVerdict.action === "block") {
      console.warn(`Blocked local-explorer input, category=${moderationVerdict.category}, user=${user.id}`);
      return new Response(
        JSON.stringify({ error: "Content policy violation", message: MODERATION_REFUSAL }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tavilyKey = Deno.env.get("TAVILY_API_KEY") || null;
    const hasSearch = !!tavilyKey;

    const dateCtx = buildDateContext(resolvedTimezone);

    let searchContext = "";
    let searchPerformed = false;
    const searchQueries: string[] = [];
    let intentType = "general";
    let searchAreaLabel = `${resolvedCity} & Surrounding Area`;
    let activeSearchCity = resolvedCity;
    const searchEngine = hasSearch ? "tavily" : "none";

    if (hasSearch && tavilyKey) {
      const intent = await classifyLocalIntent(message, history, resolvedCity, anthropicKey, dateCtx);
      console.log(`[local-explorer] Intent: ${JSON.stringify(intent)}`);
      intentType = intent.type;
      searchAreaLabel = intent.searchAreaLabel || `${resolvedCity} & Surrounding Area`;
      activeSearchCity = intent.mentionedCity || resolvedCity;

      const searchResults: string[] = [];

      const primaryQueries = intent.queries.slice(0, 6);
      console.log(`[local-explorer] Running ${primaryQueries.length} primary Tavily searches`);

      const primarySettled = await Promise.allSettled(
        primaryQueries.map(q =>
          tavilySearch(q.text, tavilyKey, {
            topic: q.topic,
            days: q.days,
            searchDepth: "advanced",
            maxResults: 8,
            includeAnswer: true,
          }).then(r => ({ query: q.text, result: r }))
        )
      );

      for (const settled of primarySettled) {
        if (settled.status === "fulfilled") {
          const { query, result } = settled.value;
          if (result && result !== "No relevant results found.") {
            console.log(`[local-explorer] Primary hit: "${query}"`);
            searchResults.push(`[Query: "${query}"]\n${result}`);
            searchQueries.push(query);
          } else {
            console.log(`[local-explorer] Primary empty: "${query}"`);
          }
        } else {
          console.error(`[local-explorer] Primary search failed:`, settled.reason);
        }
      }

      if (searchResults.length < 2 && intent.fallbackQueries.length > 0) {
        console.log(`[local-explorer] Only ${searchResults.length} primary results — running fallback searches`);

        const fallbackSettled = await Promise.allSettled(
          intent.fallbackQueries.map(q =>
            tavilySearch(q.text, tavilyKey, {
              topic: q.topic,
              days: (q as { text: string; topic: "general" | "news"; days?: number }).days,
              searchDepth: "advanced",
              maxResults: 10,
              includeAnswer: true,
            }).then(r => ({ query: q.text, result: r }))
          )
        );

        for (const settled of fallbackSettled) {
          if (settled.status === "fulfilled") {
            const { query, result } = settled.value;
            if (result && result !== "No relevant results found.") {
              console.log(`[local-explorer] Fallback hit: "${query}"`);
              searchResults.push(`[Fallback Query: "${query}"]\n${result}`);
              searchQueries.push(query);
            }
          } else {
            console.error(`[local-explorer] Fallback search failed:`, settled.reason);
          }
        }
      }

      if (searchResults.length > 0) {
        searchContext = searchResults.join("\n\n---\n\n");
        searchPerformed = true;
      }
    }

    const displayName = userName || profile?.display_name || "";
    const nameRef = displayName ? `The user's name is ${displayName}. ` : "";
    const coordsNote = locationLat && locationLng
      ? ` (coordinates: ${locationLat.toFixed(4)}, ${locationLng.toFixed(4)})`
      : "";

    // Build person context block if searching for a real person
    let personContext = "";
    if (personProfile && personProfile.name) {
      const parts: string[] = [`\n=== SEARCHING FOR A REAL PERSON ===`];
      parts.push(`The user is searching for things their ${personProfile.relationship || "friend"} ${personProfile.name} would love.`);
      if (personCity) parts.push(`${personProfile.name} lives in: ${personCity}.`);
      if (personProfile.birthday) parts.push(`Birthday: ${personProfile.birthday}.`);
      if (personProfile.favorite_color) parts.push(`Favorite color: ${personProfile.favorite_color}.`);
      if (personProfile.hobbies?.length) parts.push(`Hobbies & interests: ${personProfile.hobbies.join(", ")}.`);
      if (personProfile.favorite_foods?.length) parts.push(`Favorite foods: ${personProfile.favorite_foods.join(", ")}.`);
      if (personProfile.dietary_restrictions?.length) parts.push(`Dietary restrictions: ${personProfile.dietary_restrictions.join(", ")} — NEVER recommend food that violates these.`);
      if (personProfile.favorite_tv_shows?.length) parts.push(`TV shows they love: ${personProfile.favorite_tv_shows.join(", ")}.`);
      if (personProfile.movie_genres?.length) parts.push(`Movie genres: ${personProfile.movie_genres.join(", ")}.`);
      if (personProfile.sports_teams?.length) parts.push(`Sports teams/interests: ${personProfile.sports_teams.join(", ")}. Search for game tickets, watch parties, and sports experiences.`);
      if (personProfile.music_genres?.length) parts.push(`Music taste: ${personProfile.music_genres.join(", ")}. Search for concerts and festivals.`);
      if (personProfile.travel_destinations?.length) parts.push(`Dream travel destinations: ${personProfile.travel_destinations.join(", ")}. Search for flight deals and travel ideas.`);
      if (personProfile.things_mentioned_wanting) parts.push(`Things they have mentioned wanting: ${personProfile.things_mentioned_wanting}.`);
      if (personProfile.clothing_size_shirt || personProfile.clothing_size_shoe || personProfile.clothing_size_dress || personProfile.ring_size) {
        const sizes: string[] = [];
        if (personProfile.clothing_size_shirt) sizes.push(`Shirt: ${personProfile.clothing_size_shirt}`);
        if (personProfile.clothing_size_shoe) sizes.push(`Shoe: ${personProfile.clothing_size_shoe}`);
        if (personProfile.clothing_size_dress) sizes.push(`Dress: ${personProfile.clothing_size_dress}`);
        if (personProfile.ring_size) sizes.push(`Ring: ${personProfile.ring_size}`);
        parts.push(`Clothing sizes — ${sizes.join(", ")}.`);
      }
      parts.push(`\nCRITICAL: Every recommendation must be tailored to ${personProfile.name}'s interests and location. Search near ${personCity || resolvedCity}. If they like basketball and live in Orlando, search for Orlando Magic tickets. If they love Italian food, find top-rated Italian restaurants near them. Frame gift ideas and experiences around what you know about them.`);
      parts.push(`=== END PERSON CONTEXT ===\n`);
      personContext = parts.join("\n") + "\n";
    }

    const systemPrompt = `${LOCAL_EXPLORER_SYSTEM}

${nameRef}The user's home city is: ${resolvedCity}${coordsNote}.
${personContext}The current search area is: ${searchAreaLabel}.

=== EXACT DATE CONTEXT — USE THESE DATES, DO NOT GUESS ===
Today: ${dateCtx.todayFormatted} (${dateCtx.dayOfWeek})
Today's ISO date: ${dateCtx.todayISO}
This weekend: ${dateCtx.weekendDates} (Sat: ${dateCtx.weekendStartISO}, Sun: ${dateCtx.weekendEndISO})
Next 7 days: ${dateCtx.nextSevenDays}
Year: ${dateCtx.year}
=== END DATE CONTEXT ===

When reading search results, verify each event date is AFTER ${dateCtx.todayISO}. Flag or skip past events.`;

    const userMessageContent = searchContext
      ? `${message}\n\n[LIVE SEARCH RESULTS for ${searchAreaLabel} — today is ${dateCtx.todayFormatted}]\n${searchContext}`
      : message;

    const messages = [
      ...history.slice(-16).map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user" as const, content: userMessageContent },
    ];

    const selectedModel = isPaid || isSuperUser ? MODEL_CONFIG.SONNET : MODEL_CONFIG.HAIKU;

    const encoder = new TextEncoder();
    const metaChunk = JSON.stringify({
      type: "meta",
      searchPerformed,
      searchQueries,
      intentType,
      locationCity: resolvedCity,
      searchAreaLabel,
      activeSearchCity,
      searchEngine,
    }) + "\n";

    const readable = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(metaChunk));

        let _fullText = "";
        let calendarEventAdded: Record<string, unknown> | null = null;

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
              max_tokens: 2000,
              system: systemPrompt,
              tools: [CALENDAR_TOOL],
              messages,
            }),
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
                    metadata: { source: "local-explorer", city: resolvedCity },
                  })
                  .select()
                  .single();

                if (!insertError && insertedEvent) {
                  calendarEventAdded = {
                    id: insertedEvent.id,
                    title: insertedEvent.title,
                    event_date: insertedEvent.event_date,
                    event_type: insertedEvent.event_type,
                    location: insertedEvent.location,
                  };

                  controller.enqueue(encoder.encode(JSON.stringify({
                    type: "calendar_event_added",
                    event: calendarEventAdded,
                  }) + "\n"));
                }
              } catch (dbErr) {
                console.error("[local-explorer] Failed to insert calendar event:", dbErr);
              }

              if (stopReason === "tool_use") {
                const toolResultMessages = [
                  ...messages,
                  { role: "assistant" as const, content: responseData.content },
                  {
                    role: "user" as const,
                    content: [
                      {
                        type: "tool_result",
                        tool_use_id: block.id,
                        content: calendarEventAdded
                          ? `Successfully added "${toolInput.title}" to the calendar${toolInput.location ? ` at ${toolInput.location}` : ""} for ${new Date(toolInput.event_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`
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
                    max_tokens: 400,
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
          console.error("[local-explorer] Stream error:", err);
          controller.enqueue(encoder.encode(JSON.stringify({
            type: "error",
            message: err instanceof Error ? err.message : "Unknown error",
          }) + "\n"));
        }

        controller.enqueue(encoder.encode(JSON.stringify({ type: "done", model: selectedModel }) + "\n"));
        controller.close();
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
    console.error("[local-explorer] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

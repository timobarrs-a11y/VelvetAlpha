import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { MODEL_CONFIG } from "../_shared/modelConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  answer?: string;
  results: TavilyResult[];
}

async function tavilySearch(
  query: string,
  tavilyKey: string,
  maxResults = 5,
): Promise<TavilyResult[]> {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: tavilyKey,
        query,
        search_depth: "basic",
        topic: "general",
        max_results: maxResults,
        include_answer: true,
        include_raw_content: false,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data: TavilyResponse = await res.json();
    return data.results || [];
  } catch {
    return [];
  }
}

interface PersonRecord {
  id: string;
  user_id: string;
  name: string;
  relationship: string;
  birthday: string | null;
  city: string | null;
  state: string | null;
  hobbies: string[];
  favorite_foods: string[];
  dietary_restrictions: string[];
  favorite_tv_shows: string[];
  movie_genres: string[];
  sports_teams: string[];
  music_genres: string[];
  travel_destinations: string[];
  clothing_size_shirt: string | null;
  clothing_size_shoe: string | null;
  things_mentioned_wanting: string | null;
}

interface ContactLogRow {
  contact_date: string;
  contact_type: string;
}

interface Opportunity {
  type: 'gift' | 'event' | 'restaurant' | 'concert' | 'travel' | 'experience' | 'date_idea';
  title: string;
  description: string;
  url?: string;
  relevance: string;
  price_range?: string;
}

interface Insight {
  type: 'contact_gap' | 'upcoming_event' | 'preference_match' | 'health_trend';
  text: string;
  severity: 'info' | 'warning' | 'urgent';
}

function daysUntilNextBirthday(birthday: string | null): number | null {
  if (!birthday) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const bd = new Date(birthday);
  const thisYear = today.getFullYear();
  let nextBd = new Date(thisYear, bd.getMonth(), bd.getDate());
  if (nextBd < today) {
    nextBd = new Date(thisYear + 1, bd.getMonth(), bd.getDate());
  }
  return Math.ceil((nextBd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function computeContactGap(logs: ContactLogRow[]): number {
  if (logs.length === 0) return 999;
  const sorted = logs.sort((a, b) => b.contact_date.localeCompare(a.contact_date));
  const lastDate = new Date(sorted[0].contact_date);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  lastDate.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
}

function computeHealthScore(gapDays: number, contacts30Days: number): number {
  let score = 100;
  score -= Math.min(gapDays * 3, 60);
  if (contacts30Days >= 3) score += 15;
  else if (contacts30Days >= 1) score += 5;
  if (contacts30Days >= 3) score += 10;
  return Math.max(0, Math.min(100, score));
}

function buildSearchQueries(person: PersonRecord, daysToBirthday: number | null): string[] {
  const location = person.city && person.state
    ? `${person.city}, ${person.state}`
    : person.city || 'their area';
  const queries: string[] = [];

  if (daysToBirthday !== null && daysToBirthday <= 30) {
    if (person.hobbies.length > 0) {
      queries.push(`best birthday gift ideas for someone who loves ${person.hobbies.slice(0, 3).join(', ')}`);
    }
    if (person.favorite_foods.length > 0) {
      queries.push(`best ${person.favorite_foods[0]} restaurants near ${location}`);
    }
    queries.push(`unique birthday gift ideas ${person.relationship} 2026`);
  }

  if (person.sports_teams.length > 0) {
    queries.push(`${person.sports_teams[0]} upcoming games tickets 2026 near ${location}`);
  }

  if (person.music_genres.length > 0) {
    queries.push(`${person.music_genres[0]} concerts near ${location} 2026`);
  }

  if (person.travel_destinations.length > 0) {
    queries.push(`cheap flights to ${person.travel_destinations[0]} 2026 deals`);
  }

  if (person.hobbies.length > 0) {
    queries.push(`${person.hobbies[0]} events classes near ${location} 2026`);
  }

  if (queries.length < 3) {
    queries.push(`things to do near ${location} this weekend`);
    queries.push(`best restaurants near ${location} 2026`);
  }

  return queries.slice(0, 5);
}

async function searchForPerson(
  person: PersonRecord,
  tavilyKey: string,
): Promise<Opportunity[]> {
  const daysToBd = daysUntilNextBirthday(person.birthday);
  const queries = buildSearchQueries(person, daysToBd);
  const allResults: { query: string; results: TavilyResult[] }[] = [];

  for (const query of queries) {
    const results = await tavilySearch(query, tavilyKey, 3);
    allResults.push({ query, results });
  }

  const opportunities: Opportunity[] = [];

  for (const { query, results } of allResults) {
    for (const r of results.slice(0, 2)) {
      let type: Opportunity['type'] = 'experience';
      const q = query.toLowerCase();
      if (q.includes('restaurant') || q.includes('food')) type = 'restaurant';
      else if (q.includes('concert') || q.includes('music')) type = 'concert';
      else if (q.includes('flight') || q.includes('travel')) type = 'travel';
      else if (q.includes('game') || q.includes('sport')) type = 'event';
      else if (q.includes('gift') || q.includes('birthday')) type = 'gift';
      else if (q.includes('date')) type = 'date_idea';

      opportunities.push({
        type,
        title: r.title.substring(0, 120),
        description: r.content?.substring(0, 200) || '',
        url: r.url,
        relevance: query,
      });
    }
  }

  return opportunities.slice(0, 6);
}

async function generateBriefSummary(
  person: PersonRecord,
  healthScore: number,
  gapDays: number,
  daysToBirthday: number | null,
  opportunities: Opportunity[],
  anthropicKey: string,
): Promise<{ summary: string; insights: Insight[] }> {
  const insights: Insight[] = [];

  if (gapDays >= 14) {
    insights.push({
      type: 'contact_gap',
      text: `You haven't logged contact with ${person.name} in ${gapDays} days. Consider reaching out.`,
      severity: gapDays >= 30 ? 'urgent' : 'warning',
    });
  }

  if (daysToBirthday !== null && daysToBirthday <= 30) {
    insights.push({
      type: 'upcoming_event',
      text: `${person.name}'s birthday is in ${daysToBirthday} day${daysToBirthday === 1 ? '' : 's'}.`,
      severity: daysToBirthday <= 7 ? 'urgent' : 'info',
    });
  }

  if (person.sports_teams.length > 0) {
    const sportsOpp = opportunities.find(o => o.type === 'event');
    if (sportsOpp) {
      insights.push({
        type: 'preference_match',
        text: `Found something for ${person.name}'s interest in ${person.sports_teams[0]}.`,
        severity: 'info',
      });
    }
  }

  if (healthScore < 40) {
    insights.push({
      type: 'health_trend',
      text: `Your relationship health with ${person.name} is declining (score: ${healthScore}). Regular contact can improve this.`,
      severity: 'warning',
    });
  }

  let summary = '';
  try {
    const contextParts: string[] = [];
    contextParts.push(`Person: ${person.name} (${person.relationship})`);
    contextParts.push(`Health score: ${healthScore}/100`);
    contextParts.push(`Contact gap: ${gapDays} days`);
    if (daysToBirthday !== null && daysToBirthday <= 30) {
      contextParts.push(`Birthday in ${daysToBirthday} days`);
    }
    if (person.hobbies.length > 0) contextParts.push(`Hobbies: ${person.hobbies.join(', ')}`);
    if (person.favorite_foods.length > 0) contextParts.push(`Favorite foods: ${person.favorite_foods.join(', ')}`);
    if (person.sports_teams.length > 0) contextParts.push(`Sports: ${person.sports_teams.join(', ')}`);
    if (person.music_genres.length > 0) contextParts.push(`Music: ${person.music_genres.join(', ')}`);
    contextParts.push(`Opportunities found: ${opportunities.length}`);

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
        system: "Write a single warm, actionable sentence (max 25 words) summarizing what the user should do this week for this person. Be specific and personal. No preamble.",
        messages: [{
          role: 'user',
          content: contextParts.join('\n'),
        }],
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const data = await res.json();
      summary = data.content?.[0]?.text?.trim() || '';
    }
  } catch {
    // fallback below
  }

  if (!summary) {
    if (daysToBirthday !== null && daysToBirthday <= 30) {
      summary = `${person.name}'s birthday is in ${daysToBirthday} days — check the gift ideas and plan something special.`;
    } else if (gapDays >= 14) {
      summary = `It's been ${gapDays} days since you last contacted ${person.name} — reach out this week.`;
    } else if (opportunities.length > 0) {
      summary = `${opportunities.length} opportunities found for ${person.name} this week — tap below to explore.`;
    } else {
      summary = `Stay connected with ${person.name} this week.`;
    }
  }

  return { summary, insights };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'generate';

    if (action !== 'generate') {
      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tavilyKey = Deno.env.get("TAVILY_API_KEY") || "";
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY") || "";

    // Fetch all people for this user
    const { data: people, error: peopleError } = await supabase
      .from('real_people')
      .select('*')
      .eq('user_id', user.id);

    if (peopleError) throw new Error(`People fetch failed: ${peopleError.message}`);
    if (!people || people.length === 0) {
      return new Response(JSON.stringify({ generated: 0, message: "No people found. Add someone first." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const briefWeek = new Date();
    briefWeek.setDate(briefWeek.getDate() - briefWeek.getDay() + 1);
    const briefWeekStr = briefWeek.toISOString().split('T')[0];

    let generated = 0;

    for (const person of people as PersonRecord[]) {
      // Check if brief already exists for this week
      const { data: existing } = await supabase
        .from('relationship_briefs')
        .select('id')
        .eq('user_id', user.id)
        .eq('person_id', person.id)
        .eq('brief_week', briefWeekStr)
        .maybeSingle();

      if (existing) continue;

      // Fetch contact logs
      const { data: contactLogs } = await supabase
        .from('relationship_contact_log')
        .select('contact_date, contact_type')
        .eq('person_id', person.id)
        .order('contact_date', { ascending: false });

      const logs = (contactLogs || []) as ContactLogRow[];
      const gapDays = computeContactGap(logs);
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const contacts30Days = logs.filter(l => new Date(l.contact_date) >= thirtyDaysAgo).length;
      const healthScore = computeHealthScore(gapDays, contacts30Days);

      const daysToBd = daysUntilNextBirthday(person.birthday);
      const eventType = daysToBd !== null && daysToBd <= 30 ? 'birthday' : 'none';

      // Search for opportunities
      let opportunities: Opportunity[] = [];
      if (tavilyKey) {
        opportunities = await searchForPerson(person, tavilyKey);
      }

      // Generate summary + insights
      const { summary, insights } = await generateBriefSummary(
        person, healthScore, gapDays, daysToBd, opportunities, anthropicKey,
      );

      // Compute upcoming event date
      let upcomingEventDate: string | null = null;
      if (eventType === 'birthday' && person.birthday) {
        const bd = new Date(person.birthday);
        const thisYear = now.getFullYear();
        let nextBd = new Date(thisYear, bd.getMonth(), bd.getDate());
        if (nextBd < now) {
          nextBd = new Date(thisYear + 1, bd.getMonth(), bd.getDate());
        }
        upcomingEventDate = nextBd.toISOString().split('T')[0];
      }

      // Insert the brief
      const { error: insertError } = await supabase
        .from('relationship_briefs')
        .insert({
          user_id: user.id,
          person_id: person.id,
          brief_week: briefWeekStr,
          health_score: healthScore,
          contact_gap_days: gapDays,
          upcoming_event_type: eventType,
          upcoming_event_date: upcomingEventDate,
          days_until_event: daysToBd,
          opportunities: opportunities as unknown as Record<string, unknown>[],
          insights: insights as unknown as Record<string, unknown>[],
          brief_summary: summary,
          is_read: false,
        });

      if (insertError) {
        console.error(`Brief insert failed for ${person.name}:`, insertError.message);
        continue;
      }

      generated++;
    }

    const message = generated > 0
      ? `Generated ${generated} relationship brief${generated === 1 ? '' : 's'} for this week.`
      : "All briefs are up to date for this week.";

    return new Response(JSON.stringify({ generated, message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Relationship brief engine error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

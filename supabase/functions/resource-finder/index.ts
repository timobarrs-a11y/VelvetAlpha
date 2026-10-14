import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk@0.70.0";
import { MODEL_CONFIG } from "../_shared/modelConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CachedResult {
  id: string;
  title: string;
  channel: string;
  thumbnail: string;
  url: string;
  duration?: string;
}

interface AnnotationResult {
  picked: CachedResult | null;
  note: string;
}

async function searchYouTube(query: string): Promise<CachedResult[]> {
  const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
  if (!YOUTUBE_API_KEY) throw new Error("YouTube API key not configured");

  const filteredQuery = `${query} -kids -children -bedtime -cartoon -animated -nursery`;
  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(filteredQuery)}&type=video&maxResults=10&safeSearch=strict&key=${YOUTUBE_API_KEY}`;

  const searchResponse = await fetch(searchUrl);
  if (!searchResponse.ok) throw new Error(`YouTube search failed: ${searchResponse.statusText}`);
  const searchData = await searchResponse.json();

  const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');
  const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,status,contentDetails&id=${videoIds}&key=${YOUTUBE_API_KEY}`;

  const detailsResponse = await fetch(detailsUrl);
  if (!detailsResponse.ok) throw new Error(`YouTube details failed: ${detailsResponse.statusText}`);
  const detailsData = await detailsResponse.json();

  const isPlayable = (item: any): boolean => {
    const status = item.status || {};
    if (status.embeddable === false) return false;
    if (status.privacyStatus && status.privacyStatus === 'private') return false;
    if (status.uploadStatus && status.uploadStatus !== 'processed') return false;
    const blocked = item.contentDetails?.regionRestriction?.blocked;
    if (Array.isArray(blocked) && blocked.includes('US')) return false;
    const allowed = item.contentDetails?.regionRestriction?.allowed;
    if (Array.isArray(allowed) && !allowed.includes('US')) return false;
    return true;
  };

  const playable = (detailsData.items || []).filter(isPlayable);

  return playable.map((item: any) => ({
    id: item.id,
    title: item.snippet.title,
    channel: item.snippet.channelTitle,
    thumbnail: item.snippet.thumbnails?.high?.url ?? item.snippet.thumbnails?.default?.url ?? '',
    url: `https://www.youtube.com/watch?v=${item.id}`,
    duration: item.contentDetails?.duration,
  }));
}

async function annotateWithCoach(
  query: string,
  results: CachedResult[],
  coachContext?: string,
): Promise<AnnotationResult> {
  const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

  const videoList = results.slice(0, 8).map((v, i) =>
    `${i + 1}. "${v.title}" by ${v.channel}\n   URL: ${v.url}`
  ).join('\n');

  const prompt = `You are a coach selecting a learning resource for your student. The student is working on: "${query}"
${coachContext ? `\nCoach context: ${coachContext}\n` : ''}
Here are YouTube search results:

${videoList}

Your task: Pick the SINGLE best video for learning this topic, and write a short coach annotation (1-2 sentences) explaining why you picked it and what to watch for — like a teacher would.

Respond as JSON: {"index": <number>, "note": "<your annotation>"}
The index is 1-based (1 = first result). Pick the one most useful for actual learning.`;

  const message = await anthropic.messages.create({
    model: MODEL_CONFIG.HAIKU,
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") throw new Error("Unexpected AI response type");

  let jsonText = content.text.trim();
  const codeBlockMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlockMatch) jsonText = codeBlockMatch[1];
  else {
    const objMatch = jsonText.match(/(\{[\s\S]*\})/);
    if (objMatch) jsonText = objMatch[1];
  }

  const parsed = JSON.parse(jsonText);
  const picked = results[parsed.index - 1] ?? null;

  return { picked, note: parsed.note ?? '' };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { query, coachContext, cacheResults } = await req.json();

    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: "Query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const videos = await searchYouTube(query);

    if (videos.length === 0) {
      return new Response(
        JSON.stringify({ results: [], annotation: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const annotation = await annotateWithCoach(query, videos, coachContext);

    return new Response(
      JSON.stringify({
        results: videos,
        annotation: annotation.picked
          ? {
              resource: annotation.picked,
              note: annotation.note,
            }
          : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in resource-finder:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk@0.70.0";
import { MODEL_CONFIG } from "../_shared/modelConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface YouTubeVideo {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  channelTitle: string;
  publishedAt: string;
  viewCount?: string;
}

async function searchYouTube(query: string): Promise<YouTubeVideo[]> {
  const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");

  if (!YOUTUBE_API_KEY) {
    throw new Error("YouTube API key not configured");
  }

  // Add filters to exclude kids content and prefer adult-oriented results
  const filteredQuery = `${query} -kids -children -bedtime -cartoon -animated -nursery`;

  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(filteredQuery)}&type=video&maxResults=20&safeSearch=none&key=${YOUTUBE_API_KEY}`;

  const searchResponse = await fetch(searchUrl);
  if (!searchResponse.ok) {
    throw new Error(`YouTube search failed: ${searchResponse.statusText}`);
  }

  const searchData = await searchResponse.json();
  const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');

  // Request `status` and `contentDetails` so we can drop videos that will never
  // render in our embedded player — the uploader disabled embedding, the video
  // isn't public, or it's region-blocked for US viewers. These are exactly the
  // ones that would show "Video unavailable" inside the iframe with no way for
  // the client to detect it.
  const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,status,contentDetails&id=${videoIds}&key=${YOUTUBE_API_KEY}`;

  const detailsResponse = await fetch(detailsUrl);
  if (!detailsResponse.ok) {
    throw new Error(`YouTube details failed: ${detailsResponse.statusText}`);
  }

  const detailsData = await detailsResponse.json();

  const isPlayable = (item: any): boolean => {
    const status = item.status || {};
    // Uploader turned off embedding — the #1 cause of "won't load" videos.
    if (status.embeddable === false) return false;
    // Private / deleted / still-processing uploads won't play either.
    if (status.privacyStatus && status.privacyStatus === 'private') return false;
    if (status.uploadStatus && status.uploadStatus !== 'processed') return false;
    // Region-blocked for US viewers (our audience).
    const blocked = item.contentDetails?.regionRestriction?.blocked;
    if (Array.isArray(blocked) && blocked.includes('US')) return false;
    const allowed = item.contentDetails?.regionRestriction?.allowed;
    if (Array.isArray(allowed) && !allowed.includes('US')) return false;
    return true;
  };

  const total = detailsData.items?.length ?? 0;
  const playable = (detailsData.items || []).filter(isPlayable);
  if (total !== playable.length) {
    console.log(`[smart-video-search] Filtered ${total - playable.length}/${total} non-embeddable videos`);
  }

  return playable.map((item: any) => ({
    id: item.id,
    title: item.snippet.title,
    description: item.snippet.description,
    thumbnail: item.snippet.thumbnails.high.url,
    channelTitle: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
    viewCount: item.statistics?.viewCount,
  }));
}

async function rankVideosWithAI(query: string, videos: YouTubeVideo[], userContext?: string): Promise<YouTubeVideo[]> {
  const anthropic = new Anthropic({
    apiKey: Deno.env.get("ANTHROPIC_API_KEY"),
  });

  const videoList = videos.map((v, idx) =>
    `${idx + 1}. "${v.title}" by ${v.channelTitle}\n   Description: ${v.description.slice(0, 200)}...\n   Views: ${parseInt(v.viewCount || '0').toLocaleString()}`
  ).join('\n\n');

  const prompt = `You are a smart video recommendation system for an adult companion app. A user searched for: "${query}"

${userContext ? `User context: ${userContext}\n\n` : ''}Here are YouTube search results:

${videoList}

Your task: Rank these videos based on contextual relevance and usefulness, NOT popularity. Consider:
- This is for ADULT users in a companion/relationship app context
- STRICTLY AVOID: children's content, bedtime stories for kids, cartoons, nursery rhymes, animated kids shows
- PREFER: mature content, relationship advice, adult entertainment, documentaries, lifestyle content, comedy for adults
- What would be genuinely helpful or interesting about "${query}" for adult users
- Avoid clickbait or low-quality content
- Prioritize educational, insightful, entertaining, or romantic content appropriate for adults
- If the query seems romantic or intimate, prioritize content suitable for couples/relationships

Respond with ONLY a JSON array of video numbers in order of relevance, like: [3, 7, 1, 5, 2, ...]
Include the top 8 most relevant videos. EXCLUDE any videos that are clearly for children.`;

  const message = await anthropic.messages.create({
    model: MODEL_CONFIG.HAIKU,
    max_tokens: 500,
    messages: [{
      role: "user",
      content: prompt
    }]
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from AI");
  }

  // Extract JSON from response, handling markdown code blocks or extra text
  let jsonText = content.text.trim();

  // Remove markdown code blocks if present
  const codeBlockMatch = jsonText.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
  if (codeBlockMatch) {
    jsonText = codeBlockMatch[1];
  } else {
    // Try to find JSON array in the text
    const arrayMatch = jsonText.match(/(\[\s*\d+(?:\s*,\s*\d+)*\s*\])/);
    if (arrayMatch) {
      jsonText = arrayMatch[1];
    }
  }

  const rankings = JSON.parse(jsonText);

  return rankings
    .map((num: number) => videos[num - 1])
    .filter((v: YouTubeVideo | undefined) => v !== undefined);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { query, userContext } = await req.json();

    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: "Query is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const videos = await searchYouTube(query);

    if (videos.length === 0) {
      return new Response(
        JSON.stringify({ videos: [] }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const rankedVideos = await rankVideosWithAI(query, videos, userContext);

    return new Response(
      JSON.stringify({ videos: rankedVideos }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in smart-video-search:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

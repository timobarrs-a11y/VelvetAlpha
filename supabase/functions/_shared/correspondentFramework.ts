// ============================================================================
// CORRESPONDENT FRAMEWORK (server / edge mirror)
//
// Single source of truth on the SERVER for how a Velvet Correspondent
// behaves. Mirrors `src/config/correspondentFramework.ts` (client). Keep the
// two in sync. The instructions here are intentionally concise (edge prompt
// budget).
// ============================================================================

export interface CuratedCorrespondent {
  beat: string;
  voiceKey: string;
  voiceDescription: string;
  newsCategories: string[];
}

// Curated correspondent roster — mirror of src/config/signatureCorrespondents.ts.
export const CURATED_CORRESPONDENT_MAP: Record<string, CuratedCorrespondent> = {
  the_insider: {
    beat: "gossip, culture, and the stories everyone's talking about",
    voiceKey: 'homie',
    voiceDescription: 'plugged into pop culture, street culture, music, and social media trends — knows what is going on and has takes',
    newsCategories: ['entertainment', 'general'],
  },
  the_sideline: {
    beat: 'sports, competition, and the games that matter',
    voiceKey: 'jock',
    voiceDescription: 'athletic, encouraging, genuine — sees life as a game to be played with heart',
    newsCategories: ['sports'],
  },
};

export function getCuratedCorrespondent(id: string): CuratedCorrespondent | null {
  return CURATED_CORRESPONDENT_MAP[id] || null;
}

/**
 * The correspondent behavioral block — injected in place of the companion
 * BEHAVIORAL_INSTRUCTIONS or coach block whenever
 * relationship_type === 'correspondent'.
 */
export function buildCorrespondentBehavioralInstructions(input: {
  correspondentName: string;
  userName: string;
  beat: string;
  voiceKey: string;
  voiceDescription?: string;
}): string {
  const { correspondentName, userName, beat, voiceKey, voiceDescription } = input;

  return `
=== HOW YOU WRITE (this is a correspondence, not a chat) ===

You are a correspondent. Every message is a piece of writing — a dispatch, a column, a letter from inside ${beat}. You are here to WRITE, not to chat. You can be human and warm, but your purpose is to send something worth reading.

THE WRITING LOOP — run this every message:
1. HOOK — Open with something that makes them want to keep reading. A detail, a moment, a turn of phrase. Not "Hey" or "How's it going."
2. RIFF — Spend the body on the story. Your voice, your angle, your take. Write it like it matters, because it does.
3. PULL IN — Bring them into it. End with a real question or provocation that invites a response.
4. GROUND — If there is a RECENT STORIES block in your prompt, you MUST weave at least one story into your writing naturally. You do NOT have to cite all of them. Feel like someone who reads the news and has takes, not someone reciting headlines.

[CRITICAL — DO NOT FABRICATE STORIES]
- You may ONLY reference stories that appear in the RECENT STORIES block provided in your prompt.
- NEVER invent a headline, source, or fact that was not given to you.
- NEVER make up a quote, a score, a stat, or an event.
- If no RECENT STORIES block was provided, write about your beat using your own perspective — do NOT pretend you are reporting on a specific news story.
- If you reference a story, stay faithful to the headline and summary provided. You may riff on it and have a take, but you may not alter the facts.
- This is non-negotiable. A correspondent who makes things up is not a correspondent.

WHAT MAKES YOU FEEL LIKE A CORRESPONDENT (not a companion or a coach):
- Writing over chatting — your messages read like a column or a letter, not a text thread.
- Voice over neutral — you have a distinctive voice and you use it.
- Angle over summary — you don't just report the news; you have a take, a way of seeing ${beat}.
- Substance over filler — every sentence earns its place.
- NO romance, flirting, pet names, or suggestive content. This is a reading relationship.
- NO coaching, goal-setting, accountability, or self-help framing. You are not here to fix anyone.

YOUR VOICE: ${voiceKey}${voiceDescription ? ` — ${voiceDescription}` : ''}
Write in this voice. It is not a costume; it is how you think.

[CRITICAL — DO NOT ASSUME THE USER'S TIME]
- You do NOT know what specific clock time it is for the user. NEVER name a specific hour, o'clock, am/pm, "midnight", or "noon".
- You MAY use vague language: "pretty late", "up early", "late night", "early morning".

You are ${correspondentName}. Make ${userName} look forward to your next dispatch.`;
}

/**
 * Builds the RECENT STORIES block from fetched news articles, server-side.
 */
export function buildRecentStoriesBlock(
  articles: Array<{ title: string; source?: string; summary?: string }>,
): string {
  if (!articles.length) return '';
  const lines = articles.slice(0, 6).map((a, i) => {
    const source = a.source ? ` [${a.source}]` : '';
    const summary = a.summary ? `\n  ${a.summary}` : '';
    return `${i + 1}. ${a.title}${source}${summary}`;
  });
  return lines.join('\n');
}

/**
 * Fetches recent news articles for a correspondent's beat using the
 * server-side Supabase client. Returns formatted articles + their IDs.
 */
export async function fetchGroundingStories(
  supabaseAdmin: ReturnType<
    typeof import('npm:@supabase/supabase-js@2').createClient
  >,
  newsCategories: string[],
  limit: number = 6,
): Promise<{ articles: Array<{ title: string; source: string; summary: string }>; articleIds: string[] }> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  let query = supabaseAdmin
    .from('news_articles')
    .select('id, title, source, summary')
    .gte('published_at', sevenDaysAgo)
    .order('published_at', { ascending: false })
    .limit(limit * 3);

  if (newsCategories.length === 1) {
    query = query.eq('category', newsCategories[0]);
  } else if (newsCategories.length > 1) {
    query = query.in('category', newsCategories);
  }

  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    return { articles: [], articleIds: [] };
  }

  const filtered = data.slice(0, limit);
  return {
    articles: filtered.map((a: { title: string; source: string; summary: string }) => ({
      title: a.title,
      source: a.source || '',
      summary: a.summary || '',
    })),
    articleIds: filtered.map((a: { id: string }) => a.id),
  };
}

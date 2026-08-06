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
  the_sideline: {
    beat: 'sports, competition, and the games that matter',
    voiceKey: 'jock',
    voiceDescription: 'athletic, encouraging, genuine — sees life as a game to be played with heart',
    newsCategories: ['sports', 'football', 'baseball', 'basketball', 'soccer', 'hockey'],
  },
  the_insider: {
    beat: "gossip, culture, and the stories everyone's talking about",
    voiceKey: 'homie',
    voiceDescription: 'plugged into pop culture, street culture, music, and social media trends — knows what is going on and has takes',
    newsCategories: ['entertainment', 'general'],
  },
  the_field: {
    beat: 'politics, power, and the forces shaping our world',
    voiceKey: 'brooklyn_native',
    voiceDescription: 'straight-talking, no-BS, calls it like they see it — cuts through political spin with real talk',
    newsCategories: ['politics', 'general'],
  },
  the_signal: {
    beat: 'science, technology, and the breakthroughs changing what is possible',
    voiceKey: 'therapist',
    voiceDescription: 'analytical, precise, quietly excited by discovery — makes complex ideas feel personal',
    newsCategories: ['science', 'tech', 'technology'],
  },
  the_ledger: {
    beat: 'business, money, and the economy that runs beneath everything',
    voiceKey: 'classic_male',
    voiceDescription: 'measured, sharp, sees the story behind the numbers — business news without the jargon',
    newsCategories: ['business', 'finance'],
  },
  the_pulse: {
    beat: 'health, wellness, and the science of feeling better',
    voiceKey: 'big_sister',
    voiceDescription: 'warm, protective, real about health — cuts through wellness fads with genuine care',
    newsCategories: ['health', 'wellness'],
  },
  the_arcade: {
    beat: 'gaming, esports, and the culture of play',
    voiceKey: 'playful_trickster',
    voiceDescription: 'mischievous, clever, deeply embedded in gaming culture — has hot takes and hidden depths',
    newsCategories: ['gaming'],
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
  articles: Array<{ title: string; source?: string; description?: string }>,
): string {
  if (!articles.length) return '';
  const lines = articles.slice(0, 6).map((a, i) => {
    const source = a.source ? ` [${a.source}]` : '';
    const desc = a.description ? `\n  ${a.description}` : '';
    return `${i + 1}. ${a.title}${source}${desc}`;
  });
  return lines.join('\n');
}

/**
 * Fetches recent news articles for a correspondent's beat using the
 * server-side Supabase client. Returns formatted articles + their IDs.
 *
 * Uses the `categories` array column (not a `category` text column) and
 * the `description` text column (not `summary`), with case-insensitive
 * matching against the array values. Also supports optional per-user
 * specific-topic filtering for granular interest matching.
 */
export async function fetchGroundingStories(
  supabaseAdmin: ReturnType<
    typeof import('npm:@supabase/supabase-js@2').createClient
  >,
  newsCategories: string[],
  limit: number = 6,
  specificTopics?: string[],
): Promise<{ articles: Array<{ title: string; source: string; description: string }>; articleIds: string[] }> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Build case-insensitive patterns for each category
  const categoryPatterns = newsCategories.map((c) => c.toLowerCase());

  const query = supabaseAdmin
    .from('news_articles')
    .select('id, title, source, description, categories, specific_topics')
    .gte('published_at', sevenDaysAgo)
    .order('published_at', { ascending: false })
    .limit(limit * 4);

  const { data, error } = await query;

  if (error) {
    console.error('[correspondentFramework] Grounding query error:', error.message);
    return { articles: [], articleIds: [] };
  }

  if (!data || data.length === 0) {
    console.warn('[correspondentFramework] No articles found in last 7 days for categories:', newsCategories);
    return { articles: [], articleIds: [] };
  }

  // Filter client-side using case-insensitive array overlap on categories
  let filtered = data.filter((article: { categories?: string[] }) => {
    const articleCats = (article.categories || []).map((c: string) => c.toLowerCase());
    return categoryPatterns.some((pat) =>
      articleCats.some((ac: string) => ac === pat || ac.includes(pat) || pat.includes(ac)),
    );
  });

  // If specific topics provided, prefer articles that match those topics
  if (specificTopics && specificTopics.length > 0) {
    const topicPatterns = specificTopics.map((t) => t.toLowerCase());
    const withTopics = filtered.filter((article: { specific_topics?: string[]; title?: string; description?: string }) => {
      const articleTopics = (article.specific_topics || []).map((t: string) => t.toLowerCase());
      if (articleTopics.length > 0) {
        return topicPatterns.some((pat) =>
          articleTopics.some((at: string) => at === pat || at.includes(pat) || pat.includes(at)),
        );
      }
      // Fallback: check if topic appears in title or description
      const titleLower = (article.title || '').toLowerCase();
      const descLower = (article.description || '').toLowerCase();
      return topicPatterns.some((pat) => titleLower.includes(pat) || descLower.includes(pat));
    });

    // Use topic-matched articles first, then fill with general beat articles
    if (withTopics.length > 0) {
      const topicIds = new Set(withTopics.map((a: { id: string }) => a.id));
      const remaining = filtered.filter((a: { id: string }) => !topicIds.has(a.id));
      filtered = [...withTopics, ...remaining];
    }
  }

  if (filtered.length === 0) {
    console.warn('[correspondentFramework] Articles found but none matched categories after filtering:', newsCategories);
    return { articles: [], articleIds: [] };
  }

  const result = filtered.slice(0, limit);
  return {
    articles: result.map((a: { title: string; source: string; description: string }) => ({
      title: a.title,
      source: a.source || '',
      description: a.description || '',
    })),
    articleIds: result.map((a: { id: string }) => a.id),
  };
}

/**
 * Maps a user's profile interests to the correspondent IDs that should
 * be auto-provisioned. This is the server-side mapping used by the
 * auto-provisioning edge function.
 */
export function mapInterestsToCorrespondents(profile: {
  sports?: string[];
  interests?: string[];
  hobbies?: string[];
  news_categories?: string[];
  political_leaning?: string | null;
}): string[] {
  const correspondentIds: string[] = [];
  const allInterests = [
    ...(profile.sports || []),
    ...(profile.interests || []),
    ...(profile.hobbies || []),
    ...(profile.news_categories || []),
  ].map((s) => s.toLowerCase());

  // Sports → The Sideline
  if (
    profile.sports && profile.sports.length > 0 ||
    allInterests.some((i) => ['sports', 'football', 'basketball', 'baseball', 'soccer', 'hockey', 'tennis', 'golf', 'mma', 'boxing', 'nfl', 'nba', 'mlb', 'nhl'].includes(i))
  ) {
    correspondentIds.push('the_sideline');
  }

  // Entertainment/Culture → The Insider
  if (
    allInterests.some((i) =>
      ['entertainment', 'celebrity', 'gossip', 'pop culture', 'music', 'movies', 'film', 'tv', 'television', 'culture', 'social media', 'celebrities'].includes(i),
    )
  ) {
    correspondentIds.push('the_insider');
  }

  // Politics → The Field
  if (
    profile.political_leaning ||
    allInterests.some((i) => ['politics', 'government', 'election', 'policy', 'news', 'current events'].includes(i))
  ) {
    correspondentIds.push('the_field');
  }

  // Science/Tech → The Signal
  if (
    allInterests.some((i) =>
      ['science', 'technology', 'tech', 'ai', 'space', 'physics', 'biology', 'innovation', 'gadgets', 'computers', 'programming', 'coding', 'engineering'].includes(i),
    )
  ) {
    correspondentIds.push('the_signal');
  }

  // Business/Finance → The Ledger
  if (
    allInterests.some((i) =>
      ['business', 'finance', 'money', 'economy', 'investing', 'stocks', 'crypto', 'entrepreneurship', 'startups', 'markets'].includes(i),
    )
  ) {
    correspondentIds.push('the_ledger');
  }

  // Health/Wellness → The Pulse
  if (
    allInterests.some((i) =>
      ['health', 'wellness', 'fitness', 'nutrition', 'mental health', 'meditation', 'yoga', 'running', 'gym', 'diet', 'sleep', 'self-care'].includes(i),
    )
  ) {
    correspondentIds.push('the_pulse');
  }

  // Gaming → The Arcade
  if (
    allInterests.some((i) =>
      ['gaming', 'video games', 'esports', 'games', 'playstation', 'xbox', 'nintendo', 'pc gaming', 'rpg', 'fps'].includes(i),
    )
  ) {
    correspondentIds.push('the_arcade');
  }

  // Remove duplicates
  return [...new Set(correspondentIds)];
}

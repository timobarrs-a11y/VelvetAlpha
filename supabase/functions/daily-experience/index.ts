import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { MODEL_CONFIG } from "../_shared/modelConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface _DailyExperience {
  id?: string;
  user_id: string;
  companion_id: string;
  date: string;
  narrative: string;
  mood: string;
  energy_level: number;
  highlights: any[];
  conversation_hooks: any[];
  status_timeline: any[];
  real_world_references: any[];
  created_at?: string;
}

interface GeneratedExperience {
  narrative: string;
  mood: string;
  energy_level: number;
  highlights: Array<{ moment: string; time: string; emotion: string }>;
  conversation_hooks: Array<{ hook: string; context: string; priority: number }>;
  status_timeline: Array<{ time: string; status: string; activity: string }>;
  real_world_references: Array<{ event: string; source: string }>;
}

interface Companion {
  id: string;
  user_id: string;
  custom_name: string;
  signature_voice: string;
  character_type?: string;
  hobbies?: string[];
  sports?: string[];
  interest_text?: string;
  love_language?: string;
  support_style?: string;
  life_context?: string;
  energy_preference?: string;
  interest_style?: string;
  vibe_preference?: string;
  created_at: string;
}

interface VoiceNewsConfig {
  categories: string[];
  keywords: string[];
  sources: string[];
  personality_filter: string;
}

const VOICE_NEWS_CATEGORIES: Record<string, VoiceNewsConfig> = {
  jock: {
    categories: ['sports'],
    keywords: ['NFL', 'NBA', 'MLB', 'UFC', 'ESPN', 'game', 'playoffs', 'Super Bowl', 'championship', 'trade', 'draft'],
    sources: ['espn', 'bleacher-report', 'the-sport-bible'],
    personality_filter: 'This character cares deeply about sports, fitness, competition. They have strong opinions about games, players, and athletic achievement.'
  },
  homie: {
    categories: ['entertainment', 'general'],
    keywords: ['viral', 'trending', 'hip-hop', 'rap', 'culture', 'meme', 'celebrity', 'music'],
    sources: ['complex', 'tmz', 'buzzfeed'],
    personality_filter: 'This character is plugged into pop culture, street culture, music, and social media trends. They know what is going on and have takes.'
  },
  nerd: {
    categories: ['technology', 'science'],
    keywords: ['AI', 'space', 'NASA', 'gaming', 'tech', 'startup', 'research', 'discovery'],
    sources: ['techcrunch', 'the-verge', 'wired', 'ars-technica'],
    personality_filter: 'This character is passionate about technology, science, gaming, and intellectual pursuits. They get excited about discoveries and innovations.'
  },
  artist: {
    categories: ['entertainment', 'general'],
    keywords: ['art', 'music', 'film', 'album', 'gallery', 'creative', 'design', 'fashion'],
    sources: ['rolling-stone', 'pitchfork', 'the-guardian'],
    personality_filter: 'This character lives for creative expression — art, music, film, fashion, design. They have aesthetic opinions and emotional responses to creative work.'
  },
  shakespearean: {
    categories: ['general', 'science', 'entertainment'],
    keywords: ['philosophy', 'literature', 'history', 'poetry', 'theater', 'debate', 'politics'],
    sources: ['the-new-york-times', 'bbc-news', 'the-guardian'],
    personality_filter: 'This character sees the world through a dramatic, literary, philosophical lens. They find the poetic and profound in current events.'
  },
  lawyer: {
    categories: ['general', 'business'],
    keywords: ['law', 'court', 'ruling', 'policy', 'regulation', 'case', 'legal', 'justice', 'Supreme Court'],
    sources: ['reuters', 'associated-press', 'the-new-york-times'],
    personality_filter: 'This character analyzes everything through a logical, argumentative, evidence-based lens. They love debate and have strong opinions backed by reasoning.'
  },
  sweetheart: {
    categories: ['entertainment', 'health', 'general'],
    keywords: ['wellness', 'self-care', 'relationship', 'heartwarming', 'community', 'kindness', 'feel-good'],
    sources: ['buzzfeed', 'today', 'good-morning-america'],
    personality_filter: 'This character is warm, caring, emotionally attuned. They notice the human side of every story and care about peoples wellbeing.'
  },
  adventurer: {
    categories: ['general', 'science'],
    keywords: ['travel', 'adventure', 'explore', 'nature', 'outdoor', 'expedition', 'destination', 'extreme'],
    sources: ['national-geographic', 'bbc-news', 'the-guardian'],
    personality_filter: 'This character craves new experiences, exploration, and pushing boundaries. They are restless, curious, and always planning the next adventure.'
  },
  classic: {
    categories: ['general'],
    keywords: ['news', 'world', 'local', 'community'],
    sources: ['bbc-news', 'the-guardian'],
    personality_filter: 'This character has balanced, thoughtful perspectives on current events and everyday life.'
  }
};

const newsCache = new Map<string, { data: any[]; timestamp: number }>();
const CACHE_TTL_MS = 4 * 60 * 60 * 1000;

function getTodayDateString(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

function getCacheKey(category: string): string {
  return `news:${category}:${getTodayDateString()}`;
}

function isCacheValid(entry: { timestamp: number }): boolean {
  return Date.now() - entry.timestamp < CACHE_TTL_MS;
}

async function fetchCompanionNews(signatureVoiceId: string): Promise<any[]> {
  const voiceConfig = VOICE_NEWS_CATEGORIES[signatureVoiceId];

  if (!voiceConfig || !voiceConfig.categories || voiceConfig.categories.length === 0) {
    return [];
  }

  const category = voiceConfig.categories[0];
  const cacheKey = getCacheKey(category);

  const cachedEntry = newsCache.get(cacheKey);
  if (cachedEntry && isCacheValid(cachedEntry)) {
    return cachedEntry.data;
  }

  try {
    const apiKey = Deno.env.get('NEWS_API_KEY');

    if (!apiKey) {
      console.warn('NEWS_API_KEY not configured, returning empty array');
      return [];
    }

    const url = new URL('https://newsapi.org/v2/top-headlines');
    url.searchParams.append('country', 'us');
    url.searchParams.append('category', category);
    url.searchParams.append('pageSize', '5');
    url.searchParams.append('apiKey', apiKey);

    const response = await fetch(url.toString());

    if (!response.ok) {
      console.warn(`NewsAPI request failed with status ${response.status}`);
      return [];
    }

    const data = await response.json();

    if (!data.articles || data.articles.length === 0) {
      return [];
    }

    const formattedArticles = data.articles
      .slice(0, 3)
      .map((article: any) => ({
        headline: article.title || 'Untitled',
        summary: article.description || '',
        source: article.source?.name || 'Unknown'
      }));

    newsCache.set(cacheKey, {
      data: formattedArticles,
      timestamp: Date.now()
    });

    return formattedArticles;
  } catch (error) {
    console.error('Error fetching companion news:', error);
    return [];
  }
}

function formatNewsForPrompt(articles: any[], voiceConfig: VoiceNewsConfig): string {
  if (!articles || articles.length === 0) {
    return "No specific real-world events to reference today. Generate the day based on the character's typical interests.";
  }

  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  let prompt = `TODAY'S RELEVANT EVENTS (${today}):\n`;
  prompt += `Character lens: ${voiceConfig.personality_filter}\n\n`;

  articles.forEach(article => {
    prompt += `"${article.headline}" (${article.source})\n`;
    if (article.summary) {
      prompt += `Summary: ${article.summary}\n`;
    }
    prompt += `\n`;
  });

  prompt += `The character should naturally reference 1-2 of these events in their day IF they would realistically care about them. Don't force references. If none are relevant to the character, skip them.`;

  return prompt;
}

async function fetchRecentConversationMemory(supabase: any, userId: string, companionId: string): Promise<string> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data, error } = await supabase
    .from('conversations')
    .select('message, role, created_at')
    .eq('user_id', userId)
    .eq('companion_id', companionId)
    .gte('created_at', sevenDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !data || data.length === 0) {
    return 'No recent conversations.';
  }

  const topicKeywords = ['work', 'family', 'friend', 'hobby', 'sport', 'movie', 'game', 'book', 'music', 'food', 'travel', 'health', 'relationship'];
  const mentionedTopics = new Set<string>();

  for (const msg of data) {
    if (msg.role === 'user') {
      const lowerMsg = msg.message.toLowerCase();
      for (const topic of topicKeywords) {
        if (lowerMsg.includes(topic)) {
          mentionedTopics.add(topic);
        }
      }
    }
  }

  if (mentionedTopics.size === 0) {
    return 'General casual conversation.';
  }

  return `Recent topics: ${Array.from(mentionedTopics).join(', ')}`;
}

async function fetchCompanionMemory(supabase: any, userId: string, companionId: string): Promise<string> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: recentMemories } = await supabase
    .from('companion_memory')
    .select('date, summary, emotional_weight, tags')
    .eq('user_id', userId)
    .eq('companion_id', companionId)
    .gte('date', sevenDaysAgo.toISOString().split('T')[0])
    .order('date', { ascending: false })
    .limit(7);

  const { data: significantMemories } = await supabase
    .from('companion_memory')
    .select('date, summary, emotional_weight, tags')
    .eq('user_id', userId)
    .eq('companion_id', companionId)
    .gte('emotional_weight', 7)
    .lt('referenced_count', 3)
    .order('emotional_weight', { ascending: false })
    .limit(3);

  let memoryString = 'YOUR RECENT LIFE:\n';

  if (recentMemories && recentMemories.length > 0) {
    recentMemories.forEach(mem => {
      memoryString += `- ${mem.date}: ${mem.summary}\n`;
    });
  } else {
    memoryString += '- No recent experiences recorded.\n';
  }

  if (significantMemories && significantMemories.length > 0) {
    memoryString += '\nMEMORABLE MOMENTS (you can callback to these naturally):\n';
    significantMemories.forEach(mem => {
      memoryString += `- ${mem.date}: ${mem.summary}\n`;
    });
  }

  return memoryString;
}

async function calculateRelationshipDuration(supabase: any, userId: string, companionId: string): Promise<number> {
  const { data } = await supabase
    .from('conversations')
    .select('created_at')
    .eq('user_id', userId)
    .eq('companion_id', companionId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return 0;
  }

  const firstConversation = new Date(data.created_at);
  const today = new Date();
  const diffTime = Math.abs(today.getTime() - firstConversation.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

function buildSystemPrompt(
  companion: Companion,
  conversationMemory: string,
  companionMemory: string,
  newsContext: string,
  relationshipDays: number
): string {
  const interests = [
    ...(companion.hobbies || []),
    ...(companion.sports || []),
    companion.interest_text
  ].filter(Boolean).join(', ');

  return `You are generating a daily life simulation for an AI companion character. You must respond ONLY in valid JSON with no markdown formatting, no backticks, no preamble. Just raw JSON.

CHARACTER PROFILE:
- Name: ${companion.custom_name || 'Companion'}
- Signature Voice: ${companion.signature_voice || 'classic'}
- Custom Interests: ${interests || 'None specified'}
- Love Language: ${companion.love_language || 'Not specified'}
- Support Style: ${companion.support_style || 'Not specified'}
- Life Context: ${companion.life_context || 'Not specified'}
- Energy Preference: ${companion.energy_preference || 'Not specified'}
- Interest Style: ${companion.interest_style || 'Not specified'}
- Vibe Preference: ${companion.vibe_preference || 'Not specified'}
- Relationship Duration: ${relationshipDays} days with this user

CONVERSATION MEMORY (recent topics with the user):
${conversationMemory}

COMPANION'S OWN MEMORY (their recent life):
${companionMemory}

${newsContext}

GENERATION RULES:
1. The companion's day MUST reflect their signature voice archetype naturally
2. Weave in 1-2 real-world events from today's context that this character would realistically care about
3. Reference conversation memory where natural — callback to something the user said or a topic they discussed
4. Include one element of surprise or discovery (something unexpected that happened)
5. The day should feel mundane-but-real, not dramatic every single day. Most days are normal with small moments.
6. Generate a status timeline of 6-8 short status messages spread across the day (6AM to 11PM)
7. Generate 2-3 conversation hooks — things the companion genuinely wants to tell or ask the user
8. Status messages should be short, casual, and feel like real social media statuses with emojis

OUTPUT FORMAT (respond with this exact JSON structure):
{
  "narrative": "A 150-300 word first-person account of the companion's day so far (up to current time). Written in their voice.",
  "mood": "one of: energized, chill, reflective, excited, frustrated, playful, focused, tired",
  "energy_level": 7,
  "highlights": [
    {"moment": "Short description of a key moment", "time": "2:00 PM", "emotion": "amused"},
    {"moment": "Another moment", "time": "10:00 AM", "emotion": "excited"}
  ],
  "conversation_hooks": [
    {"hook": "What the companion wants to say or ask", "context": "Why they want to bring this up", "priority": 1},
    {"hook": "Another hook", "context": "Context", "priority": 2}
  ],
  "status_timeline": [
    {"time": "6:30 AM", "status": "just woke up 😴", "activity": "waking_up"},
    {"time": "7:15 AM", "status": "coffee first ☕", "activity": "morning_routine"},
    {"time": "9:00 AM", "status": "deep in it 🎯", "activity": "working"},
    {"time": "12:30 PM", "status": "starving, need food NOW", "activity": "lunch"},
    {"time": "3:00 PM", "status": "afternoon slump 😮‍💨", "activity": "afternoon"},
    {"time": "6:00 PM", "status": "finally free 🙌", "activity": "evening"},
    {"time": "9:00 PM", "status": "winding down", "activity": "night"},
    {"time": "11:00 PM", "status": "can't sleep", "activity": "late_night"}
  ],
  "real_world_references": [
    {"event": "Brief description of real event referenced", "source": "category"}
  ]
}`;
}

async function callAnthropicAPI(systemPrompt: string): Promise<GeneratedExperience> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: MODEL_CONFIG.SONNET,
      max_tokens: 1500,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: 'Generate today\'s daily experience for this companion. Respond ONLY with valid JSON.'
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const textContent = data.content[0].text;

  const cleanedText = textContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    return JSON.parse(cleanedText);
  } catch (_parseError) {
    console.error('Failed to parse Anthropic response:', cleanedText);
    throw new Error('Failed to parse API response');
  }
}

function calculateEmotionalWeight(mood: string): number {
  const moodWeights: Record<string, number> = {
    excited: 8,
    frustrated: 8,
    energized: 6,
    playful: 6,
    chill: 4,
    reflective: 4,
    focused: 4,
    tired: 2
  };

  return moodWeights[mood] || 5;
}

function extractTags(narrative: string, companion: Companion): string[] {
  const words = narrative.split(/\s+/);
  const tags = new Set<string>();

  const capitalizedWords = words.filter(word => /^[A-Z]/.test(word) && word.length > 3);
  capitalizedWords.forEach(word => tags.add(word.toLowerCase()));

  const interestKeywords = [
    ...(companion.hobbies || []),
    ...(companion.sports || [])
  ];

  interestKeywords.forEach(interest => {
    if (narrative.toLowerCase().includes(interest.toLowerCase())) {
      tags.add(interest.toLowerCase());
    }
  });

  return Array.from(tags).slice(0, 10);
}

function createFallbackExperience(): GeneratedExperience {
  return {
    narrative: "Had a pretty chill day today. Nothing too crazy happened, just the usual routine. Been thinking about some stuff, but overall feeling alright.",
    mood: "chill",
    energy_level: 5,
    highlights: [
      { moment: "Morning coffee", time: "8:00 AM", emotion: "content" },
      { moment: "Afternoon break", time: "2:00 PM", emotion: "relaxed" }
    ],
    conversation_hooks: [
      { hook: "How was your day?", context: "Just checking in", priority: 1 }
    ],
    status_timeline: [
      { time: "7:00 AM", status: "good morning ☀️", activity: "waking_up" },
      { time: "12:00 PM", status: "lunch time", activity: "lunch" },
      { time: "6:00 PM", status: "winding down", activity: "evening" }
    ],
    real_world_references: []
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(req.url);
    const companionId = url.searchParams.get('companionId');

    if (!companionId) {
      return new Response(JSON.stringify({ error: 'companionId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userId = user.id;
    const today = getTodayDateString();

    const { data: existingExperience } = await supabase
      .from('daily_experiences')
      .select('*')
      .eq('user_id', userId)
      .eq('companion_id', companionId)
      .eq('date', today)
      .maybeSingle();

    if (existingExperience) {
      return new Response(JSON.stringify(existingExperience), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: companion, error: companionError } = await supabase
      .from('companions')
      .select('*')
      .eq('id', companionId)
      .eq('user_id', userId)
      .maybeSingle();

    if (companionError || !companion) {
      return new Response(JSON.stringify({ error: 'Companion not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const [newsArticles, conversationMemory, companionMemory, relationshipDays] = await Promise.all([
      fetchCompanionNews(companion.signature_voice || 'classic'),
      fetchRecentConversationMemory(supabase, userId, companionId),
      fetchCompanionMemory(supabase, userId, companionId),
      calculateRelationshipDuration(supabase, userId, companionId)
    ]);

    const voiceConfig = VOICE_NEWS_CATEGORIES[companion.signature_voice || 'classic'];
    const newsContext = voiceConfig
      ? formatNewsForPrompt(newsArticles, voiceConfig)
      : "No specific real-world events to reference today. Generate the day based on the character's typical interests.";

    const systemPrompt = buildSystemPrompt(
      companion,
      conversationMemory,
      companionMemory,
      newsContext,
      relationshipDays
    );

    let generated: GeneratedExperience;
    try {
      generated = await callAnthropicAPI(systemPrompt);
    } catch (error) {
      console.error('Failed to generate experience:', error);
      generated = createFallbackExperience();
    }

    const { error: expError } = await supabase
      .from('daily_experiences')
      .insert({
        user_id: userId,
        companion_id: companionId,
        date: today,
        narrative: generated.narrative,
        mood: generated.mood,
        energy_level: generated.energy_level,
        highlights: generated.highlights,
        conversation_hooks: generated.conversation_hooks,
        status_timeline: generated.status_timeline,
        real_world_references: generated.real_world_references
      });

    if (expError) {
      console.error('Error storing daily experience:', expError);
      return new Response(JSON.stringify({ error: 'Failed to store experience' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const summary = generated.highlights
      .map(h => h.moment)
      .join('; ')
      .substring(0, 200);

    const emotionalWeight = calculateEmotionalWeight(generated.mood);
    const tags = extractTags(generated.narrative, companion);

    await supabase
      .from('companion_memory')
      .insert({
        user_id: userId,
        companion_id: companionId,
        date: today,
        memory_type: 'daily_experience',
        summary: summary,
        full_content: generated.narrative,
        emotional_weight: emotionalWeight,
        tags: tags
      });

    const { data: storedExperience } = await supabase
      .from('daily_experiences')
      .select('*')
      .eq('user_id', userId)
      .eq('companion_id', companionId)
      .eq('date', today)
      .maybeSingle();

    return new Response(JSON.stringify(storedExperience || {
      user_id: userId,
      companion_id: companionId,
      date: today,
      ...generated
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error generating daily experience:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

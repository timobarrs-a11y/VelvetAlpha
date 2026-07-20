import { supabase } from '../shared/supabase/client';
import { VOICE_NEWS_CATEGORIES, VoiceNewsConfig } from '../config/voiceNewsCategories';

export interface NewsArticle {
  id: string;
  title: string;
  description: string;
  url: string;
  image_url?: string;
  published_at: string;
  source: string;
  author?: string;
  categories: string[];
  content?: string;
}

export interface CompanionNewsArticle {
  headline: string;
  summary: string;
  source: string;
}

interface CacheEntry {
  data: CompanionNewsArticle[];
  timestamp: number;
}

class NewsService {
  async getArticlesByCategories(categories: string[], limit: number = 20): Promise<NewsArticle[]> {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const filterByCategory = (rows: NewsArticle[] | null): NewsArticle[] =>
        (rows ?? []).filter((article) => {
          if (!article.categories || article.categories.length === 0) return true;
          return article.categories.some((cat: string) =>
            categories.some((userCat) =>
              cat.toLowerCase().includes(userCat.toLowerCase()) ||
              userCat.toLowerCase().includes(cat.toLowerCase())
            )
          );
        });

      const fresh = await supabase
        .from('news_articles')
        .select('*')
        .gte('published_at', sevenDaysAgo)
        .order('published_at', { ascending: false })
        .limit(limit);

      if (fresh.error) throw fresh.error;

      let filtered = filterByCategory(fresh.data);

      if (filtered.length === 0) {
        const fallback = await supabase
          .from('news_articles')
          .select('*')
          .order('published_at', { ascending: false })
          .limit(limit);
        if (fallback.error) throw fallback.error;
        filtered = filterByCategory(fallback.data);
      }

      return filtered;
    } catch (error) {
      return [];
    }
  }

  async getArticleById(articleId: string): Promise<NewsArticle | null> {
    try {
      const { data, error } = await supabase
        .from('news_articles')
        .select('*')
        .eq('id', articleId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      return null;
    }
  }

  async saveArticle(article: Partial<NewsArticle>): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('news_articles')
        .insert({
          title: article.title,
          description: article.description,
          content: article.content,
          url: article.url,
          image_url: article.image_url,
          source: article.source,
          author: article.author,
          published_at: article.published_at,
          categories: article.categories || [],
        })
        .select()
        .single();

      if (error) throw error;
      return data?.id || null;
    } catch (error) {
      return null;
    }
  }

  async getArticleConversation(articleId: string): Promise<any[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('article_conversations')
        .select('*')
        .eq('article_id', articleId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      return [];
    }
  }

  async recordArticleView(articleId: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('article_views').upsert(
        {
          article_id: articleId,
          user_id: user.id,
          viewed_at: new Date().toISOString(),
        },
        { onConflict: 'article_id,user_id' }
      );
    } catch (error) {
    }
  }

  async fetchLatestNews(interests: string[] = []): Promise<{ success: boolean; articlesAdded: number; message?: string; error?: string }> {
    try {
      const interestsParam = interests.join(',');
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-news?interests=${interestsParam}&limit=20`;

      const headers = {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(apiUrl, { headers });
      const result = await response.json();

      return result;
    } catch (error) {
      return {
        success: false,
        articlesAdded: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async getUserAllInterests(): Promise<string[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('news_categories, sports, hobbies, music_genre, sports_interests, entertainment_interests, tech_interests, lifestyle_interests')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile) return [];

      const allInterests = new Set<string>();

      const addToSet = (items: any) => {
        if (Array.isArray(items)) {
          items.forEach(item => { if (item) allInterests.add(item); });
        } else if (typeof items === 'string' && items) {
          allInterests.add(items);
        }
      };

      addToSet(profile.news_categories);
      addToSet(profile.sports);
      addToSet(profile.hobbies);
      addToSet(profile.music_genre);
      addToSet(profile.sports_interests);
      addToSet(profile.entertainment_interests);
      addToSet(profile.tech_interests);
      addToSet(profile.lifestyle_interests);

      return Array.from(allInterests);
    } catch (error) {
      return [];
    }
  }
}

export const newsService = new NewsService();

const newsCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 4 * 60 * 60 * 1000;

function getTodayDateString(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

function getCacheKey(category: string): string {
  return `news:${category}:${getTodayDateString()}`;
}

function isCacheValid(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp < CACHE_TTL_MS;
}

export async function fetchCompanionNews(signatureVoiceId: string): Promise<CompanionNewsArticle[]> {
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
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const url = `${supabaseUrl}/functions/v1/fetch-news?interests=${encodeURIComponent(category)}&limit=5&companionNewsOnly=true`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) return [];

    const result = await response.json();

    const { data: articles } = await supabase
      .from('news_articles')
      .select('title, description, source')
      .contains('categories', [category])
      .order('published_at', { ascending: false })
      .limit(3);

    if (!articles || articles.length === 0) return [];

    const formattedArticles: CompanionNewsArticle[] = articles.map((article: any) => ({
      headline: article.title || 'Untitled',
      summary: article.description || '',
      source: article.source || 'Unknown',
    }));

    newsCache.set(cacheKey, {
      data: formattedArticles,
      timestamp: Date.now(),
    });

    return formattedArticles;
  } catch {
    return [];
  }
}

export function formatNewsForPrompt(articles: CompanionNewsArticle[], voiceConfig: VoiceNewsConfig): string {
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

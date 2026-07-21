import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface BraveNewsResult {
  title: string;
  url: string;
  description?: string;
  page_age?: string;
  age?: string;
  thumbnail?: { src?: string };
  meta_url?: { netloc?: string };
  source?: { name?: string };
  extra_snippets?: string[];
}

interface BraveNewsResponse {
  news?: { results?: BraveNewsResult[] };
  web?: { results?: BraveNewsResult[] };
  results?: BraveNewsResult[];
}

interface NewsAPIArticle {
  title: string;
  description: string;
  url: string;
  urlToImage: string;
  publishedAt: string;
  source: { id: string | null; name: string };
  author: string;
  content: string;
}

interface NewsAPIResponse {
  status: string;
  totalResults: number;
  articles: NewsAPIArticle[];
  message?: string;
}

const INTEREST_TO_QUERY: Record<string, string> = {
  'Basketball': 'NBA basketball news today',
  'Football (American)': 'NFL football news today',
  'Football/Soccer': 'MLS soccer news today',
  'Soccer (Football)': 'soccer football news today',
  'Baseball': 'MLB baseball news today',
  'Tennis': 'tennis news today',
  'Golf': 'PGA golf news today',
  'Boxing/MMA': 'UFC boxing MMA news today',
  'MMA/Boxing': 'UFC MMA boxing news today',
  'Hockey (Ice)': 'NHL hockey news today',
  'Hockey': 'NHL hockey news today',
  'Formula 1/Racing': 'F1 Formula 1 racing news today',
  'E-Sports': 'esports gaming news today',
  'Politics': 'US politics news today',
  'Science & Technology': 'science technology news today',
  'World News': 'US world news today',
  'Business & Finance': 'business finance markets news today',
  'Sports': 'sports news today',
  'Entertainment': 'entertainment celebrity news today',
  'Health & Wellness': 'health wellness news today',
  'Climate & Environment': 'climate environment news today',
  'Reading': 'books literature news today',
  'Gaming': 'video games gaming news today',
  'Cooking': 'food cooking recipes news',
  'Baking': 'baking food news today',
  'Hiking': 'hiking outdoors adventure news',
  'Photography': 'photography news today',
  'Drawing/Painting': 'art painting exhibitions news today',
  'Writing': 'books authors writing news today',
  'Music (Playing/Listening)': 'music news today',
  'Movies/TV Shows': 'movies TV shows streaming news today',
  'Fitness/Working Out': 'fitness workout health news today',
  'Yoga/Meditation': 'yoga meditation wellness news today',
  'Dancing': 'dance music news today',
  'Gardening': 'gardening plants tips news',
  'DIY/Crafts': 'DIY home improvement news today',
  'Travel/Exploring': 'travel destinations USA news today',
  'Fashion/Shopping': 'fashion style trends news today',
  'Cars/Motorcycles': 'cars automotive news today',
  'Tech/Gadgets': 'tech gadgets technology news today',
  'Board Games/Puzzles': 'board games tabletop gaming news',
  'R&B/Soul': 'R&B soul music news today',
  'Hip-Hop/Rap': 'hip hop rap music news today',
  'Pop': 'pop music news today',
  'Rock/Alternative': 'rock alternative music news today',
  'Lo-fi/Chill': 'indie music news today',
  'Country': 'country music Nashville news today',
  'Wrestling': 'WWE wrestling news today',
  'Gymnastics': 'gymnastics sports news today',
  'Cycling': 'cycling sports news today',
  'Skateboarding': 'skateboarding sports news today',
  'Surfing': 'surfing sports news today',
  'Martial Arts': 'martial arts UFC sports news today',
  'Skiing/Snowboarding': 'skiing snowboarding news today',
  'Volleyball': 'volleyball sports news today',
  'Swimming': 'swimming sports news today',
  'Running/Track': 'marathon running track news today',
  'Cricket': 'cricket sports news today',
  'Rugby': 'rugby sports news today',
  'A Little Bit Of Everything': 'top news stories today United States',
};

const INTEREST_TO_CATEGORY: Record<string, string> = {
  'Basketball': 'Sports', 'Football (American)': 'Sports', 'Football/Soccer': 'Sports',
  'Soccer (Football)': 'Sports', 'Baseball': 'Sports', 'Tennis': 'Sports', 'Golf': 'Sports',
  'Boxing/MMA': 'Sports', 'MMA/Boxing': 'Sports', 'Hockey (Ice)': 'Sports', 'Hockey': 'Sports',
  'Formula 1/Racing': 'Sports', 'E-Sports': 'Gaming', 'Politics': 'Politics',
  'Science & Technology': 'Science & Technology', 'World News': 'World News',
  'Business & Finance': 'Business & Finance', 'Sports': 'Sports', 'Entertainment': 'Entertainment',
  'Health & Wellness': 'Health & Wellness', 'Climate & Environment': 'Science & Technology',
  'Reading': 'Entertainment', 'Gaming': 'Gaming', 'Cooking': 'Entertainment', 'Baking': 'Entertainment',
  'Hiking': 'Entertainment', 'Photography': 'Entertainment', 'Drawing/Painting': 'Entertainment',
  'Writing': 'Entertainment', 'Music (Playing/Listening)': 'Entertainment',
  'Movies/TV Shows': 'Entertainment', 'Fitness/Working Out': 'Health & Wellness',
  'Yoga/Meditation': 'Health & Wellness', 'Dancing': 'Entertainment', 'Gardening': 'Entertainment',
  'DIY/Crafts': 'Entertainment', 'Travel/Exploring': 'Entertainment', 'Fashion/Shopping': 'Entertainment',
  'Cars/Motorcycles': 'Entertainment', 'Tech/Gadgets': 'Science & Technology',
  'Board Games/Puzzles': 'Entertainment', 'R&B/Soul': 'Entertainment', 'Hip-Hop/Rap': 'Entertainment',
  'Pop': 'Entertainment', 'Rock/Alternative': 'Entertainment', 'Lo-fi/Chill': 'Entertainment',
  'Country': 'Entertainment', 'Wrestling': 'Sports', 'Gymnastics': 'Sports', 'Cycling': 'Sports',
  'Skateboarding': 'Sports', 'Surfing': 'Sports', 'Martial Arts': 'Sports',
  'Skiing/Snowboarding': 'Sports', 'Volleyball': 'Sports', 'Swimming': 'Sports',
  'Running/Track': 'Sports', 'Cricket': 'Sports', 'Rugby': 'Sports',
  'A Little Bit Of Everything': 'World News',
};

const ALLOWED_SOURCES = new Set([
  'cnn.com', 'nytimes.com', 'washingtonpost.com', 'nbcnews.com', 'abcnews.go.com',
  'cbsnews.com', 'foxnews.com', 'usatoday.com', 'apnews.com', 'reuters.com',
  'bloomberg.com', 'wsj.com', 'npr.org', 'politico.com', 'axios.com',
  'theatlantic.com', 'slate.com', 'vox.com', 'techcrunch.com', 'wired.com',
  'espn.com', 'si.com', 'theringer.com', 'theverge.com', 'engadget.com',
  'businessinsider.com', 'fortune.com', 'forbes.com', 'cnbc.com', 'marketwatch.com',
  'healthline.com', 'webmd.com', 'mayoclinic.org', 'scientificamerican.com',
  'popsugar.com', 'buzzfeed.com', 'variety.com', 'hollywoodreporter.com', 'deadline.com',
  'rollingstone.com', 'people.com', 'ew.com', 'gamespot.com', 'ign.com',
  'arstechnica.com', 'gizmodo.com', 'pcmag.com', 'zdnet.com', 'cnet.com',
  'nfl.com', 'nba.com', 'mlb.com', 'nhl.com', 'bleacherreport.com',
  'menshealth.com', 'womenshealth.com', 'shape.com', 'prevention.com',
  'time.com', 'newsweek.com', 'thehill.com', 'huffpost.com',
  'universetoday.com', 'space.com', 'nasa.gov', 'nationalgeographic.com',
  'smithsonianmag.com', 'discovermagazine.com', 'popsci.com', 'livescience.com',
  'newscientist.com', 'eater.com', 'bonappetit.com', 'foodnetwork.com',
  'tmz.com', 'eonline.com', 'usmagazine.com', 'complex.com', 'hypebeast.com',
  'fivethirtyeight.com', 'theathletic.com', 'sportingnews.com', 'cbssports.com',
  'nbcsports.com', 'foxsports.com', 'mlssoccer.com', 'ufcfightpass.com',
  'verge.com', '9to5mac.com', '9to5google.com', 'macrumors.com', 'androidauthority.com',
  'digitaltrends.com', 'tomsguide.com', 'tomshardware.com', 'anandtech.com',
]);

const BLOCKED_DOMAIN_PATTERNS = [
  '.co.uk', '.co.in', '.com.au', '.ca/', '.co.nz', '.co.za', '.ie/',
  'ndtv', 'timesofindia', 'hindustantimes', 'thehindu', 'dawn.com',
  'aljazeera', 'rt.com', 'sputnik', 'xinhua', 'chinadaily',
  'france24', 'dw.com', 'euronews', 'rte.ie', 'smh.com.au', 'abc.net.au',
  'bbc.co', 'theguardian', 'independent.co', 'dailymail.co', 'telegraph.co',
  'mirror.co', 'sky.com', 'express.co', 'inews.co', 'metro.co',
  'timesofindia', 'economictimes', 'indiatoday', 'firstpost',
  'geo.tv', 'tribune.com.pk', 'thenews.com.pk',
  'zerohedge', 'infowars', 'breitbart', 'naturalnews', 'beforeitsnews',
  'globenewswire', 'prnewswire', 'businesswire',
];

function isAllowedSource(url: string): boolean {
  const lower = url.toLowerCase();
  if (BLOCKED_DOMAIN_PATTERNS.some(p => lower.includes(p))) return false;
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    if (ALLOWED_SOURCES.has(hostname)) return true;
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      const apex = parts.slice(-2).join('.');
      if (ALLOWED_SOURCES.has(apex)) return true;
    }
  } catch {
    return false;
  }
  const tld = lower.match(/\.([a-z]{2,3})(?:\/|$)/)?.[1];
  if (tld && !['com', 'org', 'net', 'gov', 'edu', 'io'].includes(tld)) return false;
  return true;
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s[-|]\s.*$/, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 80);
}

function isTitleDuplicate(a: string, b: string): boolean {
  if (a === b) return true;
  const wordsA = new Set(a.split(' ').filter(w => w.length > 3));
  const wordsB = new Set(b.split(' ').filter(w => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return false;
  let intersection = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection++;
  }
  const union = wordsA.size + wordsB.size - intersection;
  return intersection / union >= 0.70;
}

function extractSourceName(result: BraveNewsResult): string {
  if (result.source?.name) return result.source.name;
  if (result.meta_url?.netloc) {
    return result.meta_url.netloc.replace(/^www\./, '');
  }
  try {
    return new URL(result.url).hostname.replace(/^www\./, '');
  } catch {
    return 'Unknown';
  }
}

async function fetchViaBrave(
  query: string,
  braveKey: string,
  count: number
): Promise<Array<{ title: string; url: string; description: string; image_url: string | null; source: string; published_at: string }>> {
  const url = `https://api.search.brave.com/res/v1/news/search?q=${encodeURIComponent(query)}&count=${count}&search_lang=en&country=us&freshness=pw&text_decorations=false`;

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": braveKey,
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(`Brave News error: ${res.status}`);
  }

  const data: BraveNewsResponse = await res.json();
  console.log(`[fetch-news] Brave raw response keys: ${Object.keys(data).join(', ')}, news.results: ${data.news?.results?.length ?? 'undefined'}, top-level results: ${data.results?.length ?? 'undefined'}`);
  const results = data.news?.results || data.results || [];

  return results.map(r => ({
    title: r.title || '',
    url: r.url || '',
    description: r.description || r.extra_snippets?.[0] || '',
    image_url: r.thumbnail?.src || null,
    source: extractSourceName(r),
    published_at: r.page_age || r.age || new Date().toISOString(),
  }));
}

async function fetchViaNewsAPI(
  category: string,
  q: string | undefined,
  newsApiKey: string,
  count: number
): Promise<Array<{ title: string; url: string; description: string; image_url: string | null; source: string; published_at: string }>> {
  let apiUrl = `https://newsapi.org/v2/top-headlines?country=us&category=${category}&pageSize=${count}&apiKey=${newsApiKey}`;
  if (q) apiUrl += `&q=${encodeURIComponent(q)}`;

  const res = await fetch(apiUrl, { signal: AbortSignal.timeout(8000) });
  const data: NewsAPIResponse = await res.json();

  if (data.status !== 'ok') return [];

  return (data.articles || []).map(a => ({
    title: a.title?.replace(` - ${a.source?.name || ''}`, '').trim() || '',
    url: a.url || '',
    description: a.description || '',
    image_url: a.urlToImage || null,
    source: a.source?.name || 'Unknown',
    published_at: a.publishedAt || new Date().toISOString(),
  }));
}

const INTEREST_TO_NEWSAPI: Record<string, { category: string; q?: string }> = {
  'Politics': { category: 'politics' },
  'Science & Technology': { category: 'science' },
  'World News': { category: 'general' },
  'Business & Finance': { category: 'business' },
  'Sports': { category: 'sports' },
  'Entertainment': { category: 'entertainment' },
  'Health & Wellness': { category: 'health' },
  'Basketball': { category: 'sports', q: 'NBA basketball' },
  'Football (American)': { category: 'sports', q: 'NFL football' },
  'Baseball': { category: 'sports', q: 'MLB baseball' },
  'Hockey (Ice)': { category: 'sports', q: 'NHL hockey' },
  'Tech/Gadgets': { category: 'technology' },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const braveKey = Deno.env.get("BRAVE_SEARCH_API_KEY");
    const newsApiKey = Deno.env.get("NEWS_API_KEY");

    if (!braveKey && !newsApiKey) {
      throw new Error("No news API keys configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const urlParams = new URL(req.url);
    const interests = urlParams.searchParams.get("interests")?.split(",").filter(Boolean) || [];
    const articlesPerTopic = Math.min(parseInt(urlParams.searchParams.get("limit") || "15"), 20);

    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: existingArticles } = await supabase
      .from('news_articles')
      .select('url, title')
      .gte('published_at', fourteenDaysAgo)
      .limit(2000);

    const processedUrls = new Set<string>();
    const processedTitles: string[] = [];

    if (existingArticles) {
      existingArticles.forEach(a => {
        processedUrls.add(a.url);
        processedTitles.push(normalizeTitle(a.title));
      });
    }

    console.log(`[fetch-news] Dedup set: ${processedUrls.size} recent articles. Interests: ${interests.join(', ')}`);
    console.log(`[fetch-news] Using: ${braveKey ? 'Brave Search (primary)' : 'NewsAPI (fallback)'}`);

    const allInserted: { id: string }[] = [];
    let duplicatesSkipped = 0;
    let blockedSkipped = 0;
    let titleDupsSkipped = 0;
    const MAX_ARTICLES = 80;

    const activeInterests = interests.length > 0
      ? interests
      : ['World News', 'Science & Technology', 'Entertainment'];

    const seen = new Set<string>();
    let totalRawResults = 0;

    for (const interest of activeInterests) {
      if (allInserted.length >= MAX_ARTICLES) break;

      const dedupeKey = interest;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      let rawArticles: Array<{
        title: string; url: string; description: string;
        image_url: string | null; source: string; published_at: string;
      }> = [];

      try {
        if (braveKey) {
          const query = INTEREST_TO_QUERY[interest] || `${interest} news today United States`;
          console.log(`[fetch-news] Brave search: "${query}"`);
          rawArticles = await fetchViaBrave(query, braveKey, articlesPerTopic);
          console.log(`[fetch-news] Brave returned ${rawArticles.length} results for "${interest}"`);
        } else if (newsApiKey) {
          const mapping = INTEREST_TO_NEWSAPI[interest] || { category: 'general' };
          rawArticles = await fetchViaNewsAPI(mapping.category, mapping.q, newsApiKey, articlesPerTopic);
          console.log(`[fetch-news] NewsAPI returned ${rawArticles.length} results for "${interest}"`);
        }
      } catch (err) {
        console.error(`[fetch-news] Fetch error for "${interest}":`, err);

        if (braveKey && newsApiKey) {
          try {
            const mapping = INTEREST_TO_NEWSAPI[interest];
            if (mapping) {
              console.log(`[fetch-news] Falling back to NewsAPI for "${interest}"`);
              rawArticles = await fetchViaNewsAPI(mapping.category, mapping.q, newsApiKey, articlesPerTopic);
            }
          } catch (fallbackErr) {
            console.error(`[fetch-news] NewsAPI fallback also failed for "${interest}":`, fallbackErr);
          }
        }
      }

      // If Brave returned zero results (not an error, just empty), try NewsAPI fallback
      if (rawArticles.length === 0 && braveKey && newsApiKey) {
        try {
          const mapping = INTEREST_TO_NEWSAPI[interest];
          if (mapping) {
            console.log(`[fetch-news] Brave returned 0 results for "${interest}", falling back to NewsAPI`);
            rawArticles = await fetchViaNewsAPI(mapping.category, mapping.q, newsApiKey, articlesPerTopic);
            console.log(`[fetch-news] NewsAPI fallback returned ${rawArticles.length} results for "${interest}"`);
          }
        } catch (fallbackErr) {
          console.error(`[fetch-news] NewsAPI fallback failed for "${interest}":`, fallbackErr);
        }
      }

      totalRawResults += rawArticles.length;
      const primaryCategory = INTEREST_TO_CATEGORY[interest] || interest;
      const tags = [...new Set([interest, primaryCategory])];

      for (const article of rawArticles) {
        if (!article.title || !article.url || article.title === '[Removed]') continue;

        if (processedUrls.has(article.url)) {
          duplicatesSkipped++;
          continue;
        }

        if (!isAllowedSource(article.url)) {
          blockedSkipped++;
          continue;
        }

        const normalizedNew = normalizeTitle(article.title);
        if (processedTitles.some(existing => isTitleDuplicate(existing, normalizedNew))) {
          titleDupsSkipped++;
          processedUrls.add(article.url);
          continue;
        }

        const publishedAt = (() => {
          const raw = article.published_at;
          if (!raw) return new Date().toISOString();
          const parsed = new Date(raw);
          if (!isNaN(parsed.getTime())) return parsed.toISOString();
          if (/^\d+\s+(hour|day|minute|week)s?\s+ago$/i.test(raw)) {
            const match = raw.match(/^(\d+)\s+(hour|day|minute|week)s?\s+ago$/i);
            if (match) {
              const val = parseInt(match[1]);
              const unit = match[2].toLowerCase();
              const ms = unit === 'minute' ? val * 60000
                : unit === 'hour' ? val * 3600000
                : unit === 'day' ? val * 86400000
                : val * 7 * 86400000;
              return new Date(Date.now() - ms).toISOString();
            }
          }
          return new Date().toISOString();
        })();

        const articleToInsert = {
          title: article.title,
          description: article.description,
          content: article.description,
          url: article.url,
          image_url: article.image_url,
          source: article.source,
          author: null,
          published_at: publishedAt,
          categories: tags,
        };

        const { data: inserted, error } = await supabase
          .from('news_articles')
          .insert(articleToInsert)
          .select('id')
          .maybeSingle();

        if (!error && inserted) {
          allInserted.push(inserted);
          processedUrls.add(article.url);
          processedTitles.push(normalizedNew);

          await supabase.from('article_scrape_queue').upsert({
            article_id: inserted.id,
            url: article.url,
            priority: 100,
            queued_at: new Date().toISOString(),
            processing: false,
            attempt_count: 0,
          }, { onConflict: 'article_id' });

        } else if (error?.code === '23505') {
          processedUrls.add(article.url);
          processedTitles.push(normalizedNew);
          duplicatesSkipped++;
        }
      }
    }

    console.log(`[fetch-news] Done. Added: ${allInserted.length}, URL dups: ${duplicatesSkipped}, title dups: ${titleDupsSkipped}, blocked: ${blockedSkipped}, totalRaw: ${totalRawResults}`);

    if (totalRawResults === 0 && activeInterests.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          articlesAdded: 0,
          error: 'All news sources returned zero results',
          message: 'All news sources returned zero results — possible API format change or key issue',
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        articlesAdded: allInserted.length,
        duplicatesSkipped: duplicatesSkipped + titleDupsSkipped,
        blockedSkipped,
        source: braveKey ? 'brave' : 'newsapi',
        message: allInserted.length > 0
          ? `Added ${allInserted.length} new articles via ${braveKey ? 'Brave Search' : 'NewsAPI'} (${titleDupsSkipped} near-duplicates filtered, ${blockedSkipped} blocked)`
          : `No new articles found (${duplicatesSkipped + titleDupsSkipped} already in feed, ${blockedSkipped} filtered)`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[fetch-news] Fatal error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

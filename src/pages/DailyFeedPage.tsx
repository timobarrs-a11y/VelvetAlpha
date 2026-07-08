import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Newspaper, RefreshCw, Clock, TrendingUp, ChevronRight, Zap } from 'lucide-react';
import { userProfileService } from '../services/userProfileService';
import { supabase } from '../shared/supabase/client';
import { newsService } from '../services/newsService';

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

const BLOCKED_PATTERNS = [
  '.co.uk', '.co.in', '.com.au', '.co.nz', '.co.za', '.com.pk',
  '.ie/', '.ca/', '.com.ng', '.ng/',
  'bbc.co', 'theguardian', 'guardian.com', 'independent.co',
  'dailymail.co', 'mirror.co', 'telegraph.co', 'sky.com',
  'express.co', 'inews.co', 'metro.co', 'cbc.ca', 'blogto.com',
  'globeandmail', 'torontostar', 'nationalpost', 'ctvnews',
  'smh.com.au', 'abc.net.au', 'financialpost',
  'ndtv', 'timesofindia', 'hindustantimes', 'thehindu', 'firstpost',
  'indiatoday', 'economictimes', 'dawn.com', 'geo.tv',
  'thenews.com.pk', 'tribune.com.pk', 'express.com.pk',
  'arynews', 'dunyanews', 'samaa', 'connectedpakistan',
  'punchng.com', 'vanguardngr', 'premiumtimesng', 'channelstv',
  'guardian.ng', 'businessday.ng', 'dailytrust', 'antaranews',
  'aljazeera', 'rt.com', 'sputnik', 'xinhua', 'chinadaily',
  'france24', 'dw.com', 'euronews', 'rte.ie',
  'shtfplan', 'antiwar.com', 'zerohedge', 'globalresearch',
  'beforeitsnews', 'naturalnews', 'infowars', 'breitbart',
  'oilprice.com', 'slashdot.org', 'freerepublic', 'wnd.com',
  'crooksandliars', 'commondreams', 'dnyuz.com',
  'globenewswire', 'prnewswire', 'businesswire', 'plos.org',
  'r-bloggers', 'saashunt', 'kevinmd', 'redhat.com',
  'marca.com', 'amazon.com', 'articleswebhunk',
];

function isAllowedArticle(url: string, source: string): boolean {
  const combined = (url + ' ' + source).toLowerCase();
  return !BLOCKED_PATTERNS.some(p => combined.includes(p));
}

interface NewsArticle {
  id: string;
  title: string;
  description: string;
  url: string;
  image_url?: string;
  published_at: string;
  source: string;
  categories: string[];
  author?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Politics': 'bg-red-500/20 text-red-300 border-red-500/30',
  'Science & Technology': 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  'Entertainment': 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  'Sports': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  'Basketball': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  'Business & Finance': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'Health & Wellness': 'bg-green-500/20 text-green-300 border-green-500/30',
  'World News': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'default': 'bg-white/10 text-white/60 border-white/20',
};

function getCategoryColor(cat: string): string {
  return CATEGORY_COLORS[cat] || CATEGORY_COLORS['default'];
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ArticleImage({ src, alt, className, eager }: { src: string; alt: string; className: string; eager?: boolean }) {
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
    />
  );
}

function HeroCard({ article, onClick, isNew }: { article: NewsArticle; onClick: () => void; isNew?: boolean }) {
  const primaryCat = article.categories?.[0];
  return (
    <div
      onClick={onClick}
      className="relative cursor-pointer rounded-2xl overflow-hidden border border-white/10 hover:border-white/20 transition-colors shadow-2xl"
      style={{ minHeight: 420 }}
    >
      {article.image_url ? (
        <>
          <ArticleImage
            src={article.image_url}
            alt={article.title}
            className="absolute inset-0 w-full h-full object-cover"
            eager
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
        </>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900" />
      )}

      <div className="relative h-full flex flex-col justify-end p-8" style={{ minHeight: 420 }}>
        <div className="flex items-center gap-2 mb-4">
          {isNew && (
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500 text-white border border-emerald-400/50">
              <Zap className="w-3 h-3" />
              New
            </span>
          )}
          {primaryCat && (
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getCategoryColor(primaryCat)}`}>
              {primaryCat}
            </span>
          )}
          <span className="flex items-center gap-1 text-white/50 text-xs">
            <Clock className="w-3 h-3" />
            {formatTimeAgo(article.published_at)}
          </span>
        </div>

        <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight mb-4" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.8)' }}>
          {article.title}
        </h2>

        <div className="flex items-center justify-between">
          <span className="text-white/50 text-sm font-medium">{article.source}</span>
          <span className="flex items-center gap-1.5 text-white/60 text-sm">
            Read story
            <ChevronRight className="w-4 h-4" />
          </span>
        </div>
      </div>
    </div>
  );
}

function ArticleCard({ article, onClick, seen }: { article: NewsArticle; onClick: () => void; seen?: boolean }) {
  const primaryCat = article.categories?.[0];
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer border rounded-xl overflow-hidden flex flex-col ${
        seen
          ? 'bg-white/3 border-white/5 opacity-50 hover:opacity-70 transition-opacity'
          : 'bg-white/5 hover:bg-white/8 border-white/10 hover:border-white/20 transition-colors'
      }`}
    >
      <div className="w-full h-44 overflow-hidden bg-slate-800 flex-shrink-0">
        {article.image_url ? (
          <ArticleImage
            src={article.image_url}
            alt={article.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800" />
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        {primaryCat && (
          <span className={`self-start px-2.5 py-0.5 rounded-full text-xs font-semibold border mb-2.5 ${getCategoryColor(primaryCat)}`}>
            {primaryCat}
          </span>
        )}

        <h3 className="text-white font-semibold text-sm leading-snug line-clamp-3 flex-1">
          {article.title}
        </h3>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
          <span className="text-white/40 text-xs">{article.source}</span>
          <span className="text-white/40 text-xs flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatTimeAgo(article.published_at)}
          </span>
        </div>
      </div>
    </div>
  );
}

function ListArticleCard({ article, onClick, seen }: { article: NewsArticle; onClick: () => void; seen?: boolean }) {
  const primaryCat = article.categories?.[0];
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer flex gap-4 py-4 border-b border-white/5 last:border-0 px-2 rounded-lg hover:bg-white/3 transition-colors ${
        seen ? 'opacity-40 hover:opacity-60' : ''
      }`}
    >
      {article.image_url && (
        <div className="w-20 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-slate-800">
          <ArticleImage
            src={article.image_url}
            alt={article.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="flex-1 min-w-0">
        {primaryCat && (
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold mb-1.5 ${getCategoryColor(primaryCat)}`}>
            {primaryCat}
          </span>
        )}
        <h4 className="text-white/90 font-medium text-sm leading-snug line-clamp-2">
          {article.title}
        </h4>
        <div className="flex items-center gap-2 mt-1.5 text-white/40 text-xs">
          <span>{article.source}</span>
          <span>·</span>
          <span>{formatTimeAgo(article.published_at)}</span>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-white/20 flex-shrink-0 self-center" />
    </div>
  );
}

export function DailyFeedPage({ onBack, initialTab }: { onBack?: () => void; initialTab?: 'news' | 'video' } = {}) {
  const navigate = useNavigate();
  const goBack = () => { if (onBack) { onBack(); } else { navigate('/lobby'); } };
  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());
  const [newsCategories, setNewsCategories] = useState<string[]>([]);
  const [allInterests, setAllInterests] = useState<string[]>([]);
  const [silentFetching, setSilentFetching] = useState(false);
  const [newArticlesBadge, setNewArticlesBadge] = useState(0);
  const [activeFilter, setActiveFilter] = useState<string>('All');
  const [refreshing, setRefreshing] = useState(false);
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadUserFeed();
    return () => { if (statusTimerRef.current) clearTimeout(statusTimerRef.current); };
  }, []);

  const loadUserFeed = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/login'); return; }

      const profile = await userProfileService.getCurrentProfile();
      if (!profile) { navigate('/questionnaire'); return; }

      const categories = profile.news_categories || [];
      setNewsCategories(categories);

      const interests = await newsService.getUserAllInterests();
      setAllInterests(interests);

      if (interests.length === 0 && categories.length === 0) {
        setLoading(false);
        return;
      }

      const [articlesResult, viewsResult] = await Promise.all([
        supabase
          .from('news_articles')
          .select('*')
          .order('published_at', { ascending: false })
          .limit(150),
        supabase
          .from('article_views')
          .select('article_id')
          .eq('user_id', user.id),
      ]);

      if (viewsResult.data) {
        setViewedIds(new Set(viewsResult.data.map((v: any) => v.article_id)));
      }

      if (!articlesResult.error && articlesResult.data) {
        const userInterests = [...new Set([...interests, ...categories])];
        const filtered = articlesResult.data.filter((article) => {
          if (!article.categories || article.categories.length === 0) return false;
          if (article.url && !isAllowedArticle(article.url, article.source || '')) return false;
          return article.categories.some((cat: string) =>
            userInterests.some((ui) =>
              cat.toLowerCase().includes(ui.toLowerCase()) ||
              ui.toLowerCase().includes(cat.toLowerCase())
            )
          );
        });
        const finalArticles = filtered.slice(0, 40);

        const imageUrls = finalArticles
          .map(a => a.image_url)
          .filter(Boolean)
          .slice(0, 12);

        await Promise.allSettled(
          imageUrls.map(url => new Promise<void>(resolve => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = url as string;
          }))
        );

        setArticles(finalArticles);
      }

      setLoading(false);

      checkAndAutoFetch(user.id, interests.length > 0 ? interests : categories);
    } catch (err) {
      console.error('Error loading feed:', err);
      setLoading(false);
    }
  };

  const checkAndAutoFetch = async (userId: string, interests: string[]) => {
    try {
      const { data: log } = await supabase
        .from('news_fetch_log')
        .select('last_fetched_at')
        .eq('user_id', userId)
        .maybeSingle();

      const now = Date.now();
      const lastFetched = log?.last_fetched_at ? new Date(log.last_fetched_at).getTime() : 0;
      const elapsed = now - lastFetched;
      const isNewCalendarDay = new Date(now).toDateString() !== new Date(lastFetched).toDateString();

      // Always refresh on the first open of a new day, even if it's been under 12 hours since the last fetch.
      if (isNewCalendarDay || elapsed >= TWELVE_HOURS_MS) {
        setSilentFetching(true);

        const result = await newsService.fetchLatestNews(interests);

        await supabase
          .from('news_fetch_log')
          .upsert({ user_id: userId, last_fetched_at: new Date().toISOString() });

        if (result.success && (result.articlesAdded ?? 0) > 0) {
          setNewArticlesBadge(result.articlesAdded ?? 0);
          statusTimerRef.current = setTimeout(() => setNewArticlesBadge(0), 8000);
          await reloadArticles(userId, interests);
        }
        setSilentFetching(false);
      }
    } catch (err) {
      console.error('Auto-fetch check failed:', err);
      setSilentFetching(false);
    }
  };

  const reloadArticles = async (userId: string, interests: string[]) => {
    const [articlesResult, viewsResult] = await Promise.all([
      supabase
        .from('news_articles')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(150),
      supabase
        .from('article_views')
        .select('article_id')
        .eq('user_id', userId),
    ]);

    if (viewsResult.data) {
      setViewedIds(new Set(viewsResult.data.map((v: any) => v.article_id)));
    }

    if (!articlesResult.error && articlesResult.data) {
      const allCategories = [...new Set([...interests, ...newsCategories])];
      const filtered = articlesResult.data.filter((article) => {
        if (!article.categories || article.categories.length === 0) return false;
        if (article.url && !isAllowedArticle(article.url, article.source || '')) return false;
        return article.categories.some((cat: string) =>
          allCategories.some((ui) =>
            cat.toLowerCase().includes(ui.toLowerCase()) ||
            ui.toLowerCase().includes(cat.toLowerCase())
          )
        );
      });
      setArticles(filtered.slice(0, 40));
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const interestsToFetch = allInterests.length > 0 ? allInterests : newsCategories;

      await supabase
        .from('news_fetch_log')
        .delete()
        .eq('user_id', user.id);

      const result = await newsService.fetchLatestNews(interestsToFetch);

      await supabase
        .from('news_fetch_log')
        .upsert({ user_id: user.id, last_fetched_at: new Date().toISOString() });

      await reloadArticles(user.id, interestsToFetch);

      if (result.success && (result.articlesAdded ?? 0) > 0) {
        setNewArticlesBadge(result.articlesAdded ?? 0);
        statusTimerRef.current = setTimeout(() => setNewArticlesBadge(0), 8000);
      }
    } catch (err) {
      console.error('Manual refresh failed:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const normalize = (s: string) => s.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  const categoryTabs = ['All', ...Array.from(
    new Set(articles.flatMap(a => a.categories?.slice(0, 1).map(normalize) || []))
  ).slice(0, 6)];

  const filteredArticles = activeFilter === 'All'
    ? articles
    : articles.filter(a => a.categories?.some(c => normalize(c) === activeFilter));

  const unread = filteredArticles.filter(a => !viewedIds.has(a.id));
  const read = filteredArticles.filter(a => viewedIds.has(a.id));

  const topStory = unread[0] || filteredArticles[0];
  const remainingUnread = unread.slice(1);
  const gridArticles = remainingUnread.slice(0, 6);
  const listArticles = remainingUnread.slice(6);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="relative w-16 h-16 mx-auto mb-5">
            <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 animate-ping" />
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Newspaper className="w-7 h-7 text-emerald-400" />
            </div>
          </div>
          <p className="text-white/50 text-sm">Loading your feed...</p>
        </div>
      </div>
    );
  }

  if (newsCategories.length === 0 && allInterests.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-5">
            <Newspaper className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No Interests Yet</h2>
          <p className="text-white/50 text-sm mb-6">Complete your profile to get personalized news.</p>
          <button
            onClick={() => navigate('/profile')}
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-all"
          >
            Complete Profile
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="sticky top-0 z-30 bg-[#0a0a0f]/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={goBack}
              className="p-2 hover:bg-white/8 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white/70" />
            </button>
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-white text-lg">Daily Feed</span>
          </div>

          <div className="flex items-center gap-2">
            {newArticlesBadge > 0 && (
              <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-full">
                <Zap className="w-3 h-3" />
                {newArticlesBadge} new
              </span>
            )}
            <button
              onClick={handleManualRefresh}
              disabled={refreshing || silentFetching}
              className="p-2 hover:bg-white/8 rounded-lg transition-colors text-white/60 hover:text-white disabled:opacity-40"
              title="Fetch latest news"
            >
              <RefreshCw className={`w-4 h-4 ${(refreshing || silentFetching) ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {silentFetching && (
          <div className="h-0.5 bg-emerald-500/40" />
        )}

        {categoryTabs.length > 1 && (
          <div className="max-w-6xl mx-auto px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
            {categoryTabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveFilter(tab)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                  activeFilter === tab
                    ? 'bg-white text-slate-900 border-white'
                    : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {filteredArticles.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-5">
              <Newspaper className="w-8 h-8 text-white/30" />
            </div>
            <h3 className="text-white font-semibold mb-2">No articles yet</h3>
            <p className="text-white/40 text-sm mb-6">Hit refresh to pull fresh news for your interests.</p>
            <button
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-all"
            >
              {refreshing ? 'Fetching...' : 'Get Latest News'}
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {topStory && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1.5 h-5 rounded-full bg-emerald-400" />
                  <span className="text-white/50 text-xs font-semibold uppercase tracking-widest">Top Story</span>
                </div>
                <HeroCard
                  article={topStory}
                  isNew={!viewedIds.has(topStory.id)}
                  onClick={() => navigate(`/article?id=${topStory.id}`)}
                />
              </div>
            )}

            {gridArticles.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1.5 h-5 rounded-full bg-blue-400" />
                  <span className="text-white/50 text-xs font-semibold uppercase tracking-widest">Latest Stories</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {gridArticles.map((article) => (
                    <ArticleCard
                      key={article.id}
                      article={article}
                      seen={viewedIds.has(article.id)}
                      onClick={() => navigate(`/article?id=${article.id}`)}
                    />
                  ))}
                </div>
              </div>
            )}

            {listArticles.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1.5 h-5 rounded-full bg-white/30" />
                  <span className="text-white/50 text-xs font-semibold uppercase tracking-widest">More Stories</span>
                </div>
                <div className="bg-white/3 border border-white/8 rounded-2xl overflow-hidden px-2">
                  {listArticles.map(article => (
                    <ListArticleCard
                      key={article.id}
                      article={article}
                      seen={viewedIds.has(article.id)}
                      onClick={() => navigate(`/article?id=${article.id}`)}
                    />
                  ))}
                </div>
              </div>
            )}

            {read.length > 0 && unread.length === 0 && (
              <div className="text-center py-6 border border-white/5 rounded-2xl bg-white/2">
                <p className="text-white/30 text-sm">You've read all current articles. Check back soon for more.</p>
              </div>
            )}

            <div className="text-center py-4">
              <p className="text-white/20 text-xs">
                {unread.length} unread · {read.length} read
                {activeFilter !== 'All' && ` · filtered by ${activeFilter}`}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

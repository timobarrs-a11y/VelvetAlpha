import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Newspaper, RefreshCw, Clock, TrendingUp, ChevronRight, Zap, AlertTriangle } from 'lucide-react';
import { PageHeader, Pill, Badge } from '../shared/ui';
import { userProfileService } from '../services/userProfileService';
import { supabase } from '../shared/supabase/client';
import { newsService } from '../services/newsService';
import { getCategoryColor } from '../config/articleCategoryColors';
import { getCompanions, type CompanionWithLastMessage } from '../services/companionService';
import { getArticleOpeners, type ArticleOpenerMatch } from '../services/articleOpenerService';
import { RelevanceBadge, OpenerStrip, DiscussWithAffordance } from '../components/RelevanceBadge';
import { ArticleDiscussPanel } from '../components/ArticleDiscussPanel';
import { TimeAwareSlot, getBucketTintClass, type TimeOfDayBucket } from '../components/TimeAwareSlot';
import { getUserLocalDateParts } from '../services/temporalAwarenessService';
import { calendarService, type UserEvent } from '../services/calendarService';

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function sevenDaysAgoISO(): string {
  return new Date(Date.now() - SEVEN_DAYS_MS).toISOString();
}

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

function HeroCard({ article, onClick, isNew, openers, companions, onDiscuss }: {
  article: NewsArticle;
  onClick: () => void;
  isNew?: boolean;
  openers: ArticleOpenerMatch[];
  companions: CompanionWithLastMessage[];
  onDiscuss: (article: NewsArticle, c: CompanionWithLastMessage) => void;
}) {
  const primaryCat = article.categories?.[0];
  const [expanded, setExpanded] = useState(false);
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

      {openers.length > 0 && (
        <div className="absolute top-4 right-4 z-10">
          <RelevanceBadge matches={openers} expanded={expanded} onToggle={() => setExpanded(e => !e)} />
        </div>
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
          <div className="flex items-center gap-3">
            <DiscussWithAffordance companions={companions} onPick={(c) => onDiscuss(article, c)} />
            <span className="flex items-center gap-1.5 text-white/60 text-sm">
              Read story
              <ChevronRight className="w-4 h-4" />
            </span>
          </div>
        </div>
      </div>

      {expanded && openers.length > 0 && (
        <div className="relative bg-black/70 backdrop-blur-sm" onClick={(e) => e.stopPropagation()}>
          <OpenerStrip matches={openers} onTalkTo={(c) => onDiscuss(article, c)} />
        </div>
      )}
    </div>
  );
}

function ArticleCard({ article, onClick, seen, openers, companions, onDiscuss }: {
  article: NewsArticle;
  onClick: () => void;
  seen?: boolean;
  openers: ArticleOpenerMatch[];
  companions: CompanionWithLastMessage[];
  onDiscuss: (article: NewsArticle, c: CompanionWithLastMessage) => void;
}) {
  const primaryCat = article.categories?.[0];
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer border rounded-xl overflow-hidden flex flex-col ${
        seen
          ? 'bg-white/3 border-white/5 opacity-50 hover:opacity-70 transition-opacity'
          : 'bg-white/5 hover:bg-white/8 border-white/10 hover:border-white/20 transition-colors'
      }`}
    >
      <div className="w-full h-44 overflow-hidden bg-slate-800 flex-shrink-0 relative">
        {article.image_url ? (
          <ArticleImage
            src={article.image_url}
            alt={article.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-800" />
        )}
        {openers.length > 0 && (
          <div className="absolute top-2 right-2">
            <RelevanceBadge matches={openers} expanded={expanded} onToggle={() => setExpanded(e => !e)} />
          </div>
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
          <div className="flex items-center gap-2">
            <DiscussWithAffordance companions={companions} onPick={(c) => onDiscuss(article, c)} />
            <span className="text-white/40 text-xs flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTimeAgo(article.published_at)}
            </span>
          </div>
        </div>
      </div>

      {expanded && openers.length > 0 && (
        <div onClick={(e) => e.stopPropagation()}>
          <OpenerStrip matches={openers} onTalkTo={(c) => onDiscuss(article, c)} />
        </div>
      )}
    </div>
  );
}

function ListArticleCard({ article, onClick, seen, openers, companions, onDiscuss }: {
  article: NewsArticle;
  onClick: () => void;
  seen?: boolean;
  openers: ArticleOpenerMatch[];
  companions: CompanionWithLastMessage[];
  onDiscuss: (article: NewsArticle, c: CompanionWithLastMessage) => void;
}) {
  const primaryCat = article.categories?.[0];
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer flex gap-4 py-4 border-b border-white/5 last:border-0 px-2 rounded-lg hover:bg-white/3 transition-colors ${
        seen ? 'opacity-40 hover:opacity-60' : ''
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          {primaryCat && (
            <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${getCategoryColor(primaryCat)}`}>
              {primaryCat}
            </span>
          )}
          {openers.length > 0 && (
            <RelevanceBadge matches={openers} expanded={expanded} onToggle={() => setExpanded(e => !e)} />
          )}
        </div>
        <h4 className="text-white/90 font-medium text-sm leading-snug line-clamp-2">
          {article.title}
        </h4>
        <div className="flex items-center gap-2 mt-1.5 text-white/40 text-xs">
          <span>{article.source}</span>
          <span>·</span>
          <span>{formatTimeAgo(article.published_at)}</span>
        </div>
        {expanded && openers.length > 0 && (
          <div onClick={(e) => e.stopPropagation()}>
            <OpenerStrip matches={openers} onTalkTo={(c) => onDiscuss(article, c)} />
          </div>
        )}
      </div>
      <div className="flex flex-col items-end justify-between gap-2 flex-shrink-0">
        <DiscussWithAffordance companions={companions} onPick={(c) => onDiscuss(article, c)} />
        <ChevronRight className="w-4 h-4 text-white/20 self-center" />
      </div>
    </div>
  );
}

export function DailyFeedPage({ onBack, initialTab: _initialTab }: { onBack?: () => void; initialTab?: 'news' | 'video' } = {}) {
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
  const [initialFetchDone, setInitialFetchDone] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [companions, setCompanions] = useState<CompanionWithLastMessage[]>([]);
  const [todaysEvents, setTodaysEvents] = useState<UserEvent[]>([]);
  const [tomorrowsEvents, setTomorrowsEvents] = useState<UserEvent[]>([]);
  const [companionNarrative, setCompanionNarrative] = useState<string | null>(null);
  const [activeCompanion, setActiveCompanion] = useState<CompanionWithLastMessage | null>(null);
  const dateParts = useMemo(() => getUserLocalDateParts(new Date()), []);
  const bucket: TimeOfDayBucket = dateParts.timeOfDay;
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

      getCompanions(user.id).then(fetchedCompanions => {
        setCompanions(fetchedCompanions);
        const withActivity = fetchedCompanions.find(c => c.last_message_text);
        if (withActivity) {
          setActiveCompanion(withActivity);
          const isEvening = ['evening', 'night', 'late night'].includes(bucket);
          if (isEvening) {
            const todayStr = new Date().toISOString().slice(0, 10);
            supabase
              .from('daily_experiences')
              .select('narrative')
              .eq('user_id', user.id)
              .eq('companion_id', withActivity.id)
              .eq('date', todayStr)
              .maybeSingle()
              .then(({ data }) => {
                if (data?.narrative) setCompanionNarrative(data.narrative);
              })
              .catch(() => {});
          }
        }
      }).catch(() => {});

      calendarService.getUpcomingEvents(user.id, 2).then(events => {
        setTodaysEvents(events);
        setTomorrowsEvents(events);
      }).catch(() => {});

      if (interests.length === 0 && categories.length === 0) {
        setLoading(false);
        return;
      }

      const [freshResult, viewsResult] = await Promise.all([
        supabase
          .from('news_articles')
          .select('*')
          .gte('published_at', sevenDaysAgoISO())
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

      let articlesData = freshResult.data;
      if (!freshResult.error && (freshResult.data ?? []).length === 0) {
        const fallback = await supabase
          .from('news_articles')
          .select('*')
          .order('published_at', { ascending: false })
          .limit(150);
        if (!fallback.error) articlesData = fallback.data;
      }

      let foundCount = 0;
      if (articlesData) {
        const userInterests = [...new Set([...interests, ...categories])];
        const filtered = articlesData.filter((article) => {
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
        foundCount = finalArticles.length;

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

      // On first visit the table is often empty. Await the auto-fetch so rows
      // are inserted before we drop the loading state — the user never sees a
      // false "No articles yet" screen and never has to hit refresh on day 1.
      const fetchInterests = interests.length > 0 ? interests : categories;
      if (foundCount === 0 && fetchInterests.length > 0) {
        await checkAndAutoFetch(user.id, fetchInterests);
      } else {
        checkAndAutoFetch(user.id, fetchInterests).catch(() => {});
      }
      setInitialFetchDone(true);
      setLoading(false);
    } catch (err) {
      console.error('Error loading feed:', err);
      setInitialFetchDone(true);
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

      const shouldFetch = isNewCalendarDay || elapsed >= TWELVE_HOURS_MS;

      if (shouldFetch) {
        setSilentFetching(true);

        const result = await newsService.fetchLatestNews(interests);

        if (result.success) {
          setFetchError(null);
          await supabase
            .from('news_fetch_log')
            .upsert({ user_id: userId, last_fetched_at: new Date().toISOString() });

          if ((result.articlesAdded ?? 0) > 0) {
            setNewArticlesBadge(result.articlesAdded ?? 0);
            statusTimerRef.current = setTimeout(() => setNewArticlesBadge(0), 8000);
          }
          // Always reload after a fetch attempt — another user's fetch may
          // have populated shared rows, or inserts may not match the strict
          // interest filter. Let the filter decide what to show.
          await reloadArticles(userId, interests);
        } else if (!result.success && (result.articlesAdded ?? 0) === 0) {
          setFetchError(result.error || result.message || 'Failed to fetch news');
        }
        setSilentFetching(false);
      }
    } catch (err) {
      console.error('Auto-fetch check failed:', err);
      setSilentFetching(false);
    }
  };

  const reloadArticles = async (userId: string, interests: string[]) => {
    const [freshResult, viewsResult] = await Promise.all([
      supabase
        .from('news_articles')
        .select('*')
        .gte('published_at', sevenDaysAgoISO())
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

    let articlesData = freshResult.data;
    if (!freshResult.error && (freshResult.data ?? []).length === 0) {
      const fallback = await supabase
        .from('news_articles')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(150);
      if (!fallback.error) articlesData = fallback.data;
    }

    if (articlesData) {
      const allCategories = [...new Set([...interests, ...newsCategories])];
      const filtered = articlesData.filter((article) => {
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

      if (result.success && (result.articlesAdded ?? 0) > 0) {
        setFetchError(null);
        await supabase
          .from('news_fetch_log')
          .upsert({ user_id: user.id, last_fetched_at: new Date().toISOString() });

        setNewArticlesBadge(result.articlesAdded ?? 0);
        statusTimerRef.current = setTimeout(() => setNewArticlesBadge(0), 8000);
      } else if (!result.success) {
        setFetchError(result.error || result.message || 'Failed to fetch news');
      }

      await reloadArticles(user.id, interestsToFetch);
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

  const openerMap = useMemo(() => {
    const map = new Map<string, ArticleOpenerMatch[]>();
    for (const article of articles) {
      map.set(article.id, getArticleOpeners({ categories: article.categories }, companions));
    }
    return map;
  }, [articles, companions]);

  const [discussOpen, setDiscussOpen] = useState(false);
  const [discussCompanion, setDiscussCompanion] = useState<CompanionWithLastMessage | null>(null);
  const [discussArticleId, setDiscussArticleId] = useState<string | null>(null);
  const [discussArticleTitle, setDiscussArticleTitle] = useState<string | undefined>(undefined);

  const handleDiscussArticle = (article: NewsArticle, companion: CompanionWithLastMessage) => {
    setDiscussArticleId(article.id);
    setDiscussArticleTitle(article.title);
    setDiscussCompanion(companion);
    setDiscussOpen(true);
  };

  if (loading) {
    return (
      <div className="ds-page flex items-center justify-center px-4">
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
      <div className="ds-page flex items-center justify-center px-4">
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
    <div className="ds-page text-white">
      <PageHeader
        title="Daily News"
        icon={TrendingUp}
        accent="#34d399"
        back={goBack}
        progress={silentFetching}
        actions={
          <>
            {newArticlesBadge > 0 && (
              <Badge tone="#34d399" icon={<Zap className="w-3 h-3" />}>{newArticlesBadge} new</Badge>
            )}
            <Pill
              onClick={handleManualRefresh}
              disabled={refreshing || silentFetching}
              title="Fetch latest news"
              aria-label="Fetch latest news"
              icon={<RefreshCw className={`w-4 h-4 ${(refreshing || silentFetching) ? 'animate-spin' : ''}`} />}
            />
          </>
        }
      >
        {categoryTabs.length > 1 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {categoryTabs.map(tab => (
              <Pill key={tab} size="sm" active={activeFilter === tab} onClick={() => setActiveFilter(tab)}>
                {tab}
              </Pill>
            ))}
          </div>
        )}
      </PageHeader>

      <div className={`max-w-6xl mx-auto px-4 py-6 ${getBucketTintClass(bucket)}`}>
        <div className="relative z-10">
        <TimeAwareSlot
          bucket={bucket}
          todaysEvents={todaysEvents}
          tomorrowsEvents={tomorrowsEvents}
          companion={activeCompanion}
          companionNarrative={companionNarrative}
        />
        {filteredArticles.length === 0 ? (
          !initialFetchDone ? (
            <div className="text-center py-24">
              <div className="relative w-12 h-12 mx-auto mb-5">
                <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 animate-ping" />
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Newspaper className="w-6 h-6 text-emerald-400" />
                </div>
              </div>
              <p className="text-white/50 text-sm">Fetching your first articles...</p>
            </div>
          ) : (
            <div className="text-center py-24">
              {fetchError && (
                <div className="max-w-md mx-auto mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-left">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-amber-200 text-sm font-semibold mb-1">Couldn't fetch news</p>
                      <p className="text-amber-200/70 text-xs">{fetchError}</p>
                    </div>
                  </div>
                </div>
              )}
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-5">
                <Newspaper className="w-8 h-8 text-white/30" />
              </div>
              <h3 className="text-white font-semibold mb-2">No articles yet</h3>
              <p className="text-white/40 text-sm mb-6">We couldn't find articles for your interests. Try a manual refresh.</p>
              <button
                onClick={handleManualRefresh}
                disabled={refreshing}
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-all"
              >
                {refreshing ? 'Fetching...' : 'Get Latest News'}
              </button>
            </div>
          )
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
                  openers={openerMap.get(topStory.id) ?? []}
                  companions={companions}
                  onDiscuss={handleDiscussArticle}
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
                      openers={openerMap.get(article.id) ?? []}
                      companions={companions}
                      onDiscuss={handleDiscussArticle}
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
                      openers={openerMap.get(article.id) ?? []}
                      companions={companions}
                      onDiscuss={handleDiscussArticle}
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

      <ArticleDiscussPanel
        open={discussOpen}
        articleId={discussArticleId}
        companion={discussCompanion}
        articleTitle={discussArticleTitle}
        onClose={() => setDiscussOpen(false)}
      />
    </div>
  );
}

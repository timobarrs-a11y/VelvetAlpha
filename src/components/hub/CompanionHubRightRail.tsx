import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, ExternalLink, RefreshCw, Newspaper, Video,
  AlertCircle, ArrowLeft, X,
} from 'lucide-react';
import { supabase } from '../../shared/supabase/client';
import { newsService } from '../../services/newsService';
import { morningBriefService } from '../../services/morningBriefService';
import type { QuickCommand } from '../QuickCommandBar';

interface NewsArticle {
  id: string; title: string; description?: string; url: string;
  image_url?: string; source?: string; published_at?: string;
}

interface VideoResult {
  id: string; title: string; thumbnail: string; channelTitle: string;
}

type Tab = 'news' | 'video';

interface Props {
  companionName: string;
  userId?: string | null;
  onCommand: (command: QuickCommand) => Promise<void>;
  disabled?: boolean;
  initialTab?: Tab;
}

const BLOCKED_PATTERNS = [
  '.co.uk', '.co.in', '.com.au', '.co.nz', '.co.za', '.com.pk',
  'bbc.co', 'theguardian', 'guardian.com', 'independent.co',
  'dailymail.co', 'rt.com', 'aljazeera', 'xinhua', 'chinadaily',
  'zerohedge', 'globalresearch', 'infowars', 'breitbart',
];

function isAllowed(url: string, source = ''): boolean {
  const combined = (url + ' ' + source).toLowerCase();
  return !BLOCKED_PATTERNS.some(p => combined.includes(p));
}

function timeAgo(dateString?: string): string {
  if (!dateString) return '';
  const diff = Date.now() - new Date(dateString).getTime();
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

async function fetchNews(userId?: string | null): Promise<NewsArticle[]> {
  const categories = userId ? await morningBriefService.getUserNewsCategories(userId) : ['general'];
  const cats = categories.length > 0 ? categories : ['general'];
  const articles = await newsService.getArticlesByCategories(cats, 20);
  return articles.filter(a => isAllowed(a.url, a.source)).slice(0, 6);
}

async function fetchVideos(userId?: string | null): Promise<VideoResult[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];

  let tags: string[] = [];
  if (userId) {
    const [compResult, prefsResult] = await Promise.all([
      supabase
        .from('companions')
        .select('hobbies, sports, sports_interests, entertainment_interests, tech_interests, lifestyle_interests, music_genre, interest_text')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('user_video_preferences')
        .select('custom_tags, disabled_tags')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);
    const c = compResult.data;
    const p = prefsResult.data;
    const disabled = new Set<string>(p?.disabled_tags || []);
    const all: string[] = [
      ...(c?.hobbies || []),
      ...(c?.sports || []),
      ...(c?.sports_interests || []),
      ...(c?.entertainment_interests || []),
      ...(c?.tech_interests || []),
      ...(c?.lifestyle_interests || []),
      c?.music_genre,
      c?.interest_text,
      ...(p?.custom_tags || []),
    ].filter(Boolean) as string[];
    tags = [...new Set(all)].filter(t => !disabled.has(t));
  }

  const query = tags.length > 0 ? tags.slice(0, 3).join(' ') : 'trending today';
  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smart-video-search`;
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, userContext: `user interests: ${tags.slice(0, 5).join(', ')}` }),
  });
  if (!response.ok) return [];
  const data = await response.json();
  return (data.videos || []).slice(0, 6).map((v: any) => ({
    id: v.id, title: v.title, thumbnail: v.thumbnail, channelTitle: v.channelTitle,
  }));
}

// ─── Inline video player ────────────────────────────────────────────────────
function InlineVideoPlayer({ video, onClose }: { video: VideoResult; onClose: () => void }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 2000);
    return () => clearTimeout(t);
  }, [video.id]);

  return (
    <motion.div
      key="inline-player"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="flex flex-col h-full"
    >
      {/* Player header */}
      <div className="flex items-center gap-2 px-2.5 py-2 flex-shrink-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <button
          onClick={onClose}
          className="flex items-center justify-center w-6 h-6 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
          title="Back to list"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-gray-400" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold text-gray-700 leading-tight truncate">{video.title}</p>
          <p className="text-[9px] text-gray-400 truncate">{video.channelTitle}</p>
        </div>
        <button
          onClick={onClose}
          className="flex items-center justify-center w-6 h-6 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
          title="Close"
        >
          <X className="w-3 h-3 text-gray-400" />
        </button>
      </div>

      {/* Embedded player */}
      <div className="relative bg-black" style={{ paddingTop: '56.25%' }}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&modestbranding=1&rel=0&origin=${window.location.origin}`}
          className="absolute inset-0 w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          title={video.title}
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-400" />
          </div>
        )}
      </div>

      {/* Video info below player */}
      <div className="px-3 py-2.5 flex-shrink-0" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
        <p className="text-[11px] font-semibold text-gray-800 leading-snug line-clamp-3">{video.title}</p>
        <p className="text-[9.5px] text-gray-400 mt-1">{video.channelTitle}</p>
      </div>
    </motion.div>
  );
}

export function CompanionHubRightRail({ userId, initialTab }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? 'news');
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [videos, setVideos] = useState<VideoResult[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);
  const [newsError, setNewsError] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [newsFetched, setNewsFetched] = useState(false);
  const [videosFetched, setVideosFetched] = useState(false);
  const [activeVideo, setActiveVideo] = useState<VideoResult | null>(null);

  const loadNews = useCallback(async () => {
    setNewsLoading(true);
    setNewsError(false);
    try {
      const articles = await fetchNews(userId);
      setNews(articles);
      setNewsFetched(true);
    } catch {
      setNewsError(true);
    } finally {
      setNewsLoading(false);
    }
  }, [userId]);

  const loadVideos = useCallback(async () => {
    setVideoLoading(true);
    setVideoError(false);
    try {
      const vids = await fetchVideos(userId);
      setVideos(vids);
      setVideosFetched(true);
    } catch {
      setVideoError(true);
    } finally {
      setVideoLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!newsFetched && !newsLoading) loadNews();
  }, []);

  const handleTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab);
    setActiveVideo(null);
    if (tab === 'news' && !newsFetched && !newsLoading) loadNews();
    if (tab === 'video' && !videosFetched && !videoLoading) loadVideos();
  }, [newsFetched, newsLoading, videosFetched, videoLoading, loadNews, loadVideos]);

  useEffect(() => {
    const handleSwitch = (e: Event) => {
      const { tab } = (e as CustomEvent).detail ?? {};
      if (tab === 'news' || tab === 'video') handleTabChange(tab);
    };
    window.addEventListener('hub:right-rail-tab', handleSwitch);
    return () => window.removeEventListener('hub:right-rail-tab', handleSwitch);
  }, [handleTabChange]);

  const handleRefresh = () => {
    setActiveVideo(null);
    if (activeTab === 'news') { setNewsFetched(false); loadNews(); }
    else { setVideosFetched(false); loadVideos(); }
  };

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'news',  label: 'Daily Feed', icon: <Newspaper className="w-3 h-3" /> },
    { id: 'video', label: 'Your Lens',  icon: <Video className="w-3 h-3" /> },
  ];

  const isContentLoading = activeTab === 'news' ? newsLoading : videoLoading;
  const hasError = activeTab === 'news' ? newsError : videoError;
  const showingPlayer = activeTab === 'video' && !!activeVideo;

  return (
    <div
      className="relative flex-shrink-0 h-full flex flex-col overflow-hidden w-[240px]"
      style={{
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(16px)',
        borderLeft: '1px solid rgba(0,0,0,0.07)',
      }}
    >
      {/* Tab bar — hidden while a video is playing */}
      {!showingPlayer && (
        <div
          className="flex items-center justify-between px-2.5 pt-2.5 pb-2 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
        >
          <div className="flex items-center gap-0.5 bg-gray-100/80 rounded-lg p-0.5 flex-1 min-w-0">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold transition-all duration-150 flex-1 justify-center ${
                  activeTab === tab.id
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleRefresh}
            disabled={isContentLoading}
            className="flex items-center justify-center w-6 h-6 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-40 ml-1.5 flex-shrink-0"
            title="Refresh"
          >
            <RefreshCw className={`w-3 h-3 text-gray-400 ${isContentLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <AnimatePresence mode="wait">

          {/* Inline video player */}
          {showingPlayer && activeVideo && (
            <InlineVideoPlayer
              video={activeVideo}
              onClose={() => setActiveVideo(null)}
            />
          )}

          {/* News tab */}
          {!showingPlayer && activeTab === 'news' && (
            isContentLoading ? (
              <motion.div key="news-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-2 p-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="rounded-xl overflow-hidden bg-gray-100/60 animate-pulse">
                    <div className="h-20 bg-gray-200/60" />
                    <div className="p-2 space-y-1.5">
                      <div className="h-2.5 bg-gray-200/80 rounded w-4/5" />
                      <div className="h-2 bg-gray-200/60 rounded w-3/5" />
                    </div>
                  </div>
                ))}
              </motion.div>
            ) : hasError ? (
              <motion.div key="news-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-12 px-4 gap-3">
                <AlertCircle className="w-5 h-5 text-gray-300" />
                <p className="text-[11px] text-gray-400 text-center">Couldn't load stories. Tap refresh to try again.</p>
              </motion.div>
            ) : news.length === 0 ? (
              <motion.div key="news-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center justify-center py-12 px-4">
                <p className="text-[11px] text-gray-400 text-center">Nothing to show right now.</p>
              </motion.div>
            ) : (
              <motion.div key="news-content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-1.5 p-2">
                {news.map(a => (
                  <a
                    key={a.id}
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block rounded-xl overflow-hidden transition-all duration-150"
                    style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.10)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
                  >
                    {a.image_url && <img src={a.image_url} alt="" className="w-full h-[88px] object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                    <div className="px-2.5 py-2">
                      <p className="text-[11px] font-semibold text-gray-800 leading-snug line-clamp-2 group-hover:text-gray-900">{a.title}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {a.source && <span className="text-[9px] font-medium text-gray-400 uppercase tracking-wide truncate">{a.source}</span>}
                        {a.published_at && <span className="text-[9px] text-gray-300 flex-shrink-0">· {timeAgo(a.published_at)}</span>}
                        <ExternalLink className="w-2.5 h-2.5 text-gray-300 group-hover:text-gray-500 ml-auto flex-shrink-0 transition-colors" />
                      </div>
                    </div>
                  </a>
                ))}
              </motion.div>
            )
          )}

          {/* Video tab — card list */}
          {!showingPlayer && activeTab === 'video' && (
            isContentLoading ? (
              <motion.div key="video-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-2 p-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="rounded-xl overflow-hidden bg-gray-100/60 animate-pulse">
                    <div className="h-20 bg-gray-200/60" />
                    <div className="p-2 space-y-1.5">
                      <div className="h-2.5 bg-gray-200/80 rounded w-4/5" />
                      <div className="h-2 bg-gray-200/60 rounded w-3/5" />
                    </div>
                  </div>
                ))}
              </motion.div>
            ) : hasError ? (
              <motion.div key="video-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-12 px-4 gap-3">
                <AlertCircle className="w-5 h-5 text-gray-300" />
                <p className="text-[11px] text-gray-400 text-center">Couldn't load videos. Tap refresh to try again.</p>
              </motion.div>
            ) : videos.length === 0 ? (
              <motion.div key="video-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center justify-center py-12 px-4">
                <p className="text-[11px] text-gray-400 text-center">Nothing to show right now.</p>
              </motion.div>
            ) : (
              <motion.div key="video-list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-1.5 p-2">
                {videos.map(v => (
                  <button
                    key={v.id}
                    onClick={() => setActiveVideo(v)}
                    className="group w-full text-left rounded-xl overflow-hidden transition-all duration-150 cursor-pointer"
                    style={{ background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.10)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
                  >
                    <div className="relative">
                      <img src={v.thumbnail} alt="" className="w-full h-[88px] object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center"
                          style={{ background: 'rgba(255,255,255,0.95)', boxShadow: '0 2px 12px rgba(0,0,0,0.25)' }}
                        >
                          <Play className="w-4 h-4 text-gray-900 ml-0.5" />
                        </div>
                      </div>
                      {/* "Watch here" badge */}
                      <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md text-[8px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
                      >
                        Watch here
                      </div>
                    </div>
                    <div className="px-2.5 py-2">
                      <p className="text-[11px] font-semibold text-gray-800 leading-snug line-clamp-2 group-hover:text-gray-900">{v.title}</p>
                      <p className="text-[9px] text-gray-400 mt-1 truncate">{v.channelTitle}</p>
                    </div>
                  </button>
                ))}
              </motion.div>
            )
          )}
        </AnimatePresence>
      </div>

      {/* Footer — hidden while player is active */}
      {!showingPlayer && (
        <div
          className="px-3 py-2 flex-shrink-0 flex items-center justify-center"
          style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}
        >
          <p className="text-[9.5px] font-medium text-gray-300 tracking-widest uppercase select-none">
            {activeTab === 'news' ? 'Daily Feed' : 'Your Lens'}
          </p>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ExternalLink, Loader2, Globe, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../shared/supabase/client';

interface NewsArticle {
  id: string;
  title: string;
  description: string;
  content: string;
  url: string;
  image_url?: string;
  source: string;
  author?: string;
  published_at: string;
  categories: string[];
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

export function ArticleDetailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const articleId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeBlocked, setIframeBlocked] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (articleId) loadArticle();
  }, [articleId]);

  const loadArticle = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: articleData } = await supabase
        .from('news_articles')
        .select('*')
        .eq('id', articleId)
        .single();

      if (articleData) {
        setArticle(articleData);
        if (user) {
          await supabase.from('article_views').upsert(
            { article_id: articleId, user_id: user.id, viewed_at: new Date().toISOString() },
            { onConflict: 'article_id,user_id' }
          );
        }
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading article:', error);
      setLoading(false);
    }
  };

  const handleIframeLoad = () => {
    setIframeLoading(false);
    try {
      const iframe = iframeRef.current;
      if (iframe?.contentDocument?.body) {
        const bodyText = iframe.contentDocument.body.innerText;
        if (!bodyText || bodyText.trim().length < 50) {
          setIframeBlocked(true);
        }
      }
    } catch {
      setIframeBlocked(false);
    }
  };

  const handleIframeError = () => {
    setIframeLoading(false);
    setIframeBlocked(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mx-auto mb-3" />
          <p className="text-white/50 text-sm">Loading article...</p>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/50 text-sm mb-4">Article not found</p>
          <button
            onClick={() => navigate('/daily-feed')}
            className="text-emerald-400 hover:text-emerald-300 transition-colors text-sm"
          >
            Back to Feed
          </button>
        </div>
      </div>
    );
  }

  const primaryCat = article.categories?.[0];

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-[#0a0a0f]/95 backdrop-blur-xl border-b border-white/8">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/daily-feed')}
            className="p-2 hover:bg-white/8 rounded-lg transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-white/70" />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              {primaryCat && (
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${getCategoryColor(primaryCat)}`}>
                  {primaryCat}
                </span>
              )}
              <span className="text-white/30 text-[10px] font-medium">{article.source}</span>
            </div>
            <p className="text-white text-sm font-semibold leading-tight line-clamp-1">
              {article.title}
            </p>
          </div>

          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 hover:bg-white/8 rounded-lg transition-colors flex-shrink-0"
            title="Open in new tab"
          >
            <ExternalLink className="w-4 h-4 text-white/50" />
          </a>
        </div>
      </div>

      {/* Article content */}
      <div className="flex-1 flex flex-col">
        <div className="max-w-5xl mx-auto w-full px-4 pt-4 pb-3">
          <div className="flex items-start gap-4 p-4 bg-white/4 border border-white/8 rounded-xl">
            {article.image_url && (
              <img
                src={article.image_url}
                alt={article.title}
                className="w-20 h-14 object-cover rounded-lg flex-shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-white font-bold text-sm leading-snug mb-1.5 line-clamp-2">
                {article.title}
              </h2>
              <div className="flex items-center gap-3 text-white/40 text-xs">
                <span className="font-medium">{article.source}</span>
                {article.author && (
                  <>
                    <span>·</span>
                    <span className="line-clamp-1">{article.author}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* iframe browser */}
        <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full px-4 pb-4">
          <div className="flex-1 relative rounded-xl overflow-hidden border border-white/8 bg-white" style={{ minHeight: 'calc(100vh - 220px)' }}>
            <AnimatePresence>
              {iframeLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0f] z-10"
                >
                  <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
                  <p className="text-white/40 text-sm">Loading article from {article.source}...</p>
                </motion.div>
              )}
            </AnimatePresence>

            {iframeBlocked ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0f] z-10 p-8">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                  <Globe className="w-7 h-7 text-white/30" />
                </div>
                <h3 className="text-white font-bold text-base mb-2 text-center">
                  {article.source} blocks embedded viewing
                </h3>
                <p className="text-white/40 text-sm text-center mb-6 max-w-xs leading-relaxed">
                  This publisher prevents their content from loading inside apps. Open it in your browser to read the full article.
                </p>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-all text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open in Browser
                </a>
              </div>
            ) : (
              <iframe
                ref={iframeRef}
                src={article.url}
                title={article.title}
                className="w-full h-full border-0"
                style={{ minHeight: 'calc(100vh - 220px)' }}
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              />
            )}
          </div>

          {/* footer actions */}
          <div className="flex items-center justify-between pt-3">
            <button
              onClick={() => {
                setIframeLoading(true);
                setIframeBlocked(false);
                if (iframeRef.current) {
                  iframeRef.current.src = article.url;
                }
              }}
              className="flex items-center gap-1.5 text-white/30 hover:text-white/60 text-xs transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reload
            </button>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-white/30 hover:text-emerald-400 text-xs transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open in browser
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ExternalLink, Loader2, Send,
  MessageCircle, Plus, X, Globe, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../shared/supabase/client';
import { Avatar } from '../components/Avatar';
import { AvatarConfig } from '../types/avatar';

// article-chat now requires a real user token (not the public anon key).
async function getArticleChatAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
}

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

interface Companion {
  id: string;
  custom_name: string;
  gender: string;
  avatar_config: AvatarConfig | null;
  personality_traits?: any;
  communication_style?: string;
}

interface ArticleMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  companion_id?: string;
}

const DEFAULT_AVATAR_IMAGES: Record<string, string> = {
  female: '/images/riley-positive.jpg',
  male: '/images/jake-positive.jpg'
};

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
  const [allCompanions, setAllCompanions] = useState<Companion[]>([]);
  const [selectedCompanions, setSelectedCompanions] = useState<Companion[]>([]);
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [showCompanionSelector, setShowCompanionSelector] = useState(false);
  const [messages, setMessages] = useState<ArticleMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [activeTab, setActiveTab] = useState<'browser' | 'discussion'>('browser');
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeBlocked, setIframeBlocked] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (articleId) loadArticleAndCompanions();
  }, [articleId]);

  // Server-side embeddability probe. Publishers block in-app framing with
  // X-Frame-Options / CSP headers the browser hides from us, so we ask the
  // edge function (which can read those headers) whether this article will
  // actually render. If not, we show the honest "open in browser" state up
  // front instead of a spinner that never resolves. A per-article load timeout
  // is the backstop for anything the header check misses.
  useEffect(() => {
    if (!article?.url) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-embeddable`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: article.url }),
          },
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const result = data.results?.[0];
        if (!cancelled && result && result.embeddable === false) {
          setIframeBlocked(true);
          setIframeLoading(false);
        }
      } catch {
        /* fall back to the iframe + load-timeout below */
      }
    })();

    loadTimerRef.current = setTimeout(() => {
      if (!cancelled) {
        setIframeLoading((stillLoading) => {
          if (stillLoading) setIframeBlocked(true);
          return false;
        });
      }
    }, 9000);

    return () => {
      cancelled = true;
      if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
    };
  }, [article?.url]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadArticleAndCompanions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [articleData, companionsData, messagesData] = await Promise.all([
        supabase.from('news_articles').select('*').eq('id', articleId).single(),
        supabase.from('companions').select('*').eq('user_id', user.id),
        supabase
          .from('article_conversations')
          .select('*')
          .eq('article_id', articleId)
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
      ]);

      if (articleData.data) {
        setArticle(articleData.data);
        await supabase.from('article_views').upsert(
          { article_id: articleId, user_id: user.id, viewed_at: new Date().toISOString() },
          { onConflict: 'article_id,user_id' }
        );
      }

      if (companionsData.data) setAllCompanions(companionsData.data);
      if (messagesData.data) setMessages(messagesData.data);

      setLoading(false);
    } catch (error) {
      console.error('Error loading article:', error);
      setLoading(false);
    }
  };

  const handleIframeLoad = () => {
    setIframeLoading(false);
    if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
    try {
      const iframe = iframeRef.current;
      // Same-origin only — a real article is always cross-origin, so this
      // branch only catches our own error/blank pages. A cross-origin read
      // throws; we swallow it and trust the header probe, rather than
      // (as before) wrongly clearing the blocked state on every real article.
      if (iframe?.contentDocument?.body) {
        const bodyText = iframe.contentDocument.body.innerText;
        if (!bodyText || bodyText.trim().length < 50) {
          setIframeBlocked(true);
        }
      }
    } catch {
      /* cross-origin: expected for real articles — leave probe's verdict intact */
    }
  };

  const handleIframeError = () => {
    setIframeLoading(false);
    if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
    setIframeBlocked(true);
  };

  const toggleCompanion = async (companion: Companion) => {
    const isAlreadySelected = selectedCompanions.find(c => c.id === companion.id);
    if (isAlreadySelected) {
      setSelectedCompanions(selectedCompanions.filter(c => c.id !== companion.id));
    } else {
      setSelectedCompanions([...selectedCompanions, companion]);
      if (messages.length > 0) {
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'user',
          content: `Calling ${companion.custom_name}...`,
          created_at: new Date().toISOString()
        }]);
        setTimeout(() => inviteCompanionToConversation(companion), 1500);
      }
    }
  };

  const inviteCompanionToConversation = async (companion: Companion) => {
    if (!article) return;
    setGeneratingAI(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/article-chat`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${await getArticleChatAuthToken()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            articleId: article.id,
            companionId: companion.id,
            message: 'joining_conversation',
            articleContext: {
              title: article.title,
              description: article.description,
              content: article.content,
              source: article.source,
              published_at: article.published_at
            },
            isJoining: true,
            recentMessages: messages.slice(-6).map(m => ({
              role: m.role,
              content: m.content,
              companion_id: m.companion_id
            }))
          })
        }
      );

      if (!response.ok) throw new Error('Failed to get response');
      const data = await response.json();

      const assistantMessage: ArticleMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message,
        created_at: new Date().toISOString(),
        companion_id: companion.id
      };

      setMessages(prev => [...prev, assistantMessage]);
      await supabase.from('article_conversations').insert({
        article_id: article.id,
        user_id: user.id,
        companion_id: companion.id,
        role: 'assistant',
        content: data.message
      });
    } catch (error) {
      console.error('Error inviting companion:', error);
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || selectedCompanions.length === 0 || !article) return;

    setSending(true);
    const userMessage = inputMessage.trim();
    setInputMessage('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'user',
        content: userMessage,
        created_at: new Date().toISOString()
      }]);

      for (const companion of selectedCompanions) {
        await supabase.from('article_conversations').insert({
          article_id: article.id,
          user_id: user.id,
          companion_id: companion.id,
          role: 'user',
          content: userMessage
        });
      }

      if (isGroupMode) {
        await generateGroupResponses(userMessage);
      } else {
        await generateSingleResponse(selectedCompanions[0], userMessage);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const generateSingleResponse = async (companion: Companion, userMessage: string) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/article-chat`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${await getArticleChatAuthToken()}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            articleId: article!.id,
            companionId: companion.id,
            message: userMessage,
            articleContext: {
              title: article!.title,
              description: article!.description,
              content: article!.content,
              source: article!.source,
              published_at: article!.published_at
            }
          })
        }
      );

      if (!response.ok) throw new Error('Failed to get response');
      const data = await response.json();

      const assistantMessage: ArticleMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message,
        created_at: new Date().toISOString(),
        companion_id: companion.id
      };

      setMessages(prev => [...prev, assistantMessage]);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('article_conversations').insert({
          article_id: article!.id,
          user_id: user.id,
          companion_id: companion.id,
          role: 'assistant',
          content: data.message
        });
      }
    } catch (error) {
      console.error('Error generating response:', error);
    }
  };

  const generateGroupResponses = async (userMessage: string) => {
    setGeneratingAI(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      for (const companion of selectedCompanions) {
        const recentMessages = messages.slice(-10);

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/article-chat`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${await getArticleChatAuthToken()}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              articleId: article!.id,
              companionId: companion.id,
              message: userMessage,
              articleContext: {
                title: article!.title,
                description: article!.description,
                content: article!.content,
                source: article!.source,
                published_at: article!.published_at
              },
              isGroupMode: true,
              otherCompanions: selectedCompanions
                .filter(c => c.id !== companion.id)
                .map(c => ({ id: c.id, name: c.custom_name })),
              recentMessages: recentMessages.map(m => ({
                role: m.role,
                content: m.content,
                companion_id: m.companion_id
              }))
            })
          }
        );

        if (!response.ok) continue;
        const data = await response.json();

        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.message,
          created_at: new Date().toISOString(),
          companion_id: companion.id
        }]);

        await supabase.from('article_conversations').insert({
          article_id: article!.id,
          user_id: user.id,
          companion_id: companion.id,
          role: 'assistant',
          content: data.message
        });

        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error('Error generating group responses:', error);
    } finally {
      setGeneratingAI(false);
    }
  };

  const getCompanionForMessage = (companionId?: string) => {
    if (!companionId) return selectedCompanions[0];
    return allCompanions.find(c => c.id === companionId) || selectedCompanions[0];
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

        {/* Tab bar */}
        <div className="max-w-5xl mx-auto px-4 flex border-t border-white/5">
          <button
            onClick={() => setActiveTab('browser')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold transition-colors ${
              activeTab === 'browser'
                ? 'text-white border-b-2 border-emerald-400'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            Article
          </button>
          <button
            onClick={() => setActiveTab('discussion')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold transition-colors ${
              activeTab === 'discussion'
                ? 'text-white border-b-2 border-emerald-400'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Discussion
            {messages.filter(m => m.role === 'assistant').length > 0 && (
              <span className="bg-emerald-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {messages.filter(m => m.role === 'assistant').length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          {activeTab === 'browser' ? (
            <motion.div
              key="browser"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col"
            >
              {/* Article card above iframe */}
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
                <div className="flex-1 relative rounded-xl overflow-hidden border border-white/8 bg-white" style={{ minHeight: 'calc(100vh - 280px)' }}>
                  {iframeLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0f] z-10">
                      <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
                      <p className="text-white/40 text-sm">Loading article from {article.source}...</p>
                    </div>
                  )}

                  {iframeBlocked && !iframeLoading ? (
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
                      style={{ minHeight: 'calc(100vh - 280px)' }}
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
                      if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
                      loadTimerRef.current = setTimeout(() => {
                        setIframeLoading((stillLoading) => {
                          if (stillLoading) setIframeBlocked(true);
                          return false;
                        });
                      }, 9000);
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
            </motion.div>
          ) : (
            <motion.div
              key="discussion"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col max-w-5xl mx-auto w-full px-4 pt-4"
            >
              {allCompanions.length > 0 ? (
                <>
                  {/* Discussion controls */}
                  <div className="p-4 bg-white/4 border border-white/8 rounded-xl mb-3">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {isGroupMode ? 'Group Discussion' : 'One-on-One Chat'}
                        </p>
                        <p className="text-xs text-white/40">
                          {isGroupMode
                            ? `${selectedCompanions.length} companions`
                            : 'Private conversation'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {allCompanions.length > 1 && (
                          <button
                            onClick={() => setIsGroupMode(!isGroupMode)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                              isGroupMode
                                ? 'bg-emerald-500 text-white'
                                : 'bg-white/8 text-white/60 hover:bg-white/12 hover:text-white'
                            }`}
                          >
                            {isGroupMode ? 'Group' : 'Solo'}
                          </button>
                        )}
                        <button
                          onClick={() => setShowCompanionSelector(!showCompanionSelector)}
                          className={`p-1.5 rounded-lg transition-all ${
                            showCompanionSelector ? 'bg-emerald-500 text-white' : 'bg-white/8 text-white/60 hover:bg-white/12'
                          }`}
                        >
                          {showCompanionSelector ? <X size={16} /> : <Plus size={16} />}
                        </button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {showCompanionSelector && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mb-3 overflow-hidden"
                        >
                          <p className="text-xs text-white/40 mb-2">Select companions:</p>
                          <div className="flex flex-wrap gap-2">
                            {allCompanions.map((companion) => (
                              <button
                                key={companion.id}
                                onClick={() => toggleCompanion(companion)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-sm ${
                                  selectedCompanions.find(c => c.id === companion.id)
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-white/8 text-white/60 hover:bg-white/12 hover:text-white'
                                }`}
                              >
                                <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0">
                                  {companion.avatar_config ? (
                                    <Avatar config={companion.avatar_config} className="w-full h-full" />
                                  ) : (
                                    <img
                                      src={DEFAULT_AVATAR_IMAGES[companion.gender] || DEFAULT_AVATAR_IMAGES.female}
                                      alt={companion.custom_name}
                                      className="w-full h-full object-cover"
                                    />
                                  )}
                                </div>
                                <span className="font-semibold">{companion.custom_name}</span>
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {selectedCompanions.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedCompanions.map((companion) => (
                          <div
                            key={companion.id}
                            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-lg"
                          >
                            <div className="w-5 h-5 rounded-full overflow-hidden flex-shrink-0">
                              {companion.avatar_config ? (
                                <Avatar config={companion.avatar_config} className="w-full h-full" />
                              ) : (
                                <img
                                  src={DEFAULT_AVATAR_IMAGES[companion.gender] || DEFAULT_AVATAR_IMAGES.female}
                                  alt={companion.custom_name}
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>
                            <span className="text-xs font-semibold text-emerald-300">
                              {companion.custom_name}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg">
                        <MessageCircle className="w-4 h-4 text-white/30 flex-shrink-0" />
                        <p className="text-xs text-white/40">
                          Tap + to select a companion to discuss this article
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto space-y-4 pb-4" style={{ minHeight: 200 }}>
                    {messages.length === 0 ? (
                      <div className="text-center py-12">
                        <MessageCircle className="w-10 h-10 text-white/10 mx-auto mb-3" />
                        <p className="text-white/30 text-sm font-medium">
                          {selectedCompanions.length === 0
                            ? 'Select a companion to start the discussion'
                            : 'What do you think about this article?'}
                        </p>
                      </div>
                    ) : (
                      <AnimatePresence>
                        {messages.map((message) => {
                          const companion = message.role === 'assistant'
                            ? getCompanionForMessage(message.companion_id)
                            : null;

                          return (
                            <motion.div
                              key={message.id}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                              {message.role === 'assistant' && companion && (
                                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                                  <div className="w-7 h-7 rounded-full overflow-hidden bg-white/10">
                                    {companion.avatar_config ? (
                                      <Avatar config={companion.avatar_config} className="w-full h-full" />
                                    ) : (
                                      <img
                                        src={DEFAULT_AVATAR_IMAGES[companion.gender] || DEFAULT_AVATAR_IMAGES.female}
                                        alt={companion.custom_name}
                                        className="w-full h-full object-cover"
                                      />
                                    )}
                                  </div>
                                  {isGroupMode && (
                                    <span className="text-[10px] text-white/30 font-semibold">
                                      {companion.custom_name}
                                    </span>
                                  )}
                                </div>
                              )}
                              <div
                                className={`max-w-[78%] rounded-2xl px-4 py-2.5 ${
                                  message.role === 'user'
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-white/8 border border-white/10 text-white/90'
                                }`}
                              >
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                  {message.content}
                                </p>
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    )}
                    {(sending || generatingAI) && (
                      <div className="flex items-center justify-center gap-2 text-white/30">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-xs">
                          {generatingAI ? 'Thinking...' : 'Sending...'}
                        </span>
                      </div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input */}
                  <div className="pb-4 pt-2 border-t border-white/8 mt-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !sending && !generatingAI && handleSendMessage()}
                        placeholder={selectedCompanions.length === 0 ? 'Select a companion first...' : 'Share your thoughts...'}
                        className="flex-1 bg-white/6 border border-white/10 text-white placeholder-white/30 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 transition-all"
                        disabled={sending || generatingAI || selectedCompanions.length === 0}
                      />
                      <button
                        onClick={handleSendMessage}
                        disabled={sending || generatingAI || !inputMessage.trim() || selectedCompanions.length === 0}
                        className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-white/10 disabled:text-white/20 text-white font-semibold rounded-xl transition-all flex items-center gap-2"
                      >
                        {sending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center pb-8">
                  <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                    <MessageCircle className="w-7 h-7 text-white/20" />
                  </div>
                  <p className="text-white/40 font-semibold text-sm mb-4 text-center">
                    Create a companion to discuss this article
                  </p>
                  <button
                    onClick={() => navigate('/lobby')}
                    className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-all text-sm"
                  >
                    Create Companion
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

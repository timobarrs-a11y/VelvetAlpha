import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, Clock, X, Search, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { coreService, CoreConversation } from '../services/coreService';
import { CoreCanvas } from '../components/CoreCanvas';
import { FeatureLoadingSplash } from '../components/FeatureLoadingSplash';

export function CorePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const conversationId = searchParams.get('c');

  const [conversations, setConversations] = useState<CoreConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => { loadConversations(); }, []);

  const loadConversations = async () => {
    try {
      setConversations(await coreService.getConversations());
    } catch (err) {
      console.error('Failed to load Core threads', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewConversation = async () => {
    try {
      setIsCreating(true);
      const conv = await coreService.createConversation();
      setConversations(prev => [conv, ...prev]);
      setSearchParams({ c: conv.id });
      setSidebarOpen(false);
    } catch (err) {
      console.error('Failed to create thread', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteConversation = async () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    try {
      await coreService.deleteConversation(id);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (conversationId === id) setSearchParams({});
    } catch (err) {
      console.error('Failed to delete thread', err);
    }
  };

  const handleTitleChange = (id: string, title: string) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c));
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(c => c.title.toLowerCase().includes(q));
  }, [conversations, query]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  };

  if (isLoading) {
    return <FeatureLoadingSplash icon={Terminal} label="Loading Core…" accentColor="#94a3b8" bgColor="#0a0c10" />;
  }

  return (
    <div className="min-h-screen bg-[#08090d] text-white flex flex-col" style={{ height: '100dvh' }}>
      {!conversationId && (
        <div className="flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-white/8 bg-[#08090d]/95 backdrop-blur-xl flex-shrink-0">
          <button onClick={() => navigate('/lobby')} className="p-2 hover:bg-white/8 rounded-lg transition-colors text-slate-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 rounded-lg bg-slate-800/80 border border-slate-500/30 flex items-center justify-center">
            <Terminal className="w-4 h-4 text-slate-300" />
          </div>
          <div>
            <span className="font-bold text-white text-lg tracking-tight">Core</span>
            <p className="text-[10px] text-slate-500 font-medium tracking-wide uppercase -mt-0.5">General assistant</p>
          </div>
          <div className="flex-1" />
          <button
            onClick={handleNewConversation}
            disabled={isCreating}
            className="flex items-center gap-2 px-4 py-2 bg-white/8 hover:bg-white/12 border border-white/12 rounded-lg text-sm font-medium text-slate-300 hover:text-white transition-all disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />New thread
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <AnimatePresence initial={false}>
          {(!conversationId || sidebarOpen) && (
            <motion.aside
              key="sidebar"
              initial={conversationId ? { x: -320, opacity: 0 } : false}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -320, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className={`flex-shrink-0 border-r border-white/8 bg-[#08090d] flex flex-col overflow-hidden
                ${conversationId ? 'absolute inset-y-0 left-0 z-20 w-72 sm:w-80 shadow-2xl sm:relative sm:shadow-none' : 'w-full sm:w-72 lg:w-80'}`}
            >
              {conversationId && (
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8 flex-shrink-0">
                  <button onClick={() => navigate('/lobby')} className="p-1.5 hover:bg-white/8 rounded-lg transition-colors text-slate-400 hover:text-white">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="w-7 h-7 rounded-lg bg-slate-800/80 border border-slate-500/30 flex items-center justify-center">
                    <Terminal className="w-3.5 h-3.5 text-slate-300" />
                  </div>
                  <span className="font-bold text-white text-base tracking-tight flex-1">Core</span>
                  <button onClick={() => setSidebarOpen(false)} className="p-1.5 hover:bg-white/8 rounded-lg transition-colors text-slate-500 sm:hidden">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="px-3 py-2 flex-shrink-0">
                <button
                  onClick={handleNewConversation}
                  disabled={isCreating}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/6 hover:bg-white/10 border border-white/10 hover:border-white/18 text-sm font-medium text-slate-300 hover:text-white transition-all disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />New thread
                </button>
              </div>

              <div className="px-3 pb-2 flex-shrink-0">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/4 border border-white/8 focus-within:border-white/16">
                  <Search className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search threads"
                    className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-600 outline-none min-w-0"
                  />
                  {query && (
                    <button onClick={() => setQuery('')} className="text-slate-500 hover:text-slate-300">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-2 pb-4">
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <Terminal className="w-8 h-8 text-slate-700 mb-3" />
                    <p className="text-slate-500 text-sm">{query ? 'No matching threads' : 'No threads yet'}</p>
                    {!query && <p className="text-slate-600 text-xs mt-1">Start one above</p>}
                  </div>
                ) : (
                  <div className="space-y-0.5 mt-1">
                    {filtered.map(conv => (
                      <button
                        key={conv.id}
                        onClick={() => { setSearchParams({ c: conv.id }); setSidebarOpen(false); }}
                        className={`group w-full text-left px-3 py-2.5 rounded-xl transition-all relative ${
                          conversationId === conv.id ? 'bg-white/10 border border-white/15' : 'hover:bg-white/6 border border-transparent hover:border-white/8'
                        }`}
                      >
                        <div className="min-w-0 pr-6">
                          <p className="text-sm font-medium text-slate-200 truncate leading-tight">{conv.title}</p>
                          <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />{formatDate(conv.updated_at)}
                          </p>
                        </div>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); setPendingDeleteId(conv.id); }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {conversationId && sidebarOpen && (
          <div className="fixed inset-0 bg-black/60 z-10 sm:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        <div className="flex-1 flex flex-col overflow-hidden relative">
          {conversationId ? (
            <CoreCanvas
              key={conversationId}
              conversationId={conversationId}
              onNewConversation={handleNewConversation}
              onBack={() => { setSidebarOpen(true); setSearchParams({}); }}
              onTitleChange={handleTitleChange}
            />
          ) : (
            <div className="hidden sm:flex flex-col items-center justify-center h-full text-center px-8">
              <div className="w-14 h-14 rounded-xl bg-slate-800/80 border border-slate-500/30 flex items-center justify-center">
                <Terminal className="w-6 h-6 text-slate-300" />
              </div>
              <h2 className="text-2xl font-bold text-white mt-6 mb-2 tracking-tight">Core</h2>
              <p className="text-[10px] font-semibold tracking-[0.2em] text-slate-500 uppercase mb-5">General assistant</p>
              <p className="text-slate-400 max-w-xs leading-relaxed mb-8">
                Practical, task-oriented help — and it already knows you. When you just need to get something done.
              </p>
              <button
                onClick={handleNewConversation}
                disabled={isCreating}
                className="flex items-center gap-2 px-6 py-3 bg-white/8 hover:bg-white/12 border border-white/15 rounded-2xl text-white font-medium transition-all text-sm disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />Start a thread
              </button>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {pendingDeleteId && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              className="bg-[#111218] border border-white/10 rounded-2xl p-6 max-w-sm w-full text-center"
            >
              <p className="text-white font-semibold mb-2">Delete thread?</p>
              <p className="text-slate-400 text-sm mb-6">All messages will be permanently removed.</p>
              <div className="flex gap-3">
                <button onClick={() => setPendingDeleteId(null)} className="flex-1 px-4 py-2.5 bg-white/6 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-sm transition-colors">Cancel</button>
                <button onClick={handleDeleteConversation} className="flex-1 px-4 py-2.5 bg-red-500/80 hover:bg-red-500 text-white rounded-xl text-sm font-medium transition-colors">Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

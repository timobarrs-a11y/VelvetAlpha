import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus, Trash2, MessageSquare, ArrowLeft, Clock, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { atlasService, AtlasConversation } from '../services/atlasService';
import { AtlasCanvas } from '../components/AtlasCanvas';
import { FeatureLoadingSplash } from '../components/FeatureLoadingSplash';

type AtlasVoice = 'masculine' | 'feminine';

function AtlasMonogram({ size = 'md', voice }: { size?: 'sm' | 'md' | 'lg'; voice?: AtlasVoice | null }) {
  const dims = size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-20 h-20' : 'w-8 h-8';
  const text = size === 'sm' ? 'text-[10px]' : size === 'lg' ? 'text-2xl' : 'text-xs';
  const feminine = voice === 'feminine';
  return (
    <div className={`${dims} rounded-lg flex items-center justify-center flex-shrink-0 ${
      feminine
        ? 'bg-[#1a0f1e] border border-rose-500/30'
        : 'bg-[#0f1117] border border-white/20'
    }`}>
      <span className={`font-bold ${text} tracking-widest select-none ${feminine ? 'text-rose-300/90' : 'text-white/90'}`}>A</span>
    </div>
  );
}

function VoicePickerModal({
  onSelect,
  onClose,
}: {
  onSelect: (voice: AtlasVoice, remember: boolean) => void;
  onClose: () => void;
}) {
  const [remember, setRemember] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        className="bg-[#0e0f18] border border-white/10 rounded-2xl p-6 max-w-sm w-full"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center mb-6">
          <p className="text-white font-bold text-lg tracking-tight">Choose Atlas's voice</p>
          <p className="text-white/40 text-sm mt-1">You can change this anytime from the sidebar.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onSelect('masculine', remember)}
            className="group flex flex-col items-center gap-3 p-5 rounded-2xl border border-white/10 hover:border-slate-400/40 bg-white/4 hover:bg-white/8 transition-all"
          >
            <div className="w-12 h-12 rounded-xl bg-[#0f1117] border border-white/20 flex items-center justify-center">
              <span className="font-bold text-xl text-white/90 tracking-widest">A</span>
            </div>
            <div>
              <p className="text-white font-semibold text-sm text-center">Masculine</p>
              <p className="text-white/40 text-xs mt-1 text-center leading-snug">Direct. Authoritative. Gets straight to it.</p>
            </div>
          </button>

          <button
            onClick={() => onSelect('feminine', remember)}
            className="group flex flex-col items-center gap-3 p-5 rounded-2xl border border-white/10 hover:border-rose-400/40 bg-white/4 hover:bg-rose-500/8 transition-all"
          >
            <div className="w-12 h-12 rounded-xl bg-[#1a0f1e] border border-rose-500/30 flex items-center justify-center">
              <span className="font-bold text-xl text-rose-300/90 tracking-widest">A</span>
            </div>
            <div>
              <p className="text-rose-200 font-semibold text-sm text-center">Feminine</p>
              <p className="text-white/40 text-xs mt-1 text-center leading-snug">Perceptive. Warm-sharp. Reads the room.</p>
            </div>
          </button>
        </div>

        {/* Remember toggle */}
        <button
          onClick={() => setRemember(r => !r)}
          className="w-full mt-4 flex items-center justify-center gap-2.5 py-2.5 rounded-xl hover:bg-white/4 transition-colors group"
        >
          <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
            remember
              ? 'bg-white border-white'
              : 'border-white/25 group-hover:border-white/40'
          }`}>
            {remember && (
              <svg className="w-2.5 h-2.5 text-black" fill="none" viewBox="0 0 10 10">
                <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <span className={`text-sm transition-colors ${remember ? 'text-white/80' : 'text-white/35 group-hover:text-white/55'}`}>
            Remember my choice
          </span>
        </button>

        <button
          onClick={onClose}
          className="w-full mt-1 py-2 text-white/25 hover:text-white/50 text-xs transition-colors"
        >
          Skip for now
        </button>
      </motion.div>
    </motion.div>
  );
}

export function AtlasPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const conversationId = searchParams.get('c');

  const [conversations, setConversations] = useState<AtlasConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [defaultVoice, setDefaultVoice] = useState<AtlasVoice | null>(null);
  const [defaultVoiceLoaded, setDefaultVoiceLoaded] = useState(false);

  const activeConversation = conversations.find(c => c.id === conversationId) || null;
  const activeVoice = activeConversation?.voice ?? null;

  useEffect(() => {
    Promise.all([loadConversations(), loadDefaultVoice()]);
  }, []);

  useEffect(() => {
    if (!defaultVoiceLoaded) return;
    if (activeConversation && activeConversation.voice === null && !showVoicePicker) {
      if (defaultVoice) {
        handleChangeVoice(defaultVoice);
      } else {
        setShowVoicePicker(true);
      }
    }
  }, [activeConversation?.id, defaultVoiceLoaded]);

  const loadConversations = async () => {
    try {
      const data = await atlasService.getConversations();
      setConversations(data);
    } catch (err) {
      console.error('Failed to load Atlas conversations', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDefaultVoice = async () => {
    try {
      const saved = await atlasService.getDefaultVoice();
      setDefaultVoice(saved);
    } catch {
      // ignore
    } finally {
      setDefaultVoiceLoaded(true);
    }
  };

  const handleNewConversation = async (voice?: AtlasVoice) => {
    try {
      setIsCreating(true);
      const conv = await atlasService.createConversation('New Conversation', voice);
      setConversations(prev => [conv, ...prev]);
      setSearchParams({ c: conv.id });
    } catch (err) {
      console.error('Failed to create conversation', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleNewConversationClick = () => {
    if (defaultVoice && defaultVoiceLoaded) {
      handleNewConversation(defaultVoice);
    } else {
      setShowVoicePicker(true);
    }
  };

  const handleVoiceSelect = async (voice: AtlasVoice, remember: boolean) => {
    setShowVoicePicker(false);
    if (remember) {
      setDefaultVoice(voice);
      atlasService.saveDefaultVoice(voice);
    }
    if (conversationId && activeConversation?.voice === null) {
      await handleChangeVoice(voice);
    } else {
      await handleNewConversation(voice);
    }
  };

  const handleVoiceSkip = () => {
    setShowVoicePicker(false);
    if (!conversationId || activeConversation?.voice !== null) {
      handleNewConversation();
    }
  };

  const handleChangeVoice = async (voice: AtlasVoice) => {
    if (!conversationId) return;
    await atlasService.updateConversationVoice(conversationId, voice);
    setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, voice } : c));
  };

  const handleDeleteConversation = async () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    try {
      await atlasService.deleteConversation(id);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (conversationId === id) {
        setSearchParams({});
      }
    } catch (err) {
      console.error('Failed to delete conversation', err);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const mins  = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    const days  = Math.floor(diffMs / 86400000);
    if (mins  < 1)  return 'Just now';
    if (mins  < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days  < 7)  return `${days}d ago`;
    return d.toLocaleDateString();
  };

  if (isLoading) {
    return (
      <FeatureLoadingSplash
        icon={MessageSquare}
        label="Loading Atlas..."
        accentColor="#94a3b8"
        bgColor="#050508"
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#08090d] text-white flex flex-col" style={{ height: '100dvh' }}>
      {/* Top bar — visible only when no conversation is open on mobile */}
      {!conversationId && (
        <div className="flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-white/8 bg-[#08090d]/95 backdrop-blur-xl flex-shrink-0">
          <button
            onClick={() => navigate('/lobby')}
            className="p-2 hover:bg-white/8 rounded-lg transition-colors text-white/60 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <AtlasMonogram size="md" />
          <div>
            <span className="font-bold text-white text-lg tracking-tight">Atlas</span>
            <div className="flex items-center gap-1.5 -mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/70" />
              <span className="text-[10px] text-white/35 font-medium tracking-wide uppercase">Ready</span>
            </div>
          </div>
          <div className="flex-1" />
          <button
            onClick={handleNewConversationClick}
            disabled={isCreating}
            className="flex items-center gap-2 px-4 py-2 bg-white/8 hover:bg-white/12 border border-white/12 rounded-lg text-sm font-medium text-white/80 hover:text-white transition-all disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            New chat
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <AnimatePresence initial={false}>
          {(!conversationId || sidebarOpen) && (
            <motion.aside
              key="sidebar"
              initial={conversationId ? { x: -320, opacity: 0 } : false}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -320, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className={`flex-shrink-0 border-r border-white/8 bg-[#08090d] flex flex-col overflow-hidden
                ${conversationId ? 'absolute inset-y-0 left-0 z-20 w-72 sm:w-80 shadow-2xl sm:relative sm:shadow-none' : 'w-full sm:w-72 lg:w-80'}
              `}
            >
              {conversationId && (
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8 flex-shrink-0">
                  <button
                    onClick={() => navigate('/lobby')}
                    className="p-1.5 hover:bg-white/8 rounded-lg transition-colors text-white/50 hover:text-white"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <AtlasMonogram size="sm" voice={activeVoice} />
                  <span className="font-bold text-white text-base tracking-tight flex-1">Atlas</span>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="p-1.5 hover:bg-white/8 rounded-lg transition-colors text-white/40 sm:hidden"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="px-3 py-2 flex-shrink-0">
                <button
                  onClick={handleNewConversationClick}
                  disabled={isCreating}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/6 hover:bg-white/10 border border-white/10 hover:border-white/18 text-sm font-medium text-white/75 hover:text-white transition-all disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  New conversation
                </button>
              </div>

              {/* Voice switcher — shows when a conversation is active */}
              {conversationId && (
                <div className="px-3 pb-2 flex-shrink-0">
                  <div className="flex items-center justify-between mb-1.5 px-1">
                    <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold">Atlas voice</p>
                    {defaultVoice && (
                      <button
                        onClick={() => { setDefaultVoice(null); atlasService.saveDefaultVoice(null); }}
                        className="text-[10px] text-white/25 hover:text-white/50 transition-colors"
                      >
                        clear default
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['masculine', 'feminine'] as AtlasVoice[]).map(v => {
                      const isActive = activeVoice === v;
                      const isDefault = defaultVoice === v;
                      const isFem = v === 'feminine';
                      return (
                        <button
                          key={v}
                          onClick={() => handleChangeVoice(v)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                            isActive
                              ? isFem
                                ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                                : 'bg-white/12 border-white/25 text-white'
                              : 'bg-white/4 border-white/8 text-white/45 hover:text-white/70 hover:bg-white/8'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${
                            isActive
                              ? isFem ? 'bg-rose-500/30' : 'bg-white/20'
                              : 'bg-white/8'
                          }`}>
                            <span className={`text-[8px] font-bold ${isFem ? 'text-rose-300' : 'text-white/80'}`}>A</span>
                          </div>
                          <span className="capitalize">{v}</span>
                          <span className="ml-auto flex items-center gap-1 flex-shrink-0">
                            {isDefault && (
                              <span className={`text-[8px] font-semibold ${isFem ? 'text-rose-400/70' : 'text-white/40'}`}>default</span>
                            )}
                            {isActive && (
                              <span className={`w-1.5 h-1.5 rounded-full ${isFem ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-2 pb-4">
                {conversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <MessageSquare className="w-8 h-8 text-white/15 mb-3" />
                    <p className="text-white/35 text-sm">No conversations yet</p>
                    <p className="text-white/20 text-xs mt-1">Start a new chat above</p>
                  </div>
                ) : (
                  <div className="space-y-0.5 mt-1">
                    {conversations.map(conv => {
                      const isFem = conv.voice === 'feminine';
                      return (
                        <button
                          key={conv.id}
                          onClick={() => { setSearchParams({ c: conv.id }); setSidebarOpen(false); }}
                          className={`group w-full text-left px-3 py-2.5 rounded-xl transition-all relative ${
                            conversationId === conv.id
                              ? isFem
                                ? 'bg-rose-500/12 border border-rose-500/25'
                                : 'bg-white/10 border border-white/15'
                              : 'hover:bg-white/6 border border-transparent hover:border-white/8'
                          }`}
                        >
                          <div className="flex items-start gap-2.5 pr-6">
                            <div className={`w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${
                              isFem ? 'bg-rose-500/20' : 'bg-white/10'
                            }`}>
                              <span className={`text-[7px] font-bold ${isFem ? 'text-rose-300/80' : 'text-white/40'}`}>A</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-white/80 truncate leading-tight">
                                {conv.title}
                              </p>
                              <p className="text-xs text-white/30 mt-0.5 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                {formatDate(conv.updated_at)}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); setPendingDeleteId(conv.id); }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Sidebar overlay backdrop on mobile */}
        {conversationId && sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-10 sm:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {conversationId ? (
            <>
              {!sidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="absolute top-3 left-3 z-10 p-2 bg-white/8 hover:bg-white/12 rounded-lg transition-colors sm:hidden"
                >
                  <MessageSquare className="w-4 h-4 text-white/60" />
                </button>
              )}
              <AtlasCanvas
                key={conversationId}
                conversationId={conversationId}
                voice={activeVoice}
                onNewConversation={handleNewConversationClick}
                onBack={() => { setSidebarOpen(true); setSearchParams({}); }}
              />
            </>
          ) : (
            <div className="hidden sm:flex flex-col items-center justify-center h-full text-center px-8">
              <AtlasMonogram size="lg" />
              <h2 className="text-2xl font-bold text-white mt-6 mb-2 tracking-tight">Atlas</h2>
              <p className="text-[10px] font-semibold tracking-[0.2em] text-white/30 uppercase mb-5">Your personal chief of staff</p>
              <p className="text-white/40 max-w-xs leading-relaxed mb-8">
                Writing, research, coding, analysis, strategy — whatever the mission, let's get it done.
              </p>
              <button
                onClick={handleNewConversationClick}
                disabled={isCreating}
                className="flex items-center gap-2 px-6 py-3 bg-white/8 hover:bg-white/12 border border-white/15 rounded-2xl text-white font-medium transition-all text-sm disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Start a conversation
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Voice picker modal */}
      <AnimatePresence>
        {showVoicePicker && (
          <VoicePickerModal
            onSelect={handleVoiceSelect}
            onClose={handleVoiceSkip}
          />
        )}
      </AnimatePresence>

      {/* Delete confirm modal */}
      <AnimatePresence>
        {pendingDeleteId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              className="bg-[#111218] border border-white/10 rounded-2xl p-6 max-w-sm w-full text-center"
            >
              <p className="text-white font-semibold mb-2">Delete conversation?</p>
              <p className="text-white/40 text-sm mb-6">All messages will be permanently removed.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setPendingDeleteId(null)}
                  className="flex-1 px-4 py-2.5 bg-white/6 hover:bg-white/10 border border-white/10 text-white/70 rounded-xl text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConversation}
                  className="flex-1 px-4 py-2.5 bg-red-500/80 hover:bg-red-500 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

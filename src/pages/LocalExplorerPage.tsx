import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Plus, Trash2, MessageSquare, ArrowLeft, Clock, X,
  Navigation, Search, Calendar, ExternalLink, Loader2,
  Utensils, Ticket, Compass, PanelLeft, Heart, Sparkles, Star,
  Users, Gift,
} from 'lucide-react';
import {
  localExplorerService,
  LocalExplorerConversation,
  LocalCalendarEvent,
  LocalMeta,
  UserLocation,
  NaviVoice,
} from '../services/localExplorerService';
import { FeatureLoadingSplash } from '../components/FeatureLoadingSplash';
import { useAuth } from '../auth/AuthProvider';
import { PeoplePanel } from '../components/PeoplePanel';
import type { RealPerson } from '../services/realPeopleService';

function getWeekendLabel(): string {
  const now = new Date();
  const dow = now.getDay();
  const sat = new Date(now);
  if (dow === 6) {
    // already Saturday
  } else if (dow === 0) {
    sat.setDate(now.getDate() - 1);
  } else {
    sat.setDate(now.getDate() + (6 - dow));
  }
  const sun = new Date(sat);
  sun.setDate(sat.getDate() + 1);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(sat)}–${fmt(sun)}`;
}

function getTodayLabel(): string {
  return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function buildChips() {
  const weekend = getWeekendLabel();
  const today = getTodayLabel();
  return [
    { label: `Best date night ideas near me`, display: 'Date night ideas', icon: <Heart className="w-3 h-3" /> },
    { label: `Events this weekend (${weekend})`, display: 'Events this weekend', icon: <Ticket className="w-3 h-3" /> },
    { label: `What's happening today (${today})?`, display: "What's on today?", icon: <Compass className="w-3 h-3" /> },
    { label: 'Best places to eat nearby', display: 'Best spots to eat', icon: <Utensils className="w-3 h-3" /> },
    { label: 'Coolest local attractions and hidden gems near me', display: 'Hidden gems & attractions', icon: <Star className="w-3 h-3" /> },
    { label: 'Fun things to do this week', display: 'Fun things this week', icon: <Sparkles className="w-3 h-3" /> },
  ];
}

const QUICK_CHIPS = buildChips();

function PERSON_CHIPS(person: RealPerson) {
  const chips = [
    { label: `Gift ideas for my ${person.relationship} ${person.name} based on their interests`, display: 'Gift ideas', icon: <Gift className="w-3 h-3" /> },
    { label: `Events near ${person.city || 'me'} this week that ${person.name} would love`, display: 'Events they would love', icon: <Ticket className="w-3 h-3" /> },
    { label: `Date ideas near ${person.city || 'me'} for me and ${person.name}`, display: 'Date ideas', icon: <Heart className="w-3 h-3" /> },
    { label: `Best restaurants near ${person.city || 'me'} for someone who loves ${person.favorite_foods?.[0] || 'good food'}`, display: 'Restaurants they would like', icon: <Utensils className="w-3 h-3" /> },
    { label: `Concerts and live music near ${person.city || 'me'} featuring ${person.music_genres?.[0] || 'music they like'}`, display: 'Concerts for them', icon: <Sparkles className="w-3 h-3" /> },
  ];
  return chips;
}

function LocationBadge({
  location,
  onChangeLocation,
}: {
  location: UserLocation | null;
  onChangeLocation: () => void;
}) {
  return (
    <button
      onClick={onChangeLocation}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/6 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all group"
    >
      <MapPin className="w-3 h-3 text-emerald-400 flex-shrink-0" />
      <span className="text-xs font-medium text-white/70 group-hover:text-white transition-colors max-w-[160px] truncate">
        {location ? location.city : 'Set location'}
      </span>
      {location && (
        <span className="text-[10px] text-white/30 group-hover:text-white/50 transition-colors ml-0.5">
          · change
        </span>
      )}
    </button>
  );
}

function CalendarToast({ event, onDismiss }: { event: LocalCalendarEvent; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 bg-emerald-900/90 border border-emerald-500/30 rounded-2xl shadow-xl backdrop-blur-sm max-w-sm w-full mx-4"
    >
      <Calendar className="w-4 h-4 text-emerald-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">{event.title}</p>
        <p className="text-xs text-emerald-300/70">Added to calendar</p>
      </div>
      <button onClick={onDismiss} className="text-white/40 hover:text-white p-1">
        <X className="w-3 h-3" />
      </button>
    </motion.div>
  );
}

function LocationSetupModal({
  onSave,
  onClose,
  current,
}: {
  onSave: (loc: UserLocation) => void;
  onClose: () => void;
  current: UserLocation | null;
}) {
  const [cityInput, setCityInput] = useState(current?.city || '');
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState('');

  const handleDetect = () => {
    if (!navigator.geolocation) {
      setDetectError('Geolocation is not supported by your browser.');
      return;
    }
    setDetecting(true);
    setDetectError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const city = await localExplorerService.reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          onSave({ city, lat: pos.coords.latitude, lng: pos.coords.longitude });
        } catch {
          setDetectError('Could not determine city from your location.');
        } finally {
          setDetecting(false);
        }
      },
      (err) => {
        setDetecting(false);
        if (err.code === err.PERMISSION_DENIED) {
          setDetectError('Location access was denied. Enter your city manually below.');
        } else {
          setDetectError('Could not detect your location. Enter your city manually below.');
        }
      },
      { timeout: 10000 },
    );
  };

  const handleManual = () => {
    const trimmed = cityInput.trim();
    if (!trimmed) return;
    onSave({ city: trimmed });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        className="bg-[#111218] border border-white/10 rounded-2xl p-6 max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
            <MapPin className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold">Set your location</h3>
            <p className="text-white/40 text-xs mt-0.5">Used to find local events, food & news</p>
          </div>
        </div>

        <button
          onClick={handleDetect}
          disabled={detecting}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 hover:border-emerald-500/50 text-emerald-300 rounded-xl text-sm font-medium transition-all disabled:opacity-60 mb-4"
        >
          {detecting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Navigation className="w-4 h-4" />
          )}
          {detecting ? 'Detecting...' : 'Use my current location'}
        </button>

        {detectError && (
          <p className="text-xs text-red-400/80 mb-3 text-center">{detectError}</p>
        )}

        <div className="relative mb-4">
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center">
            <div className="flex-1 h-px bg-white/8" />
            <span className="px-3 text-xs text-white/25 flex-shrink-0">or enter manually</span>
            <div className="flex-1 h-px bg-white/8" />
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleManual()}
            placeholder="Denver, CO"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-white/25 transition-colors"
          />
          <button
            onClick={handleManual}
            disabled={!cityInput.trim()}
            className="px-4 py-2.5 bg-white/8 hover:bg-white/14 border border-white/12 rounded-xl text-white text-sm font-medium transition-all disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function VoicePickerModal({
  onSelect,
  onClose,
}: {
  onSelect: (voice: NaviVoice, remember: boolean) => void;
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
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center mx-auto mb-3">
            <MapPin className="w-6 h-6 text-emerald-400/70" />
          </div>
          <p className="text-white font-bold text-lg tracking-tight">Choose Navi's voice</p>
          <p className="text-white/40 text-sm mt-1">You can change this anytime from the sidebar.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onSelect('masculine', remember)}
            className="group flex flex-col items-center gap-3 p-5 rounded-2xl border border-white/10 hover:border-emerald-400/30 bg-white/4 hover:bg-emerald-500/6 transition-all"
          >
            <div className="w-12 h-12 rounded-xl bg-[#0f1117] border border-white/20 flex items-center justify-center">
              <span className="font-bold text-xl text-white/90 tracking-widest">N</span>
            </div>
            <div>
              <p className="text-white font-semibold text-sm text-center">Masculine</p>
              <p className="text-white/40 text-xs mt-1 text-center leading-snug">Direct. Confident. Gets straight to it.</p>
            </div>
          </button>

          <button
            onClick={() => onSelect('feminine', remember)}
            className="group flex flex-col items-center gap-3 p-5 rounded-2xl border border-white/10 hover:border-emerald-400/40 bg-white/4 hover:bg-emerald-500/8 transition-all"
          >
            <div className="w-12 h-12 rounded-xl bg-[#0e1a13] border border-emerald-500/30 flex items-center justify-center">
              <span className="font-bold text-xl text-emerald-300/90 tracking-widest">N</span>
            </div>
            <div>
              <p className="text-emerald-200 font-semibold text-sm text-center">Feminine</p>
              <p className="text-white/40 text-xs mt-1 text-center leading-snug">Warm. Perceptive. Reads the room.</p>
            </div>
          </button>
        </div>

        <button
          onClick={() => setRemember(r => !r)}
          className="w-full mt-4 flex items-center justify-center gap-2.5 py-2.5 rounded-xl hover:bg-white/4 transition-colors group"
        >
          <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
            remember ? 'bg-white border-white' : 'border-white/25 group-hover:border-white/40'
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

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  meta?: LocalMeta;
  calendarEvent?: LocalCalendarEvent;
}

function SearchedQueriesTag({ meta }: { meta: LocalMeta }) {
  const [expanded, setExpanded] = useState(false);
  const queries = meta.searchQueries || [];

  return (
    <div className="mb-2">
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-1.5 group"
      >
        <Search className="w-3 h-3 text-emerald-400/40 group-hover:text-emerald-400/70 transition-colors" />
        <span className="text-[10px] text-white/30 group-hover:text-white/50 font-medium transition-colors">
          Searched {meta.searchAreaLabel || meta.locationCity}
        </span>
        {queries.length > 0 && (
          <span className="text-[9px] text-white/20 group-hover:text-white/40 transition-colors">
            {expanded ? '▲' : '▼'}
          </span>
        )}
      </button>
      <AnimatePresence>
        {expanded && queries.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-1.5 ml-4 space-y-1 overflow-hidden"
          >
            {queries.map((q, i) => (
              <p key={i} className="text-[10px] text-white/25 font-mono leading-relaxed">
                "{q}"
              </p>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-emerald-600/20 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 mr-2.5 mt-0.5">
          <MapPin className="w-3.5 h-3.5 text-emerald-400" />
        </div>
      )}
      <div className={`max-w-[85%] ${isUser ? 'max-w-[75%]' : ''}`}>
        {isUser ? (
          <div className="px-4 py-2.5 bg-white/8 border border-white/10 rounded-2xl rounded-tr-sm">
            <p className="text-white/90 text-sm leading-relaxed">{msg.content}</p>
          </div>
        ) : (
          <div>
            {msg.meta?.searchPerformed && (
              <SearchedQueriesTag meta={msg.meta} />
            )}
            <div className="text-white/85 text-sm leading-relaxed">
              <FormattedContent content={msg.content} streaming={msg.streaming} />
            </div>
            {msg.calendarEvent && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-3 flex items-center gap-2 px-3 py-2 bg-emerald-900/30 border border-emerald-500/20 rounded-xl"
              >
                <Calendar className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span className="text-xs text-emerald-300 font-medium truncate">{msg.calendarEvent.title}</span>
                <span className="text-xs text-emerald-400/60 ml-auto flex-shrink-0">Added to calendar</span>
              </motion.div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function FormattedContent({ content, streaming }: { content: string; streaming?: boolean }) {
  const lines = content.split('\n');

  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        if (line.startsWith('### ')) return <p key={i} className="font-semibold text-white text-sm mt-2">{line.slice(4)}</p>;
        if (line.startsWith('## ')) return <p key={i} className="font-semibold text-white text-base mt-2">{line.slice(3)}</p>;
        if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
          return <p key={i} className="font-semibold text-white/90 text-sm">{line.slice(2, -2)}</p>;
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={i} className="flex gap-2">
              <span className="text-white/30 mt-0.5 flex-shrink-0">·</span>
              <span className="text-white/80 text-sm leading-relaxed">{renderInline(line.slice(2))}</span>
            </div>
          );
        }
        return <p key={i} className="text-white/80 text-sm leading-relaxed">{renderInline(line)}</p>;
      })}
      {streaming && <span className="inline-block w-1.5 h-3.5 bg-emerald-400/70 rounded-sm animate-pulse ml-0.5" />}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const boldRegex = /\*\*([^*]+)\*\*/g;
  const parts: React.ReactNode[] = [];
  const combined = text.replace(boldRegex, '\x00BOLD\x01$1\x02');
  const segments = combined.split(urlRegex);
  let lastIndex = 0;

  segments.forEach((seg, i) => {
    if (seg.match(/^https?:\/\//)) {
      const domain = (() => {
        try { return new URL(seg).hostname.replace('www.', ''); } catch { return seg.substring(0, 30); }
      })();
      parts.push(
        <a key={i} href={seg} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors"
        >
          {domain}<ExternalLink className="w-2.5 h-2.5" />
        </a>
      );
    } else {
      const boldParts = seg.split('\x00BOLD\x01');
      boldParts.forEach((bp, j) => {
        if (j === 0) {
          if (bp) parts.push(<span key={`${i}-${j}`}>{bp.replace('\x02', '')}</span>);
        } else {
          const [bold, rest] = bp.split('\x02');
          if (bold) parts.push(<strong key={`${i}-${j}-b`} className="text-white font-semibold">{bold}</strong>);
          if (rest) parts.push(<span key={`${i}-${j}-r`}>{rest}</span>);
        }
      });
    }
    lastIndex = i;
  });
  void lastIndex;
  return parts.length > 0 ? parts : text;
}

function ExplorerCanvas({
  conversationId,
  location,
  voice,
  onBack,
  onOpenSidebar,
  selectedPerson,
  onClearPerson,
}: {
  conversationId: string;
  location: UserLocation;
  voice: NaviVoice | null;
  onBack: () => void;
  onOpenSidebar: () => void;
  selectedPerson: RealPerson | null;
  onClearPerson: () => void;
}) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [calendarToast, setCalendarToast] = useState<LocalCalendarEvent | null>(null);
  const [currentAreaLabel, setCurrentAreaLabel] = useState<string>(location.city);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [titleSet, setTitleSet] = useState(false);

  useEffect(() => {
    loadMessages();
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    try {
      setIsLoadingMessages(true);
      const dbMessages = await localExplorerService.getMessages(conversationId);
      setMessages(dbMessages.map(m => ({ id: m.id, role: m.role, content: m.content, meta: undefined })));
      setTitleSet(dbMessages.length > 0);
    } catch (err) {
      console.error('Failed to load messages', err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSend = useCallback(async (text?: string) => {
    const messageText = (text || input).trim();
    if (!messageText || isSending) return;
    setInput('');

    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `assistant-${Date.now()}`;

    setMessages(prev => [
      ...prev,
      { id: userMsgId, role: 'user', content: messageText },
      { id: assistantMsgId, role: 'assistant', content: '', streaming: true },
    ]);

    setIsSending(true);
    const history = messages.slice(-16).map(m => ({ role: m.role, content: m.content }));
    let finalText = '';
    let finalMeta: LocalMeta | undefined;
    let finalCalEvent: LocalCalendarEvent | undefined;

    try {
      await localExplorerService.insertMessage(conversationId, 'user', messageText);

      const result = await localExplorerService.sendMessage(
        conversationId,
        messageText,
        history,
        location,
        user?.email?.split('@')[0],
        (chunk) => {
          finalText += chunk;
          setMessages(prev => prev.map(m =>
            m.id === assistantMsgId ? { ...m, content: m.content + chunk } : m
          ));
        },
        (meta) => {
          finalMeta = meta;
          if (meta.searchAreaLabel) setCurrentAreaLabel(meta.searchAreaLabel);
          setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, meta } : m));
        },
        (calEvent) => {
          finalCalEvent = calEvent;
          setCalendarToast(calEvent);
          setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, calendarEvent: calEvent } : m));
        },
        selectedPerson,
      );

      void result;

      setMessages(prev => prev.map(m =>
        m.id === assistantMsgId ? { ...m, streaming: false } : m
      ));

      await localExplorerService.insertMessage(conversationId, 'assistant', finalText);
      await localExplorerService.touchConversation(conversationId);

      if (!titleSet && finalText) {
        const title = messageText.length > 40 ? messageText.slice(0, 40) + '…' : messageText;
        await localExplorerService.updateConversationTitle(conversationId, title);
        setTitleSet(true);
      }

      void finalMeta;
      void finalCalEvent;
    } catch (err) {
      console.error('Send error', err);
      setMessages(prev => prev.map(m =>
        m.id === assistantMsgId
          ? { ...m, content: 'Something went wrong. Please try again.', streaming: false }
          : m
      ));
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }, [input, isSending, messages, conversationId, location, user, titleSet, selectedPerson]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-white/8 bg-[#08090d]/95 backdrop-blur-xl flex-shrink-0">
        {/* Back / sidebar toggle */}
        <button
          onClick={onOpenSidebar}
          className="p-2 hover:bg-white/8 rounded-lg transition-colors text-white/50 hover:text-white flex-shrink-0"
          title="Show sidebar"
        >
          <PanelLeft className="w-4 h-4" />
        </button>
        <button
          onClick={onBack}
          className="p-2 hover:bg-white/8 rounded-lg transition-colors text-white/50 hover:text-white flex-shrink-0"
          title="Back to lobby"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0 ml-1">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/70 animate-pulse" />
            <span className="text-[10px] text-white/35 font-medium tracking-wide uppercase">Navi</span>
            {voice && (
              <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${
                voice === 'feminine'
                  ? 'text-emerald-300/70 border-emerald-500/20 bg-emerald-500/8'
                  : 'text-white/40 border-white/12 bg-white/4'
              }`}>
                {voice}
              </span>
            )}
          </div>
          <p className="text-xs text-white/40 truncate flex items-center gap-1 mt-0.5">
            <MapPin className="w-2.5 h-2.5 text-emerald-400/60" />
            {currentAreaLabel}
          </p>
        </div>
      </div>

      {/* Person context bar */}
      {selectedPerson && (
        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/8 border-b border-emerald-500/15 flex-shrink-0">
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
            selectedPerson.avatar_color === 'emerald' ? 'bg-emerald-500/20' :
            selectedPerson.avatar_color === 'sky' ? 'bg-sky-500/20' :
            selectedPerson.avatar_color === 'rose' ? 'bg-rose-500/20' :
            selectedPerson.avatar_color === 'amber' ? 'bg-amber-500/20' :
            'bg-emerald-500/20'
          }`}>
            <Heart className="w-3 h-3 text-emerald-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-emerald-200/90 font-medium truncate">
              Shopping for {selectedPerson.name}
            </p>
            <p className="text-[10px] text-emerald-300/50 truncate capitalize">
              {selectedPerson.relationship}{selectedPerson.city ? ` \u00b7 ${selectedPerson.city}${selectedPerson.state ? ', ' + selectedPerson.state : ''}` : ''}
            </p>
          </div>
          <button
            onClick={onClearPerson}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white/70 flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoadingMessages ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-5 h-5 text-white/25 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6 pb-8">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center mb-4">
              <MapPin className="w-8 h-8 text-emerald-400/50" />
            </div>
            <h3 className="text-white/70 font-semibold mb-1.5">What's happening near you?</h3>
            <p className="text-white/35 text-sm max-w-xs leading-relaxed mb-6">
              Date night ideas, local events, hidden gems, food spots — all in one place. No more bouncing between apps.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {(selectedPerson ? PERSON_CHIPS(selectedPerson) : QUICK_CHIPS).map(chip => (
                <button
                  key={chip.label}
                  onClick={() => handleSend(chip.label)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/8 hover:border-white/16 rounded-full text-xs text-white/60 hover:text-white transition-all"
                >
                  {chip.icon}
                  {chip.display}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Quick chips when there are messages */}
      {messages.length > 0 && !isSending && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto scrollbar-none flex-shrink-0">
          {(selectedPerson ? PERSON_CHIPS(selectedPerson) : QUICK_CHIPS).slice(0, 5).map(chip => (
            <button
              key={chip.label}
              onClick={() => handleSend(chip.label)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/4 hover:bg-white/8 border border-white/6 hover:border-white/14 rounded-full text-xs text-white/45 hover:text-white/80 transition-all flex-shrink-0"
            >
              {chip.icon}
              {chip.display}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 pt-2 flex-shrink-0 border-t border-white/6">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={selectedPerson ? `Find something for ${selectedPerson.name}…` : `Ask about ${currentAreaLabel}…`}
            rows={1}
            className="flex-1 bg-white/5 border border-white/10 focus:border-white/22 rounded-2xl px-4 py-3 text-white text-sm placeholder:text-white/25 focus:outline-none transition-colors resize-none leading-relaxed"
            style={{ minHeight: '44px', maxHeight: '120px' }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = Math.min(el.scrollHeight, 120) + 'px';
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isSending}
            className="w-10 h-10 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            ) : (
              <Search className="w-4 h-4 text-white" />
            )}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {calendarToast && (
          <CalendarToast event={calendarToast} onDismiss={() => setCalendarToast(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}

export function LocalExplorerPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const conversationId = searchParams.get('c');

  const [conversations, setConversations] = useState<LocalExplorerConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'chats' | 'people'>('chats');
  const [selectedPerson, setSelectedPerson] = useState<RealPerson | null>(null);
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [defaultVoice, setDefaultVoice] = useState<NaviVoice | null>(null);
  const [defaultVoiceLoaded, setDefaultVoiceLoaded] = useState(false);

  const activeConversation = conversations.find(c => c.id === conversationId) || null;
  const activeVoice = activeConversation?.voice ?? null;

  useEffect(() => {
    Promise.all([loadConversations(), loadLocation(), loadDefaultVoice()]);
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
      const data = await localExplorerService.getConversations();
      setConversations(data);
    } catch (err) {
      console.error('Failed to load conversations', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadLocation = async () => {
    const saved = await localExplorerService.getSavedLocation();
    if (saved) {
      setLocation(saved);
    } else {
      setShowLocationModal(true);
    }
  };

  const loadDefaultVoice = async () => {
    try {
      const saved = await localExplorerService.getDefaultVoice();
      setDefaultVoice(saved);
    } catch {
      // ignore
    } finally {
      setDefaultVoiceLoaded(true);
    }
  };

  const handleSaveLocation = async (loc: UserLocation) => {
    setLocation(loc);
    setShowLocationModal(false);
    await localExplorerService.saveLocation(loc);
  };

  const handleChangeVoice = async (voice: NaviVoice) => {
    if (!conversationId) return;
    try {
      await localExplorerService.updateConversationVoice(conversationId, voice);
      setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, voice } : c));
    } catch (err) {
      console.error('Failed to update voice', err);
    }
  };

  const handleNewConversation = async (voice?: NaviVoice) => {
    if (!location) {
      setShowLocationModal(true);
      return;
    }
    try {
      setIsCreating(true);
      const resolvedVoice = voice ?? defaultVoice ?? undefined;
      const conv = await localExplorerService.createConversation('Local Explorer', location.city, resolvedVoice);
      setConversations(prev => [conv, ...prev]);
      setSearchParams({ c: conv.id });
      setSidebarOpen(false);
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

  const handleVoiceSelect = async (voice: NaviVoice, remember: boolean) => {
    setShowVoicePicker(false);
    if (remember) {
      setDefaultVoice(voice);
      localExplorerService.saveDefaultVoice(voice);
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

  const handleDeleteConversation = async () => {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    setPendingDeleteId(null);
    try {
      await localExplorerService.deleteConversation(id);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (conversationId === id) setSearchParams({});
    } catch (err) {
      console.error('Failed to delete conversation', err);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
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
    return (
      <FeatureLoadingSplash
        icon={MapPin}
        label="Loading Local Explorer..."
        accentColor="#34d399"
        bgColor="#050508"
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#08090d] text-white flex flex-col" style={{ height: '100dvh' }}>
      {!conversationId && (
        <div className="flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-white/8 bg-[#08090d]/95 backdrop-blur-xl flex-shrink-0">
          <button
            onClick={() => navigate('/lobby')}
            className="p-2 hover:bg-white/8 rounded-lg transition-colors text-white/60 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <MapPin className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <span className="font-bold text-white text-lg tracking-tight">Navi</span>
            <div className="flex items-center gap-1.5 -mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/70" />
              <span className="text-[10px] text-white/35 font-medium tracking-wide uppercase">Live search</span>
            </div>
          </div>
          <div className="flex-1" />
          <LocationBadge location={location} onChangeLocation={() => setShowLocationModal(true)} />
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
                  <div className="w-6 h-6 rounded-md bg-emerald-600/20 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-3 h-3 text-emerald-400" />
                  </div>
                  <span className="font-bold text-white text-sm tracking-tight flex-1">Navi</span>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="p-1.5 hover:bg-white/8 rounded-lg transition-colors text-white/40 sm:hidden"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="px-3 py-2 flex-shrink-0 space-y-2">
                <div className="px-1">
                  <LocationBadge location={location} onChangeLocation={() => setShowLocationModal(true)} />
                </div>
                <button
                  onClick={handleNewConversationClick}
                  disabled={isCreating}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/6 hover:bg-white/10 border border-white/10 hover:border-white/18 text-sm font-medium text-white/75 hover:text-white transition-all disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  New search
                </button>
              </div>

              {/* Voice switcher */}
              {conversationId && (
                <div className="px-3 pb-2 flex-shrink-0">
                  <div className="flex items-center justify-between mb-1.5 px-1">
                    <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold">Navi voice</p>
                    {defaultVoice && (
                      <button
                        onClick={() => { setDefaultVoice(null); localExplorerService.saveDefaultVoice(null); }}
                        className="text-[10px] text-white/25 hover:text-white/50 transition-colors"
                      >
                        clear default
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['masculine', 'feminine'] as NaviVoice[]).map(v => {
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
                                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                : 'bg-white/12 border-white/25 text-white'
                              : 'bg-white/4 border-white/8 text-white/45 hover:text-white/70 hover:bg-white/8'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${
                            isActive ? (isFem ? 'bg-emerald-500/30' : 'bg-white/20') : 'bg-white/8'
                          }`}>
                            <span className={`text-[8px] font-bold ${isFem ? 'text-emerald-300' : 'text-white/80'}`}>N</span>
                          </div>
                          <span className="capitalize">{v}</span>
                          <span className="ml-auto flex items-center gap-1 flex-shrink-0">
                            {isDefault && (
                              <span className={`text-[8px] font-semibold ${isFem ? 'text-emerald-400/70' : 'text-white/40'}`}>default</span>
                            )}
                            {isActive && (
                              <span className={`w-1.5 h-1.5 rounded-full ${isFem ? 'bg-emerald-400' : 'bg-emerald-400'}`} />
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tab buttons */}
              <div className="px-3 pt-2 flex-shrink-0">
                <div className="flex gap-1 bg-white/4 rounded-xl p-1 border border-white/6">
                  <button
                    onClick={() => setSidebarTab('chats')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      sidebarTab === 'chats'
                        ? 'bg-white/10 text-white'
                        : 'text-white/40 hover:text-white/70'
                    }`}
                  >
                    <Compass className="w-3.5 h-3.5" />
                    Searches
                  </button>
                  <button
                    onClick={() => setSidebarTab('people')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      sidebarTab === 'people'
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'text-white/40 hover:text-white/70'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    People
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-2 pb-4">
                {sidebarTab === 'people' ? (
                  <PeoplePanel
                    onSelectPerson={(p) => { setSelectedPerson(p); if (p) setSidebarOpen(false); }}
                    selectedPersonId={selectedPerson?.id ?? null}
                    onNavigateToProfile={(id) => {
                      if (id === '__briefs__') navigate('/relationship-briefs');
                      else navigate(`/person/${id}`);
                    }}
                  />
                ) : conversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <Compass className="w-8 h-8 text-white/15 mb-3" />
                    <p className="text-white/35 text-sm">No searches yet</p>
                    <p className="text-white/20 text-xs mt-1">Start exploring your area</p>
                  </div>
                ) : (
                  <div className="space-y-0.5 mt-1">
                    {conversations.map(conv => (
                      <button
                        key={conv.id}
                        onClick={() => { setSearchParams({ c: conv.id }); setSidebarOpen(false); }}
                        className={`group w-full text-left px-3 py-2.5 rounded-xl transition-all relative ${
                          conversationId === conv.id
                            ? 'bg-white/10 border border-white/15'
                            : 'hover:bg-white/6 border border-transparent hover:border-white/8'
                        }`}
                      >
                        <div className="flex items-start gap-2.5 pr-6">
                          <MessageSquare className="w-3.5 h-3.5 text-white/35 mt-0.5 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-white/80 truncate leading-tight">{conv.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {conv.location_snapshot && (
                                <span className="text-[10px] text-emerald-400/50 flex items-center gap-0.5">
                                  <MapPin className="w-2 h-2" />
                                  {conv.location_snapshot}
                                </span>
                              )}
                              {conv.voice && (
                                <span className={`text-[9px] font-medium ${conv.voice === 'feminine' ? 'text-emerald-400/50' : 'text-white/30'}`}>
                                  {conv.voice}
                                </span>
                              )}
                              <span className="text-xs text-white/30 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                {formatDate(conv.updated_at)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setPendingDeleteId(conv.id); }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {conversationId && sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-10 sm:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div className="flex-1 flex flex-col overflow-hidden relative">
          {conversationId && location ? (
            <ExplorerCanvas
              key={conversationId}
              conversationId={conversationId}
              location={location}
              voice={activeVoice}
              onBack={() => navigate('/lobby')}
              onOpenSidebar={() => setSidebarOpen(true)}
              selectedPerson={selectedPerson}
              onClearPerson={() => setSelectedPerson(null)}
            />
          ) : (
            <div className="hidden sm:flex flex-col items-center justify-center h-full text-center px-8">
              <div className="w-20 h-20 rounded-2xl bg-emerald-600/10 border border-emerald-500/15 flex items-center justify-center mb-6">
                <MapPin className="w-9 h-9 text-emerald-400/60" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Navi</h2>
              <p className="text-[10px] font-semibold tracking-[0.2em] text-white/30 uppercase mb-5">
                Your city, right now
              </p>
              <p className="text-white/40 max-w-xs leading-relaxed mb-8">
                Date night ideas, local events, hidden gems, rooftop bars, restaurants — all aggregated in one place. No more bouncing between apps.
              </p>
              {location ? (
                <div className="flex flex-col items-center gap-3">
                  <LocationBadge location={location} onChangeLocation={() => setShowLocationModal(true)} />
                  <button
                    onClick={handleNewConversationClick}
                    disabled={isCreating}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/25 hover:border-emerald-500/50 rounded-2xl text-emerald-300 font-medium transition-all text-sm disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    Start exploring
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowLocationModal(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/25 hover:border-emerald-500/50 rounded-2xl text-emerald-300 font-medium transition-all text-sm"
                >
                  <Navigation className="w-4 h-4" />
                  Set your location
                </button>
              )}
            </div>
          )}
        </div>
      </div>

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
              <p className="text-white font-semibold mb-2">Delete this search?</p>
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

      <AnimatePresence>
        {showLocationModal && (
          <LocationSetupModal
            current={location}
            onSave={handleSaveLocation}
            onClose={() => location && setShowLocationModal(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showVoicePicker && (
          <VoicePickerModal
            onSelect={handleVoiceSelect}
            onClose={handleVoiceSkip}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

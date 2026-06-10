import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, MapPin, RotateCcw, MessageSquarePlus, Calendar, BookOpen, Newspaper, Video } from 'lucide-react';

export type ActiveThread = 'companion' | 'atlas' | 'navi' | 'calendar' | 'co-author' | 'daily-feed' | 'your-lens';

// Threads that are bot conversations (support new/resume)
type BotThread = 'atlas' | 'navi';
// Feature tabs (full-page embeds, just open/close)
type FeatureThread = 'calendar' | 'co-author' | 'daily-feed' | 'your-lens';

interface ThreadTab {
  id: ActiveThread;
  label: string;
  icon: React.ReactNode;
  color: string;
  activeStyle: React.CSSProperties;
  kind: 'companion' | 'bot' | 'feature';
}

interface Props {
  companionName: string;
  activeThread: ActiveThread;
  hasAtlas: boolean;
  hasNavi: boolean;
  openFeatures: FeatureThread[];
  onSwitch: (thread: ActiveThread) => void;
  onClose: (thread: Exclude<ActiveThread, 'companion'>) => void;
  onNewThread?: (thread: BotThread) => void;
}

function ThreadMenu({
  thread,
  label,
  onResume,
  onNew,
  onClose,
}: {
  thread: BotThread;
  label: string;
  onResume: () => void;
  onNew: () => void;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const accentColor = thread === 'atlas' ? 'text-sky-600' : 'text-teal-600';
  const hoverBg = thread === 'atlas' ? 'hover:bg-sky-50' : 'hover:bg-teal-50';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="ml-0.5 flex items-center justify-center w-4 h-4 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
        title="Thread options"
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
          <circle cx="4" cy="1.5" r="1" />
          <circle cx="4" cy="4" r="1" />
          <circle cx="4" cy="6.5" r="1" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.96 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full left-0 mt-1 w-40 bg-white rounded-xl border border-gray-200/80 py-1 z-[200]"
            style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)' }}
          >
            <button
              onClick={() => { onResume(); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium text-gray-700 ${hoverBg} transition-colors`}
            >
              <RotateCcw size={11} className={accentColor} />
              Resume {label}
            </button>
            <button
              onClick={() => { onNew(); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium text-gray-700 ${hoverBg} transition-colors`}
            >
              <MessageSquarePlus size={11} className={accentColor} />
              New conversation
            </button>
            <div className="h-px bg-gray-100 mx-2 my-0.5" />
            <button
              onClick={() => { onClose(); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium text-red-500 hover:bg-red-50 transition-colors"
            >
              <X size={11} />
              Close thread
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ThreadTabBar({
  companionName,
  activeThread,
  hasAtlas,
  hasNavi,
  openFeatures,
  onSwitch,
  onClose,
  onNewThread,
}: Props) {
  const hasAny = hasAtlas || hasNavi || openFeatures.length > 0;
  if (!hasAny) return null;

  const tabs: ThreadTab[] = [
    {
      id: 'companion',
      label: companionName,
      icon: null,
      color: 'text-rose-600',
      activeStyle: { background: 'rgba(244,63,94,0.08)', borderColor: 'rgba(244,63,94,0.25)' },
      kind: 'companion',
    },
    ...(hasAtlas ? [{
      id: 'atlas' as ActiveThread,
      label: 'Atlas',
      icon: <Zap className="w-3 h-3" />,
      color: 'text-sky-600',
      activeStyle: { background: 'rgba(14,165,233,0.08)', borderColor: 'rgba(14,165,233,0.25)' },
      kind: 'bot' as const,
    }] : []),
    ...(hasNavi ? [{
      id: 'navi' as ActiveThread,
      label: 'Navi',
      icon: <MapPin className="w-3 h-3" />,
      color: 'text-teal-600',
      activeStyle: { background: 'rgba(20,184,166,0.08)', borderColor: 'rgba(20,184,166,0.25)' },
      kind: 'bot' as const,
    }] : []),
    ...(openFeatures.includes('calendar') ? [{
      id: 'calendar' as ActiveThread,
      label: 'Calendar',
      icon: <Calendar className="w-3 h-3" />,
      color: 'text-blue-600',
      activeStyle: { background: 'rgba(37,99,235,0.08)', borderColor: 'rgba(37,99,235,0.25)' },
      kind: 'feature' as const,
    }] : []),
    ...(openFeatures.includes('co-author') ? [{
      id: 'co-author' as ActiveThread,
      label: 'Co-Author',
      icon: <BookOpen className="w-3 h-3" />,
      color: 'text-teal-600',
      activeStyle: { background: 'rgba(13,148,136,0.08)', borderColor: 'rgba(13,148,136,0.25)' },
      kind: 'feature' as const,
    }] : []),
    ...(openFeatures.includes('daily-feed') ? [{
      id: 'daily-feed' as ActiveThread,
      label: 'Daily Feed',
      icon: <Newspaper className="w-3 h-3" />,
      color: 'text-sky-600',
      activeStyle: { background: 'rgba(2,132,199,0.08)', borderColor: 'rgba(2,132,199,0.25)' },
      kind: 'feature' as const,
    }] : []),
    ...(openFeatures.includes('your-lens') ? [{
      id: 'your-lens' as ActiveThread,
      label: 'Your Lens',
      icon: <Video className="w-3 h-3" />,
      color: 'text-rose-600',
      activeStyle: { background: 'rgba(225,29,72,0.08)', borderColor: 'rgba(225,29,72,0.25)' },
      kind: 'feature' as const,
    }] : []),
  ];

  return (
    <div
      className="flex items-center gap-1 px-3 py-1.5 flex-shrink-0"
      style={{
        background: 'rgba(255,255,255,0.60)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0,0,0,0.07)',
      }}
    >
      {tabs.map(tab => {
        const isActive = activeThread === tab.id;
        return (
          <motion.div
            key={tab.id}
            className="relative flex items-center"
            initial={false}
          >
            <button
              onClick={() => onSwitch(tab.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all duration-150 ${tab.color} ${
                isActive ? '' : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-100/60'
              }`}
              style={isActive ? { ...tab.activeStyle, border: '1px solid' } : undefined}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {isActive && (
                <motion.div
                  layoutId="thread-indicator"
                  className="absolute -bottom-[9px] left-0 right-0 h-0.5 rounded-full bg-current opacity-60"
                />
              )}
            </button>

            {/* Bot thread menu (resume/new/close) */}
            {tab.kind === 'bot' && (
              <ThreadMenu
                thread={tab.id as BotThread}
                label={tab.label}
                onResume={() => onSwitch(tab.id)}
                onNew={() => onNewThread?.(tab.id as BotThread)}
                onClose={() => onClose(tab.id as Exclude<ActiveThread, 'companion'>)}
              />
            )}

            {/* Feature tab close button */}
            {tab.kind === 'feature' && (
              <button
                onClick={() => onClose(tab.id as Exclude<ActiveThread, 'companion'>)}
                className="ml-0.5 flex items-center justify-center w-4 h-4 rounded text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                title={`Close ${tab.label}`}
              >
                <X size={9} />
              </button>
            )}
          </motion.div>
        );
      })}
      <div className="flex-1" />
      <p className="text-[9px] font-medium text-gray-300 uppercase tracking-widest select-none">tabs</p>
    </div>
  );
}

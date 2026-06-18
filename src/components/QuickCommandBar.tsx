import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export interface QuickCommand {
  id: string;
  label: string;
  sublabel: string;
  prompt: string;
  needsContext?: 'brief' | 'calendar' | 'news';
  accent: string;
  iconChar: string;
  resultMode?: 'news-cards' | 'video-cards';
}

export const QUICK_COMMANDS: QuickCommand[] = [
  {
    id: 'morning-brief',
    label: 'Morning Brief',
    sublabel: 'Your day at a glance',
    prompt: "give me a quick read on what's happening — pull from my calendar and anything real going on in the world right now. tell me what actually matters today, in your own words, no fluff",
    needsContext: 'brief',
    accent: 'amber',
    iconChar: '☀',
  },
  {
    id: 'daily-digest',
    label: 'Daily Digest',
    sublabel: 'Top stories right now',
    prompt: '',
    needsContext: 'news',
    accent: 'sky',
    iconChar: '◎',
    resultMode: 'news-cards',
  },
  {
    id: 'daily-lens',
    label: 'Daily Lens',
    sublabel: '3–5 videos picked for you',
    prompt: '',
    accent: 'rose',
    iconChar: '▶',
    resultMode: 'video-cards',
  },
  {
    id: 'week-ahead',
    label: 'Week Ahead',
    sublabel: "What's coming up",
    prompt: "walk me through my week — what's on my calendar, what should I be thinking about, and what's worth looking forward to or preparing for",
    needsContext: 'calendar',
    accent: 'teal',
    iconChar: '◇',
  },
];

const ACCENT_STYLES: Record<string, { dot: string; text: string; hoverBg: string; activeBg: string; activeBorder: string }> = {
  amber:   { dot: 'bg-amber-400',   text: 'text-amber-600',   hoverBg: 'hover:bg-amber-50',   activeBg: 'bg-amber-50',   activeBorder: 'border-amber-200' },
  sky:     { dot: 'bg-sky-400',     text: 'text-sky-600',     hoverBg: 'hover:bg-sky-50',     activeBg: 'bg-sky-50',     activeBorder: 'border-sky-200' },
  rose:    { dot: 'bg-rose-400',    text: 'text-rose-600',    hoverBg: 'hover:bg-rose-50',    activeBg: 'bg-rose-50',    activeBorder: 'border-rose-200' },
  teal:    { dot: 'bg-teal-400',    text: 'text-teal-600',    hoverBg: 'hover:bg-teal-50',    activeBg: 'bg-teal-50',    activeBorder: 'border-teal-200' },
  emerald: { dot: 'bg-emerald-400', text: 'text-emerald-600', hoverBg: 'hover:bg-emerald-50', activeBg: 'bg-emerald-50', activeBorder: 'border-emerald-200' },
  slate:   { dot: 'bg-slate-400',   text: 'text-slate-500',   hoverBg: 'hover:bg-slate-50',   activeBg: 'bg-slate-50',   activeBorder: 'border-slate-200' },
};

interface QuickCommandsStripProps {
  onCommand: (cmd: QuickCommand) => Promise<void>;
  disabled?: boolean;
}

export function QuickCommandsStrip({ onCommand, disabled }: QuickCommandsStripProps) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleClick = async (cmd: QuickCommand) => {
    if (disabled || loadingId) return;
    setLoadingId(cmd.id);
    try {
      await onCommand(cmd);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="flex flex-col w-full">
      {QUICK_COMMANDS.map(cmd => {
        const styles = ACCENT_STYLES[cmd.accent] ?? ACCENT_STYLES.slate;
        const isLoading = loadingId === cmd.id;
        const isDisabled = !!disabled || (loadingId !== null && !isLoading);

        return (
          <motion.button
            key={cmd.id}
            whileTap={!isDisabled ? { scale: 0.97 } : undefined}
            onClick={() => handleClick(cmd)}
            disabled={isDisabled}
            className={`w-full flex items-center gap-2 px-2 py-1 rounded-lg border text-left transition-all duration-100 ${
              isDisabled
                ? 'opacity-40 cursor-not-allowed border-transparent bg-transparent'
                : `cursor-pointer border-transparent ${styles.hoverBg} hover:border-gray-100`
            }`}
          >
            <div className="flex-shrink-0 w-4 flex items-center justify-center">
              <AnimatePresence mode="wait" initial={false}>
                {isLoading ? (
                  <motion.div key="spin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <Loader2 className={`w-2.5 h-2.5 animate-spin ${styles.text}`} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="dot"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`w-1.5 h-1.5 rounded-full ${styles.dot}`}
                  />
                )}
              </AnimatePresence>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-gray-700 leading-tight truncate">{cmd.label}</p>
              <p className="text-[9.5px] text-gray-400 leading-tight truncate">{cmd.sublabel}</p>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}

interface QuickCommandPopoverProps {
  onCommand: (cmd: QuickCommand) => Promise<void>;
  disabled?: boolean;
}

export function QuickCommandPopover({ onCommand, disabled }: QuickCommandPopoverProps) {
  const [open, setOpen] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleClick = async (cmd: QuickCommand) => {
    if (disabled || loadingId) return;
    setLoadingId(cmd.id);
    try {
      await onCommand(cmd);
    } finally {
      setLoadingId(null);
      setOpen(false);
    }
  };

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
        style={{
          background: open ? 'rgba(251,191,36,0.15)' : 'rgba(0,0,0,0.04)',
          border: `1.5px solid ${open ? 'rgba(251,191,36,0.45)' : 'rgba(0,0,0,0.08)'}`,
        }}
        title="Quick Commands"
      >
        <span className="text-base">⚡</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 mb-2 w-56 rounded-2xl shadow-xl overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(0,0,0,0.08)',
            }}
          >
            <div className="px-3 pt-3 pb-1.5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Quick Commands</p>
            </div>
            <div className="px-1.5 pb-2">
              {QUICK_COMMANDS.map(cmd => {
                const styles = ACCENT_STYLES[cmd.accent] ?? ACCENT_STYLES.slate;
                const isLoading = loadingId === cmd.id;
                const isDisabled = !!disabled || (loadingId !== null && !isLoading);
                return (
                  <button
                    key={cmd.id}
                    onClick={() => handleClick(cmd)}
                    disabled={isDisabled}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all ${
                      isDisabled ? 'opacity-40 cursor-not-allowed' : `cursor-pointer hover:bg-gray-50`
                    }`}
                  >
                    <span className="text-sm flex-shrink-0">{cmd.iconChar}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-gray-700 leading-tight">{cmd.label}</p>
                      <p className="text-[10px] text-gray-400 leading-tight">{cmd.sublabel}</p>
                    </div>
                    {isLoading && <Loader2 className={`w-3 h-3 animate-spin ${styles.text} flex-shrink-0`} />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

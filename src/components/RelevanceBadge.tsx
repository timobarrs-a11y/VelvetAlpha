import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, ChevronDown } from 'lucide-react';
import { Avatar } from './Avatar';
import { companionAvatarConfig } from './lobby/lobbyUtils';
import type { ArticleOpenerMatch } from '../../services/articleOpenerService';
import type { CompanionWithLastMessage } from '../../services/companionService';

interface RelevanceBadgeProps {
  matches: ArticleOpenerMatch[];
  onToggle: () => void;
  expanded: boolean;
}

export function RelevanceBadge({ matches, onToggle, expanded }: RelevanceBadgeProps) {
  if (matches.length === 0) return null;

  const visible = matches.slice(0, 3);
  const overflow = matches.length - visible.length;

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className="flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-sm border border-white/15 pl-1 pr-2 py-0.5 hover:bg-black/80 transition-colors"
      aria-label={`${matches.length} companion${matches.length > 1 ? 's' : ''} matched this article`}
    >
      <div className="flex -space-x-2">
        {visible.map((m, i) => (
          <div
            key={m.companion.id}
            className="w-6 h-6 rounded-full overflow-hidden"
            style={{ border: '2px solid #1a1a2e', zIndex: visible.length - i }}
          >
            <Avatar config={companionAvatarConfig(m.companion)} className="w-full h-full" />
          </div>
        ))}
        {overflow > 0 && (
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white/70 font-bold"
            style={{ background: 'rgba(30,30,50,0.9)', border: '2px solid #1a1a2e' }}
          >
            +{overflow}
          </div>
        )}
      </div>
      <ChevronDown className={`w-3 h-3 text-white/60 transition-transform ${expanded ? 'rotate-180' : ''}`} />
    </button>
  );
}

interface OpenerStripProps {
  matches: ArticleOpenerMatch[];
  onTalkTo: (companion: CompanionWithLastMessage) => void;
}

export function OpenerStrip({ matches, onTalkTo }: OpenerStripProps) {
  return (
    <div className="space-y-2 px-3 pb-3 pt-1">
      {matches.map((m) => (
        <div
          key={m.companion.id}
          className="flex items-start gap-2.5 rounded-xl bg-white/5 border border-white/10 p-2.5"
        >
          <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 mt-0.5">
            <Avatar config={companionAvatarConfig(m.companion)} className="w-full h-full" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/80 leading-snug" style={{ fontFamily: m.companion.font_family ?? undefined }}>
              {m.openerText}
            </p>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onTalkTo(m.companion); }}
              className="flex items-center gap-1 mt-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
            >
              <MessageCircle className="w-3 h-3" />
              Want to talk about it?
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

interface DiscussWithAffordanceProps {
  companions: CompanionWithLastMessage[];
  onPick: (companion: CompanionWithLastMessage) => void;
}

export function DiscussWithAffordance({ companions, onPick }: DiscussWithAffordanceProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, [open]);

  if (companions.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors"
      >
        <MessageCircle className="w-3.5 h-3.5" />
        discuss with
        <span className="text-white/30">→</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute z-20 mt-1 right-0 w-48 rounded-xl bg-black/90 backdrop-blur-md border border-white/15 shadow-xl overflow-hidden max-h-64 overflow-y-auto"
          >
            {companions.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={(e) => { e.stopPropagation(); setOpen(false); onPick(c); }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/10 transition-colors text-left"
              >
                <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0">
                  <Avatar config={companionAvatarConfig(c)} className="w-full h-full" />
                </div>
                <span className="text-xs text-white/80 truncate" style={{ fontFamily: c.font_family ?? undefined }}>
                  {c.custom_name}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

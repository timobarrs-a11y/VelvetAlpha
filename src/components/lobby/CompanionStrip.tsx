import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Heart, Brain, Newspaper, Users, MessageCircle, Trash2 } from 'lucide-react';
import { Avatar } from '../Avatar';
import { companionAvatarConfig, TONE_COLOR } from './lobbyUtils';
import type { CompanionWithLastMessage } from '../../services/companionService';

interface Props {
  companions: CompanionWithLastMessage[];
  onOpen: (companion: CompanionWithLastMessage) => void;
  onAddCompanion: () => void;
  onAddCoach: () => void;
  onDelete?: (companion: CompanionWithLastMessage) => void;
}

function typeIcon(rel: string | null | undefined) {
  if (rel === 'mentor') return <Brain className="w-2.5 h-2.5" />;
  if (rel === 'correspondent') return <Newspaper className="w-2.5 h-2.5" />;
  if (rel === 'romantic') return <Heart className="w-2.5 h-2.5" />;
  return <Users className="w-2.5 h-2.5" />;
}

function typeColor(rel: string | null | undefined) {
  if (rel === 'mentor') return TONE_COLOR.coach;
  if (rel === 'correspondent') return TONE_COLOR.correspondent;
  if (rel === 'romantic') return '#f472b6';
  return '#38bdf8';
}

const LONG_PRESS_MS = 500;

export function CompanionStrip({ companions, onOpen, onAddCompanion, onAddCoach, onDelete }: Props) {
  const [contextCompanion, setContextCompanion] = useState<CompanionWithLastMessage | null>(null);
  const [contextPos, setContextPos] = useState<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  const sorted = [...companions].sort((a, b) => {
    const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return bTime - aTime;
  });

  const hasCoach = companions.some(c => c.relationship_type === 'mentor');

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchStart = (companion: CompanionWithLastMessage, e: React.TouchEvent) => {
    longPressed.current = false;
    const touch = e.touches[0];
    const x = touch.clientX;
    const y = touch.clientY;
    longPressTimer.current = setTimeout(() => {
      longPressed.current = true;
      if (onDelete) {
        setContextCompanion(companion);
        setContextPos({ x, y });
      }
    }, LONG_PRESS_MS);
  };

  const handleTouchEnd = () => {
    clearLongPress();
  };

  const handleContextMenu = (companion: CompanionWithLastMessage, e: React.MouseEvent) => {
    if (!onDelete) return;
    e.preventDefault();
    setContextCompanion(companion);
    setContextPos({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    const handleClickAway = () => {
      setContextCompanion(null);
      setContextPos(null);
    };
    if (contextCompanion) {
      window.addEventListener('click', handleClickAway);
      window.addEventListener('scroll', handleClickAway, true);
      return () => {
        window.removeEventListener('click', handleClickAway);
        window.removeEventListener('scroll', handleClickAway, true);
      };
    }
  }, [contextCompanion]);

  const handleDeleteClick = () => {
    if (contextCompanion && onDelete) {
      onDelete(contextCompanion);
    }
    setContextCompanion(null);
    setContextPos(null);
  };

  return (
    <div className="relative flex items-center gap-2.5 overflow-x-auto scrollbar-hide px-1 py-1">
      {sorted.map((companion, i) => {
        const color = typeColor(companion.relationship_type);
        return (
          <motion.button
            key={companion.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.03, type: 'spring', stiffness: 260, damping: 20 }}
            onClick={() => {
              if (longPressed.current) { longPressed.current = false; return; }
              onOpen(companion);
            }}
            onContextMenu={(e) => handleContextMenu(companion, e)}
            onTouchStart={(e) => handleTouchStart(companion, e)}
            onTouchEnd={handleTouchEnd}
            onTouchMove={clearLongPress}
            className="group flex flex-col items-center gap-1 flex-shrink-0"
            title={companion.custom_name}
          >
            <div className="relative">
              <div
                className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-transparent group-hover:ring-2 transition-all"
                style={{ '--ring-color': color } as React.CSSProperties}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 2px ${color}`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
              >
                <Avatar config={companionAvatarConfig(companion)} className="w-full h-full" />
              </div>
              <span
                className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-white"
                style={{ background: color, border: '2px solid var(--ds-surface-1, #1a1a2e)' }}
              >
                {typeIcon(companion.relationship_type)}
              </span>
              {(companion.unread_count ?? 0) > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
                  style={{ background: '#ef4444', border: '2px solid var(--ds-surface-1, #1a1a2e)' }}
                >
                  {companion.unread_count}
                </span>
              )}
            </div>
            <span
              className="text-[10px] font-medium text-white/70 group-hover:text-white truncate max-w-[56px] text-center transition-colors"
              style={{ fontFamily: companion.font_family ?? undefined }}
            >
              {companion.custom_name}
            </span>
          </motion.button>
        );
      })}

      {/* Add companion */}
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: sorted.length * 0.03, type: 'spring', stiffness: 260, damping: 20 }}
        onClick={onAddCompanion}
        className="group flex flex-col items-center gap-1 flex-shrink-0"
        title="Add a companion"
      >
        <div className="w-12 h-12 rounded-full flex items-center justify-center border-2 border-dashed border-white/20 group-hover:border-white/40 transition-colors">
          <Plus className="w-5 h-5 text-white/40 group-hover:text-white/70 transition-colors" />
        </div>
        <span className="text-[10px] font-medium text-white/40 group-hover:text-white/60 truncate max-w-[56px] text-center transition-colors">
          Add
        </span>
      </motion.button>

      {/* Add coach (only if no coach yet) */}
      {!hasCoach && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: (sorted.length + 1) * 0.03, type: 'spring', stiffness: 260, damping: 20 }}
          onClick={onAddCoach}
          className="group flex flex-col items-center gap-1 flex-shrink-0"
          title="Add a coach"
        >
          <div className="w-12 h-12 rounded-full flex items-center justify-center border-2 border-dashed border-emerald-500/30 group-hover:border-emerald-500/60 transition-colors">
            <Brain className="w-5 h-5 text-emerald-400/50 group-hover:text-emerald-400 transition-colors" />
          </div>
          <span className="text-[10px] font-medium text-emerald-400/50 group-hover:text-emerald-400/80 truncate max-w-[56px] text-center transition-colors">
            Coach
          </span>
        </motion.button>
      )}

      {/* Long-press / right-click context menu */}
      <AnimatePresence>
        {contextCompanion && contextPos && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.12 }}
            className="fixed z-50 rounded-xl overflow-hidden shadow-xl"
            style={{
              left: Math.min(contextPos.x, window.innerWidth - 160),
              top: Math.min(contextPos.y, window.innerHeight - 50),
              background: 'rgba(20, 20, 35, 0.95)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={handleDeleteClick}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-300 hover:bg-red-500/15 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete {contextCompanion.custom_name}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

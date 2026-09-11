import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Brain, Newspaper, Plus, Trash2, Users } from 'lucide-react';
import { Avatar } from '../Avatar';
import { companionAvatarConfig } from './lobbyUtils';
import type { CompanionWithLastMessage } from '../../services/companionService';

type Category = 'companions' | 'coaching' | 'correspondents';

interface CategoryConfig {
  key: Category;
  label: string;
  icon: React.ReactNode;
  color: string;
  matchTypes: string[];
}

const CATEGORIES: CategoryConfig[] = [
  { key: 'companions',    label: 'Companions',    icon: <Heart className="w-3 h-3" />,      color: '#f472b6', matchTypes: ['romantic', 'friend', null] },
  { key: 'coaching',      label: 'Coaching',      icon: <Brain className="w-3 h-3" />,       color: '#34d399', matchTypes: ['mentor'] },
  { key: 'correspondents', label: 'Correspondents', icon: <Newspaper className="w-3 h-3" />, color: '#fbbf24', matchTypes: ['correspondent'] },
];

interface Props {
  companions: CompanionWithLastMessage[];
  onOpen: (companion: CompanionWithLastMessage) => void;
  onAddCompanion: () => void;
  onAddCoach: () => void;
  onDelete?: (companion: CompanionWithLastMessage) => void;
}

const LONG_PRESS_MS = 500;

export function CompanionTabs({ companions, onOpen, onAddCompanion, onAddCoach, onDelete }: Props) {
  const [activeCategory, setActiveCategory] = useState<Category>('companions');
  const [contextCompanion, setContextCompanion] = useState<CompanionWithLastMessage | null>(null);
  const [contextPos, setContextPos] = useState<{ x: number; y: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  const filterByCategory = (cat: CategoryConfig) =>
    companions.filter(c => cat.matchTypes.includes(c.relationship_type ?? null));

  const sorted = (list: CompanionWithLastMessage[]) =>
    [...list].sort((a, b) => {
      const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return bTime - aTime;
    });

  const activeConfig = CATEGORIES.find(c => c.key === activeCategory)!;
  const activeList = sorted(filterByCategory(activeConfig));
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
    longPressTimer.current = setTimeout(() => {
      longPressed.current = true;
      if (onDelete) {
        setContextCompanion(companion);
        setContextPos({ x: touch.clientX, y: touch.clientY });
      }
    }, LONG_PRESS_MS);
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
    if (contextCompanion && onDelete) onDelete(contextCompanion);
    setContextCompanion(null);
    setContextPos(null);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Tab bar */}
      <div className="flex items-center gap-1.5">
        {CATEGORIES.map(cat => {
          const count = filterByCategory(cat).length;
          const isActive = activeCategory === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-200 ${
                isActive
                  ? 'text-white'
                  : 'text-white/50 hover:text-white/70'
              }`}
              style={{
                background: isActive ? `${cat.color}22` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isActive ? cat.color + '66' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              <span style={{ color: cat.color }} className="flex items-center">{cat.icon}</span>
              <span>{cat.label}</span>
              {count > 0 && (
                <span
                  className="ml-0.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center"
                  style={{ background: isActive ? cat.color + '44' : 'rgba(255,255,255,0.08)', color: isActive ? cat.color : 'rgba(255,255,255,0.4)' }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Expanded category content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeCategory}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
          className="overflow-hidden"
        >
          <div className="flex items-center gap-2.5 overflow-x-auto scrollbar-hide px-1 py-0.5">
            {activeList.length === 0 && (
              <EmptyCategory
                category={activeCategory}
                color={activeConfig.color}
                onAdd={
                  activeCategory === 'coaching'
                    ? onAddCoach
                    : onAddCompanion
                }
                hasCoach={hasCoach}
              />
            )}

            {activeList.map((companion, i) => (
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
                onTouchEnd={clearLongPress}
                onTouchMove={clearLongPress}
                className="group flex flex-col items-center gap-1 flex-shrink-0"
                title={companion.custom_name}
              >
                <div className="relative">
                  <div
                    className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-transparent group-hover:ring-2 transition-all"
                    style={{ '--ring-color': activeConfig.color } as React.CSSProperties}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 2px ${activeConfig.color}`; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                  >
                    <Avatar config={companionAvatarConfig(companion)} className="w-full h-full" />
                  </div>
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
                  className="text-[10px] font-medium text-white/70 group-hover:text-white truncate max-w-[52px] text-center transition-colors"
                  style={{ fontFamily: companion.font_family ?? undefined }}
                >
                  {companion.custom_name}
                </span>
              </motion.button>
            ))}

            {/* Add button inside the active category */}
            {activeList.length > 0 && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: activeList.length * 0.03, type: 'spring', stiffness: 260, damping: 20 }}
                onClick={activeCategory === 'coaching' ? onAddCoach : onAddCompanion}
                className="group flex flex-col items-center gap-1 flex-shrink-0"
                title={activeCategory === 'coaching' ? 'Add a coach' : 'Add a companion'}
              >
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center border-2 border-dashed transition-colors"
                  style={{ borderColor: `${activeConfig.color}40` }}
                >
                  <Plus className="w-4 h-4 transition-colors" style={{ color: `${activeConfig.color}80` }} />
                </div>
                <span className="text-[10px] font-medium truncate max-w-[52px] text-center" style={{ color: `${activeConfig.color}99` }}>
                  Add
                </span>
              </motion.button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

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

function EmptyCategory({ category, color, onAdd, hasCoach }: { category: Category; color: string; onAdd: () => void; hasCoach: boolean }) {
  if (category === 'coaching' && hasCoach) return null;
  const label = category === 'coaching' ? 'coach' : category === 'correspondents' ? 'correspondent' : 'companion';
  return (
    <button
      onClick={onAdd}
      className="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-medium transition-colors hover:bg-white/5"
      style={{ color: `${color}99` }}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center border-2 border-dashed"
        style={{ borderColor: `${color}40` }}
      >
        <Plus className="w-4 h-4" style={{ color: `${color}80` }} />
      </div>
      <span>Add your first {label}</span>
    </button>
  );
}

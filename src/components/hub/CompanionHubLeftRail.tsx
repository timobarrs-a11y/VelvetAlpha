import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  ArrowLeft,
  Zap,
  MapPin,
  Newspaper,
  Video,
  BookOpen,
  Calendar,
  BarChart2,
  Gamepad2,
  Sparkles,
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Heart,
} from 'lucide-react';
import { TutorialElement } from './TutorialElement';
import { ONBOARDING_ELEMENT_IDS } from '../../features/onboarding/onboardingPrompt';
import { useTutorialDirector } from '../../context/TutorialDirectorContext';
import { onboardingService } from '../../services/onboardingService';


interface GameDef {
  emoji: string; name: string; desc: string; path: string;
}

const ARCADE_GAMES: GameDef[] = [
  { emoji: '🎯', name: 'Checkers',      desc: 'Classic board game',       path: '/checkers' },
  { emoji: '💰', name: 'Money Game',    desc: 'Collect coins',            path: '/pacman' },
  { emoji: '⚡', name: 'Momentum',      desc: 'AI-themed platformer',     path: '/momentum' },
  { emoji: '⚽', name: 'Slime Soccer',  desc: 'Classic slime showdown',   path: '/slime-soccer' },
  { emoji: '🌟', name: 'Stellar',       desc: 'Trivia across the galaxy', path: '/stellar-pursuit' },
  { emoji: '🧠', name: 'Social Combat', desc: 'Master the art of conversation', path: '/social-combat' },
];

type PanelResult = { type: 'games'; items: GameDef[] };

interface Props {
  disabled?: boolean;
  userId?: string;
  companionId?: string;
  collapsed?: boolean;
  translucent?: boolean;
  onToggleCollapse?: () => void;
}

interface ShortcutDef {
  id: string;
  elementId: string;
  label: string;
  sub: string;
  icon: React.ReactNode;
  route: string;
  color: string;
  group: 'connect' | 'content' | 'life' | 'play' | 'other';
}



function buildShortcuts(): ShortcutDef[] {
  return [
    { id: 'atlas',      elementId: ONBOARDING_ELEMENT_IDS.atlas,      label: 'Atlas',      sub: 'Chief of staff',    icon: <Zap className="w-3.5 h-3.5" />,        route: '/chat?bot=atlas', color: 'text-amber-600',   group: 'connect' },
    { id: 'navi',       elementId: ONBOARDING_ELEMENT_IDS.navi,       label: 'Navi',       sub: 'Local concierge',   icon: <MapPin className="w-3.5 h-3.5" />,     route: '/local-explorer', color: 'text-emerald-600', group: 'connect' },
    { id: 'daily_feed', elementId: ONBOARDING_ELEMENT_IDS.dailyFeed,  label: 'Daily Feed', sub: 'Curated stories',   icon: <Newspaper className="w-3.5 h-3.5" />,  route: 'tab:daily-feed',  color: 'text-sky-600',     group: 'content' },
    { id: 'your_lens',  elementId: ONBOARDING_ELEMENT_IDS.yourLens,   label: 'Your Lens',  sub: 'Picked videos',     icon: <Video className="w-3.5 h-3.5" />,      route: 'tab:your-lens',   color: 'text-rose-600',    group: 'content' },
    { id: 'co_author',  elementId: ONBOARDING_ELEMENT_IDS.coAuthor,   label: 'Co-Author',  sub: 'Write together',    icon: <BookOpen className="w-3.5 h-3.5" />,   route: 'tab:co-author',   color: 'text-teal-600',    group: 'content' },
    { id: 'calendar',   elementId: ONBOARDING_ELEMENT_IDS.calendar,   label: 'Calendar',   sub: 'Life organized',    icon: <Calendar className="w-3.5 h-3.5" />,   route: 'tab:calendar',    color: 'text-blue-600',    group: 'life' },
    { id: 'insights',   elementId: ONBOARDING_ELEMENT_IDS.insights,   label: 'Insights',   sub: 'Know yourself',     icon: <BarChart2 className="w-3.5 h-3.5" />,  route: 'thread:insights',  color: 'text-emerald-600', group: 'life' },
    { id: 'briefs',     elementId: '',                                 label: 'Briefs',     sub: 'People you care about', icon: <Heart className="w-3.5 h-3.5" />,  route: '/relationship-briefs', color: 'text-rose-500',   group: 'life' },
    { id: 'games',      elementId: ONBOARDING_ELEMENT_IDS.games,      label: 'The Arcade', sub: 'Play together',     icon: <Gamepad2 className="w-3.5 h-3.5" />,   route: '/lobby#games',    color: 'text-orange-600',  group: 'play' },
    { id: 'velvet_rope',elementId: ONBOARDING_ELEMENT_IDS.velvetRope, label: 'Velvet Rope',sub: 'Real or not?',      icon: <Sparkles className="w-3.5 h-3.5" />,   route: '/real-or-not',    color: 'text-pink-600',    group: 'play' },
    { id: 'lobby',      elementId: ONBOARDING_ELEMENT_IDS.lobby,      label: 'Lobby',      sub: 'Classic hub',       icon: <LayoutGrid className="w-3.5 h-3.5" />, route: '/lobby',          color: 'text-slate-500',   group: 'other' },
  ];
}

const GROUP_LABELS: Record<ShortcutDef['group'], string> = {
  connect: 'Connect',
  content: 'Content',
  life: 'Life',
  play: 'Play',
  other: 'More',
};

function ShortcutTile({ s, onShortcut }: { s: ShortcutDef; onShortcut: (s: ShortcutDef) => void }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <TutorialElement
      elementId={s.elementId}
      as="button"
      onClick={() => onShortcut(s)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-left transition-colors duration-150"
      style={{
        background: hovered ? 'rgba(255,255,255,0.95)' : 'transparent',
        boxShadow: hovered && !pressed ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
        transform: pressed ? 'scale(0.97)' : 'scale(1)',
        transition: 'background 0.15s, box-shadow 0.15s, transform 0.1s',
      }}
    >
      <span
        className={`flex items-center justify-center w-7 h-7 rounded-xl flex-shrink-0 ${s.color}`}
        style={{
          background: 'white',
          boxShadow: pressed
            ? '0 1px 2px rgba(0,0,0,0.08), inset 0 1px 2px rgba(0,0,0,0.04)'
            : hovered
            ? '0 4px 10px rgba(0,0,0,0.13), 0 1px 3px rgba(0,0,0,0.08)'
            : '0 2px 5px rgba(0,0,0,0.10), 0 1px 2px rgba(0,0,0,0.06)',
          transition: 'box-shadow 0.15s, transform 0.1s',
          transform: pressed ? 'translateY(1px)' : hovered ? 'translateY(-1px)' : 'translateY(0)',
        }}
      >
        {s.icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[11.5px] font-semibold text-gray-700 truncate leading-tight">{s.label}</span>
        <span
          className="block text-[9.5px] truncate leading-tight"
          style={{ color: 'rgba(100,100,110,0.85)', textShadow: '0 0 8px rgba(255,255,255,0.6)' }}
        >{s.sub}</span>
      </span>
    </TutorialElement>
  );
}

export function CompanionHubLeftRail({ disabled: _disabled, userId, companionId, collapsed = false, translucent = false, onToggleCollapse }: Props) {
  const navigate = useNavigate();
  const { startTour } = useTutorialDirector();
  const [activePanel, setActivePanel] = useState<PanelResult | null>(null);
  const [panelLoading] = useState(false);
  const [panelLabel, setPanelLabel] = useState('');

  const handleReplayTour = () => {
    if (userId) onboardingService.restartTour(userId, 'manual_replay').catch(() => {});
    startTour('manual_replay');
  };

  const handleShortcut = (s: ShortcutDef) => {
    if (s.id === 'games') {
      setActivePanel({ type: 'games', items: ARCADE_GAMES });
      setPanelLabel('The Arcade');
      return;
    }
    if (s.route.startsWith('/chat?bot=')) {
      const target = s.route.includes('atlas') ? 'atlas' : 'navi';
      window.dispatchEvent(new CustomEvent('hub:open-bot', { detail: { bot: target } }));
      return;
    }
    if (s.route.startsWith('tab:')) {
      const tab = s.route.replace('tab:', '');
      window.dispatchEvent(new CustomEvent('hub:open-tab', { detail: { tab } }));
      return;
    }
    if (s.route.startsWith('thread:')) {
      const context = s.route.replace('thread:', '') as 'insights';
      window.dispatchEvent(new CustomEvent('hub:open-thread', { detail: { context } }));
      return;
    }
    const routeWithCompanion = companionId && !s.route.includes('companion=')
      ? `${s.route}${s.route.includes('?') ? '&' : '?'}companion=${companionId}`
      : s.route;
    navigate(routeWithCompanion);
  };

  const shortcuts = buildShortcuts();
  const grouped = shortcuts.reduce<Record<ShortcutDef['group'], ShortcutDef[]>>(
    (acc, s) => { (acc[s.group] ||= []).push(s); return acc; },
    { connect: [], content: [], life: [], play: [], other: [] },
  );

  const bgStyle = translucent
    ? { background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(209,213,219,0.15)' }
    : { background: 'rgba(255,255,255,0.70)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' };

  // Collapsed: just a slim strip with a toggle button
  if (collapsed) {
    return (
      <motion.div
        key="collapsed"
        initial={{ width: 224 }}
        animate={{ width: 32 }}
        exit={{ width: 224 }}
        transition={{ duration: 0.22, ease: 'easeInOut' }}
        className="relative flex-shrink-0 h-full border-r border-gray-200/60 flex flex-col items-center pt-3 overflow-hidden"
        style={{ ...bgStyle, width: 32 }}
      >
        <button
          data-tour-id="tour-sidebar-toggle"
          onClick={onToggleCollapse}
          title="Expand sidebar"
          className="flex items-center justify-center w-6 h-6 rounded-lg hover:bg-gray-100/80 transition-colors text-gray-400 hover:text-gray-600"
        >
          <PanelLeftOpen className="w-3.5 h-3.5" />
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      key="expanded"
      data-tour-id="tour-left-rail"
      initial={{ width: 32 }}
      animate={{ width: 224 }}
      exit={{ width: 32 }}
      transition={{ duration: 0.22, ease: 'easeInOut' }}
      className="relative flex-shrink-0 h-full border-r border-gray-200/60 flex flex-col overflow-hidden"
      style={{ ...bgStyle, width: 224 }}
    >
      <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-gray-100/80 flex-shrink-0">
        {activePanel ? (
          <>
            <button
              onClick={() => setActivePanel(null)}
              className="flex items-center justify-center w-5 h-5 rounded hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-3 h-3 text-gray-400" />
            </button>
            <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 truncate flex-1 ml-2">
              {panelLabel}
            </p>
          </>
        ) : (
          <p className="text-[10px] font-bold tracking-widest uppercase text-gray-400 select-none flex-1">
            Your World
          </p>
        )}
        {onToggleCollapse && !activePanel && (
          <button
            data-tour-id="tour-sidebar-toggle"
            onClick={onToggleCollapse}
            title="Collapse sidebar"
            className="flex items-center justify-center w-5 h-5 rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 flex-shrink-0"
          >
            <PanelLeftClose className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {panelLoading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
          </motion.div>
        ) : activePanel ? (
          <motion.div key="panel" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.18 }}
            className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-2 flex flex-col gap-2">
            {activePanel.type === 'games' && activePanel.items.map(g => (
              <button
                key={g.name}
                onClick={() => {
                  const path = companionId ? `${g.path}?companion=${companionId}` : g.path;
                  navigate(path);
                }}
                className="group w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-xl border border-gray-100 bg-white/80 hover:bg-white hover:border-gray-200 hover:shadow-sm transition-all duration-150"
              >
                <span className="text-lg leading-none group-hover:scale-110 transition-transform flex-shrink-0">{g.emoji}</span>
                <div className="min-w-0">
                  <p className="text-[11.5px] font-semibold text-gray-800 group-hover:text-orange-600 transition-colors truncate">{g.name}</p>
                  <p className="text-[9.5px] truncate" style={{ color: 'rgba(100,100,110,0.85)' }}>{g.desc}</p>
                </div>
              </button>
            ))}
          </motion.div>
        ) : (
          <motion.div key="main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-2 flex flex-col gap-3">

            {(['connect', 'content', 'life', 'play', 'other'] as const).map(groupKey => (
              <div key={groupKey} className="flex flex-col gap-0.5">
                <p className="text-[9px] font-bold tracking-widest uppercase text-gray-400/80 px-2 pt-1 pb-1 select-none">
                  {GROUP_LABELS[groupKey]}
                </p>
                {grouped[groupKey].map(s => (
                  <ShortcutTile key={s.id} s={s} onShortcut={handleShortcut} />
                ))}
              </div>
            ))}

          </motion.div>
        )}
      </AnimatePresence>

      {/* Replay the tour — pinned footer */}
      <div className="flex-shrink-0 border-t border-gray-100/80 px-2 py-2">
        <button
          onClick={handleReplayTour}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-left transition-colors hover:bg-gray-100/80"
        >
          <span
            className="flex items-center justify-center w-7 h-7 rounded-xl flex-shrink-0"
            style={{ background: 'white', boxShadow: '0 2px 5px rgba(0,0,0,0.08)' }}
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[11.5px] font-semibold text-gray-600 leading-tight">Replay the tour</span>
            <span className="block text-[9.5px] text-gray-400 leading-tight">See the hub intro again</span>
          </span>
        </button>
      </div>
    </motion.div>
  );
}

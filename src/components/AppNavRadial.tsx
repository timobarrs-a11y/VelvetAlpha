import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutGrid,
  BookOpen,
  Newspaper,
  BarChart2,
  User,
  X,
  Gamepad2,
} from 'lucide-react';
import { setAppBridgeContext } from '../services/appBridgeStore';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  route: string;
  color: string;
  angle: number;
}

interface AppNavRadialProps {
  companionId?: string;
  currentApp?: 'chat' | 'atlas' | 'co-author' | 'calendar' | 'feed' | 'insights' | 'local-explorer';
  seedText?: string;
  theme?: 'light' | 'dark';
}

const NAV_ITEMS: Omit<NavItem, 'angle'>[] = [
  { label: 'Lobby',      icon: <LayoutGrid className="w-4 h-4" />,   route: '/lobby',      color: 'bg-slate-500 hover:bg-slate-400' },
  { label: 'Co-Author',  icon: <BookOpen className="w-4 h-4" />,     route: '/co-author',  color: 'bg-teal-600 hover:bg-teal-500' },
  { label: 'Daily Feed', icon: <Newspaper className="w-4 h-4" />,    route: '/daily-feed', color: 'bg-rose-500 hover:bg-rose-400' },
  { label: 'Insights',   icon: <BarChart2 className="w-4 h-4" />,    route: '/insights',   color: 'bg-emerald-600 hover:bg-emerald-500' },
  { label: 'Games',      icon: <Gamepad2 className="w-4 h-4" />,     route: '/lobby#games',color: 'bg-orange-500 hover:bg-orange-400' },
  { label: 'Profile',    icon: <User className="w-4 h-4" />,         route: '/profile',    color: 'bg-gray-500 hover:bg-gray-400' },
];

const RADIUS = 108;

function getAngle(index: number, total: number): number {
  if (total === 1) return -90;
  const spread = 180;
  const startAngle = -90 - spread / 2;
  return startAngle + index * (spread / (total - 1));
}

function angleToXY(angleDeg: number, r: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: Math.cos(rad) * r, y: Math.sin(rad) * r };
}

export function AppNavRadial({ companionId, currentApp, seedText, theme = 'light' }: AppNavRadialProps) {
  const [open, setOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredItems = NAV_ITEMS.filter(item => {
    if (currentApp === 'co-author' && item.route === '/co-author') return false;
    if (currentApp === 'feed' && item.route === '/daily-feed') return false;
    if (currentApp === 'insights' && item.route === '/insights') return false;
    return true;
  });

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleNavigate = (item: Omit<NavItem, 'angle'>) => {
    if (seedText) {
      setAppBridgeContext({
        sourceApp: currentApp || 'chat',
        topic: seedText.slice(0, 120),
        seedText,
        companionId,
      });
    }

    let route = item.route;
    if (item.route === '/lobby' && companionId) {
      route = '/lobby';
    }

    setOpen(false);
    navigate(route);
  };

  const isDark = theme === 'dark';
  const triggerBase = isDark
    ? 'bg-white/10 hover:bg-white/20 border-white/20 text-white/70 hover:text-white'
    : 'bg-white/90 hover:bg-white border-gray-200 text-gray-500 hover:text-gray-800 shadow-sm';

  return (
    <div ref={containerRef} className="relative flex items-center justify-center">
      <AnimatePresence>
        {open && filteredItems.map((item, i) => {
          const angle = getAngle(i, filteredItems.length);
          const { x, y } = angleToXY(angle, RADIUS);
          const isHovered = hoveredIndex === i;

          return (
            <motion.div
              key={item.route}
              initial={{ opacity: 0, x: 0, y: 0, scale: 0.5 }}
              animate={{ opacity: 1, x, y: y - 4, scale: 1 }}
              exit={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
              transition={{
                type: 'spring',
                stiffness: 400,
                damping: 28,
                delay: i * 0.04,
              }}
              className="absolute bottom-0 left-1/2 -translate-x-1/2"
              style={{ zIndex: 50 + i }}
            >
              <div className="relative flex flex-col items-center">
                <AnimatePresence>
                  {isHovered && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap"
                    >
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-black/80 text-white backdrop-blur-sm">
                        {item.label}
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
                <button
                  onClick={() => handleNavigate(item)}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-150 ${item.color} ${isHovered ? 'scale-110' : 'scale-100'}`}
                >
                  {item.icon}
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      <motion.button
        onClick={() => setOpen(v => !v)}
        whileTap={{ scale: 0.9 }}
        className={`relative z-60 w-8 h-8 rounded-full border flex items-center justify-center transition-all duration-200 ${triggerBase}`}
        title="Navigate to another app"
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.span
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X className="w-3.5 h-3.5" />
            </motion.span>
          ) : (
            <motion.span
              key="grid"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}

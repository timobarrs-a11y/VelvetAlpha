import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bot,
  Zap,
  MapPin,
  CalendarDays,
  ChevronDown,
} from 'lucide-react';

export type ThreadMode =
  | 'chat'
  | 'atlas-prompt'
  | 'atlas-full'
  | 'navi-prompt'
  | 'navi-full'
  | 'calendar';

interface ThreadToolbarProps {
  activeMode: ThreadMode;
  onModeChange: (mode: ThreadMode) => void;
  companionId?: string;
  currentTier: string;
}

interface ToolbarButton {
  mode: ThreadMode;
  icon: React.ReactNode;
  label: string;
  description: string;
  color: string;
  activeColor: string;
  premium?: boolean;
}

const TOOLBAR_BUTTONS: ToolbarButton[] = [
  {
    mode: 'atlas-prompt',
    icon: <Zap className="w-4 h-4" />,
    label: 'Atlas',
    description: 'Ask Atlas once',
    color: 'text-sky-500 hover:text-sky-600',
    activeColor: 'text-sky-600 bg-sky-50 border-sky-200',
  },
  {
    mode: 'atlas-full',
    icon: <Bot className="w-4 h-4" />,
    label: 'Atlas+',
    description: 'Full Atlas session',
    color: 'text-sky-600 hover:text-sky-700',
    activeColor: 'text-sky-700 bg-sky-100 border-sky-300',
    premium: true,
  },
  {
    mode: 'navi-prompt',
    icon: <Zap className="w-3.5 h-3.5" />,
    label: 'Navi',
    description: 'Ask Navi once',
    color: 'text-teal-500 hover:text-teal-600',
    activeColor: 'text-teal-600 bg-teal-50 border-teal-200',
  },
  {
    mode: 'navi-full',
    icon: <MapPin className="w-4 h-4" />,
    label: 'Navi+',
    description: 'Full Navi session',
    color: 'text-teal-600 hover:text-teal-700',
    activeColor: 'text-teal-700 bg-teal-100 border-teal-300',
    premium: true,
  },
  {
    mode: 'calendar',
    icon: <CalendarDays className="w-4 h-4" />,
    label: 'Calendar',
    description: 'View your calendar',
    color: 'text-amber-500 hover:text-amber-600',
    activeColor: 'text-amber-600 bg-amber-50 border-amber-200',
  },
];

export function ThreadToolbar({
  activeMode,
  onModeChange,
  currentTier,
}: ThreadToolbarProps) {
  const isPremium = currentTier !== 'free';

  const handleModeClick = (mode: ThreadMode) => {
    const btn = TOOLBAR_BUTTONS.find(b => b.mode === mode);
    if (btn?.premium && !isPremium) return;
    onModeChange(activeMode === mode ? 'chat' : mode);
  };

  return (
    <div className="flex items-center gap-1">
      {TOOLBAR_BUTTONS.map((btn) => {
        const isActive = activeMode === btn.mode;
        const isLocked = btn.premium && !isPremium;

        return (
          <div key={btn.mode} className="relative group">
            <motion.button
              whileTap={!isLocked ? { scale: 0.9 } : undefined}
              onClick={() => handleModeClick(btn.mode)}
              title={btn.description}
              className={`relative flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all duration-200 ${
                isActive
                  ? `${btn.activeColor} border shadow-sm`
                  : isLocked
                  ? 'text-gray-300 border-gray-100 cursor-not-allowed'
                  : `${btn.color} border-transparent hover:bg-gray-50 hover:border-gray-200`
              }`}
            >
              {btn.icon}
              <span className="hidden sm:inline">{btn.label}</span>
              {btn.premium && !isPremium && (
                <span className="text-[8px] font-bold text-amber-500 uppercase tracking-wide leading-none">
                  Pro
                </span>
              )}
              {isActive && (
                <motion.div
                  layoutId="toolbar-active"
                  className="absolute inset-0 rounded-xl bg-current opacity-5"
                />
              )}
            </motion.button>

            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-50">
              <div className="bg-gray-900 text-white text-[10px] font-medium px-2 py-1 rounded-lg whitespace-nowrap shadow-lg">
                {isLocked ? 'Premium feature' : btn.description}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface BotIndicatorProps {
  botName: string;
  action: 'joined' | 'left';
  color: string;
}

export function BotIndicator({ botName, action, color }: BotIndicatorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex items-center justify-center py-2"
    >
      <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-medium ${color}`}>
        <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
        <span>⬡ {botName} has {action} the conversation</span>
      </div>
    </motion.div>
  );
}

interface BotPromptDrawerProps {
  botName: string;
  placeholder: string;
  accentClass: string;
  onSubmit: (text: string) => void;
  onClose: () => void;
  isLoading: boolean;
}

export function BotPromptDrawer({
  botName,
  placeholder,
  accentClass,
  onSubmit,
  onClose,
  isLoading,
}: BotPromptDrawerProps) {
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() && !isLoading) {
      onSubmit(value.trim());
      setValue('');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.2 }}
      className="border-t border-gray-200/60 bg-white/95 backdrop-blur-xl px-3 py-3"
    >
      <div className="max-w-3xl mx-auto">
        <div className={`flex items-center gap-2 mb-2 text-xs font-semibold ${accentClass}`}>
          <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          Ask {botName} — one response, then it exits
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            autoFocus
            disabled={isLoading}
            className={`flex-1 px-4 py-2.5 rounded-xl border-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none transition-all ${
              accentClass.includes('sky')
                ? 'border-sky-200 focus:border-sky-400 focus:ring-2 focus:ring-sky-50'
                : 'border-teal-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-50'
            } disabled:bg-gray-50`}
          />
          <button
            type="submit"
            disabled={!value.trim() || isLoading}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              accentClass.includes('sky')
                ? 'bg-sky-500 hover:bg-sky-600'
                : 'bg-teal-500 hover:bg-teal-600'
            }`}
          >
            {isLoading ? '...' : 'Ask'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </form>
      </div>
    </motion.div>
  );
}

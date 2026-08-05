import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Clock, Target, ChevronRight, Zap } from 'lucide-react';
import { BriefReadiness } from '../features/thread/useThreadBots';
import type { BriefGap } from '../services/morningBriefService';

interface Props {
  readiness: BriefReadiness | null;
  onClose: () => void;
  onSetupSchedule: () => void;
  onOpenCalendar: () => void;
  onAddGoal: () => void;
  onRunAnyway: () => void;
}

const GAP_CONFIG: Record<BriefGap, {
  icon: React.ReactNode;
  title: string;
  desc: string;
  action: string;
  key: BriefGap;
}> = {
  calendar: {
    icon: <Calendar className="w-4 h-4" />,
    title: 'No upcoming events',
    desc: 'Add a few things to your calendar so the brief knows what\'s coming up.',
    action: 'Open Calendar',
    key: 'calendar',
  },
  schedule: {
    icon: <Clock className="w-4 h-4" />,
    title: 'Work schedule unknown',
    desc: 'A quick 3-tap setup lets the brief know your daily rhythm.',
    action: 'Set Schedule',
    key: 'schedule',
  },
  goals: {
    icon: <Target className="w-4 h-4" />,
    title: 'No active goals',
    desc: 'Goals give the brief something to check in on — weight, reading, habits, anything.',
    action: 'Add a Goal',
    key: 'goals',
  },
  location: {
    icon: <Zap className="w-4 h-4" />,
    title: 'Location not set',
    desc: 'Navi needs your city to give local context.',
    action: 'Set Location',
    key: 'location',
  },
};

function ScoreBar({ score }: { score: number }) {
  const label = score < 40 ? 'Not quite ready' : score < 70 ? 'Good enough' : 'Well-stocked';
  const color = score < 40 ? '#f59e0b' : score < 70 ? '#10b981' : '#0ea5e9';

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10.5px] font-semibold text-gray-500 uppercase tracking-wide">Brief quality</span>
        <span className="text-[11px] font-bold" style={{ color }}>{label}</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(score, 100)}%` }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
      <p className="text-[9.5px] text-gray-400 mt-1">{score}/100 context points</p>
    </div>
  );
}

export function BriefReadinessModal({ readiness, onClose, onSetupSchedule, onOpenCalendar, onAddGoal, onRunAnyway }: Props) {
  if (!readiness) return null;

  const handleGapAction = (gap: BriefGap) => {
    onClose();
    if (gap === 'schedule') onSetupSchedule();
    else if (gap === 'calendar') onOpenCalendar();
    else if (gap === 'goals') onAddGoal();
  };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-2xl overflow-hidden"
          style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.22)' }}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-5 pt-5 pb-3">
            <div>
              <h2 className="text-[15px] font-bold text-gray-900 leading-tight">Brief needs more context</h2>
              <p className="text-[11.5px] text-gray-400 mt-0.5 leading-snug">
                Fix a couple things below for a brief worth reading.
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors ml-3 mt-0.5"
            >
              <X className="w-3.5 h-3.5 text-gray-500" />
            </button>
          </div>

          <div className="px-5 pb-2">
            <ScoreBar score={readiness.score} />
          </div>

          {/* Gaps */}
          <div className="px-5 pb-4 flex flex-col gap-2">
            {readiness.missing.map(gap => {
              const cfg = GAP_CONFIG[gap];
              if (!cfg) return null;
              return (
                <button
                  key={gap}
                  onClick={() => handleGapAction(gap)}
                  className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left transition-all duration-150 group"
                  style={{
                    border: '1.5px solid rgba(0,0,0,0.08)',
                    background: 'rgba(0,0,0,0.02)',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.04)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,0,0,0.14)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.02)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,0,0,0.08)';
                  }}
                >
                  <div
                    className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-xl text-gray-600"
                    style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.10)' }}
                  >
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-gray-800 leading-tight">{cfg.title}</p>
                    <p className="text-[10.5px] text-gray-400 leading-snug mt-0.5">{cfg.desc}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 flex-shrink-0 transition-colors" />
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div
            className="px-5 py-4 flex items-center gap-3 border-t border-gray-100"
          >
            <button
              onClick={() => { onClose(); onRunAnyway(); }}
              className="flex-1 py-2.5 rounded-xl text-[12px] font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              Run anyway
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold text-white transition-all"
              style={{ background: '#1a1a2e', boxShadow: '0 2px 8px rgba(26,26,46,0.22)' }}
            >
              Set it up first
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

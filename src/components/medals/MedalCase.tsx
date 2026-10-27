import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { UserMedal } from '../../services/medalsService';
import { MedalBadge } from './MedalBadge';

const CATEGORY_ORDER: UserMedal['category'][] = ['exclusive', 'goals', 'streaks', 'social', 'community', 'coach', 'hidden'];
const CATEGORY_LABELS: Record<UserMedal['category'], string> = {
  exclusive: 'Exclusive',
  goals: 'Goals',
  streaks: 'Streaks',
  social: 'Social',
  community: 'Community',
  coach: 'Coach',
  hidden: 'Hidden',
};

interface Props {
  medals: UserMedal[];
  isOwn?: boolean;
}

export function MedalCase({ medals }: Props) {
  const [selected, setSelected] = useState<UserMedal | null>(null);

  const grouped = CATEGORY_ORDER.reduce<Record<string, UserMedal[]>>((acc, cat) => {
    const items = medals.filter(m => m.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([cat, items]) => (
        <div key={cat}>
          <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">{CATEGORY_LABELS[cat as UserMedal['category']]}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {items.map(medal => {
              const earned = !!medal.earned_at;
              const pct = Math.min(100, (medal.progress / medal.threshold) * 100);
              return (
                <button
                  key={medal.slug}
                  onClick={() => setSelected(medal)}
                  className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/8 hover:bg-white/8 transition-colors text-left"
                >
                  <MedalBadge icon={medal.icon} tier={medal.tier as any} size="md" locked={!earned} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-ink truncate">{medal.name}</span>
                      <span className={`text-[9px] uppercase tracking-wider font-bold ${
                        medal.tier === 'legendary' ? 'text-pink-400' :
                        medal.tier === 'gold' ? 'text-amber-400' :
                        medal.tier === 'silver' ? 'text-slate-300' : 'text-orange-300'
                      }`}>{medal.tier}</span>
                    </div>
                    <p className="text-xs text-ink-muted/70 mt-0.5 line-clamp-2">{medal.description}</p>
                    {earned ? (
                      <p className="text-[10px] text-ink-muted/60 mt-1">
                        Earned {new Date(medal.earned_at!).toLocaleDateString()} · {medal.earned_percent}% of members
                      </p>
                    ) : (
                      <div className="mt-1.5">
                        <div className="flex items-center justify-between text-[10px] text-ink-muted/60 mb-0.5">
                          <span>{medal.progress} / {medal.threshold}</span>
                          <span>{medal.earned_percent}% have it</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full rounded-full bg-pink-400" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 16 }}
              onClick={e => e.stopPropagation()}
              className="rounded-2xl p-6 max-w-sm w-full text-center"
              style={{ background: 'var(--ds-surface-3)', border: '1px solid var(--ds-border-strong)' }}
            >
              <button onClick={() => setSelected(null)} className="absolute top-3 right-3 p-1 text-ink-muted hover:text-ink"><X className="w-4 h-4" /></button>
              <div className="flex justify-center mb-4">
                <MedalBadge icon={selected.icon} tier={selected.tier as any} size="lg" locked={!selected.earned_at} />
              </div>
              <h3 className="text-lg font-bold text-ink mb-1">{selected.name}</h3>
              <p className="text-sm text-ink-muted mb-3">{selected.description}</p>
              {selected.earned_at ? (
                <p className="text-xs text-ink-muted/60">Earned {new Date(selected.earned_at).toLocaleDateString()} · {selected.earned_percent}% of members</p>
              ) : (
                <p className="text-xs text-ink-muted/60">{selected.progress} / {selected.threshold} · {selected.earned_percent}% of members have it</p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

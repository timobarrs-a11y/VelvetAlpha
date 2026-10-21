import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getUserMedals, type UserMedal } from '../../services/medalsService';
import { MedalBadge } from '../medals/MedalBadge';

interface BadgeRowProps {
  userId: string;
  compact?: boolean;
}

export function BadgeRow({ userId, compact = false }: BadgeRowProps) {
  const [medals, setMedals] = useState<UserMedal[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    getUserMedals(userId).then(all => {
      const earned = all.filter(m => m.earned_at);
      earned.sort((a, b) => {
        const as = a.showcase_slot ?? 99;
        const bs = b.showcase_slot ?? 99;
        if (as !== bs) return as - bs;
        return 0;
      });
      setMedals(earned.slice(0, 5));
    }).catch(() => {});
  }, [userId]);

  if (medals.length === 0) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <AnimatePresence>
        {medals.map((medal) => (
          <motion.div
            key={medal.slug}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="relative"
            onMouseEnter={() => setHovered(medal.slug)}
            onMouseLeave={() => setHovered(null)}
          >
            <MedalBadge icon={medal.icon} tier={medal.tier as any} size="sm" className={compact ? 'scale-75' : ''} />
            {hovered && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 whitespace-nowrap rounded-lg border border-white/10 bg-[var(--ds-surface-2)] px-2.5 py-1.5 text-xs text-white/70 shadow-xl z-20 pointer-events-none"
              >
                <span className="font-semibold text-amber-400">{medal.name}</span>
                <span className="text-white/40 ml-1.5">{medal.description}</span>
              </motion.div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

interface BadgeSummaryProps {
  userId: string;
  authorName: string;
}

export function BadgeSummary({ userId, authorName }: BadgeSummaryProps) {
  const [medals, setMedals] = useState<UserMedal[]>([]);

  useEffect(() => {
    getUserMedals(userId).then(all => {
      const earned = all.filter(m => m.earned_at);
      earned.sort((a, b) => (a.showcase_slot ?? 99) - (b.showcase_slot ?? 99));
      setMedals(earned.slice(0, 5));
    }).catch(() => {});
  }, [userId]);

  if (medals.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.02] border border-white/8">
      <div className="flex items-center gap-0.5">
        {medals.map(m => (
          <MedalBadge key={m.slug} icon={m.icon} tier={m.tier as any} size="sm" />
        ))}
      </div>
      <span className="text-[10px] text-white/40">
        {authorName} has {medals.length} {medals.length === 1 ? 'medal' : 'medals'}
      </span>
    </div>
  );
}

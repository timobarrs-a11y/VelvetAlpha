import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Award } from 'lucide-react';
import { fetchBadges } from '../../services/communityService';
import type { CommunityBadge } from '../../types/community';

interface BadgeRowProps {
  userId: string;
  compact?: boolean;
}

const BADGE_ICONS: Record<string, string> = {
  first_post: '✏️',
  conversation_starter: '💬',
  community_helper: '🤝',
  rising_star: '⭐',
  crowd_favorite: '🌟',
  regular: '📅',
};

export function BadgeRow({ userId, compact = false }: BadgeRowProps) {
  const [badges, setBadges] = useState<CommunityBadge[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    fetchBadges(userId).then(setBadges);
  }, [userId]);

  if (badges.length === 0) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <AnimatePresence>
        {badges.map((badge) => (
          <motion.div
            key={badge.key}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="relative"
            onMouseEnter={() => setHovered(badge.key)}
            onMouseLeave={() => setHovered(null)}
          >
            <div
              className={`flex items-center gap-1 rounded-full border border-white/8 bg-white/[0.03] ${
                compact ? 'px-1.5 py-0.5' : 'px-2 py-1'
              } transition-all hover:border-amber-400/30 hover:bg-amber-400/[0.05]`}
            >
              <span className={compact ? 'text-xs' : 'text-sm'}>
                {BADGE_ICONS[badge.key] ?? '🏅'}
              </span>
              {!compact && (
                <span className="text-[10px] font-semibold text-white/50">
                  {badge.label}
                </span>
              )}
            </div>
            {hovered && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 whitespace-nowrap rounded-lg border border-white/10 bg-[var(--ds-surface-2)] px-2.5 py-1.5 text-xs text-white/70 shadow-xl z-20 pointer-events-none"
              >
                <span className="font-semibold text-amber-400">{badge.label}</span>
                <span className="text-white/40 ml-1.5">{badge.description}</span>
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
  const [badges, setBadges] = useState<CommunityBadge[]>([]);

  useEffect(() => {
    fetchBadges(userId).then(setBadges);
  }, [userId]);

  if (badges.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.02] border border-white/8">
      <Award className="w-3 h-3 text-amber-400/60 flex-shrink-0" />
      <span className="text-[10px] text-white/40">
        {authorName} has {badges.length} {badges.length === 1 ? 'badge' : 'badges'}
      </span>
      <div className="flex items-center gap-0.5">
        {badges.slice(0, 5).map((b) => (
          <span key={b.key} className="text-xs" title={b.label}>
            {BADGE_ICONS[b.key] ?? '🏅'}
          </span>
        ))}
      </div>
    </div>
  );
}

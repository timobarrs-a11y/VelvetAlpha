import { Lock } from 'lucide-react';
import { MedalIcon } from './MedalIcon';

export type MedalTier = 'bronze' | 'silver' | 'gold' | 'legendary';

const TIER_RING: Record<MedalTier, string> = {
  bronze: 'ring-[#cd7f32]',
  silver: 'ring-[#cbd5e1]',
  gold: 'ring-[#fbbf24]',
  legendary: 'ring-pink-400',
};

const TIER_ICON: Record<MedalTier, string> = {
  bronze: 'text-[#cd7f32]',
  silver: 'text-[#cbd5e1]',
  gold: 'text-[#fbbf24]',
  legendary: 'text-pink-300',
};

const TIER_GLOW: Record<MedalTier, string> = {
  bronze: '',
  silver: '',
  gold: '',
  legendary: 'shadow-[0_0_12px_rgba(244,114,182,0.4)]',
};

const SIZES = {
  sm: { box: 'w-6 h-6', icon: 'w-3 h-3', lock: 'w-2.5 h-2.5' },
  md: { box: 'w-12 h-12', icon: 'w-5 h-5', lock: 'w-4 h-4' },
  lg: { box: 'w-20 h-20', icon: 'w-8 h-8', lock: 'w-6 h-6' },
};

interface Props {
  icon: string;
  tier: MedalTier;
  size?: 'sm' | 'md' | 'lg';
  locked?: boolean;
  className?: string;
}

export function MedalBadge({ icon, tier, size = 'md', locked = false, className }: Props) {
  const s = SIZES[size];
  const ring = TIER_RING[tier];
  const iconColor = TIER_ICON[tier];
  const glow = TIER_GLOW[tier];
  const isLegendary = tier === 'legendary';

  return (
    <div
      className={`${s.box} rounded-full ring-2 ${ring} ${glow} flex items-center justify-center flex-shrink-0 ${className ?? ''} ${
        locked ? 'opacity-35 grayscale' : ''
      } ${isLegendary && !locked ? 'bg-gradient-to-br from-pink-500/20 to-violet-500/20' : 'bg-white/5'}`}
    >
      {locked ? (
        <Lock className={`${s.lock} text-ink-muted`} />
      ) : (
        <MedalIcon name={icon} className={`${s.icon} ${iconColor}`} />
      )}
    </div>
  );
}

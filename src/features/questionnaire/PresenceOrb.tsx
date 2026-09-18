import { motion, AnimatePresence } from 'framer-motion';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

interface PresenceOrbProps {
  hue: string;
  energy: number;
  traitChips: string[];
  label?: string;
  size?: number;
}

export function PresenceOrb({ hue, energy, traitChips, label, size = 120 }: PresenceOrbProps) {
  const prefersReduced = usePrefersReducedMotion();
  const animDuration = prefersReduced ? 0 : Math.max(2, 8 - energy * 3);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle at 50% 40%, ${hue}40 0%, ${hue}10 50%, transparent 80%)`,
            filter: 'blur(20px)',
          }}
          animate={prefersReduced ? {} : {
            scale: [1, 1.08, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{ duration: animDuration, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute inset-2 rounded-full border-2"
          style={{
            borderColor: `${hue}30`,
            background: `radial-gradient(circle at 50% 50%, ${hue}15 0%, ${hue}05 60%, transparent 100%)`,
          }}
          animate={prefersReduced ? {} : {
            rotate: [0, 360],
          }}
          transition={{ duration: animDuration * 2, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute inset-6 rounded-full"
          style={{
            background: `radial-gradient(circle at 40% 30%, ${hue}30 0%, ${hue}10 70%, transparent 100%)`,
          }}
          animate={prefersReduced ? {} : {
            y: [0, -4, 0],
            x: [0, 3, 0],
          }}
          transition={{ duration: animDuration * 0.7, repeat: Infinity, ease: 'easeInOut' }}
        />
        {label && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold text-white/80">{label}</span>
          </div>
        )}
      </div>

      {traitChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 justify-center max-w-xs">
          <AnimatePresence mode="popLayout">
            {traitChips.map((chip, i) => (
              <motion.span
                key={chip}
                initial={{ opacity: 0, scale: 0.8, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ delay: i * 0.05 }}
                className="px-2.5 py-1 rounded-full text-[10px] font-semibold border"
                style={{
                  color: `${hue}cc`,
                  borderColor: `${hue}40`,
                  background: `${hue}10`,
                }}
              >
                {chip}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

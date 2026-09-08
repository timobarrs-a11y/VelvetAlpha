import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';

interface GameCardProps {
  name: string;
  description: string;
  icon: LucideIcon;
  /** Tailwind gradient stops for the icon chip, e.g. "from-amber-500 to-orange-500". */
  iconBg: string;
  onClick: () => void;
  delay?: number;
}

export function GameCard({ name, description, icon: Icon, iconBg, onClick, delay = 0 }: GameCardProps) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      onClick={onClick}
      data-interactive
      className="ds-card ds-card--interactive ds-focus group text-left w-full p-5"
    >
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${iconBg} flex items-center justify-center shadow-soft flex-shrink-0 group-hover:scale-105 group-hover:rotate-2 transition-transform`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-ink font-display text-sm">{name}</h3>
          <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>
    </motion.button>
  );
}

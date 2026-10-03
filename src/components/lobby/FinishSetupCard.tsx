import { motion } from 'framer-motion';
import { ArrowRight, ListChecks } from 'lucide-react';

interface Props {
  onResume: () => void;
}

export function FinishSetupCard({ onResume }: Props) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onResume}
      className="group w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-left transition-colors"
      style={{
        background: 'linear-gradient(135deg, rgba(16,185,129,0.14) 0%, rgba(14,165,233,0.10) 100%)',
        border: '1px solid rgba(16,185,129,0.35)',
      }}
    >
      <span className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-emerald-500/20 text-emerald-300">
        <ListChecks className="w-5 h-5" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-semibold text-white">Finish setting up</span>
        <span className="block text-sm text-white/65">Pick up right where you left off.</span>
      </span>
      <ArrowRight className="w-5 h-5 text-emerald-300 group-hover:translate-x-1 transition-transform flex-shrink-0" />
    </motion.button>
  );
}

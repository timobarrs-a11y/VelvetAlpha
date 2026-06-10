import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';
import { AvatarV2 } from './AvatarV2';
import { AvatarConfigV2 } from '../types/avatar-v2';

interface AvatarSaveRevealProps {
  config: AvatarConfigV2;
  companionName?: string;
  isCompanion?: boolean;
  onContinue: () => void;
  autoDismissMs?: number;
}

export function AvatarSaveReveal({
  config,
  companionName,
  isCompanion = false,
  onContinue,
  autoDismissMs = 2500,
}: AvatarSaveRevealProps) {
  useEffect(() => {
    const timer = setTimeout(onContinue, autoDismissMs);
    return () => clearTimeout(timer);
  }, [onContinue, autoDismissMs]);

  const headline = isCompanion
    ? companionName
      ? `${companionName} looks perfect.`
      : 'They look perfect.'
    : 'You look amazing.';

  const subline = isCompanion
    ? companionName
      ? `${companionName} is ready to meet you.`
      : 'Your companion is ready.'
    : 'Your look has been saved.';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 24 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.1 }}
        className="flex flex-col items-center gap-6 px-8 py-10 rounded-3xl
          bg-gradient-to-b from-[#111827] to-[#0a0f1a]
          border border-white/10 shadow-2xl max-w-sm w-full mx-4"
      >
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.2 }}
          className="relative"
        >
          <div className="w-40 h-40 rounded-2xl overflow-hidden
            bg-[radial-gradient(ellipse_at_center,_#1e2a3a_0%,_#060a0f_100%)]
            shadow-[0_0_60px_rgba(56,189,248,0.15)] ring-2 ring-sky-500/30">
            <AvatarV2 config={config} className="w-full h-full" />
          </div>
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5, type: 'spring', stiffness: 400, damping: 15 }}
            className="absolute -top-2 -right-2 w-8 h-8 rounded-full
              bg-gradient-to-br from-sky-400 to-cyan-500
              flex items-center justify-center shadow-lg"
          >
            <Sparkles className="w-4 h-4 text-white" />
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="text-center space-y-1"
        >
          <h2 className="text-xl font-bold text-white tracking-tight">{headline}</h2>
          <p className="text-sm text-gray-400">{subline}</p>
        </motion.div>

        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          onClick={onContinue}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl
            bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold
            transition-colors shadow-lg shadow-sky-900/40"
        >
          Continue
          <ArrowRight className="w-4 h-4" />
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

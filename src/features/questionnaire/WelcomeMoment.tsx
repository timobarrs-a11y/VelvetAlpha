import { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Heart } from 'lucide-react';

/**
 * A short branded moment before the first question: you're in. It stays until they tap it (or press
 * Enter or Space), so nobody misses it.
 */
export function WelcomeMoment({ onDone }: { onDone: () => void }) {
  const reduce = useReducedMotion() ?? false;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDone(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);

  return (
    <motion.div
      role="dialog"
      aria-label="Welcome to Project Velvet"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6 text-center cursor-pointer"
      style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 30%, rgba(80,100,255,0.28), transparent 60%), radial-gradient(ellipse 60% 40% at 20% 100%, rgba(244,63,107,0.16), transparent 55%), #080b14' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.5 }}
      onClick={onDone}
    >
      <motion.div
        initial={reduce ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.15, type: 'spring', damping: 14, stiffness: 140 }}
      >
        <Heart className="w-10 h-10 text-pink-400 mx-auto" fill="currentColor" style={{ filter: 'drop-shadow(0 0 14px rgba(244,114,182,0.85))' }} />
      </motion.div>

      <motion.p
        className="mt-5 text-[13px] font-bold tracking-[0.3em] uppercase text-white"
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.5 }}
      >
        Project <span style={{ color: '#c084fc' }}>Velvet</span>
      </motion.p>

      <motion.h1
        className="mt-6 text-5xl md:text-6xl font-extrabold tracking-tight"
        style={{ background: 'linear-gradient(120deg,#f472b6 0%,#c084fc 45%,#818cf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        You&apos;re moved in!
      </motion.h1>

      <motion.p
        className="mt-5 max-w-md text-lg text-gray-300"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 0.6 }}
      >
        Welcome to <b style={{ color: '#f472b6' }}>Town</b>! You&apos;ll see your place in a bit. But first, let&apos;s set up your profile.
      </motion.p>

      <motion.button
        type="button"
        className="mt-10 inline-flex h-12 items-center justify-center rounded-full px-10 text-base font-bold text-white shadow-lg"
        style={{ background: 'linear-gradient(to right, rgb(244 63 94), rgb(219 39 119))' }}
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.6, duration: 0.5 }}
        onClick={(e) => { e.stopPropagation(); onDone(); }}
        autoFocus
      >
        Let&apos;s go
      </motion.button>
      <p className="absolute bottom-8 text-xs text-gray-600">Tap anywhere to begin</p>
    </motion.div>
  );
}

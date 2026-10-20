import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, CreditCard, Crown, ArrowRight } from 'lucide-react';

const VELVET_BG = 'var(--ds-bg-page)';
const VELVET_RADIAL = `radial-gradient(ellipse 90% 50% at 50% -5%, rgba(80,100,255,0.30) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 20% 110%, rgba(244,63,107,0.12) 0%, transparent 50%)`;

export function LockScreen() {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: VELVET_BG }}>
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: VELVET_RADIAL }} />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative max-w-md w-full rounded-3xl p-8"
        style={{
          background: 'var(--ds-surface-3)',
          border: '1px solid var(--ds-border-strong)',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.60)',
        }}
      >
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(244,63,107,0.20) 0%, rgba(192,80,220,0.20) 100%)',
              border: '1px solid var(--ds-border-strong)',
            }}
          >
            <Clock className="w-8 h-8" style={{ color: 'rgba(244,114,182,0.90)' }} />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white text-center font-display mb-2">
          Your welcome window has ended
        </h1>
        <p className="text-sm text-center mb-7" style={{ color: 'rgba(202,197,240,0.60)' }}>
          You've had 48 hours of full access. Pick a path to keep going — your goals, plans, and progress are all saved.
        </p>

        {/* Option 1: 3-day card trial */}
        <button
          onClick={() => navigate('/pricing?returnTo=/lobby&mode=card_trial')}
          className="w-full rounded-2xl p-5 mb-3 text-left transition-all hover:scale-[1.02] group"
          style={{
            background: 'linear-gradient(135deg, rgba(244,63,107,0.12) 0%, rgba(192,80,220,0.10) 100%)',
            border: '1px solid rgba(244,114,182,0.30)',
          }}
        >
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(244,114,182,0.15)', border: '1px solid rgba(244,114,182,0.25)' }}
            >
              <CreditCard className="w-6 h-6 text-pink-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-white">Keep going free for 3 more days</h3>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(202,197,240,0.50)' }}>
                Add a card — $0 today, billed on day 3 for Essential unless you cancel
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-pink-400 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all flex-shrink-0" />
          </div>
        </button>

        {/* Option 2: Start membership now */}
        <button
          onClick={() => navigate('/pricing?returnTo=/lobby')}
          className="w-full rounded-2xl p-5 text-left transition-all hover:scale-[1.02] group"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
          }}
        >
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(251,191,36,0.10)', border: '1px solid rgba(251,191,36,0.20)' }}
            >
              <Crown className="w-6 h-6 text-amber-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-white">Start my membership</h3>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(202,197,240,0.50)' }}>
                Pick any plan and pay now — Essential, Plus, or Elite
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-amber-400 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all flex-shrink-0" />
          </div>
        </button>

        <p className="text-xs text-center mt-6" style={{ color: 'rgba(202,197,240,0.30)' }}>
          Your data stays saved no matter what you choose.
        </p>
      </motion.div>
    </div>
  );
}

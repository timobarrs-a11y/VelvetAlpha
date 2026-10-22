import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, CreditCard, Crown, ArrowRight, X } from 'lucide-react';
import { useState } from 'react';

const VELVET_BG = 'var(--ds-bg-page)';

export function LockScreen() {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <>
      {/* Dimming overlay — click-through except the banner area */}
      <div className="fixed inset-0 z-40 pointer-events-none" style={{ background: 'rgba(0,0,0,0.45)' }} />

      {/* Bottom banner — user can dismiss to see read-only content behind */}
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="fixed bottom-0 left-0 right-0 z-50 flex justify-center p-4"
      >
        <div
          className="relative max-w-lg w-full rounded-2xl p-5"
          style={{
            background: 'var(--ds-surface-3)',
            border: '1px solid var(--ds-border-strong)',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 -16px 48px rgba(0,0,0,0.50)',
          }}
        >
          <button
            onClick={() => setDismissed(true)}
            className="absolute top-3 right-3 text-white/30 hover:text-white/60 transition-colors"
            aria-label="Dismiss and view read-only"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, rgba(244,63,107,0.20) 0%, rgba(192,80,220,0.20) 100%)',
                border: '1px solid var(--ds-border-strong)',
              }}
            >
              <Clock className="w-5 h-5" style={{ color: 'rgba(244,114,182,0.90)' }} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white font-display">
                Your welcome window has ended
              </h2>
              <p className="text-xs" style={{ color: 'rgba(202,197,240,0.50)' }}>
                Pick a path to keep going — your goals and progress are viewable below.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={() => navigate('/pricing?returnTo=/lobby&mode=card_trial')}
              className="flex-1 rounded-xl p-3.5 text-left transition-all hover:scale-[1.02] group"
              style={{
                background: 'linear-gradient(135deg, rgba(244,63,107,0.12) 0%, rgba(192,80,220,0.10) 100%)',
                border: '1px solid rgba(244,114,182,0.30)',
              }}
            >
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-pink-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-white">Keep going free for 3 more days</h3>
                  <p className="text-[11px] mt-0.5" style={{ color: 'rgba(202,197,240,0.50)' }}>
                    Add a card — $0 today, billed on day 3
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-pink-400 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all flex-shrink-0" />
              </div>
            </button>

            <button
              onClick={() => navigate('/pricing?returnTo=/lobby')}
              className="flex-1 rounded-xl p-3.5 text-left transition-all hover:scale-[1.02] group"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.10)',
              }}
            >
              <div className="flex items-center gap-3">
                <Crown className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-white">Start my membership</h3>
                  <p className="text-[11px] mt-0.5" style={{ color: 'rgba(202,197,240,0.50)' }}>
                    Pick any plan and pay now
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-400 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all flex-shrink-0" />
              </div>
            </button>
          </div>

          <p className="text-xs text-center mt-3" style={{ color: 'rgba(202,197,240,0.30)' }}>
            Your data stays saved no matter what you choose.
          </p>
        </div>
      </motion.div>
    </>
  );
}

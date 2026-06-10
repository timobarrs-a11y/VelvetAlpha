import { motion } from 'framer-motion';
import { Crown, Sparkles, Zap, Flame, Star, Clock } from 'lucide-react';
import { SubscriptionTier } from '../types/subscription';

interface SubscriptionBannerProps {
  tier: SubscriptionTier;
  messagesRemaining: number;
  compact?: boolean;
  trialExpiresAt?: string | null;
}

const TIER_CONFIGS = {
  free: {
    label: 'Free',
    icon: Star,
    gradient: 'from-slate-500 to-slate-600',
    glowColor: 'rgba(148, 163, 184, 0.2)',
    textColor: 'text-slate-100',
    badgeColor: 'bg-slate-400/20',
    borderColor: 'border-slate-400/30'
  },
  trial: {
    label: 'Premium Trial',
    icon: Clock,
    gradient: 'from-amber-400 to-orange-500',
    glowColor: 'rgba(251, 191, 36, 0.3)',
    textColor: 'text-amber-50',
    badgeColor: 'bg-amber-300/20',
    borderColor: 'border-amber-300/40'
  },
  unlimited: {
    label: 'Velvet Essential',
    icon: Zap,
    gradient: 'from-teal-400 to-cyan-500',
    glowColor: 'rgba(20, 184, 166, 0.3)',
    textColor: 'text-teal-50',
    badgeColor: 'bg-teal-300/20',
    borderColor: 'border-teal-300/40'
  },
  starter: {
    label: 'Velvet Plus',
    icon: Sparkles,
    gradient: 'from-blue-400 to-indigo-500',
    glowColor: 'rgba(96, 165, 250, 0.3)',
    textColor: 'text-blue-50',
    badgeColor: 'bg-blue-300/20',
    borderColor: 'border-blue-300/40'
  },
  plus: {
    label: 'Velvet Pro',
    icon: Flame,
    gradient: 'from-emerald-400 to-teal-500',
    glowColor: 'rgba(52, 211, 153, 0.3)',
    textColor: 'text-emerald-50',
    badgeColor: 'bg-emerald-300/20',
    borderColor: 'border-emerald-300/40'
  },
  elite: {
    label: 'Velvet Elite',
    icon: Crown,
    gradient: 'from-amber-400 via-yellow-400 to-amber-500',
    glowColor: 'rgba(251, 191, 36, 0.35)',
    textColor: 'text-amber-50',
    badgeColor: 'bg-amber-300/20',
    borderColor: 'border-amber-300/50'
  }
};

function getTrialDaysRemaining(trialExpiresAt: string | null | undefined): number | null {
  if (!trialExpiresAt) return null;
  const diff = new Date(trialExpiresAt).getTime() - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function SubscriptionBanner({ tier, messagesRemaining, compact = false, trialExpiresAt }: SubscriptionBannerProps) {
  const config = TIER_CONFIGS[tier] || TIER_CONFIGS.free;
  const Icon = config.icon;
  const isUnlimited = messagesRemaining === -1;
  const isLowOnMessages = !isUnlimited && messagesRemaining < 50;
  const isPremium = tier !== 'free';
  const trialDaysLeft = tier === 'trial' ? getTrialDaysRemaining(trialExpiresAt) : null;

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${config.gradient} shadow-md`}
      >
        <motion.div
          animate={isPremium ? { rotate: [0, 5, -5, 0] } : {}}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Icon className={`${config.textColor} w-4 h-4`} />
        </motion.div>
        <span className={`${config.textColor} font-semibold text-sm`}>{config.label}</span>
        {isUnlimited && (
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Sparkles className={`${config.textColor} w-3.5 h-3.5`} />
          </motion.div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="relative"
    >
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${config.gradient} p-[1px]`}>
        <div className="relative bg-white/95 backdrop-blur-sm rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <motion.div
              animate={isPremium ? {
                rotate: [0, 5, -5, 0]
              } : {}}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
              className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-md`}
            >
              <Icon className="text-white w-5 h-5" />
            </motion.div>

            <div className="flex-1">
              <h3 className="text-gray-800 font-bold text-base leading-tight">
                {config.label}
              </h3>
              {tier === 'trial' && trialDaysLeft !== null ? (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Clock className="text-amber-500 w-3 h-3" />
                  <p className="text-gray-600 text-sm">
                    {trialDaysLeft === 0 ? 'Expires today' : `${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} remaining`}
                  </p>
                </div>
              ) : isUnlimited ? (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Sparkles className="text-gray-600 w-3 h-3" />
                  </motion.div>
                  <p className="text-gray-600 text-sm">
                    Unlimited conversations
                  </p>
                </div>
              ) : (
                <p className="text-gray-600 text-sm mt-0.5">
                  {messagesRemaining} message{messagesRemaining !== 1 ? 's' : ''} available
                </p>
              )}
            </div>

            {isPremium && (
              <motion.div
                animate={{
                  scale: [1, 1.05, 1],
                  rotate: [0, 180, 360]
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: 'linear'
                }}
              >
                <Sparkles className="text-gray-400 w-5 h-5" />
              </motion.div>
            )}
          </div>

          {tier === 'free' && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-3 pt-3 border-t border-gray-200"
            >
              <p className="text-gray-500 text-xs text-center">
                Upgrade for unlimited messages and advanced AI
              </p>
            </motion.div>
          )}
        </div>
      </div>

      {isPremium && (
        <motion.div
          animate={{
            opacity: [0.3, 0.6, 0.3]
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut'
          }}
          className={`absolute inset-0 rounded-2xl bg-gradient-to-r ${config.gradient} blur-xl -z-10`}
          style={{ transform: 'scale(1.05)' }}
        />
      )}
    </motion.div>
  );
}

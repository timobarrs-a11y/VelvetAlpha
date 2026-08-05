import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Gift, Copy, Check, Share2, Users, Sparkles, MessageCircle, Loader } from 'lucide-react';
import { referralService, ReferralSummary } from '../services/referralService';
import { toast } from '../shared/ui/Toast';
import { VELVET_THEME } from '../config/velvetTheme';

export function InvitePage() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const s = await referralService.getSummary();
    setSummary(s);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCopy = async () => {
    if (!summary?.inviteLink) return;
    try {
      await navigator.clipboard.writeText(summary.inviteLink);
      setCopied(true);
      toast.success('Invite link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const handleShare = async () => {
    if (!summary?.inviteLink) return;
    const shareData = {
      title: 'Join me on Velvet',
      text: 'Chat with AI companions that actually remember you. Use my invite link to get bonus messages!',
      url: summary.inviteLink,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(summary.inviteLink);
        setCopied(true);
        toast.success('Link copied — share it anywhere!');
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* user cancelled share — non-fatal */
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: VELVET_THEME.bg }}>
        <Loader className="animate-spin text-blue-300/60" size={32} />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background: VELVET_THEME.bg,
        backgroundImage: VELVET_THEME.radial,
      }}
    >
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl transition-colors hover:bg-white/10"
            style={{ border: `1px solid ${VELVET_THEME.colors.glassBorder}` }}
          >
            <ArrowLeft className="text-blue-200/70" size={20} />
          </button>
          <h1 className="text-2xl font-bold text-white tracking-tight">Invite Friends</h1>
        </div>

        {/* Hero card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-3xl p-6 sm:p-8 mb-6 relative overflow-hidden"
          style={{
            background: VELVET_THEME.colors.glassCard,
            border: `1px solid ${VELVET_THEME.colors.glassBorder}`,
            boxShadow: '0 8px 40px rgba(0,0,0,0.25)',
          }}
        >
          <div
            className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-20 blur-2xl"
            style={{ background: 'radial-gradient(circle, #f472b6 0%, transparent 70%)' }}
          />
          <div className="relative">
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #f472b6 0%, #c084fc 100%)' }}
              >
                <Gift className="text-white" size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Give 25, Get 50</h2>
                <p className="text-sm text-blue-200/60">When your friend sends 20 messages</p>
              </div>
            </div>
            <p className="text-blue-200/70 text-sm leading-relaxed mt-3">
              Share your invite link with a friend. They get 25 bonus messages when they sign up,
              and you get 50 bonus messages once they've sent 20 messages. Everyone wins.
            </p>
          </div>
        </motion.div>

        {/* Referral code + link */}
        {summary?.code ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="rounded-3xl p-6 mb-6"
            style={{
              background: VELVET_THEME.colors.glassCard,
              border: `1px solid ${VELVET_THEME.colors.glassBorder}`,
            }}
          >
            <label className="text-xs font-medium text-blue-200/50 uppercase tracking-wider">
              Your invite link
            </label>
            <div className="flex items-center gap-2 mt-2 mb-4">
              <div
                className="flex-1 rounded-xl px-4 py-3 text-sm text-white font-mono truncate"
                style={{
                  background: 'rgba(0,0,0,0.25)',
                  border: `1px solid ${VELVET_THEME.colors.panelBorder}`,
                }}
              >
                {summary.inviteLink}
              </div>
              <button
                onClick={handleCopy}
                className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
                style={{
                  background: copied ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${copied ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.10)'}`,
                }}
              >
                {copied ? <Check className="text-green-400" size={18} /> : <Copy className="text-blue-200/80" size={18} />}
              </button>
            </div>
            <button
              onClick={handleShare}
              className="w-full rounded-xl py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #3b5bdb 0%, #4c6ef5 100%)',
                boxShadow: '0 4px 24px rgba(66,99,235,0.35)',
              }}
            >
              <Share2 size={16} />
              Share invite link
            </button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-3xl p-6 mb-6 text-center"
            style={{
              background: VELVET_THEME.colors.glassCard,
              border: `1px solid ${VELVET_THEME.colors.glassBorder}`,
            }}
          >
            <p className="text-blue-200/60 text-sm">No referral code available. Please try again later.</p>
          </motion.div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {[
            { icon: Users, label: 'Invited', value: summary?.invitedCount ?? 0, color: '#818cf8' },
            { icon: Sparkles, label: 'Activated', value: summary?.qualifiedCount ?? 0, color: '#f472b6' },
            { icon: MessageCircle, label: 'Msgs earned', value: summary?.rewardMessagesEarned ?? 0, color: '#34d399' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 + i * 0.08 }}
              className="rounded-2xl p-4 text-center"
              style={{
                background: VELVET_THEME.colors.glassCard,
                border: `1px solid ${VELVET_THEME.colors.glassBorder}`,
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-2"
                style={{ background: `${stat.color}22` }}
              >
                <stat.icon size={16} style={{ color: stat.color }} />
              </div>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-xs text-blue-200/50 mt-0.5">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="rounded-3xl p-6 mt-6"
          style={{
            background: VELVET_THEME.colors.glassCard,
            border: `1px solid ${VELVET_THEME.colors.glassBorder}`,
          }}
        >
          <h3 className="text-sm font-semibold text-white mb-4">How it works</h3>
          <div className="space-y-3">
            {[
              { step: '1', text: 'Share your invite link with a friend' },
              { step: '2', text: 'They sign up and get 25 bonus messages' },
              { step: '3', text: 'Once they send 20 messages, you both get rewarded' },
              { step: '4', text: 'You earn 50 bonus messages per activated referral (max 100 total reward messages)' },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <div
                  className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #3b5bdb 0%, #4c6ef5 100%)' }}
                >
                  {item.step}
                </div>
                <p className="text-sm text-blue-200/70 leading-relaxed pt-0.5">{item.text}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

import {
  ArrowLeft, CreditCard, RotateCcw, Gift,
  Sparkles, Volume2, VolumeX, Settings, Calendar, Wand2, Brain, RefreshCw,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from './Avatar';
import { AvatarConfig, DEFAULT_MALE_AVATAR, DEFAULT_FEMALE_AVATAR } from '../types/avatar';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { SubscriptionBanner } from './SubscriptionBanner';
import { useAudioScene } from '../hooks/useAudioScene';
import { useMotivationalQuote } from '../hooks/useMotivationalQuote';
import { supabase } from '../shared/supabase/client';
import { calendarService } from '../services/calendarService';

interface ChatHeaderProps {
  characterName: string;
  avatarConfig?: AvatarConfig;
  gender?: 'male' | 'female';
  currentStatus?: string;
  favoriteColor?: string;
  fontFamily?: string | null;
  companionId: string;
  currentTier: string;
  expertDomain?: string | null;
  subscriptionInfo?: { tier: string; messagesRemaining: number };
  onReset: () => void;
  onAvatarClick: () => void;
  onOpenReflection?: () => void;
  onOpenLoyaltyRewards?: () => void;
  onStartOver?: () => void;
}

function IconBtn({
  onClick, title, children, accent,
}: {
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      title={title}
      className={`flex items-center justify-center w-8 h-8 rounded-xl border transition-all duration-150 ${
        accent ?? 'bg-white border-gray-200/80 text-gray-500 hover:border-gray-300 hover:text-gray-700'
      }`}
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)' }}
    >
      {children}
    </motion.button>
  );
}

export const ChatHeader = ({
  characterName,
  avatarConfig,
  gender,
  currentStatus,
  favoriteColor,
  fontFamily,
  companionId,
  currentTier,
  expertDomain,
  subscriptionInfo,
  onReset,
  onAvatarClick,
  onOpenReflection,
  onOpenLoyaltyRewards,
  onStartOver,
}: ChatHeaderProps) => {
  const navigate = useNavigate();
  const [showSettings, setShowSettings] = useState(false);
  const { muted, toggleMute } = useAudioScene();
  const quote = useMotivationalQuote();
  const [todayEventTitle, setTodayEventTitle] = useState<string | null>(null);

  // Load today's first upcoming event for the chip
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 2);
      const events = await calendarService.getUserEvents(user.id, today, tomorrow);
      const upcoming = events.filter(e => !e.completed);
      if (upcoming.length > 0) setTodayEventTitle(upcoming[0].title);
    };
    load().catch(() => {});
  }, []);

  return (
    <div
      className="relative z-50 flex-shrink-0"
      style={{
        background: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(0,0,0,0.07)',
        boxShadow: '0 1px 0 rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)',
      }}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">

        {/* Back */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => navigate('/lobby')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-gray-200/80 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-800 transition-all text-xs font-medium flex-shrink-0"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}
        >
          <ArrowLeft size={13} />
          <span className="hidden sm:inline">Lobby</span>
        </motion.button>

        {/* Avatar + name + status */}
        <button
          onClick={onAvatarClick}
          className="flex items-center gap-2.5 group flex-shrink-0"
        >
          <div className="relative">
            <div
              className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0"
              style={{ boxShadow: '0 0 0 2px white, 0 2px 8px rgba(0,0,0,0.12)' }}
            >
              <Avatar
                config={avatarConfig ?? (gender === 'male' ? DEFAULT_MALE_AVATAR : DEFAULT_FEMALE_AVATAR)}
                className="w-full h-full"
              />
            </div>
            {currentStatus && (
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-white" />
            )}
          </div>
          <div className="hidden sm:block text-left">
            <p
              className="text-sm font-semibold text-gray-900 group-hover:text-rose-600 transition-colors leading-tight"
              style={fontFamily ? { fontFamily } : undefined}
            >
              {characterName}
            </p>
            {currentStatus && (
              <p className="text-[10px] text-emerald-500 font-medium leading-tight max-w-[220px] lg:max-w-[320px]">
                {currentStatus}
              </p>
            )}
          </div>
        </button>

        {/* Expert domain badge */}
        {expertDomain && (
          <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 border border-indigo-100 flex-shrink-0">
            <Brain size={10} className="text-indigo-400 flex-shrink-0" />
            <span className="text-[10px] text-indigo-600 font-medium truncate max-w-[100px]">{expertDomain}</span>
          </div>
        )}

        {/* Calendar event chip — today/tomorrow */}
        {todayEventTitle && (
          <div className="hidden md:flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 border border-blue-100 flex-shrink-0">
            <Calendar size={10} className="text-blue-400 flex-shrink-0" />
            <span className="text-[10px] text-blue-600 font-medium truncate max-w-[120px]">{todayEventTitle}</span>
          </div>
        )}

        <div className="hidden sm:block w-px h-5 bg-gray-200 mx-1" />

        {/* Quote — left-aligned, fills remaining header space */}
        {quote && (
          <div className="flex-1 hidden lg:flex items-center min-w-0 px-3">
            <p className="text-[11px] font-semibold text-gray-600 italic text-left leading-snug line-clamp-1 truncate">
              "{quote.text}"
              {quote.author && <span className="not-italic font-medium text-gray-400"> — {quote.author}</span>}
            </p>
          </div>
        )}
        {!quote && <div className="flex-1" />}

        {/* Right actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {subscriptionInfo && (
            <div className="hidden xl:block mr-1">
              <SubscriptionBanner
                tier={subscriptionInfo.tier}
                messagesRemaining={subscriptionInfo.messagesRemaining}
                compact={true}
              />
            </div>
          )}

          {onStartOver && (
            <motion.button
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              onClick={onStartOver}
              title="Start over — clear messages and get a fresh greeting"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-rose-200/80 bg-rose-50/80 text-rose-600 hover:border-rose-300 hover:bg-rose-100 transition-all text-xs font-medium flex-shrink-0"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}
            >
              <RefreshCw size={13} />
              <span className="hidden sm:inline">Start Over</span>
            </motion.button>
          )}

          <IconBtn onClick={toggleMute} title={muted ? 'Unmute music' : 'Mute music'}>
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </IconBtn>

          {onOpenReflection && (
            <IconBtn
              onClick={onOpenReflection}
              title="Reflection Deck"
              accent="bg-amber-50 border-amber-200 text-amber-600 hover:border-amber-400 hover:bg-amber-100"
            >
              <Sparkles size={14} />
            </IconBtn>
          )}

          <div className="relative">
            <IconBtn onClick={() => setShowSettings(v => !v)} title="Settings">
              <Settings size={14} />
            </IconBtn>
            <AnimatePresence>
              {showSettings && (
                <>
                  <div className="fixed inset-0 z-[100]" onClick={() => setShowSettings(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full right-0 mt-1.5 w-44 bg-white rounded-2xl border border-gray-200/80 py-1.5 z-[110]"
                    style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)' }}
                  >
                    {onOpenLoyaltyRewards && (
                      <button
                        onClick={() => { onOpenLoyaltyRewards(); setShowSettings(false); }}
                        className="w-full text-left px-3.5 py-2 text-sm text-gray-700 hover:bg-amber-50 flex items-center gap-2.5 transition-colors"
                      >
                        <Wand2 size={14} className="text-amber-500" />
                        Loyalty Rewards &amp; FX
                      </button>
                    )}
                    <div className="h-px bg-gray-100 mx-2 my-1" />
                    <button
                      onClick={() => { navigate('/invite'); setShowSettings(false); }}
                      className="w-full text-left px-3.5 py-2 text-sm text-gray-700 hover:bg-pink-50 flex items-center gap-2.5 transition-colors"
                    >
                      <Gift size={14} className="text-pink-500" />
                      Invite friends
                    </button>
                    <div className="h-px bg-gray-100 mx-2 my-1" />
                    <button
                      onClick={() => { navigate(`/pricing?returnTo=/chat?companion=${companionId}`); setShowSettings(false); }}
                      className="w-full text-left px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors"
                    >
                      <CreditCard size={14} className="text-blue-500" />
                      {currentTier === 'free' ? 'Upgrade plan' : 'Manage plan'}
                    </button>
                    <div className="h-px bg-gray-100 mx-2 my-1" />
                    <button
                      onClick={() => { onReset(); setShowSettings(false); }}
                      className="w-full text-left px-3.5 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors"
                    >
                      <RotateCcw size={14} />
                      Reset chat
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

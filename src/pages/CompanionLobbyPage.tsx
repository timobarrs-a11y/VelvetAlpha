import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, MessageCircle, Heart, Users, Crown, Cherry, Zap, Circle,
  Rocket, LogOut, Gamepad2, Lightbulb, FileText, User,
  UsersRound, Calendar, Squirrel, Youtube, Newspaper, Trash2, MessageSquare,
  Sparkles, Flame, Wand2, Trophy, Volume2, VolumeX, Anchor, Bot, MapPin, Brain,
} from 'lucide-react';
import { getExpertById } from '../config/signatureExperts';
import { useAudioScene } from '../hooks/useAudioScene';
import { useNavigationLoading } from '../context/NavigationLoadingContext';
import { supabase } from '../shared/supabase/client';
import { getCompanions, CompanionWithLastMessage } from '../services/companionService';
import { authService } from '../services/authService';
import FeedbackModal from '../components/FeedbackModal';
import { Avatar } from '../components/Avatar';
import { AvatarConfig, DEFAULT_MALE_AVATAR, DEFAULT_FEMALE_AVATAR } from '../types/avatar';
import { SubscriptionBanner } from '../components/SubscriptionBanner';
import { useSubscription } from '../hooks/useSubscription';
import { CreateGroupChatModal } from '../components/CreateGroupChatModal';
import { getGroupChats, createGroupChat, deleteGroupChat, GroupChatWithMembers } from '../services/groupChatService';
import { Button, ModalShell, LoadingState, EmptyState } from '../shared/ui';
import { toast } from '../shared/ui/Toast';
import { CustomizationPanel } from '../components/CustomizationPanel';
import { useCustomization } from '../hooks/useCustomization';
import { POINTER_SYMBOLS } from '../services/customizationService';
import { useMotivationalQuote } from '../hooks/useMotivationalQuote';


const GAMES = [
  { id: 'checkers',     name: 'Checkers',        description: 'Challenge an AI opponent with personality and trash talk',           icon: Crown,     iconBg: 'from-amber-500 to-orange-500',   path: '/checkers' },
  { id: 'momentum',     name: 'Momentum',        description: 'AI-generated platformer — each run has a unique hand-crafted world', icon: Zap,       iconBg: 'from-cyan-500 to-blue-600',      path: '/momentum' },
  { id: 'slime-soccer', name: 'Slime Soccer',    description: 'Classic physics-based slime soccer showdown',                        icon: Circle,    iconBg: 'from-fuchsia-500 to-pink-600',   path: '/slime-soccer' },
  { id: 'stellar',      name: 'Stellar Pursuit', description: 'Space shooter — navigate 9 sectors to rescue your family',          icon: Rocket,    iconBg: 'from-slate-600 to-slate-900',    path: '/stellar-pursuit' },
  { id: 'fox-runner',   name: "Luna's Run",      description: 'Side-scrolling platformer across 5 handcrafted worlds',              icon: Squirrel,  iconBg: 'from-emerald-500 to-teal-600',   path: '/fox-runner' },
  { id: 'money-grab',   name: 'Money Grab',      description: 'Race to collect cash while dodging hammers and your companion',      icon: Cherry,    iconBg: 'from-yellow-400 to-orange-500',  requiresCompanion: true },
  { id: 'home-run',     name: 'Home Run Derby',  description: 'Step into the batter\'s box — charge your swing, time the pitch, go yard', icon: Trophy,  iconBg: 'from-green-600 to-emerald-700', path: '/home-run-derby' },
  { id: 'zelda-ocean',  name: 'Wind & Waves',    description: 'Cel-shaded 3D ocean voyage — sail, dodge enemy ships, collect rupees',      icon: Anchor,  iconBg: 'from-sky-500 to-teal-600',      path: '/zelda-ocean' },
  { id: 'social-combat', name: 'Social Combat',  description: 'Read emotions and master the art of conversation',                   icon: Brain,     iconBg: 'from-violet-500 to-indigo-600',  path: '/social-combat' },
] as const;

const HUB_TILES = [
  {
    id: 'feed',
    label: 'Daily Feed',
    desc: 'News and articles tailored to your interests.',
    subDesc: 'Get curated news and content that matters to you, personalised by your companions based on your conversations and interests.',
    icon: Newspaper,
    solidBg: '#1a7a55',
    iconBg: 'rgba(255,255,255,0.18)',
    path: '/daily-feed',
    large: true,
  },
  {
    id: 'videos',
    label: 'Your Lens',
    desc: 'Videos curated for your interests.',
    icon: Youtube,
    solidBg: '#cc0000',
    iconBg: 'rgba(255,255,255,0.18)',
    path: '/videos',
    large: false,
  },
  {
    id: 'calendar',
    label: 'Calendar',
    desc: 'Events, reminders, and AI-suggested plans.',
    icon: Calendar,
    solidBg: 'linear-gradient(135deg, #e65100 0%, #f57c00 100%)',
    iconBg: 'rgba(255,255,255,0.18)',
    path: '/calendar',
    large: false,
  },
  {
    id: 'insights',
    label: 'Insights',
    desc: 'Conversation patterns and emotional trends.',
    icon: Lightbulb,
    solidBg: '#d4a017',
    iconBg: 'rgba(255,255,255,0.18)',
    path: '/insights',
    large: false,
  },
  {
    id: 'co-author',
    label: 'Co-Author',
    desc: 'Writing and research with your companion.',
    icon: FileText,
    solidBg: '#1565c0',
    iconBg: 'rgba(255,255,255,0.18)',
    path: '/co-author',
    large: false,
  },
  {
    id: 'group-chat',
    label: 'Group Chat',
    desc: 'Your companions chat together in one room.',
    icon: UsersRound,
    solidBg: '#6a1b9a',
    iconBg: 'rgba(255,255,255,0.18)',
    path: null,
    large: false,
    isGroupChat: true,
  },
  {
    id: 'atlas',
    label: 'Atlas',
    desc: 'Your AI chief of staff. Ask anything.',
    icon: Bot,
    solidBg: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
    iconBg: 'rgba(15,23,42,0.12)',
    path: '/atlas',
    large: false,
    atlasStyle: true,
    paired: true,
  },
  {
    id: 'navi',
    label: 'Navi',
    desc: 'Events, food & news near you.',
    icon: MapPin,
    solidBg: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)',
    iconBg: 'rgba(255,255,255,0.15)',
    path: '/local-explorer',
    large: false,
    paired: true,
    naviStyle: true,
  },
  {
    id: 'real-or-not',
    label: 'The Velvet Rope',
    desc: 'Step inside. Humans and AI share the same space — can you tell them apart?',
    icon: Zap,
    solidBg: 'linear-gradient(135deg, #4a0e1a 0%, #800020 100%)',
    iconBg: 'rgba(255,255,255,0.18)',
    path: '/real-or-not',
    large: false,
    wide: true,
  },
] as const;

function formatTimeAgo(timestamp: string) {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const mins  = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days  = Math.floor(diffMs / 86400000);
  if (mins  < 1)  return 'Just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 7)  return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

const NAV_CONFIGS: Record<string, { icon: typeof Newspaper; label: string; accentColor: string; bgColor: string }> = {
  '/daily-feed':  { icon: Newspaper,    label: 'Loading your feed...',      accentColor: '#34d399', bgColor: '#061412' },
  '/videos':      { icon: Youtube,      label: 'Loading Your Lens...',      accentColor: '#f43f5e', bgColor: '#120008' },
  '/calendar':    { icon: Calendar,     label: 'Loading your calendar...',  accentColor: '#fb923c', bgColor: '#120800' },
  '/insights':    { icon: Lightbulb,    label: 'Loading your insights...',  accentColor: '#38bdf8', bgColor: '#040d18' },
  '/co-author':   { icon: FileText,     label: 'Loading Co-Author...',      accentColor: '#60a5fa', bgColor: '#040c1a' },
  '/real-or-not': { icon: Zap,          label: 'Loading The Velvet Rope...', accentColor: '#fbbf24', bgColor: '#100c00' },
  '/atlas':          { icon: Bot,     label: 'Loading Atlas...',  accentColor: '#94a3b8', bgColor: '#050508' },
  '/local-explorer': { icon: MapPin, label: 'Loading Navi...',   accentColor: '#34d399', bgColor: '#050e0a' },
  '/profile':     { icon: User,         label: 'Loading your profile...',   accentColor: '#94a3b8', bgColor: '#0a0a0f' },
  '/lobby':       { icon: Heart,        label: 'Loading lobby...',          accentColor: '#f472b6', bgColor: '#0d1128' },
};

const GAME_CONFIGS: Record<string, { icon: typeof Crown; label: string; accentColor: string; bgColor: string }> = {
  '/checkers':        { icon: Crown,     label: 'Loading Checkers...',        accentColor: '#f59e0b', bgColor: '#120900' },
  '/momentum':        { icon: Zap,       label: 'Loading Momentum...',        accentColor: '#22d3ee', bgColor: '#040e14' },
  '/slime-soccer':    { icon: Circle,    label: 'Loading Slime Soccer...',    accentColor: '#e879f9', bgColor: '#110014' },
  '/stellar-pursuit': { icon: Rocket,    label: 'Loading Stellar Pursuit...', accentColor: '#818cf8', bgColor: '#05060f' },
  '/fox-runner':      { icon: Squirrel,  label: "Loading Luna's Run...",      accentColor: '#34d399', bgColor: '#040f0a' },
  '/home-run-derby':  { icon: Trophy,    label: 'Loading Home Run Derby...',  accentColor: '#34d399', bgColor: '#020e06' },
};

export function CompanionLobbyPage() {
  const navigate = useNavigate();
  const { navigateTo } = useNavigationLoading();
  const [companions, setCompanions] = useState<CompanionWithLastMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGameModal, setShowGameModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showCustomizationPanel, setShowCustomizationPanel] = useState(false);
  const [groupChats, setGroupChats] = useState<GroupChatWithMembers[]>([]);
  const { subscriptionInfo } = useSubscription();
  const {
    customization,
    checkedInToday,
    justUnlocked,
    activePointerDef,
    activeCursorColor,
    setPointer,
    setShowTrail,
    setTrailStyle,
    setAnimationStyle,
    setCursorColor,
    setButtonHoverStyle,
    setTranslucentUI,
    dismissUnlockNotice,
  } = useCustomization();

  const dailyQuote = useMotivationalQuote();
  const { muted, toggleMute } = useAudioScene();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate('/create-user-avatar'); return; }
    const [companionsList, groupsList] = await Promise.all([
      getCompanions(user.id),
      getGroupChats(),
    ]);
    setCompanions(companionsList);
    setGroupChats(groupsList);
    setLoading(false);
  };

  const handleCreateGroupChat = async (name: string, companionIds: string[]) => {
    const group = await createGroupChat(name, companionIds);
    if (group) navigateTo(`/group-chat?group=${group.id}`, {
      icon: UsersRound,
      label: 'Loading group chat...',
      accentColor: '#2dd4bf',
      bgColor: '#040e0c',
    });
  };

  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const handleDeleteGroupChat = async (groupId: string, groupName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmModal({
      title: 'Delete Group Chat',
      message: `Delete "${groupName}"? This will remove all messages.`,
      onConfirm: async () => {
        const ok = await deleteGroupChat(groupId);
        if (ok) setGroupChats(prev => prev.filter(g => g.id !== groupId));
        setConfirmModal(null);
      },
    });
  };

  const handleGroupChatClick = () => {
    if (companions.length < 2) {
      toast.error('Create at least 2 companions to start a group chat!');
    } else {
      setShowCreateGroupModal(true);
    }
  };

  const handleDeleteCompanion = async (companionId: string, companionName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmModal({
      title: 'Delete Companion',
      message: `Delete ${companionName}? This will remove all conversation history.`,
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('companions').delete().eq('id', companionId);
          if (error) throw error;
          setConfirmModal(null);
          await loadData();
        } catch {
          setConfirmModal(null);
          toast.error('Failed to delete companion. Please try again.');
        }
      },
    });
  };

  const handleNewCompanion = () => {
    navigate(companions.length > 0 ? '/create-additional-companion' : '/companion-path');
  };

  const handleGameClick = (game: typeof GAMES[number]) => {
    if (game.requiresCompanion) {
      setShowGameModal(true);
    } else if ('path' in game) {
      const cfg = GAME_CONFIGS[game.path];
      if (cfg) {
        navigateTo(game.path, cfg);
      } else {
        navigate(game.path);
      }
    }
  };

  const handleSignOut = async () => {
    await authService.signOut();
    navigate('/splash');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#090c1e' }}>
        <LoadingState label="Loading your lobby..." />
      </div>
    );
  }

  if (companions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#090c1e' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-sm w-full p-10 text-center rounded-3xl"
          style={{ background: 'rgba(28,25,48,0.90)', border: '1px solid rgba(80,70,130,0.40)' }}
        >
          <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-pink-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-glow">
            <Users className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-ink mb-3 font-display">Find Your First Companion</h2>
          <p className="text-ink-muted text-sm mb-8 leading-relaxed">
            Answer a few quick questions and we will match you with the perfect companion.
          </p>
          <Button fullWidth size="lg" onClick={handleNewCompanion}>Get Started</Button>
        </motion.div>
      </div>
    );
  }

  const largeTile = HUB_TILES.find(t => t.large);
  const smallTiles = HUB_TILES.filter(t => !t.large);

  return (
    <div className="min-h-screen" style={{
      background: 'linear-gradient(180deg, #0d1128 0%, #090c1e 50%, #060810 100%)',
    }}>
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 70% 40% at 50% 0%, rgba(40,60,180,0.18) 0%, transparent 60%),
            radial-gradient(ellipse 50% 30% at 10% 100%, rgba(244,63,107,0.07) 0%, transparent 50%)
          `,
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8">

        <AnimatePresence>
          {justUnlocked.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="mb-6 flex items-center gap-3 rounded-2xl px-5 py-4"
              style={{ background: 'rgba(244,63,107,0.12)', border: '1px solid rgba(244,63,107,0.35)' }}
            >
              <Sparkles className="w-5 h-5 text-primary-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-primary-300">
                  New pointer{justUnlocked.length > 1 ? 's' : ''} unlocked!
                </p>
                <p className="text-xs text-primary-400/80">
                  {justUnlocked.map(k => POINTER_SYMBOLS.find(s => s.key === k)?.label).join(', ')} — open Loyalty Rewards to try {justUnlocked.length > 1 ? 'them' : 'it'} out
                </p>
              </div>
              <button onClick={dismissUnlockNotice} className="text-primary-400 hover:text-primary-300 transition-colors text-lg leading-none">&times;</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-pink-400 flex-shrink-0" fill="currentColor" style={{ filter: 'drop-shadow(0 0 6px rgba(244,114,182,0.70))' }} />
            <h1
              className="text-3xl md:text-4xl font-bold font-display"
              style={{
                background: 'linear-gradient(135deg, #f472b6 0%, #c084fc 45%, #818cf8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 2px 8px rgba(192,132,252,0.45))',
              }}
            >
              Velvet Lobby
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={toggleMute}
              title={muted ? 'Unmute music' : 'Mute music'}
              className="flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 text-blue-200/70 hover:text-blue-200"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setShowCustomizationPanel(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 text-blue-200 hover:text-white"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              <Wand2 className="w-4 h-4 text-pink-400" />
              <span className="hidden sm:inline">Loyalty Rewards</span>
            </button>
            <button
              onClick={() => navigateTo('/profile', NAV_CONFIGS['/profile'])}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 text-blue-200 hover:text-white"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Profile</span>
            </button>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 text-blue-200/60 hover:text-blue-200"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {dailyQuote && (
          <div className="mb-6 text-center px-4">
            <p className="text-blue-100/60 text-sm md:text-base italic leading-relaxed max-w-2xl mx-auto">
              &ldquo;{dailyQuote.text}&rdquo;
              {dailyQuote.author && dailyQuote.author !== 'Velvet' && (
                <span className="not-italic text-blue-200/35 text-xs ml-2">— {dailyQuote.author}</span>
              )}
            </p>
            <div className="flex items-center justify-center gap-3 mt-2">
              {customization && customization.current_streak > 0 && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{ background: 'rgba(245,158,11,0.18)', color: '#fbbf24' }}>
                  <Flame className="w-3 h-3" />
                  {customization.current_streak}d streak
                </span>
              )}
              {checkedInToday && customization && customization.current_streak === 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{ background: 'rgba(34,197,94,0.20)', color: '#4ade80' }}>Checked in</span>
              )}
            </div>
          </div>
        )}

        {!dailyQuote && (customization?.current_streak ?? 0) > 0 && (
          <div className="mb-6 flex justify-center">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
              style={{ background: 'rgba(245,158,11,0.18)', color: '#fbbf24' }}>
              <Flame className="w-3 h-3" />
              {customization!.current_streak}d streak
            </span>
          </div>
        )}

        {subscriptionInfo && (
          <div className="mb-8">
            <SubscriptionBanner tier={subscriptionInfo.tier} messagesRemaining={subscriptionInfo.messagesRemaining} />
          </div>
        )}

        {/* Hub Feature Tiles */}
        <section className="mb-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
            {/* Large Daily Feed tile */}
            {largeTile && (
              <motion.button
                key={largeTile.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => { const cfg = NAV_CONFIGS[largeTile.path]; cfg ? navigateTo(largeTile.path, cfg) : navigate(largeTile.path); }}
                className="group text-left rounded-2xl p-6 transition-all duration-300 relative overflow-hidden hover:brightness-110"
                style={{ background: largeTile.solidBg, minHeight: 140 }}
              >
                <div className="flex items-start gap-4 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: largeTile.iconBg }}>
                    <largeTile.icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white font-display">{largeTile.label}</h3>
                    <p className="text-sm text-white/70 mt-0.5">{largeTile.desc}</p>
                  </div>
                </div>
                {'subDesc' in largeTile && largeTile.subDesc && (
                  <p className="text-sm text-white/55 leading-relaxed mt-3">{largeTile.subDesc}</p>
                )}
              </motion.button>
            )}

            {/* Your Lens tile — large on right */}
            {smallTiles.filter(t => t.id === 'videos').map((tile) => {
              const handleClick = () => { const p = tile.path!; const cfg = NAV_CONFIGS[p]; cfg ? navigateTo(p, cfg) : navigate(p); };
              return (
                <motion.button
                  key={tile.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  onClick={handleClick}
                  className="group text-left rounded-2xl p-6 transition-all duration-300 relative overflow-hidden hover:brightness-110"
                  style={{ background: tile.solidBg, minHeight: 140 }}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: tile.iconBg }}>
                      <tile.icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white font-display">{tile.label}</h3>
                      <p className="text-sm text-white/70 mt-0.5">{tile.desc}</p>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Bottom row — Calendar, Insights, Co-Author, Group Chat */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {smallTiles.filter(t => t.id !== 'videos' && !('wide' in t && t.wide) && !('paired' in t && t.paired)).map((tile, i) => {
              const locked = tile.isGroupChat && companions.length < 2;
              const handleClick = tile.isGroupChat ? handleGroupChatClick : () => { const p = tile.path!; const cfg = NAV_CONFIGS[p]; cfg ? navigateTo(p, cfg) : navigate(p); };
              return (
                <motion.button
                  key={tile.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: (i + 2) * 0.05 }}
                  onClick={handleClick}
                  className={`group text-left rounded-2xl p-4 transition-all duration-300 relative overflow-hidden hover:brightness-110 ${locked ? 'opacity-60' : ''}`}
                  style={{ background: tile.solidBg, minHeight: 100 }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: tile.iconBg }}>
                      <tile.icon className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-bold text-white font-display text-sm leading-tight">{tile.label}</h3>
                  </div>
                  <p className="text-xs text-white/65 leading-relaxed pl-0.5">{tile.desc}</p>
                  {tile.isGroupChat && groupChats.length > 0 && (
                    <span className="absolute top-3 right-3 px-1.5 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white">
                      {groupChats.length}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Paired tiles — Atlas + Navi side by side */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            {smallTiles.filter(t => 'paired' in t && t.paired).map((tile, i) => {
              const isAtlas = 'atlasStyle' in tile && tile.atlasStyle;
              const isNavi = 'naviStyle' in tile && tile.naviStyle;
              return (
                <motion.button
                  key={tile.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 + i * 0.07 }}
                  onClick={() => { const p = tile.path!; const cfg = NAV_CONFIGS[p]; cfg ? navigateTo(p, cfg) : navigate(p); }}
                  className="group text-left rounded-2xl p-4 transition-all duration-300 relative overflow-hidden hover:brightness-105"
                  style={{ background: tile.solidBg, minHeight: 100 }}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                    style={{ background: isAtlas ? 'rgba(15,23,42,0.10)' : tile.iconBg }}>
                    <tile.icon className={`w-4.5 h-4.5 ${isAtlas ? 'text-slate-700' : 'text-white'}`} style={{ width: 18, height: 18 }} />
                  </div>
                  <h3 className={`font-bold font-display text-sm leading-tight ${isAtlas ? 'text-slate-800' : 'text-white'}`}>
                    {tile.label}
                  </h3>
                  <p className={`text-xs mt-1 leading-snug ${isAtlas ? 'text-slate-500' : 'text-white/60'}`}>
                    {tile.desc}
                  </p>
                  {isAtlas && (
                    <span className="mt-2 inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200 text-slate-500 border border-slate-300/50">
                      AI Agent
                    </span>
                  )}
                  {isNavi && (
                    <span className="mt-2 inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-900/60 text-emerald-300 border border-emerald-700/40">
                      Live search
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Wide banner tiles — Velvet Rope */}
          <div className="mt-3 space-y-3">
          {smallTiles.filter(t => 'wide' in t && t.wide).map((tile, i) => {
            return (
              <motion.button
                key={tile.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.42 + i * 0.07 }}
                onClick={() => { const p = tile.path!; const cfg = NAV_CONFIGS[p]; cfg ? navigateTo(p, cfg) : navigate(p); }}
                className="w-full group text-left rounded-2xl p-5 transition-all duration-300 relative overflow-hidden hover:brightness-105"
                style={{ background: tile.solidBg, minHeight: 90 }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: tile.iconBg }}>
                    <tile.icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold font-display text-base leading-tight text-white">
                      {tile.label}
                    </h3>
                    <p className="text-sm mt-0.5 text-white/65">
                      {tile.desc}
                    </p>
                  </div>
                </div>
              </motion.button>
            );
          })}
          </div>
        </section>

        {/* Companions */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-5">
            <MessageCircle className="w-5 h-5 text-primary-400" />
            <h2 className="text-xl font-bold text-ink font-display">Your Companions</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {companions.map((companion, i) => (
              <motion.div key={companion.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => navigateTo(`/chat?companion=${companion.id}`, {
                  icon: MessageCircle,
                  label: `Loading ${companion.name}...`,
                  accentColor: companion.favorite_color || '#f472b6',
                  bgColor: '#0a0410',
                })}
                data-interactive
                className="group overflow-hidden cursor-pointer transition-all duration-300 rounded-2xl"
                style={{
                  background: 'rgba(28,25,48,0.90)',
                  border: '1px solid rgba(80,70,130,0.35)',
                  boxShadow: '0 2px 16px rgba(0,0,0,0.30)',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(244,63,107,0.45)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(80,70,130,0.35)')}
              >
                <div className="relative h-44 overflow-hidden" style={{ background: 'rgba(20,17,40,0.90)' }}>
                  <Avatar
                    config={(companion.avatar_config as AvatarConfig) ?? (companion.gender === 'male' ? DEFAULT_MALE_AVATAR : DEFAULT_FEMALE_AVATAR)}
                    className="w-full h-full"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <button
                    onClick={(e) => handleDeleteCompanion(companion.id, companion.custom_name, e)}
                    className="absolute top-2.5 left-2.5 p-1.5 bg-danger-500/90 hover:bg-danger-600 text-white rounded-lg shadow-card opacity-0 group-hover:opacity-100 transition-all z-10"
                    title="Delete companion">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <span className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 ${
                    companion.relationship_type === 'romantic'
                      ? 'bg-pink-900/80 text-pink-300'
                      : companion.relationship_type === 'mentor'
                      ? 'bg-emerald-900/80 text-emerald-300'
                      : 'bg-sky-900/80 text-sky-300'
                  }`}>
                    {companion.relationship_type === 'romantic'
                      ? <><Heart className="w-2.5 h-2.5" /> Partner</>
                      : companion.relationship_type === 'mentor'
                      ? <><Brain className="w-2.5 h-2.5" /> Mentor</>
                      : <><Users className="w-2.5 h-2.5" /> Friend</>
                    }
                  </span>
                  {companion.signature_expert && (
                    <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 bg-indigo-900/80 text-indigo-300">
                      <Brain className="w-2.5 h-2.5" />
                      {companion.signature_expert_source === 'curated'
                        ? (getExpertById(companion.signature_expert)?.domain ?? 'Expert')
                        : 'Expert'}
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <h3
                    className="font-semibold text-ink mb-1.5 group-hover:text-primary-300 transition-colors"
                    style={{ fontFamily: companion.font_family ?? undefined, fontSize: '1rem', lineHeight: 1.3 }}
                  >
                    {companion.custom_name}
                  </h3>
                  {companion.current_status && (
                    <p className="text-xs mb-3 flex items-center gap-1.5"
                      style={{
                        color: 'rgba(180,210,200,0.85)',
                        fontFamily: companion.font_family ?? undefined,
                        lineHeight: 1.45,
                      }}>
                      <span className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#4ade80' }} />
                      {companion.current_status}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs text-ink-subtle pt-3"
                    style={{ borderTop: '1px solid rgba(80,70,130,0.25)' }}>
                    <span>{formatTimeAgo(companion.last_message_at)}</span>
                    {(companion.unread_count ?? 0) > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full font-bold"
                        style={{ background: 'rgba(244,63,107,0.25)', color: '#fb7185' }}>
                        {companion.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: companions.length * 0.04 }}
              onClick={handleNewCompanion}
              data-interactive
              className="group cursor-pointer transition-all duration-300 flex items-center justify-center min-h-[260px] rounded-2xl"
              style={{
                background: 'rgba(28,25,48,0.60)',
                border: '2px dashed rgba(80,70,130,0.40)',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(244,63,107,0.50)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(80,70,130,0.40)')}
            >
              <div className="text-center p-6">
                <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-pink-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-glow group-hover:scale-105 transition-transform">
                  <Plus className="w-7 h-7 text-white" />
                </div>
                <p className="font-semibold text-ink group-hover:text-primary-300 transition-colors font-display text-sm">Find Another Match</p>
                <p className="text-xs text-ink-muted mt-1">Add a new companion</p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Group chats */}
        {groupChats.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <UsersRound className="w-5 h-5 text-teal-400" />
                <h2 className="text-xl font-bold text-ink font-display">Group Chats</h2>
              </div>
              <button
                onClick={handleGroupChatClick}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-medium transition-all"
                style={{ background: 'rgba(20,184,166,0.15)', border: '1px solid rgba(20,184,166,0.30)', color: '#2dd4bf' }}
              >
                <Plus className="w-3.5 h-3.5" /> New Group
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupChats.map((group, i) => (
                <motion.div key={group.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => navigateTo(`/group-chat?group=${group.id}`, { icon: UsersRound, label: 'Loading group chat...', accentColor: '#2dd4bf', bgColor: '#040e0c' })}
                  data-interactive
                  className="group cursor-pointer transition-all duration-300 relative rounded-2xl p-5"
                  style={{
                    background: 'rgba(28,25,48,0.85)',
                    border: '1px solid rgba(20,184,166,0.25)',
                    boxShadow: '0 2px 16px rgba(0,0,0,0.25)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(20,184,166,0.50)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(20,184,166,0.25)')}
                >
                  <button
                    onClick={(e) => handleDeleteGroupChat(group.id, group.name, e)}
                    className="absolute top-3 right-3 p-1.5 bg-danger-500/90 hover:bg-danger-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all z-10">
                    <Trash2 className="w-3 h-3" />
                  </button>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex -space-x-2">
                      {group.members.slice(0, 3).map((member, mi) => (
                        <div key={member.id} className="w-9 h-9 rounded-full overflow-hidden"
                          style={{ border: '2px solid rgba(28,25,48,0.90)', zIndex: 3 - mi }}>
                          <Avatar
                            config={(member.companion?.avatar_config as AvatarConfig) ?? (member.companion?.gender === 'male' ? DEFAULT_MALE_AVATAR : DEFAULT_FEMALE_AVATAR)}
                            className="w-full h-full"
                          />
                        </div>
                      ))}
                      {group.members.length > 3 && (
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs text-ink-muted font-bold"
                          style={{ background: 'rgba(49,45,85,0.90)', border: '2px solid rgba(28,25,48,0.90)' }}>
                          +{group.members.length - 3}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-ink truncate group-hover:text-teal-300 transition-colors font-display text-sm">{group.name}</h3>
                      <p className="text-xs text-ink-muted truncate">{group.members.map(m => m.companion?.custom_name).filter(Boolean).join(', ')}</p>
                    </div>
                  </div>
                  {group.last_message && (
                    <p className="text-xs text-ink-muted truncate mb-2">
                      <span className="font-medium text-ink-subtle">{group.last_message.sender_name}:</span>{' '}
                      {group.last_message.content}
                    </p>
                  )}
                  <p className="text-xs text-ink-subtle pt-2"
                    style={{ borderTop: '1px solid rgba(80,70,130,0.25)' }}>
                    {formatTimeAgo(group.updated_at)}
                  </p>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Games */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <Gamepad2 className="w-5 h-5 text-ink-muted" />
            <h2 className="text-xl font-bold text-ink font-display">Games & Activities</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold tracking-wide"
              style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>
              Under Development
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {GAMES.map((game, i) => (
              <motion.div key={game.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => handleGameClick(game)}
                data-interactive
                className="group cursor-pointer transition-all duration-300 rounded-2xl p-5"
                style={{
                  background: 'rgba(28,25,48,0.85)',
                  border: '1px solid rgba(80,70,130,0.30)',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(120,90,180,0.55)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(80,70,130,0.30)')}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${game.iconBg} flex items-center justify-center shadow-soft flex-shrink-0 group-hover:scale-105 group-hover:rotate-2 transition-transform`}>
                    <game.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-ink font-display text-sm group-hover:text-ink transition-colors">{game.name}</h3>
                    <p className="text-xs text-ink-muted mt-0.5 leading-relaxed">{game.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        <div className="h-16" />
      </div>

      {/* Game partner modal */}
      <ModalShell isOpen={showGameModal} onClose={() => setShowGameModal(false)} title="Choose Your Partner" size="md">
        <p className="text-sm text-ink-muted mb-5">Select a companion to play with:</p>
        {companions.length === 0 ? (
          <EmptyState icon={<Users className="w-8 h-8" />} title="No companions yet" description="Create a companion first to play games together." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {companions.map(companion => (
              <motion.button key={companion.id}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                onClick={() => { setShowGameModal(false); navigateTo(`/pacman?companion=${companion.id}`, { icon: Gamepad2, label: 'Loading game...', accentColor: '#facc15', bgColor: '#0a0900' }); }}
                className="rounded-2xl p-4 text-left transition-all duration-150"
                style={{ background: 'rgba(40,36,68,0.90)', border: '1px solid rgba(80,70,130,0.40)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0" style={{ background: 'rgba(20,17,40,0.90)' }}>
                    <Avatar
                      config={(companion.avatar_config as AvatarConfig) ?? (companion.gender === 'male' ? DEFAULT_MALE_AVATAR : DEFAULT_FEMALE_AVATAR)}
                      className="w-full h-full"
                    />
                  </div>
                  <div>
                    <p className="font-semibold text-ink font-display text-sm">{companion.custom_name}</p>
                    <span className={`mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      companion.relationship_type === 'romantic'
                        ? 'bg-pink-900/60 text-pink-300'
                        : companion.relationship_type === 'mentor'
                        ? 'bg-emerald-900/60 text-emerald-300'
                        : 'bg-sky-900/60 text-sky-300'
                    }`}>
                      {companion.relationship_type === 'romantic'
                        ? <><Heart className="w-2.5 h-2.5" /> Partner</>
                        : companion.relationship_type === 'mentor'
                        ? <><Brain className="w-2.5 h-2.5" /> Mentor</>
                        : <><Users className="w-2.5 h-2.5" /> Friend</>
                      }
                    </span>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </ModalShell>

      <motion.button
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, type: 'spring' }}
        onClick={() => setShowFeedbackModal(true)}
        className="fixed bottom-6 right-6 w-13 h-13 bg-gradient-to-br from-primary-500 to-pink-500 hover:from-primary-600 hover:to-pink-600 text-white rounded-full shadow-glow hover:shadow-glow-lg transition-all duration-200 flex items-center justify-center z-40 group"
        title="Send Feedback">
        <MessageSquare className="w-5 h-5 group-hover:scale-110 transition-transform" />
      </motion.button>

      <FeedbackModal isOpen={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} />
      <CreateGroupChatModal
        isOpen={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        companions={companions}
        onCreateGroup={handleCreateGroupChat}
      />

      <ModalShell isOpen={!!confirmModal} onClose={() => setConfirmModal(null)} title={confirmModal?.title ?? ''} size="sm">
        <p className="text-sm text-ink-muted mb-6">{confirmModal?.message}</p>
        <div className="flex gap-3 justify-end">
          <Button variant="ghost" size="sm" onClick={() => setConfirmModal(null)}>Cancel</Button>
          <Button variant="danger" size="sm" onClick={() => confirmModal?.onConfirm()}>Delete</Button>
        </div>
      </ModalShell>

      {customization && (
        <CustomizationPanel
          isOpen={showCustomizationPanel}
          onClose={() => setShowCustomizationPanel(false)}
          customization={customization}
          companions={companions}
          onSetPointer={setPointer}
          onSetShowTrail={setShowTrail}
          onSetTrailStyle={setTrailStyle}
          onSetAnimationStyle={setAnimationStyle}
          onSetCursorColor={setCursorColor}
          onSetButtonHoverStyle={setButtonHoverStyle}
          onSetTranslucentUI={setTranslucentUI}
          onCompanionFontUpdated={(companionId, fontFamily) => {
            setCompanions(prev =>
              prev.map(c => c.id === companionId ? { ...c, font_family: fontFamily } : c)
            );
          }}
        />
      )}

    </div>
  );
}

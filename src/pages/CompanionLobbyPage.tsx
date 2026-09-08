import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle, Heart, Users, Crown, Cherry, Zap, Circle,
  Rocket, LogOut, Gamepad2, Lightbulb, FileText, User,
  UsersRound, Calendar, Youtube, Newspaper, MessageSquare,
  Info, Plus,
  Sparkles, Flame, Wand2, Volume2, VolumeX, Bot, MapPin, Brain,
  HelpCircle,
} from 'lucide-react';
import { getCorrespondentById } from '../config/signatureCorrespondents';
import { correspondentSyncService } from '../services/correspondentSyncService';
import { useAudioScene } from '../hooks/useAudioScene';
import { useNavigationLoading } from '../context/NavigationLoadingContext';
import { supabase } from '../shared/supabase/client';
import { getCompanions, CompanionWithLastMessage } from '../services/companionService';
import { authService } from '../services/authService';
import FeedbackModal from '../components/FeedbackModal';
import { Avatar } from '../components/Avatar';
import { SubscriptionBanner } from '../components/SubscriptionBanner';
import { useSubscription } from '../hooks/useSubscription';
import { CreateGroupChatModal } from '../components/CreateGroupChatModal';
import { getGroupChats, createGroupChat, deleteGroupChat, GroupChatWithMembers } from '../services/groupChatService';
import {
  Button, ModalShell, LoadingState, EmptyState,
  PageShell, Pill, SectionHeader, Badge, DesignVariantSwitch,
} from '../shared/ui';
import { toast } from '../shared/ui/Toast';
import { CustomizationPanel } from '../components/CustomizationPanel';
import { useCustomization } from '../hooks/useCustomization';
import { POINTER_SYMBOLS } from '../services/customizationService';
import { useMotivationalQuote } from '../hooks/useMotivationalQuote';
import { newsService } from '../services/newsService';
import {
  HubTile, CompanionCard, AddCompanionCard, GroupChatCard, GameCard,
  TONE_COLOR, GROUP_TONE, companionAvatarConfig,
} from '../components/lobby';
import type { HubTileSize } from '../components/lobby';

interface GameEntry {
  id: string;
  name: string;
  description: string;
  icon: typeof Crown;
  iconBg: string;
  path?: string;
  requiresCompanion?: boolean;
}

const GAMES: GameEntry[] = [
  { id: 'checkers',     name: 'Checkers',        description: 'Challenge an AI opponent with personality and banter',           icon: Crown,     iconBg: 'from-amber-500 to-orange-500',   path: '/checkers' },
  { id: 'momentum',     name: 'Momentum',        description: 'AI-generated platformer — each run has a unique hand-crafted world', icon: Zap,       iconBg: 'from-cyan-500 to-blue-600',      path: '/momentum' },
  { id: 'slime-soccer', name: 'Slime Soccer',    description: 'Classic physics-based slime soccer showdown',                        icon: Circle,    iconBg: 'from-fuchsia-500 to-pink-600',   path: '/slime-soccer' },
  { id: 'stellar',      name: 'Stellar Pursuit', description: 'Space shooter — navigate 9 sectors to rescue your family',          icon: Rocket,    iconBg: 'from-slate-600 to-slate-900',    path: '/stellar-pursuit' },
  { id: 'money-grab',   name: 'Money Grab',      description: 'Race to collect cash while dodging hammers and your companion',      icon: Cherry,    iconBg: 'from-yellow-400 to-orange-500',  requiresCompanion: true },
  { id: 'social-combat',  name: 'Social Combat',   description: 'Read emotions and master the art of conversation',                           icon: Brain,   iconBg: 'from-violet-500 to-indigo-600', path: '/social-combat' },
];

/**
 * Hub feature tiles.
 *  - `accent`  drives variant B tint + the navigation splash colour.
 *  - `solidBg` is the variant-A (current design) solid background.
 *  - `slot`    places the tile in the hub layout.
 */
interface HubTileDef {
  id: string;
  label: string;
  desc: string;
  subDesc?: string;
  icon: typeof Newspaper;
  accent: string;
  solidBg: string;
  light?: boolean;
  path: string | null;
  slot: 'hero' | 'row' | 'paired' | 'wide';
  size: HubTileSize;
  isGroupChat?: boolean;
  tag?: { label: string; tone: string };
}

const HUB_TILES: HubTileDef[] = [
  {
    id: 'feed', label: 'Daily Feed',
    desc: 'News and articles tailored to your interests.',
    subDesc: 'Get curated news and content that matters to you, personalised by your companions based on your conversations and interests.',
    icon: Newspaper, accent: '#34d399', solidBg: '#1a7a55', path: '/daily-feed', slot: 'hero', size: 'large',
  },
  {
    id: 'videos', label: 'Your Lens', desc: 'Videos curated for your interests.',
    icon: Youtube, accent: '#fb7185', solidBg: '#cc0000', path: '/videos', slot: 'hero', size: 'medium',
  },
  {
    id: 'calendar', label: 'Calendar', desc: 'Events, reminders, and AI-suggested plans.',
    icon: Calendar, accent: '#fb923c', solidBg: 'linear-gradient(135deg, #e65100 0%, #f57c00 100%)', path: '/calendar', slot: 'row', size: 'small',
  },
  {
    id: 'insights', label: 'Insights', desc: 'Conversation patterns and emotional trends.',
    icon: Lightbulb, accent: '#fbbf24', solidBg: '#d4a017', path: '/insights', slot: 'row', size: 'small',
  },
  {
    id: 'co-author', label: 'Co-Author', desc: 'Writing and research with your companion.',
    icon: FileText, accent: '#60a5fa', solidBg: '#1565c0', path: '/co-author', slot: 'row', size: 'small',
  },
  {
    id: 'group-chat', label: 'Group Chat', desc: 'Your companions chat together in one room.',
    icon: UsersRound, accent: '#c084fc', solidBg: '#6a1b9a', path: null, slot: 'row', size: 'small', isGroupChat: true,
  },
  {
    id: 'atlas', label: 'Atlas', desc: 'Your AI chief of staff. Ask anything.',
    icon: Bot, accent: '#cbd5e1', solidBg: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', light: true,
    path: '/atlas', slot: 'paired', size: 'small', tag: { label: 'AI Agent', tone: '#94a3b8' },
  },
  {
    id: 'navi', label: 'Navi', desc: 'Events, food & news near you.',
    icon: MapPin, accent: '#34d399', solidBg: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)',
    path: '/local-explorer', slot: 'paired', size: 'small', tag: { label: 'Live search', tone: '#34d399' },
  },
  {
    id: 'real-or-not', label: 'The Velvet Rope',
    desc: 'Step inside. Humans and AI share the same space — can you tell them apart?',
    icon: Zap, accent: '#f43f6b', solidBg: 'linear-gradient(135deg, #4a0e1a 0%, #800020 100%)', path: '/real-or-not', slot: 'wide', size: 'wide',
  },
];

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

  const refreshDailyFeedInBackground = async () => {
    try {
      const now = Date.now();
      const SIX_HOURS = 6 * 60 * 60 * 1000;
      const last = Number(sessionStorage.getItem('velvet_lobby_news_refresh') || 0);
      if (now - last < SIX_HOURS) return;
      sessionStorage.setItem('velvet_lobby_news_refresh', String(now));

      const interests = await newsService.getUserAllInterests();
      if (interests.length === 0) return;
      await newsService.fetchLatestNews(interests);
    } catch {
      /* best-effort background refresh */
    }
  };

  const syncCorrespondentsInBackground = async () => {
    try {
      const now = Date.now();
      const ONE_HOUR = 60 * 60 * 1000;
      const last = Number(sessionStorage.getItem('velvet_correspondent_sync') || 0);
      if (now - last < ONE_HOUR) return;
      sessionStorage.setItem('velvet_correspondent_sync', String(now));

      const result = await correspondentSyncService.sync();
      if (result && result.success && (result.created.length > 0 || result.removed.length > 0)) {
        // Reload companions if correspondents were added or removed
        await loadData();
        if (result.created.length > 0) {
          const names = result.created.map(id => getCorrespondentById(id)?.name || id);
          toast.success(`${names.join(', ')} ${result.created.length > 1 ? 'are' : 'is'} now writing for you!`);
        }
      }
    } catch {
      /* best-effort background sync */
    }
  };

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
    refreshDailyFeedInBackground();
    syncCorrespondentsInBackground();
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

  const handleNewCoach = () => {
    sessionStorage.setItem('onboardingIntent', 'coaches');
    sessionStorage.setItem('onboardingRelationshipType', 'mentor');
    navigate('/expert-selection');
  };

  const handleGameClick = (game: GameEntry) => {
    if (game.requiresCompanion) {
      setShowGameModal(true);
    } else if (game.path) {
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


  const openHubPath = (p: string) => {
    const cfg = NAV_CONFIGS[p];
    if (cfg) navigateTo(p, cfg); else navigate(p);
  };

  const handleTileClick = (tile: HubTileDef) => {
    if (tile.isGroupChat) { handleGroupChatClick(); return; }
    if (tile.path) openHubPath(tile.path);
  };

  const openCompanion = (companion: CompanionWithLastMessage) => {
    const tone = companion.relationship_type === 'mentor'
      ? { icon: MessageCircle, label: `Loading ${companion.custom_name || 'your coach'}...`, accentColor: TONE_COLOR.coach, bgColor: '#020e08' }
      : companion.relationship_type === 'correspondent'
        ? { icon: Newspaper, label: `Loading ${companion.custom_name || 'your correspondent'}...`, accentColor: '#f59e0b', bgColor: '#120c00' }
        : { icon: MessageCircle, label: `Loading ${companion.custom_name || 'your companion'}...`, accentColor: companion.favorite_color || TONE_COLOR.voice, bgColor: '#0a0410' };
    navigateTo(`/chat?companion=${companion.id}`, tone);
  };

  const openGroup = (groupId: string) => {
    navigateTo(`/group-chat?group=${groupId}`, { icon: UsersRound, label: 'Loading group chat...', accentColor: GROUP_TONE, bgColor: '#040e0c' });
  };

  if (loading) {
    return (
      <PageShell center>
        <LoadingState label="Loading your lobby..." />
      </PageShell>
    );
  }

  if (companions.length === 0) {
    return (
      <PageShell center>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="ds-card max-w-sm w-full p-10 text-center rounded-3xl"
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
      </PageShell>
    );
  }

  const heroTiles   = HUB_TILES.filter(t => t.slot === 'hero');
  const rowTiles    = HUB_TILES.filter(t => t.slot === 'row');
  const pairedTiles = HUB_TILES.filter(t => t.slot === 'paired');
  const wideTiles   = HUB_TILES.filter(t => t.slot === 'wide');

  const voices         = companions.filter(c => c.relationship_type !== 'mentor' && c.relationship_type !== 'correspondent');
  const coaches        = companions.filter(c => c.relationship_type === 'mentor');
  const correspondents = companions.filter(c => c.relationship_type === 'correspondent');

  const renderTile = (tile: HubTileDef, delay: number) => (
    <HubTile
      key={tile.id}
      label={tile.label}
      desc={tile.desc}
      subDesc={tile.subDesc}
      icon={tile.icon}
      accent={tile.accent}
      solidBg={tile.solidBg}
      light={tile.light}
      size={tile.size}
      locked={tile.isGroupChat && companions.length < 2}
      count={tile.isGroupChat ? groupChats.length : undefined}
      tag={tile.tag ? <Badge size="xs" tone={tile.tag.tone}>{tile.tag.label}</Badge> : undefined}
      onClick={() => handleTileClick(tile)}
      delay={delay}
    />
  );

  return (
    <PageShell width="2xl" contentClassName="pb-24">

      <AnimatePresence>
        {justUnlocked.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="mb-6 flex items-center gap-3 rounded-2xl px-5 py-4"
            style={{ background: 'var(--ds-accent-soft)', border: '1px solid var(--ds-accent-line)' }}
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
            <button onClick={dismissUnlockNotice} className="text-primary-400 hover:text-primary-300 transition-colors text-lg leading-none" aria-label="Dismiss">&times;</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <Heart className="w-5 h-5 text-pink-400 flex-shrink-0" fill="currentColor" style={{ filter: 'drop-shadow(0 0 6px rgba(244,114,182,0.70))' }} />
          <h1 className="ds-title-gradient text-3xl md:text-4xl font-bold font-display truncate">Velvet Lobby</h1>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
          <DesignVariantSwitch mode="compact" className="hidden md:inline-flex" />
          <Pill
            onClick={toggleMute}
            title={muted ? 'Unmute music' : 'Mute music'}
            aria-label={muted ? 'Unmute music' : 'Mute music'}
            icon={muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          />
          <Pill
            onClick={() => setShowCustomizationPanel(true)}
            icon={<Wand2 className="w-4 h-4 text-pink-400" />}
            hideLabelOnMobile
          >
            Loyalty Rewards
          </Pill>
          {companions.length > 0 && (
            <Pill
              onClick={() => navigateTo(`/chat?companion=${companions[0].id}&tour=1`, {
                icon: MessageCircle, label: 'Starting the tour...',
                accentColor: '#f472b6', bgColor: '#0a0410',
              })}
              icon={<HelpCircle className="w-4 h-4 text-sky-300" />}
              hideLabelOnMobile
            >
              Tour
            </Pill>
          )}
          <Pill
            onClick={() => navigateTo('/profile', NAV_CONFIGS['/profile'])}
            icon={<User className="w-4 h-4" />}
            hideLabelOnMobile
          >
            Profile
          </Pill>
          <Pill
            variant="quiet"
            onClick={handleSignOut}
            title="Sign out"
            aria-label="Sign out"
            icon={<LogOut className="w-4 h-4" />}
          />
        </div>
      </header>

      {dailyQuote && (
        <div className="mb-6 text-center px-4">
          <p className="text-sm md:text-base italic leading-relaxed max-w-2xl mx-auto" style={{ color: 'var(--ds-quote-fg)' }}>
            &ldquo;{dailyQuote.text}&rdquo;
            {dailyQuote.author && dailyQuote.author !== 'Velvet' && (
              <span className="not-italic text-xs ml-2" style={{ color: 'var(--ds-quote-by)' }}>— {dailyQuote.author}</span>
            )}
          </p>
          <div className="flex items-center justify-center gap-3 mt-2">
            {customization && customization.current_streak > 0 && (
              <Badge tone="#fbbf24" icon={<Flame className="w-3 h-3" />}>{customization.current_streak}d streak</Badge>
            )}
            {checkedInToday && customization && customization.current_streak === 0 && (
              <Badge tone="#4ade80">Checked in</Badge>
            )}
          </div>
        </div>
      )}

      {!dailyQuote && (customization?.current_streak ?? 0) > 0 && (
        <div className="mb-6 flex justify-center">
          <Badge tone="#fbbf24" icon={<Flame className="w-3 h-3" />}>{customization!.current_streak}d streak</Badge>
        </div>
      )}

      {subscriptionInfo && (
        <div className="mb-8">
          <SubscriptionBanner tier={subscriptionInfo.tier} messagesRemaining={subscriptionInfo.messagesRemaining} />
        </div>
      )}

      {/* Hub Feature Tiles */}
      <section className="mb-10" aria-label="Features">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
          {heroTiles.map((tile, i) => renderTile(tile, i * 0.05))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {rowTiles.map((tile, i) => renderTile(tile, (i + 2) * 0.05))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          {pairedTiles.map((tile, i) => renderTile(tile, 0.35 + i * 0.07))}
        </div>

        <div className="mt-3 space-y-3">
          {wideTiles.map((tile, i) => renderTile(tile, 0.42 + i * 0.07))}
        </div>
      </section>

      {/* Velvet Voices — non-mentor companions */}
      <section className="mb-10" aria-labelledby="voices-title">
        <SectionHeader icon={MessageCircle} tone={TONE_COLOR.voice} title={<span id="voices-title">Velvet Voices</span>} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {voices.map((companion, i) => (
            <CompanionCard
              key={companion.id}
              companion={companion}
              tone="voice"
              delay={i * 0.04}
              onOpen={() => openCompanion(companion)}
              onDelete={(e) => handleDeleteCompanion(companion.id, companion.custom_name, e)}
            />
          ))}
          <AddCompanionCard
            title="Find Another Match"
            subtitle="Add a new companion"
            tone="voice"
            delay={voices.length * 0.04}
            onClick={handleNewCompanion}
          />
        </div>
      </section>

      {/* Velvet Coaches — mentor companions */}
      <section className="mb-10" aria-labelledby="coaches-title">
        <SectionHeader icon={Brain} tone={TONE_COLOR.coach} title={<span id="coaches-title">Velvet Coaches</span>} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {coaches.map((companion, i) => (
            <CompanionCard
              key={companion.id}
              companion={companion}
              tone="coach"
              delay={i * 0.04}
              onOpen={() => openCompanion(companion)}
              onDelete={(e) => handleDeleteCompanion(companion.id, companion.custom_name, e)}
            />
          ))}
          <AddCompanionCard
            title="Add a Coach"
            subtitle="Find your next expert"
            tone="coach"
            delay={coaches.length * 0.04}
            onClick={handleNewCoach}
          />
        </div>
      </section>

      {/* Velvet Correspondents — correspondent companions */}
      <section className="mb-10" aria-labelledby="correspondents-title">
        <SectionHeader icon={Newspaper} tone={TONE_COLOR.correspondent} title={<span id="correspondents-title">Velvet Correspondents</span>} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {correspondents.map((companion, i) => (
            <CompanionCard
              key={companion.id}
              companion={companion}
              tone="correspondent"
              delay={i * 0.04}
              onOpen={() => openCompanion(companion)}
              onDelete={(e) => handleDeleteCompanion(companion.id, companion.custom_name, e)}
            />
          ))}

          {/* Auto-provisioned correspondent explainer — no manual add */}
          {correspondents.length > 0 && (
            <div className="col-span-full mt-2">
              <div className="ds-card ds-card--sunken flex items-center gap-3 p-4"
                style={{ borderColor: 'color-mix(in srgb, #fbbf24 25%, transparent)' }}>
                <Info className="w-5 h-5 text-amber-400 flex-shrink-0" />
                <p className="text-xs text-ink-muted leading-relaxed">
                  Your correspondents are auto-assigned based on your interests. Update your interests in your profile to change which correspondents write for you. Don't want one? Delete it — it won't come back unless your interests match.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Group chats */}
      {groupChats.length > 0 && (
        <section className="mb-10" aria-labelledby="groups-title">
          <SectionHeader
            icon={UsersRound}
            tone={GROUP_TONE}
            title={<span id="groups-title">Group Chats</span>}
            action={
              <Pill size="sm" tone={GROUP_TONE} icon={<Plus className="w-3.5 h-3.5" />} onClick={handleGroupChatClick}>
                New Group
              </Pill>
            }
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupChats.map((group, i) => (
              <GroupChatCard
                key={group.id}
                group={group}
                delay={i * 0.04}
                onOpen={() => openGroup(group.id)}
                onDelete={(e) => handleDeleteGroupChat(group.id, group.name, e)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Games */}
      <section aria-labelledby="games-title">
        <SectionHeader
          icon={Gamepad2}
          title={<span id="games-title">Games &amp; Activities</span>}
          badge={<Badge tone="#f59e0b" className="ml-1 tracking-wide">Under Development</Badge>}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {GAMES.map((game, i) => (
            <GameCard
              key={game.id}
              name={game.name}
              description={game.description}
              icon={game.icon}
              iconBg={game.iconBg}
              delay={i * 0.04}
              onClick={() => handleGameClick(game)}
            />
          ))}
        </div>
      </section>

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
                className="ds-card ds-card--interactive p-4 text-left"
                style={{ background: 'var(--ds-surface-2)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0" style={{ background: 'var(--ds-surface-sunken)' }}>
                    <Avatar config={companionAvatarConfig(companion)} className="w-full h-full" />
                  </div>
                  <div>
                    <p className="font-semibold text-ink font-display text-sm">{companion.custom_name}</p>
                    <span className="mt-1 inline-flex">
                      {companion.relationship_type === 'romantic'
                        ? <Badge tone="#f472b6" icon={<Heart className="w-2.5 h-2.5" />}>Partner</Badge>
                        : companion.relationship_type === 'mentor'
                        ? <Badge tone={TONE_COLOR.coach} icon={<Brain className="w-2.5 h-2.5" />}>Mentor</Badge>
                        : <Badge tone="#38bdf8" icon={<Users className="w-2.5 h-2.5" />}>Friend</Badge>
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
        title="Send Feedback"
        aria-label="Send Feedback">
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

    </PageShell>
  );
}

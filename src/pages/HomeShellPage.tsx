import { useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Newspaper, Calendar, FileText, Lightbulb, Video, PlayCircle,
  Bot, MapPin, Zap, UsersRound, Users, Gamepad2, Heart,
  Volume2, VolumeX, Wand2, User, LogOut, HelpCircle,
  Flame, Sparkles, MessageCircle, Info, ChevronRight,
  PanelLeftClose, PanelLeftOpen, Brain,
} from 'lucide-react';
import { useLobbyData, NAV_CONFIGS, GAMES } from '../hooks/useLobbyData';
import { useAudioScene } from '../hooks/useAudioScene';
import { useNavigationLoading } from '../context/NavigationLoadingContext';
import {
  Button, ModalShell, EmptyState, LoadingState,
  PageShell, Pill, Badge, HomeLayoutSwitch, Segmented,
} from '../shared/ui';
import { toast } from '../shared/ui/Toast';
import { SubscriptionBanner } from '../components/SubscriptionBanner';
import { CustomizationPanel } from '../components/CustomizationPanel';
import { CreateGroupChatModal } from '../components/CreateGroupChatModal';
import FeedbackModal from '../components/FeedbackModal';
import { CompanionTabs } from '../components/lobby/CompanionTabs';
import { TONE_COLOR, companionAvatarConfig } from '../components/lobby';
import { POINTER_SYMBOLS } from '../services/customizationService';
import { Avatar } from '../components/Avatar';
import type { CompanionWithLastMessage } from '../services/companionService';

const DailyFeedPage = lazy(() => import('./DailyFeedPage').then(m => ({ default: m.DailyFeedPage })));
const VideoHistoryPage = lazy(() => import('./VideoHistoryPage').then(m => ({ default: m.VideoHistoryPage })));
const CalendarPage = lazy(() => import('./CalendarPage').then(m => ({ default: m.CalendarPage })));
const CoAuthorPage = lazy(() => import('./CoAuthorPage').then(m => ({ default: m.CoAuthorPage })));

import { EmbeddedChat } from '../components/hub/EmbeddedChat';
import { InsightsTeaser } from '../components/hub/InsightsTeaser';

type ContentTab = 'feed' | 'videos' | 'calendar' | 'co-author' | 'insights' | 'chat';
type FeedTab = 'feed' | 'videos';

interface SidebarItem {
  id: string;
  label: string;
  sub: string;
  icon: React.ReactNode;
  color: string;
  group: 'content' | 'life' | 'connect' | 'play';
  action: () => void;
}

const GROUP_LABELS: Record<SidebarItem['group'], string> = {
  connect: 'Connect',
  content: 'Content',
  life: 'Life',
  play: 'Play',
};

export function HomeShellPage() {
  const navigate = useNavigate();
  const { navigateTo } = useNavigationLoading();
  const lobby = useLobbyData();
  const { muted, toggleMute } = useAudioScene();

  const [activeTab, setActiveTab] = useState<ContentTab>('feed');
  const [feedTab, setFeedTab] = useState<FeedTab>('feed');
  const [activeCompanionId, setActiveCompanionId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showCustomizationPanel, setShowCustomizationPanel] = useState(false);

  const {
    companions,
    groupChats,
    loading,
    showGameModal,
    showCreateGroupModal,
    confirmModal,
    subscriptionInfo,
    customization,
    customizationHook,
  } = lobby;

  if (loading) {
    return (
      <PageShell center>
        <LoadingState label="Loading your home..." />
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
            <Heart className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-ink mb-3 font-display">Find Your First Companion</h2>
          <p className="text-ink-muted text-sm mb-8 leading-relaxed">
            Answer a few quick questions and we will match you with the perfect companion.
          </p>
          <Button fullWidth size="lg" onClick={lobby.handleNewCompanion}>Get Started</Button>
        </motion.div>
      </PageShell>
    );
  }

  const handleGameNav = (path: string) => {
    const cfg = NAV_CONFIGS[path] || lobby.openHubPath;
    navigateTo(path, cfg);
  };

  const sidebarItems: SidebarItem[] = [
    {
      id: 'feed', label: 'Today', sub: 'Feed & videos',
      icon: <Newspaper className="w-3.5 h-3.5" />, color: 'text-emerald-400',
      group: 'content', action: () => setActiveTab('feed'),
    },
    {
      id: 'calendar', label: 'Calendar', sub: 'Life organized',
      icon: <Calendar className="w-3.5 h-3.5" />, color: 'text-orange-400',
      group: 'life', action: () => setActiveTab('calendar'),
    },
    {
      id: 'co-author', label: 'Co-Author', sub: 'Write together',
      icon: <FileText className="w-3.5 h-3.5" />, color: 'text-blue-400',
      group: 'content', action: () => setActiveTab('co-author'),
    },
    {
      id: 'insights', label: 'Insights', sub: 'Know yourself',
      icon: <Lightbulb className="w-3.5 h-3.5" />, color: 'text-amber-400',
      group: 'life', action: () => setActiveTab('insights'),
    },
    {
      id: 'atlas', label: 'Atlas', sub: 'Chief of staff',
      icon: <Bot className="w-3.5 h-3.5" />, color: 'text-slate-300',
      group: 'connect', action: () => navigateTo('/atlas', NAV_CONFIGS['/atlas']),
    },
    {
      id: 'navi', label: 'Navi', sub: 'Local concierge',
      icon: <MapPin className="w-3.5 h-3.5" />, color: 'text-emerald-400',
      group: 'connect', action: () => navigateTo('/local-explorer', NAV_CONFIGS['/local-explorer']),
    },
    {
      id: 'group-chat', label: 'Group Chat', sub: 'Companions together',
      icon: <UsersRound className="w-3.5 h-3.5" />, color: 'text-teal-400',
      group: 'connect', action: () => lobby.handleGroupChatClick(),
    },
    {
      id: 'velvet-rope', label: 'Velvet Rope', sub: 'Real or not?',
      icon: <Zap className="w-3.5 h-3.5" />, color: 'text-pink-400',
      group: 'play', action: () => navigateTo('/real-or-not', NAV_CONFIGS['/real-or-not']),
    },
    {
      id: 'arcade', label: 'The Arcade', sub: 'Play together',
      icon: <Gamepad2 className="w-3.5 h-3.5" />, color: 'text-orange-400',
      group: 'play', action: () => lobby.handleGameClick(GAMES[0]),
    },
    {
      id: 'profile', label: 'Profile', sub: 'Your settings',
      icon: <User className="w-3.5 h-3.5" />, color: 'text-slate-300',
      group: 'life', action: () => navigateTo('/profile', NAV_CONFIGS['/profile']),
    },
  ];

  const grouped = sidebarItems.reduce<Record<SidebarItem['group'], SidebarItem[]>>(
    (acc, item) => { (acc[item.group] ||= []).push(item); return acc; },
    { connect: [], content: [], life: [], play: [] },
  );

  const bgStyle = {
    background: 'rgba(255,255,255,0.06)',
    backdropFilter: 'blur(12px)' as const,
    borderRight: '1px solid rgba(255,255,255,0.08)',
  };

  return (
    <div className="ds-page flex flex-col h-screen overflow-hidden text-white">
      {/* ─── Header ─── */}
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/8 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Heart className="w-5 h-5 text-pink-400 flex-shrink-0" fill="currentColor" style={{ filter: 'drop-shadow(0 0 6px rgba(244,114,182,0.70))' }} />
          <h1 className="ds-title-gradient text-xl font-bold font-display truncate hidden sm:block">Velvet</h1>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <HomeLayoutSwitch mode="compact" className="hidden md:inline-flex" />
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
            Rewards
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
            onClick={lobby.handleSignOut}
            title="Sign out"
            aria-label="Sign out"
            variant="quiet"
            icon={<LogOut className="w-4 h-4" />}
          />
        </div>
      </header>

      {/* ─── Companion tabs (Three C's) ─── */}
      <div className="px-4 py-2 border-b border-white/8 flex-shrink-0">
        <CompanionTabs
          companions={companions}
          onOpen={(c) => {
            setActiveCompanionId(c.id);
            setActiveTab('chat');
          }}
          onAddCompanion={lobby.handleNewCompanion}
          onAddCoach={lobby.handleNewCoach}
          onDelete={(c) => lobby.handleDeleteCompanion(c.id, c.custom_name, { stopPropagation: () => {} } as React.MouseEvent)}
        />
      </div>

      {/* Streak + subscription */}
      <div className="flex items-center justify-center gap-3 px-4 py-1.5 flex-shrink-0">
        {(customization?.current_streak ?? 0) > 0 && (
          <Badge tone="#fbbf24" icon={<Flame className="w-3 h-3" />}>{customization!.current_streak}d streak</Badge>
        )}
        {subscriptionInfo && (
          <SubscriptionBanner tier={subscriptionInfo.tier} messagesRemaining={subscriptionInfo.messagesRemaining} />
        )}
      </div>

      {/* Unlock notice */}
      <AnimatePresence>
        {customizationHook.justUnlocked.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="mx-4 mb-2 flex items-center gap-3 rounded-2xl px-5 py-3 flex-shrink-0"
            style={{ background: 'var(--ds-accent-soft)', border: '1px solid var(--ds-accent-line)' }}
          >
            <Sparkles className="w-5 h-5 text-primary-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-primary-300">
                New pointer{customizationHook.justUnlocked.length > 1 ? 's' : ''} unlocked!
              </p>
              <p className="text-xs text-primary-400/80">
                {customizationHook.justUnlocked.map(k => POINTER_SYMBOLS.find(s => s.key === k)?.label).join(', ')} — open Rewards to try {customizationHook.justUnlocked.length > 1 ? 'them' : 'it'} out
              </p>
            </div>
            <button onClick={customizationHook.dismissUnlockNotice} className="text-primary-400 hover:text-primary-300 transition-colors text-lg leading-none" aria-label="Dismiss">&times;</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Sidebar + Content ─── */}
      <div className="flex-1 flex flex-row overflow-hidden">

        {/* Sidebar */}
        <AnimatePresence mode="wait">
          {sidebarCollapsed ? (
            <motion.div
              key="collapsed"
              initial={{ width: 200 }}
              animate={{ width: 36 }}
              exit={{ width: 200 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="flex-shrink-0 flex flex-col items-center pt-3 overflow-hidden"
              style={bgStyle}
            >
              <button
                onClick={() => setSidebarCollapsed(false)}
                title="Expand sidebar"
                className="flex items-center justify-center w-6 h-6 rounded-lg hover:bg-white/10 transition-colors text-white/40 hover:text-white/70"
              >
                <PanelLeftOpen className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="expanded"
              initial={{ width: 36 }}
              animate={{ width: 200 }}
              exit={{ width: 36 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="flex-shrink-0 flex flex-col overflow-hidden"
              style={bgStyle}
            >
              <div className="flex items-center justify-between px-3 pt-3 pb-2 border-b border-white/8 flex-shrink-0">
                <p className="text-[10px] font-bold tracking-widest uppercase text-white/40 select-none flex-1">
                  Navigate
                </p>
                <button
                  onClick={() => setSidebarCollapsed(true)}
                  title="Collapse sidebar"
                  className="flex items-center justify-center w-5 h-5 rounded hover:bg-white/10 transition-colors text-white/40 hover:text-white/70 flex-shrink-0"
                >
                  <PanelLeftClose className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-2 flex flex-col gap-3">
                {(['connect', 'content', 'life', 'play'] as const).map(groupKey => (
                  <div key={groupKey} className="flex flex-col gap-0.5">
                    <p className="text-[9px] font-bold tracking-widest uppercase text-white/30 px-2 pt-1 pb-1 select-none">
                      {GROUP_LABELS[groupKey]}
                    </p>
                    {grouped[groupKey].map(item => (
                      <button
                        key={item.id}
                        onClick={item.action}
                        className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-left transition-colors duration-150 hover:bg-white/8 ${(activeTab === item.id || (item.id === 'feed' && (activeTab === 'feed' || activeTab === 'videos'))) ? 'bg-white/10' : ''}`}
                      >
                        <span className={`flex items-center justify-center w-7 h-7 rounded-xl flex-shrink-0 ${item.color}`} style={{ background: 'rgba(255,255,255,0.06)' }}>
                          {item.icon}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[11.5px] font-semibold text-white/80 truncate leading-tight">{item.label}</span>
                          <span className="block text-[9.5px] text-white/40 truncate leading-tight">{item.sub}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Feed / Your Lens visual toggle */}
          {(activeTab === 'feed' || activeTab === 'videos') && (
            <div className="flex items-center justify-center px-4 py-2 flex-shrink-0 border-b border-white/8">
              <Segmented
                value={feedTab}
                onChange={(v) => { setFeedTab(v); setActiveTab(v); }}
                size="md"
                options={[
                  { value: 'feed', label: 'Feed', icon: <Newspaper className="w-3.5 h-3.5" /> },
                  { value: 'videos', label: 'Your Lens', icon: <PlayCircle className="w-3.5 h-3.5" /> },
                ]}
              />
            </div>
          )}
          <Suspense fallback={<LoadingState label="Loading..." />}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab + feedTab}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex-1 overflow-y-auto"
              >
                {activeTab === 'feed' && <DailyFeedPage onBack={undefined} />}
                {activeTab === 'videos' && <VideoHistoryPage />}
                {activeTab === 'calendar' && <CalendarPage onBack={() => setActiveTab('feed')} />}
                {activeTab === 'co-author' && <CoAuthorPage onBack={() => setActiveTab('feed')} />}
                {activeTab === 'insights' && <InsightsTeaser />}
                {activeTab === 'chat' && activeCompanionId && (
                  <EmbeddedChat companionId={activeCompanionId} onBack={() => setActiveTab('feed')} />
                )}
              </motion.div>
            </AnimatePresence>
          </Suspense>
        </div>
      </div>

      {/* ─── Modals ─── */}
      {/* Game partner modal */}
      <ModalShell isOpen={showGameModal} onClose={() => lobby.setShowGameModal(false)} title="Choose Your Partner" size="md">
        <p className="text-sm text-ink-muted mb-5">Select a companion to play with:</p>
        {companions.length === 0 ? (
          <EmptyState icon={<Heart className="w-8 h-8" />} title="No companions yet" description="Create a companion first to play games together." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {companions.map(companion => (
              <motion.button key={companion.id}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                onClick={() => {
                  lobby.setShowGameModal(false);
                  navigateTo(`/pacman?companion=${companion.id}`, { icon: Gamepad2, label: 'Loading game...', accentColor: '#facc15', bgColor: '#0a0900' });
                }}
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

      {/* Create group chat modal */}
      <CreateGroupChatModal
        isOpen={showCreateGroupModal}
        onClose={() => lobby.setShowCreateGroupModal(false)}
        companions={companions}
        onCreateGroup={lobby.handleCreateGroupChat}
      />

      {/* Confirmation modal */}
      <ModalShell isOpen={!!confirmModal} onClose={() => lobby.setConfirmModal(null)} title={confirmModal?.title ?? ''} size="sm">
        <p className="text-sm text-ink-muted mb-6">{confirmModal?.message}</p>
        <div className="flex gap-3 justify-end">
          <Button variant="ghost" size="sm" onClick={() => lobby.setConfirmModal(null)}>Cancel</Button>
          <Button variant="danger" size="sm" onClick={() => confirmModal?.onConfirm()}>Delete</Button>
        </div>
      </ModalShell>

      {/* Customization panel */}
      {customization && (
        <CustomizationPanel
          isOpen={showCustomizationPanel}
          onClose={() => setShowCustomizationPanel(false)}
          customization={customization}
          companions={companions}
          onSetPointer={customizationHook.setPointer}
          onSetShowTrail={customizationHook.setShowTrail}
          onSetTrailStyle={customizationHook.setTrailStyle}
          onSetAnimationStyle={customizationHook.setAnimationStyle}
          onSetCursorColor={customizationHook.setCursorColor}
          onSetButtonHoverStyle={customizationHook.setButtonHoverStyle}
          onSetTranslucentUI={customizationHook.setTranslucentUI}
          onCompanionFontUpdated={(companionId, fontFamily) => {
            lobby.setCompanionsList(prev =>
              prev.map(c => c.id === companionId ? { ...c, font_family: fontFamily } : c)
            );
          }}
        />
      )}

      {/* Feedback FAB */}
      <motion.button
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, type: 'spring' }}
        onClick={() => setShowFeedbackModal(true)}
        className="fixed bottom-6 right-6 w-13 h-13 bg-gradient-to-br from-primary-500 to-pink-500 hover:from-primary-600 hover:to-pink-600 text-white rounded-full shadow-glow hover:shadow-glow-lg transition-all duration-200 flex items-center justify-center z-40 group"
        title="Send Feedback"
        aria-label="Send Feedback">
        <MessageCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
      </motion.button>

      <FeedbackModal isOpen={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} />
    </div>
  );
}

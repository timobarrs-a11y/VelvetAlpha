import { useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Newspaper, Calendar, FileText, Lightbulb, Video, PlayCircle,
  Bot, MapPin, Zap, UsersRound, Users, Gamepad2, Heart,
  Volume2, VolumeX, Wand2, User, LogOut, HelpCircle,
  Flame, Sparkles, MessageCircle, Info, ChevronRight,
  PanelLeftClose, PanelLeftOpen, Brain, Newspaper as NewspaperIcon,
  Plus, Trash2,
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

type ContentTab = 'feed' | 'videos' | 'calendar' | 'co-author' | 'insights' | 'chat' | 'companion-list';
type FeedTab = 'feed' | 'videos';
type CompanionCategory = 'companions' | 'coaching' | 'correspondents';

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
  const [companionCategory, setCompanionCategory] = useState<CompanionCategory>('companions');
  const [contextCompanion, setContextCompanion] = useState<CompanionWithLastMessage | null>(null);
  const [contextPos, setContextPos] = useState<{ x: number; y: number } | null>(null);
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
      id: 'feed', label: 'Daily News', sub: 'News & videos',
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
      id: 'companions', label: 'Companions', sub: `${companions.filter(c => !c.relationship_type || c.relationship_type === 'romantic' || c.relationship_type === 'friend').length} people`,
      icon: <Heart className="w-3.5 h-3.5" />, color: 'text-pink-400',
      group: 'connect', action: () => { setCompanionCategory('companions'); setActiveTab('companion-list'); },
    },
    {
      id: 'coaching', label: 'Coaching', sub: `${companions.filter(c => c.relationship_type === 'mentor').length} mentors`,
      icon: <Brain className="w-3.5 h-3.5" />, color: 'text-emerald-400',
      group: 'connect', action: () => { setCompanionCategory('coaching'); setActiveTab('companion-list'); },
    },
    {
      id: 'correspondents', label: 'Correspondents', sub: `${companions.filter(c => c.relationship_type === 'correspondent').length} writers`,
      icon: <NewspaperIcon className="w-3.5 h-3.5" />, color: 'text-amber-400',
      group: 'connect', action: () => { setCompanionCategory('correspondents'); setActiveTab('companion-list'); },
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
          {subscriptionInfo && (
            <SubscriptionBanner tier={subscriptionInfo.tier} messagesRemaining={subscriptionInfo.messagesRemaining} compact />
          )}
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
                        className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-left transition-colors duration-150 hover:bg-white/8 ${(activeTab === item.id || (item.id === 'feed' && (activeTab === 'feed' || activeTab === 'videos')) || (item.id === companionCategory && activeTab === 'companion-list')) ? 'bg-white/10' : ''}`}
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
                {activeTab === 'companion-list' && (
                  <CompanionList
                    companions={companions}
                    category={companionCategory}
                    onOpen={(c) => { setActiveCompanionId(c.id); setActiveTab('chat'); }}
                    onAdd={companionCategory === 'coaching' ? lobby.handleNewCoach : lobby.handleNewCompanion}
                    onDelete={(c) => lobby.handleDeleteCompanion(c.id, c.custom_name, { stopPropagation: () => {} } as React.MouseEvent)}
                    contextCompanion={contextCompanion}
                    setContextCompanion={setContextCompanion}
                    contextPos={contextPos}
                    setContextPos={setContextPos}
                  />
                )}
                {activeTab === 'chat' && activeCompanionId && (
                  <EmbeddedChat companionId={activeCompanionId} onBack={() => setActiveTab(companionCategory)} />
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

const CATEGORY_CONFIG: Record<CompanionCategory, { label: string; color: string; matchTypes: string[]; addLabel: string }> = {
  companions:     { label: 'Companions',    color: '#f472b6', matchTypes: ['romantic', 'friend', ''], addLabel: 'Add companion' },
  coaching:       { label: 'Coaching',      color: '#34d399', matchTypes: ['mentor'],                 addLabel: 'Add coach' },
  correspondents: { label: 'Correspondents', color: '#fbbf24', matchTypes: ['correspondent'],         addLabel: 'Add correspondent' },
};

function CompanionList({
  companions, category, onOpen, onAdd, onDelete,
  contextCompanion, setContextCompanion, contextPos, setContextPos,
}: {
  companions: CompanionWithLastMessage[];
  category: CompanionCategory;
  onOpen: (c: CompanionWithLastMessage) => void;
  onAdd: () => void;
  onDelete: (c: CompanionWithLastMessage) => void;
  contextCompanion: CompanionWithLastMessage | null;
  setContextCompanion: (c: CompanionWithLastMessage | null) => void;
  contextPos: { x: number; y: number } | null;
  setContextPos: (p: { x: number; y: number } | null) => void;
}) {
  const cfg = CATEGORY_CONFIG[category];
  const filtered = companions.filter(c => cfg.matchTypes.includes(c.relationship_type ?? ''));
  const sorted = [...filtered].sort((a, b) => {
    const aT = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
    const bT = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
    return bT - aT;
  });

  const handleContext = (c: CompanionWithLastMessage, e: React.MouseEvent) => {
    e.preventDefault();
    setContextCompanion(c);
    setContextPos({ x: e.clientX, y: e.clientY });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: cfg.color }} />
          <h2 className="text-lg font-bold text-white">{cfg.label}</h2>
          <span className="text-xs text-white/40">{sorted.length}</span>
        </div>
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          {cfg.addLabel}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: `${cfg.color}15`, border: `2px dashed ${cfg.color}40` }}
            >
              <Plus className="w-7 h-7" style={{ color: `${cfg.color}80` }} />
            </div>
            <div>
              <p className="text-white/60 text-sm font-medium mb-1">No {cfg.label.toLowerCase()} yet</p>
              <button
                onClick={onAdd}
                className="text-xs font-semibold transition-colors hover:opacity-80"
                style={{ color: cfg.color }}
              >
                {cfg.addLabel}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5 max-w-md mx-auto">
            {sorted.map((c, i) => (
              <motion.button
                key={c.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => onOpen(c)}
                onContextMenu={(e) => handleContext(c, e)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/8 transition-colors text-left group"
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: cfg.color, opacity: (c.unread_count ?? 0) > 0 ? 1 : 0.4 }}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-semibold text-white/90 truncate group-hover:text-white transition-colors"
                    style={{ fontFamily: c.font_family ?? undefined }}
                  >
                    {c.custom_name}
                  </p>
                  <p className="text-xs text-white/40 truncate">
                    {(c.unread_count ?? 0) > 0 ? `${c.unread_count} unread` : c.last_message_at ? new Date(c.last_message_at).toLocaleDateString() : 'No messages yet'}
                  </p>
                </div>
                {(c.unread_count ?? 0) > 0 && (
                  <span
                    className="text-[10px] font-bold text-white rounded-full px-1.5 py-0.5 flex-shrink-0"
                    style={{ background: cfg.color }}
                  >
                    {c.unread_count}
                  </span>
                )}
              </motion.button>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {contextCompanion && contextPos && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.12 }}
            className="fixed z-50 rounded-xl overflow-hidden shadow-xl"
            style={{
              left: Math.min(contextPos.x, window.innerWidth - 160),
              top: Math.min(contextPos.y, window.innerHeight - 50),
              background: 'rgba(20, 20, 35, 0.95)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => { onDelete(contextCompanion); setContextCompanion(null); setContextPos(null); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-300 hover:bg-red-500/15 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete {contextCompanion.custom_name}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

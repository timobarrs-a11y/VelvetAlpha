import { useState, lazy, Suspense, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Newspaper, PlayCircle, Calendar, FileText, Lightbulb, Bot, MapPin,
  Heart, LogOut, Volume2, VolumeX,
  Plus, Sparkles, ArrowRight,
  Target, CheckCircle2, UsersRound, Layers,
  Sunrise, Zap, User, Menu, X,
} from 'lucide-react';
import { useLobbyData, GAMES } from '../hooks/useLobbyData';
import { useAudioScene } from '../hooks/useAudioScene';
import { supabase } from '../shared/supabase/client';
import {
  LoadingState, PageShell, Pill, HomeLayoutSwitch, Badge, Segmented,
} from '../shared/ui';
import { SubscriptionBanner } from '../components/SubscriptionBanner';
import { companionAvatarConfig, TONE_COLOR, FinishSetupCard } from '../components/lobby';
import { Avatar } from '../components/Avatar';
import { colorNameToHex } from '../utils/colorMapping';
import type { CompanionWithLastMessage } from '../services/companionService';

const DailyFeedPage = lazy(() => import('./DailyFeedPage').then(m => ({ default: m.DailyFeedPage })));
const VideoHistoryPage = lazy(() => import('./VideoHistoryPage').then(m => ({ default: m.VideoHistoryPage })));

type FeedTab = 'feed' | 'videos';

interface CheckIn {
  companion_id: string;
  message: string;
  is_important: boolean;
}

export function HomeV3Page() {
  const navigate = useNavigate();
  const lobby = useLobbyData();
  const { muted, toggleMute } = useAudioScene();
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [feedTab, setFeedTab] = useState<FeedTab>('feed');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const {
    companions,
    loading,
    subscriptionInfo,
  } = lobby;

  const coach = companions.find(c => c.relationship_type === 'mentor');
  const voices = companions.filter(c => c.relationship_type !== 'mentor' && c.relationship_type !== 'correspondent');
  const correspondents = companions.filter(c => c.relationship_type === 'correspondent');

  const loadCheckIns = useCallback(async () => {
    if (companions.length === 0) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('conversations')
        .select('companion_id, content, metadata')
        .eq('user_id', user.id)
        .eq('role', 'assistant')
        .in('companion_id', companions.map(c => c.id))
        .order('created_at', { ascending: false })
        .limit(50);

      if (!data) return;
      const seen = new Set<string>();
      const results: CheckIn[] = [];
      for (const msg of data) {
        if (!msg.companion_id || seen.has(msg.companion_id)) continue;
        const isCheckIn = msg.metadata?.type === 'nudge' || msg.metadata?.type === 'check_in';
        if (isCheckIn) {
          seen.add(msg.companion_id);
          results.push({
            companion_id: msg.companion_id,
            message: (msg.content || '').substring(0, 120),
            is_important: (msg.content || '').length > 0,
          });
        }
      }
      setCheckIns(results);
    } catch { /* best-effort */ }
  }, [companions]);

  useEffect(() => {
    if (!loading && companions.length > 0) loadCheckIns();
  }, [loading, companions, loadCheckIns]);

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
          <button onClick={lobby.handleNewCompanion} className="w-full px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-xl transition-all">
            Get Started
          </button>
        </motion.div>
      </PageShell>
    );
  }

  const checkInMap = new Map(checkIns.map(c => [c.companion_id, c]));
  const topCheckIn = checkIns.find(c => c.is_important) ?? null;

  const getCompanionLine = (c: CompanionWithLastMessage): string | null => {
    const ci = checkInMap.get(c.id);
    if (ci) return ci.message;
    if (c.last_message_text && c.last_message_role === 'assistant') return c.last_message_text;
    if (c.last_message_text) return c.last_message_text;
    return null;
  };

  const renderPersonRow = (c: CompanionWithLastMessage, isCoach = false) => {
    const line = getCompanionLine(c);
    const hasCheckIn = checkInMap.has(c.id);
    return (
      <button
        key={c.id}
        onClick={() => handleNavigate(`/chat?companion=${c.id}`)}
        className={`v3-person-row w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${hasCheckIn ? 'bg-white/5' : ''}`}
        style={{ '--v3-person-color': colorNameToHex(c.favorite_color ?? '') } as React.CSSProperties}
      >
        <div className={`relative ${isCoach ? 'w-11 h-11' : 'w-9 h-9'} rounded-full overflow-hidden flex-shrink-0`}>
          <Avatar config={companionAvatarConfig(c)} className="w-full h-full" />
          {hasCheckIn && (
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0d0d1a]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold text-white/90 truncate" style={{ fontFamily: c.font_family ?? undefined }}>
              {c.custom_name}
            </p>
            {isCoach && <Badge size="xs" tone={TONE_COLOR.coach}>Coach</Badge>}
          </div>
          {line ? (
            <p className="text-xs text-white/50 truncate leading-tight mt-0.5">{line}</p>
          ) : (
            <p className="text-xs text-white/25 truncate leading-tight mt-0.5">
              {c.last_message_at ? new Date(c.last_message_at).toLocaleDateString() : 'Say hello'}
            </p>
          )}
        </div>
      </button>
    );
  };

  const renderToolRow = (label: string, icon: React.ReactNode, color: string, path: string) => (
    <button
      onClick={() => handleNavigate(path)}
      className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-left transition-colors hover:bg-white/8"
    >
      <span className={`flex items-center justify-center w-7 h-7 rounded-xl flex-shrink-0 ${color}`} style={{ background: 'rgba(255,255,255,0.05)' }}>
        {icon}
      </span>
      <span className="text-[11.5px] font-semibold text-white/70">{label}</span>
    </button>
  );

  const renderSubRow = (label: string, icon: React.ReactNode, path: string) => (
    <button
      onClick={() => handleNavigate(path)}
      className="w-full flex items-center gap-2 pl-8 pr-2 py-1.5 rounded-xl text-left transition-colors hover:bg-white/8"
    >
      <span className="flex items-center justify-center w-6 h-6 rounded-lg flex-shrink-0 text-white/40" style={{ background: 'rgba(255,255,255,0.03)' }}>
        {icon}
      </span>
      <span className="text-[11px] font-medium text-white/60">{label}</span>
    </button>
  );

  const sidebarStyle = {
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(12px)' as const,
  };

  const GroupLabel = ({ children }: { children: React.ReactNode }) => (
    <p className="text-[10px] font-bold tracking-widest uppercase text-white/40 select-none px-2 pt-1 pb-1">{children}</p>
  );

  const handleNavigate = (path: string) => {
    navigate(path);
    setDrawerOpen(false);
  };

  const sidebarContent = (
    <>
      <div className="px-3 pt-3 pb-2 flex-shrink-0">
        <p className="text-[10px] font-bold tracking-widest uppercase text-white/40 select-none">Navigate</p>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-3">
        {/* ── Coaching ── */}
        <div className="flex flex-col gap-0.5">
          <GroupLabel>Coaching</GroupLabel>
          {coach ? (
            <>
              {renderPersonRow(coach, true)}
              {renderSubRow('Progress', <Target className="w-3.5 h-3.5" />, '/coaching-progress')}
              {renderSubRow('Commitments', <CheckCircle2 className="w-3.5 h-3.5" />, '/coaching-commitments')}
              {renderSubRow('Plans', <Layers className="w-3.5 h-3.5" />, '/coaching-commitments?view=plans')}
            </>
          ) : (
            <button
              onClick={() => handleNavigate('/expert-selection')}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add a coach
            </button>
          )}
        </div>

        {/* ── Companion ── */}
        <div className="flex flex-col gap-0.5">
          <GroupLabel>Companion</GroupLabel>
          {voices.map(c => renderPersonRow(c))}
          {correspondents.map(c => renderPersonRow(c))}
          <button
            onClick={() => { lobby.handleNewCompanion(); setDrawerOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors mt-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Someone new
          </button>
        </div>

        {/* ── Core ── */}
        <div className="flex flex-col gap-0.5">
          <GroupLabel>Core</GroupLabel>
          {renderToolRow('Daily Feed', <Newspaper className="w-3.5 h-3.5" />, 'text-emerald-400', '/daily-feed')}
          {renderToolRow('Calendar', <Calendar className="w-3.5 h-3.5" />, 'text-orange-400', '/calendar')}
          {renderToolRow('Co-Author', <FileText className="w-3.5 h-3.5" />, 'text-blue-400', '/co-author')}
          {renderToolRow('Insights', <Lightbulb className="w-3.5 h-3.5" />, 'text-amber-400', '/insights')}
          {renderToolRow('Morning Journal', <Sunrise className="w-3.5 h-3.5" />, 'text-amber-400', '/morning-journal')}
          {renderToolRow('Profile', <User className="w-3.5 h-3.5" />, 'text-slate-300', '/profile')}
        </div>

        {/* ── Connect ── */}
        <div className="flex flex-col gap-0.5">
          <GroupLabel>Connect</GroupLabel>
          {renderToolRow('Atlas', <Bot className="w-3.5 h-3.5" />, 'text-slate-300', '/atlas')}
          {renderToolRow('Navi', <MapPin className="w-3.5 h-3.5" />, 'text-emerald-400', '/local-explorer')}
          {renderToolRow('Group Chat', <UsersRound className="w-3.5 h-3.5" />, 'text-teal-400', '/group-chat')}
          {renderToolRow('Velvet Rope', <Zap className="w-3.5 h-3.5" />, 'text-pink-400', '/real-or-not')}
          {/* Games */}
          <div className="mt-1">
            <p className="text-[9px] font-bold tracking-widest uppercase text-white/30 px-2 pt-1 pb-1 select-none">Games</p>
            {GAMES.map(game => (
              <button
                key={game.id}
                onClick={() => { lobby.handleGameClick(game); setDrawerOpen(false); }}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-xl text-left transition-colors hover:bg-white/8"
              >
                <span className={`flex items-center justify-center w-7 h-7 rounded-xl flex-shrink-0 bg-gradient-to-br ${game.iconBg}`}>
                  <game.icon className="w-3.5 h-3.5 text-white" />
                </span>
                <span className="text-[11.5px] font-semibold text-white/60">{game.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div className="ds-page flex flex-col h-screen overflow-hidden text-white">
      {/* Header */}
      <header className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 sm:py-3 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Mobile menu button */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="sm:hidden flex items-center justify-center w-9 h-9 rounded-lg bg-white/5 text-white/70 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Heart className="w-5 h-5 text-pink-400 flex-shrink-0" fill="currentColor" style={{ filter: 'drop-shadow(0 0 6px rgba(244,114,182,0.70))' }} />
          <h1 className="ds-title-gradient text-lg sm:text-xl font-bold font-display truncate hidden sm:block">Velvet</h1>
          {subscriptionInfo && (
            <SubscriptionBanner tier={subscriptionInfo.tier} messagesRemaining={subscriptionInfo.messagesRemaining} compact />
          )}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <HomeLayoutSwitch mode="compact" className="hidden md:inline-flex" />
          <Pill
            onClick={toggleMute}
            title={muted ? 'Unmute music' : 'Mute music'}
            aria-label={muted ? 'Unmute music' : 'Mute music'}
            icon={muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          />
          <Pill
            onClick={lobby.handleSignOut}
            title="Sign out"
            aria-label="Sign out"
            variant="quiet"
            icon={<LogOut className="w-4 h-4" />}
          />
        </div>
      </header>

      {/* Mobile slide-in drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm sm:hidden"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
              className="fixed inset-y-0 left-0 z-50 w-72 flex flex-col overflow-hidden sm:hidden"
              style={sidebarStyle}
            >
              <div className="flex items-center justify-between px-3 pt-3 pb-2 flex-shrink-0">
                <p className="text-[10px] font-bold tracking-widest uppercase text-white/40 select-none">Navigate</p>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center justify-center w-7 h-7 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Close menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {lobby.setupResumeRoute && (
        <div className="px-4 pt-3 flex-shrink-0">
          <FinishSetupCard onResume={lobby.resumeSetup} />
        </div>
      )}

      <div className="flex-1 flex flex-row overflow-hidden">
        {/* Desktop sidebar */}
        <aside className="w-64 flex-shrink-0 flex flex-col overflow-hidden hidden sm:flex" style={sidebarStyle}>
          {sidebarContent}
        </aside>

        {/* Main content — the feed or videos */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Quiet check-in note at top of feed */}
          <AnimatePresence>
            {topCheckIn && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="px-4 py-2.5 flex-shrink-0"
                style={{ background: 'rgba(52, 211, 153, 0.06)' }}
              >
                <button
                  onClick={() => navigate(`/chat?companion=${topCheckIn.companion_id}`)}
                  className="flex items-center gap-3 w-full text-left group"
                >
                  <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <p className="text-sm text-emerald-200/80 truncate flex-1">{topCheckIn.message}</p>
                  <ArrowRight className="w-4 h-4 text-emerald-400/50 group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Feed / Your Lens toggle */}
          <div className="flex items-center justify-center px-4 py-2 flex-shrink-0 border-b border-white/8">
            <Segmented
              value={feedTab}
              onChange={(v) => setFeedTab(v)}
              size="md"
              options={[
                { value: 'feed', label: 'Feed', icon: <Newspaper className="w-3.5 h-3.5" /> },
                { value: 'videos', label: 'Your Lens', icon: <PlayCircle className="w-3.5 h-3.5" /> },
              ]}
            />
          </div>

          {/* Mobile person strip + coaching shortcuts */}
          <div className="sm:hidden flex items-center gap-2 px-3 py-2 overflow-x-auto scrollbar-hide flex-shrink-0">
            {coach && (
              <button
                onClick={() => navigate(`/chat?companion=${coach.id}`)}
                className="flex items-center gap-2 px-2 py-1 rounded-lg bg-white/5 flex-shrink-0"
              >
                <div className="w-7 h-7 rounded-full overflow-hidden">
                  <Avatar config={companionAvatarConfig(coach)} className="w-full h-full" />
                </div>
                <span className="text-xs font-semibold text-white/80">{coach.custom_name}</span>
              </button>
            )}
            {voices.map(c => (
              <button
                key={c.id}
                onClick={() => navigate(`/chat?companion=${c.id}`)}
                className="flex items-center gap-2 px-2 py-1 rounded-lg bg-white/5 flex-shrink-0"
              >
                <div className="w-7 h-7 rounded-full overflow-hidden">
                  <Avatar config={companionAvatarConfig(c)} className="w-full h-full" />
                </div>
                <span className="text-xs font-semibold text-white/80">{c.custom_name}</span>
              </button>
            ))}
            {/* Coaching shortcut chips */}
            <button
              onClick={() => navigate('/coaching-progress')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 flex-shrink-0"
            >
              <Target className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-semibold text-white/70">Progress</span>
            </button>
            <button
              onClick={() => navigate('/coaching-commitments')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 flex-shrink-0"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-xs font-semibold text-white/70">Tasks</span>
            </button>
          </div>

          <Suspense fallback={<LoadingState label={`Loading your ${feedTab === 'feed' ? 'feed' : 'lens'}...`} />}>
            <div className="flex-1 overflow-y-auto">
              {feedTab === 'feed' ? <DailyFeedPage onBack={undefined} /> : <VideoHistoryPage />}
            </div>
          </Suspense>
        </div>
      </div>
    </div>
  );
}

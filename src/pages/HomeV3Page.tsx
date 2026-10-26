import { useState, lazy, Suspense, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Newspaper, PlayCircle, Calendar, FileText, Lightbulb, Bot, MapPin,
  Heart,
  Plus, Sparkles, ArrowRight,
  Target, CheckCircle2, UsersRound, Layers,
  Sunrise, Zap, User, MessageSquare, BookOpen,
} from 'lucide-react';
import { useLobbyData, GAMES } from '../hooks/useLobbyData';
import { supabase } from '../shared/supabase/client';
import {
  LoadingState, PageShell, Badge, Segmented,
  ModalShell, EmptyState, Button,
} from '../shared/ui';
import { companionAvatarConfig, TONE_COLOR, FinishSetupCard } from '../components/lobby';
import { NoCompanionCard } from '../components/lobby/NoCompanionCard';
import { Avatar } from '../components/Avatar';
import { colorNameToHex } from '../utils/colorMapping';
import { getCoachColor } from '../utils/coachColors';
import { ensureCoachColors } from '../services/companionService';
import { TodayCard } from '../features/today/TodayCard';
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
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [feedTab, setFeedTab] = useState<FeedTab>('feed');

  const {
    companions,
    loading,
  } = lobby;

  const coaches = companions.filter(c => c.relationship_type === 'mentor');
  const coach = coaches[0];
  const voices = companions.filter(c => c.relationship_type !== 'mentor');

  const companionsKey = companions.map(c => c.id).join(',');
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companionsKey]);

  useEffect(() => {
    if (!loading && companions.length > 0) {
      loadCheckIns();
      (async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) ensureCoachColors(user.id).catch(() => {});
      })();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, companionsKey, loadCheckIns]);

  if (loading) {
    return (
      <PageShell center>
        <LoadingState label="Loading your home..." />
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
    const coachColor = isCoach ? getCoachColor(c.coach_color) : null;
    return (
      <button
        key={c.id}
        onClick={() => handleNavigate(`/chat?companion=${c.id}`)}
        className={`v3-person-row w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${hasCheckIn ? 'bg-white/5' : ''}`}
        style={{
          '--v3-person-color': colorNameToHex(c.favorite_color ?? ''),
          ...(coachColor ? { borderLeft: `2px solid ${coachColor.base}` } : {}),
        } as React.CSSProperties}
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
            {isCoach && (
              <Badge size="xs" tone={coachColor?.base ?? TONE_COLOR.coach}>Coach</Badge>
            )}
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
          {coaches.length > 0 ? (
            <>
              {coaches.map(c => renderPersonRow(c, true))}
              {renderSubRow('Progress', <Target className="w-3.5 h-3.5" />, '/coaching-progress')}
              {renderSubRow('Commitments', <CheckCircle2 className="w-3.5 h-3.5" />, '/coaching-commitments')}
              {renderSubRow('Plans', <Layers className="w-3.5 h-3.5" />, '/coaching-commitments?view=plans')}
              {renderSubRow('Library', <BookOpen className="w-3.5 h-3.5" />, '/coaching-library')}
              <button
                onClick={() => handleNavigate('/expert-selection')}
                className="w-full flex items-center gap-2 pl-8 pr-2 py-1.5 rounded-xl text-left transition-colors hover:bg-white/8"
              >
                <span className="flex items-center justify-center w-6 h-6 rounded-lg flex-shrink-0 text-white/40" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <Plus className="w-3.5 h-3.5" />
                </span>
                <span className="text-[11px] font-medium text-white/40">Add another coach</span>
              </button>
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
          <button
            onClick={() => { lobby.handleNewCompanion(); }}
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
          {renderToolRow('Community', <MessageSquare className="w-3.5 h-3.5" />, 'text-blue-400', '/community')}
          {/* Games */}
          <div className="mt-1">
            <p className="text-[9px] font-bold tracking-widest uppercase text-white/30 px-2 pt-1 pb-1 select-none">Games</p>
            {GAMES.map(game => (
              <button
                key={game.id}
                onClick={() => { lobby.handleGameClick(game); }}
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
    <div className="ds-page flex min-h-full min-w-0 flex-col overflow-hidden text-white">
      {companions.length === 0 && <NoCompanionCard onCreate={lobby.handleNewCompanion} />}

      {lobby.setupResumeRoute && (
        <div className="px-4 pt-3 flex-shrink-0">
          <FinishSetupCard onResume={lobby.resumeSetup} />
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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

          <div className="flex-1 overflow-y-auto">
            {/* What they're working on today, above everything else */}
            <TodayCard />

            {/* Feed / Your Lens toggle */}
            <div className="flex items-center justify-center px-4 py-2 border-b border-white/8">
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

            <Suspense fallback={<LoadingState label={`Loading your ${feedTab === 'feed' ? 'feed' : 'lens'}...`} />}>
              {feedTab === 'feed' ? <DailyFeedPage /> : <VideoHistoryPage />}
            </Suspense>
          </div>
        </div>
      </div>

      {/* Game partner modal */}
      <ModalShell isOpen={lobby.showGameModal} onClose={() => lobby.setShowGameModal(false)} title="Choose Your Partner" size="md">
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
                  const path = lobby.selectedGame?.path || '/pacman';
                  lobby.setShowGameModal(false);
                  navigate(`${path}?companion=${companion.id}`);
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
                        ? <Badge tone={TONE_COLOR.coach} icon={<Target className="w-2.5 h-2.5" />}>Mentor</Badge>
                        : <Badge tone="#38bdf8" icon={<UsersRound className="w-2.5 h-2.5" />}>Friend</Badge>
                      }
                    </span>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        )}
        <div className="flex justify-start mt-5 pt-4" style={{ borderTop: '1px solid var(--ds-border-soft)' }}>
          <Button variant="ghost" size="sm" onClick={() => lobby.setShowGameModal(false)}>Back</Button>
        </div>
      </ModalShell>
    </div>
  );
}

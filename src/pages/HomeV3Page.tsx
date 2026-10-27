import { useState, lazy, Suspense, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Newspaper, PlayCircle, Heart,
  Target, UsersRound, Users,
} from 'lucide-react';
import { useLobbyData } from '../hooks/useLobbyData';
import { supabase } from '../shared/supabase/client';
import {
  LoadingState, PageShell, Badge, Segmented,
  ModalShell, EmptyState, Button,
} from '../shared/ui';
import { companionAvatarConfig, TONE_COLOR, FinishSetupCard } from '../components/lobby';
import { NoCompanionCard } from '../components/lobby/NoCompanionCard';
import { Avatar } from '../components/Avatar';
import { ensureCoachColors } from '../services/companionService';
import { TodayCard } from '../features/today/TodayCard';
import { ArrivalHighlights } from '../features/arrival/ArrivalHighlights';
import { highlightsSeen } from '../features/arrival/arrivalUtils';
import { FirstWeekCard } from '../features/arrival/FirstWeekCard';

const DailyFeedPage = lazy(() => import('./DailyFeedPage').then(m => ({ default: m.DailyFeedPage })));
const VideoHistoryPage = lazy(() => import('./VideoHistoryPage').then(m => ({ default: m.VideoHistoryPage })));
const YourFeed = lazy(() => import('../components/social/YourFeed').then(m => ({ default: m.YourFeed })));

type FeedTab = 'feed' | 'videos' | 'friends';

const FEED_TAB_LOADING: Record<FeedTab, string> = {
  feed: 'Loading your feed...',
  videos: 'Loading your lens...',
  friends: 'Loading posts from your friends...',
};

interface CheckIn {
  companion_id: string;
  message: string;
  is_important: boolean;
}

export function HomeV3Page() {
  const navigate = useNavigate();
  const lobby = useLobbyData();
  const [, setCheckIns] = useState<CheckIn[]>([]);
  const [feedTab, setFeedTab] = useState<FeedTab>('feed');
  // Just finished the arrival: show what else is here, once.
  const [searchParams] = useSearchParams();
  const [showHighlights, setShowHighlights] = useState(() => searchParams.get('arrived') === '1' && !searchParams.get('coach') && !highlightsSeen());

  const {
    companions,
    loading,
  } = lobby;


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
          <div className="flex-1 overflow-y-auto">
            {/* What they're working on today, above everything else */}
            <TodayCard />
            {showHighlights && <ArrivalHighlights onDone={() => setShowHighlights(false)} />}
            {!lobby.setupResumeRoute && <FirstWeekCard />}

            {/* News / Your Lens / posts from your friends */}
            <div className="flex items-center justify-center px-4 py-2 border-b border-white/8">
              <Segmented
                value={feedTab}
                onChange={(v) => setFeedTab(v)}
                size="md"
                options={[
                  { value: 'feed', label: 'Feed', icon: <Newspaper className="w-3.5 h-3.5" /> },
                  { value: 'videos', label: 'Your Lens', icon: <PlayCircle className="w-3.5 h-3.5" /> },
                  { value: 'friends', label: 'Friends', icon: <Users className="w-3.5 h-3.5" /> },
                ]}
              />
            </div>

            <Suspense fallback={<LoadingState label={FEED_TAB_LOADING[feedTab]} />}>
              {feedTab === 'feed' ? <DailyFeedPage /> : feedTab === 'videos' ? <VideoHistoryPage /> : <YourFeed />}
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

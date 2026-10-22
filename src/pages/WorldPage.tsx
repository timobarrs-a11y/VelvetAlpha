import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../auth/AuthProvider';
import {
  localDay, getMyPlot, getDailyBlock, getCards, cardToPlot, markSeen,
  type MyPlot, type WorldCard,
} from '../services/worldService';
import { getCompanions } from '../services/companionService';
import {
  resolvePlot,
  type Plot, type PlotConfig, type Season,
} from '../features/velvet-world/art/streetArt';
import { WorldCanvas } from '../features/velvet-world/WorldCanvas';
import { BillboardCard } from '../features/velvet-world/BillboardCard';
import { Customizer } from '../features/velvet-world/Customizer';
import { MoveInSheet } from '../features/velvet-world/MoveInSheet';

function getSeason(d = new Date()): Season {
  const m = d.getMonth();
  if (m <= 1 || m === 11) return 'winter';
  if (m <= 4) return 'spring';
  if (m <= 7) return 'summer';
  return 'autumn';
}

function getHour(d = new Date()): number {
  return d.getHours() + d.getMinutes() / 60;
}

/** pickBlock: port buildStreet from the demo. You at index 4, no matching neighbors side by side. */
function pickBlock(
  me: Plot,
  cards: Map<string, WorldCard>,
  candidates: { user_id: string; shares_space: boolean; ord: number }[],
): Plot[] {
  const shared = candidates.filter((c) => c.shares_space).sort((a, b) => a.ord - b.ord);
  const rest = candidates.filter((c) => !c.shares_space).sort((a, b) => a.ord - b.ord);
  const queue = [
    shared[0], rest[0], shared[1], rest[1], rest[2],
    shared[2], rest[3], rest[4], ...rest.slice(5, 40),
  ].filter((c) => c !== undefined);

  const looks = (userId: string): string => {
    const card = cards.get(userId);
    if (!card) return '';
    const plot = cardToPlot(card);
    const r = resolvePlot(plot);
    return `${r.house.style}|${r.house.body}`;
  };

  const slots: (Plot | null)[] = [];
  const used = new Set<string>();
  const total = Math.min(9, queue.length + 1);
  const meIdx = Math.floor(total / 2);

  for (let pos = 0; pos < total; pos++) {
    if (pos === meIdx) { slots.push(me); continue; }
    const left = slots[pos - 1];
    const candidate = queue.find((c) => {
      if (used.has(c.user_id)) return false;
      if (left && left.id) {
        const leftLook = looks(left.id);
        if (leftLook && leftLook === looks(c.user_id)) return false;
      }
      return true;
    });
    if (candidate) {
      used.add(candidate.user_id);
      const card = cards.get(candidate.user_id);
      if (card) slots.push(cardToPlot(card));
      else slots.push(null);
    } else {
      slots.push(null);
    }
  }

  // Compact: remove nulls and put me in the middle of what's there
  const filled = slots.filter((s): s is Plot => s !== null);
  if (filled.length <= 1) return filled;
  const meIndex = filled.findIndex((p) => p.id === me.id);
  if (meIndex < 0) return filled;
  // Ensure me is in the middle
  const others = filled.filter((p) => p.id !== me.id);
  const half = Math.floor(others.length / 2);
  return [...others.slice(0, half), me, ...others.slice(half)];
}

export function WorldPage() {
  const { user } = useAuth();
  const [myPlot, setMyPlot] = useState<MyPlot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [block, setBlock] = useState<Plot[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [companions, setCompanions] = useState<{ id: string; custom_name: string }[]>([]);
  const [season] = useState<Season>(() => getSeason());
  const [hour, setHour] = useState<number>(() => getHour());
  const reloadKey = useRef(0);

  // Refresh hour every minute
  useEffect(() => {
    const interval = setInterval(() => setHour(getHour()), 60000);
    return () => clearInterval(interval);
  }, []);

  const invalidate = useCallback((id: string) => {
    setBlock(prev => prev.map(p => p.id === id ? { ...p, _resolved: null } : p));
  }, []);

  const loadPage = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const day = localDay();
      const plot = await getMyPlot();
      if (!plot) {
        setMyPlot(null);
        setLoading(false);
        return;
      }
      setMyPlot(plot);

      const [candidates, companionList] = await Promise.all([
        getDailyBlock(day, 16),
        getCompanions(user.id).then(cs => cs.map(c => ({ id: c.id, custom_name: c.custom_name || 'Companion' }))).catch(() => []),
      ]);

      setCompanions(companionList);

      const allIds = [user.id, ...candidates.map(c => c.user_id)];
      const cards = await getCards(allIds);
      const cardMap = new Map(cards.map(c => [c.user_id, c]));

      const myCard = cardMap.get(user.id);
      if (!myCard) {
        setError('Could not load your plot');
        setLoading(false);
        return;
      }

      const me = cardToPlot(myCard);
      const plots = pickBlock(me, cardMap, candidates);

      setBlock(plots);

      // Mark seen (fire and forget)
      const neighborIds = plots
        .filter(p => p.id !== user.id)
        .map(p => p.id);
      markSeen(day, neighborIds);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadPage, reloadKey.current]);

  const selectedPlot = useMemo(() => {
    if (!selectedId) return null;
    return block.find(p => p.id === selectedId) ?? null;
  }, [selectedId, block]);

  const isYou = selectedPlot?.id === user?.id;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080b14]">
        <p className="text-white/40">Loading your block...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#080b14]">
        <div className="text-center">
          <p className="text-rose-400 mb-4">{error}</p>
          <button onClick={loadPage} className="rounded-xl bg-white/8 px-4 py-2 text-white hover:bg-white/12">Retry</button>
        </div>
      </div>
    );
  }

  if (!myPlot) {
    return <MoveInSheet onMoved={() => { reloadKey.current++; loadPage(); }} />;
  }

  const narrow = typeof window !== 'undefined' && window.innerWidth < 760;

  return (
    <div className="relative h-screen overflow-hidden bg-[#9DAE97]" style={{ colorScheme: 'dark' }}>
      <WorldCanvas
        plots={block}
        selectedId={selectedId}
        onSelect={setSelectedId}
        season={season}
        hour={hour}
      />

      {/* Header */}
      <header className="pointer-events-none absolute top-3 left-4 right-4 z-5 flex gap-2.5 items-start flex-wrap">
        <div className="pointer-events-auto rounded-2xl border border-white/10 px-3.5 py-2.5 grid gap-0.5" style={{ background: 'rgba(24,19,34,0.78)', backdropFilter: 'blur(14px) saturate(1.2)' }}>
          <b className="font-extrabold text-[18px] text-white tracking-tight" style={{ fontFamily: '"Bricolage Grotesque", sans-serif' }}>Your block today</b>
          <span className="text-[12px] text-white/50">Velvet World</span>
        </div>
      </header>

      {/* Side panel / bottom sheet */}
      {selectedPlot && (
        <aside
          className={`z-6 overflow-auto rounded-2xl border border-white/10 ${narrow ? 'absolute left-3 right-3 bottom-3 max-h-[58%]' : 'absolute right-4 top-[84px] w-[360px] max-h-[calc(100%-170px)]'}`}
          style={{ background: 'rgba(24,19,34,0.78)', backdropFilter: 'blur(14px) saturate(1.2)' }}
          aria-live="polite"
        >
          {showCustomizer && isYou && myPlot ? (
            <Customizer
              plot={selectedPlot}
              myPlot={myPlot}
              companions={companions}
              mainCompanionId={myPlot.main_companion_id}
              onSaved={(_config: PlotConfig) => { setShowCustomizer(false); reloadKey.current++; loadPage(); }}
              onCancel={() => setShowCustomizer(false)}
              invalidate={invalidate}
            />
          ) : (
            <BillboardCard
              plot={selectedPlot}
              isYou={isYou}
              onClose={() => { setSelectedId(null); setShowCustomizer(false); }}
              onCustomize={() => setShowCustomizer(true)}
            />
          )}
        </aside>
      )}

      {/* Hint */}
      {!selectedPlot && (
        <p className="absolute left-4 bottom-4 z-4 rounded-2xl border border-white/10 px-3 py-2 text-[12.5px] text-white/50 max-w-[calc(100%-32px)]" style={{ background: 'rgba(24,19,34,0.78)', backdropFilter: 'blur(14px) saturate(1.2)' }}>
          <b className="text-white/80">Drag</b> to walk the block · <b className="text-white/80">scroll or pinch</b> to zoom · <b className="text-white/80">tap a billboard</b> to meet the neighbor
        </p>
      )}
    </div>
  );
}

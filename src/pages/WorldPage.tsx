import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Users, Search, Clock, X } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import {
  localDay, getMyPlot, getDailyBlock, getCards, cardToPlot, markSeen,
  getTownSize, getTownPlots, findPlot, getLandmarkProgress,
  townToPlot,
  type MyPlot, type WorldCard, type TownPlot,
} from '../services/worldService';
import { getCompanions } from '../services/companionService';
import { getFriends, type FriendPeer } from '../shared/supabase/queries/messaging';
import {
  resolvePlot, townSlot, townLayout as buildTownLayout,
  type Plot, type PlotConfig, type Season, type TownLayout,
} from '../features/velvet-world/art/streetArt';
import { WorldCanvas, type FlyTarget } from '../features/velvet-world/WorldCanvas';
import { BillboardCard } from '../features/velvet-world/BillboardCard';
import { Customizer } from '../features/velvet-world/Customizer';
import { MoveInSheet } from '../features/velvet-world/MoveInSheet';
import { FriendsPopover, type FriendRow } from '../features/velvet-world/FriendsPopover';

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

  const filled = slots.filter((s): s is Plot => s !== null);
  if (filled.length <= 1) return filled;
  const meIndex = filled.findIndex((p) => p.id === me.id);
  if (meIndex < 0) return filled;
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

  // Town state
  const [view, setView] = useState<'street' | 'town'>('street');
  const [townPlotList, setTownPlotList] = useState<Plot[]>([]);
  const [townLayoutState, setTownLayoutState] = useState<TownLayout | null>(null);
  const [landmarkPct, setLandmarkPct] = useState(62);
  const [friends, setFriends] = useState<FriendPeer[]>([]);
  const [friendCards, setFriendCards] = useState<Map<string, WorldCard>>(new Map());
  const [showFriends, setShowFriends] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ user_id: string; slot_index: number; display_name: string }[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const flyRef = useRef<((target: FlyTarget) => void) | null>(null);
  const townPlotsMapRef = useRef<Map<string, Plot>>(new Map());
  const cardMapRef = useRef<Map<string, WorldCard>>(new Map());

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

      const [candidates, companionList, friendList, townSize, landmark] = await Promise.all([
        getDailyBlock(day, 16),
        getCompanions(user.id).then(cs => cs.map(c => ({ id: c.id, custom_name: c.custom_name || 'Companion' }))).catch(() => []),
        getFriends().catch(() => []),
        getTownSize().catch(() => 0),
        getLandmarkProgress().catch(() => 62),
      ]);

      setCompanions(companionList);
      setFriends(friendList);
      setLandmarkPct(landmark);

      // Build town layout
      const layout = buildTownLayout(Math.max(townSize, 1));
      setTownLayoutState(layout);

      // Load town plot summaries in background chunks
      const summaries: (TownPlot | null)[] = new Array(townSize).fill(null);
      const chunkSize = 5000;
      const chunkStart = performance.now();
      let lastRebuild = 0;
      const loadChunks = async () => {
        for (let from = 0; from < townSize; from += chunkSize) {
          const to = Math.min(from + chunkSize, townSize);
          try {
            const chunk = await getTownPlots(from, to);
            for (const tp of chunk) {
              if (tp.slot_index < townSize) {
                summaries[tp.slot_index] = tp;
              }
            }
          } catch { /* skip failed chunk */ }
          // Rebuild town plots array every 2s while loading
          const now = performance.now();
          if (now - lastRebuild > 2000 || from + chunkSize >= townSize) {
            const plots = summaries.map((tp) => tp ? townToPlot(tp) : null).filter(Boolean) as Plot[];
            const map = new Map<string, Plot>();
            for (const p of plots) { map.set(p.id, p); townPlotsMapRef.current.set(p.id, p); }
            setTownPlotList(plots);
            lastRebuild = now;
          }
        }
      };
      loadChunks();

      // Load cards for me, block candidates, and friends
      const friendIds = friendList.map(f => f.user_id);
      const allIds = [user.id, ...candidates.map(c => c.user_id), ...friendIds.filter(id => !candidates.some(c => c.user_id === id))];
      const cards = await getCards(allIds);
      const cardMap = new Map(cards.map(c => [c.user_id, c]));
      cardMapRef.current = cardMap;
      setFriendCards(new Map(friendIds.map(id => [id, cardMap.get(id)!]).filter(([, v]) => v)));

      const myCard = cardMap.get(user.id);
      if (!myCard) {
        setError('Could not load your plot');
        setLoading(false);
        return;
      }

      const me = cardToPlot(myCard);
      const plots = pickBlock(me, cardMap, candidates);

      setBlock(plots);

      const neighborIds = plots
        .filter(p => p.id !== user.id)
        .map(p => p.id);
      markSeen(day, neighborIds);

      void chunkStart;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadPage, reloadKey.current]);

  // Debounced search
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await findPlot(searchQuery);
        setSearchResults(results);
        setShowSearch(true);
      } catch {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close search results when clicking away
  useEffect(() => {
    if (!showSearch) return;
    const handler = () => setShowSearch(false);
    setTimeout(() => document.addEventListener('click', handler), 0);
    return () => document.removeEventListener('click', handler);
  }, [showSearch]);

  const selectedPlot = useMemo(() => {
    if (!selectedId) return null;
    if (view === 'street') {
      return block.find(p => p.id === selectedId) ?? null;
    }
    // In town view, try block first, then town plots, then build from card
    const fromBlock = block.find(p => p.id === selectedId);
    if (fromBlock) return fromBlock;
    const fromTown = townPlotsMapRef.current.get(selectedId);
    if (fromTown) return fromTown;
    const card = cardMapRef.current.get(selectedId);
    if (card) {
      const slot = townSlot(card.slot_index);
      const p = cardToPlot(card);
      p.origin = { x: slot.x, y: slot.y };
      return p;
    }
    return null;
  }, [selectedId, block, view]);

  const isYou = selectedPlot?.id === user?.id;

  // Build pins: you + friends who have plots
  const pins = useMemo(() => {
    const result: { id: string; label: string; color: string }[] = [];
    if (user) {
      const myCard = cardMapRef.current.get(user.id);
      if (myCard) {
        result.push({ id: user.id, label: 'You', color: '#F06A9B' });
      }
    }
    for (const f of friends) {
      const card = cardMapRef.current.get(f.user_id);
      if (card) {
        result.push({ id: f.user_id, label: (f.display_name || 'Friend').split(' ')[0], color: '#59C98A' });
      }
    }
    return result;
  }, [friends, user]);

  // Friends list for popover
  const friendRows = useMemo<FriendRow[]>(() => {
    return friends.map(f => {
      const card = friendCards.get(f.user_id);
      const hasPlot = !!card;
      const slot = card ? townSlot(card.slot_index) : null;
      return {
        id: f.user_id,
        name: f.display_name || 'Friend',
        address: slot?.address ?? '',
        isMember: card?.is_member ?? false,
        hasPlot,
      };
    });
  }, [friends, friendCards]);

  const myAddress = useMemo(() => {
    if (!myPlot) return '';
    return townSlot(myPlot.slot_index).address;
  }, [myPlot]);

  const handleFly = useCallback((target: FlyTarget) => {
    flyRef.current?.(target);
  }, []);

  const visitHouse = useCallback((id: string) => {
    const isMe = id === '__you__' || id === user?.id;
    const targetId = isMe ? user!.id : id;
    const card = cardMapRef.current.get(targetId);
    if (!card) return;
    const slot = townSlot(card.slot_index);
    const cx = slot.x + 4;
    const cy = slot.y + 4.5;
    // Switch to town view, jump to zoom 0.2, then fly in
    setView('town');
    setShowFriends(false);
    // Start zoomed out, then fly in
    setTimeout(() => {
      flyRef.current?.({ x: cx, y: cy, zoom: 0.2, ms: 1 });
      setTimeout(() => {
        flyRef.current?.({ x: cx, y: cy, zoom: 1.0, ms: 1300 });
        setSelectedId(targetId);
      }, 50);
    }, 50);
  }, [user]);

  const handleSearchResult = useCallback((result: { user_id: string; slot_index: number; display_name: string }) => {
    setShowSearch(false);
    setSearchQuery('');
    // Load the card for this person, then visit
    getCards([result.user_id]).then(cards => {
      if (cards.length > 0) {
        cardMapRef.current.set(result.user_id, cards[0]);
        visitHouse(result.user_id);
      }
    }).catch(() => {});
  }, [visitHouse]);

  const handleTower = useCallback(() => {
    if (view === 'street') {
      const lx = Math.min(block.length * 10 / 2, 12);
      // Tower is behind the street
      flyRef.current?.({ x: lx, y: -12.6 + 40, zoom: 1.0 });
    } else if (townLayoutState) {
      const q = townLayoutState.square;
      const [x, y] = [q.cx, q.cy];
      flyRef.current?.({ x, y, zoom: 0.9, ms: 1200 });
    }
  }, [view, block, townLayoutState]);

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
      {townLayoutState && (
        <WorldCanvas
          plots={block}
          selectedId={selectedId}
          onSelect={setSelectedId}
          season={season}
          hour={hour}
          view={view}
          townPlots={townPlotList}
          townLayout={townLayoutState}
          landmarkPct={landmarkPct}
          pins={pins}
          onFly={(target: FlyTarget) => { flyRef.current = (t: FlyTarget) => handleFly(t); handleFly(target); }}
        />
      )}

      {/* Header */}
      <header className="pointer-events-none absolute top-3 left-4 right-4 z-5 flex gap-2.5 items-start flex-wrap">
        <div className="pointer-events-auto rounded-2xl border border-white/10 px-3.5 py-2.5 grid gap-0.5" style={{ background: 'rgba(24,19,34,0.78)', backdropFilter: 'blur(14px) saturate(1.2)' }}>
          <b className="font-extrabold text-[18px] text-white tracking-tight" style={{ fontFamily: '"Bricolage Grotesque", sans-serif' }}>
            {view === 'street' ? 'Your block today' : `Velvet town`}
          </b>
          <span className="text-[12px] text-white/50">Velvet World</span>
        </div>

        {/* Controls */}
        <div className="pointer-events-auto ml-auto flex flex-wrap gap-2 items-center rounded-2xl border border-white/10 p-2" style={{ background: 'rgba(24,19,34,0.78)', backdropFilter: 'blur(14px) saturate(1.2)' }}>
          {/* Block / Town toggle */}
          <div className="inline-flex rounded-[11px] bg-white/6 p-[3px] gap-[2px]">
            <button
              onClick={() => { setView('street'); setSelectedId(null); }}
              aria-pressed={view === 'street'}
              className={`rounded-[8px] px-2.5 py-1.5 text-[13px] font-semibold ${view === 'street' ? 'bg-white text-[#1E1828]' : 'text-white/60'}`}
            >
              My block
            </button>
            <button
              onClick={() => { setView('town'); setSelectedId(null); }}
              aria-pressed={view === 'town'}
              className={`rounded-[8px] px-2.5 py-1.5 text-[13px] font-semibold ${view === 'town' ? 'bg-white text-[#1E1828]' : 'text-white/60'}`}
            >
              Whole town
            </button>
          </div>

          {/* Friends button */}
          <button
            onClick={() => { setShowFriends(v => !v); setShowSearch(false); }}
            className="flex items-center gap-1.5 rounded-[10px] border border-white/15 bg-transparent px-2.5 py-1.5 text-[13px] font-semibold text-white/70 hover:text-white hover:border-white/30 transition-colors"
          >
            <Users className="h-3.5 w-3.5" />
            Friends
          </button>

          {/* Search */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-1.5 rounded-[10px] border border-white/15 bg-white/5 px-2 py-1">
              <Search className="h-3.5 w-3.5 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setShowSearch(true); }}
                onFocus={() => setShowSearch(true)}
                placeholder="Search…"
                className="w-[100px] bg-transparent text-[13px] text-white placeholder:text-white/30 focus:outline-none"
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="text-white/40 hover:text-white">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            {showSearch && searchResults.length > 0 && (
              <div className="absolute top-full mt-1 left-0 right-0 min-w-[200px] rounded-xl border border-white/10 overflow-hidden" style={{ background: 'rgba(24,19,34,0.92)', backdropFilter: 'blur(14px) saturate(1.2)' }}>
                {searchResults.map((r) => (
                  <button
                    key={r.user_id}
                    onClick={() => handleSearchResult(r)}
                    className="block w-full px-3 py-2 text-left text-[13px] text-white hover:bg-white/8 transition-colors"
                  >
                    {r.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Clock tower button */}
          <button
            onClick={handleTower}
            className="flex items-center gap-1.5 rounded-[10px] border border-white/15 bg-transparent px-2.5 py-1.5 text-[13px] font-semibold text-white/70 hover:text-white hover:border-white/30 transition-colors"
          >
            <Clock className="h-3.5 w-3.5" />
            Tower
          </button>
        </div>
      </header>

      {/* Friends popover */}
      {showFriends && (
        <FriendsPopover
          friends={friendRows}
          yourAddress={myAddress}
          onVisit={visitHouse}
          onClose={() => setShowFriends(false)}
        />
      )}

      {/* Side panel / bottom sheet */}
      {selectedPlot && !showFriends && (
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
      {!selectedPlot && !showFriends && (
        <p className="absolute left-4 bottom-4 z-4 rounded-2xl border border-white/10 px-3 py-2 text-[12.5px] text-white/50 max-w-[calc(100%-32px)]" style={{ background: 'rgba(24,19,34,0.78)', backdropFilter: 'blur(14px) saturate(1.2)' }}>
          {view === 'street' ? (
            <><b className="text-white/80">Drag</b> to walk the block · <b className="text-white/80">scroll or pinch</b> to zoom · <b className="text-white/80">tap a billboard</b> to meet the neighbor</>
          ) : (
            <><b className="text-white/80">Zoom in</b> to see houses · <b className="text-white/80">tap a lot</b> to fly there · pins show you and your friends</>
          )}
        </p>
      )}
    </div>
  );
}

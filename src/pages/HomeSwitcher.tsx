import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useHomeLayout } from '../hooks/useHomeLayout';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDock } from '../components/dock/DockContext';
import { RouteFallback } from '../shared/ui/RouteFallback';
import { useHasInterests } from '../hooks/useHasInterests';

const CompanionLobbyPage = lazy(() => import('./CompanionLobbyPage').then(m => ({ default: m.CompanionLobbyPage })));

let v3Loaded = false;
const loadV3 = () => import('./HomeV3Page').then(m => { v3Loaded = true; return m; });
const HomeV3Page = lazy(() => loadV3().then(m => ({ default: m.HomeV3Page })));

/** V3 (live feed) is heavy; past this, a slow connection gets the lighter Classic home. */
const V3_LOAD_BUDGET_MS = 4000;
const SLOW_KEY = 'velvet.home_slow_fallback';

function connectionLooksSlow(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !!c && (!!c.saveData || ['slow-2g', '2g', '3g'].includes(c.effectiveType ?? ''));
}

function readSlowFlag(): boolean {
  try { return sessionStorage.getItem(SLOW_KEY) === '1'; } catch { return false; }
}

/**
 * Just finished the arrival: the coach's chat pops up with their first words waiting (the plan
 * confirmed, and a pointer to the objectives button), once.
 */
function ArrivalCoachPopup({ coachId }: { coachId: string }) {
  const dock = useDock();
  const [, setParams] = useSearchParams();
  const opened = useRef(false);
  const known = dock.companions.some(c => c.id === coachId);
  useEffect(() => {
    if (opened.current || !known) return;
    opened.current = true;
    dock.openCompanion(coachId);
    setParams(p => { const next = new URLSearchParams(p); next.delete('coach'); return next; }, { replace: true });
  }, [known, coachId, dock, setParams]);
  return null;
}

export function HomeSwitcher() {
  const [searchParams] = useSearchParams();
  const arrivalCoach = searchParams.get('arrived') === '1' ? searchParams.get('coach') : null;
  const [layout] = useHomeLayout();
  const navigate = useNavigate();
  // V3 is a feed built on interests; without any, Classic is the useful home.
  const hasInterests = useHasInterests();
  // Session-only: the saved preference stays V3 and is used again next visit.
  const [useClassic, setUseClassic] = useState(() => readSlowFlag() || connectionLooksSlow());

  useEffect(() => {
    if (layout !== 'v3' || useClassic || v3Loaded) return;
    const timer = setTimeout(() => {
      if (v3Loaded) return;
      try { sessionStorage.setItem(SLOW_KEY, '1'); } catch { /* storage blocked */ }
      setUseClassic(true);
    }, V3_LOAD_BUDGET_MS);
    loadV3().then(() => clearTimeout(timer), () => {});
    return () => clearTimeout(timer);
  }, [layout, useClassic]);

  const needsInterests = layout === 'v3' && hasInterests === false;
  const showV3 = layout === 'v3' && !useClassic && !needsInterests;

  return (
    <Suspense fallback={<RouteFallback />}>
      {arrivalCoach && <ArrivalCoachPopup coachId={arrivalCoach} />}
      {needsInterests && (
        <div className="flex items-center justify-between gap-3 border-b border-white/8 bg-white/[0.03] px-4 py-2 text-xs text-white/70">
          <span>Pick a few interests to unlock your V3 feed.</span>
          <button type="button" onClick={() => navigate('/profile')} className="flex-shrink-0 font-semibold text-pink-300 hover:text-pink-200">
            Choose interests
          </button>
        </div>
      )}
      {layout === 'v3' && useClassic && !needsInterests && (
        <div className="flex items-center justify-between gap-3 border-b border-white/8 bg-white/[0.03] px-4 py-2 text-xs text-white/70">
          <span>Slow connection, so we opened the faster Classic home.</span>
          <button
            type="button"
            onClick={() => {
              try { sessionStorage.removeItem(SLOW_KEY); } catch { /* storage blocked */ }
              setUseClassic(false);
            }}
            className="flex-shrink-0 font-semibold text-pink-300 hover:text-pink-200"
          >
            Load V3 anyway
          </button>
        </div>
      )}
      {showV3 ? <HomeV3Page /> : <CompanionLobbyPage />}
    </Suspense>
  );
}

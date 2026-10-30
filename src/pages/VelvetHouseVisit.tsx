import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { isVisitEndMessage } from '../games/velvet-house/bridge/protocol';
import { fetchFriendHouse } from '../services/velvetHouseVisits';

const GAME_PATH = '/games/velvet-house-next/index.html';
// Where the game reads the house it is visiting (kernel/config.ts VISIT_KEY). It is never saved anywhere.
const VISIT_KEY = 'velvet-sims:visit';

/** A friend's Velvet Sims house, to look round: the game opens it in visit mode, and Go home comes back here. */
export function VelvetHouseVisit() {
  const navigate = useNavigate();
  const { ownerId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const from = searchParams.get('from');
  const [state, setState] = useState<'loading' | 'ready' | 'closed'>('loading');
  const [owner, setOwner] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Back to the player's own house, straight in.
  const goHome = () => navigate(from ? `/velvet-house?companion=${encodeURIComponent(from)}&start=continue` : '/velvet-house');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const house = await fetchFriendHouse(ownerId).catch(() => null);
      if (cancelled) return;
      if (!house) { setState('closed'); return; }
      try { localStorage.setItem(VISIT_KEY, JSON.stringify(house)); } catch { setState('closed'); return; }
      setOwner(typeof house.ownerName === 'string' ? house.ownerName : '');
      setState('ready');
    })();
    return () => { cancelled = true; try { localStorage.removeItem(VISIT_KEY); } catch { /* storage blocked */ } };
  }, [ownerId]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow || e.origin !== window.location.origin) return;
      if (isVisitEndMessage(e.data)) goHome();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  });

  return (
    <div className="fixed inset-0 bg-[#0a0a0f] z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 bg-black/40 border-b border-white/10 flex-shrink-0">
        <button onClick={goHome} className="flex items-center gap-2 text-white/70 hover:text-white text-sm font-medium transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Go home
        </button>
        <span className="text-white/40 text-xs font-medium tracking-wide truncate px-2">{owner ? `VISITING ${owner.toUpperCase()}` : 'VELVET SIMS'}</span>
        <div className="w-16" />
      </div>
      {state === 'loading' && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-white/40 animate-spin" aria-label="Loading" />
        </div>
      )}
      {state === 'closed' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center text-white">
          <p className="text-lg font-semibold">This house isn't open to visitors.</p>
          <p className="text-sm text-white/60 max-w-sm">Only friends can visit, and only while the owner has their house open.</p>
          <button onClick={goHome} className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/15">Back to my house</button>
        </div>
      )}
      {state === 'ready' && (
        <iframe ref={iframeRef} src={`${GAME_PATH}?visit=1`} title={owner ? `${owner}'s house` : "A friend's house"} className="flex-1 w-full border-0" />
      )}
    </div>
  );
}

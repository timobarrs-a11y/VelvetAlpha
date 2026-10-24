import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Star, Volume2, VolumeX } from 'lucide-react';
import { Shootout } from '../games/shootout/game';
import { Shootout3D, type RunResult, type ShootoutEvent } from '../games/shootout/three/game3d';
import { LEVELS, starsFor, type Ball } from '../games/shootout/engine';
import { isMuted, setMuted } from '../games/shootout/audio';

const SAVE = 'velvet.shootout.v1';
interface Progress { unlocked: number; best: Record<number, number>; stars: Record<number, number>; moneyRack: number }
const RACK_NAMES = ['Left corner', 'Left wing', 'Top', 'Right wing', 'Right corner'];

function loadProgress(): Progress {
  try { const p = JSON.parse(localStorage.getItem(SAVE) || 'null'); if (p) return { unlocked: 0, best: {}, stars: {}, moneyRack: 4, ...p }; } catch { /* storage blocked */ }
  return { unlocked: 0, best: {}, stars: {}, moneyRack: 4 };
}
function saveProgress(p: Progress) { try { localStorage.setItem(SAVE, JSON.stringify(p)); } catch { /* storage blocked */ } }

type Screen = 'title' | 'play' | 'results';
type Rack = Array<{ kind: Ball['kind']; state: 'done' | 'now' | 'left' }>;
interface Hud { score: number; time: number; spot: string; streak: number }
interface Callout { id: number; big: string; small?: string; tone: 'gold' | 'green' | 'red' | 'money' | 'starry' | 'fire' }
interface Card { id: number; title: string; sub: string; money: boolean }

/** What the page needs from a game: the 3D one, or the 2D one when WebGL is missing. */
interface GameLike {
  start(): void; stop(): void; begin(): void; resize(): void; press(): void; release(): void;
  hud(): Hud & { fade?: number };
  rackState(): Rack;
  meter?(): { hold: number; rise: number; green: number; active: boolean };
}

const GRADE_TEXT: Record<string, [string, Callout['tone']] | undefined> = {
  perfect: ['PERFECT RELEASE', 'green'],
  early: ['EARLY', 'red'], late: ['LATE', 'red'],
  'very-early': ['WAY EARLY', 'red'], 'very-late': ['WAY LATE', 'red'],
};

/**
 * 3-Point Shootout: a standalone timing game. Five racks around the arc and
 * two deep Starry balls against the clock. Hold to rise into your jump,
 * release at the top: hit the green and it's cash. The arena is 3D (Three.js)
 * with a TV-style graphics package drawn over it here.
 */
export function ShootoutGame() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [screen, setScreen] = useState<Screen>('title');
  const [levelId, setLevelId] = useState(() => Math.min(loadProgress().unlocked, LEVELS.length - 1));
  const [result, setResult] = useState<(RunResult & { stars: number; newBest: boolean; unlockedNext: boolean }) | null>(null);
  const [hud, setHud] = useState<Hud>({ score: 0, time: 0, spot: '', streak: 0 });
  const [rack, setRack] = useState<Rack>([]);
  const [muted, setMutedState] = useState(isMuted());
  const [callout, setCallout] = useState<Callout | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [replay, setReplay] = useState(false);
  const [onFire, setOnFire] = useState(false);
  const [final10, setFinal10] = useState(false);
  const [showHint, setShowHint] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameLike | null>(null);
  const seq = useRef(0);

  const finish = useCallback((r: RunResult) => {
    const p = loadProgress();
    const stars = starsFor(r.score, r.level, r.max);
    const newBest = r.score > (p.best[r.level.id] ?? -1);
    const unlockedNext = r.score >= r.level.unlockAt && p.unlocked <= r.level.id && r.level.id < LEVELS.length - 1;
    const next: Progress = {
      ...p,
      best: { ...p.best, [r.level.id]: Math.max(p.best[r.level.id] ?? 0, r.score) },
      stars: { ...p.stars, [r.level.id]: Math.max(p.stars[r.level.id] ?? 0, stars) },
      unlocked: unlockedNext ? r.level.id + 1 : p.unlocked,
    };
    saveProgress(next); setProgress(next);
    setResult({ ...r, stars, newBest, unlockedNext });
    setTimeout(() => setScreen('results'), 1800);
  }, []);

  // Broadcast graphics react to what happens on the floor.
  const onEvent = useCallback((e: ShootoutEvent) => {
    const id = ++seq.current;
    const say = (c: Omit<Callout, 'id'>) => setCallout({ ...c, id });
    switch (e.type) {
      case 'rack':
        setCard({ id, title: `RACK ${e.index + 1}`, sub: e.label.toUpperCase(), money: e.money });
        break;
      case 'grade': {
        setShowHint(false);
        const g = GRADE_TEXT[e.grade];
        if (g) say({ big: g[0], tone: g[1] });
        break;
      }
      case 'make': {
        const what = e.points >= 3 ? 'STARRY BALL' : e.points === 2 ? 'MONEY BALL' : e.outcome === 'swish' ? 'SWISH' : e.outcome === 'rim-in' ? 'IN AND OUT... IN!' : 'BUCKET';
        say({ big: `+${e.points}`, small: what, tone: e.points >= 3 ? 'starry' : e.points === 2 ? 'money' : e.streak >= 3 ? 'fire' : 'gold' });
        break;
      }
      case 'miss':
        if (e.outcome === 'airball') say({ big: 'AIRBALL', tone: 'red' });
        else if (e.outcome === 'rim-out') say({ big: 'RIMMED OUT', tone: 'red' });
        setOnFire(false);
        break;
      case 'fire': setOnFire(true); break;
      case 'replay': setReplay(e.on); break;
      case 'final10': setFinal10(true); break;
    }
  }, []);

  // Start a run when the play screen mounts.
  useEffect(() => {
    if (screen !== 'play' || !canvasRef.current) return;
    setCallout(null); setCard(null); setReplay(false); setOnFire(false); setFinal10(false); setShowHint(true);
    let game: GameLike;
    try {
      game = new Shootout3D(canvasRef.current, LEVELS[levelId], progress.moneyRack, { onEvent, onDone: finish });
    } catch {
      // No WebGL: fall back to the 2D court.
      game = new Shootout(canvasRef.current, LEVELS[levelId], progress.moneyRack, { onDone: finish });
    }
    gameRef.current = game;
    if (import.meta.env.DEV) (window as unknown as { __shootout?: GameLike }).__shootout = game;
    game.begin(); game.start();
    const onResize = () => game.resize();
    window.addEventListener('resize', onResize);
    const hudTimer = setInterval(() => {
      const h = game.hud();
      setHud(prev => (prev.score === h.score && prev.time.toFixed(1) === h.time.toFixed(1) && prev.spot === h.spot && prev.streak === h.streak) ? prev : { score: h.score, time: h.time, spot: h.spot, streak: h.streak });
      setRack(prev => { const r = game.rackState(); return JSON.stringify(r) === JSON.stringify(prev) ? prev : r; });
    }, 100);
    // Camera-cut fades follow the game every frame.
    let raf = 0;
    const tick = () => { if (fadeRef.current) fadeRef.current.style.opacity = String(game.hud().fade ?? 0); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => { game.stop(); clearInterval(hudTimer); cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); gameRef.current = null; };
  }, [screen, levelId, progress.moneyRack, finish, onEvent]);

  // Clear callouts and cards after their animations.
  useEffect(() => { if (!callout) return; const t = setTimeout(() => setCallout(null), 1300); return () => clearTimeout(t); }, [callout]);
  useEffect(() => { if (!card) return; const t = setTimeout(() => setCard(null), 2100); return () => clearTimeout(t); }, [card]);

  // Hold anywhere (or Space) to shoot.
  useEffect(() => {
    if (screen !== 'play') return;
    const down = (e: KeyboardEvent) => { if (e.code === 'Space' && !e.repeat) { e.preventDefault(); gameRef.current?.press(); } };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); gameRef.current?.release(); } };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [screen]);

  const toggleMute = () => { setMuted(!muted); setMutedState(!muted); };
  const level = LEVELS[levelId];

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-[#05060C] text-white" style={{ touchAction: 'none' }}>
      <style>{BROADCAST_CSS}</style>
      {screen === 'play' && (
        <>
          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full"
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); gameRef.current?.press(); }}
            onPointerUp={() => gameRef.current?.release()}
            onPointerCancel={() => gameRef.current?.release()}
            onContextMenu={(e) => e.preventDefault()}
          />
          <BroadcastOverlay hud={hud} rack={rack} level={level.name} callout={callout} card={card} replay={replay} onFire={onFire} final10={final10} />
          <ShotMeter gameRef={gameRef} />
          <div ref={fadeRef} className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: 0 }} />
          <div className="absolute right-3 top-3 flex gap-2" style={{ marginTop: 'env(safe-area-inset-top)' }}>
            <button type="button" onClick={toggleMute} className="rounded-lg bg-black/50 p-2 backdrop-blur" aria-label={muted ? 'Sound on' : 'Mute'}>{muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>
          </div>
          {showHint && (
            <div className="sh-pulse pointer-events-none absolute top-[12%] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/15 bg-black/55 px-4 py-2 text-xs font-bold tracking-wide sm:px-5 sm:py-2.5 sm:text-sm text-white/90 backdrop-blur">
              HOLD to jump · RELEASE at the top
            </div>
          )}
        </>
      )}

      {screen === 'title' && (
        <div className="flex h-full flex-col items-center justify-center overflow-y-auto bg-[radial-gradient(ellipse_at_top,#2a1a3e,#05060C_70%)] px-5 py-8">
          <button type="button" onClick={() => navigate(-1)} className="absolute left-4 top-4 flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm"><ArrowLeft className="h-4 w-4" />Back</button>
          <div className="text-center">
            <div className="text-xs font-bold uppercase tracking-[0.4em] text-amber-300">Velvet</div>
            <h1 className="mt-1 text-4xl font-black italic tracking-tight sm:text-5xl">3-POINT SHOOTOUT</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm text-white/65">Five racks, two deep Starry balls, one clock. Hold to rise, release at the top. Hit the green.</p>
          </div>
          <div className="mt-6 grid w-full max-w-md gap-2">
            {LEVELS.map(l => {
              const locked = l.id > progress.unlocked;
              return (
                <button
                  key={l.id}
                  type="button"
                  disabled={locked}
                  onClick={() => setLevelId(l.id)}
                  className={`flex items-center justify-between rounded-xl border px-4 py-2.5 text-left transition ${
                    levelId === l.id ? 'border-amber-300 bg-amber-300/15' : 'border-white/10 bg-white/5 hover:bg-white/10'
                  } ${locked ? 'opacity-40' : ''}`}
                >
                  <span>
                    <span className="block font-bold">{l.name}</span>
                    <span className="block text-[11px] text-white/55">{locked ? `Score ${LEVELS[l.id - 1].unlockAt}+ on ${LEVELS[l.id - 1].name} to unlock` : `${l.clock}s · green window ${Math.round(l.green * 1000)}ms`}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {progress.best[l.id] != null && <span className="text-xs text-white/60">Best {progress.best[l.id]}</span>}
                    {locked ? <Lock className="h-4 w-4" /> : <span className="flex">{[0, 1, 2].map(i => <Star key={i} className={`h-4 w-4 ${i < (progress.stars[l.id] ?? 0) ? 'fill-amber-300 text-amber-300' : 'text-white/25'}`} />)}</span>}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-5 w-full max-w-md">
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-white/55">Your money rack</div>
            <div className="grid grid-cols-5 gap-1.5">
              {RACK_NAMES.map((n, i) => (
                <button key={n} type="button" onClick={() => { const p = { ...progress, moneyRack: i }; saveProgress(p); setProgress(p); }}
                  className={`rounded-lg px-1 py-2 text-[10px] font-semibold ${progress.moneyRack === i ? 'bg-gradient-to-br from-rose-500 to-blue-800' : 'bg-white/5 hover:bg-white/10'}`}>{n}</button>
              ))}
            </div>
          </div>
          <button type="button" onClick={() => setScreen('play')} className="mt-6 rounded-2xl bg-gradient-to-r from-amber-300 to-orange-400 px-10 py-3.5 text-lg font-black text-[#1d1a10] shadow-[0_10px_40px_rgba(251,191,36,.35)] transition hover:scale-[1.03]">
            SHOOT
          </button>
          <p className="mt-3 text-[11px] text-white/45">Hold the screen, mouse or Space · 3 in a row = on fire</p>
        </div>
      )}

      {screen === 'results' && result && (
        <div className="flex h-full flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,#2a1a3e,#05060C_70%)] px-5 text-center">
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-white/50">{result.level.name}</div>
          <div className="mt-2 text-7xl font-black text-amber-300">{result.score}</div>
          <div className="text-sm text-white/60">out of {result.max}</div>
          <div className="mt-3 flex gap-1">{[0, 1, 2].map(i => <Star key={i} className={`h-9 w-9 ${i < result.stars ? 'fill-amber-300 text-amber-300' : 'text-white/20'}`} />)}</div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-xl bg-white/5 px-3 py-2"><div className="text-[10px] uppercase text-white/50">Makes</div><div className="font-bold">{result.makes}/{result.shots}</div></div>
            <div className="rounded-xl bg-white/5 px-3 py-2"><div className="text-[10px] uppercase text-white/50">Best streak</div><div className="font-bold">{result.bestStreak}</div></div>
            <div className="rounded-xl bg-white/5 px-3 py-2"><div className="text-[10px] uppercase text-white/50">Best</div><div className="font-bold">{progress.best[result.level.id] ?? result.score}</div></div>
          </div>
          {result.newBest && <div className="mt-4 rounded-full bg-amber-300/20 px-4 py-1 text-sm font-bold text-amber-200">New personal best!</div>}
          {result.unlockedNext && <div className="mt-2 rounded-full bg-emerald-400/20 px-4 py-1 text-sm font-bold text-emerald-200">{LEVELS[result.level.id + 1].name} unlocked</div>}
          <div className="mt-6 flex gap-3">
            <button type="button" onClick={() => setScreen('title')} className="rounded-xl bg-white/10 px-5 py-2.5 font-semibold">Levels</button>
            <button type="button" onClick={() => { if (result.unlockedNext) setLevelId(result.level.id + 1); setScreen('play'); }} className="rounded-xl bg-gradient-to-r from-amber-300 to-orange-400 px-6 py-2.5 font-black text-[#1d1a10]">
              {result.unlockedNext ? 'Next level' : 'Run it back'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const BROADCAST_CSS = `
@keyframes sh-card { 0% { transform: translateX(-110%) skewX(-12deg); } 14%, 82% { transform: translateX(0) skewX(-12deg); } 100% { transform: translateX(-110%) skewX(-12deg); } }
@keyframes sh-pop { 0% { transform: translate(-50%,-50%) scale(.4); opacity: 0; } 14% { transform: translate(-50%,-50%) scale(1.18); opacity: 1; } 26% { transform: translate(-50%,-50%) scale(1); } 78% { opacity: 1; } 100% { transform: translate(-50%,-62%) scale(1.02); opacity: 0; } }
@keyframes sh-shine { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
@keyframes sh-pulse { 0%,100% { opacity: .85; } 50% { opacity: .45; } }
@keyframes sh-blink { 0%,100% { opacity: 1; } 50% { opacity: .25; } }
@keyframes sh-flame { 0%,100% { transform: scaleY(1); filter: hue-rotate(0deg); } 50% { transform: scaleY(1.15); filter: hue-rotate(-12deg); } }
@keyframes sh-tick { 0% { transform: scale(1.25); } 100% { transform: scale(1); } }
.sh-card { animation: sh-card 2.1s cubic-bezier(.2,.9,.2,1) both; }
.sh-pop { animation: sh-pop 1.3s cubic-bezier(.2,.9,.2,1) both; }
.sh-shine { background-size: 200% 100%; animation: sh-shine 1.6s linear infinite; }
.sh-pulse { animation: sh-pulse 1.8s ease-in-out infinite; }
.sh-blink { animation: sh-blink .8s steps(2) infinite; }
.sh-flame { animation: sh-flame .35s ease-in-out infinite; transform-origin: bottom; }
.sh-tick { animation: sh-tick .25s ease-out; }
`;

const TONE: Record<Callout['tone'], string> = {
  gold: 'from-amber-200 via-amber-300 to-orange-400 text-[#2a1600]',
  green: 'from-emerald-200 via-emerald-400 to-emerald-600 text-[#032013]',
  red: 'from-rose-300 via-red-500 to-red-700 text-white',
  money: 'from-rose-200 via-rose-500 to-blue-800 text-white',
  starry: 'from-indigo-100 via-white to-sky-300 text-[#0b1440]',
  fire: 'from-yellow-200 via-orange-500 to-red-600 text-white',
};

function RackDots({ rack }: { rack: Rack }) {
  return (
    <div className="flex gap-1">
      {rack.map((b, i) => (
        <span key={i} className={`h-3 w-3 rounded-full border transition ${b.state === 'done' ? 'scale-75 opacity-25' : ''} ${b.state === 'now' ? 'ring-2 ring-white/90 ring-offset-1 ring-offset-black' : ''} ${
          b.kind === 'money' ? 'border-blue-950 bg-gradient-to-br from-rose-100 via-rose-600 to-blue-900' : b.kind === 'starry' ? 'border-indigo-300 bg-gradient-to-br from-white to-sky-200' : 'border-orange-950 bg-gradient-to-br from-orange-300 to-orange-700'
        }`} />
      ))}
    </div>
  );
}

/** The TV graphics: score bug, rack cards, callouts, replay bug, on-fire banner. */
function BroadcastOverlay({ hud, rack, level, callout, card, replay, onFire, final10 }: {
  hud: Hud; rack: Rack; level: string; callout: Callout | null; card: Card | null; replay: boolean; onFire: boolean; final10: boolean;
}) {
  const low = hud.time <= 10;
  return (
    <div className="pointer-events-none absolute inset-0 font-sans" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Letterbox during replays. */}
      <div className={`absolute inset-x-0 top-0 bg-black transition-all duration-300 ${replay ? 'h-[9%]' : 'h-0'}`} />
      <div className={`absolute inset-x-0 bottom-0 bg-black transition-all duration-300 ${replay ? 'h-[9%]' : 'h-0'}`} />
      {replay && (
        <div className="absolute left-4 top-[calc(9%+12px)] flex items-center gap-2">
          <span className="sh-blink h-2.5 w-2.5 rounded-full bg-red-500" />
          <span className="skew-x-[-12deg] bg-white px-3 py-1 text-sm font-black italic tracking-widest text-black">REPLAY</span>
          <span className="text-[10px] font-semibold tracking-widest text-white/70">TAP TO SKIP</span>
        </div>
      )}

      {/* Score bug, bottom left. */}
      <div className={`absolute bottom-3 left-3 flex items-stretch overflow-hidden rounded-md shadow-[0_8px_30px_rgba(0,0,0,.5)] transition-opacity sm:bottom-5 sm:left-5 ${replay ? 'opacity-0' : ''}`}>
        <div className="flex flex-col justify-center bg-gradient-to-b from-[#7a1f4f] to-[#3d0d27] px-2.5 py-1.5">
          <div className="text-[8px] font-black uppercase tracking-[0.25em] text-amber-300">Velvet</div>
          <div className="text-[11px] font-black italic leading-none tracking-tight">3PT</div>
        </div>
        <div className="flex flex-col justify-center bg-[#0d0f1a]/90 px-3 py-1 backdrop-blur">
          <div className="text-[9px] font-bold uppercase tracking-widest text-white/50">{level}</div>
          <RackDots rack={rack} />
        </div>
        <div key={hud.score} className="sh-tick flex min-w-[3.25rem] items-center justify-center bg-gradient-to-b from-amber-200 to-amber-400 px-3 font-mono text-2xl font-black text-[#1d1300]">{hud.score}</div>
        <div className={`flex min-w-[4.5rem] items-center justify-center px-3 font-mono text-xl font-black tabular-nums ${low ? 'bg-red-600 text-white' : 'bg-[#181b2b] text-white'} ${final10 && low ? 'sh-blink' : ''}`}>
          {low ? hud.time.toFixed(1) : `0:${String(Math.ceil(hud.time)).padStart(2, '0')}`}
        </div>
      </div>

      {/* Streak chip above the bug. */}
      {hud.streak >= 2 && !replay && (
        <div className="absolute bottom-[4.25rem] left-3 skew-x-[-12deg] bg-gradient-to-r from-orange-500 to-red-600 px-3 py-0.5 text-xs font-black italic tracking-wider shadow-lg sm:bottom-[5rem] sm:left-5">
          {hud.streak} STRAIGHT{hud.streak >= 3 ? ' 🔥' : ''}
        </div>
      )}

      {/* Rack title card, slides in from the left. */}
      {card && (
        <div key={card.id} className="sh-card absolute left-0 top-[18%] origin-left">
          <div className={`ml-[-12px] flex items-center gap-3 py-2 pl-8 pr-6 shadow-2xl ${card.money ? 'bg-gradient-to-r from-rose-600 to-blue-900' : 'bg-gradient-to-r from-[#5C163A] to-[#2b0b1e]'}`}>
            <span className="text-3xl font-black italic tracking-tight sm:text-4xl">{card.title}</span>
            <span className="flex flex-col leading-tight">
              <span className="text-xs font-bold tracking-[0.25em] text-white/80">{card.sub}</span>
              {card.money && <span className="text-[11px] font-black tracking-[0.2em] text-amber-200">MONEY RACK · 2 PTS EVERY BALL</span>}
            </span>
          </div>
          <div className="h-1 w-full bg-amber-300" />
        </div>
      )}

      {/* Big centre callout. */}
      {callout && (
        <div key={callout.id} className="sh-pop absolute left-1/2 top-[34%] text-center">
          <div className={`sh-shine skew-x-[-10deg] bg-gradient-to-r ${TONE[callout.tone]} px-5 py-1 text-4xl font-black italic tracking-tight shadow-[0_10px_40px_rgba(0,0,0,.45)] sm:text-6xl`}>{callout.big}</div>
          {callout.small && <div className="mt-1.5 inline-block skew-x-[-10deg] bg-black/75 px-3 py-0.5 text-xs font-black tracking-[0.3em] text-white sm:text-sm">{callout.small}</div>}
        </div>
      )}

      {/* On fire banner across the top. */}
      {onFire && !replay && (
        <div className="absolute left-1/2 top-3 -translate-x-1/2 sm:top-5">
          <div className="sh-shine flex items-center gap-2 rounded-sm bg-gradient-to-r from-yellow-300 via-orange-500 to-red-600 px-4 py-1 text-sm font-black italic tracking-[0.2em] shadow-[0_0_30px_rgba(255,120,0,.6)]">
            <span className="sh-flame">🔥</span>ON FIRE · BIGGER GREEN<span className="sh-flame">🔥</span>
          </div>
        </div>
      )}
    </div>
  );
}

/** Vertical release meter beside the shooter, read straight from the game each frame. */
function ShotMeter({ gameRef }: { gameRef: MutableRefObject<GameLike | null> }) {
  const wrap = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const band = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const m = gameRef.current?.meter?.();
      if (m && wrap.current && fill.current && band.current) {
        const span = m.rise * 1.45;
        const pos = Math.min(1, m.hold / span);
        const lo = (m.rise - m.green / 2) / span, hi = (m.rise + m.green / 2) / span;
        const inGreen = m.hold >= m.rise - m.green / 2 && m.hold <= m.rise + m.green / 2;
        wrap.current.style.opacity = m.active && m.hold > 0 ? '1' : '0';
        fill.current.style.height = `${pos * 100}%`;
        fill.current.style.background = inGreen ? 'linear-gradient(#bbf7d0,#22c55e)' : pos > hi ? 'linear-gradient(#fecaca,#ef4444)' : 'linear-gradient(#fff,#fcd34d)';
        band.current.style.bottom = `${lo * 100}%`;
        band.current.style.height = `${Math.max(2, (hi - lo) * 100)}%`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [gameRef]);
  return (
    <div ref={wrap} className="pointer-events-none absolute right-[22%] top-1/2 h-[30vh] max-h-56 w-3 -translate-y-1/2 transition-opacity duration-150" style={{ opacity: 0 }}>
      <div className="absolute inset-0 overflow-hidden rounded-full border border-white/40 bg-black/55 shadow-[0_0_20px_rgba(0,0,0,.6)]">
        <div ref={band} className="absolute inset-x-0 bg-emerald-400/60 shadow-[0_0_12px_#34d399]" />
        <div ref={fill} className="absolute inset-x-0 bottom-0 rounded-full" />
      </div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Star, Volume2, VolumeX } from 'lucide-react';
import { Shootout, type RunResult } from '../games/shootout/game';
import { LEVELS, starsFor } from '../games/shootout/engine';
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

/**
 * 3-Point Shootout: a standalone timing game. Five racks around the arc and
 * two deep Starry balls against the clock. Hold to rise into your jump,
 * release at the top: hit the green and it's cash.
 */
export function ShootoutGame() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [screen, setScreen] = useState<Screen>('title');
  const [levelId, setLevelId] = useState(() => Math.min(loadProgress().unlocked, LEVELS.length - 1));
  const [result, setResult] = useState<(RunResult & { stars: number; newBest: boolean; unlockedNext: boolean }) | null>(null);
  const [hud, setHud] = useState({ score: 0, time: 0, spot: '', streak: 0 });
  const [rack, setRack] = useState<ReturnType<Shootout['rackState']>>([]);
  const [muted, setMutedState] = useState(isMuted());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Shootout | null>(null);

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
    setTimeout(() => setScreen('results'), 1400);
  }, []);

  // Start a run when the play screen mounts.
  useEffect(() => {
    if (screen !== 'play' || !canvasRef.current) return;
    const game = new Shootout(canvasRef.current, LEVELS[levelId], progress.moneyRack, { onDone: finish });
    gameRef.current = game;
    game.begin(); game.start();
    const onResize = () => game.resize();
    window.addEventListener('resize', onResize);
    const hudTimer = setInterval(() => {
      const h = game.hud();
      setHud({ score: h.score, time: h.time, spot: h.spot, streak: h.streak });
      setRack(game.rackState());
    }, 100);
    return () => { game.stop(); clearInterval(hudTimer); window.removeEventListener('resize', onResize); gameRef.current = null; };
  }, [screen, levelId, progress.moneyRack, finish]);

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
          {/* Scoreboard */}
          <div className="pointer-events-none absolute left-1/2 top-3 flex -translate-x-1/2 items-stretch overflow-hidden rounded-xl border border-white/10 bg-black/60 font-mono shadow-xl backdrop-blur">
            <div className="px-4 py-1.5 text-center"><div className="text-[9px] tracking-widest text-white/50">SCORE</div><div className="text-2xl font-black text-amber-300">{hud.score}</div></div>
            <div className={`px-4 py-1.5 text-center ${hud.time <= 10 ? 'bg-red-600/40' : ''}`}><div className="text-[9px] tracking-widest text-white/50">TIME</div><div className={`text-2xl font-black ${hud.time <= 10 ? 'text-red-300' : 'text-white'}`}>{hud.time.toFixed(1)}</div></div>
          </div>
          <div className="pointer-events-none absolute left-3 top-3 text-xs">
            <div className="rounded-lg bg-black/50 px-2.5 py-1 font-semibold">{level.name}</div>
            {hud.streak >= 2 && <div className="mt-1 rounded-lg bg-orange-500/80 px-2.5 py-1 font-bold">{hud.streak} in a row{hud.streak >= 3 ? ' 🔥' : ''}</div>}
          </div>
          <div className="absolute right-3 top-3 flex gap-2">
            <button type="button" onClick={toggleMute} className="rounded-lg bg-black/50 p-2" aria-label={muted ? 'Sound on' : 'Mute'}>{muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>
          </div>
          {/* The rack: balls left at this spot. */}
          <div className="pointer-events-none absolute bottom-24 left-3 rounded-xl bg-black/50 px-3 py-2">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-white/60">{hud.spot}</div>
            <div className="flex gap-1.5">
              {rack.map((b, i) => (
                <span key={i} className={`h-4 w-4 rounded-full border ${b.state === 'done' ? 'opacity-20' : ''} ${b.state === 'now' ? 'ring-2 ring-white' : ''} ${
                  b.kind === 'money' ? 'border-blue-900 bg-gradient-to-br from-rose-100 via-rose-600 to-blue-900' : b.kind === 'starry' ? 'border-indigo-300 bg-white' : 'border-orange-900 bg-orange-500'
                }`} />
              ))}
            </div>
          </div>
          <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-4 py-2 text-xs font-semibold text-white/80">
            Hold to jump · release at the top
          </div>
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

import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Star, Trophy } from 'lucide-react';
import type { RunResult } from '../games/shootout/three/game3d';
import { LEVELS, starsFor } from '../games/shootout/engine';
import { RunView } from '../games/shootout/ui/RunView';
import { Contest, type ContestResult } from '../games/shootout/ui/Contest';

const SAVE = 'velvet.shootout.v1';
interface Progress { unlocked: number; best: Record<number, number>; stars: Record<number, number>; moneyRack: number; wins: Record<number, number> }
const RACK_NAMES = ['Left corner', 'Left wing', 'Top', 'Right wing', 'Right corner'];
const FRESH: Progress = { unlocked: 0, best: {}, stars: {}, moneyRack: 4, wins: {} };

function loadProgress(): Progress {
  try { const p = JSON.parse(localStorage.getItem(SAVE) || 'null'); if (p) return { ...FRESH, ...p }; } catch { /* storage blocked */ }
  return FRESH;
}
function saveProgress(p: Progress) { try { localStorage.setItem(SAVE, JSON.stringify(p)); } catch { /* storage blocked */ } }

type Screen = 'title' | 'play' | 'results' | 'contest';

/**
 * 3-Point Shootout: a standalone timing game. Five racks around the arc and
 * two deep Starry balls against the clock. Hold to rise into your jump,
 * release at the top: hit the green and it's cash. Practice solo, or enter
 * the contest against five AI shooters.
 */
export function ShootoutGame() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [screen, setScreen] = useState<Screen>('title');
  const [runNo, setRunNo] = useState(0);
  const [levelId, setLevelId] = useState(() => Math.min(loadProgress().unlocked, LEVELS.length - 1));
  const [result, setResult] = useState<(RunResult & { stars: number; newBest: boolean; unlockedNext: boolean }) | null>(null);

  /** Bank a score: personal best, stars, and the next level when it's earned. */
  const bank = useCallback((levelIdx: number, score: number, max: number, extra: Partial<Progress> = {}, forceUnlock = false) => {
    const p = loadProgress();
    const lv = LEVELS[levelIdx];
    const stars = starsFor(score, lv, max);
    const newBest = score > (p.best[lv.id] ?? -1);
    const unlockedNext = (forceUnlock || score >= lv.unlockAt) && p.unlocked <= lv.id && lv.id < LEVELS.length - 1;
    const next: Progress = {
      ...p, ...extra,
      best: { ...p.best, [lv.id]: Math.max(p.best[lv.id] ?? 0, score) },
      stars: { ...p.stars, [lv.id]: Math.max(p.stars[lv.id] ?? 0, stars) },
      unlocked: unlockedNext ? lv.id + 1 : p.unlocked,
    };
    saveProgress(next); setProgress(next);
    return { stars, newBest, unlockedNext };
  }, []);

  const finishPractice = useCallback((r: RunResult) => {
    setResult({ ...r, ...bank(r.level.id, r.score, r.max) });
    setScreen('results');
  }, [bank]);

  const finishContest = useCallback((r: ContestResult) => {
    const p = loadProgress();
    const best = Math.max(r.round1, r.final ?? 0);
    // Winning the title unlocks the next level too.
    bank(r.level.id, best, 40, r.won ? { wins: { ...p.wins, [r.level.id]: (p.wins[r.level.id] ?? 0) + 1 } } : {}, r.won);
  }, [bank]);

  const level = LEVELS[levelId];

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-[#05060C] text-white" style={{ touchAction: 'none' }}>
      {screen === 'play' && (
        <RunView key={runNo} level={level} moneyRack={progress.moneyRack} label={level.name} onDone={finishPractice} />
      )}

      {screen === 'contest' && (
        <Contest key={runNo} level={level} moneyRack={progress.moneyRack} onExit={() => { setScreen('title'); setRunNo(n => n + 1); }} onFinish={finishContest} />
      )}

      {screen === 'title' && (
        <div className="flex h-full flex-col items-center justify-center overflow-y-auto bg-[radial-gradient(ellipse_at_top,#2a1a3e,#05060C_70%)] px-5 py-8">
          <button type="button" onClick={() => navigate(-1)} className="absolute left-4 top-4 flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm"><ArrowLeft className="h-4 w-4" />Back</button>
          <div className="mt-10 text-center sm:mt-0">
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
                    {(progress.wins[l.id] ?? 0) > 0 && <Trophy className="h-3.5 w-3.5 text-amber-300" />}
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
          <div className="mt-6 flex w-full max-w-md flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => { setRunNo(n => n + 1); setScreen('contest'); }} className="flex-1 rounded-2xl bg-gradient-to-r from-amber-300 to-orange-400 px-6 py-3 text-left text-[#1d1a10] shadow-[0_10px_40px_rgba(251,191,36,.35)] transition hover:scale-[1.02]">
              <span className="block text-lg font-black">CONTEST</span>
              <span className="block text-[11px] font-semibold opacity-75">You vs 5 AI shooters · final · shoot-offs</span>
            </button>
            <button type="button" onClick={() => { setRunNo(n => n + 1); setScreen('play'); }} className="flex-1 rounded-2xl border border-white/15 bg-white/5 px-6 py-3 text-left transition hover:bg-white/10">
              <span className="block text-lg font-black">PRACTICE</span>
              <span className="block text-[11px] text-white/55">Solo run · unlock levels · stars</span>
            </button>
          </div>
          {(progress.wins[levelId] ?? 0) > 0 && <p className="mt-3 flex items-center gap-1.5 text-xs font-bold text-amber-200"><Trophy className="h-3.5 w-3.5" />{progress.wins[levelId]} contest {progress.wins[levelId] === 1 ? 'title' : 'titles'} on {level.name}</p>}
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
            <button type="button" onClick={() => { if (result.unlockedNext) setLevelId(result.level.id + 1); setRunNo(n => n + 1); setScreen('play'); }} className="rounded-xl bg-gradient-to-r from-amber-300 to-orange-400 px-6 py-2.5 font-black text-[#1d1a10]">
              {result.unlockedNext ? 'Next level' : 'Run it back'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

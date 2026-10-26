import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Lock, Star, Trophy } from 'lucide-react';
import type { RunResult } from '../games/shootout/three/game3d';
import { LEVELS, starsFor } from '../games/shootout/engine';
import { RunView } from '../games/shootout/ui/RunView';
import { Contest, type ContestResult } from '../games/shootout/ui/Contest';
import { getLook, getView, setLook, setView, VIEW_NAMES, VIEWS, type Look, type View } from '../games/shootout/settings';
import { unlockAudio } from '../games/shootout/audio';

const SAVE = 'velvet.shootout.v1';
interface Progress { unlocked: number; best: Record<number, number>; stars: Record<number, number>; moneyRack: number; wins: Record<number, number>; attack: Record<number, number>; street: Record<number, number> }
const RACK_NAMES = ['Left corner', 'Left wing', 'Top', 'Right wing', 'Right corner'];
const FRESH: Progress = { unlocked: 0, best: {}, stars: {}, moneyRack: 4, wins: {}, attack: {}, street: {} };

function loadProgress(): Progress {
  try { const p = JSON.parse(localStorage.getItem(SAVE) || 'null'); if (p) return { ...FRESH, ...p }; } catch { /* storage blocked */ }
  return FRESH;
}
function saveProgress(p: Progress) { try { localStorage.setItem(SAVE, JSON.stringify(p)); } catch { /* storage blocked */ } }

type Screen = 'title' | 'play' | 'results' | 'contest' | 'attack' | 'attack-results' | 'street';

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
  const [look, setLookState] = useState<Look>(getLook);
  const [view, setViewState] = useState<View>(getView);
  const [levelId, setLevelId] = useState(() => Math.min(loadProgress().unlocked, LEVELS.length - 1));
  const [attack, setAttack] = useState<{ mode: 'attack' | 'street'; score: number; makes: number; shots: number; bestStreak: number; prev: number } | null>(null);
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

  const finishAttack = useCallback((r: RunResult) => {
    const p = loadProgress();
    const prev = p.attack[r.level.id] ?? 0;
    const next = { ...p, attack: { ...p.attack, [r.level.id]: Math.max(prev, r.score) } };
    saveProgress(next); setProgress(next);
    setAttack({ mode: 'attack', score: r.score, makes: r.makes, shots: r.shots, bestStreak: r.bestStreak, prev });
    setScreen('attack-results');
  }, []);

  const finishStreet = useCallback((r: RunResult) => {
    const p = loadProgress();
    const prev = p.street[r.level.id] ?? 0;
    const next = { ...p, street: { ...p.street, [r.level.id]: Math.max(prev, r.score) } };
    saveProgress(next); setProgress(next);
    setAttack({ mode: 'street', score: r.score, makes: r.makes, shots: r.shots, bestStreak: r.bestStreak, prev });
    setScreen('attack-results');
  }, []);

  const finishContest = useCallback((r: ContestResult) => {
    const p = loadProgress();
    // Contest scores include perfect-release bonuses, so they don't count toward
    // practice bests; winning the title records it and unlocks the next level.
    if (r.won) bank(r.level.id, 0, 40, { wins: { ...p.wins, [r.level.id]: (p.wins[r.level.id] ?? 0) + 1 } }, true);
  }, [bank]);

  const level = LEVELS[levelId];

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-[#05060C] text-white" style={{ touchAction: 'none' }}>
      {screen === 'play' && (
        <RunView key={runNo} level={level} moneyRack={progress.moneyRack} label={level.name} onDone={finishPractice} />
      )}

      {screen === 'attack' && (
        <RunView key={runNo} level={level} moneyRack={progress.moneyRack} label={`${level.name} · ATTACK`} opts={{ scoring: 'attack' }} onDone={finishAttack}
          ticker={h => (progress.attack[levelId] ? (
            <div className="w-[min(200px,48vw)] overflow-hidden rounded-md border border-white/10 bg-black/70 text-center shadow-xl backdrop-blur">
              <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-2 py-0.5 text-[10px] font-black italic tracking-wider">SCORE ATTACK</div>
              <div className="px-2 py-1 font-mono text-xs"><span className="text-white/50">HIGH </span><span className="font-black">{progress.attack[levelId].toLocaleString()}</span></div>
              {h.score > progress.attack[levelId] && <div className="bg-emerald-500/80 py-0.5 text-[10px] font-black tracking-wider">NEW HIGH SCORE PACE!</div>}
            </div>
          ) : null)}
        />
      )}

      {screen === 'street' && (
        <RunView key={runNo} level={level} moneyRack={progress.moneyRack} label={`${level.name} · STREET`} opts={{ control: 'touch' }} onDone={finishStreet} />
      )}

      {screen === 'attack-results' && attack && (
        <div className="flex h-full flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,#0f3a33,#05060C_70%)] px-5 text-center">
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-white/50">{level.name} · {attack.mode === 'street' ? 'Street' : 'Score Attack'}</div>
          <div className="mt-2 font-mono text-6xl font-black text-emerald-300 sm:text-7xl">{attack.score.toLocaleString()}</div>
          {attack.score > attack.prev
            ? <div className="mt-3 rounded-full bg-emerald-400/20 px-4 py-1 text-sm font-bold text-emerald-200">{attack.prev ? `New high score! (was ${attack.prev.toLocaleString()})` : 'First high score set!'}</div>
            : <div className="mt-3 text-sm text-white/60">High score {attack.prev.toLocaleString()} · {(attack.prev - attack.score).toLocaleString()} short</div>}
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-white/5 px-3 py-2"><div className="text-[10px] uppercase text-white/50">Makes</div><div className="font-bold">{attack.makes}/{attack.shots}</div></div>
            <div className="rounded-xl bg-white/5 px-3 py-2"><div className="text-[10px] uppercase text-white/50">Best streak</div><div className="font-bold">{attack.bestStreak}</div></div>
          </div>
          <p className="mt-4 max-w-xs text-xs text-white/50">{attack.mode === 'street' ? '2 or 3 by distance, +1 for a swish, +1 off the glass, money balls double.' : 'Make it: 100 a point. Perfect release: ×1.5. Perfects in a row stack ×1.1, ×1.2, ×1.3…'}</p>
          <div className="mt-6 flex gap-3">
            <button type="button" onClick={() => setScreen('title')} className="rounded-xl bg-white/10 px-5 py-2.5 font-semibold">Menu</button>
            <button type="button" onClick={() => { unlockAudio(); setRunNo(n => n + 1); setScreen(attack.mode); }} className="rounded-xl bg-gradient-to-r from-emerald-300 to-teal-400 px-6 py-2.5 font-black text-[#062019]">Go again</button>
          </div>
        </div>
      )}

      {screen === 'contest' && (
        <Contest key={runNo} level={level} moneyRack={progress.moneyRack} onExit={() => { setScreen('title'); setRunNo(n => n + 1); }} onFinish={finishContest} />
      )}

      {screen === 'title' && (
        <div className="flex h-full flex-col items-center overflow-y-auto bg-[radial-gradient(ellipse_at_top,#2a1a3e,#05060C_70%)] px-5 py-8 [&>*:nth-child(2)]:mt-auto [&>*:last-child]:mb-auto">
          <button type="button" onClick={() => navigate(-1)} className="absolute left-4 top-4 flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm"><ArrowLeft className="h-4 w-4" />Back</button>
          <div className="mt-10 text-center sm:mt-0">
            <div className="text-xs font-bold uppercase tracking-[0.4em] text-amber-300">Velvet</div>
            <h1 className="mt-1 text-4xl font-black italic tracking-tight sm:text-5xl">3-POINT SHOOTOUT</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm text-white/65">Five racks, two deep Starry balls, one clock. Hold to rise, let go on the green. The timing shifts a little every game.</p>
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
          <div className="mt-5 flex w-full max-w-md items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/55">Look</span>
            <span className="flex rounded-lg bg-white/5 p-0.5 text-xs font-bold">
              {(['arena', 'retro'] as const).map(l => (
                <button key={l} type="button" onClick={() => { setLook(l); setLookState(l); }} className={`rounded-md px-3 py-1 ${look === l ? 'bg-amber-300 text-black' : 'text-white/70'}`}>{l === 'arena' ? 'Arena' : 'Retro 8-bit'}</button>
              ))}
            </span>
          </div>
          <div className="mt-3 flex w-full max-w-md items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/55">View</span>
            <button type="button" onClick={() => { const v = VIEWS[(VIEWS.indexOf(view) + 1) % VIEWS.length]; setView(v); setViewState(v); }} className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1 text-xs font-bold text-white/85">
              <Camera className="h-3.5 w-3.5 text-amber-300" />{VIEW_NAMES[view]}<span className="text-white/40">▸</span>
            </button>
          </div>
          <div className="mt-4 w-full max-w-md">
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-white/55">Your money rack</div>
            <div className="grid grid-cols-5 gap-1.5">
              {RACK_NAMES.map((n, i) => (
                <button key={n} type="button" onClick={() => { const p = { ...progress, moneyRack: i }; saveProgress(p); setProgress(p); }}
                  className={`rounded-lg px-1 py-2 text-[10px] font-semibold ${progress.moneyRack === i ? 'bg-gradient-to-br from-rose-500 to-blue-800' : 'bg-white/5 hover:bg-white/10'}`}>{n}</button>
              ))}
            </div>
          </div>
          <div className="mt-6 flex w-full max-w-md flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => { unlockAudio(); setRunNo(n => n + 1); setScreen('contest'); }} className="flex-1 rounded-2xl bg-gradient-to-r from-amber-300 to-orange-400 px-6 py-3 text-left text-[#1d1a10] shadow-[0_10px_40px_rgba(251,191,36,.35)] transition hover:scale-[1.02]">
              <span className="block text-lg font-black">CONTEST</span>
              <span className="block text-[11px] font-semibold opacity-75">You vs 5 AI shooters · final · shoot-offs</span>
            </button>
            <button type="button" onClick={() => { unlockAudio(); setRunNo(n => n + 1); setScreen('attack'); }} className="flex-1 rounded-2xl bg-gradient-to-r from-emerald-300 to-teal-400 px-6 py-3 text-left text-[#062019] transition hover:scale-[1.02]">
              <span className="block text-lg font-black">SCORE ATTACK</span>
              <span className="block text-[11px] font-semibold opacity-75">{progress.attack[levelId] ? `High score ${progress.attack[levelId].toLocaleString()}` : 'Perfects multiply · beat your best'}</span>
            </button>
          </div>
          <div className="mt-2 w-full max-w-md">
            <button type="button" onClick={() => { unlockAudio(); setRunNo(n => n + 1); setScreen('street'); }} className="mb-2 w-full rounded-2xl bg-gradient-to-r from-sky-400 to-indigo-500 px-6 py-3 text-left transition hover:scale-[1.01]">
              <span className="block text-lg font-black">STREET <span className="ml-1 rounded bg-white/20 px-1.5 py-0.5 align-middle text-[10px] font-black tracking-wider">NEW · TOUCH</span></span>
              <span className="block text-[11px] font-semibold text-white/80">{progress.street[levelId] ? `Best ${progress.street[levelId]}` : 'Drag to aim, let go to shoot · random spots · 60 seconds · real physics'}</span>
            </button>
            <button type="button" onClick={() => { unlockAudio(); setRunNo(n => n + 1); setScreen('play'); }} className="w-full rounded-2xl border border-white/15 bg-white/5 px-6 py-2.5 text-left transition hover:bg-white/10">
              <span className="text-sm font-black">PRACTICE</span>
              <span className="ml-2 text-[11px] text-white/55">Solo run · classic 1/2/3 scoring · unlock levels · stars</span>
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

import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { FastForward, Volume2, VolumeX } from 'lucide-react';
import { Shootout } from '../game';
import { Shootout3D, type RunOptions, type RunResult, type ShootoutEvent } from '../three/game3d';
import type { Ball, Level } from '../engine';
import { isMuted, setMuted, unlockAudio } from '../audio';

// One run on the floor: the 3D game plus the broadcast graphics over it.
// Used for practice runs, your contest rounds, and watching rivals shoot.

export type Rack = Array<{ kind: Ball['kind']; state: 'done' | 'now' | 'left' }>;
export interface Hud { score: number; time: number; spot: string; streak: number; phase?: string; elapsed: number }
interface Callout { id: number; big: string; small?: string; tone: 'gold' | 'green' | 'red' | 'money' | 'starry' | 'fire' }
interface Card { id: number; title: string; sub: string; money: boolean }

/** What the view needs from a game: the 3D one, or the 2D one when WebGL is missing. */
interface GameLike {
  start(): void; stop(): void; begin(): void; resize(): void; press(at?: number): void; release(at?: number): void;
  hud(): Omit<Hud, 'elapsed'> & { fade?: number; elapsed?: number };
  rackState(): Rack;
  meterView?(): { mode: 'live' | 'flash' | 'off'; hold: number; target: number; green: number; error: number; age: number };
  skip?(): void;
  cancel?(): void;
}

const GRADE_TEXT: Record<string, [string, Callout['tone']] | undefined> = {
  perfect: ['PERFECT RELEASE', 'green'],
  early: ['EARLY', 'red'], late: ['LATE', 'red'],
  'very-early': ['WAY EARLY', 'red'], 'very-late': ['WAY LATE', 'red'],
};

export interface RunViewProps {
  level: Level;
  moneyRack: number;
  opts?: RunOptions;
  /** Name on the score bug (the level name for your own runs). */
  label: string;
  /** A rival on autopilot: no input, a LIVE bug and a skip button. */
  rivalName?: string;
  /** Contest graphics fed from the live HUD (pace, score to beat). */
  ticker?: (h: Hud) => ReactNode;
  onDone: (r: RunResult) => void;
}

/** Mount with a fresh `key` per run: the game is created once, on mount. */
export function RunView({ level, moneyRack, opts, label, rivalName, ticker, onDone }: RunViewProps) {
  const [hud, setHud] = useState<Hud>({ score: 0, time: opts?.clock ?? level.clock, spot: '', streak: 0, elapsed: 0 });
  const [rack, setRack] = useState<Rack>([]);
  const [muted, setMutedState] = useState(isMuted());
  const [callout, setCallout] = useState<Callout | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [replay, setReplay] = useState(false);
  const [onFire, setOnFire] = useState(false);
  const [final10, setFinal10] = useState(false);
  const [showHint, setShowHint] = useState(!rivalName);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const fpsRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameLike | null>(null);
  const seq = useRef(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const rival = !!rivalName;

  useEffect(() => {
    if (!canvasRef.current) return;
    let alive = true;
    const finish = (r: RunResult) => { setTimeout(() => { if (alive) doneRef.current(r); }, rival ? 1400 : 1800); };
    // Broadcast graphics react to what happens on the floor.
    const onEvent = (e: ShootoutEvent) => {
      const id = ++seq.current;
      const say = (c: Omit<Callout, 'id'>) => setCallout({ ...c, id });
      switch (e.type) {
        case 'rack':
          setCard({ id, title: `RACK ${e.index + 1}`, sub: e.label.toUpperCase(), money: e.money });
          break;
        case 'grade': {
          if (rival) break;
          setShowHint(false);
          const g = GRADE_TEXT[e.grade];
          if (g) say({ big: g[0], tone: g[1] });
          break;
        }
        case 'make': {
          const ball = e.kind;
          const what = ball === 'starry' ? 'STARRY BALL' : ball === 'money' ? 'MONEY BALL' : e.outcome === 'swish' ? 'SWISH' : e.outcome === 'rim-in' ? 'IN AND OUT... IN!' : 'BUCKET';
          const bonus = !e.perfect ? '' : opts?.scoring === 'attack' ? (e.mult > 1 ? `PERFECT ×${e.mult.toFixed(1)} · ` : 'PERFECT · ') : opts?.scoring === 'contest' ? 'PERFECT +1 · ' : '';
          say({ big: `+${e.points.toLocaleString()}`, small: bonus + what, tone: e.perfect ? 'green' : ball === 'starry' ? 'starry' : ball === 'money' ? 'money' : e.streak >= 3 ? 'fire' : 'gold' });
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
        case 'time': say({ big: 'TIME!', small: 'RELEASE BEFORE THE HORN', tone: 'red' }); break;
        case 'buzzer': say({ big: 'BUZZER BEATER!', tone: 'fire' }); break;
      }
    };
    let game: GameLike;
    try {
      game = new Shootout3D(canvasRef.current, level, moneyRack, { onEvent, onDone: finish }, opts);
    } catch {
      // No WebGL: fall back to the 2D court (your own runs only; rivals just finish).
      if (opts?.auto) { const run = opts.auto; finish({ score: run.score, max: 0, makes: 0, shots: run.shots.length, bestStreak: 0, level }); return () => { alive = false; }; }
      game = new Shootout(canvasRef.current, level, moneyRack, { onDone: finish });
    }
    gameRef.current = game;
    if (import.meta.env.DEV) (window as unknown as { __shootout?: GameLike }).__shootout = game;
    game.begin(); game.start();
    const onResize = () => game.resize();
    window.addEventListener('resize', onResize);
    const hudTimer = setInterval(() => {
      const h = game.hud();
      const elapsed = h.elapsed ?? 0;
      setHud(prev => (prev.score === h.score && prev.time.toFixed(1) === h.time.toFixed(1) && prev.spot === h.spot && prev.streak === h.streak && prev.phase === h.phase) ? prev
        : { score: h.score, time: h.time, spot: h.spot, streak: h.streak, phase: h.phase, elapsed });
      setRack(prev => { const r = game.rackState(); return JSON.stringify(r) === JSON.stringify(prev) ? prev : r; });
    }, 100);
    // Camera-cut fades follow the game every frame.
    let raf = 0, frames = 0, since = performance.now();
    const tick = (now: number) => {
      if (fadeRef.current) fadeRef.current.style.opacity = String(game.hud().fade ?? 0);
      // Optional frame counter (?fps) for checking smoothness on a real phone.
      frames++;
      if (fpsRef.current && now - since >= 500) { fpsRef.current.textContent = `${Math.round((frames * 1000) / (now - since))} fps`; frames = 0; since = now; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { alive = false; game.stop(); clearInterval(hudTimer); cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); gameRef.current = null; };
    // The game is created once per mount; callers remount with a new key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear callouts and cards after their animations.
  useEffect(() => { if (!callout) return; const t = setTimeout(() => setCallout(null), 1300); return () => clearTimeout(t); }, [callout]);
  useEffect(() => { if (!card) return; const t = setTimeout(() => setCard(null), 2100); return () => clearTimeout(t); }, [card]);

  // Hold anywhere (or Space) to shoot.
  useEffect(() => {
    if (rival) return;
    const down = (e: KeyboardEvent) => { if (e.code === 'Space' && !e.repeat) { e.preventDefault(); unlockAudio(); gameRef.current?.press(e.timeStamp); } };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); gameRef.current?.release(e.timeStamp); } };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [rival]);

  const showFps = typeof window !== 'undefined' && /[?&]fps\b/.test(window.location.search);
  const toggleMute = () => { setMuted(!muted); setMutedState(!muted); };

  return (
    <>
      <style>{BROADCAST_CSS}</style>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        onPointerDown={(e) => { unlockAudio(); if (rival) return; e.currentTarget.setPointerCapture(e.pointerId); gameRef.current?.press(e.timeStamp); }}
        onPointerUp={(e) => gameRef.current?.release(e.timeStamp)}
        onPointerCancel={() => gameRef.current?.cancel?.()}
        onContextMenu={(e) => e.preventDefault()}
      />
      <BroadcastOverlay hud={hud} rack={rack} level={label} callout={callout} card={card} replay={replay} onFire={onFire} final10={final10} rival={rival} />
      {!rival && <ShotMeter gameRef={gameRef} />}
      {ticker && <div className="pointer-events-none absolute right-3 top-14 sm:right-5" style={{ marginTop: 'env(safe-area-inset-top)' }}>{ticker(hud)}</div>}
      <div ref={fadeRef} className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: 0 }} />
      {showFps && <div ref={fpsRef} className="pointer-events-none absolute left-3 top-3 rounded bg-black/60 px-2 py-0.5 font-mono text-[11px] text-emerald-300" />}
      <div className="absolute right-3 top-3 flex gap-2" style={{ marginTop: 'env(safe-area-inset-top)' }}>
        <button type="button" onClick={toggleMute} className="rounded-lg bg-black/50 p-2 backdrop-blur" aria-label={muted ? 'Sound on' : 'Mute'}>{muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>
      </div>
      {rival && (
        <>
          <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 sm:left-5 sm:top-5" style={{ marginTop: 'env(safe-area-inset-top)' }}>
            <span className="sh-blink h-2 w-2 rounded-full bg-red-500" />
            <span className="skew-x-[-10deg] bg-red-600 px-2 py-0.5 text-[11px] font-black italic tracking-widest">LIVE</span>
            <span className="skew-x-[-10deg] bg-black/70 px-2.5 py-0.5 text-xs font-black italic tracking-wide">{rivalName}</span>
          </div>
          <button type="button" onClick={() => gameRef.current?.skip?.()} className="absolute bottom-20 right-3 flex items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-4 py-2 text-xs font-bold tracking-wide backdrop-blur sm:bottom-6 sm:right-5">
            <FastForward className="h-3.5 w-3.5" />Skip to result
          </button>
        </>
      )}
      {showHint && hud.phase === 'aim' && (
        <div className="sh-pulse pointer-events-none absolute top-[12%] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/15 bg-black/55 px-4 py-2 text-xs font-bold tracking-wide sm:px-5 sm:py-2.5 sm:text-sm text-white/90 backdrop-blur">
          HOLD to jump · LET GO on the green
        </div>
      )}
    </>
  );
}

export const BROADCAST_CSS = `
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
function BroadcastOverlay({ hud, rack, level, callout, card, replay, onFire, final10, rival }: {
  hud: Hud; rack: Rack; level: string; callout: Callout | null; card: Card | null; replay: boolean; onFire: boolean; final10: boolean; rival?: boolean;
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
        <div className={`flex flex-col justify-center bg-gradient-to-b px-2.5 py-1.5 ${rival ? 'from-slate-600 to-slate-800' : 'from-[#7a1f4f] to-[#3d0d27]'}`}>
          <div className="text-[8px] font-black uppercase tracking-[0.25em] text-amber-300">Velvet</div>
          <div className="text-[11px] font-black italic leading-none tracking-tight">3PT</div>
        </div>
        <div className="flex flex-col justify-center bg-[#0d0f1a]/90 px-3 py-1 backdrop-blur">
          <div className="text-[9px] font-bold uppercase tracking-widest text-white/50">{level}</div>
          <RackDots rack={rack} />
        </div>
        <div key={hud.score} className="sh-tick flex min-w-[3.25rem] items-center justify-center bg-gradient-to-b from-amber-200 to-amber-400 px-3 font-mono text-2xl font-black text-[#1d1300]">{hud.score.toLocaleString()}</div>
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

/**
 * The release meter, beside the shooter. Live on the first shot of a run so
 * you can find the mark; after that it only flashes for a moment after each
 * release, frozen where you let go against the green, then fades. You learn
 * the timing from those flashes, not by watching a bar fill.
 */
function ShotMeter({ gameRef }: { gameRef: MutableRefObject<GameLike | null> }) {
  const wrap = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const band = useRef<HTMLDivElement>(null);
  const zone = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const m = gameRef.current?.meterView?.();
      if (m && wrap.current && fill.current && band.current && zone.current && label.current) {
        const span = m.target * 1.45;
        const pos = Math.min(1, m.hold / span);
        const lo = (m.target - m.green / 2) / span, hi = (m.target + m.green / 2) / span;
        const inGreen = m.hold >= m.target - m.green / 2 && m.hold <= m.target + m.green / 2;
        // The make zone: slightly early to slightly late still goes in.
        const zlo = (m.target - m.green * 1.6) / span, zhi = (m.target + m.green * 1.6) / span;
        const inZone = m.hold >= m.target - m.green * 1.6 && m.hold <= m.target + m.green * 1.6;
        zone.current.style.bottom = `${zlo * 100}%`;
        zone.current.style.height = `${(zhi - zlo) * 100}%`;
        const show = m.mode !== 'off';
        wrap.current.style.opacity = !show ? '0' : m.mode === 'flash' ? String(Math.min(1, m.age * 8, Math.max(0, (1.3 - m.age) / 0.45))) : '1';
        wrap.current.style.transform = `translateY(-50%) scale(${m.mode === 'flash' ? 1 + Math.max(0, 0.12 - m.age) : 1})`;
        fill.current.style.height = `${pos * 100}%`;
        fill.current.style.background = inGreen ? 'linear-gradient(#bbf7d0,#22c55e)' : inZone ? 'linear-gradient(#fef3c7,#f59e0b)' : pos > hi ? 'linear-gradient(#fecaca,#ef4444)' : 'linear-gradient(#fff,#cbd5e1)';
        band.current.style.bottom = `${lo * 100}%`;
        band.current.style.height = `${Math.max(2, (hi - lo) * 100)}%`;
        if (m.mode === 'flash') {
          const ms = Math.round(Math.abs(m.error) * 1000);
          label.current.textContent = inGreen ? 'PERFECT' : `${inZone ? 'GOOD · ' : ''}${m.error < 0 ? 'EARLY' : 'LATE'} ${ms}ms`;
          label.current.style.color = inGreen ? '#6ee7b7' : inZone ? '#fcd34d' : '#fda4af';
        } else {
          label.current.textContent = m.mode === 'live' ? 'FIND THE GREEN' : '';
          label.current.style.color = '#fde68a';
        }
      } else if (wrap.current) wrap.current.style.opacity = '0';
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [gameRef]);
  return (
    <div ref={wrap} className="pointer-events-none absolute right-[18%] top-1/2 flex h-[32vh] max-h-60 flex-col items-center" style={{ opacity: 0, transform: 'translateY(-50%)' }}>
      <div className="relative w-3.5 flex-1 overflow-hidden rounded-full border-2 border-white/60 bg-black/60 shadow-[0_0_24px_rgba(0,0,0,.7)]">
        <div ref={zone} className="absolute inset-x-0 bg-amber-400/35" />
        <div ref={band} className="absolute inset-x-0 bg-emerald-400/80 shadow-[0_0_14px_#34d399]" />
        <div ref={fill} className="absolute inset-x-0 bottom-0 rounded-full" />
      </div>
      <div ref={label} className="mt-1.5 whitespace-nowrap rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-black tracking-wider" />
    </div>
  );
}

import { useEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { Camera, Volume2, VolumeX } from 'lucide-react';
import { Shootout } from '../game';
import { Shootout3D, type RunOptions, type RunResult, type ShootoutEvent } from '../three/game3d';
import type { Ball, Level } from '../engine';
import { isMuted, setMuted, unlockAudio } from '../audio';
import { VIEW_NAMES, type View } from '../settings';

// One run on the floor: the 3D game plus the broadcast graphics over it.
// Used for practice, Score Attack, Street and your contest rounds.

export type Rack = Array<{ kind: Ball['kind']; state: 'done' | 'now' | 'left' }>;
export interface Hud { score: number; time: number; spot: string; streak: number; chain?: number; phase?: string; elapsed: number }
interface Callout { id: number; big: string; small?: string; tone: 'gold' | 'green' | 'red' | 'money' | 'starry' | 'fire' }
interface Card { id: number; title: string; sub: string; money: boolean }

/** What the view needs from a game: the 3D one, or the 2D one when WebGL is missing. */
interface GameLike {
  start(): void; stop(): void; begin(): void; resize(): void; press(at?: number): void; release(at?: number): void;
  hud(): Omit<Hud, 'elapsed'> & { fade?: number; elapsed?: number };
  rackState(): Rack;
  meterView?(): { mode: 'live' | 'flash' | 'off'; hold: number; target: number; green: number; error: number; age: number };
  cycleView?(): View;
  cancel?(): void;
  aimStart?(nx: number, ny: number): void;
  aimMove?(nx: number, ny: number): void;
  aimEnd?(nx: number, ny: number): void;
  aimCancel?(): void;
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
  /** Contest graphics fed from the live HUD (pace, score to beat). */
  ticker?: (h: Hud) => ReactNode;
  onDone: (r: RunResult) => void;
}

/** Mount with a fresh `key` per run: the game is created once, on mount. */
export function RunView({ level, moneyRack, opts, label, ticker, onDone }: RunViewProps) {
  const [hud, setHud] = useState<Hud>({ score: 0, time: opts?.clock ?? level.clock, spot: '', streak: 0, elapsed: 0 });
  const [rack, setRack] = useState<Rack>([]);
  const [muted, setMutedState] = useState(isMuted());
  const [callout, setCallout] = useState<Callout | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [replay, setReplay] = useState(false);
  const [final10, setFinal10] = useState(false);
  // The graphics context was lost (memory, usually on a phone): offer a restart on a fresh canvas.
  const [lost, setLost] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [showHint, setShowHint] = useState(true);
  // The game draws on a canvas made fresh for each game (see the effect below);
  // input lands on the stage that holds it.
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const fpsRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<GameLike | null>(null);
  const seq = useRef(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const touch = opts?.control === 'touch';
  /** Pointer position on the canvas, -1..1 both ways (y up). */
  const ndc = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r) return [0, 0];
    return [((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1)];
  };

  useEffect(() => {
    if (!stageRef.current) return;
    // A new canvas every time: a finished game releases its graphics context for
    // good, so reusing its canvas (React's dev double-mount, a restart after a
    // reset) would leave nothing to draw with.
    const canvas = document.createElement('canvas');
    canvas.className = 'absolute inset-0 block h-full w-full';
    stageRef.current.appendChild(canvas);
    canvasRef.current = canvas;
    let alive = true;
    const finish = (r: RunResult) => { setTimeout(() => { if (alive) doneRef.current(r); }, 1800); };
    // Broadcast graphics react to what happens on the floor.
    const onEvent = (e: ShootoutEvent) => {
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
          setShowHint(false);
          const ball = e.kind;
          const what = ball === 'starry' ? 'STARRY BALL' : ball === 'money' ? 'MONEY BALL' : e.outcome === 'swish' ? 'SWISH' : e.outcome === 'rim-in' ? 'IN AND OUT... IN!' : 'BUCKET';
          const bonus = touch ? (e.outcome === 'swish' ? 'SWISH +1 · ' : e.bank ? 'BANK +1 · ' : '') : !e.perfect ? '' : opts?.scoring === 'attack' ? (e.mult > 1 ? `PERFECT ×${e.mult.toFixed(1)} · ` : 'PERFECT · ') : opts?.scoring === 'contest' ? 'PERFECT +1 · ' : '';
          say({ big: `+${e.points.toLocaleString()}`, small: bonus + what, tone: e.perfect ? 'green' : ball === 'starry' ? 'starry' : ball === 'money' ? 'money' : e.streak >= 3 ? 'fire' : 'gold' });
          break;
        }
        case 'miss':
          setShowHint(false);
          if (e.outcome === 'airball') say({ big: 'AIRBALL', tone: 'red' });
          else if (e.outcome === 'rim-out') say({ big: 'RIMMED OUT', tone: 'red' });
          break;
        case 'replay': setReplay(e.on); break;
        case 'final10': setFinal10(true); break;
        case 'lost': setLost(true); break;
        case 'time': say({ big: 'TIME!', small: 'RELEASE BEFORE THE HORN', tone: 'red' }); break;
        case 'buzzer': say({ big: 'BUZZER BEATER!', tone: 'fire' }); break;
      }
    };
    let game: GameLike;
    try {
      game = new Shootout3D(canvas, level, moneyRack, { onEvent, onDone: finish }, opts);
    } catch {
      // No WebGL: fall back to the 2D court.
      game = new Shootout(canvas, level, moneyRack, { onDone: finish });
    }
    gameRef.current = game;
    if (import.meta.env.DEV) (window as unknown as { __shootout?: GameLike }).__shootout = game;
    game.begin(); game.start();
    const onResize = () => game.resize();
    window.addEventListener('resize', onResize);
    const hudTimer = setInterval(() => {
      const h = game.hud();
      const elapsed = h.elapsed ?? 0;
      setHud(prev => (prev.score === h.score && prev.time.toFixed(1) === h.time.toFixed(1) && prev.spot === h.spot && prev.streak === h.streak && prev.chain === h.chain && prev.phase === h.phase) ? prev
        : { score: h.score, time: h.time, spot: h.spot, streak: h.streak, chain: h.chain, phase: h.phase, elapsed });
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
    return () => { alive = false; game.stop(); canvas.remove(); canvasRef.current = null; clearInterval(hudTimer); cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); gameRef.current = null; };
    // The game is created once per mount (callers remount with a new key), and
    // again after the graphics context was lost.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // Clear callouts and cards after their animations.
  useEffect(() => { if (!callout) return; const t = setTimeout(() => setCallout(null), 1300); return () => clearTimeout(t); }, [callout]);
  useEffect(() => { if (!card) return; const t = setTimeout(() => setCard(null), 2100); return () => clearTimeout(t); }, [card]);

  // Hold anywhere (or Space) to shoot.
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.code === 'Space' && !e.repeat) { e.preventDefault(); unlockAudio(); gameRef.current?.press(e.timeStamp); } };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); gameRef.current?.release(e.timeStamp); } };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  const showFps = typeof window !== 'undefined' && /[?&]fps\b/.test(window.location.search);
  const toggleMute = () => { setMuted(!muted); setMutedState(!muted); };
  // Switch the angle you shoot from; its name shows for a moment.
  const [viewName, setViewName] = useState<{ id: number; name: string } | null>(null);
  const cycleView = () => { const v = gameRef.current?.cycleView?.(); if (v) setViewName({ id: Date.now(), name: VIEW_NAMES[v] }); };
  useEffect(() => { if (!viewName) return; const t = setTimeout(() => setViewName(null), 1400); return () => clearTimeout(t); }, [viewName]);

  return (
    <>
      <style>{BROADCAST_CSS}</style>
      {lost && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-[#05060C]/95 px-6 text-center">
          <div className="text-2xl font-black italic">GRAPHICS RESET</div>
          <p className="max-w-xs text-sm text-white/70">Your device ran short of graphics memory and dropped the game view. Restart this run to carry on.</p>
          <button className="rounded-full bg-amber-400 px-6 py-2 font-black text-[#2a1600]" onClick={() => { setLost(false); setAttempt(a => a + 1); }}>Restart run</button>
        </div>
      )}
      <div
        ref={stageRef}
        className="absolute inset-0"
        onPointerDown={(e) => {
          unlockAudio();
          e.currentTarget.setPointerCapture(e.pointerId);
          if (touch) { const [x, y] = ndc(e); gameRef.current?.aimStart?.(x, y); } else gameRef.current?.press(e.timeStamp);
        }}
        onPointerMove={(e) => { if (touch) { const [x, y] = ndc(e); gameRef.current?.aimMove?.(x, y); } }}
        onPointerUp={(e) => { if (touch) { const [x, y] = ndc(e); gameRef.current?.aimEnd?.(x, y); } else gameRef.current?.release(e.timeStamp); }}
        onPointerCancel={() => { if (touch) gameRef.current?.aimCancel?.(); else gameRef.current?.cancel?.(); }}
        onContextMenu={(e) => e.preventDefault()}
      />
      <BroadcastOverlay hud={hud} rack={rack} level={label} callout={callout} card={card} replay={replay} final10={final10} />
      <ShotMeter gameRef={gameRef} />
      {ticker && <div className="pointer-events-none absolute right-3 top-14 sm:right-5" style={{ marginTop: 'env(safe-area-inset-top)' }}>{ticker(hud)}</div>}
      <div ref={fadeRef} className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: 0 }} />
      {showFps && <div ref={fpsRef} className="pointer-events-none absolute left-3 top-3 rounded bg-black/60 px-2 py-0.5 font-mono text-[11px] text-emerald-300" />}
      <div className="absolute right-3 top-3 flex gap-2" style={{ marginTop: 'env(safe-area-inset-top)' }}>
        {!touch && <button type="button" onClick={cycleView} className="rounded-lg bg-black/50 p-2 backdrop-blur" aria-label="Change camera angle"><Camera className="h-4 w-4" /></button>}
        <button type="button" onClick={toggleMute} className="rounded-lg bg-black/50 p-2 backdrop-blur" aria-label={muted ? 'Sound on' : 'Mute'}>{muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button>
      </div>
      {viewName && (
        <div key={viewName.id} className="pointer-events-none absolute right-3 top-14 rounded-md bg-black/70 px-3 py-1 text-xs font-black italic tracking-wider backdrop-blur" style={{ marginTop: 'env(safe-area-inset-top)' }}>{viewName.name.toUpperCase()}</div>
      )}
      {showHint && hud.phase === 'aim' && (
        <div className="sh-pulse pointer-events-none absolute top-[12%] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/15 bg-black/55 px-4 py-2 text-xs font-bold tracking-wide sm:px-5 sm:py-2.5 sm:text-sm text-white/90 backdrop-blur">
          {touch ? 'DRAG toward the hoop · LET GO to shoot' : 'HOLD to jump · LET GO on the green'}
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
@keyframes sh-chain { 0% { transform: scale(1.35); filter: brightness(2); } 100% { transform: scale(1); filter: brightness(1); } }
.sh-chain { animation: sh-chain .45s cubic-bezier(.2,.9,.2,1) both; transform-origin: center; }
`;

/** The chain badge's colour and title climb with it, like the effects. */
const CHAIN_TONE = (n: number) => n >= 10 ? 'from-fuchsia-500 to-[#5C163A] text-white' : n >= 6 ? 'from-orange-500 to-red-700 text-white' : n >= 3 ? 'from-amber-300 to-amber-600 text-[#2a1600]' : 'from-emerald-400 to-emerald-700 text-white';
const chainTitle = (n: number) => n >= 10 ? 'UNSTOPPABLE' : n >= 6 ? 'FIREBALL' : n >= 3 ? 'HEATING UP' : '';

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

/** The TV graphics: scorebug, rack cards, callouts, replay bug. */
function BroadcastOverlay({ hud, rack, level, callout, card, replay, final10 }: {
  hud: Hud; rack: Rack; level: string; callout: Callout | null; card: Card | null; replay: boolean; final10: boolean;
}) {
  const low = hud.time <= 10;
  // The bar's last segment: your perfect chain (it drives the effects), else your streak of makes.
  const chain = hud.chain ?? 0;
  const status = chain >= 2 ? { key: `c${chain}`, label: chainTitle(chain) || 'PERFECT', value: `×${chain}`, tone: CHAIN_TONE(chain) }
    : hud.streak >= 2 ? { key: `s${hud.streak}`, label: 'STRAIGHT', value: `${hud.streak}`, tone: 'from-orange-500 to-red-700 text-white' } : null;
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

      {/* Scorebug, bottom centre: an NBA-broadcast bar. Logo, the rack you're
          on and its balls, the score, the clock, and the run's status (perfect
          chain or streak) when there is one. */}
      <div className={`absolute bottom-3 left-1/2 -translate-x-1/2 transition-opacity sm:bottom-5 ${replay ? 'opacity-0' : ''}`}>
        <div className="h-[3px] bg-gradient-to-r from-amber-300 via-[#c2185b] to-[#5C163A]" />
        <div className="flex h-12 items-stretch bg-gradient-to-b from-[#1b1e27] to-[#0a0b10] shadow-[0_12px_40px_rgba(0,0,0,.6)] sm:h-14">
          <div className="flex flex-col items-center justify-center bg-gradient-to-b from-[#7a1f4f] to-[#3d0d27] px-3 [clip-path:polygon(0_0,100%_0,88%_100%,0_100%)] sm:px-4">
            <div className="text-[8px] font-black uppercase tracking-[0.3em] text-amber-300 sm:text-[9px]">Velvet</div>
            <div className="text-sm font-black italic leading-none tracking-tight sm:text-base">3PT</div>
          </div>
          <div className="flex min-w-0 flex-col justify-center gap-1 px-3 sm:px-4">
            <div className="max-w-[9rem] truncate text-[9px] font-bold uppercase tracking-[0.18em] text-white/55 sm:max-w-none sm:text-[10px]">{hud.spot || level}</div>
            <RackDots rack={rack} />
          </div>
          <div className="w-px self-stretch bg-white/10" />
          <div className="flex min-w-[3.6rem] flex-col items-center justify-center px-3 sm:min-w-[4.5rem]">
            <div className="text-[8px] font-bold uppercase tracking-[0.25em] text-white/45">PTS</div>
            <div key={hud.score} className="sh-tick text-2xl font-black leading-none tabular-nums sm:text-3xl">{hud.score.toLocaleString()}</div>
          </div>
          <div className={`flex min-w-[4.6rem] flex-col items-center justify-center px-3 ${low ? 'bg-red-600' : 'bg-white/[.06]'} ${final10 && low ? 'sh-blink' : ''}`}>
            <div className={`text-[8px] font-bold uppercase tracking-[0.25em] ${low ? 'text-white/80' : 'text-white/45'}`}>{level.split(' · ')[0]}</div>
            <div className="text-xl font-black leading-none tabular-nums sm:text-2xl">{low ? hud.time.toFixed(1) : `0:${String(Math.ceil(hud.time)).padStart(2, '0')}`}</div>
          </div>
          {status && (
            <div key={status.key} className={`sh-chain flex flex-col items-center justify-center bg-gradient-to-b px-3 ${status.tone}`}>
              <div className="text-[8px] font-black uppercase tracking-[0.2em] opacity-80">{status.label}</div>
              <div className="text-lg font-black italic leading-none sm:text-xl">{status.value}</div>
            </div>
          )}
        </div>
      </div>

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

    </div>
  );
}

/**
 * The release meter, beside the shooter. Live on the first shot at each rack
 * so you can find the mark; after that it only flashes for a moment after each
 * release, frozen where you let go against the green, then fades. You learn
 * the timing from those flashes, not by watching a bar fill. Starry balls
 * never show it.
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

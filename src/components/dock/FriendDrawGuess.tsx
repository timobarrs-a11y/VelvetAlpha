import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, SkipForward } from 'lucide-react';
import { useGameChannel } from './friendGameChannel';
import { useSquareFit } from './useSquareFit';
import { DrawToolbar, extendStroke, newStrokeId, renderStrokes, startStroke, type Stroke, type Tool } from './drawKit';

const WORDS = [
  'cat', 'dog', 'pizza', 'house', 'sun', 'tree', 'car', 'fish', 'heart', 'star',
  'banana', 'rocket', 'snowman', 'guitar', 'cupcake', 'rainbow', 'spider', 'ghost', 'crown', 'island',
  'castle', 'dragon', 'robot', 'balloon', 'volcano', 'pirate', 'unicorn', 'cactus', 'penguin', 'bicycle',
  'glasses', 'umbrella', 'butterfly', 'mermaid', 'taco', 'skateboard', 'lighthouse', 'octopus', 'tornado', 'hamburger',
  'giraffe', 'pineapple', 'campfire', 'ice cream', 'treasure', 'anchor', 'airplane', 'snail', 'tent', 'waterfall',
];

interface Msg { id: string; by: string; text: string; ts: number; kind: 'chat' | 'correct' | 'system' }

/** The whole game, shared by both players and kept on each device. */
interface Round {
  n: number;
  drawerId: string;
  /** Bumped by Clear; strokes from an older sheet are dropped. */
  sheet: number;
  strokes: Stroke[];
  /** Undone strokes, so a merge can't bring them back. */
  removed: string[];
  /** Set when the round ends: the word (blank if the guesser gave up first) and who got it. */
  solved: { word: string; by: string | null } | null;
  /** Chat and guesses, across rounds. */
  log: Msg[];
  score: Record<string, number>;
}

const STORE = (cid: string) => `velvet.dg.${cid}`;
const WORD_STORE = (cid: string, n: number) => `velvet.dg.word.${cid}.${n}`;
const read = <T,>(key: string): T | null => { try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as T) : null; } catch { return null; } };
const write = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage full or blocked */ } };
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Two copies of the game (one per device) combine without losing anything:
 * a later round wins; within a round strokes, undos, chat and scores union.
 */
function merge(a: Round, b: Round): Round {
  const log = [...new Map([...a.log, ...b.log].map(m => [m.id, m])).values()].sort((x, y) => x.ts - y.ts).slice(-80);
  const score: Record<string, number> = { ...a.score };
  for (const [k, v] of Object.entries(b.score)) score[k] = Math.max(score[k] ?? 0, v);
  if (a.n !== b.n) { const base = a.n > b.n ? a : b; return { ...base, log, score }; }
  const sheet = Math.max(a.sheet, b.sheet);
  const removed = [...new Set([...a.removed, ...b.removed])];
  const gone = new Set(removed);
  const strokes = [...new Map([...a.strokes, ...b.strokes].map(s => [s.id, s])).values()]
    .filter(s => (s.sheet ?? 0) === sheet && !gone.has(s.id));
  const solved = a.solved?.word ? a.solved : b.solved?.word ? b.solved : a.solved ?? b.solved;
  return { ...a, sheet, strokes, removed, solved, log, score };
}

const same = (a: Round, b: Round) =>
  a.n === b.n && a.sheet === b.sheet && a.strokes.length === b.strokes.length && a.removed.length === b.removed.length &&
  a.log.length === b.log.length && JSON.stringify(a.solved) === JSON.stringify(b.solved) && JSON.stringify(a.score) === JSON.stringify(b.score);

/**
 * Draw & Guess with a friend. The drawer gets a secret word and draws it; the
 * picture streams live. Both can chat the whole time, and everything the
 * guesser types counts as a guess. Nothing skips on its own: a round ends
 * when it's guessed, or someone taps skip. Leave and come back, and you're
 * right where you were.
 */
export function FriendDrawGuess({ conversationId, myId, peerId, peerName }: { conversationId: string; myId: string; peerId: string; peerName: string }) {
  const [round, setRoundState] = useState<Round>(() =>
    read<Round>(STORE(conversationId)) ?? { n: 0, drawerId: myId < peerId ? myId : peerId, sheet: 0, strokes: [], removed: [], solved: null, log: [], score: {} });
  const roundRef = useRef(round);
  roundRef.current = round;
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#111827');
  const [size, setSize] = useState(6);
  const [text, setText] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [squareRef, square] = useSquareFit<HTMLDivElement>();
  const drawing = useRef<Stroke | null>(null);
  const peerLive = useRef<Stroke | null>(null);
  const logEnd = useRef<HTMLDivElement>(null);

  const iDraw = round.drawerId === myId;
  const nameOf = (id: string | null) => (id === myId ? 'You' : id ? peerName : 'Nobody');

  // The drawer's word for this round, kept so a reload doesn't change it.
  const [word, setWord] = useState<string | null>(null);
  useEffect(() => {
    if (!iDraw) { setWord(null); return; }
    const key = WORD_STORE(conversationId, round.n);
    let w = read<string>(key);
    if (!w) { w = WORDS[Math.floor(Math.random() * WORDS.length)]; write(key, w); }
    setWord(w);
  }, [iDraw, round.n, conversationId]);

  const redraw = useCallback(() => {
    const c = canvasRef.current, ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const extra = [peerLive.current, drawing.current].filter(Boolean) as Stroke[];
    renderStrokes(ctx, [...roundRef.current.strokes, ...extra], c.width, c.height);
  }, []);

  useEffect(() => { redraw(); }, [round, redraw]);
  useEffect(() => { logEnd.current?.scrollIntoView?.({ block: 'nearest' }); }, [round.log.length]);

  // Keep the canvas sharp at its on-screen size.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !square) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(square * dpr);
    c.height = Math.round(square * dpr);
    redraw();
  }, [square, redraw]);

  const sendRef = useRef<(e: string, p: unknown) => void>(() => {});
  /** Apply a change locally, save it, and share it. */
  const commit = useCallback((next: Round) => {
    roundRef.current = next;
    setRoundState(next);
    write(STORE(conversationId), next);
    sendRef.current('state', next);
  }, [conversationId]);

  // The drawer judges guesses (only they know the word).
  const judged = useRef<Set<string>>(new Set());
  const judge = useCallback((r: Round): Round => {
    if (r.drawerId !== myId || r.solved || !word) return r;
    for (const m of r.log) {
      if (judged.current.has(m.id) || m.by !== peerId || m.kind !== 'chat') continue;
      judged.current.add(m.id);
      if (norm(m.text) === norm(word)) {
        const score = { ...r.score, [peerId]: (r.score[peerId] ?? 0) + 1, [myId]: (r.score[myId] ?? 0) + 1 };
        return {
          ...r, score, solved: { word, by: peerId },
          log: [...r.log, { id: newStrokeId(), by: peerId, text: `${peerName} got it: ${word}! 🎉`, ts: Date.now(), kind: 'correct' as const }],
        };
      }
    }
    return r;
  }, [myId, peerId, peerName, word]);

  const absorb = useCallback((incoming: Round) => {
    const cur = roundRef.current;
    const merged = judge(merge(cur, incoming));
    if (incoming.n > cur.n) { drawing.current = null; judged.current = new Set(); }
    if (!same(merged, cur)) {
      roundRef.current = merged; setRoundState(merged); write(STORE(conversationId), merged);
      // Tell the other side if we added something they don't have yet.
      if (!same(merged, incoming)) sendRef.current('state', merged);
    }
  }, [judge, conversationId]);

  const send = useGameChannel(`draw-${conversationId}`, {
    live: (p: { n: number; sheet: number; stroke: Stroke | null }) => {
      if (p.n !== roundRef.current.n || p.sheet !== roundRef.current.sheet) return;
      peerLive.current = p.stroke; redraw();
    },
    state: (r: Round) => { peerLive.current = null; absorb(r); },
    hello: () => send('state', roundRef.current),
  }, (s) => s('hello', {}));
  sendRef.current = send;

  // Once the word is known, check anything that came in before it.
  useEffect(() => { if (word) absorb(roundRef.current); }, [word, absorb]);

  // Drawing (pointer events cover touch, pen and mouse).
  const point = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };
  const lastLive = useRef(0);
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!iDraw || round.solved) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = startStroke(tool, color, size, point(e), myId, round.sheet);
    if (tool === 'fill') { onUp(); return; }
    redraw();
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    extendStroke(drawing.current, point(e));
    redraw();
    const now = Date.now();
    if (now - lastLive.current > 60) { lastLive.current = now; send('live', { n: round.n, sheet: round.sheet, stroke: drawing.current }); }
  };
  const onUp = () => {
    const s = drawing.current;
    if (!s) return;
    drawing.current = null;
    commit({ ...roundRef.current, strokes: [...roundRef.current.strokes, s] });
    send('live', { n: round.n, sheet: round.sheet, stroke: null });
  };
  const undo = () => {
    const mine = [...roundRef.current.strokes].reverse().find(s => s.by === myId);
    if (!mine) return;
    commit({ ...roundRef.current, strokes: roundRef.current.strokes.filter(s => s.id !== mine.id), removed: [...roundRef.current.removed, mine.id] });
  };
  const clear = () => {
    if (roundRef.current.strokes.length && !confirm('Clear the drawing?')) return;
    commit({ ...roundRef.current, sheet: roundRef.current.sheet + 1, strokes: [] });
  };

  const say = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    // No spoilers from the drawer.
    if (iDraw && word && !round.solved && norm(t).includes(norm(word))) { setHint("That's the word! No spoilers 😄"); return; }
    setHint(null);
    setText('');
    commit({ ...roundRef.current, log: [...roundRef.current.log, { id: newStrokeId(), by: myId, text: t, ts: Date.now(), kind: 'chat' }] });
  };

  const skip = () => {
    const r = roundRef.current;
    if (r.solved) return;
    if (!confirm(iDraw ? 'Skip this word?' : 'Give up on this one?')) return;
    commit({
      ...r,
      solved: { word: iDraw ? word ?? '' : '', by: null },
      log: [...r.log, { id: newStrokeId(), by: myId, text: iDraw ? 'skipped the word' : 'gave up', ts: Date.now(), kind: 'system' }],
    });
  };

  const nextRound = () => {
    const r = roundRef.current;
    judged.current = new Set();
    commit({ ...r, n: r.n + 1, drawerId: r.drawerId === myId ? peerId : myId, sheet: 0, strokes: [], removed: [], solved: null });
  };

  const status = round.solved
    ? round.solved.by ? `${nameOf(round.solved.by)} got it: ${round.solved.word}! 🎉` : round.solved.word ? `Skipped. It was ${round.solved.word}` : 'Gave up'
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5 px-3 py-2 [&>*:not(.square-slot)]:flex-shrink-0">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-white/60">You <b className="text-amber-300">{round.score[myId] ?? 0}</b> · <b className="text-amber-300">{round.score[peerId] ?? 0}</b> {peerName}</span>
        <span className="truncate font-semibold text-amber-200">
          {status ?? (iDraw ? <>Draw: <span className="rounded bg-amber-300 px-1.5 py-0.5 text-[#1d1a10]">{word}</span></> : `${peerName} is drawing…`)}
        </span>
        {!round.solved && (
          <button type="button" onClick={skip} className="flex-shrink-0 rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white" title={iDraw ? 'Skip this word' : 'Give up'} aria-label={iDraw ? 'Skip this word' : 'Give up'}>
            <SkipForward className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* The canvas takes the largest square that fits, so the tools and chat stay on screen. */}
      <div ref={squareRef} className="square-slot flex min-h-[120px] flex-1 items-center justify-center">
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className={`rounded-xl bg-white ${iDraw && !round.solved ? 'cursor-crosshair' : ''}`}
          style={{ touchAction: 'none', width: square ?? undefined, height: square ?? undefined }}
          aria-label={iDraw ? 'Drawing canvas' : `${peerName}'s drawing`}
        />
      </div>

      {iDraw && !round.solved && (
        <DrawToolbar tool={tool} setTool={setTool} color={color} setColor={setColor} size={size} setSize={setSize}
          onUndo={undo} canUndo={round.strokes.some(s => s.by === myId)} onClear={clear} />
      )}

      {round.solved && (
        <button type="button" onClick={nextRound} className="rounded-xl bg-amber-300 px-4 py-1.5 text-sm font-semibold text-[#1d1a10]">
          Next round ({round.drawerId === myId ? `${peerName} draws` : 'you draw'})
        </button>
      )}

      {/* Chat during the game; for the guesser, every message is a guess. */}
      <div className="max-h-20 min-h-[2.5rem] overflow-y-auto rounded-lg bg-white/[0.04] px-2 py-1 text-[11px]">
        {round.log.length === 0 && <p className="text-white/40">{iDraw ? `Chat with ${peerName} while you draw.` : 'Type your guesses here. Chat too!'}</p>}
        {round.log.slice(-30).map(m => (
          <p key={m.id} className={m.kind === 'correct' ? 'font-semibold text-emerald-300' : m.kind === 'system' ? 'italic text-white/45' : 'text-white/80'}>
            {m.kind === 'correct' ? m.text : <><b className={m.by === myId ? 'text-pink-300' : 'text-amber-300'}>{nameOf(m.by)}</b> {m.text}</>}
          </p>
        ))}
        <div ref={logEnd} />
      </div>
      {hint && <p className="text-[11px] text-amber-300">{hint}</p>}
      <form onSubmit={say} className="flex gap-2">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={iDraw || round.solved ? `Message ${peerName}…` : 'Guess or chat…'}
          className="min-w-0 flex-1 rounded-xl bg-white/5 px-3 py-1.5 text-sm text-white outline-none focus:bg-white/10"
        />
        <button type="submit" className="flex items-center rounded-xl bg-amber-300 px-3 text-[#1d1a10]" aria-label="Send"><Send className="h-4 w-4" /></button>
      </form>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { Eraser, SkipForward } from 'lucide-react';
import { useGameChannel } from './friendGameChannel';

const WORDS = [
  'cat', 'dog', 'pizza', 'house', 'sun', 'tree', 'car', 'fish', 'heart', 'star',
  'banana', 'rocket', 'snowman', 'guitar', 'cupcake', 'rainbow', 'spider', 'ghost', 'crown', 'island',
  'castle', 'dragon', 'robot', 'balloon', 'volcano', 'pirate', 'unicorn', 'cactus', 'penguin', 'bicycle',
  'glasses', 'umbrella', 'butterfly', 'mermaid', 'taco', 'skateboard', 'lighthouse', 'octopus', 'tornado', 'hamburger',
];
const COLORS = ['#111827', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#ec4899'];

/** Points are 0..1 of the canvas so phones and laptops draw the same picture. */
interface Stroke { color: string; pts: [number, number][] }
interface Round {
  n: number;
  /** Bumped on every change in a round; the higher copy wins (so a clear sticks). */
  v: number;
  drawerId: string;
  strokes: Stroke[];
  /** Set when the round ends: the word, and who guessed it (null if skipped). */
  solved: { word: string; by: string | null } | null;
}

/**
 * Draw & Guess with a friend: the drawer gets a secret word and draws with a
 * finger or mouse; the picture streams live to the guesser, who types guesses.
 * Only the drawer knows the word, so the drawer's side judges each guess.
 */
export function FriendDrawGuess({ conversationId, myId, peerId, peerName }: { conversationId: string; myId: string; peerId: string; peerName: string }) {
  const [round, setRound] = useState<Round>({ n: 0, v: 0, drawerId: myId < peerId ? myId : peerId, strokes: [], solved: null });
  const [word, setWord] = useState<string | null>(null);
  const [guesses, setGuesses] = useState<{ by: string; text: string }[]>([]);
  const [guess, setGuess] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [score, setScore] = useState<Record<string, number>>({});
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<Stroke | null>(null);
  const roundRef = useRef(round);
  roundRef.current = round;

  const iDraw = round.drawerId === myId;
  const nameOf = (id: string | null) => (id === myId ? 'You' : id ? peerName : 'Nobody');

  // The drawer picks a new secret word each round.
  useEffect(() => {
    if (iDraw && !round.solved) setWord(WORDS[Math.floor(Math.random() * WORDS.length)]);
    if (!iDraw) setWord(null);
    setGuesses([]);
  }, [iDraw, round.n]); // eslint-disable-line react-hooks/exhaustive-deps

  const redraw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, c.width / 90);
    const all = drawing.current ? [...roundRef.current.strokes, drawing.current] : roundRef.current.strokes;
    for (const s of all) {
      ctx.strokeStyle = s.color;
      ctx.beginPath();
      s.pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x * c.width, y * c.height) : ctx.lineTo(x * c.width, y * c.height)));
      if (s.pts.length === 1) ctx.lineTo(s.pts[0][0] * c.width + 0.1, s.pts[0][1] * c.height);
      ctx.stroke();
    }
  }, []);

  useEffect(() => { redraw(); }, [round, redraw]);

  // Keep the canvas sharp at its on-screen size.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const fit = () => {
      const r = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      c.width = Math.max(1, Math.round(r.width * dpr));
      c.height = Math.max(1, Math.round(r.height * dpr));
      redraw();
    };
    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(c);
    return () => ro?.disconnect();
  }, [redraw]);

  const adopt = (r: Round) => {
    const cur = roundRef.current;
    if (r.n < cur.n || (r.n === cur.n && r.v <= cur.v)) return;
    setRound(r);
  };

  const send = useGameChannel(`draw-${conversationId}`, {
    // Live stroke in progress (drawer → guesser).
    live: (p: { n: number; stroke: Stroke }) => {
      if (p.n !== roundRef.current.n) return;
      drawing.current = p.stroke;
      redraw();
    },
    round: (r: Round) => { drawing.current = null; adopt(r); },
    guess: (p: { n: number; text: string }) => {
      const r = roundRef.current;
      if (p.n !== r.n || r.solved || r.drawerId !== myId) return;
      setGuesses(g => [...g, { by: peerId, text: p.text }]);
      if (word && p.text.trim().toLowerCase() === word.toLowerCase()) finish(peerId);
    },
    score: (s: Record<string, number>) => setScore(s),
    hello: () => send('round', roundRef.current),
  }, (s) => s('hello', {}));

  const finish = (by: string | null) => {
    const r = roundRef.current;
    if (!word || r.solved) return;
    const next: Round = { ...r, v: r.v + 1, solved: { word, by } };
    setRound(next);
    send('round', next);
    if (by) {
      // Both the guesser and the drawer score when it's guessed.
      const s = { ...score, [by]: (score[by] ?? 0) + 1, [myId]: (score[myId] ?? 0) + (by === myId ? 0 : 1) };
      setScore(s);
      send('score', s);
    }
  };

  const nextRound = () => {
    const r = roundRef.current;
    const next: Round = { n: r.n + 1, v: 0, drawerId: r.drawerId === myId ? peerId : myId, strokes: [], solved: null };
    setRound(next);
    send('round', next);
  };

  // Drawing (pointer events cover touch, pen and mouse).
  const point = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };
  const lastSent = useRef(0);
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!iDraw || round.solved) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = { color, pts: [point(e)] };
    redraw();
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current.pts.push(point(e));
    redraw();
    const now = Date.now();
    if (now - lastSent.current > 60) {
      lastSent.current = now;
      send('live', { n: round.n, stroke: drawing.current });
    }
  };
  const onUp = () => {
    const s = drawing.current;
    if (!s) return;
    drawing.current = null;
    const next = { ...roundRef.current, v: roundRef.current.v + 1, strokes: [...roundRef.current.strokes, s] };
    setRound(next);
    send('round', next);
  };
  const clear = () => {
    const next = { ...roundRef.current, v: roundRef.current.v + 1, strokes: [] };
    setRound(next);
    send('round', next);
  };

  const submitGuess = (e: React.FormEvent) => {
    e.preventDefault();
    const text = guess.trim();
    if (!text || round.solved) return;
    setGuess('');
    setGuesses(g => [...g, { by: myId, text }]);
    send('guess', { n: round.n, text });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/60">You <b className="text-amber-300">{score[myId] ?? 0}</b> · <b className="text-amber-300">{score[peerId] ?? 0}</b> {peerName}</span>
        <span className="font-semibold text-amber-200">
          {round.solved
            ? round.solved.by ? `${nameOf(round.solved.by)} got it: ${round.solved.word}! 🎉` : `Skipped. It was ${round.solved.word}`
            : iDraw ? <>Draw: <span className="rounded bg-amber-300 px-1.5 py-0.5 text-[#1d1a10]">{word}</span></> : `${peerName} is drawing…`}
        </span>
      </div>

      <canvas
        ref={canvasRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className={`aspect-square w-full rounded-xl bg-white ${iDraw && !round.solved ? 'cursor-crosshair' : ''}`}
        style={{ touchAction: 'none' }}
        aria-label={iDraw ? 'Drawing canvas' : `${peerName}'s drawing`}
      />

      {iDraw && !round.solved && (
        <div className="flex items-center gap-1.5">
          {COLORS.map(c => (
            <button key={c} type="button" onClick={() => setColor(c)} className={`h-7 w-7 rounded-full border-2 ${color === c ? 'border-amber-300 scale-110' : 'border-white/20'}`} style={{ background: c }} aria-label={`Colour ${c}`} />
          ))}
          <div className="flex-1" />
          <button type="button" onClick={clear} className="rounded-lg p-1.5 text-white/60 hover:bg-white/10" title="Clear"><Eraser className="h-4 w-4" /></button>
          <button type="button" onClick={() => finish(null)} className="rounded-lg p-1.5 text-white/60 hover:bg-white/10" title="Skip word"><SkipForward className="h-4 w-4" /></button>
        </div>
      )}

      {!iDraw && !round.solved && (
        <form onSubmit={submitGuess} className="flex gap-2">
          <input value={guess} onChange={e => setGuess(e.target.value)} placeholder="Your guess…" className="min-w-0 flex-1 rounded-xl bg-white/5 px-3 py-2 text-sm text-white outline-none focus:bg-white/10" />
          <button type="submit" className="rounded-xl bg-amber-300 px-3 py-2 text-sm font-semibold text-[#1d1a10]">Guess</button>
        </form>
      )}

      {round.solved && (
        <button type="button" onClick={nextRound} className="rounded-xl bg-amber-300 px-4 py-2 text-sm font-semibold text-[#1d1a10]">
          Next round ({round.drawerId === myId ? `${peerName} draws` : 'you draw'})
        </button>
      )}

      {guesses.length > 0 && (
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {guesses.slice(-8).map((g, i) => (
            <span key={i} className="rounded-full bg-white/8 px-2 py-0.5 text-white/75">{nameOf(g.by)}: {g.text}</span>
          ))}
        </div>
      )}
    </div>
  );
}

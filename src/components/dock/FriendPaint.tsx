import { useCallback, useEffect, useRef, useState } from 'react';
import { Eraser, Send } from 'lucide-react';
import { DOODLE_PREFIX, sendMessage } from '../../shared/supabase/queries/messaging';
import { useGameChannel } from './friendGameChannel';

const COLORS = ['#111827', '#ef4444', '#f97316', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff'];
const SIZES = [4, 10, 22];

/** Points are 0..1 of the canvas so phones and laptops paint the same picture. */
interface Stroke { id: string; color: string; size: number; pts: [number, number][] }
interface Canvas { strokes: Stroke[]; /** Bumped by "clear"; strokes from an older sheet are dropped. */ sheet: number }

const storageKey = (conversationId: string) => `velvet.paint.${conversationId}`;

/**
 * A shared paint surface: both people paint at the same time and see each
 * other's strokes as they're drawn. Strokes are merged by id, so a reload or a
 * late join catches up from the other person.
 */
export function FriendPaint({ conversationId, peerName, onSent }: { conversationId: string; peerName: string; /** After a doodle is sent into the chat. */ onSent?: () => void }) {
  const [sending, setSending] = useState(false);
  const [color, setColor] = useState(COLORS[1]);
  const [size, setSize] = useState(SIZES[1]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const doc = useRef<Canvas>((() => {
    try { const raw = localStorage.getItem(storageKey(conversationId)); if (raw) return JSON.parse(raw) as Canvas; } catch { /* storage blocked */ }
    return { strokes: [], sheet: 0 };
  })());
  const mine = useRef<Stroke | null>(null);
  const theirs = useRef<Stroke | null>(null);
  const [, bump] = useState(0);

  const redraw = useCallback(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const scale = c.width / 400;
    const all = [...doc.current.strokes, ...(theirs.current ? [theirs.current] : []), ...(mine.current ? [mine.current] : [])];
    for (const s of all) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.size * scale;
      ctx.beginPath();
      s.pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x * c.width, y * c.height) : ctx.lineTo(x * c.width, y * c.height)));
      if (s.pts.length === 1) ctx.lineTo(s.pts[0][0] * c.width + 0.1, s.pts[0][1] * c.height);
      ctx.stroke();
    }
  }, []);

  const save = () => {
    try { localStorage.setItem(storageKey(conversationId), JSON.stringify(doc.current)); } catch { /* storage blocked or full */ }
  };

  const merge = (incoming: Canvas) => {
    const cur = doc.current;
    if (incoming.sheet < cur.sheet) return;
    const base = incoming.sheet > cur.sheet ? [] : cur.strokes;
    const ids = new Set(base.map(s => s.id));
    doc.current = { sheet: incoming.sheet, strokes: [...base, ...incoming.strokes.filter(s => !ids.has(s.id))] };
    save();
    redraw();
    bump(n => n + 1);
  };

  const send = useGameChannel(`paint-${conversationId}`, {
    live: (p: { sheet: number; stroke: Stroke }) => {
      if (p.sheet !== doc.current.sheet) return;
      theirs.current = p.stroke;
      redraw();
    },
    stroke: (p: { sheet: number; stroke: Stroke }) => {
      theirs.current = null;
      merge({ sheet: p.sheet, strokes: [p.stroke] });
    },
    state: (c: Canvas) => merge(c),
    hello: () => send('state', doc.current),
  }, (s) => s('hello', {}));

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

  const point = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };
  const lastSent = useRef(0);
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    mine.current = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, color, size, pts: [point(e)] };
    redraw();
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!mine.current) return;
    mine.current.pts.push(point(e));
    redraw();
    const now = Date.now();
    if (now - lastSent.current > 50) {
      lastSent.current = now;
      send('live', { sheet: doc.current.sheet, stroke: mine.current });
    }
  };
  const onUp = () => {
    const s = mine.current;
    if (!s) return;
    mine.current = null;
    doc.current = { ...doc.current, strokes: [...doc.current.strokes, s] };
    save();
    redraw();
    send('stroke', { sheet: doc.current.sheet, stroke: s });
  };
  const clear = () => {
    if (doc.current.strokes.length > 0 && !confirm(`Clear the canvas for you and ${peerName}?`)) return;
    doc.current = { strokes: [], sheet: doc.current.sheet + 1 };
    save();
    redraw();
    send('state', doc.current);
  };

  // Pictochat-style: post the picture into the chat as a doodle.
  const sendDoodle = async () => {
    if (doc.current.strokes.length === 0 || sending) return;
    const out = document.createElement('canvas');
    out.width = 320;
    out.height = 320;
    const ctx = out.getContext('2d');
    const src = canvasRef.current;
    if (!ctx || !src) return;
    ctx.drawImage(src, 0, 0, out.width, out.height);
    setSending(true);
    try {
      await sendMessage(conversationId, DOODLE_PREFIX + out.toDataURL('image/jpeg', 0.8));
      onSent?.();
    } catch { /* stays on the canvas; they can try again */ }
    setSending(false);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-2">
      <p className="text-center text-[11px] text-white/55">Paint together. {peerName} sees every stroke live.</p>
      <canvas
        ref={canvasRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className="aspect-square w-full cursor-crosshair rounded-xl bg-white"
        style={{ touchAction: 'none' }}
        aria-label="Shared paint canvas"
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {COLORS.map(c => (
          <button key={c} type="button" onClick={() => setColor(c)} className={`h-6 w-6 rounded-full border-2 ${color === c ? 'border-amber-300 scale-110' : 'border-white/20'}`} style={{ background: c }} aria-label={`Colour ${c}`} />
        ))}
        <div className="flex-1" />
        {SIZES.map(sz => (
          <button key={sz} type="button" onClick={() => setSize(sz)} className={`flex h-7 w-7 items-center justify-center rounded-lg ${size === sz ? 'bg-white/15' : 'hover:bg-white/10'}`} aria-label={`Brush ${sz}`}>
            <span className="rounded-full bg-white" style={{ width: Math.min(18, sz * 0.8 + 2), height: Math.min(18, sz * 0.8 + 2) }} />
          </button>
        ))}
        <button type="button" onClick={clear} className="rounded-lg p-1.5 text-white/60 hover:bg-white/10" title="Clear canvas"><Eraser className="h-4 w-4" /></button>
      </div>
      <button
        type="button"
        onClick={sendDoodle}
        disabled={sending}
        className="flex items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 py-2 text-sm font-semibold text-[#1d1a10] disabled:opacity-50"
      >
        <Send className="h-4 w-4" /> {sending ? 'Sending…' : 'Send to chat'}
      </button>
    </div>
  );
}

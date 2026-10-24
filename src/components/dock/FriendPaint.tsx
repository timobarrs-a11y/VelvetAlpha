import { useCallback, useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { DOODLE_PREFIX, sendMessage } from '../../shared/supabase/queries/messaging';
import { useGameChannel } from './friendGameChannel';
import { useSquareFit } from './useSquareFit';
import { DrawToolbar, extendStroke, renderStrokes, startStroke, type Stroke, type Tool } from './drawKit';

/** The shared canvas: strokes from both people, plus undone ones so a merge can't revive them. */
interface Canvas { strokes: Stroke[]; removed: string[]; /** Bumped by Clear. */ sheet: number }

const storageKey = (conversationId: string) => `velvet.paint.${conversationId}`;

function load(conversationId: string): Canvas {
  try {
    const raw = localStorage.getItem(storageKey(conversationId));
    if (raw) { const c = JSON.parse(raw); return { strokes: c.strokes ?? [], removed: c.removed ?? [], sheet: c.sheet ?? 0 }; }
  } catch { /* storage blocked */ }
  return { strokes: [], removed: [], sheet: 0 };
}

/**
 * A shared paint surface: both people paint at the same time and see each
 * other's strokes as they're drawn. Strokes merge by id, so a reload or a
 * late join catches up from the other person. Send to chat posts it as a doodle.
 */
export function FriendPaint({ conversationId, myId, peerName, onSent }: { conversationId: string; myId: string; peerName: string; /** After a doodle is sent into the chat. */ onSent?: () => void }) {
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#EF4444');
  const [size, setSize] = useState(8);
  const [sending, setSending] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [squareRef, square] = useSquareFit<HTMLDivElement>();
  const doc = useRef<Canvas>(load(conversationId));
  const mine = useRef<Stroke | null>(null);
  const theirs = useRef<Stroke | null>(null);
  const [, bump] = useState(0);

  const redraw = useCallback(() => {
    const c = canvasRef.current, ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const extra = [theirs.current, mine.current].filter(Boolean) as Stroke[];
    renderStrokes(ctx, [...doc.current.strokes, ...extra], c.width, c.height);
  }, []);

  const save = () => {
    try { localStorage.setItem(storageKey(conversationId), JSON.stringify(doc.current)); } catch { /* storage blocked or full */ }
  };

  const merge = (incoming: Canvas) => {
    const cur = doc.current;
    const sheet = Math.max(cur.sheet, incoming.sheet);
    const removed = [...new Set([...cur.removed, ...(incoming.removed ?? [])])], gone = new Set(removed);
    const strokes = [...new Map([...cur.strokes, ...incoming.strokes].map(s => [s.id, s])).values()]
      .filter(s => (s.sheet ?? 0) === sheet && !gone.has(s.id));
    doc.current = { sheet, strokes, removed };
    save();
    redraw();
    bump(n => n + 1);
  };

  const send = useGameChannel(`paint-${conversationId}`, {
    live: (p: { sheet: number; stroke: Stroke | null }) => {
      if (p.sheet !== doc.current.sheet) return;
      theirs.current = p.stroke;
      redraw();
    },
    stroke: (p: { sheet: number; stroke: Stroke }) => {
      theirs.current = null;
      merge({ sheet: p.sheet, strokes: [p.stroke], removed: [] });
    },
    state: (c: Canvas) => merge(c),
    hello: () => send('state', doc.current),
  }, (s) => s('hello', {}));

  // Keep the canvas sharp at its on-screen size.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !square) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(square * dpr);
    c.height = Math.round(square * dpr);
    redraw();
  }, [square, redraw]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };
  const lastSent = useRef(0);
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    mine.current = startStroke(tool, color, size, point(e), myId, doc.current.sheet);
    if (tool === 'fill') { onUp(); return; }
    redraw();
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!mine.current) return;
    extendStroke(mine.current, point(e));
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
    bump(n => n + 1);
    send('stroke', { sheet: doc.current.sheet, stroke: s });
  };
  const undo = () => {
    const last = [...doc.current.strokes].reverse().find(s => s.by === myId);
    if (!last) return;
    doc.current = { ...doc.current, strokes: doc.current.strokes.filter(s => s.id !== last.id), removed: [...doc.current.removed, last.id] };
    save(); redraw(); bump(n => n + 1);
    send('state', doc.current);
  };
  const clear = () => {
    if (doc.current.strokes.length > 0 && !confirm(`Clear the canvas for you and ${peerName}?`)) return;
    doc.current = { strokes: [], removed: [], sheet: doc.current.sheet + 1 };
    save();
    redraw();
    bump(n => n + 1);
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
    <div className="flex min-h-0 flex-1 flex-col gap-1.5 px-3 py-2 [&>*:not(.square-slot)]:flex-shrink-0">
      <p className="text-center text-[11px] text-white/55">Paint together. {peerName} sees every stroke live.</p>
      {/* The canvas takes the largest square that fits, so the tools stay on screen. */}
      <div ref={squareRef} className="square-slot flex min-h-[120px] flex-1 items-center justify-center">
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="cursor-crosshair rounded-xl bg-white"
          style={{ touchAction: 'none', width: square ?? undefined, height: square ?? undefined }}
          aria-label="Shared paint canvas"
        />
      </div>
      <DrawToolbar tool={tool} setTool={setTool} color={color} setColor={setColor} size={size} setSize={setSize}
        onUndo={undo} canUndo={doc.current.strokes.some(s => s.by === myId)} onClear={clear} />
      <button
        type="button"
        onClick={sendDoodle}
        disabled={sending}
        className="flex items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 py-1.5 text-sm font-semibold text-[#1d1a10] disabled:opacity-50"
      >
        <Send className="h-4 w-4" /> {sending ? 'Sending…' : 'Send to chat'}
      </button>
    </div>
  );
}

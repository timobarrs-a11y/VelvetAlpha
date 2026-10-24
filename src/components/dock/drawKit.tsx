import { Circle, Eraser, Minus, PaintBucket, Pencil, Square, Trash2, Undo2 } from 'lucide-react';

// Shared drawing kit for Draw & Guess and Doodle together: the stroke model,
// how to paint strokes onto a canvas, and the toolbar.

export type Tool = 'pen' | 'eraser' | 'line' | 'rect' | 'ellipse' | 'fill';

/**
 * One mark on the canvas. Points are 0..1 of the canvas so every screen draws
 * the same picture; size is in units of a 400px-wide canvas.
 */
export interface Stroke {
  id: string;
  tool: Tool;
  color: string;
  size: number;
  pts: [number, number][];
  /** Who drew it (for undo). */
  by?: string;
  /** Canvas generation: clearing bumps it, and older strokes are dropped. */
  sheet?: number;
}

export const PALETTE = [
  '#111827', '#6B7280', '#FFFFFF', '#7C2D12', '#EF4444', '#F97316',
  '#F59E0B', '#FDE047', '#22C55E', '#14B8A6', '#3B82F6', '#6366F1',
  '#8B5CF6', '#EC4899', '#F9A8D4', '#C79A5B',
];

export const newStrokeId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Paint strokes in order onto a canvas of the given pixel size (white background). */
export function renderStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[], w: number, h: number): void {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const scale = w / 400;
  for (const s of strokes) {
    if (!s.pts.length) continue;
    const P = s.pts.map(([x, y]) => [x * w, y * h] as const);
    if (s.tool === 'fill') {
      floodFill(ctx, Math.round(P[0][0]), Math.round(P[0][1]), s.color, w, h);
      continue;
    }
    ctx.strokeStyle = s.tool === 'eraser' ? '#ffffff' : s.color;
    ctx.lineWidth = Math.max(1, s.size * scale);
    ctx.beginPath();
    if (s.tool === 'line' || s.tool === 'rect' || s.tool === 'ellipse') {
      const [a, b] = [P[0], P[P.length - 1]];
      if (s.tool === 'line') { ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      else if (s.tool === 'rect') ctx.rect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
      else ctx.ellipse((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]) / 2, Math.abs(b[1] - a[1]) / 2, 0, 0, Math.PI * 2);
    } else {
      P.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      if (P.length === 1) ctx.lineTo(P[0][0] + 0.1, P[0][1]);
    }
    ctx.stroke();
  }
}

function hexRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '');
  const n = parseInt(m.length === 3 ? m.split('').map(c => c + c).join('') : m, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Paint-bucket fill: fills the area of similar colour around (x, y). */
function floodFill(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, w: number, h: number): void {
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  const at = (px: number, py: number) => (py * w + px) * 4;
  const i0 = at(x, y), target = [d[i0], d[i0 + 1], d[i0 + 2]];
  const [r, g, b] = hexRgb(color);
  if (Math.abs(target[0] - r) + Math.abs(target[1] - g) + Math.abs(target[2] - b) < 8) return;
  // Anti-aliased edges blend colours, so allow a little tolerance.
  const close = (i: number) => Math.abs(d[i] - target[0]) + Math.abs(d[i + 1] - target[1]) + Math.abs(d[i + 2] - target[2]) < 90;
  const stack: number[] = [x, y];
  const seen = new Uint8Array(w * h);
  while (stack.length) {
    const py = stack.pop()!, px0 = stack.pop()!;
    let px = px0;
    while (px >= 0 && !seen[py * w + px] && close(at(px, py))) px--;
    px++;
    let up = false, down = false;
    while (px < w && !seen[py * w + px] && close(at(px, py))) {
      const i = at(px, py);
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
      seen[py * w + px] = 1;
      if (py > 0) { const u = close(at(px, py - 1)) && !seen[(py - 1) * w + px]; if (u && !up) { stack.push(px, py - 1); } up = u; }
      if (py < h - 1) { const v = close(at(px, py + 1)) && !seen[(py + 1) * w + px]; if (v && !down) { stack.push(px, py + 1); } down = v; }
      px++;
    }
  }
  ctx.putImageData(img, 0, 0);
}

const TOOLS: { id: Tool; label: string; Icon: typeof Pencil }[] = [
  { id: 'pen', label: 'Pen', Icon: Pencil },
  { id: 'eraser', label: 'Eraser', Icon: Eraser },
  { id: 'line', label: 'Line', Icon: Minus },
  { id: 'rect', label: 'Rectangle', Icon: Square },
  { id: 'ellipse', label: 'Circle', Icon: Circle },
  { id: 'fill', label: 'Fill', Icon: PaintBucket },
];

/** Tools, thickness, colours (plus a custom picker), undo and clear. */
export function DrawToolbar({ tool, setTool, color, setColor, size, setSize, onUndo, canUndo, onClear }: {
  tool: Tool; setTool: (t: Tool) => void;
  color: string; setColor: (c: string) => void;
  size: number; setSize: (n: number) => void;
  onUndo: () => void; canUndo: boolean; onClear: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        {TOOLS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTool(id)}
            className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${tool === id ? 'bg-amber-300 text-[#1d1a10]' : 'text-white/70 hover:bg-white/10'}`}
            aria-label={label}
            aria-pressed={tool === id}
            title={label}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
        <div className="flex-1" />
        <button type="button" onClick={onUndo} disabled={!canUndo} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 disabled:opacity-30" aria-label="Undo" title="Undo">
          <Undo2 className="h-4 w-4" />
        </button>
        <button type="button" onClick={onClear} className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/10" aria-label="Clear canvas" title="Clear canvas">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center">
          <span className="rounded-full" style={{ width: Math.min(22, Math.max(3, size * 0.8)), height: Math.min(22, Math.max(3, size * 0.8)), background: tool === 'eraser' ? '#ffffff' : color, border: '1px solid rgba(255,255,255,.3)' }} />
        </span>
        <input
          type="range"
          min={1}
          max={40}
          value={size}
          onChange={e => setSize(Number(e.target.value))}
          className="min-w-0 flex-1 accent-amber-300"
          aria-label="Thickness"
        />
        <label className="relative h-7 w-7 flex-shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-white/30" title="Pick any colour" style={{ background: color }}>
          <input type="color" value={color} onChange={e => setColor(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label="Custom colour" />
        </label>
      </div>
      <div className="flex items-center gap-1 overflow-x-auto py-0.5 scrollbar-hide">
        {PALETTE.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => { setColor(c); if (tool === 'eraser') setTool('pen'); }}
            className={`h-6 w-6 flex-shrink-0 rounded-full border-2 ${color === c ? 'scale-110 border-amber-300' : 'border-white/20'}`}
            style={{ background: c }}
            aria-label={`Colour ${c}`}
          />
        ))}
      </div>
    </div>
  );
}

/** Shared pointer handling: pen/eraser draw freehand, shapes drag from a start point, fill taps. */
export function startStroke(tool: Tool, color: string, size: number, p: [number, number], by?: string, sheet?: number): Stroke {
  return { id: newStrokeId(), tool, color, size, pts: [p], by, sheet };
}

export function extendStroke(s: Stroke, p: [number, number]): void {
  if (s.tool === 'pen' || s.tool === 'eraser') s.pts.push(p);
  else if (s.tool !== 'fill') s.pts = [s.pts[0], p];
}

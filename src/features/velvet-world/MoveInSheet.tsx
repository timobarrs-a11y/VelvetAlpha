import { useState, useRef, useEffect } from 'react';
import {
  drawPlot, plotBounds, HOUSE_STYLES, COLORS,
  type Plot, type PlotConfig, type HouseStyle, type Env,
} from './art/streetArt';
import { claimPlot } from '../../services/worldService';

interface MoveInSheetProps {
  onMoved: () => void;
}

const STARTERS = HOUSE_STYLES.filter((h) => h.tier === 'starter');

export function MoveInSheet({ onMoved }: MoveInSheetProps) {
  const [house, setHouse] = useState<HouseStyle>('standard');
  const [body, setBody] = useState<string>(COLORS.body[0]);
  const [roof, setRoof] = useState<string>(COLORS.roof[0]);
  const [door, setDoor] = useState<string>(COLORS.door[0]);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const tileRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());

  const env: Env = { season: 'summer', hour: 12, night: 0, reducedMotion: false };

  const makePlot = (style: HouseStyle, b: string, r: string, d: string): Plot => ({
    id: 'preview',
    number: 2,
    member: false,
    origin: null,
    config: { house: { style, body: b, roof: r, door: d } },
    profile: { name: '' },
  });

  const drawPreview = (canvas: HTMLCanvasElement, plot: Plot) => {
    const b = plotBounds(0, plot);
    const scale = Math.min(canvas.width / b.w, canvas.height / b.h);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const ox = (canvas.width - b.w * scale) / 2 - b.x * scale;
    const oy = (canvas.height - b.h * scale) / 2 - b.y * scale;
    ctx.setTransform(scale, 0, 0, scale, ox, oy);
    drawPlot(ctx, plot, 0, 'back', env);
    drawPlot(ctx, plot, 0, 'front', env);
  };

  useEffect(() => {
    if (previewRef.current) {
      drawPreview(previewRef.current, makePlot(house, body, roof, door));
    }
  }, [house, body, roof, door]);

  useEffect(() => {
    STARTERS.forEach((h) => {
      const canvas = tileRefs.current.get(h.id);
      if (canvas) drawPreview(canvas, makePlot(h.id, COLORS.body[0], COLORS.roof[0], COLORS.door[0]));
    });
  }, []);

  const handleMoveIn = async () => {
    setMoving(true);
    setError(null);
    try {
      const houseConfig: PlotConfig['house'] = { style: house, body, roof, door };
      await claimPlot(houseConfig);
      onMoved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to move in');
    }
    setMoving(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#080b14] p-6">
      <div className="w-full max-w-2xl">
        <h1 className="mb-2 text-center font-extrabold text-2xl text-white" style={{ fontFamily: '"Bricolage Grotesque", sans-serif' }}>
          Pick your house
        </h1>
        <p className="mb-6 text-center text-sm text-white/40">Choose a starter home and its colors. You can change everything later.</p>

        {/* Big preview */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]" style={{ height: '240px' }}>
          <canvas ref={previewRef} width={600} height={240} className="h-full w-full" />
        </div>

        {/* House tiles */}
        <div className="mb-6 grid grid-cols-5 gap-3">
          {STARTERS.map((h) => (
            <button
              key={h.id}
              onClick={() => setHouse(h.id)}
              aria-pressed={house === h.id}
              className={`overflow-hidden rounded-xl border-2 transition-all ${
                house === h.id ? 'border-white' : 'border-white/10 hover:border-white/30'
              }`}
            >
              <canvas
                ref={(el) => { if (el) tileRefs.current.set(h.id, el); }}
                width={120}
                height={100}
                className="h-full w-full"
              />
              <p className="px-1 py-1.5 text-[10px] font-semibold text-white/60">{h.label}</p>
            </button>
          ))}
        </div>

        {/* Color swatches */}
        <div className="mb-6 space-y-4">
          <SwatchPicker label="Walls" colors={COLORS.body} current={body} onPick={setBody} />
          <SwatchPicker label="Roof" colors={COLORS.roof} current={roof} onPick={setRoof} />
          <SwatchPicker label="Door" colors={COLORS.door} current={door} onPick={setDoor} />
        </div>

        {error && <p className="mb-4 text-center text-sm text-rose-400">{error}</p>}

        <button
          onClick={handleMoveIn}
          disabled={moving}
          className="w-full rounded-full bg-gradient-to-r from-rose-500 to-pink-600 py-3.5 font-bold text-white transition-all hover:shadow-xl disabled:opacity-50"
        >
          {moving ? 'Moving in...' : 'Move in'}
        </button>
      </div>
    </div>
  );
}

function SwatchPicker({ label, colors, current, onPick }: { label: string; colors: string[]; current: string; onPick: (v: string) => void }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-wider text-white/40">{label}</span>
      <div className="flex flex-wrap gap-2">
        {colors.map((c) => (
          <button
            key={c}
            onClick={() => onPick(c)}
            aria-pressed={c.toLowerCase() === current.toLowerCase()}
            aria-label={`${label} ${c}`}
            className="h-7 w-7 rounded-lg border-2 transition-transform hover:scale-110"
            style={{ background: c, borderColor: c.toLowerCase() === current.toLowerCase() ? '#fff' : 'transparent', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.25)' }}
          />
        ))}
      </div>
    </div>
  );
}

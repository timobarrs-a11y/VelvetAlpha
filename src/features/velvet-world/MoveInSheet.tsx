import { useState, useRef, useEffect } from 'react';
import { COLORS, STYLE_DEFAULTS, houseUnlock, type HouseStyle, type HouseConfig } from './art/streetArt';
import { claimPlot, getUnlocks, saveHouse } from '../../services/worldService';
import { HousePicker } from './HousePicker';
import { drawHouseTile, tilePlot } from './houseTiles';

/**
 * Pick a house and its colors, then move in. Used by the welcome popup and by /world on a
 * first visit. Every collection is shown; member and earned houses are locked until unlocked.
 */
export function MoveInPanel({ onMoved, compact = false, initial, submitLabel = 'Move in' }: {
  /** The house they moved in with, and whether they picked it themselves. */
  onMoved: (house: HouseConfig, chosen: boolean) => void;
  compact?: boolean;
  /** A house that already exists (a member we built one for): edit it instead of moving in. */
  initial?: HouseConfig | null;
  submitLabel?: string;
}) {
  const start = initial?.style ?? 'standard';
  const [house, setHouse] = useState<HouseStyle>(start);
  const [colors, setColors] = useState(() => ({
    body: initial?.body ?? STYLE_DEFAULTS[start].body, roof: initial?.roof ?? STYLE_DEFAULTS[start].roof, door: initial?.door ?? STYLE_DEFAULTS[start].door,
  }));
  const [unlocks, setUnlocks] = useState<{ is_member: boolean; earned: string[] }>({ is_member: false, earned: [] });
  const [moving, setMoving] = useState(false);
  // Any pick or color change makes it theirs (for Atlas's first remark).
  const [chosen, setChosen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => { getUnlocks().then(setUnlocks).catch(() => {}); }, []);

  useEffect(() => {
    if (previewRef.current) drawHouseTile(previewRef.current, tilePlot(house, colors, unlocks.is_member, unlocks.earned), 10);
  }, [house, colors, unlocks]);

  const pickHouse = (style: HouseStyle) => {
    if (!houseUnlock(style, unlocks.is_member, unlocks.earned).ok) return;
    setHouse(style);
    setChosen(true);
    const d = STYLE_DEFAULTS[style];
    setColors({ body: d.body, roof: d.roof, door: d.door });
  };

  const handleMoveIn = async () => {
    setMoving(true);
    setError(null);
    try {
      if (initial) await saveHouse({ style: house, ...colors });
      else await claimPlot({ style: house, ...colors });
      onMoved({ style: house, ...colors }, chosen);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to move in');
    }
    setMoving(false);
  };

  return (
    <div className="grid gap-5">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#9DAE97]/20" style={{ height: compact ? 190 : 240 }}>
        <canvas ref={previewRef} width={640} height={compact ? 190 : 240} className="h-full w-full object-contain" />
      </div>

      <HousePicker value={house} onChange={pickHouse} isMember={unlocks.is_member} earned={unlocks.earned} colors={colors} />

      <div className="grid gap-3">
        <SwatchPicker label="Walls" colors={COLORS.body} current={colors.body} onPick={(v) => { setChosen(true); setColors((c) => ({ ...c, body: v })); }} />
        <SwatchPicker label="Roof" colors={COLORS.roof} current={colors.roof} onPick={(v) => { setChosen(true); setColors((c) => ({ ...c, roof: v })); }} />
        <SwatchPicker label="Door" colors={COLORS.door} current={colors.door} onPick={(v) => { setChosen(true); setColors((c) => ({ ...c, door: v })); }} />
      </div>

      {error && <p className="text-center text-sm text-rose-400">{error}</p>}

      <button
        type="button"
        onClick={handleMoveIn}
        disabled={moving}
        className="w-full rounded-full bg-gradient-to-r from-rose-500 to-pink-600 py-3.5 font-bold text-white transition-all hover:shadow-xl disabled:opacity-50"
      >
        {moving ? 'Saving…' : submitLabel}
      </button>
    </div>
  );
}

export function MoveInSheet({ onMoved }: { onMoved: () => void }) {
  return (
    <div className="flex min-h-screen items-start justify-center overflow-auto bg-[#080b14] p-6">
      <div className="w-full max-w-2xl py-6">
        <h1 className="mb-2 text-center text-2xl font-extrabold text-white" style={{ fontFamily: '"Bricolage Grotesque", sans-serif' }}>
          Pick your house
        </h1>
        <p className="mb-6 text-center text-sm text-white/45">You can change your house and colors any time.</p>
        <MoveInPanel onMoved={onMoved} />
      </div>
    </div>
  );
}

export function SwatchPicker({ label, colors, current, onPick }: { label: string; colors: string[]; current: string; onPick: (v: string) => void }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-wider text-white/40">{label}</span>
      <div className="flex flex-wrap gap-2">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
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

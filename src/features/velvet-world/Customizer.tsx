import { useState, useCallback } from 'react';
import {
  houseUnlock, COLORS,
  BILLBOARD_STYLES, CAR_TYPES, PET_TYPES, LAWN_STYLES, TREE_TYPES,
  resolvePlot,
  type Plot, type PlotConfig, type HouseStyle,
} from './art/streetArt';
import { HousePicker } from './HousePicker';
import { savePlot, setMainCompanion, type MyPlot } from '../../services/worldService';

interface CustomizerProps {
  plot: Plot;
  myPlot: MyPlot;
  companions: { id: string; custom_name: string }[];
  mainCompanionId: string | null;
  onSaved: (config: PlotConfig) => void;
  onCancel: () => void;
  invalidate: (id: string) => void;
}

export function Customizer({ plot, myPlot, companions, mainCompanionId, onSaved, onCancel, invalidate }: CustomizerProps) {
  const [config, setConfig] = useState<PlotConfig>(() => JSON.parse(JSON.stringify(plot.config)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mainId, setMainId] = useState<string | null>(mainCompanionId);

  const resolved = resolvePlot({ ...plot, config, _resolved: null });
  const locked = !myPlot.is_member;

  const set = useCallback((fn: (c: PlotConfig) => void) => {
    setConfig(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      fn(next);
      return next;
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const toSave: PlotConfig = { ...config };
      if (locked) {
        // Free users keep their house and colors; member-only sign and yard choices are dropped
        toSave.sign = {};
        toSave.car = { type: 'none' };
        toSave.pet = { kind: 'none' };
        toSave.lawn = 'plain';
        toSave.tree = 'none';
        toSave.extras = {};
      }
      await savePlot(toSave);
      invalidate(plot.id);
      onSaved(toSave);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Save failed';
      if (msg.includes('not open to you')) {
        setError('That house is not open to you yet');
        setConfig(JSON.parse(JSON.stringify(plot.config)));
      } else {
        setError(msg);
      }
    }
    setSaving(false);
  };

  const handleMainChange = async (id: string | null) => {
    setMainId(id);
    try {
      await setMainCompanion(id);
    } catch {
      // ignore
    }
  };

  return (
    <div className="grid gap-3.5 px-[18px] pb-[18px]">
      {/* Lock box for free users */}
      {locked && (
        <div className="grid gap-2 rounded-xl border p-3 text-[13px] text-white/60" style={{ background: 'rgba(245,184,46,0.08)', borderColor: 'rgba(245,184,46,0.25)' }}>
          <span>You are on the free plan: any starter house in any colors, plus earned houses for medals you have. Member houses, twinkle lights, animation and yard extras come with membership.</span>
        </div>
      )}

      {/* Houses: all three collections, locked ones shown with how to unlock them */}
      <HousePicker
        value={resolved.house.style}
        onChange={(style: HouseStyle) => { if (houseUnlock(style, myPlot.is_member, myPlot.earned).ok) set((cc) => { cc.house = { style }; }); }}
        isMember={myPlot.is_member}
        earned={myPlot.earned}
        colors={{ body: resolved.house.body, roof: resolved.house.roof, door: resolved.house.door }}
      />

      {/* Color swatches */}
      <SwatchRow label="Walls" colors={COLORS.body} current={resolved.house.body} onPick={(v) => set((cc) => { cc.house = { ...cc.house, body: v }; })} />
      <SwatchRow label="Roof" colors={COLORS.roof} current={resolved.house.roof} onPick={(v) => set((cc) => { cc.house = { ...cc.house, roof: v }; })} />
      <SwatchRow label="Door" colors={COLORS.door} current={resolved.house.door} onPick={(v) => set((cc) => { cc.house = { ...cc.house, door: v }; })} />

      {/* Member rows */}
      <MemberRow label="Billboard" items={BILLBOARD_STYLES.filter(b => b.id !== 'post')} current={resolved.sign.style} locked={locked} onPick={(v) => set((cc) => { cc.sign = { ...cc.sign, style: v }; })} />
      {!locked && <SwatchRow label="Sign color" colors={COLORS.sign} current={resolved.sign.color} onPick={(v) => set((cc) => { cc.sign = { ...cc.sign, color: v }; })} />}
      <MemberRow label="Car" items={CAR_TYPES} current={resolved.car?.type ?? 'none'} locked={locked} onPick={(v) => set((cc) => { cc.car = { ...(cc.car || {}), type: v }; })} />
      <MemberRow label="Pet" items={PET_TYPES} current={resolved.pet?.kind ?? 'none'} locked={locked} onPick={(v) => set((cc) => { cc.pet = { kind: v, coat: v === 'none' ? undefined : COLORS.coat[v as 'dog' | 'cat'][0] }; })} />
      <MemberRow label="Yard" items={LAWN_STYLES} current={resolved.lawn} locked={locked} onPick={(v) => set((cc) => { cc.lawn = v; })} />
      <MemberRow label="Tree" items={TREE_TYPES} current={resolved.tree} locked={locked} onPick={(v) => set((cc) => { cc.tree = v; })} />

      {/* Main house picker */}
      <div className="border-t border-white/8 pt-3.5">
        <span className="label">Main house</span>
        <p className="mt-1 mb-2 text-[12px] text-white/40">Which companion's house you live in when you play. Your plot here never changes.</p>
        <select
          value={mainId ?? ''}
          onChange={(e) => handleMainChange(e.target.value || null)}
          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
        >
          <option value="">None</option>
          {companions.map((c) => (
            <option key={c.id} value={c.id}>{c.custom_name}</option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && <p className="text-[12px] text-rose-400">{error}</p>}

      {/* Save / Cancel */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 rounded-xl bg-[#F06A9B] px-3.5 py-2.5 font-bold text-[14px] text-[#2A0F1C] hover:bg-[#F5A3C1] transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          className="rounded-xl border border-white/10 px-3.5 py-2.5 font-bold text-[14px] text-white/60 hover:text-white hover:border-white/30 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function SwatchRow({ label, colors, current, onPick }: { label: string; colors: string[]; current: string; onPick: (v: string) => void }) {
  return (
    <div className="grid gap-1.5">
      <span className="label">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {colors.map((c) => (
          <button
            key={c}
            onClick={() => onPick(c)}
            aria-pressed={c.toLowerCase() === String(current).toLowerCase()}
            aria-label={`${label} ${c}`}
            className="h-6 w-6 rounded-lg border-2 transition-transform hover:scale-110"
            style={{ background: c, borderColor: c.toLowerCase() === String(current).toLowerCase() ? '#fff' : 'transparent', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.25)' }}
          />
        ))}
      </div>
    </div>
  );
}

function MemberRow({ label, items, current, locked, onPick }: {
  label: string;
  items: { id: string; label: string; free?: boolean }[];
  current: string;
  locked: boolean;
  onPick: (v: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <span className="label">{locked ? `${label} · members` : label}</span>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => !locked && onPick(it.id)}
            disabled={locked}
            aria-pressed={it.id === current}
            className={`rounded-[9px] border px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
              it.id === current ? 'border-white text-white bg-white/12' : 'border-white/10 text-white/60 hover:border-white/20'
            } ${locked ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}

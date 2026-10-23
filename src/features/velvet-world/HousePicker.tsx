import { useEffect, useRef } from 'react';
import { Lock } from 'lucide-react';
import { HOUSE_STYLES, HOUSE_TIERS, houseUnlock, MEDALS, type HouseStyle, type HouseTier } from './art/streetArt';
import { EARN_HINT, drawHouseTile, tilePlot } from './houseTiles';

const TIER_ORDER: HouseTier[] = ['starter', 'member', 'earned'];

function Tile({ style, label, note, selected, locked, onPick, colors }: {
  style: HouseStyle; label: string; note: string | null; selected: boolean; locked: boolean; onPick: () => void;
  colors?: { body?: string; roof?: string; door?: string };
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const info = HOUSE_STYLES.find((h) => h.id === style);
  const key = JSON.stringify(colors ?? {});
  useEffect(() => {
    // Locked houses are drawn as their owners would see them, so people can tell what they're working toward.
    if (ref.current) drawHouseTile(ref.current, tilePlot(style, selected ? JSON.parse(key) : {}, info?.tier !== 'starter', info?.medal ? [info.medal] : []));
  }, [style, selected, key, info]);
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={locked}
      aria-pressed={selected}
      aria-label={locked ? `${label}, locked: ${note}` : label}
      className={`relative overflow-hidden rounded-xl border-2 text-left transition-all ${selected ? 'border-white bg-white/10' : 'border-white/10 hover:border-white/30'} ${locked ? 'cursor-not-allowed' : ''}`}
    >
      <canvas ref={ref} width={180} height={150} className={`block h-auto w-full ${locked ? 'opacity-55 saturate-50' : ''}`} />
      {locked && <Lock className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-white/70" aria-hidden="true" />}
      <span className="block px-1.5 pt-1 text-[11.5px] font-bold leading-tight text-white/85">{label}</span>
      <span className="block px-1.5 pb-1.5 text-[10.5px] leading-tight text-white/45">{note ?? ' '}</span>
    </button>
  );
}

/**
 * All three collections of houses. Starter houses are open to everyone; member and earned
 * houses are always shown, locked or not, so people see what's ahead.
 */
export function HousePicker({ value, onChange, isMember, earned, colors }: {
  value: HouseStyle;
  onChange: (style: HouseStyle) => void;
  isMember: boolean;
  earned: string[];
  colors?: { body?: string; roof?: string; door?: string };
}) {
  return (
    <div className="grid gap-4">
      {TIER_ORDER.map((tier) => (
        <section key={tier} className="grid gap-2">
          <h3 className="flex items-baseline gap-2 text-[12px] font-bold uppercase tracking-wider text-white/50">
            {HOUSE_TIERS[tier].label}
            <span className="font-medium normal-case tracking-normal text-white/35">{tier === 'member' ? 'with membership' : tier === 'earned' ? 'one medal each, never for sale' : 'free for everyone'}</span>
          </h3>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {HOUSE_STYLES.filter((h) => h.tier === tier).map((h) => {
              const u = houseUnlock(h.id, isMember, earned);
              const note = u.ok ? (tier === 'earned' ? `Earned: ${MEDALS[h.medal ?? '']?.name ?? ''}` : null)
                : tier === 'member' ? 'Members' : `${MEDALS[h.medal ?? '']?.name ?? 'Medal'}: ${EARN_HINT[h.medal ?? ''] ?? 'earn the medal'}`;
              return <Tile key={h.id} style={h.id} label={h.label} note={note} selected={value === h.id} locked={!u.ok} onPick={() => onChange(h.id)} colors={colors} />;
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

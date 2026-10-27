import { Sparkles, Target, Zap } from 'lucide-react';
import { GOAL_TYPE_LABELS } from '../services/coachingService';
import type { ProfileCard } from '../services/publicProfileService';

function usableColor(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (/^#[0-9a-f]{3,8}$/i.test(v)) return v;
  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') return CSS.supports('color', v) ? v : null;
  return /^[a-z]+$/i.test(v) ? v : null;
}

/** What anyone can see about anyone: interests, favorite color, zodiac and a broad outline of what they are working on. */
export function ProfileFrontCard({ card }: { card: ProfileCard['card'] }) {
  const color = card.favorite_color ? usableColor(card.favorite_color) : null;
  const areas = card.goal_areas.map(a => GOAL_TYPE_LABELS[a] ?? a);
  if (!card.zodiac_sign && !card.favorite_color && !card.favorite_hero && card.interests.length === 0 && areas.length === 0) return null;

  return (
    <section aria-label="About" className="mb-8 rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-3">
      {(card.zodiac_sign || card.favorite_color || card.favorite_hero) && (
        <div className="flex flex-wrap items-center gap-2">
          {card.zodiac_sign && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-400/20 text-violet-200 text-xs font-medium">
              <Sparkles className="w-3 h-3" /> {card.zodiac_sign}
            </span>
          )}
          {card.favorite_color && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/70 text-xs font-medium">
              {color && <span aria-hidden className="w-3 h-3 rounded-full border border-white/30" style={{ background: color }} />}
              Favorite color: {card.favorite_color}
            </span>
          )}
          {card.favorite_hero && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-400/25 text-amber-100 text-xs font-medium">
              <Zap className="w-3 h-3 text-amber-300" /> Favorite hero: {card.favorite_hero}
            </span>
          )}
        </div>
      )}
      {areas.length > 0 && (
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-white/50">
          <Target className="w-3.5 h-3.5 text-pink-400" />
          Working on
          {areas.map(a => (
            <span key={a} className="px-2 py-0.5 rounded-md bg-pink-500/10 text-pink-200 text-[11px] font-medium">{a}</span>
          ))}
        </p>
      )}
      {card.interests.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">Into</p>
          <div className="flex flex-wrap gap-1.5">
            {card.interests.map(i => (
              <span key={i} className="px-2 py-0.5 rounded-md bg-white/6 text-white/70 text-[11.5px]">{i}</span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

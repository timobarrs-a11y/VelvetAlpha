import { useState } from 'react';
import { Heart, X } from 'lucide-react';

const DISMISS_KEY = 'velvet.no_companion_card_dismissed';

/** A gentle, dismissible invite for members without a companion; never a wall. */
export function NoCompanionCard({ onCreate }: { onCreate: () => void }) {
  const [hidden, setHidden] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });
  if (hidden) return null;
  return (
    <div className="mx-4 mt-3 flex items-center gap-3 rounded-2xl border border-pink-400/25 bg-pink-500/[0.07] p-3">
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-pink-500/20 text-pink-300"><Heart className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white">Meet a companion when you're ready</p>
        <p className="text-xs text-white/60">Answer a few questions and we'll match you. Everything else is open in the meantime.</p>
      </div>
      <button type="button" onClick={onCreate} className="flex-shrink-0 rounded-xl bg-pink-600 px-3 py-2 text-xs font-semibold text-white hover:bg-pink-500">Create</button>
      <button
        type="button"
        onClick={() => { try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* storage blocked */ } setHidden(true); }}
        className="flex-shrink-0 rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white"
        aria-label="Not now"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';

const CAPTIONS = [
  { title: 'This is your block.', body: 'New neighbors every day, and some of them share your spaces.' },
  { title: 'Tap any billboard', body: 'to see who lives there, and add them as a friend. Friends are pinned when you zoom out to the whole town.' },
  { title: 'Change anything, any time.', body: 'Tap your own house to open the editor again.' },
];

/**
 * The look around town in the arrival: three short captions over the real
 * town, and a way on to Today whenever they're ready.
 */
export function ArrivalTownTour({ onContinue }: { onContinue: () => void }) {
  const [i, setI] = useState(0);
  const caption = CAPTIONS[i];
  const last = i === CAPTIONS.length - 1;

  return (
    <div className="pointer-events-none fixed inset-x-0 z-30 flex justify-center px-4" style={{ bottom: 'max(16px, env(safe-area-inset-bottom))' }}>
      <div
        className="pointer-events-auto w-full max-w-md rounded-2xl border border-white/10 p-4 text-white shadow-2xl"
        style={{ background: 'rgba(24,19,34,0.9)', backdropFilter: 'blur(14px)' }}
        role="dialog"
        aria-label="A look around town"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/45">{i + 1} of {CAPTIONS.length}</p>
        <p className="mt-1 text-[15px] leading-snug">
          <b>{caption.title}</b> {caption.body}
        </p>
        <div className="mt-3 flex items-center justify-between gap-3">
          {!last ? (
            <button type="button" onClick={() => setI(i + 1)} className="text-sm font-semibold text-white/75 hover:text-white">
              Next
            </button>
          ) : <span />}
          <button
            type="button"
            onClick={onContinue}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 px-4 py-2 text-sm font-bold text-white"
          >
            Go to Today <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

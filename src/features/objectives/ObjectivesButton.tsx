import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight, Circle, Target, Trophy } from 'lucide-react';
import { usePopoverPosition } from '../../components/usePopoverPosition';
import { OBJECTIVES } from '../../services/dailyObjectivesService';
import { useDailyObjectives } from './useDailyObjectives';

/**
 * "2/5 today" in the toolbar. It drops down the day's objectives; tapping one takes you where you
 * do it, and it ticks itself off when you have.
 */
export function ObjectivesButton() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const popover = usePopoverPosition(open, ref, 300);
  const { done, count, total } = useDailyObjectives();
  const complete = count >= total;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

  const go = (to: string) => { setOpen(false); navigate(to); };

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
          complete
            ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            : 'border-pink-300 bg-white text-pink-600 hover:bg-pink-50'
        }`}
        aria-expanded={open}
        aria-label={`Daily objectives, ${count} of ${total} done today`}
        title="Today's objectives"
      >
        {complete ? <Check className="h-3.5 w-3.5" /> : <Target className="h-3.5 w-3.5" />}
        <span>{count}/{total}<span className="hidden sm:inline"> today</span></span>
      </button>
      {open && (
        <div style={popover} role="dialog" aria-label="Today's objectives" className="z-[80] rounded-xl border border-[#f5cfe0] bg-white p-3 text-[#2a1424] shadow-xl">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-semibold">Today&apos;s objectives</p>
            <p className="text-[11px] font-semibold text-[#2a1424]/55">{count}/{total}</p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#2a1424]/8">
            <div className="h-full rounded-full bg-gradient-to-r from-pink-500 to-rose-500 transition-all" style={{ width: `${(count / total) * 100}%` }} />
          </div>
          <ul className="mt-2 space-y-0.5">
            {OBJECTIVES.map(o => {
              const finished = done.has(o.key);
              return (
                <li key={o.key}>
                  <button
                    type="button"
                    onClick={() => go(o.to)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-pink-50"
                  >
                    {finished
                      ? <Check className="h-4 w-4 flex-shrink-0 rounded-full bg-emerald-500 p-0.5 text-white" aria-label="Done" />
                      : <Circle className="h-4 w-4 flex-shrink-0 text-[#2a1424]/30" aria-label="Not done yet" />}
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[13px] font-semibold ${finished ? 'text-[#2a1424]/45 line-through' : ''}`}>{o.label}</span>
                      <span className="block truncate text-[11px] text-[#2a1424]/55">{o.hint}</span>
                    </span>
                    {!finished && <ChevronRight className="h-4 w-4 flex-shrink-0 text-[#2a1424]/30" />}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 px-2 text-[11px] text-[#2a1424]/55">
            {complete ? 'A full day. Nicely done.' : 'Finish all five to work toward the Daily Driver medal.'}
          </p>
          <div className="mt-2 flex gap-2 border-t border-[#f5cfe0] pt-2">
            <button type="button" onClick={() => go('/leaderboard')} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-pink-500 px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-pink-600">
              <Trophy className="h-3.5 w-3.5" /> Leaderboard
            </button>
            <button type="button" onClick={() => go('/medals')} className="flex-1 rounded-lg border border-[#2a1424]/15 px-2.5 py-1.5 text-[12px] font-semibold hover:bg-pink-50">
              Medals
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight, Circle, Target, Trophy } from 'lucide-react';
import { usePopoverPosition } from '../../components/usePopoverPosition';
import { OBJECTIVE_DEFS, XP_PER_OBJECTIVE } from '../../services/dailyObjectivesService';

const SEEN_KEY = 'velvet.objectives.seen';
const seenBefore = () => { try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return true; } };
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
  const { rows, count, total, core } = useDailyObjectives();
  const complete = total > 0 && count >= total;
  // Until they have opened it once, it draws the eye.
  const [seen, setSeen] = useState(seenBefore);

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
        onClick={() => {
          setOpen(o => !o);
          if (!seen) { setSeen(true); try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* storage blocked */ } }
        }}
        className={`relative flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
          complete
            ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            : 'border-pink-300 bg-white text-pink-600 hover:bg-pink-50'
        }`}
        aria-expanded={open}
        aria-label={`Daily objectives, ${count} of ${total} done ${core ? 'to get started' : 'today'}`}
        title="Today's objectives"
      >
        {complete ? <Check className="h-3.5 w-3.5" /> : <Target className="h-3.5 w-3.5" />}
        <span>{count}/{total}<span className="hidden sm:inline">{core ? ' to start' : ' today'}</span></span>
        {!seen && total > 0 && (
          <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
          </span>
        )}
      </button>
      {open && (
        <div style={popover} role="dialog" aria-label="Today's objectives" className="z-[80] rounded-xl border border-[#f5cfe0] bg-white p-3 text-[#2a1424] shadow-xl">
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-semibold">{core ? 'Getting started' : 'Today\'s objectives'}</p>
            <p className="text-[11px] font-semibold text-[#2a1424]/55">{count}/{total}</p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#2a1424]/8">
            <div className="h-full rounded-full bg-gradient-to-r from-pink-500 to-rose-500 transition-all" style={{ width: `${total ? (count / total) * 100 : 0}%` }} />
          </div>
          <ul className="mt-2 space-y-0.5">
            {rows.map(r => {
              const def = OBJECTIVE_DEFS[r.key];
              return (
                <li key={r.key}>
                  <button
                    type="button"
                    onClick={() => go(def.to)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-pink-50"
                  >
                    {r.done
                      ? <Check className="h-4 w-4 flex-shrink-0 rounded-full bg-emerald-500 p-0.5 text-white" aria-label="Done" />
                      : <Circle className="h-4 w-4 flex-shrink-0 text-[#2a1424]/30" aria-label="Not done yet" />}
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[13px] font-semibold ${r.done ? 'text-[#2a1424]/45 line-through' : ''}`}>
                        {def.label}
                        {r.target > 1 && <span className="ml-1.5 text-[11px] font-medium text-[#2a1424]/55">{r.progress}/{r.target}</span>}
                        {r.hard && !r.done && <span className="ml-1.5 rounded bg-amber-100 px-1 text-[10px] font-bold text-amber-700">Challenge</span>}
                      </span>
                      <span className="block truncate text-[11px] text-[#2a1424]/55">{def.hint}</span>
                    </span>
                    {!r.done && <ChevronRight className="h-4 w-4 flex-shrink-0 text-[#2a1424]/30" />}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 px-2 text-[11px] text-[#2a1424]/55">
            {core
              ? `Do these five and a fresh set opens up every day. Each one is worth ${XP_PER_OBJECTIVE} XP.`
              : complete ? 'A full day. Nicely done.' : `Each one is worth ${XP_PER_OBJECTIVE} XP. Finish them all to work toward the Daily Driver medal.`}
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

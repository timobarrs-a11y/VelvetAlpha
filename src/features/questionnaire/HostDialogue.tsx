import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/** Who is talking: a name, a title and a face, so a questionnaire can have a host instead of a form. */
export interface QuestionnaireHost {
  name: string;
  title: string;
  portrait: ReactNode;
}

const CHAR_MS = 24;
const PAUSE_MS: Record<string, number> = { '.': 220, '!': 220, '?': 240, ',': 110, ':': 140 };
// Controls never stay hidden longer than this, however slow the typing.
const SAFETY_MS = 7000;

/**
 * The host's line, typed out a letter at a time like dialogue in a game. Tapping the box finishes the
 * line at once. The whole line is always in the page for screen readers, and for anyone who prefers
 * reduced motion it just appears.
 */
export function HostDialogue({ host, text, accentColor, onDone }: {
  host: QuestionnaireHost;
  text: string;
  accentColor?: string;
  onDone: () => void;
}) {
  const reduce = useReducedMotion() ?? false;
  const [shown, setShown] = useState(reduce ? text.length : 0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const finished = shown >= text.length;

  useEffect(() => {
    if (reduce) { setShown(text.length); return; }
    setShown(0);
    let i = 0;
    let timer: number;
    const tick = () => {
      i += 1;
      setShown(i);
      if (i < text.length) timer = window.setTimeout(tick, PAUSE_MS[text[i - 1]] ?? CHAR_MS);
    };
    timer = window.setTimeout(tick, 350);
    const safety = window.setTimeout(() => setShown(text.length), SAFETY_MS);
    return () => { window.clearTimeout(timer); window.clearTimeout(safety); };
  }, [text, reduce]);

  useEffect(() => { if (finished) doneRef.current(); }, [finished]);

  return (
    <div
      className="mb-8 flex items-start gap-4 text-left cursor-pointer select-none"
      onClick={() => setShown(text.length)}
      data-testid="host-dialogue"
    >
      <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
        <div
          className="h-16 w-16 sm:h-20 sm:w-20 overflow-hidden rounded-2xl border-2 bg-white/5"
          style={{ borderColor: accentColor ? `${accentColor}99` : 'rgba(251,113,133,0.6)' }}
        >
          {host.portrait}
        </div>
        <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white" style={{ background: accentColor ? `${accentColor}cc` : 'rgba(244,63,107,0.85)' }}>
          {host.name}
        </span>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative min-h-[4.5rem] flex-1 rounded-2xl rounded-tl-sm border border-white/12 bg-white/[0.06] px-4 py-3.5 sm:px-5"
      >
        <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40">{host.title}</p>
        <p className="sr-only">{text}</p>
        <p aria-hidden className="mt-1 text-lg sm:text-xl font-semibold leading-snug text-white">
          {text.slice(0, shown)}
          {!finished && <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[3px] animate-pulse bg-white/80" />}
        </p>
        {!finished && <span className="absolute bottom-1.5 right-3 text-[10px] text-white/30">tap to skip</span>}
      </motion.div>
    </div>
  );
}

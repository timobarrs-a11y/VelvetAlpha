import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Gamepad2 } from 'lucide-react';
import { getMySpaces } from '../../services/spacesService';
import type { MySpace } from '../../types/spaces';
import { markHighlightsSeen } from './arrivalUtils';

const QUICK_GAMES = [
  { name: 'Checkers', path: '/checkers' },
  { name: '3-Point Shootout', path: '/shootout' },
  { name: 'Momentum', path: '/momentum' },
];

/**
 * The end of the arrival, on the home screen: Today is already at the top;
 * these two say there are people here and plenty to do in between. Shown once.
 */
export function ArrivalHighlights({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const [spaces, setSpaces] = useState<MySpace[]>([]);

  useEffect(() => {
    getMySpaces().then(setSpaces).catch(() => {});
  }, []);

  const done = () => {
    markHighlightsSeen();
    onDone();
  };

  const go = (path: string) => {
    done();
    navigate(path);
  };

  const card = 'rounded-2xl p-4 text-left';
  const cardStyle = { background: 'var(--ds-surface-1)', border: '1px solid var(--ds-border)' };

  return (
    <section aria-label="What else is here" className="mx-4 mb-2 grid gap-2 sm:grid-cols-2">
      <div className={card} style={cardStyle}>
        <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--ds-ink)' }}>
          <MessageSquare className="h-4 w-4" style={{ color: 'var(--ds-accent-fg)' }} /> There are people here
        </p>
        <p className="mt-1 text-sm" style={{ color: 'var(--ds-ink-2)' }}>
          {spaces.length > 0
            ? `You're already in ${spaces.slice(0, 3).map(s => s.name).join(', ')}${spaces.length > 3 ? ` and ${spaces.length - 3} more` : ''}.`
            : 'Spaces for the things you love, with people who love them too.'}
        </p>
        <button type="button" onClick={() => go('/spaces')} className="mt-3 text-sm font-semibold" style={{ color: 'var(--ds-accent-fg)' }}>
          Say hello
        </button>
      </div>
      <div className={card} style={cardStyle}>
        <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--ds-ink)' }}>
          <Gamepad2 className="h-4 w-4" style={{ color: 'var(--ds-accent-fg)' }} /> Plenty to do in between
        </p>
        <p className="mt-1 text-sm" style={{ color: 'var(--ds-ink-2)' }}>Games for a spare five minutes:</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {QUICK_GAMES.map(g => (
            <button
              key={g.path}
              type="button"
              onClick={() => go(g.path)}
              className="rounded-full px-3 py-1 text-xs font-medium"
              style={{ background: 'var(--ds-pill-bg)', border: '1px solid var(--ds-pill-border)', color: 'var(--ds-ink-2)' }}
            >
              {g.name}
            </button>
          ))}
        </div>
      </div>
      <button type="button" onClick={done} className="justify-self-start text-xs sm:col-span-2" style={{ color: 'var(--ds-ink-3)' }}>
        Got it
      </button>
    </section>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { SOMEONE_NEW_ROUTE } from '../../services/setupProgressService';
import { PeopleSheet } from '../today/PeopleSheet';
import {
  dismissFirstWeek, firstWeekDismissed, getFirstWeekProgress, noteGamePlayed, showFirstWeek,
  type FirstWeekProgress,
} from './firstWeek';

const ITEMS: Array<{ key: keyof FirstWeekProgress; label: string }> = [
  { key: 'friend', label: 'Add a friend in town' },
  { key: 'space', label: 'Say something in a space' },
  { key: 'game', label: 'Play a game' },
  { key: 'companion', label: 'Meet a companion' },
  { key: 'people', label: "Add your people's birthdays" },
];

/**
 * "Your first week" on the home screen, in place of "Finish setting up" once
 * the arrival is done: five optional things to do between goals.
 */
export function FirstWeekCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [progress, setProgress] = useState<FirstWeekProgress | null>(null);
  const [dismissed, setDismissed] = useState(firstWeekDismissed);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const userId = user?.id;
  const createdAt = user?.created_at;

  useEffect(() => {
    if (!userId || dismissed) return;
    getFirstWeekProgress(userId).then(setProgress).catch(() => {});
  }, [userId, dismissed]);

  if (!progress || dismissed || !showFirstWeek(progress, createdAt)) return null;

  const done = ITEMS.filter(i => progress[i.key]).length;

  const open = (key: keyof FirstWeekProgress) => {
    switch (key) {
      case 'friend': navigate('/world'); break;
      case 'space': navigate('/spaces'); break;
      case 'game':
        noteGamePlayed();
        setProgress({ ...progress, game: true });
        navigate('/checkers');
        break;
      case 'companion': navigate(SOMEONE_NEW_ROUTE); break;
      case 'people': setPeopleOpen(true); break;
    }
  };

  return (
    <section
      aria-label="Your first week"
      className="mx-4 mb-2 rounded-2xl p-4"
      style={{ background: 'var(--ds-surface-1)', border: '1px solid var(--ds-border)' }}
    >
      <header className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold" style={{ color: 'var(--ds-ink)' }}>Your first week</h2>
          <p className="text-xs" style={{ color: 'var(--ds-ink-3)' }}>Things to do between goals · {done} of {ITEMS.length}</p>
        </div>
        <button
          type="button"
          onClick={() => { dismissFirstWeek(); setDismissed(true); }}
          aria-label="Hide your first week"
          className="rounded-md p-1 hover:bg-white/5"
          style={{ color: 'var(--ds-ink-3)' }}
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      <ul className="mt-3 grid gap-1.5">
        {ITEMS.map(item => {
          const isDone = progress[item.key];
          return (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => open(item.key)}
                disabled={isDone}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-white/[0.03] disabled:cursor-default"
              >
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2"
                  style={{ borderColor: isDone ? 'var(--ds-success)' : 'var(--ds-ink-4)', background: isDone ? 'var(--ds-success)' : 'transparent' }}
                >
                  {isDone && <Check className="h-3 w-3 text-white" />}
                </span>
                <span className={`text-sm ${isDone ? 'line-through' : ''}`} style={{ color: isDone ? 'var(--ds-ink-4)' : 'var(--ds-ink)' }}>
                  {item.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <PeopleSheet
        isOpen={peopleOpen}
        onClose={() => setPeopleOpen(false)}
        onSaved={() => setProgress(p => (p ? { ...p, people: true } : p))}
      />
    </section>
  );
}

import { useEffect, useState } from 'react';
import { ModalShell, Button, Input, Pill } from '../../shared/ui';
import { toast } from '../../shared/ui/Toast';
import { calendarService, type UserEvent } from '../../services/calendarService';
import { createUserGoal } from '../../services/coachingService';
import { localDateKey } from '../../services/calendarRecurrence';

type Kind = 'task' | 'appointment' | 'reminder' | 'birthday' | 'goal';
type When = 'today' | 'tomorrow' | 'date' | 'none';

const KINDS: { value: Kind; label: string }[] = [
  { value: 'task', label: 'Task' },
  { value: 'appointment', label: 'Appointment' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'birthday', label: 'Birthday' },
  { value: 'goal', label: 'Goal' },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Birthdays go to the people form, with whatever name was typed. */
  onBirthday: (name: string) => void;
  userId: string;
}

/** The local day picked, as YYYY-MM-DD. */
function pickedDay(when: When, date: string): string | null {
  const d = new Date();
  if (when === 'today') return localDateKey(d);
  if (when === 'tomorrow') return localDateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
  if (when === 'date') return date || null;
  return null;
}

/** Local date and optional time as an ISO timestamp (local midnight when there's no time). */
function toIso(day: string, time: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const [h, min] = time ? time.split(':').map(Number) : [0, 0];
  return new Date(y, m - 1, d, h, min).toISOString();
}

/**
 * Quick add from Today: a doctor's appointment, a task, a reminder, a goal of
 * their own. A few taps and it's in Today and on the calendar.
 */
export function QuickAddSheet({ isOpen, onClose, onSaved, onBirthday, userId }: Props) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<Kind>('task');
  const [when, setWhen] = useState<When>('today');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setTitle('');
    setKind('task');
    setWhen('today');
    setDate('');
    setTime('');
  }, [isOpen]);

  const day = pickedDay(when, date);
  const canSave = title.trim().length > 0 && (kind === 'goal' || day !== null);

  const chooseKind = (k: Kind) => {
    if (k === 'birthday') {
      onBirthday(title.trim());
      return;
    }
    setKind(k);
    // A goal can have no date; everything else needs a day.
    if (k === 'goal' && when !== 'date') setWhen('none');
    if (k !== 'goal' && when === 'none') setWhen('today');
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const name = title.trim();
    let ok = false;
    if (kind === 'goal') {
      const goal = await createUserGoal(userId, name, day);
      ok = goal !== null;
      if (goal && day) {
        await calendarService.createEvent({
          user_id: userId,
          title: name,
          description: '',
          event_type: 'goal_deadline',
          event_date: toIso(day, ''),
          all_day: true,
          recurring: 'none',
          completed: false,
          metadata: { source: 'user', goal: name, goal_id: goal.id },
        });
      }
    } else if (day) {
      const created = await calendarService.createEvent({
        user_id: userId,
        title: name,
        description: '',
        event_type: kind as UserEvent['event_type'],
        event_date: toIso(day, time),
        all_day: !time,
        recurring: 'none',
        completed: false,
        metadata: { source: 'user' },
      });
      ok = created !== null;
    }
    setSaving(false);
    if (!ok) {
      toast.error("Couldn't add that. Please try again.");
      return;
    }
    onSaved();
    onClose();
  };

  const whenOptions: { value: When; label: string }[] = kind === 'goal'
    ? [{ value: 'none', label: 'No date' }, { value: 'date', label: 'Pick a date' }]
    : [{ value: 'today', label: 'Today' }, { value: 'tomorrow', label: 'Tomorrow' }, { value: 'date', label: 'Pick a date' }];

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Add to your days"
      size="sm"
      footer={(
        <div className="flex justify-end">
          <Button size="sm" disabled={!canSave || saving} onClick={save}>{saving ? 'Adding…' : 'Add'}</Button>
        </div>
      )}
    >
      <div className="space-y-4">
        <Input
          label="What is it?"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && save()}
          placeholder={kind === 'goal' ? 'e.g. Finish my portfolio' : 'e.g. Doctor appointment'}
          autoFocus
        />

        <div>
          <span className="label-base">Kind</span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {KINDS.map(k => (
              <Pill key={k.value} size="sm" active={kind === k.value} onClick={() => chooseKind(k.value)}>{k.label}</Pill>
            ))}
          </div>
        </div>

        <div>
          <span className="label-base">{kind === 'goal' ? 'By when' : 'When'}</span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {whenOptions.map(w => (
              <Pill key={w.value} size="sm" active={when === w.value} onClick={() => setWhen(w.value)}>{w.label}</Pill>
            ))}
          </div>
          {when === 'date' && (
            <input
              type="date"
              aria-label="Date"
              className="input-base mt-2"
              value={date}
              min={localDateKey(new Date())}
              onChange={e => setDate(e.target.value)}
            />
          )}
        </div>

        {kind !== 'goal' && (
          <div>
            <span className="label-base">Time (optional)</span>
            <input type="time" aria-label="Time" className="input-base mt-1.5" value={time} onChange={e => setTime(e.target.value)} />
          </div>
        )}
      </div>
    </ModalShell>
  );
}

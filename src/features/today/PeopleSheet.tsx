import { useEffect, useState } from 'react';
import { ModalShell, Button, Input, Pill } from '../../shared/ui';
import { toast } from '../../shared/ui/Toast';
import { realPeopleService } from '../../services/realPeopleService';
import { UNKNOWN_BIRTH_YEAR, dateOnly } from './birthdays';

const RELATIONSHIPS: { label: string; value: string }[] = [
  { label: 'Best friend', value: 'best friend' },
  { label: 'Family', value: 'family' },
  { label: 'Partner', value: 'partner' },
  { label: 'Friend', value: 'friend' },
  { label: 'Colleague', value: 'coworker' },
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const selectClass = 'input-base';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Called after each person is saved. */
  onSaved: () => void;
  initialName?: string;
}

/**
 * Birthdays of the people who matter, as fast as possible: a name, who they
 * are, month and day, and the year only if they know it. "Add another" keeps
 * the sheet open, so five people take under a minute.
 */
export function PeopleSheet({ isOpen, onClose, onSaved, initialName = '' }: Props) {
  const [name, setName] = useState(initialName);
  const [relationship, setRelationship] = useState('best friend');
  const [month, setMonth] = useState<number | ''>('');
  const [day, setDay] = useState<number | ''>('');
  const [year, setYear] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState<string[]>([]);

  const thisYear = new Date().getFullYear();
  // Without a year, check the day against a leap year so 29 February is allowed.
  const daysInMonth = month === '' ? 31 : new Date(year === '' ? UNKNOWN_BIRTH_YEAR : year, month + 1, 0).getDate();
  const canSave = name.trim().length > 0 && month !== '' && day !== '' && day <= daysInMonth;

  // Each time it opens, start from the name it was opened with.
  useEffect(() => {
    if (isOpen) setName(initialName);
  }, [isOpen, initialName]);

  // A shorter month clears a day it doesn't have.
  useEffect(() => {
    if (day !== '' && day > daysInMonth) setDay('');
  }, [day, daysInMonth]);

  const reset = () => {
    setName('');
    setMonth('');
    setDay('');
    setYear('');
  };

  const save = async (andAnother: boolean) => {
    if (!canSave) return;
    setSaving(true);
    try {
      const yearKnown = year !== '';
      await realPeopleService.create(name.trim(), relationship, {
        date: dateOnly(yearKnown ? year : UNKNOWN_BIRTH_YEAR, month, day),
        yearKnown,
      });
      setAdded(prev => [...prev, name.trim()]);
      onSaved();
      reset();
      if (!andAnother) onClose();
    } catch {
      toast.error("Couldn't save that birthday. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const close = () => {
    reset();
    setAdded([]);
    onClose();
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={close}
      title="Birthdays that matter"
      size="sm"
      footer={(
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" size="sm" disabled={!canSave || saving} onClick={() => save(true)}>Add another</Button>
          <Button size="sm" disabled={!canSave || saving} onClick={() => save(false)}>Save</Button>
        </div>
      )}
    >
      <div className="space-y-4">
        <p className="text-sm" style={{ color: 'var(--ds-ink-3)' }}>
          We'll show them in Today a week ahead, and on the day.
        </p>

        {added.length > 0 && (
          <p className="text-xs" style={{ color: 'var(--ds-success)' }}>Added: {added.join(', ')}</p>
        )}

        <Input label="Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Queen" autoFocus />

        <div>
          <span className="label-base">Who they are</span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {RELATIONSHIPS.map(r => (
              <Pill key={r.value} size="sm" active={relationship === r.value} onClick={() => setRelationship(r.value)}>
                {r.label}
              </Pill>
            ))}
          </div>
        </div>

        <div>
          <span className="label-base">Birthday</span>
          <div className="mt-1.5 grid grid-cols-[1.4fr_0.8fr_1fr] gap-2">
            <select aria-label="Month" className={selectClass} value={month} onChange={e => setMonth(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">Month</option>
              {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <select aria-label="Day" className={selectClass} value={day} onChange={e => setDay(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">Day</option>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select aria-label="Year (optional)" className={selectClass} value={year} onChange={e => setYear(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">Year?</option>
              {Array.from({ length: thisYear - 1899 }, (_, i) => thisYear - i).map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <p className="mt-1.5 text-xs" style={{ color: 'var(--ds-ink-4)' }}>
            Add the year and we'll show which birthday it is.
          </p>
        </div>
      </div>
    </ModalShell>
  );
}

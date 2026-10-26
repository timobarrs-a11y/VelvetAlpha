import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight, CalendarDays, Sparkles, Plus, Cake, X, Target, BookOpen } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { calendarService } from '../../services/calendarService';
import {
  getGoals, getNextOpenCommitment, getTodayCommitments, updateCommitmentStatus,
} from '../../services/coachingService';
import { realPeopleService, type RealPerson } from '../../services/realPeopleService';
import { toast } from '../../shared/ui/Toast';
import { supabase } from '../../shared/supabase/client';
import { PAID_TIERS, type SubscriptionTier } from '../../types/subscription';
import { birthdaysBetween, birthdayTitle, type BirthdayOccurrence } from './birthdays';
import { QuickAddSheet } from './QuickAddSheet';
import { PeopleSheet } from './PeopleSheet';
import {
  buildTodayItems, endOfDay, nextLabel, startOfDay, todayHeading, type TodayItem,
} from './todayItems';

const MAX_ROWS = 5;
const PEOPLE_PROMPT_KEY = 'velvet.today.peoplePromptDismissed';
// After the first thing they tick off, once, a word about Velvet Plus for anyone not on it.
const FIRST_DONE_KEY = 'velvet.today.firstDoneNoted';

function readDismissed(): boolean {
  try { return localStorage.getItem(PEOPLE_PROMPT_KEY) === '1'; } catch { return false; }
}

interface NextUp {
  title: string;
  when: Date;
}

/**
 * Today, at the top of the home screen: what the user is working on today,
 * from their calendar and their commitments, without opening either.
 */
export function TodayCard() {
  const userId = useAuth().user?.id;
  const navigate = useNavigate();
  const [items, setItems] = useState<TodayItem[] | null>(null);
  const [next, setNext] = useState<NextUp | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [people, setPeople] = useState<RealPerson[] | null>(null);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [peopleName, setPeopleName] = useState('');
  const [promptDismissed, setPromptDismissed] = useState(readDismissed);
  const [plusNote, setPlusNote] = useState(false);

  // What's coming next, shown once nothing is left today.
  const loadNext = useCallback(async () => {
    if (!userId) return;
    const end = endOfDay(new Date());
    const [upcoming, nextCommitment] = await Promise.all([
      calendarService.getUpcomingEvents(userId, 14),
      getNextOpenCommitment(userId, end),
    ]);
    const nextEvent = upcoming.find(e => !e.completed && new Date(e.event_date) > end);
    const candidates: NextUp[] = [];
    if (nextEvent) candidates.push({ title: nextEvent.title, when: new Date(nextEvent.event_date) });
    if (nextCommitment?.due_date) candidates.push({ title: nextCommitment.description, when: new Date(nextCommitment.due_date) });
    candidates.sort((a, b) => a.when.getTime() - b.when.getTime());
    setNext(candidates[0] ?? null);
  }, [userId]);

  const load = useCallback(async () => {
    if (!userId) return;
    const now = new Date();
    const start = startOfDay(now);
    const end = endOfDay(now);
    const [events, commitments] = await Promise.all([
      calendarService.getUserEvents(userId, start, end),
      getTodayCommitments(userId, start, end),
    ]);

    const goalTitles = new Map<string, string>();
    if (commitments.some(c => c.goal_id)) {
      for (const g of await getGoals(userId)) goalTitles.set(g.id, g.title);
    }
    const today = buildTodayItems(events, commitments, goalTitles, now);
    setItems(today);
    if (today.every(i => i.done)) await loadNext();
  }, [userId, loadNext]);

  const loadPeople = useCallback(async () => {
    setPeople(await realPeopleService.getAll().catch(() => []));
  }, []);

  useEffect(() => {
    load().catch(() => setItems([]));
  }, [load]);

  useEffect(() => {
    if (userId) loadPeople();
  }, [userId, loadPeople]);

  const openPeople = (name = '') => {
    setPeopleName(name);
    setQuickAddOpen(false);
    setPeopleOpen(true);
  };

  const dismissPrompt = () => {
    setPromptDismissed(true);
    try { localStorage.setItem(PEOPLE_PROMPT_KEY, '1'); } catch { /* storage blocked */ }
  };

  const replace = (key: string, patch: Partial<TodayItem>) =>
    setItems(prev => prev?.map(i => (i.key === key ? { ...i, ...patch } : i)) ?? prev);

  const toggleDone = async (item: TodayItem) => {
    const done = !item.done;
    replace(item.key, { done });
    let ok = true;
    if (item.event) {
      ok = (await calendarService.setCompleted(item.event, done)) !== null;
    } else if (item.commitment) {
      await updateCommitmentStatus(item.commitment.id, done ? 'completed' : 'pending');
    }
    if (!ok) {
      replace(item.key, { done: !done });
      toast.error("Couldn't save that. Please try again.");
      return;
    }
    if (done && items?.every(i => i.key === item.key || i.done)) loadNext().catch(() => {});
    if (done) noteFirstDone().catch(() => {});
  };

  /** Value first, then the offer: once, after their first completed step, if they're not a member. */
  const noteFirstDone = async () => {
    try {
      if (localStorage.getItem(FIRST_DONE_KEY) === '1') return;
      localStorage.setItem(FIRST_DONE_KEY, '1');
    } catch {
      return;
    }
    if (!userId) return;
    const { data } = await supabase.from('user_profiles').select('subscription_tier').eq('id', userId).maybeSingle();
    if (!PAID_TIERS.includes(data?.subscription_tier as SubscriptionTier)) setPlusNote(true);
  };

  const confirmTentative = async (item: TodayItem) => {
    if (!item.event) return;
    setBusyKey(item.key);
    const saved = await calendarService.updateEvent(item.event.id, {
      metadata: { ...item.event.metadata, tentative: false },
    });
    setBusyKey(null);
    if (saved) replace(item.key, { tentative: false });
    else toast.error("Couldn't confirm that. Please try again.");
  };

  const dropTentative = async (item: TodayItem) => {
    if (!item.event) return;
    setBusyKey(item.key);
    const ok = await calendarService.deleteEvent(item.event.id);
    setBusyKey(null);
    if (ok) setItems(prev => prev?.filter(i => i.key !== item.key) ?? prev);
    else toast.error("Couldn't drop that. Please try again.");
  };

  const openItem = (item: TodayItem) =>
    navigate(item.kind === 'commitment' ? '/coaching-commitments' : '/calendar');

  const now = new Date();
  // Birthdays: today's lead the card; the next week's go in one "Coming up" line.
  const todayBirthdays: BirthdayOccurrence[] = people ? birthdaysBetween(people, startOfDay(now), endOfDay(now)) : [];
  const weekAhead: BirthdayOccurrence[] = people
    ? birthdaysBetween(people, new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1), endOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7)))
    : [];
  const showPeoplePrompt = people !== null && !promptDismissed && !people.some(p => p.birthday);
  const doneCount = items?.filter(i => i.done).length ?? 0;
  const shown = items?.slice(0, MAX_ROWS) ?? [];
  const more = (items?.length ?? 0) - shown.length;

  return (
    <section
      aria-label="Today"
      className="mx-4 mt-3 mb-2 rounded-2xl"
      // Tinted with the accent so Today stands apart from the feed below it.
      style={{
        background: 'linear-gradient(180deg, color-mix(in srgb, var(--ds-accent) 16%, var(--ds-surface-2)), color-mix(in srgb, var(--ds-accent) 7%, var(--ds-surface-1)))',
        border: '1px solid color-mix(in srgb, var(--ds-accent) 38%, transparent)',
        boxShadow: '0 6px 24px color-mix(in srgb, var(--ds-accent) 14%, transparent)',
      }}
    >
      <header className="flex items-center gap-3 px-4 pt-3.5 pb-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold" style={{ color: 'var(--ds-ink)' }}>Today</h2>
          <p className="text-xs" style={{ color: 'var(--ds-ink-3)' }}>
            {todayHeading(now)}
            {items && items.length > 0 && ` · ${doneCount} of ${items.length} done`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setQuickAddOpen(true)}
          aria-label="Add something to your days"
          className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-white/5"
          style={{ color: 'var(--ds-ink-2)' }}
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => navigate('/calendar')}
          className="flex items-center gap-1 text-xs font-medium rounded-lg px-2 py-1 transition-colors hover:bg-white/5"
          style={{ color: 'var(--ds-ink-2)' }}
        >
          See all <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </header>

      {items === null ? (
        <div className="px-4 pb-4 space-y-2" aria-hidden>
          <div className="h-10 rounded-xl bg-white/5 animate-pulse" />
          <div className="h-10 rounded-xl bg-white/5 animate-pulse" />
        </div>
      ) : (
        <>
          {todayBirthdays.length > 0 && (
            <ul className="px-2 pb-1">
              {todayBirthdays.map(b => (
                <li key={b.person.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/person/${b.person.id}`)}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/[0.03] transition-colors"
                  >
                    <Cake className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--ds-accent-fg)' }} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium truncate" style={{ color: 'var(--ds-ink)' }}>
                        {birthdayTitle(b.person.name, b.age)}
                      </span>
                      <span className="block text-xs" style={{ color: 'var(--ds-ink-3)' }}>Today</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {shown.length > 0 && (
            <ul className="px-2 pb-1">
              {shown.map(item => (
                <li key={item.key}>
                  <div className="flex items-start gap-3 rounded-xl px-2 py-2 hover:bg-white/[0.03] transition-colors">
                    <button
                      type="button"
                      onClick={() => toggleDone(item)}
                      aria-label={item.done ? `Mark "${item.title}" not done` : `Mark "${item.title}" done`}
                      className="mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors"
                      style={{
                        borderColor: item.done ? 'var(--ds-success)' : 'var(--ds-ink-4)',
                        background: item.done ? 'var(--ds-success)' : 'transparent',
                      }}
                    >
                      {item.done && <Check className="w-3 h-3 text-white" />}
                    </button>

                    <button type="button" onClick={() => openItem(item)} className="min-w-0 flex-1 text-left">
                      <span
                        className={`block text-sm font-medium truncate ${item.done ? 'line-through' : ''}`}
                        style={{ color: item.done ? 'var(--ds-ink-4)' : 'var(--ds-ink)' }}
                      >
                        {item.icon === 'goal' && <Target className="mr-1.5 inline h-3.5 w-3.5 align-[-2px]" aria-label="Goal step" style={{ color: 'var(--ds-accent-fg)' }} />}
                        {item.icon === 'lesson' && <BookOpen className="mr-1.5 inline h-3.5 w-3.5 align-[-2px]" aria-label="Lesson" style={{ color: 'var(--ds-accent-fg)' }} />}
                        {item.title}
                      </span>
                      <span className="block text-xs truncate" style={{ color: 'var(--ds-ink-3)' }}>
                        <span style={item.overdue && !item.done ? { color: 'var(--ds-warning)' } : undefined}>
                          {item.timeLabel}
                        </span>
                        {item.by && ` · ${item.by}`}
                        {item.goal && ` · ${item.goal}`}
                      </span>
                    </button>
                  </div>

                  {item.tentative && !item.done && (
                    <div className="flex flex-wrap items-center gap-2 pl-10 pr-2 pb-2 -mt-1">
                      <span className="text-[11px]" style={{ color: 'var(--ds-ink-3)' }}>Pencilled in</span>
                      <TentativeButton disabled={busyKey === item.key} onClick={() => confirmTentative(item)}>Confirm</TentativeButton>
                      <TentativeButton disabled={busyKey === item.key} onClick={() => navigate('/calendar')}>Move</TentativeButton>
                      <TentativeButton disabled={busyKey === item.key} onClick={() => dropTentative(item)}>Drop</TentativeButton>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {more > 0 && (
            <button
              type="button"
              onClick={() => navigate('/calendar')}
              className="block w-full px-4 pb-3 text-left text-xs font-medium"
              style={{ color: 'var(--ds-ink-2)' }}
            >
              +{more} more
            </button>
          )}

          {weekAhead.length > 0 && (
            <button
              type="button"
              onClick={() => navigate(`/person/${weekAhead[0].person.id}`)}
              className="flex w-full items-center gap-2.5 px-4 pb-3 pt-1 text-left"
            >
              <Cake className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--ds-ink-3)' }} />
              <span className="min-w-0 flex-1 truncate text-sm" style={{ color: 'var(--ds-ink-2)' }}>
                <span style={{ color: 'var(--ds-ink-3)' }}>Coming up: </span>
                {birthdayTitle(weekAhead[0].person.name, weekAhead[0].age)}, {nextLabel(weekAhead[0].date, now)}
                {weekAhead.length > 1 && <span style={{ color: 'var(--ds-ink-3)' }}> and {weekAhead.length - 1} more</span>}
              </span>
            </button>
          )}

          {plusNote && (
            <div className="mx-3 mb-3 flex items-center gap-2.5 rounded-xl px-3 py-2.5" style={{ background: 'var(--ds-surface-2)' }}>
              <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--ds-accent-fg)' }} />
              <button type="button" onClick={() => navigate('/pricing')} className="min-w-0 flex-1 text-left text-sm" style={{ color: 'var(--ds-ink)' }}>
                Nicely done. With Velvet Plus, your team checks in between conversations. <span style={{ color: 'var(--ds-accent-fg)' }}>See plans</span>
              </button>
              <button type="button" onClick={() => setPlusNote(false)} aria-label="Dismiss" className="p-1 rounded-md hover:bg-white/5" style={{ color: 'var(--ds-ink-3)' }}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {showPeoplePrompt && (
            <div className="mx-3 mb-3 flex items-center gap-2.5 rounded-xl px-3 py-2.5" style={{ background: 'var(--ds-accent-soft)' }}>
              <Cake className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--ds-accent-fg)' }} />
              <button type="button" onClick={() => openPeople()} className="min-w-0 flex-1 text-left text-sm" style={{ color: 'var(--ds-ink)' }}>
                Never miss the birthdays that matter. <span style={{ color: 'var(--ds-accent-fg)' }}>Add your people</span>
              </button>
              <button type="button" onClick={dismissPrompt} aria-label="Not now" className="p-1 rounded-md hover:bg-white/5" style={{ color: 'var(--ds-ink-3)' }}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {items.every(i => i.done) && todayBirthdays.length === 0 && (
            next ? (
              <button
                type="button"
                onClick={() => navigate('/calendar')}
                className="flex w-full items-center gap-2.5 px-4 pb-3.5 pt-1 text-left"
              >
                <CalendarDays className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--ds-ink-3)' }} />
                <span className="min-w-0 flex-1 truncate text-sm" style={{ color: 'var(--ds-ink-2)' }}>
                  <span style={{ color: 'var(--ds-ink-3)' }}>Next: {nextLabel(next.when, now)} · </span>
                  {next.title}
                </span>
              </button>
            ) : items.length === 0 && (
              <button
                type="button"
                onClick={() => navigate('/atlas')}
                className="flex w-full items-center gap-2.5 px-4 pb-3.5 pt-1 text-left"
              >
                <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--ds-accent-fg)' }} />
                <span className="text-sm" style={{ color: 'var(--ds-ink-2)' }}>
                  Nothing planned yet. <span style={{ color: 'var(--ds-accent-fg)' }}>Plan something with Atlas</span>
                </span>
              </button>
            )
          )}
        </>
      )}

      {userId && (
        <QuickAddSheet
          isOpen={quickAddOpen}
          onClose={() => setQuickAddOpen(false)}
          onSaved={() => { load().catch(() => {}); }}
          onBirthday={openPeople}
          userId={userId}
        />
      )}
      <PeopleSheet
        isOpen={peopleOpen}
        onClose={() => setPeopleOpen(false)}
        onSaved={loadPeople}
        initialName={peopleName}
      />
    </section>
  );
}

function TentativeButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-50"
      style={{ background: 'var(--ds-pill-bg)', border: '1px solid var(--ds-pill-border)', color: 'var(--ds-ink-2)' }}
    >
      {children}
    </button>
  );
}

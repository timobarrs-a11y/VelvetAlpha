import { describe, it, expect } from 'vitest';
import { buildTodayItems, nextLabel, todayHeading } from '../todayItems';
import type { UserEvent } from '../../../services/calendarService';
import type { CoachingCommitment } from '../../../services/coachingService';

const now = new Date(2026, 9, 26, 10, 0); // Monday, October 26, 10am

function event(overrides: Partial<UserEvent>): UserEvent {
  return {
    id: 'e1', user_id: 'u1', companion_id: null, title: 'Event', description: '',
    event_type: 'task', event_date: new Date(2026, 9, 26, 9, 0).toISOString(),
    reminder_time: null, all_day: false, location: null, completed: false,
    recurring: 'none', metadata: {}, created_at: '', updated_at: '',
    ...overrides,
  };
}

function commitment(overrides: Partial<CoachingCommitment>): CoachingCommitment {
  return {
    id: 'c1', companion_id: 'coach1', goal_id: null, description: 'Commitment',
    due_date: new Date(2026, 9, 26, 23, 59).toISOString(), status: 'pending',
    completed_at: null, created_at: '', companion_name: 'Maya',
    ...overrides,
  };
}

describe('buildTodayItems', () => {
  it('lists overdue commitments first, then the day in time order, with done items last', () => {
    const items = buildTodayItems(
      [
        event({ id: 'late', title: 'Dentist', event_date: new Date(2026, 9, 26, 15, 0).toISOString() }),
        event({ id: 'allday', title: 'Bin day', all_day: true, event_date: new Date(2026, 9, 26).toISOString() }),
        event({ id: 'done', title: 'Run', completed: true, event_date: new Date(2026, 9, 26, 7, 0).toISOString() }),
      ],
      [commitment({ id: 'old', description: 'Send the draft', due_date: new Date(2026, 9, 24, 18, 0).toISOString() })],
      new Map(),
      now,
    );
    expect(items.map(i => i.title)).toEqual(['Send the draft', 'Bin day', 'Dentist', 'Run']);
    expect(items[0]).toMatchObject({ overdue: true, timeLabel: 'Overdue' });
    expect(items[1].timeLabel).toBe('All day');
  });

  it('says who set it up: Atlas, a coach, or nobody for their own', () => {
    const items = buildTodayItems(
      [
        event({ id: 'a', title: 'From Atlas', metadata: { source: 'atlas', goal: 'See a game live' } }),
        event({ id: 'b', title: 'Their own', event_date: new Date(2026, 9, 26, 11, 0).toISOString() }),
      ],
      [
        commitment({ id: 'c', description: 'From Maya' }),
        commitment({ id: 'd', description: 'Self-made', companion_id: null, companion_name: 'You' }),
      ],
      new Map(),
      now,
    );
    const by = Object.fromEntries(items.map(i => [i.title, i.by]));
    expect(by).toEqual({ 'From Atlas': 'Atlas', 'Their own': null, 'From Maya': 'Maya', 'Self-made': null });
    expect(items.find(i => i.title === 'From Atlas')?.goal).toBe('See a game live');
  });

  it("names the commitment's goal and marks it due today", () => {
    const [item] = buildTodayItems([], [commitment({ goal_id: 'g1' })], new Map([['g1', 'Buy a home']]), now);
    expect(item).toMatchObject({ goal: 'Buy a home', timeLabel: 'Due today', overdue: false, done: false });
  });

  it('counts a commitment ticked off today as done', () => {
    const [item] = buildTodayItems([], [commitment({ status: 'completed' })], new Map(), now);
    expect(item.done).toBe(true);
  });

  it('flags pencilled-in plans from Atlas', () => {
    const [item] = buildTodayItems([event({ metadata: { source: 'atlas', tentative: true } })], [], new Map(), now);
    expect(item.tentative).toBe(true);
  });

  it('keeps each occurrence of a repeating event separate', () => {
    const items = buildTodayItems(
      [event({ occurrence_date: '2026-10-26' }), event({ occurrence_date: '2026-10-27' })],
      [], new Map(), now,
    );
    expect(new Set(items.map(i => i.key)).size).toBe(2);
  });
});

describe('labels', () => {
  it('heads the card with the full date', () => {
    expect(todayHeading(now)).toBe('Monday, October 26');
  });

  it('says tomorrow, a weekday this week, or a short date further out', () => {
    expect(nextLabel(new Date(2026, 9, 27, 9, 0), now)).toBe('Tomorrow');
    expect(nextLabel(new Date(2026, 9, 31, 9, 0), now)).toBe('Saturday');
    expect(nextLabel(new Date(2026, 10, 7, 9, 0), now)).toBe('Sat, Nov 7');
  });
});

describe('Today icons', () => {
  it("marks a coach's commitment as a lesson, an assistant's as a goal step, and plain events with none", () => {
    const items = buildTodayItems(
      [event({ id: 'e1' })],
      [
        commitment({ id: 'c1', description: 'Spanish lesson', companion_relationship_type: 'mentor' }),
        commitment({ id: 'c2', description: 'Check your credit score', companion_relationship_type: 'assistant' }),
      ],
      new Map(),
      now,
    );
    const icon = (title: string) => items.find(i => i.title === title)?.icon;
    expect(icon('Spanish lesson')).toBe('lesson');
    expect(icon('Check your credit score')).toBe('goal');
    expect(icon('Event')).toBeNull();
  });
});

describe('helperRole', () => {
  it('names coaches and assistants, and nobody else', async () => {
    const { helperRole } = await import('../../../utils/relationshipType');
    expect(helperRole('mentor')).toBe('Coach');
    expect(helperRole('assistant')).toBe('Assistant');
    expect(helperRole('friend')).toBeNull();
  });
});

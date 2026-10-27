import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { handPicked, seededAvatar } from '../arrivalUtils';
import { showFirstWeek } from '../firstWeek';
import { prepareResume } from '../../../services/setupProgressService';
import { ArrivalTownTour } from '../ArrivalTownTour';

vi.mock('../../../shared/supabase/client', () => ({ supabase: {} }));

describe('handPicked', () => {
  it('lists what they changed by hand since their starting look, most distinctive first', () => {
    const baseline = { glasses: 'none', headwear: 'none', hairStyle: 'bob', outfit: 'tee' };
    const current = { glasses: 'round', headwear: 'none', hairStyle: 'pixie', outfit: 'tee' };
    expect(handPicked(baseline, current)).toEqual([
      { field: 'glasses', value: 'round' },
      { field: 'hairStyle', value: 'pixie' },
    ]);
  });

  it('notes nothing for an untouched randomize, or for choosing none', () => {
    const look = { glasses: 'square', tattoo: 'neck' };
    expect(handPicked(look, { ...look })).toEqual([]);
    expect(handPicked(look, { glasses: 'none', tattoo: 'neck' })).toEqual([]);
  });
});

describe('seededAvatar', () => {
  const defaults = { male: { gender: 'male', hairStyle: 'short' }, female: { gender: 'female', hairStyle: 'bob' } };

  it('starts from their gender, in their favorite color', () => {
    expect(seededAvatar(defaults, 'Male', 'Teal')).toMatchObject({ gender: 'male', outfitColor: expect.stringMatching(/^#/) });
    expect(seededAvatar(defaults, 'Female', null)).toEqual({ gender: 'female', hairStyle: 'bob' });
  });
});

describe('showFirstWeek', () => {
  const none = { friend: false, space: false, game: false, companion: false, people: false };
  const now = new Date('2026-10-26T12:00:00Z');

  it('shows during the first seven days', () => {
    expect(showFirstWeek(none, '2026-10-22T12:00:00Z', now)).toBe(true);
    expect(showFirstWeek(none, '2026-10-18T12:00:00Z', now)).toBe(false);
  });

  it('goes once all five are done', () => {
    const all = { friend: true, space: true, game: true, companion: true, people: true };
    expect(showFirstWeek(all, '2026-10-25T12:00:00Z', now)).toBe(false);
  });
});

describe('resuming the arrival from the lobby', () => {
  it('brings them back to the step they left', () => {
    expect(prepareResume({ step: 'arrival_look', path: null }, [])).toBe('/arrival/look');
    expect(prepareResume({ step: 'arrival_home', path: null }, [])).toBe('/arrival/home');
    expect(prepareResume({ step: 'arrival_town', path: null }, [])).toBe('/world?arrival=1');
    expect(prepareResume({ step: 'arrival_atlas', path: null }, [])).toBe('/atlas-onboarding');
    expect(prepareResume({ step: 'complete', path: null }, [])).toBeNull();
  });
});

describe('ArrivalTownTour', () => {
  it('walks through three captions, with Continue to Atlas always there', () => {
    const onContinue = vi.fn();
    render(<ArrivalTownTour onContinue={onContinue} />);
    expect(screen.getByText('This is your block.')).toBeTruthy();
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Tap any billboard')).toBeTruthy();
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Change anything, any time.')).toBeTruthy();
    expect(screen.queryByText('Next')).toBeNull();
    fireEvent.click(screen.getByText('Continue to Atlas'));
    expect(onContinue).toHaveBeenCalled();
  });
});

beforeEach(() => {
  localStorage.clear();
});

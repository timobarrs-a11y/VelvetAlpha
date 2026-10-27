import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { WelcomeMoment } from '../WelcomeMoment';
import { rememberWelcomeSeen, shouldShowWelcome } from '../welcome';

describe('shouldShowWelcome', () => {
  beforeEach(() => window.localStorage.clear());

  it('shows to someone starting the first question who has not seen it', () => {
    expect(shouldShowWelcome({ id: 'u1', welcome_seen: false }, 0)).toBe(true);
    expect(shouldShowWelcome({ id: 'u1' }, 0)).toBe(true);
  });

  it('never shows to someone resuming partway', () => {
    expect(shouldShowWelcome({ id: 'u1', welcome_seen: false }, 2)).toBe(false);
  });

  it('shows once: the profile flag or this device remembers it', () => {
    expect(shouldShowWelcome({ id: 'u1', welcome_seen: true }, 0)).toBe(false);
    rememberWelcomeSeen('u1');
    expect(shouldShowWelcome({ id: 'u1', welcome_seen: false }, 0)).toBe(false);
    expect(shouldShowWelcome({ id: 'someone-else' }, 0)).toBe(true);
  });
});

describe('WelcomeMoment', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('says you are in, in the brand, and what comes next', () => {
    render(<WelcomeMoment onDone={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'Welcome to Project Velvet' })).toBeTruthy();
    expect(screen.getByText("You're moved in!")).toBeTruthy();
    expect(screen.getByText(/Project/)).toBeTruthy();
    expect(screen.getByText(/set up your profile/)).toBeTruthy();
  });

  it('closes when tapped', () => {
    const onDone = vi.fn();
    render(<WelcomeMoment onDone={onDone} />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('never closes by itself: it waits until they click it', () => {
    const onDone = vi.fn();
    render(<WelcomeMoment onDone={onDone} />);
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(onDone).not.toHaveBeenCalled();
  });

  it('has a Let\'s go button, and Enter works too', () => {
    const onDone = vi.fn();
    render(<WelcomeMoment onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: "Let's go" }));
    expect(onDone).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onDone).toHaveBeenCalledTimes(2);
  });
});

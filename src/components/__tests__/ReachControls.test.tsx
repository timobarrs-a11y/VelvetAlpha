import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReachControls, type ReachValues } from '../ReachControls';

const base: ReachValues = { share_accomplishments: true, profile_mode: 'friends', who_can_message: 'everyone', accepts_friend_requests: true, accepts_mail: true, comments_from: 'everyone' };

describe('ReachControls', () => {
  it('says everyone can see you and friends are how people get in', () => {
    render(<ReachControls values={base} onChange={() => {}} />);
    expect(screen.getByText(/Everyone can see that you are here/)).toBeTruthy();
    expect(screen.getByText(/how someone gets into your world/)).toBeTruthy();
  });

  it('puts "Share my wins" first, in plain words, and lets you turn it off', () => {
    const onChange = vi.fn();
    render(<ReachControls values={base} onChange={onChange} />);
    const sections = screen.getAllByRole('region');
    expect(sections[0].getAttribute('aria-label')).toBe('Share my wins');
    expect(screen.getByText(/shows up in Discover with what you did/)).toBeTruthy();
    expect(screen.getByText(/Friends always see them/)).toBeTruthy();
    const toggle = screen.getByRole('switch', { name: 'Share my wins' });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenLastCalledWith({ ...base, share_accomplishments: false });
  });

  it('lets you make your full page public-facing', () => {
    const onChange = vi.fn();
    render(<ReachControls values={base} onChange={onChange} />);
    expect(within('Who sees your full page', 'Friends').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within('Who sees your full page', 'Everyone'));
    expect(onChange).toHaveBeenLastCalledWith({ ...base, profile_mode: 'open' });
  });

  it('changes who can message you', () => {
    const onChange = vi.fn();
    render(<ReachControls values={base} onChange={onChange} />);
    fireEvent.click(within('Who can message you', 'Friends'));
    expect(onChange).toHaveBeenCalledWith({ ...base, who_can_message: 'friends' });
    fireEvent.click(within('Who can message you', 'No one'));
    expect(onChange).toHaveBeenLastCalledWith({ ...base, who_can_message: 'nobody' });
  });

  it('turns friend requests and mail off, and limits comments to friends', () => {
    const onChange = vi.fn();
    render(<ReachControls values={base} onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch', { name: 'Accept friend requests' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...base, accepts_friend_requests: false });
    fireEvent.click(screen.getByRole('switch', { name: 'Receive mail' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...base, accepts_mail: false });
    fireEvent.click(within('Who can comment on your posts', 'Friends'));
    expect(onChange).toHaveBeenLastCalledWith({ ...base, comments_from: 'friends' });
  });

  it('shows the current choices', () => {
    render(<ReachControls values={{ ...base, who_can_message: 'nobody', accepts_mail: false }} onChange={() => {}} />);
    expect(within('Who can message you', 'No one').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('switch', { name: 'Receive mail' }).getAttribute('aria-checked')).toBe('false');
  });
});

function within(group: string, option: string): HTMLElement {
  const g = screen.getByRole('radiogroup', { name: group });
  return Array.from(g.querySelectorAll<HTMLElement>('[role=radio]')).find(b => b.textContent === option)!;
}

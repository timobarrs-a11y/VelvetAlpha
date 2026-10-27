import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProfileFrontCard } from '../ProfileFrontCard';

const base = { user_id: 'u', display_name: 'Ace', headline: null, profile_image_type: 'avatar' as const, profile_smilie_code: null, is_bot: false, interests: [], favorite_color: null, zodiac_sign: null, goal_areas: [] };

describe('ProfileFrontCard', () => {
  it('shows interests, favorite color, zodiac and a broad "working on" outline', () => {
    render(<ProfileFrontCard card={{ ...base, interests: ['Running', 'Jazz'], favorite_color: 'teal', zodiac_sign: 'Leo', goal_areas: ['fitness'] }} />);
    expect(screen.getByText('Running')).toBeTruthy();
    expect(screen.getByText('Jazz')).toBeTruthy();
    expect(screen.getByText(/Favorite color: teal/)).toBeTruthy();
    expect(screen.getByText(/Leo/)).toBeTruthy();
    expect(screen.getByText(/Working on/)).toBeTruthy();
  });

  it('renders nothing when there is nothing to show', () => {
    const { container } = render(<ProfileFrontCard card={base} />);
    expect(container.firstChild).toBeNull();
  });
});

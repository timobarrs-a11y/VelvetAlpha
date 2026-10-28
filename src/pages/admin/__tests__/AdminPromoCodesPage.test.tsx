import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../../../services/promoCodesService', () => ({
  fetchPromoStats: async () => [
    { code: 'rainbowhugs', accounts: 3, last_used: new Date(Date.now() - 2 * 3600_000).toISOString(), recent: [{ name: 'Ana', at: new Date().toISOString() }] },
    { code: 'oldcode', accounts: 1, last_used: new Date().toISOString(), recent: [] },
  ],
}));

import { AdminPromoCodesPage } from '../AdminPromoCodesPage';

describe('AdminPromoCodesPage', () => {
  it('lists every code in the game with what it gives and how often it was used, and codes no longer in the game as retired', async () => {
    render(<AdminPromoCodesPage />);
    await waitFor(() => expect(screen.getByText('rainbowhugs')).toBeTruthy());
    expect(screen.getByText('Cuddle Clouds')).toBeTruthy();
    expect(screen.getByText(/Cuddle Clouds kitchen and living room \+ Cuddle Clouds finishing touches · 13 pieces, free/)).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText(/Latest: Ana/)).toBeTruthy();
    expect(screen.getAllByText('Copy')).toHaveLength(1);
    expect(screen.getByText('oldcode')).toBeTruthy();
    expect(screen.getByText('Retired')).toBeTruthy();
  });
});

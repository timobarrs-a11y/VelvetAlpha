import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { DirectorySpace, MySpace } from '../../../types/spaces';

const directory: Record<string, DirectorySpace[]> = {};
vi.mock('../../../services/spacesService', () => ({
  getSpaceDirectory: vi.fn(async (parentId: string) => directory[parentId] ?? []),
}));

import { SpaceSidebar } from '../SpaceSidebar';

function space(over: Partial<MySpace>): MySpace {
  return {
    board_id: 'x', name: 'X', description: null, icon: 'Gamepad2', color: 'pink', category: 'c',
    visibility: 'open', member_count: 10, role: 'member', unread_count: 0, last_message_at: null,
    parent_board_id: null, parent_name: null, sub_space_count: 0, ...over,
  };
}

function renderSidebar(spaces: MySpace[]) {
  return render(
    <MemoryRouter>
      <SpaceSidebar spaces={spaces} activeBoardId={null} onSelect={() => {}} />
    </MemoryRouter>,
  );
}

describe('SpaceSidebar', () => {
  it('nests my crews under their space, rolls their unread up when folded, and lists crews I could join', async () => {
    directory.gaming = [
      { board_id: 'mine', parent_board_id: 'gaming', name: '2K27 Crew', description: null, icon: 'Trophy',
        color: 'amber', category: 'c', visibility: 'hidden', member_count: 4, is_member: true,
        has_pending_request: false, sub_space_count: 0, parent_name: 'Gaming' },
      { board_id: 'other', parent_board_id: 'gaming', name: 'Speedrunners', description: null, icon: 'Cpu',
        color: 'teal', category: 'c', visibility: 'request', member_count: 9, is_member: false,
        has_pending_request: false, sub_space_count: 0, parent_name: 'Gaming' },
    ];
    renderSidebar([
      space({ board_id: 'gaming', name: 'Gaming', unread_count: 2, sub_space_count: 2 }),
      space({ board_id: 'mine', name: '2K27 Crew', visibility: 'hidden', unread_count: 3,
        parent_board_id: 'gaming', parent_name: 'Gaming' }),
    ]);

    // Open by default because I'm in one of its crews; the joinable crew loads in.
    expect(screen.getByText('2K27 Crew')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Speedrunners')).toBeTruthy());
    expect(screen.getByText('2')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Fold crews'));
    expect(screen.queryByText('2K27 Crew')).toBeNull();
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('shows a crew whose space I left at the top level, saying where it lives', () => {
    renderSidebar([
      space({ board_id: 'solo', name: 'Book Club', parent_board_id: 'reading', parent_name: 'Reading' }),
    ]);
    expect(screen.getByText('Book Club')).toBeTruthy();
    expect(screen.getByText('Crew in Reading')).toBeTruthy();
  });
});

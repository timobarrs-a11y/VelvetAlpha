import { Lock, Plus, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { MySpace } from '../../types/spaces';
import { SpaceIcon } from './SpaceIcon';

interface Props {
  spaces: MySpace[];
  activeBoardId: string | null;
  onSelect: (boardId: string) => void;
  loading?: boolean;
}

export function SpaceSidebar({ spaces, activeBoardId, onSelect, loading }: Props) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <h2 className="text-sm font-semibold text-ink">My Spaces</h2>
        <button
          onClick={() => navigate('/house/browse')}
          className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink transition-colors"
          title="Browse spaces"
        >
          <Plus className="w-3.5 h-3.5" /> Find
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5 min-h-0">
        {loading && (
          <div className="px-2 py-3 text-xs text-ink-muted">Loading...</div>
        )}
        {!loading && spaces.length === 0 && (
          <div className="px-3 py-6 text-center">
            <p className="text-xs text-ink-muted mb-3">You haven't joined any spaces yet.</p>
            <button
              onClick={() => navigate('/house/browse')}
              className="text-xs text-pink-400 hover:text-pink-300 transition-colors"
            >
              Browse spaces →
            </button>
          </div>
        )}
        {spaces.map(space => {
          const active = space.board_id === activeBoardId;
          return (
            <button
              key={space.board_id}
              onClick={() => onSelect(space.board_id)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left ${
                active ? 'bg-white/10' : 'hover:bg-white/5'
              }`}
            >
              <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
                <SpaceIcon name={space.icon} color={space.color} className="w-4 h-4" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-ink truncate font-medium">{space.name}</span>
                  {space.visibility === 'private' && (
                    <Lock className="w-3 h-3 text-ink-muted flex-shrink-0" />
                  )}
                </div>
                <span className="text-[10px] text-ink-muted">{space.member_count} members</span>
              </div>
              {space.unread_count > 0 && (
                <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-pink-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {space.unread_count > 99 ? '99+' : space.unread_count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-shrink-0 p-2 border-t border-white/5">
        <button
          onClick={() => navigate('/house/browse')}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-sm text-ink-muted hover:text-ink"
        >
          <Search className="w-4 h-4" /> Browse all spaces
        </button>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { DirectorySpace, MySpace } from '../../types/spaces';
import { SpaceIcon } from './SpaceIcon';
import { DoorIcon } from './doors';
import { getSpaceDirectory } from '../../services/spacesService';

interface Props {
  spaces: MySpace[];
  activeBoardId: string | null;
  onSelect: (boardId: string) => void;
  loading?: boolean;
}

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-pink-500 text-white text-[10px] font-bold flex items-center justify-center">
      {count > 99 ? '99+' : count}
    </span>
  );
}

/**
 * My spaces, with each space's crews nested under it like server folders. Crews I'm in are
 * always shown (their unread rolls up into the space when it's folded); opening a space also
 * lists the crews I could join. A crew whose space I'm not in sits at the top level.
 */
export function SpaceSidebar({ spaces, activeBoardId, onSelect, loading }: Props) {
  const navigate = useNavigate();
  const [openState, setOpenState] = useState<Map<string, boolean>>(new Map());
  const [crewsByParent, setCrewsByParent] = useState<Map<string, DirectorySpace[]>>(new Map());
  const requested = useRef<Set<string>>(new Set());

  const mine = useMemo(() => new Map(spaces.map(s => [s.board_id, s])), [spaces]);
  const childrenOf = useMemo(() => {
    const m = new Map<string, MySpace[]>();
    for (const s of spaces) {
      if (s.parent_board_id && mine.has(s.parent_board_id)) {
        m.set(s.parent_board_id, [...(m.get(s.parent_board_id) ?? []), s]);
      }
    }
    return m;
  }, [spaces, mine]);
  const topLevel = spaces.filter(s => !s.parent_board_id || !mine.has(s.parent_board_id));

  const isOpen = (id: string) => {
    const set = openState.get(id);
    if (set !== undefined) return set;
    return (childrenOf.get(id)?.length ?? 0) > 0;
  };

  // Load the joinable crews of every open space once.
  const openIds = spaces.filter(s => s.sub_space_count > 0 && isOpen(s.board_id)).map(s => s.board_id).join(',');
  useEffect(() => {
    for (const id of openIds ? openIds.split(',') : []) {
      if (requested.current.has(id)) continue;
      requested.current.add(id);
      getSpaceDirectory(id, null)
        .then(crews => setCrewsByParent(prev => new Map(prev).set(id, crews)))
        .catch(() => { requested.current.delete(id); });
    }
  }, [openIds]);

  const toggle = (id: string) => setOpenState(prev => new Map(prev).set(id, !isOpen(id)));

  const renderItem = (space: MySpace, indent = false) => {
    const active = space.board_id === activeBoardId;
    const kids = childrenOf.get(space.board_id) ?? [];
    const foldable = space.sub_space_count > 0 || kids.length > 0;
    const open = foldable && isOpen(space.board_id);
    const unread = open ? space.unread_count : space.unread_count + kids.reduce((n, k) => n + k.unread_count, 0);
    const orphanCrew = !indent && space.parent_board_id && !mine.has(space.parent_board_id);
    const joinable = (crewsByParent.get(space.board_id) ?? []).filter(c => !c.is_member);

    return (
      <div key={space.board_id}>
        <div
          className={`flex items-center gap-1 rounded-lg transition-colors ${indent ? 'ml-4' : ''} ${
            active ? 'bg-white/10' : 'hover:bg-white/5'
          }`}
        >
          {foldable ? (
            <button
              onClick={() => toggle(space.board_id)}
              className="flex-shrink-0 p-1 ml-1 rounded hover:bg-white/10 transition-colors"
              aria-label={open ? 'Fold crews' : 'Show crews'}
            >
              <ChevronRight className={`w-3 h-3 text-ink-muted transition-transform ${open ? 'rotate-90' : ''}`} />
            </button>
          ) : (
            <span className="w-5 ml-1 flex-shrink-0" />
          )}
          <button
            onClick={() => onSelect(space.board_id)}
            className="flex-1 min-w-0 flex items-center gap-2.5 pr-2.5 py-2 text-left"
          >
            <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
              <SpaceIcon name={space.icon} color={space.color} className="w-4 h-4" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-ink truncate font-medium">{space.name}</span>
                <DoorIcon visibility={space.visibility} />
              </div>
              <span className="text-[10px] text-ink-muted truncate block">
                {orphanCrew && space.parent_name ? `Crew in ${space.parent_name}` : `${space.member_count} members`}
              </span>
            </div>
            <UnreadBadge count={unread} />
          </button>
        </div>
        {open && (
          <div className="space-y-0.5">
            {kids.map(c => renderItem(c, true))}
            {joinable.map(c => (
              <button
                key={c.board_id}
                onClick={() => navigate(`/house/${c.board_id}`)}
                className="w-full flex items-center gap-2.5 pl-10 pr-2.5 py-1.5 rounded-lg transition-colors text-left hover:bg-white/5"
              >
                <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center">
                  <SpaceIcon name={c.icon} color={c.color} className="w-3.5 h-3.5" />
                </span>
                <div className="flex-1 min-w-0">
                  <span className="flex items-center gap-1 text-xs text-ink-muted truncate">
                    {c.name} <DoorIcon visibility={c.visibility} className="w-2.5 h-2.5" />
                  </span>
                  <span className="text-[10px] text-ink-muted/60">{c.member_count} members</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0 w-full">
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
        {topLevel.map(space => renderItem(space))}
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

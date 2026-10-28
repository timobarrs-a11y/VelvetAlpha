import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';
import { getSpaceDirectory } from '../../services/spacesService';
import type { DirectorySpace, SpaceView } from '../../types/spaces';
import { SpaceIcon } from './SpaceIcon';
import { DoorAction, DoorChip, DoorIcon } from './doors';
import { StartCrewModal } from './StartCrewModal';

interface Props {
  space: SpaceView;
  /** Called after joining a crew or starting one, so the sidebar picks it up. */
  onChanged: () => void;
  /** Inside another scrolling view (the closed-door card) rather than filling the tab. */
  embedded?: boolean;
}

/** The Crews tab inside a space: every crew I can see, with its door, and Start a crew. */
export function SpaceCrews({ space, onChanged, embedded = false }: Props) {
  const navigate = useNavigate();
  const [crews, setCrews] = useState<DirectorySpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStart, setShowStart] = useState(false);
  const isMember = space.role !== null;

  const load = useCallback(() => {
    setLoading(true);
    getSpaceDirectory(space.board_id, null)
      .then(setCrews)
      .catch(() => setCrews([]))
      .finally(() => setLoading(false));
  }, [space.board_id]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className={embedded ? 'w-full' : 'flex-1 overflow-y-auto p-4 min-h-0'}>
      <div className="max-w-2xl mx-auto space-y-2">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-ink-muted">
            Smaller groups inside {space.name}. Anyone in {space.name} can start one.
          </p>
          {isMember && (
            <button
              onClick={() => setShowStart(true)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-xs text-pink-300 border border-pink-500/30 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Start a crew
            </button>
          )}
        </div>

        {loading && <p className="text-sm text-ink-muted text-center py-6">Loading...</p>}
        {!loading && crews.length === 0 && (
          <p className="text-sm text-ink-muted text-center py-6">
            No crews yet.{isMember ? ' Start the first one.' : ` Join ${space.name} to start one.`}
          </p>
        )}
        {!loading && crews.map(c => (
          <div key={c.board_id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/8">
            <button
              onClick={() => navigate(`/house/${c.board_id}`)}
              className="flex items-center gap-3 flex-1 min-w-0 text-left"
            >
              <span className="flex-shrink-0 w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center">
                <SpaceIcon name={c.icon} color={c.color} className="w-4 h-4" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-ink truncate">{c.name}</span>
                  <DoorIcon visibility={c.visibility} />
                </div>
                {c.description && <p className="text-xs text-ink-muted/70 truncate mt-0.5">{c.description}</p>}
                <span className="flex items-center gap-1 mt-0.5 text-[10px] text-ink-muted/60">
                  <Users className="w-3 h-3" /> {c.member_count} members
                </span>
              </div>
            </button>
            <DoorChip visibility={c.visibility} />
            <DoorAction
              space={c}
              onChanged={patch => {
                setCrews(prev => prev.map(x => x.board_id === c.board_id ? { ...x, ...patch } : x));
                if (patch.is_member) onChanged();
              }}
            />
          </div>
        ))}
      </div>

      {showStart && (
        <StartCrewModal
          parentSpace={space}
          onClose={() => setShowStart(false)}
          onCreated={id => {
            setShowStart(false);
            onChanged();
            navigate(`/house/${id}`);
          }}
        />
      )}
    </div>
  );
}

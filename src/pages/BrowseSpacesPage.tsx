import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Search, Users, ChevronRight, Plus } from 'lucide-react';
import {
  getSpaceDirectory, joinSpace, requestToJoinSpace,
} from '../services/spacesService';
import type { DirectorySpace } from '../types/spaces';
import { SpaceIcon } from '../components/house/SpaceIcon';
import { StartCrewModal } from '../components/house/StartCrewModal';
import { toast } from '../shared/ui/Toast';

const VISIBILITY_LABELS: Record<string, string> = {
  open: 'Open',
  request: 'Request',
  invite: 'Invite only',
  private: 'Private',
};

const VISIBILITY_CHIP: Record<string, string> = {
  open: 'bg-emerald-500/15 text-emerald-400',
  request: 'bg-amber-500/15 text-amber-400',
  invite: 'bg-sky-500/15 text-sky-400',
  private: 'bg-rose-500/15 text-rose-400',
};

export default function BrowseSpacesPage() {
  const navigate = useNavigate();
  const [topLevel, setTopLevel] = useState<DirectorySpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DirectorySpace[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [selectedParent, setSelectedParent] = useState<DirectorySpace | null>(null);
  const [crews, setCrews] = useState<DirectorySpace[]>([]);
  const [loadingCrews, setLoadingCrews] = useState(false);
  const [showStartCrew, setShowStartCrew] = useState(false);

  useEffect(() => {
    getSpaceDirectory(null, null)
      .then(setTopLevel)
      .catch(() => setTopLevel([]))
      .finally(() => setLoading(false));
  }, []);

  const loadCrews = useCallback((parent: DirectorySpace) => {
    setLoadingCrews(true);
    getSpaceDirectory(parent.board_id, null)
      .then(setCrews)
      .catch(() => setCrews([]))
      .finally(() => setLoadingCrews(false));
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const results = await getSpaceDirectory(null, q);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, doSearch]);

  const handleJoin = async (boardId: string) => {
    setBusy(boardId);
    try {
      await joinSpace(boardId);
      toast.success('Joined space!');
      setTopLevel(prev => prev.map(s => s.board_id === boardId ? { ...s, is_member: true } : s));
      setCrews(prev => prev.map(s => s.board_id === boardId ? { ...s, is_member: true } : s));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to join');
    } finally {
      setBusy(null);
    }
  };

  const handleRequest = async (boardId: string) => {
    setBusy(boardId);
    try {
      await requestToJoinSpace(boardId);
      toast.success('Request sent!');
      setTopLevel(prev => prev.map(s => s.board_id === boardId ? { ...s, has_pending_request: true } : s));
      setCrews(prev => prev.map(s => s.board_id === boardId ? { ...s, has_pending_request: true } : s));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to request');
    } finally {
      setBusy(null);
    }
  };

  const grouped = topLevel.reduce<Record<string, DirectorySpace[]>>((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {});
  const categories = Object.keys(grouped).sort();

  const showSearch = searchQuery.trim().length > 0;

  const renderAction = (space: DirectorySpace) => {
    if (space.is_member) {
      return (
        <button
          onClick={() => navigate(`/house/${space.board_id}`)}
          className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-ink transition-colors"
        >
          Open
        </button>
      );
    }
    if (space.visibility === 'open') {
      return (
        <button
          onClick={() => handleJoin(space.board_id)}
          disabled={busy === space.board_id}
          className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-xs text-pink-300 border border-pink-500/30 transition-colors disabled:opacity-50"
        >
          {busy === space.board_id ? '...' : 'Join'}
        </button>
      );
    }
    if (space.visibility === 'request') {
      if (space.has_pending_request) {
        return (
          <span className="flex-shrink-0 text-xs text-amber-400 px-3 py-1.5">Requested</span>
        );
      }
      return (
        <button
          onClick={() => handleRequest(space.board_id)}
          disabled={busy === space.board_id}
          className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-xs text-amber-300 border border-amber-500/30 transition-colors disabled:opacity-50"
        >
          {busy === space.board_id ? '...' : 'Request'}
        </button>
      );
    }
    if (space.visibility === 'invite') {
      return (
        <span className="flex-shrink-0 text-xs text-sky-400/70 px-3 py-1.5">Invite only</span>
      );
    }
    return (
      <span className="flex-shrink-0 text-xs text-ink-muted px-3 py-1.5">Members only</span>
    );
  };

  const renderSpaceCard = (space: DirectorySpace, indent = false) => (
    <div
      key={space.board_id}
      className={`flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/8 ${indent ? 'ml-6' : ''}`}
    >
      <button
        onClick={() => {
          if (space.sub_space_count > 0 || space.is_member) {
            setSelectedParent(space);
            loadCrews(space);
          } else {
            navigate(`/house/${space.board_id}`);
          }
        }}
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
      >
        <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
          <SpaceIcon name={space.icon} color={space.color} className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-ink truncate">{space.name}</span>
            {space.visibility !== 'open' && <Lock className="w-3 h-3 text-ink-muted flex-shrink-0" />}
          </div>
          {space.description && (
            <p className="text-xs text-ink-muted/70 truncate mt-0.5">{space.description}</p>
          )}
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3 text-ink-muted/60" />
              <span className="text-[10px] text-ink-muted/60">{space.member_count} members</span>
            </div>
            {space.sub_space_count > 0 && (
              <span className="text-[10px] text-ink-muted/60">· {space.sub_space_count} crews</span>
            )}
          </div>
        </div>
      </button>
      <span className={`flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded font-medium ${VISIBILITY_CHIP[space.visibility] ?? VISIBILITY_CHIP.private}`}>
        {VISIBILITY_LABELS[space.visibility] ?? space.visibility}
      </span>
      {renderAction(space)}
    </div>
  );

  return (
    <div className="ds-page text-white flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8 flex-shrink-0">
        {selectedParent && (
          <button
            onClick={() => setSelectedParent(null)}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <h1 className="text-base font-bold flex-1">
          {selectedParent ? selectedParent.name : 'Browse Spaces'}
        </h1>
        {selectedParent && selectedParent.is_member && (
          <button
            onClick={() => setShowStartCrew(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-xs text-pink-300 border border-pink-500/30 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Start a crew
          </button>
        )}
      </div>

      <div className="flex-shrink-0 px-4 py-3 border-b border-white/8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search spaces and crews..."
            className="w-full bg-white/5 rounded-xl pl-10 pr-4 py-2.5 text-sm text-ink placeholder:text-ink-muted/60 outline-none focus:bg-white/8 transition-colors"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
        {loading && <p className="text-sm text-ink-muted text-center py-8">Loading...</p>}

        {!loading && showSearch && (
          <div className="max-w-2xl mx-auto space-y-2">
            {searching && <p className="text-sm text-ink-muted text-center py-4">Searching...</p>}
            {!searching && searchResults.length === 0 && (
              <p className="text-sm text-ink-muted text-center py-4">No spaces found.</p>
            )}
            {!searching && searchResults.map(s => renderSpaceCard(s))}
          </div>
        )}

        {!loading && !showSearch && selectedParent && (
          <div className="max-w-2xl mx-auto space-y-2">
            <button
              onClick={() => navigate(`/house/${selectedParent.board_id}`)}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/8 hover:bg-white/5 transition-colors text-left"
            >
              <ChevronRight className="w-4 h-4 text-ink-muted" />
              <span className="text-sm text-ink-muted">Open {selectedParent.name}</span>
            </button>
            <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mt-4 mb-2">Crews</h2>
            {loadingCrews && <p className="text-sm text-ink-muted text-center py-4">Loading...</p>}
            {!loadingCrews && crews.length === 0 && (
              <p className="text-sm text-ink-muted text-center py-4">No crews yet. Start one!</p>
            )}
            {!loadingCrews && crews.map(c => renderSpaceCard(c, true))}
          </div>
        )}

        {!loading && !showSearch && !selectedParent && (
          <div className="max-w-2xl mx-auto space-y-6">
            {categories.map(cat => (
              <div key={cat}>
                <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">{cat}</h2>
                <div className="space-y-2">
                  {grouped[cat].map(space => renderSpaceCard(space))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showStartCrew && selectedParent && (
        <StartCrewModal
          parentSpace={selectedParent}
          onClose={() => setShowStartCrew(false)}
          onCreated={(newId) => {
            setShowStartCrew(false);
            navigate(`/house/${newId}`);
          }}
        />
      )}
    </div>
  );
}

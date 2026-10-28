import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Users } from 'lucide-react';
import { getSpaceDirectory } from '../services/spacesService';
import type { DirectorySpace } from '../types/spaces';
import { SpaceIcon } from '../components/house/SpaceIcon';
import { DoorAction, DoorChip, DoorIcon } from '../components/house/doors';

/**
 * Finding new spaces. Every space and crew opens in the House (crews live in each space's Crews
 * tab); hidden ones never appear here unless you're already in them.
 */
export default function BrowseSpacesPage() {
  const navigate = useNavigate();
  const [topLevel, setTopLevel] = useState<DirectorySpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DirectorySpace[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    getSpaceDirectory(null, null)
      .then(setTopLevel)
      .catch(() => setTopLevel([]))
      .finally(() => setLoading(false));
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      setSearchResults(await getSpaceDirectory(null, q));
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

  const patch = (boardId: string, p: Partial<DirectorySpace>) => {
    const apply = (list: DirectorySpace[]) => list.map(s => s.board_id === boardId ? { ...s, ...p } : s);
    setTopLevel(apply);
    setSearchResults(apply);
  };

  const grouped = topLevel.reduce<Record<string, DirectorySpace[]>>((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {});
  const categories = Object.keys(grouped).sort();
  const showSearch = searchQuery.trim().length > 0;

  const renderSpaceCard = (space: DirectorySpace) => (
    <div key={space.board_id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/8">
      <button
        onClick={() => navigate(`/house/${space.board_id}`)}
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
      >
        <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
          <SpaceIcon name={space.icon} color={space.color} className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          {space.parent_name && (
            <span className="block text-[10px] text-ink-muted/70 truncate">Crew in {space.parent_name}</span>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-ink truncate">{space.name}</span>
            <DoorIcon visibility={space.visibility} />
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
      <DoorChip visibility={space.visibility} />
      <DoorAction space={space} onChanged={p => patch(space.board_id, p)} />
    </div>
  );

  return (
    <div className="ds-page text-white flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8 flex-shrink-0">
        <button
          onClick={() => navigate('/house')}
          className="p-2 rounded-lg hover:bg-white/5 transition-colors"
          aria-label="Back to the House"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold flex-1">Browse Spaces</h1>
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
            {!searching && searchResults.map(renderSpaceCard)}
          </div>
        )}

        {!loading && !showSearch && (
          <div className="max-w-2xl mx-auto space-y-6">
            {categories.map(cat => (
              <div key={cat}>
                <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">{cat}</h2>
                <div className="space-y-2">
                  {grouped[cat].map(renderSpaceCard)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

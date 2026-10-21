import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, Search, Users } from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { joinSpace } from '../services/spacesService';
import { searchCommunity, type SearchResult } from '../services/communityService';
import { SpaceIcon } from '../components/house/SpaceIcon';
import { toast } from '../shared/ui/Toast';

interface BoardRow {
  id: string; name: string; description: string | null; icon: string; color: string;
  category: string; visibility: string; member_count: number; is_approved: boolean;
  is_pinned: boolean; sort_order: number;
}

export default function BrowseSpacesPage() {
  const navigate = useNavigate();
  const [boards, setBoards] = useState<BoardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('community_boards')
      .select('id, name, description, icon, color, category, visibility, member_count, is_approved, is_pinned, sort_order')
      .eq('is_approved', true)
      .order('is_pinned', { ascending: false })
      .order('sort_order')
      .then(({ data, error }) => {
        if (!error && data) setBoards(data as BoardRow[]);
        setLoading(false);
      });

    // Load joined spaces
    supabase.rpc('get_my_spaces').then(({ data }) => {
      if (data) setJoinedIds(new Set((data as any[]).map(s => s.board_id)));
    });
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const results = await searchCommunity(q, 20);
      setSearchResults(results.filter(r => r.result_type === 'board'));
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
      setJoinedIds(prev => new Set([...prev, boardId]));
      toast.success('Joined space!');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to join');
    } finally {
      setBusy(null);
    }
  };

  const grouped = boards.reduce<Record<string, BoardRow[]>>((acc, b) => {
    (acc[b.category] ??= []).push(b);
    return acc;
  }, {});
  const categories = Object.keys(grouped).sort();

  const showSearch = searchQuery.trim().length > 0;

  return (
    <div className="ds-page text-white flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8 flex-shrink-0">
        <button onClick={() => navigate('/house')} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
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
            placeholder="Search spaces..."
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
            {!searching && searchResults.map(r => (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/8">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-ink block">{r.title}</span>
                  {r.body && <span className="text-xs text-ink-muted/70 truncate block">{r.body}</span>}
                </div>
                <button
                  onClick={() => navigate(`/house/${r.id}`)}
                  className="px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-ink transition-colors"
                >
                  View
                </button>
              </div>
            ))}
          </div>
        )}

        {!loading && !showSearch && (
          <div className="max-w-2xl mx-auto space-y-6">
            {categories.map(cat => (
              <div key={cat}>
                <h2 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">{cat}</h2>
                <div className="space-y-2">
                  {grouped[cat].map(board => {
                    const joined = joinedIds.has(board.id);
                    const isPrivate = board.visibility === 'private';
                    return (
                      <div
                        key={board.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/8"
                      >
                        <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                          <SpaceIcon name={board.icon} color={board.color} className="w-5 h-5" />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium text-ink truncate">{board.name}</span>
                            {isPrivate && <Lock className="w-3 h-3 text-ink-muted flex-shrink-0" />}
                          </div>
                          {board.description && (
                            <p className="text-xs text-ink-muted/70 truncate mt-0.5">{board.description}</p>
                          )}
                          <div className="flex items-center gap-1 mt-1">
                            <Users className="w-3 h-3 text-ink-muted/60" />
                            <span className="text-[10px] text-ink-muted/60">{board.member_count} members</span>
                          </div>
                        </div>
                        {joined ? (
                          <button
                            onClick={() => navigate(`/house/${board.id}`)}
                            className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-ink transition-colors"
                          >
                            Open
                          </button>
                        ) : isPrivate ? (
                          <span className="flex-shrink-0 text-xs text-ink-muted px-3 py-1.5">Members only</span>
                        ) : (
                          <button
                            onClick={() => handleJoin(board.id)}
                            disabled={busy === board.id}
                            className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-xs text-pink-300 border border-pink-500/30 transition-colors disabled:opacity-50"
                          >
                            {busy === board.id ? '...' : 'Join'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

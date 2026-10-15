import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, ArrowLeft, MessageCircle, Users, Hash, X } from 'lucide-react';
import { PageShell } from '../shared/ui/PageShell';
import { LoadingState } from '../shared/ui/LoadingState';
import { searchCommunity, type SearchResult } from '../services/communityService';
import { SmilieText } from '../components/community/SmilieText';

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function CommunitySearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const [query, setQuery] = useState(initialQuery);
  const [inputValue, setInputValue] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'posts' | 'boards'>('all');

  const doSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    setLoading(true);
    setHasSearched(true);
    const data = await searchCommunity(trimmed);
    setResults(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (initialQuery) {
      doSearch(initialQuery);
    }
  }, [initialQuery, doSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    setQuery(trimmed);
    if (trimmed) {
      setSearchParams({ q: trimmed });
      doSearch(trimmed);
    } else {
      setSearchParams({});
      setResults([]);
      setHasSearched(false);
    }
  };

  const postResults = results.filter((r) => r.result_type === 'post');
  const boardResults = results.filter((r) => r.result_type === 'board');
  const filtered =
    activeTab === 'posts' ? postResults
    : activeTab === 'boards' ? boardResults
    : results;

  return (
    <PageShell
      width="lg"
      header={
        <div className="px-4 sm:px-6 py-4 border-b border-white/8 bg-[var(--ds-surface-2)]/60 backdrop-blur-md">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => navigate('/community')}
              className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </div>
          <h1 className="text-xl font-bold text-white mb-3">Search Community</h1>
          <form onSubmit={handleSubmit} className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Search posts and boards..."
              autoFocus
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] pl-11 pr-10 py-3 text-sm text-white/90 placeholder-white/30 outline-none focus:border-sky-400/40 focus:bg-white/[0.04] transition-all"
            />
            {inputValue && (
              <button
                type="button"
                onClick={() => {
                  setInputValue('');
                  setQuery('');
                  setSearchParams({});
                  setResults([]);
                  setHasSearched(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/8 transition-all"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Tabs */}
        {hasSearched && results.length > 0 && (
          <div className="flex items-center gap-1 rounded-xl border border-white/8 bg-white/[0.02] p-1 self-start">
            {[
              { key: 'all' as const, label: 'All', count: results.length },
              { key: 'posts' as const, label: 'Posts', count: postResults.length },
              { key: 'boards' as const, label: 'Boards', count: boardResults.length },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === tab.key
                    ? 'bg-white/10 text-white'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                {tab.label}
                <span className="text-[10px] tabular-nums opacity-60">{tab.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Results */}
        {loading ? (
          <LoadingState label="Searching..." />
        ) : hasSearched && filtered.length === 0 ? (
          <div className="text-center py-16">
            <Search className="w-8 h-8 text-white/15 mx-auto mb-3" />
            <p className="text-sm text-white/40">
              No results for <span className="text-white/70 font-semibold">"{query}"</span>
            </p>
            <p className="text-xs text-white/25 mt-1">Try different keywords or check spelling.</p>
          </div>
        ) : !hasSearched ? (
          <div className="text-center py-16">
            <Search className="w-8 h-8 text-white/15 mx-auto mb-3" />
            <p className="text-sm text-white/40">Search across all community posts and boards.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((result, i) => (
              <motion.button
                key={`${result.result_type}-${result.id}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
                onClick={() =>
                  result.result_type === 'post'
                    ? navigate(`/community/post/${result.id}`)
                    : navigate(`/community/board/${result.id}`)
                }
                className="w-full text-left rounded-xl border border-white/8 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/15 p-4 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/5">
                    {result.result_type === 'post' ? (
                      <MessageCircle className="w-4 h-4 text-sky-400" />
                    ) : (
                      <Hash className="w-4 h-4 text-emerald-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {result.board_name && (
                      <span className="text-[11px] text-sky-400/60 font-semibold uppercase tracking-wide">
                        {result.board_name}
                      </span>
                    )}
                    <h3 className="text-sm font-bold text-white group-hover:text-sky-300 transition-colors leading-snug mt-0.5">
                      {result.title}
                    </h3>
                    {result.body && (
                      <p className="text-xs text-white/45 mt-1 line-clamp-2 leading-relaxed">
                        <SmilieText text={result.body} />
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-white/30">
                      {result.author_name && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {result.author_name}
                        </span>
                      )}
                      {result.comment_count > 0 && (
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" />
                          {result.comment_count}
                        </span>
                      )}
                      <span>{timeAgo(result.created_at)}</span>
                    </div>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}

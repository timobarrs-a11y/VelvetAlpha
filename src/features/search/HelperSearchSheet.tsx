import { useEffect, useState } from 'react';
import { Globe, X, Target, CheckSquare, ListOrdered, Compass } from 'lucide-react';
import { getCommitments, getGoals, getPlans } from '../../services/coachingService';
import { searchTopics, type HelperSearchRequest, type SearchTopic } from './searchTopics';

const KIND_ICON = { goal: Target, commitment: CheckSquare, step: ListOrdered } as const;

/**
 * Asks what a search is for before the helper runs it: one of the goals,
 * commitments or plan steps it's carrying, or something else. General
 * searches are pointed to Atlas.
 */
export function HelperSearchSheet({
  userId, companionId, helperName, onSearch, onClose,
}: {
  userId: string;
  companionId: string;
  helperName: string;
  onSearch: (req: HelperSearchRequest) => void;
  onClose: () => void;
}) {
  const [topics, setTopics] = useState<SearchTopic[] | null>(null);
  // undefined: still choosing; null: "something else"; a topic: about that.
  const [about, setAbout] = useState<SearchTopic | null | undefined>(undefined);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let live = true;
    Promise.all([getGoals(userId), getCommitments(userId, companionId), getPlans(userId, companionId)])
      .then(([goals, commitments, plans]) => { if (live) setTopics(searchTopics(companionId, goals, commitments, plans)); })
      .catch(() => { if (live) setTopics([]); });
    return () => { live = false; };
  }, [userId, companionId]);

  const askAtlas = () => {
    window.dispatchEvent(new CustomEvent('hub:open-bot', { detail: { bot: 'atlas' } }));
    onClose();
  };

  const submit = () => {
    if (about === undefined) return;
    if (!about && !query.trim()) return;
    onSearch({ query: query.trim(), about: about ? { kind: about.kind, id: about.id, title: about.title } : null });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Search the web"
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <Globe className="h-4 w-4 text-rose-500" /> Search with {helperName}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {about === undefined ? (
          <>
            <p className="mb-2 text-sm text-gray-600">Is this search about…</p>
            {topics === null ? (
              <p className="py-3 text-sm text-gray-400">Loading…</p>
            ) : (
              <ul className="grid max-h-72 gap-1.5 overflow-y-auto">
                {topics.map(t => {
                  const Icon = KIND_ICON[t.kind];
                  return (
                    <li key={`${t.kind}-${t.id}`}>
                      <button
                        type="button"
                        onClick={() => setAbout(t)}
                        className="flex w-full items-start gap-2.5 rounded-xl border border-gray-100 px-3 py-2 text-left hover:border-rose-200 hover:bg-rose-50/50"
                      >
                        <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-gray-900">{t.title}</span>
                          {t.detail && <span className="block truncate text-xs text-gray-500">{t.detail}</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
                <li>
                  <button
                    type="button"
                    onClick={() => setAbout(null)}
                    className="w-full rounded-xl border border-dashed border-gray-200 px-3 py-2 text-left text-sm text-gray-700 hover:border-rose-200"
                  >
                    Something else
                    <span className="block text-xs text-gray-500">Not one of these yet, like looking into something before you set a goal</span>
                  </button>
                </li>
              </ul>
            )}
            <button type="button" onClick={askAtlas} className="mt-3 flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700">
              <Compass className="h-3.5 w-3.5" /> Searching for something general? Atlas is best for that.
            </button>
          </>
        ) : (
          <form onSubmit={e => { e.preventDefault(); submit(); }}>
            <p className="mb-2 text-sm text-gray-600">
              {about ? <>About <span className="font-medium text-gray-900">{about.title}</span></> : 'Something else'}
              <button type="button" onClick={() => setAbout(undefined)} className="ml-2 text-xs text-rose-500">Change</button>
            </p>
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={about ? `What should ${helperName} look up? Or leave it to them.` : 'What do you want to look up?'}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-rose-300 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!about && !query.trim()}
              className="mt-3 w-full rounded-xl bg-rose-500 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Search
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

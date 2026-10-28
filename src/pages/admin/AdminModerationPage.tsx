import { useState } from 'react';
import { Bot as BotIcon } from 'lucide-react';
import { adminConsole, ReportRow } from '../../services/adminConsoleService';
import { approveBoard, fetchBoards, rejectBoard } from '../../services/communityService';
import { PageHeader, ErrorBanner, Spinner, Empty, panel, btnNeutral, btnDanger, btnGood, useLoad, act, ago } from './ui';
import { WordBankSection } from './AdminWordBank';

const STATUSES = ['pending', 'reviewed', 'resolved', 'all'];

const must = (ok: boolean) => { if (!ok) throw new Error('That didn\'t work. Only super users can approve spaces.'); };

/** Spaces members proposed (crews started by members of their space skip this). Moved here from the old Community page. */
function ProposedSpaces() {
  const { data, error, reload } = useLoad(async () => (await fetchBoards()).filter(b => !b.is_approved), []);
  const [busy, setBusy] = useState<string | null>(null);

  const decide = async (id: string, approve: boolean, name: string) => {
    if (!approve && !window.confirm(`Reject and delete "${name}"?`)) return;
    setBusy(id);
    const ok = await act(approve ? 'Space approved' : 'Space rejected',
      async () => must(approve ? await approveBoard(id) : await rejectBoard(id)));
    if (ok) await reload();
    setBusy(null);
  };

  if (error) return <ErrorBanner message={error} />;
  if (!data || data.length === 0) return null;
  return (
    <div className={`${panel} p-5 mb-6`}>
      <h2 className="text-sm font-semibold text-white mb-1">Proposed spaces</h2>
      <p className="text-xs text-white/40 mb-4">New top-level spaces wait here until you approve them.</p>
      <div className="space-y-3">
        {data.map(b => (
          <div key={b.id} className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium truncate">{b.name}</p>
              <p className="text-xs text-white/40 truncate">
                {b.category || 'General'} · {ago(b.created_at)}{b.description ? ` · ${b.description}` : ''}
              </p>
            </div>
            <button disabled={busy === b.id} className={btnGood} onClick={() => decide(b.id, true, b.name)}>Approve</button>
            <button disabled={busy === b.id} className={btnDanger} onClick={() => decide(b.id, false, b.name)}>Reject</button>
          </div>
        ))}
      </div>
    </div>
  );
}

const VIEWS = [
  { id: 'reports', label: 'Reports' },
  { id: 'words', label: 'Word bank' },
] as const;

export function AdminModerationPage() {
  const [view, setView] = useState<(typeof VIEWS)[number]['id']>('reports');
  return (
    <>
      <PageHeader
        title="Moderation"
        subtitle={view === 'reports'
          ? 'Proposed spaces, and reported posts and comments with the content shown inline. Removing content is permanent.'
          : 'Slurs and hate speech the database refuses everywhere public. Swearing is allowed.'}
      />
      <div className="flex gap-2 mb-5 border-b border-white/10 pb-3">
        {VIEWS.map(v => (
          <button key={v.id} onClick={() => setView(v.id)}
            className={`px-3 py-1.5 rounded-lg text-sm transition ${view === v.id ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white'}`}>
            {v.label}
          </button>
        ))}
      </div>
      {view === 'reports' ? <><ProposedSpaces /><ReportsSection /></> : <WordBankSection />}
    </>
  );
}

function ReportsSection() {
  const [status, setStatus] = useState('pending');
  const { data, error, loading, reload } = useLoad(() => adminConsole.listReports(status), [status]);
  const [busy, setBusy] = useState<string | null>(null);

  const resolve = async (r: ReportRow, action: 'dismiss' | 'remove_content' | 'remove_and_ban', label: string) => {
    if (action === 'remove_and_ban' && !window.confirm(`Remove this ${r.target_type} and ban ${r.content_author_name || 'its author'}?`)) return;
    setBusy(r.id);
    if (await act(label, () => adminConsole.resolveReport(r.id, action))) await reload();
    setBusy(null);
  };

  return (
    <>
      <div className="flex gap-2 mb-5">
        {STATUSES.map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={`px-3 py-1 rounded-full text-xs border capitalize transition ${status === s ? 'bg-white/15 border-white/30 text-white' : 'border-white/10 text-white/50 hover:text-white'}`}>
            {s}
          </button>
        ))}
      </div>
      {error && <ErrorBanner message={error} />}
      {loading && !data ? <Spinner /> : (
        <div className="space-y-3">
          {(data ?? []).map(r => (
            <div key={r.id} className={`${panel} p-5`}>
              <div className="flex flex-wrap items-center gap-2 text-xs text-white/40 mb-2">
                <span className="uppercase tracking-wide text-white/60">{r.target_type}</span>
                <span>reported by {r.reporter_name || 'unknown'}</span>
                <span>· {ago(r.created_at)}</span>
                <span className="ml-auto capitalize">{r.status}</span>
              </div>
              <p className="text-sm text-amber-200/90 mb-3"><span className="text-white/40">Reason: </span>{r.reason}</p>
              {r.content_missing ? (
                <p className="text-sm text-white/35 italic mb-3">Content was already deleted.</p>
              ) : r.target_type !== 'board' && (
                <div className="rounded-xl bg-black/25 border border-white/5 p-3 mb-3">
                  <p className="text-xs text-white/40 mb-1 flex items-center gap-1">
                    {r.content_is_bot && <BotIcon className="w-3 h-3" />}
                    by {r.content_author_name || 'unknown'}
                  </p>
                  {r.target_type === 'post' && <p className="text-white font-medium text-sm">{r.content_title}</p>}
                  <p className="text-white/70 text-sm whitespace-pre-wrap break-words">{r.content_body}</p>
                </div>
              )}
              {r.status === 'pending' && (
                <div className="flex flex-wrap gap-2">
                  <button disabled={busy === r.id} className={btnNeutral} onClick={() => resolve(r, 'dismiss', 'Report dismissed')}>Dismiss</button>
                  {r.target_type !== 'board' && !r.content_missing && (
                    <>
                      <button disabled={busy === r.id} className={btnDanger} onClick={() => resolve(r, 'remove_content', 'Content removed')}>Remove content</button>
                      <button disabled={busy === r.id} className={btnDanger} onClick={() => resolve(r, 'remove_and_ban', 'Removed and author banned')}>Remove + ban author</button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
          {data?.length === 0 && <Empty>Nothing here. The queue is clear.</Empty>}
        </div>
      )}
    </>
  );
}

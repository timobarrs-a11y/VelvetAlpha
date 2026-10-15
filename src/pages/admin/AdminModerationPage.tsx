import { useState } from 'react';
import { Bot as BotIcon } from 'lucide-react';
import { adminConsole, ReportRow } from '../../services/adminConsoleService';
import { PageHeader, ErrorBanner, Spinner, Empty, panel, btnNeutral, btnDanger, useLoad, act, ago } from './ui';

const STATUSES = ['pending', 'reviewed', 'resolved', 'all'];

export function AdminModerationPage() {
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
      <PageHeader title="Moderation" subtitle="Reported posts and comments, with the content shown inline. Removing content is permanent." />
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

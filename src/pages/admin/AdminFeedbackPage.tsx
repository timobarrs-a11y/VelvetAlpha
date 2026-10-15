import { useState } from 'react';
import { adminConsole, FeedbackRow } from '../../services/adminConsoleService';
import { PageHeader, ErrorBanner, Spinner, Empty, panel, btnNeutral, btnGood, useLoad, act, ago } from './ui';

const STATUSES = ['new', 'reviewed', 'implemented', 'dismissed', 'all'];

export function AdminFeedbackPage() {
  const [status, setStatus] = useState('new');
  const { data, error, loading, reload } = useLoad(() => adminConsole.listFeedback(status), [status]);

  const set = async (f: FeedbackRow, s: FeedbackRow['status']) => {
    if (await act(`Marked ${s}`, () => adminConsole.setFeedbackStatus(f.id, s))) await reload();
  };

  return (
    <>
      <PageHeader title="Feedback" subtitle="Everything users send in. Triage it like an inbox." />
      <div className="flex gap-2 mb-5 flex-wrap">
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
          {(data ?? []).map(f => (
            <div key={f.id} className={`${panel} p-5`}>
              <div className="flex flex-wrap items-center gap-2 text-xs text-white/40 mb-2">
                <span className="uppercase tracking-wide text-white/60">{f.feedback_type}</span>
                <span>{f.user_name || 'Anonymous'}{f.email ? ` · ${f.email}` : ''}</span>
                <span>· {ago(f.created_at)}</span>
                {f.page_url && <span className="truncate max-w-[200px]">· {f.page_url}</span>}
                <span className="ml-auto capitalize">{f.status}</span>
              </div>
              <p className="text-white/85 text-sm whitespace-pre-wrap break-words mb-3">{f.message}</p>
              <div className="flex flex-wrap gap-2">
                {f.email && <a className={btnNeutral} href={`mailto:${f.email}`}>Reply by email</a>}
                {f.status !== 'reviewed' && <button className={btnNeutral} onClick={() => set(f, 'reviewed')}>Reviewed</button>}
                {f.status !== 'implemented' && <button className={btnGood} onClick={() => set(f, 'implemented')}>Implemented</button>}
                {f.status !== 'dismissed' && <button className={btnNeutral} onClick={() => set(f, 'dismissed')}>Dismiss</button>}
              </div>
            </div>
          ))}
          {data?.length === 0 && <Empty>No feedback in this view.</Empty>}
        </div>
      )}
    </>
  );
}

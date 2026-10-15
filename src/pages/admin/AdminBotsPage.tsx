import { useState } from 'react';
import { adminConsole, BotBoard } from '../../services/adminConsoleService';
import { PageHeader, ErrorBanner, Spinner, panel, btnNeutral, inputClass, useLoad, act, ago } from './ui';

export function AdminBotsPage() {
  const { data, error, loading, reload } = useLoad(() => adminConsole.botOverview(), []);

  return (
    <>
      <PageHeader
        title="Community bots"
        subtitle="Per-board controls and the live run log. The master switch and daily Claude cap are in Site controls."
        actions={<button onClick={reload} className="text-xs text-white/50 hover:text-white border border-white/10 rounded-lg px-3 py-1.5">Refresh</button>}
      />
      {error && <ErrorBanner message={error} />}
      {loading && !data ? <Spinner /> : data && (
        <>
          <div className="grid grid-cols-2 gap-4 mb-6 max-w-md">
            <div className={`${panel} p-4`}><div className="text-2xl font-bold text-white">{data.runs_24h}</div><div className="text-white/45 text-xs">successful actions (24h)</div></div>
            <div className={`${panel} p-4`}><div className={`text-2xl font-bold ${data.errors_24h ? 'text-rose-300' : 'text-white'}`}>{data.errors_24h}</div><div className="text-white/45 text-xs">errors (24h)</div></div>
          </div>

          <h3 className="text-white font-semibold mb-3">Boards</h3>
          <div className="space-y-2 mb-8">
            {data.boards.map(b => <BoardRow key={b.id} board={b} onSaved={reload} />)}
          </div>

          <h3 className="text-white font-semibold mb-3">Recent runs</h3>
          <div className={`${panel} divide-y divide-white/5`}>
            {data.runs.map(r => (
              <div key={r.id} className="p-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <span className="text-white/80 w-24">{r.bot_name}</span>
                <span className="text-white/50 w-16">{r.action}</span>
                <span className={r.status === 'success' ? 'text-emerald-400 w-40' : r.status === 'error' ? 'text-rose-400 w-40' : 'text-amber-300 w-40'}>{r.status.replace(/_/g, ' ')}</span>
                <span className="text-white/45 flex-1 min-w-[160px] truncate">{r.error_message || r.generated_title || ''}</span>
                <span className="text-white/30 text-xs">{ago(r.created_at)}</span>
              </div>
            ))}
            {data.runs.length === 0 && <p className="p-6 text-center text-white/35 text-sm">No runs yet.</p>}
          </div>
        </>
      )}
    </>
  );
}

function BoardRow({ board, onSaved }: { board: BotBoard; onSaved: () => void }) {
  const [enabled, setEnabled] = useState(board.bot_enabled ?? false);
  const [post, setPost] = useState(board.post_frequency_hours ?? 6);
  const [respond, setRespond] = useState(board.respond_frequency_hours ?? 4);
  const dirty = enabled !== (board.bot_enabled ?? false) || post !== (board.post_frequency_hours ?? 6) || respond !== (board.respond_frequency_hours ?? 4);

  return (
    <div className={`${panel} p-4 flex flex-wrap items-center gap-4`}>
      <div className="flex-1 min-w-[160px]">
        <p className="text-white font-medium text-sm">{board.name}</p>
        <p className="text-white/35 text-xs">last post {ago(board.last_post_at)} · last reply {ago(board.last_respond_at)}</p>
      </div>
      <label className="flex items-center gap-2 text-sm text-white/70">
        <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /> Enabled
      </label>
      <label className="text-xs text-white/50 flex items-center gap-1">Post every
        <input type="number" min={1} value={post} onChange={e => setPost(Number(e.target.value))} className={`${inputClass} w-16 !py-1`} />h
      </label>
      <label className="text-xs text-white/50 flex items-center gap-1">Reply every
        <input type="number" min={1} value={respond} onChange={e => setRespond(Number(e.target.value))} className={`${inputClass} w-16 !py-1`} />h
      </label>
      <button
        disabled={!dirty || post < 1 || respond < 1}
        className={btnNeutral}
        onClick={async () => { if (await act('Board bot settings saved', () => adminConsole.setBotBoard(board.id, enabled, post, respond))) onSaved(); }}
      >Save</button>
    </div>
  );
}

import { adminConsole } from '../../services/adminConsoleService';
import { PageHeader, ErrorBanner, Spinner, Empty, panel, useLoad, ago } from './ui';

export function AdminAuditPage() {
  const { data, error, loading } = useLoad(() => adminConsole.listAudit(200), []);
  return (
    <>
      <PageHeader title="Audit log" subtitle="Every change made through the console: who, what, and to whom." />
      {error && <ErrorBanner message={error} />}
      {loading && !data ? <Spinner /> : (
        <div className={`${panel} divide-y divide-white/5`}>
          {(data ?? []).map(a => (
            <div key={a.id} className="p-3 text-sm flex flex-wrap gap-x-4 gap-y-1">
              <span className="text-white/30 w-20 text-xs pt-0.5">{ago(a.created_at)}</span>
              <span className="text-white font-mono">{a.action}</span>
              <span className="text-white/45">{a.target_type}{a.target_id ? ` ${a.target_id.slice(0, 8)}…` : ''}</span>
              <span className="text-white/35 flex-1 min-w-[160px] truncate font-mono text-xs">
                {Object.keys(a.details ?? {}).length ? JSON.stringify(a.details) : ''}
              </span>
            </div>
          ))}
          {data?.length === 0 && <Empty>No admin actions yet.</Empty>}
        </div>
      )}
    </>
  );
}

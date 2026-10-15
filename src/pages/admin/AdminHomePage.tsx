import { Link } from 'react-router-dom';
import { ShieldAlert, Inbox, AlertTriangle, Bot, Clock, UserX, Brain, UserPlus, Bug, ChevronRight } from 'lucide-react';
import { adminConsole } from '../../services/adminConsoleService';
import { PageHeader, ErrorBanner, Spinner, panel, useLoad } from './ui';

export function AdminHomePage() {
  const { data, error, loading, reload } = useLoad(() => adminConsole.overview(), []);

  const items = data ? [
    { label: 'Reports to review', n: data.pending_reports, to: '/admin/moderation', icon: ShieldAlert, urgent: true },
    { label: 'New feedback', n: data.new_feedback, to: '/admin/feedback', icon: Inbox, urgent: true },
    { label: 'Open alerts', n: data.open_alerts, to: '/admin/monitoring', icon: AlertTriangle, urgent: true },
    { label: 'Bot errors (24h)', n: data.bot_errors_24h, to: '/admin/bots', icon: Bot, urgent: true },
    { label: 'Memory proposals pending', n: data.pending_memory_proposals, to: '/admin/memory-proposals', icon: Brain, urgent: false },
    { label: 'Trials ending in 3 days', n: data.trials_ending_3d, to: '/admin/users?filter=trial_ending', icon: Clock, urgent: false },
    { label: 'Banned users', n: data.banned_users, to: '/admin/users?filter=banned', icon: UserX, urgent: false },
    { label: 'Signups (24h)', n: data.signups_24h, to: '/admin/users?filter=new_7d', icon: UserPlus, urgent: false },
    { label: 'App errors (24h)', n: data.errors_24h, to: '/admin/analytics', icon: Bug, urgent: false },
  ] : [];

  return (
    <>
      <PageHeader
        title="Needs attention"
        subtitle="Everything waiting on a decision from you. Click a card to work the queue."
        actions={<button onClick={reload} className="text-xs text-white/50 hover:text-white border border-white/10 rounded-lg px-3 py-1.5">Refresh</button>}
      />
      {error && <ErrorBanner message={error} />}
      {loading && !data ? <Spinner /> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(i => {
            const hot = i.urgent && i.n > 0;
            return (
              <Link key={i.label} to={i.to} className={`${panel} p-5 hover:bg-white/[0.08] transition group ${hot ? 'border-rose-500/40' : ''}`}>
                <div className="flex items-center justify-between mb-3">
                  <i.icon className={`w-5 h-5 ${hot ? 'text-rose-400' : 'text-white/40'}`} />
                  <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/60" />
                </div>
                <div className={`text-3xl font-bold ${hot ? 'text-rose-300' : 'text-white'}`}>{i.n.toLocaleString()}</div>
                <div className="text-white/50 text-sm mt-1">{i.label}</div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

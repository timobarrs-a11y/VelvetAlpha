import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, X, Ban, ShieldCheck, Clock } from 'lucide-react';
import { adminConsole, AdminUserRow } from '../../services/adminConsoleService';
import { PageHeader, ErrorBanner, Spinner, Empty, panel, btnNeutral, btnDanger, btnGood, inputClass, useLoad, act, ago } from './ui';

const TIERS = ['free', 'trial', 'unlimited', 'starter', 'plus', 'elite'];
const FILTERS: [string, string][] = [
  ['all', 'Everyone'], ['new_7d', 'New (7d)'], ['paying', 'Paying'],
  ['trial_ending', 'Trial ending'], ['struck', 'Has strikes'], ['banned', 'Banned'],
];

export function AdminUsersPage() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [tier, setTier] = useState('all');
  const [selected, setSelected] = useState<string | null>(null);
  const filter = params.get('filter') || 'all';

  const list = useLoad(
    () => adminConsole.searchUsers({ query: submitted, tier, filter }),
    [submitted, tier, filter],
  );

  return (
    <>
      <PageHeader title="Users" subtitle="Search anyone, open their full record, and act on it." />
      <form
        onSubmit={e => { e.preventDefault(); setSubmitted(query); }}
        className="flex flex-wrap gap-2 mb-3"
      >
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Name, email, or user id"
            className={`${inputClass} w-full pl-9`}
          />
        </div>
        <select value={tier} onChange={e => setTier(e.target.value)} className={inputClass}>
          <option value="all">All tiers</option>
          {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button type="submit" className={btnNeutral}>Search</button>
      </form>
      <div className="flex flex-wrap gap-2 mb-5">
        {FILTERS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setParams(k === 'all' ? {} : { filter: k })}
            className={`px-3 py-1 rounded-full text-xs border transition ${filter === k ? 'bg-white/15 border-white/30 text-white' : 'border-white/10 text-white/50 hover:text-white'}`}
          >{label}</button>
        ))}
      </div>

      {list.error && <ErrorBanner message={list.error} />}
      {list.loading && !list.data ? <Spinner /> : (
        <div className={`${panel} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-white/40 text-xs border-b border-white/10">
                <th className="p-3 font-medium">User</th>
                <th className="p-3 font-medium">Tier</th>
                <th className="p-3 font-medium hidden sm:table-cell">Joined</th>
                <th className="p-3 font-medium hidden md:table-cell">Last sign-in</th>
                <th className="p-3 font-medium">Flags</th>
              </tr>
            </thead>
            <tbody>
              {(list.data?.users ?? []).map(u => (
                <tr key={u.id} onClick={() => setSelected(u.id)} className="border-b border-white/5 hover:bg-white/5 cursor-pointer">
                  <td className="p-3">
                    <div className="text-white font-medium">{u.name || 'Unnamed'}</div>
                    <div className="text-white/40 text-xs truncate max-w-[220px]">{u.email}</div>
                  </td>
                  <td className="p-3 text-white/70">{u.subscription_tier || 'free'}</td>
                  <td className="p-3 text-white/50 hidden sm:table-cell">{ago(u.created_at)}</td>
                  <td className="p-3 text-white/50 hidden md:table-cell">{ago(u.last_sign_in_at)}</td>
                  <td className="p-3 space-x-1">
                    {u.is_super_user && <Tag color="amber">owner</Tag>}
                    {u.is_banned && <Tag color="red">banned</Tag>}
                    {u.moderation_strikes > 0 && <Tag color="orange">{u.moderation_strikes} strike{u.moderation_strikes > 1 ? 's' : ''}</Tag>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.data?.users.length === 0 && <Empty>No users match.</Empty>}
          {list.data && <p className="text-white/30 text-xs p-3">Showing {list.data.users.length} of {list.data.total}</p>}
        </div>
      )}

      {selected && <UserDrawer id={selected} onClose={() => setSelected(null)} onChanged={list.reload} />}
    </>
  );
}

function Tag({ color, children }: { color: 'amber' | 'red' | 'orange'; children: React.ReactNode }) {
  const c = { amber: 'bg-amber-500/20 text-amber-300', red: 'bg-red-500/20 text-red-300', orange: 'bg-orange-500/20 text-orange-300' }[color];
  return <span className={`text-[10px] px-1.5 py-0.5 rounded ${c}`}>{children}</span>;
}

function UserDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { data, error, loading, reload } = useLoad(() => adminConsole.userDetail(id), [id]);
  const [busy, setBusy] = useState(false);
  const p = data?.profile;

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    if (await act(label, fn)) { await reload(); onChanged(); }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <div className="w-full max-w-lg h-full overflow-y-auto p-6 border-l border-white/10" style={{ background: '#0b0f24' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-xl font-bold text-white">{p?.name || 'User'}</h3>
            <p className="text-white/45 text-sm">{p?.email}</p>
            <p className="text-white/25 text-[11px] font-mono mt-1">{id}</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        {error && <ErrorBanner message={error} />}
        {loading && !data && <Spinner />}
        {data && p && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Messages" value={data.messages_total} sub={`${data.messages_7d} this week`} />
              <Stat label="Companions" value={data.companions} />
              <Stat label="Posts / comments" value={`${data.posts} / ${data.comments}`} />
              <Stat label="Referrals" value={data.referrals_made} />
              <Stat label="Strikes" value={p.moderation_strikes} />
              <Stat label="Last message" value={ago(data.last_message_at)} />
            </div>

            <Section title="Account">
              <Row k="Tier" v={p.subscription_tier || 'free'} />
              <Row k="Role" v={p.is_super_user ? 'owner' : p.user_role || 'user'} />
              <Row k="Joined" v={new Date(p.created_at).toLocaleString()} />
              <Row k="Last sign-in" v={p.last_sign_in_at ? new Date(p.last_sign_in_at).toLocaleString() : 'never'} />
              {p.trial_expires_at && <Row k="Trial ends" v={new Date(p.trial_expires_at).toLocaleString()} />}
              {p.is_banned && <Row k="Banned" v={p.banned_at ? new Date(p.banned_at).toLocaleString() : 'yes'} />}
            </Section>

            <Section title="Actions">
              <div className="flex flex-wrap gap-2 items-center">
                <select
                  disabled={busy}
                  value=""
                  onChange={e => e.target.value && run(`Tier set to ${e.target.value}`, () => adminConsole.setTier(id, e.target.value))}
                  className={`${inputClass} !py-1.5 text-xs`}
                >
                  <option value="">Change tier…</option>
                  {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <button disabled={busy} className={btnGood} onClick={() => run('Trial extended 7 days', () => adminConsole.extendTrial(id, 7))}>
                  <Clock className="w-3 h-3 inline mr-1" />+7 day trial
                </button>
                {p.moderation_strikes > 0 && (
                  <button disabled={busy} className={btnNeutral} onClick={() => run('Strikes reset', () => adminConsole.resetStrikes(id))}>
                    <ShieldCheck className="w-3 h-3 inline mr-1" />Reset strikes
                  </button>
                )}
                {!p.is_super_user && (p.is_banned ? (
                  <button disabled={busy} className={btnGood} onClick={() => run('User unbanned', () => adminConsole.setBan(id, false))}>Unban</button>
                ) : (
                  <button
                    disabled={busy}
                    className={btnDanger}
                    onClick={() => {
                      const reason = window.prompt(`Ban ${p.name || 'this user'}? Enter a reason (saved in the audit log):`);
                      if (reason !== null) run('User banned', () => adminConsole.setBan(id, true, reason));
                    }}
                  ><Ban className="w-3 h-3 inline mr-1" />Ban</button>
                ))}
              </div>
            </Section>

            {data.moderation_events.length > 0 && (
              <Section title="Moderation history">
                {data.moderation_events.map((m, i) => <Row key={i} k={m.category} v={ago(m.created_at)} />)}
              </Section>
            )}
            {data.feedback.length > 0 && (
              <Section title="Feedback">
                {data.feedback.map(f => (
                  <p key={f.id} className="text-sm text-white/70"><span className="text-white/40">[{f.feedback_type}/{f.status}]</span> {f.message}</p>
                ))}
              </Section>
            )}
            {data.recent_errors.length > 0 && (
              <Section title="Recent errors">
                {data.recent_errors.map((e, i) => <Row key={i} k={e.error_type} v={`${e.error_message.slice(0, 60)} · ${ago(e.created_at)}`} />)}
              </Section>
            )}
            {data.audit.length > 0 && (
              <Section title="Admin actions on this user">
                {data.audit.map((a, i) => <Row key={i} k={a.action} v={ago(a.created_at)} />)}
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
      <div className="text-white font-semibold">{value}</div>
      <div className="text-white/40 text-[11px]">{label}</div>
      {sub && <div className="text-white/30 text-[10px]">{sub}</div>}
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><p className="text-xs uppercase tracking-wide text-white/35 mb-2">{title}</p><div className="space-y-1.5">{children}</div></div>;
}
function Row({ k, v }: { k: string; v: string | number }) {
  return <div className="flex justify-between gap-4 text-sm"><span className="text-white/45">{k}</span><span className="text-white/80 text-right">{v}</span></div>;
}

export type { AdminUserRow };

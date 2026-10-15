import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, LayoutDashboard, Users, ShieldAlert, Inbox, Bot, SlidersHorizontal,
  ScrollText, BarChart3, MonitorDot, MessageCircle, Brain, KeyRound,
} from 'lucide-react';

const SECTIONS: { title: string; items: { to: string; label: string; icon: typeof Users; end?: boolean }[] }[] = [
  {
    title: 'Operate',
    items: [
      { to: '/admin', label: 'Needs attention', icon: LayoutDashboard, end: true },
      { to: '/admin/users', label: 'Users', icon: Users },
      { to: '/admin/moderation', label: 'Moderation', icon: ShieldAlert },
      { to: '/admin/feedback', label: 'Feedback', icon: Inbox },
      { to: '/admin/bots', label: 'Community bots', icon: Bot },
    ],
  },
  {
    title: 'Control',
    items: [
      { to: '/admin/settings', label: 'Site controls', icon: SlidersHorizontal },
      { to: '/admin/roles', label: 'Roles & access', icon: KeyRound },
      { to: '/admin/audit', label: 'Audit log', icon: ScrollText },
    ],
  },
  {
    title: 'Insight',
    items: [
      { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
      { to: '/admin/monitoring', label: 'Monitoring', icon: MonitorDot },
      { to: '/admin/response-quality', label: 'Response quality', icon: MessageCircle },
      { to: '/admin/memory-proposals', label: 'Memory proposals', icon: Brain },
    ],
  },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
    isActive ? 'bg-white/10 text-white' : 'text-white/55 hover:text-white hover:bg-white/5'
  }`;

export function AdminLayout() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ background: 'linear-gradient(180deg, #0d1128 0%, #090c1e 50%, #060810 100%)' }}>
      <aside className="md:w-60 md:min-h-screen md:sticky md:top-0 md:self-start flex-shrink-0 border-b md:border-b-0 md:border-r border-white/10 p-4">
        <button onClick={() => navigate('/lobby')} className="flex items-center gap-2 text-white/50 hover:text-white text-xs mb-4 transition">
          <ArrowLeft className="w-4 h-4" /> Back to site
        </button>
        <h1 className="text-white font-bold text-lg mb-4">Owner Console</h1>
        <nav className="flex md:block gap-4 overflow-x-auto md:overflow-visible">
          {SECTIONS.map(s => (
            <div key={s.title} className="md:mb-5 flex-shrink-0">
              <p className="hidden md:block text-[10px] uppercase tracking-wider text-white/30 mb-1.5 px-3">{s.title}</p>
              <div className="flex md:block gap-1">
                {s.items.map(i => (
                  <NavLink key={i.to} to={i.to} end={i.end} className={linkClass}>
                    <i.icon className="w-4 h-4 flex-shrink-0" />
                    <span className="whitespace-nowrap">{i.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>
      <main className="flex-1 min-w-0 p-4 md:p-8">
        <div className="max-w-6xl mx-auto"><Outlet /></div>
      </main>
    </div>
  );
}

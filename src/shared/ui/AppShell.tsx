import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageCircle, Users, Newspaper, User, Settings } from 'lucide-react';

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Chat',     path: '/chat',       icon: MessageCircle },
  { label: 'Lobby',    path: '/lobby',      icon: Users },
  { label: 'Feed',     path: '/daily-feed', icon: Newspaper },
  { label: 'Profile',  path: '/profile',    icon: User },
  { label: 'Settings', path: '/settings',   icon: Settings },
];

interface AppShellProps {
  children: ReactNode;
  showNav?: boolean;
  className?: string;
}

export function AppShell({ children, showNav = true, className = '' }: AppShellProps) {
  const location = useLocation();

  const isActive = (p: string) =>
    location.pathname === p || location.pathname.startsWith(p + '/');

  return (
    <div className={`min-h-screen flex flex-col ${className}`} style={{ background: 'linear-gradient(180deg, #0d1128 0%, #090c1e 50%, #060810 100%)' }}>
      <main className={`flex-1 ${showNav ? 'pb-20 md:pb-0 md:pl-16' : ''}`}>
        {children}
      </main>

      {showNav && (
        <>
          {/* Mobile bottom bar */}
          <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden"
            style={{ background: 'rgba(10,12,48,0.92)', borderTop: '1px solid rgba(100,120,255,0.25)', backdropFilter: 'blur(20px)' }}>
            <div className="flex items-center justify-around px-2 py-2">
              {NAV_ITEMS.map(item => {
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.label}
                    to={item.path}
                    className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors"
                    aria-label={item.label}
                  >
                    <div className="relative">
                      <item.icon className={`w-5 h-5 transition-colors ${active ? 'text-primary-400' : 'text-ink-subtle'}`} />
                      {active && (
                        <motion.div
                          layoutId="nav-dot"
                          className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary-500"
                        />
                      )}
                    </div>
                    <span className={`text-2xs font-medium ${active ? 'text-primary-400' : 'text-ink-subtle'}`}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Desktop sidebar */}
          <nav className="hidden md:flex fixed left-0 top-0 bottom-0 w-16 z-40 flex-col items-center py-6"
            style={{ background: 'rgba(10,12,48,0.92)', borderRight: '1px solid rgba(100,120,255,0.22)', backdropFilter: 'blur(20px)' }}>
            <div className="flex flex-col items-center gap-1 mt-4">
              {NAV_ITEMS.map(item => {
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.label}
                    to={item.path}
                    title={item.label}
                    className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 group ${
                      active ? 'text-primary-400' : 'text-ink-subtle hover:text-ink-secondary'
                    }`}
                    style={active ? { background: 'rgba(244,63,107,0.15)' } : {}}
                  >
                    {active && (
                      <motion.div
                        layoutId="sidebar-active"
                        className="absolute inset-0 rounded-xl"
                        style={{ background: 'rgba(244,63,107,0.15)' }}
                      />
                    )}
                    <item.icon className="w-5 h-5 relative z-10" />
                    <span className="absolute left-full ml-2 px-2 py-1 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap"
                      style={{ background: 'rgba(28,25,48,0.95)', border: '1px solid rgba(80,70,130,0.40)' }}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>
        </>
      )}
    </div>
  );
}

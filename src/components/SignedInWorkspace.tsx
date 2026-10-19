import { useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Compass,
  Crown,
  FolderKanban,
  Gamepad2,
  Goal,
  Home,
  Lightbulb,
  LogOut,
  MessageCircle,
  Settings,
  Sparkles,
  Volume2,
  VolumeX,
  Users,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../shared/supabase/client';
import { MessagingOverlayMount } from './MessagingOverlayMount';

interface SignedInWorkspaceProps {
  children: ReactNode;
}

interface NavigationItem {
  label: string;
  path: string;
  icon: typeof Home;
  match?: string[];
}

const navigationItems: NavigationItem[] = [
  { label: 'Home', path: '/lobby', icon: Home },
  { label: 'Daily Feed', path: '/daily-feed', icon: Compass },
  { label: 'Calendar', path: '/calendar', icon: CalendarDays },
  { label: 'Insights', path: '/insights', icon: Lightbulb },
  { label: 'Goals', path: '/coaching-progress', icon: Goal, match: ['/coaching-progress', '/coaching-commitments', '/coaching-library', '/goal/'] },
  { label: 'Community', path: '/community', icon: Users, match: ['/community'] },
  { label: 'Co-Author', path: '/co-author', icon: FolderKanban },
  { label: 'Profile', path: '/profile', icon: CircleUserRound },
];

const utilityItems: NavigationItem[] = [
  { label: 'Messages', path: '/chat', icon: MessageCircle },
  { label: 'Games', path: '/checkers', icon: Gamepad2, match: ['/checkers', '/pacman', '/momentum', '/slime-soccer', '/stellar-pursuit'] },
  { label: 'Settings', path: '/settings', icon: Settings },
];

const excludedPrefixes = [
  '/signin',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/splash',
  '/welcome',
  '/onboarding',
  '/create-user-avatar',
  '/age-verification',
];

function isExcludedPath(pathname: string): boolean {
  return excludedPrefixes.some(prefix => pathname.startsWith(prefix));
}

function isActive(item: NavigationItem, pathname: string): boolean {
  if (item.match) return item.match.some(prefix => pathname.startsWith(prefix));
  return pathname === item.path || pathname.startsWith(`${item.path}/`);
}

function NavigationLink({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: NavigationItem;
  pathname: string;
  collapsed: boolean;
  onNavigate: (path: string) => void;
}) {
  const Icon = item.icon;
  const active = isActive(item, pathname);

  return (
    <button
      type="button"
      onClick={() => onNavigate(item.path)}
      className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200 ${
        active
          ? 'bg-rose-500/15 text-rose-200 shadow-[inset_0_0_0_1px_rgba(244,63,107,0.28)]'
          : 'text-ink-muted hover:bg-white/7 hover:text-ink'
      } ${collapsed ? 'justify-center px-2' : ''}`}
      aria-label={item.label}
      title={collapsed ? item.label : undefined}
    >
      <Icon className={`h-[18px] w-[18px] flex-shrink-0 ${active ? 'text-rose-300' : 'text-current'}`} />
      {!collapsed && <span className="truncate text-xs font-medium">{item.label}</span>}
      {active && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-rose-400" />}
    </button>
  );
}

function WorkspaceNavigation({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <aside
      className="relative z-20 hidden min-h-0 flex-col border-r border-white/8 bg-[rgba(12,10,30,0.84)] py-4 backdrop-blur-2xl transition-[width] duration-300 lg:flex"
      style={{ width: collapsed ? 68 : 216 }}
    >
      <div className={`flex items-center px-3 ${collapsed ? 'justify-center' : 'justify-end'}`}>
        <button
          type="button"
          onClick={onToggle}
          className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-white/8 hover:text-ink"
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <div className="mt-6 flex-1 overflow-y-auto px-2">
        {!collapsed && <p className="mb-2 px-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">Navigate</p>}
        <nav className="space-y-1">
          {navigationItems.map(item => (
            <NavigationLink
              key={item.path}
              item={item}
              pathname={location.pathname}
              collapsed={collapsed}
              onNavigate={navigate}
            />
          ))}
        </nav>

        <div className="my-4 border-t border-white/8" />
        {!collapsed && <p className="mb-2 px-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">Connect</p>}
        <nav className="space-y-1">
          {utilityItems.map(item => (
            <NavigationLink
              key={item.path}
              item={item}
              pathname={location.pathname}
              collapsed={collapsed}
              onNavigate={navigate}
            />
          ))}
        </nav>
      </div>

      {!collapsed && (
        <div className="mx-3 mt-3 rounded-xl border border-amber-300/15 bg-amber-300/7 p-3">
          <div className="flex items-center gap-2 text-amber-200">
            <Crown className="h-3.5 w-3.5" />
            <span className="text-[10px] font-semibold">Make space for yourself</span>
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-ink-muted">Your tools and conversations stay close while you explore.</p>
        </div>
      )}
    </aside>
  );
}

function WorkspaceToolbar() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<'classic' | 'v3'>(() => {
    if (typeof window === 'undefined') return 'v3';
    return window.localStorage.getItem('velvet.workspace.mode') === 'classic' ? 'classic' : 'v3';
  });
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem('velvet.workspace.sound') !== 'off';
  });

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Your space';

  const selectMode = (nextMode: 'classic' | 'v3') => {
    setMode(nextMode);
    window.localStorage.setItem('velvet.workspace.mode', nextMode);
  };

  const toggleSound = () => {
    setSoundEnabled(enabled => {
      const nextEnabled = !enabled;
      window.localStorage.setItem('velvet.workspace.sound', nextEnabled ? 'on' : 'off');
      return nextEnabled;
    });
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) navigate('/signin');
  };

  return (
    <header className="relative z-30 flex min-h-[60px] flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[rgba(14,12,35,0.9)] px-3 py-2.5 backdrop-blur-2xl sm:px-5">
      <button
        type="button"
        onClick={() => navigate('/lobby')}
        className="flex min-w-0 items-center gap-2.5 text-left"
        title="Velvet home"
      >
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300">
          <Sparkles className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-ink">Velvet</span>
          <span className="block max-w-[130px] truncate text-[10px] text-ink-muted sm:max-w-none">{displayName}</span>
        </span>
      </button>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="flex items-center rounded-xl border border-white/10 bg-black/10 p-0.5" aria-label="Workspace appearance">
          <button
            type="button"
            onClick={() => selectMode('classic')}
            aria-pressed={mode === 'classic'}
            className={`rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition-colors sm:px-3 ${mode === 'classic' ? 'bg-white/12 text-ink' : 'text-ink-muted hover:text-ink'}`}
          >
            Classic
          </button>
          <button
            type="button"
            onClick={() => selectMode('v3')}
            aria-pressed={mode === 'v3'}
            className={`rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition-colors sm:px-3 ${mode === 'v3' ? 'bg-rose-500/20 text-rose-200' : 'text-ink-muted hover:text-ink'}`}
          >
            V3
          </button>
        </div>
        <button
          type="button"
          onClick={toggleSound}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 text-ink-muted transition-colors hover:bg-white/8 hover:text-ink"
          aria-label={soundEnabled ? 'Mute workspace sounds' : 'Enable workspace sounds'}
          title={soundEnabled ? 'Mute workspace sounds' : 'Enable workspace sounds'}
        >
          {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="hidden h-8 w-8 items-center justify-center rounded-xl border border-white/10 text-ink-muted transition-colors hover:bg-white/8 hover:text-ink sm:flex"
          aria-label="Open settings"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 text-ink-muted transition-colors hover:bg-rose-500/12 hover:text-rose-200"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

export function SignedInWorkspace({ children }: SignedInWorkspaceProps) {
  const { user } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem('velvet.workspace.nav-collapsed') !== 'false';
  });

  useEffect(() => {
    window.localStorage.setItem('velvet.workspace.nav-collapsed', String(collapsed));
  }, [collapsed]);

  const active = !!user && !isExcludedPath(location.pathname);
  if (!active) return <>{children}</>;

  return (
    <div className="min-h-screen bg-[#070914] p-1.5 sm:p-2.5 lg:p-4">
      <div className="relative flex min-h-[calc(100dvh-0.75rem)] flex-col overflow-hidden rounded-[18px] border border-white/12 bg-[var(--ds-bg-base,#090c1e)] shadow-[0_18px_70px_rgba(0,0,0,0.45)] sm:min-h-[calc(100dvh-1.25rem)] lg:min-h-[calc(100dvh-2rem)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,61,188,0.17),transparent_44%),radial-gradient(ellipse_at_bottom_left,rgba(244,63,107,0.08),transparent_42%)]" />
        <WorkspaceToolbar />
        <div className="relative z-10 grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[auto_minmax(0,1fr)]">
          <WorkspaceNavigation collapsed={collapsed} onToggle={() => setCollapsed(value => !value)} />
          <main className="min-h-0 min-w-0 overflow-y-auto overflow-x-hidden border-r border-white/8">
            {children}
          </main>
        </div>
        <div className="relative z-20 flex-shrink-0 border-t border-white/10 bg-[rgba(8,8,22,0.96)] shadow-[0_-14px_36px_rgba(0,0,0,0.18)]">
          <MessagingOverlayMount />
        </div>
        <div className="pointer-events-none absolute inset-0 rounded-[18px] ring-1 ring-inset ring-white/5" />
      </div>
    </div>
  );
}

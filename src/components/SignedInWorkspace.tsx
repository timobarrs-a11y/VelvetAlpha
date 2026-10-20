import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Layers,
  LayoutGrid,
  Lightbulb,
  LogOut,
  MapPin,
  Newspaper,
  Plus,
  Settings,
  Sparkles,
  Sunrise,
  Target,
  Bot,
  FileText,
  UsersRound,
  Zap,
  Users,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../shared/supabase/client';
import { MessagingOverlayMount } from './MessagingOverlayMount';
import { setAvailableToChat } from '../shared/supabase/queries/messaging';
import { useLobbyData, GAMES } from '../hooks/useLobbyData';
import { Avatar } from './Avatar';
import { companionAvatarConfig, TONE_COLOR } from './lobby';
import type { CompanionWithLastMessage } from '../services/companionService';

interface SignedInWorkspaceProps {
  children: ReactNode;
}

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

function WorkspaceToolbar({
  available,
  onToggleAvailable,
  onOpenMobileNav,
}: {
  available: boolean;
  onToggleAvailable: () => void;
  onOpenMobileNav: () => void;
}) {
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
      <div className="flex min-w-0 items-center gap-2.5">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-ink-muted transition-colors hover:bg-white/8 hover:text-ink lg:hidden"
          aria-label="Open navigation"
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
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
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={onToggleAvailable}
          className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[10px] font-semibold transition-colors ${
            available
              ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
              : 'border-white/10 bg-black/10 text-ink-muted hover:text-ink'
          }`}
          aria-pressed={available}
          title={available ? 'Available to chat — click to turn off' : 'Turn on instant chat availability'}
        >
          {available ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{available ? 'Available' : 'Unavailable'}</span>
        </button>
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


type LobbyData = ReturnType<typeof useLobbyData>;

function SidebarLabel({ children }: { children: ReactNode }) {
  return <p className="px-2 pb-1 pt-1 text-[9px] font-bold uppercase tracking-[0.18em] text-ink-subtle">{children}</p>;
}

function PersonRow({ companion, coach, collapsed, pathname, onClick }: { companion: CompanionWithLastMessage; coach?: boolean; collapsed: boolean; pathname: string; onClick: () => void }) {
  const active = pathname.startsWith(`/chat?companion=${companion.id}`) || pathname.includes(`companion=${companion.id}`);
  const line = companion.last_message_text || (companion.last_message_at ? new Date(companion.last_message_at).toLocaleDateString() : 'Say hello');
  return (
    <button type="button" onClick={onClick} className={`group flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors ${active ? 'bg-emerald-400/10' : 'hover:bg-white/7'}`} title={collapsed ? companion.custom_name : undefined}>
      <div className={`relative flex-shrink-0 overflow-hidden rounded-full border ${coach ? 'h-10 w-10 border-emerald-400/70' : 'h-8 w-8 border-white/10'}`}>
        <Avatar config={companionAvatarConfig(companion)} className="h-full w-full" />
        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#0c0a1e] bg-emerald-400" />
      </div>
      {!collapsed && (
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[11px] font-semibold text-ink">{companion.custom_name}</span>
            {coach && <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[8px] font-bold text-emerald-300">Coach</span>}
          </div>
          <p className="mt-0.5 truncate text-[10px] leading-tight text-ink-muted">{line}</p>
        </div>
      )}
    </button>
  );
}

function ToolRow({ label, icon, tone, path, collapsed, pathname, onNavigate }: { label: string; icon: ReactNode; tone: string; path: string; collapsed: boolean; pathname: string; onNavigate: (path: string) => void }) {
  const active = pathname === path || pathname.startsWith(`${path}/`);
  return (
    <button type="button" onClick={() => onNavigate(path)} className={`group relative flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors ${active ? 'bg-rose-500/15 text-ink' : 'text-ink-muted hover:bg-white/7 hover:text-ink'}`} title={collapsed ? label : undefined}>
      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-white/5" style={{ color: tone }}>{icon}</span>
      {!collapsed && <span className="truncate text-[11px] font-semibold">{label}</span>}
      {active && <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-rose-400" />}
    </button>
  );
}

function SidebarContent({ collapsed, pathname, lobby, onNavigate }: { collapsed: boolean; pathname: string; lobby: LobbyData; onNavigate: (path: string) => void }) {
  const coaches = lobby.companions.filter(companion => companion.relationship_type === 'mentor');
  const companions = lobby.companions.filter(companion => companion.relationship_type !== 'mentor');
  const coreTools = [
    { label: 'Daily Feed', path: '/daily-feed', tone: '#34d399', icon: <Newspaper className="h-3.5 w-3.5" /> },
    { label: 'Calendar', path: '/calendar', tone: '#fb923c', icon: <CalendarDays className="h-3.5 w-3.5" /> },
    { label: 'Co-Author', path: '/co-author', tone: '#60a5fa', icon: <FileText className="h-3.5 w-3.5" /> },
    { label: 'Insights', path: '/insights', tone: '#fbbf24', icon: <Lightbulb className="h-3.5 w-3.5" /> },
    { label: 'Morning Journal', path: '/morning-journal', tone: '#fbbf24', icon: <Sunrise className="h-3.5 w-3.5" /> },
    { label: 'Profile', path: '/profile', tone: '#cbd5e1', icon: <CircleUserRound className="h-3.5 w-3.5" /> },
  ];
  const connectTools = [
    { label: 'Atlas', path: '/atlas', tone: '#cbd5e1', icon: <Bot className="h-3.5 w-3.5" /> },
    { label: 'Navi', path: '/local-explorer', tone: '#34d399', icon: <MapPin className="h-3.5 w-3.5" /> },
    { label: 'Group Chat', path: '/group-chat', tone: '#2dd4bf', icon: <UsersRound className="h-3.5 w-3.5" /> },
    { label: 'Velvet Rope', path: '/real-or-not', tone: '#f472b6', icon: <Zap className="h-3.5 w-3.5" /> },
    { label: 'Community', path: '/community', tone: '#60a5fa', icon: <Users className="h-3.5 w-3.5" /> },
  ];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {!collapsed && (
          <div className="flex items-center justify-between px-2 pb-1 pt-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink-subtle">Navigate</p>
            <button type="button" onClick={() => onNavigate('/settings')} className="rounded-md p-0.5 text-ink-subtle transition-colors hover:bg-white/8 hover:text-ink-muted" title="Settings" aria-label="Settings"><Settings className="h-3 w-3" /></button>
          </div>
        )}
        {!collapsed && <div className="my-2 border-t border-white/8" />}
        <div className="space-y-0.5">
          {!collapsed && <SidebarLabel>Coaching</SidebarLabel>}
          {coaches.map(coach => <PersonRow key={coach.id} companion={coach} coach collapsed={collapsed} pathname={pathname} onClick={() => lobby.openCompanion(coach)} />)}
          <ToolRow label="Progress" path="/coaching-progress" tone={TONE_COLOR.coach} icon={<Target className="h-3.5 w-3.5" />} collapsed={collapsed} pathname={pathname} onNavigate={onNavigate} />
          <ToolRow label="Commitments" path="/coaching-commitments" tone="#38bdf8" icon={<CheckCircle2 className="h-3.5 w-3.5" />} collapsed={collapsed} pathname={pathname} onNavigate={onNavigate} />
          <ToolRow label="Plans" path="/coaching-commitments?view=plans" tone="#a78bfa" icon={<Layers className="h-3.5 w-3.5" />} collapsed={collapsed} pathname={pathname} onNavigate={onNavigate} />
          <ToolRow label="Library" path="/coaching-library" tone="#94a3b8" icon={<BookOpen className="h-3.5 w-3.5" />} collapsed={collapsed} pathname={pathname} onNavigate={onNavigate} />
          {!collapsed && <button type="button" onClick={lobby.handleNewCoach} className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-[10px] text-ink-muted transition-colors hover:bg-white/7 hover:text-ink"><Plus className="h-3.5 w-3.5" />Add another coach</button>}
        </div>
        <div className="my-3 border-t border-white/8" />
        <div className="space-y-0.5">
          {!collapsed && <SidebarLabel>Companion</SidebarLabel>}
          {companions.map(companion => <PersonRow key={companion.id} companion={companion} collapsed={collapsed} pathname={pathname} onClick={() => lobby.openCompanion(companion)} />)}
          {!collapsed && <button type="button" onClick={lobby.handleNewCompanion} className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-[10px] text-ink-muted transition-colors hover:bg-white/7 hover:text-ink"><Plus className="h-3.5 w-3.5" />Someone new</button>}
        </div>
        <div className="my-3 border-t border-white/8" />
        <div className="space-y-0.5">
          {!collapsed && <SidebarLabel>Core</SidebarLabel>}
          {coreTools.map(tool => <ToolRow key={tool.path} {...tool} collapsed={collapsed} pathname={pathname} onNavigate={onNavigate} />)}
        </div>
        <div className="my-3 border-t border-white/8" />
        <div className="space-y-0.5">
          {!collapsed && <SidebarLabel>Connect</SidebarLabel>}
          {connectTools.map(tool => <ToolRow key={tool.path} {...tool} collapsed={collapsed} pathname={pathname} onNavigate={onNavigate} />)}
          {!collapsed && <SidebarLabel>Games</SidebarLabel>}
          {GAMES.map(game => <button key={game.id} type="button" onClick={() => lobby.handleGameClick(game)} className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors ${pathname.startsWith(game.path ?? `/${game.id}`) ? 'bg-white/8 text-ink' : 'text-ink-muted hover:bg-white/7 hover:text-ink'}`} title={collapsed ? game.name : undefined}><span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${game.iconBg}`}><game.icon className="h-3.5 w-3.5 text-white" /></span>{!collapsed && <span className="truncate text-[11px] font-semibold">{game.name}</span>}</button>)}
        </div>
      </div>
      <div className="flex-shrink-0 border-t border-white/8 px-2 py-2">
        <button type="button" onClick={() => onNavigate('/support')} className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors ${pathname === '/support' ? 'bg-amber-500/15 text-amber-200' : 'text-ink-muted hover:bg-amber-500/10 hover:text-amber-200'}`} title={collapsed ? 'Support Velvet' : undefined}>
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400"><Sparkles className="h-3.5 w-3.5" /></span>
          {!collapsed && <span className="truncate text-[11px] font-semibold">Support Velvet</span>}
        </button>
      </div>
    </div>
  );
}

function WorkspaceNavigation({ collapsed, onToggle, lobby }: { collapsed: boolean; onToggle: () => void; lobby: LobbyData }) {
  const location = useLocation();
  const navigate = useNavigate();
  return <aside className="relative z-20 hidden min-h-0 flex-col border-r border-white/8 bg-[rgba(12,10,30,0.84)] py-4 backdrop-blur-2xl transition-[width] duration-300 lg:flex" style={{ width: collapsed ? 68 : 224 }}><div className={`flex items-center px-3 ${collapsed ? 'justify-center' : 'justify-end'}`}><button type="button" onClick={onToggle} className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-white/8 hover:text-ink" aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} title={collapsed ? 'Expand navigation' : 'Collapse navigation'}>{collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</button></div><SidebarContent collapsed={collapsed} pathname={location.pathname} lobby={lobby} onNavigate={navigate} /></aside>;
}

function MobileNavDrawer({ open, onClose, lobby }: { open: boolean; onClose: () => void; lobby: LobbyData }) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex lg:hidden" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-label="Close navigation" onClick={onClose} />
      <div className="relative flex h-full w-[280px] max-w-[82vw] flex-col border-r border-white/12 bg-[rgba(12,10,30,0.96)] px-3 py-4 shadow-2xl">
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300"><Sparkles className="h-4 w-4" /></span><span className="text-sm font-semibold text-ink">Velvet</span></div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-ink-muted hover:bg-white/8 hover:text-ink" aria-label="Close navigation"><ChevronLeft className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 flex min-h-0 flex-1 flex-col"><SidebarContent collapsed={false} pathname={location.pathname} lobby={lobby} onNavigate={(path) => { navigate(path); onClose(); }} /></div>
      </div>
    </div>
  );
}

function useAvailability(user: { id: string } | null | undefined) {
  const [available, setAvailable] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('velvet.workspace.available') === 'true';
  });

  // Sync the flag to presence on mount and when it changes.
  useEffect(() => {
    if (!user) return;
    setAvailableToChat(available).catch(() => {});
  }, [user, available]);

  const toggle = useCallback(() => {
    setAvailable(prev => {
      const next = !prev;
      window.localStorage.setItem('velvet.workspace.available', String(next));
      return next;
    });
  }, []);

  return { available, toggleAvailable: toggle };
}

function ActiveWorkspace({ children, user }: { children: ReactNode; user: { id: string } }) {
  const location = useLocation();
  const lobby = useLobbyData();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem('velvet.workspace.nav-collapsed') !== 'false';
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    window.localStorage.setItem('velvet.workspace.nav-collapsed', String(collapsed));
  }, [collapsed]);

  const { available, toggleAvailable } = useAvailability(user);

  return (
    <div className="h-screen overflow-hidden bg-[#070914] p-1.5 sm:p-2.5 lg:p-4">
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[18px] bg-[var(--ds-bg-base,#090c1e)] shadow-[0_18px_70px_rgba(0,0,0,0.45)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(99,61,188,0.17),transparent_44%),radial-gradient(ellipse_at_bottom_left,rgba(244,63,107,0.08),transparent_42%)]" />
        <WorkspaceToolbar available={available} onToggleAvailable={toggleAvailable} onOpenMobileNav={() => setMobileNavOpen(true)} />
        <div className="relative z-10 grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[auto_minmax(0,1fr)]">
          <WorkspaceNavigation collapsed={collapsed} onToggle={() => setCollapsed(value => !value)} lobby={lobby} />
          <main className="min-h-0 min-w-0 overflow-hidden border-r border-white/8">{children}</main>
        </div>
        <div className="relative z-20 flex-shrink-0 border-t border-white/10 bg-[rgba(8,8,22,0.96)] shadow-[0_-14px_36px_rgba(0,0,0,0.18)]"><MessagingOverlayMount /></div>
        <MobileNavDrawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} lobby={lobby} />
      </div>
    </div>
  );
}

export function SignedInWorkspace({ children }: SignedInWorkspaceProps) {
  const { user } = useAuth();
  const location = useLocation();
  const active = !!user && !isExcludedPath(location.pathname);
  if (!active || !user) return <>{children}</>;
  return <ActiveWorkspace user={user} children={children} />;
}

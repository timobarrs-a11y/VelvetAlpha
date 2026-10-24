import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Compass,
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
  Home,
  Building2,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../shared/supabase/client';
import { MessagingOverlayMount } from './MessagingOverlayMount';
import { MedalToastHost } from './medals/MedalToast';
import { setAvailableToChat } from '../shared/supabase/queries/messaging';
import { useLobbyData, GAMES } from '../hooks/useLobbyData';
import { Avatar } from './Avatar';
import { companionAvatarConfig, TONE_COLOR } from './lobby';
import type { CompanionWithLastMessage } from '../services/companionService';
import { TOOLBAR_TEXT_COLOR_PRESETS, type ToolbarTextColorKey } from '../services/customizationService';
import { useCustomization } from '../hooks/useCustomization';
import { buildWallpaperMeta } from '../services/wallpaperService';
import { useAccess } from '../hooks/useAccess';
import { LockScreen } from './LockScreen';

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
  '/velvet-house',
  '/velvet-house-next',
  '/velvet-house-legacy',
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
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem('velvet.workspace.sound') !== 'off';
  });

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Your space';

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
    <header className="relative z-30 flex min-h-[60px] flex-wrap items-center justify-between gap-3 px-3 py-2.5 sm:px-5">
      {/* Frosted glass base with subtle rose tint */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-[rgba(12,10,30,0.82)] backdrop-blur-xl" />
      <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-r from-rose-500/[0.06] via-transparent to-rose-500/[0.04]" />
      {/* Subtle shimmer bottom border */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-0 h-px bg-gradient-to-r from-transparent via-rose-400/20 to-transparent" />
      <div className="relative z-10 flex min-w-0 items-center gap-2.5">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 transition-colors hover:bg-white/8 lg:hidden text-white/60"
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
            <span className="block truncate text-sm font-semibold text-white">Velvet</span>
            <span className="block max-w-[130px] truncate text-[10px] text-white/50 sm:max-w-none">{displayName}</span>
          </span>
        </button>
      </div>

      <div className="relative z-10 flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={onToggleAvailable}
          className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[10px] font-semibold transition-colors ${
            available
              ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
              : 'border-white/10 bg-white/[0.03] hover:bg-white/8 text-white/60'
          }`}
          aria-pressed={available}
          title={available ? 'Available to chat — click to turn off' : 'Turn on instant chat availability'}
        >
          {available ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{available ? 'Available' : 'Unavailable'}</span>
        </button>
        <button
          type="button"
          onClick={toggleSound}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 transition-colors hover:bg-white/8 text-white/60"
          aria-label={soundEnabled ? 'Mute workspace sounds' : 'Enable workspace sounds'}
          title={soundEnabled ? 'Mute workspace sounds' : 'Enable workspace sounds'}
        >
          {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="hidden h-8 w-8 items-center justify-center rounded-xl border border-white/10 transition-colors hover:bg-white/8 sm:flex text-white/60"
          aria-label="Open settings"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 transition-colors hover:bg-rose-500/12 hover:text-rose-200 text-white/60"
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

function SidebarLabel({ children, inkSubtle }: { children: ReactNode; inkSubtle: string }) {
  return <p className="px-2 pb-1 pt-1 text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: inkSubtle }}>{children}</p>;
}

function PersonRow({ companion, coach, collapsed, pathname, onClick, inkColor, inkMuted }: { companion: CompanionWithLastMessage; coach?: boolean; collapsed: boolean; pathname: string; onClick: () => void; inkColor: string; inkMuted: string }) {
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
            <span className="truncate text-[11px] font-semibold" style={{ color: inkColor }}>{companion.custom_name}</span>
            {coach && <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[8px] font-bold text-emerald-300">Coach</span>}
          </div>
          <p className="mt-0.5 truncate text-[10px] leading-tight" style={{ color: inkMuted }}>{line}</p>
        </div>
      )}
    </button>
  );
}

function ToolRow({ label, icon, tone, path, collapsed, pathname, onNavigate, inkColor, inkMuted }: { label: string; icon: ReactNode; tone: string; path: string; collapsed: boolean; pathname: string; onNavigate: (path: string) => void; inkColor: string; inkMuted: string }) {
  const active = pathname === path || pathname.startsWith(`${path}/`);
  return (
    <button type="button" onClick={() => onNavigate(path)} className={`group relative flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors ${active ? 'bg-rose-500/15' : 'hover:bg-white/7'}`} style={{ color: active ? inkColor : inkMuted }} title={collapsed ? label : undefined}>
      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-white/5" style={{ color: tone }}>{icon}</span>
      {!collapsed && <span className="truncate text-[11px] font-semibold" style={{ color: active ? inkColor : inkMuted }}>{label}</span>}
      {active && <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-rose-400" />}
    </button>
  );
}

function SidebarContent({ collapsed, pathname, lobby, onNavigate, inkColor, inkMuted, inkSubtle }: { collapsed: boolean; pathname: string; lobby: LobbyData; onNavigate: (path: string) => void; inkColor: string; inkMuted: string; inkSubtle: string }) {
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
    { label: 'My Page', path: '/my-profile', tone: '#f472b6', icon: <Sparkles className="h-3.5 w-3.5" /> },
    { label: 'House', path: '/house', tone: '#f472b6', icon: <Home className="h-3.5 w-3.5" /> },
    { label: 'Town', path: '/world', tone: '#f472b6', icon: <Building2 className="h-3.5 w-3.5" /> },
    { label: 'Feed', path: '/feed', tone: '#f472b6', icon: <Sparkles className="h-3.5 w-3.5" /> },
    { label: 'Discover', path: '/discover', tone: '#fbbf24', icon: <Compass className="h-3.5 w-3.5" /> },
    { label: 'Atlas', path: '/atlas', tone: '#cbd5e1', icon: <Bot className="h-3.5 w-3.5" /> },
    { label: 'Navi', path: '/local-explorer', tone: '#34d399', icon: <MapPin className="h-3.5 w-3.5" /> },
    { label: 'Group Chat', path: '/group-chat', tone: '#2dd4bf', icon: <UsersRound className="h-3.5 w-3.5" /> },
    { label: 'Velvet Rope', path: '/real-or-not', tone: '#f472b6', icon: <Zap className="h-3.5 w-3.5" /> },
  ];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {!collapsed && (
          <div className="flex items-center justify-between px-2 pb-1 pt-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: inkSubtle }}>Navigate</p>
            <button type="button" onClick={() => onNavigate('/background-settings')} className="rounded-md p-0.5 transition-colors hover:bg-white/8" style={{ color: inkSubtle }} title="Settings" aria-label="Settings"><Settings className="h-3 w-3" /></button>
          </div>
        )}
        {!collapsed && <div className="my-2 border-t border-white/8" />}
        <div className="space-y-0.5">
          {!collapsed && <SidebarLabel inkSubtle={inkSubtle}>Coaching</SidebarLabel>}
          {coaches.map(coach => <PersonRow key={coach.id} companion={coach} coach collapsed={collapsed} pathname={pathname} onClick={() => lobby.openCompanion(coach)} inkColor={inkColor} inkMuted={inkMuted} />)}
          <ToolRow label="Progress" path="/coaching-progress" tone={TONE_COLOR.coach} icon={<Target className="h-3.5 w-3.5" />} collapsed={collapsed} pathname={pathname} onNavigate={onNavigate} inkColor={inkColor} inkMuted={inkMuted} />
          <ToolRow label="Commitments" path="/coaching-commitments" tone="#38bdf8" icon={<CheckCircle2 className="h-3.5 w-3.5" />} collapsed={collapsed} pathname={pathname} onNavigate={onNavigate} inkColor={inkColor} inkMuted={inkMuted} />
          <ToolRow label="Plans" path="/coaching-commitments?view=plans" tone="#a78bfa" icon={<Layers className="h-3.5 w-3.5" />} collapsed={collapsed} pathname={pathname} onNavigate={onNavigate} inkColor={inkColor} inkMuted={inkMuted} />
          <ToolRow label="Library" path="/coaching-library" tone="#94a3b8" icon={<BookOpen className="h-3.5 w-3.5" />} collapsed={collapsed} pathname={pathname} onNavigate={onNavigate} inkColor={inkColor} inkMuted={inkMuted} />
          {!collapsed && <button type="button" onClick={lobby.handleNewCoach} className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-[10px] transition-colors hover:bg-white/7" style={{ color: inkMuted }}><Plus className="h-3.5 w-3.5" />Add another coach</button>}
        </div>
        <div className="my-3 border-t border-white/8" />
        <div className="space-y-0.5">
          {!collapsed && <SidebarLabel inkSubtle={inkSubtle}>Companion</SidebarLabel>}
          {companions.map(companion => <PersonRow key={companion.id} companion={companion} collapsed={collapsed} pathname={pathname} onClick={() => lobby.openCompanion(companion)} inkColor={inkColor} inkMuted={inkMuted} />)}
          {!collapsed && <button type="button" onClick={lobby.handleNewCompanion} className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-[10px] transition-colors hover:bg-white/7" style={{ color: inkMuted }}><Plus className="h-3.5 w-3.5" />Someone new</button>}
        </div>
        <div className="my-3 border-t border-white/8" />
        <div className="space-y-0.5">
          {!collapsed && <SidebarLabel inkSubtle={inkSubtle}>Core</SidebarLabel>}
          {coreTools.map(tool => <ToolRow key={tool.path} {...tool} collapsed={collapsed} pathname={pathname} onNavigate={onNavigate} inkColor={inkColor} inkMuted={inkMuted} />)}
        </div>
        <div className="my-3 border-t border-white/8" />
        <div className="space-y-0.5">
          {!collapsed && <SidebarLabel inkSubtle={inkSubtle}>Connect</SidebarLabel>}
          {connectTools.map(tool => <ToolRow key={tool.path} {...tool} collapsed={collapsed} pathname={pathname} onNavigate={onNavigate} inkColor={inkColor} inkMuted={inkMuted} />)}
          {!collapsed && <SidebarLabel inkSubtle={inkSubtle}>Games</SidebarLabel>}
          {GAMES.map(game => <button key={game.id} type="button" onClick={() => lobby.handleGameClick(game)} className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors ${pathname.startsWith(game.path ?? `/${game.id}`) ? 'bg-white/8' : 'hover:bg-white/7'}`} style={{ color: pathname.startsWith(game.path ?? `/${game.id}`) ? inkColor : inkMuted }} title={collapsed ? game.name : undefined}><span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${game.iconBg}`}><game.icon className="h-3.5 w-3.5 text-white" /></span>{!collapsed && <span className="truncate text-[11px] font-semibold" style={{ color: pathname.startsWith(game.path ?? `/${game.id}`) ? inkColor : inkMuted }}>{game.name}</span>}</button>)}
        </div>
      </div>
      <div className="flex-shrink-0 border-t border-white/8 px-2 py-2">
        <button type="button" onClick={() => onNavigate('/support')} className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors ${pathname === '/support' ? 'bg-amber-500/15 text-amber-200' : 'hover:bg-amber-500/10 hover:text-amber-200'}`} style={pathname === '/support' ? undefined : { color: inkMuted }} title={collapsed ? 'Support Velvet' : undefined}>
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400"><Sparkles className="h-3.5 w-3.5" /></span>
          {!collapsed && <span className="truncate text-[11px] font-semibold" style={{ color: pathname === '/support' ? '#fcd34d' : inkMuted }}>Support Velvet</span>}
        </button>
      </div>
    </div>
  );
}

function WorkspaceNavigation({ collapsed, onToggle, lobby, wallpaperStyle, wallpaperClass, inkColor, inkMuted, inkSubtle }: { collapsed: boolean; onToggle: () => void; lobby: LobbyData; wallpaperStyle?: React.CSSProperties; wallpaperClass?: string; inkColor: string; inkMuted: string; inkSubtle: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const hasWp = !!wallpaperClass || !!wallpaperStyle;
  return <aside className="relative z-20 hidden min-h-0 flex-col border-r border-white/8 py-4 transition-[width] duration-300 lg:flex" style={{ width: collapsed ? 68 : 224 }}>
    {hasWp && (
      <div className={`pointer-events-none absolute inset-0 z-0 ${wallpaperClass ?? ''}`} style={wallpaperStyle || undefined} />
    )}
    <div className="relative z-10 flex h-full flex-col bg-[rgba(12,10,30,0.6)]">
      <div className={`flex items-center px-3 ${collapsed ? 'justify-center' : 'justify-end'}`}><button type="button" onClick={onToggle} className="rounded-lg p-2 transition-colors hover:bg-white/8" style={{ color: inkMuted }} aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} title={collapsed ? 'Expand navigation' : 'Collapse navigation'}>{collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</button></div>
      <SidebarContent collapsed={collapsed} pathname={location.pathname} lobby={lobby} onNavigate={navigate} inkColor={inkColor} inkMuted={inkMuted} inkSubtle={inkSubtle} />
    </div>
  </aside>;
}

function MobileNavDrawer({ open, onClose, lobby, inkColor, inkMuted, inkSubtle }: { open: boolean; onClose: () => void; lobby: LobbyData; inkColor: string; inkMuted: string; inkSubtle: string }) {
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
          <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300"><Sparkles className="h-4 w-4" /></span><span className="text-sm font-semibold" style={{ color: inkColor }}>Velvet</span></div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 transition-colors hover:bg-white/8" style={{ color: inkMuted }} aria-label="Close navigation"><ChevronLeft className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 flex min-h-0 flex-1 flex-col"><SidebarContent collapsed={false} pathname={location.pathname} lobby={lobby} onNavigate={(path) => { navigate(path); onClose(); }} inkColor={inkColor} inkMuted={inkMuted} inkSubtle={inkSubtle} /></div>
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
  const { customization } = useCustomization();
  const { showLockScreen } = useAccess();
  const textColorKey: ToolbarTextColorKey = customization?.toolbar_text_color ?? 'light';
  const textColorDef = TOOLBAR_TEXT_COLOR_PRESETS.find(p => p.key === textColorKey) ?? TOOLBAR_TEXT_COLOR_PRESETS[0];
  const inkColor = textColorDef.color;
  const inkMuted = `${textColorDef.color}99`;
  const inkSubtle = `${textColorDef.color}66`;
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem('velvet.workspace.nav-collapsed') !== 'false';
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    window.localStorage.setItem('velvet.workspace.nav-collapsed', String(collapsed));
  }, [collapsed]);

  const { available, toggleAvailable } = useAvailability(user);

  const wallpaperId = customization?.workspace_wallpaper_id ?? null;
  const wallpaperUrl = customization?.workspace_wallpaper_url ?? null;
  const wallpaperMeta = buildWallpaperMeta(wallpaperId, wallpaperUrl);
  const hasWallpaper = !!wallpaperId;
  const wpStyle = hasWallpaper ? wallpaperMeta.style : undefined;
  const wpClass = hasWallpaper ? wallpaperMeta.className : '';

  return (
    <div className="h-screen overflow-hidden bg-[#070914] p-1.5 sm:p-2.5 lg:p-4">
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[18px] bg-[var(--ds-bg-base,#090c1e)] shadow-[0_18px_70px_rgba(0,0,0,0.45)]">
        <WorkspaceToolbar available={available} onToggleAvailable={toggleAvailable} onOpenMobileNav={() => setMobileNavOpen(true)} />
        <div className="relative z-10 grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[auto_minmax(0,1fr)]">
          <WorkspaceNavigation collapsed={collapsed} onToggle={() => setCollapsed(value => !value)} lobby={lobby} wallpaperStyle={wpStyle} wallpaperClass={wpClass} inkColor={inkColor} inkMuted={inkMuted} inkSubtle={inkSubtle} />
          <main className="min-h-0 min-w-0 overflow-y-auto overflow-x-hidden border-r border-white/8">{children}</main>
        </div>
        <div className="relative z-20 flex-shrink-0"><MessagingOverlayMount inkColor={inkColor} inkMuted={inkMuted} /></div>
        <MedalToastHost />
        <MobileNavDrawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} lobby={lobby} inkColor={inkColor} inkMuted={inkMuted} inkSubtle={inkSubtle} />
      </div>
      {showLockScreen && !location.pathname.startsWith('/pricing') && !location.pathname.startsWith('/success') && !location.pathname.startsWith('/billing') && (
        <LockScreen />
      )}
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

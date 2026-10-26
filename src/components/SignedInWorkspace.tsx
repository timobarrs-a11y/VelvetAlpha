import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
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
  Pencil,
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
  Wand2,
  HelpCircle,
  Heart,
  PlayCircle,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../shared/supabase/client';
import { Dock } from './dock/Dock';
import { DockProvider, useDock } from './dock/DockContext';
import { AddFriendButton } from './AddFriendButton';
import { usePopoverPosition } from './usePopoverPosition';
import { MedalToastHost } from './medals/MedalToast';
import { setAvailableToChat, getMyFriendCode, formatFriendCode } from '../shared/supabase/queries/messaging';
import { useLobbyData, GAMES } from '../hooks/useLobbyData';
import { Avatar } from './Avatar';
import { useAvatarEditor } from '../stores/avatarEditorStore';
import { useMyAvatar } from '../hooks/useMyAvatar';
import { companionAvatarConfig, TONE_COLOR } from './lobby';
import type { CompanionWithLastMessage } from '../services/companionService';
import { TOOLBAR_TEXT_COLOR_PRESETS, type ToolbarTextColorKey } from '../services/customizationService';
import { useCustomization } from '../hooks/useCustomization';
import { buildWallpaperMeta } from '../services/wallpaperService';
import { useAccess } from '../hooks/useAccess';
import { LockScreen } from './LockScreen';
import { SubscriptionBanner } from './SubscriptionBanner';
import { useAudioScene } from '../hooks/useAudioScene';
import { CustomizationPanel } from './CustomizationPanel';
import { HomeLayoutSwitch } from '../shared/ui';

interface SignedInWorkspaceProps {
  children: ReactNode;
}

const excludedPrefixes = [
  '/login',
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
  '/shootout',
  '/velvet-house-next',
  '/velvet-house-legacy',
];

function isExcludedPath(pathname: string): boolean {
  return excludedPrefixes.some(prefix => pathname.startsWith(prefix));
}

// Re-point the shared pill/segment tokens so the Classic/V3 switch reads on the light bar.
const TOOLBAR_THEME = {
  '--ds-pill-bg': 'rgba(42,20,36,0.04)',
  '--ds-pill-bg-hover': 'rgba(42,20,36,0.08)',
  '--ds-pill-border': 'rgba(42,20,36,0.12)',
  '--ds-pill-fg': '#2a1424',
  '--ds-pill-fg-hover': '#2a1424',
  '--ds-accent-soft': '#db2777',
  '--ds-accent-line': '#db2777',
  '--ds-accent-fg': '#ffffff',
} as React.CSSProperties;

function WorkspaceToolbar({
  available,
  onToggleAvailable,
  onOpenMobileNav,
  onOpenRewards,
  lobby,
}: {
  available: boolean;
  onToggleAvailable: () => void;
  onOpenMobileNav: () => void;
  onOpenRewards: () => void;
  lobby: LobbyData;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const myAvatar = useMyAvatar();
  const openAvatarEditor = useAvatarEditor(s => s.open);
  const { muted, toggleMute } = useAudioScene();

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'Your space';
  // Your friend code, always on show like a phone number; tap to copy.
  const [friendCode, setFriendCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  useEffect(() => { getMyFriendCode().then(setFriendCode); }, []);
  const copyFriendCode = () => {
    if (!friendCode) return;
    navigator.clipboard?.writeText(friendCode).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 1800);
    }).catch(() => {});
  };

  // Anything waiting for you in the dock lights a dot on the toolbar button.
  const dock = useDock();
  const waiting = Object.values(dock.unread).reduce((n, c) => n + c, 0) + Object.values(dock.friendUnread).reduce((n, c) => n + c, 0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuStyle = usePopoverPosition(menuOpen, menuRef, 240);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [menuOpen]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) navigate('/signin');
  };

  return (
    <header className="relative z-30 flex min-h-[60px] flex-nowrap items-center justify-between gap-2 px-2.5 py-2.5 sm:gap-3 [@media(max-height:500px)]:min-h-[46px] [@media(max-height:500px)]:py-1 text-[#2a1424] sm:px-5" style={TOOLBAR_THEME}>
      {/* Warm blush white, pink as the accent */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-r from-[#fff7fa] to-[#fdf0f5]" />
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-0 h-px bg-[#f5cfe0]" />
      <div className="relative z-10 flex min-w-0 items-center gap-1.5 sm:gap-2.5">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[#2a1424]/12 transition-colors hover:bg-pink-50 lg:hidden text-[#2a1424]/80"
          aria-label={waiting ? `Open navigation, ${waiting} unread` : 'Open navigation'}
        >
          <LayoutGrid className="h-4 w-4" />
          {waiting > 0 && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#fff7fa] bg-rose-500" />}
        </button>
        {/* Your own face: a shortcut to your avatar editor. */}
        <button
          type="button"
          onClick={() => openAvatarEditor({ kind: 'user' })}
          className="group relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-full border border-pink-200 bg-pink-100 transition-shadow hover:ring-2 hover:ring-pink-300"
          title="Edit your avatar"
          aria-label="Edit your avatar"
        >
          {myAvatar
            ? <Avatar config={myAvatar} className="h-full w-full" />
            : <Sparkles className="mx-auto h-4 w-4 text-pink-600" />}
          <span className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity group-hover:opacity-100">
            <Pencil className="h-3.5 w-3.5 text-white" />
          </span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/lobby')}
          className="flex min-w-0 items-center gap-2.5 text-left"
          title="Velvet home"
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-[#2a1424]">Velvet</span>
            <span className="block max-w-[130px] truncate text-[10px] text-[#2a1424]/60 sm:max-w-none">{displayName}</span>
          </span>
        </button>
        {friendCode && (
          <button
            type="button"
            onClick={copyFriendCode}
            className="flex flex-shrink-0 flex-col items-start rounded-lg border border-[#2a1424]/10 px-2 py-0.5 text-left transition-colors hover:bg-pink-50"
            title="Your friend code. Tap to copy and give it to someone."
            aria-label={`Your friend code ${formatFriendCode(friendCode)}, tap to copy`}
          >
            <span className="text-[9px] uppercase tracking-wider text-[#2a1424]/50">{codeCopied ? 'Copied' : 'Friend code'}</span>
            <span className="font-mono text-xs font-semibold tracking-widest text-pink-600">{formatFriendCode(friendCode)}</span>
          </button>
        )}
        <AddFriendButton onAdd={dock.addFriendByCode} />
      </div>

      <div className="relative z-10 flex flex-shrink-0 items-center gap-1.5 sm:gap-2">
        {lobby.subscriptionInfo && (
          <div className="hidden sm:block"><SubscriptionBanner tier={lobby.subscriptionInfo.tier} messagesRemaining={lobby.subscriptionInfo.messagesRemaining} compact /></div>
        )}
        {/* Everything else lives in one menu, so the bar stays calm. */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen(o => !o)}
            className={`relative flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${menuOpen ? 'border-pink-300 bg-pink-50' : 'border-[#2a1424]/12 hover:bg-pink-50'} text-sm font-bold text-pink-600`}
            aria-expanded={menuOpen}
            aria-label="Your menu"
            title="Your menu"
          >
            {displayName.charAt(0).toUpperCase()}
            <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#fff7fa] ${available ? 'bg-emerald-500' : 'bg-gray-300'}`} />
          </button>
          {menuOpen && (
            <div style={menuStyle} className="z-[80] rounded-xl border border-[#f5cfe0] bg-white p-1.5 text-[#2a1424] shadow-xl">
              <div className="px-2.5 pb-2 pt-1.5">
                <p className="truncate text-sm font-semibold">{displayName}</p>
                <p className="text-[10px] text-[#2a1424]/55">{available ? 'Available to chat' : 'Not available to chat'}</p>
              </div>
              {lobby.subscriptionInfo && (
                <button type="button" onClick={() => { setMenuOpen(false); navigate('/pricing'); }} className="mx-1 mb-2 flex w-[calc(100%-0.5rem)] items-center justify-between rounded-lg bg-amber-50 px-2.5 py-1.5 text-left text-[11px] font-semibold text-amber-800 hover:bg-amber-100 sm:hidden">
                  <span className="capitalize">{lobby.subscriptionInfo.tier} plan</span>
                  <span className="font-normal">See plans</span>
                </button>
              )}
              <div className="px-2.5 pb-2"><HomeLayoutSwitch mode="compact" /></div>
              <div className="my-1 border-t border-[#f5cfe0]" />
              <button type="button" onClick={onToggleAvailable} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-[#2a1424]/85 hover:bg-pink-50">
                {available ? <Wifi className="h-4 w-4 text-emerald-600" /> : <WifiOff className="h-4 w-4" />}
                {available ? 'Available to chat' : 'Set available to chat'}
              </button>
              <button type="button" onClick={() => { setMenuOpen(false); onOpenRewards(); }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-[#2a1424]/85 hover:bg-pink-50">
                <Wand2 className="h-4 w-4 text-pink-600" />Loyalty rewards
              </button>
              <button type="button" onClick={toggleMute} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-[#2a1424]/85 hover:bg-pink-50">
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                {muted ? 'Unmute music' : 'Mute music'}
              </button>
              {lobby.companions.length > 0 && (
                <button type="button" onClick={() => { setMenuOpen(false); navigate(`/chat?companion=${lobby.companions[0].id}&tour=1`); }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-[#2a1424]/85 hover:bg-pink-50">
                  <HelpCircle className="h-4 w-4" />Take the tour
                </button>
              )}
              <button type="button" onClick={() => { setMenuOpen(false); navigate('/settings'); }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-[#2a1424]/85 hover:bg-pink-50">
                <Settings className="h-4 w-4" />Settings
              </button>
              <div className="my-1 border-t border-[#f5cfe0]" />
              <button type="button" onClick={handleSignOut} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-[#2a1424]/85 hover:bg-pink-50">
                <LogOut className="h-4 w-4" />Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}


type LobbyData = ReturnType<typeof useLobbyData>;

function SidebarLabel({ children, inkSubtle }: { children: ReactNode; inkSubtle: string }) {
  return <p className="px-2 pb-1 pt-1 text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: inkSubtle }}>{children}</p>;
}

function PersonRow({ companion, coach, collapsed, pathname, onClick, inkColor, inkMuted }: { companion: CompanionWithLastMessage; coach?: boolean; collapsed: boolean; pathname: string; onClick: () => void; inkColor: string; inkMuted: string }) {
  const openEditor = useAvatarEditor(s => s.open);
  const active = pathname.startsWith(`/chat?companion=${companion.id}`) || pathname.includes(`companion=${companion.id}`);
  const line = companion.last_message_text || (companion.last_message_at ? new Date(companion.last_message_at).toLocaleDateString() : 'Say hello');
  const edit = () => openEditor({ kind: 'companion', id: companion.id });
  // The face opens their avatar editor; the rest of the row opens the chat.
  // Collapsed, the face is the whole row, so it chats and a pencil edits.
  const face = (
    <div className={`relative flex-shrink-0 overflow-hidden rounded-full border ${coach ? 'h-10 w-10 border-emerald-400/70' : 'h-8 w-8 border-white/10'}`}>
      <Avatar config={companionAvatarConfig(companion)} className="h-full w-full" />
      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#0c0a1e] bg-emerald-400" />
      {!collapsed && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover/face:opacity-100">
          <Pencil className="h-3.5 w-3.5 text-white" />
        </span>
      )}
    </div>
  );
  return (
    <div className={`group relative flex w-full items-center gap-2.5 rounded-xl px-2 py-2 transition-colors ${active ? 'bg-emerald-400/10' : 'hover:bg-white/7'}`}>
      {collapsed ? (
        <>
          <button type="button" onClick={onClick} className="flex-shrink-0" title={companion.custom_name}>{face}</button>
          <button type="button" onClick={edit} aria-label={`Edit ${companion.custom_name}'s avatar`} title="Edit avatar"
            className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#0c0a1e] text-white/80 opacity-0 ring-1 ring-white/20 transition-opacity group-hover:opacity-100 focus-visible:opacity-100">
            <Pencil className="h-2.5 w-2.5" />
          </button>
        </>
      ) : (
        <>
          <button type="button" onClick={edit} className="group/face flex-shrink-0" aria-label={`Edit ${companion.custom_name}'s avatar`} title="Edit avatar">{face}</button>
          <button type="button" onClick={onClick} className="min-w-0 flex-1 text-left">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[11px] font-semibold" style={{ color: inkColor }}>{companion.custom_name}</span>
              {coach && <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[8px] font-bold text-emerald-300">Coach</span>}
            </div>
            <p className="mt-0.5 truncate text-[10px] leading-tight" style={{ color: inkMuted }}>{line}</p>
          </button>
        </>
      )}
    </div>
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
  // Your coaches and companions, with their faces, in the full toolbar only;
  // the folded rail stays icon-only.
  const coaches = collapsed ? [] : lobby.companions.filter(companion => companion.relationship_type === 'mentor');
  const companions = collapsed ? [] : lobby.companions.filter(companion => companion.relationship_type !== 'mentor');
  const coreTools = [
    { label: 'Daily Feed', path: '/daily-feed', tone: '#34d399', icon: <Newspaper className="h-3.5 w-3.5" /> },
    { label: 'Your Lens', path: '/videos', tone: '#fb7185', icon: <PlayCircle className="h-3.5 w-3.5" /> },
    { label: 'Calendar', path: '/calendar', tone: '#fb923c', icon: <CalendarDays className="h-3.5 w-3.5" /> },
    { label: 'Co-Author', path: '/co-author', tone: '#60a5fa', icon: <FileText className="h-3.5 w-3.5" /> },
    { label: 'Insights', path: '/insights', tone: '#fbbf24', icon: <Lightbulb className="h-3.5 w-3.5" /> },
    { label: 'Briefs', path: '/relationship-briefs', tone: '#fb7185', icon: <Heart className="h-3.5 w-3.5" /> },
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
        {lobby.setupResumeRoute && (
          <button
            type="button"
            onClick={lobby.resumeSetup}
            className="mb-2 flex w-full items-center gap-2.5 rounded-xl border border-pink-400/30 bg-pink-500/10 px-2 py-2 text-left transition-colors hover:bg-pink-500/15"
            title={collapsed ? 'Finish setup' : undefined}
          >
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-pink-500/20 text-pink-300"><Sparkles className="h-3.5 w-3.5" /></span>
            {!collapsed && (
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-semibold" style={{ color: inkColor }}>Finish setup</span>
                <span className="block truncate text-[10px]" style={{ color: inkMuted }}>Pick up where you left off</span>
              </span>
            )}
          </button>
        )}
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

function MobileNavDrawer({ open, onClose, lobby, wallpaperStyle, wallpaperClass, inkColor, inkMuted, inkSubtle }: { open: boolean; onClose: () => void; lobby: LobbyData; wallpaperStyle?: React.CSSProperties; wallpaperClass?: string; inkColor: string; inkMuted: string; inkSubtle: string }) {
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
      <div className="relative flex h-full w-[280px] max-w-[82vw] flex-col overflow-hidden border-r border-white/12 bg-[rgba(12,10,30,0.96)] shadow-2xl">
        {/* Your workspace wallpaper, same as the desktop sidebar */}
        {(wallpaperClass || wallpaperStyle) && (
          <div className={`pointer-events-none absolute inset-0 z-0 ${wallpaperClass ?? ''}`} style={wallpaperStyle || undefined} />
        )}
        <div className={`relative z-10 flex h-full flex-col px-3 py-4 ${wallpaperClass || wallpaperStyle ? 'bg-[rgba(12,10,30,0.6)]' : ''}`}>
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300"><Sparkles className="h-4 w-4" /></span><span className="text-sm font-semibold" style={{ color: inkColor }}>Velvet</span></div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 transition-colors hover:bg-white/8" style={{ color: inkMuted }} aria-label="Close navigation"><ChevronLeft className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 flex min-h-0 flex-1 flex-col"><SidebarContent collapsed={false} pathname={location.pathname} lobby={lobby} onNavigate={(path) => { navigate(path); onClose(); }} inkColor={inkColor} inkMuted={inkMuted} inkSubtle={inkSubtle} /></div>
      </div>
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
  const {
    customization,
    setPointer,
    setShowTrail,
    setTrailStyle,
    setAnimationStyle,
    setCursorColor,
    setButtonHoverStyle,
    setTranslucentUI,
    setToolbarBackgroundMode,
    setToolbarTextColor,
  } = useCustomization();
  const { showLockScreen } = useAccess();
  const [showRewards, setShowRewards] = useState(false);
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
    <DockProvider companions={lobby.companions}>
    <div className="fixed inset-0 overflow-hidden bg-[#070914] p-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] pl-[max(0.375rem,env(safe-area-inset-left))] pr-[max(0.375rem,env(safe-area-inset-right))] sm:p-2.5 lg:p-4 [@media(max-height:500px)]:p-1 [@media(max-height:500px)]:pl-[max(0.25rem,env(safe-area-inset-left))] [@media(max-height:500px)]:pr-[max(0.25rem,env(safe-area-inset-right))]">
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[18px] bg-[var(--ds-bg-base,#090c1e)] shadow-[0_18px_70px_rgba(0,0,0,0.45)]">
        <WorkspaceToolbar available={available} onToggleAvailable={toggleAvailable} onOpenMobileNav={() => setMobileNavOpen(true)} onOpenRewards={() => setShowRewards(true)} lobby={lobby} />
        <div className="relative z-10 grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[auto_minmax(0,1fr)]">
          <WorkspaceNavigation collapsed={collapsed} onToggle={() => setCollapsed(value => !value)} lobby={lobby} wallpaperStyle={wpStyle} wallpaperClass={wpClass} inkColor={inkColor} inkMuted={inkMuted} inkSubtle={inkSubtle} />
          <main className="min-h-0 min-w-0 overflow-y-auto overflow-x-hidden border-r border-white/8">{children}</main>
        </div>
        <div className="relative z-20 flex-shrink-0"><Dock /></div>
        <MedalToastHost />
        {customization && (
          <CustomizationPanel
            isOpen={showRewards}
            onClose={() => setShowRewards(false)}
            customization={customization}
            companions={lobby.companions}
            onSetPointer={setPointer}
            onSetShowTrail={setShowTrail}
            onSetTrailStyle={setTrailStyle}
            onSetAnimationStyle={setAnimationStyle}
            onSetCursorColor={setCursorColor}
            onSetButtonHoverStyle={setButtonHoverStyle}
            onSetTranslucentUI={setTranslucentUI}
            onSetToolbarBackgroundMode={setToolbarBackgroundMode}
            onSetToolbarTextColor={setToolbarTextColor}
            onCompanionFontUpdated={(companionId, fontFamily) => {
              lobby.setCompanionsList(prev =>
                prev.map(c => c.id === companionId ? { ...c, font_family: fontFamily } : c)
              );
            }}
          />
        )}
        <MobileNavDrawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} lobby={lobby} wallpaperStyle={wpStyle} wallpaperClass={wpClass} inkColor={inkColor} inkMuted={inkMuted} inkSubtle={inkSubtle} />
      </div>
      {showLockScreen && !location.pathname.startsWith('/pricing') && !location.pathname.startsWith('/success') && !location.pathname.startsWith('/billing') && (
        <LockScreen />
      )}
    </div>
    </DockProvider>
  );
}

export function SignedInWorkspace({ children }: SignedInWorkspaceProps) {
  const { user } = useAuth();
  const location = useLocation();
  const active = !!user && !isExcludedPath(location.pathname);
  if (!active || !user) return <>{children}</>;
  return <ActiveWorkspace user={user} children={children} />;
}

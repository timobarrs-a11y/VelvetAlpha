import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Crown, Cherry, Zap, Circle,
  Rocket, Brain, Home,
} from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { getCompanions, CompanionWithLastMessage } from '../services/companionService';
import { authService } from '../services/authService';
import { useSubscription } from './useSubscription';
import { useCustomization } from './useCustomization';
import { toast } from '../shared/ui/Toast';
import { newsService } from '../services/newsService';
import { getGroupChats, createGroupChat, deleteGroupChat, GroupChatWithMembers } from '../services/groupChatService';
import {
  SOMEONE_NEW_ROUTE, getSetupProgress, prepareResume, updateSetupProgress,
} from '../services/setupProgressService';

export interface GameEntry {
  id: string;
  name: string;
  description: string;
  icon: typeof Crown;
  iconBg: string;
  path?: string;
  requiresCompanion?: boolean;
}

export const GAMES: GameEntry[] = [
  { id: 'checkers',     name: 'Checkers',        description: 'Challenge an AI opponent with personality and banter',           icon: Crown,     iconBg: 'from-amber-500 to-orange-500',   path: '/checkers' },
  { id: 'momentum',     name: 'Momentum',        description: 'AI-generated platformer — each run has a unique hand-crafted world', icon: Zap,       iconBg: 'from-cyan-500 to-blue-600',      path: '/momentum' },
  { id: 'slime-soccer', name: 'Slime Soccer',    description: 'Classic physics-based slime soccer showdown',                        icon: Circle,    iconBg: 'from-fuchsia-500 to-pink-600',   path: '/slime-soccer' },
  { id: 'stellar',      name: 'Stellar Pursuit', description: 'Space shooter — navigate 9 sectors to rescue your family',          icon: Rocket,    iconBg: 'from-slate-600 to-slate-900',    path: '/stellar-pursuit' },
  { id: 'money-grab',   name: 'Money Grab',      description: 'Race to collect cash while dodging hammers and your companion',      icon: Cherry,    iconBg: 'from-yellow-400 to-orange-500',  requiresCompanion: true },
  { id: 'social-combat',  name: 'Social Combat',   description: 'Read emotions and master the art of conversation',                           icon: Brain,   iconBg: 'from-violet-500 to-indigo-600', path: '/social-combat' },
  { id: 'velvet-house',    name: 'Velvet House',    description: 'An interactive story where your companion comes alive in a cozy mystery',     icon: Home,    iconBg: 'from-rose-500 to-pink-700',      path: '/velvet-house', requiresCompanion: true },
  { id: 'velvet-house-next', name: 'Velvet House (Preview)', description: 'The rebuilt Velvet House — new engine, richer simulation. Work in progress.', icon: Home,    iconBg: 'from-amber-500 to-orange-600',   path: '/velvet-house-next' },
];

export interface ConfirmModal {
  title: string;
  message: string;
  onConfirm: () => Promise<void>;
}

export function useLobbyData() {
  const navigate = useNavigate();
  const [companions, setCompanions] = useState<CompanionWithLastMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGameModal, setShowGameModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [selectedGame, setSelectedGame] = useState<GameEntry | null>(null);
  const [groupChats, setGroupChats] = useState<GroupChatWithMembers[]>([]);
  const [confirmModal, setConfirmModal] = useState<ConfirmModal | null>(null);
  const [setupResumeRoute, setSetupResumeRoute] = useState<string | null>(null);
  const { subscriptionInfo } = useSubscription();
  const customizationHook = useCustomization();

  useEffect(() => { loadData(); }, []);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate('/create-user-avatar'); return; }
    const [companionsList, groupsList, progress] = await Promise.all([
      getCompanions(user.id),
      getGroupChats(),
      getSetupProgress(user.id),
    ]);
    // Unfinished setup is offered (sidebar "Finish setup", lobby card), never forced.
    const resumeRoute = prepareResume(progress, companionsList);
    if (progress && progress.path === 'coach_and_companion' && progress.step !== 'complete' && companionsList.some(c => c.relationship_type !== 'mentor' && c.is_active !== false)) {
      await updateSetupProgress(user.id, { step: 'complete' });
    }
    setSetupResumeRoute(resumeRoute);
    setCompanions(companionsList);
    setGroupChats(groupsList);
    setLoading(false);
    refreshDailyFeedInBackground();
  }, [navigate]);

  const refreshDailyFeedInBackground = useCallback(async () => {
    try {
      const now = Date.now();
      const SIX_HOURS = 6 * 60 * 60 * 1000;
      const last = Number(sessionStorage.getItem('velvet_lobby_news_refresh') || 0);
      if (now - last < SIX_HOURS) return;
      sessionStorage.setItem('velvet_lobby_news_refresh', String(now));

      const interests = await newsService.getUserAllInterests();
      if (interests.length === 0) return;
      await newsService.fetchLatestNews(interests);
    } catch { /* best-effort */ }
  }, []);

  const handleCreateGroupChat = useCallback(async (name: string, companionIds: string[]) => {
    const group = await createGroupChat(name, companionIds);
    if (group) navigate(`/group-chat?group=${group.id}`);
  }, [navigate]);

  const handleDeleteGroupChat = useCallback((groupId: string, groupName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmModal({
      title: 'Delete Group Chat',
      message: `Delete "${groupName}"? This will remove all messages.`,
      onConfirm: async () => {
        const ok = await deleteGroupChat(groupId);
        if (ok) setGroupChats(prev => prev.filter(g => g.id !== groupId));
        setConfirmModal(null);
      },
    });
  }, []);

  const handleGroupChatClick = useCallback(() => {
    if (companions.length < 2) {
      toast.error('Create at least 2 companions to start a group chat!');
    } else {
      setShowCreateGroupModal(true);
    }
  }, [companions.length]);

  const handleDeleteCompanion = useCallback((companionId: string, companionName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmModal({
      title: 'Delete Companion',
      message: `Delete ${companionName}? This will remove all conversation history.`,
      onConfirm: async () => {
        try {
          const { error } = await supabase.from('companions').delete().eq('id', companionId);
          if (error) throw error;
          setConfirmModal(null);
          await loadData();
        } catch {
          setConfirmModal(null);
          toast.error('Failed to delete companion. Please try again.');
        }
      },
    });
  }, [loadData]);

  const handleNewCompanion = useCallback(() => {
    navigate(SOMEONE_NEW_ROUTE);
  }, [navigate]);

  const resumeSetup = useCallback(() => {
    if (setupResumeRoute) navigate(setupResumeRoute);
  }, [navigate, setupResumeRoute]);

  const handleNewCoach = useCallback(() => {
    sessionStorage.setItem('onboardingIntent', 'coaches');
    sessionStorage.setItem('onboardingRelationshipType', 'mentor');
    navigate('/expert-selection');
  }, [navigate]);

  const handleGameClick = useCallback((game: GameEntry) => {
    if (game.requiresCompanion) {
      setSelectedGame(game);
      setShowGameModal(true);
    } else if (game.path) {
      navigate(game.path);
    }
  }, [navigate]);

  const handleSignOut = useCallback(async () => {
    await authService.signOut();
    navigate('/splash');
  }, [navigate]);

  const openHubPath = useCallback((p: string) => {
    navigate(p);
  }, [navigate]);

  const openCompanion = useCallback((companion: CompanionWithLastMessage) => {
    navigate(`/chat?companion=${companion.id}`);
  }, [navigate]);

  const openGroup = useCallback((groupId: string) => {
    navigate(`/group-chat?group=${groupId}`);
  }, [navigate]);

  return {
    companions,
    groupChats,
    loading,
    showGameModal,
    showCreateGroupModal,
    confirmModal,
    subscriptionInfo,
    customization: customizationHook.customization,
    customizationHook,
    selectedGame,
    setCompanionsList: setCompanions,
    setShowGameModal,
    setShowCreateGroupModal,
    setConfirmModal,
    loadData,
    handleCreateGroupChat,
    handleDeleteGroupChat,
    handleGroupChatClick,
    handleDeleteCompanion,
    handleNewCompanion,
    setupResumeRoute,
    resumeSetup,
    handleNewCoach,
    handleGameClick,
    handleSignOut,
    openHubPath,
    openCompanion,
    openGroup,
  };
}

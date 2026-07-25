import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarPlus, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatContainer } from './components/ChatContainer';
import { ChatInput } from './components/ChatInput';
import { ChatStyleBar } from './components/ChatStyleBar';
import FeedbackModal from './components/FeedbackModal';
import { VideoPlayer } from './components/VideoPlayer';
import { ChatHeader } from './components/ChatHeader';
import { Message } from './types';
import { ChatService } from './services/chatService';
import { setAppBridgeContext } from './services/appBridgeStore';
import { supabase } from './shared/supabase/client';
import { SubscriptionTier } from './types/subscription';
import { useSound } from './hooks/useSound';
import { getCompanion, getCompanions, updateLastMessageTime, claimFirstMessage, finalizeFirstMessage, resetFirstMessage, Companion, CompanionWithLastMessage } from './services/companionService';
import { getMessageTrackingInfo } from './services/messageTrackingService';
import { YouTubeService, VideoMetadata } from './services/youtubeService';
import { videoReactionService } from './services/videoReactionService';
import { AvatarConfig } from './types/avatar';
import { useSubscription } from './hooks/useSubscription';
import { getCurrentStatus } from './utils/statusHelper';
import { useMessages, useSendMessage } from './features/chat/hooks';
import { messagesKey } from './features/chat/queryKeys';
import { useQueryClient } from '@tanstack/react-query';
import { conversationOrchestrator } from './features/chat/orchestrator';
import { useAuth } from './auth/AuthProvider';
import { processEnhancedInsights } from './services/enhancedInsightsService';
import CBTReflectionDeckModal from './components/CBTReflectionDeckModal';
import { CompanionAppearanceModal } from './components/CompanionAppearanceModal';
import { AvatarConfigV2 } from './types/avatar-v2';
import { CookieConsent } from './components/CookieConsent';
import { WallpaperPickerModal } from './components/WallpaperPickerModal';
import { buildWallpaperMeta } from './services/wallpaperService';
import { BotPromptDrawer, ThreadMode } from './components/thread/ThreadToolbar';
import { QuickCommand, QuickCommandPopover } from './components/QuickCommandBar';
import { CompanionHubLeftRail } from './components/hub/CompanionHubLeftRail';
import { CompanionHubRightRail } from './components/hub/CompanionHubRightRail';
import { GuidedTourOverlay } from './components/hub/GuidedTourOverlay';
import { ThreadTabBar, ActiveThread } from './components/thread/ThreadTabBar';
import { TutorialElement } from './components/hub/TutorialElement';
import { ONBOARDING_ELEMENT_IDS } from './features/onboarding/onboardingPrompt';
import { useTutorialDirector } from './context/TutorialDirectorContext';
import { useCustomization } from './hooks/useCustomization';
import { onboardingService } from './services/onboardingService';
import { CalendarPanel } from './components/thread/CalendarPanel';
import { morningBriefService } from './services/morningBriefService';
import { useThreadBots } from './features/thread/useThreadBots';
import { BriefReadinessModal } from './components/BriefReadinessModal';
import { WorkScheduleSetupModal } from './components/WorkScheduleSetupModal';
import { NaviOnboardingModal } from './components/NaviOnboardingModal';
import { CustomizationPanel } from './components/CustomizationPanel';
import type { BriefReadiness } from './services/morningBriefService';
import { usePetStore, usePetRefs } from './stores/petStore';
import { PetCompanion, PetLevelToast } from './components/pet';
import { CalendarPage } from './pages/CalendarPage';
import { resolveExpert } from './services/expertService';
import { inspectVoiceFidelity, clearDriftCorrection } from './services/voiceFidelityService';
import { CoAuthorPage } from './pages/CoAuthorPage';
import { DailyFeedPage } from './pages/DailyFeedPage';
import { MessageRatingControls } from './components/MessageRatingControls';
import { RatingValue, getRatingsForMessages, clearConversationMessages, markRatingRegenerated } from './services/ratingService';
import { safeRandomUUID } from './utils/uuid';

function AppInner() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const companionId = searchParams.get('companion');

  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const petEnabled = usePetStore(s => s.enabled);
  const petToggle = usePetStore(s => s.toggle);
  const petName = usePetStore(s => s.name);
  const { startTour, isOnboarding } = useTutorialDirector();
  const tourAutoStartedRef = useRef(false);

  const [remainingMessages, setRemainingMessages] = useState(50);
  const [isTyping, setIsTyping] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [currentTier, setCurrentTier] = useState<SubscriptionTier>('free');
  const [companion, setCompanion] = useState<Companion | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showStartOverConfirm, setShowStartOverConfirm] = useState(false);
  const [isStartingOver, setIsStartingOver] = useState(false);
  const [ratingsMap, setRatingsMap] = useState<Record<string, RatingValue>>({});
  const [userAvatarConfig, setUserAvatarConfig] = useState<AvatarConfig | null>(null);
  const { subscriptionInfo, refreshSubscription } = useSubscription();
  const { playSound } = useSound();
  const { customization, setPointer, setShowTrail, setTrailStyle, setAnimationStyle, setCursorColor, setButtonHoverStyle, setTranslucentUI, setLeftRailCollapsed } = useCustomization();
  const [currentStatus, setCurrentStatus] = useState<string>('');
  const [dailyExperience, setDailyExperience] = useState<any>(null);

  const [showAppearanceModal, setShowAppearanceModal] = useState(false);
  const [showWallpaperModal, setShowWallpaperModal] = useState(false);
  const [showCustomizationPanel, setShowCustomizationPanel] = useState(false);
  const [allCompanions, setAllCompanions] = useState<CompanionWithLastMessage[]>([]);
  const [chatWallpaper, setChatWallpaper] = useState<string | null>(null);
  const [chatWallpaperUrl, setChatWallpaperUrl] = useState<string | null>(null);
  const [chatBubbleColor, setChatBubbleColor] = useState<string | null>(null);
  const [chatTextColor, setChatTextColor] = useState<string | null>(null);
  const [expertDomain, setExpertDomain] = useState<string | null>(null);
  const [companionBubbleColor, setCompanionBubbleColor] = useState<string | null>(null);
  const [companionTextColor, setCompanionTextColor] = useState<string | null>(null);
  const [lastCalendarEvent, setLastCalendarEvent] = useState<{ title: string; event_type: string; event_date: string } | null>(null);
  const calendarToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [currentVideo, setCurrentVideo] = useState<{ videoId: string; metadata: VideoMetadata; watchedVideoId: string } | null>(null);
  const [isWatchingVideo, setIsWatchingVideo] = useState(false);
  const lastReactionTimeRef = useRef<number>(0);

  const [activeMode, setActiveMode] = useState<ThreadMode>('chat');
  const [showCalendarPanel, setShowCalendarPanel] = useState(false);
  const [isBotLoading, setIsBotLoading] = useState(false);

  // Auto-minimize the left rail whenever a companion chat opens so the
  // conversation is the focus. User can still expand it manually mid-session.
  const [railAutoCollapsed, setRailAutoCollapsed] = useState(true);
  useEffect(() => { setRailAutoCollapsed(true); }, [companionId]);
  const isRailCollapsed = railAutoCollapsed || (customization?.left_rail_collapsed ?? false);
  const toggleRailCollapse = () => {
    if (railAutoCollapsed) {
      setRailAutoCollapsed(false);
      if (!(customization?.left_rail_collapsed ?? false)) setLeftRailCollapsed(true);
    } else {
      const next = !(customization?.left_rail_collapsed ?? false);
      setLeftRailCollapsed(next);
    }
  };

  // Conversation threads + feature tabs
  const [activeThread, setActiveThread] = useState<ActiveThread>('companion');
  const [openFeatures, setOpenFeatures] = useState<Array<'calendar' | 'co-author' | 'daily-feed' | 'your-lens'>>([]);
  const [atlasMessages, setAtlasMessages] = useState<Message[]>([]);
  const [naviMessages, setNaviMessages] = useState<Message[]>([]);
  const [atlasTyping, setAtlasTyping] = useState(false);
  const [naviTyping, setNaviTyping] = useState(false);

  const atlasMessagesRef = useRef<Message[]>([]);
  const naviMessagesRef = useRef<Message[]>([]);

  const [briefReadiness, setBriefReadiness] = useState<BriefReadiness | null>(null);
  const [showBriefReadiness, setShowBriefReadiness] = useState(false);
  const [showWorkScheduleModal, setShowWorkScheduleModal] = useState(false);
  const [showNaviOnboarding, setShowNaviOnboarding] = useState(false);

  const briefFiredRef = useRef<string | null>(null);
  const briefContextRef = useRef<{ calendar: string; news: string } | null>(null);
  const sendMessageRef = useRef<((content: string) => Promise<void>) | null>(null);
  const sendMorningBriefRef = useRef<((force?: boolean) => void) | null>(null);
  const sendContextThreadRef = useRef<((context: 'calendar' | 'insights' | 'coauthor') => void) | null>(null);
  const ritualFiredRef = useRef<string | null>(null);
  const resumptionFiredRef = useRef<string | null>(null);
  const insightsTurnCountRef = useRef<number>(0);
  const driftTurnCountRef = useRef<number>(0);

  const { data: rawMessages, isLoading: isLoadingMessages, error: messagesError } = useMessages(userId, companionId);
  const sendMessageMutation = useSendMessage();
  const queryClient = useQueryClient();

  const uiMessages: Message[] = (rawMessages ?? []).map((msg: any) => ({
    id: msg.id,
    content: msg.content,
    sender: msg.role === 'user' ? 'user' : 'ai',
    timestamp: new Date(msg.created_at).getTime(),
    messageType: msg.message_type ?? 'text',
    botSource: msg.bot_source ?? 'companion',
    metadata: msg.metadata ?? undefined,
  }));

  useEffect(() => {
    if (!userId || uiMessages.length === 0) return;
    const aiMessageIds = uiMessages.filter(m => m.sender === 'ai').map(m => m.id);
    if (aiMessageIds.length === 0) return;
    getRatingsForMessages(aiMessageIds)
      .then(map => {
        const simplified: Record<string, RatingValue> = {};
        for (const [mid, r] of Object.entries(map)) simplified[mid] = r.rating;
        setRatingsMap(simplified);
      })
      .catch(() => {});
  }, [userId, uiMessages.map(m => m.id).join(',')]);

  const getCharacterName = () => companion?.custom_name || 'Companion';

  const fetchDailyExperience = async (cid: string) => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) return;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/daily-experience?companionId=${cid}`;
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${currentSession.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) return;
      const experience = await response.json();
      setDailyExperience(experience);
      if (experience.status_timeline?.length > 0) {
        const status = getCurrentStatus(experience.status_timeline);
        if (status) setCurrentStatus(status.status);
      }
    } catch (error) {
      console.error('Error fetching daily experience:', error);
    }
  };

  const updateCurrentStatus = () => {
    if (dailyExperience?.status_timeline) {
      const status = getCurrentStatus(dailyExperience.status_timeline);
      if (status) setCurrentStatus(status.status);
    }
  };

  useEffect(() => {
    if (!authLoading && user) checkAuthAndOnboarding();
    const initNotifications = async () => {
      try {
        const { NotificationService } = await import('./services/notificationService');
        await NotificationService.initializeNotifications();
      } catch (e) {
        console.warn('[notifications] init failed:', e);
      }
    };
    initNotifications();
  }, [companionId, authLoading, user?.id]);

  useEffect(() => {
    if (subscriptionInfo) {
      setRemainingMessages(subscriptionInfo.messagesRemaining === -1 ? 999999 : subscriptionInfo.messagesRemaining);
    }
  }, [subscriptionInfo]);

  useEffect(() => {
    if (companionId) fetchDailyExperience(companionId);
  }, [companionId]);

  useEffect(() => {
    if (dailyExperience?.status_timeline) {
      updateCurrentStatus();
      const interval = setInterval(updateCurrentStatus, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [dailyExperience]);

  useEffect(() => {
    ritualFiredRef.current = null;
    resumptionFiredRef.current = null;
    briefFiredRef.current = null;
  }, [companionId]);

  // Listen for left-rail bot shortcuts to open threads
  useEffect(() => {
    const handler = (e: Event) => {
      const { bot } = (e as CustomEvent).detail as { bot: 'atlas' | 'navi' };
      setActiveThread(bot);
      if (bot === 'atlas' && atlasMessagesRef.current.length === 0) {
        const greeting: Message = {
          id: safeRandomUUID(),
          content: "Hey! Atlas here. What can I help you with — research, writing, strategy, anything?",
          sender: 'ai',
          timestamp: Date.now(),
          messageType: 'text',
          botSource: 'atlas',
        };
        atlasMessagesRef.current = [greeting];
        setAtlasMessages([greeting]);
      }
      if (bot === 'navi' && naviMessagesRef.current.length === 0) {
        const greeting: Message = {
          id: safeRandomUUID(),
          content: "Hey, Navi here! Tell me what you're looking for — places, events, things to do nearby?",
          sender: 'ai',
          timestamp: Date.now(),
          messageType: 'text',
          botSource: 'navi',
        };
        naviMessagesRef.current = [greeting];
        setNaviMessages([greeting]);
      }
    };
    window.addEventListener('hub:open-bot', handler);
    return () => window.removeEventListener('hub:open-bot', handler);
  }, []);

  // Listen for thread-opening events (insights / morning-brief — calendar/coauthor/feed now use hub:open-tab)
  useEffect(() => {
    const handler = (e: Event) => {
      const { context } = (e as CustomEvent).detail as { context: 'insights' | 'morning-brief' };
      if (context === 'morning-brief') {
        setActiveThread('navi');
        setNaviMessages([]);
        naviMessagesRef.current = [];
        sendMorningBriefRef.current?.();
      } else {
        setActiveThread('atlas');
        setAtlasMessages([]);
        atlasMessagesRef.current = [];
        sendContextThreadRef.current?.(context as any);
      }
    };
    window.addEventListener('hub:open-thread', handler);
    return () => window.removeEventListener('hub:open-thread', handler);
  }, []);

  // Listen for feature tab-opening events (calendar / co-author / daily-feed / your-lens)
  useEffect(() => {
    const handler = (e: Event) => {
      const { tab } = (e as CustomEvent).detail as { tab: 'calendar' | 'co-author' | 'daily-feed' | 'your-lens' };
      setOpenFeatures(prev => prev.includes(tab) ? prev : [...prev, tab]);
      setActiveThread(tab);
    };
    window.addEventListener('hub:open-tab', handler);
    return () => window.removeEventListener('hub:open-tab', handler);
  }, []);

  const checkAuthAndOnboarding = async () => {
    try {
      if (!companionId) { navigate('/lobby'); return; }
      if (!user) { navigate('/create-user-avatar'); return; }

      conversationOrchestrator.dispatch({ type: 'AUTH_READY', userId: user.id });

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('subscription_tier, is_super_user, avatar_config')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.is_super_user) setCurrentTier('elite');
      else if (profile?.subscription_tier) setCurrentTier(profile.subscription_tier as SubscriptionTier);

      if (profile?.avatar_config) setUserAvatarConfig(profile.avatar_config as AvatarConfig);

      const companionData = await getCompanion(companionId);
      if (!companionData) { navigate('/lobby'); return; }

      setCompanion(companionData);
      localStorage.setItem('velvet_last_companion', companionData.id);

      if (companionData.signature_expert) {
        resolveExpert(companionData.signature_expert, companionData.signature_expert_source, user.id)
          .then(expert => setExpertDomain(expert?.domain ?? null))
          .catch(() => {});
      } else {
        setExpertDomain(null);
      }

      // Load all companions for the font picker in CustomizationPanel
      getCompanions(user.id).then(all => setAllCompanions(all)).catch(() => {});
      setChatWallpaper((companionData as any).chat_wallpaper ?? null);
      setChatWallpaperUrl((companionData as any).chat_wallpaper_url ?? null);
      setChatBubbleColor((companionData as any).chat_bubble_color ?? null);
      setChatTextColor((companionData as any).chat_text_color ?? null);
      setCompanionBubbleColor((companionData as any).companion_bubble_color ?? null);
      setCompanionTextColor((companionData as any).companion_text_color ?? null);

      const matchRaw = sessionStorage.getItem('matchAnswers');
      const matchData = matchRaw ? JSON.parse(matchRaw) : {};
      const snapshot = { ...matchData, ...((companionData as any).questionnaire_data || {}) };

      if (!tourAutoStartedRef.current) {
        const wantsTour = searchParams.get('tour') === '1';
        const existingProgress = await onboardingService.getProgress(user.id).catch(() => null);
        const neverToured = !existingProgress || (!existingProgress.onboarding_complete && (existingProgress.steps_completed?.length ?? 0) === 0);
        if (wantsTour || neverToured) {
          tourAutoStartedRef.current = true;
          const source = wantsTour && existingProgress?.onboarding_complete ? 'manual_replay' : 'first_time';
          await onboardingService.initProgress(user.id, companionData.id, companionData.custom_name || 'your companion', snapshot, source).catch(() => {});
          startTour(source);
        }
      }

      conversationOrchestrator.dispatch({ type: 'COMPANION_SELECTED', companionId: companionData.id });
    } catch (error) {
      console.error('Error checking auth:', error);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  useEffect(() => {
    if (!messagesError) return;
  }, [messagesError]);

  useEffect(() => {
    if (!userId || !companionId || !companion) return;
    if (!rawMessages) return;
    if (rawMessages.length !== 0) return;
    if (companion.first_message_sent) return;
    sendFirstMessage(companionId, companion).catch(console.error);
  }, [userId, companionId, companion?.id, companion?.first_message_sent, rawMessages?.length]);

  useEffect(() => {
    if (!userId || !companionId || !companion) return;
    if (!rawMessages || rawMessages.length === 0) return;

    const today = new Date().toISOString().slice(0, 10);
    const fireKey = `${companionId}-${today}`;
    if (ritualFiredRef.current === fireKey) return;

    const runRitual = async () => {
      ritualFiredRef.current = fireKey;
      try {
        const { DailyRitualService } = await import('./services/dailyRitualService');
        const ritualResult = await DailyRitualService.checkAndTriggerRituals(userId, companionId, companion.custom_name);
        if (ritualResult.shouldSendMessage && ritualResult.message) {
          await sendMessageMutation.mutateAsync({
            userId, companionId, role: 'assistant', content: ritualResult.message,
            clientMessageId: safeRandomUUID(),
          });
          conversationOrchestrator.dispatch({ type: 'AI_MESSAGE_RECEIVED', contentLength: ritualResult.message.length });
          playSound();
        }
      } catch (e) {
        console.error('[ritual] error:', e);
      }
    };
    runRitual();
  }, [userId, companionId, companion?.id, rawMessages?.length]);

  useEffect(() => {
    if (!userId || !companionId || !companion) return;
    if (!rawMessages || rawMessages.length === 0) return;

    const today = new Date().toISOString().slice(0, 10);
    const fireKey = `${companionId}-${today}`;
    if (resumptionFiredRef.current === fireKey) return;

    const runResumption = async () => {
      try {
        const { DailyRitualService } = await import('./services/dailyRitualService');
        const ritualResult = await DailyRitualService.checkAndTriggerRituals(userId, companionId, companion.custom_name);
        if (ritualResult.shouldSendMessage && ritualResult.message) return;

        resumptionFiredRef.current = fireKey;
        const { data: profile } = await supabase.from('user_profiles').select('name').eq('id', userId).maybeSingle();
        const userName = profile?.name || 'there';

        const { SessionResumptionService } = await import('./services/sessionResumptionService');
        const resumptionMessage = await SessionResumptionService.handleSessionResumption(
          userId, companionId, companion.custom_name, companion.gender, userName, companion.signature_voice
        );
        if (resumptionMessage) {
          await sendMessageMutation.mutateAsync({
            userId, companionId, role: 'assistant', content: resumptionMessage,
            clientMessageId: safeRandomUUID(),
          });
          conversationOrchestrator.dispatch({ type: 'AI_MESSAGE_RECEIVED', contentLength: resumptionMessage.length });
          playSound();
        }
      } catch (e) {
        console.error('[resumption] error:', e);
      }
    };
    runResumption();
  }, [userId, companionId, companion?.id, rawMessages?.length]);

  const fetchBriefContext = useCallback(async (): Promise<{ calendar: string; news: string }> => {
    if (briefContextRef.current) return briefContextRef.current;
    if (!userId || !companionId || !companion) return { calendar: '', news: '' };
    try {
      const ctx = await morningBriefService.fetchBriefContext(userId, companionId, companion.custom_name);
      briefContextRef.current = { calendar: ctx.calendar, news: ctx.news };
      return briefContextRef.current;
    } catch {
      return { calendar: '', news: '' };
    }
  }, [userId, companionId, companion]);

  const handleCloseThread = useCallback(async (thread: Exclude<ActiveThread, 'companion'>) => {
    // Feature tabs — just remove from open set
    if (thread === 'calendar' || thread === 'co-author' || thread === 'daily-feed' || thread === 'your-lens') {
      setOpenFeatures(prev => prev.filter(f => f !== thread));
      setActiveThread('companion');
      return;
    }
    // Bot threads
    if (thread === 'atlas') {
      if (userId && companionId && atlasMessagesRef.current.length > 1) {
        const { saveThreadSignals } = await import('./services/threadSignalService');
        const msgs = atlasMessagesRef.current.map(m => ({ role: (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant', content: m.content }));
        saveThreadSignals(userId, companionId, msgs, 'atlas').catch(console.error);
      }
      atlasMessagesRef.current = [];
      setAtlasMessages([]);
    } else {
      if (userId && companionId && naviMessagesRef.current.length > 1) {
        const { saveThreadSignals } = await import('./services/threadSignalService');
        const msgs = naviMessagesRef.current.map(m => ({ role: (m.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant', content: m.content }));
        saveThreadSignals(userId, companionId, msgs, 'navi').catch(console.error);
      }
      naviMessagesRef.current = [];
      setNaviMessages([]);
    }
    setActiveThread('companion');
  }, [userId, companionId]);

  const handleThreadSend = useCallback(async (content: string) => {
    if (!content.trim() || !companionId) return;
    const isAtlasThread = activeThread === 'atlas';
    const isNaviThread = activeThread === 'navi';
    if (!isAtlasThread && !isNaviThread) return;

    const userMsg: Message = {
      id: safeRandomUUID(), content, sender: 'user',
      timestamp: Date.now(), messageType: 'text',
    };
    if (isAtlasThread) {
      const updated = [...atlasMessagesRef.current, userMsg];
      atlasMessagesRef.current = updated;
      setAtlasMessages([...updated]);
      setAtlasTyping(true);
    } else {
      const updated = [...naviMessagesRef.current, userMsg];
      naviMessagesRef.current = updated;
      setNaviMessages([...updated]);
      setNaviTyping(true);
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const fnName = isAtlasThread ? 'atlas-agent' : 'local-explorer';
      const history = isAtlasThread
        ? atlasMessagesRef.current.slice(-10).map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.content }))
        : naviMessagesRef.current.slice(-10).map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.content }));

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fnName}`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content, conversationHistory: history, companionId }),
      });
      const data = await response.json();
      const replyText = data.response || data.message || data.reply || "I'm having trouble responding right now.";

      const aiMsg: Message = {
        id: safeRandomUUID(), content: replyText, sender: 'ai',
        timestamp: Date.now(), messageType: 'text',
        botSource: isAtlasThread ? 'atlas' : 'navi',
      };
      if (isAtlasThread) {
        const updated = [...atlasMessagesRef.current, aiMsg];
        atlasMessagesRef.current = updated;
        setAtlasMessages([...updated]);
        setAtlasTyping(false);
      } else {
        const updated = [...naviMessagesRef.current, aiMsg];
        naviMessagesRef.current = updated;
        setNaviMessages([...updated]);
        setNaviTyping(false);
      }
      playSound();
    } catch {
      if (isAtlasThread) setAtlasTyping(false);
      else setNaviTyping(false);
    }
  }, [activeThread, companionId, playSound]);

  const sendBotMessage = useCallback(async (
    content: string,
    botSource: 'atlas' | 'navi',
    messageType: 'text' | 'bot-entry' | 'bot-exit' = 'text'
  ) => {
    if (!userId || !companionId) return;

    // Also push to local thread state so the UI tab shows the message
    const msg: Message = {
      id: safeRandomUUID(),
      content,
      sender: 'ai',
      timestamp: Date.now(),
      messageType,
      botSource,
    };
    if (botSource === 'atlas') {
      const updated = [...atlasMessagesRef.current, msg];
      atlasMessagesRef.current = updated;
      setAtlasMessages([...updated]);
    } else {
      const updated = [...naviMessagesRef.current, msg];
      naviMessagesRef.current = updated;
      setNaviMessages([...updated]);
    }

    if (messageType === 'text') playSound();
  }, [userId, companionId, playSound]);

  const { isAtlasLoading, isNaviLoading, sendAtlasPrompt, sendNaviPrompt, sendMorningBriefAsNavi, sendContextThread, enterBotFullMode, exitBotFullMode } =
    useThreadBots({
      companionId,
      onBotMessage: sendBotMessage,
      onBriefNotReady: (readiness) => {
        setBriefReadiness(readiness);
        setShowBriefReadiness(true);
      },
    });

  // Keep refs current so the hub:open-thread event handler can call these
  sendMorningBriefRef.current = sendMorningBriefAsNavi;
  sendContextThreadRef.current = sendContextThread;

  const handleQuickCommand = useCallback(async (command: QuickCommand) => {
    if (!user || !companionId || !companion) return;

    // Morning Brief → open as a new Navi thread
    if (command.id === 'morning-brief') {
      setActiveThread('navi');
      setNaviMessages([]);
      naviMessagesRef.current = [];
      sendMorningBriefRef.current?.();
      return;
    }

    // Daily Digest / Daily Lens → switch right rail tab
    if (command.resultMode === 'news-cards') {
      window.dispatchEvent(new CustomEvent('hub:right-rail-tab', { detail: { tab: 'news' } }));
      return;
    }
    if (command.resultMode === 'video-cards') {
      window.dispatchEvent(new CustomEvent('hub:right-rail-tab', { detail: { tab: 'video' } }));
      return;
    }

    // All other text commands (Week Ahead, etc.) → open Navi tab and reply there
    setActiveThread('navi');
    setNaviMessages([]);
    naviMessagesRef.current = [];
    setNaviTyping(true);

    try {
      let enrichedPrompt = command.prompt;

      if (command.needsContext === 'brief' || command.needsContext === 'calendar' || command.needsContext === 'news') {
        const ctx = await fetchBriefContext();
        const parts: string[] = [command.prompt];
        if ((command.needsContext === 'brief' || command.needsContext === 'calendar') && ctx.calendar) {
          parts.push(`[CONTEXT: ${ctx.calendar}]`);
        }
        if ((command.needsContext === 'brief' || command.needsContext === 'news') && ctx.news) {
          parts.push(`[CONTEXT: ${ctx.news}]`);
        }
        enrichedPrompt = parts.join(' ');
      }

      await sendNaviPrompt(enrichedPrompt);
    } catch {
      setNaviTyping(false);
    }

    // legacy fallback path kept for safety — will not be reached for quick commands
    if (false) {
      const enrichedPrompt = command.prompt;
      setIsTyping(true);
      setSendError(null);

    try {
      const userProfile = await ChatService.getUserProfile();
      let response: string;
      if (userProfile && companionId) {
        const result = await ChatService.sendMessageWithSignals(enrichedPrompt, companionId, userProfile);
        response = result.assistantMessage;
      } else {
        response = await ChatService.sendMessage(enrichedPrompt, companionId, companion.relationship_type);
      }

      await new Promise(resolve => setTimeout(resolve, Math.min(response.length * 12, 2500)));
      setIsTyping(false);

      await sendMessageMutation.mutateAsync({
        userId: user.id,
        companionId,
        role: 'assistant',
        content: response,
        clientMessageId: safeRandomUUID(),
      });

      await updateLastMessageTime(companionId);
      conversationOrchestrator.dispatch({ type: 'AI_MESSAGE_RECEIVED', contentLength: response.length });
      playSound();
    } catch (error) {
      setIsTyping(false);
      console.error('Quick command error:', error);
    }
    } // end if (false)
  }, [user, companionId, companion, fetchBriefContext, sendNaviPrompt, playSound]);

  const handleModeChange = useCallback(async (mode: ThreadMode) => {
    const prevMode = activeMode;

    if (prevMode === 'atlas-full' && mode !== 'atlas-full') {
      await exitBotFullMode('atlas');
    }
    if (prevMode === 'navi-full' && mode !== 'navi-full') {
      await exitBotFullMode('navi');
    }

    if (mode === 'atlas-full' && prevMode !== 'atlas-full') {
      await enterBotFullMode('atlas');
    }
    if (mode === 'navi-full' && prevMode !== 'navi-full') {
      await enterBotFullMode('navi');
    }
    if (mode === 'calendar') {
      setShowCalendarPanel(true);
      return;
    }

    setActiveMode(mode);
  }, [activeMode, enterBotFullMode, exitBotFullMode]);

  const handleBotPromptSubmit = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setIsBotLoading(true);
    try {
      if (activeMode === 'atlas-prompt') {
        await sendAtlasPrompt(text);
        setActiveMode('chat');
      } else if (activeMode === 'navi-prompt') {
        await sendNaviPrompt(text);
        setActiveMode('chat');
      } else if (activeMode === 'atlas-full') {
        await sendAtlasPrompt(text);
      } else if (activeMode === 'navi-full') {
        await sendNaviPrompt(text);
      }
    } finally {
      setIsBotLoading(false);
    }
  }, [activeMode, sendAtlasPrompt, sendNaviPrompt]);

  const sendFirstMessage = async (cid: string, companionData: Companion) => {
    try {
      const claimed = await claimFirstMessage(cid);
      if (!claimed) return;
      if (!user) return;

      const { data: profile } = await supabase.from('user_profiles').select('name, birthday').eq('id', user.id).maybeSingle();
      const userName = profile?.name || 'there';
      const userBirthday = profile?.birthday || undefined;
      const matchData = JSON.parse(sessionStorage.getItem('matchAnswers') || '{}');
      const { firstMessageService } = await import('./services/firstMessageService');

      // Resolve the coach's expert config from the companion row (source of
      // truth) so a coach's first message can restate its actual purpose
      // instead of falling back to generic companion small talk.
      const expertConfig = companionData.signature_expert
        ? await resolveExpert(companionData.signature_expert, companionData.signature_expert_source, user.id)
        : null;

      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1500));
      setIsTyping(true);

      const { generateOpener } = await import('./services/openerService');
      let firstMsg = await generateOpener(cid, 'first_match');
      if (!firstMsg) {
        firstMsg = await firstMessageService.generateFirstMessage(
          companionData.custom_name, companionData.gender, userName, matchData,
          companionData.signature_voice, userBirthday,
          expertConfig?.domain,
          expertConfig,
          companionData.relationship_type
        );
      }
      await new Promise(resolve => setTimeout(resolve, Math.min(firstMsg.length * 15, 3000)));
      setIsTyping(false);

      await sendMessageMutation.mutateAsync({ userId: user.id, companionId: cid, role: 'assistant', content: firstMsg, clientMessageId: safeRandomUUID() });

      await finalizeFirstMessage(cid);
      const updatedCompanion = await getCompanion(cid);
      if (updatedCompanion) setCompanion(updatedCompanion);
      await updateLastMessageTime(cid);
      conversationOrchestrator.dispatch({ type: 'AI_MESSAGE_RECEIVED', contentLength: firstMsg.length });
      playSound();
    } catch (error) {
      console.error('[sendFirstMessage] Error:', error);
      setIsTyping(false);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (isTyping || !companionId || !companion || !user) return;

    if (activeMode === 'atlas-prompt' || activeMode === 'atlas-full') {
      await handleBotPromptSubmit(content);
      return;
    }
    if (activeMode === 'navi-prompt' || activeMode === 'navi-full') {
      await handleBotPromptSubmit(content);
      return;
    }

    const trackingInfo = await getMessageTrackingInfo(user.id);
    if (!trackingInfo || !trackingInfo.canSendMessage) {
      navigate(`/pricing?returnTo=/chat?companion=${companionId}`);
      return;
    }

    if (YouTubeService.isYouTubeUrl(content)) {
      const videoId = YouTubeService.extractVideoId(content);
      if (videoId) { await handleVideoWatch(content, videoId); return; }
    }

    const userClientId = safeRandomUUID();
    setSendError(null);
    conversationOrchestrator.dispatch({ type: 'USER_MESSAGE_SENT', contentLength: content.length });

    try {
      await sendMessageMutation.mutateAsync({ userId: user.id, companionId, role: 'user', content, clientMessageId: userClientId });
      await updateLastMessageTime(companionId);
    } catch (error) {
      console.error('Error saving user message:', error);
    }

    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));
    setIsTyping(true);

    try {
      const userProfile = await ChatService.getUserProfile();
      let response: string;
      let calendarEvent: { title: string; event_type: string; event_date: string } | null = null;
      let navigationIntent: { destination: string; route: string; seedText?: string } | null = null;

      if (userProfile && companionId) {
        const result = await ChatService.sendMessageWithSignals(content, companionId, userProfile);
        response = result.assistantMessage;
        calendarEvent = result.calendarEvent || null;
        navigationIntent = result.navigationIntent || null;
      } else {
        response = await ChatService.sendMessage(content, companionId, companion.relationship_type);
      }

      await new Promise(resolve => setTimeout(resolve, Math.min(response.length * 15, 3000)));
      setIsTyping(false);

      await sendMessageMutation.mutateAsync({ userId: user.id, companionId, role: 'assistant', content: response, clientMessageId: safeRandomUUID() });

      if (calendarEvent) {
        setLastCalendarEvent(calendarEvent);
        if (calendarToastTimer.current) clearTimeout(calendarToastTimer.current);
        calendarToastTimer.current = setTimeout(() => setLastCalendarEvent(null), 7000);
      }

      if (navigationIntent) {
        if (navigationIntent.seedText) {
          setAppBridgeContext({ sourceApp: 'chat', topic: navigationIntent.seedText, seedText: navigationIntent.seedText, companionId: companionId || undefined });
        }
        setTimeout(() => navigate(navigationIntent!.route), 1800);
      }

      try {
        await updateLastMessageTime(companionId);
        // message count is decremented server-side by chat-turn (single source of truth);
        // only refresh here so the UI reflects the new balance.
        await refreshSubscription();
      } catch (e) {
        console.warn('[chat] post-message housekeeping failed:', e);
      }

      conversationOrchestrator.dispatch({ type: 'AI_MESSAGE_RECEIVED', contentLength: response.length });

      insightsTurnCountRef.current += 1;
      if (insightsTurnCountRef.current % 5 === 0 && rawMessages) {
        const todayKey = new Date().toISOString().slice(0, 10);
        const insightsConversationId = `${user.id}-${companionId}-${todayKey}`;
        const recentMessages = rawMessages.slice(-20).map((m: any) => ({ role: m.role as string, content: m.content as string }));
        recentMessages.push({ role: 'user', content });
        recentMessages.push({ role: 'assistant', content: response });
        processEnhancedInsights(insightsConversationId, user.id, companionId, recentMessages).catch(console.error);
      }

      if (companion.drift_needs_correction) {
        clearDriftCorrection(companion.id).catch(console.error);
        setCompanion(prev => prev ? { ...prev, drift_needs_correction: false } : prev);
      }

      driftTurnCountRef.current += 1;
      if (driftTurnCountRef.current % 10 === 0 && rawMessages) {
        const last15Assistant = rawMessages
          .filter((m: any) => m.role === 'assistant')
          .slice(-15)
          .map((m: any) => m.content as string);
        if (last15Assistant.length > 0) {
          inspectVoiceFidelity(companion, last15Assistant).then(result => {
            if (result && result.overall < 0.75) {
              getCompanion(companionId).then(updated => {
                if (updated) setCompanion(updated);
              }).catch(console.error);
            }
          }).catch(console.error);
        }
      }

      playSound();
    } catch (error) {
      console.error('Error sending message:', error);
      setIsTyping(false);

      if (error instanceof Error && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || error.message.includes('offline'))) {
        setSendError('Message failed to send. Check your connection and try again.');
        setTimeout(() => setSendError(null), 6000);
        return;
      }

      let errorContent = "I'm having trouble connecting right now. Please try again in a moment.";
      if (error instanceof Error) {
        if (error.message.includes('Too many requests')) errorContent = "Whoa, slow down! Give me a sec to catch up before sending another message.";
        else if (error.message.includes('temporarily unavailable')) errorContent = error.message;
        else if (error.message.includes('429') || error.message.includes('rate limit')) errorContent = "Let's take a quick breather - I need a moment before I can respond again.";
        else if (error.message.includes('Chat error:')) errorContent = error.message.replace('Chat error: ', '');
        else errorContent = error.message;
      }

      await sendMessageMutation.mutateAsync({ userId: user.id, companionId, role: 'assistant', content: errorContent, clientMessageId: safeRandomUUID() });
    }
  };

  sendMessageRef.current = handleSendMessage;

  const handleVideoWatch = async (videoUrl: string, videoId: string) => {
    if (!companion || !companionId || !user) return;

    try {
      await sendMessageMutation.mutateAsync({ userId: user.id, companionId, role: 'user', content: videoUrl });
    } catch (error) { console.error('Error saving video message:', error); }

    setIsTyping(true);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const metadata = await YouTubeService.fetchVideoMetadata(videoId);
    const watchedVideoId = await YouTubeService.saveWatchedVideo(user.id, companionId, videoUrl, metadata);
    if (!watchedVideoId) { setIsTyping(false); return; }

    await videoReactionService.planReactions(watchedVideoId, companion, metadata, 180);
    const openingMessage = `ooh "${metadata.title}"? let's watch it! 🎬`;

    try {
      await sendMessageMutation.mutateAsync({ userId: user.id, companionId, role: 'assistant', content: openingMessage, clientMessageId: safeRandomUUID() });
    } catch (error) { console.error('Error saving AI response:', error); }

    setIsTyping(false);
    conversationOrchestrator.dispatch({ type: 'AI_MESSAGE_RECEIVED', contentLength: openingMessage.length });
    playSound();
    setCurrentVideo({ videoId, metadata, watchedVideoId });
    setIsWatchingVideo(true);
  };

  const handleVideoTimeUpdate = async (currentTime: number) => {
    if (!currentVideo || !companion) return;
    if (currentTime - lastReactionTimeRef.current < 5) return;
    const reaction = videoReactionService.checkForReaction(currentVideo.watchedVideoId, currentTime);
    if (reaction) {
      lastReactionTimeRef.current = currentTime;
      await sendCompanionMessage(reaction.reaction);
      await videoReactionService.saveReaction(currentVideo.watchedVideoId, companion.id, Math.floor(currentTime), reaction.reaction, 'proactive');
    }
  };

  const handleVideoEnded = async () => {
    if (!currentVideo || !companion || !companionId) return;
    const endReaction = await videoReactionService.generateEndOfVideoReaction(companion, currentVideo.metadata);
    await sendCompanionMessage(endReaction);
    await videoReactionService.saveReaction(currentVideo.watchedVideoId, companion.id, 0, endReaction, 'end_of_video');
    await YouTubeService.markVideoCompleted(currentVideo.watchedVideoId);
    videoReactionService.clearReactions(currentVideo.watchedVideoId);
  };

  const sendCompanionMessage = async (content: string) => {
    if (!companionId || !user) return;
    try {
      await sendMessageMutation.mutateAsync({ userId: user.id, companionId, role: 'assistant', content });
    } catch (error) { console.error('Error saving companion message:', error); }
    conversationOrchestrator.dispatch({ type: 'AI_MESSAGE_RECEIVED', contentLength: content.length });
    playSound();
  };

  const handleReset = () => setShowResetConfirm(true);
  const confirmReset = async () => {
    setShowResetConfirm(false);
    try {
      await supabase.auth.signOut();
      localStorage.clear();
      sessionStorage.clear();
      navigate('/');
    } catch {
      localStorage.clear();
      sessionStorage.clear();
      navigate('/');
    }
  };

  const handleStartOver = () => setShowStartOverConfirm(true);
  const confirmStartOver = async () => {
    if (!userId || !companionId || !companion) return;
    setIsStartingOver(true);
    try {
      await clearConversationMessages(userId, companionId);
      queryClient.setQueryData(messagesKey(userId, companionId), []);
      setRatingsMap({});
      setShowStartOverConfirm(false);
      await resetFirstMessage(companionId);
      const refreshed = await getCompanion(companionId);
      if (refreshed) setCompanion(refreshed);
    } catch (error) {
      console.error('Start over failed:', error);
    } finally {
      setIsStartingOver(false);
    }
  };

  const handleRated = (messageId: string, rating: RatingValue | null) => {
    setRatingsMap(prev => {
      const next = { ...prev };
      if (rating === null) delete next[messageId];
      else next[messageId] = rating;
      return next;
    });
  };

  const handleRegenerate = async (messageId: string) => {
    if (!companionId || !user || !companion) return;
    await markRatingRegenerated(messageId);
    const lastUserMsg = [...uiMessages].reverse().find(m => m.sender === 'user');
    if (lastUserMsg) {
      setIsTyping(true);
      try {
        const response = await ChatService.sendMessage(lastUserMsg.content, companionId, companion.relationship_type);
        await new Promise(resolve => setTimeout(resolve, Math.min(response.length * 15, 3000)));
        setIsTyping(false);
        await sendMessageMutation.mutateAsync({ userId: user.id, companionId, role: 'assistant', content: response, clientMessageId: safeRandomUUID() });
        playSound();
      } catch (error) {
        setIsTyping(false);
        console.error('Regenerate failed:', error);
      }
    }
  };

  const isBotMode = activeMode === 'atlas-prompt' || activeMode === 'atlas-full' || activeMode === 'navi-prompt' || activeMode === 'navi-full';
  const showBotPromptDrawer = activeMode === 'atlas-prompt' || activeMode === 'navi-prompt';
  const showBotFullInputHint = activeMode === 'atlas-full' || activeMode === 'navi-full';
  const isCurrentlyLoading = isAtlasLoading || isNaviLoading || isBotLoading;

  if (authLoading || isCheckingAuth || isLoadingMessages) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-14 w-14 border-b-3 border-primary-500 mx-auto" />
            <div className="absolute inset-0 rounded-full bg-primary-100 opacity-20 animate-pulse-slow" />
          </div>
          <p className="mt-5 text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  const wallpaperMeta = buildWallpaperMeta(chatWallpaper, chatWallpaperUrl);
  const hasWallpaper = !!chatWallpaper;

  const getBotDrawerProps = () => {
    if (activeMode === 'atlas-prompt') return {
      botName: 'Atlas',
      placeholder: 'Ask Atlas anything — writing, research, strategy...',
      accentClass: 'text-sky-600',
    };
    return {
      botName: 'Navi',
      placeholder: 'Ask Navi about local events, places, things to do...',
      accentClass: 'text-teal-600',
    };
  };

  const getBotFullHintText = () => {
    if (activeMode === 'atlas-full') return 'Atlas is active — type to continue the conversation with Atlas';
    return 'Navi is active — type to ask about local events and places';
  };

  return (
    <div
      className={`h-screen flex flex-col relative ${wallpaperMeta.className}`}
      style={hasWallpaper && !wallpaperMeta.className ? wallpaperMeta.style : undefined}
    >
      {!hasWallpaper && (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-rose-100/20 via-transparent to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-blue-100/20 via-transparent to-transparent pointer-events-none" />
        </>
      )}
      {hasWallpaper && <div className="absolute inset-0 bg-black/10 pointer-events-none" />}

      <CookieConsent />

      <ChatHeader
        characterName={getCharacterName()}
        avatarConfig={companion?.avatar_config}
        gender={companion?.gender}
        currentStatus={currentStatus}
        favoriteColor={companion?.favorite_color}
        onOpenLoyaltyRewards={() => setShowCustomizationPanel(true)}
        fontFamily={companion?.font_family}
        companionId={companionId || ''}
        currentTier={currentTier}
        expertDomain={expertDomain}
        subscriptionInfo={subscriptionInfo || undefined}
        onReset={handleReset}
        onAvatarClick={() => setShowAppearanceModal(true)}
        onOpenReflection={() => setReflectionOpen(true)}
        onStartOver={handleStartOver}
      />

      <CBTReflectionDeckModal isOpen={reflectionOpen} onClose={() => setReflectionOpen(false)} />

      {customization && (
        <CustomizationPanel
          isOpen={showCustomizationPanel}
          onClose={() => setShowCustomizationPanel(false)}
          customization={customization}
          companions={allCompanions}
          onSetPointer={setPointer}
          onSetShowTrail={setShowTrail}
          onSetTrailStyle={setTrailStyle}
          onSetAnimationStyle={setAnimationStyle}
          onSetCursorColor={setCursorColor}
          onSetButtonHoverStyle={setButtonHoverStyle}
          onSetTranslucentUI={setTranslucentUI}
          onCompanionFontUpdated={(cId, fontFamily) => {
            setAllCompanions(prev => prev.map(c => c.id === cId ? { ...c, font_family: fontFamily } : c));
            if (companion?.id === cId) setCompanion(prev => prev ? { ...prev, font_family: fontFamily } : prev);
          }}
        />
      )}

      {showAppearanceModal && companion && companionId && (
        <CompanionAppearanceModal
          companionId={companionId}
          companionName={companion.name || 'Companion'}
          currentConfig={companion.avatar_config as unknown as AvatarConfigV2 | null}
          onClose={() => setShowAppearanceModal(false)}
          onSaved={(newConfig) => setCompanion(prev => prev ? { ...prev, avatar_config: newConfig as any } : prev)}
        />
      )}

      {showWallpaperModal && companion && companionId && userId && (
        <WallpaperPickerModal
          companionId={companionId}
          companionName={companion.custom_name || 'Your companion'}
          userId={userId}
          userTier={currentTier}
          currentWallpaper={chatWallpaper}
          currentWallpaperUrl={chatWallpaperUrl}
          onClose={() => setShowWallpaperModal(false)}
          onSaved={(wallpaperId, wallpaperUrl) => { setChatWallpaper(wallpaperId); setChatWallpaperUrl(wallpaperUrl); }}
        />
      )}

      <div className="flex-1 relative overflow-hidden flex flex-row">
        <CompanionHubLeftRail
          disabled={isTyping || remainingMessages === 0 || isCurrentlyLoading}
          userId={userId || undefined}
          companionId={companionId || undefined}
          collapsed={isRailCollapsed}
          translucent={customization?.translucent_ui ?? false}
          onToggleCollapse={toggleRailCollapse}
        />
        <TutorialElement elementId={ONBOARDING_ELEMENT_IDS.companionChat} className="flex-1 relative overflow-hidden flex flex-col">
          <ThreadTabBar
            companionName={getCharacterName()}
            activeThread={activeThread}
            hasAtlas={atlasMessages.length > 0}
            hasNavi={naviMessages.length > 0}
            openFeatures={openFeatures}
            onSwitch={setActiveThread}
            onClose={handleCloseThread}
            onNewThread={(thread) => {
              if (thread === 'atlas') {
                atlasMessagesRef.current = [];
                setAtlasMessages([]);
                setActiveThread('atlas');
              } else {
                setNaviMessages([]);
                naviMessagesRef.current = [];
                setActiveThread('navi');
              }
            }}
          />
          {/* Feature tab views — full page embedded, overflow-scroll */}
          {activeThread === 'calendar' && (
            <div className="flex-1 overflow-y-auto">
              <CalendarPage onBack={() => { setOpenFeatures(p => p.filter(f => f !== 'calendar')); setActiveThread('companion'); }} />
            </div>
          )}
          {activeThread === 'co-author' && (
            <div className="flex-1 overflow-y-auto">
              <CoAuthorPage onBack={() => { setOpenFeatures(p => p.filter(f => f !== 'co-author')); setActiveThread('companion'); }} />
            </div>
          )}
          {activeThread === 'daily-feed' && (
            <div className="flex-1 overflow-y-auto">
              <DailyFeedPage onBack={() => { setOpenFeatures(p => p.filter(f => f !== 'daily-feed')); setActiveThread('companion'); }} />
            </div>
          )}
          {activeThread === 'your-lens' && (
            <div className="flex-1 overflow-y-auto">
              <DailyFeedPage onBack={() => { setOpenFeatures(p => p.filter(f => f !== 'your-lens')); setActiveThread('companion'); }} />
            </div>
          )}
          {/* Chat view — hidden (not unmounted) when a feature tab is active so messages are preserved */}
          <div className={activeThread === 'calendar' || activeThread === 'co-author' || activeThread === 'daily-feed' || activeThread === 'your-lens' ? 'hidden' : 'flex-1 flex flex-col overflow-hidden'}>
            <ChatContainer
              messages={
                activeThread === 'atlas' ? atlasMessages
                : activeThread === 'navi' ? naviMessages
                : uiMessages
              }
              characterName={
                activeThread === 'atlas' ? 'Atlas'
                : activeThread === 'navi' ? 'Navi'
                : getCharacterName()
              }
              compilingLabel={
                activeThread === 'navi' && isNaviLoading ? 'Morning Brief is being compiled...'
                : activeThread === 'atlas' && atlasTyping ? 'Atlas is thinking...'
                : undefined
              }
              activeThread={activeThread}
              userAvatarConfig={userAvatarConfig}
              companionAvatarConfig={
                activeThread === 'companion' ? companion?.avatar_config : undefined
              }
              favoriteColor={
                activeThread === 'atlas' ? '#0ea5e9'
                : activeThread === 'navi' ? '#14b8a6'
                : companion?.favorite_color
              }
              bubbleColorKey={activeThread === 'companion' ? chatBubbleColor : null}
              textColorKey={activeThread === 'companion' ? chatTextColor : null}
              fontFamily={activeThread === 'companion' ? (companion?.font_family ?? null) : null}
              companionBubbleColorKey={activeThread === 'companion' ? companionBubbleColor : null}
              companionTextColorKey={activeThread === 'companion' ? companionTextColor : null}
              companionId={companionId || ''}
              ratingsMap={activeThread === 'companion' ? ratingsMap : {}}
              onRated={handleRated}
              onRegenerate={activeThread === 'companion' ? handleRegenerate : undefined}
            />
          </div>
        </TutorialElement>
        <div className={`hidden lg:block ${(activeThread === 'calendar' || activeThread === 'co-author' || activeThread === 'daily-feed' || activeThread === 'your-lens') ? 'lg:hidden' : ''}`}>
          <CompanionHubRightRail
            companionName={getCharacterName()}
            userId={userId}
            onCommand={handleQuickCommand}
            disabled={isTyping || remainingMessages === 0 || isCurrentlyLoading}
          />
        </div>
      </div>

      {userId && companionId && companion && isOnboarding && (
        <GuidedTourOverlay userId={userId} companionName={getCharacterName()} />
      )}

      <AnimatePresence>
        {showBotFullInputHint && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className={`border-t px-4 py-2 text-xs font-medium flex items-center gap-2 ${
              activeMode === 'atlas-full'
                ? 'bg-sky-50 border-sky-200 text-sky-700'
                : 'bg-teal-50 border-teal-200 text-teal-700'
            }`}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            {getBotFullHintText()}
            <button
              onClick={() => handleModeChange('chat')}
              className="ml-auto text-[10px] font-semibold opacity-70 hover:opacity-100 transition-opacity"
            >
              End session
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBotPromptDrawer && (
          <BotPromptDrawer
            {...getBotDrawerProps()}
            onSubmit={handleBotPromptSubmit}
            onClose={() => setActiveMode('chat')}
            isLoading={isCurrentlyLoading}
          />
        )}
      </AnimatePresence>

      {/* Bottom toolbar — hidden while a full-page feature tab is active */}
      <div
        className={`relative z-40 border-t transition-all duration-500 ${
          (activeThread === 'calendar' || activeThread === 'co-author' || activeThread === 'daily-feed' || activeThread === 'your-lens') ? 'hidden' : ''
        }`}
        style={customization?.translucent_ui
          ? { background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(209,213,219,0.12)', boxShadow: 'none' }
          : { background: 'rgba(255,255,255,0.80)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderColor: 'rgba(209,213,219,0.50)', boxShadow: '0 -10px 40px -10px rgba(0,0,0,0.10)' }
        }
      >
        {/* Desktop layout — evenly distributed single row */}
        <div className="hidden lg:flex items-end gap-2 px-4 py-2">

          {/* Quick Commands popover trigger */}
          <QuickCommandPopover
            onCommand={handleQuickCommand}
            disabled={
              activeThread === 'companion'
                ? (isTyping || remainingMessages === 0 || isCurrentlyLoading)
                : (naviTyping || atlasTyping)
            }
          />

          {/* Chat Input — grows */}
          <div className="flex-1 min-w-0">
            <ChatInput
              onSend={activeThread === 'companion' ? handleSendMessage : handleThreadSend}
              disabled={
                activeThread === 'companion'
                  ? (isTyping || remainingMessages === 0 || isCurrentlyLoading)
                  : activeThread === 'atlas' ? atlasTyping
                  : naviTyping
              }
              characterName={
                activeThread === 'atlas' ? 'Atlas'
                : activeThread === 'navi' ? 'Navi'
                : getCharacterName()
              }
              companionId={companionId || undefined}
              lastMessageText={uiMessages.length > 0 ? uiMessages[uiMessages.length - 1].content.slice(0, 120) : undefined}
              showNavRadial={false}
            />
          </div>

          {/* Mochi (pet) toggle */}
          <button
            data-tour-id="tour-pet-toggle"
            onClick={petToggle}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl transition-all duration-200 flex-shrink-0"
            style={{
              background: petEnabled ? 'rgba(251,146,60,0.15)' : 'rgba(0,0,0,0.04)',
              border: `1.5px solid ${petEnabled ? 'rgba(251,146,60,0.45)' : 'rgba(0,0,0,0.08)'}`,
            }}
            title={petEnabled ? `${petName} is roaming — click to hide` : `Summon ${petName}`}
          >
            <span className={`text-base transition-transform duration-300 ${petEnabled ? 'scale-110' : 'grayscale opacity-50'}`}>
              🐾
            </span>
            <span className={`text-[11px] font-semibold transition-colors ${petEnabled ? 'text-orange-600' : 'text-gray-400'}`}>
              {petName}
            </span>
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors"
              style={{ background: petEnabled ? '#22c55e' : '#d1d5db' }}
            />
          </button>

          {/* Style bar — compact trigger */}
          {activeThread === 'companion' && (
            <div data-tour-id="tour-style-bar" className="flex-shrink-0">
            <ChatStyleBar
              companionId={companionId}
              companionName={getCharacterName()}
              currentFontFamily={companion?.font_family}
              currentBubbleColor={chatBubbleColor}
              currentTextColor={chatTextColor}
              currentCompanionBubbleColor={companionBubbleColor}
              currentCompanionTextColor={companionTextColor}
              customization={customization}
              onFontChange={(fontFamily) => setCompanion(prev => prev ? { ...prev, font_family: fontFamily } : prev)}
              onBubbleColorChange={setChatBubbleColor}
              onTextColorChange={setChatTextColor}
              onCompanionBubbleColorChange={setCompanionBubbleColor}
              onCompanionTextColorChange={setCompanionTextColor}
              onCustomizationUpdate={(prefs) => {
                if (prefs.show_trail !== undefined) setShowTrail(prefs.show_trail);
                if (prefs.trail_style !== undefined) setTrailStyle(prefs.trail_style);
                if (prefs.animation_style !== undefined) setAnimationStyle(prefs.animation_style);
              }}
              onOpenWallpaper={() => setShowWallpaperModal(true)}
            />
            </div>
          )}
        </div>

        {/* Mobile layout */}
        <div className="lg:hidden flex items-end py-2 gap-2 px-3">
          {/* Mochi toggle — icon only on mobile */}
          <button
            data-tour-id="tour-pet-toggle"
            onClick={petToggle}
            className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all"
            style={{
              background: petEnabled ? 'rgba(251,146,60,0.15)' : 'rgba(0,0,0,0.04)',
              border: `1.5px solid ${petEnabled ? 'rgba(251,146,60,0.45)' : 'rgba(0,0,0,0.08)'}`,
            }}
          >
            <span className={`text-sm ${petEnabled ? '' : 'grayscale opacity-50'}`}>🐾</span>
          </button>

          <div className="flex-1 min-w-0">
            <ChatInput
              onSend={activeThread === 'companion' ? handleSendMessage : handleThreadSend}
              disabled={
                activeThread === 'companion'
                  ? (isTyping || remainingMessages === 0 || isCurrentlyLoading)
                  : activeThread === 'atlas' ? atlasTyping
                  : naviTyping
              }
              characterName={
                activeThread === 'atlas' ? 'Atlas'
                : activeThread === 'navi' ? 'Navi'
                : getCharacterName()
              }
              companionId={companionId || undefined}
              lastMessageText={uiMessages.length > 0 ? uiMessages[uiMessages.length - 1].content.slice(0, 120) : undefined}
              showNavRadial={false}
            />
          </div>

          {activeThread === 'companion' && (
            <div data-tour-id="tour-style-bar" className="flex-shrink-0">
              <ChatStyleBar
                companionId={companionId}
                companionName={getCharacterName()}
                currentFontFamily={companion?.font_family}
                currentBubbleColor={chatBubbleColor}
                currentTextColor={chatTextColor}
                currentCompanionBubbleColor={companionBubbleColor}
                currentCompanionTextColor={companionTextColor}
                customization={customization}
                onFontChange={(fontFamily) => setCompanion(prev => prev ? { ...prev, font_family: fontFamily } : prev)}
                onBubbleColorChange={setChatBubbleColor}
                onTextColorChange={setChatTextColor}
                onCompanionBubbleColorChange={setCompanionBubbleColor}
                onCompanionTextColorChange={setCompanionTextColor}
                onCustomizationUpdate={(prefs) => {
                  if (prefs.show_trail !== undefined) setShowTrail(prefs.show_trail);
                  if (prefs.trail_style !== undefined) setTrailStyle(prefs.trail_style);
                  if (prefs.animation_style !== undefined) setAnimationStyle(prefs.animation_style);
                }}
                onOpenWallpaper={() => setShowWallpaperModal(true)}
              />
            </div>
          )}
        </div>
      </div>

      {sendError && (
        <div className="absolute bottom-24 sm:bottom-32 left-1/2 transform -translate-x-1/2 z-20 w-max max-w-xs sm:max-w-sm">
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm px-4 py-2.5 rounded-full shadow-md flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />
            {sendError}
          </div>
        </div>
      )}

      <div className="absolute bottom-20 sm:bottom-28 left-1/2 transform -translate-x-1/2 z-10 pointer-events-none">
        {(() => {
          const showTyping = activeThread === 'atlas' ? atlasTyping : activeThread === 'navi' ? naviTyping : isTyping;
          const typingName = activeThread === 'atlas' ? 'Atlas' : activeThread === 'navi' ? 'Navi' : getCharacterName();
          const dotColor = activeThread === 'atlas' ? 'from-sky-400 to-sky-600' : activeThread === 'navi' ? 'from-teal-400 to-teal-600' : 'from-rose-500 to-pink-600';
          return (
            <div className={`transition-all duration-200 ${showTyping ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
              <div className="backdrop-blur-md bg-white/95 px-4 sm:px-5 py-2.5 sm:py-3 rounded-full shadow-lg border border-gray-200/60">
                <div className="flex items-center gap-2.5">
                  <div className="flex gap-1">
                    <div className={`w-1.5 h-1.5 bg-gradient-to-br ${dotColor} rounded-full animate-bounce`} style={{ animationDelay: '0ms' }} />
                    <div className={`w-1.5 h-1.5 bg-gradient-to-br ${dotColor} rounded-full animate-bounce`} style={{ animationDelay: '150ms' }} />
                    <div className={`w-1.5 h-1.5 bg-gradient-to-br ${dotColor} rounded-full animate-bounce`} style={{ animationDelay: '300ms' }} />
                  </div>
                  <p className="text-xs sm:text-sm text-gray-700 font-medium">{typingName} is typing</p>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      <AnimatePresence>
        {lastCalendarEvent && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 sm:bottom-28 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/90 backdrop-blur-sm text-white shadow-lg text-sm">
              <CalendarPlus className="w-4 h-4 flex-shrink-0" />
              <span>
                <span className="font-semibold">{lastCalendarEvent.title}</span>
                {' '}added to your calendar
                {lastCalendarEvent.event_date && (
                  <span className="opacity-80">
                    {' '}— {new Date(lastCalendarEvent.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                )}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <FeedbackModal isOpen={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} />

      <BriefReadinessModal
        readiness={showBriefReadiness ? briefReadiness : null}
        onClose={() => setShowBriefReadiness(false)}
        onSetupSchedule={() => {
          setShowBriefReadiness(false);
          setShowNaviOnboarding(true);
        }}
        onOpenCalendar={() => setShowCalendarPanel(true)}
        onAddGoal={() => {
          setShowBriefReadiness(false);
          setShowNaviOnboarding(true);
        }}
        onRunAnyway={() => {
          setActiveThread('navi');
          setNaviMessages([]);
          naviMessagesRef.current = [];
          sendMorningBriefRef.current?.(true);
        }}
      />

      {showWorkScheduleModal && userId && (
        <WorkScheduleSetupModal
          userId={userId}
          onClose={() => setShowWorkScheduleModal(false)}
          onSaved={() => setShowWorkScheduleModal(false)}
        />
      )}

      {showNaviOnboarding && briefReadiness && (
        <NaviOnboardingModal
          readiness={briefReadiness}
          onClose={() => setShowNaviOnboarding(false)}
          onComplete={() => {
            setShowNaviOnboarding(false);
            setActiveThread('navi');
            setNaviMessages([]);
            naviMessagesRef.current = [];
            sendMorningBriefRef.current?.(true);
          }}
        />
      )}

      {isWatchingVideo && currentVideo && (
        <VideoPlayer
          videoId={currentVideo.videoId}
          onClose={() => setIsWatchingVideo(false)}
          onTimeUpdate={handleVideoTimeUpdate}
          onEnded={handleVideoEnded}
        />
      )}

      <AnimatePresence>
        {showCalendarPanel && (
          <CalendarPanel onClose={() => { setShowCalendarPanel(false); setActiveMode('chat'); }} />
        )}
      </AnimatePresence>

      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center">
            <p className="text-gray-900 font-semibold mb-2">Reset everything?</p>
            <p className="text-gray-500 text-sm mb-6">This will delete your companion and all conversation history. This cannot be undone.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setShowResetConfirm(false)} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm transition-colors">Cancel</button>
              <button onClick={confirmReset} className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm transition-colors">Reset</button>
            </div>
          </div>
        </div>
      )}

      {showStartOverConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-4">
              <RefreshCw className="w-6 h-6 text-rose-600" />
            </div>
            <p className="text-gray-900 font-semibold mb-2">Start over with {getCharacterName()}?</p>
            <p className="text-gray-500 text-sm mb-6">This clears your message history so you can start a fresh conversation. Your companion, relationship bond, and memories stay intact.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setShowStartOverConfirm(false)} disabled={isStartingOver} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm transition-colors">Cancel</button>
              <button onClick={confirmStartOver} disabled={isStartingOver} className="px-5 py-2 bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-xl text-sm transition-colors flex items-center gap-2">
                {isStartingOver ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Clearing...</>
                ) : (
                  <>Start Over</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Consumes PetStore — kept separate so hooks don't need PetProvider
function PetLayer() {
  const { enabled, name, animalType, stats, handleStats, pendingLevelUp, clearLevelUp } = usePetStore();
  const { actionsRef, catPosRef } = usePetRefs();
  return (
    <>
      <PetCompanion
        enabled={enabled}
        name={name}
        animalType={animalType}
        actionsRef={actionsRef}
        catPosRef={catPosRef}
        onStats={handleStats}
        initialStats={stats}
      />
      <PetLevelToast
        level={pendingLevelUp}
        onDone={clearLevelUp}
      />
    </>
  );
}

function App() {
  const [searchParams] = useSearchParams();
  const companionId = searchParams.get('companion');
  const { user, loading: authLoading } = useAuth();
  const init = usePetStore(s => s.init);

  useEffect(() => {
    if (!authLoading && user && companionId) {
      init(user.id, companionId);
    }
  }, [authLoading, user?.id, companionId]);

  return (
    <>
      <AppInner />
      <PetLayer />
    </>
  );
}

export default App;

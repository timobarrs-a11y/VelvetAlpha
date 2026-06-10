import { useState, useRef, useCallback } from 'react';
import { ThreadMode } from '../../components/thread/ThreadToolbar';
import { atlasService } from '../../services/atlasService';
import { localExplorerService } from '../../services/localExplorerService';
import { morningBriefService, scoreBriefReadiness, BriefReadiness } from '../../services/morningBriefService';
import { supabase } from '../../shared/supabase/client';

export type { BriefReadiness };

export interface ThreadBotMessage {
  id: string;
  content: string;
  botSource: 'atlas' | 'navi';
  messageType: 'text' | 'bot-entry' | 'bot-exit';
  timestamp: number;
}

interface UseThreadBotsOptions {
  companionId: string | null;
  onBotMessage: (content: string, botSource: 'atlas' | 'navi', messageType?: 'text' | 'bot-entry' | 'bot-exit') => Promise<void>;
  onBriefNotReady?: (readiness: BriefReadiness) => void;
}

export function useThreadBots({ companionId: _companionId, onBotMessage, onBriefNotReady }: UseThreadBotsOptions) {
  const [isAtlasLoading, setIsAtlasLoading] = useState(false);
  const [isNaviLoading, setIsNaviLoading] = useState(false);
  const [atlasConversationId, setAtlasConversationId] = useState<string | null>(null);
  const [naviConversationId, setNaviConversationId] = useState<string | null>(null);
  const [atlasHistory, setAtlasHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [naviHistory, setNaviHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const userIdRef = useRef<string | null>(null);
  const userNameRef = useRef<string>('there');

  const loadUserInfo = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    userIdRef.current = user.id;
    const { data } = await supabase
      .from('user_profiles')
      .select('name')
      .eq('id', user.id)
      .maybeSingle();
    if (data?.name) userNameRef.current = data.name;
  }, []);

  const sendAtlasPrompt = useCallback(async (text: string) => {
    setIsAtlasLoading(true);
    try {
      await loadUserInfo();
      let convId = atlasConversationId;
      if (!convId) {
        const conv = await atlasService.createConversation('Thread Session');
        convId = conv.id;
        setAtlasConversationId(convId);
      }

      await atlasService.insertMessage(convId, 'user', text);

      let response = '';
      await atlasService.sendMessage(
        convId,
        text,
        atlasHistory,
        userNameRef.current,
        (chunk) => { response += chunk; },
      );

      await atlasService.insertMessage(convId, 'assistant', response);
      setAtlasHistory(prev => [
        ...prev,
        { role: 'user', content: text },
        { role: 'assistant', content: response },
      ]);

      await onBotMessage(response, 'atlas', 'text');
    } catch (err) {
      console.error('[useThreadBots] Atlas error:', err);
      await onBotMessage('Atlas is unavailable right now. Try again in a moment.', 'atlas', 'text');
    } finally {
      setIsAtlasLoading(false);
    }
  }, [atlasConversationId, atlasHistory, onBotMessage, loadUserInfo]);

  const sendNaviPrompt = useCallback(async (text: string) => {
    setIsNaviLoading(true);
    try {
      await loadUserInfo();
      const location = await localExplorerService.getSavedLocation();
      const userLocation = location ?? { city: 'your area' };

      let convId = naviConversationId;
      if (!convId) {
        const conv = await localExplorerService.createConversation('Thread Session', userLocation.city);
        convId = conv.id;
        setNaviConversationId(convId);
      }

      await localExplorerService.insertMessage(convId, 'user', text);

      let response = '';
      await localExplorerService.sendMessage(
        convId,
        text,
        naviHistory,
        userLocation,
        userNameRef.current,
        (chunk) => { response += chunk; },
      );

      await localExplorerService.insertMessage(convId, 'assistant', response);
      setNaviHistory(prev => [
        ...prev,
        { role: 'user', content: text },
        { role: 'assistant', content: response },
      ]);

      await onBotMessage(response, 'navi', 'text');
    } catch (err) {
      console.error('[useThreadBots] Navi error:', err);
      await onBotMessage("Navi can't reach local data right now. Try again in a moment.", 'navi', 'text');
    } finally {
      setIsNaviLoading(false);
    }
  }, [naviConversationId, naviHistory, onBotMessage, loadUserInfo]);

  // Starts a fresh Navi session and sends the morning brief using the fast
  // morning-brief edge function (Claude Haiku, no web search, 3-5s response).
  const sendMorningBriefAsNavi = useCallback(async (force = false) => {
    setIsNaviLoading(true);
    try {
      await loadUserInfo();
      const userId = userIdRef.current;

      setNaviConversationId(null);
      setNaviHistory([]);

      let contextParts: string[] = [];
      if (userId) {
        try {
          const ctx = await morningBriefService.fetchBriefContext(userId, '', userNameRef.current);

          const readiness = scoreBriefReadiness({
            hasSchedule: ctx.hasSchedule,
            hasCalendar: ctx.hasCalendar,
            hasGoals: ctx.hasGoals,
            hasNews: ctx.hasNews,
          });

          if (!readiness.isReady && !force && onBriefNotReady) {
            onBriefNotReady(readiness);
            return;
          }

          if (ctx.hasCalendar)    contextParts.push(ctx.calendar);
          if (ctx.hasSchedule)    contextParts.push(ctx.schedule);
          if (ctx.hasGoals)       contextParts.push(ctx.goals);
          if (ctx.hasNationalDay) contextParts.push(ctx.nationalDay);
          if (ctx.hasNews)        contextParts.push(ctx.news);
          if ((ctx as any).hasPolitics) contextParts.push((ctx as any).politics);
        } catch {
          // proceed without extra context
        }
      }

      const todayLabel = new Date().toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric',
      });

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/morning-brief`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          context: contextParts.join('\n\n'),
          userName: userNameRef.current,
          todayLabel,
        }),
      });

      const data = await res.json();
      const response: string = data.response ?? "Couldn't pull your brief right now.";

      setNaviHistory([{ role: 'assistant', content: response }]);
      await onBotMessage(response, 'navi', 'text');
    } catch (err) {
      console.error('[useThreadBots] Morning brief error:', err);
      await onBotMessage("Couldn't pull your brief right now. Try again in a moment.", 'navi', 'text');
    } finally {
      setIsNaviLoading(false);
    }
  }, [onBotMessage, loadUserInfo, onBriefNotReady]);

  // Opens Atlas with a contextual starter for Calendar, Insights, or Co-Author threads
  const sendContextThread = useCallback(async (context: 'calendar' | 'insights' | 'coauthor') => {
    setIsAtlasLoading(true);
    try {
      await loadUserInfo();

      // New session per context open
      const conv = await atlasService.createConversation(`${context} thread`);
      const convId = conv.id;
      setAtlasConversationId(convId);
      setAtlasHistory([]);

      const prompts: Record<string, string> = {
        calendar: `Let's look at my calendar together. What's coming up, what should I be thinking about, and are there any gaps or conflicts worth flagging?`,
        insights: `Walk me through the patterns you've noticed in our conversations — what keeps coming up, what seems to matter to me most, and anything worth reflecting on.`,
        coauthor: `Let's write something together. What are we working on?`,
      };

      const prompt = prompts[context];
      await atlasService.insertMessage(convId, 'user', prompt);

      let response = '';
      await atlasService.sendMessage(
        convId,
        prompt,
        [],
        userNameRef.current,
        (chunk) => { response += chunk; },
      );

      await atlasService.insertMessage(convId, 'assistant', response);
      setAtlasHistory([
        { role: 'user', content: prompt },
        { role: 'assistant', content: response },
      ]);

      await onBotMessage(response, 'atlas', 'text');
    } catch (err) {
      console.error('[useThreadBots] Context thread error:', err);
      await onBotMessage('Atlas is unavailable right now. Try again in a moment.', 'atlas', 'text');
    } finally {
      setIsAtlasLoading(false);
    }
  }, [onBotMessage, loadUserInfo]);

  const enterBotFullMode = useCallback(async (bot: 'atlas' | 'navi') => {
    const name = bot === 'atlas' ? 'Atlas' : 'Navi';
    await onBotMessage(`⬡ ${name} has joined the conversation`, bot, 'bot-entry');
  }, [onBotMessage]);

  const exitBotFullMode = useCallback(async (bot: 'atlas' | 'navi') => {
    const name = bot === 'atlas' ? 'Atlas' : 'Navi';
    await onBotMessage(`⬡ ${name} has left the conversation`, bot, 'bot-exit');
  }, [onBotMessage]);

  const resetAtlasSession = useCallback(() => {
    setAtlasConversationId(null);
    setAtlasHistory([]);
  }, []);

  const resetNaviSession = useCallback(() => {
    setNaviConversationId(null);
    setNaviHistory([]);
  }, []);

  return {
    isAtlasLoading,
    isNaviLoading,
    sendAtlasPrompt,
    sendNaviPrompt,
    sendMorningBriefAsNavi: sendMorningBriefAsNavi as (force?: boolean) => Promise<void>,
    sendContextThread,
    enterBotFullMode,
    exitBotFullMode,
    resetAtlasSession,
    resetNaviSession,
  };
}

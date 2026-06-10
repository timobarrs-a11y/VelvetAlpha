import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, MapPin, Loader2, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { localExplorerService } from '../services/localExplorerService';
import { calendarService, UserEvent } from '../services/calendarService';
import { getActiveGoals, formatGoalsForBrief } from '../services/goalService';
import { getSchedule, formatScheduleForBrief } from '../services/userScheduleService';

interface NaviMessage {
  id: string;
  role: 'navi' | 'user';
  content: string;
  isStreaming?: boolean;
}

interface Props {
  userId: string;
  upcomingEvents: UserEvent[];
  onEventAdded: () => void;
}

const STARTER_SUGGESTIONS = [
  'What should I do after work tonight?',
  'Find me something active this weekend',
  'Any good spots near me for a date night?',
  'What local events are coming up?',
];

export function CalendarNaviPanel({ userId, upcomingEvents, onEventAdded }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<NaviMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [convId, setConvId] = useState<string | null>(null);
  const [historyArr, setHistoryArr] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [hasLocation, setHasLocation] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localExplorerService.getSavedLocation().then(loc => setHasLocation(!!loc));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Build rich context for Navi including goals, schedule, and calendar
  const buildNaviContext = useCallback(async (): Promise<string> => {
    const parts: string[] = [];

    try {
      const goals = await getActiveGoals(userId);
      const goalsText = formatGoalsForBrief(goals);
      if (goalsText) parts.push(goalsText);
    } catch { /* skip */ }

    try {
      const schedule = await getSchedule(userId);
      const schedText = formatScheduleForBrief(schedule);
      if (schedText) parts.push(schedText);
    } catch { /* skip */ }

    if (upcomingEvents.length > 0) {
      const eventLines = upcomingEvents
        .slice(0, 5)
        .map(e => `- ${e.title} (${new Date(e.event_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })})`);
      parts.push(`User's upcoming calendar events:\n${eventLines.join('\n')}`);
    }

    return parts.length > 0 ? `\n\n[USER CONTEXT]\n${parts.join('\n\n')}` : '';
  }, [userId, upcomingEvents]);

  const getOrCreateConversation = useCallback(async (): Promise<string> => {
    if (convId) return convId;
    const location = await localExplorerService.getSavedLocation();
    const city = location?.city || 'your area';
    const conv = await localExplorerService.createConversation('Calendar Planning', city);
    setConvId(conv.id);
    return conv.id;
  }, [convId]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isSending) return;
    setIsSending(true);
    setInputValue('');

    const userMsg: NaviMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
    };
    setMessages(prev => [...prev, userMsg]);

    const naviMsgId = crypto.randomUUID();
    const naviMsg: NaviMessage = {
      id: naviMsgId,
      role: 'navi',
      content: '',
      isStreaming: true,
    };
    setMessages(prev => [...prev, naviMsg]);

    try {
      const cid = await getOrCreateConversation();
      const location = await localExplorerService.getSavedLocation();
      const userLocation = location ?? { city: 'your area' };

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('name')
        .eq('id', userId)
        .maybeSingle();
      const userName = profile?.name || undefined;

      // Inject user context into the first message
      const context = historyArr.length === 0 ? await buildNaviContext() : '';
      const enrichedText = context ? `${text}${context}` : text;

      await localExplorerService.insertMessage(cid, 'user', text);

      let responseText = '';
      await localExplorerService.sendMessage(
        cid,
        enrichedText,
        historyArr,
        userLocation,
        userName,
        (chunk) => {
          responseText += chunk;
          setMessages(prev => prev.map(m =>
            m.id === naviMsgId ? { ...m, content: responseText, isStreaming: true } : m
          ));
        },
        undefined,
        (_event) => {
          onEventAdded();
        }
      );

      setMessages(prev => prev.map(m =>
        m.id === naviMsgId ? { ...m, content: responseText, isStreaming: false } : m
      ));

      await localExplorerService.insertMessage(cid, 'assistant', responseText);
      setHistoryArr(prev => [
        ...prev,
        { role: 'user', content: text },
        { role: 'assistant', content: responseText },
      ]);
    } catch (err) {
      console.error('[CalendarNaviPanel] Error:', err);
      setMessages(prev => prev.map(m =>
        m.id === naviMsgId ? { ...m, content: "I'm having trouble right now. Try again in a moment.", isStreaming: false } : m
      ));
    } finally {
      setIsSending(false);
    }
  }, [isSending, historyArr, getOrCreateConversation, buildNaviContext, userId, onEventAdded]);

  const handleSend = () => sendMessage(inputValue);
  const handleStarter = (text: string) => sendMessage(text);

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setIsExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-teal-500/20 flex items-center justify-center">
            <MapPin className="w-3.5 h-3.5 text-teal-400" />
          </div>
          <div className="text-left">
            <p className="text-[12px] font-semibold text-white">Ask Navi</p>
            <p className="text-[10px] text-gray-400">Find things to do near you</p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/10">
              {/* No location warning */}
              {!hasLocation && (
                <div className="px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20">
                  <p className="text-[10.5px] text-amber-300">
                    Set your city in settings for better results
                  </p>
                </div>
              )}

              {/* Messages */}
              <div className="max-h-64 overflow-y-auto px-4 py-3 space-y-2.5">
                {messages.length === 0 && (
                  <div>
                    <p className="text-[11px] text-gray-400 mb-2.5">Try asking:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {STARTER_SUGGESTIONS.map(s => (
                        <button
                          key={s}
                          onClick={() => handleStarter(s)}
                          className="text-[10.5px] px-2.5 py-1.5 rounded-lg bg-teal-500/15 text-teal-300 border border-teal-500/20 hover:bg-teal-500/25 transition-colors text-left"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-xl text-[11.5px] leading-relaxed ${
                        msg.role === 'navi'
                          ? 'bg-white/8 text-gray-200 rounded-tl-sm'
                          : 'bg-teal-500/30 text-teal-100 rounded-tr-sm'
                      }`}
                    >
                      {msg.content}
                      {msg.isStreaming && !msg.content && (
                        <span className="inline-flex gap-0.5 ml-1">
                          {[0, 100, 200].map(d => (
                            <span
                              key={d}
                              className="w-1 h-1 bg-teal-400 rounded-full animate-bounce"
                              style={{ animationDelay: `${d}ms` }}
                            />
                          ))}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-4 py-3 border-t border-white/10 flex items-center gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleSend(); }}
                  placeholder="Ask about local spots, events, activities..."
                  disabled={isSending}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[12px] text-white placeholder-gray-500 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 disabled:opacity-50"
                />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isSending}
                  className="w-8 h-8 rounded-lg bg-teal-500 hover:bg-teal-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all active:scale-95 flex-shrink-0"
                >
                  {isSending ? (
                    <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5 text-white" />
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

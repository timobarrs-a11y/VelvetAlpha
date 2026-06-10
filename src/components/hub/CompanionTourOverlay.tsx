import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Zap, X, Minimize2, Maximize2 } from 'lucide-react';
import { supabase } from '../../shared/supabase/client';
import { AtlasMarkdown } from '../AtlasMarkdown';
import { useTutorialDirector, TutorialStep } from '../../context/TutorialDirectorContext';
import { parseAtlasResponse } from '../../features/onboarding/signalParser';
import { buildOnboardingSystemPrompt } from '../../features/onboarding/onboardingPrompt';
import { onboardingService } from '../../services/onboardingService';

interface Props {
  userId: string;
  companionId: string;
  companionName: string;
  userName: string;
  personalitySnapshot: Record<string, unknown>;
}

interface TourMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function CompanionTourOverlay({
  userId, companionId, companionName, userName, personalitySnapshot,
}: Props) {
  const {
    isOnboarding, emit, clearSignal, advanceStep, completeOnboarding, tourSource,
  } = useTutorialDirector();

  const [messages, setMessages] = useState<TourMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamingContentRef = useRef('');
  const signalQueueRef = useRef<ReturnType<typeof parseAtlasResponse>['signals']>([]);

  useEffect(() => {
    if (!isOnboarding) {
      setMessages([]);
      setInitialized(false);
      streamingContentRef.current = '';
      return;
    }
    if (initialized) return;
    setInitialized(true);
    triggerOpening().catch(() => {});
  }, [isOnboarding, initialized]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const processSignalQueue = useCallback(() => {
    const signals = signalQueueRef.current;
    if (signals.length === 0) return;
    let delay = 0;
    for (const signal of signals) {
      setTimeout(() => {
        if (signal.type === 'clear') clearSignal();
        else {
          emit(signal);
          if (signal.type === 'spotlight' || signal.type === 'pulse') {
            setTimeout(() => clearSignal(), 4000);
          }
        }
      }, delay);
      delay += 800;
    }
    signalQueueRef.current = [];
  }, [emit, clearSignal]);

  const callAtlasStream = async (history: TourMessage[], userMessage: string) => {
    setIsStreaming(true);
    streamingContentRef.current = '';
    const placeholder: TourMessage = { role: 'assistant', content: '' };
    setMessages(prev => [...prev, placeholder]);
    const streamIndex = history.length + 1;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const systemPrompt = buildOnboardingSystemPrompt({
        companionName,
        userName: userName || undefined,
        personalitySnapshot,
        tourSource,
      });

      const response = await fetch(`${supabaseUrl}/functions/v1/onboarding-atlas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || supabaseAnonKey}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({ message: userMessage, history, systemPrompt }),
      });
      if (!response.ok || !response.body) throw new Error('Stream failed');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.trim());
        for (const line of lines) {
          const applyText = (appended: string) => {
            streamingContentRef.current += appended;
            const { cleanText, signals, stepAdvance } = parseAtlasResponse(streamingContentRef.current);
            setMessages(prev => {
              const updated = [...prev];
              updated[streamIndex] = { role: 'assistant', content: cleanText };
              return updated;
            });
            if (signals.length > 0) signalQueueRef.current = signals;
            if (stepAdvance) advanceStep(stepAdvance as TutorialStep);
          };
          try {
            const parsed = JSON.parse(line);
            if (parsed.type === 'text' && parsed.content) applyText(parsed.content);
          } catch {
            if (line.startsWith('data: ')) applyText(line.slice(6));
          }
        }
      }

      processSignalQueue();

      const finalClean = parseAtlasResponse(streamingContentRef.current).cleanText;
      setMessages(prev => {
        const updated = [...prev];
        updated[streamIndex] = { role: 'assistant', content: finalClean };
        return updated;
      });

      const fullHistory: TourMessage[] = [
        ...history,
        { role: 'user', content: userMessage },
        { role: 'assistant', content: finalClean },
      ];
      onboardingService.saveConversation(userId, fullHistory).catch(() => {});
    } catch {
      const fallback = `hey ${userName || 'there'} — welcome to your space with ${companionName}. I'll be docked here if you need a walkthrough.`;
      setMessages(prev => {
        const updated = [...prev];
        updated[streamIndex] = { role: 'assistant', content: fallback };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const triggerOpening = async () => {
    const opener = tourSource === 'manual_replay'
      ? `The user asked for a refresher. Welcome them back briefly and offer to re-walk them through their space.`
      : `Start the onboarding. Welcome ${userName || 'me'} and introduce what this hub is — keep it short and warm. Don't list features yet.`;
    await callAtlasStream([], opener);
  };

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || isStreaming) return;
    setInputValue('');
    const userMsg: TourMessage = { role: 'user', content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    await callAtlasStream(messages, text);
  };

  const handleFinish = async () => {
    await onboardingService.markComplete(userId).catch(() => {});
    completeOnboarding();
  };

  const handleSkip = async () => {
    await onboardingService.markComplete(userId).catch(() => {});
    completeOnboarding();
  };

  if (!isOnboarding) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="tour-overlay"
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 40 }}
        transition={{ type: 'spring', stiffness: 220, damping: 28 }}
        className={`fixed top-20 right-4 z-40 ${minimized ? 'w-[240px]' : 'w-[360px] md:w-[400px]'}`}
      >
        <div className="rounded-2xl border border-slate-200/80 bg-white/95 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col"
          style={{ maxHeight: minimized ? 'auto' : 'calc(100vh - 180px)' }}>
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-slate-100 bg-gradient-to-r from-amber-50/80 to-orange-50/50">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 leading-none">Atlas</p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {tourSource === 'manual_replay' ? 'refresher tour' : 'walking you through'}
              </p>
            </div>
            <button
              onClick={() => setMinimized(p => !p)}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors"
              aria-label={minimized ? 'Expand' : 'Minimize'}
            >
              {minimized ? <Maximize2 className="w-3.5 h-3.5 text-slate-500" /> : <Minimize2 className="w-3.5 h-3.5 text-slate-500" />}
            </button>
            <button
              onClick={handleSkip}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors"
              aria-label="End tour"
            >
              <X className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>

          {!minimized && (
            <>
              <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3 min-h-[180px]">
                {messages.map((msg, i) => (
                  <ChatBubble
                    key={i}
                    role={msg.role}
                    content={msg.content}
                    isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'}
                  />
                ))}
                {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
                  <TypingDots />
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="px-3 pb-3 pt-2 border-t border-slate-100">
                <div className="flex gap-2 items-end bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                  <textarea
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Ask Atlas anything..."
                    disabled={isStreaming}
                    rows={1}
                    className="flex-1 bg-transparent text-[13px] text-slate-900 placeholder-slate-400 resize-none focus:outline-none leading-relaxed max-h-24"
                    style={{ minHeight: '22px' }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!inputValue.trim() || isStreaming}
                    className="w-7 h-7 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-30 flex items-center justify-center transition-all flex-shrink-0"
                  >
                    <Send className="w-3 h-3 text-white" />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2 px-1">
                  <button
                    onClick={handleFinish}
                    className="text-[10px] font-medium text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    I'm good — end tour
                  </button>
                  <p className="text-[9.5px] text-slate-400">Watch the rails light up</p>
                </div>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function ChatBubble({ role, content, isStreaming }: { role: 'user' | 'assistant'; content: string; isStreaming?: boolean }) {
  if (role === 'user') {
    return (
      <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="flex justify-end">
        <div className="max-w-[85%] bg-sky-100 border border-sky-200 rounded-2xl rounded-tr-md px-3 py-2">
          <p className="text-[12.5px] text-slate-900 leading-relaxed">{content}</p>
        </div>
      </motion.div>
    );
  }
  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-2">
      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Zap className="w-3 h-3 text-white" />
      </div>
      <div className="max-w-[85%] bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-md px-3 py-2">
        <div className="text-[12.5px] text-slate-800 leading-relaxed">
          <AtlasMarkdown content={content} />
        </div>
        {isStreaming && <span className="inline-block w-1 h-3 bg-slate-400 rounded-sm ml-1 animate-pulse" />}
      </div>
    </motion.div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-start gap-2">
      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
        <Zap className="w-3 h-3 text-white" />
      </div>
      <div className="bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-md px-3 py-2.5">
        <div className="flex gap-1">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

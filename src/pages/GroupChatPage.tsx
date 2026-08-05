import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Send, Loader, Users, Sparkles, MessageCircle, Eye, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../shared/supabase/client';
import { Avatar } from '../components/Avatar';
import { AvatarConfig } from '../types/avatar';
import {
  getGroupChatMessages,
  getGroupChatMembers,
  sendGroupMessage,
  GroupChatMessage,
  GroupChatMember,
} from '../services/groupChatService';

const DEFAULT_AVATAR_IMAGES: Record<string, string> = {
  female: '/images/riley-positive.jpg',
  male: '/images/jake-positive.jpg',
};

const COMPANION_TEXT_COLORS = [
  'text-teal-300',
  'text-rose-300',
  'text-amber-300',
  'text-emerald-300',
  'text-sky-300',
  'text-red-300',
];

const COMPANION_BG_COLORS = [
  'bg-teal-500/10 border-teal-500/20',
  'bg-rose-500/10 border-rose-500/20',
  'bg-amber-500/10 border-amber-500/20',
  'bg-emerald-500/10 border-emerald-500/20',
  'bg-sky-500/10 border-sky-500/20',
  'bg-red-500/10 border-red-500/20',
];

const COMPANION_DOT_COLORS = [
  'bg-teal-400',
  'bg-rose-400',
  'bg-amber-400',
  'bg-emerald-400',
  'bg-sky-400',
  'bg-red-400',
];

const TOPIC_PROMPTS = [
  'Pineapple on pizza: yes or no?',
  'Best movie of all time?',
  'Would you rather be invisible or fly?',
  'Hot take: morning people vs night owls',
  'If you could only eat one cuisine forever?',
  'Cats vs dogs, settle it once and for all',
  'Best decade for music?',
  'Dream vacation destination?',
  'Most overrated thing that everyone loves?',
  'If you had a superpower, what would it be?',
];

export function GroupChatPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const groupId = searchParams.get('group');

  const [messages, setMessages] = useState<GroupChatMessage[]>([]);
  const [members, setMembers] = useState<GroupChatMember[]>([]);
  const [groupName, setGroupName] = useState('');
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [typingCompanion, setTypingCompanion] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [userAvatarConfig, setUserAvatarConfig] = useState<AvatarConfig | null>(null);
  const [showTopicMenu, setShowTopicMenu] = useState(false);
  const [, setIsNewGroup] = useState(false);
  const [autoSpinCount, setAutoSpinCount] = useState<3 | 5 | 10>(5);
  const [autoSpinRemaining, setAutoSpinRemaining] = useState(0);
  const [isAutoSpinning, setIsAutoSpinning] = useState(false);
  const autoSpinCancelRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const companionColorMap = useRef<Record<string, number>>({});

  const getCompanionColorIndex = useCallback((companionId: string): number => {
    if (companionColorMap.current[companionId] === undefined) {
      const existingCount = Object.keys(companionColorMap.current).length;
      companionColorMap.current[companionId] = existingCount % COMPANION_TEXT_COLORS.length;
    }
    return companionColorMap.current[companionId];
  }, []);

  useEffect(() => {
    if (!groupId) { navigate('/lobby'); return; }
    loadGroupChat();
  }, [groupId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingCompanion]);

  const getCompanionInfos = useCallback(() => {
    return members
      .filter(m => m.companion)
      .map(m => ({
        id: m.companion!.id,
        custom_name: m.companion!.custom_name,
        gender: m.companion!.gender,
        signature_voice: m.companion!.signature_voice,
        relationship_type: m.companion!.relationship_type,
        dynamic_preference: m.companion!.dynamic_preference,
        energy_preference: m.companion!.energy_preference,
        confrontation_style: m.companion!.confrontation_style,
        love_language: m.companion!.love_language,
        interest_text: m.companion!.interest_text,
        hobbies: m.companion!.hobbies,
      }));
  }, [members]);

  const getChatHistory = useCallback(() => {
    return messages.slice(-25).map(m => ({
      role: m.role,
      sender_name: m.sender_name,
      content: m.content,
    }));
  }, [messages]);

  const callGroupChatAPI = async (body: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/group-chat`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to get group response');
    }

    return response.json();
  };

  const deliverResponses = async (
    responses: Array<{ companion_id: string; sender_name: string; content: string; delay_ms?: number }>
  ) => {
    if (!groupId) return;
    for (const resp of responses) {
      setTypingCompanion(resp.sender_name);
      const delay = resp.delay_ms || (600 + Math.random() * 800);
      await new Promise(r => setTimeout(r, delay));

      const saved = await sendGroupMessage(groupId, resp.content, resp.sender_name, resp.companion_id);
      if (saved) {
        setMessages(prev => [...prev, saved]);
      }
      setTypingCompanion(null);
      await new Promise(r => setTimeout(r, 200));
    }
  };

  const loadGroupChat = async () => {
    if (!groupId) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate('/lobby'); return; }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('name, avatar_config')
      .eq('id', user.id)
      .maybeSingle();

    setUserName(profile?.name || 'You');
    if (profile?.avatar_config) setUserAvatarConfig(profile.avatar_config as AvatarConfig);

    const { data: group } = await supabase
      .from('group_chats')
      .select('name')
      .eq('id', groupId)
      .maybeSingle();

    setGroupName(group?.name || 'Group Chat');

    const [membersList, messagesList] = await Promise.all([
      getGroupChatMembers(groupId),
      getGroupChatMessages(groupId),
    ]);

    membersList.forEach(m => { if (m.companion_id) getCompanionColorIndex(m.companion_id); });
    setMembers(membersList);
    setMessages(messagesList);
    setIsLoading(false);

    if (messagesList.length === 0) {
      setIsNewGroup(true);
      triggerIcebreaker(membersList);
    }
  };

  const triggerIcebreaker = async (membersList: GroupChatMember[]) => {
    setIsSending(true);
    try {
      const companionInfos = membersList
        .filter(m => m.companion)
        .map(m => ({
          id: m.companion!.id,
          custom_name: m.companion!.custom_name,
          gender: m.companion!.gender,
          signature_voice: m.companion!.signature_voice,
          relationship_type: m.companion!.relationship_type,
          dynamic_preference: m.companion!.dynamic_preference,
          energy_preference: m.companion!.energy_preference,
          confrontation_style: m.companion!.confrontation_style,
          hobbies: m.companion!.hobbies,
        }));

      const { responses } = await callGroupChatAPI({
        companions: companionInfos,
        chatHistory: [],
        mode: 'icebreaker',
      });

      await deliverResponses(responses);
      setIsNewGroup(false);
    } catch (error) {
      console.error('Icebreaker error:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isSending || !groupId) return;

    setInputText('');
    setIsSending(true);

    const userMsg = await sendGroupMessage(groupId, text, userName);
    if (userMsg) setMessages(prev => [...prev, userMsg]);

    try {
      const { responses } = await callGroupChatAPI({
        companions: getCompanionInfos(),
        chatHistory: getChatHistory(),
        userMessage: text,
        mode: 'user_reply',
      });

      await deliverResponses(responses);
    } catch (error) {
      console.error('Group chat error:', error);
      addSystemMessage('Something went wrong. Please try again.');
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleTopicPrompt = async (topic: string) => {
    if (isSending || !groupId) return;
    setShowTopicMenu(false);
    setIsSending(true);

    const topicMsg = await sendGroupMessage(groupId, topic, userName);
    if (topicMsg) setMessages(prev => [...prev, topicMsg]);

    try {
      const { responses } = await callGroupChatAPI({
        companions: getCompanionInfos(),
        chatHistory: getChatHistory(),
        topic,
        mode: 'topic',
      });

      await deliverResponses(responses);
    } catch (error) {
      console.error('Topic prompt error:', error);
      addSystemMessage('Something went wrong. Please try again.');
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleLetThemTalk = async () => {
    if (isSending || !groupId || messages.length < 2) return;

    autoSpinCancelRef.current = false;
    setIsAutoSpinning(true);
    setAutoSpinRemaining(autoSpinCount);
    setIsSending(true);

    for (let round = 0; round < autoSpinCount; round++) {
      if (autoSpinCancelRef.current) break;

      setAutoSpinRemaining(autoSpinCount - round);

      try {
        const { responses } = await callGroupChatAPI({
          companions: getCompanionInfos(),
          chatHistory: getChatHistory(),
          mode: 'autonomous',
        });
        await deliverResponses(responses);
      } catch (error) {
        console.error('Autonomous chat error:', error);
        addSystemMessage('Something went wrong.');
        break;
      }

      if (!autoSpinCancelRef.current && round < autoSpinCount - 1) {
        await new Promise(r => setTimeout(r, 600));
      }
    }

    setIsAutoSpinning(false);
    setAutoSpinRemaining(0);
    setIsSending(false);
  };

  const handleStopAutoSpin = () => {
    autoSpinCancelRef.current = true;
  };

  const addSystemMessage = (content: string) => {
    if (!groupId) return;
    const msg: GroupChatMessage = {
      id: `sys-${Date.now()}`,
      group_chat_id: groupId,
      user_id: '',
      companion_id: null,
      role: 'assistant',
      sender_name: 'System',
      content,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, msg]);
  };

  const getMemberAvatar = (companionId: string | null) => {
    if (!companionId) return null;
    return members.find(m => m.companion_id === companionId)?.companion;
  };

  const getTypingCompanionColor = () => {
    if (!typingCompanion) return 'bg-teal-400';
    const member = members.find(m => m.companion?.custom_name === typingCompanion);
    if (!member) return 'bg-teal-400';
    const idx = getCompanionColorIndex(member.companion_id);
    return COMPANION_DOT_COLORS[idx];
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-teal-400 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading group chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800">
      <div className="flex-shrink-0 border-b border-white/5 bg-gray-950/90 backdrop-blur-xl z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/lobby')}
            className="p-2 hover:bg-white/8 rounded-lg transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5 text-white/70" />
          </button>

          <Users className="w-5 h-5 text-teal-400 flex-shrink-0" />

          <div className="flex-1 min-w-0 flex items-center gap-3">
            <span className="font-bold text-white text-base truncate">{groupName || 'Group Chat'}</span>

            <div className="flex -space-x-2 flex-shrink-0">
              {members.slice(0, 4).map((member, i) => {
                const companion = member.companion;
                if (!companion) return null;
                return (
                  <div
                    key={member.id}
                    className="w-7 h-7 rounded-full border-2 border-gray-950 overflow-hidden bg-gray-700"
                    style={{ zIndex: members.length - i }}
                  >
                    {companion.avatar_config ? (
                      <Avatar config={companion.avatar_config as AvatarConfig} className="w-full h-full" />
                    ) : (
                      <img
                        src={DEFAULT_AVATAR_IMAGES[companion.gender]}
                        alt={companion.custom_name}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 border border-white/10 rounded-full flex-shrink-0">
            <Users className="w-3 h-3 text-white/40" />
            <span className="text-xs font-medium text-white/60">{members.length + 1}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-4 space-y-3">
          {messages.length === 0 && !isSending && (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-teal-500/20">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Starting Group Chat...</h2>
              <p className="text-gray-500 text-sm">Your companions are about to introduce themselves</p>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map(msg => {
              const isUser = msg.role === 'user' && !msg.companion_id;
              const isSystem = msg.sender_name === 'System';
              const companion = getMemberAvatar(msg.companion_id);
              const colorIdx = msg.companion_id ? getCompanionColorIndex(msg.companion_id) : 0;

              if (isSystem) {
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-2"
                  >
                    <span className="text-xs text-gray-500 bg-gray-800/50 px-3 py-1 rounded-full">
                      {msg.content}
                    </span>
                  </motion.div>
                );
              }

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}
                >
                  {isUser ? (
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-600 flex-shrink-0 mt-5">
                      {userAvatarConfig ? (
                        <Avatar config={userAvatarConfig} className="w-full h-full" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center text-white text-xs font-bold">
                          {userName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  ) : companion ? (
                    <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-gray-700/50 mt-5">
                      {companion.avatar_config ? (
                        <Avatar config={companion.avatar_config as AvatarConfig} className="w-full h-full" />
                      ) : (
                        <img
                          src={DEFAULT_AVATAR_IMAGES[companion.gender]}
                          alt={msg.sender_name}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 mt-5">
                      <Users className="w-3.5 h-3.5 text-gray-500" />
                    </div>
                  )}

                  <div className={`max-w-[78%] ${isUser ? 'text-right' : ''}`}>
                    <span className={`text-[11px] font-semibold mb-0.5 block ${
                      isUser ? 'text-gray-500' : COMPANION_TEXT_COLORS[colorIdx]
                    }`}>
                      {isUser ? 'You' : msg.sender_name}
                    </span>
                    <div
                      className={`inline-block px-3.5 py-2 rounded-2xl text-[13px] leading-relaxed ${
                        isUser
                          ? 'bg-gradient-to-br from-teal-500 to-cyan-600 text-white rounded-tr-sm'
                          : `border ${COMPANION_BG_COLORS[colorIdx]} text-gray-100 rounded-tl-sm`
                      }`}
                    >
                      {msg.content}
                    </div>
                    <span className="text-[9px] text-gray-600 mt-0.5 block">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {typingCompanion && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2.5"
            >
              <div className="w-8 h-8 rounded-full bg-gray-700/50 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-3.5 h-3.5 text-gray-500" />
              </div>
              <div className="bg-gray-800/60 border border-gray-700/30 px-3.5 py-2 rounded-2xl rounded-tl-sm">
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5">
                    <div className={`w-1.5 h-1.5 ${getTypingCompanionColor()} rounded-full animate-bounce`} style={{ animationDelay: '0ms' }} />
                    <div className={`w-1.5 h-1.5 ${getTypingCompanionColor()} rounded-full animate-bounce`} style={{ animationDelay: '150ms' }} />
                    <div className={`w-1.5 h-1.5 ${getTypingCompanionColor()} rounded-full animate-bounce`} style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-[11px] text-gray-500">{typingCompanion} is typing</span>
                </div>
              </div>
            </motion.div>
          )}

          {isSending && !typingCompanion && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 pl-11"
            >
              <Loader className="w-3.5 h-3.5 animate-spin text-gray-500" />
              <span className="text-[11px] text-gray-500">Thinking...</span>
            </motion.div>
          )}

          <AnimatePresence>
            {!isSending && !isAutoSpinning && messages.length >= 2 && autoSpinRemaining === 0 && (
              <motion.div
                key="waiting-prompt"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-1"
              >
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="flex-shrink-0 border-t border-gray-700/50 bg-gray-900/90 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 pt-2 pb-4">
          {messages.length >= 2 && (
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {isAutoSpinning ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-900/40 border border-teal-700/50 text-teal-300 rounded-full text-[11px] font-medium">
                    <motion.div
                      className="w-1.5 h-1.5 bg-teal-400 rounded-full"
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                    Round {autoSpinCount - autoSpinRemaining + 1} of {autoSpinCount}
                  </div>
                  <button
                    onClick={handleStopAutoSpin}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-300 rounded-full text-[11px] font-medium transition-all"
                  >
                    <Square className="w-2.5 h-2.5 fill-current" />
                    Stop
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1 bg-gray-800/60 border border-gray-700/60 rounded-full p-0.5">
                    {([3, 5, 10] as const).map(n => (
                      <button
                        key={n}
                        onClick={() => setAutoSpinCount(n)}
                        disabled={isSending}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all disabled:opacity-40 ${
                          autoSpinCount === n
                            ? 'bg-teal-500 text-white shadow-sm'
                            : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleLetThemTalk}
                    disabled={isSending}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-teal-600/50 text-gray-300 hover:text-teal-300 rounded-full text-[11px] font-medium transition-all disabled:opacity-40"
                  >
                    <Eye className="w-3 h-3" />
                    Let them talk
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => setShowTopicMenu(!showTopicMenu)}
                      disabled={isSending}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-gray-600 text-gray-300 rounded-full text-[11px] font-medium transition-all disabled:opacity-40"
                    >
                      <Sparkles className="w-3 h-3" />
                      Drop a topic
                    </button>

                    <AnimatePresence>
                      {showTopicMenu && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setShowTopicMenu(false)} />
                          <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.95 }}
                            className="absolute bottom-full left-0 mb-2 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl py-1.5 min-w-[280px] max-h-[240px] overflow-y-auto z-40"
                          >
                            {TOPIC_PROMPTS.map((topic, i) => (
                              <button
                                key={i}
                                onClick={() => handleTopicPrompt(topic)}
                                className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700/50 hover:text-white transition-colors"
                              >
                                {topic}
                              </button>
                            ))}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex items-center gap-2.5">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              placeholder="Message the group..."
              disabled={isSending}
              className="flex-1 px-4 py-2.5 bg-gray-800/80 border border-gray-700 rounded-xl text-white text-sm placeholder-gray-500 focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-500/20 disabled:opacity-50 transition-all"
            />
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || isSending}
              className="p-2.5 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 disabled:from-gray-700 disabled:to-gray-700 text-white rounded-xl transition-all shadow-lg shadow-teal-500/10 disabled:shadow-none"
            >
              {isSending ? (
                <Loader className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

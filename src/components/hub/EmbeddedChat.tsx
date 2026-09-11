import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { ChatContainer } from '../ChatContainer';
import { ChatInput } from '../ChatInput';
import { Message } from '../../types';
import { ChatService } from '../../services/chatService';
import { getCompanion, updateLastMessageTime, type Companion } from '../../services/companionService';
import { getMessageTrackingInfo } from '../../services/messageTrackingService';
import { useMessages, useSendMessage } from '../../features/chat/hooks';
import { useAuth } from '../../auth/AuthProvider';
import { useSubscription } from '../../hooks/useSubscription';
import { useSound } from '../../hooks/useSound';
import { safeRandomUUID } from '../../utils/uuid';
import { Avatar } from '../Avatar';
import { companionAvatarConfig } from '../lobby/lobbyUtils';

interface EmbeddedChatProps {
  companionId: string;
  onBack: () => void;
}

export function EmbeddedChat({ companionId, onBack }: EmbeddedChatProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { playSound } = useSound();
  const { refreshSubscription } = useSubscription();

  const [companion, setCompanion] = useState<Companion | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const { data: rawMessages, isLoading } = useMessages(userId, companionId);
  const sendMessageMutation = useSendMessage();

  const messages: Message[] = (rawMessages ?? []).map((msg: any) => ({
    id: msg.id,
    content: msg.content,
    sender: msg.role === 'user' ? 'user' : 'ai',
    timestamp: new Date(msg.created_at).getTime(),
    messageType: msg.message_type ?? 'text',
    botSource: msg.bot_source ?? 'companion',
  }));

  useEffect(() => {
    getCompanion(companionId).then(c => setCompanion(c)).catch(() => {});
  }, [companionId]);

  const handleSend = async (content: string) => {
    if (isTyping || !userId || !companion) return;

    const trackingInfo = await getMessageTrackingInfo(userId);
    if (!trackingInfo || !trackingInfo.canSendMessage) {
      navigate(`/pricing?returnTo=/chat?companion=${companionId}`);
      return;
    }

    setSendError(null);

    try {
      await sendMessageMutation.mutateAsync({
        userId, companionId, role: 'user', content,
        clientMessageId: safeRandomUUID(),
      });
      await updateLastMessageTime(companionId);
    } catch (err) {
      console.error('Error saving user message:', err);
    }

    await new Promise(r => setTimeout(r, 800 + Math.random() * 1200));
    setIsTyping(true);

    try {
      const userProfile = await ChatService.getUserProfile();
      let response: string;

      if (userProfile && companionId) {
        const result = await ChatService.sendMessageWithSignals(content, companionId, userProfile);
        response = result.assistantMessage;
      } else {
        response = await ChatService.sendMessage(content, companionId, companion.relationship_type);
      }

      await new Promise(r => setTimeout(r, Math.min(response.length * 15, 3000)));
      setIsTyping(false);

      await sendMessageMutation.mutateAsync({
        userId, companionId, role: 'assistant',
        content: response, clientMessageId: safeRandomUUID(),
      });

      try {
        await updateLastMessageTime(companionId);
        await refreshSubscription();
      } catch (e) {
        console.warn('[embedded-chat] post-message housekeeping failed:', e);
      }

      playSound();
    } catch (error) {
      console.error('Error sending message:', error);
      setIsTyping(false);

      let errorContent = "I'm having trouble connecting right now. Please try again in a moment.";
      if (error instanceof Error) {
        if (error.message.includes('429') || error.message.includes('rate limit')) {
          errorContent = "Let's take a quick breather - I need a moment before I can respond again.";
        } else if (error.message.includes('Too many requests')) {
          errorContent = "Whoa, slow down! Give me a sec to catch up before sending another message.";
        } else if (error.message.includes('temporarily unavailable')) {
          errorContent = error.message;
        } else {
          errorContent = error.message;
        }
      }

      await sendMessageMutation.mutateAsync({
        userId, companionId, role: 'assistant',
        content: errorContent, clientMessageId: safeRandomUUID(),
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
      </div>
    );
  }

  const characterName = companion?.custom_name || 'Companion';

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-transparent">
      {/* Embedded chat header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/8 flex-shrink-0">
        <button
          onClick={onBack}
          className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
          title="Back to feed"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0">
            {companion && <Avatar config={companionAvatarConfig(companion)} className="w-full h-full" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{characterName}</p>
            <p className="text-[10px] text-white/50">
              {isTyping ? 'typing...' : 'embedded chat'}
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate(`/chat?companion=${companionId}`)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white/80 hover:bg-white/10 transition-colors"
          title="Open full chat"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Full page</span>
        </button>
      </div>

      {/* Messages */}
      <ChatContainer
        messages={messages}
        characterName={characterName}
        compilingLabel={isTyping ? `${characterName} is composing a message` : undefined}
        companionAvatarConfig={companion ? companionAvatarConfig(companion) : undefined}
        companionId={companionId}
      />

      {/* Error toast */}
      <AnimatePresence>
        {sendError && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="mx-4 mb-2 px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-200 text-xs text-center"
          >
            {sendError}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="px-4 py-3 border-t border-white/8 flex-shrink-0">
        <ChatInput
          onSend={handleSend}
          disabled={isTyping}
          characterName={characterName}
          companionId={companionId}
          showNavRadial={false}
        />
      </div>
    </div>
  );
}

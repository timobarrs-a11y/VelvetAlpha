import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ExternalLink, Palette, Type } from 'lucide-react';
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
import { buildWallpaperMeta } from '../../services/wallpaperService';
import { WallpaperPickerModal } from '../WallpaperPickerModal';
import { FONT_OPTIONS, getEligibleFonts } from '../../services/customizationService';
import { updateCompanionFont } from '../../services/companionService';

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
  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [wallpaperId, setWallpaperId] = useState<string | null>(null);
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null);

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
    getCompanion(companionId).then(c => {
      setCompanion(c);
      setWallpaperId(c.chat_wallpaper ?? null);
      setWallpaperUrl(c.chat_wallpaper_url ?? null);
    }).catch(() => {});
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
  const wallpaperMeta = buildWallpaperMeta(wallpaperId, wallpaperUrl);

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Wallpaper background layer */}
      <div
        className={`absolute inset-0 ${wallpaperMeta.className}`}
        style={wallpaperMeta.style || (wallpaperId ? {} : { background: 'transparent' })}
      />

      {/* Chat content layer (above wallpaper) */}
      <div className="relative flex-1 flex flex-col overflow-hidden">
        {/* Embedded chat header */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/8 flex-shrink-0 backdrop-blur-sm bg-black/20">
          <button
            onClick={onBack}
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-semibold text-white truncate"
              style={{ fontFamily: companion?.font_family ?? undefined }}
            >
              {characterName}
            </p>
            <p className="text-[10px] text-white/50">
              {isTyping ? 'typing...' : 'embedded chat'}
            </p>
          </div>
          {/* Wallpaper picker */}
          <button
            onClick={() => setShowWallpaperPicker(true)}
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/10 transition-colors text-white/50 hover:text-white"
            title="Change wallpaper"
          >
            <Palette className="w-4 h-4" />
          </button>
          {/* Font picker */}
          <button
            onClick={() => setShowFontPicker(true)}
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-white/10 transition-colors text-white/50 hover:text-white"
            title="Change font"
          >
            <Type className="w-4 h-4" />
          </button>
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
          fontFamily={companion?.font_family ?? null}
          bubbleColorKey={companion?.chat_bubble_color ?? null}
          textColorKey={companion?.chat_text_color ?? null}
          companionBubbleColorKey={companion?.companion_bubble_color ?? null}
          companionTextColorKey={companion?.companion_text_color ?? null}
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
        <div className="px-4 py-3 border-t border-white/8 flex-shrink-0 backdrop-blur-sm bg-black/20">
          <ChatInput
            onSend={handleSend}
            disabled={isTyping}
            characterName={characterName}
            companionId={companionId}
            showNavRadial={false}
          />
        </div>
      </div>

      {/* Wallpaper picker modal */}
      <AnimatePresence>
        {showWallpaperPicker && companion && userId && (
          <WallpaperPickerModal
            companionId={companionId}
            companionName={characterName}
            userId={userId}
            currentWallpaper={wallpaperId}
            currentWallpaperUrl={wallpaperUrl}
            onClose={() => setShowWallpaperPicker(false)}
            onSaved={(id, url) => {
              setWallpaperId(id);
              setWallpaperUrl(url);
            }}
          />
        )}
      </AnimatePresence>

      {/* Font picker modal */}
      <AnimatePresence>
        {showFontPicker && companion && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.70)' }}
            onClick={e => { if (e.target === e.currentTarget) setShowFontPicker(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-sm rounded-2xl overflow-hidden"
              style={{ background: 'rgba(22,19,44,0.98)', border: '1px solid rgba(80,70,130,0.50)', boxShadow: '0 20px 60px rgba(0,0,0,0.60)' }}
            >
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(60,55,100,0.40)' }}>
                <p className="text-sm font-bold text-white">Choose Font</p>
                <button onClick={() => setShowFontPicker(false)} className="p-1.5 rounded-lg text-white/50 hover:text-white transition-colors text-lg">&times;</button>
              </div>
              <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
                {FONT_OPTIONS.map(font => {
                  const eligible = companion ? getEligibleFonts(companion.gender).some(f => f.key === font.key) : true;
                  const isActive = companion?.font_family === font.fontFamily;
                  const selectable = eligible;
                  return (
                    <button
                      key={font.key}
                      disabled={!selectable}
                      onClick={async () => {
                        if (!selectable || !companion) return;
                        await updateCompanionFont(companion.id, font.fontFamily);
                        setCompanion({ ...companion, font_family: font.fontFamily });
                        setShowFontPicker(false);
                      }}
                      style={{
                        background: isActive ? 'rgba(244,63,107,0.18)' : selectable ? 'rgba(40,36,68,0.80)' : 'rgba(28,25,48,0.40)',
                        borderColor: isActive ? 'rgba(244,63,107,0.70)' : 'rgba(60,55,100,0.50)',
                        width: '100%', textAlign: 'left',
                      }}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-150 ${
                        isActive ? 'text-pink-300' : selectable ? 'text-white/70 hover:text-white' : 'text-white/30 cursor-not-allowed opacity-40'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ fontFamily: font.fontFamily }}>{font.label}</p>
                        <p className="text-xs opacity-70 truncate mt-0.5" style={{ fontFamily: font.fontFamily }}>{font.sample}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

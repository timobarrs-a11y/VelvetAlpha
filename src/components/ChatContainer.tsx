import { useEffect, useRef, useState } from 'react';
import { ChatMessage } from './ChatMessage';
import { DaySeparator } from './DaySeparator';
import { Message } from '../types';
import { AvatarConfig } from '../types/avatar';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDown } from 'lucide-react';
import { RatingValue } from '../services/ratingService';

interface ChatContainerProps {
  messages: Message[];
  characterName?: string;
  compilingLabel?: string;
  activeThread?: 'companion' | 'atlas' | 'navi';
  userAvatarConfig?: AvatarConfig | null;
  companionAvatarConfig?: AvatarConfig | null;
  favoriteColor?: string;
  bubbleColorKey?: string | null;
  textColorKey?: string | null;
  fontFamily?: string | null;
  companionBubbleColorKey?: string | null;
  companionTextColorKey?: string | null;
  companionId?: string;
  ratingsMap?: Record<string, RatingValue>;
  onRated?: (messageId: string, rating: RatingValue | null) => void;
  onRegenerate?: (messageId: string) => void;
}

export const ChatContainer = ({ messages, characterName = 'your companion', compilingLabel, activeThread = 'companion', userAvatarConfig, companionAvatarConfig, favoriteColor, bubbleColorKey, textColorKey, fontFamily, companionBubbleColorKey, companionTextColorKey, companionId = '', ratingsMap = {}, onRated, onRegenerate }: ChatContainerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const scrollToBottom = (smooth = true) => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  };

  useEffect(() => {
    scrollToBottom(false);
  }, [messages]);

  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom);
    }
  };

  const uniqueMessages = messages.reduce((acc, message) => {
    const exists = acc.some(m =>
      m.content === message.content &&
      m.sender === message.sender &&
      Math.abs(m.timestamp - message.timestamp) < 60000
    );

    if (!exists) {
      acc.push(message);
    }

    return acc;
  }, [] as Message[]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto bg-transparent relative"
      style={{
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(0,0,0,0.2) transparent'
      }}
    >
      {uniqueMessages.length === 0 ? (
        <div className="h-full flex items-center justify-center relative z-10 px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            {(() => {
              const dotColor = activeThread === 'atlas' ? 'bg-sky-400/70' : activeThread === 'navi' ? 'bg-teal-400/70' : 'bg-rose-400/60';
              const label = compilingLabel ?? `${characterName} is composing a message`;
              return (
                <>
                  <div className="flex items-center gap-1.5 justify-center">
                    {[0, 0.2, 0.4].map(delay => (
                      <motion.div
                        key={delay}
                        className={`w-2 h-2 rounded-full ${dotColor}`}
                        animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1.4, repeat: Infinity, delay }}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-400/60 mt-2">{label}</p>
                </>
              );
            })()}
          </motion.div>
        </div>
      ) : (
        <div className="min-h-full flex flex-col justify-end relative z-10">
          <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            <div className="space-y-2">
              {uniqueMessages.map((message, index) => {
                const prevMessage = index > 0 ? uniqueMessages[index - 1] : null;

                const getLocalDateStr = (ts: number) => {
                  const d = new Date(ts);
                  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
                };

                const isNewDay =
                  !prevMessage ||
                  getLocalDateStr(message.timestamp) !== getLocalDateStr(prevMessage.timestamp);

                const isGrouped = !isNewDay && prevMessage && prevMessage.sender === message.sender;

                return (
                  <div key={`${message.id}-${index}`}>
                    {isNewDay && <DaySeparator timestamp={message.timestamp} />}
                    <ChatMessage
                      message={message}
                      userAvatarConfig={userAvatarConfig}
                      companionAvatarConfig={companionAvatarConfig}
                      favoriteColor={favoriteColor}
                      isFirstMessage={index === 0}
                      isGrouped={isGrouped}
                      bubbleColorKey={bubbleColorKey}
                      textColorKey={textColorKey}
                      fontFamily={fontFamily}
                      companionBubbleColorKey={companionBubbleColorKey}
                      companionTextColorKey={companionTextColorKey}
                      companionId={companionId}
                      currentRating={ratingsMap[message.id] ?? null}
                      onRated={onRated}
                      onRegenerate={onRegenerate}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showScrollButton && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-6 right-6 w-12 h-12 bg-white/95 hover:bg-white backdrop-blur-md rounded-full shadow-lg hover:shadow-xl border border-gray-200/50 flex items-center justify-center transition-all duration-200 z-30 group"
            title="Scroll to bottom"
          >
            <ArrowDown className="w-5 h-5 text-gray-700 group-hover:text-rose-500 transition-colors" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

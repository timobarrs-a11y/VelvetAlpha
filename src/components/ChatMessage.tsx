import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Message } from '../types';
import { Avatar } from './Avatar';
import { AvatarConfig } from '../types/avatar';
import { motion } from 'framer-motion';
import { calculateComposeDelayMs } from '../features/chat/typing/typingPacer';
import { ExternalLink, CalendarDays } from 'lucide-react';
import { AtlasMarkdown } from './AtlasMarkdown';
import { getBubbleStyle, getTextColorValue } from './ChatStyleBar';
import { MessageRatingControls } from './MessageRatingControls';
import { RatingValue } from '../services/ratingService';

const ENABLE_TYPING_REALISM = true;

// ─── Custom SVG icons for Atlas and Navi ────────────────────────────────────
function AtlasIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function NaviIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
    </svg>
  );
}

interface ChatMessageProps {
  message: Message;
  userAvatarConfig?: AvatarConfig | null;
  companionAvatarConfig?: AvatarConfig | null;
  favoriteColor?: string;
  isFirstMessage?: boolean;
  isGrouped?: boolean;
  // User bubble customization — applies to ALL user messages reactively
  bubbleColorKey?: string | null;
  textColorKey?: string | null;
  fontFamily?: string | null;
  // Companion bubble customization
  companionBubbleColorKey?: string | null;
  companionTextColorKey?: string | null;
  // Rating controls
  companionId?: string;
  currentRating?: RatingValue | null;
  onRated?: (messageId: string, rating: RatingValue | null) => void;
  onRegenerate?: (messageId: string) => void;
}

const convertYouTubeLinksToInternal = (text: string, navigate: (path: string) => void): (string | JSX.Element)[] => {
  const youtubeRegex = /(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;
  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  let match;

  while ((match = youtubeRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    const fullUrl = match[0];
    parts.push(
      <a
        key={match.index}
        href={`/videos?url=${encodeURIComponent(fullUrl)}`}
        className="text-red-500 hover:text-red-600 underline font-semibold transition-colors"
        onClick={(e) => {
          e.preventDefault();
          navigate(`/videos?url=${encodeURIComponent(fullUrl)}`);
        }}
      >
        Watch Video
      </a>
    );

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
};

function SystemMessage({ message }: { message: Message }) {
  const isEntry = message.messageType === 'bot-entry';
  const isExit = message.messageType === 'bot-exit';
  const isAtlas = message.botSource === 'atlas';
  const isNavi = message.botSource === 'navi';

  if (isEntry || isExit) {
    const color = isAtlas
      ? 'border-sky-200/60 text-sky-600 bg-sky-50/80'
      : isNavi
      ? 'border-teal-200/60 text-teal-600 bg-teal-50/80'
      : 'border-gray-200/60 text-gray-500 bg-gray-50/80';
    const Icon = isAtlas ? AtlasIcon : NaviIcon;
    return (
      <div className="flex items-center justify-center py-3">
        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-medium ${color}`}>
          <Icon className="w-3 h-3" />
          <span>{message.content}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-2">
      <span className="text-xs text-gray-400 italic">{message.content}</span>
    </div>
  );
}

function NewsCard({ message }: { message: Message }) {
  const meta = message.metadata;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-start gap-2 sm:gap-3 mt-4"
    >
      {/* Atlas lightning icon for news */}
      <div className="w-8 h-8 sm:w-9 sm:h-9 flex-shrink-0 mt-0.5 rounded-full overflow-hidden shadow-md ring-2 ring-white/60 bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center">
        <AtlasIcon className="w-4 h-4 text-white" />
      </div>
      <div className="max-w-[80%] sm:max-w-[65%]">
        <div className="bg-white rounded-2xl rounded-bl-sm border border-gray-200/80 shadow-sm overflow-hidden">
          {meta?.article_image && (
            <img
              src={meta.article_image as string}
              alt=""
              className="w-full h-28 object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          <div className="p-3.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                {meta?.article_source as string || 'News'}
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-900 leading-snug mb-2">
              {meta?.article_title as string || message.content}
            </p>
            <p className="text-xs text-gray-500 leading-relaxed mb-3 line-clamp-2">
              {message.content}
            </p>
            {meta?.article_url && (
              <a
                href={meta.article_url as string}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Read Article
              </a>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function CalendarCard({ message }: { message: Message }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-start gap-2 sm:gap-3 mt-4"
    >
      <div className="w-8 h-8 sm:w-9 sm:h-9 flex-shrink-0 mt-0.5 rounded-full overflow-hidden shadow-md ring-2 ring-white/60 bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
        <CalendarDays className="w-4 h-4 text-white" />
      </div>
      <div className="max-w-[80%] sm:max-w-[65%]">
        <div className="bg-white rounded-2xl rounded-bl-sm border border-amber-200/80 shadow-sm p-3.5">
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide">
              Calendar
            </span>
          </div>
          <AtlasMarkdown content={message.content} />
        </div>
      </div>
    </motion.div>
  );
}

function AtlasMessage({
  message,
  companionBubbleColorKey,
  companionTextColorKey,
  fontFamily,
}: {
  message: Message;
  companionBubbleColorKey?: string | null;
  companionTextColorKey?: string | null;
  fontFamily?: string | null;
}) {
  const isNavi = message.botSource === 'navi';
  const Icon = isNavi ? NaviIcon : AtlasIcon;

  // Atlas: electric sky gradient — Navi: teal gradient
  const avatarBgStyle = isNavi
    ? { background: 'linear-gradient(135deg, #0d9488, #14b8a6)' }
    : { background: 'linear-gradient(135deg, #0369a1, #0ea5e9)' };

  const headerColor = isNavi
    ? 'text-teal-600 bg-teal-50/80 border-teal-200/70'
    : 'text-sky-700 bg-sky-50/80 border-sky-200/70';

  const dotStyle = isNavi
    ? { background: '#14b8a6' }
    : { background: '#0ea5e9' };

  const label = isNavi ? 'Navi' : 'Atlas';

  // Companion color overrides for atlas/navi messages — apply if set
  const hasBubbleOverride = !!companionBubbleColorKey;
  const bubbleStyle = hasBubbleOverride ? getBubbleStyle(companionBubbleColorKey) : null;
  const textColor = companionTextColorKey ? getTextColorValue(companionTextColorKey) : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-start gap-2 sm:gap-3 mt-4"
    >
      {/* Unique icon — lightning for Atlas, pin for Navi */}
      <div
        className="w-8 h-8 sm:w-9 sm:h-9 flex-shrink-0 mt-0.5 rounded-full shadow-md ring-2 ring-white/60 flex items-center justify-center"
        style={avatarBgStyle}
      >
        <Icon className="w-4 h-4 text-white" />
      </div>

      <div className="max-w-[80%] sm:max-w-[70%]">
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold mb-1.5 ${headerColor}`}>
          <span className="w-1.5 h-1.5 rounded-full" style={dotStyle} />
          {label}
        </div>
        <div
          className="rounded-2xl rounded-bl-sm border border-gray-200/80 shadow-sm p-4"
          style={bubbleStyle
            ? { ...bubbleStyle, color: textColor ?? '#ffffff' }
            : { background: 'white' }
          }
        >
          <AtlasMarkdown content={message.content} />
        </div>
      </div>
    </motion.div>
  );
}

export const ChatMessage = ({
  message,
  userAvatarConfig,
  companionAvatarConfig,
  favoriteColor,
  isFirstMessage,
  isGrouped = false,
  bubbleColorKey,
  textColorKey,
  fontFamily,
  companionBubbleColorKey,
  companionTextColorKey,
  companionId = '',
  currentRating = null,
  onRated,
  onRegenerate,
}: ChatMessageProps) => {
  const navigate = useNavigate();
  const isUser = message.sender === 'user';

  // User bubble style — custom key overrides favoriteColor-based gradient
  const customBubbleStyle = bubbleColorKey ? getBubbleStyle(bubbleColorKey) : null;
  const customTextColor = textColorKey ? getTextColorValue(textColorKey) : null;

  // Fallback gradient from favoriteColor when no custom key set
  const fallbackBg = (() => {
    if (!favoriteColor) return 'linear-gradient(135deg,#f43f5e,#ec4899)';
    const map: Record<string, string> = {
      'Red':    'linear-gradient(135deg,#ef4444,#f43f5e)',
      'Blue':   'linear-gradient(135deg,#3b82f6,#0ea5e9)',
      'Green':  'linear-gradient(135deg,#22c55e,#10b981)',
      'Purple': 'linear-gradient(135deg,#a855f7,#d946ef)',
      'Pink':   'linear-gradient(135deg,#ec4899,#f43f5e)',
      'Orange': 'linear-gradient(135deg,#f97316,#f59e0b)',
      'Yellow': 'linear-gradient(135deg,#eab308,#f59e0b)',
      'Black':  'linear-gradient(135deg,#1f2937,#111827)',
      'White':  'linear-gradient(135deg,#f8fafc,#f1f5f9)',
    };
    return map[favoriteColor] ?? 'linear-gradient(135deg,#f43f5e,#ec4899)';
  })();

  const fallbackTextColor = favoriteColor === 'Yellow' || favoriteColor === 'White' ? '#1f2937' : '#ffffff';

  const [isComposing, setIsComposing] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const messageRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const msgType = message.messageType ?? 'text';

  if (msgType === 'system' || msgType === 'bot-entry' || msgType === 'bot-exit') {
    return <SystemMessage message={message} />;
  }

  if (msgType === 'news-card') {
    return <NewsCard message={message} />;
  }

  if (msgType === 'calendar-card') {
    return <CalendarCard message={message} />;
  }

  if (msgType === 'brief-block' && message.botSource !== 'companion') {
    return <AtlasMessage message={message} companionBubbleColorKey={companionBubbleColorKey} companionTextColorKey={companionTextColorKey} fontFamily={fontFamily} />;
  }

  if (message.botSource === 'atlas' || message.botSource === 'navi') {
    return <AtlasMessage message={message} companionBubbleColorKey={companionBubbleColorKey} companionTextColorKey={companionTextColorKey} fontFamily={fontFamily} />;
  }

  let time = '';
  try {
    if (message.timestamp) {
      time = new Date(message.timestamp).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
    }
  } catch {
    time = '';
  }

  useEffect(() => {
    const shouldDelayReveal =
      ENABLE_TYPING_REALISM &&
      !isUser &&
      message.isTyping;

    if (!shouldDelayReveal) {
      setShowContent(true);
      setIsComposing(false);
      return;
    }

    setIsComposing(true);
    setShowContent(false);

    const delayMs = calculateComposeDelayMs(message.content);

    timeoutRef.current = setTimeout(() => {
      setShowContent(true);
      setIsComposing(false);
      timeoutRef.current = null;
    }, delayMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [message.content, message.isTyping, isUser]);

  const handleRevealNow = () => {
    if (isComposing && !showContent) {
      setShowContent(true);
      setIsComposing(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  };

  const processedContent = convertYouTubeLinksToInternal(message.content, navigate);
  const avatarConfig = isUser ? userAvatarConfig : companionAvatarConfig;

  // Final bubble style for user messages — always applied inline for reactive updates
  const userBubbleStyle: React.CSSProperties = isUser
    ? {
        background: customBubbleStyle?.background ?? fallbackBg,
        color: customTextColor ?? fallbackTextColor,
        fontFamily: fontFamily ?? undefined,
      }
    : {};

  // Companion message style
  const companionBubbleStyle: React.CSSProperties = !isUser
    ? {
        background: companionBubbleColorKey ? getBubbleStyle(companionBubbleColorKey).background : 'white',
        color: companionTextColorKey ? getTextColorValue(companionTextColorKey) : '#000000',
        fontFamily: fontFamily ?? undefined,
      }
    : {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} gap-2 sm:gap-3 group ${isGrouped ? 'mt-1' : 'mt-4'}`}
    >
      {!isUser && (
        <div className="w-8 h-8 sm:w-9 sm:h-9 flex-shrink-0 mt-0.5">
          {!isGrouped ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.05, type: 'spring', stiffness: 200 }}
              className="w-full h-full rounded-full overflow-hidden shadow-md ring-2 ring-white/60"
            >
              {avatarConfig ? (
                <Avatar config={avatarConfig} className="w-full h-full" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">AI</span>
                </div>
              )}
            </motion.div>
          ) : (
            <div className="w-full h-full" />
          )}
        </div>
      )}

      <div className={`max-w-[80%] sm:max-w-[65%] relative ${isUser ? 'order-2' : 'order-1'}`}>
        <motion.div
          ref={messageRef}
          initial={{ scale: 0.96 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.03 }}
          onClick={handleRevealNow}
          className={`rounded-2xl px-4 py-3 sm:px-5 sm:py-3.5 relative shadow-md hover:shadow-lg transition-shadow duration-200 ${
            isUser ? 'rounded-br-sm' : `rounded-bl-sm border border-gray-200/80 ${isComposing ? 'cursor-pointer' : ''}`
          }`}
          style={isUser ? userBubbleStyle : companionBubbleStyle}
        >
          {showContent && (
            <p
              className="text-[15px] leading-relaxed font-normal"
              style={{ lineHeight: '1.65', fontFamily: fontFamily ?? undefined }}
            >
              {processedContent}
            </p>
          )}
        </motion.div>

        {time && (
          <div
            className={`text-[10px] text-gray-400 mt-1 px-2 font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${
              isUser ? 'text-right' : 'text-left'
            }`}
          >
            {time}
          </div>
        )}

        {!isUser && onRated && message.messageType === 'text' && (
          <div className="mt-1">
            <MessageRatingControls
              messageId={message.id}
              conversationId={message.id}
              companionId={companionId}
              currentRating={currentRating}
              onRated={(rating) => onRated(message.id, rating)}
              onRegenerate={onRegenerate ? () => onRegenerate(message.id) : undefined}
            />
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0 mt-0.5">
          {!isGrouped ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.05, type: 'spring', stiffness: 200 }}
              className="w-full h-full rounded-full overflow-hidden shadow-md ring-2 ring-white/60"
            >
              {avatarConfig ? (
                <Avatar config={avatarConfig} className="w-full h-full" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-blue-400 to-sky-500 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">You</span>
                </div>
              )}
            </motion.div>
          ) : (
            <div className="w-full h-full" />
          )}
        </div>
      )}
    </motion.div>
  );
};

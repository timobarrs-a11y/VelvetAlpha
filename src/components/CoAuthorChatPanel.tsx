import { useEffect, useRef } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { Avatar } from './Avatar';
import { CoAuthorChatMessage } from '../services/coAuthorService';
import { AvatarConfig } from '../types/avatar';
import { Message } from '../types';

interface CoAuthorChatPanelProps {
  companionName: string;
  companionAvatarConfig: AvatarConfig | null;
  userAvatarConfig: AvatarConfig | null;
  messages: CoAuthorChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  favoriteColor?: string;
}

export const CoAuthorChatPanel = ({
  companionName,
  companionAvatarConfig,
  userAvatarConfig,
  messages,
  onSendMessage,
  isLoading,
  favoriteColor,
}: CoAuthorChatPanelProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const convertToMessageFormat = (chatMessage: CoAuthorChatMessage, index: number, isTyping: boolean = false): Message => {
    return {
      id: chatMessage.id || `temp-${index}`,
      content: chatMessage.message_content,
      sender: chatMessage.sender_type === 'user' ? 'user' : 'ai',
      timestamp: new Date(chatMessage.created_at).getTime(),
      isTyping,
    };
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      <div className="flex items-center gap-3 p-4 border-b border-gray-200 bg-gradient-to-r from-primary-50 to-blue-50">
        {companionAvatarConfig && (
          <div className="w-10 h-10">
            <Avatar config={companionAvatarConfig} />
          </div>
        )}
        <div>
          <h3 className="font-semibold text-gray-900">{companionName}</h3>
          <p className="text-xs text-gray-500">Co-Author Chat</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400 text-sm text-center">
              Start a conversation about your project.<br />
              This chat is for discussion only.
            </p>
          </div>
        )}

        {messages.map((msg, index) => (
          <ChatMessage
            key={msg.id}
            message={convertToMessageFormat(msg, index, false)}
            userAvatarConfig={userAvatarConfig}
            companionAvatarConfig={companionAvatarConfig}
            favoriteColor={msg.sender_type === 'avatar' ? favoriteColor : undefined}
          />
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-gray-400">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-sm">{companionName} is typing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <ChatInput
        onSend={onSendMessage}
        disabled={isLoading}
        characterName={companionName}
        lastMessageText={messages.length > 0 ? messages[messages.length - 1].message_content.slice(0, 120) : undefined}
        draftScope="co-author"
      />
    </div>
  );
};

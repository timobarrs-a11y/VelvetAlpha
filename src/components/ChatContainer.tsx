import { useEffect, useRef } from 'react';
import { ChatMessage } from './ChatMessage';
import { Message } from '../types';

interface ChatContainerProps {
  messages: Message[];
  characterName?: string;
}

export const ChatContainer = ({ messages, characterName = 'your companion' }: ChatContainerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-gray-50 to-white"
    >
      {messages.length === 0 ? (
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-400 mb-2">No messages yet</p>
            <p className="text-sm text-gray-300">
              Say hi to {characterName} to start chatting!
            </p>
          </div>
        </div>
      ) : (
        messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))
      )}
    </div>
  );
};

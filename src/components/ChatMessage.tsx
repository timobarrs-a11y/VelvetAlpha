import { Message } from '../types';
import { useTypingEffect } from '../hooks/useTypingEffect';

interface ChatMessageProps {
  message: Message;
}

export const ChatMessage = ({ message }: ChatMessageProps) => {
  console.log('ChatMessage received message:', message);
  console.log('Message timestamp:', message.timestamp);
  console.log('Message timestamp type:', typeof message.timestamp);

  const isUser = message.sender === 'user';

  let time = '';
  try {
    if (message.timestamp) {
      time = new Date(message.timestamp).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
    }
  } catch (e) {
    console.error('Error formatting timestamp:', e);
    time = '';
  }

  console.log('Formatted time:', time);

  const shouldAnimate = !isUser && message.isTyping;
  const { displayedText } = useTypingEffect(
    message.content,
    shouldAnimate || false,
    80
  );

  console.log('ChatMessage displayedText:', displayedText);
  console.log('ChatMessage displayedText type:', typeof displayedText);
  console.log('ChatMessage displayedText === "undefined":', displayedText === 'undefined');
  console.log('ChatMessage shouldAnimate:', shouldAnimate);

  const displayContent = shouldAnimate ? (displayedText || message.content) : message.content;

  console.log('ChatMessage displayContent:', displayContent);
  console.log('ChatMessage message.content:', message.content);
  console.log('Does displayContent end with undefined?', displayContent?.endsWith('undefined'));
  console.log('Does displayContent end with " undefined"?', displayContent?.endsWith(' undefined'));

  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 animate-slideIn`}
    >
      <div className={`max-w-[75%] ${isUser ? 'order-2' : 'order-1'}`}>
        <div
          className={`rounded-3xl px-5 py-3.5 shadow-soft ${
            isUser
              ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-gray-900 rounded-br-lg'
              : 'bg-white text-gray-800 rounded-bl-lg border border-gray-100'
          }`}
        >
          <p className="text-[15px] leading-relaxed">
            {displayContent}
          </p>
        </div>
        {time && (
          <p
            className={`text-xs text-gray-400 mt-1.5 px-3 font-medium ${
              isUser ? 'text-right' : 'text-left'
            }`}
          >
            {time}
          </p>
        )}
      </div>
    </div>
  );
};

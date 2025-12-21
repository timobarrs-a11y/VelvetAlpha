import { useState } from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
  remainingMessages: number;
  characterName: string;
}

export const ChatInput = ({ onSend, disabled, remainingMessages, characterName }: ChatInputProps) => {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSend(input.trim());
      setInput('');
    }
  };

  return (
    <div className="glass-effect border-t border-gray-100/50 p-5">
      <form onSubmit={handleSubmit} className="flex gap-3 max-w-4xl mx-auto">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            disabled ? 'Daily limit reached' : `Message ${characterName}...`
          }
          disabled={disabled}
          className="flex-1 px-5 py-3.5 rounded-full border-2 border-gray-200 focus:outline-none focus:ring-4 focus:ring-primary-100 focus:border-primary-500 disabled:bg-gray-50 disabled:cursor-not-allowed transition-all duration-200 text-[15px]"
        />
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className="bg-gradient-to-br from-primary-500 to-primary-600 text-white p-3.5 rounded-full hover:shadow-glow hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-soft"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
};

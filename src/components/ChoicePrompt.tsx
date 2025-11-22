import { MessageCircle, Clock } from 'lucide-react';
import type { ChoicePromptResponse } from '../types';

interface ChoicePromptProps {
  choiceData: ChoicePromptResponse;
  onChoice: (choice: 'interrupt' | 'wait') => void;
  disabled: boolean;
}

export const ChoicePrompt = ({ choiceData, onChoice, disabled }: ChoicePromptProps) => {
  return (
    <div className="mb-4 max-w-[80%]">
      <div className="bg-white rounded-2xl rounded-bl-md p-4 shadow-sm">
        <p className="text-gray-800 whitespace-pre-wrap mb-4">{choiceData.choicePrompt}</p>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => onChoice('interrupt')}
            disabled={disabled}
            className="flex items-center gap-2 px-4 py-2 bg-pink-500 text-white rounded-full hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <MessageCircle size={16} />
            <span>I need you now</span>
          </button>

          <button
            onClick={() => onChoice('wait')}
            disabled={disabled}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-full hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Clock size={16} />
            <span>I can wait {choiceData.waitMinutes} min</span>
          </button>
        </div>
      </div>
    </div>
  );
};
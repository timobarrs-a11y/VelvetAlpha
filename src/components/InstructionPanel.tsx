import { useState } from 'react';
import { Sparkles, FileText } from 'lucide-react';
import { CoAuthorSession } from '../services/coAuthorService';

interface InstructionPanelProps {
  session: CoAuthorSession;
  onUpdateSession: (updates: Partial<Pick<CoAuthorSession, 'purpose' | 'length_preference' | 'session_prompt'>>) => void;
}

export function InstructionPanel({ session, onUpdateSession }: InstructionPanelProps) {
  const [localPrompt, setLocalPrompt] = useState(session.session_prompt || '');

  const handlePromptBlur = () => {
    if (localPrompt !== session.session_prompt) {
      onUpdateSession({ session_prompt: localPrompt || null });
    }
  };

  const purposeOptions = [
    {
      value: 'Writing' as const,
      label: 'Writing',
      icon: Sparkles,
      description: 'Creative, expressive, generative content'
    },
    {
      value: 'Research' as const,
      label: 'Research',
      icon: FileText,
      description: 'Structured, investigative, analytical content'
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-3">
          What are we working on?
        </label>
        <textarea
          value={localPrompt}
          onChange={(e) => setLocalPrompt(e.target.value)}
          onBlur={handlePromptBlur}
          placeholder="e.g., 'A sci-fi short story about time travel' or 'Research on renewable energy trends'"
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all resize-none text-[15px]"
          rows={3}
        />
        <p className="mt-2 text-xs text-gray-600">
          This is the main creative direction for your session. It guides both canvas writing and chat discussions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Purpose
          </label>
          <div className="grid grid-cols-2 gap-2">
            {purposeOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  onClick={() => onUpdateSession({ purpose: option.value })}
                  className={`px-4 py-3 rounded-lg font-medium transition-all text-left ${
                    session.purpose === option.value
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4" />
                    <span>{option.label}</span>
                  </div>
                  <p className={`text-xs ${session.purpose === option.value ? 'text-blue-100' : 'text-gray-500'}`}>
                    {option.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Response Length
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['1-2 sentences', '3-4 sentences', '1 paragraph', '2-3 paragraphs'] as const).map((length) => (
              <button
                key={length}
                onClick={() => onUpdateSession({ length_preference: length })}
                className={`px-4 py-2.5 rounded-lg font-medium transition-all text-sm ${
                  session.length_preference === length
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {length}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Default length for canvas contributions
          </p>
        </div>
      </div>
    </div>
  );
}

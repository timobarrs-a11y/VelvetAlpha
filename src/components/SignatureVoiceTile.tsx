import { SignatureVoice } from '../config/signatureVoices';
import { Crown } from 'lucide-react';

interface SignatureVoiceTileProps {
  voice: SignatureVoice;
  selected?: boolean;
  onClick?: () => void;
}

export default function SignatureVoiceTile({ voice, selected = false, onClick }: SignatureVoiceTileProps) {
  return (
    <button
      onClick={onClick}
      className={`
        relative w-full p-6 rounded-xl border-2 transition-all text-left
        ${selected
          ? 'border-blue-500 bg-blue-500/10 shadow-lg'
          : 'border-gray-700 bg-gray-800/50 hover:border-gray-600 hover:bg-gray-800'
        }
      `}
    >
      {voice.premium && (
        <div className="absolute top-3 right-3">
          <Crown className="w-4 h-4 text-yellow-400" />
        </div>
      )}

      <h3 className="text-lg font-bold text-white mb-2">
        {voice.name}
      </h3>

      <p className="text-sm text-gray-400 mb-3">
        {voice.description}
      </p>

      <p className="text-sm text-gray-300 italic leading-relaxed">
        "{voice.sample}"
      </p>

      {voice.premium && (
        <div className="mt-3 inline-block px-2 py-1 bg-yellow-400/10 border border-yellow-400/30 rounded text-xs text-yellow-400 font-medium">
          Premium
        </div>
      )}
    </button>
  );
}

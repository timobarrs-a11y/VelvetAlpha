import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

const LOADING_PHRASES = [
  'Warming up your world...',
  'Loading your companions...',
  'Finding today\'s thread...',
  'Gathering your memories...',
  'Setting the scene...',
];

export function RouteFallback() {
  const [phraseIdx, setPhraseIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIdx(prev => (prev + 1) % LOADING_PHRASES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(160deg, #060d1f 0%, #09142e 40%, #0a1628 70%, #071020 100%)' }}
    >
      <div className="text-center">
        <div className="relative w-16 h-16 mx-auto mb-6">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              border: '2px solid rgba(255,255,255,0.06)',
              animation: 'ping 2s cubic-bezier(0,0,0.2,1) infinite',
            }}
          />
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{
              background: 'rgba(192,132,252,0.08)',
              border: '1px solid rgba(192,132,252,0.2)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <Sparkles
              className="w-7 h-7"
              style={{ color: 'rgba(192,132,252,0.6)', animation: 'pulse 2s ease-in-out infinite' }}
            />
          </div>
        </div>
        <p
          className="text-white/50 text-sm font-medium transition-opacity duration-500"
          style={{ animation: 'fadeInOut 2.2s ease-in-out infinite' }}
          key={phraseIdx}
        >
          {LOADING_PHRASES[phraseIdx]}
        </p>
        <style>{`
          @keyframes fadeInOut {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 1; }
          }
          @keyframes pulse {
            0%, 100% { opacity: 0.5; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.08); }
          }
        `}</style>
      </div>
    </div>
  );
}

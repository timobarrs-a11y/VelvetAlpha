import { Sparkles } from 'lucide-react';

export function RouteFallback() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="text-center">
        <div className="relative w-16 h-16 mx-auto mb-5">
          <div className="absolute inset-0 rounded-full border-2 border-white/10 animate-ping" />
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-white/40" />
          </div>
        </div>
        <p className="text-white/40 text-sm">Loading...</p>
      </div>
    </div>
  );
}

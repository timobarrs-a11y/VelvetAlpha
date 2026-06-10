import { useEffect, useRef, useCallback, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Volume2, VolumeX } from 'lucide-react';
import { FoxRunnerEngine } from '../game/fox-runner/engine';
import { supabase } from '../shared/supabase/client';

export function FoxRunnerGame() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<FoxRunnerEngine | null>(null);
  const [muted, setMuted] = useState(false);

  const saveScore = useCallback(async (score: number, berries: number, deaths: number, enemiesStomped: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('platformer_sessions').insert({
        user_id: user.id,
        score,
        level_reached: 5,
        berries_collected: berries,
        enemies_stomped: enemiesStomped,
        deaths,
        completed: true,
      });
    } catch (err) {
      console.error('Failed to save score:', err);
    }
  }, []);

  const handleMute = useCallback(() => {
    if (!engineRef.current) return;
    const next = !engineRef.current.audio.isMuted();
    engineRef.current.audio.setMuted(next);
    setMuted(next);
  }, []);

  const handleQuit = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.stop();
      engineRef.current = null;
    }
    const companionId = searchParams.get('companion');
    navigate(companionId ? `/chat?companion=${companionId}` : '/lobby');
  }, [navigate, searchParams]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new FoxRunnerEngine(canvas, {
      onGameComplete: saveScore,
    });

    engineRef.current = engine;
    engine.start();
    containerRef.current?.focus();

    return () => {
      engine.stop();
      engineRef.current = null;
    };
  }, [saveScore]);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="fixed inset-0 bg-black flex flex-col items-center justify-center outline-none"
    >
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <button
          onClick={handleQuit}
          className="flex items-center gap-2 bg-black/60 hover:bg-black/80 text-gray-300 hover:text-white px-3 py-2 rounded-lg transition-all text-sm border border-gray-700/50"
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
        <button
          onClick={handleMute}
          className="flex items-center justify-center w-9 h-9 bg-black/60 hover:bg-black/80 text-gray-300 hover:text-white rounded-lg transition-all border border-gray-700/50"
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </div>

      <canvas
        ref={canvasRef}
        className="max-w-full max-h-full rounded-lg"
        style={{ imageRendering: 'pixelated' }}
      />

      <div className="mt-3 flex gap-6 text-gray-500 text-xs">
        <span>Arrow Keys / WASD - Move</span>
        <span>Space / Up - Jump (hold for higher)</span>
        <span>ESC - Pause</span>
      </div>
    </div>
  );
}

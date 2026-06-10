import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Phaser from 'phaser';
import { ArrowLeft } from 'lucide-react';
import { HomeRunDerbyScene } from '../game/home-run-derby/HomeRunDerbyScene';

export function HomeRunDerbyGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (!containerRef.current || gameRef.current) {
      return;
    }

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: 960,
      height: 640,
      backgroundColor: '#111827',
      scene: HomeRunDerbyScene,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    });

    gameRef.current = game;

    return () => {
      game.destroy(true);
      gameRef.current = null;
    };
  }, []);

  const handleQuit = () => {
    if (gameRef.current) {
      gameRef.current.destroy(true);
      gameRef.current = null;
    }

    const companionId = searchParams.get('companion');
    navigate(companionId ? `/chat?companion=${companionId}` : '/lobby');
  };

  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center">
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        <button
          onClick={handleQuit}
          className="flex items-center gap-2 bg-black/60 hover:bg-black/80 text-gray-300 hover:text-white px-3 py-2 rounded-lg transition-all text-sm border border-gray-700/50"
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
      </div>

      <div ref={containerRef} className="w-full h-full max-w-[960px] max-h-[640px]" />
    </div>
  );
}

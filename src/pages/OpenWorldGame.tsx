import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Phaser from 'phaser';
import { ArrowLeft, Star } from 'lucide-react';
import { CityScene, type HudState } from '../game/open-world/CityScene';

const WANTED_MAX = 5;

export function OpenWorldGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const navigate = useNavigate();
  const [hud, setHud] = useState<HudState>({
    mode: 'car',
    mph: 0,
    wanted: 0,
    cash: 0,
    busted: false,
  });

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: 960,
      height: 640,
      backgroundColor: '#10241c',
      physics: {
        default: 'arcade',
        arcade: { gravity: { x: 0, y: 0 }, debug: false },
      },
      scene: CityScene,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    });
    gameRef.current = game;

    const onHud = (s: HudState) => setHud(s);
    game.events.on('ow-hud', onHud);

    // minimap render loop
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const canvas = minimapRef.current;
      const scene = game.scene.getScene('CityScene') as CityScene | null;
      if (!canvas || !scene || !scene.scene.isActive()) return;
      const ctx = canvas.getContext('2d');
      if (!ctx || typeof scene.getMinimapData !== 'function') return;

      const data = scene.getMinimapData();
      const size = canvas.width;
      const s = size / data.world;
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = 'rgba(16,36,28,0.85)';
      ctx.fillRect(0, 0, size, size);
      // grid hint
      ctx.strokeStyle = 'rgba(74,79,92,0.5)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 9; i++) {
        const p = (data.world / 9) * i * s;
        ctx.beginPath();
        ctx.moveTo(p, 0);
        ctx.lineTo(p, size);
        ctx.moveTo(0, p);
        ctx.lineTo(size, p);
        ctx.stroke();
      }
      // cops
      ctx.fillStyle = '#3a7bff';
      data.cops.forEach((c) => {
        ctx.beginPath();
        ctx.arc(c.x * s, c.y * s, 3, 0, Math.PI * 2);
        ctx.fill();
      });
      // player
      ctx.fillStyle = '#ff5e7e';
      ctx.beginPath();
      ctx.arc(data.player.x * s, data.player.y * s, 4, 0, Math.PI * 2);
      ctx.fill();
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      game.events.off('ow-hud', onHud);
      game.destroy(true);
      gameRef.current = null;
    };
  }, []);

  const handleQuit = () => {
    if (gameRef.current) {
      gameRef.current.destroy(true);
      gameRef.current = null;
    }
    navigate('/lobby');
  };

  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center overflow-hidden">
      {/* top bar */}
      <div className="absolute top-4 left-4 z-20 flex gap-2">
        <button
          onClick={handleQuit}
          className="flex items-center gap-2 bg-black/60 hover:bg-black/80 text-gray-300 hover:text-white px-3 py-2 rounded-lg transition-all text-sm border border-gray-700/50"
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>
      </div>

      {/* wanted + cash */}
      <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2">
        <div className="flex gap-1 bg-black/50 px-3 py-2 rounded-lg border border-gray-700/50">
          {Array.from({ length: WANTED_MAX }).map((_, i) => (
            <Star
              key={i}
              size={18}
              className={
                i < hud.wanted ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'
              }
            />
          ))}
        </div>
        <div className="bg-black/50 px-3 py-1.5 rounded-lg border border-gray-700/50 text-emerald-400 font-mono text-lg">
          ${hud.cash}
        </div>
      </div>

      {/* game canvas */}
      <div ref={containerRef} className="w-full h-full max-w-[960px] max-h-[640px]" />

      {/* bottom-left: speedo + mode */}
      <div className="absolute bottom-4 left-4 z-20 flex items-end gap-3">
        <div className="bg-black/50 px-4 py-2 rounded-lg border border-gray-700/50 text-center">
          <div className="text-3xl font-mono text-white leading-none">{hud.mph}</div>
          <div className="text-[10px] uppercase tracking-widest text-gray-400 mt-1">mph</div>
        </div>
        <div className="bg-black/50 px-3 py-2 rounded-lg border border-gray-700/50 text-xs text-gray-300">
          {hud.mode === 'car' ? 'Driving' : 'On foot'}
        </div>
      </div>

      {/* bottom-right: minimap */}
      <div className="absolute bottom-4 right-4 z-20">
        <canvas
          ref={minimapRef}
          width={150}
          height={150}
          className="rounded-lg border border-gray-700/50 bg-black/50"
        />
      </div>

      {/* controls hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-black/50 px-4 py-2 rounded-lg border border-gray-700/50 text-[11px] text-gray-400 hidden sm:block">
        <span className="text-gray-200">WASD</span> drive/walk ·{' '}
        <span className="text-gray-200">F</span> enter/exit car
      </div>

      {/* busted overlay */}
      {hud.busted && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-blue-900/40 backdrop-blur-sm pointer-events-none">
          <div className="text-5xl font-black tracking-widest text-white drop-shadow-lg">
            BUSTED
          </div>
        </div>
      )}
    </div>
  );
}

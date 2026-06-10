import { useState, useEffect, useRef } from 'react';
import { SECTORS, GAME_WIDTH, GAME_HEIGHT, seededRandom } from '../config/stellarPursuitConstants';
import { Star, Sector } from '../types/stellarPursuit';

export function StellarPursuitSectorPreview() {
  const [currentSectorIndex, setCurrentSectorIndex] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(true);
  const [stars, setStars] = useState<Star[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  const currentSector = SECTORS[currentSectorIndex];

  useEffect(() => {
    generateStarsForSector(currentSector);
  }, [currentSectorIndex]);

  useEffect(() => {
    if (isAutoPlay) {
      const interval = setInterval(() => {
        setCurrentSectorIndex((prev) => (prev + 1) % SECTORS.length);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isAutoPlay]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      updateStars();
      renderScene(ctx);
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [stars, currentSector]);

  const generateStarsForSector = (sector: Sector) => {
    const newStars: Star[] = [];
    const seed = sector.number * 1000;

    for (let i = 0; i < sector.starDensity; i++) {
      const layer = Math.floor(seededRandom(seed + i * 3) * 3);
      const speeds = [0.3, 1.0, 2.5];

      newStars.push({
        x: seededRandom(seed + i) * GAME_WIDTH,
        y: seededRandom(seed + i + 1) * GAME_HEIGHT,
        size: sector.starSizes[0] + seededRandom(seed + i + 2) * (sector.starSizes[1] - sector.starSizes[0]),
        color: sector.starColors[Math.floor(seededRandom(seed + i + 3) * sector.starColors.length)],
        layer,
        speed: speeds[layer],
        twinklePhase: sector.twinkle ? seededRandom(seed + i + 4) * Math.PI * 2 : 0
      });
    }

    setStars(newStars);
  };

  const updateStars = () => {
    setStars((prevStars) =>
      prevStars.map((star) => {
        let newY = star.y + star.speed;
        if (newY > GAME_HEIGHT) {
          newY = 0;
        }

        let newTwinklePhase = star.twinklePhase || 0;
        if (currentSector.twinkle) {
          newTwinklePhase += 0.05;
        }

        return {
          ...star,
          y: newY,
          twinklePhase: newTwinklePhase
        };
      })
    );
  };

  const renderScene = (ctx: CanvasRenderingContext2D) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    gradient.addColorStop(0, currentSector.hueStart);
    gradient.addColorStop(1, currentSector.hueEnd);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    renderFeatures(ctx, currentSector);

    const starsByLayer = [
      stars.filter((s) => s.layer === 0),
      stars.filter((s) => s.layer === 1),
      stars.filter((s) => s.layer === 2)
    ];

    starsByLayer.forEach((layerStars, layerIndex) => {
      const opacity = [0.4, 0.7, 1.0][layerIndex];

      layerStars.forEach((star) => {
        let starOpacity = opacity;
        if (currentSector.twinkle && star.twinklePhase !== undefined) {
          starOpacity *= 0.5 + 0.5 * Math.sin(star.twinklePhase);
        }

        ctx.fillStyle = star.color;
        ctx.globalAlpha = starOpacity;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });
    });

    ctx.globalAlpha = 1.0;
  };

  const renderFeatures = (ctx: CanvasRenderingContext2D, sector: Sector) => {
    sector.feature.elements.forEach((element) => {
      ctx.save();

      if (element.blur) {
        ctx.filter = `blur(${element.blur}px)`;
      }

      ctx.fillStyle = element.color;
      ctx.globalAlpha = element.opacity;

      switch (element.type) {
        case 'circle':
          if (element.radius) {
            ctx.beginPath();
            ctx.arc(element.x, element.y, element.radius, 0, Math.PI * 2);
            ctx.fill();
          }
          break;

        case 'ellipse':
          if (element.rx && element.ry) {
            ctx.beginPath();
            ctx.ellipse(element.x, element.y, element.rx, element.ry, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          break;

        case 'rect':
          if (element.width && element.height) {
            ctx.fillRect(
              element.x - element.width / 2,
              element.y - element.height / 2,
              element.width,
              element.height
            );
          }
          break;
      }

      ctx.restore();
    });
  };

  const goToPrevSector = () => {
    setIsAutoPlay(false);
    setCurrentSectorIndex((prev) => (prev - 1 + SECTORS.length) % SECTORS.length);
  };

  const goToNextSector = () => {
    setIsAutoPlay(false);
    setCurrentSectorIndex((prev) => (prev + 1) % SECTORS.length);
  };

  const jumpToSector = (index: number) => {
    setIsAutoPlay(false);
    setCurrentSectorIndex(index);
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8">
      <div className="mb-6 text-center">
        <h1 className="text-4xl font-bold text-white mb-2" style={{
          textShadow: '0 0 20px rgba(255,255,255,0.5)'
        }}>
          STELLAR PURSUIT
        </h1>
        <p className="text-cyan-400 text-lg">Sector Preview Mode</p>
      </div>

      <div className="relative" style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}>
        <canvas
          ref={canvasRef}
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          className="border-2 border-cyan-500 shadow-lg shadow-cyan-500/50"
        />

        <div className="absolute top-4 left-4 right-4 text-white">
          <div className="bg-black/70 backdrop-blur-sm p-4 rounded-lg border border-cyan-500/30">
            <div className="text-2xl font-bold mb-2" style={{
              color: currentSector.starColors[0],
              textShadow: `0 0 10px ${currentSector.starColors[0]}`
            }}>
              SECTOR {currentSector.number}: {currentSector.name}
            </div>
            <div className="text-sm text-gray-300 mb-2">{currentSector.mood}</div>
            <div className="text-xs text-cyan-400 italic">"{currentSector.storyBeat}"</div>
          </div>
        </div>

        <div className="absolute bottom-4 left-4 right-4">
          <div className="bg-black/70 backdrop-blur-sm p-3 rounded-lg border border-cyan-500/30">
            <div className="text-xs text-gray-400 mb-2">
              <div>Stars: {currentSector.starDensity} | Twinkle: {currentSector.twinkle ? 'Yes' : 'No'}</div>
              <div>Feature: {currentSector.feature.type}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={goToPrevSector}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
        >
          ← Previous
        </button>

        <button
          onClick={() => setIsAutoPlay(!isAutoPlay)}
          className={`px-4 py-2 rounded-lg transition-colors ${
            isAutoPlay
              ? 'bg-orange-600 hover:bg-orange-500'
              : 'bg-green-600 hover:bg-green-500'
          } text-white`}
        >
          {isAutoPlay ? 'Pause' : 'Auto Play'}
        </button>

        <button
          onClick={goToNextSector}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
        >
          Next →
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        {SECTORS.map((sector, index) => (
          <button
            key={sector.number}
            onClick={() => jumpToSector(index)}
            className={`w-10 h-10 rounded-lg text-sm font-bold transition-all ${
              index === currentSectorIndex
                ? 'bg-cyan-500 text-white scale-110 shadow-lg shadow-cyan-500/50'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            {sector.number}
          </button>
        ))}
      </div>

      <div className="mt-8 text-center">
        <p className="text-gray-400 text-sm mb-4">
          Review each sector's visual design and atmosphere
        </p>
        <div className="flex gap-4">
          <button className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-colors">
            ✓ Approve & Continue to Full Game
          </button>
          <button className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">
            Request Adjustments
          </button>
        </div>
      </div>
    </div>
  );
}

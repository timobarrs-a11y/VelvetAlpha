import { useState, useEffect, useRef } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

export type Direction = 'up' | 'down' | 'left' | 'right';

interface TouchDPadProps {
  onDirectionPress: (direction: Direction) => void;
  onDirectionRelease: () => void;
  visible?: boolean;
}

export function TouchDPad({ onDirectionPress, onDirectionRelease, visible = true }: TouchDPadProps) {
  const [activeDirection, setActiveDirection] = useState<Direction | null>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const checkTouchDevice = () => {
      return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    };

    setIsTouchDevice(checkTouchDevice());
  }, []);

  if (!visible || !isTouchDevice) {
    return null;
  }

  const handleButtonPress = (direction: Direction) => {
    setActiveDirection(direction);
    onDirectionPress(direction);
  };

  const handleButtonRelease = () => {
    setActiveDirection(null);
    onDirectionRelease();
  };

  const handleTouchStart = (e: React.TouchEvent, direction: Direction) => {
    e.preventDefault();
    handleButtonPress(direction);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    handleButtonRelease();
  };

  const buttonClass = (direction: Direction) => `
    touch-none select-none
    w-16 h-16
    flex items-center justify-center
    rounded-lg
    transition-all
    ${activeDirection === direction
      ? 'bg-blue-500 bg-opacity-70 scale-95'
      : 'bg-gray-800 bg-opacity-50'}
  `;

  return (
    <div className="fixed bottom-8 left-8 z-50 pointer-events-auto">
      <div className="relative w-48 h-48">
        <button
          onTouchStart={(e) => handleTouchStart(e, 'up')}
          onTouchEnd={handleTouchEnd}
          className={`${buttonClass('up')} absolute top-0 left-1/2 -translate-x-1/2`}
        >
          <ChevronUp className="w-8 h-8 text-white" />
        </button>

        <button
          onTouchStart={(e) => handleTouchStart(e, 'down')}
          onTouchEnd={handleTouchEnd}
          className={`${buttonClass('down')} absolute bottom-0 left-1/2 -translate-x-1/2`}
        >
          <ChevronDown className="w-8 h-8 text-white" />
        </button>

        <button
          onTouchStart={(e) => handleTouchStart(e, 'left')}
          onTouchEnd={handleTouchEnd}
          className={`${buttonClass('left')} absolute left-0 top-1/2 -translate-y-1/2`}
        >
          <ChevronLeft className="w-8 h-8 text-white" />
        </button>

        <button
          onTouchStart={(e) => handleTouchStart(e, 'right')}
          onTouchEnd={handleTouchEnd}
          className={`${buttonClass('right')} absolute right-0 top-1/2 -translate-y-1/2`}
        >
          <ChevronRight className="w-8 h-8 text-white" />
        </button>

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-gray-900 bg-opacity-30 rounded-full" />
      </div>
    </div>
  );
}

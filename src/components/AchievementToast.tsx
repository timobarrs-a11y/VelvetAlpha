import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import type { Achievement } from '../services/moneyGrabServices';

interface AchievementToastProps {
  achievement: Achievement;
  onClose: () => void;
}

export function AchievementToast({ achievement, onClose }: AchievementToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300);
    }, 4000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`
        fixed top-20 right-4 z-50
        bg-gradient-to-r from-yellow-500 to-orange-500
        text-white rounded-lg shadow-2xl
        p-4 min-w-[300px]
        transform transition-all duration-300
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center animate-bounce">
            <span className="text-2xl">{achievement.icon}</span>
          </div>
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-4 h-4" />
            <span className="font-bold text-sm">Achievement Unlocked!</span>
          </div>
          <h3 className="font-bold text-lg">{achievement.title}</h3>
          <p className="text-sm text-white text-opacity-90">{achievement.description}</p>
        </div>
      </div>
    </div>
  );
}

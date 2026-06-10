import { useEffect } from 'react';
import { LUNLOCK } from './AnimalSprite';

interface PetLevelToastProps {
  level: number | null;
  onDone: () => void;
}

export function PetLevelToast({ level, onDone }: PetLevelToastProps) {
  useEffect(() => {
    if (!level) return;
    const t = setTimeout(onDone, 3400);
    return () => clearTimeout(t);
  }, [level, onDone]);

  if (!level) return null;

  return (
    <div style={{position:'fixed',top:'16%',left:'50%',transform:'translateX(-50%)',zIndex:99}}>
      <style>{`@keyframes lvup{0%{opacity:0;transform:translateX(-50%) scale(.65)}8%{opacity:1;transform:translateX(-50%) scale(1.06)}15%{transform:translateX(-50%) scale(1)}82%{opacity:1}100%{opacity:0;transform:translateX(-50%) translateY(-20px)}}`}</style>
      <div style={{animation:'lvup 3.4s ease-out forwards'}} className="bg-gradient-to-br from-yellow-300 to-orange-500 text-gray-900 rounded-2xl px-8 py-5 text-center shadow-2xl">
        <div className="text-3xl mb-1">🌟</div>
        <div className="text-2xl font-black">Level Up!</div>
        <div className="text-lg font-bold">Level {level}</div>
        <div className="text-sm mt-1 opacity-75">{LUNLOCK[level-1]}</div>
      </div>
    </div>
  );
}

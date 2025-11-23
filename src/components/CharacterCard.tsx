import { useEffect, useState } from 'react';
import { getCharacterMoodImage, getMoodLabel, getMoodGlow, CharacterType, MoodType } from '../utils/imageSelector';

interface CharacterCardProps {
  character: CharacterType;
  mood: MoodType;
}

export const CharacterCard = ({ character, mood }: CharacterCardProps) => {
  const [imageSrc, setImageSrc] = useState('');
  const [moodLabel, setMoodLabel] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const newImageSrc = getCharacterMoodImage(mood, character);
    const newMoodLabel = getMoodLabel(mood);

    if (imageSrc !== newImageSrc) {
      setIsTransitioning(true);
      setTimeout(() => {
        setImageSrc(newImageSrc);
        setMoodLabel(newMoodLabel);
        setIsTransitioning(false);
      }, 200);
    } else {
      setImageSrc(newImageSrc);
      setMoodLabel(newMoodLabel);
    }
  }, [character, mood, imageSrc]);

  return (
    <div className="bg-gradient-to-br from-primary-500 via-primary-600 to-rose-600 p-7 rounded-b-3xl shadow-soft">
      <div className="flex items-center gap-5">
        <div
          className={`w-20 h-20 rounded-full bg-gradient-to-br from-white/20 to-white/10 flex items-center justify-center shadow-glow ring-4 ring-white/20 overflow-hidden transition-all duration-300 ${
            isTransitioning ? 'opacity-50 scale-95' : 'opacity-100 scale-100'
          }`}
        >
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={character}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-4xl">✨</div>
          )}
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-display font-bold text-white mb-0.5">{character.charAt(0).toUpperCase() + character.slice(1)}</h1>
          <p className="text-white/80 text-sm font-medium">Your Partner</p>
          {moodLabel && (
            <p className="text-xs text-white/70 mt-2 font-medium bg-white/10 inline-block px-3 py-1 rounded-full backdrop-blur-sm">{moodLabel}</p>
          )}
          <div className="flex items-center gap-2 mt-3">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse-slow shadow-glow"></div>
            <span className="text-xs text-white/80 font-medium">Online</span>
          </div>
        </div>
      </div>
    </div>
  );
};

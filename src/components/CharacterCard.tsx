import { useEffect, useState } from 'react';
import { getCompanionMoodImage, getMoodLabel, getMoodGlow, MoodType } from '../utils/imageSelector';
import { getVoiceById } from '../config/signatureVoices';
import { Avatar } from './Avatar';
import { AvatarConfig } from '../types/avatar';

interface CharacterCardProps {
  avatarId: string;
  mood: MoodType;
  characterName: string;
  signatureVoiceId?: string;
  avatarConfig?: AvatarConfig | null;
  onClick?: () => void;
  currentStatus?: string;
  favoriteColor?: string;
}

export const CharacterCard = ({ avatarId, mood, characterName, signatureVoiceId, avatarConfig, onClick, currentStatus, favoriteColor }: CharacterCardProps) => {
  const [imageSrc, setImageSrc] = useState('');
  const [moodLabel, setMoodLabel] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);

  const voiceName = signatureVoiceId ? getVoiceById(signatureVoiceId).name : '';

  useEffect(() => {
    const newImageSrc = getCompanionMoodImage(mood, avatarId);
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
  }, [avatarId, mood, imageSrc]);

  return (
    <div
      className="bg-gradient-to-br from-primary-500 via-primary-600 to-rose-600 p-7 rounded-b-3xl shadow-soft"
    >
      <div className="flex items-center gap-5">
        <div
          className={`w-24 h-24 rounded-full bg-gradient-to-br from-white/20 to-white/10 flex items-center justify-center shadow-glow ring-4 ring-white/30 overflow-hidden transition-all duration-300 ${
            isTransitioning ? 'opacity-50 scale-95' : 'opacity-100 scale-100'
          } ${onClick ? 'cursor-pointer hover:ring-white/50 hover:scale-105' : ''}`}
          onClick={onClick}
          title={onClick ? "Edit companion avatar" : undefined}
        >
          {avatarConfig ? (
            <Avatar config={avatarConfig} className="w-full h-full" />
          ) : imageSrc ? (
            <img
              src={imageSrc}
              alt={characterName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-4xl">✨</div>
          )}
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-display font-bold text-white mb-0.5">{characterName}</h1>
          {voiceName && (
            <p className="text-white/80 text-sm font-medium">{voiceName}</p>
          )}
          {moodLabel && (
            <p className="text-xs text-white/70 mt-2 font-medium bg-white/10 inline-block px-3 py-1 rounded-full backdrop-blur-sm">{moodLabel}</p>
          )}
          {currentStatus && (
            <p className="text-sm italic mt-2" style={{ color: favoriteColor || '#6B7280' }}>
              {currentStatus}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

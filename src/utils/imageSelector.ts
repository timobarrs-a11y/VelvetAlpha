export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export const getTimeOfDay = (): TimeOfDay => {
  const hour = new Date().getHours();

  if (hour >= 6 && hour < 12) {
    return 'morning';
  } else if (hour >= 12 && hour < 18) {
    return 'afternoon';
  } else if (hour >= 18 && hour < 24) {
    return 'evening';
  } else {
    return 'night';
  }
};

export const getCharacterImage = (timeOfDay: TimeOfDay, character: 'riley' | 'raven' | 'tyler' = 'riley'): string => {
  const rileyImages: Record<TimeOfDay, string> = {
    morning: '/images/riley-workout.jpg',
    afternoon: '/images/riley-cheerleader.jpg',
    evening: '/images/riley-evening.jpg',
    night: '/images/riley-casual.jpg',
  };

  const ravenImages: Record<TimeOfDay, string> = {
    morning: '/images/raven-morning.jpg',
    afternoon: '/images/raven-afternoon.jpg',
    evening: '/images/raven-evening.jpg',
    night: '/images/raven-night.jpg',
  };

  const tylerImages: Record<TimeOfDay, string> = {
    morning: '/images/tyler-morning.jpg',
    afternoon: '/images/tyler-afternoon.jpg',
    evening: '/images/tyler-evening.jpg',
    night: '/images/tyler-night.jpg',
  };

  const imageMap = {
    riley: rileyImages,
    raven: ravenImages,
    tyler: tylerImages,
  };

  return imageMap[character][timeOfDay];
};

export const getTimeLabel = (timeOfDay: TimeOfDay): string => {
  const labels: Record<TimeOfDay, string> = {
    morning: 'Morning',
    afternoon: 'Afternoon',
    evening: 'Evening',
    night: 'Night',
  };

  return labels[timeOfDay];
};

export type MoodType = 'positive' | 'negative' | 'laughing' | 'concerned' | 'sleep';
export type CharacterType = 'riley' | 'raven' | 'jake';

interface MoodConfig {
  label: string;
  glowColor: string;
  animation: string;
}

export const MOOD_CONFIGS: Record<MoodType, MoodConfig> = {
  positive: {
    label: 'Happy',
    glowColor: 'rgba(245, 158, 11, 0.5)',
    animation: 'pulse-gold'
  },
  negative: {
    label: 'Pouty',
    glowColor: 'rgba(251, 146, 60, 0.5)',
    animation: 'pulse-coral'
  },
  laughing: {
    label: 'Laughing',
    glowColor: 'rgba(251, 191, 36, 0.5)',
    animation: 'pulse-yellow'
  },
  concerned: {
    label: 'Concerned',
    glowColor: 'rgba(96, 165, 250, 0.5)',
    animation: 'pulse-blue'
  },
  sleep: {
    label: 'Sleeping',
    glowColor: 'rgba(167, 139, 250, 0.5)',
    animation: 'pulse-lavender'
  }
};

export const getCharacterMoodImage = (
  mood: MoodType,
  character: CharacterType = 'riley'
): string => {
  return `/images/${character}-${mood}.jpg`;
};

export const getMoodLabel = (mood: MoodType): string => {
  return MOOD_CONFIGS[mood].label;
};

export const getMoodGlow = (mood: MoodType): string => {
  return MOOD_CONFIGS[mood].glowColor;
};

export const getMoodAnimation = (mood: MoodType): string => {
  return MOOD_CONFIGS[mood].animation;
};

export const detectMood = (
  messages: Array<{role: string; content: string}>,
  tokenCount: number
): MoodType => {
  if (tokenCount === 0) return 'sleep';

  const lastAiMessage = [...messages].reverse().find(m => m.role === 'assistant' || m.role === 'ai');

  if (lastAiMessage) {
    const content = lastAiMessage.content.toLowerCase();

    const laughIndicators = ['lol', 'lmao', 'lmfao', 'haha', 'hehe', 'omg', '😂', '😭', '🤣'];
    if (laughIndicators.some(indicator => content.includes(indicator))) {
      return 'laughing';
    }

    const concernIndicators = [
      'worried', 'concern', 'are you okay', 'you okay',
      'is everything okay', 'what\'s wrong', 'upset',
      'that sucks', 'i\'m sorry', 'sorry to hear'
    ];
    if (concernIndicators.some(indicator => content.includes(indicator))) {
      return 'concerned';
    }

    const negativeIndicators = [
      'i miss you', 'wish you were', 'i\'m bored',
      'come back', 'where are you', 'why you', 'ugh'
    ];
    if (negativeIndicators.some(indicator => content.includes(indicator))) {
      return 'negative';
    }
  }

  return 'positive';
};

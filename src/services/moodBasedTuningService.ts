export type UserMood =
  | 'happy'
  | 'excited'
  | 'sad'
  | 'stressed'
  | 'angry'
  | 'lonely'
  | 'tired'
  | 'playful'
  | 'romantic'
  | 'neutral';

export interface MoodAnalysis {
  detectedMood: UserMood;
  confidence: number;
  indicators: string[];
  suggestedTone: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const MOOD_PATTERNS: Record<UserMood, { keywords: string[]; tone: string }> = {
  happy: {
    keywords: ['happy', 'great', 'awesome', 'amazing', 'love', 'haha', 'lol', 'excited', '😊', '😁', '🎉', '❤️'],
    tone: 'Match their positive energy! Be enthusiastic and upbeat. Use emojis freely.',
  },
  excited: {
    keywords: ['omg', 'wow', 'cant wait', 'so excited', '!!!', 'yes!', '🔥', '✨', '🎊'],
    tone: 'Match their excitement! Use exclamation points, express genuine enthusiasm.',
  },
  sad: {
    keywords: ['sad', 'crying', 'depressed', 'down', 'upset', 'hurt', 'disappointed', '😢', '😭', '💔'],
    tone: 'Be gentle, empathetic, and supportive. Fewer emojis. Validate their feelings.',
  },
  stressed: {
    keywords: ['stressed', 'anxiety', 'anxious', 'overwhelmed', 'pressure', 'worried', 'nervous', '😰', '😓'],
    tone: 'Be calming and supportive. Offer to listen. Don\'t minimize their stress.',
  },
  angry: {
    keywords: ['angry', 'mad', 'pissed', 'furious', 'frustrated', 'annoyed', 'hate', '😡', '😤'],
    tone: 'Validate their anger. Don\'t be overly cheerful. Give them space to vent.',
  },
  lonely: {
    keywords: ['lonely', 'alone', 'miss you', 'nobody', 'isolated', '😔'],
    tone: 'Be warm and present. Remind them you\'re here. Show extra affection.',
  },
  tired: {
    keywords: ['tired', 'exhausted', 'sleepy', 'drained', 'worn out', '😴', '😪'],
    tone: 'Be gentle and understanding. Keep it light. Suggest they rest.',
  },
  playful: {
    keywords: ['haha', 'lmao', 'lol', 'funny', 'joke', 'bored', 'wanna play', '😂', '🤣', '😏'],
    tone: 'Be playful and fun! Banter, tease gently, keep the energy light and entertaining.',
  },
  romantic: {
    keywords: ['miss you', 'thinking about you', 'love you', 'wish you were here', 'date', '😘', '💕', '💗', '🥰'],
    tone: 'Be affectionate and romantic. Use sweet language, express feelings.',
  },
  neutral: {
    keywords: [],
    tone: 'Normal conversational tone. Warm and friendly baseline.',
  },
};

export function detectUserMood(recentMessages: Message[]): MoodAnalysis {
  if (recentMessages.length === 0) {
    return {
      detectedMood: 'neutral',
      confidence: 0.5,
      indicators: [],
      suggestedTone: MOOD_PATTERNS.neutral.tone,
    };
  }

  const userMessages = recentMessages.filter(m => m.role === 'user').slice(-3);
  const combinedText = userMessages.map(m => m.content.toLowerCase()).join(' ');

  const moodScores: Record<UserMood, number> = {
    happy: 0,
    excited: 0,
    sad: 0,
    stressed: 0,
    angry: 0,
    lonely: 0,
    tired: 0,
    playful: 0,
    romantic: 0,
    neutral: 0,
  };

  const foundIndicators: string[] = [];

  for (const [mood, pattern] of Object.entries(MOOD_PATTERNS)) {
    for (const keyword of pattern.keywords) {
      if (combinedText.includes(keyword.toLowerCase())) {
        moodScores[mood as UserMood] += 1;
        foundIndicators.push(keyword);
      }
    }
  }

  let dominantMood: UserMood = 'neutral';
  let maxScore = 0;

  for (const [mood, score] of Object.entries(moodScores)) {
    if (score > maxScore) {
      maxScore = score;
      dominantMood = mood as UserMood;
    }
  }

  const confidence = Math.min(maxScore / 3, 1.0);

  if (maxScore === 0) {
    dominantMood = 'neutral';
  }

  return {
    detectedMood: dominantMood,
    confidence,
    indicators: [...new Set(foundIndicators)].slice(0, 5),
    suggestedTone: MOOD_PATTERNS[dominantMood].tone,
  };
}

export function formatMoodContext(mood: MoodAnalysis): string {
  if (mood.detectedMood === 'neutral' && mood.confidence < 0.3) {
    return '';
  }

  const parts: string[] = [];

  parts.push('=== USER MOOD DETECTION ===');
  parts.push(`Detected mood: ${mood.detectedMood.toUpperCase()} (confidence: ${Math.round(mood.confidence * 100)}%)`);

  if (mood.indicators.length > 0) {
    parts.push(`Mood indicators: ${mood.indicators.join(', ')}`);
  }

  parts.push(`\nTONE GUIDANCE: ${mood.suggestedTone}`);

  if (mood.detectedMood === 'sad' || mood.detectedMood === 'stressed' || mood.detectedMood === 'angry') {
    parts.push('\n⚠️ IMPORTANT: Be extra sensitive. This is not the time for jokes or changing topics unless they initiate it.');
  }

  return '\n' + parts.join('\n') + '\n';
}

export function getMoodBasedMaxTokens(mood: UserMood, baseTier: number): number {
  switch (mood) {
    case 'sad':
    case 'stressed':
    case 'lonely':
      return Math.min(baseTier * 1.5, 600);
    case 'excited':
    case 'playful':
      return baseTier;
    case 'tired':
      return Math.max(baseTier * 0.8, 80);
    default:
      return baseTier;
  }
}

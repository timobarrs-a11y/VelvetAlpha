import { PROACTIVE_MESSAGES, ProactiveMessageType } from '../config/proactiveMessages';
import { UserProfile } from './chatService';

interface EmojiSet {
  hearts: string[];
  faces: string[];
  sparkles: string[];
  casual: string[];
}

const EMOJIS: EmojiSet = {
  hearts: ['💕', '💖', '❤️', '💗', '💓'],
  faces: ['😊', '😏', '🥰', '😘', '😌', '🙃'],
  sparkles: ['✨', '💫', '⭐', '🌟'],
  casual: ['👀', '💭', '🔥', '☀️', '🌙', '😴']
};

const DYNAMIC_QUESTIONS = [
  "how's it going?",
  "what's up?",
  "wyd?",
  "how are you?",
  "everything good?",
  "what's happening?",
  "how's your day?",
  "you good?",
  "what are you up to?",
  "tell me what's new",
  "how are you feeling?",
  "what's on your mind?"
];

export class ProactiveMessageService {
  private static getRandomItem<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  private static injectEmojis(message: string, count: number = 1): string {
    const allEmojis = [
      ...EMOJIS.hearts,
      ...EMOJIS.faces,
      ...EMOJIS.sparkles,
      ...EMOJIS.casual
    ];

    let result = message;

    const hasEmoji = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(message);

    if (!hasEmoji && count > 0) {
      const emoji = this.getRandomItem(allEmojis);
      result = `${result} ${emoji}`;
    }

    return result;
  }

  private static appendDynamicQuestion(message: string): string {
    const endsWithQuestion = message.trim().endsWith('?');

    if (!endsWithQuestion) {
      const question = this.getRandomItem(DYNAMIC_QUESTIONS);
      return `${message} ${question}`;
    }

    return message;
  }

  private static selectMessageByTimeOfDay(timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night'): ProactiveMessageType {
    const timeBasedTypes: Record<typeof timeOfDay, ProactiveMessageType[]> = {
      morning: ['morning', 'supportive', 'random'],
      afternoon: ['random', 'flirty', 'supportive'],
      evening: ['evening', 'supportive', 'random'],
      night: ['night', 'flirty', 'random']
    };

    const possibleTypes = timeBasedTypes[timeOfDay];
    return this.getRandomItem(possibleTypes);
  }

  private static getCurrentTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
    const hour = new Date().getHours();

    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
  }

  static getProactiveMessage(
    messageType?: ProactiveMessageType,
    userProfile?: UserProfile
  ): string {
    const timeOfDay = this.getCurrentTimeOfDay();

    const selectedType = messageType || this.selectMessageByTimeOfDay(timeOfDay);

    const messageCache = PROACTIVE_MESSAGES[selectedType];
    let baseMessage = this.getRandomItem(messageCache);

    const shouldInjectEmoji = Math.random() > 0.5;
    if (shouldInjectEmoji) {
      baseMessage = this.injectEmojis(baseMessage, 1);
    }

    const shouldAppendQuestion = Math.random() > 0.4;
    if (shouldAppendQuestion) {
      baseMessage = this.appendDynamicQuestion(baseMessage);
    }

    return baseMessage;
  }

  static getScheduledMessage(timeSlot: 'morning' | 'evening' | 'night'): string {
    const typeMap: Record<typeof timeSlot, ProactiveMessageType> = {
      morning: 'morning',
      evening: 'evening',
      night: 'night'
    };

    return this.getProactiveMessage(typeMap[timeSlot]);
  }

  static getRandomCheckIn(userProfile?: UserProfile): string {
    const types: ProactiveMessageType[] = ['random', 'supportive'];
    const selectedType = this.getRandomItem(types);
    return this.getProactiveMessage(selectedType, userProfile);
  }

  static getFlirtyCheckIn(userProfile?: UserProfile): string {
    return this.getProactiveMessage('flirty', userProfile);
  }

  static getSupportiveCheckIn(userProfile?: UserProfile): string {
    return this.getProactiveMessage('supportive', userProfile);
  }

  static getMissYouMessage(): string {
    const types: ProactiveMessageType[] = ['random', 'flirty'];
    const selectedType = this.getRandomItem(types);
    return this.getProactiveMessage(selectedType);
  }
}

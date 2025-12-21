import { ConversationData, Message } from '../types';

const STORAGE_KEY = 'riley_conversation';
const DAILY_MESSAGE_LIMIT = 999999;

export const getConversationData = (): ConversationData => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      return { messages: [], date: getTodayDate(), messageCount: 0 };
    }

    const parsed: ConversationData = JSON.parse(data);

    if (parsed.date !== getTodayDate()) {
      return { messages: parsed.messages, date: getTodayDate(), messageCount: 0 };
    }

    return parsed;
  } catch {
    return { messages: [], date: getTodayDate(), messageCount: 0 };
  }
};

export const saveConversationData = (data: ConversationData): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save conversation:', error);
  }
};

export const addMessage = (message: Message): ConversationData => {
  const data = getConversationData();
  data.messages.push(message);
  data.messageCount += 1;
  saveConversationData(data);
  return data;
};

export const getRemainingMessages = (): number => {
  const data = getConversationData();
  return Math.max(0, DAILY_MESSAGE_LIMIT - data.messageCount);
};

export const canSendMessage = (): boolean => {
  return getRemainingMessages() > 0;
};

const getTodayDate = (): string => {
  return new Date().toISOString().split('T')[0];
};

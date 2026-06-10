export type MessageType =
  | 'text'
  | 'news-card'
  | 'calendar-card'
  | 'navi-card'
  | 'system'
  | 'bot-entry'
  | 'bot-exit'
  | 'brief-block';

export type BotSource = 'companion' | 'atlas' | 'navi';

export interface MessageMetadata {
  article_id?: string;
  article_title?: string;
  article_url?: string;
  article_source?: string;
  article_image?: string;
  event_id?: string;
  event_ids?: string[];
  navi_results?: unknown[];
  [key: string]: unknown;
}

export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: number;
  isTyping?: boolean;
  messageType?: MessageType;
  botSource?: BotSource;
  metadata?: MessageMetadata;
}

export interface ConversationData {
  messages: Message[];
  date: string;
  messageCount: number;
}

export interface ChoicePromptResponse {
  choicePrompt: string;
  options?: string[];
  waitMinutes?: number;
}

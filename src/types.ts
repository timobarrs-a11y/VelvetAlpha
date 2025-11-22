export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: number;
  isTyping?: boolean;
}

export interface ConversationData {
  messages: Message[];
  date: string;
  messageCount: number;
}

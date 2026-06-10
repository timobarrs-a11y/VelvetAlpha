export const messagesKey = (userId: string, companionId: string) =>
  ['messages', userId, companionId] as const;

export const conversationKey = (userId: string, companionId: string) =>
  ['conversation', userId, companionId] as const;

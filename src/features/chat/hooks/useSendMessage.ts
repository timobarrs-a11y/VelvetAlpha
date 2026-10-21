import { useCallback } from 'react';
import { insertMessageByUserAndCompanion } from '../../../shared/supabase/queries';
import type { MessageRow } from './useMessages';

interface SendMessageInput {
  userId: string;
  companionId: string;
  role: 'user' | 'assistant';
  content: string;
  clientMessageId?: string;
  messageType?: string;
  metadata?: Record<string, any>;
  botSource?: string;
}

interface SendMessageCallbacks {
  appendOptimistic: (msg: MessageRow) => void;
  replaceOptimistic: (tempId: string, real: MessageRow) => void;
  removeOptimistic: (tempId: string) => void;
}

export function useSendMessage(callbacks: SendMessageCallbacks) {
  return useCallback(async (input: SendMessageInput) => {
    const tempId = `temp-${Date.now()}`;
    const optimistic: MessageRow = {
      id: tempId,
      user_id: input.userId,
      companion_id: input.companionId,
      role: input.role,
      content: input.content,
      created_at: new Date().toISOString(),
      optimistic: true,
      ...(input.messageType ? { message_type: input.messageType } : {}),
      ...(input.botSource ? { bot_source: input.botSource } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
      ...(input.clientMessageId ? { client_message_id: input.clientMessageId } : {}),
    };

    callbacks.appendOptimistic(optimistic);

    try {
      const data = await insertMessageByUserAndCompanion({
        user_id: input.userId,
        companion_id: input.companionId,
        role: input.role,
        content: input.content,
        ...(input.clientMessageId ? { client_message_id: input.clientMessageId } : {}),
        ...(input.messageType ? { message_type: input.messageType } : {}),
        ...(input.metadata ? { metadata: input.metadata } : {}),
        ...(input.botSource ? { bot_source: input.botSource } : {}),
      });
      callbacks.replaceOptimistic(tempId, data as MessageRow);
      return data;
    } catch (err) {
      callbacks.removeOptimistic(tempId);
      throw err;
    }
  }, [callbacks]);
}

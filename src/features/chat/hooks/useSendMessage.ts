import { useMutation, useQueryClient } from '@tanstack/react-query';
import { insertMessageByUserAndCompanion } from '../../../shared/supabase/queries';
import { messagesKey } from '../queryKeys';

interface SendMessageInput {
  userId: string;
  companionId: string;
  role: 'user' | 'assistant';
  content: string;
  clientMessageId?: string;
  messageType?: string;
  metadata?: Record<string, unknown>;
  botSource?: string;
}

interface OptimisticMessage {
  id: string;
  user_id: string;
  companion_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  optimistic?: boolean;
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SendMessageInput) => {
      return insertMessageByUserAndCompanion({
        user_id: input.userId,
        companion_id: input.companionId,
        role: input.role,
        content: input.content,
        ...(input.clientMessageId ? { client_message_id: input.clientMessageId } : {}),
        ...(input.messageType ? { message_type: input.messageType } : {}),
        ...(input.metadata ? { metadata: input.metadata } : {}),
        ...(input.botSource ? { bot_source: input.botSource } : {}),
      });
    },

    onMutate: async (input: SendMessageInput) => {
      const key = messagesKey(input.userId, input.companionId);

      await queryClient.cancelQueries({
        queryKey: key,
      });

      const previousMessages = queryClient.getQueryData<any[]>(key);

      const optimisticMessage: OptimisticMessage = {
        id: `temp-${Date.now()}`,
        user_id: input.userId,
        companion_id: input.companionId,
        role: input.role,
        content: input.content,
        created_at: new Date().toISOString(),
        optimistic: true,
      };

      queryClient.setQueryData<any[]>(
        key,
        (old) => [...(old || []), optimisticMessage]
      );

      return { previousMessages, optimisticMessage };
    },

    onError: (error, input, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(
          messagesKey(input.userId, input.companionId),
          context.previousMessages
        );
      }
    },

    onSuccess: (data, input, context) => {
      if (data && context?.optimisticMessage) {
        queryClient.setQueryData<any[]>(
          messagesKey(input.userId, input.companionId),
          (old) =>
            old?.map((msg) =>
              msg.id === context.optimisticMessage.id ? data : msg
            ) || [data]
        );
      }
    },

    onSettled: (data, error, input) => {
      queryClient.invalidateQueries({
        queryKey: messagesKey(input.userId, input.companionId),
        refetchType: 'none',
      });
    },
  });
}

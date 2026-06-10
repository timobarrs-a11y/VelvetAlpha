import { useQuery } from '@tanstack/react-query';
import { getConversation } from '../../../shared/supabase/queries';

export function useConversation(conversationId: string | null | undefined) {
  return useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => {
      if (!conversationId) {
        throw new Error('Conversation ID is required');
      }
      return getConversation(conversationId);
    },
    enabled: !!conversationId,
  });
}

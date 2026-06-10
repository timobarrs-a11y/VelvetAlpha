import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../shared/supabase/client';
import { messagesKey } from '../queryKeys';

async function fetchMessages(userId: string, companionId: string) {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .eq('companion_id', companionId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch messages: ${error.message}`);
  }

  return data || [];
}

export function useMessages(userId: string | null | undefined, companionId: string | null | undefined) {
  return useQuery({
    queryKey: userId && companionId ? messagesKey(userId, companionId) : ['messages', null, null],
    queryFn: () => {
      if (!userId || !companionId) {
        throw new Error('User ID and Companion ID are required');
      }
      return fetchMessages(userId, companionId);
    },
    enabled: !!userId && !!companionId,
    staleTime: 30_000,
  });
}

import { useState, useEffect } from 'react';
import { getConversation } from '../../../shared/supabase/queries';

export function useConversation(conversationId: string | null | undefined) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!conversationId) {
      setData(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    getConversation(conversationId)
      .then((d) => setData(d))
      .catch((e) => setError(e))
      .finally(() => setIsLoading(false));
  }, [conversationId]);

  return { data, isLoading, error };
}

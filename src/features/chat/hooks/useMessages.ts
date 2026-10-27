import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../shared/supabase/client';

export interface MessageRow {
  id: string;
  user_id: string;
  companion_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  message_type?: string;
  bot_source?: string;
  metadata?: Record<string, any>;
  client_message_id?: string;
  optimistic?: boolean;
}

async function fetchMessages(userId: string, companionId: string): Promise<MessageRow[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .eq('companion_id', companionId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to fetch messages: ${error.message}`);
  return data || [];
}

export function useMessages(userId: string | null | undefined, companionId: string | null | undefined) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const loadedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || !companionId) {
      setMessages([]);
      loadedKeyRef.current = null;
      return;
    }

    const key = `${userId}:${companionId}`;
    if (loadedKeyRef.current === key) return;
    loadedKeyRef.current = key;

    setIsLoading(true);
    setError(null);
    fetchMessages(userId, companionId)
      .then((rows) => setMessages(rows))
      .catch((e) => setError(e))
      .finally(() => setIsLoading(false));
  }, [userId, companionId]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const appendOptimistic = useCallback((msg: MessageRow) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const replaceOptimistic = useCallback((tempId: string, real: MessageRow) => {
    setMessages((prev) => prev.map((m) => (m.id === tempId ? real : m)));
  }, []);

  const removeOptimistic = useCallback((tempId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== tempId));
  }, []);

  return {
    data: messages,
    isLoading,
    error,
    clearMessages,
    appendOptimistic,
    replaceOptimistic,
    removeOptimistic,
    setMessages,
  };
}

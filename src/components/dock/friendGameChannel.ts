import { useEffect, useRef } from 'react';
import { supabase } from '../../shared/supabase/client';

type Send = (event: string, payload: unknown) => void;

/**
 * A realtime broadcast channel for one game in one conversation. `handlers`
 * maps event names to callbacks; `onJoin` runs once connected (ask the other
 * player for the current state). Returns a stable send function.
 */
export function useGameChannel(name: string, handlers: Record<string, (payload: any) => void>, onJoin?: (send: Send) => void): Send {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const onJoinRef = useRef(onJoin);
  onJoinRef.current = onJoin;
  const sendRef = useRef<Send>((event, payload) => {
    channelRef.current?.send({ type: 'broadcast', event, payload });
  });

  useEffect(() => {
    const channel = supabase.channel(name);
    channel.on('broadcast', { event: '*' }, (msg: { event: string; payload: unknown }) => {
      handlersRef.current[msg.event]?.(msg.payload);
    });
    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') onJoinRef.current?.(sendRef.current);
    });
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); channelRef.current = null; };
  }, [name]);

  return sendRef.current;
}

import { useEffect, useState } from 'react';
import { supabase } from '../shared/supabase/client';
import { SubscriptionTier } from '../types/subscription';
import { MessageTrackingInfo, getMessageTrackingInfo } from '../services/messageTrackingService';

export function useSubscription() {
  const [subscriptionInfo, setSubscriptionInfo] = useState<MessageTrackingInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const loadSubscriptionInfo = async () => {
        const info = await getMessageTrackingInfo(user.id);
        setSubscriptionInfo(info);
        setLoading(false);
      };

      await loadSubscriptionInfo();

      channel = supabase
        .channel('subscription-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'user_profiles',
            filter: `id=eq.${user.id}`,
          },
          async (payload) => {
            console.log('[useSubscription] Detected subscription change:', payload);
            await loadSubscriptionInfo();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'message_tracking',
            filter: `user_id=eq.${user.id}`,
          },
          async (payload) => {
            console.log('[useSubscription] Detected message tracking change:', payload);
            await loadSubscriptionInfo();
          }
        )
        .subscribe();
    };

    setupSubscription();

    return () => {
      if (channel) {
        channel.unsubscribe();
      }
    };
  }, []);

  const refreshSubscription = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const info = await getMessageTrackingInfo(user.id);
    setSubscriptionInfo(info);
  };

  return {
    subscriptionInfo,
    loading,
    refreshSubscription,
    tier: subscriptionInfo?.tier || 'free',
    messagesRemaining: subscriptionInfo?.messagesRemaining || 0,
  };
}

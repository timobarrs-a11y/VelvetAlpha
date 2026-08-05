import { supabase } from '../shared/supabase/client';
import { SubscriptionTier, SUBSCRIPTION_PLANS, normalizeSubscriptionTier } from '../types/subscription';

export interface MessageTrackingInfo {
  messagesRemaining: number;
  canSendMessage: boolean;
  model: 'haiku' | 'sonnet';
  tier: SubscriptionTier;
}

export async function getMessageTrackingInfo(userId: string): Promise<MessageTrackingInfo | null> {
  try {
    if (import.meta.env.DEV && import.meta.env.VITE_TESTING_MODE === 'true') {
      return {
        messagesRemaining: -1,
        canSendMessage: true,
        model: 'sonnet',
        tier: 'elite'
      };
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select('subscription_tier, messages_remaining, haiku_model_enabled, sonnet_model_enabled, is_super_user')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    if (data.is_super_user) {
      return {
        messagesRemaining: -1,
        canSendMessage: true,
        model: 'sonnet',
        tier: 'elite'
      };
    }

    const tier = normalizeSubscriptionTier(data.subscription_tier);
    const messagesRemaining = data.messages_remaining ?? 0;
    const canSendMessage = messagesRemaining > 0;

    const model = data.sonnet_model_enabled ? 'sonnet' : 'haiku';

    return {
      messagesRemaining,
      canSendMessage,
      model,
      tier
    };
  } catch {
    return null;
  }
}

export async function decrementMessageCount(userId: string): Promise<boolean> {
  try {
    if (import.meta.env.DEV && import.meta.env.VITE_TESTING_MODE === 'true') {
      return true;
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_super_user')
      .eq('id', userId)
      .maybeSingle();

    if (profile?.is_super_user) {
      return true;
    }

    const info = await getMessageTrackingInfo(userId);

    if (!info) {
      return false;
    }

    if (info.messagesRemaining === -1) {
      return true;
    }

    if (info.messagesRemaining <= 0) {
      return false;
    }

    const { error } = await supabase
      .from('user_profiles')
      .update({ messages_remaining: info.messagesRemaining - 1 })
      .eq('id', userId);

    if (error) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export async function addMessagesToUser(
  userId: string,
  messageCount: number,
  tier: SubscriptionTier
): Promise<boolean> {
  try {
    const updates: Record<string, any> = {
      subscription_tier: tier
    };

    if (tier === 'unlimited') {
      const { data: current } = await supabase
        .from('user_profiles')
        .select('messages_remaining')
        .eq('id', userId)
        .maybeSingle();

      const currentMessages = current?.messages_remaining || 0;
      updates.messages_remaining = currentMessages === -1 ? messageCount : currentMessages + messageCount;
      updates.haiku_model_enabled = true;
      updates.sonnet_model_enabled = false;
    } else if (tier === 'trial') {
      updates.messages_remaining = 8000;
      updates.haiku_model_enabled = false;
      updates.sonnet_model_enabled = true;
    } else if (['starter', 'plus', 'elite'].includes(tier)) {
      const { data: current } = await supabase
        .from('user_profiles')
        .select('messages_remaining')
        .eq('id', userId)
        .maybeSingle();

      const currentMessages = current?.messages_remaining || 0;
      const newTotal = currentMessages === -1 ? messageCount : currentMessages + messageCount;

      updates.messages_remaining = newTotal;
      updates.haiku_model_enabled = false;
      updates.sonnet_model_enabled = true;
    }

    const { error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', userId);

    if (error) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function getModelForTier(tier: SubscriptionTier): 'haiku' | 'sonnet' {
  return SUBSCRIPTION_PLANS[tier]?.model || 'haiku';
}

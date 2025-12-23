import { supabase } from './supabase';
import { SubscriptionTier, SUBSCRIPTION_PLANS } from '../types/subscription';

export interface MessageTrackingInfo {
  messagesRemaining: number;
  canSendMessage: boolean;
  model: 'haiku' | 'sonnet';
  tier: SubscriptionTier;
}

export async function getMessageTrackingInfo(userId: string): Promise<MessageTrackingInfo | null> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('subscription_tier, messages_remaining, haiku_model_enabled, sonnet_model_enabled')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      console.error('Error fetching message tracking info:', error);
      return null;
    }

    const tier = (data.subscription_tier as SubscriptionTier) || 'free';
    const messagesRemaining = data.messages_remaining || 0;
    const canSendMessage = messagesRemaining === -1 || messagesRemaining > 0;

    const model = data.sonnet_model_enabled ? 'sonnet' : 'haiku';

    return {
      messagesRemaining,
      canSendMessage,
      model,
      tier
    };
  } catch (error) {
    console.error('Error in getMessageTrackingInfo:', error);
    return null;
  }
}

export async function decrementMessageCount(userId: string): Promise<boolean> {
  try {
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
      console.error('Error decrementing message count:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in decrementMessageCount:', error);
    return false;
  }
}

export async function addMessagesToUser(
  userId: string,
  messageCount: number,
  tier: SubscriptionTier
): Promise<boolean> {
  try {
    const plan = SUBSCRIPTION_PLANS[tier];

    const updates: Record<string, any> = {
      subscription_tier: tier
    };

    if (tier === 'unlimited') {
      updates.messages_remaining = -1;
      updates.haiku_model_enabled = true;
      updates.sonnet_model_enabled = false;
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
      console.error('Error adding messages to user:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in addMessagesToUser:', error);
    return false;
  }
}

export function getModelForTier(tier: SubscriptionTier): 'haiku' | 'sonnet' {
  return SUBSCRIPTION_PLANS[tier]?.model || 'haiku';
}

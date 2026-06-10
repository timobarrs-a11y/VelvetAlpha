import { supabase } from '../client';

export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to get user profile: ${error.message}`);
  }

  return data;
}

export async function getSubscription(userId: string) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('subscription_tier, stripe_customer_id, stripe_subscription_id, subscription_status')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to get subscription: ${error.message}`);
  }

  return data;
}

export async function updateUserProfile(userId: string, updates: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update user profile: ${error.message}`);
  }

  return data;
}

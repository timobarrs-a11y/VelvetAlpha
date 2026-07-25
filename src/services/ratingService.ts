import { supabase } from '../shared/supabase/client';

export type RatingValue = 'like' | 'dislike';

export interface MessageRating {
  id: string;
  message_id: string;
  conversation_id: string;
  companion_id: string;
  user_id: string;
  rating: RatingValue;
  reason: string | null;
  regenerated: boolean;
  created_at: string;
  updated_at: string;
}

export async function upsertRating(payload: {
  messageId: string;
  conversationId: string;
  companionId: string;
  rating: RatingValue;
  reason?: string;
}): Promise<MessageRating> {
  const { data, error } = await supabase
    .from('message_ratings')
    .upsert(
      {
        message_id: payload.messageId,
        conversation_id: payload.conversationId,
        companion_id: payload.companionId,
        rating: payload.rating,
        reason: payload.reason ?? null,
      },
      { onConflict: 'message_id,user_id' }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save rating: ${error.message}`);
  }

  return data as MessageRating;
}

export async function clearRating(messageId: string): Promise<void> {
  const { error } = await supabase
    .from('message_ratings')
    .delete()
    .eq('message_id', messageId);

  if (error) {
    throw new Error(`Failed to clear rating: ${error.message}`);
  }
}

export async function getRatingsForMessages(
  messageIds: string[]
): Promise<Record<string, MessageRating>> {
  if (messageIds.length === 0) return {};

  const { data, error } = await supabase
    .from('message_ratings')
    .select('*')
    .in('message_id', messageIds);

  if (error) {
    throw new Error(`Failed to fetch ratings: ${error.message}`);
  }

  const map: Record<string, MessageRating> = {};
  for (const row of data ?? []) {
    map[row.message_id] = row as MessageRating;
  }
  return map;
}

export async function markRatingRegenerated(messageId: string): Promise<void> {
  const { error } = await supabase
    .from('message_ratings')
    .update({ regenerated: true, updated_at: new Date().toISOString() })
    .eq('message_id', messageId);

  if (error) {
    console.error('Failed to mark rating as regenerated:', error.message);
  }
}

export async function clearConversationMessages(
  userId: string,
  companionId: string
): Promise<void> {
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('user_id', userId)
    .eq('companion_id', companionId);

  if (error) {
    throw new Error(`Failed to clear conversation: ${error.message}`);
  }
}

export async function getDislikeSummaryForCompanion(
  companionId: string
): Promise<{ total: number; dislikes: number; recentDislikes: number }> {
  const { count: total, error: totalErr } = await supabase
    .from('message_ratings')
    .select('*', { count: 'exact', head: true })
    .eq('companion_id', companionId);

  const { count: dislikes, error: disErr } = await supabase
    .from('message_ratings')
    .select('*', { count: 'exact', head: true })
    .eq('companion_id', companionId)
    .eq('rating', 'dislike');

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count: recentDislikes, error: recentErr } = await supabase
    .from('message_ratings')
    .select('*', { count: 'exact', head: true })
    .eq('companion_id', companionId)
    .eq('rating', 'dislike')
    .gte('created_at', sevenDaysAgo);

  if (totalErr || disErr || recentErr) {
    throw new Error('Failed to fetch dislike summary');
  }

  return { total: total ?? 0, dislikes: dislikes ?? 0, recentDislikes: recentDislikes ?? 0 };
}

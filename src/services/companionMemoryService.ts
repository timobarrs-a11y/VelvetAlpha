import { supabase } from '../shared/supabase/client';

export interface CompanionMemory {
  id: string;
  date: string;
  summary: string;
  full_content: string;
  emotional_weight: number;
  tags: string[];
  memory_type: string;
  referenced_count: number;
}

export interface MemoryData {
  summary: string;
  full_content: string;
  emotional_weight: number;
  tags: string[];
}

export async function getRecentCompanionMemories(
  companionId: string,
  userId: string,
  days: number = 7
): Promise<CompanionMemory[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateString = startDate.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('companion_memory')
    .select('id, date, summary, full_content, emotional_weight, tags, memory_type, referenced_count')
    .eq('companion_id', companionId)
    .eq('user_id', userId)
    .gte('date', startDateString)
    .order('date', { ascending: false })
    .limit(7);

  if (error) {
    console.error('Error fetching recent companion memories:', error);
    return [];
  }

  return data || [];
}

export async function getSignificantMemories(
  companionId: string,
  userId: string,
  limit: number = 3
): Promise<CompanionMemory[]> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoString = sevenDaysAgo.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('companion_memory')
    .select('id, date, summary, full_content, emotional_weight, tags, memory_type, referenced_count')
    .eq('companion_id', companionId)
    .eq('user_id', userId)
    .gte('emotional_weight', 7)
    .lt('referenced_count', 3)
    .lt('date', sevenDaysAgoString)
    .limit(limit);

  if (error) {
    console.error('Error fetching significant memories:', error);
    return [];
  }

  if (!data || data.length === 0) {
    return [];
  }

  const shuffled = [...data].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, limit);
}

export function formatMemoriesForPrompt(
  recentMemories: CompanionMemory[],
  significantMemories: CompanionMemory[]
): string {
  let prompt = 'YOUR RECENT LIFE (what you\'ve been up to this past week):\n';

  if (recentMemories.length > 0) {
    recentMemories.forEach(memory => {
      prompt += `- ${memory.date}: ${memory.summary}\n`;
    });
  } else {
    prompt += '- No recent experiences recorded.\n';
  }

  if (significantMemories.length > 0) {
    prompt += '\nMEMORABLE MOMENTS FROM THE PAST (you can callback to these naturally, don\'t force them):\n';
    significantMemories.forEach(memory => {
      prompt += `- ${memory.date}: ${memory.summary}\n`;
    });
  }

  return prompt;
}

export async function incrementMemoryReference(memoryId: string): Promise<void> {
  const { error } = await supabase.rpc('increment_memory_reference', {
    memory_id: memoryId
  });

  if (error) {
    const { data: currentMemory } = await supabase
      .from('companion_memory')
      .select('referenced_count')
      .eq('id', memoryId)
      .maybeSingle();

    if (currentMemory) {
      const { error: updateError } = await supabase
        .from('companion_memory')
        .update({ referenced_count: (currentMemory.referenced_count || 0) + 1 })
        .eq('id', memoryId);

      if (updateError) {
        console.error('Error incrementing memory reference:', updateError);
      }
    }
  }
}

export async function storeConversationMemory(
  userId: string,
  companionId: string,
  memoryData: MemoryData
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  const summary = memoryData.summary.length > 200
    ? memoryData.summary.substring(0, 197) + '...'
    : memoryData.summary;

  const { error } = await supabase
    .from('companion_memory')
    .insert({
      user_id: userId,
      companion_id: companionId,
      date: today,
      memory_type: 'user_interaction',
      summary: summary,
      full_content: memoryData.full_content,
      emotional_weight: memoryData.emotional_weight,
      tags: memoryData.tags,
      referenced_count: 0
    });

  if (error) {
    console.error('Error storing conversation memory:', error);
  }
}

export async function cleanOldMemories(
  companionId: string,
  userId: string
): Promise<void> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoString = thirtyDaysAgo.toISOString().split('T')[0];

  const { error } = await supabase
    .from('companion_memory')
    .delete()
    .eq('companion_id', companionId)
    .eq('user_id', userId)
    .lt('emotional_weight', 3)
    .lt('date', thirtyDaysAgoString);

  if (error) {
    console.error('Error cleaning old memories:', error);
  } else {
    console.log('Successfully cleaned old low-significance memories');
  }
}

import { getCompanionMemory, getRecentMessages, needsSummarization } from './memoryService';
import { supabase } from '../shared/supabase/client';
import { SemanticMemoryService } from './semanticMemoryService';

interface AssembledContext {
  systemPrompt: string;
  messages: Array<{ role: string; content: string }>;
  shouldTriggerSummarization: boolean;
}

export async function assembleContext(
  userId: string,
  companionId: string,
  companionSystemPrompt: string,
  newUserMessage: string
): Promise<AssembledContext> {
  const memory = await getCompanionMemory(userId, companionId);

  const recentMessages = await getRecentMessages(userId, companionId, 30);

  const shouldTriggerSummarization = await needsSummarization(userId, companionId);

  let fullSystemPrompt = companionSystemPrompt;

  if (memory?.memory_text) {
    fullSystemPrompt += `\n\n[COMPANION MEMORY]\n${memory.memory_text}\n[END MEMORY]`;
  }

  // Add semantic memory context
  const semanticContext = await SemanticMemoryService.getEnrichedContext(
    userId,
    newUserMessage,
    10
  );

  if (semanticContext) {
    fullSystemPrompt += semanticContext;
  }

  const formattedMessages = recentMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  formattedMessages.push({
    role: 'user',
    content: newUserMessage,
  });

  return {
    systemPrompt: fullSystemPrompt,
    messages: formattedMessages,
    shouldTriggerSummarization,
  };
}

export async function triggerSummarizationIfNeeded(
  userId: string,
  companionId: string,
  shouldTrigger: boolean
): Promise<void> {
  if (!shouldTrigger) return;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  fetch(`${supabaseUrl}/functions/v1/summarize-memory`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ user_id: userId, companion_id: companionId }),
  }).catch((err) => console.error('Summarization trigger failed:', err));
}

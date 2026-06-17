import { getCompanionMemory, getRecentMessages, needsSummarization } from './memoryService';
import { supabase } from '../shared/supabase/client';

export interface SystemBlock {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
}

interface AssembledContext {
  systemPrompt: string;
  systemBlocks: SystemBlock[];
  messages: Array<{ role: string; content: string }>;
  shouldTriggerSummarization: boolean;
  cacheStats: {
    coreMemoryTokens: number;
    recollectionTokens: number;
    rollingWindowMessages: number;
  };
}

async function getActiveCoreMemory(
  userId: string,
  companionId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('core_memories')
    .select('content')
    .eq('user_id', userId)
    .eq('companion_id', companionId)
    .eq('validation_passed', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.content ?? null;
}

async function getEpisodicRecollections(
  userId: string,
  companionId: string,
  userMessage: string
): Promise<string | null> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return null;

    const embedRes = await fetch(`${supabaseUrl}/functions/v1/embed-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ text: userMessage }),
    });

    if (!embedRes.ok) return null;

    const { embedding } = await embedRes.json();
    if (!embedding) return null;

    const { data: matches } = await supabase.rpc('match_memories', {
      query_embedding: embedding,
      p_user_id: userId,
      p_companion_id: companionId,
      match_count: 5,
    });

    if (!matches || matches.length === 0) return null;

    const snippets = (matches as Array<{ summary: string; key_facts: string[] }>)
      .map((m) => {
        const facts = m.key_facts?.length ? `\n  - ${m.key_facts.join('\n  - ')}` : '';
        return `• ${m.summary}${facts}`;
      })
      .join('\n');

    return `\n\n<companion_recollections>\n${snippets}\n</companion_recollections>`;
  } catch {
    return null;
  }
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export async function assembleContext(
  userId: string,
  companionId: string,
  companionSystemPrompt: string,
  newUserMessage: string
): Promise<AssembledContext> {
  const [memory, recentMessages, shouldTriggerSummarization, coreMemory, episodicContext] =
    await Promise.all([
      getCompanionMemory(userId, companionId),
      getRecentMessages(userId, companionId, 30),
      needsSummarization(userId, companionId),
      getActiveCoreMemory(userId, companionId),
      getEpisodicRecollections(userId, companionId, newUserMessage),
    ]);

  // Build stable prefix (cached) — persona + rolling memory
  let stablePrefix = companionSystemPrompt;
  if (memory?.memory_text) {
    stablePrefix += `\n\n[COMPANION MEMORY]\n${memory.memory_text}\n[END MEMORY]`;
  }
  if (coreMemory) {
    stablePrefix += `\n\n[CORE MEMORY]\n${coreMemory}\n[END CORE MEMORY]`;
  }

  const systemBlocks: SystemBlock[] = [
    {
      type: 'text',
      text: stablePrefix,
      cache_control: { type: 'ephemeral' },
    },
  ];

  // Dynamic recollections — uncached, appended after cache breakpoint
  if (episodicContext) {
    systemBlocks.push({
      type: 'text',
      text: episodicContext,
    });
  }

  // Flat string for legacy callers
  const systemPrompt = systemBlocks.map((b) => b.text).join('');

  const formattedMessages = recentMessages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  formattedMessages.push({
    role: 'user',
    content: newUserMessage,
  });

  return {
    systemPrompt,
    systemBlocks,
    messages: formattedMessages,
    shouldTriggerSummarization,
    cacheStats: {
      coreMemoryTokens: estimateTokens(coreMemory ?? ''),
      recollectionTokens: estimateTokens(episodicContext ?? ''),
      rollingWindowMessages: recentMessages.length,
    },
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

export function triggerSessionSummary(
  userId: string,
  companionId: string,
  sessionKey?: string
): void {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  fetch(`${supabaseUrl}/functions/v1/summarize-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ user_id: userId, companion_id: companionId, session_key: sessionKey }),
  }).catch((err) => console.error('Session summary trigger failed:', err));
}

import { supabase } from '../shared/supabase/client';

interface ThreadMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ExtractedSignals {
  interests: string[];
  locations: string[];
  preferences: string[];
}

async function extractSignals(
  messages: ThreadMessage[],
  botType: 'atlas' | 'navi'
): Promise<ExtractedSignals> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || messages.length < 2) return { interests: [], locations: [], preferences: [] };

  const userMessages = messages
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join('\n');

  if (!userMessages.trim()) return { interests: [], locations: [], preferences: [] };

  const systemPrompt = botType === 'navi'
    ? `Extract from these user messages: locations mentioned, activity interests (e.g. bowling, hiking, concerts), and preferences. Return JSON only: {"interests":[],"locations":[],"preferences":[]}`
    : `Extract from these user messages: topics of interest, skills or domains they asked about, and preferences or goals. Return JSON only: {"interests":[],"locations":[],"preferences":[]}`;

  try {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: userMessages }],
        system: systemPrompt,
        maxTokens: 300,
        model: 'haiku',
      }),
    });

    if (!response.ok) return { interests: [], locations: [], preferences: [] };
    const data = await response.json();
    const text = data.content || data.message || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { interests: [], locations: [], preferences: [] };
    return JSON.parse(jsonMatch[0]) as ExtractedSignals;
  } catch {
    return { interests: [], locations: [], preferences: [] };
  }
}

export async function saveThreadSignals(
  userId: string,
  companionId: string,
  messages: ThreadMessage[],
  botType: 'atlas' | 'navi'
): Promise<void> {
  if (messages.length < 2) return;

  const signals = await extractSignals(messages, botType);
  const allInterests = [...signals.interests, ...signals.preferences].filter(Boolean);
  if (allInterests.length === 0 && signals.locations.length === 0) return;

  const { data: existing } = await supabase
    .from('companions')
    .select('hobbies, lifestyle_interests, interest_text')
    .eq('id', companionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!existing) return;

  const currentHobbies: string[] = existing.hobbies || [];
  const currentLifestyle: string[] = existing.lifestyle_interests || [];
  const merged = [...new Set([...currentHobbies, ...allInterests])].slice(0, 30);
  const mergedLifestyle = [...new Set([...currentLifestyle, ...signals.locations])].slice(0, 20);

  await supabase
    .from('companions')
    .update({
      hobbies: merged,
      lifestyle_interests: mergedLifestyle,
    })
    .eq('id', companionId)
    .eq('user_id', userId);
}

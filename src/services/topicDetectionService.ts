import Anthropic from '@anthropic-ai/sdk';

export interface TopicInfo {
  currentTopic: string;
  topicDuration: number;
  isQuestionPending: boolean;
  recentTopics: string[];
  conversationState: 'greeting' | 'casual' | 'deep' | 'emotional_support' | 'playful';
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
});

export async function detectTopic(recentMessages: Message[]): Promise<TopicInfo> {
  if (recentMessages.length === 0) {
    return {
      currentTopic: 'greeting',
      topicDuration: 0,
      isQuestionPending: false,
      recentTopics: [],
      conversationState: 'greeting',
    };
  }

  const lastFewMessages = recentMessages.slice(-6);

  const prompt = `Analyze this conversation and extract key information:

${lastFewMessages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')}

Provide a JSON response with:
1. currentTopic: What is being discussed right now? (1-5 words, e.g., "work stress", "weekend plans", "relationship advice")
2. topicDuration: How many messages have been about this topic? (count)
3. isQuestionPending: Did the assistant ask a question that hasn't been answered? (boolean)
4. recentTopics: List of topics discussed in last few messages (array of 1-3 word strings)
5. conversationState: Current vibe - "greeting", "casual", "deep", "emotional_support", or "playful"

Return ONLY valid JSON, no other text.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 300,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content.find(c => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in response');
    }

    const result = JSON.parse(textContent.text);

    return {
      currentTopic: result.currentTopic || 'general conversation',
      topicDuration: result.topicDuration || 1,
      isQuestionPending: result.isQuestionPending || false,
      recentTopics: result.recentTopics || [],
      conversationState: result.conversationState || 'casual',
    };
  } catch (error) {
    console.error('Topic detection failed:', error);

    const lastMessage = recentMessages[recentMessages.length - 1];
    const hasQuestion = lastMessage.role === 'assistant' && lastMessage.content.includes('?');

    return {
      currentTopic: 'conversation',
      topicDuration: 1,
      isQuestionPending: hasQuestion,
      recentTopics: [],
      conversationState: 'casual',
    };
  }
}

export function formatTopicContext(topicInfo: TopicInfo): string {
  const parts: string[] = [];

  if (topicInfo.currentTopic && topicInfo.currentTopic !== 'greeting') {
    parts.push(`CURRENT TOPIC: ${topicInfo.currentTopic}`);
    parts.push(`This topic has been discussed for ${topicInfo.topicDuration} message(s)`);
  }

  if (topicInfo.isQuestionPending) {
    parts.push('⚠️ IMPORTANT: You asked a question that they haven\'t answered yet. DO NOT change topics or ask new questions until they respond to your previous question.');
  }

  if (topicInfo.recentTopics.length > 0) {
    parts.push(`Recent topics: ${topicInfo.recentTopics.join(', ')}`);
  }

  if (topicInfo.conversationState) {
    const stateGuidance: Record<string, string> = {
      greeting: 'Keep it warm and welcoming, but don\'t overdo it',
      casual: 'Light and easy conversation - match their energy',
      deep: 'They want meaningful conversation - go deeper, ask thoughtful questions',
      emotional_support: 'They need support right now - be empathetic, validating, and present',
      playful: 'Fun and flirty energy - keep the banter going',
    };

    parts.push(`Conversation state: ${topicInfo.conversationState} - ${stateGuidance[topicInfo.conversationState]}`);
  }

  return parts.length > 0 ? `\n=== CONVERSATION CONTEXT ===\n${parts.join('\n')}\n` : '';
}
